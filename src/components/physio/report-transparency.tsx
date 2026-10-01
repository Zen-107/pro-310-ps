'use client';

import { useState } from 'react';
import { Calculator, CheckCircle2, AlertTriangle, ListOrdered, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { getAccuracyTextColor } from '@/lib/angle-utils';

export interface ReportTarget {
  name: string;
  nameTh: string;
  idealAngle: number;
  minAngle: number;
  maxAngle: number;
  isPrimary: boolean;
  formula: string | null;
  angleBasis: string;
  rationale: string | null;
  overridden: boolean;
}

export interface ReportRep {
  setNumber: number;
  repNumber: number;
  bestAngle: number;
  accuracy: number;
  durationMs: number;
}

export interface ReportReview {
  status: 'APPROVED' | 'NEEDS_ATTENTION';
  comment: string | null;
  reviewedAt: string;
  reviewer: { name: string; title: string };
}

const BASIS_LABEL: Record<string, string> = {
  DEVELOPER_ESTIMATE: 'ค่าประมาณโดยผู้พัฒนา',
  SOURCE_STATED: 'จากแหล่งอ้างอิง',
  GROUND_TRUTH_EXTRACTED: 'วัดจากวิดีโออ้างอิง',
  CLINICIAN_SET: 'กำหนดโดยผู้ดูแล',
};

/** How every number in the report was computed */
export function ReportFormulas({
  angleDefinition,
  scoring,
  targets,
  algorithmVersion,
  romMinAngle,
  romMaxAngle,
  primaryJoint,
}: {
  angleDefinition: string;
  scoring: Record<string, string>;
  targets: ReportTarget[];
  algorithmVersion: string;
  romMinAngle: number | null;
  romMaxAngle: number | null;
  primaryJoint: string | null;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <Calculator className="h-4 w-4 text-emerald-600" />
        วิธีคำนวณ (Kinematics)
        <Badge variant="outline" className="font-mono text-[10px]">{algorithmVersion}</Badge>
      </h4>
      <div className="rounded-xl border bg-muted/30 p-4 space-y-2 text-xs">
        <p className="font-mono leading-relaxed">{angleDefinition}</p>
        <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
          {Object.entries(scoring).map(([key, text]) => (
            <li key={key}>{text}</li>
          ))}
        </ul>
        {primaryJoint && romMinAngle !== null && romMaxAngle !== null && (
          <p className="text-muted-foreground">
            ROM ({primaryJoint}) = {romMaxAngle}° − {romMinAngle}° = {Math.round((romMaxAngle - romMinAngle) * 10) / 10}°
          </p>
        )}
      </div>
      <div className="rounded-xl border overflow-x-auto">
        <table className="w-full text-xs min-w-[560px]">
          <thead>
            <tr className="bg-muted/60 border-b text-left">
              <th className="p-2.5 font-medium">ค่าที่วัด</th>
              <th className="p-2.5 font-medium">สูตร</th>
              <th className="p-2.5 font-medium text-center">เป้าหมาย</th>
              <th className="p-2.5 font-medium">ที่มาของเป้าหมาย</th>
            </tr>
          </thead>
          <tbody>
            {targets.map((t) => (
              <tr key={t.name} className="border-t align-top">
                <td className="p-2.5">
                  <span className="font-medium">{t.nameTh}</span>
                  {t.isPrimary && <Badge variant="secondary" className="ml-1.5 text-[10px]">นับครั้ง</Badge>}
                  <div className="font-mono text-muted-foreground">{t.name}</div>
                </td>
                <td className="p-2.5 font-mono text-muted-foreground">{t.formula ?? '—'}</td>
                <td className="p-2.5 text-center tabular-nums whitespace-nowrap">
                  {t.minAngle}° – {t.maxAngle}°<div className="text-muted-foreground">ideal {t.idealAngle}°</div>
                </td>
                <td className="p-2.5 text-muted-foreground">
                  {BASIS_LABEL[t.angleBasis] ?? t.angleBasis}
                  {t.rationale && !t.overridden && <div className="mt-0.5 text-[11px]">{t.rationale}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Per-rep results (best angle of the counted side, accuracy, duration) */
export function ReportReps({ reps }: { reps: ReportRep[] }) {
  if (reps.length === 0) return null;
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <ListOrdered className="h-4 w-4 text-emerald-600" />
        ผลรายครั้ง ({reps.length} ครั้ง)
      </h4>
      <div className="rounded-xl border overflow-x-auto max-h-64 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted">
            <tr className="text-left">
              <th className="p-2 font-medium">เซ็ต</th>
              <th className="p-2 font-medium">ครั้งที่</th>
              <th className="p-2 font-medium text-right">มุมดีที่สุด</th>
              <th className="p-2 font-medium text-right">ความแม่นยำ</th>
              <th className="p-2 font-medium text-right">เวลาค้าง</th>
            </tr>
          </thead>
          <tbody>
            {reps.map((r) => (
              <tr key={r.repNumber} className="border-t tabular-nums">
                <td className="p-2">{r.setNumber}</td>
                <td className="p-2">{r.repNumber}</td>
                <td className="p-2 text-right">{r.bestAngle}°</td>
                <td className={`p-2 text-right font-semibold ${getAccuracyTextColor(r.accuracy)}`}>{r.accuracy}%</td>
                <td className="p-2 text-right text-muted-foreground">{(r.durationMs / 1000).toFixed(1)} วิ</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Clinician sign-off: approve or flag the session for attention */
export function ReviewPanel({
  sessionId,
  review,
  onReviewed,
}: {
  sessionId: string;
  review: ReportReview | null;
  onReviewed: (review: ReportReview) => void;
}) {
  const [comment, setComment] = useState(review?.comment ?? '');
  const [saving, setSaving] = useState<null | ReportReview['status']>(null);

  async function submit(status: ReportReview['status']) {
    setSaving(status);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, comment }),
      });
      if (!res.ok) throw new Error();
      onReviewed(await res.json());
      toast.success(status === 'APPROVED' ? 'รับรองผลเซสชันแล้ว' : 'ทำเครื่องหมายให้ติดตามแล้ว');
    } catch {
      toast.error('บันทึกการตรวจสอบไม่สำเร็จ');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        การตรวจสอบโดยผู้ดูแล
      </h4>
      {review && (
        <div
          className={`rounded-lg border p-3 text-xs ${
            review.status === 'APPROVED'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
              : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
          }`}
        >
          <p className="font-medium">
            {review.status === 'APPROVED' ? 'รับรองแล้ว' : 'ต้องติดตาม'} โดย {review.reviewer.name} ·{' '}
            {new Date(review.reviewedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
          {review.comment && <p className="mt-1 text-muted-foreground">{review.comment}</p>}
        </div>
      )}
      <Textarea
        placeholder="ความเห็นของแพทย์/นักกายภาพ (ไม่บังคับ)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={!!saving} onClick={() => submit('APPROVED')}>
          {saving === 'APPROVED' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          รับรองผล
        </Button>
        <Button size="sm" variant="outline" disabled={!!saving} onClick={() => submit('NEEDS_ATTENTION')}>
          {saving === 'NEEDS_ATTENTION' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          ต้องติดตาม
        </Button>
      </div>
    </div>
  );
}
