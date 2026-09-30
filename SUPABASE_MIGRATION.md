# Moving the online deployment onto Supabase (multi-school)

This tracks the in-progress move of the **online (Render) deployment only** onto Supabase
Postgres, with multi-school ("folder") support — one shared deployment where each school's data
is fully isolated. **The offline installation (`Start Nibras School System.bat`) is completely
unaffected**: it keeps using `db.js` and `node:sqlite`, unchanged, with zero internet required.

## Why two backends

| | Offline install | Online (Render) deployment |
|---|---|---|
| Database | SQLite (`db.js`, `node:sqlite`) | Postgres on Supabase (`db-postgres.js`, `pg`) |
| Dependencies | Zero — built into Node | One: `pg` (only for this path) |
| Schools per deployment | One | Many, isolated by `school_id` |
| Internet required | No | Yes |

`server.js` will select between them at startup based on whether `DATABASE_URL` is set (Postgres)
or not (SQLite) — see "What's left" below; that switch isn't wired up yet.

## What's done

- **Schema** (`supabase/001_schema.sql`): all 68 tables from `db.js` ported to Postgres, plus a
  new `schools` table. Every table except `schools` carries a `school_id` column
  (`REFERENCES schools(id) ON DELETE CASCADE`), so deleting a school cleanly removes everything
  it owns. Applied to the live Supabase project and re-validated directly against it (see
  "How this was tested" below).
- **Data-access layer** (`db-postgres.js`): a `pg.Pool`-based module — `query()`,
  `withTransaction()`, `hashPassword`/`verifyPassword` (identical algorithm to `db.js`, so hashes
  are portable), `logAudit()`, `generateSequentialId()`, `getSchoolBySlug()`, and `createSchool()`
  — the online equivalent of `db.js`'s `seed()`, ported line-for-line (same roles, same
  permission matrix, same default admin/`Admin@123` user, same BECE grading scale, same Arabic
  subjects list, same GES starter schools, same default academic year/terms), but scoped to one
  new, isolated school per call instead of running once at process startup.
- **`pg` added to `package.json`** as a dependency, scoped to this path only.

## How this was tested

Two different things had to be verified, and they needed two different methods:

1. **Is the SQL itself correct against the real schema?** Yes — every statement `createSchool()`
   runs was executed directly against the live Supabase project (via a `DO $$ ... $$` block
   inserting a temporary school, then deleting it), and it ran clean: no type errors, no
   constraint violations, no missing columns. Confirmed the schema is left exactly as it started
   afterward (`SELECT COUNT(*) FROM schools` back to 0).
2. **Does the actual `db-postgres.js` module work over the real `pg` driver?** **Not yet verified
   — this is the one piece that could not be tested from the development sandbox**, because its
   network egress blocks both the npm registry (`npm install pg` fails with `403 host_not_allowed`)
   and direct outbound Postgres connections. `node --check` confirms the file has no syntax
   errors, but that's it.

   `scripts/test-postgres-auth.js` is written and ready for this: it creates a school, looks it
   up, logs in as the seeded admin, runs one school-scoped query, then deletes the test school. It
   needs to be run somewhere with real internet access — either Render's shell after deploying, or
   a developer's own machine:

   ```bash
   npm install
   DATABASE_URL="postgresql://postgres:<password>@db.abnfnrwdkusfmhydlidl.supabase.co:5432/postgres" \
     node scripts/test-postgres-auth.js
   ```

   **This has not been run yet** — it's blocked on the Supabase database password, which only the
   project owner can retrieve (Supabase doesn't expose it through any tool, by design). Until this
   script has actually been run and passed, treat `db-postgres.js` as *written but unverified*, not
   as working.

## What's left

1. Run `scripts/test-postgres-auth.js` for real (see above) and fix anything it turns up.
2. Wire the runtime switch into `server.js`/`db.js` (pick SQLite vs. `db-postgres.js` based on
   `DATABASE_URL`).
3. Convert `server.js`'s ~100 endpoints from synchronous SQLite calls (`db.prepare(...).get()`)
   to the async Postgres equivalents (`await dbpg.query(...)`) — this is the largest remaining
   piece of work, done module by module (students/classes/attendance/results first, then
   fees/bus/canteen/comms/etc.), each tested before moving to the next.
4. Add a school-creation UI so a new school can actually be provisioned from the app, not just
   from a script.
5. Full regression pass against the Supabase-backed deployment before calling this done.
