// db-postgres.js — Supabase/Postgres backend for the ONLINE, multi-school deployment only.
//
// The offline installation (db.js + node:sqlite) is completely untouched by this file and keeps
// working with zero internet, exactly as before. This file is loaded instead of db.js only when
// a DATABASE_URL environment variable is present (see the runtime switch in server.js), which in
// practice means "running on Render, backed by Supabase".
//
// Because this path is online-only, it is allowed to use one external dependency, "pg" — the
// offline path stays 100% dependency-free. "pg" is NOT installed in this development sandbox
// (its network egress blocks the npm registry), but it IS listed in package.json, so Render's
// build step (which has full internet access) installs it normally. Anything in this file that
// depends on the actual TCP connection to Postgres can only be exercised on Render or on a
// developer's own machine with internet access — see SUPABASE_MIGRATION.md in this repo for
// how to test it and for the current migration status.
//
// Every table except `schools` carries a `school_id` column, so one Postgres database serves many
// schools with each school's data isolated by that column. There is no client-side Supabase SDK
// and no browser ever holds the database password: this module is used exclusively by server.js
// over a direct, server-side connection, with all RBAC/access-control enforced in server.js itself
// (see ONLINE_DEPLOYMENT.md's note on Row Level Security for why that's the right call here).

const crypto = require('crypto');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('db-postgres.js was loaded but DATABASE_URL is not set — this module must only be used when an online/Postgres backend is configured.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase's pooled/direct Postgres connections require TLS; Node's default root store doesn't
  // always include Supabase's chain, and pinning the exact CA is more upkeep than this deployment
  // needs, so we encrypt the connection without verifying the certificate chain. The connection
  // string itself (host + password) is the actual secret and is never logged or sent to the client.
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  // A background/idle client emitting an error should not crash the whole server.
  console.error('[db-postgres] Unexpected error on idle Postgres client:', err.message);
});

async function query(text, params) {
  return pool.query(text, params);
}

/** Run several statements inside one transaction. `fn` receives a client with the same .query(text, params) shape. */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn({ query: (text, params) => client.query(text, params) });
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------------------------
// Password hashing — identical algorithm to db.js (crypto.scryptSync), so a school's password
// hashes are portable between the offline and online backends if ever needed.
// ---------------------------------------------------------------------------------------------

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, salt, hash) {
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(check, 'hex'), Buffer.from(hash, 'hex'));
}

// ---------------------------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------------------------

async function logAudit(schoolId, user, action, module, details) {
  await query(
    'INSERT INTO audit_logs (school_id, user_id, username, action, module, details) VALUES ($1,$2,$3,$4,$5,$6)',
    [schoolId, user ? user.id : null, user ? user.username : 'system', action, module || null, details ? JSON.stringify(details) : null]
  );
}

// ---------------------------------------------------------------------------------------------
// Sequential, human-readable IDs ("NIB/2026/001") — same scheme as db.js's generateSequentialId,
// scoped per school via id_counters' (school_id, type, year) primary key.
// ---------------------------------------------------------------------------------------------

async function generateSequentialId(schoolId, prefix, type, year, digits) {
  digits = digits || 3;
  return withTransaction(async (tx) => {
    const { rows } = await tx.query(
      'SELECT next_seq FROM id_counters WHERE school_id=$1 AND type=$2 AND year=$3 FOR UPDATE',
      [schoolId, type, year]
    );
    let nextSeq;
    if (rows.length === 0) {
      nextSeq = 1;
      await tx.query('INSERT INTO id_counters (school_id, type, year, next_seq) VALUES ($1,$2,$3,$4)', [schoolId, type, year, 2]);
    } else {
      nextSeq = rows[0].next_seq;
      await tx.query('UPDATE id_counters SET next_seq=next_seq+1 WHERE school_id=$1 AND type=$2 AND year=$3', [schoolId, type, year]);
    }
    return `${prefix}/${year}/${String(nextSeq).padStart(digits, '0')}`;
  });
}

// ---------------------------------------------------------------------------------------------
// School provisioning — the online equivalent of db.js's seed(), but creates one new, fully
// isolated school ("folder") instead of running once at process startup. Ported line-for-line
// from db.js's seed()/seedBeceGrades()/seedRoleDashboardWidgets() so a school created online
// starts with exactly the same roles, permissions, grading scale, and defaults as an offline
// install. Slug must be unique (used as the school's identifier in login/URLs).
// ---------------------------------------------------------------------------------------------

const ALL_MODULES = ['dashboard','students','parents','teachers','staff','classes','subjects','academic_sessions','attendance','results','fees','bus','canteen','announcements','users','settings','audit_logs','backup','forum','messages','assignments','class_groups','exam_schedule','live_class_rooms'];

