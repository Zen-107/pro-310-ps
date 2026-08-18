# 🏋️ AI-Driven Home Rehabilitation & Physical Therapy Tracker

## 🎯 Pain Points ในวงการกายภาพบำบัดที่บ้าน
### 1. คนไข้ทำท่าผิดหรือทำไม่สุดระยะ (Poor Form & Limited ROM)
> [!problem] ปัญหา
> เมื่อคนไข้กลับไปทำกายภาพที่บ้าน มักทำท่าผิดๆ ถูกๆ หรือขยับไม่สุดระยะ (Range of Motion - ROM) ทำให้ฟื้นฟูช้า หรือร้ายแรงกว่านั้นคือ บาดเจ็บซ้ำ (Re-injury) เนื่องจากไม่มีผู้เชี่ยวชาญคอยประกบ

> [!solution] โอกาส Data/AI
> - **Data Capture:** ใช้กล้อง Smartphone
> - **AI Analytics:** ใช้ `Pose Estimation` ตรวจจับข้อต่อ (Joints) และคำนวณมุม (Kinematics) เพื่อเช็คว่าท่าถูกต้องและสุดระยะหรือไม่

### 2. ขาดแรงจูงใจและการติดตามผลระยะยาว (Lack of Motivation & Long-term Tracking)
> [!problem] ปัญหา
> การทำกายภาพเป็นเรื่องน่าเบื่อ คนไข้มักขาดแรงจูงใจ และแพทย์ไม่สามารถเห็นกราฟพัฒนาการที่ต่อเนื่องระหว่างคาบการรักษาได้

> [!solution] โอกาส Data/AI
> - **Integration (Gamification):** นำคะแนนความถูกต้อง (Accuracy Score) มาทำเป็นเกม เช่น ทำท่าถูกตัวละครถึงจะกระโดดข้ามสิ่งกีดขวางได้
> - **Time-Series & Predictive:** ใช้ `Time-Series Analysis` พล็อตกราฟพัฒนาการ และใช้ `Predictive Analytics` พยากรณ์ระยะเวลาฟื้นตัว (Recovery Forecast) หรือแจ้งเตือนเมื่อกราฟพัฒนาการ "แบนราบ" (Plateau)

---

## 🧠 Technical Strategy & CPE310 Alignment
### 💡 Dataset Strategy: "ไม่ต้องหา Dataset ภาพเยอะ"
- ใช้ MediaPipe (Pre-trained) ดึง Joint จากวิดีโอ YouTube แนวกายภาพบำบัดฟรีๆ
- **Ground Truth:** ดึงเฟรมวิดีโอ -> รัน MediaPipe -> คำนวณมุมข้อต่อมาตรฐาน (Ideal Angles) -> บันทึกเป็น JSON Baseline
- **จุดแข็ง:** ลดเวลา Data Labeling 90% ใช้ Logic ทางเรขาคณิต (Geometry) แทน Deep Learning แบบ Train เอง

### 📊 Phase 1: Core ML/DL & Analytics
1. **Computer Vision (MediaPipe):** ตรวจจับ Skeleton tracking และคำนวณมุมข้อต่อแบบ Real-time
2. **Time-Series Analysis:** เก็บค่า ROM และ Accuracy Score รายวัน พล็อตเป็นกราฟแนวโน้มพัฒนาการ (Progression Curve)
3. **Predictive Analytics:** สร้างโมเดลถดถอย (Regression) หรือ Classification เพื่อพยากรณ์ว่า "หากคนไข้ทำท่านี้ครบ X ครั้งต่อสัปดาห์ จะใช้เวลากี่สัปดาห์ถึงจะกลับมาเดินได้ปกติ" หรือแจ้งเตือน "Risk of Re-injury"

### 🤖 Phase 2: Agentic AI Architecture (Multi-Agent System)
ระบบใช้ Multi-Agent System เพื่อแบ่งแยกหน้าที่ (Separation of Concerns):

- 📷 **Agent 1: Vision Tracker (The Eyes)**
  - **หน้าที่:** รับเฟรมจากกล้อง รัน MediaPipe ดึงพิกัด (x, y, z) ของข้อต่อ
  - **Output:** ส่งค่า Coordinates และคำนวณ Angle/Distance แบบ Real-time
