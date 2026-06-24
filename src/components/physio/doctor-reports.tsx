'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import ReactMarkdown from 'react-markdown';
import {
  FileText, RefreshCw, Loader2, CheckCircle, AlertTriangle, ClipboardList,
  Calendar, Target, Activity, Clock, Eye, Stethoscope, Sparkles,
} from 'lucide-react';

interface Session {
  id: string; exerciseId: string; startedAt: string; endedAt: string | null;
  totalReps: number; avgAccuracy: number; maxRom: number; status: string;
  exercise?: { name: string; nameTh: string; category: string; icon: string };
}

interface JointReport {
  joint: string; avgAngle: number; maxAngle: number; minAngle: number;
  avgDeviation: number; accuracy: number;
}

interface ReportData {
  sessionId: string; exerciseName: string; exerciseNameEn: string; category: string;
  startedAt: string; endedAt: string; totalReps: number; avgAccuracy: number;
  maxRom: number; jointReport: JointReport[]; clinicalSummary: string; generatedAt: string;
}

export function DoctorReports() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch('/api/sessions').then(r => r.json()).then(d => { setSessions(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const completedSessions = sessions.filter(s => s.status === 'completed');

  async function generateReport(sessionId: string) {
 setSelectedId(sessionId);
    setGenerating(true);
    setReport(null);
    try {
      const res = await fetch(`/api/reports/${sessionId}`, { method: 'POST' });
      const data = await res.json();
      setReport(data);
    } catch {
      setReport(null);
    } finally {
      setGenerating(false);
    }
  }

  function getAccColor(acc: number) {
    if (acc >= 80) return 'text-emerald-600';
    if (acc >= 60) return 'text-amber-600';
    return 'text-red-600';
  }
  function getAccBg(acc: number) {
    if (acc >= 80) return 'bg-emerald-500';
    if (acc >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  }

  if (loading) return <ReportsSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">รายงานคลินิก</h2>
        <p className="text-muted-foreground mt-1">สร้างและดูรายงานสรุปผลการฝึกโดย AI</p>
      </div>

      {!report && !generating && (
        <Card className="border-dashed border-2 border-muted">
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">เลือกเซสชันจากรายการด้านล่างเพื่อสร้างรายงานคลินิก</p>
          </CardContent>
        </Card>
      )}

      {/* Report Display */
      <AnimatePresence>
        {(report || generating) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <Card className="border-emerald-500/20 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-4 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-xl"><FileText className="h-5 w-5 text-emerald-400" /></div>
                    <div>
                      <h3 className="font-semibold">{report?.exerciseName || 'กำลังสร้างรายงาน...'}</h3>
                      <p className="text-xs text-slate-300">{report ? `สร้างเมื่อ ${new Date(report.generatedAt).toLocaleString('th-TH')}` : 'AI กำลังวิเคราะห์ข้อมูล...'}</p>
                    </div>
                  </div>
                  {report && (
                    <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white" onClick={() => { if (selectedId) generateReport(selectedId); }}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1" /> สร้างใหม่
                    </Button>
                  )}
                </div>
              </div>

              {generating && !report && (
                <CardContent className="py-16 flex flex-col items-center">
                  <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mb-3" />
                  <p className="text-sm text-muted-foreground">AI กำลังสร้างรายงานคลินิก...</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">กรุณารอสักครู่</p>
                </CardContent>
              )}

              {report && (
                <CardContent className="p-6 space-y-6">
                  {/* Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="text-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                      <p className="text-2xl font-bold text-emerald-600">{report.totalReps}</p>
                      <p className="text-xs text-muted-foreground">ครั้งที่ทำ</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30">
                      <p className={`text-2xl font-bold ${getAccColor(report.avgAccuracy)}`}>{report.avgAccuracy}%</p>
                      <p className="text-xs text-muted-foreground">ความแม่นยำ</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-muted">
                      <p className="text-2xl font-bold">{report.maxRom}°</p>
                      <p className="text-xs text-muted-foreground">ROM สูงสุด</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-muted">
                      <p className="text-2xl font-bold">{report.jointReport.length}</p>
                      <p className="text-xs text-muted-foreground">ข้อต่อที่ตรวจ</p>
                    </div>
                  </div>

                  {/* Joint Analysis Table */}
                  {report.jointReport.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                        <Stethoscope className="h-4 w-4 text-emerald-600" /> วิเคราะห์ข้อต่อแต่ละจุด
                      </h4>
                      <div className="rounded-xl border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead><tr className="bg-muted/50">
                            <th className="text-left p-3 font-medium">ข้อต่อ</th>
                            <th className="text-center p-3 font-medium">เฉลี่ย</th>
                            <th className="text-center p-3 font-medium hidden sm:table-cell">ต่ำสุด-สูงสุด</th>
                            <th className="text-center p-3 font-medium hidden md:table-cell">เบี่ยงเบน</th>
                            <th className="text-center p-3 font-medium">ความแม่นยำ</th>
                          </tr></thead>
                          <tbody>
                            {report.jointReport.map((j, i) => (
                              <tr key={i} className="border-t">
                                <td className="p-3 font-medium">{j.joint}</td>
                                <td className="p-3 text-center font-bold">{j.avgAngle}°</td>
                                <td className="p-3 text-center text-muted-foreground hidden sm:table-cell">{j.minAngle}° - {j.maxAngle}°</td>
                                <td className="p-3 text-center hidden md:table-cell"><span className={j.avgDeviation <= 5 ? 'text-emerald-600' : j.avgDeviation <= 15 ? 'text-amber-600' : 'text-red-600'}>{j.avgDeviation}°</span></td>
                                <td className="p-3">
                                  <div className="flex items-center gap-2 justify-center">
                                    <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden"><div className={`h-full rounded-full ${getAccBg(j.accuracy)}`} style={{ width: `${j.accuracy}%` }} /></div>
                                    <span className={`text-xs font-bold ${getAccColor(j.accuracy)}`}>{j.accuracy}%</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Clinical Summary */}
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-amber-500" /> สรุปคลินิก (AI)
                    </h4>
                    <div className="prose prose-sm max-w-none dark:prose-invert p-4 rounded-xl bg-muted/50 border border-dashed">
                      <ReactMarkdown>{report.clinicalSummary}</ReactMarkdown>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Session List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2"><ClipboardList className="h-4 w-4" /> เซสชัน ({completedSessions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {completedSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">ยังไม่มีเซสชันที่สำเร็จ</p>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {completedSessions.map(s => (
                  <div key={s.id} className={`flex items-center justify-between p-3 rounded-xl transition-colors cursor-pointer ${selectedId === s.id ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800' : 'bg-muted/50 hover:bg-muted'}`} onClick={() => generateReport(s.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{s.exercise?.nameTh || 'ท่ากายภาพ'}</p>
                        <Badge variant="outline" className="text-[10px] shrink-0">{s.exercise?.category || ''}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{new Date(s.startedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      <span className="text-xs text-muted-foreground hidden sm:inline">{s.totalReps} ครั้ง</span>
                      <span className={`text-sm font-bold ${getAccColor(s.avgAccuracy)}`}>{Math.round(s.avgAccuracy)}%</span>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportsSkeleton() {
  return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>;
}