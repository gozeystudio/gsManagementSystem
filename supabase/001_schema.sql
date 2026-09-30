-- Nibras School Management System — multi-tenant Postgres schema for Supabase.
-- Converted from db.js's SQLite schema. Every table except `schools` itself carries a
-- school_id column referencing schools(id), so each school's data is fully isolated —
-- this is the "folder" a school's records live in, enforced at the database level via
-- foreign keys (and, in Phase 2+, checked on every query in the app layer too).
--
-- Conventions carried over from the SQLite version to minimize app-layer changes:
--   * booleans stay INTEGER (0/1), matching how the existing JS code reads them
--   * REAL -> DOUBLE PRECISION
--   * "datetime('now')" defaults reproduce the exact same 'YYYY-MM-DD HH24:MI:SS' UTC string
--     SQLite produced, so date-parsing code elsewhere doesn't need to change
--   * TEXT primary/foreign keys stay TEXT; numeric autoincrement ids become SERIAL
--   * per-installation "singleton" tables (CHECK (id=1) in SQLite) become one-row-per-school,
--     keyed directly by school_id as the primary key

-- ============================== Tenancy ==============================
CREATE TABLE IF NOT EXISTS schools (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,              -- the "folder" identifier, e.g. used in URLs
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================== Core / RBAC ==============================
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE(school_id, name)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  can_view INTEGER DEFAULT 0,
  can_add INTEGER DEFAULT 0,
  can_edit INTEGER DEFAULT 0,
  can_delete INTEGER DEFAULT 0,
  can_export INTEGER DEFAULT 0,
  PRIMARY KEY (role_id, module)
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  linked_teacher_id INTEGER,
  linked_parent_id INTEGER,
  linked_student_id INTEGER,
  linked_staff_id INTEGER,
  assigned_class_id INTEGER,
  assigned_level TEXT,
  dashboard_prefs TEXT,
  last_notifications_seen_at TEXT,
  status TEXT DEFAULT 'Active',
  photo TEXT,
  created_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'),
  UNIQUE(school_id, username)
);

-- ============================== Academic structure ==============================
CREATE TABLE IF NOT EXISTS academic_years (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date TEXT, end_date TEXT,
  UNIQUE(school_id, name)
);

CREATE TABLE IF NOT EXISTS terms (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id INTEGER NOT NULL REFERENCES academic_years(id),
  name TEXT NOT NULL,
  start_date TEXT, end_date TEXT,
  pass_mark DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  level TEXT,
  class_teacher_id INTEGER,
  academic_year_id INTEGER,
  UNIQUE(school_id, name, academic_year_id)
);

CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  department TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS teacher_subjects (
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  PRIMARY KEY (teacher_id, subject_id)
);

CREATE TABLE IF NOT EXISTS teacher_classes (
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL,
  class_id INTEGER NOT NULL,
  PRIMARY KEY (teacher_id, class_id)
);

-- ============================== People ==============================
CREATE TABLE IF NOT EXISTS teachers (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  staff_id TEXT,
  full_name TEXT NOT NULL,
  gender TEXT, dob TEXT, phone TEXT, email TEXT, address TEXT,
  qualification TEXT, specialization TEXT, employment_date TEXT,
  employment_type TEXT, department TEXT,
  status TEXT DEFAULT 'Active',
  photo TEXT,
  salary DOUBLE PRECISION,
  teacher_level TEXT,
  teaching_language TEXT DEFAULT 'English',
  UNIQUE(school_id, staff_id)
);

CREATE TABLE IF NOT EXISTS staff (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  staff_id TEXT,
  full_name TEXT NOT NULL,
  gender TEXT, phone TEXT, address TEXT,
  position TEXT, department TEXT,
  employment_date TEXT, employment_status TEXT DEFAULT 'Active',
  emergency_contact TEXT, photo TEXT,
  salary DOUBLE PRECISION,
  UNIQUE(school_id, staff_id)
);

