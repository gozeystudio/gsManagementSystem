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

`server.js` selects between them at startup based on whether `DATABASE_URL` is set (Postgres) or
not (SQLite) — see "What's done" below, this is now wired up for the endpoints that are converted.

## What's done

- **Schema** (`supabase/001_schema.sql`): all 68 tables from `db.js` ported to Postgres, plus a
  new `schools` table. Every table except `schools` carries a `school_id` column
  (`REFERENCES schools(id) ON DELETE CASCADE`), so deleting a school cleanly removes everything
  it owns. Applied to the live Supabase project and re-validated directly against it twice now,
  in two different sessions (see "How this was tested" below) — still intact, still matches.
- **Data-access layer** (`db-postgres.js`): a `pg.Pool`-based module — `query()`,
  `withTransaction()`, `hashPassword`/`verifyPassword` (identical algorithm to `db.js`, so hashes
  are portable), `logAudit()`, `generateSequentialId()`, `getSchoolBySlug()`, and `createSchool()`
  — the online equivalent of `db.js`'s `seed()`, ported line-for-line (same roles, same
  permission matrix, same default admin/`Admin@123` user, same BECE grading scale, same Arabic
  subjects list, same GES starter schools, same default academic year/terms), but scoped to one
  new, isolated school per call instead of running once at process startup.
