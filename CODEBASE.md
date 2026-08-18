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
│   │   ├── ui/                      # shadcn/ui components (pre-built)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── chart.tsx
│   │   │   ├── toast.tsx
│   │   │   └── ... (40+ UI primitives)
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
│   │   ├── angle-utils.ts          # Core math: angle calculation, ROM check, accuracy scoring
│   │   ├── exercises-data.ts       # Exercise library with target joints & ideal angles
│   │   └── utils.ts                # General utilities (cn, toast helpers, etc.)
│   │
│   └── hooks/                       # React hooks
│       ├── use-toast.ts
│       └── use-mobile.ts
│
├── prisma/
│   └── schema.prisma               # Database schema (SQLite)
│
├── db/
│   └── custom.db                   # SQLite database file
│
├── public/                          # Static assets
│   └── logo.svg
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
| **Database** | SQLite + Prisma ORM | Persistent data storage |
| **Computer Vision** | MediaPipe (Web) | Pose detection & skeleton tracking |
| **Math** | Vector algebra (JavaScript) | Angle calculation & ROM validation |
| **AI/LLM** | Z-AI Web SDK | Coach feedback & clinical reports |
| **Charts** | Recharts | Time-series data visualization |
| **Package Manager** | Bun | Fast dependency management |
| **Runtime** | Node.js + Next.js standalone | Production deployment |

---

## 🌐 API Endpoints Quick Reference

### Seed & Setup
- **POST /api/seed** — Initialize database: create exercises, sample patients

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
- **POST /api/sessions/[id]/logs** — Save joint angle log during session
  - Body: `{ repNumber, jointName, angle, idealAngle, deviation, isCorrect }`

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

### Exercise
```prisma
model Exercise {
  id              String   @id                    # ex_knee_flexion
  name            String                         # "Knee Flexion"
  nameTh          String                         # "การงอเข่า"
  category        String                         # "knee", "shoulder", etc.
  description     String
  instructions    String                         # JSON array of steps
  targetJoints    String                         # JSON: [{name, idealAngle, minAngle, maxAngle}]
  difficulty      String   @default("beginner")
  sets            Int      @default(3)
  repsPerSet      Int      @default(10)
  restSeconds     Int      @default(30)
  icon            String   @default("Activity")
  bodyPart        String                         # "lower", "upper", "full"
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  sessions        Session[]
}
```

### Patient
```prisma
model Patient {
  id                  String   @id
  name                String                     # Patient name (Thai)
  age                 Int?
  gender              String   @default("ไม่ระบุ")
  condition           String   @default("")     # Medical condition description
  phone               String   @default("")
  assignedExerciseIds String   @default("[]")   # JSON array of exercise IDs
  therapistNotes      String   @default("")
  streak              Int      @default(0)      # Consecutive days with sessions
  totalMinutes        Int      @default(0)
  lastActiveAt        DateTime?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  sessions            Session[]
}
```

### Session
```prisma
model Session {
  id           String   @id
  exerciseId   String
  exercise     Exercise @relation(fields: [exerciseId], references: [id])
  patientId    String
  patient      Patient  @relation(fields: [patientId], references: [id])
  startedAt    DateTime @default(now())
  endedAt      DateTime?
  totalReps    Int      @default(0)             # Completed reps count
  avgAccuracy  Float    @default(0)             # 0-100%
  maxRom       Float    @default(0)             # Maximum angle achieved (degrees)
  status       String   @default("in_progress") # "completed", "cancelled"
  notes        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  logs         JointAngleLog[]
}
```

### JointAngleLog
```prisma
model JointAngleLog {
  id          String   @id
  sessionId   String
  session     Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  repNumber   Int      @default(0)
  timestamp   DateTime @default(now())
  jointName   String                           # "left_knee", "right_shoulder", etc.
  angle       Float                            # Current measured angle
  idealAngle  Float                            # Target angle from exercise definition
  deviation   Float                            # |angle - idealAngle|
  isCorrect   Boolean  @default(false)         # Within acceptable range?
}
```

---

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
  
  // Live session data
  isSessionActive: boolean;
  currentSessionId: string | null;
  liveAngles: Record<string, number>;          # { left_knee: 95, right_knee: 92, ... }
  currentRep: number;
  currentSet: number;
  sessionAccuracy: number[];                   # Array of accuracy scores per rep
  aiFeedback: string;                          # Latest AI Coach message
  
  // Skeleton tracking
  skeletonLandmarks: Array<{ x, y, z }>;       # 33 MediaPipe landmarks
}
```

**Usage in components:**
```tsx
const { role, setRole, activeTab, setActiveTab, currentSessionId } = useAppStore();
```

---

### **src/lib/angle-utils.ts** — Core Math Engine

The most critical file for the AI Coach system. Contains all pose estimation logic:

```typescript
// MediaPipe Landmark Indices
export const LANDMARKS = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

// Calculate angle between 3 points (using vector math)
export function calculateAngle(a: Landmark, b: Landmark, c: Landmark): number {
  // vertex angle at point b
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * (180.0 / Math.PI));
  if (angle > 180) angle = 360 - angle;
  return Math.round(angle * 10) / 10;  // 1 decimal place
}

