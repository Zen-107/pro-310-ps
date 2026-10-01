import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/password';

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // one clinic shift

// Hash checked when the email is unknown, so response time doesn't reveal
// which emails have accounts.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword('dummy-password-for-timing'));

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await db.user.findUnique({
          where: { email },
          include: { clinician: true, patient: true },
        });
        if (!user) {
          await verifyPassword(password, await getDummyHash());
          return null;
        }
        if (!(await verifyPassword(password, user.passwordHash))) return null;
        if (!user.isActive || user.patient?.archivedAt) return null;

        await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          clinicianId: user.clinician?.id ?? null,
          patientId: user.patient?.id ?? null,
          organizationId: user.clinician?.organizationId ?? user.patient?.organizationId ?? null,
        };
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
      };
      return session;
    },
  },
};
