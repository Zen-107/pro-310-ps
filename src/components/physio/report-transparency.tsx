'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  Calculator,
  CheckCircle2,
  AlertTriangle,
  ListOrdered,
  Loader2,
  Film,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  StepBack,
  StepForward,
  LineChart as LineChartIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { getAccuracyTextColor, getAngleStatus, LANDMARKS, SKELETON_CONNECTIONS, type AngleStatus } from '@/lib/angle-utils';
import { safeTruncate } from '@/lib/text-safe';
import {
  arcGeometry,
  frameIndexAt,
  framePoints,
  measurementLandmarks,
  pointOf,
  project,
  MID_SHOULDER,
  type P2,
  type ReplayFrame,
} from '@/lib/replay';

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
  isCorrect?: boolean;
  enteredAt?: string;
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
        <Calculator className="h-4 w-4 text-teal-600" />
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
                  {t.rationale && !t.overridden && <div className="mt-0.5 text-[11px]">{safeTruncate(t.rationale, 600)}</div>}
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
        <ListOrdered className="h-4 w-4 text-teal-600" />
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
                <td className={`p-2 text-right font-semibold ${getAccuracyTextColor(r.accuracy)}`}>
                  {r.accuracy}%{r.isCorrect === false && <span className="ml-1 text-amber-600" title="Incorrect rep">⚠</span>}
                </td>
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
              ? 'bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800'
              : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
          }`}
        >
          <p className="font-medium">
            {review.status === 'APPROVED' ? 'รับรองแล้ว' : 'ต้องติดตาม'} โดย {review.reviewer.name} ·{' '}
            {new Date(review.reviewedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
          {review.comment && <p className="mt-1 text-muted-foreground">{safeTruncate(review.comment, 1000)}</p>}
        </div>
      )}
      <Textarea
        data-print-hide
        placeholder="ความเห็นของแพทย์/นักกายภาพ (ไม่บังคับ)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="text-sm"
      />
      <div data-print-hide className="flex flex-wrap gap-2">
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

export interface ReportFaults {
  total: number;
  counts: { INCOMPLETE_ROM: number; COMPENSATION: number; LOW_ACCURACY: number };
  incorrectReps: number;
  avgIncompleteDeficit: number | null;
  compensations: { checkId: string; message: string; count: number }[];
  items: {
    type: 'INCOMPLETE_ROM' | 'COMPENSATION' | 'LOW_ACCURACY';
    repNumber: number | null;
    joint: string;
    measuredAngle: number;
    expectedMin: number | null;
    expectedMax: number | null;
    deficit: number | null;
    message: string;
    occurredAt: string;
  }[];
}

const FAULT_LABEL: Record<ReportFaults['items'][number]['type'], string> = {
  INCOMPLETE_ROM: 'ทำไม่สุดระยะ',
  COMPENSATION: 'ท่าชดเชย',
  LOW_ACCURACY: 'ความแม่นยำต่ำ',
};

/** Form faults: incomplete ROM, compensations and low-accuracy reps */
export function ReportFaultsPanel({ faults, totalReps }: { faults: ReportFaults; totalReps: number }) {
  const expected = (f: ReportFaults['items'][number]) =>
    f.expectedMin !== null && f.expectedMax !== null
      ? `${f.expectedMin}–${f.expectedMax}°`
      : f.expectedMin !== null
        ? `≥ ${f.expectedMin}°`
        : f.expectedMax !== null
          ? `≤ ${f.expectedMax}°`
          : '—';
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        ข้อผิดพลาดของท่าทาง (Form faults)
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
        <div className="rounded-lg border p-2.5">
          <p className="text-lg font-bold tabular-nums">{faults.incorrectReps}/{totalReps}</p>
          <p className="text-[11px] text-muted-foreground">ครั้งที่ไม่ถูกต้อง</p>
        </div>
        <div className="rounded-lg border p-2.5">
          <p className="text-lg font-bold tabular-nums">{faults.counts.INCOMPLETE_ROM}</p>
          <p className="text-[11px] text-muted-foreground">
            ทำไม่สุดระยะ{faults.avgIncompleteDeficit !== null && ` (ขาด ~${faults.avgIncompleteDeficit}°)`}
          </p>
        </div>
        <div className="rounded-lg border p-2.5">
          <p className="text-lg font-bold tabular-nums">{faults.counts.COMPENSATION}</p>
          <p className="text-[11px] text-muted-foreground">ท่าชดเชย</p>
        </div>
        <div className="rounded-lg border p-2.5">
          <p className="text-lg font-bold tabular-nums">{faults.counts.LOW_ACCURACY}</p>
          <p className="text-[11px] text-muted-foreground">ความแม่นยำต่ำ</p>
        </div>
      </div>
      {faults.compensations.length > 0 && (
        <ul className="space-y-1 text-xs">
          {faults.compensations.map((c) => (
            <li key={c.checkId} className="flex justify-between rounded bg-amber-50 px-2.5 py-1.5 dark:bg-amber-950/30">
              <span>{safeTruncate(c.message, 160)}</span>
              <span className="font-semibold tabular-nums">×{c.count}</span>
            </li>
          ))}
        </ul>
      )}
      {faults.items.length === 0 ? (
        <p className="text-xs text-muted-foreground">ไม่พบข้อผิดพลาดของท่าทางในเซสชันนี้</p>
      ) : (
        <div className="rounded-xl border overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-xs min-w-[520px]">
            <thead className="sticky top-0 bg-muted">
              <tr className="text-left">
                <th className="p-2 font-medium">ครั้งที่</th>
                <th className="p-2 font-medium">ประเภท</th>
                <th className="p-2 font-medium">ค่าที่วัด</th>
                <th className="p-2 font-medium text-right">วัดได้</th>
                <th className="p-2 font-medium text-right">ที่ควรเป็น</th>
                <th className="p-2 font-medium text-right">ห่าง</th>
              </tr>
            </thead>
            <tbody>
              {faults.items.map((f, i) => (
                <tr key={i} className="border-t align-top">
                  <td className="p-2 tabular-nums">{f.repNumber ?? '—'}</td>
                  <td className="p-2">
                    <span className="font-medium">{FAULT_LABEL[f.type]}</span>
                    <div className="text-muted-foreground">{safeTruncate(f.message, 160)}</div>
                  </td>
                  <td className="p-2 font-mono text-muted-foreground">{f.joint}</td>
                  <td className="p-2 text-right tabular-nums">{Math.round(f.measuredAngle)}°</td>
                  <td className="p-2 text-right tabular-nums">{expected(f)}</td>
                  <td className="p-2 text-right tabular-nums text-amber-600">{f.deficit !== null ? `${f.deficit}°` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Clinical session replay ──────────────────────────────────────────
// Plays back the pose frames recorded during the session (10 fps) on a
// skeleton rig, with the recorded joint angles, the target (ROM) band of the
// selected measurement and the form faults at the moment they were logged.

const SPEEDS = [0.5, 1, 2] as const;
const FAULT_WINDOW_MS = 750; // a fault is shown this long around its timestamp
const SCRUB_STEP_MS = 100; // one recorded frame
const RIG_W = 360;
const RIG_H = 300;
const CHART_W = 640;
const CHART_H = 120;
const CHART_PAD = { l: 34, r: 8, t: 14, b: 22 };

const STATUS_STROKE: Record<AngleStatus, string> = {
  good: 'stroke-emerald-500',
  warn: 'stroke-amber-500',
  bad: 'stroke-red-500',
};
const STATUS_TEXT: Record<AngleStatus, string> = {
  good: 'fill-emerald-700 dark:fill-emerald-300',
  warn: 'fill-amber-600 dark:fill-amber-300',
  bad: 'fill-red-600 dark:fill-red-400',
};
const FAULT_FILL: Record<ReportFaults['items'][number]['type'], string> = {
  COMPENSATION: 'fill-red-500',
  INCOMPLETE_ROM: 'fill-amber-500',
  LOW_ACCURACY: 'fill-orange-400',
};

const VIEWS = [
  { label: 'กล้อง', yaw: 0 },
  { label: 'ด้านข้าง', yaw: 90 },
  { label: '45°', yaw: 45 },
] as const;

function formatClock(ms: number): string {
  const s = Math.max(0, ms) / 1000;
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toFixed(1).padStart(4, '0')}`;
}

