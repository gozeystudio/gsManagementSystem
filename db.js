// db.js — Database layer for Nibras Educational Complex School Management System
// Uses Node's built-in SQLite (node:sqlite) — no external packages required.

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

// DATA_DIR lets a cloud host point the database at a persistent disk (e.g. Render's mounted
// volume) so it survives redeploys; unset, it defaults to the same local ./data folder the
// offline Windows install has always used, so nothing changes for that setup.
const DATA_ROOT = process.env.DATA_DIR || __dirname;
const DB_DIR = path.join(DATA_ROOT, 'data');
const DB_PATH = path.join(DB_DIR, 'nibras.db');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS school_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  school_name TEXT NOT NULL DEFAULT 'Nibras Educational Complex',
  motto TEXT NOT NULL DEFAULT 'Knowledge is Light',
  address TEXT, phone TEXT, email TEXT,
  current_academic_year_id INTEGER,
  current_term_id INTEGER
);

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL,
  module TEXT NOT NULL,
  can_view INTEGER DEFAULT 0,
  can_add INTEGER DEFAULT 0,
  can_edit INTEGER DEFAULT 0,
  can_delete INTEGER DEFAULT 0,
  can_export INTEGER DEFAULT 0,
  PRIMARY KEY (role_id, module),
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_id INTEGER NOT NULL,
  linked_teacher_id INTEGER,
  linked_parent_id INTEGER,
  linked_student_id INTEGER,
  status TEXT DEFAULT 'Active',
  photo TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS academic_years (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  start_date TEXT, end_date TEXT
);

CREATE TABLE IF NOT EXISTS terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academic_year_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  start_date TEXT, end_date TEXT,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
);

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT,
  level TEXT,
  class_teacher_id INTEGER,
  academic_year_id INTEGER,
  UNIQUE(name, academic_year_id)
);

CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT,
  department TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS teacher_subjects (
  teacher_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  PRIMARY KEY (teacher_id, subject_id)
);

CREATE TABLE IF NOT EXISTS teacher_classes (
  teacher_id INTEGER NOT NULL,
  class_id INTEGER NOT NULL,
  PRIMARY KEY (teacher_id, class_id)
);

CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id TEXT UNIQUE,
  full_name TEXT NOT NULL,
  gender TEXT, dob TEXT, phone TEXT, email TEXT, address TEXT,
  qualification TEXT, specialization TEXT, employment_date TEXT,
  employment_type TEXT, department TEXT,
  status TEXT DEFAULT 'Active',
  photo TEXT,
  salary REAL
);

CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id TEXT UNIQUE,
  full_name TEXT NOT NULL,
  gender TEXT, phone TEXT, address TEXT,
  position TEXT, department TEXT,
  employment_date TEXT, employment_status TEXT DEFAULT 'Active',
  emergency_contact TEXT, photo TEXT
);

CREATE TABLE IF NOT EXISTS parents_guardians (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  relationship TEXT NOT NULL, -- Father, Mother, Guardian, Other
  gender TEXT, phone TEXT, alt_phone TEXT, email TEXT,
  occupation TEXT, address TEXT,
  status TEXT DEFAULT 'Alive', -- Alive, Deceased, Unknown
  preferred_contact TEXT,
  pta_member INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT UNIQUE NOT NULL,
  admission_number TEXT UNIQUE,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  gender TEXT, dob TEXT, place_of_birth TEXT, nationality TEXT, religion TEXT,
  previous_school TEXT, admission_date TEXT, photo TEXT,
  academic_year_id INTEGER, class_id INTEGER, stream TEXT, section TEXT, house TEXT,
  status TEXT DEFAULT 'Active', -- Active, Inactive, Graduated, Alumni, Transferred, Withdrawn, Stopped
  orphan_status TEXT DEFAULT 'Non-Orphan', -- Orphan, Non-Orphan
  caregiver_info TEXT,
  uses_bus INTEGER DEFAULT 0,
  bus_id INTEGER, pickup_point TEXT, dropoff_point TEXT, transport_fee REAL,
  pays_canteen INTEGER DEFAULT 0,
  canteen_plan TEXT, canteen_amount REAL,
  emergency_contact_name TEXT, emergency_contact_phone TEXT, emergency_relationship TEXT,
  medical_info TEXT, allergies TEXT, special_needs TEXT, additional_notes TEXT,
  boarding_status TEXT DEFAULT 'Day', -- Day, Boarder
  scholarship_status TEXT DEFAULT 'None', -- None, Full Scholarship, Partial Scholarship, Bursary, Sponsored
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS student_parents (
  student_id INTEGER NOT NULL,
  parent_id INTEGER NOT NULL,
  PRIMARY KEY (student_id, parent_id)
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  class_id INTEGER,
  date TEXT NOT NULL,
  status TEXT NOT NULL, -- Present, Absent, Late, Excused
  remarks TEXT,
  marked_by INTEGER,
  UNIQUE(student_id, date)
);

CREATE TABLE IF NOT EXISTS grading_system (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grade TEXT NOT NULL,
  min_score REAL NOT NULL,
  max_score REAL NOT NULL,
  description TEXT,
  grade_point REAL
);

-- Continuous Assessment (school's specific CA + Exam structure):
--   Class Exercise (/15) + Class Test (/15) + Group Work (/15) + Project Work (/15)
--   = CA Total (/60), scaled to 50%
--   Exam (/100), scaled to 50%
--   Final Score (/100) = CA(50%) + Exam(50%)
CREATE TABLE IF NOT EXISTS continuous_assessment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  class_id INTEGER,
  academic_year_id INTEGER,
  term_id INTEGER NOT NULL,
  class_exercise REAL DEFAULT 0,
  class_test REAL DEFAULT 0,
  group_work REAL DEFAULT 0,
  project_work REAL DEFAULT 0,
  exam_score REAL DEFAULT 0,
  teacher_comment TEXT,
  entered_by INTEGER,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(student_id, subject_id, term_id)
);

CREATE TABLE IF NOT EXISTS fee_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  default_amount REAL
);

CREATE TABLE IF NOT EXISTS fees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  fee_type_id INTEGER NOT NULL,
  academic_year_id INTEGER,
  term_id INTEGER,
  amount_due REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS fee_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fee_id INTEGER NOT NULL,
  amount_paid REAL NOT NULL,
  payment_date TEXT DEFAULT (datetime('now')),
  payment_method TEXT,
  receipt_number TEXT,
  recorded_by INTEGER
);

-- MTN Mobile Money "Request to Pay" transactions — one row per payment attempt, tracked from
-- the moment it's requested through to MTN's final status (Pending/Successful/Failed). A
-- successful transaction gets turned into a normal fee_payments row once confirmed, so paid
-- fees look the same everywhere in the app regardless of how they were paid.
CREATE TABLE IF NOT EXISTS momo_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fee_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  phone TEXT NOT NULL,
  reference_id TEXT UNIQUE NOT NULL, -- the UUID sent to MTN as X-Reference-Id
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, SUCCESSFUL, FAILED
  momo_financial_transaction_id TEXT,
  failure_reason TEXT,
  initiated_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Manual expense entries for the Income & Expenditure feature — income itself isn't stored
-- here at all, it's computed live from fee_payments and successful momo_transactions, so it
-- never drifts out of sync with the actual payment records.
CREATE TABLE IF NOT EXISTS expenditures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  description TEXT,
  amount REAL NOT NULL,
  expense_date TEXT NOT NULL DEFAULT (date('now')),
  recorded_by INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);
-- Income targets an admin sets to track progress against — one row per period type, each
-- holding the single current target for that cadence (weekly/monthly/termly).
CREATE TABLE IF NOT EXISTS income_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_type TEXT NOT NULL UNIQUE, -- 'weekly', 'monthly', 'termly'
  target_amount REAL NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);
