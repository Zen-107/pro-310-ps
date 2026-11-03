import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { canAccessPatient } from '@/lib/access';
import { badRequest, jsonError, notFound, readJson, serverError } from '@/lib/api-utils';
import { createTicket } from '@/lib/kid-login';
import { childHasConsent } from '@/lib/terms';

/**
 * "Play as …": a parent or teacher hands the device to a child.
 * { patientId } → { ticket } for signIn('ticket'). The adult must have set a
 * PIN first (needed to leave kid mode) and the child must have consent.
 */
export async function POST(req: Request) {
  const auth = await requireApiUser(['PARENT', 'TEACHER']);
  if ('response' in auth) return auth.response;
  const body = await readJson(req);
  const patientId = typeof body?.patientId === 'string' ? body.patientId : null;
  if (!patientId) return badRequest('patientId is required');
  try {
    if (!(await canAccessPatient(auth.user, patientId))) return notFound('Child not found');
    const [adult, child] = await Promise.all([
      db.user.findUniqueOrThrow({ where: { id: auth.user.id }, select: { adultPinHash: true } }),
      db.patient.findUniqueOrThrow({ where: { id: patientId } }),
    ]);
    if (!adult.adultPinHash) return NextResponse.json({ error: 'Set a PIN first', code: 'PIN_REQUIRED' }, { status: 409 });
    if (!childHasConsent(child)) return NextResponse.json({ error: 'Consent required', code: 'CONSENT_REQUIRED' }, { status: 409 });
    if (!child.userId) return jsonError('Child has no login', 409);
    return NextResponse.json({ ticket: createTicket({ userId: child.userId, returnUserId: auth.user.id }) });
  } catch (error) {
    return serverError('Switch POST error', error);
  }
}