- 🗣️ **Agent 2: AI Coach (The Brain)**
  - **หน้าที่:** LLM ที่รับค่ามุมข้อต่อ (JSON) เปรียบเทียบกับทฤษฎีกายภาพบำบัด (ดึงจาก RAG)
  - **Action:** Generate ข้อความ/เสียง (TTS) แบบ Real-time เช่น "งอเข่าอีกนิดครับ ขาดอีกประมาณ 1 คืบ"
  - **XAI Feature:** แสดงผลบน UI ว่า "ข้อผิดพลาด: มุมเข่า 120° (เป้าหมาย: 90°)"
- 📄 **Agent 3: Clinical Reporter (The Scribe)**
  - **หน้าที่:** เมื่อจบเซสชัน ดึง Log ความถูกต้อง, จำนวนครั้ง (Reps), และ ROM
  - **Output:** Generate เป็น Clinical Summary Report (PDF/JSON) ส่งให้แพทย์ผ่าน Web Dashboard

---

## 📱 Mobile & Play Store Strategy
> [!tip] การเตรียมแอปเพื่อลง Play Store
> เนื่องจาก Core เป็น Web-based (Tailwind + FastAPI) จะใช้กลยุทธ์ดังนี้:

1. **App Wrapper:** ใช้ **Capacitor** หรือ **PWA (Progressive Web App)** Wrap หน้าเว็บให้เป็น Native Android App เพื่ออัปโหลดขึ้น Play Store ได้
2. **On-Device Processing (สำคัญมาก):** รัน MediaPipe ผ่าน TensorFlow.js / MediaPipe JS ใน WebView ของมือถือ เพื่อไม่ให้ส่งภาพวิดีโอขึ้น Cloud (ลด Latency และแก้ปัญหา PDPA) ส่งขึ้น Server แค่ค่า JSON Coordinates
3. **Offline Mode:** รองรับการทำกายภาพแบบไม่มีอินเทอร์เน็ต โดยซิงค์ข้อมูลขึ้น Cloud เมื่อมีเครือข่าย (Sync Queue)
4. **App Store Optimization (ASO):** ตั้งชื่อแอปให้ค้นหาง่าย เช่น "AI Physio: กายภาพบำบัดที่บ้าน"

---

## 🎨 UI/UX Strategy: "Minimalist & Tech/Geek"
- **หน้า Live Camera:** แสดง Live Webcam + เส้น Skeleton ทับ + กราฟมุมข้อต่อแบบ Real-time (สไตล์ Oscilloscope)
- **Dashboard ผู้ป่วย:** แสดงกราฟ Time-Series พัฒนาการ, Streak (จำนวนวันที่ทำติดต่อกัน), และ Badge ความสำเร็จ
- **Dashboard แพทย์ (Web):** ใช้ Tailwind CSS + DaisyUI จัด Layout ให้ดูเป็น Professional Tool สำหรับดูรายงานจาก Agent 3

---
## Flowchart
```mermaid
%%{init: {"flowchart":{"nodeSpacing":30,"rankSpacing":40}}}%%
flowchart BT
    subgraph Patient ["🧑‍🦯 ผู้ป่วย (ที่บ้าน)"]
        A["เปิดแอป"]
        B["เลือกท่ากายภาพตามแผนที่หมอสั่ง"]
        C["วางมือถือให้กล้องเห็นตัว"]
        D["ทำท่ากายภาพ"]
        E{"ผลลัพธ์จาก AI"}
        F["✅ ได้คะแนน + เสียงชม"]
        G["⚠️ เสียงเตือนจาก AI Coach"]
        H["ทำครบเซสชัน"]
        I["ดูกราฟพัฒนาการบน Dashboard"]
    end
    subgraph System ["🤖 ระบบ AI (Multi-Agent)"]
        P["Agent 1: Vision Tracker - ตรวจจับท่าและมุม"]
        Q["Agent 2: AI Coach - ให้ Feedback เรียลไทม์"]
        R["Agent 3: Clinical Reporter - สรุปภาพรวมการรักษา"]
    end
    subgraph Doctor ["👨‍⚕️ แพทย์ (คลินิก)"]
        J["Login Web Dashboard"]
        K["ดูรายงานคนไข้ Clinical Report"]
        L["ดูวิเคราะห์แนวโน้ม ROM + Progression"]
        M{"ประเมินพัฒนาการ"}
        N["เพิ่มระดับความยาก"]
        O["ปรับแผนการรักษา"]
        S["อัปเดตระบบ Prescription Sync"]
    end
    A --> B
    B --> C
    C --> D
    E -->|"ถูกต้อง"| F
    E -->|"ผิดฟอร์ม"| G
    F --> H
    G --> D
    H --> I
    D -.->|"ส่งวิดีโอเฟรม/พิกัด"| P
    P -->|"วิเคราะห์มุมข้อต่อ"| Q
    Q -.->|"ส่งคำแนะนำ/คะแนน"| E
    H -.->|"ส่งข้อมูลสรุปเซสชัน"| R
    J --> K
    R -.->|"ส่งรายงานอัตโนมัติ"| K
    K --> L
    L --> M
    M -->|"ดีขึ้น"| N
    M -->|"ทรงตัว/แย่ลง"| O
    N --> S
    O --> S
    S -.->|"ซิงค์เกณฑ์และท่าใหม่"| B
    classDef patientStyle fill:#e1f5ff,stroke:#0288d1,color:#01579b,stroke-width:2px
    classDef systemStyle fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c,stroke-width:2px
    classDef doctorStyle fill:#ffebee,stroke:#d32f2f,color:#b71c1c,stroke-width:2px
    %% mermaid-flow:pos A=426,1335 B=426,1251 C=493,1167 D=493,1083 E=601,817 F=611,719 G=237,719 H=611,635 I=888,551 P=1318,1070 Q=1318,986 R=1318,622 J=1937,1065 K=1782,981 L=1782,897 M=1782,799 N=1887,701 O=1723,701 S=1737,625
```


