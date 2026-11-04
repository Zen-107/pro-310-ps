// Online demo (Vercel) database step, run before `next build` by `bun run vercel-build`.
// 1. Applies migrations over the direct (unpooled) connection when one exists:
//    Neon's pooled URL goes through PgBouncer, which Prisma migrate should not use.
// 2. Seeds the demo data only when the database is still empty, so redeploys
//    keep what people did in the demo. See docs/decisions/0001-online-demo.md.
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const pooled = process.env.DATABASE_URL;
const direct = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || pooled;
if (!pooled || !direct) {
  console.error('deploy-db: DATABASE_URL is not set (add the Neon database in Vercel → Storage)');
  process.exit(1);
}

function run(cmd: string, args: string[], env: Record<string, string | undefined>) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env }, shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run('bunx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: direct });

const db = new PrismaClient({ datasources: { db: { url: direct } } });
const users = await db.user.count();
await db.$disconnect();

if (users === 0) {
  console.log('deploy-db: empty database → seeding demo data');
  run('bun', ['prisma/seed.ts'], { DATABASE_URL: direct, SEED_ALLOW_PRODUCTION: 'true' });
} else {
  console.log(`deploy-db: ${users} users already there → not seeding`);
}
