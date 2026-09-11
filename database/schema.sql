CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name varchar(180) NOT NULL,
  school_type varchar(40) NOT NULL DEFAULT 'secondary',
  school_logo text,
  school_address text,
  city varchar(100),
  country varchar(100),
  phone varchar(40),
  email varchar(180),
  website varchar(180),
  motto varchar(240),
  registration_number varchar(100),
  brand_colors jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS school_type varchar(40) NOT NULL DEFAULT 'secondary';

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(80) NOT NULL UNIQUE,
  description text
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  role_id uuid REFERENCES roles(id),
  email varchar(180) NOT NULL,
  password_hash text NOT NULL,
  full_name varchar(180) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (organization_id, email)
);

CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid REFERENCES users(id),
  staff_number varchar(80),
  full_name varchar(180) NOT NULL,
  position varchar(120),
  department varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name varchar(100) NOT NULL,
  stream varchar(100),
  academic_year varchar(20) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (organization_id, name, stream, academic_year)
);

CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name varchar(140) NOT NULL,
  code varchar(40),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  class_id uuid REFERENCES classes(id),
  student_number varchar(80) NOT NULL,
  student_id varchar(80),
  admission_number varchar(80),
  full_name varchar(180) NOT NULL,
  first_name varchar(120),
  middle_name varchar(120),
  last_name varchar(120),
  gender varchar(30) DEFAULT 'prefer-not-to-say',
  date_of_birth date,
  nationality varchar(80),
  status varchar(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','transferred','graduated','suspended','archived')),
  academic_year varchar(20),
  admission_date date,
  parent_name varchar(180),
  parent_phone varchar(40),
  parent_email varchar(180),
  parent_relationship varchar(80),
  photo_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (organization_id, student_number),
  UNIQUE (organization_id, student_id),
  UNIQUE (organization_id, admission_number)
);

CREATE TABLE IF NOT EXISTS student_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  student_id uuid NOT NULL REFERENCES students(id),
  document_name varchar(180) NOT NULL,
  file_name varchar(220) NOT NULL,
  file_type varchar(80),
  file_size integer,
  uploaded_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  student_id uuid NOT NULL REFERENCES students(id),
  attendance_date date NOT NULL,
  status varchar(20) NOT NULL CHECK (status IN ('present','absent','late','excused','left_school')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS digital_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  student_id uuid NOT NULL REFERENCES students(id),
  verification_token_hash varchar(64) NOT NULL UNIQUE,
  status varchar(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','lost','stolen','expired','deactivated')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  student_id uuid REFERENCES students(id),
  invoice_number varchar(80) NOT NULL,
  description varchar(240) NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  balance numeric(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  status varchar(30) NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','part_paid','paid','cancelled')),
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS class_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  staff_id uuid NOT NULL REFERENCES staff(id),
  class_id uuid NOT NULL REFERENCES classes(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, class_id)
);

CREATE TABLE IF NOT EXISTS parent_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  parent_user_id uuid NOT NULL REFERENCES users(id),
  student_id uuid NOT NULL REFERENCES students(id),
  relationship varchar(60),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_user_id, student_id)
);

CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  invited_by uuid NOT NULL REFERENCES users(id),
  email varchar(180) NOT NULL,
  role varchar(80) NOT NULL,
  token_hash varchar(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  actor_user_id uuid REFERENCES users(id),
  action varchar(120) NOT NULL,
  entity_type varchar(80) NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  student_id uuid NOT NULL REFERENCES students(id),
  full_name varchar(180) NOT NULL,
  relationship varchar(80) NOT NULL,
  phone varchar(40) NOT NULL,
  email varchar(180),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  full_name varchar(180) NOT NULL,
  phone varchar(40),
  email varchar(180),
  identification_number varchar(120),
  purpose varchar(240) NOT NULL,
  host_user_id uuid REFERENCES users(id),
  status varchar(30) NOT NULL DEFAULT 'checked_in' CHECK (status IN ('expected','checked_in','checked_out','blocked')),
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS visitor_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  visitor_id uuid NOT NULL REFERENCES visitors(id),
  pass_code varchar(80) NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked','returned')),
  issued_by uuid REFERENCES users(id),
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  UNIQUE (organization_id, pass_code)
);

