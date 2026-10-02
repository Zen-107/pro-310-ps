'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cleanClinicalSummary } from '@/lib/clinical-markdown';
import type { ReportFaults, ReportRep, ReportReview, ReportTarget } from '@/components/physio/report-transparency';

// Clinical session report: AI summary rendering (screen + print) and the
// official printed document (Thai medical-record layout, A4).

// ─── AI summary as clean HTML (tables via remark-gfm) ───────────────

const mdComponents = (print: boolean): Components => ({
  table: ({ children }) => (
    <div className={print ? 'my-2' : 'not-prose my-3 overflow-x-auto rounded-lg border'}>
      <table className={print ? 'report-table' : 'w-full text-xs'}>{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className={print ? '' : 'bg-muted/60'}>{children}</thead>,
  th: ({ children }) => <th className={print ? '' : 'border-b p-2 text-left font-medium'}>{children}</th>,
  td: ({ children }) => <td className={print ? '' : 'border-t p-2 tabular-nums'}>{children}</td>,
  hr: () => null,
});

export function ClinicalSummaryMarkdown({
  content,
  jointNames,
  print = false,
}: {
  content: string;
  jointNames?: Record<string, string>;
  print?: boolean;
}) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents(print)}>
      {cleanClinicalSummary(content, jointNames)}
    </ReactMarkdown>
  );
}

// ─── Printed document ────────────────────────────────────────────────

export interface PrintableReport {
  sessionId: string;
  documentNumber: string;
  patient: { name: string; hn: string | null; age: number | null; gender: string; condition: string | null };
  organization: { name: string; address: string | null; phone: string | null };
  attending: { name: string; title: string; licenseNumber: string | null } | null;
  prescriptionTitle: string | null;
  exerciseName: string;
  exerciseNameEn: string;
  startedAt: string;
  endedAt: string | null;
  totalReps: number;
  avgAccuracy: number;
  maxRom: number;
  romMinAngle: number | null;
  romMaxAngle: number | null;
  primaryJoint: string | null;
  algorithmVersion: string;
  targets: ReportTarget[];
  jointReport: {
    joint: string;
    nameTh: string;
    avgAngle: number;
    minAngle: number;
    maxAngle: number;
    accuracy: number;
    samples: number;
    target: { idealAngle: number; minAngle: number; maxAngle: number } | null;
  }[];
  reps: ReportRep[];
  faults: ReportFaults;
  clinicalSummary: string | null;
  generatedAt: string | null;
  review: ReportReview | null;
}

const TITLE_TH: Record<string, string> = { DOCTOR: 'แพทย์', PHYSIOTHERAPIST: 'นักกายภาพบำบัด' };

const thDate = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
const thTime = (iso: string) => new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
const dash = (v: string | number | null | undefined) => (v === null || v === undefined || v === '' ? '—' : v);

function durationText(start: string, end: string | null): string {
  if (!end) return '—';
  const sec = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  return `${Math.floor(sec / 60)} นาที ${sec % 60} วินาที`;
}

/**
 * Default PDF file name (without .pdf): printresult_<last 6 of session id>_<patient name>,
 * e.g. printresult_e15htr_คุณวิชัย กล้าหาญ. Characters invalid in file names are removed.
 */
