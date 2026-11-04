// The secret that signs sessions (next-auth JWT) and kid-login tickets (server only).
// NEXTAUTH_SECRET wins when it is set. Without it (the online demo on Vercel),
// derive one from DATABASE_URL: Neon puts that value there, it is already
// secret and server-only, so nobody has to type a secret into a dashboard.
// Changing the database password logs everyone out, which is fine for a demo.
// See docs/decisions/0001-online-demo.md.
import { createHash } from 'node:crypto';

export function authSecret(): string | undefined {
  if (process.env.NEXTAUTH_SECRET) return process.env.NEXTAUTH_SECRET;
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return undefined;
  return createHash('sha256').update(`ai-physio-kids:auth-secret:${dbUrl}`).digest('base64');
}