CREATE TABLE IF NOT EXISTS entry_exit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  student_id uuid REFERENCES students(id),
  visitor_id uuid REFERENCES visitors(id),
  recorded_by uuid REFERENCES users(id),
  direction varchar(10) NOT NULL CHECK (direction IN ('entry','exit')),
  reason varchar(240),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CHECK (student_id IS NOT NULL OR visitor_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS book_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name varchar(120) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  category_id uuid REFERENCES book_categories(id),
  title varchar(240) NOT NULL,
  author varchar(180),
  isbn varchar(40),
  copies_total integer NOT NULL DEFAULT 1 CHECK (copies_total >= 0),
  copies_available integer NOT NULL DEFAULT 1 CHECK (copies_available >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS book_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  book_id uuid NOT NULL REFERENCES books(id),
  borrower_user_id uuid REFERENCES users(id),
  borrower_student_id uuid REFERENCES students(id),
  issued_by uuid REFERENCES users(id),
  issued_at timestamptz NOT NULL DEFAULT now(),
  due_at date NOT NULL,
  returned_at timestamptz,
  CHECK (borrower_user_id IS NOT NULL OR borrower_student_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  class_id uuid REFERENCES classes(id),
  subject_id uuid REFERENCES subjects(id),
  created_by uuid REFERENCES users(id),
  title varchar(240) NOT NULL,
  description text,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  class_id uuid REFERENCES classes(id),
  subject_id uuid REFERENCES subjects(id),
  created_by uuid REFERENCES users(id),
  title varchar(240) NOT NULL,
  assessment_date date,
  max_score numeric(8,2) NOT NULL DEFAULT 100 CHECK (max_score > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  assessment_id uuid NOT NULL REFERENCES assessments(id),
  student_id uuid NOT NULL REFERENCES students(id),
  score numeric(8,2) NOT NULL CHECK (score >= 0),
  feedback text,
  recorded_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, student_id)
);

CREATE TABLE IF NOT EXISTS timetables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  class_id uuid REFERENCES classes(id),
  subject_id uuid REFERENCES subjects(id),
  teacher_user_id uuid REFERENCES users(id),
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  room varchar(80),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  created_by uuid REFERENCES users(id),
  title varchar(240) NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  location varchar(180),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  student_id uuid NOT NULL REFERENCES students(id),
  issued_by uuid REFERENCES users(id),
  certificate_type varchar(120) NOT NULL,
  certificate_number varchar(100) NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, certificate_number)
);

CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  author_user_id uuid REFERENCES users(id),
  title varchar(240) NOT NULL,
  body text NOT NULL,
  audience varchar(40) NOT NULL DEFAULT 'school',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  sender_user_id uuid NOT NULL REFERENCES users(id),
  recipient_user_id uuid NOT NULL REFERENCES users(id),
  subject varchar(240) NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  assigned_to uuid REFERENCES users(id),
  created_by uuid REFERENCES users(id),
  title varchar(240) NOT NULL,
  description text,
  status varchar(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','cancelled')),
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  registration_number varchar(80) NOT NULL,
  vehicle_type varchar(80),
  capacity integer CHECK (capacity > 0),
  status varchar(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active','maintenance','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, registration_number)
);

CREATE TABLE IF NOT EXISTS drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid REFERENCES users(id),
  full_name varchar(180) NOT NULL,
  phone varchar(40),
  licence_number varchar(100),
  status varchar(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name varchar(160) NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS transport_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  route_id uuid NOT NULL REFERENCES routes(id),
  student_id uuid NOT NULL REFERENCES students(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_id, student_id)
);

CREATE TABLE IF NOT EXISTS trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  route_id uuid REFERENCES routes(id),
  vehicle_id uuid REFERENCES vehicles(id),
  driver_id uuid REFERENCES drivers(id),
  trip_date date NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  invoice_id uuid REFERENCES invoices(id),
  recorded_by uuid REFERENCES users(id),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method varchar(40),
  reference varchar(120),
  paid_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  plan_name varchar(120) NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'active' CHECK (status IN ('trial','active','past_due','cancelled')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_students_org ON students(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_students_status ON students(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_students_admission ON students(organization_id, admission_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(organization_id, student_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_staff_org ON staff(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_classes_org ON classes(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_subjects_org ON subjects(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_org_date ON attendance(organization_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_digital_ids_org_status ON digital_ids(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_org_status ON invoices(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_class_teachers_staff ON class_teachers(staff_id);
CREATE INDEX IF NOT EXISTS idx_parent_students_parent ON parent_students(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitors_org_status ON visitors(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entry_exit_org_time ON entry_exit_logs(organization_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_student ON emergency_contacts(student_id);
CREATE INDEX IF NOT EXISTS idx_book_loans_org_due ON book_loans(organization_id, due_at);
CREATE INDEX IF NOT EXISTS idx_assignments_org_due ON assignments(organization_id, due_at);
CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_events_org_start ON events(organization_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_announcements_org_published ON announcements(organization_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_status ON tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_trips_org_date ON trips(organization_id, trip_date);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);

INSERT INTO roles (name, description) VALUES
  ('super_admin', 'Full platform administration access'),
  ('school_admin', 'Full school administration access'),
  ('head_teacher', 'School performance and academic oversight'),
  ('class_teacher', 'Attendance and academic access for assigned classes'),
  ('finance', 'Fees, invoices, payments, and finance reports'),
  ('teacher', 'Classroom and academic access'),
  ('librarian', 'Library operations access'),
  ('transport_manager', 'Transport operations access'),
  ('receptionist', 'Front desk and visitor access'),
  ('staff', 'Operational staff access'),
  ('parent', 'Guardian portal access'),
  ('student', 'Student portal access')
ON CONFLICT (name) DO NOTHING;
