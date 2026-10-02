'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { BrainCircuit, Loader2, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Clinician view of the AI agent's fault-trend analysis for one patient:
// computed trends load automatically; the AI narrative is generated on demand.

interface Trend {
  exerciseId: string;
  exercise: string;
  exerciseTh: string;
  sessions: number;
  accuracy: { first: number; last: number; slopePerSession: number };
  rom: { joint: string | null; first: number | null; last: number | null; slopePerSession: number | null };
  faultRate: Record<'INCOMPLETE_ROM' | 'COMPENSATION' | 'LOW_ACCURACY', { early: number; recent: number }>;
  topCompensations: { checkId: string; message: string; count: number; recentShare: number }[];
  flags: string[];
}

const FLAG_LABEL: Record<string, { text: string; good?: boolean }> = {
  accuracy_declining: { text: 'ความแม่นยำลดลง' },
  rom_declining: { text: 'ROM ลดลง' },
  compensation_increasing: { text: 'ท่าชดเชยเพิ่มขึ้น' },
  incomplete_rom_increasing: { text: 'ทำไม่สุดระยะเพิ่มขึ้น' },
  improving: { text: 'พัฒนาขึ้น', good: true },
};

export function AiInsightsPanel({ patientId }: { patientId: string }) {
  const [trends, setTrends] = useState<Trend[] | null>(null);
  const [sessions, setSessions] = useState(0);
  const [summary, setSummary] = useState<{ text: string; model: string; at: string } | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/patients/${patientId}/ai-insights`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (cancelled) return;
        setTrends(d.trends);
        setSessions(d.sessionsAnalysed);
      })
      .catch(() => !cancelled && setTrends([]));
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/ai-insights`, { method: 'POST' });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setTrends(d.trends);
      setSessions(d.sessionsAnalysed);
      if (d.summary) setSummary({ text: d.summary, model: d.model, at: d.generatedAt });
      else toast.error(d.aiError ?? 'ยังไม่มีข้อมูลเพียงพอสำหรับการวิเคราะห์');
    } catch {
      toast.error('วิเคราะห์ด้วย AI ไม่สำเร็จ');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex flex-wrap items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-violet-600" />
          แนวโน้มข้อผิดพลาด & ข้อเสนอแนะ (AI Agent)
          <span className="text-xs font-normal text-muted-foreground">{sessions} เซสชันล่าสุด</span>
          <Button size="sm" variant="outline" className="ml-auto h-7" disabled={generating || !trends?.length} onClick={generate}>
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {summary ? 'วิเคราะห์ใหม่' : 'สรุปด้วย AI'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {trends === null ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : trends.length === 0 ? (
          <p className="text-xs text-muted-foreground">ยังไม่มีเซสชันที่เสร็จสมบูรณ์สำหรับการวิเคราะห์</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {trends.map((t) => {
              const up = t.accuracy.slopePerSession >= 0;
              return (
                <div key={t.exerciseId} className="rounded-lg border p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{t.exerciseTh}</span>
                    <span className="text-muted-foreground">{t.sessions} เซสชัน</span>
                  </div>
                  <p className="flex items-center gap-1 tabular-nums">
                    {up ? <TrendingUp className="h-3.5 w-3.5 text-teal-600" /> : <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                    ความแม่นยำ {t.accuracy.first}% → {t.accuracy.last}%
                    {t.rom.first !== null && (
                      <span className="ml-2 text-muted-foreground">
                        ROM {t.rom.first}° → {t.rom.last}°
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground tabular-nums">
                    ท่าชดเชย/ครั้ง {t.faultRate.COMPENSATION.early} → {t.faultRate.COMPENSATION.recent} · ไม่สุดระยะ/ครั้ง{' '}
                    {t.faultRate.INCOMPLETE_ROM.early} → {t.faultRate.INCOMPLETE_ROM.recent}
                  </p>
                  {t.topCompensations[0] && (
                    <p className="text-amber-700 dark:text-amber-400">
                      พบบ่อย: {t.topCompensations[0].message} ×{t.topCompensations[0].count}
                    </p>
                  )}
                  {t.flags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {t.flags.map((f) => (
                        <Badge
                          key={f}
                          variant="outline"
                          className={`text-[10px] ${FLAG_LABEL[f]?.good ? 'border-emerald-300 text-emerald-700' : 'border-red-300 text-red-700'}`}
                        >
                          {FLAG_LABEL[f]?.text ?? f}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {summary && (
          <div className="rounded-xl border border-dashed bg-muted/40 p-4">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{summary.text}</ReactMarkdown>
            </div>
            <p className="mt-2 text-[10px] italic text-muted-foreground">
              สร้างโดย AI ({summary.model}) · {new Date(summary.at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })} — ตัวเลขคำนวณจากข้อมูลเซสชัน
              ข้อเสนอแนะเป็นประเด็นให้ผู้ดูแลพิจารณา ไม่ใช่คำสั่งการรักษา
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
