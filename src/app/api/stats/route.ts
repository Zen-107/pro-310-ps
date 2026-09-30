import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const patientId = searchParams.get('patientId');

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    const completedSessions = await db.session.findMany({
      where: {
        patientId,
        status: 'completed',
        startedAt: { gte: since },
      },
      orderBy: { startedAt: 'asc' },
      include: { exercise: true },
    });

    const dailyMap = new Map<string, { date: string; sessions: number; avgAccuracy: number; exercises: string[] }>();
    for (const s of completedSessions) {
      const dateStr = s.startedAt.toISOString().split('T')[0];
      const existing = dailyMap.get(dateStr) || { date: dateStr, sessions: 0, avgAccuracy: 0, exercises: [] };
      existing.sessions += 1;
      existing.avgAccuracy = existing.avgAccuracy + (s.avgAccuracy - existing.avgAccuracy) / existing.sessions;
      if (s.exercise) existing.exercises.push(s.exercise.nameTh);
      dailyMap.set(dateStr, existing);
    }
    const dailyData = Array.from(dailyMap.values());

    const totalSessions = completedSessions.length;
    const avgAccuracy = totalSessions > 0
      ? completedSessions.reduce((sum, s) => sum + s.avgAccuracy, 0) / totalSessions
      : 0;
    const totalReps = completedSessions.reduce((sum, s) => sum + s.totalReps, 0);

    const categoryMap = new Map<string, number>();
    for (const s of completedSessions) {
      if (s.exercise) categoryMap.set(s.exercise.category, (categoryMap.get(s.exercise.category) || 0) + 1);
    }
    const categoryData = Array.from(categoryMap.entries()).map(([category, count]) => ({ category, count }));

    const romTrend = await db.session.findMany({
      where: { patientId, status: 'completed' },
      orderBy: { startedAt: 'asc' },
      take: 30,
      include: { exercise: true },
    });

    const romData = romTrend.map((s) => ({
      date: s.startedAt.toISOString().split('T')[0],
      exercise: s.exercise?.nameTh || '',
      rom: s.maxRom,
      accuracy: s.avgAccuracy,
    }));

    return NextResponse.json({
      dailyData,
      totalSessions,
      avgAccuracy: Math.round(avgAccuracy),
      totalReps,
      categoryData,
      romData,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}