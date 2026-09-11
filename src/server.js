const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const { checkConnection, pool, initializeDatabase } = require('./db');
const { getDashboard } = require('./services/dashboardService');
const { query } = require('./db');
const { findUserByEmail, registerSchoolAdmin, createInvitation, findInvitation, acceptInvitation, verifyPassword, getRoleLabel, getDashboardPath, canAccess, requireAuth, requirePermission, roleLabels } = require('./auth');
const { roleDashboards } = require('./dashboardConfig');

const schoolTypes = [
  ['primary', 'Primary school'], ['secondary', 'Secondary school'], ['college', 'College'],
  ['university', 'University'], ['international', 'International school'], ['vocational', 'Vocational / technical school'], ['other', 'Other education organization'],
];
const inviteRoles = Object.entries(roleLabels)
  .filter(([role]) => !['super_admin', 'school_admin'].includes(role))
  .map(([value, label]) => ({ value, label }));

const app = express();
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  store: new pgSession({
    pool,
    createTableIfMissing: true,
  }),
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    maxAge: 8 * 60 * 60 * 1000,
  },
}));

app.get('/login', (req, res) => res.render('login', { error: null, success: req.query.created === '1' ? 'Account created successfully. Please sign in.' : null }));
app.post('/login', async (req, res, next) => {
  try {
    const user = await findUserByEmail(req.body.email || '');
    if (!user || !verifyPassword(req.body.password || '', user.password_hash)) return res.status(401).render('login', { error: 'The email or password is incorrect.' });
    req.session.user = { id: user.id, organizationId: user.organization_id, fullName: user.full_name, email: user.email, role: user.role, roleLabel: getRoleLabel(user.role) };
    res.redirect(getDashboardPath(user.role));
  } catch (error) { next(error); }
});

app.get('/register', (req, res) => res.render('register', { error: null, schoolTypes }));
app.post('/register', async (req, res, next) => {
  try {
    if (!req.body.password || req.body.password.length < 8) throw new Error('Password must be at least 8 characters.');
    await registerSchoolAdmin(req.body);
    res.redirect('/login?created=1');
  } catch (error) {
    const message = error.code === '23505' ? 'That email is already registered for this school.' : error.message;
    res.status(400).render('register', { error: message, schoolTypes });
  }
});
app.get('/invite/:token', async (req, res, next) => {
  try {
    const invitation = await findInvitation(req.params.token);
    if (!invitation) return res.status(400).render('invite', { error: 'This invitation is invalid or has expired.', invitation: null, token: req.params.token });
    res.render('invite', { error: null, invitation, token: req.params.token });
  } catch (error) { next(error); }
});
app.post('/invite/:token', async (req, res, next) => {
  try {
    const user = await acceptInvitation({ token: req.params.token, ...req.body });
    req.session.user = { id: user.id, organizationId: user.organization_id, fullName: user.full_name, email: user.email, role: user.role, roleLabel: getRoleLabel(user.role) };
    res.redirect(getDashboardPath(user.role));
  } catch (error) {
    res.status(400).render('invite', { error: error.message, invitation: await findInvitation(req.params.token), token: req.params.token });
  }
});
app.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

app.get('/health', async (req, res) => {
  try {
    await checkConnection();
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'degraded', database: 'unavailable' });
  }
});

app.get('/verify/:token', async (req, res, next) => {
  try {
    const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const result = await query(`
      SELECT d.status, d.expires_at, s.full_name, s.student_number, o.school_name, o.city, o.country
      FROM digital_ids d
      JOIN students s ON s.id = d.student_id
      JOIN organizations o ON o.id = d.organization_id
      WHERE d.verification_token_hash = $1
    `, [tokenHash]);
    res.render('verify', { identity: result.rows[0] || null });
  } catch (error) { next(error); }
});

app.get('/', requireAuth, (req, res) => res.redirect(getDashboardPath(req.session.user.role)));

async function renderRoleDashboard(req, res, next) {
  try {
    const expectedPath = getDashboardPath(req.session.user.role);
    if (req.path !== expectedPath) return res.redirect(expectedPath);
    const { dashboard, summary, school } = await getDashboard(req.session.user);
    res.render('dashboard', { dashboard, summary, school, user: req.session.user, canAccess, activePath: req.path });
  } catch (error) { next(error); }
}