CREATE TABLE IF NOT EXISTS parents_guardians (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  gender TEXT, phone TEXT, alt_phone TEXT, email TEXT,
  occupation TEXT, address TEXT,
  status TEXT DEFAULT 'Alive',
  preferred_contact TEXT,
  pta_member INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  admission_number TEXT,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  gender TEXT, dob TEXT, place_of_birth TEXT, nationality TEXT, religion TEXT,
  previous_school TEXT, admission_date TEXT, photo TEXT,
  academic_year_id INTEGER, class_id INTEGER, stream TEXT, section TEXT, house TEXT,
  status TEXT DEFAULT 'Active',
  orphan_status TEXT DEFAULT 'Non-Orphan',
  caregiver_info TEXT,
  uses_bus INTEGER DEFAULT 0,
  bus_id INTEGER, pickup_point TEXT, dropoff_point TEXT, transport_fee DOUBLE PRECISION,
  pays_canteen INTEGER DEFAULT 0,
  canteen_plan TEXT, canteen_amount DOUBLE PRECISION,
  emergency_contact_name TEXT, emergency_contact_phone TEXT, emergency_relationship TEXT,
  medical_info TEXT, allergies TEXT, special_needs TEXT, additional_notes TEXT,
  boarding_status TEXT DEFAULT 'Day',
  scholarship_status TEXT DEFAULT 'None',
  blood_group TEXT,
  sponsor_name TEXT, sponsor_contact TEXT, sponsor_organization TEXT,
  created_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'),
  UNIQUE(school_id, student_id),
  UNIQUE(school_id, admission_number)
);

CREATE TABLE IF NOT EXISTS student_parents (
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL,
  parent_id INTEGER NOT NULL,
  PRIMARY KEY (student_id, parent_id)
);

-- ============================== Attendance / Assessment ==============================
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL,
  class_id INTEGER,
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  remarks TEXT,
  marked_by INTEGER,
  UNIQUE(school_id, student_id, date)
);

