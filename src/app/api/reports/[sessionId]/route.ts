import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: { exercise: true, logs: { orderBy: { timestamp: 'asc' } } },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: session.id,
      exerciseName: session.exercise?.nameTh || 'ท่ากายภาพ',
      exerciseNameEn: session.exercise?.name || '',
      category: session.exercise?.category || '',
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString(),
      totalReps: session.totalReps,
      avgAccuracy: Math.round(session.avgAccuracy),
      maxRom: Math.round(session.maxRom),
      status: session.status,
      logs: session.logs.map((l) => ({
        repNumber: l.repNumber,
        jointName: l.jointName,
        angle: Math.round(l.angle),
        idealAngle: Math.round(l.idealAngle),
        deviation: Math.round(l.deviation),
        isCorrect: l.isCorrect,
        timestamp: l.timestamp.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Report GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 });
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: { exercise: true, logs: { orderBy: { timestamp: 'asc' } } },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const logs = session.logs;
    const correctCount = logs.filter((l) => l.isCorrect).length;

    const jointSummary = logs.reduce(
      (acc, l) => {
        if (!acc[l.jointName]) {
          acc[l.jointName] = { angles: [], deviations: [], correct: 0, total: 0 };
        }
        acc[l.jointName].angles.push(l.angle);
        acc[l.jointName].deviations.push(l.deviation);
        acc[l.jointName].total++;
        if (l.isCorrect) acc[l.jointName].correct++;
        return acc;
      },
      {} as Record<string, { angles: number[]; deviations: number[]; correct: number; total: number }>
    );

    const jointReport = Object.entries(jointSummary).map(([name, data]) => ({
      joint: name,
      avgAngle: Math.round(data.angles.reduce((a, b) => a + b, 0) / data.angles.length),
      maxAngle: Math.round(Math.max(...data.angles)),
      minAngle: Math.round(Math.min(...data.angles)),
      avgDeviation: Math.round(data.deviations.reduce((a, b) => a + b, 0) / data.deviations.length),
      accuracy: Math.round((data.correct / data.total) * 100),
    }));

    const zai = await ZAI.create();

    const prompt = `สร้าง Clinical Summary Report สำหรับนักกายภาพบำบัด

ข้อมูลเซสชัน:
- ท่าทาง: ${session.exercise?.nameTh || '-'} (${session.exercise?.name || '-'})
- หมวดหมู่: ${session.exercise?.category || '-'}
- เวลาเริ่ม: ${session.startedAt.toLocaleString('th-TH')}
- เวลาจบ: ${session.endedAt?.toLocaleString('th-TH') || 'ยังไม่จบ'}
- จำนวนครั้ง: ${session.totalReps}
- ความแม่นยำเฉลี่ย: ${Math.round(session.avgAccuracy)}%
- ROM สูงสุด: ${Math.round(session.maxRom)}°

ข้อมูลข้อต่อแต่ละจุด:
${jointReport.map((j) => `- ${j.joint}: เฉลี่ย ${j.avgAngle}°, ความแม่นยำ ${j.accuracy}%, เบี่ยงเบนเฉลี่ย ${j.avgDeviation}°`).join('\n')}

กรุณาสรุปเป็นรายงานคลินิกภาษาไทย 3-4 ย่อหน้า โดยมีโครงสร้าง:
1. สรุปผลการฝึก (สั้นๆ)
2. การวิเคราะห์ข้อต่อแต่ละจุด
3. คำแนะนำสำหรับครั้งต่อไป
4. ระดับความเสี่ยง (ถ้ามี)

หมายเหตุ: นี่คือข้อมูลจาก AI ตรวจจับท่าทาง แพทย์ควรพิจารณาร่วมกับการตรวจแบบตัวต่อตัว`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'คุณคือนักกายภาพบำบัดที่เขียนรายงานคลินิก ใช้ภาษาไทยที่เป็นมืออาชีพ แต่อ่านง่าย' },
        { role: 'user', content: prompt },
      ],
      thinking: { type: 'disabled' },
    });

    const clinicalSummary = completion.choices[0]?.message?.content || 'ไม่สามารถสร้างรายงานได้';

    return NextResponse.json({
      sessionId,
      exerciseName: session.exercise?.nameTh,
      exerciseNameEn: session.exercise?.name,
      category: session.exercise?.category,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString(),
      totalReps: session.totalReps,
      avgAccuracy: Math.round(session.avgAccuracy),
      maxRom: Math.round(session.maxRom),
      jointReport,
      clinicalSummary,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Report generation error:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