---


## 🚀 Project Roadmap
### Step 1: Backend, Database & Mobile Setup
- ✅ ออกแบบ Database Schema (Users → Exercise Plans → Session Logs → Joint_Angle_Records)
- ✅ สร้าง FastAPI Endpoint สำหรับ Auth, Sync Data, และดึง Exercise Plans
- ✅ Setup โครงสร้าง Mobile App ด้วย Capacitor (Wrap Tailwind Frontend)

### Step 2: Computer Vision & Logic Module (Phase 1 Core)
- ✅ เขียน Python Script ดึงวิดีโอ YouTube -> Extract Ideal Angles (Ground Truth)
- ✅ เขียน Logic คำนวณมุมข้อต่อ (Angle Calculation using Vector Math) บน Frontend (JS)
- ⚠️ เช็คว่าทำท่าถูกไหม (Form Check) และสุดระยะไหม (ROM Check) — ยังต้อง test live camera flow
- ⚠️ Implement Time-Series Dashboard (กราฟพัฒนาการ) — dashboard มี แต่ยังต้อง test data flow

### Step 3: Agentic AI & Predictive Integration (Phase 2 Core)
- ⚠️ เชื่อมต่อ Tracker Agent กับ Coach Agent (ใช้ Z-AI SDK Endpoint) — foundation มี แต่ยังต้อง test real-time feedback
- ⚠️ สร้าง Reporter Agent ให้สรุปผลเป็น Clinical Note — endpoint มี แต่ยังต้อง test generation quality
- ⏳ สร้างโมเดล Predictive Analytics ง่ายๆ (เช่น Linear Regression) เพื่อพยากรณ์วันฟื้นตัว

### Step 4: Play Store Preparation & Launch
- ⏳ ทำระบบ Sign-up / Login และหน้า **Privacy Policy / Terms of Service** (บังคับโดย Google Play)
- ⏳ ขอ Permission กล้อง และ Microphone (สำหรับ TTS) อย่างถูกต้องตาม Android Guideline
- ⏳ Build APK/AAB และทดสอบบนเครื่องจริง (Real-device Testing)
- ⏳ อัปโหลดขึ้น Google Play Console (เตรียมรูป Screenshot, คำอธิบายแอป)

---

## 📚 Developer Documentation

> 👉 **สำหรับ developers ที่จะทำต่อ** — อ่าน [CODEBASE.md](./CODEBASE.md) สำหรับคำอธิบายโครงสร้างโค้ด, API endpoints, database schema, วิธีการรันเว็บ, และ data flow ทั้งหมด

### Quick Start
```bash
# Install dependencies
bun install

# Setup database
bun run db:push && bun run db:generate

# Run development server
bun run dev

# Open browser to http://localhost:3000
```

### Key Files Reference
- **Core Logic:** `src/lib/angle-utils.ts` (angle calculation, ROM check)
- **State Management:** `src/lib/store.ts` (Zustand global state)
- **Live Camera:** `src/components/physio/live-session-view.tsx` (main session component)
- **AI Coach:** `src/app/api/coach/route.ts` (Z-AI LLM endpoint)
- **Reports:** `src/app/api/reports/[sessionId]/route.ts` (clinical summary generator)
- **Exercise Library:** `src/lib/exercises-data.ts` (all exercises with target angles)
- **Database:** `prisma/schema.prisma` (Exercise, Patient, Session, JointAngleLog models)