-- A specific target for one specific week (by its start date and a human-friendly week number,
-- e.g. "Week 3 of Term 1") — separate from the single recurring weekly figure in
-- income_targets, for a school that wants a different goal for a particular week rather than
-- the same number reused every time.
CREATE TABLE IF NOT EXISTS weekly_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_number INTEGER,
  week_start_date TEXT NOT NULL,
  target_amount REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Any file a student needs on record — a birth certificate, a medical note, a previous
-- school's transfer letter, and so on. Deliberately generic (any file type, a free-text
-- description) rather than a fixed set of "document types," since what a school actually
-- needs to keep on file varies a lot.
CREATE TABLE IF NOT EXISTS student_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT,
  description TEXT,
  uploaded_by INTEGER,
  uploaded_at TEXT DEFAULT (datetime('now'))
);
-- Files a teacher shares with an entire class at once (handouts, worksheets, reading lists) —
-- visible to every student and parent linked to that class, distinct from the 1-to-1 Messages
-- feature and from Assignments (which expect a submission back).
CREATE TABLE IF NOT EXISTS class_shared_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT,
  description TEXT,
  shared_by INTEGER,
  shared_at TEXT DEFAULT (datetime('now'))
);

-- Custom fonts an admin has uploaded (.ttf/.otf), so the school can use its own fonts — e.g. a
-- particular Arabic calligraphy style — instead of only the small fixed set built into the app.
-- font_key is what gets stored in places like arabic_report_font; family_name is the actual
-- CSS font-family name declared in the generated @font-face rule.
CREATE TABLE IF NOT EXISTS custom_fonts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name TEXT NOT NULL,
  font_key TEXT UNIQUE NOT NULL,
  family_name TEXT NOT NULL,
  filename TEXT NOT NULL,
  uploaded_by INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS buses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bus_number TEXT UNIQUE NOT NULL,
  registration_number TEXT,
  driver_name TEXT,
  route TEXT,
  capacity INTEGER,
  status TEXT DEFAULT 'Active'
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT DEFAULT 'All', -- All, Teachers, Staff, Parents, Students
  posted_by INTEGER,
  posted_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  action TEXT NOT NULL,
  module TEXT,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  created_by INTEGER
);

CREATE TABLE IF NOT EXISTS id_counters (
  type TEXT NOT NULL,
  year INTEGER NOT NULL,
  next_seq INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (type, year)
);

-- Timetable: one global schedule shape (periods/day, weekdays, break/lunch/prayer/closing times)
-- shared by every class, then each class fills its own grid of subject+teacher per period/day.
-- Works for any class level, including Nursery and KG — nothing here is JHS/Primary-specific.
CREATE TABLE IF NOT EXISTS timetable_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  periods_per_day INTEGER NOT NULL DEFAULT 8, -- fallback used for any weekday not listed in periods_per_day_json
  periods_per_day_json TEXT, -- optional per-weekday override, e.g. {"Monday":8,"Friday":5}
  weekdays TEXT NOT NULL DEFAULT 'Monday,Tuesday,Wednesday,Thursday,Friday',
  period_length_minutes INTEGER NOT NULL DEFAULT 40,
  school_start_time TEXT NOT NULL DEFAULT '08:00',
  break_time TEXT DEFAULT '10:00', break_duration_minutes INTEGER DEFAULT 20,
  lunch_time TEXT DEFAULT '12:30', lunch_duration_minutes INTEGER DEFAULT 45,
  prayer_time TEXT DEFAULT '12:00', prayer_duration_minutes INTEGER DEFAULT 15,
  closing_time TEXT DEFAULT '15:00'
);

CREATE TABLE IF NOT EXISTS timetable_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  weekday TEXT NOT NULL,
  period_number INTEGER NOT NULL,
  subject_id INTEGER,
  teacher_id INTEGER,
  UNIQUE(class_id, weekday, period_number)
);

-- Duty Roster: which staff are on duty (gate, assembly, compound, etc.) on which weekday.
-- Independent of the class timetable above — this is a whole-school, day-based schedule.
CREATE TABLE IF NOT EXISTS duty_roster (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weekday TEXT NOT NULL,
  duty_name TEXT NOT NULL DEFAULT 'General Duty',
  teacher_id INTEGER,
  notes TEXT
);

-- Discussion Forum: simple topic-based message board for students and teachers.
-- Not a full private/real-time chat — everyone with forum access can see every topic,
-- which keeps it simple, moderatable, and appropriate for a school setting.
CREATE TABLE IF NOT EXISTS forum_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  class_id INTEGER,
  subject_id INTEGER,
  created_by INTEGER,
  created_by_name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS forum_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,
  author_id INTEGER,
  author_name TEXT,
  author_role TEXT,
  body TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Staff Check-in / Check-out (time & attendance tracking for teachers and non-teaching staff).
-- Each person gets one durable QR token (for phone-camera check-in) and one short PIN
-- (for a shared kiosk device where typing is easier than scanning). Both are convenience
-- credentials for a local time clock — not login credentials, and not the main user-login system.
CREATE TABLE IF NOT EXISTS staff_checkin_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  standard_start_time TEXT NOT NULL DEFAULT '08:00',
  standard_end_time TEXT NOT NULL DEFAULT '16:00'
);
CREATE TABLE IF NOT EXISTS checkin_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_type TEXT NOT NULL, -- 'teacher' or 'staff'
  person_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  pin TEXT,
  UNIQUE(person_type, person_id)
);
CREATE TABLE IF NOT EXISTS staff_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_type TEXT NOT NULL,
  person_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  check_in_time TEXT,
  check_out_time TEXT,
  method TEXT, -- 'QR' or 'PIN'
  UNIQUE(person_type, person_id, date)
);

-- Student kiosk check-in/out, via their barcode ID card — separate from the teacher-marked
-- daily Present/Absent attendance register (that's a judgment call by a teacher; this is simply
-- "the student physically scanned in/out at the kiosk today", the same idea as staff_attendance
-- but kept as its own table since the two concepts shouldn't be conflated.
CREATE TABLE IF NOT EXISTS student_checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  check_in_time TEXT,
  check_out_time TEXT,
  method TEXT DEFAULT 'Barcode',
  UNIQUE(student_id, date)
);

-- Non-staff visitors (parents dropping by, contractors, inspectors, etc.) checking in/out at
-- the kiosk. Kept separate from staff_attendance since a visitor has no existing teacher/staff
-- record to key off, and — unlike staff — the same person might check in and out more than
-- once in a single day.
CREATE TABLE IF NOT EXISTS visitor_checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  purpose TEXT,
  date TEXT NOT NULL,
  check_in_time TEXT,
  check_out_time TEXT,
  photo TEXT
);

-- Private one-to-one messages between logged-in users (e.g. a student messaging a classmate
-- or their class teacher) — distinct from the Discussion Forum, which is a public class/school
-- board rather than a private conversation.
CREATE TABLE IF NOT EXISTS direct_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL,
  recipient_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  read_at TEXT
);

-- Assignments / Group Work / Quizzes / Exams: teacher-authored question sets assigned to a
-- class, with student answer submissions that go back to whichever teacher created them.
CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Assignment', -- Assignment, Group Work, Quiz, Examination
  class_id INTEGER,
  subject_id INTEGER,
  instructions TEXT,
  due_date TEXT,
  created_by INTEGER,
  created_by_name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS assignment_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL,
  question_number INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'text', -- 'text' (essay/short answer) or 'mcq'
  options TEXT, -- JSON array, only for mcq
  correct_option INTEGER, -- index into options, only for mcq
  marks REAL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  submitted_at TEXT DEFAULT (datetime('now')),
  UNIQUE(assignment_id, student_id)
);
CREATE TABLE IF NOT EXISTS assignment_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  answer_text TEXT,
  marks_awarded REAL,
  teacher_feedback TEXT,
  UNIQUE(submission_id, question_id)
);

