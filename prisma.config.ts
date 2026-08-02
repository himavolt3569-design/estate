import path from 'node:path';

import { defineConfig } from 'prisma/config';

/**
 * Prisma's configuration.
 *
 * The database URL is not read from here — the npm scripts run the CLI through
 * `dotenv -e <file>`, the same way `dev:remote` runs Next, so one env file
 * decides which database every command in a session talks to. That keeps
 * "which database am I about to migrate" answerable by reading the command
 * rather than by reading this file.
 *
 * `migrations.path` points at a generated directory. The hand-written SQL lives
 * in supabase/migrations, which is what the Supabase CLI reads for local
 * `db reset`; scripts/prisma-sync-migrations.mjs copies it into the
 * folder-per-migration layout Prisma expects, byte for byte, so the checksums
 * Prisma records stay stable.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  datasource: {
    // Prisma 7 no longer accepts `url` in schema.prisma, so this is the only
    // place it can live. Empty is allowed on purpose: `db:sync` and the other
    // offline commands work without a database, and only the ones that connect
    // should complain — see the message below.
    url: process.env.DATABASE_URL ?? '',
  },
});

if (!process.env.DATABASE_URL) {
  console.warn(
    [
      '',
      'DATABASE_URL is not set, so nothing can reach the database.',
      '',
      'Add it to .env.production (hosted) or .env.local (local Supabase):',
      '  Supabase dashboard -> Project Settings -> Database -> Connection string',
      '  Use the DIRECT connection on port 5432, not the pooled one on 6543.',
      '',
    ].join('\n'),
  );
}
