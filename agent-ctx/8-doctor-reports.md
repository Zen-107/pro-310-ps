# Task 8 — Doctor Reports Component Rewrite

## Work Log
- Read existing `doctor-reports.tsx`, Zustand store (`store.ts`), API routes (`/api/sessions`, `/api/patients`, `/api/reports/[sessionId]`), Prisma schema, and shadcn Select/Progress components
- Completely rewrote `src/components/physio/doctor-reports.tsx` with all 9 requirements

## What Changed

### New Features Added
1. **Patient Selector** — shadcn `Select` dropdown fetching from `/api/patients`, defaults to `selectedPatientId` from Zustand store (falls back to first patient)
2. **Patient metadata display** — shows session count and latest accuracy next to the selector
3. **Sessions filtered by patient** — calls `GET /api/sessions?patientId=xxx` on patient change
4. **Professional report card** — dark gradient header with exercise name (Thai + English), category, generation timestamp
5. **Stats row** — 4 animated cards: ครั้งที่ทำ, ความแม่นยำ, ROM สูงสุด, ข้อต่อที่ตรวจ with color-coded backgrounds
6. **Session metadata** — start/end timestamps displayed
7. **Joint Analysis Table** — columns: ข้อต่อ, เฉลี่ย, ต่ำสุด–สูงสุด, เบี่ยงเบน, ความแม่นยำ (with animated progress bar)
8. **Clinical Summary** — ReactMarkdown rendered in styled prose container with emerald headings and amber list markers
9. **AI disclaimer** — small italic note about AI-generated reports
10. **Generate/Regenerate button** — in the dark report header
11. **Error state** — with retry button
12. **Empty states** — for no patients, no sessions, no report selected
13. **Detailed loading skeleton** — `ReportsSkeleton` matches the full layout (header, patient selector, report area with stats/table/markdown, session list)
14. **Session list skeleton** — separate `SessionListSkeleton` for session loading state
15. **Staggered framer-motion animations** — on stats cards, joint table rows, and session items

### Quality Improvements
- No blue/indigo anywhere — strict emerald (#10b981) + amber (#f59e0b) color scheme
- All Thai language
- Proper `useCallback` for fetchSessions to avoid stale closures
- Cancelled fetch pattern in patient loading
- Tabular-nums for numeric alignment
- Responsive: grid cols adapt, table has min-width with overflow-x-auto
- Session items show: exercise name, category badge, date with icon, total reps, accuracy %, eye icon

### Lint Status
- **Zero lint errors** in `doctor-reports.tsx` (2 pre-existing errors in `doctor-patients.tsx` are unrelated)
- Dev log compiles cleanly after the change