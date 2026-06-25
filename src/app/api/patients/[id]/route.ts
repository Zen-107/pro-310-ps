import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const patient = await db.patient.findUnique({ where: { id } });
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    const completedSessions = await db.session.findMany({
      where: { patientId: id, status: 'completed' },
      orderBy: { startedAt: 'desc' },
      include: { exercise: true, logs: true },
    });

    const totalSessions = completedSessions.length;
    const avgAccuracy = totalSessions > 0
      ? Math.round(completedSessions.reduce((sum, s) => sum + s.avgAccuracy, 0) / totalSessions)
      : 0;
    const totalReps = completedSessions.reduce((sum, s) => sum + s.totalReps, 0);
    const exerciseIds = new Set(completedSessions.map((s) => s.exerciseId));

    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentSessions = completedSessions.filter(s => new Date(s.startedAt) >= last7Days);

    // Streak
    const sessionDays = new Set(
      completedSessions.map(s => new Date(s.startedAt).toISOString().split('T')[0])
    );
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let checkDate = new Date(today);
    if (sessionDays.size > 0) {
      const todayStr = checkDate.toISOString().split('T')[0];
      if (!sessionDays.has(todayStr)) checkDate.setDate(checkDate.getDate() - 1);
      while (true) {
        const dateStr = checkDate.toISOString().split('T')[0];
        if (sessionDays.has(dateStr)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else break;
      }
    }
    await db.patient.update({ where: { id }, data: { streak } });

    // Improvement trend
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

    // Latest ROM per exercise
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

    // Joint trends
    const jointTrends: Record<string, { date: string; angle: number; idealAngle: number }[]> = {};
    for (const s of completedSessions) {
      for (const log of s.logs) {
        if (!jointTrends[log.jointName]) jointTrends[log.jointName] = [];
        jointTrends[log.jointName].push({
          date: log.timestamp.toISOString().split('T')[0],
          angle: log.angle,
          idealAngle: log.idealAngle,
        });
      }
    }

    // Alerts
    const alerts: { type: 'warning' | 'info' | 'success'; message: string }[] = [];
    if (totalSessions >= 5 && improvementTrend <= 0) {
      alerts.push({ type: 'warning', message: `กราฟพัฒนาการแบนราบ — ความแม่นยำไม่ดีขึ้นในช่วงล่าสุด` });
    }
    if (avgAccuracy >= 80 && totalSessions > 0) {
      alerts.push({ type: 'success', message: `ทำท่าได้ค่อนข้างถูกต้อง — เฉลี่ย ${avgAccuracy}%` });
    }
    if (recentSessions.length >= 5) {
      alerts.push({ type: 'info', message: `ใน 7 วันที่ผ่านมาทำไป ${recentSessions.length} เซสชัน` });
    }
    if (totalSessions === 0) {
      alerts.push({ type: 'warning', message: `ยังไม่มีข้อมูลเซสชัน — คนไข้ยังไม่ได้เริ่มฝึก` });
    }

    const sessionDetails = completedSessions.slice(0, 20).map(s => ({
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
        id: patient.id,
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        condition: patient.condition,
        phone: patient.phone,
        assignedExerciseIds: JSON.parse(patient.assignedExerciseIds),
        therapistNotes: patient.therapistNotes,
        streak,
        totalSessions,
        totalMinutes: patient.totalMinutes,
        totalReps,
        avgAccuracy,
        exercisesCompleted: exerciseIds.size,
        recentSessions7d: recentSessions.length,
        improvementTrend,
        lastActiveAt: patient.lastActiveAt?.toISOString(),
        alerts,
      },
      sessionDetails,
      latestRomPerExercise: Object.values(latestRomPerExercise),
      jointTrends,
    });
  } catch (error) {
    console.error('Patient detail error:', error);
    return NextResponse.json({ error: 'Failed to fetch patient detail' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.age !== undefined) updateData.age = body.age;
    if (body.gender !== undefined) updateData.gender = body.gender;
    if (body.condition !== undefined) updateData.condition = body.condition;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.therapistNotes !== undefined) updateData.therapistNotes = body.therapistNotes;
    if (body.assignedExerciseIds !== undefined) {
      updateData.assignedExerciseIds = JSON.stringify(body.assignedExerciseIds);
    }

    const patient = await db.patient.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ ...patient, assignedExerciseIds: JSON.parse(patient.assignedExerciseIds) });
  } catch (error) {
    console.error('Patient PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update patient' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Delete sessions and logs cascade
    await db.session.deleteMany({ where: { patientId: id } });
    await db.patient.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Patient DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete patient' }, { status: 500 });
  }
}