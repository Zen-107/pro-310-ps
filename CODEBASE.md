# 📘 AI Physio — Codebase Documentation

> **สำหรับ developers ที่จะทำต่อ** — โครงสร้างโค้ด, API endpoints, database schema, สูตรคำนวณมุม, pipeline ของหน้าฝึก, การตั้งค่า และประวัติการพัฒนา
>
> ⚠️ This repo uses **Next.js 16** (see `AGENTS.md`): APIs and conventions differ from older versions — read `node_modules/next/dist/docs/` before writing framework code. Route handler `params` are a `Promise`.

---

## 🔧 Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Framework** | Next.js 16 (App Router, Turbopack) + React 19 + TypeScript 5 | `output: 'standalone'`; `typescript.ignoreBuildErrors` is on, so run `bun run typecheck` separately |
| **Styling** | Tailwind CSS 4 + shadcn/ui (Radix) | Theme tokens in `src/app/globals.css` (slate + teal clinical theme) |
| **State** | Zustand | Client state only (tab, live session counters) |
| **Database** | PostgreSQL + Prisma 6 (versioned migrations) | Local DB via `docker compose` |
| **Auth** | next-auth v4 (credentials, JWT) | Roles: `CLINICIAN`, `PATIENT`, `ADMIN` |
| **Computer Vision** | MediaPipe Pose (Web, CDN-pinned) | Runs on the patient's device; only landmarks leave it |
| **AI / LLM** | OpenAI-compatible Chat Completions via `fetch` (`src/lib/ai-agent.ts`) | Groq / Gemini / OpenRouter free tiers or any compatible server, automatic fallback |
| **Speech** | Server Thai TTS (`/api/tts`) → browser Web Speech → Web Audio chime | `src/lib/tts-server.ts`, `src/lib/speech.ts` |
| **Charts** | Recharts + hand-written SVG (replay, gauge) | |
| **PDF** | Print CSS + jsPDF / html2canvas-pro (one-click download) | `src/lib/report-pdf.ts` |
| **Package manager / runtime** | Bun (dev, scripts) · Node.js (standalone server) | |

---

## 🏗️ Project Structure

