import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth-guard';
import { badRequest, jsonError, readJson, serverError } from '@/lib/api-utils';
import { createTicket, isAdultPin, MAX_PIN_FAILS, PIN_LOCK_MS } from '@/lib/kid-login';
import { verifyPassword } from '@/lib/password';

// Wrong-PIN counter per child session (in memory: a lock, not an audit trail)
const fails = new Map<string, { count: number; lockedUntil: number }>();

/**
 * Leave kid mode: { pin } → { ticket } to sign back in as the adult who
 * switched to this child. Works without the terms check (the child's session).
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError('Not signed in', 401);
  if (user.role !== 'PATIENT' || !user.returnUserId) return jsonError('Not in kid mode', 409);
  const body = await readJson(req);
  if (!isAdultPin(body?.pin)) return badRequest('pin must be 4 digits');

  const key = `${user.id}:${user.returnUserId}`;
  const state = fails.get(key);
  if (state && state.lockedUntil > Date.now()) return jsonError('Too many attempts, try again later', 429);

  try {
    const adult = await db.user.findUnique({ where: { id: user.returnUserId }, select: { id: true, adultPinHash: true, isActive: true } });
    if (!adult?.isActive || !adult.adultPinHash) return jsonError('Adult account unavailable', 409);
    if (!(await verifyPassword(body.pin, adult.adultPinHash))) {
      const count = (state?.count ?? 0) + 1;
      fails.set(key, count >= MAX_PIN_FAILS ? { count: 0, lockedUntil: Date.now() + PIN_LOCK_MS } : { count, lockedUntil: 0 });
      return jsonError('Wrong PIN', 403);
    }
    fails.delete(key);
    return NextResponse.json({ ticket: createTicket({ userId: adult.id }) });
  } catch (error) {
    return serverError('Return POST error', error);
  }
}
