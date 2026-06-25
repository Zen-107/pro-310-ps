---
Task ID: 5
Agent: Main Agent
Task: Rewrite doctor-overview.tsx as multi-patient overview dashboard

Work Log:
- Rewrote `/src/components/physio/doctor-overview.tsx` from single-patient view to multi-patient overview dashboard
- Fetches from GET /api/patients (enriched list) and GET /api/sessions (for today count)
- Parallel fetch of patient details for sparkline data (last 3 session accuracies per patient)
- 4 summary stat cards: จำนวนผู้ป่วยทั้งหมด, เซสชันวันนี้, ความแม่นยำเฉลี่ยรวม, ผู้ป่วยที่กำลังฝึก
- Responsive patient cards grid (1/2/3 cols) with name, condition, age/gender, stats, status badge, sparkline, last active
- Status badge: กำลังฝึก (emerald) or ไม่มีกิจกรรม (muted)
- Quick Alerts section: inactive 7d, never started, low accuracy — clickable to patient
- Full loading skeleton, framer-motion stagger animations
- Named export with onSelectPatient(patientId) prop
- Updated page.tsx to set selectedPatientId in store on card click
- Fixed pre-existing bugs in doctor-reports.tsx and doctor-patients.tsx

Stage Summary:
- All 9 requirements met. ESLint clean. Server compiles (GET / 200).
