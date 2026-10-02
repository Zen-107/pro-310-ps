import { getServerSession, type Session } from 'next-auth';
import { NextResponse } from 'next/server';
import type { UserRole } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasAcceptedTerms } from '@/lib/terms';

export type SessionUser = Session['user'];

/** The signed-in user, or null (server components and route handlers). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

/** true when the user accepted the current terms of use / PDPA consent */
export async function userAcceptedTerms(userId: string): Promise<boolean> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { termsVersion: true } });
  return hasAcceptedTerms(u);
}

/**
 * API route guard. Usage:
 *   const auth = await requireApiUser(['CLINICIAN']);
 *   if ('response' in auth) return auth.response;
 *   auth.user …
 *
 * Users who have not accepted the current terms (entry popup) get 403 with
 * code TERMS_REQUIRED from every route except the terms route itself.
 */
export async function requireApiUser(
  roles?: UserRole[],
  options: { allowWithoutTerms?: boolean } = {}
): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const user = await getSessionUser();
  if (!user) {
    return { response: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) };
  }
  if (roles && !roles.includes(user.role)) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  if (!options.allowWithoutTerms && !(await userAcceptedTerms(user.id))) {
    return {
      response: NextResponse.json({ error: 'Terms of use not accepted', code: 'TERMS_REQUIRED' }, { status: 403 }),
    };
  }
  return { user };
}
