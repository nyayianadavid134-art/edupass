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
  full_name varchar(180) NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','graduated','transferred')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (organization_id, student_number)
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

CREATE INDEX IF NOT EXISTS idx_students_org ON students(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_staff_org ON staff(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_classes_org ON classes(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_subjects_org ON subjects(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_org_date ON attendance(organization_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_digital_ids_org_status ON digital_ids(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_org_status ON invoices(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_class_teachers_staff ON class_teachers(staff_id);
CREATE INDEX IF NOT EXISTS idx_parent_students_parent ON parent_students(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON audit_logs(organization_id, created_at DESC);

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