export function printFileName(report: Pick<PrintableReport, 'sessionId' | 'patient'>): string {
  const sessionNo = report.sessionId.slice(-6).toLowerCase();
  const name =
    report.patient.name
      .normalize('NFC')
      .replace(/[\\/:*?"<>|#%{}~&\u0000-\u001f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60) || 'patient';
  return `printresult_${sessionNo}_${name}`;
}

export function ReportPrintDocument({ report }: { report: PrintableReport }) {
  const names = Object.fromEntries(report.jointReport.map((j) => [j.joint, j.nameTh]));
  const primary = report.targets.find((t) => t.name === report.primaryJoint) ?? report.targets.find((t) => t.isPrimary);
  const printedAt = new Date().toISOString();
  const attendingLine = report.attending
    ? `${report.attending.name} (${TITLE_TH[report.attending.title] ?? report.attending.title})`
    : '—';

  return (
    <article data-print-only className="report-print">
      {/* ── Letterhead ── */}
      <header className="rp-letterhead">
        <div>
          <p className="rp-org">{report.organization.name}</p>
          {report.organization.address && <p className="rp-small">{report.organization.address}</p>}
          {report.organization.phone && <p className="rp-small">โทร {report.organization.phone}</p>}
        </div>
        <table className="rp-docmeta">
          <tbody>
            <tr>
              <th>เลขที่เอกสาร</th>
              <td>{report.documentNumber}</td>
            </tr>
            <tr>
              <th>วันที่ออกเอกสาร</th>
              <td>
                {thDate(printedAt)} {thTime(printedAt)} น.
              </td>
            </tr>
          </tbody>
        </table>
      </header>

      <h1 className="rp-title">แบบบันทึกผลการฟื้นฟูสมรรถภาพทางกายภาพบำบัด (ทางไกล)</h1>
      <p className="rp-subtitle">Telerehabilitation Physical Therapy Session Record</p>

      {/* ── Patient data ── */}
      <section className="rp-section rp-avoid">
        <h2>ข้อมูลผู้ป่วย</h2>
        <table className="report-table rp-kv">
          <tbody>
            <tr>
              <th>เลขประจำตัวผู้ป่วย (HN)</th>
              <td>{dash(report.patient.hn)}</td>
              <th>ชื่อ–สกุล</th>
              <td>{report.patient.name}</td>
            </tr>
            <tr>
              <th>เพศ</th>
              <td>{dash(report.patient.gender)}</td>
              <th>อายุ</th>
              <td>{report.patient.age !== null ? `${report.patient.age} ปี` : '—'}</td>
            </tr>
            <tr>
              <th>การวินิจฉัย / ภาวะ</th>
              <td colSpan={3}>{dash(report.patient.condition)}</td>
            </tr>
            <tr>
              <th>ผู้รับผิดชอบ</th>
              <td colSpan={3}>
                {attendingLine}
                {report.attending?.licenseNumber && ` · ใบอนุญาตประกอบวิชาชีพเลขที่ ${report.attending.licenseNumber}`}
              </td>
            </tr>
            <tr>
              <th>แผนการรักษา</th>
              <td colSpan={3}>{dash(report.prescriptionTitle)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── Session ── */}
      <section className="rp-section rp-avoid">
        <h2>1. ข้อมูลการฝึก</h2>
        <table className="report-table rp-kv">
          <tbody>
            <tr>
              <th>ท่าฝึก</th>
              <td>
                {report.exerciseName}
                {report.exerciseNameEn !== report.exerciseName && ` (${report.exerciseNameEn})`}
              </td>
              <th>วันที่ฝึก</th>
              <td>{thDate(report.startedAt)}</td>
            </tr>
            <tr>
              <th>เวลา</th>
              <td>
                {thTime(report.startedAt)}
                {report.endedAt && ` – ${thTime(report.endedAt)}`} น.
              </td>
              <th>ระยะเวลา</th>
              <td>{durationText(report.startedAt, report.endedAt)}</td>
            </tr>
            <tr>
              <th>จำนวนครั้งที่ทำได้</th>
              <td>{report.totalReps} ครั้ง</td>
              <th>ความแม่นยำเฉลี่ย</th>
              <td>{report.avgAccuracy}%</td>
            </tr>
            <tr>
              <th>ช่วงการเคลื่อนไหว (ROM)</th>
              <td colSpan={3}>
                {report.maxRom}° {primary && `(${primary.nameTh})`}
                {report.romMinAngle !== null && report.romMaxAngle !== null && ` · จาก ${report.romMinAngle}° ถึง ${report.romMaxAngle}°`}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── Joint angles ── */}
      {report.jointReport.length > 0 && (
        <section className="rp-section rp-avoid">
          <h2>2. ผลการวัดมุมข้อต่อเทียบกับเป้าหมาย</h2>
          <table className="report-table">
            <thead>
              <tr>
                <th>ข้อต่อ</th>
                <th className="rp-num">ช่วงเป้าหมาย</th>
                <th className="rp-num">ค่าที่เหมาะสม</th>
                <th className="rp-num">เฉลี่ย</th>
                <th className="rp-num">ต่ำสุด – สูงสุด</th>
                <th className="rp-num">อยู่ในช่วงเป้าหมาย</th>
              </tr>
            </thead>
            <tbody>
              {report.jointReport.map((j) => (
                <tr key={j.joint}>
                  <td>{j.nameTh}</td>
                  <td className="rp-num">{j.target ? `${j.target.minAngle}° – ${j.target.maxAngle}°` : '—'}</td>
                  <td className="rp-num">{j.target ? `${j.target.idealAngle}°` : '—'}</td>
                  <td className="rp-num">{j.avgAngle}°</td>
                  <td className="rp-num">
                    {j.minAngle}° – {j.maxAngle}°
                  </td>
                  <td className="rp-num">
                    {j.accuracy}% ({j.samples} ครั้ง)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ── Faults ── */}
      <section className="rp-section rp-avoid">
        <h2>3. ความถูกต้องของท่าทาง</h2>
        <table className="report-table">
          <thead>
            <tr>
              <th>รายการ</th>
              <th className="rp-num">จำนวน</th>
              <th>รายละเอียด</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>ครั้งที่ไม่ถูกต้อง</td>
              <td className="rp-num">
                {report.faults.incorrectReps} / {report.totalReps}
              </td>
              <td>ครั้งที่มีท่าชดเชยหรือความแม่นยำต่ำกว่าเกณฑ์</td>
            </tr>
            <tr>
              <td>ทำไม่สุดช่วงการเคลื่อนไหว</td>
              <td className="rp-num">{report.faults.counts.INCOMPLETE_ROM}</td>
              <td>{report.faults.avgIncompleteDeficit !== null ? `ขาดจากช่วงเป้าหมายเฉลี่ย ${report.faults.avgIncompleteDeficit}°` : '—'}</td>
            </tr>
            <tr>
              <td>ท่าชดเชย</td>
              <td className="rp-num">{report.faults.counts.COMPENSATION}</td>
              <td>{report.faults.compensations.map((c) => `${c.message} (${c.count})`).join('; ') || '—'}</td>
            </tr>
            <tr>
              <td>ความแม่นยำต่ำ</td>
              <td className="rp-num">{report.faults.counts.LOW_ACCURACY}</td>
              <td>ความแม่นยำต่อครั้งต่ำกว่า 60%</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── Clinical summary ── */}
      <section className="rp-section">
        <h2>4. สรุปทางคลินิก</h2>
        {report.clinicalSummary ? (
          <div className="rp-summary">
            <ClinicalSummaryMarkdown content={report.clinicalSummary} jointNames={names} print />
            <p className="rp-note">
              ร่างโดยระบบ AI {report.generatedAt && `เมื่อ ${thDate(report.generatedAt)} ${thTime(report.generatedAt)} น.`} — ผู้ลงนามได้ตรวจสอบความถูกต้องแล้ว
            </p>
          </div>
        ) : (
          <p className="rp-blank-lines">
            ...........................................................................................................................................
            <br />
            ...........................................................................................................................................
          </p>
        )}
      </section>

      {/* ── Review ── */}
      <section className="rp-section rp-avoid">
        <h2>5. ผลการตรวจสอบโดยผู้ดูแล</h2>
        <p>
          {report.review
            ? `${report.review.status === 'APPROVED' ? '☑ รับรองผล' : '☑ ต้องติดตาม'} โดย ${report.review.reviewer.name} เมื่อ ${thDate(report.review.reviewedAt)} ${thTime(report.review.reviewedAt)} น.`
            : '☐ รับรองผล    ☐ ต้องติดตาม'}
        </p>
        {report.review?.comment && <p>ความเห็น: {report.review.comment}</p>}
      </section>

      {/* ── Signature ── */}
      <section className="rp-signature rp-avoid">
        <div className="rp-sign-box">
          <p>ลงชื่อ ..................................................................</p>
          <p>( {report.attending?.name ?? '..................................................................'} )</p>
          <p>ตำแหน่ง {report.attending ? TITLE_TH[report.attending.title] ?? report.attending.title : '..................................................'}</p>
          <p>
            เลขที่ใบอนุญาตประกอบวิชาชีพ {report.attending?.licenseNumber ?? '..............................'}
          </p>
          <p>วันที่ ........ / ................ / ..........</p>
        </div>
      </section>

      <footer className="rp-footer">
        ข้อมูลมุมข้อต่อได้จากการประมวลผลภาพด้วยกล้อง (MediaPipe Pose, {report.algorithmVersion}) ใช้ประกอบการตรวจร่างกายโดยบุคลากรทางการแพทย์
        ไม่ใช่เครื่องมือวินิจฉัย · Session ID {report.sessionId} · เอกสารนี้เป็นข้อมูลสุขภาพส่วนบุคคล (PDPA) ห้ามเผยแพร่
      </footer>
    </article>
  );
}
