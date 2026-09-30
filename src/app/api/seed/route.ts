import { db } from '@/lib/db';
import { EXERCISES } from '@/lib/exercises-data';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Upsert exercises
    for (const ex of EXERCISES) {
      await db.exercise.upsert({
        where: { id: `ex_${ex.name.toLowerCase().replace(/\s+/g, '_')}` },
        update: {
          name: ex.name,
          nameTh: ex.nameTh,
          category: ex.category,
          description: ex.description,
          instructions: JSON.stringify(ex.instructions),
          targetJoints: JSON.stringify(ex.targetJoints),
          difficulty: ex.difficulty,
          sets: ex.sets,
          repsPerSet: ex.repsPerSet,
          restSeconds: ex.restSeconds,
          icon: ex.icon,
          bodyPart: ex.bodyPart,
        },
        create: {
          id: `ex_${ex.name.toLowerCase().replace(/\s+/g, '_')}`,
          name: ex.name,
          nameTh: ex.nameTh,
          category: ex.category,
          description: ex.description,
          instructions: JSON.stringify(ex.instructions),
          targetJoints: JSON.stringify(ex.targetJoints),
          difficulty: ex.difficulty,
          sets: ex.sets,
          repsPerSet: ex.repsPerSet,
          restSeconds: ex.restSeconds,
          icon: ex.icon,
          bodyPart: ex.bodyPart,
        },
      });
    }

    // Seed sample patients
    const samplePatients = [
      { name: 'คุณสมชาย ใจดี', age: 55, gender: 'ชาย', condition: 'ปวดเข่าเรื้อรัง OA Grade 2' },
      { name: 'คุณสมหญิง รักเรียน', age: 42, gender: 'หญิง', condition: 'บาดเจ็บไหล่ซ้าย rotator cuff' },
      { name: 'คุณวิชัย กล้าหาญ', age: 60, gender: 'ชาย', condition: 'ท่าเดินผิดปกติ หลังผ่าตัดเข่า' },
    ];

    for (const sp of samplePatients) {
      const exists = await db.patient.findFirst({ where: { name: sp.name } });
      if (!exists) {
        await db.patient.create({
          data: {
            ...sp,
            assignedExerciseIds: JSON.stringify(EXERCISES.slice(0, 6).map(e => `ex_${e.name.toLowerCase().replace(/\s+/g, '_')}`)),
          },
        });
      }
    }

    return NextResponse.json({ success: true, exerciseCount: EXERCISES.length });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ success: false, error: 'Failed to seed' }, { status: 500 });
  }
}