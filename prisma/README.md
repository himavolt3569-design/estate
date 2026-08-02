# Migrations

Hand-written SQL, applied by Prisma.

```
supabase/migrations/0020_three_photo_minimum.sql   ← you write this
prisma/migrations/0020_three_photo_minimum/        ← generated, gitignored
_prisma_migrations (table)                         ← what each database has had
```

Prisma is here for one reason: to know which migrations a database has already
had, and to apply the rest. It does **not** own the schema — see the comment at
the top of `schema.prisma` for why letting it own the schema would delete the
RLS policies and triggers.

## One-time setup per database

`DATABASE_URL` must be in the env file for the database you are targeting
(`.env.production` for the hosted project, `.env.local` for local Supabase).
Supabase dashboard → Project Settings → Database → Connection string → **direct
connection, port 5432**. Not the pooled 6543 one: PgBouncer's transaction mode
cannot carry a migration.

If the database already has objects from migrations that were applied by hand,
tell Prisma so before the first deploy, or it will try to create them again:

```bash
npm run db:baseline:remote -- --through 0019_remove_admin_mfa
```

That marks 0001 through 0019 as applied and leaves everything after them
pending. It writes rows in `_prisma_migrations` and changes nothing else. Read
the list it prints — naming a migration that has *not* actually been applied
means its SQL will never run.

## Day to day

```bash
npm run db:status:remote     # what is applied, what is pending, what failed
npm run db:migrate:remote    # apply everything pending
```

Both re-sync `prisma/migrations` from `supabase/migrations` first, so a new
`.sql` file is picked up with no extra step. Drop the `:remote` suffix to work
against local Supabase.

## Adding a migration

1. Write `supabase/migrations/00NN_short_name.sql`. Zero-pad the number —
   ordering is lexicographic, so `0009` sorts before `0010` and `9` would not.
2. `npm run db:status:remote` to see it listed as pending.
3. `npm run db:migrate:remote` to apply it.

Prisma runs each migration in a transaction, so a failure rolls back rather
than leaving the schema half-changed. Nothing in the current set uses a
statement that cannot run in a transaction (`CREATE INDEX CONCURRENTLY` and
friends); if you add one, it needs its own migration and a note here.

Never edit a migration that has already been applied. Prisma stores a checksum
and will refuse to continue — correctly, because the databases that already ran
the old text will not agree with the new. Write another migration instead.

## The other direction

`npm run db:pull:remote` overwrites `schema.prisma` with models introspected
from the live database. Useful as a reference for what is actually there; it is
not a source of truth, and it cannot see policies, triggers or functions.