-- Class Groups: a teacher's own sub-groupings within a class (e.g. "Group A"), with tasks
-- assigned to the group on a daily/weekly/monthly/one-time basis.
CREATE TABLE IF NOT EXISTS class_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS class_group_members (
  group_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  PRIMARY KEY (group_id, student_id)
);
CREATE TABLE IF NOT EXISTS group_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL DEFAULT 'One-time', -- Daily, Weekly, Monthly, One-time
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Exam schedule: which exam is happening for which class/subject, when, and where — separate
-- from the day-to-day class Timetable, since exams don't follow the regular weekly period grid.
CREATE TABLE IF NOT EXISTS exam_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  term_id INTEGER,
  exam_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  venue TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Live Class Rooms: real-time video via WebRTC, peer-to-peer (teacher's browser connects
-- directly to each student's browser — no media server). Signaling (the technical handshake
-- browsers need before they can stream to each other) goes through plain HTTP polling below,
-- since this app has no WebSocket/persistent-connection infrastructure. Best suited to a
-- school LAN or a small class; genuinely large-scale broadcast would need a real media server,
-- which is out of scope for a zero-dependency offline app.
CREATE TABLE IF NOT EXISTS live_class_rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  subject_id INTEGER,
  teacher_id INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT 'Live Class',
  status TEXT NOT NULL DEFAULT 'active', -- active, ended
  started_at TEXT DEFAULT (datetime('now')),
  ended_at TEXT,
  created_by INTEGER
);
CREATE TABLE IF NOT EXISTS live_class_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  student_id INTEGER,
  display_name TEXT,
  joined_at TEXT DEFAULT (datetime('now')),
  left_at TEXT
);
-- One row per signaling message (WebRTC offer/answer/ICE candidate) exchanged between the
-- teacher and one student. to_user_id is always set (this is 1-to-1 signaling per student,
-- not a broadcast) — each side polls for messages addressed to them since the last one seen.
CREATE TABLE IF NOT EXISTS live_class_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL,
  from_user_id INTEGER NOT NULL,
  to_user_id INTEGER NOT NULL,
  signal_type TEXT NOT NULL, -- offer, answer, ice-candidate
  payload TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- A one-time link an admin can send a new teacher, letting them fill in their own details
-- (same fields as the admin's own "Add Teacher" form) rather than the admin typing it all in —
-- self-service registration, not a way to bypass admin approval: nothing goes live until the
-- link is actually used, and it can only be used once.
CREATE TABLE IF NOT EXISTS teacher_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  created_by INTEGER,
  used_at TEXT,
  used_by_teacher_id INTEGER,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);


-- Announcements) each role sees on their own landing-page dashboard. Only applies to the
-- card-based portal dashboards (Teacher, Student, Parent/Guardian, Non-teaching Staff) — the
-- admin-style stat-card Dashboard has its own separate, per-account customization already.
-- One row per (role, widget); absence of a row for a widget defaults to "visible" so a brand
-- new widget shows up everywhere until an admin deliberately hides it somewhere.
CREATE TABLE IF NOT EXISTS role_dashboard_widgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER NOT NULL,
  widget_key TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1,
  UNIQUE(role_id, widget_key)
);

-- A task/duty assigned to ONE specific student, rather than a whole Class Group — for when a
-- teacher wants to give an individual student something to do without setting up a group of one.
CREATE TABLE IF NOT EXISTS student_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL DEFAULT 'One-time',
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'Pending', -- Pending, Done
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- GES Senior High School placement / "School Selection" form, matching the real CSSPS form:
-- 8 ranked choices (School Code, Name, Category, Programme Code, Programme Name, Day/Boarding
-- each), candidate details, and parent/headteacher sign-off fields.
CREATE TABLE IF NOT EXISTS school_selection_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  max_choices INTEGER NOT NULL DEFAULT 8,
  max_category_a INTEGER NOT NULL DEFAULT 2,
  max_category_b INTEGER NOT NULL DEFAULT 3
);
CREATE TABLE IF NOT EXISTS school_selections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL UNIQUE,
  index_number TEXT,
  residential_location TEXT,
  choices TEXT, -- JSON array of { school_code, school_name, category, programme_code, programme_name, day_boarding }, rank order
  programme_preferences TEXT, -- JSON array of selected programme checkbox labels
  other_programme TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  parent_signed_off INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- GES School Database: the reference list of schools (Category A/B/C/Pilot Private/TVET) a
-- candidate can pick from. Ships with a small starter set of well-known schools; a school can
-- bulk-import the full official register (it's republished every year) via CSV.
CREATE TABLE IF NOT EXISTS ges_schools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_code TEXT UNIQUE NOT NULL,
  school_name TEXT NOT NULL,
  category TEXT NOT NULL, -- A, B, C, Pilot Private, TVET
  region TEXT, district TEXT, gender TEXT, -- Mixed, Boys, Girls
  day_boarding TEXT, -- e.g. "Day/Boarding" or "Day"
  sch_type TEXT, -- SHS, SHTS, STEM, TVET
  programmes TEXT -- free-text summary, e.g. "General Arts, General Science, Business"
);

-- System-wide access lock: the admin sets an expiry date; once passed, the whole system
-- (every user, including admins) is locked out of normal use until the correct unlock token
-- is entered. A new token/expiry can then be set, and the cycle repeats.
CREATE TABLE IF NOT EXISTS system_lock (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  expiry_date TEXT, -- NULL = no expiry set, never locks
  token TEXT,
  lock_message TEXT DEFAULT 'This system''s access period has ended. Please contact your administrator.'
);

-- Canteen: daily paid/not-paid tracking per student, the same shape as attendance, plus a
-- school-customizable standard daily fee and which weekdays the canteen actually runs.
CREATE TABLE IF NOT EXISTS canteen_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  daily_amount REAL NOT NULL DEFAULT 5,
  weekdays TEXT NOT NULL DEFAULT 'Monday,Tuesday,Wednesday,Thursday,Friday'
);
CREATE TABLE IF NOT EXISTS canteen_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  class_id INTEGER,
  date TEXT NOT NULL,
  status TEXT NOT NULL, -- Paid, Not Paid
  amount REAL,
  marked_by INTEGER,
  UNIQUE(student_id, date)
);

-- Arabic Terminal Report: subjects, categories, and grading structure modelled directly on a
-- real Islamic secondary certificate report (Quran/Religious/Arabic/Social/Foreign subject
-- groups, each scored out of a max with a minimum pass mark) — fully editable by the school.
CREATE TABLE IF NOT EXISTS arabic_subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  category TEXT NOT NULL DEFAULT 'Religious', -- Religious, Arabic, Social, Foreign
  max_score REAL NOT NULL DEFAULT 100,
  min_pass_score REAL NOT NULL DEFAULT 50,
  display_order INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS arabic_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  arabic_subject_id INTEGER NOT NULL,
  term_id INTEGER NOT NULL,
  academic_year_id INTEGER,
  score_obtained REAL,
  remarks TEXT,
  entered_by INTEGER,
  UNIQUE(student_id, arabic_subject_id, term_id)
);

