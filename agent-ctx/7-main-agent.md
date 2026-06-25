---
Task ID: 7
Agent: Main Agent
Task: Rewrite doctor-plans.tsx — per-patient exercise assignment view for doctors

Work Log:
- Read existing codebase: worklog.md, store.ts, exercises-data.ts, API routes, UI components
- Rewrote `/src/components/physio/doctor-plans.tsx` from scratch with all requirements
- Added patient selector dropdown using shadcn Select component, reads from Zustand `selectedPatientId`
- If no patient selected (or no patients exist), shows a contextual empty state with message
- Plan Summary card with 5 stat pills: ท่าที่กำหนด, เวลาโดยประมาณ, หมวดหมู่, เริ่มต้น, กลาง-สูง
- Exercise list grouped by CATEGORIES with expand/collapse per category
- Each exercise shows: nameTh, sets×reps, restSeconds, target joint count, difficulty badge
- Switch toggle per exercise with emerald color when enabled
- Auto-save exercise assignments via debounced (800ms) PATCH to `/api/patients/[id]` with `assignedExerciseIds`
- Therapist Notes textarea with auto-save (1200ms debounce) via PATCH with `therapistNotes`
- Manual "บันทึกเลย" button for immediate save
- Toast notifications on save success/failure via sonner
- Loading skeleton for all sections
- Saving indicator (animated spinner + text)
- Last saved timestamp display in header
- Emerald (#10b981) + Amber (#f59e0b) color scheme, no blue/indigo
- All text in Thai language
- ESLint passes with zero errors
- Exported as `export function DoctorPlans()`

Stage Summary:
- Complete rewrite of doctor-plans.tsx with full patient selection, exercise assignment, and therapist notes
- Proper API integration with auto-save and debouncing
- Professional UI with shadcn components, framer-motion animations, and responsive design