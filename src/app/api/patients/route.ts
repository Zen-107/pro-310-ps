import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const patients = await db.patient.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with session counts
    const enriched = await Promise.all(
      patients.map(async (p) => {
        const completedCount = await db.session.count({
          where: { patientId: p.id, status: 'completed' },
        });
        const recent7d = await db.session.count({
          where: {
            patientId: p.id,
            status: 'completed',
            startedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        });
        const lastSession = await db.session.findFirst({
          where: { patientId: p.id, status: 'completed' },
          orderBy: { startedAt: 'desc' },
          select: { avgAccuracy: true },
        });
        return {
          ...p,
          assignedExerciseIds: JSON.parse(p.assignedExerciseIds),
          totalSessions: completedCount,
          recentSessions7d: recent7d,
          latestAccuracy: lastSession ? Math.round(lastSession.avgAccuracy) : 0,
        };
      })
    );

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('Patients GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, age, gender, condition, phone } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'ชื่อจำเป็นต้องกรอก' }, { status: 400 });
    }

    const patient = await db.patient.create({
      data: {
        name: name.trim(),
        age: age || null,
        gender: gender || 'ไม่ระบุ',
        condition: condition || '',
        phone: phone || '',
        assignedExerciseIds: '[]',
      },
    });

    return NextResponse.json({ ...patient, assignedExerciseIds: [], totalSessions: 0, recentSessions7d: 0, latestAccuracy: 0 });
  } catch (error) {
    console.error('Patients POST error:', error);
    return NextResponse.json({ error: 'Failed to create patient' }, { status: 500 });
  }
}