import type { NextAuthOptions, User as AuthUser } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { authSecret } from '@/lib/auth-secret';
import { hashPassword, verifyPassword } from '@/lib/password';
import {
  isKidCode,
  isPicturePin,
  MAX_PIN_FAILS,
  normalizeCode,
  PIN_LOCK_MS,
  readTicket,
  verifyPicturePin,
} from '@/lib/kid-login';

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // one school day

// Hash checked when the email is unknown, so response time doesn't reveal
// which emails have accounts.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword('dummy-password-for-timing'));

const userInclude = { clinician: true, patient: true } satisfies Prisma.UserInclude;
type UserWithProfiles = Prisma.UserGetPayload<{ include: typeof userInclude }>;

/** Session user for a DB user, or null when the account may not sign in */
async function toAuthUser(user: UserWithProfiles | null, returnUserId: string | null = null): Promise<AuthUser | null> {
  if (!user || !user.isActive || user.patient?.archivedAt) return null;
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  let returnName: string | null = null;
  if (returnUserId) {
    returnName = (await db.user.findUnique({ where: { id: returnUserId }, select: { name: true } }))?.name ?? null;
  }
  return {
    id: user.id,
    email: user.email,
    name: user.patient?.nickname || user.name,
    role: user.role,
    clinicianId: user.clinician?.id ?? null,
    patientId: user.patient?.id ?? null,
    organizationId: user.clinician?.organizationId ?? user.patient?.organizationId ?? null,
    returnUserId,
    returnName,
  };
}

export const authOptions: NextAuthOptions = {
  secret: authSecret(),
  session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: '/login' },
  providers: [
    // Adults: email + password
    CredentialsProvider({
      id: 'credentials',
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await db.user.findUnique({ where: { email }, include: userInclude });
        if (!user) {
          await verifyPassword(password, await getDummyHash());
          return null;
        }
        if (!(await verifyPassword(password, user.passwordHash))) return null;
        return toAuthUser(user);
      },
    }),

    // Kids: code from the card + 3 pictures in order (JSON array of picture ids)
    CredentialsProvider({
      id: 'kid-code',
      name: 'Kid code',
      credentials: {
        code: { label: 'Code', type: 'text' },
        pictures: { label: 'Pictures', type: 'text' },
      },
      async authorize(credentials) {
        const code = normalizeCode(credentials?.code);
        let pictures: unknown;
        try {
          pictures = JSON.parse(credentials?.pictures ?? 'null');
        } catch {
          return null;
        }
        if (!isKidCode(code) || !isPicturePin(pictures)) return null;

        const patient = await db.patient.findUnique({ where: { kidCode: code } });
        if (!patient?.picturePinHash || !patient.userId) {
          await verifyPassword('x', await getDummyHash());
          return null;
        }
        if (patient.pinLockedUntil && patient.pinLockedUntil > new Date()) return null;
        if (!(await verifyPicturePin(pictures, patient.picturePinHash))) {
          const fails = patient.pinFailCount + 1;
          await db.patient.update({
            where: { id: patient.id },
            data: fails >= MAX_PIN_FAILS
              ? { pinFailCount: 0, pinLockedUntil: new Date(Date.now() + PIN_LOCK_MS) }
              : { pinFailCount: fails },
          });
          return null;
        }
        await db.patient.update({ where: { id: patient.id }, data: { pinFailCount: 0, pinLockedUntil: null } });
        return toAuthUser(await db.user.findUnique({ where: { id: patient.userId }, include: userInclude }));
      },
    }),

    // Switch between an adult and a child (tickets from /api/me/switch and /api/me/return)
    CredentialsProvider({
      id: 'ticket',
      name: 'Switch ticket',
      credentials: { ticket: { label: 'Ticket', type: 'text' } },
      async authorize(credentials) {
        const t = readTicket(credentials?.ticket);
        if (!t) return null;
        return toAuthUser(await db.user.findUnique({ where: { id: t.userId }, include: userInclude }), t.returnUserId ?? null);
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      // `user` is only present right after sign-in
      if (user) {
        token.role = user.role;
        token.clinicianId = user.clinicianId;
        token.patientId = user.patientId;
        token.organizationId = user.organizationId;
        token.returnUserId = user.returnUserId ?? null;
        token.returnName = user.returnName ?? null;
      }
      return token;
    },
    session({ session, token }) {
      session.user = {
        id: token.sub!,
        name: token.name ?? '',
        email: token.email ?? '',
        role: token.role,
        clinicianId: token.clinicianId,
        patientId: token.patientId,
        organizationId: token.organizationId,
        returnUserId: token.returnUserId ?? null,
        returnName: token.returnName ?? null,
      };
      return session;
    },
  },
};
