# 📘 AI Physio — Complete Codebase Documentation

> **สำหรับ developers ที่จะทำต่อ** — คู่มือเข้าใจโครงสร้างโค้ดทั้งหมด, API endpoints, database schema, และวิธีการรันเว็บ

---

## 🏗️ Project Architecture & Code Structure

### 📁 Folder Structure

```
project-root/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                 # Main entry point (role switcher: patient/doctor)
│   │   ├── layout.tsx               # Global layout + metadata
│   │   ├── globals.css              # Global styles
│   │   └── api/                     # API routes (Backend)
│   │       ├── seed/                # POST: Initialize database with exercises & sample patients
│   │       ├── coach/               # POST: AI Coach feedback (z-ai LLM integration)
│   │       ├── exercises/           # GET: List all exercises
│   │       ├── patients/            # GET/POST: Patient CRUD operations
│   │       │   └── [id]/            # GET: Fetch single patient with session history
│   │       ├── sessions/            # GET/POST: Session management
│   │       │   ├── [id]/            # GET: Fetch single session details
│   │       │   └── [id]/logs/       # POST: Save joint angle logs during session
│   │       ├── reports/             # GET/POST: Clinical report generation (AI powered)
│   │       │   └── [sessionId]/     # GET/POST: Generate clinical summary with z-ai
│   │       ├── stats/               # GET: Fetch statistics & trends for patient
│   │       ├── profile/             # GET: Fetch current user profile
│   │       ├── tts/                 # POST: Text-to-speech for AI Coach feedback
│   │       └── route.ts             # Root API health check
│   │
│   ├── components/
│   │   ├── ui/                      # shadcn/ui primitives actually in use (add more via `bunx shadcn add <name>`)
│   │   │   ├── badge.tsx, button.tsx, card.tsx, progress.tsx, scroll-area.tsx
│   │   │   ├── select.tsx, separator.tsx, skeleton.tsx, switch.tsx, textarea.tsx
│   │   │   └── sonner.tsx           # Toaster for `toast()` from 'sonner' (mounted in layout.tsx)
│   │   │
│   │   └── physio/                  # Custom physio app components
│   │       ├── patient-selector.tsx        # Screen: Select which patient identity to use
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
| **AI/LLM** | Z-AI Web SDK | Coach feedback & clinical reports |
| **Charts** | Recharts | Time-series data visualization |
| **Package Manager** | Bun | Fast dependency management |
| **Runtime** | Node.js + Next.js standalone | Production deployment |

---

## 🌐 API Endpoints Quick Reference

### Seed & Setup
- ~~POST /api/seed~~ — replaced by `bun run db:seed` (route will be removed in the API refactor)

### Exercises
- **GET /api/exercises** — List all exercises with details
- **GET /api/exercises?category=knee** — Filter by category

### Patients
- **GET /api/patients** — List all patients with summary stats
- **GET /api/patients/[id]** — Get patient detail + session history
- **POST /api/patients** — Create new patient

### Sessions
- **GET /api/sessions** — List all sessions across patients
- **GET /api/sessions?patientId=[id]** — Filter sessions by patient
- **POST /api/sessions** — Create new session for exercise
  - Body: `{ exerciseId, patientId }`
  - Returns: `{ id, exerciseId, patientId, startedAt, status }`
- **GET /api/sessions/[id]** — Get session details with logs
- **POST /api/sessions/[id]/logs** — Save joint angle logs (batched, max 200 rows per request)
  - Body: `{ logs: [{ repNumber, jointName, angle, idealAngle, deviation, isCorrect }, ...] }` (a single log object is also accepted)

### AI Coach
- **POST /api/coach** — Generate AI feedback based on current angles
  - Input: `{ exerciseName, currentAngles, targetJoints, repCount, setCount }`
  - Output: `{ feedback: "เข่าขวางอได้ดี! แต่ลองงออีกนิด..." }`

### Clinical Reports
- **GET /api/reports/[sessionId]** — Fetch session summary (joint by joint)
- **POST /api/reports/[sessionId]** — Generate clinical summary with LLM
  - Output: `{ sessionId, exerciseName, jointReport, clinicalSummary, generatedAt }`

### Stats & Analytics
- **GET /api/stats?patientId=[id]&days=30** — Fetch time-series stats
  - Output: `{ dailyData, totalSessions, avgAccuracy, categoryData, romData }`

### Profile
- **GET /api/profile** — Fetch current user/patient info

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

## 🔑 Key Files Explained

### **src/lib/store.ts** — Global State Management (Zustand)

Manages all client-side state:
```typescript
interface AppState {
  // Role switching
  role: 'patient' | 'doctor';
  setRole: (role) => void;
  
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
const { role, setRole, activeTab, setActiveTab, currentSessionId } = useAppStore();
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
| `left/right_hip` | angle(shoulder, hip, knee) | Hip Bridge |
| `left/right_hip_flexion` | 180 − angle(shoulder, hip, knee) | Straight Leg Raise |
| `hip_opening` | angle(left_knee, mid_hip, right_knee) | Clamshell |
| `left/right_shoulder` | angle(hip, shoulder, elbow) | Shoulder Flexion/Abduction, Arm Circles |
| `left/right_ankle` | 90 − angle(knee, ankle, foot_index) | Ankle Dorsiflexion |
| `neck` | head yaw from the ear-to-ear line (x/z) | Neck Rotation |
| `spine_flexion` | ±(180 − angle(ear, shoulder, hip)), + = head below trunk line — **proxy** | Cat-Cow |
| `left/right_shoulder_extension` | ±angle(hip, shoulder, elbow), + = elbow above trunk line — **proxy** | Prone Scapular Squeeze |

Signed measurements decide "above/below the trunk line" in image space (y down), so they work whichever way the patient faces.

**Scoring:** `isAngleCorrect()` → in range = correct; accuracy = max(0, 100 − deviation/tolerance × 50), tolerance = (max − min)/2. **ROM** = max − min of the primary measurement during the session.

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

4. **Per frame** — `calculateAllAngles(poseLandmarks, { aspect, world: poseWorldLandmarks })` (3D when available), draw the skeleton on the
   canvas, push `liveAngles` to the store at most every 100 ms.

5. **Reps & accuracy** — on the first target joint: a rep is *enter range → hold ≥ 300 ms → leave range
   by 5°*. It is scored with `isAngleCorrect` on the best angle reached while in range.
   ROM = max − min of that joint (visible frames only).

6. **AI Coach** — `POST /api/coach` at most every 8 s with only the visible target-joint angles; one
   request in flight, aborted on stop/unmount.

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
  // Fetch /api/profile
  // Fetch /api/stats?patientId=X&days=30
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

# 2. Seed data
curl -X POST http://localhost:3000/api/seed

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
