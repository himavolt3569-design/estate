/**
 * Tells Prisma which migrations a database has already had.
 *
 * The hosted database was built by pasting SQL into the Supabase editor, so it
 * has every object migrations 0001–0019 create, and no record that they ran.
 * Point `prisma migrate deploy` at it and the first thing it does is try to
 * create the extensions and enums again, which fails — correctly, but
 * unhelpfully.
 *
 * Baselining is the documented answer: mark the migrations that are already
 * live as applied, then let deploy handle everything after them. This does that
 * in one pass instead of nineteen `prisma migrate resolve --applied` commands.
 *
 *   node scripts/db-baseline.mjs --through 0019_remove_admin_mfa
 *   node scripts/db-baseline.mjs                 # every migration on disk
 *
 * It is safe to run twice: a migration Prisma already has a record of is
 * reported and skipped rather than duplicated. It changes no schema and touches
 * no data — the only thing it writes is rows in _prisma_migrations.
 *
 * Getting `--through` wrong in the optimistic direction is the one real risk:
 * naming a migration that has NOT been applied marks it as done, and its SQL
 * will then never run. Check `npm run db:status:remote` afterwards, and read
 * the list this prints before trusting it.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const TARGET = path.join('prisma', 'migrations');

/*
 * The Prisma CLI is run as `node node_modules/prisma/build/index.js`, not as
 * `npx prisma`. Since the fix for CVE-2024-27980, Node refuses to spawn a .cmd
 * or .bat file without `shell: true`, so on Windows `npx.cmd` fails before it
 * starts — and it fails with an `error` on the result rather than output on
 * stderr, which is how this script first reported "FAILED" with nothing under
 * it. Calling the entry point with the current interpreter sidesteps both the
 * shell and its quoting rules.
 */
const require = createRequire(import.meta.url);
const PRISMA_CLI = (() => {
  try {
    return require.resolve('prisma/build/index.js');
  } catch {
    return null;
  }
})();

if (!PRISMA_CLI) {
  console.error('Could not find the Prisma CLI. Run `npm install` first.');
  process.exit(1);
}

const throughIndex = process.argv.indexOf('--through');
const through = throughIndex === -1 ? null : process.argv[throughIndex + 1];

if (!existsSync(TARGET)) {
  console.error('No prisma/migrations. Run `npm run db:sync` first.');
  process.exit(1);
}

const all = readdirSync(TARGET, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (through && !all.includes(through)) {
  console.error(`No migration named "${through}". Known migrations:`);
  for (const name of all) console.error(`  ${name}`);
  process.exit(1);
}

const upTo = through ? all.slice(0, all.indexOf(through) + 1) : all;

console.log(
  `Marking ${upTo.length} of ${all.length} migrations as already applied` +
    (through ? ` (through ${through})` : '') +
    ':',
);

let recorded = 0;
let already = 0;

for (const name of upTo) {
  const result = spawnSync(
    process.execPath,
    [PRISMA_CLI, 'migrate', 'resolve', '--applied', name],
    { encoding: 'utf8' },
  );

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

  // A spawn that never started reports here and nowhere else. Without this the
  // failure prints as an empty "FAILED" line, which says nothing.
  if (result.error) {
    console.error(`  FAILED    ${name}`);
    console.error(`  ${result.error.message}`);
    process.exit(1);
  }

  if (result.status === 0) {
    console.log(`  recorded  ${name}`);
    recorded++;
    continue;
  }

  // Prisma's wording for "there is already a row for this one".
  if (/already recorded as applied/i.test(output)) {
    console.log(`  known     ${name}`);
    already++;
    continue;
  }

  console.error(`  FAILED    ${name}`);
  console.error(output.trim());
  process.exit(1);
}

console.log('');
console.log(`Done: ${recorded} recorded, ${already} already known.`);
console.log('Next: npm run db:status:remote — anything after this point is still pending.');
