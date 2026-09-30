import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const bodyPart = searchParams.get('bodyPart');
    const difficulty = searchParams.get('difficulty');

    const exercises = await db.exercise.findMany({
      where: {
        ...(category && category !== 'all' ? { category } : {}),
        ...(bodyPart && bodyPart !== 'all' ? { bodyPart } : {}),
        ...(difficulty && difficulty !== 'all' ? { difficulty } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    // Parse JSON fields
    const parsed = exercises.map((ex) => ({
      ...ex,
      instructions: JSON.parse(ex.instructions),
      targetJoints: JSON.parse(ex.targetJoints),
    }));

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Exercises GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch exercises' }, { status: 500 });
  }
}