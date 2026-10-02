import { NextRequest, NextResponse } from 'next/server';
import type { BodyPart, Difficulty, ExerciseCategory, Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { serverError } from '@/lib/api-utils';
import { exerciseDTO, exerciseInclude } from '@/lib/presenters';

const CATEGORIES: ExerciseCategory[] = ['knee', 'shoulder', 'hip', 'back', 'neck', 'ankle'];
const BODY_PARTS: BodyPart[] = ['upper', 'lower', 'full'];
const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced'];

// Published exercise library (with targets, formulas and citations).
// Clinicians see the full library; patients see only the exercises in their
// active prescriptions (no free choice of exercises).
export async function GET(req: NextRequest) {
  const auth = await requireApiUser(['CLINICIAN', 'PATIENT']);
  if ('response' in auth) return auth.response;

  const params = req.nextUrl.searchParams;
  const pick = <T extends string>(key: string, allowed: T[]) => {
    const v = params.get(key) as T | null;
    return v && allowed.includes(v) ? v : undefined;
  };
  const where: Prisma.ExerciseWhereInput = {
    status: 'PUBLISHED',
    category: pick('category', CATEGORIES),
    bodyPart: pick('bodyPart', BODY_PARTS),
    difficulty: pick('difficulty', DIFFICULTIES),
    ...(auth.user.role === 'PATIENT'
      ? { prescriptionItems: { some: { prescription: { patientId: auth.user.patientId ?? '__none__', status: 'ACTIVE' } } } }
      : {}),
  };

  try {
    const exercises = await db.exercise.findMany({ where, include: exerciseInclude, orderBy: { createdAt: 'asc' } });
    return NextResponse.json(exercises.map((ex) => exerciseDTO(ex)));
  } catch (error) {
    return serverError('Exercises GET error', error);
  }
}
