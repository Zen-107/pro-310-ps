# 📘 AI Physio — Complete Codebase Documentation

> **สำหรับ developers ที่จะทำต่อ** — คู่มือเข้าใจโครงสร้างโค้ดทั้งหมด, API endpoints, database schema, และวิธีการรันเว็บ

---

## 🏗️ Project Architecture & Code Structure

### 📁 Folder Structure

```
project-root/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                 # Server entry: requires login, renders AppShell by role
│   │   ├── login/page.tsx           # Email/password sign-in
│   │   ├── layout.tsx               # Global layout + metadata
│   │   ├── globals.css              # Global styles
│   │   └── api/                     # API routes (all require login; role + care-team scoped)
│   │       ├── auth/[...nextauth]/  # next-auth
│   │       ├── me/                  # GET: signed-in profile
│   │       ├── exercises/           # GET: published library (targets, formulas, citations)
│   │       ├── patients/            # GET/POST (clinician)  · [id]/ GET/PATCH/DELETE(archive)
│   │       ├── prescriptions/       # GET/POST · [id]/ · [id]/items/ · [id]/items/[itemId]/
│   │       ├── quests/              # GET history · today/ GET (patient, generated on demand)
│   │       ├── sessions/            # GET/POST · [id]/ GET/PATCH · [id]/logs/ · [id]/review/
│   │       ├── reports/[sessionId]/ # GET metrics+formulas · POST AI summary (stored)
│   │       ├── stats/               # GET progress statistics
│   │       ├── coach/               # AI coach feedback (patient; speech via browser Web Speech API)
│   │       └── route.ts             # Root API health check
│   │
│   ├── components/
│   │   ├── ui/                      # shadcn/ui primitives actually in use (add more via `bunx shadcn add <name>`)
│   │   │   ├── badge.tsx, button.tsx, card.tsx, progress.tsx, scroll-area.tsx
│   │   │   ├── select.tsx, separator.tsx, skeleton.tsx, switch.tsx, textarea.tsx
│   │   │   └── sonner.tsx           # Toaster for `toast()` from 'sonner' (mounted in layout.tsx)
│   │   │
│   │   └── physio/                  # Custom physio app components
│   │       ├── live-session-view.tsx       # Screen: Live camera + skeleton overlay + real-time angle feedback
│   │       ├── dashboard-view.tsx          # Screen: Patient progress, stats, streak, badges
│   │       ├── exercises-view.tsx          # Screen: Browse & filter exercises by category
│   │       ├── history-view.tsx            # Screen: Past sessions & session details
│   │       ├── doctor-overview.tsx         # Screen: Doctor sees all patients + alerts
│   │       ├── doctor-patients.tsx         # Screen: Doctor manages patient list
│   │       ├── doctor-reports.tsx          # Screen: View clinical reports
│   │       └── doctor-plans.tsx            # Screen: Manage exercise prescriptions
│   │
│   ├── lib/                         # Utility functions & shared logic
│   │   ├── store.ts                # Zustand global state (role, activeTab, sessionData, etc.)
│   │   ├── db.ts                   # Prisma client singleton
│   │   ├── angle-utils.ts          # Core math: angle calculation, ROM check, accuracy scoring + accuracy color helpers
│   │   ├── exercises-data.ts       # Exercise library, CATEGORIES/DIFFICULTY labels, exerciseIdFromName()
│   │   └── utils.ts                # General utilities (cn)
│
├── prisma/
│   ├── schema.prisma               # Database schema (PostgreSQL)
│   ├── migrations/                 # Versioned SQL migrations
│   └── seed.ts                     # Demo data + exercise citations (bun run db:seed)
│
├── docker-compose.yml               # Local PostgreSQL
│
├── public/                          # Static assets
│   └── logo.svg                    # (MediaPipe Pose is loaded from jsDelivr, pinned version)
│
├── .env                             # Environment variables
├── package.json                    # Dependencies & scripts
├── next.config.ts                  # Next.js config
├── tsconfig.json                   # TypeScript config
├── tailwind.config.ts              # Tailwind CSS config
├── eslint.config.mjs               # ESLint config
└── README.md                       # Project overview
```

---