const dirOf = (deg: number): P2 => ({ x: Math.cos((deg * Math.PI) / 180), y: Math.sin((deg * Math.PI) / 180) });
const r2 = (v: number) => Math.round(v * 100) / 100;

/** SVG arc around c from angle a0 sweeping `sweep` degrees; wedge closes it to the centre */
function arc(c: P2, radius: number, a0: number, sweep: number, wedge = false): string {
  const p0 = { x: c.x + dirOf(a0).x * radius, y: c.y + dirOf(a0).y * radius };
  const p1 = { x: c.x + dirOf(a0 + sweep).x * radius, y: c.y + dirOf(a0 + sweep).y * radius };
  const large = Math.abs(sweep) > 180 ? 1 : 0;
  const flag = sweep > 0 ? 1 : 0;
  const a = `A${radius},${radius} 0 ${large} ${flag} ${r2(p1.x)},${r2(p1.y)}`;
  return wedge ? `M${r2(c.x)},${r2(c.y)} L${r2(p0.x)},${r2(p0.y)} ${a} Z` : `M${r2(p0.x)},${r2(p0.y)} ${a}`;
}

interface VideoMeta {
  recordStartAt: number;
  pauses: { at: number; resumedAt: number }[];
  complete: boolean;
}

/** Wall-clock time → position in the recorded video (seconds), skipping paused spans */
function videoSeconds(meta: VideoMeta, wallMs: number): number {
  let paused = 0;
  for (const p of meta.pauses) {
    if (p.at >= wallMs) break;
    paused += Math.min(p.resumedAt, wallMs) - p.at;
  }
  return (wallMs - meta.recordStartAt - paused) / 1000;
}

