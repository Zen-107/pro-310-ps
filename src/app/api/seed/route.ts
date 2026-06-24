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

    // Ensure user profile exists
    await db.userProfile.upsert({
      where: { id: 'default_user' },
      update: {},
      create: { id: 'default_user', name: 'ผู้ใช้งาน' },
    });

    return NextResponse.json({ success: true, count: EXERCISES.length });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ success: false, error: 'Failed to seed' }, { status: 500 });
  }
}