// Extract all joint angles from pose landmarks
export function calculateAllAngles(landmarks: Landmark[]): Record<string, number> {
  const angles = {};
  angles.left_knee = calculateAngle(lm(LEFT_HIP), lm(LEFT_KNEE), lm(LEFT_ANKLE));
  angles.right_knee = calculateAngle(lm(RIGHT_HIP), lm(RIGHT_KNEE), lm(RIGHT_ANKLE));
  angles.left_shoulder = calculateAngle(lm(LEFT_HIP), lm(LEFT_SHOULDER), lm(LEFT_ELBOW));
  // ... etc for all joints
  return angles;
}

// Check if angle is within acceptable range
export function isAngleCorrect(
  currentAngle: number,
  idealAngle: number,
  minAngle: number,
  maxAngle: number
): { correct: boolean; deviation: number; percentAccuracy: number } {
  const deviation = Math.abs(currentAngle - idealAngle);
  const tolerance = (maxAngle - minAngle) / 2;
  const correct = currentAngle >= minAngle && currentAngle <= maxAngle;
  const percentAccuracy = Math.max(0, 100 - (deviation / tolerance) * 50);
  return { correct, deviation, percentAccuracy: Math.round(percentAccuracy) };
}
```

**Key equations:**
- **Angle calculation:** Uses `atan2()` to compute angle between vectors
- **Accuracy scoring:** Penalty based on deviation from ideal angle
- **ROM (Range of Motion):** Max angle achieved during session

---

### **src/components/physio/live-session-view.tsx** — Core Camera Component

This is the heart of the app. Handles:

1. **MediaPipe Setup (CDN)**
   ```typescript
   const POSE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js';
   
   async function loadScript(src: string) {
     // Load MediaPipe from CDN
   }
   ```

2. **Webcam Stream**
   ```typescript
   navigator.mediaDevices.getUserMedia({ video: true })
     .then(stream => {
       videoRef.current.srcObject = stream;
     });
   ```

3. **Real-time Pose Detection Loop**
   ```typescript
   const onFrame = async () => {
     const results = await pose.send({ image: canvasRef.current });
     // results.poseLandmarks = 33 points with x, y, z coordinates
   };
   ```

4. **Angle Calculation & Accuracy Scoring**
   ```typescript
   const angles = calculateAllAngles(results.poseLandmarks);
   // angles = { left_knee: 95, right_knee: 92, ... }
   
   const accuracies = targetJoints.map(joint => {
     const { correct, percentAccuracy } = isAngleCorrect(
       angles[joint.name],
       joint.idealAngle,
       joint.minAngle,
       joint.maxAngle
     );
     return percentAccuracy;
   });
   ```

5. **AI Coach Feedback (Every 2-3 frames)**
   ```typescript
   const response = await fetch('/api/coach', {
     method: 'POST',
     body: JSON.stringify({
       exerciseName: selectedExercise.nameTh,
       currentAngles: angles,
       targetJoints: selectedExercise.targetJoints,
       repCount: currentRep,
       setCount: currentSet,
     }),
   });
   const { feedback } = await response.json();
   setAiFeedback(feedback);  // Display to user
   ```

6. **Session Logging**
   ```typescript
   // After each rep, save logs to database
   for (const joint of targetJoints) {
     await fetch(`/api/sessions/${currentSessionId}/logs`, {
       method: 'POST',
       body: JSON.stringify({
         repNumber: currentRep,
         jointName: joint.name,
         angle: angles[joint.name],
         idealAngle: joint.idealAngle,
         deviation: Math.abs(angles[joint.name] - joint.idealAngle),
         isCorrect: angles[joint.name] >= joint.minAngle && angles[joint.name] <= joint.maxAngle,
       }),
     });
   }
   ```

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
# Clone repo
cd pro-310-ps

# Install dependencies
bun install
# or: npm install

# Setup environment
echo "DATABASE_URL=file:./db/custom.db" > .env

# Initialize database
bun run db:push
bun run db:generate
```

### Running Development Server

```bash
bun run dev
# or: npm run dev
```

**Output:**
```
  ▲ Next.js 14.0.0
  - Local:        http://localhost:3000
```

**First load:**
- Page calls `POST /api/seed` automatically
- Creates exercises, sample patients
- Shows demo data

### Access the App

1. **Patient Mode** (default)
   - View exercises, progress, badges
   - Click "เริ่มฝึก" to open camera
   - Position on camera, do exercise
   - AI Coach gives feedback in real-time
   - Session auto-saves

2. **Doctor Mode**
   - Click "หมอ" tab
   - See all patients with stats
   - Click patient to view detail report
   - View clinical summaries

### Production Build

```bash
# Build
bun run build

# Run production server
bun run start
```

### Database Commands

```bash
# Push schema changes
bun run db:push

# Generate Prisma client
bun run db:generate

# Reset database (caution!)
bun run db:reset

# Run migrations
bun run db:migrate
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

# Terminal 2: View database
sqlite3 db/custom.db "SELECT * FROM Session LIMIT 5;"
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

### Why SQLite instead of PostgreSQL?
- Single-file database, easy to deploy
- Sufficient for demo/MVP
- Can migrate to PostgreSQL later

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
