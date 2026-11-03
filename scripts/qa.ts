// QA gate: the same checks as CI, run locally in order and stopping at the
// first failure. `bun run qa` (add `--skip-build` while iterating).
// Integration tests need TEST_DATABASE_URL (a database whose name contains
// "test"); bun loads it from .env.

import { spawnSync } from 'node:child_process';

const skipBuild = process.argv.includes('--skip-build');

const steps: { name: string; cmd: string[]; needs?: string }[] = [
  { name: 'Typecheck', cmd: ['bun', 'run', 'typecheck'] },
  { name: 'Lint', cmd: ['bun', 'run', 'lint'] },
  { name: 'Unit tests', cmd: ['bun', 'run', 'test'] },
  { name: 'Migrate test DB', cmd: ['bunx', 'prisma', 'migrate', 'deploy'], needs: 'TEST_DATABASE_URL' },
  { name: 'Integration tests', cmd: ['bun', 'run', 'test:integration'], needs: 'TEST_DATABASE_URL' },
  ...(skipBuild ? [] : [{ name: 'Production build', cmd: ['bun', 'run', 'build'] }]),
];

const results: { name: string; ok: boolean; seconds: number }[] = [];

for (const step of steps) {
  if (step.needs && !process.env[step.needs]) {
    console.error(`\n✗ ${step.name}: ${step.needs} is not set`);
    process.exit(1);
  }
  console.log(`\n▶ ${step.name}`);
  const started = Date.now();
  // Migrations go to the test database, never the development one
  const env = step.name === 'Migrate test DB' ? { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL } : process.env;
  const [cmd, ...args] = step.cmd;
  const code = spawnSync(cmd, args, { stdio: 'inherit', env, shell: process.platform === 'win32' }).status;
  const seconds = Math.round((Date.now() - started) / 1000);
  results.push({ name: step.name, ok: code === 0, seconds });
  if (code !== 0) break;
}

console.log('\nQA summary');
for (const r of results) console.log(`  ${r.ok ? '✓' : '✗'} ${r.name} (${r.seconds}s)`);
const passed = results.length === steps.length && results.every((r) => r.ok);
console.log(passed ? '\nQA PASSED' : '\nQA FAILED');
process.exit(passed ? 0 : 1);
