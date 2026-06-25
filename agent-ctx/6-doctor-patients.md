---
Task ID: 6
Agent: Main Agent
Task: Rewrite doctor-patients.tsx — detailed patient data view for doctors

Work Log:
- Read existing component, API routes (/api/patients, /api/patients/[id]), Prisma schema, and shadcn UI components
- Identified 10 requirements: header with back arrow, patient selector dropdown, editable profile card, stats row, alerts, category breakdown, accuracy chart, joint ROM chart, session detail table, loading skeletons
- Completely rewrote /src/components/physio/doctor-patients.tsx (~500 lines)
- Used shadcn Select for patient switching, Textarea + Button for therapist notes (PATCH /api/patients/[id])
- Implemented derived loading state (detailPatientId vs selectedPatientId) to avoid ESLint set-state-in-effect errors
- Added framer-motion animations: stagger container, fade-up variants, AnimatePresence for expanded rows, whileHover on cards
- Emerald (#10b981) + Amber (#f59e0b) theme throughout
- Fixed 2 ESLint errors: removed synchronous setState in useEffect by using derived state pattern
- Verified: `bun run lint` passes clean, dev server compiles without errors

Stage Summary:
- Fully rewritten DoctorPatients component with all 10 requirements implemented
- Patient selector dropdown synced with Zustand store selectedPatientId
- Editable therapist notes with save button → PATCH API, toast feedback via Sonner
- 4-card stats row: sessions, avg accuracy, streak, improvement trend with +/- coloring
- Alerts section with type-based styling (warning/info/success)
- Category breakdown grid with accuracy-colored cards
- Accuracy trend LineChart with 80% reference line
- Joint ROM trend LineChart with ideal angle reference line and joint selector tabs
- Expandable session detail table with accuracy progress bar animation
- Full loading skeletons (list skeleton + detail skeleton)
- No blue/indigo colors used