"""Sync-Sidecar: kapselt inoffizielle Libs. Zugangsdaten NUR hier per Env.

Antwortformat = SyncResult aus src/lib/types.ts (camelCase, ms UTC):
  {"workouts": [...], "nutrition": [...], "body": [...]}
"""
import hmac
import json
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel

app = FastAPI(title="hub-sync", docs_url=None, redoc_url=None, openapi_url=None)

DATA = Path(os.environ.get("SYNC_DATA_DIR", "/data"))
CACHE_TTL = 6 * 3600  # Antworten >= 6 h cachen, um Provider zu schonen
BACKOFF_BASE = 3600   # nach Fehlern 1h, 2h, 4h ... (max 24h)


def empty() -> dict:
    return {"workouts": [], "nutrition": [], "body": []}


def mode() -> str:
    return os.environ.get("INTEGRATION", "live").lower()


def check_auth(x_sync_secret: str | None = Header(default=None)) -> None:
    secret = os.environ.get("SYNC_SHARED_SECRET", "")
    if not secret or not x_sync_secret or not hmac.compare_digest(
        x_sync_secret.encode(), secret.encode()
    ):
        raise HTTPException(status_code=401, detail="unauthorized")


class SyncReq(BaseModel):
    since: int | None = None  # ms UTC


# ---- Cache + Backoff (Datei-basiert, im Volume) ----
def _state_file(name: str) -> Path:
    return DATA / f"{name}-state.json"


def _read_state(name: str) -> dict:
    try:
        return json.loads(_state_file(name).read_text())
    except Exception:
        return {}


def _write_state(name: str, st: dict) -> None:
    try:
        DATA.mkdir(parents=True, exist_ok=True)
        _state_file(name).write_text(json.dumps(st))
    except OSError:
        pass


def cached_call(name: str, fn):
    st = _read_state(name)
    now = time.time()
    if st.get("result") and now - st.get("ok_at", 0) < CACHE_TTL:
        return st["result"]
    fails = st.get("fails", 0)
    if fails and now < st.get("fail_at", 0) + min(BACKOFF_BASE * 2 ** (fails - 1), 86400):
        raise HTTPException(status_code=429, detail=f"{name}: backoff nach {fails} Fehlern")
    try:
        result = fn()
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:  # inoffizielle Libs werfen alles Mögliche
        _write_state(name, {**st, "fails": fails + 1, "fail_at": now})
        raise HTTPException(status_code=502, detail=f"{name}: {type(e).__name__}")
    _write_state(name, {"result": result, "ok_at": now, "fails": 0})
    return result


def _ms(dt: datetime) -> int:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp() * 1000)


def _need(*names: str) -> list[str]:
    vals = [os.environ.get(n, "") for n in names]
    if not all(vals):
        raise HTTPException(status_code=503, detail=f"Env fehlt: {', '.join(names)}")
    return vals


# ---- Garmin (cyberjunky/python-garminconnect) ----
def garmin_fetch(since_ms: int | None) -> dict:
    from garminconnect import Garmin  # lazy: Mock-Betrieb braucht die Lib nicht

    email, password = _need("GARMIN_EMAIL", "GARMIN_PASSWORD")
    tokens = DATA / "garmin-tokens"
    tokens.mkdir(parents=True, exist_ok=True)
    client = Garmin(email, password)
    client.login(str(tokens))  # nutzt/erneuert Token-Cache -> kein Voll-Login pro Sync
    start = datetime.now(timezone.utc) - timedelta(days=7)
    if since_ms:
        start = max(start - timedelta(days=0), datetime.fromtimestamp(since_ms / 1000, timezone.utc) - timedelta(days=1))
    acts = client.get_activities_by_date(start.date().isoformat(), datetime.now(timezone.utc).date().isoformat())
    out = empty()
    for a in acts or []:
        aid = a.get("activityId")
        begin = a.get("startTimeGMT")
        if not aid or not begin:
            continue
        s = datetime.strptime(begin, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        dur = float(a.get("duration") or 0)
        dist = float(a.get("distance") or 0) / 1000
        name = a.get("activityName") or (a.get("activityType") or {}).get("typeKey", "Aktivität")
        title = f"{name} {dist:.1f} km" if dist > 0.1 else name
        out["workouts"].append({
            "externalId": f"garmin-{aid}", "startedAt": _ms(s),
            "endedAt": _ms(s) + int(dur * 1000), "title": title,
        })
    return out


# ---- RENPHO (danvaneijck/renpho-api) ----
def renpho_fetch(since_ms: int | None) -> dict:
    from renpho import RenphoClient

    email, password = _need("RENPHO_EMAIL", "RENPHO_PASSWORD")
    client = RenphoClient(email, password)
    client.login()
    out = empty()
    for m in client.get_all_measurements() or []:
        # Feldnamen laut Lib-README: weight, bodyfat, Zeitstempel je nach Version
        ts = m.get("timeStamp") or m.get("time_stamp") or m.get("createdAt")
        w = m.get("weight")
        if ts is None or w is None:
            continue
        ts = int(ts)
        ts_ms = ts * 1000 if ts < 10**11 else ts
        if since_ms and ts_ms < since_ms - 86400000:
            continue
        row = {"externalId": f"renpho-{ts_ms}", "measuredAt": ts_ms, "weightKg": float(w)}
        if m.get("bodyfat") is not None:
            row["bodyFatPct"] = float(m["bodyfat"])
        out["body"].append(row)
    return out


# ---- Yazio: Lib nicht verifizierbar -> Stub ----
def yazio_fetch(since_ms: int | None) -> dict:
    raise NotImplementedError(
        "Yazio-Live ist nicht implementiert (saganos/yazio_public_api nicht verifizierbar). "
        "Fallback: CSV-Import (docs/INTEGRATIONS.md) oder Apple-Health-Export."
    )


@app.get("/health")
def health() -> dict:
    return {"ok": True, "mode": mode()}


def _handle(name: str, fn, req: SyncReq) -> dict:
    if mode() == "mock":
        return empty()  # Mock liefert Node selbst; Sidecar nichts Echtes
    return cached_call(name, lambda: fn(req.since))


@app.post("/garmin", dependencies=[Depends(check_auth)])
def garmin(req: SyncReq) -> dict:
    return _handle("garmin", garmin_fetch, req)


@app.post("/yazio", dependencies=[Depends(check_auth)])
def yazio(req: SyncReq) -> dict:
    return _handle("yazio", yazio_fetch, req)


@app.post("/renpho", dependencies=[Depends(check_auth)])
def renpho(req: SyncReq) -> dict:
    return _handle("renpho", renpho_fetch, req)