Object.entries(roleDashboards).forEach(([role, dashboard]) => {
  app.get(getDashboardPath(role), requireAuth, requirePermission(dashboard.navigation[0][2]), renderRoleDashboard);
});

app.get('/workspace/*', requireAuth, async (req, res, next) => {
  const workspace = req.params[0];
  const permissionByWorkspace = {
    students: 'students.view', staff: 'staff.view', classes: 'classes.view', academics: 'academics.view', attendance: 'attendance.view',
    finance: 'finance.view', 'digital-ids': 'digital_ids.view', communication: 'communication.view', reports: 'reports.view',
    schools: 'platform.schools', subscriptions: 'platform.subscriptions', 'platform-payments': 'platform.payments', plans: 'platform.subscriptions', 'platform-users': 'platform.users', 'platform-analytics': 'platform.analytics', support: 'platform.support', 'platform-settings': 'platform.settings', 'audit-logs': 'audit.view',
    subjects: 'academics.view', events: 'events.view', certificates: 'certificates.view', 'school-settings': 'school.settings', billing: 'subscription.view', invitations: 'users.invite',
    'fee-structures': 'finance.view', 'student-fees': 'finance.view', 'finance-reports': 'finance.reports.view', 'outstanding-balances': 'finance.view',
    'book-categories': 'library.books.manage', 'overdue-books': 'library.reports.view', 'library-reports': 'library.reports.view',
    'transport-assignments': 'transport.manage', trips: 'transport.manage', 'transport-attendance': 'transport.manage', 'transport-reports': 'transport.reports.view',
    'visitor-passes': 'visitors.manage', 'emergency-contacts': 'students.lookup', 'my-tasks': 'dashboard.staff', announcements: 'communication.view', messages: 'messages.own.manage',
    'my-classes': 'classes.assigned', 'my-students': 'students.assigned.view', 'my-attendance': 'attendance.assigned.view',
    assignments: 'assignments.manage', assessments: 'assessments.manage', grades: 'grades.manage', timetable: 'timetable.assigned.view',
    'my-digital-id': 'digital_ids.own.view', 'my-timetable': 'timetable.own.view', 'my-assignments': 'assignments.own.view', 'my-grades': 'grades.own.view',
    'my-children': 'children.own.view', 'my-children-attendance': 'attendance.own.view', 'my-children-academics': 'academics.own.view', 'my-children-assignments': 'assignments.own.view', 'my-children-timetable': 'timetable.own.view', 'my-fees': 'fees.own.view', 'my-library': 'library.own.view',
    invoices: 'finance.view', payments: 'finance.payments.create', receipts: 'finance.receipts.create',
    books: 'library.books.manage', borrowing: 'library.borrowing.manage', returns: 'library.borrowing.manage', 'student-lookup': 'students.lookup',
    vehicles: 'transport.manage', drivers: 'transport.manage', routes: 'transport.manage', visitors: 'visitors.manage', 'id-verification': 'digital_ids.verify',
    'entry-exit': 'entry_exit.manage', events: 'events.view', certificates: 'certificates.view', profile: 'profile.view',
  };
  const permission = permissionByWorkspace[workspace] || permissionByWorkspace[workspace.split('/')[0]];
  if (!permission) return res.status(404).render('error', { message: 'That workspace does not exist.' });
  if (!canAccess(req.session.user.role, permission)) return res.status(403).render('forbidden', { user: req.session.user, permission });
  if (workspace === 'invitations') return res.render('invite-admin', { user: req.session.user, roles: inviteRoles, error: null, inviteLink: null });
  const loadWorkspace = async () => {
    const organizationId = req.session.user.organizationId;
    if (workspace === 'students' || workspace === 'my-students' || workspace === 'student-lookup') {
      const result = await query('SELECT id, full_name, student_number, status FROM students WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY full_name', [organizationId]);
      return { records: result.rows };
    }
    if (workspace === 'subjects') {
      const result = await query('SELECT id, name, code FROM subjects WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY name', [organizationId]);
      return { records: result.rows };
    }
    if (workspace === 'digital-ids') {
      const result = await query(`SELECT d.id, d.status, d.expires_at, s.full_name, s.student_number FROM digital_ids d JOIN students s ON s.id = d.student_id WHERE d.organization_id = $1 ORDER BY d.created_at DESC`, [organizationId]);
      const students = await query('SELECT id, full_name, student_number FROM students WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY full_name', [organizationId]);
      return { records: result.rows, students: students.rows };
    }
    if (workspace === 'attendance' || workspace === 'my-attendance') {
      const result = await query(`SELECT a.attendance_date, a.status, s.full_name, s.student_number FROM attendance a JOIN students s ON s.id = a.student_id WHERE a.organization_id = $1 ORDER BY a.attendance_date DESC, s.full_name LIMIT 100`, [organizationId]);
      const students = await query('SELECT id, full_name, student_number FROM students WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY full_name', [organizationId]);
      return { records: result.rows, students: students.rows };
    }
    if (workspace === 'finance' || workspace === 'invoices' || workspace === 'outstanding-balances') {
      const result = await query(`SELECT i.invoice_number, i.description, i.amount, i.balance, i.status, s.full_name FROM invoices i LEFT JOIN students s ON s.id = i.student_id WHERE i.organization_id = $1 ORDER BY i.created_at DESC`, [organizationId]);
      return { records: result.rows };
    }
    if (workspace === 'visitors') {
      const result = await query(`SELECT v.id, v.full_name, v.phone, v.purpose, v.status, v.checked_in_at, v.checked_out_at, u.full_name AS host_name FROM visitors v LEFT JOIN users u ON u.id = v.host_user_id WHERE v.organization_id = $1 ORDER BY v.created_at DESC LIMIT 100`, [organizationId]);
      return { records: result.rows };
    }
    if (workspace === 'visitor-passes') {
      const result = await query(`SELECT p.pass_code, p.status, p.issued_at, p.expires_at, v.full_name, v.purpose FROM visitor_passes p JOIN visitors v ON v.id = p.visitor_id WHERE p.organization_id = $1 ORDER BY p.issued_at DESC LIMIT 100`, [organizationId]);
      const visitors = await query(`SELECT id, full_name FROM visitors WHERE organization_id = $1 AND status <> 'checked_out' ORDER BY full_name`, [organizationId]);
      return { records: result.rows, visitors: visitors.rows };
    }
    if (workspace === 'entry-exit') {
      const result = await query(`SELECT e.direction, e.reason, e.recorded_at, s.full_name AS student_name, v.full_name AS visitor_name FROM entry_exit_logs e LEFT JOIN students s ON s.id = e.student_id LEFT JOIN visitors v ON v.id = e.visitor_id WHERE e.organization_id = $1 ORDER BY e.recorded_at DESC LIMIT 100`, [organizationId]);
      const students = await query(`SELECT id, full_name, student_number FROM students WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY full_name`, [organizationId]);
      const visitors = await query(`SELECT id, full_name FROM visitors WHERE organization_id = $1 AND status <> 'checked_out' ORDER BY full_name`, [organizationId]);
      return { records: result.rows, students: students.rows, visitors: visitors.rows };
    }
    if (workspace === 'emergency-contacts') {
      const result = await query(`SELECT e.full_name, e.relationship, e.phone, e.email, e.is_primary, s.full_name AS student_name, s.student_number FROM emergency_contacts e JOIN students s ON s.id = e.student_id WHERE e.organization_id = $1 ORDER BY s.full_name, e.full_name`, [organizationId]);
      const students = await query(`SELECT id, full_name, student_number FROM students WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY full_name`, [organizationId]);
      return { records: result.rows, students: students.rows };
    }
    if (workspace === 'books' || workspace === 'book-categories') {
      const result = workspace === 'book-categories'
        ? await query(`SELECT name, created_at FROM book_categories WHERE organization_id = $1 ORDER BY name`, [organizationId])
        : await query(`SELECT b.title, b.author, b.isbn, b.copies_total, b.copies_available, c.name AS category_name FROM books b LEFT JOIN book_categories c ON c.id = b.category_id WHERE b.organization_id = $1 ORDER BY b.title`, [organizationId]);
      return { records: result.rows };
    }
    if (workspace === 'borrowing' || workspace === 'returns') {
      const result = await query(`SELECT l.id, b.title, COALESCE(s.full_name, u.full_name) AS borrower_name, l.issued_at, l.due_at, l.returned_at FROM book_loans l JOIN books b ON b.id = l.book_id LEFT JOIN students s ON s.id = l.borrower_student_id LEFT JOIN users u ON u.id = l.borrower_user_id WHERE l.organization_id = $1 AND ${workspace === 'returns' ? 'l.returned_at IS NOT NULL' : 'l.returned_at IS NULL'} ORDER BY l.issued_at DESC`, [organizationId]);
      const books = await query(`SELECT id, title, copies_available FROM books WHERE organization_id = $1 AND copies_available > 0 ORDER BY title`, [organizationId]);
      const students = await query(`SELECT id, full_name, student_number FROM students WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY full_name`, [organizationId]);
      return { records: result.rows, books: books.rows, students: students.rows };
    }
    if (workspace === 'payments' || workspace === 'receipts') {
      const result = await query(`SELECT p.amount, p.payment_method, p.reference, p.paid_at, i.invoice_number FROM payments p LEFT JOIN invoices i ON i.id = p.invoice_id WHERE p.organization_id = $1 ORDER BY p.paid_at DESC LIMIT 100`, [organizationId]);
      const invoices = await query(`SELECT id, invoice_number, balance FROM invoices WHERE organization_id = $1 AND balance > 0 ORDER BY created_at DESC`, [organizationId]);
      return { records: result.rows, invoices: invoices.rows };
    }
    if (['my-assignments', 'my-children-assignments'].includes(workspace)) {
      const parentFilter = workspace === 'my-children-assignments' ? 'JOIN parent_students ps ON ps.organization_id = a.organization_id JOIN students child ON child.id = ps.student_id AND child.class_id = a.class_id WHERE ps.parent_user_id = $2 AND ' : 'WHERE ';
      const params = workspace === 'my-children-assignments' ? [organizationId, req.session.user.id] : [organizationId];
      const result = await query(`SELECT DISTINCT a.title, a.description, a.due_at, s.name AS subject_name FROM assignments a LEFT JOIN subjects s ON s.id = a.subject_id ${parentFilter}a.organization_id = $1 ORDER BY a.due_at NULLS LAST, a.created_at DESC`, params);
      return { records: result.rows };
    }
    if (['my-grades', 'my-children-academics'].includes(workspace)) {
      const parentFilter = workspace === 'my-children-academics' ? 'JOIN parent_students ps ON ps.student_id = g.student_id AND ps.organization_id = g.organization_id WHERE ps.parent_user_id = $2 AND ' : 'WHERE ';
      const params = workspace === 'my-children-academics' ? [organizationId, req.session.user.id] : [organizationId];
      const result = await query(`SELECT a.title AS assessment, s.full_name AS student_name, sub.name AS subject_name, g.score, a.max_score, g.feedback FROM grades g JOIN assessments a ON a.id = g.assessment_id JOIN students s ON s.id = g.student_id LEFT JOIN subjects sub ON sub.id = a.subject_id ${parentFilter}g.organization_id = $1 ORDER BY g.created_at DESC LIMIT 100`, params);
      return { records: result.rows };
    }
    if (['my-timetable', 'my-children-timetable'].includes(workspace)) {
      const parentFilter = workspace === 'my-children-timetable' ? 'JOIN parent_students ps ON ps.organization_id = t.organization_id JOIN students child ON child.id = ps.student_id AND child.class_id = t.class_id WHERE ps.parent_user_id = $2 AND ' : 'WHERE ';
      const params = workspace === 'my-children-timetable' ? [organizationId, req.session.user.id] : [organizationId];
      const result = await query(`SELECT DISTINCT t.weekday, t.starts_at, t.ends_at, t.room, c.name AS class_name, s.name AS subject_name FROM timetables t LEFT JOIN classes c ON c.id = t.class_id LEFT JOIN subjects s ON s.id = t.subject_id ${parentFilter}t.organization_id = $1 ORDER BY t.weekday, t.starts_at`, params);
      return { records: result.rows };
    }
    if (workspace === 'assignments' || workspace === 'assessments' || workspace === 'grades' || workspace === 'timetable') {
      const table = workspace === 'timetable' ? 'timetables' : workspace;
      const result = await query(`SELECT * FROM ${table} WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 100`, [organizationId]);
      if (workspace === 'assessments') return { records: result.rows, assessments: result.rows };
      if (workspace === 'grades') {
        const assessments = await query('SELECT id, title, max_score FROM assessments WHERE organization_id = $1 ORDER BY assessment_date DESC NULLS LAST', [organizationId]);
        const students = await query('SELECT id, full_name, student_number FROM students WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY full_name', [organizationId]);
        return { records: result.rows, assessments: assessments.rows, students: students.rows };
      }
      if (workspace === 'timetable') {
        const classes = await query('SELECT id, name FROM classes WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY name', [organizationId]);
        const subjects = await query('SELECT id, name FROM subjects WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY name', [organizationId]);
        return { records: result.rows, classes: classes.rows, subjects: subjects.rows };
      }
      return { records: result.rows };
    }
    if (workspace === 'events' || workspace === 'announcements' || workspace === 'messages' || workspace === 'my-tasks') {
      const table = workspace === 'my-tasks' ? 'tasks' : workspace;
      const result = await query(`SELECT * FROM ${table} WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 100`, [organizationId]);
      return { records: result.rows };
    }
    if (workspace === 'vehicles' || workspace === 'drivers' || workspace === 'routes' || workspace === 'trips' || workspace === 'transport-assignments') {
      const table = workspace.replace('transport-', '').replace('assignments', 'transport_assignments');
      const result = await query(`SELECT * FROM ${table} WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 100`, [organizationId]);
      if (workspace === 'trips') {
        const routes = await query('SELECT id, name FROM routes WHERE organization_id = $1 ORDER BY name', [organizationId]);
        const vehicles = await query('SELECT id, registration_number FROM vehicles WHERE organization_id = $1 ORDER BY registration_number', [organizationId]);
        const drivers = await query('SELECT id, full_name FROM drivers WHERE organization_id = $1 ORDER BY full_name', [organizationId]);
        return { records: result.rows, routes: routes.rows, vehicles: vehicles.rows, drivers: drivers.rows };
      }
      if (workspace === 'transport-assignments') {
        const routes = await query('SELECT id, name FROM routes WHERE organization_id = $1 ORDER BY name', [organizationId]);
        const students = await query('SELECT id, full_name, student_number FROM students WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY full_name', [organizationId]);
        return { records: result.rows, routes: routes.rows, students: students.rows };
      }
      return { records: result.rows };
    }
    return { records: [] };
  };
  try {
    const data = await loadWorkspace();
    const specializedWorkspaces = ['assessments', 'grades', 'timetable', 'trips', 'transport-assignments'];
    if (specializedWorkspaces.includes(workspace)) {
      const titles = { assessments: 'Create assessment', grades: 'Record grade', timetable: 'Add timetable entry', trips: 'Schedule trip', 'transport-assignments': 'Assign student to route' };
      return res.render('special-workspace', { workspace, ...data, module: { title: workspace.replaceAll('-', ' '), eyebrow: 'AUTHORIZED WORKSPACE', description: `This workspace is scoped to the ${(req.session.user.roleLabel || 'staff').toLowerCase()} role.` }, actionTitle: titles[workspace], user: req.session.user, dashboard: roleDashboards[req.session.user.role] || roleDashboards.staff, canAccess });
    }
    res.render('module', { workspace, ...data, query: req.query, module: { title: workspace.replaceAll('-', ' '), eyebrow: 'AUTHORIZED WORKSPACE', description: `This workspace is scoped to the ${(req.session.user.roleLabel || 'staff').toLowerCase()} role.` }, user: req.session.user, dashboard: roleDashboards[req.session.user.role] || roleDashboards.staff, canAccess });
  } catch (error) {
    next(error);
  }
});

