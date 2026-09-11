const crypto = require('crypto');
const { query } = require('./db');

const roleLabels = {
  super_admin: 'Super administrator',
  school_admin: 'School administrator',
  head_teacher: 'Head teacher / principal',
  class_teacher: 'Class teacher',
  finance: 'Finance officer',
  teacher: 'Teacher',
  librarian: 'Librarian',
  transport_manager: 'Transport manager',
  receptionist: 'Receptionist / front desk',
  staff: 'Staff member',
  parent: 'Parent / guardian',
  student: 'Student',
};

const rolePermissions = {
  super_admin: ['platform.dashboard', 'platform.schools', 'platform.subscriptions', 'platform.payments', 'platform.users', 'platform.analytics', 'platform.support', 'platform.settings', 'audit.view'],
  school_admin: ['dashboard.school', 'students.view', 'students.create', 'students.update', 'staff.view', 'classes.manage', 'academics.view', 'attendance.view', 'attendance.create', 'digital_ids.view', 'digital_ids.create', 'finance.view', 'finance.create', 'communication.send', 'reports.view', 'school.settings', 'subscription.view', 'audit.view', 'users.invite'],
  head_teacher: ['dashboard.head_teacher', 'students.view', 'classes.view', 'staff.view', 'academics.view', 'attendance.view', 'reports.view', 'communication.send', 'events.view', 'certificates.view'],
  class_teacher: ['dashboard.teacher', 'classes.assigned', 'students.assigned.view', 'attendance.assigned.view', 'attendance.assigned.create', 'assignments.manage', 'assessments.manage', 'grades.manage', 'timetable.assigned.view', 'communication.class.send', 'profile.view'],
  teacher: ['dashboard.teacher', 'classes.assigned', 'students.assigned.view', 'attendance.assigned.view', 'attendance.assigned.create', 'assignments.manage', 'assessments.manage', 'grades.manage', 'timetable.assigned.view', 'communication.class.send', 'profile.view'],
  finance: ['dashboard.finance', 'finance.view', 'finance.create', 'finance.payments.create', 'finance.receipts.create', 'finance.reports.view'],
  librarian: ['dashboard.library', 'library.books.manage', 'library.borrowing.manage', 'students.lookup', 'library.reports.view'],
  transport_manager: ['dashboard.transport', 'transport.manage', 'students.lookup', 'transport.reports.view'],
  receptionist: ['dashboard.reception', 'digital_ids.verify', 'visitors.manage', 'students.lookup', 'entry_exit.manage'],
  staff: ['dashboard.staff', 'attendance.view', 'communication.view', 'profile.view'],
  parent: ['dashboard.parent', 'children.own.view', 'attendance.own.view', 'academics.own.view', 'assignments.own.view', 'timetable.own.view', 'fees.own.view', 'messages.own.manage', 'events.view', 'profile.view'],
  student: ['dashboard.student', 'digital_ids.own.view', 'timetable.own.view', 'attendance.own.view', 'assignments.own.view', 'grades.own.view', 'library.own.view', 'events.view', 'profile.view'],
};

const roleDashboardPaths = {
  super_admin: '/admin/dashboard',
  school_admin: '/school/dashboard',
  head_teacher: '/head-teacher/dashboard',
  class_teacher: '/teacher/dashboard',
  teacher: '/teacher/dashboard',
  finance: '/finance/dashboard',
  librarian: '/library/dashboard',
  transport_manager: '/transport/dashboard',
  receptionist: '/reception/dashboard',
  student: '/student/dashboard',
  parent: '/parent/dashboard',
  staff: '/staff/dashboard',
};

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
  const [salt, storedHash] = storedPassword.split(':');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

async function findUserByEmail(email) {
  const { rows } = await query(`
    SELECT u.id, u.organization_id, u.email, u.full_name, u.password_hash, r.name AS role
    FROM users u JOIN roles r ON r.id = u.role_id
    WHERE lower(u.email) = lower($1) AND u.deleted_at IS NULL AND u.is_active = true
  `, [email]);
  return rows[0] || null;
}

