const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const { checkConnection } = require('./db');
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

app.get('/workspace/*', requireAuth, (req, res) => {
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
    return { records: [] };
  };
    loadWorkspace().then((data) => res.render('module', { workspace, ...data, query: req.query, module: { title: workspace.replaceAll('-', ' '), eyebrow: 'AUTHORIZED WORKSPACE', description: `This workspace is scoped to the ${req.session.user.roleLabel.toLowerCase()} role.` }, user: req.session.user, dashboard: roleDashboards[req.session.user.role], canAccess })).catch(next);
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

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).render('error', { message: 'EduPass could not load this view.' });
});

app.listen(config.port, () => {
  console.log(`EduPass running at http://localhost:${config.port}`);
});
