import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const profile = await db.userProfile.upsert({
      where: { id: 'default_user' },
      update: {},
      create: { id: 'default_user', name: 'ผู้ใช้งาน' },
    });

    const sessions = await db.session.findMany({
      orderBy: { startedAt: 'desc' },
      include: { exercise: true, logs: true },
    });

    const completedSessions = sessions.filter((s) => s.status === 'completed');
    const totalSessions = completedSessions.length;
    const avgAccuracy = totalSessions > 0
      ? Math.round(completedSessions.reduce((sum, s) => sum + s.avgAccuracy, 0) / totalSessions)
      : 0;
    const totalReps = completedSessions.reduce((sum, s) => sum + s.totalReps, 0);
    const exerciseIds = new Set(completedSessions.map((s) => s.exerciseId));

    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    const recentSessions = completedSessions.filter(
      (s) => new Date(s.startedAt) >= last7Days
    );

    let improvementTrend = 0;
    if (completedSessions.length >= 4) {
      const half = Math.min(5, Math.floor(completedSessions.length / 2));
      const recent = completedSessions.slice(0, half);
      const older = completedSessions.slice(half, half * 2);
      if (older.length > 0) {
        const recentAvg = recent.reduce((s, ses) => s + ses.avgAccuracy, 0) / recent.length;
        const olderAvg = older.reduce((s, ses) => s + ses.avgAccuracy, 0) / older.length;
        improvementTrend = Math.round(recentAvg - olderAvg);
      }
    }

    const latestRomPerExercise: Record<string, { exercise: string; exerciseTh: string; rom: number; accuracy: number; date: string }> = {};
    for (const s of completedSessions) {
      if (s.exercise && !latestRomPerExercise[s.exerciseId]) {
        latestRomPerExercise[s.exerciseId] = {
          exercise: s.exercise.name,
          exerciseTh: s.exercise.nameTh,
          rom: s.maxRom,
          accuracy: Math.round(s.avgAccuracy),
          date: s.startedAt.toISOString().split('T')[0],
        };
      }
    }

    const jointHistory = await db.jointAngleLog.findMany({
      orderBy: { timestamp: 'asc' },
      take: 500,
    });

    const jointTrends: Record<string, { date: string; angle: number; idealAngle: number }[]> = {};
    for (const log of jointHistory) {
      if (!jointTrends[log.jointName]) jointTrends[log.jointName] = [];
      jointTrends[log.jointName].push({
        date: log.timestamp.toISOString().split('T')[0],
        angle: log.angle,
        idealAngle: log.idealAngle,
      });
    }

    const alerts: { type: 'warning' | 'info' | 'success'; message: string; date: string }[] = [];

    if (totalSessions >= 5 && improvementTrend <= 0) {
      alerts.push({
        type: 'warning',
        message: `กราฟพัฒนาการแบนราบ — ความแม่นยำเฉลี่ยไม่ดีขึ้นในช่วงล่าสุด`,
        date: new Date().toISOString(),
      });
    }
    if (avgAccuracy >= 80 && totalSessions > 0) {
      alerts.push({
        type: 'success',
        message: `คนไข้ทำท่าได้ค่อนข้างถูกต้อง — เฉลี่ย ${avgAccuracy}%`,
        date: new Date().toISOString(),
      });
    }
    if (recentSessions.length >= 5) {
      alerts.push({
        type: 'info',
        message: `ใน 7 วันที่ผ่านมาทำไป ${recentSessions.length} เซสชัน — ความมุ่งมั่นดีเยี่ยม`,
        date: new Date().toISOString(),
      });
    }
    if (totalSessions === 0) {
      alerts.push({
        type: 'warning',
        message: `ยังไม่มีข้อมูลเซสชัน — คนไข้ยังไม่ได้เริ่มฝึก`,
        date: new Date().toISOString(),
      });
    }

    const sessionDetails = completedSessions.slice(0, 20).map((s) => ({
      id: s.id,
      exerciseName: s.exercise?.nameTh || 'ท่ากายภาพ',
      exerciseCategory: s.exercise?.category || '',
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt?.toISOString(),
      totalReps: s.totalReps,
      avgAccuracy: Math.round(s.avgAccuracy),
      maxRom: Math.round(s.maxRom),
      logCount: s.logs?.length || 0,
    }));

    return NextResponse.json({
      patient: {
        id: profile.id,
        name: profile.name,
        streak: profile.streak,
        totalSessions,
        totalMinutes: profile.totalMinutes,
        totalReps,
        avgAccuracy,
        exercisesCompleted: exerciseIds.size,
        recentSessions7d: recentSessions.length,
        improvementTrend,
        lastActiveAt: profile.lastActiveAt?.toISOString(),
        alerts,
      },
      sessionDetails,
      latestRomPerExercise: Object.values(latestRomPerExercise),
      jointTrends,
    });
  } catch (error) {
    console.error('Patients API error:', error);
    return NextResponse.json({ error: 'Failed to fetch patient data' }, { status: 500 });
  }
}
