import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

/*
 * Generate database types safely.
 *
 * The obvious form, `supabase gen types > database.types.ts`, truncates the
 * file the moment the shell opens it and then writes whatever the CLI produced.
 * When the CLI fails (Docker down, stack not started) that is an error payload,
 * and the real types are gone. This has already happened twice.
 *
 * Generate into memory, sanity-check, and only then write.
 */
const out = execFileSync('npx', ['supabase', 'gen', 'types', 'typescript', '--local'], {
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
  shell: process.platform === 'win32',
});

if (!out.includes('export type Database') || out.split('\n').length < 100) {
  console.error('Refusing to write: output does not look like generated types.');
  console.error(out.slice(0, 300));
  process.exit(1);
}

writeFileSync('src/lib/supabase/database.types.ts', out);
console.log(`Wrote ${out.split('\n').length} lines of database types.`);