app.post('/workspace/visitors', requireAuth, requirePermission('visitors.manage'), async (req, res, next) => {
  try {
    if (!req.body.fullName || !req.body.purpose) throw new Error('Visitor name and purpose are required.');
    await query(`INSERT INTO visitors (organization_id, full_name, phone, email, identification_number, purpose, host_user_id, status, checked_in_at) VALUES ($1, $2, $3, $4, $5, $6, $7, 'checked_in', now())`, [req.session.user.organizationId, req.body.fullName.trim(), req.body.phone || null, req.body.email || null, req.body.identificationNumber || null, req.body.purpose.trim(), req.body.hostUserId || null]);
    res.redirect('/workspace/visitors');
  } catch (error) { next(error); }
});

app.post('/workspace/visitor-passes', requireAuth, requirePermission('visitors.manage'), async (req, res, next) => {
  try {
    if (!req.body.visitorId) throw new Error('Select a visitor.');
    const passCode = `VP-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
    await query(`INSERT INTO visitor_passes (organization_id, visitor_id, pass_code, issued_by, expires_at) VALUES ($1, $2, $3, $4, $5)`, [req.session.user.organizationId, req.body.visitorId, passCode, req.session.user.id, req.body.expiresAt || null]);
    res.redirect('/workspace/visitor-passes');
  } catch (error) { next(error); }
});

app.post('/workspace/entry-exit', requireAuth, requirePermission('entry_exit.manage'), async (req, res, next) => {
  try {
    if (!req.body.studentId && !req.body.visitorId) throw new Error('Select a student or visitor.');
    await query(`INSERT INTO entry_exit_logs (organization_id, student_id, visitor_id, recorded_by, direction, reason) VALUES ($1, $2, $3, $4, $5, $6)`, [req.session.user.organizationId, req.body.studentId || null, req.body.visitorId || null, req.session.user.id, req.body.direction, req.body.reason || null]);
    if (req.body.visitorId) await query(`UPDATE visitors SET status = $1, checked_out_at = CASE WHEN $1 = 'checked_out' THEN now() ELSE checked_out_at END WHERE id = $2 AND organization_id = $3`, [req.body.direction === 'exit' ? 'checked_out' : 'checked_in', req.body.visitorId, req.session.user.organizationId]);
    res.redirect('/workspace/entry-exit');
  } catch (error) { next(error); }
});

app.post('/workspace/emergency-contacts', requireAuth, requirePermission('students.lookup'), async (req, res, next) => {
  try {
    if (!req.body.studentId || !req.body.fullName || !req.body.phone) throw new Error('Student, contact name, and phone are required.');
    await query(`INSERT INTO emergency_contacts (organization_id, student_id, full_name, relationship, phone, email, is_primary) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [req.session.user.organizationId, req.body.studentId, req.body.fullName.trim(), req.body.relationship || 'Other', req.body.phone.trim(), req.body.email || null, req.body.isPrimary === 'on']);
    res.redirect('/workspace/emergency-contacts');
  } catch (error) { next(error); }
});