const ROLE_NAMES = ['Super Administrator', 'Headteacher', 'Headmistress', 'Teacher', 'Non-teaching Staff', 'Accountant/Bursar', 'Canteen Collector', 'Arabic Head Teacher', 'Parent/Guardian', 'Student'];

// Identical permission matrix to db.js's seed() — see that function's comments for the reasoning
// behind each role's access (Canteen Collector / Arabic Head Teacher scoping is enforced in
// server.js, not here, since a flat can_view flag can't express "only their own assigned class").
function permsForRole(roleName, moduleName) {
  const m = moduleName;
  if (roleName === 'Super Administrator') return [1,1,1,1,1];
  if (roleName === 'Headteacher' || roleName === 'Headmistress') {
    return (m === 'users' || m === 'backup') ? [1,0,0,0,1] : [1,1,1,1,1];
  }
  if (roleName === 'Teacher') {
    if (['attendance','results','assignments','class_groups','exam_schedule','live_class_rooms'].includes(m)) return [1,1,1,1,1];
    if (['students','classes','subjects','dashboard','forum','announcements','messages'].includes(m)) return [1,1,0,0,0];
    if (m === 'academic_sessions') return [1,0,0,0,0];
    return [0,0,0,0,0];
  }
  if (roleName === 'Non-teaching Staff') {
    if (m === 'dashboard') return [1,0,0,0,0];
    if (['forum', 'messages'].includes(m)) return [1,1,0,0,0];
    if (m === 'announcements') return [1,0,0,0,0];
    return [0,0,0,0,0];
  }
  if (roleName === 'Accountant/Bursar') {
    if (['fees','dashboard'].includes(m)) return [1,1,1,1,1];
    if (m === 'canteen') return [1,0,0,0,1];
    if (m === 'students') return [1,0,0,0,0];
    return [0,0,0,0,0];
  }
  if (roleName === 'Canteen Collector') {
    return ['canteen', 'dashboard'].includes(m) ? [1,1,0,0,0] : [0,0,0,0,0];
  }
  if (roleName === 'Arabic Head Teacher') {
    return ['teachers', 'results', 'dashboard'].includes(m) ? [1,0,0,0,0] : [0,0,0,0,0];
  }
  if (roleName === 'Parent/Guardian') {
    if (['dashboard','students','attendance','results','fees','exam_schedule','announcements','forum','live_class_rooms','academic_sessions'].includes(m)) return [1,0,0,0,0];
    if (m === 'messages') return [1,1,0,0,0];
    return [0,0,0,0,0];
  }
  if (roleName === 'Student') {
    if (['dashboard','students','attendance','results','fees','academic_sessions','announcements','exam_schedule','live_class_rooms'].includes(m)) return [1,0,0,0,0];
    if (['forum','assignments','messages'].includes(m)) return [1,1,0,0,0];
    return [0,0,0,0,0];
  }
  return [0,0,0,0,0];
}

const BECE_GRADES = [
  ['1', 80, 100, 'Excellent'],
  ['2', 70, 79.99, 'Very Good'],
  ['3', 60, 69.99, 'Good'],
  ['4', 55, 59.99, 'Credit (High)'],
  ['5', 50, 54.99, 'Credit'],
  ['6', 45, 49.99, 'Credit (Low)'],
  ['7', 40, 44.99, 'Pass (High)'],
  ['8', 35, 39.99, 'Pass'],
  ['9', 0, 34.99, 'Fail'],
];

const ARABIC_SUBJECTS = [
  ['حفظ القرآن الكريم', 'Quran Memorization', 'Religious', 1],
  ['تلاوة القرآن الكريم', 'Quran Recitation', 'Religious', 2],
  ['التجويد', 'Tajweed', 'Religious', 3],
  ['التفسير', 'Tafsir', 'Religious', 4],
  ['التوحيد', 'Tawheed', 'Religious', 5],
  ['الحديث', 'Hadith', 'Religious', 6],
  ['الفقه', 'Fiqh', 'Religious', 7],
  ['أصول الفقه', 'Usul al-Fiqh', 'Religious', 8],
  ["الفرائض", "Fara'id", 'Religious', 9],
  ['النحو والصرف', 'Grammar & Morphology', 'Arabic', 10],
  ['البلاغة', 'Rhetoric', 'Arabic', 11],
  ['النصوص الأدبية', 'Literary Texts', 'Arabic', 12],
  ['الإنشاء', 'Composition', 'Arabic', 13],
  ['المطالعة', 'Reading', 'Arabic', 14],
  ['السيرة النبوية / التاريخ', 'Prophetic Biography / History', 'Social', 15],
  ['الفكر الإسلامي', 'Islamic Thought', 'Social', 16],
  ['الجغرافيا', 'Geography', 'Social', 17],
  ['الحساب', 'Arithmetic', 'Foreign', 18],
  ['اللغة الإنجليزية', 'English Language', 'Foreign', 19],
];