-- Class Termly Report: a narrative report a class teacher writes about their own class for a
-- term (attendance/behaviour/academic summary, general remarks), printable.
CREATE TABLE IF NOT EXISTS class_termly_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  term_id INTEGER NOT NULL,
  academic_year_id INTEGER,
  report_text TEXT,
  written_by INTEGER,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(class_id, term_id)
);
`;

db.exec(SCHEMA);

// ---------- Migrations: add new school_settings columns for existing databases ----------
// (CREATE TABLE IF NOT EXISTS won't add columns to a table that already exists, so we
// check for each column and ALTER TABLE if it's missing. Safe to run on every startup.)
const SCHOOL_SETTINGS_NEW_COLUMNS = [
  ['location', "TEXT"],
  ['logo_photo', "TEXT"],
  ['dashboard_background_photo', "TEXT"],
  ['student_id_prefix', "TEXT DEFAULT 'NIB'"],
  ['staff_id_prefix', "TEXT DEFAULT 'ST'"],
  ['id_seq_digits', "INTEGER DEFAULT 3"],
  ['ca_c1_name', "TEXT DEFAULT 'Class Exercise'"], ['ca_c1_max', "REAL DEFAULT 15"],
  ['ca_c2_name', "TEXT DEFAULT 'Class Test'"], ['ca_c2_max', "REAL DEFAULT 15"],
  ['ca_c3_name', "TEXT DEFAULT 'Group Work'"], ['ca_c3_max', "REAL DEFAULT 15"],
  ['ca_c4_name', "TEXT DEFAULT 'Project Work'"], ['ca_c4_max', "REAL DEFAULT 15"],
  ['exam_max', "REAL DEFAULT 100"],
  ['ca_weight_percent', "REAL DEFAULT 50"],
  ['exam_weight_percent', "REAL DEFAULT 50"],
  ['backup_email', "TEXT"],
  ['smtp_host', "TEXT"], ['smtp_port', "INTEGER DEFAULT 587"], ['smtp_secure', "INTEGER DEFAULT 0"],
  ['smtp_username', "TEXT"], ['smtp_password', "TEXT"],
  ['auto_backup_email_enabled', "INTEGER DEFAULT 0"],
  ['last_auto_backup_sent_date', "TEXT"],
  ['last_auto_backup_status', "TEXT"],
];
const existingCols = new Set(db.prepare("PRAGMA table_info(school_settings)").all().map(c => c.name));
for (const [name, def] of SCHOOL_SETTINGS_NEW_COLUMNS) {
  if (!existingCols.has(name)) {
    db.exec(`ALTER TABLE school_settings ADD COLUMN ${name} ${def}`);
  }
}


// Migration: add 'photo' column to users table if it doesn't already exist (for installs created before this feature)
try {
  const cols = db.prepare("PRAGMA table_info(users)").all();
  if (!cols.some(c => c.name === 'photo')) {
    db.exec('ALTER TABLE users ADD COLUMN photo TEXT');
  }
} catch (e) { /* ignore - table_info/alter should not fail, but never block startup on this */ }

// Generic column-migration helper used for the newer per-record fields below
// (day/boarder, scholarship, PTA membership, salary) so existing installs upgrade in place.
function addColumnsIfMissing(table, columns) {
  const existing = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name));
  for (const [name, def] of columns) {
    if (!existing.has(name)) {
      try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`); } catch (e) { /* ignore */ }
    }
  }
}
addColumnsIfMissing('students', [
  ['boarding_status', "TEXT DEFAULT 'Day'"],
  ['scholarship_status', "TEXT DEFAULT 'None'"],
  ['blood_group', 'TEXT'],
]);
addColumnsIfMissing('parents_guardians', [['pta_member', 'INTEGER DEFAULT 0']]);
addColumnsIfMissing('teachers', [['salary', 'REAL']]);
addColumnsIfMissing('staff', [['salary', 'REAL']]);
// Groups fee types into broader categories (Academic, Transport, Feeding, Extra-curricular, etc.)
// so the Fees Report can show totals per category, not just per individual fee type.
addColumnsIfMissing('fee_types', [['category', "TEXT DEFAULT 'General'"]]);
addColumnsIfMissing('timetable_config', [['periods_per_day_json', 'TEXT']]);
addColumnsIfMissing('users', [['linked_student_id', 'INTEGER'], ['assigned_class_id', 'INTEGER'], ['linked_teacher_id', 'INTEGER'], ['linked_parent_id', 'INTEGER'], ['linked_staff_id', 'INTEGER'], ['assigned_level', 'TEXT'], ['dashboard_prefs', 'TEXT'], ['last_notifications_seen_at', 'TEXT']]);
addColumnsIfMissing('teachers', [['teacher_level', 'TEXT']]); // Nursery, Primary, JHS, SHS — which level this teacher works at
addColumnsIfMissing('terms', [['pass_mark', 'REAL']]); // overall pass mark (out of 100) for report cards this term, customizable per term
addColumnsIfMissing('school_settings', [
  ['report_header_align', "TEXT DEFAULT 'center'"], // left, center, right
  ['report_header_extra', 'TEXT'], // optional extra line(s) shown under the school name/motto on report cards
  ['nav_theme', "TEXT DEFAULT 'navy-gold'"], // which of the preset sidebar color themes is active
  ['page_theme', "TEXT DEFAULT 'default'"], // which of the preset whole-page color themes is active
  ['nav_font_size', "TEXT DEFAULT 'medium'"], // small, medium, large — sidebar menu text size
  ['app_font_family', "TEXT DEFAULT 'default'"], // default, serif, rounded, mono, classic — whole-app typeface
  ['arabic_report_font', "TEXT DEFAULT 'default'"], // which installed Arabic font the Arabic Terminal Report prints in
  ['cursor_style', "TEXT DEFAULT 'default'"], // default, 3d — an optional custom 3D-look cursor
  ['ui_font_scale', "TEXT DEFAULT 'medium'"], // small, medium, large, xlarge — overall interface text/UI size, not just the menu
  ['custom_accent_color', 'TEXT'], // used when nav_theme = 'custom' — any hex color the user picks
  ['custom_bg_color', 'TEXT'], // used when page_theme = 'custom' — any hex color the user picks
  ['id_card_color', "TEXT DEFAULT 'navy-gold'"], // which ID card color scheme is active
  ['id_card_show_dob', 'INTEGER DEFAULT 1'],
  ['id_card_show_blood_group', 'INTEGER DEFAULT 0'],
  ['id_card_show_contact', 'INTEGER DEFAULT 0'],
  ['momo_subscription_key', 'TEXT'], ['momo_api_user', 'TEXT'], ['momo_api_key', 'TEXT'],
  ['momo_target_environment', "TEXT DEFAULT 'sandbox'"], ['momo_base_url', "TEXT DEFAULT 'https://sandbox.momodeveloper.mtn.com'"],
  ['momo_callback_host', 'TEXT'],
  ['custom_connect_url', 'TEXT'],
  ['login_background', 'TEXT'],
  ['lock_pin_hash', 'TEXT'], ['lock_pin_salt', 'TEXT'], ['lock_enabled', 'INTEGER DEFAULT 0'],
  ['custom_backup_folder', 'TEXT'],
]);
addColumnsIfMissing('forum_messages', [['attachment', 'TEXT'], ['attachment_name', 'TEXT']]);
addColumnsIfMissing('assignment_answers', [['marks_awarded', 'REAL'], ['teacher_feedback', 'TEXT']]);
addColumnsIfMissing('forum_topics', [['audience', "TEXT DEFAULT 'All'"]]); // All, Teacher, Student, Parent, Non-teaching Staff
addColumnsIfMissing('exam_schedule', [['created_by', 'INTEGER']]);
addColumnsIfMissing('announcements', [['attachment', 'TEXT'], ['attachment_name', 'TEXT']]);
addColumnsIfMissing('staff_attendance', [['photo', 'TEXT'], ['checkout_photo', 'TEXT']]);
// So a salary expense can be traced back to exactly who it paid, and month-based reporting can
// find "has this person already been paid this month" without parsing free-text descriptions.
addColumnsIfMissing('expenditures', [['paid_to_type', 'TEXT'], ['paid_to_id', 'INTEGER'], ['pay_period', 'TEXT']]);
addColumnsIfMissing('students', [
  ['sponsor_name', 'TEXT'], ['sponsor_contact', 'TEXT'], ['sponsor_organization', 'TEXT'],
]);
addColumnsIfMissing('teachers', [['teaching_language', "TEXT DEFAULT 'English'"]]); // English, Arabic, Both
addColumnsIfMissing('school_selection_config', [
  ['max_category_a', 'INTEGER NOT NULL DEFAULT 2'],
  ['max_category_b', 'INTEGER NOT NULL DEFAULT 3'],
]);
addColumnsIfMissing('school_selections', [
  ['index_number', 'TEXT'], ['residential_location', 'TEXT'], ['parent_signed_off', 'INTEGER DEFAULT 0'],
]);
// GES's own current rule is 8 ranked choices — bump any install still on the old default of 6,
// but leave it alone if a school has already customized it to something else on purpose.
try {
  const cfg = db.prepare('SELECT max_choices FROM school_selection_config WHERE id=1').get();
  if (cfg && cfg.max_choices === 6) db.prepare('UPDATE school_selection_config SET max_choices=8 WHERE id=1').run();
} catch (e) { /* ignore */ }

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, salt, hash) {
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(check, 'hex'), Buffer.from(hash, 'hex'));
}

