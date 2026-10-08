// Back up the local development database: `bun run db:backup`
//
// Runs pg_dump inside the Docker container (no PostgreSQL tools needed on
// the host) and writes backups/<db>-<timestamp>.dump in PostgreSQL's custom
// format. Restore with pg_restore — see docs/DATABASE.md ("สำรองและกู้คืน").
// Backups contain patient data: they are git-ignored; keep them private.

import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set (.env)');
  process.exit(1);
}
const url = new URL(process.env.DATABASE_URL);
const dbName = url.pathname.slice(1);

const container = spawnSync('docker', ['compose', 'ps', '-q', 'db'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
if (!container) {
  console.error('Database container is not running — start it with `bun run db:up`');
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
const dir = path.join(ROOT, 'backups');
mkdirSync(dir, { recursive: true });
const file = path.join(dir, `${dbName}-${stamp}.dump`);

const dump = spawnSync('docker', ['exec', container, 'pg_dump', '-U', decodeURIComponent(url.username), '-d', dbName, '-Fc'], {
  maxBuffer: 1024 * 1024 * 1024,
});
if (dump.status !== 0) {
  console.error(`pg_dump failed: ${dump.stderr.toString()}`);
  process.exit(1);
}
writeFileSync(file, dump.stdout);
console.log(`Backup written: ${path.relative(ROOT, file)} (${Math.round(statSync(file).size / 1024)} KB)`);