app.post('/workspace/students', requireAuth, requirePermission('students.create'), async (req, res, next) => {
  try { await query('INSERT INTO students (organization_id, student_number, full_name) VALUES ($1, $2, $3)', [req.session.user.organizationId, req.body.studentNumber, req.body.fullName]); res.redirect('/workspace/students'); } catch (error) { next(error); }
});
app.post('/workspace/subjects', requireAuth, requirePermission('academics.view'), async (req, res, next) => {
  try { await query('INSERT INTO subjects (organization_id, name, code) VALUES ($1, $2, $3)', [req.session.user.organizationId, req.body.name, req.body.code || null]); res.redirect('/workspace/subjects'); } catch (error) { next(error); }
});
app.post('/workspace/digital-ids', requireAuth, requirePermission('digital_ids.create'), async (req, res, next) => {
  try { const token = crypto.randomBytes(32).toString('hex'); const tokenHash = crypto.createHash('sha256').update(token).digest('hex'); await query('INSERT INTO digital_ids (organization_id, student_id, verification_token_hash, expires_at) VALUES ($1, $2, $3, $4)', [req.session.user.organizationId, req.body.studentId, tokenHash, req.body.expiresAt || null]); res.redirect(`/workspace/digital-ids?issued=${token}`); } catch (error) { next(error); }
});
app.post('/workspace/attendance', requireAuth, requirePermission('attendance.create'), async (req, res, next) => {
  try { await query(`INSERT INTO attendance (organization_id, student_id, attendance_date, status) VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4) ON CONFLICT (student_id, attendance_date) DO UPDATE SET status = EXCLUDED.status, recorded_at = now()`, [req.session.user.organizationId, req.body.studentId, req.body.date || null, req.body.status]); res.redirect('/workspace/attendance'); } catch (error) { next(error); }
});

