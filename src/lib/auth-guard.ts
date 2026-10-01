import { getServerSession, type Session } from 'next-auth';
import { NextResponse } from 'next/server';
import type { UserRole } from '@prisma/client';
import { authOptions } from '@/lib/auth';

export type SessionUser = Session['user'];

/** The signed-in user, or null (server components and route handlers). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

/**
 * API route guard. Usage:
 *   const auth = await requireApiUser(['CLINICIAN']);
 *   if ('response' in auth) return auth.response;
 *   auth.user …
 */
export async function requireApiUser(
  roles?: UserRole[]
): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const user = await getSessionUser();
  if (!user) {
    return { response: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) };
  }
  if (roles && !roles.includes(user.role)) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user };
}
