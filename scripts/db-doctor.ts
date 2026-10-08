// Database health check: `bun run db:doctor`
//
// Walks the chain the app depends on — .env → Docker → container → port →
// login → migrations → data — and stops at the first broken link with the
// command that fixes it. Read-only: it never changes the database.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { createConnection } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = path.join(ROOT, 'prisma', 'migrations');
const SERVICE = 'db';

let problems = 0;
const ok = (msg: string) => console.log(`  ✅ ${msg}`);
const warn = (msg: string, fix?: string) => {
  console.log(`  ⚠️  ${msg}${fix ? `\n      แก้: ${fix}` : ''}`);
};
const fail = (msg: string, fix: string): never => {
  problems++;
  console.log(`  ❌ ${msg}\n      แก้: ${fix}\n`);
  console.log('หยุดตรวจที่จุดนี้ — แก้ข้อนี้ก่อนแล้วรัน `bun run db:doctor` อีกครั้ง');
  process.exit(1);
};
const step = (title: string) => console.log(`\n${title}`);

function sh(cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() || String(r.error ?? '') };
}

function canConnect(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const done = (v: boolean) => {
      socket.destroy();
      resolve(v);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

// ─── 1. .env ──────────────────────────────────────────────────────────
step('1) ไฟล์ .env และ DATABASE_URL');
if (!existsSync(path.join(ROOT, '.env'))) fail('ไม่พบไฟล์ .env', 'cp .env.example .env  (แล้วตั้ง NEXTAUTH_SECRET)');
const raw = process.env.DATABASE_URL;
if (!raw) fail('ไม่ได้ตั้ง DATABASE_URL ใน .env', 'คัดลอกบรรทัด DATABASE_URL จาก .env.example');
let url: URL;
try {
  url = new URL(raw!);
} catch {
  fail('DATABASE_URL อ่านไม่ได้ (รูปแบบผิด)', 'ใช้รูปแบบ postgresql://USER:PASSWORD@127.0.0.1:5432/DBNAME?schema=public');
}
url = new URL(raw!);
if (!url.protocol.startsWith('postgres')) fail(`DATABASE_URL เป็น ${url.protocol} ไม่ใช่ PostgreSQL`, 'โปรเจกต์นี้ใช้ PostgreSQL เท่านั้น — ดู .env.example');
const host = url.hostname;
const port = Number(url.port || 5432);
const dbName = url.pathname.slice(1);
ok(`DATABASE_URL → ${url.username}@${host}:${port}/${dbName}`);
if (host === 'localhost') warn('ใช้ "localhost" — บน Windows Prisma อาจลอง IPv6 (::1) แล้วต่อไม่ติด (P1001)', 'เปลี่ยนเป็น 127.0.0.1');
const isLocal = host === '127.0.0.1' || host === 'localhost';

// ─── 2. Docker + container (local only) ──────────────────────────────
if (isLocal) {
  step('2) Docker และ container ฐานข้อมูล');
  const info = sh('docker', ['info', '--format', '{{.ServerVersion}}']);
  if (!info.ok) fail('Docker ไม่ได้ทำงาน', 'เปิด Docker Desktop รอจนขึ้น "Engine running" แล้วลองใหม่');
  ok(`Docker ${info.out}`);

  const ps = sh('docker', ['compose', 'ps', '--all', '--format', 'json', SERVICE]);
  const rows = ps.out
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { Name: string; State: string; Health: string; Project: string });
  const c = rows[0];
  if (!c) fail('ยังไม่มี container ฐานข้อมูล', 'bun run db:up');
  if (c.State !== 'running') fail(`container ${c.Name} สถานะ "${c.State}"`, 'bun run db:up');
  if (c.Health && c.Health !== 'healthy') warn(`container ${c.Name} health = ${c.Health} (เพิ่งเริ่ม?)`, 'รอ 10 วินาทีแล้วรันใหม่; ถ้ายังไม่หาย: docker compose logs db');
  else ok(`container ${c.Name} ทำงาน (${c.Health || 'running'}) — compose project "${c.Project}"`);

  // Other Postgres containers that would fight over the port or confuse which DB is used
  const others = sh('docker', ['ps', '-a', '--filter', 'ancestor=postgres:16-alpine', '--format', '{{.Names}}|{{.Status}}|{{.Label "com.docker.compose.project"}}']);
  for (const line of others.out.split('\n').filter(Boolean)) {
    const [name, status, project] = line.split('|');
    if (name === c.Name) continue;
    warn(
      `พบ container Postgres อีกตัว: ${name} (project "${project || '-'}", ${status}) — ไม่ได้ใช้งาน แต่ถ้าเปิดจะชนพอร์ต ${port}`,
      `ถ้าไม่ต้องการข้อมูลในนั้น: docker rm ${name}  แล้ว  docker volume rm ${project}_pgdata  (ลบถาวร — สำรองก่อนถ้าไม่แน่ใจ)`
    );
  }
}

// ─── 3. Port ──────────────────────────────────────────────────────────
step(`3) พอร์ต ${host}:${port}`);
if (!(await canConnect(host, port))) {
  fail(`ต่อพอร์ต ${port} ไม่ได้`, isLocal ? 'bun run db:up  (หรือดูว่าโปรแกรมอื่นใช้พอร์ต 5432 อยู่: netstat -ano | findstr :5432)' : 'ตรวจ host/พอร์ต และ firewall ของผู้ให้บริการฐานข้อมูล');
}
ok('พอร์ตเปิดอยู่');

// ─── 4. Login + migrations ───────────────────────────────────────────
step('4) ล็อกอินฐานข้อมูลและ migrations');
const db = new PrismaClient();
try {
  await db.$queryRaw`SELECT 1`;
  ok(`ล็อกอินเป็น ${url.username} สำเร็จ`);
} catch (e) {
  const code = (e as { errorCode?: string }).errorCode ?? '';
  const msg = String((e as Error).message).split('\n').find((l) => l.trim()) ?? '';
  const fixes: Record<string, string> = {
    P1000: 'รหัสผ่าน/ชื่อผู้ใช้ไม่ตรงกับ container (ค่าใน docker-compose.yml คือ physio/physio) — แก้ DATABASE_URL',
    P1001: 'เซิร์ฟเวอร์ไม่ตอบ — bun run db:up และใช้ 127.0.0.1 แทน localhost',
    P1003: `ยังไม่มีฐานข้อมูล "${dbName}" — bun run db:migrate:deploy จะสร้างให้ (หรือ docker exec <container> createdb -U physio ${dbName})`,
  };
  fail(`ล็อกอินไม่สำเร็จ ${code} ${msg}`, fixes[code] ?? 'ดูข้อความ error ด้านบน และ docs/DATABASE.md หัวข้อ "แก้ปัญหา"');
}

const folders = readdirSync(MIGRATIONS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
let applied: { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[] = [];
try {
  applied = await db.$queryRaw`SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY migration_name`;
} catch {
  fail('ฐานข้อมูลยังว่าง (ไม่มีตาราง _prisma_migrations)', 'bun run db:migrate:deploy && bun run db:seed');
}
const failed = applied.filter((m) => !m.finished_at && !m.rolled_back_at);
const done = new Set(applied.filter((m) => m.finished_at).map((m) => m.migration_name));
const pending = folders.filter((f) => !done.has(f));
const unknown = [...done].filter((m) => !folders.includes(m));
if (failed.length) {
  fail(
    `migration ล้มเหลวค้างอยู่: ${failed.map((m) => m.migration_name).join(', ')} (P3009)`,
    `ฐานข้อมูลสาธิต: bun run db:reset  · ฐานข้อมูลจริง: แก้สาเหตุแล้ว bunx prisma migrate resolve --rolled-back ${failed[0].migration_name}`
  );
}
if (unknown.length) {
  warn(`ฐานข้อมูลมี migration ที่ไม่มีในโฟลเดอร์: ${unknown.join(', ')} — อาจมาจาก branch อื่น`, 'git checkout branch ที่สร้าง migration นั้น หรือ db:reset ถ้าเป็นฐานข้อมูลสาธิต');
}
if (pending.length) {
  problems++;
  console.log(`  ❌ ยังไม่ได้ apply ${pending.length} migration: ${pending.join(', ')}\n      แก้: bun run db:migrate:deploy`);
} else {
  ok(`migrations ครบ ${folders.length}/${folders.length} (ล่าสุด ${folders[folders.length - 1]})`);
}

// ─── 5. Data ──────────────────────────────────────────────────────────
step('5) ข้อมูล');
try {
  const [orgs, users, patients, archived, exercises, sessions, simulated] = await Promise.all([
    db.organization.count(),
    db.user.count(),
    db.patient.count({ where: { archivedAt: null } }),
    db.patient.count({ where: { archivedAt: { not: null } } }),
    db.exercise.count({ where: { status: 'PUBLISHED' } }),
    db.exerciseSession.count(),
    db.exerciseSession.count({ where: { notes: { startsWith: 'ข้อมูลจำลอง' } } }),
  ]);
  if (users === 0) {
    problems++;
    console.log('  ❌ ยังไม่มีผู้ใช้ — ล็อกอินไม่ได้\n      แก้: bun run db:seed  (สร้างบัญชีสาธิต ลบข้อมูลเดิมทั้งหมด)');
  } else {
    ok(`${orgs} หน่วยงาน · ${users} ผู้ใช้ · ${patients} ผู้ป่วย (+${archived} ที่จำหน่ายแล้ว) · ${exercises} ท่า · ${sessions} เซสชัน (จำลอง ${simulated})`);
  }
} catch (e) {
  warn(`นับข้อมูลไม่ได้: ${(e as Error).message.split('\n')[0]}`, 'ถ้าเพิ่ง pull โค้ดใหม่: bun run db:migrate:deploy');
}

// ─── 6. Test database (optional) ─────────────────────────────────────
step('6) ฐานข้อมูลสำหรับ integration test (ไม่บังคับ)');
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) console.log('  ➖ ไม่ได้ตั้ง TEST_DATABASE_URL — `bun run test:integration` จะข้ามไป');
else if (testUrl === raw) fail('TEST_DATABASE_URL ชี้ไปที่ฐานข้อมูลเดียวกับ DATABASE_URL — เทสต์จะลบข้อมูลทั้งหมด', 'ใช้ฐานข้อมูลแยกที่ชื่อมีคำว่า test เช่น ai_physio_test');
else ok(`TEST_DATABASE_URL → ${new URL(testUrl).pathname.slice(1)}`);

await db.$disconnect();
console.log(problems ? `\nพบปัญหา ${problems} ข้อ — ทำตามบรรทัด "แก้:" ด้านบน` : '\nฐานข้อมูลพร้อมใช้งาน ✅');
process.exit(problems ? 1 : 0);