/**
 * Session video recorded with the patient's consent. MediaRecorder WebM files
 * have no duration header; seeking far past the end once makes the browser
 * compute it, after which normal seeking works.
 */
function SessionVideoPlayer({
  sessionId,
  videoRef,
  meta,
}: {
  sessionId: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  meta: VideoMeta;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-black">
      <video
        ref={videoRef}
        src={`/api/sessions/${sessionId}/video`}
        className="h-72 w-full object-contain"
        playsInline
        muted
        preload="metadata"
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (!Number.isFinite(v.duration)) {
            const reset = () => {
              v.removeEventListener('timeupdate', reset);
              v.currentTime = 0;
            };
            v.addEventListener('timeupdate', reset);
            v.currentTime = 1e101;
          }
        }}
      />
      <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
        วิดีโอ (ผู้ป่วยให้ความยินยอม){!meta.complete && ' · บันทึกไม่ครบ'}
      </span>
    </div>
  );
}

interface ReplayFault {
  t: number;
  type: ReportFaults['items'][number]['type'];
  joint: string;
  message: string;
  repNumber: number | null;
  measuredAngle: number;
}

export function ClinicalSessionReplay({
  sessionId,
  targets,
  faults,
  reps,
  primaryJoint,
  view = 'replay',
}: {
  sessionId: string;
  targets: ReportTarget[];
  faults: ReportFaults['items'];
  reps: ReportRep[];
  primaryJoint: string | null;
  /**
   * 'replay' = video + 3D rig + timeline (default); 'chart' = large
   * angle-over-time chart with joint picker and the same playback controls.
   */
  view?: 'replay' | 'chart';
}) {
  const [frames, setFrames] = useState<ReplayFrame[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [time, setTime] = useState(0); // ms since the first frame
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [yaw, setYaw] = useState(0);
  const [focus, setFocus] = useState<string>(primaryJoint ?? targets.find((t) => t.isPrimary)?.name ?? targets[0]?.name ?? '');
  const timeRef = useRef(0);
  const chartRef = useRef<SVGSVGElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null);

  // Consented session video, if one was recorded
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sessions/${sessionId}/video?meta=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setVideoMeta({
          recordStartAt: new Date(d.recordStartAt).getTime(),
          pauses: Array.isArray(d.pauses) ? d.pauses : [],
          complete: !!d.complete,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sessions/${sessionId}/frames`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => !cancelled && setFrames(d.frames ?? []))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const t0 = frames?.[0]?.t ?? 0;
  const duration = frames && frames.length > 1 ? frames[frames.length - 1].t - t0 : 0;

  const seek = useCallback(
    (ms: number) => {
      const clamped = Math.min(Math.max(ms, 0), duration);
      timeRef.current = clamped;
      setTime(clamped);
    },
    [duration]
  );

  // Playback clock (requestAnimationFrame, scaled by speed)
  useEffect(() => {
    if (!playing || !frames?.length) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const next = timeRef.current + (now - last) * speed;
      last = now;
      if (next >= duration) {
        seek(duration);
        setPlaying(false);
        return;
      }
      timeRef.current = next;
      setTime(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, frames, duration, seek]);

  // Keep the video on the replay clock (the replay is the master timeline)
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !videoMeta || !frames?.length) return;
    const target = videoSeconds(videoMeta, t0 + time);
    const known = Number.isFinite(v.duration);
    if (target < 0 || (known && target > v.duration)) {
      if (!v.paused) v.pause();
      return;
    }
    if (Math.abs(v.currentTime - target) > (playing ? 0.4 : 0.05)) v.currentTime = target;
    v.playbackRate = speed;
    if (playing && v.paused) v.play().catch(() => {});
    if (!playing && !v.paused) v.pause();
  }, [time, playing, speed, videoMeta, frames, t0]);

  const replayFaults: ReplayFault[] = useMemo(
    () =>
      faults
        .map((f) => ({
          t: new Date(f.occurredAt).getTime() - t0,
          type: f.type,
          joint: f.joint,
          message: f.message,
          repNumber: f.repNumber,
          measuredAngle: f.measuredAngle,
        }))
        .filter((f) => Number.isFinite(f.t))
        .sort((a, b) => a.t - b.t),
    [faults, t0]
  );

  const repMarks = useMemo(
    () =>
      reps
        .filter((r) => r.enteredAt)
        .map((r) => ({ t: new Date(r.enteredAt!).getTime() - t0, repNumber: r.repNumber, isCorrect: r.isCorrect !== false })),
    [reps, t0]
  );

  // Stable framing: bounds of every point over the whole recording for this view
  const bounds = useMemo(() => {
    if (!frames?.length) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const step = Math.max(1, Math.floor(frames.length / 400));
    for (let i = 0; i < frames.length; i += step) {
      for (const p of framePoints(frames[i]).values()) {
        const q = project(p, yaw);
        minX = Math.min(minX, q.x);
        maxX = Math.max(maxX, q.x);
        minY = Math.min(minY, q.y);
        maxY = Math.max(maxY, q.y);
      }
    }
    if (!Number.isFinite(minX)) return null;
    const span = Math.max(maxX - minX, maxY - minY, 1e-3);
    const scale = (Math.min(RIG_W, RIG_H) - 48) / span;
    return {
      toSvg: (p: P2): P2 => ({
        x: RIG_W / 2 + (p.x - (minX + maxX) / 2) * scale,
        y: RIG_H / 2 + (p.y - (minY + maxY) / 2) * scale,
      }),
    };
  }, [frames, yaw]);

  const idx = frames?.length ? frameIndexAt(frames, t0 + time) : -1;
  const frame = idx >= 0 ? frames![idx] : null;
  const now = frame ? frame.t - t0 : 0;
  const activeFaults = replayFaults.filter((f) => Math.abs(f.t - now) <= FAULT_WINDOW_MS);
  const faultLandmarks = new Map<number, ReplayFault['type']>();
  for (const f of activeFaults) {
    for (const lm of measurementLandmarks(f.joint)) {
      if (faultLandmarks.get(lm) !== 'COMPENSATION') faultLandmarks.set(lm, f.type);
    }
  }

  const targetByName = new Map(targets.map((t) => [t.name, t]));
  const focusTarget = targetByName.get(focus);
  // Measurements offered in the picker: targets, then anything a fault refers to
  const measurementOptions = [...new Set([...targets.map((t) => t.name), ...replayFaults.map((f) => f.joint)])];

  // ─── Chart series for the focused measurement ─────────────────────
  const chart = useMemo(() => {
    if (!frames?.length || !focus) return null;
    const values = frames.map((f) => f.a[focus]);
    const present = values.filter((v): v is number => v !== undefined);
    if (!present.length) return { segments: [] as string[], yOf: (v: number) => v, lo: 0, hi: 180 };
    let lo = Math.min(...present);
    let hi = Math.max(...present);
    if (focusTarget) {
      lo = Math.min(lo, focusTarget.minAngle);
      hi = Math.max(hi, focusTarget.maxAngle);
    }
    lo = Math.floor((lo - 5) / 10) * 10;
    hi = Math.ceil((hi + 5) / 10) * 10;
    const innerW = CHART_W - CHART_PAD.l - CHART_PAD.r;
    const innerH = CHART_H - CHART_PAD.t - CHART_PAD.b;
    const xOf = (t: number) => CHART_PAD.l + (duration > 0 ? (t / duration) * innerW : 0);
    const yOf = (v: number) => CHART_PAD.t + (1 - (v - lo) / (hi - lo || 1)) * innerH;
    // Polyline segments, broken where the measurement was not visible
    const segments: string[] = [];
    let cur: string[] = [];
    frames.forEach((f, i) => {
      const v = values[i];
      if (v === undefined) {
        if (cur.length > 1) segments.push(cur.join(' '));
        cur = [];
        return;
      }
      cur.push(`${r2(xOf(f.t - t0))},${r2(yOf(v))}`);
    });
    if (cur.length > 1) segments.push(cur.join(' '));
    return { segments, yOf, lo, hi };
  }, [frames, focus, focusTarget, duration, t0]);

  const xOfTime = (t: number) => CHART_PAD.l + (duration > 0 ? (t / duration) * (CHART_W - CHART_PAD.l - CHART_PAD.r) : 0);

  const scrubFromPointer = (e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = chartRef.current;
    if (!svg || duration <= 0) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CHART_W;
    const innerW = CHART_W - CHART_PAD.l - CHART_PAD.r;
    seek(((x - CHART_PAD.l) / innerW) * duration);
  };

  const jumpToFault = (direction: 1 | -1) => {
    const list = direction > 0 ? replayFaults.filter((f) => f.t > now + 1) : replayFaults.filter((f) => f.t < now - 1).reverse();
    if (list[0]) {
      setPlaying(false);
      seek(list[0].t);
    }
  };

  const stepFrame = (delta: number) => {
    if (!frames?.length) return;
    setPlaying(false);
    const next = Math.min(Math.max(idx + delta, 0), frames.length - 1);
    seek(frames[next].t - t0);
  };

  // ─── Render ───────────────────────────────────────────────────────
  const header =
    view === 'chart' ? (
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <LineChartIcon className="h-4 w-4 text-teal-600" />
        กราฟมุมข้อต่อตลอดเซสชัน
        <span className="font-normal text-muted-foreground">· แตะกราฟเพื่อเลื่อนไปยังช่วงเวลา</span>
      </h4>
    ) : (
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <Film className="h-4 w-4 text-teal-600" />
        Clinical Session Replay
        <span className="font-normal text-muted-foreground">· ภาพซ้ำการเคลื่อนไหวจากข้อมูลที่บันทึก</span>
      </h4>
    );

  if (loadError) {
    return (
      <div className="space-y-3">
        {header}
        <p className="text-xs text-muted-foreground">โหลดข้อมูลการเคลื่อนไหวไม่สำเร็จ</p>
      </div>
    );
  }
  if (!frames) {
    return (
      <div className="space-y-3">
        {header}
        <div className="flex h-40 items-center justify-center rounded-xl border">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }
  if (frames.length < 2 || !bounds || !frame) {
    return (
      <div className="space-y-3">
        {header}
        {videoMeta && (
          <video src={`/api/sessions/${sessionId}/video`} controls playsInline muted className="h-72 w-full rounded-xl border bg-black object-contain" />
        )}
        <p className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
          ไม่มีข้อมูลเฟรมสำหรับเซสชันนี้ (เซสชันที่บันทึกก่อนเปิดใช้ระบบ replay จะไม่มีข้อมูลนี้)
        </p>
      </div>
    );
  }

  const points = framePoints(frame);
  const svgPt = (idx: number) => {
    const p = pointOf(points, idx);
    return p ? bounds.toSvg(project(p, yaw)) : null;
  };

  // Measurements drawn on the rig: every target, focused one emphasised
  const arcs = targets
    .map((t) => {
      const value = frame.a[t.name];
      const g = arcGeometry(t.name, points, yaw);
      if (value === undefined || !g) return null;
      const vertex = bounds.toSvg(g.vertex);
      return { t, value, g, vertex, status: getAngleStatus(value, t.minAngle, t.maxAngle) };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  const focusArc = arcs.find((a) => a.t.name === focus);
  const neck = svgPt(MID_SHOULDER);
  const nose = svgPt(LANDMARKS.NOSE);

  return (
    <div
      className="space-y-3 outline-none"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === ' ') {
          e.preventDefault();
          setPlaying((p) => !p);
        } else if (e.key === 'ArrowRight') stepFrame(1);
        else if (e.key === 'ArrowLeft') stepFrame(-1);
      }}
      aria-label="Clinical session replay. Space to play or pause, arrow keys to step frames."
    >
      {header}

      {view === 'chart' && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Measurement">
          {targets.map((t) => {
            const v = frame.a[t.name];
            const status = v === undefined ? null : getAngleStatus(v, t.minAngle, t.maxAngle);
            return (
              <button
                type="button"
                key={t.name}
                onClick={() => setFocus(t.name)}
                aria-pressed={t.name === focus}
                className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                  t.name === focus ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/40' : 'hover:bg-muted/60'
                }`}
              >
                <span>
                  <span className="block font-medium">{t.nameTh}</span>
                  <span className="block text-[10px] text-muted-foreground tabular-nums">
                    เป้าหมาย {t.minAngle}°–{t.maxAngle}°
                  </span>
                </span>
                <span
                  className={`text-base font-bold tabular-nums ${
                    status === 'good' ? 'text-emerald-600' : status === 'warn' ? 'text-amber-600' : status === 'bad' ? 'text-red-600' : 'text-muted-foreground'
                  }`}
                >
                  {v === undefined ? '—' : `${Math.round(v)}°`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {view === 'replay' && (
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className={videoMeta ? 'grid gap-3 md:grid-cols-2' : ''}>
        {videoMeta && <SessionVideoPlayer sessionId={sessionId} videoRef={videoRef} meta={videoMeta} />}
        {/* Rig */}
        <div className="relative rounded-xl border bg-gradient-to-b from-muted/30 to-muted/60">
          <svg viewBox={`0 0 ${RIG_W} ${RIG_H}`} className="h-72 w-full" role="img" aria-label={`Replay frame at ${formatClock(now)}`}>
            {/* vertical reference through the pelvis for trunk measures */}
            {focusArc?.g && focus.startsWith('trunk_') && (
              <line
                x1={focusArc.vertex.x}
                y1={focusArc.vertex.y}
                x2={focusArc.vertex.x}
                y2={focusArc.vertex.y - 90}
                className="stroke-slate-400"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
            )}

            {/* ROM threshold band + min/max rays for the focused measurement */}
            {focusArc && (
              <g>
                <path
                  d={arc(focusArc.vertex, 46, focusArc.g.startDeg + focusArc.g.sign * focusArc.t.minAngle, focusArc.g.sign * (focusArc.t.maxAngle - focusArc.t.minAngle), true)}
                  className="fill-teal-500/15 stroke-none"
                />
                {[focusArc.t.minAngle, focusArc.t.maxAngle].map((deg, i) => {
                  const d = dirOf(focusArc.g.startDeg + focusArc.g.sign * deg);
                  return (
                    <g key={i}>
                      <line
                        x1={focusArc.vertex.x}
                        y1={focusArc.vertex.y}
                        x2={r2(focusArc.vertex.x + d.x * 58)}
                        y2={r2(focusArc.vertex.y + d.y * 58)}
                        className="stroke-teal-600/70 dark:stroke-teal-400/70"
                        strokeDasharray="4 3"
                        strokeWidth={1.2}
                      />
                      <text
                        x={r2(focusArc.vertex.x + d.x * 66)}
                        y={r2(focusArc.vertex.y + d.y * 66)}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-teal-700 dark:fill-teal-300 text-[8px]"
                      >
                        {i === 0 ? 'min' : 'max'} {deg}°
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* bones */}
            {SKELETON_CONNECTIONS.map(([a, b]) => {
              const p = svgPt(a);
              const q = svgPt(b);
              if (!p || !q) return null;
              const flagged = faultLandmarks.has(a) && faultLandmarks.has(b);
              return (
                <line
                  key={`${a}-${b}`}
                  x1={r2(p.x)}
                  y1={r2(p.y)}
                  x2={r2(q.x)}
                  y2={r2(q.y)}
                  className={flagged ? 'stroke-red-500' : 'stroke-slate-500 dark:stroke-slate-300'}
                  strokeWidth={flagged ? 4 : 3}
                  strokeLinecap="round"
                />
              );
            })}
            {neck && nose && (
              <>
                <line x1={r2(neck.x)} y1={r2(neck.y)} x2={r2(nose.x)} y2={r2(nose.y)} className="stroke-slate-400" strokeWidth={2} strokeLinecap="round" />
                <circle cx={r2(nose.x)} cy={r2(nose.y)} r={9} className="fill-slate-300/70 stroke-slate-500 dark:fill-slate-600/70" strokeWidth={1} />
              </>
            )}

            {/* joints + compensation markers */}
            {[...points.keys()].filter((i) => i !== LANDMARKS.NOSE).map((i) => {
              const p = svgPt(i)!;
              const fault = faultLandmarks.get(i);
              return (
                <g key={i}>
                  {fault && (
                    <circle cx={r2(p.x)} cy={r2(p.y)} r={11} className={`${fault === 'COMPENSATION' ? 'stroke-red-500' : 'stroke-amber-500'} fill-none animate-pulse`} strokeWidth={2.5} />
                  )}
                  <circle cx={r2(p.x)} cy={r2(p.y)} r={4} className="fill-white stroke-slate-600" strokeWidth={1.2} />
                </g>
              );
            })}

            {/* angle arcs + recorded values */}
            {arcs.map((a) => {
              const focused = a.t.name === focus;
              const label = dirOf(a.g.startDeg + (a.g.sign * a.g.projectedDeg) / 2);
              const rad = focused ? 24 : 16;
              return (
                <g key={a.t.name} opacity={focused ? 1 : 0.65}>
                  <path
                    d={arc(a.vertex, rad, a.g.startDeg, a.g.sign * a.g.projectedDeg)}
                    fill="none"
                    className={STATUS_STROKE[a.status]}
                    strokeWidth={focused ? 2.5 : 1.5}
                    strokeLinecap="round"
                  />
                  <text
                    x={r2(a.vertex.x + label.x * (rad + 12))}
                    y={r2(a.vertex.y + label.y * (rad + 12))}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className={`${STATUS_TEXT[a.status]} ${focused ? 'text-[11px] font-bold' : 'text-[9px] font-semibold'}`}
                  >
                    {Math.round(a.value)}°
                  </text>
                </g>
              );
            })}
          </svg>

          {activeFaults.length > 0 && (
            <div className="absolute inset-x-2 top-2 space-y-1" role="status">
              {activeFaults.slice(0, 3).map((f, i) => (
                <div
                  key={i}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium shadow-sm ${
                    f.type === 'COMPENSATION'
                      ? 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                      : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}
                >
                  {FAULT_LABEL[f.type]}
                  {f.repNumber !== null && ` · ครั้งที่ ${f.repNumber}`} — {safeTruncate(f.message, 90)}
                </div>
              ))}
            </div>
          )}
          <div className="absolute bottom-2 left-2 rounded bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {frame.s === 'w' ? '3D world' : '2D image'} · frame {idx + 1}/{frames.length}
          </div>
        </div>

        </div>

        {/* Live angle panel */}
        <div className="space-y-2">
          <label className="block text-[11px] text-muted-foreground">
            ค่าที่ติดตาม
            <select
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-xs"
            >
              {measurementOptions.map((m) => (
                <option key={m} value={m}>
                  {targetByName.get(m)?.nameTh ?? m}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-xl border divide-y text-xs">
            {targets.map((t) => {
              const v = frame.a[t.name];
              const status = v === undefined ? null : getAngleStatus(v, t.minAngle, t.maxAngle);
              return (
                <button
                  type="button"
                  key={t.name}
                  onClick={() => setFocus(t.name)}
                  className={`flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left ${t.name === focus ? 'bg-muted/60' : ''}`}
                >
                  <span>
                    <span className="font-medium">{t.nameTh}</span>
                    <span className="block text-[10px] text-muted-foreground tabular-nums">
                      {t.minAngle}°–{t.maxAngle}°
                    </span>
                  </span>
                  <span
                    className={`tabular-nums font-bold ${
                      status === 'good' ? 'text-emerald-600' : status === 'warn' ? 'text-amber-600' : status === 'bad' ? 'text-red-600' : 'text-muted-foreground'
                    }`}
                  >
                    {v === undefined ? '—' : `${Math.round(v)}°`}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="View angle">
            {VIEWS.map((v) => (
              <Button key={v.yaw} size="sm" variant={yaw === v.yaw ? 'secondary' : 'outline'} className="h-7 px-2 text-[11px]" onClick={() => setYaw(v.yaw)}>
                {v.label}
              </Button>
            ))}
          </div>
          <input
            type="range"
            min={-90}
            max={90}
            step={5}
            value={yaw}
            onChange={(e) => setYaw(Number(e.target.value))}
            className="w-full accent-teal-600"
            aria-label="Rotate view"
          />
          <p className="text-[10px] leading-snug text-muted-foreground">
            ตัวเลขคือมุมที่วัดจริงขณะฝึก (3D); เส้นโค้งและเส้น min/max วาดบนภาพฉาย 2D จึงอาจไม่ตรงกับตัวเลขเมื่อมองจากมุมอื่น
          </p>
        </div>
      </div>
      )}

      {/* Timeline */}
      <div className="rounded-xl border p-2">
        <svg
          ref={chartRef}
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className={`${view === 'chart' ? 'h-60 sm:h-72' : 'h-32'} w-full cursor-pointer touch-none select-none`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setPlaying(false);
            scrubFromPointer(e);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) scrubFromPointer(e);
          }}
          role="img"
          aria-label={`${focus} over time with target range and fault markers`}
        >
          {chart && focusTarget && (
            <>
              <rect
                x={CHART_PAD.l}
                y={chart.yOf(focusTarget.maxAngle)}
                width={CHART_W - CHART_PAD.l - CHART_PAD.r}
                height={Math.max(0, chart.yOf(focusTarget.minAngle) - chart.yOf(focusTarget.maxAngle))}
                className="fill-teal-500/10"
              />
              {[focusTarget.minAngle, focusTarget.maxAngle].map((v) => (
                <g key={v}>
                  <line x1={CHART_PAD.l} x2={CHART_W - CHART_PAD.r} y1={chart.yOf(v)} y2={chart.yOf(v)} className="stroke-teal-600/60" strokeDasharray="4 3" />
                  <text x={CHART_PAD.l - 4} y={chart.yOf(v)} textAnchor="end" dominantBaseline="middle" className="fill-teal-700 dark:fill-teal-300 text-[9px]">
                    {v}°
                  </text>
                </g>
              ))}
            </>
          )}
          {chart && (
            <>
              <text x={CHART_PAD.l - 4} y={CHART_PAD.t} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[9px]">
                {chart.hi}°
              </text>
              <text x={CHART_PAD.l - 4} y={CHART_H - CHART_PAD.b} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[9px]">
                {chart.lo}°
              </text>
              {chart.segments.map((pts, i) => (
                <polyline key={i} points={pts} fill="none" className="stroke-sky-600 dark:stroke-sky-400" strokeWidth={1.5} strokeLinejoin="round" />
              ))}
            </>
          )}
          {/* rep ticks */}
          {repMarks.map((r) => (
            <g key={r.repNumber}>
              <line x1={xOfTime(r.t)} x2={xOfTime(r.t)} y1={CHART_PAD.t - 6} y2={CHART_PAD.t} className={r.isCorrect ? 'stroke-emerald-600' : 'stroke-amber-500'} strokeWidth={1.5} />
            </g>
          ))}
          {/* fault markers */}
          {replayFaults.map((f, i) => {
            const x = xOfTime(f.t);
            const y = CHART_H - CHART_PAD.b + 4;
            return (
              <path
                key={i}
                d={`M${r2(x)},${y} l4,8 l-8,0 Z`}
                className={`${FAULT_FILL[f.type]} cursor-pointer`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setPlaying(false);
                  seek(f.t);
                }}
              >
                <title>{`${FAULT_LABEL[f.type]} ${formatClock(f.t)}: ${f.message}`}</title>
              </path>
            );
          })}
          {/* playhead */}
          <line x1={xOfTime(now)} x2={xOfTime(now)} y1={CHART_PAD.t - 8} y2={CHART_H - CHART_PAD.b} className="stroke-foreground" strokeWidth={1.5} />
        </svg>
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[10px] text-muted-foreground">
          <span><span className="inline-block h-2 w-3 bg-teal-500/20 align-middle" /> ช่วงเป้าหมาย</span>
          <span><span className="text-red-500">▲</span> ท่าชดเชย</span>
          <span><span className="text-amber-500">▲</span> ทำไม่สุดระยะ</span>
          <span><span className="text-orange-400">▲</span> ความแม่นยำต่ำ</span>
          <span>| ขีดบน = จุดเริ่มแต่ละครั้ง</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => {
          if (!playing && now >= duration) seek(0);
          setPlaying((p) => !p);
        }} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {playing ? 'หยุด' : 'เล่น'}
        </Button>
        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => stepFrame(-1)} aria-label="Previous frame">
          <StepBack className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => stepFrame(1)} aria-label="Next frame">
          <StepForward className="h-3.5 w-3.5" />
        </Button>
        <div className="flex rounded-md border" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className={`px-2 py-1 text-xs tabular-nums ${speed === s ? 'bg-muted font-semibold' : 'text-muted-foreground'}`}
              aria-pressed={speed === s}
            >
              {s}x
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={() => jumpToFault(-1)} disabled={!replayFaults.some((f) => f.t < now - 1)}>
          <SkipBack className="h-3.5 w-3.5" /> ข้อผิดพลาดก่อนหน้า
        </Button>
        <Button size="sm" variant="outline" onClick={() => jumpToFault(1)} disabled={!replayFaults.some((f) => f.t > now + 1)}>
          ข้อผิดพลาดถัดไป <SkipForward className="h-3.5 w-3.5" />
        </Button>
        <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
          {formatClock(now)} / {formatClock(duration)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(duration, 1)}
        step={SCRUB_STEP_MS}
        value={Math.min(time, duration)}
        onChange={(e) => {
          setPlaying(false);
          seek(Number(e.target.value));
        }}
        className="w-full accent-teal-600"
        aria-label="Scrub timeline"
      />

      {replayFaults.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground">ข้ามไปยังเหตุการณ์ ({replayFaults.length})</p>
          <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
            {replayFaults.map((f, i) => (
              <button
                type="button"
                key={i}
                onClick={() => {
                  setPlaying(false);
                  seek(f.t);
                }}
                className={`rounded-full border px-2 py-0.5 text-[11px] tabular-nums hover:bg-muted ${Math.abs(f.t - now) <= FAULT_WINDOW_MS ? 'border-red-400 bg-red-50 dark:bg-red-950/40' : ''}`}
                title={f.message}
              >
                {formatClock(f.t)} · {FAULT_LABEL[f.type]}
                {f.repNumber !== null && ` #${f.repNumber}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