## 🔧 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 + React 18 | Full-stack web framework |
| **Styling** | Tailwind CSS + shadcn/ui | Component library & styling |
| **State** | Zustand | Client-side state management |
| **Database** | PostgreSQL + Prisma ORM (migrations) | Persistent data storage |
| **Computer Vision** | MediaPipe (Web) | Pose detection & skeleton tracking |
| **Math** | Vector algebra (JavaScript) | Angle calculation & ROM validation |
| **AI/LLM** | OpenAI-compatible Chat Completions via `fetch` (Gemini / Groq / OpenRouter free tiers, or any compatible server) — `src/lib/ai-agent.ts` | Coach feedback, clinical reports, trend analysis, patient companion |
| **Charts** | Recharts | Time-series data visualization |
| **Package Manager** | Bun | Fast dependency management |
| **Runtime** | Node.js + Next.js standalone | Production deployment |

---

## 🌐 API Endpoints Quick Reference

Every route requires a signed-in user (next-auth session cookie). **Scope:** a PATIENT sees only their own data; a CLINICIAN sees patients they have a `CareAssignment` with. Records outside scope return **404** (IDs are not leaked); wrong role returns **403**.

### Account
- **GET /api/me** — signed-in user + clinician/patient profile
- **GET / POST /api/me/terms** (any role) — entry consent popup (`src/components/terms-gate.tsx`, text and `TERMS_VERSION` in `src/lib/terms.ts`). Until the current version is accepted, the home page renders only the popup and every other API route returns 403 `TERMS_REQUIRED` (`requireApiUser`); `{ accept: true, version }` records it (also sets `Patient.consentAt`)
- **GET / POST /api/me/video-consent** (PATIENT) — video-recording consent status; `{ consent: true|false }` gives (current `VIDEO_CONSENT_VERSION`, text in `src/lib/consent.ts`) or withdraws it
- **/api/auth/*** — next-auth (sign-in, sign-out, session, csrf)

### Exercises (any role)
- **GET /api/exercises** — PUBLISHED library with `targetJoints` (formula, isPrimary, rationale), `formChecks` and `references` (citations). Clinicians get the full library; **patients only their prescribed exercises**

### Patients (CLINICIAN, care team)
- **GET /api/patients** — care-team patients with summary stats
- **POST /api/patients** — register a patient in your organization (you become PRIMARY). Optional `email` creates a login and returns a one-time `temporaryPassword`
- **GET /api/patients/[id]** — detail: summary, recent sessions, ROM per exercise, joint trends, care team (a PATIENT may read their own record without clinical notes/alerts)
- **PATCH /api/patients/[id]** — profile fields and `clinicalNotes`
- **DELETE /api/patients/[id]** — archive (never hard-deleted)

### Prescriptions (CLINICIAN writes; PATIENT reads own)
- **GET /api/prescriptions?patientId=** — with items and merged targets
- **POST /api/prescriptions** — `{ patientId, title, notes?, startDate?, endDate?, items? }`
- **GET / PATCH / DELETE /api/prescriptions/[id]** — DELETE = cancel
- **POST /api/prescriptions/[id]/items** — `{ exerciseId, sets?, repsPerSet?, restSeconds?, daysOfWeek?, targetOverrides? }` (PUBLISHED exercises only; override joints must exist on the exercise; min ≤ ideal ≤ max)
- **PATCH / DELETE /api/prescriptions/[id]/items/[itemId]** — `targetOverrides` replaces all overrides

### Quests
- **GET /api/quests/today** (PATIENT) — today's quests, generated on demand from active prescriptions (Asia/Bangkok calendar); earlier unfinished quests become MISSED
- **GET /api/quests?patientId=&days=14** — history + adherence %

### Sessions
- **GET /api/sessions?patientId=&status=&awaitingReview=true&limit=** — sessions in scope, with `faultCount`; `awaitingReview=true` = completed and not yet reviewed (clinician review queue)
- **POST /api/sessions** (PATIENT) — `{ questId }` only; free practice is disabled (`{ exerciseId }` → 403). Stores `prescriptionId`, `prescriptionItemId` and the prescribing `clinicianId`; snapshots merged targets, form checks, formulas and algorithm version; returns the exercise to run
- **GET /api/sessions/[id]** — metrics, target snapshot, reps, joint logs, review
- **PATCH /api/sessions/[id]** (owning PATIENT, once) — `{ status: COMPLETED|CANCELLED, totalReps, avgAccuracy, romMinAngle, romMaxAngle, primaryJoint }`; server sets `endedAt`, `romDegrees` and the quest status
- **POST /api/sessions/[id]/logs** (owning PATIENT) — `{ reps: [...], logs: [...], faults: [...] }`, ≤ 200 rows/request; logs and faults link to reps by `repNumber`; locked after review
- **POST /api/sessions/[id]/review** (CLINICIAN) — `{ status: APPROVED|NEEDS_ATTENTION, comment? }`
- **POST /api/sessions/[id]/frames** (owning PATIENT) — `{ seq, frames: ReplayFrame[] }` (≤ 100 frames, ~5 s per chunk, idempotent per `seq`); pose frames at 10 fps for clinical replay, format in `src/lib/replay.ts`; locked after review
- **GET /api/sessions/[id]/frames** — all recorded frames in time order (used by *Clinical Session Replay* in the report)
- **POST /api/sessions/[id]/video?seq=&final=&startedAt=** (owning PATIENT) — session video chunk (raw `video/webm|mp4`, sequential `seq`, retries idempotent, ≤ 20 MB/chunk, 500 MB/session). **Refused (403) unless the patient has current video consent**; `X-Video-Pauses` on the final chunk syncs pauses with the replay. Files live in `VIDEO_STORAGE_DIR` (git-ignored), never under `public/`
- **GET /api/sessions/[id]/video** — stream with HTTP Range (seeking); `?meta=1` → `{ recordStartAt, pauses, complete, consentVersion }`. Care team or owning patient only

### Reports
- **GET /api/reports/[sessionId]** — metrics with explicit formulas (`angleDefinition`, `scoring`), targets (basis + rationale), per-joint and per-rep results, stored AI summary, review (AI summary and review comment are clinician-only)
- **POST /api/reports/[sessionId]** (CLINICIAN) — generate + store an AI clinical summary (`summarizeSession` in `src/lib/ai-agent.ts`)

### AI agent (`src/lib/ai-agent.ts`)
- **GET /api/clinician/summary** (CLINICIAN, care team) — dashboard summary cards: sessions completed today, completed sessions awaiting review, and red flags (patient-assistant escalations in the last 7 days, latest per patient)
- **GET /api/patients/[id]/ai-insights** (CLINICIAN, care team) — computed per-exercise trends over the last 20 completed sessions: accuracy/ROM slope, fault rate per rep (early vs recent half), top compensations, flags. No AI call
- **POST /api/patients/[id]/ai-insights** (CLINICIAN) — same trends + AI clinical summary/recommendations (`aiError` set and trends still returned if the AI service fails)
- **POST /api/messages/assistant** (PATIENT) — `{ body }` → AI companion answer; question (`ASSISTANT_QUESTION`) and reply (`ASSISTANT_REPLY`, no sender) are both stored in the care-team thread. Red-flag symptoms get a fixed escalation reply without calling the model (`escalated: true`). 20 questions/hour

### Stats
- **GET /api/stats?patientId=&days=30** — `profile` (streak, totals), `dailyData`, `categoryData`, `romData`

### Care-team chat
- **GET /api/messages?patientId=&after=ISO** — messages in a patient's thread (patients: own thread). Marks the thread read for the caller
- **POST /api/messages** — `{ patientId?, body }` (≤ 2000 chars) to the care-team thread
- **GET /api/messages/threads** — threads in scope with last message and unread count

### AI Coach (PATIENT)
- **GET /api/tts?text=** — Thai speech (audio/mpeg) for the coach voice, synthesised server-side so it works without a Thai voice on the device (`src/lib/tts-server.ts`: Google Translate TTS, Thai word-boundary chunking, in-memory cache, 200 requests / 10 min per user; `TTS_PROVIDER="off"` disables). Client order in `src/lib/speech.ts` `speakThai`: server audio → browser Thai voice → chime
- **POST /api/coach** — one natural Thai coaching cue (spoken via /api/tts). The model sees only qualitative joint states from `src/lib/coach-cues.ts`, never angle numbers; replies containing degrees/percentages are replaced by a deterministic cue

---

## 💾 Database Schema

PostgreSQL via Prisma — full definition in [`prisma/schema.prisma`](prisma/schema.prisma), migrations in `prisma/migrations/`.

```
Organization (HOSPITAL | CLINIC)
 ├─ Clinician (DOCTOR | PHYSIOTHERAPIST) ── CareAssignment (PRIMARY | SUPPORTING) ──┐
 └─ Patient ───────────────────────────────────────────────────────────────────────┘
      └─ Prescription (by a clinician)
           └─ PrescriptionItem (exercise, sets/reps/rest, daysOfWeek, PrescriptionTargetOverride[])
                └─ Quest (one per due day)
                     └─ ExerciseSession → SessionRep → JointAngleLog
                          ├─ SessionReview (clinician sign-off)
                          └─ ClinicalReport (stored AI summary)

User (login: ADMIN | CLINICIAN | PATIENT) ── 1:1 ── Clinician / Patient

Exercise (DRAFT | PUBLISHED | RETIRED)
 ├─ ExerciseJointTarget (joint, ideal/min/max, isPrimary, formula, angleBasis)
 └─ ExerciseReference (EXACT | CLOSE | PARTIAL) ── ExerciseSource (citation + verification)
                                               └─ ReferenceMeasurement (ground-truth angles)
```

**Key rules**
- Only `PUBLISHED` exercises can be prescribed. An exercise is publishable when it has at least one `VERIFIED` source **and** its primary target is measurable by the angle engine (`formula` not null). The reason for a `DRAFT` is stored in `statusNote`.
- `angleBasis` records where a target angle came from (`DEVELOPER_ESTIMATE`, `SOURCE_STATED`, `GROUND_TRUTH_EXTRACTED`, `CLINICIAN_SET`). The seeded sources describe technique only, so seeded angles are `DEVELOPER_ESTIMATE`.
- `ExerciseSource.verifiedByType` is `CLINICIAN` or `DEVELOPER`; seeded citations are developer-verified (`verifiedByName = "VERIFIED BY DEV"`), not clinically reviewed.
- `ExerciseSession.targetSnapshot` + `algorithmVersion` freeze the exact targets and formulas used, so later prescription edits never change past reports. Formulas live in `src/lib/joint-formulas.ts`.
- Patients are archived (`archivedAt`), never hard-deleted.
- `streak` / total minutes are computed from sessions, not stored.

## 🔐 Authentication (next-auth v4)

- **Credentials login** (email + password) at `/login`; passwords hashed with scrypt (`src/lib/password.ts`).
- **JWT sessions** (8 h). The token carries `role` (`CLINICIAN` | `PATIENT` | `ADMIN`), `clinicianId`, `patientId` and `organizationId` (`src/lib/auth.ts`, types in `src/types/next-auth.d.ts`).
- **Pages:** `src/app/page.tsx` is a server component — no session → redirect to `/login`. The role decides which tabs `AppShell` shows (clinician dashboard vs patient app). Admin accounts have no screens yet.
- **API routes:** guard with `requireApiUser(roles?)` from `src/lib/auth-guard.ts` (401 when signed out, 403 for the wrong role). `GET /api/me` returns the signed-in user's profile.
- Unknown emails still run a password check (constant-ish timing); `callbackUrl` only accepts same-site paths.
- Env: `NEXTAUTH_URL`, `NEXTAUTH_SECRET` (see `.env.example`).

---

## 🔑 Key Files Explained

### **src/lib/store.ts** — Global State Management (Zustand)

Manages all client-side state:
```typescript
interface AppState {
  // (role now comes from the login session, not the store)
  
  // Navigation
  activeTab: 'dashboard' | 'exercises' | 'camera' | 'history' | 'overview' | 'patients' | 'reports' | 'plans';
  setActiveTab: (tab) => void;
  
  // Patient context
  currentPatientId: string | null;
  setCurrentPatientId: (id) => void;

  // Doctor: patient selected for detail/report/plan views
  selectedPatientId: string | null;

  // Exercise picked in Exercises tab → highlighted first in LiveSessionView
  selectedExerciseId: string | null;
  
  // Live session data
  isSessionActive: boolean;
  currentSessionId: string | null;
  liveAngles: Record<string, number>;          # { left_knee: 95, right_knee: 92, ... }
  currentRep: number;
  currentSet: number;
  sessionAccuracy: number[];                   # Array of accuracy scores per rep
  aiFeedback: string;                          # Latest AI Coach message
}
// liveAngles is updated in one setLiveAngles() call, throttled to ~10 Hz.
// The per-frame pipeline writes via useAppStore.getState() to avoid re-renders.
```

**Usage in components:**
```tsx
const { activeTab, setActiveTab, currentSessionId } = useAppStore();
```

---

### **src/lib/angle-utils.ts** — Core Math Engine (`angle-utils@3`)

All joint angles use the vector dot product with the vertex at B:

```
θ = arccos( (A − B) · (C − B) / (|A − B| · |C − B|) )     cosine clipped to [−1, 1]
```

```typescript
export function angleAt(a: Vec3, b: Vec3, c: Vec3): number | null {
  const v1 = sub(a, b), v2 = sub(c, b);
  const m1 = length(v1), m2 = length(v2);
  if (m1 < 1e-6 || m2 < 1e-6) return null;               // coincident points → no angle
  const cos = Math.min(1, Math.max(-1, dot(v1, v2) / (m1 * m2)));
  return round1(Math.acos(cos) * 180 / Math.PI);
}

// image = poseLandmarks (normalized, has visibility); world = poseWorldLandmarks (metres)
calculateAllAngles(image, { aspect: videoWidth / videoHeight, world });
```

**Inputs and safeguards**
- **3D world landmarks** (metres, equal scale on x/y/z) are used when MediaPipe provides them; otherwise image landmarks with x × aspect ratio (2D). Raw normalized x/y/z are never mixed, because each axis has a different scale.
- Measurements whose landmarks have `visibility < 0.5`, or whose vectors have zero length, are **omitted** (never reported as 0°).
- Every measurement's formula is listed in `src/lib/joint-formulas.ts` (stored on each `ExerciseJointTarget.formula`).

| Measurement | Formula | Used by |
|---|---|---|
| `left/right_knee` | angle(hip, knee, ankle) | Knee Flexion, Wall Squat |
| `left/right_hip` | angle(shoulder, hip, knee) | — (no standing/sitting exercise uses it) |
| `left/right_hip_flexion` | 180 − angle(shoulder, hip, knee) | — (no standing/sitting exercise uses it) |
| `hip_opening` | angle(left_knee, mid_hip, right_knee) | — (no standing/sitting exercise uses it) |
| `left/right_shoulder` | angle(hip, shoulder, elbow) | Shoulder Flexion/Abduction, Arm Circles |
| `left/right_elbow` | angle(shoulder, elbow, wrist) | form checks |

The catalogue is limited to major joints MediaPipe tracks reliably in 3D, and to standing or sitting exercises a single webcam can see; floor and lying exercises (straight leg raise, hip bridge, clamshell) were removed and are marked RETIRED in existing databases. Neck, ankle (foot landmark) and the cat-cow / prone-scapular proxies were removed; their enum values remain in the schema only so old rows stay valid.

**Smoothing** (`src/lib/landmark-smoother.ts`): every image and world coordinate passes a One Euro low-pass filter (min cutoff 1 Hz, β 5, derivative cutoff 2 Hz — ≈ 2.4× less jitter at rest, < 1° error once a hold settles). Visibility uses hysteresis: tracked from ≥ 0.65, dropped below 0.5; untracked landmarks are reported with visibility 0 and their filter restarts on re-acquisition.

**Scoring:** `isAngleCorrect()` → in range = correct; accuracy = max(0, 100 − deviation/tolerance × 50), tolerance = (max − min)/2. **ROM** = max − min of the primary measurement during the session.

**Form faults** (`src/lib/rep-counter.ts`, `src/lib/form-checks.ts`), stored in `SessionFault`:
- `INCOMPLETE_ROM` — moved ≥ 10° from rest toward the range, returned without reaching it (2 s warm-up and 300 ms minimum ignore noise); deficit = degrees short
- `COMPENSATION` — an exercise form check failed at the rep's best moment (e.g. lifted knee < 160° in SLR, trunk lean, left/right asymmetry); `{side}`/`{other}` templates follow the counted side
- `LOW_ACCURACY` — counted rep < 60%
- A rep with COMPENSATION or LOW_ACCURACY is stored with `isCorrect = false`

**Targets** are developer estimates (`angleBasis = DEVELOPER_ESTIMATE`) bounded by normative ROM (Physiopedia; Soucie et al., *Haemophilia* 2011), with the reasoning stored in `ExerciseJointTarget.rationale`.

---

### **src/components/physio/live-session-view.tsx** — Core Camera Component

This is the heart of the app. Pipeline per session:

1. **MediaPipe Setup (CDN, pinned)** — `pose.js` and its WASM/model files are loaded from
   `cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/` (loader and `locateFile` must use the same
   version). Failed `<script>` tags are removed so retries re-request; `initialize()` is raced against a 60 s timeout.

2. **Webcam Stream** — `getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } })`
   is opened before the model loads so permission errors show immediately.

3. **Detection Loop** — a `requestAnimationFrame` loop calls `pose.send({ image: video })`, skipping
   frames while a previous `send()` is in flight. `onResults` is registered once and dispatches through a ref.

4. **Per frame** — smooth landmarks (One Euro + visibility hysteresis), then `calculateAllAngles(smoothed.image, { aspect, world: smoothed.world })` (3D when available), draw the skeleton on the
   canvas, push `liveAngles` to the store at most every 100 ms.

5. **Reps, accuracy & faults** — `RepCounter` tracks the primary measurement and its left/right counterpart: a rep is *enter range → hold ≥ 300 ms → leave range by 5°*, scored on the best angle reached; both sides within 800 ms count once. Incomplete attempts, failed form checks and low-accuracy reps become `SessionFault` rows and an on-screen form cue.
   ROM = max − min of the side that moved most.

   **Quests only:** the pre-session screen lists today's quests (with an animated demo); there is no free practice.
   **Demo rig** (`src/lib/exercise-poses.ts`, `exercise-demo.tsx`): anatomical SVG silhouette driven by joint-angle keyframes with IK for planted feet; the overlay measures the rig with the engine's formula and shows the target band. Start/end positions follow the cited AAOS/NHS instructions; not yet verified against Kisner & Colby (pending clinician review).

6. **AI Coach** — `POST /api/coach` at most every 8 s with only the visible target-joint angles; one
   request in flight, aborted on stop/unmount.
   **Spoken cues are gated by movement phase** (`RepCounter.motion()`: rest / moving / hold / returning)
   through `src/lib/cue-gate.ts`: posture corrections are checked live and spoken only while the rep is
   performed (fault must persist 400 ms), never while returning or for 2.5 s after a rep; ≥ 2.5 s between
   cues, 6 s before the same cue repeats; coach replies arriving during the return are not spoken; a
   "range not reached" cue waits until the return is over. Speech (`speakThai`) never queues: a new cue
   flushes the old one (coach cues never cut a correction short), cues that can't start within 1.5 s are
   dropped, and playback runs at 1.15× with pitch preserved.

7. **Session Logging** — each completed rep buffers one `JointAngleLog` row per visible target joint.
   The buffer is flushed to `POST /api/sessions/[id]/logs` as `{ logs: [...] }` every 5 s or at 20 rows,
   and before the final `PATCH /api/sessions/[id]` (`completed`). Leaving the view or closing the tab
   mid-session flushes with `keepalive` and saves the session as `cancelled`.

---

### **src/app/api/coach/route.ts** — AI Coach Endpoint

Receives angle data, generates feedback using Z-AI LLM:

```typescript
const SYSTEM_PROMPT = `คุณคือ AI Physio Coach...`;

export async function POST(req: NextRequest) {
  const { exerciseName, currentAngles, targetJoints, repCount, setCount } = await req.json();
  
  // Format angle info for LLM
  const angleInfo = Object.entries(currentAngles)
    .map(([joint, angle]) => {
      const target = targetJoints.find(t => t.name === joint);
      return `• ${joint}: ปัจจุบัน ${angle}° (เป้าหมาย: ${target.idealAngle}°, ช่วง: ${target.minAngle}°-${target.maxAngle}°)`;
    })
    .join('\n');
  
  const userMessage = `ท่าทาง: ${exerciseName}
เซ็ตที่: ${setCount}, ซ้ำที่: ${repCount}
มุมข้อต่อ: ${angleInfo}`;

  // Call Z-AI LLM
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    thinking: { type: 'disabled' },
  });
  
  return NextResponse.json({ feedback: completion.choices[0].message.content });
}
```

---

### **src/app/api/reports/[sessionId]/route.ts** — Clinical Report Generator

Generates Thai-language clinical summary with LLM:

```typescript
export async function POST(req, { params }) {
  const { sessionId } = await params;
  
  // Fetch session + logs
  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: { exercise: true, logs: true },
  });
  
  // Summarize by joint
  const jointReport = Object.entries(jointSummary).map(([joint, data]) => ({
    joint,
    avgAngle: Math.round(data.angles.reduce((a, b) => a + b) / data.angles.length),
    accuracy: Math.round((data.correct / data.total) * 100),
    avgDeviation: Math.round(data.deviations.reduce((a, b) => a + b) / data.deviations.length),
  }));
  
  // Generate clinical summary with LLM
  const prompt = `Create clinical summary report...
  Exercise: ${session.exercise.nameTh}
  Duration: ${Math.round((session.endedAt - session.startedAt) / 60000)} minutes
  Total reps: ${session.totalReps}
  Average accuracy: ${session.avgAccuracy}%
  
  Joint details:
  ${jointReport.map(j => `- ${j.joint}: avg ${j.avgAngle}°, accuracy ${j.accuracy}%, deviation ${j.avgDeviation}°`).join('\n')}`;
  
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: 'คุณคือนักกายภาพบำบัดที่เขียนรายงาน...' },
      { role: 'user', content: prompt },
    ],
  });
  
  return NextResponse.json({
    sessionId,
    exerciseName: session.exercise.nameTh,
    jointReport,
    clinicalSummary: completion.choices[0].message.content,
    generatedAt: new Date().toISOString(),
  });
}
```

---

### **src/lib/exercises-data.ts** — Exercise Library

Defines all available exercises with ideal angles, instructions, etc:

```typescript
export interface TargetJoint {
  name: string;           # "left_knee"
  nameTh: string;         # "เข่าซ้าย"
  idealAngle: number;     # 90
  minAngle: number;       # 80
  maxAngle: number;       # 100
  unit: string;           # "°"
}

export const EXERCISES = [
  {
    name: "Knee Flexion",
    nameTh: "การงอเข่า",
    category: "knee",
    difficulty: "beginner",
    sets: 3,
    repsPerSet: 10,
    targetJoints: [
      {
        name: "left_knee",
        nameTh: "เข่าซ้าย",
        idealAngle: 90,
        minAngle: 80,
        maxAngle: 100,
      },
      {
        name: "right_knee",
        nameTh: "เข่าขวา",
        idealAngle: 90,
        minAngle: 80,
        maxAngle: 100,
      },
    ],
    instructions: [
      "นั่งบนเก้าอี้",
      "งอเข่าค่อยๆ",
      "...",
    ],
  },
  // More exercises...
];
```

---

### **src/components/physio/dashboard-view.tsx** — Patient Progress Dashboard

Displays:
- Time-series chart (accuracy trend)
- Streak counter
- Total sessions, average accuracy
- Earned badges (Streak badges, accuracy milestones)
- Quick start buttons

Key state:
```typescript
const [profileData, setProfileData] = useState<ProfileData>();
const [statsData, setStatsData] = useState<StatsData>();  // dailyData, avgAccuracy, totalReps, categoryData, romData
const [loading, setLoading] = useState(true);

useEffect(() => {
  // Fetch /api/stats?days=30   (includes profile: streak, totals)
  // Fetch /api/quests/today     (today's prescribed quests)
}, [currentPatientId]);
```

---

### **src/components/physio/doctor-overview.tsx** — Doctor's Dashboard

Shows all patients with:
- Alert system (inactive > 7 days, low accuracy, never started)
- Sparkline chart (accuracy trend for each patient)
- Quick stats (total patients, sessions today, avg accuracy)

---

## 🚀 Getting Started (Running the App)

### Prerequisites
- **Node.js 18+** or **Bun 1.0+**
- **Git**
- **Web browser** with webcam (Chrome, Edge, Firefox)

### Installation

```bash
bun install                 # also runs `prisma generate`
cp .env.example .env        # then set NEXTAUTH_SECRET (openssl rand -base64 32)

bun run db:up               # local PostgreSQL via docker compose (needs Docker Desktop running)
bun run db:migrate:deploy   # apply migrations
bun run db:seed             # demo data — WIPES the database
```

Demo accounts (password = `SEED_DEMO_PASSWORD`, default `physio-demo-2026`):
`admin@`, `doctor@`, `pt@`, `pt2@`, `patient1@`, `patient2@`, `patient3@` + `demo.aiphysio.local`

### Running Development Server

```bash
bun run dev
```

### Production Build

```bash
bun run db:migrate:deploy   # against the production DATABASE_URL
bun run build
bun run start
```

### Database Commands

```bash
bun run db:up              # start local Postgres (docker compose)
bun run db:migrate         # create a new migration after editing schema.prisma (dev)
bun run db:migrate:deploy  # apply pending migrations (CI / production)
bun run db:seed            # reset + seed demo data (refuses when NODE_ENV=production)
bun run db:reset           # drop, re-migrate and re-seed (caution!)
bun run db:studio          # browse data
```

---

## 📊 Data Flow Diagram

### Patient Session Flow
```
1. Patient clicks "เริ่มฝึก" (Start Exercise)
   ↓
2. Select exercise from list
   ↓
3. Allow camera permission
   ↓
4. Video stream starts from webcam
   ↓
5. MediaPipe Pose Detection (Real-time, on-device)
   - Extract 33 landmarks (joints)
   - No video upload to server
   ↓
6. JavaScript: Calculate angles using vector math
   - Compare to targetJoints (ideal angle ± tolerance)
   - Compute accuracy score
   ↓
7. Every 2-3 frames: AI Coach feedback
   - POST /api/coach with currentAngles
   - Z-AI LLM generates feedback
   - Display on screen (+ optional TTS audio)
   ↓
8. Per rep: Save JointAngleLog
   - jointName, angle, deviation, isCorrect
   - POST /api/sessions/[id]/logs
   ↓
9. Session ends
   - Mark as "completed"
   - POST /api/reports/[sessionId]
   - LLM generates clinical summary
   ↓
10. Display session summary
    - Total reps, accuracy, ROM
    - Badges earned
    - Streak updated
```

### Doctor Dashboard Flow
```
1. Doctor clicks "หมอ" (Doctor mode)
   ↓
2. Fetch /api/patients → list all patients
   ↓
3. For each patient: compute stats (streak, total sessions, accuracy)
   ↓
4. Display alerts (inactive, low accuracy, never started)
   ↓
5. Doctor clicks patient → view detail
   ↓
6. Fetch /api/stats?patientId=X → time-series trends
   ↓
7. Doctor clicks session → view clinical report
   ↓
8. Fetch /api/reports/[sessionId] → joint-by-joint analysis
   ↓
9. Display LLM-generated clinical summary
```

---

## 🧪 Testing

### Quick Test
```bash
# 1. Start dev server
bun run dev

# 2. Seed data (wipes the database)
bun run db:seed

# 3. Open browser
# http://localhost:3000

# 4. Test patient mode
# - Select exercise
# - Allow camera
# - Do exercise (put hand in front of camera)
# - Watch AI feedback appear

# 5. Test doctor mode
# - Click "หมอ" tab
# - See patient stats
# - Click patient to view report
```

### Debugging

**Check logs:**
```bash
# Terminal 1: Dev server logs
bun run dev

# Terminal 2: Browse the database
bun run db:studio
```

**Common issues:**

| Issue | Solution |
|-------|----------|
| "Camera not working" | Check browser permissions, allow camera |
| "MediaPipe not loading" | Check internet connection, CDN availability |
| "Database locked" | Kill other db processes: `lsof +D ./db` |
| "Angles not updating" | Check browser console for errors, verify MediaPipe loaded |
| "AI Coach feedback missing" | Check Z-AI SDK key in env, verify LLM endpoint |

---

## 📋 Next Steps for Development

### Must-Do (Blocking)
1. **Test live camera flow end-to-end**
   - Verify MediaPipe detects pose correctly
   - Verify angles calculate correctly
   - Verify logs save to database

2. **Test AI Coach real-time feedback**
   - Verify Z-AI SDK responds
   - Verify feedback quality
   - Verify TTS works (if enabled)

3. **Test clinical report generation**
   - Verify LLM generates reports
   - Verify Thai language quality
   - Verify report format

### Nice-to-Have (Optimization)
- [ ] Add TTS (Text-to-Speech) for AI Coach feedback
- [ ] Add predictive analytics (Linear Regression for recovery timeline)
- [ ] Add gamification (achievements, leaderboard)
- [ ] Add offline mode (sync when back online)
- [ ] Add exercise video tutorials

### Play Store Prep (Future)
- [ ] Add Sign-up / Login system
- [ ] Add Privacy Policy & Terms of Service pages
- [ ] Build Android APK/AAB with Capacitor
- [ ] Submit to Google Play Console

---

## 🎯 Architecture Decisions

### Why Zustand instead of Redux?
- Simpler boilerplate for client-side state
- Perfect for role/tab switching use case
- No providers needed, direct hook usage

### Why PostgreSQL?
- Production-ready, widely hosted (Neon, Supabase, Railway, RDS)
- Native date, array and enum types used by the quest/prescription model
- Same database in development (docker compose) and production, so migrations are identical

### Why Z-AI SDK instead of OpenAI API?
- Local to development environment
- Lower latency for real-time feedback
- Built-in support for Thai language

### Why MediaPipe instead of TensorFlow.js custom model?
- Pre-trained pose detection (no labeling needed)
- Real-time performance on browser
- 33 joints per frame (rich data)
- Industry standard (used by Google)

### Why angle calculation in JavaScript?
- No server round-trip latency
- On-device processing (privacy/PDPA compliant)
- Real-time responsiveness

---

## 🔗 External Resources

- **MediaPipe Pose:** https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
- **Recharts:** https://recharts.org
- **Tailwind CSS:** https://tailwindcss.com
- **shadcn/ui:** https://ui.shadcn.com
- **Prisma:** https://www.prisma.io
- **Zustand:** https://github.com/pmndrs/zustand
- **Next.js:** https://nextjs.org
- **Z-AI SDK:** (internal documentation)

---

**Last updated:** 2026-08-18  
**Version:** 0.2.0-dev
