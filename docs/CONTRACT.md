# Schnittstellen-Vertrag (eingefroren, WP0)

Stack: SvelteKit 2 + Svelte 5 (Runes) + TS, Tailwind v4 (siehe src/app.css Klassen: .card .btn .btn-ghost .input .label .big .glow),
Drizzle + better-sqlite3 (`import { db, schema } from '$lib/server/db'`), Typen in `$lib/types`.
Zeiten: ms UTC (integer). Datum: 'YYYY-MM-DD' (lokale Zeitzone Europe/Berlin für "heute"/Wochen, Woche beginnt Montag).
Jede Service-Funktion bekommt `userId` als ersten Parameter und filtert IMMER nach user_id.
Locals: `event.locals.user: {id,email}|null` (gesetzt von hooks.server.ts, WP1).

## Services (WP2/WP3 implementieren, WP4 konsumiert) – alle async NICHT nötig, synchron ist ok (better-sqlite3)
src/lib/server/services/training.ts
- listExercises(userId): {id,name,primaryMuscle}[]
- createExercise(userId, {name, primaryMuscle, secondaryMuscles?}): {id}
- startWorkout(userId, {title?}): {id}   // startedAt=now
- finishWorkout(userId, workoutId): void
- getWorkout(userId, id): {id,title,startedAt,endedAt,note, exercises:{exerciseId,name,sets:{id,idx,weightKg,reps,rpe,isWarmup}[]}[]} | null
- listWorkouts(userId, limit=20): {id,title,startedAt,endedAt,setCount,volume}[]
- addSet(userId, workoutId, {exerciseId, weightKg, reps, rpe?, isWarmup?}): {id, newPRs: PR[]}   // aktualisiert personal_records
- deleteSet(userId, setId): void
- suggestSet(userId, exerciseId): SuggestedSet   // letztes Training; wenn alle Arbeitssätze >= Ziel-Wdh (oder RPE<=8): +2.5 kg (Kurzhantel/Isolation +1.25 egal, einfach +2.5), sonst gleiche Last; hint z.B. "wie letztes Mal – heute sind +2,5 kg drin"
- progression(userId, exerciseId, days=180): ProgressionPoint[]
- prs(userId, limit=10): PR[]   // neueste/aktuelle Bestleistungen (kind=est_1rm bevorzugt)
- weeklySetsByMuscle(userId, weeks=1): WeeklyMuscleSets[]  // ohne Aufwärmsätze, primär=1 Satz, sekundär nicht zählen
- parseVoiceSet(userId, text): {exerciseId,exerciseName,weightKg,reps}|null  // "Kniebeuge 4x8 80 kg" -> sets=4 (siehe addVoiceSets)
- addVoiceSets(userId, workoutId, text): {added:number}

src/lib/server/services/nutrition.ts
- dayNutrition(userId, date): DayNutrition
- rangeNutrition(userId, fromDate, toDate): DayNutrition[]  // lückenlos, 0 für leere Tage
- listEntries(userId, date): {id,meal,name,kcal,protein,carbs,fat}[]
- addEntry(userId, {date,meal?,name,kcal,protein,carbs,fat}): {id}
- deleteEntry(userId, id): void
- proteinTarget(userId): {perKg:number, weightKg:number|null, grams:number|null}  // users.protein_g_per_kg * letztes Gewicht

src/lib/server/services/body.ts
- addMetric(userId, {date, weightKg?, bodyFatPct?}): {id}
- bodySeries(userId, days=90): BodyPoint[]
- latestBody(userId): {weightKg,bodyFatPct,date}|null

src/lib/server/services/goals.ts
- listGoals(userId): GoalProgress[]   // Fortschritt live berechnet (Woche=Mo-So, Monat=Kalendermonat)
- createGoal(userId, {metric, period, target, label?}): {id}
- deleteGoal(userId, id): void

src/lib/server/services/dashboard.ts
- dashboard(userId): { today:{kcal,protein,proteinTarget,workoutDone:boolean,weightKg}, week:{workouts,sets,volume,muscles:Record<MuscleGroup,number>, nutritionDays:DayNutrition[]}, month:{workouts,avgProtein,weightDelta:number|null}, goals:GoalProgress[], prs:PR[], lastWorkout:{...}|null }

## Seed (WP2/3 Autor): scripts/seed.ts  (npm run db:seed)
Legt Demo-User an (E-Mail/Passwort aus SEED_EMAIL / SEED_PASSWORD, Default demo@hub.local / demo1234 – nur Dev) + ~8 Wochen realistische Daten:
3-4 Trainings/Woche (Push/Pull/Legs), ~25 Übungen mit Muskelgruppen, steigende Gewichte, Ernährung täglich (~2600 kcal, 150-170 g Eiweiß), Gewicht ~82→80,5 kg, KFA 17→15,5 %, Ziele (4 Trainings/Wo, 160 g Eiweiß/Tag, Zielgewicht 78). Idempotent (löscht Demo-User-Daten vorher).

## Auth (WP1)
src/lib/server/auth/{password,session,ratelimit}.ts, src/hooks.server.ts, src/routes/(auth)/login/*, src/routes/(auth)/logout, optional register (nur wenn ALLOW_REGISTRATION=true), scripts/create-user.ts.
Exports: hashPassword, verifyPassword, createSession(userId, ip, ua)->{token,expiresAt}, validateSession(token)->{user,...}|null, invalidateSession(id).
Cookie `hub_session`: HttpOnly, Secure (nicht auf http://localhost), SameSite=Lax, Path=/, 30d sliding. DB speichert sha256(token). Login-Rate-Limit 5 Fehlversuche/15 min je IP+E-Mail, Dummy-Verify bei unbekannter E-Mail.
Security-Header in hooks (CSP default-src 'self', frame-ancestors 'none', X-Content-Type-Options, Referrer-Policy). Routen unter (app) schützt (app)/+layout.server.ts (WP4): `if(!locals.user) redirect(303,'/login')`.
Öffentlich: /login, /logout, /api/ingest/* (eigene Token-Auth), /healthz (200 'ok').

## Integrationen (WP5)
src/lib/server/integrations/{types,registry,upsert,mock}.ts + adapters/{apple,garmin,yazio,renpho}.ts, src/routes/api/ingest/apple/+server.ts, src/routes/(app)/settings/integrations: NICHT anlegen (gehört WP4); WP5 exportiert stattdessen
`integrationStatus(): {id,label,mode,lastRun:{at,status,items}|null,risk:string}[]` und `runSync(userId, id): Promise<{items:number}>` aus registry.ts. sync/ = Python-FastAPI-Sidecar.

## UI (WP4)
Root-Layout src/routes/+layout.svelte (importiert ../app.css), (app)/+layout.svelte mit Bottom-Tab-Nav (Dashboard, Training, Essen, Körper, Ziele) + Settings/Integrationen über Link. Charts als eigene schlanke SVG-Komponenten (keine Chart-Lib).
Seiten: (app)/dashboard (Startseite, `/` redirectet dorthin), workouts (Liste + Neu), workouts/[id] (Live-Logging mit Satz-Vorschlag, Sprach-Button), exercises/[id] (Progression-Chart + PRs), nutrition, body, goals, settings (Integrationen-Status + "Sync jetzt").