```
project-root/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Server entry: login required → TermsGate (until accepted) → AppShell
│   │   ├── login/page.tsx            # Email/password sign-in
│   │   ├── layout.tsx                # Fonts (Geist + Sarabun Thai), Toaster
│   │   ├── globals.css               # Theme tokens, print / PDF stylesheet
│   │   └── api/                      # Route handlers (see API reference)
│   │
│   ├── components/
│   │   ├── app-shell.tsx             # Role-based shell: header, tab nav, unread badge
│   │   ├── terms-gate.tsx            # Blocking terms / PDPA consent popup
│   │   ├── auth/login-form.tsx
│   │   ├── ui/                       # shadcn/ui primitives in use (badge, button, card, input, progress,
│   │   │                             #   scroll-area, select, separator, skeleton, sonner, switch, tabs, textarea)
│   │   └── physio/
│   │       ├── live-session-view.tsx     # Patient: quest picker → live camera session → summary
│   │       ├── exercise-demo.tsx         # Animated SVG demonstration of an exercise
│   │       ├── dashboard-view.tsx        # Patient: progress charts, streak, badges, today's quests
│   │       ├── exercises-view.tsx        # Patient: prescribed exercise library
│   │       ├── history-view.tsx          # Patient: past sessions
│   │       ├── care-chat.tsx             # Care-team chat + AI companion toggle (patient & clinician)
│   │       ├── doctor-overview.tsx       # Clinician: summary cards, alerts, review queue, patient cards
│   │       ├── review-queue.tsx          # Completed sessions awaiting sign-off
│   │       ├── doctor-patients.tsx       # Clinician: patient list/detail, HN, notes
│   │       ├── ai-insights-panel.tsx     # Clinician: multi-session trends + AI analysis
│   │       ├── doctor-plans.tsx          # Clinician: prescriptions and target overrides
│   │       ├── doctor-reports.tsx        # Clinician: tabbed session report, print, PDF download
│   │       ├── report-transparency.tsx   # Formulas, reps, faults, review panel, ClinicalSessionReplay
│   │       ├── report-print.tsx          # Official Thai A4 print document, AI-summary markdown
│   │       └── doctor-messages.tsx       # Clinician: message threads
│   │
│   ├── lib/
│   │   ├── auth.ts, auth-guard.ts, password.ts, access.ts   # next-auth config, API guards, scrypt, care-team scope
│   │   ├── db.ts, api-utils.ts, dates.ts, utils.ts          # Prisma singleton, JSON errors, Bangkok dates, cn()
│   │   ├── terms.ts, consent.ts                             # Terms/PDPA text + version; video consent text + version
│   │   ├── angle-utils.ts, joint-formulas.ts                # Angle engine + formula strings (angle-utils@5)
│   │   ├── landmark-smoother.ts                             # One Euro filter, visibility hysteresis, left/right swap fix
│   │   ├── rep-counter.ts, form-checks.ts                   # Reps, incomplete attempts, movement phase; compensation checks
│   │   ├── cue-gate.ts, coach-cues.ts                       # When a cue may be spoken; natural Thai phrases (no numbers)
│   │   ├── speech.ts, tts-server.ts                         # Client voice (server TTS → Web Speech → chime); server TTS
│   │   ├── ai-agent.ts, clinical-markdown.ts                # LLM providers + agents; AI-summary cleanup
│   │   ├── replay.ts                                        # Replay frame format and rig geometry
│   │   ├── session-video-recorder.ts, video-storage.ts      # Consented recording (client); chunk storage (server)
│   │   ├── report-pdf.ts                                    # One-click PDF of the print document
│   │   ├── exercises-data.ts, exercise-poses.ts             # Exercise catalogue (seed source); demo rig keyframes
│   │   ├── prescriptions.ts, quests.ts, patient-summary.ts  # Domain logic
│   │   ├── messages.ts, presenters.ts, text-safe.ts         # DTOs; display helpers; Thai-safe truncation
│   │   └── store.ts                                         # Zustand store
│   └── types/next-auth.d.ts
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/                   # Apply with `bun run db:migrate:deploy`
│   └── seed.ts                       # Demo organizations, users, exercises + citations (WIPES data)
├── scripts/copy-standalone-assets.mjs  # Post-build copy for the standalone server (cross-platform)
├── storage/                          # Runtime data: consented session videos (git-ignored, not in build output)
├── docker-compose.yml                # Local PostgreSQL
├── .env.example                      # All settings with explanations
├── AGENTS.md / CLAUDE.md             # Instructions for coding agents (generated by next dev)
└── README.md
```

---

## 🌐 API Reference

Every route requires a signed-in user (next-auth session cookie) **and acceptance of the current terms** (otherwise 403 `TERMS_REQUIRED`, except `/api/me/terms`). **Scope:** a PATIENT sees only their own data; a CLINICIAN sees patients they have a `CareAssignment` with. Records outside scope return **404** (IDs are not leaked); wrong role returns **403**. Guard new routes with `requireApiUser(roles?)` from `src/lib/auth-guard.ts`.

