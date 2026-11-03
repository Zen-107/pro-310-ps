import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { badRequest, jsonError, readJson, serverError } from '@/lib/api-utils';
import { isAdultPin } from '@/lib/kid-login';
import { hashPassword, verifyPassword } from '@/lib/password';
import { ADULTS } from '@/lib/roles';

// The adult's 4-digit PIN for leaving kid mode. GET → { hasPin }.
export async function GET() {
  const auth = await requireApiUser(ADULTS);
  if ('response' in auth) return auth.response;
  const u = await db.user.findUnique({ where: { id: auth.user.id }, select: { adultPinHash: true } });
  return NextResponse.json({ hasPin: !!u?.adultPinHash });
}

// Set or change it: { pin, password } — the account password confirms it is the adult
export async function POST(req: Request) {
  const auth = await requireApiUser(ADULTS);
  if ('response' in auth) return auth.response;
  const body = await readJson(req);
  if (!isAdultPin(body?.pin)) return badRequest('pin must be 4 digits');
  if (typeof body?.password !== 'string') return badRequest('password is required');
  try {
    const u = await db.user.findUniqueOrThrow({ where: { id: auth.user.id }, select: { passwordHash: true } });
    if (!(await verifyPassword(body.password, u.passwordHash))) return jsonError('Wrong password', 403);
    await db.user.update({ where: { id: auth.user.id }, data: { adultPinHash: await hashPassword(body.pin) } });
    return NextResponse.json({ hasPin: true });
  } catch (error) {
    return serverError('PIN POST error', error);
  }
}