app.post('/workspace/invitations', requireAuth, requirePermission('users.invite'), async (req, res, next) => {
  try {
    const token = await createInvitation({ organizationId: req.session.user.organizationId, invitedBy: req.session.user.id, email: req.body.email, role: req.body.role });
    res.render('invite-admin', { user: req.session.user, roles: inviteRoles, error: null, inviteLink: `${config.appUrl}/invite/${token}` });
  } catch (error) {
    res.status(400).render('invite-admin', { user: req.session.user, roles: inviteRoles, error: error.message, inviteLink: null });
  }
});

app.post('/workspace/:workspace', requireAuth, async (req, res, next) => {
  const permissions = {
    'book-categories': 'library.books.manage', books: 'library.books.manage', borrowing: 'library.borrowing.manage', returns: 'library.borrowing.manage', assignments: 'assignments.manage', assessments: 'assessments.manage', grades: 'grades.manage', timetable: 'timetable.assigned.view', events: 'events.view', announcements: 'communication.send', 'my-tasks': 'dashboard.staff', vehicles: 'transport.manage', drivers: 'transport.manage', routes: 'transport.manage', trips: 'transport.manage', 'transport-assignments': 'transport.manage', payments: 'finance.payments.create', receipts: 'finance.receipts.create',
  };
  const permission = permissions[req.params.workspace];
  if (!permission || !canAccess(req.session.user.role, permission)) return res.status(403).render('forbidden', { user: req.session.user, permission: permission || 'workspace' });
  const organizationId = req.session.user.organizationId;
  try {
    switch (req.params.workspace) {
      case 'book-categories':
        await query('INSERT INTO book_categories (organization_id, name) VALUES ($1, $2)', [organizationId, req.body.name.trim()]);
        break;
      case 'books':
        await query('INSERT INTO books (organization_id, title, author, isbn, copies_total, copies_available) VALUES ($1, $2, $3, $4, $5, $5)', [organizationId, req.body.title.trim(), req.body.author || null, req.body.isbn || null, Number(req.body.copiesTotal || 1)]);
        break;
      case 'assignments':
        await query('INSERT INTO assignments (organization_id, created_by, title, description, due_at) VALUES ($1, $2, $3, $4, $5)', [organizationId, req.session.user.id, req.body.title.trim(), req.body.description || null, req.body.dueAt || null]);
        break;
      case 'assessments':
        await query('INSERT INTO assessments (organization_id, created_by, title, assessment_date, max_score) VALUES ($1, $2, $3, $4, $5)', [organizationId, req.session.user.id, req.body.title.trim(), req.body.assessmentDate || null, Number(req.body.maxScore || 100)]);
        break;
      case 'grades':
        await query('INSERT INTO grades (organization_id, assessment_id, student_id, score, feedback, recorded_by) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (assessment_id, student_id) DO UPDATE SET score = EXCLUDED.score, feedback = EXCLUDED.feedback, recorded_by = EXCLUDED.recorded_by', [organizationId, req.body.assessmentId, req.body.studentId, Number(req.body.score), req.body.feedback || null, req.session.user.id]);
        break;
      case 'timetable':
        await query('INSERT INTO timetables (organization_id, class_id, subject_id, teacher_user_id, weekday, starts_at, ends_at, room) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [organizationId, req.body.classId || null, req.body.subjectId || null, req.session.user.id, Number(req.body.weekday), req.body.startsAt, req.body.endsAt, req.body.room || null]);
        break;
      case 'events':
        await query('INSERT INTO events (organization_id, created_by, title, description, starts_at, location) VALUES ($1, $2, $3, $4, $5, $6)', [organizationId, req.session.user.id, req.body.title.trim(), req.body.description || null, req.body.startsAt, req.body.location || null]);
        break;
      case 'announcements':
        await query('INSERT INTO announcements (organization_id, author_user_id, title, body, audience, published_at) VALUES ($1, $2, $3, $4, $5, now())', [organizationId, req.session.user.id, req.body.title.trim(), req.body.body.trim(), req.body.audience || 'school']);
        break;
      case 'my-tasks':
        await query('INSERT INTO tasks (organization_id, assigned_to, created_by, title, description, due_at) VALUES ($1, $2, $3, $4, $5, $6)', [organizationId, req.body.assignedTo || req.session.user.id, req.session.user.id, req.body.title.trim(), req.body.description || null, req.body.dueAt || null]);
        break;
      case 'vehicles':
        await query('INSERT INTO vehicles (organization_id, registration_number, vehicle_type, capacity) VALUES ($1, $2, $3, $4)', [organizationId, req.body.registrationNumber.trim(), req.body.vehicleType || null, Number(req.body.capacity || 0) || null]);
        break;
      case 'drivers':
        await query('INSERT INTO drivers (organization_id, full_name, phone, licence_number) VALUES ($1, $2, $3, $4)', [organizationId, req.body.fullName.trim(), req.body.phone || null, req.body.licenceNumber || null]);
        break;
      case 'routes':
        await query('INSERT INTO routes (organization_id, name, description) VALUES ($1, $2, $3)', [organizationId, req.body.name.trim(), req.body.description || null]);
        break;
      case 'transport-assignments':
        await query('INSERT INTO transport_assignments (organization_id, route_id, student_id) VALUES ($1, $2, $3)', [organizationId, req.body.routeId, req.body.studentId]);
        break;
      case 'trips':
        await query('INSERT INTO trips (organization_id, route_id, vehicle_id, driver_id, trip_date, status) VALUES ($1, $2, $3, $4, $5, $6)', [organizationId, req.body.routeId || null, req.body.vehicleId || null, req.body.driverId || null, req.body.tripDate, req.body.status || 'scheduled']);
        break;
      case 'borrowing':
        await query('INSERT INTO book_loans (organization_id, book_id, borrower_student_id, issued_by, due_at) VALUES ($1, $2, $3, $4, $5)', [organizationId, req.body.bookId, req.body.studentId, req.session.user.id, req.body.dueAt]);
        await query('UPDATE books SET copies_available = copies_available - 1 WHERE id = $1 AND organization_id = $2 AND copies_available > 0', [req.body.bookId, organizationId]);
        break;
      case 'returns':
        await query('UPDATE book_loans SET returned_at = now() WHERE id = $1 AND organization_id = $2 AND returned_at IS NULL', [req.body.loanId, organizationId]);
        await query('UPDATE books SET copies_available = copies_available + 1 WHERE id = (SELECT book_id FROM book_loans WHERE id = $1) AND organization_id = $2', [req.body.loanId, organizationId]);
        break;
      case 'payments':
        await query('INSERT INTO payments (organization_id, invoice_id, recorded_by, amount, payment_method, reference) VALUES ($1, $2, $3, $4, $5, $6)', [organizationId, req.body.invoiceId, req.session.user.id, Number(req.body.amount), req.body.paymentMethod || null, req.body.reference || null]);
        await query('UPDATE invoices SET balance = GREATEST(balance - $1, 0), status = CASE WHEN balance - $1 <= 0 THEN \'paid\' ELSE \'part_paid\' END, updated_at = now() WHERE id = $2 AND organization_id = $3', [Number(req.body.amount), req.body.invoiceId, organizationId]);
        break;
      default:
        return res.status(404).render('error', { message: 'That workspace action does not exist.' });
    }
    res.redirect(`/workspace/${req.params.workspace}`);
  } catch (error) { next(error); }
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).render('error', { message: 'EduPass could not load this view.' });
});

async function start() {
  await initializeDatabase();
  app.listen(config.port, () => {
    console.log(`EduPass running at http://localhost:${config.port}`);
  });
}

start().catch((error) => {
  console.error('EduPass could not start:', error.message);
  process.exitCode = 1;
});