### Account & consent
- **GET /api/me** — signed-in user + clinician/patient profile
- **GET / POST /api/me/terms** (any role) — entry consent popup (`src/components/terms-gate.tsx`, text and `TERMS_VERSION` in `src/lib/terms.ts`). Until the current version is accepted, the home page renders only the popup and every other API route returns 403 `TERMS_REQUIRED`; `{ accept: true, version }` records it (also sets `Patient.consentAt`). Bumping `TERMS_VERSION` makes everyone accept again
- **GET / POST /api/me/video-consent** (PATIENT) — video-recording consent status; `{ consent: true|false }` gives (current `VIDEO_CONSENT_VERSION`, text in `src/lib/consent.ts`) or withdraws it
- **/api/auth/*** — next-auth (sign-in, sign-out, session, csrf)

### Exercises (any role)
- **GET /api/exercises** — PUBLISHED library with `targetJoints` (formula, isPrimary, rationale), `formChecks` and `references` (citations). Clinicians get the full library; **patients only their prescribed exercises**

### Patients (CLINICIAN, care team)
- **GET /api/patients** — care-team patients with summary stats
- **POST /api/patients** — register a patient in your organization (you become PRIMARY). `hn` optional (auto `yy-NNNNN` from the Buddhist-era year, unique per organization); optional `email` creates a login and returns a one-time `temporaryPassword`
- **GET /api/patients/[id]** — detail: summary, recent sessions, ROM per exercise, joint trends, care team (a PATIENT may read their own record without clinical notes/alerts)
- **PATCH /api/patients/[id]** — profile fields, `hn` and `clinicalNotes`
- **DELETE /api/patients/[id]** — archive (never hard-deleted)

### Clinician dashboard & AI analysis (CLINICIAN, care team)
- **GET /api/clinician/summary** — summary cards: sessions completed today, completed sessions awaiting review, red flags (patient-assistant escalations in the last 7 days, latest per patient)
- **GET /api/patients/[id]/ai-insights** — computed per-exercise trends over the last 20 completed sessions: accuracy/ROM slope, fault rate per rep (early vs recent half), top compensations, flags. No AI call
- **POST /api/patients/[id]/ai-insights** — same trends + AI clinical summary/recommendations (`aiError` set and trends still returned if the AI service fails)

### Prescriptions (CLINICIAN writes; PATIENT reads own)
- **GET /api/prescriptions?patientId=** — with items and merged targets
- **POST /api/prescriptions** — `{ patientId, title, notes?, startDate?, endDate?, items? }`
- **GET / PATCH / DELETE /api/prescriptions/[id]** — DELETE = cancel
- **POST /api/prescriptions/[id]/items** — `{ exerciseId, sets?, repsPerSet?, restSeconds?, daysOfWeek?, targetOverrides? }` (PUBLISHED exercises only; override joints must exist on the exercise; min ≤ ideal ≤ max)
- **PATCH / DELETE /api/prescriptions/[id]/items/[itemId]** — `targetOverrides` replaces all overrides

### Quests
- **GET /api/quests/today** (PATIENT) — today's quests, generated on demand from active prescriptions (Asia/Bangkok calendar); earlier unfinished quests become MISSED. Only PUBLISHED exercises appear
- **GET /api/quests?patientId=&days=14** — history + adherence %

### Sessions
- **GET /api/sessions?patientId=&status=&awaitingReview=true&limit=** — sessions in scope, with `faultCount`; `awaitingReview=true` = completed and not yet reviewed (clinician review queue)
- **POST /api/sessions** (PATIENT) — `{ questId }` only; free practice is disabled (`{ exerciseId }` → 403). Stores `prescriptionId`, `prescriptionItemId` and the prescribing `clinicianId`; snapshots merged targets, form checks, formulas and algorithm version; returns the exercise to run; moves a PENDING quest to IN_PROGRESS
- **GET /api/sessions/[id]** — metrics, target snapshot, reps, joint logs, review
- **PATCH /api/sessions/[id]** (owning PATIENT, once) — `{ status: COMPLETED|CANCELLED, totalReps, avgAccuracy, romMinAngle, romMaxAngle, primaryJoint }`; server sets `endedAt`, `romDegrees` and the quest status
- **POST /api/sessions/[id]/logs** (owning PATIENT) — `{ reps: [...], logs: [...], faults: [...] }`, ≤ 200 rows/request; logs and faults link to reps by `repNumber`; locked after review
- **POST /api/sessions/[id]/review** (CLINICIAN) — `{ status: APPROVED|NEEDS_ATTENTION, comment? }`
- **POST /api/sessions/[id]/frames** (owning PATIENT) — `{ seq, frames: ReplayFrame[] }` (≤ 100 frames, ~5 s per chunk, idempotent per `seq`); pose frames at 10 fps for clinical replay, format in `src/lib/replay.ts`; locked after review
- **GET /api/sessions/[id]/frames** — all recorded frames in time order (used by *Clinical Session Replay*)
- **POST /api/sessions/[id]/video?seq=&final=&startedAt=** (owning PATIENT) — session video chunk (raw `video/webm|mp4`, sequential `seq`, retries idempotent, ≤ 20 MB/chunk, 500 MB/session). **Refused (403) unless the patient has current video consent**; `X-Video-Pauses` on the final chunk syncs pauses with the replay. Files live in `VIDEO_STORAGE_DIR` (git-ignored), never under `public/`
- **GET /api/sessions/[id]/video** — stream with HTTP Range (seeking); `?meta=1` → `{ recordStartAt, pauses, complete, consentVersion }`. Care team or owning patient only

### Reports
- **GET /api/reports/[sessionId]** — metrics with explicit formulas (`angleDefinition`, `scoring`), targets (basis + rationale), per-joint and per-rep results, stored AI summary, review, plus print header data: `documentNumber` (`PT-<BE yyyymmdd>-<id suffix>`), patient (name, HN, age, gender, condition), organization, attending clinician (licence number), prescription title. AI summary and review comment are clinician-only
- **POST /api/reports/[sessionId]** (CLINICIAN) — generate + store an AI clinical summary (`summarizeSession`)

### Care-team chat & patient companion
- **GET /api/messages?patientId=&after=ISO** — messages in a patient's thread (patients: own thread). Marks the thread read for the caller
- **POST /api/messages** — `{ patientId?, body }` (≤ 2000 chars) to the care-team thread
- **GET /api/messages/threads** — threads in scope with last message and unread count
- **POST /api/messages/assistant** (PATIENT) — `{ body }` → AI companion answer; question (`ASSISTANT_QUESTION`) and reply (`ASSISTANT_REPLY`, no sender) are both stored in the thread. Red-flag symptoms get a fixed escalation reply (call 1669 / contact the care team) without calling the model (`escalated: true`). 20 questions/hour

### Live coaching (PATIENT)
- **POST /api/coach** — one natural Thai coaching cue. The model sees only qualitative joint states from `src/lib/coach-cues.ts`, never angle numbers; replies containing degrees/percentages are replaced by a deterministic cue
- **GET /api/tts?text=** — Thai speech (audio/mpeg), synthesised server-side so it works without a Thai voice on the device (`src/lib/tts-server.ts`: Google Translate TTS, Thai word-boundary chunking, in-memory cache, 200 requests / 10 min per user; `TTS_PROVIDER="off"` disables)

### Stats
- **GET /api/stats?patientId=&days=30** — `profile` (streak, totals), `dailyData`, `categoryData`, `romData`

---

## 💾 Database Schema

PostgreSQL via Prisma — full definition in [`prisma/schema.prisma`](prisma/schema.prisma).

```
Organization (HOSPITAL | CLINIC)
 ├─ Clinician (DOCTOR | PHYSIOTHERAPIST, licenseNumber) ── CareAssignment (PRIMARY | SUPPORTING) ──┐
 └─ Patient (hn unique per org, consentAt, videoConsentVersion/At) ────────────────────────────────┘
      ├─ Prescription (by a clinician)
      │    └─ PrescriptionItem (exercise, sets/reps/rest, daysOfWeek, PrescriptionTargetOverride[])
      │         └─ Quest (one per due day: PENDING | IN_PROGRESS | COMPLETED | MISSED)
      │              └─ ExerciseSession (targetSnapshot, algorithmVersion)
      │                   ├─ SessionRep → JointAngleLog
      │                   ├─ SessionFault (INCOMPLETE_ROM | COMPENSATION | LOW_ACCURACY)
      │                   ├─ SessionFrameChunk (replay frames, 10 fps)
      │                   ├─ SessionVideo (consented recording, pauses)
      │                   ├─ SessionReview (APPROVED | NEEDS_ATTENTION)
      │                   └─ ClinicalReport (stored AI summary)
      └─ CareMessage (CARE_TEAM | ASSISTANT_QUESTION | ASSISTANT_REPLY, escalated) · CareThreadRead

User (login: ADMIN | CLINICIAN | PATIENT, termsVersion/termsAcceptedAt) ── 1:1 ── Clinician / Patient

Exercise (DRAFT | PUBLISHED | RETIRED)
 ├─ ExerciseJointTarget (joint, ideal/min/max, isPrimary, formula, angleBasis, rationale)
 └─ ExerciseReference (EXACT | CLOSE | PARTIAL) ── ExerciseSource (citation + verification)
                                               └─ ReferenceMeasurement (ground-truth angles)
```

**Key rules**
- Only `PUBLISHED` exercises can be prescribed or appear in quests. An exercise is publishable when it has at least one `VERIFIED` source **and** its primary target is measurable (`formula` not null). The reason for a `DRAFT`/`RETIRED` is stored in `statusNote`.
- `angleBasis` records where a target came from (`DEVELOPER_ESTIMATE`, `SOURCE_STATED`, `GROUND_TRUTH_EXTRACTED`, `CLINICIAN_SET`). Seeded sources describe technique only, so seeded angles are `DEVELOPER_ESTIMATE`.
- Seeded citations are developer-verified (`verifiedByName = "VERIFIED BY DEV"`), not clinically reviewed. KIMORE and REHAB24-6 are seeded `PENDING`, so exercises citing only them stay `DRAFT`.
- `ExerciseSession.targetSnapshot` + `algorithmVersion` freeze the targets and formulas used, so later prescription edits never change past reports.
- Patients are archived (`archivedAt`), never hard-deleted. `streak` / total minutes are computed, not stored.
- Schema changes: edit `schema.prisma` → `bun run db:migrate` (dev) → commit the new folder in `prisma/migrations/`.

---

## 🔐 Authentication, consent & privacy

- **Credentials login** (email + password) at `/login`; scrypt hashes (`src/lib/password.ts`). Unknown emails still run a password check; `callbackUrl` only accepts same-site paths.
- **JWT sessions** (8 h, one clinic shift). The token carries `role`, `clinicianId`, `patientId`, `organizationId` (`src/lib/auth.ts`, types in `src/types/next-auth.d.ts`).
- **Pages:** `src/app/page.tsx` (server component) → no session: redirect to `/login`; terms not accepted: only `TermsGate`; otherwise `AppShell` with the role's tabs. Admin accounts have no screens yet.
- **Terms / PDPA gate:** versioned per user; enforced on the page and in `requireApiUser`.
- **Video consent:** separate, versioned, withdrawable; enforced server-side on upload. Videos are served only through the access-checked route and excluded from build tracing (`next.config.ts`).
- **What leaves the device:** pose landmarks, angles and session metrics (never camera images, unless video consent is given). Coaching phrases go to the AI provider and the TTS service without names or identifiers.

---

## 📐 Angle engine (`src/lib/angle-utils.ts`, `angle-utils@5`)

All joint angles use the vector dot product with the vertex at B:

```
θ = arccos( (A − B) · (C − B) / (|A − B| · |C − B|) )     cosine clipped to [−1, 1]
```

- **3D world landmarks** (metres) are used when MediaPipe provides them; otherwise image landmarks with x × aspect ratio (2D). Normalized x/y/z are never mixed.
- Measurements whose landmarks have `visibility < 0.5`, or zero-length vectors, are **omitted** (never reported as 0°).
- Every formula string lives in `src/lib/joint-formulas.ts` and is stored on each target and session snapshot.

| Measurement | Formula | Used by |
|---|---|---|
| `left/right_knee` | angle(hip, knee, ankle) | Knee Flexion, Wall Squat, Squat, Forward/Side Lunge |
| `left/right_shoulder` | angle(hip, shoulder, elbow) | Shoulder Flexion/Abduction, Arm Circles |
| `left/right_elbow` | angle(shoulder, elbow, wrist) | form checks |
| `left/right_hip_abduction` | angle(other hip, hip, knee) − 90 | Standing Hip Abduction |
| `trunk_lateral_flexion` | trunk vector vs vertical, frontal plane | Trunk Lateral Flexion, form checks |
| `trunk_inclination` | trunk vector vs vertical, 3D | form checks (lean) |
| `trunk_rotation` | shoulder line vs hip line, transverse plane (world landmarks only) | Trunk Rotation |
| `left/right_hip`, `left/right_hip_flexion`, `hip_opening` | see `joint-formulas.ts` | none (lying exercises were retired); kept for old sessions |

**Catalogue** (`src/lib/exercises-data.ts`, seeded by `prisma/seed.ts`): standing or sitting exercises a single webcam can see. Published: Knee Flexion, Wall Squat, Squat, Shoulder Flexion, Shoulder Abduction, Arm Circles. Draft (pending source verification): Trunk Lateral Flexion, Trunk Rotation, Forward Lunge, Side Lunge, Standing Hip Abduction. Floor/lying exercises (straight leg raise, hip bridge, clamshell) were removed and are `RETIRED` in existing databases.

**Scoring:** in range = correct; accuracy = max(0, 100 − deviation/tolerance × 50), tolerance = (max − min)/2. **ROM** = max − min of the side that moved most.

**Targets** are developer estimates bounded by normative ROM (Physiopedia; Soucie et al., *Haemophilia* 2011), with reasoning in `ExerciseJointTarget.rationale` — **pending clinician review**.

---

## 🎥 Live session pipeline (`src/components/physio/live-session-view.tsx`)

1. **Start** — patient picks one of today's quests → `POST /api/sessions`. The click unlocks audio (`unlockAudio`), Focus Mode collapses the info panel.
2. **Camera + model** — `getUserMedia` (640×480) opens first; MediaPipe Pose loads from `cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/` (loader and `locateFile` must use the same version; 60 s init timeout).
3. **Inference loop** — paced by `requestVideoFrameCallback` (one `pose.send()` per new camera frame, rAF fallback), skipping frames while one is in flight. `onResults` is registered once and dispatches through a ref.
4. **Smoothing** (`landmark-smoother.ts`) — out-of-frame landmarks dropped; left/right label swaps corrected per body half by a continuity check (reset when facing the camera); One Euro filter (min cutoff 1 Hz, β 5, d-cutoff 2 Hz); visibility hysteresis 0.65 / 0.5.
5. **Angles** — `calculateAllAngles(image, { aspect, world })`; `liveAngles` pushed to the store at most every 100 ms.
6. **Rendering** — a separate rAF render loop draws the latest skeleton only when it changed: dark halo, neutral body, status-coloured gradients + glow on measured joints. The HUD shows reps, sets and a target-ROM gauge in large type; the current cue appears in a large banner.
7. **Reps & faults** (`rep-counter.ts`, `form-checks.ts`) — a rep = enter range → hold ≥ 300 ms → leave by 5°, scored on the best angle; left and right within 800 ms count once. `INCOMPLETE_ROM` (moved ≥ 10° toward the range and returned), `COMPENSATION` (form check failed), `LOW_ACCURACY` (< 60%) become `SessionFault` rows.
8. **Spoken feedback** — gated by movement phase (`RepCounter.motion()`: rest / moving / hold / returning) in `cue-gate.ts`:
   - posture corrections checked live, spoken only while moving/holding, fault must persist 400 ms;
   - nothing during the return or for 2.5 s after a rep; ≥ 2.5 s between cues, 6 s before the same cue repeats;
   - "range not reached" waits until the patient is back at rest; AI coach (`POST /api/coach`, ≤ every 8 s) only during the movement or after 15 s of silence at rest.
   - `speakThai` never queues: a new cue flushes the old one (coach never cuts a correction short), cues not started within 1.5 s are dropped, playback 1.15× with pitch preserved.
9. **Logging** — reps, joint logs and faults buffered and flushed to `/logs` every 5 s or at 20 rows (≤ 200 per request); replay frames at 10 fps to `/frames`; consented video in 5 s chunks to `/video`. Leaving mid-session flushes with `keepalive` and saves the session as CANCELLED.
10. **Finish** — `PATCH /api/sessions/[id]` with metrics → summary screen.

---

## 📄 Clinical report (`doctor-reports.tsx`)

- **Tabs:** สรุปและรับรองผล (AI summary + review) · ข้อมูลเซสชัน (joint table, formulas, reps, faults) · กราฟมุมข้อต่อ (`ClinicalSessionReplay view="chart"`) · วิดีโอและรีเพลย์ (`view="replay"`: video synced with the reconstructed rig, timeline, speed, jump to fault).
- **AI summary:** `summarizeSession` prompt forbids headers/tables/identifiers; `clinical-markdown.ts` cleans stored output (snake_case ids → Thai names, fault codes, formulas) before rendering.
- **Print:** `ReportPrintDocument` (`report-print.tsx`) is the official Thai A4 layout; `@media print` in `globals.css` prints only `[data-print-root]`.
- **Download PDF** (primary action): `report-pdf.ts` renders the same document off-screen with html2canvas-pro, breaks pages between rows/paragraphs (never through text) and saves with jsPDF as `printresult_<last 6 of session id>_<patient name>.pdf`. The PDF is an image (text not selectable); printing to PDF keeps selectable text.

---

## 🤖 AI agent (`src/lib/ai-agent.ts`)

- **Providers:** configured by API keys in `.env`; `AI_PROVIDER` picks the first to try, the rest are fallbacks. Defaults: Groq `openai/gpt-oss-120b`, Gemini `gemini-3.8-flash`, OpenRouter `openrouter/free`, OpenAI-compatible `gpt-4o-mini` (`OPENAI_BASE_URL` for Ollama/vLLM etc.). `complete()` throws `AiUnavailableError` when all fail; every caller has a non-AI fallback.
- **Agents:** session summary (`summarizeSession`), multi-session trends (`computeFaultTrends` / `analyzePatientTrends`), patient companion (`companionReply`, Kisner & Colby principles, Thai red-flag detection → fixed escalation reply), live coach (`/api/coach`).

---

## ⚙️ Configuration (`.env`, documented in `.env.example`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection |
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET` | next-auth (`openssl rand -base64 32`) |
| `SEED_DEMO_PASSWORD` | Password for seeded demo accounts |
| `AI_PROVIDER` | `groq` \| `gemini` \| `openrouter` \| `openai` — tried first |
| `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY` (+ `*_MODEL`, `OPENAI_BASE_URL`) | AI providers (any subset) |
| `AI_REASONING_EFFORT`, `AI_TIMEOUT_MS` | Optional AI tuning |
| `TTS_PROVIDER` | `google` (default) or `off` (browser voice only) |
| `VIDEO_STORAGE_DIR` | Where consented videos are stored (default `storage/session-videos`) |

Never commit `.env`; keys belong only there.

---

## 🚀 Getting Started

### Prerequisites
- **Bun 1.x** (Node.js 20+ for the production server)
- **Docker Desktop** (local PostgreSQL)
- Browser with a webcam (Chrome / Edge recommended)

### Install & run
```bash
bun install                 # also runs `prisma generate`
cp .env.example .env        # set NEXTAUTH_SECRET and at least one AI key

bun run db:up               # local PostgreSQL (docker compose)
bun run db:migrate:deploy   # apply migrations
bun run db:seed             # demo data — WIPES the database

bun run dev                 # http://localhost:3000
```

Demo accounts (password = `SEED_DEMO_PASSWORD`, default `physio-demo-2026`): `admin@`, `doctor@`, `pt@`, `pt2@`, `patient1@`, `patient2@`, `patient3@` + `demo.aiphysio.local`. Each user must accept the terms popup on first entry.

### Checks & production build
```bash
bun run typecheck           # tsc --noEmit (the build does not type-check)
bun run lint
bun run build               # next build + copy static assets into .next/standalone
bun run start               # production server (run db:migrate:deploy against the production DB first)
```

### Database commands
```bash
bun run db:up              # start local Postgres
bun run db:migrate         # create a migration after editing schema.prisma (dev)
bun run db:migrate:deploy  # apply pending migrations (CI / production)
bun run db:seed            # reset + seed demo data (refuses when NODE_ENV=production)
bun run db:reset           # drop, re-migrate and re-seed (caution!)
bun run db:studio          # browse data
```

---

## 🧪 Testing & troubleshooting

**Manual end-to-end check:** sign in as `patient3@…` → accept terms → เริ่มฝึก → start a quest → stand back so the whole body is visible → complete reps (listen for the coach) → sign in as `doctor@…` → รายงาน → pick the patient and session → check each tab → ดาวน์โหลด PDF.

There is no automated test suite yet. The angle engine, smoother, rep counter and cue gate are framework-free and can be exercised directly with `bun` scripts (feed synthetic landmark/angle sequences).

| Issue | Check |
|---|---|
| Camera not working | Browser camera permission; another app using the camera; HTTPS or `localhost` required |
| "ยังไม่ได้รับผลตรวจจับจาก AI" | MediaPipe loads from jsDelivr — needs internet; enough light; whole body in frame |
| Coach silent / only a chime | Sound toggle on; server TTS reachable (`/api/tts`); `TTS_PROVIDER` not `off`. Chime = neither server TTS nor a browser Thai voice worked |
| AI summary / coach fails | At least one valid AI key in `.env`; provider quota; the app falls back to built-in cues |
| Every API call returns 403 `TERMS_REQUIRED` | The user hasn't accepted the current `TERMS_VERSION` |
| `prisma generate` EPERM on Windows | The running dev server locks the query engine DLL — stop `bun run dev`, regenerate, restart |
| Exercise missing from quests | Only `PUBLISHED` exercises appear; check `status` / `statusNote` |

---

## 🧭 Development History

| Phase | Commit(s) | What was built |
|---|---|---|
| 0. Prototype | `3badfd0a`, `6a55d8d6`, `aaa37820`, `c71f4d37` | MediaPipe pipeline fixes (stale closure, selfieMode mirroring), 3D dot-product angle engine for all exercises |
| 1. Backend & data | `e35a3d42`, `c9cc1e0b`, `82ab8015`, `9ad8cefc` | PostgreSQL schema + baseline migration + cited seed; next-auth roles; role-guarded, care-team-scoped API; prescription → quest workflow; dashboards on the new API; left/right rep counting |
| 2. Measurement quality | `c06830b9`, `76baf69b`, `7928f67b` | Catalogue trimmed to reliably tracked joints; landmark smoothing; form-fault detection; sessions linked to prescriptions; care-team chat; demo rig; review queue |
| 3. Clinical evidence & AI | `c7623979` | Clinical Session Replay; KIMORE/REHAB24-6 exercises (draft); trunk measures; free-tier multi-provider AI agent (summary, trends, patient companion); Thai-safe text |
| 4. Session UX & reports | `a0191019` | Capped side panel + mute; natural Thai coaching without numbers; print/PDF; consented video recording |
| 5. Accuracy & documents | `57df057f` | Thai voice ranking + chime fallback; official Thai A4 report with HN; left/right swap correction, One Euro filter, rAF render loop |
| 6. Voice & consent | `85c8c433` | Server Thai TTS; blocking terms/PDPA gate (page + API); one-click PDF; standing/sitting-only catalogue; Squat demo |
| 7. Cue timing | `868c982c` | Movement-phase gating, cooldowns, faster non-stacking speech |
| 8. UI/UX | `89e42ffa` | Focus Mode HUD, clinician summary cards, tabbed report, slate/teal theme, touch targets |

### Known limitations / next steps
- **Clinical validation:** target angles, compensation thresholds, coaching phrases and the consent text need review by a physiotherapist; KIMORE / REHAB24-6 sources need verification before those exercises can be published.
- **Predictive analytics** (recovery forecast, plateau alerts) — not implemented; trends are descriptive only.
- **TTS dependency:** the server voice uses Google's unofficial Translate TTS endpoint (may be blocked or change). Consider an official TTS API for production.
- **PDF download** is rasterised (not selectable text).
- **No automated tests**; no admin screens; no offline mode; mobile packaging (PWA/Capacitor) and Play Store preparation not started.
- **Production:** set up encrypted, backed-up storage and a retention policy for videos (`VIDEO_STORAGE_DIR`); move the in-memory TTS cache and rate limits to shared storage if running more than one server instance.

---

## 🎯 Architecture Decisions

- **Angles on the device, not the server** — no video upload needed (PDPA), no round-trip latency.
- **MediaPipe + geometry instead of a custom model** — no labelling; explicit formulas make every reported number explainable and auditable (`algorithmVersion`, `targetSnapshot`).
- **The coach never sees numbers** — qualitative states keep the LLM from reading out degrees and keep phrasing natural; deterministic cues cover AI outages.
- **Free-tier AI via plain `fetch`** — no vendor SDK; any OpenAI-compatible endpoint works; automatic fallback.
- **PostgreSQL + Prisma migrations** — same database in development and production; native enums/arrays for the quest/prescription model.
- **Zustand** — small client state (tabs, live counters) without providers; the per-frame pipeline writes via `getState()` to avoid re-renders.

## 🔗 External Resources
- MediaPipe Pose: https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
- Next.js: https://nextjs.org · Prisma: https://www.prisma.io · shadcn/ui: https://ui.shadcn.com · Recharts: https://recharts.org
- KIMORE dataset: https://vrai.dii.univpm.it/content/kimore-dataset
- One Euro filter: Casiez, Roussel & Vogel, CHI 2012

---

**Last updated:** 2026-10-05 · **Version:** 0.3.0-dev · **Branch:** `ai-physio`