CREATE TABLE IF NOT EXISTS grading_system (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  grade TEXT NOT NULL,
  min_score DOUBLE PRECISION NOT NULL,
  max_score DOUBLE PRECISION NOT NULL,
  description TEXT,
  grade_point DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS continuous_assessment (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  class_id INTEGER,
  academic_year_id INTEGER,
  term_id INTEGER NOT NULL,
  class_exercise DOUBLE PRECISION DEFAULT 0,
  class_test DOUBLE PRECISION DEFAULT 0,
  group_work DOUBLE PRECISION DEFAULT 0,
  project_work DOUBLE PRECISION DEFAULT 0,
  exam_score DOUBLE PRECISION DEFAULT 0,
  teacher_comment TEXT,
  entered_by INTEGER,
  updated_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'),
  UNIQUE(school_id, student_id, subject_id, term_id)
);

-- ============================== Fees ==============================
CREATE TABLE IF NOT EXISTS fee_types (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_amount DOUBLE PRECISION,
  category TEXT DEFAULT 'General',
  UNIQUE(school_id, name)
);

CREATE TABLE IF NOT EXISTS fees (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL,
  fee_type_id INTEGER NOT NULL,
  academic_year_id INTEGER,
  term_id INTEGER,
  amount_due DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS fee_payments (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  fee_id INTEGER NOT NULL,
  amount_paid DOUBLE PRECISION NOT NULL,
  payment_date TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'),
  payment_method TEXT,
  receipt_number TEXT,
  recorded_by INTEGER
);

CREATE TABLE IF NOT EXISTS momo_transactions (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  fee_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  phone TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  momo_financial_transaction_id TEXT,
  failure_reason TEXT,
  initiated_by INTEGER,
  created_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'),
  updated_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'),
  UNIQUE(school_id, reference_id)
);

CREATE TABLE IF NOT EXISTS expenditures (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT,
  amount DOUBLE PRECISION NOT NULL,
  expense_date TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD'),
  recorded_by INTEGER,
  paid_to_type TEXT, paid_to_id INTEGER, pay_period TEXT,
  created_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS income_targets (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL,
  target_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'),
  UNIQUE(school_id, period_type)
);

CREATE TABLE IF NOT EXISTS weekly_targets (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  week_number INTEGER,
  week_start_date TEXT NOT NULL,
  target_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
);

-- ============================== Files ==============================
CREATE TABLE IF NOT EXISTS student_documents (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT,
  description TEXT,
  uploaded_by INTEGER,
  uploaded_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS class_shared_files (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT,
  description TEXT,
  shared_by INTEGER,
  shared_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS custom_fonts (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  font_key TEXT NOT NULL,
  family_name TEXT NOT NULL,
  filename TEXT NOT NULL,
  uploaded_by INTEGER,
  created_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'),
  UNIQUE(school_id, font_key)
);

-- ============================== Bus / Comms / Audit ==============================
CREATE TABLE IF NOT EXISTS buses (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  bus_number TEXT NOT NULL,
  registration_number TEXT,
  driver_name TEXT,
  route TEXT,
  capacity INTEGER,
  status TEXT DEFAULT 'Active',
  UNIQUE(school_id, bus_number)
);

CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT DEFAULT 'All',
  posted_by INTEGER,
  attachment TEXT, attachment_name TEXT,
  posted_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id INTEGER,
  username TEXT,
  action TEXT NOT NULL,
  module TEXT,
  details TEXT,
  created_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS backups (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  created_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'),
  created_by INTEGER
);

CREATE TABLE IF NOT EXISTS id_counters (
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  year INTEGER NOT NULL,
  next_seq INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (school_id, type, year)
);

-- ============================== Timetable ==============================
CREATE TABLE IF NOT EXISTS timetable_config (
  school_id INTEGER PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  periods_per_day INTEGER NOT NULL DEFAULT 8,
  periods_per_day_json TEXT,
  weekdays TEXT NOT NULL DEFAULT 'Monday,Tuesday,Wednesday,Thursday,Friday',
  period_length_minutes INTEGER NOT NULL DEFAULT 40,
  school_start_time TEXT NOT NULL DEFAULT '08:00',
  break_time TEXT DEFAULT '10:00', break_duration_minutes INTEGER DEFAULT 20,
  lunch_time TEXT DEFAULT '12:30', lunch_duration_minutes INTEGER DEFAULT 45,
  prayer_time TEXT DEFAULT '12:00', prayer_duration_minutes INTEGER DEFAULT 15,
  closing_time TEXT DEFAULT '15:00'
);

CREATE TABLE IF NOT EXISTS timetable_entries (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL,
  weekday TEXT NOT NULL,
  period_number INTEGER NOT NULL,
  subject_id INTEGER,
  teacher_id INTEGER,
  UNIQUE(school_id, class_id, weekday, period_number)
);

CREATE TABLE IF NOT EXISTS duty_roster (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  weekday TEXT NOT NULL,
  duty_name TEXT NOT NULL DEFAULT 'General Duty',
  teacher_id INTEGER,
  notes TEXT
);

-- ============================== Forum ==============================
CREATE TABLE IF NOT EXISTS forum_topics (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  class_id INTEGER,
  subject_id INTEGER,
  audience TEXT DEFAULT 'All',
  created_by INTEGER,
  created_by_name TEXT,
  created_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS forum_messages (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  topic_id INTEGER NOT NULL,
  author_id INTEGER,
  author_name TEXT,
  author_role TEXT,
  body TEXT NOT NULL,
  attachment TEXT, attachment_name TEXT,
  created_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
);

-- ============================== Check-in / Attendance kiosks ==============================
CREATE TABLE IF NOT EXISTS staff_checkin_config (
  school_id INTEGER PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  standard_start_time TEXT NOT NULL DEFAULT '08:00',
  standard_end_time TEXT NOT NULL DEFAULT '16:00'
);

CREATE TABLE IF NOT EXISTS checkin_credentials (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  person_type TEXT NOT NULL,
  person_id INTEGER NOT NULL,
  token TEXT NOT NULL,
  pin TEXT,
  UNIQUE(person_type, person_id),
  UNIQUE(token)
);

CREATE TABLE IF NOT EXISTS staff_attendance (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  person_type TEXT NOT NULL,
  person_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  check_in_time TEXT,
  check_out_time TEXT,
  method TEXT,
  photo TEXT, checkout_photo TEXT,
  UNIQUE(school_id, person_type, person_id, date)
);

CREATE TABLE IF NOT EXISTS student_checkins (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  check_in_time TEXT,
  check_out_time TEXT,
  method TEXT DEFAULT 'Barcode',
  UNIQUE(school_id, student_id, date)
);

CREATE TABLE IF NOT EXISTS visitor_checkins (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  purpose TEXT,
  date TEXT NOT NULL,
  check_in_time TEXT,
  check_out_time TEXT,
  photo TEXT
);

-- ============================== Messaging / Assignments ==============================
CREATE TABLE IF NOT EXISTS direct_messages (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL,
  recipient_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'),
  read_at TEXT
);

CREATE TABLE IF NOT EXISTS assignments (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Assignment',
  class_id INTEGER,
  subject_id INTEGER,
  instructions TEXT,
  due_date TEXT,
  created_by INTEGER,
  created_by_name TEXT,
  created_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS assignment_questions (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  assignment_id INTEGER NOT NULL,
  question_number INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'text',
  options TEXT,
  correct_option INTEGER,
  marks DOUBLE PRECISION DEFAULT 1
);

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  assignment_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  submitted_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'),
  UNIQUE(assignment_id, student_id)
);

CREATE TABLE IF NOT EXISTS assignment_answers (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  submission_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  answer_text TEXT,
  marks_awarded DOUBLE PRECISION,
  teacher_feedback TEXT,
  UNIQUE(submission_id, question_id)
);

-- ============================== Class Groups ==============================
CREATE TABLE IF NOT EXISTS class_groups (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS class_group_members (
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  PRIMARY KEY (group_id, student_id)
);

CREATE TABLE IF NOT EXISTS group_tasks (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL DEFAULT 'One-time',
  created_by INTEGER,
  created_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
);

-- ============================== Exam schedule / Live classes ==============================
CREATE TABLE IF NOT EXISTS exam_schedule (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  term_id INTEGER,
  exam_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  venue TEXT,
  notes TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS live_class_rooms (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL,
  subject_id INTEGER,
  teacher_id INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT 'Live Class',
  status TEXT NOT NULL DEFAULT 'active',
  started_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'),
  ended_at TEXT,
  created_by INTEGER
);

CREATE TABLE IF NOT EXISTS live_class_participants (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  room_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  student_id INTEGER,
  display_name TEXT,
  joined_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'),
  left_at TEXT
);

CREATE TABLE IF NOT EXISTS live_class_signals (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  room_id INTEGER NOT NULL,
  from_user_id INTEGER NOT NULL,
  to_user_id INTEGER NOT NULL,
  signal_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
);

-- ============================== Invites / widgets / tasks ==============================
CREATE TABLE IF NOT EXISTS teacher_invites (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  created_by INTEGER,
  used_at TEXT,
  used_by_teacher_id INTEGER,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'),
  UNIQUE(token)
);

CREATE TABLE IF NOT EXISTS role_dashboard_widgets (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL,
  widget_key TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1,
  UNIQUE(role_id, widget_key)
);

CREATE TABLE IF NOT EXISTS student_tasks (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL DEFAULT 'One-time',
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  created_by INTEGER,
  created_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
);

-- ============================== School Selection (GES/CSSPS) ==============================
CREATE TABLE IF NOT EXISTS school_selection_config (
  school_id INTEGER PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  max_choices INTEGER NOT NULL DEFAULT 8,
  max_category_a INTEGER NOT NULL DEFAULT 2,
  max_category_b INTEGER NOT NULL DEFAULT 3
);

CREATE TABLE IF NOT EXISTS school_selections (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL,
  index_number TEXT,
  residential_location TEXT,
  choices TEXT,
  programme_preferences TEXT,
  other_programme TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  parent_signed_off INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'),
  UNIQUE(school_id, student_id)
);

CREATE TABLE IF NOT EXISTS ges_schools (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  school_code TEXT NOT NULL,
  school_name TEXT NOT NULL,
  category TEXT NOT NULL,
  region TEXT, district TEXT, gender TEXT,
  day_boarding TEXT,
  sch_type TEXT,
  programmes TEXT,
  UNIQUE(school_id, school_code)
);

-- ============================== System ==============================
CREATE TABLE IF NOT EXISTS system_lock (
  school_id INTEGER PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  expiry_date TEXT,
  token TEXT,
  lock_message TEXT DEFAULT 'This system''s access period has ended. Please contact your administrator.'
);

CREATE TABLE IF NOT EXISTS canteen_config (
  school_id INTEGER PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  daily_amount DOUBLE PRECISION NOT NULL DEFAULT 5,
  weekdays TEXT NOT NULL DEFAULT 'Monday,Tuesday,Wednesday,Thursday,Friday'
);

CREATE TABLE IF NOT EXISTS canteen_payments (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL,
  class_id INTEGER,
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  amount DOUBLE PRECISION,
  marked_by INTEGER,
  UNIQUE(school_id, student_id, date)
);

-- ============================== Arabic ==============================
CREATE TABLE IF NOT EXISTS arabic_subjects (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  category TEXT NOT NULL DEFAULT 'Religious',
  max_score DOUBLE PRECISION NOT NULL DEFAULT 100,
  min_pass_score DOUBLE PRECISION NOT NULL DEFAULT 50,
  display_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS arabic_results (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL,
  arabic_subject_id INTEGER NOT NULL,
  term_id INTEGER NOT NULL,
  academic_year_id INTEGER,
  score_obtained DOUBLE PRECISION,
  remarks TEXT,
  entered_by INTEGER,
  UNIQUE(school_id, student_id, arabic_subject_id, term_id)
);

CREATE TABLE IF NOT EXISTS class_termly_reports (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL,
  term_id INTEGER NOT NULL,
  academic_year_id INTEGER,
  report_text TEXT,
  written_by INTEGER,
  updated_at TEXT DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'),
  UNIQUE(school_id, class_id, term_id)
);

-- ============================== School Settings ==============================
-- One row per school (school_id is the primary key), covering every column added over the
-- SQLite version's lifetime via its ALTER TABLE migrations.
CREATE TABLE IF NOT EXISTS school_settings (
  school_id INTEGER PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  school_name TEXT NOT NULL DEFAULT 'Nibras Educational Complex',
  motto TEXT NOT NULL DEFAULT 'Knowledge is Light',
  address TEXT, phone TEXT, email TEXT,
  current_academic_year_id INTEGER,
  current_term_id INTEGER,
  location TEXT,
  logo_photo TEXT,
  dashboard_background_photo TEXT,
  student_id_prefix TEXT DEFAULT 'NIB',
  staff_id_prefix TEXT DEFAULT 'ST',
  id_seq_digits INTEGER DEFAULT 3,
  ca_c1_name TEXT DEFAULT 'Class Exercise', ca_c1_max DOUBLE PRECISION DEFAULT 15,
  ca_c2_name TEXT DEFAULT 'Class Test', ca_c2_max DOUBLE PRECISION DEFAULT 15,
  ca_c3_name TEXT DEFAULT 'Group Work', ca_c3_max DOUBLE PRECISION DEFAULT 15,
  ca_c4_name TEXT DEFAULT 'Project Work', ca_c4_max DOUBLE PRECISION DEFAULT 15,
  exam_max DOUBLE PRECISION DEFAULT 100,
  ca_weight_percent DOUBLE PRECISION DEFAULT 50,
  exam_weight_percent DOUBLE PRECISION DEFAULT 50,
  backup_email TEXT,
  smtp_host TEXT, smtp_port INTEGER DEFAULT 587, smtp_secure INTEGER DEFAULT 0,
  smtp_username TEXT, smtp_password TEXT,
  auto_backup_email_enabled INTEGER DEFAULT 0,
  last_auto_backup_sent_date TEXT,
  last_auto_backup_status TEXT,
  report_header_align TEXT DEFAULT 'center',
  report_header_extra TEXT,
  nav_theme TEXT DEFAULT 'navy-gold',
  page_theme TEXT DEFAULT 'default',
  nav_font_size TEXT DEFAULT 'medium',
  app_font_family TEXT DEFAULT 'default',
  arabic_report_font TEXT DEFAULT 'default',
  cursor_style TEXT DEFAULT 'default',
  ui_font_scale TEXT DEFAULT 'medium',
  custom_accent_color TEXT,
  custom_bg_color TEXT,
  id_card_color TEXT DEFAULT 'navy-gold',
  id_card_show_dob INTEGER DEFAULT 1,
  id_card_show_blood_group INTEGER DEFAULT 0,
  id_card_show_contact INTEGER DEFAULT 0,
  momo_subscription_key TEXT, momo_api_user TEXT, momo_api_key TEXT,
  momo_target_environment TEXT DEFAULT 'sandbox',
  momo_base_url TEXT DEFAULT 'https://sandbox.momodeveloper.mtn.com',
  momo_callback_host TEXT,
  custom_connect_url TEXT,
  login_background TEXT,
  lock_pin_hash TEXT, lock_pin_salt TEXT, lock_enabled INTEGER DEFAULT 0,
  custom_backup_folder TEXT
);
