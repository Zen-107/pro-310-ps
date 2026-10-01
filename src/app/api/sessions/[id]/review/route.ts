import { NextResponse } from 'next/server';
import type { ReviewStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { sessionScope } from '@/lib/access';
import { badRequest, jsonError, notFound, optionalString, readJson, serverError } from '@/lib/api-utils';

type Params = { params: Promise<{ id: string }> };
const STATUSES: ReviewStatus[] = ['APPROVED', 'NEEDS_ATTENTION'];

// Clinician sign-off on a completed session (care team). Re-posting updates it.
export async function POST(req: Request, { params }: Params) {
  const auth = await requireApiUser(['CLINICIAN']);
  if ('response' in auth) return auth.response;
  const { id } = await params;
  const body = await readJson(req);
  if (!body) return badRequest('Invalid JSON body');
  const status = body.status as ReviewStatus;
  if (!STATUSES.includes(status)) return badRequest(`status must be one of ${STATUSES.join(', ')}`);
  const comment = optionalString(body.comment, 5000) ?? null;

  try {
    const session = await db.exerciseSession.findFirst({ where: { AND: [{ id }, sessionScope(auth.user)] } });
    if (!session) return notFound('Session not found');
    if (session.status !== 'COMPLETED') return jsonError('Only completed sessions can be reviewed', 409);

    const review = await db.sessionReview.upsert({
      where: { sessionId: id },
      create: { sessionId: id, clinicianId: auth.user.clinicianId!, status, comment },
      update: { clinicianId: auth.user.clinicianId!, status, comment, reviewedAt: new Date() },
      include: { clinician: { select: { title: true, user: { select: { name: true } } } } },
    });
    return NextResponse.json({
      status: review.status,
      comment: review.comment,
      reviewedAt: review.reviewedAt.toISOString(),
      reviewer: { name: review.clinician.user.name, title: review.clinician.title },
    });
  } catch (error) {
    return serverError('Session review POST error', error);
  }
}
