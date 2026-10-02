import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser, type SessionUser } from '@/lib/auth-guard';
import { canAccessPatient } from '@/lib/access';
import { badRequest, notFound, readJson, serverError } from '@/lib/api-utils';
import { graphemes, sanitizeText } from '@/lib/text-safe';
import { MAX_MESSAGE_LENGTH, markThreadRead, messageDTO, senderSelect } from '@/lib/messages';

function threadPatientId(user: SessionUser, requested: string | null | undefined) {
  return user.role === 'PATIENT' ? user.patientId : requested ?? null;
}

// Messages in a patient's care-team thread. Patients get their own thread;
// clinicians pass ?patientId (care team only). ?after=ISO returns only newer
// messages (for polling). Reading marks the thread as read for the caller.
export async function GET(req: NextRequest) {
  const auth = await requireApiUser(['CLINICIAN', 'PATIENT']);
  if ('response' in auth) return auth.response;
  const patientId = threadPatientId(auth.user, req.nextUrl.searchParams.get('patientId'));
  if (!patientId) return badRequest('patientId is required');
  const after = req.nextUrl.searchParams.get('after');
  const afterDate = after ? new Date(after) : null;
  if (afterDate && Number.isNaN(afterDate.getTime())) return badRequest('after must be an ISO date');

  try {
    if (!(await canAccessPatient(auth.user, patientId))) return notFound('Patient not found');
    const rows = await db.careMessage.findMany({
      where: { patientId, ...(afterDate ? { createdAt: { gt: afterDate } } : {}) },
      orderBy: { createdAt: afterDate ? 'asc' : 'desc' },
      take: 200,
      include: { sender: { select: senderSelect } },
    });
    const messages = (afterDate ? rows : rows.reverse()).map((m) => messageDTO(m, auth.user.id));

    await markThreadRead(patientId, auth.user.id, new Date());
    return NextResponse.json({ patientId, messages });
  } catch (error) {
    return serverError('Messages GET error', error);
  }
}

// Send a message to a patient's care-team thread. Body: { patientId?, body }.
export async function POST(req: Request) {
  const auth = await requireApiUser(['CLINICIAN', 'PATIENT']);
  if ('response' in auth) return auth.response;
  const input = await readJson(req);
  if (!input) return badRequest('Invalid JSON body');
  const patientId = threadPatientId(auth.user, typeof input.patientId === 'string' ? input.patientId : null);
  if (!patientId) return badRequest('patientId is required');
  const body = typeof input.body === 'string' ? sanitizeText(input.body).trim() : '';
  if (!body) return badRequest('Message body is required');
  if (graphemes(body).length > MAX_MESSAGE_LENGTH) return badRequest(`Message must be at most ${MAX_MESSAGE_LENGTH} characters`);

  try {
    if (!(await canAccessPatient(auth.user, patientId))) return notFound('Patient not found');
    const message = await db.careMessage.create({
      data: { patientId, senderId: auth.user.id, body },
      include: { sender: { select: senderSelect } },
    });
    await markThreadRead(patientId, auth.user.id, message.createdAt);
    return NextResponse.json(messageDTO(message, auth.user.id), { status: 201 });
  } catch (error) {
    return serverError('Messages POST error', error);
  }
}
