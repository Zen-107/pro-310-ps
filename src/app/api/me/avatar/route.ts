import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { badRequest, jsonError, readJson, serverError } from '@/lib/api-utils';
import { isValidLook, lockedParts, parseLook } from '@/lib/mascot-look';
import { KID } from '@/lib/roles';

// The child dresses their own น้องยืด. Body: { avatar: "color.eyes.mouth.hat.outfit.glasses" }.
// Items that unlock with completed rounds are checked here, not only in the UI.
export async function PUT(req: Request) {
  const auth = await requireApiUser(KID);
  if ('response' in auth) return auth.response;
  const body = await readJson(req);
  if (!isValidLook(body?.avatar)) return badRequest('avatar must be a full look string');
  try {
    const patientId = auth.user.patientId!;
    const rounds = await db.exerciseSession.count({ where: { patientId, status: 'COMPLETED' } });
    const locked = lockedParts(parseLook(body.avatar), rounds);
    if (locked.length) return NextResponse.json({ error: 'Not unlocked yet', locked }, { status: 403 });
    await db.patient.update({ where: { id: patientId }, data: { avatar: body.avatar } });
    return NextResponse.json({ avatar: body.avatar, rounds });
  } catch (error) {
    return serverError('Avatar PUT error', error);
  }
}

// What the child has unlocked: { avatar, rounds }
export async function GET() {
  const auth = await requireApiUser(KID);
  if ('response' in auth) return auth.response;
  const patientId = auth.user.patientId!;
  const [p, rounds] = await Promise.all([
    db.patient.findUnique({ where: { id: patientId }, select: { avatar: true } }),
    db.exerciseSession.count({ where: { patientId, status: 'COMPLETED' } }),
  ]);
  if (!p) return jsonError('Not found', 404);
  return NextResponse.json({ avatar: p.avatar, rounds });
}