- **`pg` added to `package.json`** as a dependency, scoped to this path only.
- **Runtime switch, wired into `server.js`**: `const dbpg = process.env.DATABASE_URL ? require('./db-postgres.js') : null;` and `const USE_POSTGRES = !!dbpg`. Unset (the offline install's
  case, and any online deployment that hasn't set `DATABASE_URL` yet), `dbpg` is `null` and every
  line of `server.js` behaves exactly as it always has — verified live (see below).
- **Converted to Postgres so far**: login (`POST /api/login`), logout (`POST /api/logout`),
  session → current-user resolution (every request), and public branding
  (`GET /api/public-settings`, what the login screen reads before anyone signs in). Sessions now
  carry a `schoolId` alongside the `userId` they always carried.
- **The generic resource dispatcher — 22 resource tables at once**: the app has a single
  `crud(table, opts)` factory plus a `resources = { ... }` config object that generates full
  list/get/create/update/delete handlers for 22 tables, all served through one
  `/api/<resource>[/<id>]` dispatcher. Converting that one factory and that one dispatcher block
  (instead of converting each table's handler separately) lit up full CRUD, in both backends, for:
  `students`, `teachers`, `staff`, `parents_guardians`, `classes`, `subjects`, `academic_years`,
  `terms`, `buses`, `fee_types`, `expenditures`, `weekly_targets`, `fees`, `grading_system`,
  `announcements`, `duty_roster`, `exam_schedule`, `live_class_rooms`, `class_groups`,
  `group_tasks`, `student_tasks`, `ges_schools`, `arabic_subjects`. This includes the role-scoping
  rules (a Student only sees their own record; a Parent/Guardian only their own ward(s); a Teacher
  only their own classes/students; an Arabic Head Teacher only Arabic-teaching staff at their
  level) and the relation/enrichment lookups (a student's parents/attendance/results/fees/login on
  `GET /api/students/:id`; class-teacher names on classes; class/subject/term names on
  `exam_schedule` and `live_class_rooms`). `isConvertedResourceRoute()` tells the Postgres-mode
  safety net to let these 22 resources' routes through while still blocking everything else.
- **Multi-school resolution for pre-login requests** (`resolveSchoolPg` in `server.js`): pass an
  explicit school slug (`?school=` on `public-settings`, `school` in the login request body), or
  if this deployment has exactly one school so far, it's picked automatically — so a single-school
  Supabase deployment works with **no frontend changes**, while multi-school works once a slug is
  passed through (there's no picker UI for that yet — see "What's left").
- **Safety net for everything not yet converted**: rather than let an unconverted endpoint quietly
  run against the local, unused SQLite database and return empty/wrong data when `DATABASE_URL` is
  set, `server.js` now refuses every `/api/` route past login with a clear `501` and a pointer to
  this file, until each one is actually converted. This makes "not built yet" impossible to
  mistake for "broken" or "returns no data." Verified live (see below).

## How this was tested

Three different things had to be verified, and they needed different methods:

1. **Is the SQL itself correct against the real schema?** Yes, twice now — most recently, ran
   `createSchool()`'s full statement sequence (school → settings/config singletons → roles →
   permissions → admin user → dashboard widgets → grading scale → Arabic subjects → GES schools →
   academic year/terms) against the live Supabase project inside a transaction that was then
   rolled back: every statement succeeded, no type errors, no constraint violations, and
   `SELECT COUNT(*) FROM schools` confirmed to be `0` again afterward — nothing persisted.
2. **Does `server.js` behave identically offline when `DATABASE_URL` is unset?** Yes — ran the
   live server with no `DATABASE_URL`, logged in, fetched public-settings, fetched an ordinary
   settings endpoint: all three worked exactly as before, and the new Postgres-mode code paths
   were never even reached (`USE_POSTGRES` is `false`). Re-verified after the 22-resource
   dispatcher conversion: full create → get → update → list → delete round-trips against
   `classes` and `students` (including the parents/attendance/results/fees/login relation
   attachment on a student's `GET /api/students/:id`), plus list checks on `grading_system`,
   `exam_schedule`, `live_class_rooms`, `arabic_subjects`, and `ges_schools` — all byte-identical
   to pre-conversion behavior, and the test rows were deleted afterward, leaving the database
   clean (`students` and `classes` both back to `0` rows).
3. **Does the actual `db-postgres.js`/new `server.js` Postgres-mode code work over a real `pg`
   connection, end-to-end, over HTTP?** **Still not verified — same blocker as before**: this
   sandbox's network egress blocks the npm registry (`npm install pg` fails with
   `403 Forbidden`), so `pg` cannot be installed here, and even with it installed, running the
   real server against Postgres needs the Supabase database password, which only the project
   owner can retrieve. `node --check` confirms no syntax errors in every file touched, and the SQL
   each new code path runs has been reasoned through against the (verified-live) schema and
   against `db-postgres.js`'s own already-proven query shapes, but that is not the same as an
   actual request having actually round-tripped through Postgres.

   `scripts/test-postgres-auth.js` still covers the data-access layer directly; running the
   *server* (not just `db-postgres.js`) against a real `DATABASE_URL` — `npm install && DATABASE_URL="postgresql://postgres:<password>@db.abnfnrwdkusfmhydlidl.supabase.co:5432/postgres" node server.js`,
   then `curl -X POST .../api/login -d '{"username":"admin","password":"Admin@123","school":"<slug>"}'`
   — is the next real checkpoint, from Render or a developer machine with internet access.

## ⚠ Security: enable Row Level Security before going further

Supabase's advisor flags all 68 tables as **publicly exposed via the anon key** through
Supabase's auto-generated REST API (PostgREST) — anyone with the project's anon key (which is
not secret — it's meant to be used from browsers) could read or write every row in every school,
right now. This app's own access control (RBAC, `school_id` scoping) is enforced in `server.js`
over a direct, server-side `pg` connection and **never uses PostgREST or the anon key at all** —
but PostgREST sits on the database regardless of whether anything in this app uses it, so the
exposure is real. **This has not been fixed yet, on purpose**: enabling RLS with no policies
defined would flip every table to deny-all, which is actually *safe* for this app specifically
(since it never queries through PostgREST/anon key), but that's a decision for you to make
explicitly rather than have silently applied. The fix, when you're ready:

```sql
-- Run in the Supabase SQL Editor, or ask me to apply it. Safe for this app (it only ever
-- connects via a direct server-side `pg` connection, never through PostgREST/the anon key), but
-- if you ever add a feature that DOES query Supabase from the browser with the anon key, that
-- feature will need explicit RLS policies added after this, not before.
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
-- …and the same for all 67 other tables — ask me and I'll generate the full list again, or run
-- the security advisor (I can do this any time) for the exact, current statement list.
```

## What's left

1. **Convert the remaining endpoints** in `server.js` from synchronous SQLite (`db.prepare(...).get()`)
   to async Postgres (`await dbpg.query(...)`, with `school_id` added to every query). Auth and the
   22-table generic resource dispatcher (students, teachers, staff, parents_guardians, classes,
   subjects, academic_years, terms, buses, fee_types, expenditures, weekly_targets, fees,
   grading_system, announcements, duty_roster, exam_schedule, live_class_rooms, class_groups,
   group_tasks, student_tasks, ges_schools, arabic_subjects) are done — that's full CRUD for the
   core student/class/academic-setup data. Still ahead, module by module: attendance → results
   (`continuous_assessment`, the 3 remaining `gradeFor()` call sites) → fee payments (`fees` itself
   is converted, but `fee_payments` and the payment-recording endpoints aren't yet) → bus → canteen
   → communications/forum/assignments → reports → audit log → backup/restore → settings. Each
   module converted, then tested, before moving to the next — not a single big-bang pass, both for
   safety and because it can only be partially verified without a live `DATABASE_URL` (see above).
2. **Decide on Row Level Security** (see above) — recommend enabling it with no policies, since
   this app doesn't need PostgREST access at all.
3. **Run the server itself against a real `DATABASE_URL`** (Render, or a developer machine with
   internet) — the one verification step this sandbox genuinely cannot do.
4. **Add a school-creation UI** so a new school can actually be provisioned from the app, not just
   from a script — and a school picker for the login page once more than one school exists (right
   now, multi-school login needs the slug passed in by hand; auto-detection only covers the
   single-school case).
5. Full regression pass against the Supabase-backed deployment before calling this done.