async function registerUser({ fullName, email, password, role, organizationId }) {
  if (!rolePermissions[role]) throw new Error('Choose a valid school role.');
  const roleResult = await query('SELECT id FROM roles WHERE name = $1', [role]);
  if (!roleResult.rows[0]) throw new Error('That role is not configured. Run the database migration.');
  const passwordHash = hashPassword(password);
  const { rows } = await query(`
    INSERT INTO users (organization_id, role_id, email, password_hash, full_name)
    VALUES ($1, $2, lower($3), $4, $5)
    RETURNING id, organization_id, email, full_name
  `, [organizationId, roleResult.rows[0].id, email, passwordHash, fullName]);
  return { ...rows[0], role };
}

async function registerSchoolAdmin({ fullName, email, password, schoolName, schoolType }) {
  if (!schoolName || schoolName.trim().length < 2) throw new Error('Enter your school name.');
  const allowedSchoolTypes = ['primary', 'secondary', 'college', 'university', 'international', 'vocational', 'other'];
  if (!allowedSchoolTypes.includes(schoolType)) throw new Error('Choose a valid school type.');
  const roleResult = await query('SELECT id FROM roles WHERE name = $1', ['school_admin']);
  if (!roleResult.rows[0]) throw new Error('School administrator role is not configured. Run the database migration.');
  const passwordHash = hashPassword(password);
  const { rows } = await query(`
    WITH new_school AS (
      INSERT INTO organizations (school_name, school_type) VALUES ($1, $2) RETURNING id
    )
    INSERT INTO users (organization_id, role_id, email, password_hash, full_name)
    SELECT new_school.id, $3, lower($4), $5, $6 FROM new_school
    RETURNING id, organization_id, email, full_name
  `, [schoolName.trim(), schoolType, roleResult.rows[0].id, email, passwordHash, fullName]);
  return { ...rows[0], role: 'school_admin' };
}

async function createInvitation({ organizationId, invitedBy, email, role }) {
  if (!['head_teacher', 'class_teacher', 'teacher', 'finance', 'librarian', 'transport_manager', 'receptionist', 'staff', 'parent', 'student'].includes(role)) {
    throw new Error('That role must be invited by a school administrator.');
  }
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await query(`
    INSERT INTO invitations (organization_id, invited_by, email, role, token_hash, expires_at)
    VALUES ($1, $2, lower($3), $4, $5, now() + interval '7 days')
  `, [organizationId, invitedBy, email, role, tokenHash]);
  return token;
}

async function findInvitation(token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const { rows } = await query(`
    SELECT i.*, o.school_name
    FROM invitations i JOIN organizations o ON o.id = i.organization_id
    WHERE i.token_hash = $1 AND i.accepted_at IS NULL AND i.expires_at > now() AND o.deleted_at IS NULL
  `, [tokenHash]);
  return rows[0] || null;
}

async function acceptInvitation({ token, fullName, password }) {
  const invitation = await findInvitation(token);
  if (!invitation) throw new Error('This invitation is invalid or has expired.');
  if (!password || password.length < 8) throw new Error('Password must be at least 8 characters.');
  const roleResult = await query('SELECT id FROM roles WHERE name = $1', [invitation.role]);
  const passwordHash = hashPassword(password);
  const clientResult = await query(`
    INSERT INTO users (organization_id, role_id, email, password_hash, full_name)
    VALUES ($1, $2, lower($3), $4, $5)
    RETURNING id, organization_id, email, full_name
  `, [invitation.organization_id, roleResult.rows[0].id, invitation.email, passwordHash, fullName]);
  await query('UPDATE invitations SET accepted_at = now() WHERE id = $1', [invitation.id]);
  return { ...clientResult.rows[0], role: invitation.role };
}

function getRoleLabel(role) { return roleLabels[role] || role; }
function canAccess(role, permission) { return Boolean(rolePermissions[role]?.includes(permission)); }
function getDashboardPath(role) { return roleDashboardPaths[role] || '/login'; }

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    if (!canAccess(req.session.user.role, permission)) return res.status(403).render('forbidden', { user: req.session.user, permission });
    next();
  };
}

module.exports = { findUserByEmail, registerUser, registerSchoolAdmin, createInvitation, findInvitation, acceptInvitation, verifyPassword, getRoleLabel, getDashboardPath, canAccess, requireAuth, requirePermission, roleLabels, rolePermissions };