function seed() {
  const settingsExists = db.prepare('SELECT id FROM school_settings WHERE id=1').get();
  if (!settingsExists) {
    db.prepare(`INSERT INTO school_settings (id, school_name, motto, address, phone, email) VALUES (1, ?, ?, ?, ?, ?)`)
      .run('Nibras Educational Complex', 'Knowledge is Light', 'Accra, Ghana', '', '');
  }

  const timetableConfigExists = db.prepare('SELECT id FROM timetable_config WHERE id=1').get();
  if (!timetableConfigExists) {
    db.prepare('INSERT INTO timetable_config (id) VALUES (1)').run(); // all columns take their defaults
  }

  const roleCount = db.prepare('SELECT COUNT(*) c FROM roles').get().c;
  if (roleCount === 0) {
    const roleNames = ['Super Administrator', 'Headteacher', 'Headmistress', 'Teacher', 'Non-teaching Staff', 'Accountant/Bursar', 'Canteen Collector', 'Arabic Head Teacher', 'Parent/Guardian', 'Student'];
    const modules = ['dashboard','students','parents','teachers','staff','classes','subjects','academic_sessions','attendance','results','fees','bus','canteen','announcements','users','settings','audit_logs','backup','forum','messages','assignments','class_groups','exam_schedule','live_class_rooms'];
    const insertRole = db.prepare('INSERT INTO roles (name) VALUES (?)');
    const insertPerm = db.prepare('INSERT INTO role_permissions (role_id, module, can_view, can_add, can_edit, can_delete, can_export) VALUES (?,?,?,?,?,?,?)');
    for (const rn of roleNames) {
      insertRole.run(rn);
      const roleId = db.prepare('SELECT id FROM roles WHERE name=?').get(rn).id;
      for (const m of modules) {
        let perms;
        if (rn === 'Super Administrator') perms = [1,1,1,1,1];
        else if (rn === 'Headteacher' || rn === 'Headmistress') {
          perms = (m === 'users' || m === 'backup') ? [1,0,0,0,1] : [1,1,1,1,1];
        } else if (rn === 'Teacher') {
          perms = ['attendance','results','assignments','class_groups','exam_schedule','live_class_rooms'].includes(m) ? [1,1,1,1,1]
                : ['students','classes','subjects','dashboard','forum','announcements','messages'].includes(m) ? [1,1,0,0,0]
                : m === 'academic_sessions' ? [1,0,0,0,0] // view only — a teacher picks a term to work in, never creates/edits one
                : [0,0,0,0,0];
        } else if (rn === 'Non-teaching Staff') {
          perms = m === 'dashboard' ? [1,0,0,0,0]
                : ['forum', 'messages'].includes(m) ? [1,1,0,0,0]
                : m === 'announcements' ? [1,0,0,0,0]
                : [0,0,0,0,0];
        } else if (rn === 'Accountant/Bursar') {
          perms = ['fees','dashboard'].includes(m) ? [1,1,1,1,1]
                : m === 'canteen' ? [1,0,0,0,1] // monitors Canteen Collectors' work — view + export, not edit
                : ['students'].includes(m) ? [1,0,0,0,0]
                : [0,0,0,0,0];
        } else if (rn === 'Canteen Collector') {
          // Scoped server-side to only their own assigned class — see the canteen-payments
          // endpoints — so broad view/add here doesn't mean they can see every class's payments.
          perms = ['canteen', 'dashboard'].includes(m) ? [1,1,0,0,0] : [0,0,0,0,0];
        } else if (rn === 'Arabic Head Teacher') {
          // Scoped server-side to only Arabic-designated teachers at their own assigned level
          // (Primary/JHS/Nursery) — see the teachers endpoint's Arabic Head Teacher handling.
          // Also gets visibility into the Arabic Terminal Report to monitor their department's work.
          perms = ['teachers', 'results', 'dashboard'].includes(m) ? [1,0,0,0,0] : [0,0,0,0,0];
        } else if (rn === 'Parent/Guardian') {
          perms = ['dashboard','students','attendance','results','fees','exam_schedule','announcements','forum','live_class_rooms','academic_sessions'].includes(m) ? [1,0,0,0,0]
                : m === 'messages' ? [1,1,0,0,0]
                : [0,0,0,0,0];
        } else if (rn === 'Student') {
          // Students only ever see their OWN attendance/results/fees/profile — enforced in the
          // API layer, not just by hiding menu items, since view permission alone doesn't scope
          // to "my own record" (see the Student-specific checks in server.js's request handler).
          // academic_sessions is view-only so they can pick a term when looking up their report card.
          // assignments: view + add (add = submitting answers, not creating assignments —
          // also enforced server-side, since this flag alone doesn't distinguish the two actions).
          perms = ['dashboard','students','attendance','results','fees','academic_sessions','announcements','exam_schedule','live_class_rooms'].includes(m) ? [1,0,0,0,0]
                : ['forum','assignments','messages'].includes(m) ? [1,1,0,0,0]
                : [0,0,0,0,0];
        } else perms = [0,0,0,0,0];
        insertPerm.run(roleId, m, ...perms);
      }
    }
  }

  const userCount = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  if (userCount === 0) {
    const adminRoleId = db.prepare("SELECT id FROM roles WHERE name='Super Administrator'").get().id;
    const { hash, salt } = hashPassword('Admin@123');
    db.prepare('INSERT INTO users (username, password_hash, password_salt, full_name, role_id) VALUES (?,?,?,?,?)')
      .run('admin', hash, salt, 'System Administrator', adminRoleId);
  }

  const checkinConfigExists = db.prepare('SELECT id FROM staff_checkin_config WHERE id=1').get();
  if (!checkinConfigExists) db.prepare('INSERT INTO staff_checkin_config (id) VALUES (1)').run();

  const schoolSelectionConfigExists = db.prepare('SELECT id FROM school_selection_config WHERE id=1').get();
  if (!schoolSelectionConfigExists) db.prepare('INSERT INTO school_selection_config (id) VALUES (1)').run();

  const systemLockExists = db.prepare('SELECT id FROM system_lock WHERE id=1').get();
  if (!systemLockExists) db.prepare('INSERT INTO system_lock (id) VALUES (1)').run();

  const canteenConfigExists = db.prepare('SELECT id FROM canteen_config WHERE id=1').get();
  if (!canteenConfigExists) db.prepare('INSERT INTO canteen_config (id) VALUES (1)').run();

  // Arabic subjects, seeded from a real Islamic secondary certificate report's subject list and
  // grouping — schools can rename, reorder, add, or remove any of these afterward.
  const arabicSubjectsSeeded = db.prepare('SELECT COUNT(*) c FROM arabic_subjects').get().c;
  if (arabicSubjectsSeeded === 0) {
    const arabicSubjects = [
      ['حفظ القرآن الكريم', 'Quran Memorization', 'Religious', 1],
      ['تلاوة القرآن الكريم', 'Quran Recitation', 'Religious', 2],
      ['التجويد', 'Tajweed', 'Religious', 3],
      ['التفسير', 'Tafsir', 'Religious', 4],
      ['التوحيد', 'Tawheed', 'Religious', 5],
      ['الحديث', 'Hadith', 'Religious', 6],
      ['الفقه', 'Fiqh', 'Religious', 7],
      ['أصول الفقه', 'Usul al-Fiqh', 'Religious', 8],
      ['الفرائض', "Fara'id", 'Religious', 9],
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
    const insArabicSubject = db.prepare('INSERT INTO arabic_subjects (name_ar, name_en, category, display_order) VALUES (?,?,?,?)');
    arabicSubjects.forEach(s => insArabicSubject.run(...s));
  }

  // A small, carefully-verified starter set of well-known schools from the official 2026 GES
  // register, so the School Database isn't empty on first use. This is NOT the full register
  // (900+ schools across Categories A/B/C, TVET, and Pilot Private) — schools should bulk-import
  // the complete official list via CSV under SHS School Selection > School Database, since GES
  // republishes it every year and hand-typing hundreds of rows risks introducing errors.
  const schoolsSeeded = db.prepare('SELECT COUNT(*) c FROM ges_schools').get().c;
  if (schoolsSeeded === 0) {
    const starterSchools = [
      ['0050108', 'Prempeh College', 'A', 'Ashanti', 'Kumasi Metro', 'Boys', 'Day/Boarding', 'SHS'],
      ['0050110', 'Opoku Ware School', 'A', 'Ashanti', 'Kumasi Metro', 'Boys', 'Day/Boarding', 'SHS'],
      ['0030101', "St. Augustine's College, Cape Coast", 'A', 'Central', 'Cape Coast Metro', 'Boys', 'Day/Boarding', 'SHS'],
      ['0030107', "Wesley Girls' High School, Cape Coast", 'A', 'Central', 'Cape Coast Metro', 'Girls', 'Day/Boarding', 'SHS'],
      ['0030104', 'Mfantsipim School', 'A', 'Central', 'Cape Coast Metro', 'Boys', 'Day/Boarding', 'SHTS'],
      ['0030103', 'Holy Child School, Cape Coast', 'A', 'Central', 'Cape Coast Metro', 'Girls', 'Day/Boarding', 'SHS'],
      ['0010121', 'Accra Academy', 'A', 'Gt. Accra', 'Accra Metro', 'Boys', 'Day/Boarding', 'SHS'],
      ['0010110', 'Achimota Senior High', 'A', 'Gt. Accra', 'Okaikwei North Municipal', 'Mixed', 'Day/Boarding', 'SHS'],
      ['0010111', "Presby Boys' Senior High, Legon", 'A', 'Gt. Accra', 'La Nkwantanang Madina Municipal', 'Boys', 'Day/Boarding', 'SHS'],
      ['0070102', 'Mawuli School, Ho', 'A', 'Volta', 'Ho Municipal', 'Mixed', 'Day/Boarding', 'SHTS'],
      ['0080101', 'Tamale Senior High', 'A', 'Northern', 'Sagnerigu Municipal', 'Mixed', 'Day/Boarding', 'SHTS'],
      ['0060104', 'Sunyani Senior High', 'A', 'Bono', 'Sunyani Municipal', 'Mixed', 'Day/Boarding', 'SHS'],
    ];
    const insSchool = db.prepare('INSERT INTO ges_schools (school_code, school_name, category, region, district, gender, day_boarding, sch_type) VALUES (?,?,?,?,?,?,?,?)');
    starterSchools.forEach(s => insSchool.run(...s));
  }

// BECE-style 9-point grading (Ghana Junior High School convention): 1 is the HIGHEST grade,
// 9 is the LOWEST — the reverse of A-F letter grading. Note: the real, official BECE national
// exam grade boundaries are set by WAEC using a norm-referenced "stanine" system based on how
// all candidates nationwide perform that year — they are NOT fixed percentages, and no school
// software can reproduce that calculation locally. The scale below is the fixed-percentage
// convention most Ghanaian JHS schools use for their own internal continuous assessment and
// mock exam reporting. Every boundary here is fully editable afterwards under
// Settings > Grading System, in case your school follows a different circular.
function seedBeceGrades() {
  db.exec('DELETE FROM grading_system');
  const grades = [
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
  const ins = db.prepare('INSERT INTO grading_system (grade, min_score, max_score, description, grade_point) VALUES (?,?,?,?,?)');
  for (const g of grades) ins.run(...g, null);
}

function migrateOldLetterGradesToBece() {
  const hasLetterGrades = db.prepare("SELECT COUNT(*) c FROM grading_system WHERE grade IN ('A','B','C','D','E','F')").get().c;
  if (hasLetterGrades > 0) seedBeceGrades();
}
migrateOldLetterGradesToBece();

// Adds the "Student" role (with results/attendance/fees/dashboard/forum access, scoped to their
// own record at the API layer) and the "forum" module permission row for any pre-existing role
// that doesn't have one yet — covers installs upgrading from before these features existed.
function migrateStudentRoleAndForum() {
  let studentRole = db.prepare("SELECT id FROM roles WHERE name='Student'").get();
  if (!studentRole) {
    db.prepare('INSERT INTO roles (name) VALUES (?)').run('Student');
    studentRole = db.prepare("SELECT id FROM roles WHERE name='Student'").get();
  }
  const allModules = ['dashboard','students','parents','teachers','staff','classes','subjects','academic_sessions','attendance','results','fees','bus','canteen','announcements','users','settings','audit_logs','backup','forum','messages','assignments','class_groups','exam_schedule','live_class_rooms'];
  const roles = db.prepare('SELECT id, name FROM roles').all();
  const insertPerm = db.prepare('INSERT INTO role_permissions (role_id, module, can_view, can_add, can_edit, can_delete, can_export) VALUES (?,?,?,?,?,?,?)');
  for (const role of roles) {
    for (const m of allModules) {
      const existing = db.prepare('SELECT 1 FROM role_permissions WHERE role_id=? AND module=?').get(role.id, m);
      if (existing) continue;
      let perms;
      if (role.name === 'Super Administrator') perms = [1,1,1,1,1];
      else if (['Headteacher', 'Headmistress'].includes(role.name)) perms = [1,1,1,1,1];
      else if (role.name === 'Teacher' && ['assignments','class_groups'].includes(m)) perms = [1,1,1,1,1];
      else if (role.name === 'Teacher' && m === 'forum') perms = [1,1,0,0,0];
      else if (role.name === 'Student') {
        perms = ['dashboard','students','attendance','results','fees','academic_sessions'].includes(m) ? [1,0,0,0,0]
              : ['forum','assignments'].includes(m) ? [1,1,0,0,0] : [0,0,0,0,0];
      } else perms = [0,0,0,0,0];
      insertPerm.run(role.id, m, ...perms);
    }
  }
  // Corrective fix: earlier versions of this migration didn't grant the Student role view access
  // to the 'students' module (blocking their own profile) or 'academic_sessions' (blocking the
  // term picker on their report card). This repairs any database that ran an older version.
  for (const moduleName of ['students', 'academic_sessions']) {
    const perm = db.prepare("SELECT can_view FROM role_permissions WHERE role_id=? AND module=?").get(studentRole.id, moduleName);
    if (perm && !perm.can_view) {
      db.prepare("UPDATE role_permissions SET can_view=1 WHERE role_id=? AND module=?").run(studentRole.id, moduleName);
    }
  }
}
migrateStudentRoleAndForum();

// Adds the "Canteen Collector" role (for existing installs that ran seed() before this role
// existed), grants Accountant/Bursar view+export on 'canteen' (to monitor collectors), and
// fills in the 'assigned_class_id' column on users used to scope a collector to their one class.
function migrateCanteenCollectorRole() {
  let role = db.prepare("SELECT id FROM roles WHERE name='Canteen Collector'").get();
  if (!role) {
    db.prepare('INSERT INTO roles (name) VALUES (?)').run('Canteen Collector');
    role = db.prepare("SELECT id FROM roles WHERE name='Canteen Collector'").get();
  }
  const allModules = ['dashboard','students','parents','teachers','staff','classes','subjects','academic_sessions','attendance','results','fees','bus','canteen','announcements','users','settings','audit_logs','backup','forum','messages','assignments','class_groups','exam_schedule','live_class_rooms'];
  for (const m of allModules) {
    const existing = db.prepare('SELECT 1 FROM role_permissions WHERE role_id=? AND module=?').get(role.id, m);
    if (existing) continue;
    const perms = ['canteen', 'dashboard'].includes(m) ? [1, 1, 0, 0, 0] : [0, 0, 0, 0, 0];
    db.prepare('INSERT INTO role_permissions (role_id, module, can_view, can_add, can_edit, can_delete, can_export) VALUES (?,?,?,?,?,?,?)').run(role.id, m, ...perms);
  }
  const accountantRole = db.prepare("SELECT id FROM roles WHERE name='Accountant/Bursar'").get();
  if (accountantRole) {
    const canteenPerm = db.prepare('SELECT * FROM role_permissions WHERE role_id=? AND module=?').get(accountantRole.id, 'canteen');
    if (!canteenPerm) {
      db.prepare('INSERT INTO role_permissions (role_id, module, can_view, can_add, can_edit, can_delete, can_export) VALUES (?,?,1,0,0,0,1)').run(accountantRole.id, 'canteen');
    } else if (!canteenPerm.can_view) {
      db.prepare('UPDATE role_permissions SET can_view=1, can_export=1 WHERE role_id=? AND module=?').run(accountantRole.id, 'canteen');
    }
  }
}
migrateCanteenCollectorRole();

// Adds the "Arabic Head Teacher" role (for existing installs that ran seed() before this role
// existed) and fills in the 'assigned_level' / 'linked_teacher_id' columns used to scope one
// to their own department level and to link a Teacher account to its teacher record.
function migrateArabicHeadTeacherRole() {
  let role = db.prepare("SELECT id FROM roles WHERE name='Arabic Head Teacher'").get();
  if (!role) {
    db.prepare('INSERT INTO roles (name) VALUES (?)').run('Arabic Head Teacher');
    role = db.prepare("SELECT id FROM roles WHERE name='Arabic Head Teacher'").get();
  }
  const allModules = ['dashboard','students','parents','teachers','staff','classes','subjects','academic_sessions','attendance','results','fees','bus','canteen','announcements','users','settings','audit_logs','backup','forum','messages','assignments','class_groups','exam_schedule','live_class_rooms'];
  for (const m of allModules) {
    const existing = db.prepare('SELECT 1 FROM role_permissions WHERE role_id=? AND module=?').get(role.id, m);
    if (existing) continue;
    const perms = ['teachers', 'results', 'dashboard'].includes(m) ? [1, 0, 0, 0, 0] : [0, 0, 0, 0, 0];
    db.prepare('INSERT INTO role_permissions (role_id, module, can_view, can_add, can_edit, can_delete, can_export) VALUES (?,?,?,?,?,?,?)').run(role.id, m, ...perms);
  }
}
migrateArabicHeadTeacherRole();

// Grants the Teacher role view+add on Announcements, and view-only on Academic Sessions
// (terms/years), for installs that were seeded before these were added. Without the latter,
// a teacher can't even open the Results page — it needs the term list to populate its dropdown,
// and a failed permission check there was silently bouncing teachers back to the Dashboard.
function migrateTeacherAnnouncementsPermission() {
  const role = db.prepare("SELECT id FROM roles WHERE name='Teacher'").get();
  if (!role) return;
  const grant = (module, canAdd) => {
    const existing = db.prepare('SELECT * FROM role_permissions WHERE role_id=? AND module=?').get(role.id, module);
    if (existing && existing.can_view) return; // already granted
    if (existing) {
      db.prepare('UPDATE role_permissions SET can_view=1, can_add=? WHERE role_id=? AND module=?').run(canAdd ? 1 : 0, role.id, module);
    } else {
      db.prepare('INSERT INTO role_permissions (role_id, module, can_view, can_add, can_edit, can_delete, can_export) VALUES (?,?,1,?,0,0,0)').run(role.id, module, canAdd ? 1 : 0);
    }
  };
  grant('announcements', true);
  grant('academic_sessions', false);
  grant('messages', true);
}
migrateTeacherAnnouncementsPermission();

// Grants the Student role view-only on Announcements for installs seeded before this was
// added — the Student menu has always shown an "Announcements" link, but without this the
// page silently bounced students back to the Dashboard on a 403.
function migrateStudentAnnouncementsPermission() {
  const role = db.prepare("SELECT id FROM roles WHERE name='Student'").get();
  if (!role) return;
  const existing = db.prepare('SELECT * FROM role_permissions WHERE role_id=? AND module=?').get(role.id, 'announcements');
  if (existing && existing.can_view) return;
  if (existing) {
    db.prepare('UPDATE role_permissions SET can_view=1 WHERE role_id=? AND module=?').run(role.id, 'announcements');
  } else {
    db.prepare('INSERT INTO role_permissions (role_id, module, can_view, can_add, can_edit, can_delete, can_export) VALUES (?,?,1,0,0,0,0)').run(role.id, 'announcements');
  }
}
migrateStudentAnnouncementsPermission();

// Grants Exam Schedule access to Teacher (full), Student and Parent/Guardian (view-only) for
// installs seeded before this module existed.
function migrateExamSchedulePermission() {
  const grantsByRole = { Teacher: [1, 1, 1, 1, 1], Student: [1, 0, 0, 0, 0], 'Parent/Guardian': [1, 0, 0, 0, 0] };
  for (const [roleName, perms] of Object.entries(grantsByRole)) {
    const role = db.prepare('SELECT id FROM roles WHERE name=?').get(roleName);
    if (!role) continue;
    const existing = db.prepare('SELECT * FROM role_permissions WHERE role_id=? AND module=?').get(role.id, 'exam_schedule');
    if (existing && existing.can_view) continue;
    if (existing) {
      db.prepare('UPDATE role_permissions SET can_view=?, can_add=?, can_edit=?, can_delete=?, can_export=? WHERE role_id=? AND module=?')
        .run(...perms, role.id, 'exam_schedule');
    } else {
      db.prepare('INSERT INTO role_permissions (role_id, module, can_view, can_add, can_edit, can_delete, can_export) VALUES (?,?,?,?,?,?,?)')
        .run(role.id, 'exam_schedule', ...perms);
    }
  }
}
migrateExamSchedulePermission();

// Grants Live Class Rooms access to Teacher (full) and Student (view-only, to see/join active
// rooms) for installs seeded before this module existed.
function migrateLiveClassRoomsPermission() {
  const grantsByRole = { Teacher: [1, 1, 1, 1, 1], Student: [1, 0, 0, 0, 0] };
  for (const [roleName, perms] of Object.entries(grantsByRole)) {
    const role = db.prepare('SELECT id FROM roles WHERE name=?').get(roleName);
    if (!role) continue;
    const existing = db.prepare('SELECT * FROM role_permissions WHERE role_id=? AND module=?').get(role.id, 'live_class_rooms');
    if (existing && existing.can_view) continue;
    if (existing) {
      db.prepare('UPDATE role_permissions SET can_view=?, can_add=?, can_edit=?, can_delete=?, can_export=? WHERE role_id=? AND module=?')
        .run(...perms, role.id, 'live_class_rooms');
    } else {
      db.prepare('INSERT INTO role_permissions (role_id, module, can_view, can_add, can_edit, can_delete, can_export) VALUES (?,?,?,?,?,?,?)')
        .run(role.id, 'live_class_rooms', ...perms);
    }
  }
}
migrateLiveClassRoomsPermission();

// Grants Non-teaching Staff and Parent/Guardian access to Announcements/Forum/Messages/Live
// Class Rooms for installs seeded before this was added — their portal dashboards already show
// cards for these, and without this migration those cards would 403 on click for anyone who
// set up their account before today, exactly like several earlier bugs this same session.
function migrateStaffParentCommsPermissions() {
  const grantsByRole = {
    'Non-teaching Staff': { forum: [1, 1, 0, 0, 0], messages: [1, 1, 0, 0, 0], announcements: [1, 0, 0, 0, 0] },
    'Parent/Guardian': { announcements: [1, 0, 0, 0, 0], forum: [1, 0, 0, 0, 0], live_class_rooms: [1, 0, 0, 0, 0], messages: [1, 1, 0, 0, 0], academic_sessions: [1, 0, 0, 0, 0] },
  };
  for (const [roleName, moduleGrants] of Object.entries(grantsByRole)) {
    const role = db.prepare('SELECT id FROM roles WHERE name=?').get(roleName);
    if (!role) continue;
    for (const [module, perms] of Object.entries(moduleGrants)) {
      const existing = db.prepare('SELECT * FROM role_permissions WHERE role_id=? AND module=?').get(role.id, module);
      if (existing && existing.can_view) continue;
      if (existing) {
        db.prepare('UPDATE role_permissions SET can_view=?, can_add=?, can_edit=?, can_delete=?, can_export=? WHERE role_id=? AND module=?')
          .run(...perms, role.id, module);
      } else {
        db.prepare('INSERT INTO role_permissions (role_id, module, can_view, can_add, can_edit, can_delete, can_export) VALUES (?,?,?,?,?,?,?)')
          .run(role.id, module, ...perms);
      }
    }
  }
}
migrateStaffParentCommsPermissions();

// Grants Student explicit view+add on Messages for installs seeded before this was added —
// messaging has always actually worked for students (it's checked through a self-scoped
// endpoint rather than the generic module permission), but the permission record itself never
// reflected that, which would have broken the new "only show a dashboard widget if the role
// truly has permission for it" safety check added alongside this.
function migrateStudentMessagesPermission() {
  const role = db.prepare("SELECT id FROM roles WHERE name='Student'").get();
  if (!role) return;
  const existing = db.prepare('SELECT * FROM role_permissions WHERE role_id=? AND module=?').get(role.id, 'messages');
  if (existing && existing.can_view) return;
  if (existing) {
    db.prepare('UPDATE role_permissions SET can_view=1, can_add=1 WHERE role_id=? AND module=?').run(role.id, 'messages');
  } else {
    db.prepare('INSERT INTO role_permissions (role_id, module, can_view, can_add, can_edit, can_delete, can_export) VALUES (?,?,1,1,0,0,0)').run(role.id, 'messages');
  }
}
migrateStudentMessagesPermission();

// Seeds sensible starting visibility for each role's portal dashboard widgets — an admin can
// still change any of this from Settings afterward. Only runs once per role (skips a role that
// already has any rows), so it never overwrites an admin's own configuration on re-run.
function seedRoleDashboardWidgets() {
  const defaultsByRole = {
    Student: { results: 1, fees: 1, 'live-class': 1, forum: 1, messages: 1, tasks: 1, announcements: 1 },
    Teacher: { results: 1, fees: 1, 'live-class': 1, forum: 1, messages: 1, tasks: 1, announcements: 1 },
    'Parent/Guardian': { results: 1, fees: 1, 'live-class': 0, forum: 1, messages: 0, tasks: 0, announcements: 1 },
    'Non-teaching Staff': { results: 0, fees: 0, 'live-class': 0, forum: 1, messages: 0, tasks: 1, announcements: 1 },
  };
  for (const [roleName, widgets] of Object.entries(defaultsByRole)) {
    const role = db.prepare('SELECT id FROM roles WHERE name=?').get(roleName);
    if (!role) continue;
    const existingCount = db.prepare('SELECT COUNT(*) c FROM role_dashboard_widgets WHERE role_id=?').get(role.id).c;
    if (existingCount > 0) continue;
    const insert = db.prepare('INSERT INTO role_dashboard_widgets (role_id, widget_key, visible) VALUES (?,?,?)');
    for (const [key, visible] of Object.entries(widgets)) insert.run(role.id, key, visible);
  }
}
seedRoleDashboardWidgets();

  const gradingCount = db.prepare('SELECT COUNT(*) c FROM grading_system').get().c;
  if (gradingCount === 0) {
    seedBeceGrades();
  }

  const yearCount = db.prepare('SELECT COUNT(*) c FROM academic_years').get().c;
  if (yearCount === 0) {
    db.prepare('INSERT INTO academic_years (name, start_date, end_date) VALUES (?,?,?)').run('2026/2027', '2026-09-01', '2027-07-31');
    const yearId = db.prepare('SELECT id FROM academic_years WHERE name=?').get('2026/2027').id;
    const insTerm = db.prepare('INSERT INTO terms (academic_year_id, name, start_date, end_date) VALUES (?,?,?,?)');
    insTerm.run(yearId, 'Term 1', '2026-09-01', '2026-12-12');
    insTerm.run(yearId, 'Term 2', '2027-01-05', '2027-04-02');
    insTerm.run(yearId, 'Term 3', '2027-04-20', '2027-07-31');
    const term1Id = db.prepare("SELECT id FROM terms WHERE name='Term 1' AND academic_year_id=?").get(yearId).id;
    db.prepare('UPDATE school_settings SET current_academic_year_id=?, current_term_id=? WHERE id=1').run(yearId, term1Id);
  }
}

seed();

function logAudit(user, action, module, details) {
  db.prepare('INSERT INTO audit_logs (user_id, username, action, module, details) VALUES (?,?,?,?,?)')
    .run(user ? user.id : null, user ? user.username : 'system', action, module || null, details ? JSON.stringify(details) : null);
}

// Generates sequential, human-readable IDs like "NIB/2026/001" or "ST/2026/014".
// The counter resets per calendar year and is tracked per id "type" so students and
// staff each get their own independent sequence even though both may share a prefix style.
// Prefix and digit-padding come from school_settings so admins can restyle the ID format
// without touching code (see Settings > ID Format in the app).
function generateSequentialId(prefix, type, year, digits) {
  digits = digits || 3;
  const row = db.prepare('SELECT next_seq FROM id_counters WHERE type=? AND year=?').get(type, year);
  let seq;
  if (row) {
    seq = row.next_seq;
    db.prepare('UPDATE id_counters SET next_seq=? WHERE type=? AND year=?').run(seq + 1, type, year);
  } else {
    seq = 1;
    db.prepare('INSERT INTO id_counters (type, year, next_seq) VALUES (?,?,?)').run(type, year, 2);
  }
  return `${prefix}/${year}/${String(seq).padStart(digits, '0')}`;
}

// Returns (creating if necessary) the QR token + PIN a person uses to check in/out.
// Generated lazily on first request rather than for every teacher/staff up front.
function getOrCreateCheckinCredential(personType, personId) {
  let row = db.prepare('SELECT * FROM checkin_credentials WHERE person_type=? AND person_id=?').get(personType, personId);
  if (row) return row;
  const token = crypto.randomBytes(16).toString('hex');
  const pin = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  db.prepare('INSERT INTO checkin_credentials (person_type, person_id, token, pin) VALUES (?,?,?,?)').run(personType, personId, token, pin);
  return db.prepare('SELECT * FROM checkin_credentials WHERE person_type=? AND person_id=?').get(personType, personId);
}

// A human-typeable unlock token (not security-sensitive like a password — the admin writes this
// down and re-enters it themselves later, so it's short letters+digits rather than a long hex string).
function generateUnlockToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid transcription mistakes
  let token = '';
  for (let i = 0; i < 10; i++) { if (i > 0 && i % 5 === 0) token += '-'; token += chars[crypto.randomInt(0, chars.length)]; }
  return token;
}

module.exports = { db, DB_PATH, DB_DIR, hashPassword, verifyPassword, logAudit, generateSequentialId, getOrCreateCheckinCredential, generateUnlockToken };