const STARTER_GES_SCHOOLS = [
  ['0050108', 'Prempeh College', 'A', 'Ashanti', 'Kumasi Metro', 'Boys', 'Day/Boarding', 'SHS'],
  ['0050110', 'Opoku Ware School', 'A', 'Ashanti', 'Kumasi Metro', 'Boys', 'Day/Boarding', 'SHS'],
  ["0030101", "St. Augustine's College, Cape Coast", 'A', 'Central', 'Cape Coast Metro', 'Boys', 'Day/Boarding', 'SHS'],
  ["0030107", "Wesley Girls' High School, Cape Coast", 'A', 'Central', 'Cape Coast Metro', 'Girls', 'Day/Boarding', 'SHS'],
  ['0030104', 'Mfantsipim School', 'A', 'Central', 'Cape Coast Metro', 'Boys', 'Day/Boarding', 'SHTS'],
  ['0030103', 'Holy Child School, Cape Coast', 'A', 'Central', 'Cape Coast Metro', 'Girls', 'Day/Boarding', 'SHS'],
  ['0010121', 'Accra Academy', 'A', 'Gt. Accra', 'Accra Metro', 'Boys', 'Day/Boarding', 'SHS'],
  ['0010110', 'Achimota Senior High', 'A', 'Gt. Accra', 'Okaikwei North Municipal', 'Mixed', 'Day/Boarding', 'SHS'],
  ["0010111", "Presby Boys' Senior High, Legon", 'A', 'Gt. Accra', 'La Nkwantanang Madina Municipal', 'Boys', 'Day/Boarding', 'SHS'],
  ['0070102', 'Mawuli School, Ho', 'A', 'Volta', 'Ho Municipal', 'Mixed', 'Day/Boarding', 'SHTS'],
  ['0080101', 'Tamale Senior High', 'A', 'Northern', 'Sagnerigu Municipal', 'Mixed', 'Day/Boarding', 'SHTS'],
  ['0060104', 'Sunyani Senior High', 'A', 'Bono', 'Sunyani Municipal', 'Mixed', 'Day/Boarding', 'SHS'],
];

const DASHBOARD_WIDGET_DEFAULTS = {
  Student: { results: 1, fees: 1, 'live-class': 1, forum: 1, messages: 1, tasks: 1, announcements: 1 },
  Teacher: { results: 1, fees: 1, 'live-class': 1, forum: 1, messages: 1, tasks: 1, announcements: 1 },
  'Parent/Guardian': { results: 1, fees: 1, 'live-class': 0, forum: 1, messages: 0, tasks: 0, announcements: 1 },
  'Non-teaching Staff': { results: 0, fees: 0, 'live-class': 0, forum: 1, messages: 0, tasks: 1, announcements: 1 },
};

/**
 * Creates a brand-new, fully isolated school: the `schools` row plus every seeded default a
 * fresh offline install would have (roles, permissions, the admin/Admin@123 user, singleton
 * config rows, grading scale, Arabic subjects, a GES starter list, and the default academic
 * year/term). Returns { schoolId, slug, adminUsername: 'admin', adminPassword: 'Admin@123' }.
 *
 * Throws if the slug is already taken (schools.slug is UNIQUE) — the caller should catch a
 * unique-violation (error code '23505') and ask for a different slug.
 */
