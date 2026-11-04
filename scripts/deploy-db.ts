// Online demo (Vercel) database step, run before `next build` by `bun run vercel-build`.
// 1. Applies migrations over the direct (unpooled) connection when one exists:
//    Neon's pooled URL goes through PgBouncer, which Prisma migrate should not use.
// 2. Seeds the demo data when the database is still empty, so redeploys keep
//    what people did in the demo. See docs/decisions/0001-online-demo.md.
// 3. Re-seeds (wipes) the demo when the exercise library in the code no longer
//    matches the database: status or target angles changed. The library is
//    seed data, so this is the only way the online demo picks up a new library.
//    Demo only — never point this script at a database with real children.
//    See docs/decisions/0002-kids-five-exercises.md.
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { EXERCISES, exerciseIdFromName } from '../src/lib/exercises-data';
import { exerciseStatus } from '../prisma/library';

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

// One line per exercise: slug, status and every target range, sorted
const fingerprint = (rows: { slug: string; status: string; targets: { joint: string; minAngle: number; idealAngle: number; maxAngle: number }[] }[]) =>
  rows
    .map((r) => [r.slug, r.status, ...r.targets.map((t) => `${t.joint}:${t.minAngle}/${t.idealAngle}/${t.maxAngle}`).sort()].join(' '))
    .sort()
    .join('\n');
const expected = fingerprint(
  EXERCISES.map((ex) => ({
    slug: exerciseIdFromName(ex.name),
    status: exerciseStatus(ex).status,
    targets: ex.targetJoints.map((t) => ({ joint: t.name, minAngle: t.minAngle, idealAngle: t.idealAngle, maxAngle: t.maxAngle })),
  }))
);
const current = fingerprint(
  await db.exercise.findMany({ select: { slug: true, status: true, targets: { select: { joint: true, minAngle: true, idealAngle: true, maxAngle: true } } } })
);
await db.$disconnect();

if (users === 0) {
  console.log('deploy-db: empty database → seeding demo data');
  run('bun', ['prisma/seed.ts'], { DATABASE_URL: direct, SEED_ALLOW_PRODUCTION: 'true' });
} else if (current !== expected) {
  console.log('deploy-db: the exercise library changed in the code → re-seeding the demo (wipes demo activity)');
  run('bun', ['prisma/seed.ts'], { DATABASE_URL: direct, SEED_ALLOW_PRODUCTION: 'true' });
} else {
  console.log(`deploy-db: ${users} users already there, library unchanged → not seeding`);
}
