// Preloaded by `bun run test:integration` (see package.json), before any app
// module is imported:
//  - points Prisma at TEST_DATABASE_URL (never the development database);
//  - replaces next-auth's getServerSession so tests choose who is signed in;
//  - disables outbound services (server TTS, AI providers).
import { mock } from 'bun:test';

const url = process.env.TEST_DATABASE_URL;
if (url) {
  const dbName = new URL(url).pathname.slice(1);
  if (!/test/i.test(dbName)) {
    throw new Error(`TEST_DATABASE_URL must point at a database whose name contains "test" (got "${dbName}")`);
  }
  process.env.DATABASE_URL = url;
} else {
  // Make any accidental connection fail instead of reaching the dev database
  process.env.DATABASE_URL = 'postgresql://invalid:invalid@127.0.0.1:1/not_configured';
}
process.env.NEXTAUTH_SECRET ??= 'integration-test-secret';
process.env.TTS_PROVIDER = 'off';
for (const k of ['GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'OPENAI_API_KEY']) delete process.env[k];

const g = globalThis as { __testSession?: unknown; __integrationPreloaded?: boolean };
g.__testSession = null;
g.__integrationPreloaded = true;

mock.module('next-auth', () => ({
  default: () => () => new Response(null, { status: 404 }),
  getServerSession: async () => g.__testSession,
}));