async function createSchool(name, slug) {
  return withTransaction(async (tx) => {
    const { rows: schoolRows } = await tx.query(
      'INSERT INTO schools (slug, name) VALUES ($1,$2) RETURNING id',
      [slug, name]
    );
    const schoolId = schoolRows[0].id;

    // school_settings (singleton, PK = school_id)
    await tx.query(
      'INSERT INTO school_settings (school_id, school_name, motto, address, phone, email) VALUES ($1,$2,$3,$4,$5,$6)',
      [schoolId, name || 'Nibras Educational Complex', 'Knowledge is Light', 'Accra, Ghana', '', '']
    );

    // timetable_config / staff_checkin_config / school_selection_config / system_lock / canteen_config
    // — every column takes its schema default, so a bare insert of school_id is enough for each.
    await tx.query('INSERT INTO timetable_config (school_id) VALUES ($1)', [schoolId]);
    await tx.query('INSERT INTO staff_checkin_config (school_id) VALUES ($1)', [schoolId]);
    await tx.query('INSERT INTO school_selection_config (school_id) VALUES ($1)', [schoolId]);
    await tx.query('INSERT INTO system_lock (school_id) VALUES ($1)', [schoolId]);
    await tx.query('INSERT INTO canteen_config (school_id) VALUES ($1)', [schoolId]);

    // Roles + role_permissions
    const roleIdByName = {};
    for (const roleName of ROLE_NAMES) {
      const { rows } = await tx.query('INSERT INTO roles (school_id, name) VALUES ($1,$2) RETURNING id', [schoolId, roleName]);
      roleIdByName[roleName] = rows[0].id;
      for (const m of ALL_MODULES) {
        const [canView, canAdd, canEdit, canDelete, canExport] = permsForRole(roleName, m);
        await tx.query(
          'INSERT INTO role_permissions (school_id, role_id, module, can_view, can_add, can_edit, can_delete, can_export) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [schoolId, roleIdByName[roleName], m, canView, canAdd, canEdit, canDelete, canExport]
        );
      }
    }

    // Default Super Administrator user
    const { hash, salt } = hashPassword('Admin@123');
    await tx.query(
      'INSERT INTO users (school_id, username, password_hash, password_salt, full_name, role_id) VALUES ($1,$2,$3,$4,$5,$6)',
      [schoolId, 'admin', hash, salt, 'System Administrator', roleIdByName['Super Administrator']]
    );

    // Role dashboard widget defaults
    for (const [roleName, widgets] of Object.entries(DASHBOARD_WIDGET_DEFAULTS)) {
      const roleId = roleIdByName[roleName];
      if (!roleId) continue;
      for (const [widgetKey, visible] of Object.entries(widgets)) {
        await tx.query(
          'INSERT INTO role_dashboard_widgets (school_id, role_id, widget_key, visible) VALUES ($1,$2,$3,$4)',
          [schoolId, roleId, widgetKey, visible]
        );
      }
    }

    // BECE grading scale
    for (const [grade, min, max, description] of BECE_GRADES) {
      await tx.query(
        'INSERT INTO grading_system (school_id, grade, min_score, max_score, description, grade_point) VALUES ($1,$2,$3,$4,$5,NULL)',
        [schoolId, grade, min, max, description]
      );
    }

    // Arabic subjects
    for (const [nameAr, nameEn, category, displayOrder] of ARABIC_SUBJECTS) {
      await tx.query(
        'INSERT INTO arabic_subjects (school_id, name_ar, name_en, category, display_order) VALUES ($1,$2,$3,$4,$5)',
        [schoolId, nameAr, nameEn, category, displayOrder]
      );
    }

    // GES starter school list
    for (const [code, schoolName, category, region, district, gender, dayBoarding, schType] of STARTER_GES_SCHOOLS) {
      await tx.query(
        'INSERT INTO ges_schools (school_id, school_code, school_name, category, region, district, gender, day_boarding, sch_type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [schoolId, code, schoolName, category, region, district, gender, dayBoarding, schType]
      );
    }

    // Default academic year + terms, and point school_settings at Term 1
    const { rows: yearRows } = await tx.query(
      'INSERT INTO academic_years (school_id, name, start_date, end_date) VALUES ($1,$2,$3,$4) RETURNING id',
      [schoolId, '2026/2027', '2026-09-01', '2027-07-31']
    );
    const yearId = yearRows[0].id;
    const termsToInsert = [
      ['Term 1', '2026-09-01', '2026-12-12'],
      ['Term 2', '2027-01-05', '2027-04-02'],
      ['Term 3', '2027-04-20', '2027-07-31'],
    ];
    let term1Id = null;
    for (const [termName, startDate, endDate] of termsToInsert) {
      const { rows: termRows } = await tx.query(
        'INSERT INTO terms (school_id, academic_year_id, name, start_date, end_date) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [schoolId, yearId, termName, startDate, endDate]
      );
      if (termName === 'Term 1') term1Id = termRows[0].id;
    }
    await tx.query('UPDATE school_settings SET current_academic_year_id=$1, current_term_id=$2 WHERE school_id=$3', [yearId, term1Id, schoolId]);

    return { schoolId, slug, adminUsername: 'admin', adminPassword: 'Admin@123' };
  });
}

/** Looks up a school by its slug (used to resolve which school a login/request belongs to). */
async function getSchoolBySlug(slug) {
  const { rows } = await query('SELECT id, slug, name, created_at FROM schools WHERE slug=$1', [slug]);
  return rows[0] || null;
}

module.exports = {
  pool,
  query,
  withTransaction,
  hashPassword,
  verifyPassword,
  logAudit,
  generateSequentialId,
  createSchool,
  getSchoolBySlug,
};
