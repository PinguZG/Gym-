# Hub – private Fitness-Tracking-Webapp (Prototyp)

SvelteKit 2 · Svelte 5 · TypeScript · Tailwind 4 · Drizzle + SQLite · Docker Compose + Caddy (HTTPS).
Mobile-first, Dark Mode, Neongrün. Einzelnutzer, aber alle Tabellen haben `user_id`.

## Schnellstart lokal (ohne Docker)
```bash
npm install
cp .env.example .env
npm run db:seed        # Demo-Daten + Nutzer demo@hub.local / demo1234 (nur Dev!)
npm run dev            # http://localhost:5173
```
Eigenen Nutzer anlegen: `npm run create-user -- du@example.com "langes-passwort"`.

## Start mit Docker
```bash
cp .env.example .env   # Secrets setzen (APPLE_INGEST_TOKEN, SYNC_SHARED_SECRET), HUB_DOMAIN, ORIGIN
docker compose up -d --build
```
Lokal: https://localhost (Caddy-eigene CA, Browserwarnung). Auf dem VPS: `HUB_DOMAIN=hub.deinedomain.de`,
`ORIGIN=https://hub.deinedomain.de`, DNS auf den VPS, Ports 80/443 offen – Zertifikat holt Caddy automatisch.
Nutzer im Container anlegen/Seed: `docker compose exec app node -e "..."` ist im Prototyp nicht vorbereitet → siehe „Nächste Schritte“.

## Aufbau
- `src/lib/server/db` Schema + Auto-Migration (`drizzle/`), `services/` Fachlogik, `auth/` Login/Session, `integrations/` Adapter
- `src/routes/(app)` geschützte Seiten, `(auth)` Login, `api/ingest/apple` Token-gesicherter Endpunkt
- `sync/` Python-Sidecar (FastAPI) für Garmin/Yazio/RENPHO, `docs/CONTRACT.md` Schnittstellen, `docs/INTEGRATIONS.md` Details

## Auth
E-Mail + Passwort (argon2id), Session-Cookie `hub_session` (HttpOnly, Secure, SameSite=Lax, 30 Tage sliding, DB speichert nur den SHA-256), Login-Rate-Limit (5 Fehlversuche / 15 min je IP+E-Mail, in-memory). Registrierung ist aus; nur mit `ALLOW_REGISTRATION=true`.

## Integrationen (Adapter, einzeln per `INTEGRATION_<ID>=off|mock|live`)
Im Prototyp alles `mock`. Zugangsdaten nur in `.env` (gitignored), nie im Code.

| Adapter | Quelle | Risiko |
|---|---|---|
| Apple Health | `POST /api/ingest/apple` (Bearer-Token), JSON der App „Health Auto Export“ | offiziell stabil; Exportformat kann sich ändern |
| Garmin | python-garminconnect (inoffiziell) | Login/MFA-Änderungen brechen es; selten abfragen (Cache ≥6 h, Backoff) |
| Yazio | inoffizielle API (saganos/yazio_public_api) | Stand nicht verifizierbar → live ist Stub, Fallback CSV-Import |
| RENPHO | renpho-api (inoffiziell, Alpha) | jung, Reverse-Engineering → Fallback Apple Health / CSV |

Genaueres: `docs/INTEGRATIONS.md`.

## Status
Siehe unten bzw. Abschlussbericht. Nicht getestet: `docker compose up` (Docker-Daemon in der Entwicklungsumgebung), echte Live-Adapter, Spracherkennung auf echtem Gerät.

## Review-Stand (Opus-Review, Prototyp)
Behoben: getrennte Env je Container, echte Client-IP hinter Caddy (`ADDRESS_HEADER`), Ingest-Token-Pflicht (≥32 Zeichen), Live-Sync nur für `HUB_OWNER_EMAIL`, Settings zeigt nur eigene Läufe.
Offen (vor Mehrbenutzer/Produktion): Sidecar-Zugangsdaten pro Nutzer, Rate-Limit auch für Register + pro IP, zusammengesetzte FKs (`user_id` konsistent), Indizes auf `sessions`, CSP mit Nonce statt `unsafe-inline`, PR-Neuberechnung nach Sync, Zeitzone pro Nutzer.
