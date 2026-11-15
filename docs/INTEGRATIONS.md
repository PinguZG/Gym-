# Integrationen (WP5)

Modi je Provider per `INTEGRATION_<APPLE|GARMIN|YAZIO|RENPHO>=off|mock|live`.
`off` -> `runSync` wirft Fehler; `mock` -> deterministische Daten der letzten 7 Tage (kein Throttle); `live` -> Sidecar bzw. Push.

- Registry: `src/lib/server/integrations/registry.ts` (`integrationStatus()`, `runSync(userId, id)`), Upsert zentral in `upsert.ts` (UNIQUE user/source/external_id, Wiederholung erzeugt keine Duplikate).
- Live-Throttle: pro Provider max. 1 Sync / 6 h; nach Fehlern Backoff 1 h, 2 h, 4 h, ... (max. 24 h). Gedrosselte Versuche werden nicht in `integration_runs` geschrieben.
- Sidecar `sync/` (FastAPI, Port 8000, nur internes Docker-Netz, kein Port-Mapping): `GET /health`, `POST /garmin|/yazio|/renpho`, Header `X-Sync-Secret` (= `SYNC_SHARED_SECRET`, `hmac.compare_digest`). Antworten werden >= 6 h im Volume `/data` gecacht. Zugangsdaten (`GARMIN_*`, `YAZIO_*`, `RENPHO_*`) nur als Env des Sidecars, nie in Node. Mit `INTEGRATION=mock` liefert der Sidecar leere Ergebnisse. Garmin-Token-Cache: `/data/garmin-tokens` (Volume).

## Apple Health (Push)
`POST /api/ingest/apple` mit `Authorization: Bearer $APPLE_INGEST_TOKEN` (fehlt Token-Env -> 503; timing-safe Vergleich; max. 2 MB). Benutzer: `APPLE_INGEST_USER_EMAIL`, sonst erster User. Format Health Auto Export (JSON): `{"data":{"metrics":[{"name":"weight_body_mass","units":"kg|lb","data":[{"date":"2026-11-14 08:15:00 +0100","qty":81.2}]},{"name":"body_fat_percentage",...}],"workouts":[{"id","name","start","end"}]}}`. Unbekannte Metriken werden ignoriert; lb/st werden nach kg umgerechnet; Körperfett als Anteil (<=1) oder Prozent. Format defensiv geparst (nicht gegen die App geprüft).

## CSV-Import (Fallback)
Trenner `,` oder `;`, Dezimalkomma erlaubt, Kopfzeile Pflicht, idempotent.
- Yazio (`adapters/yazio.ts: importCsv(userId, text)`): `date,meal,name,kcal,protein,carbs,fat` (date `YYYY-MM-DD`, meal optional).
- RENPHO (`adapters/renpho.ts: importCsv(userId, text)`): `date,weight_kg,body_fat_pct` (date `YYYY-MM-DD` oder ISO-Zeit; Körperfett optional).

## Risiken inoffizieller Libs (Stand 2026-11-15)
Hinweis: GitHub-API war in der Recherche-Umgebung gesperrt; Stand nur über PyPI/Websuche, Issues nicht geprüft.
- **garminconnect** (cyberjunky/python-garminconnect): aktiv gepflegt, PyPI 0.3.20 vom 2026-10-23; inoffiziell, Garmin-SSO/Cloudflare/MFA-Änderungen können jederzeit brechen -> Token-Cache + 6 h Cache + Backoff.
- **Yazio** (saganos/yazio_public_api): Repo/Release-Stand nicht verifizierbar (kein PyPI-Paket gefunden) -> Live ist Stub (501 NotImplemented); Fallback CSV-Import oder Apple Health.
- **renpho-api** (danvaneijck/renpho-api): junges Projekt, PyPI 0.2.0 vom 2026-08-02, basiert auf Reverse-Engineering (RenphoGarminSync-CLI) der Renpho-Health-App; Backend-Änderungen brechen es leicht, Feldnamen im Sidecar defensiv gelesen und nicht live getestet -> Fallback CSV/Apple Health.
