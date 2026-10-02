// Copies static assets into the standalone build (next.config: output "standalone").
// Cross-platform replacement for `cp -r`, which Bun's shell rejects on Windows.
import { cpSync, existsSync } from 'node:fs';

const copies = [
  ['.next/static', '.next/standalone/.next/static'],
  ['public', '.next/standalone/public'],
];

if (!existsSync('.next/standalone')) {
  console.error('copy-standalone-assets: .next/standalone not found (run next build first)');
  process.exit(1);
}

for (const [from, to] of copies) {
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}
