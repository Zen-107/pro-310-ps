// Prisma CLI configuration (replaces the deprecated "prisma" key in package.json).
// With a config file Prisma no longer reads .env by itself, so load it here:
// DATABASE_URL comes from .env (see .env.example).
import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'bun prisma/seed.ts',
  },
});
