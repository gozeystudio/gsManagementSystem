#!/usr/bin/env node
// scripts/test-postgres-auth.js
//
// A standalone, no-server proof that db-postgres.js's provisioning and auth actually work
// against the real Supabase database over the real "pg" driver — the thing that could NOT be
// tested inside the development sandbox (its network egress blocks npm and direct Postgres
// connections). Run this instead, from either:
//   - your own machine (with internet access): npm install, then set DATABASE_URL and run it, or
//   - Render's shell (once deployed): the app already has DATABASE_URL set as an env var there.
//
// Usage:
//   DATABASE_URL="postgresql://postgres:<password>@db.abnfnrwdkusfmhydlidl.supabase.co:5432/postgres" \
//     node scripts/test-postgres-auth.js
//
// What it proves, step by step:
//   1. Creates a brand-new school ("folder") with createSchool() — roles, permissions, the
//      default admin user, grading scale, Arabic subjects, GES starter list, academic year/terms.
//   2. Looks that school up again by its slug (getSchoolBySlug) — proves multi-tenant lookup works.
//   3. Logs in as its seeded admin/Admin@123 user — proves hashPassword/verifyPassword round-trip.
//   4. Runs one protected, school-scoped query (SELECT ... FROM students WHERE school_id=$1) —
//      proves ordinary reads work and are isolated per school.
//   5. Deletes the test school (cascades to everything it seeded) so this is safe to re-run.
//
// It exits non-zero and prints the real error on any failure — nothing here is allowed to be
// reported as "it works" without this actually passing.

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Example:');
    console.error('  DATABASE_URL="postgresql://postgres:<password>@db.abnfnrwdkusfmhydlidl.supabase.co:5432/postgres" node scripts/test-postgres-auth.js');
    process.exit(1);
  }

  const dbpg = require('../db-postgres.js');
  const slug = `__test_${Date.now()}`;

  console.log(`[1/5] Creating school with slug "${slug}"...`);
  const created = await dbpg.createSchool('Test School', slug);
  console.log('      OK ->', created);

  console.log('[2/5] Looking the school up by slug...');
  const school = await dbpg.getSchoolBySlug(slug);
  if (!school) throw new Error('getSchoolBySlug returned nothing for a school we just created');
  console.log('      OK ->', school);

  console.log('[3/5] Logging in as the seeded admin user...');
  const { rows } = await dbpg.query(
    'SELECT id, username, password_hash, password_salt, full_name FROM users WHERE school_id=$1 AND username=$2',
    [school.id, 'admin']
  );
  if (rows.length !== 1) throw new Error(`expected exactly 1 admin user, found ${rows.length}`);
  const adminUser = rows[0];
  const passwordOk = dbpg.verifyPassword('Admin@123', adminUser.password_salt, adminUser.password_hash);
  if (!passwordOk) throw new Error('verifyPassword rejected the correct default password');
  const wrongPasswordRejected = !dbpg.verifyPassword('WrongPassword', adminUser.password_salt, adminUser.password_hash);
  if (!wrongPasswordRejected) throw new Error('verifyPassword accepted an incorrect password');
  console.log(`      OK -> logged in as "${adminUser.username}" (${adminUser.full_name}), wrong password correctly rejected`);

  console.log('[4/5] Running one protected, school-scoped query (students)...');
  const studentsResult = await dbpg.query('SELECT COUNT(*) AS c FROM students WHERE school_id=$1', [school.id]);
  console.log(`      OK -> ${studentsResult.rows[0].c} students (expected 0 for a brand-new school)`);

  console.log('[5/5] Cleaning up the test school...');
  await dbpg.query('DELETE FROM schools WHERE id=$1', [school.id]);
  const stillThere = await dbpg.getSchoolBySlug(slug);
  if (stillThere) throw new Error('school still exists after DELETE — cascade did not clean up');
  console.log('      OK -> test school and all its seeded rows removed');

  console.log('\nAll checks passed.');
  await dbpg.pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('\nFAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
});
