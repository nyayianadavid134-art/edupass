const { query } = require('../db');

async function getDashboardSummary() {
  const { rows } = await query(`
    SELECT
      (SELECT COUNT(*)::int FROM students WHERE deleted_at IS NULL) AS students,
      (SELECT COUNT(*)::int FROM staff WHERE deleted_at IS NULL) AS staff,
      (SELECT COUNT(*)::int FROM classes WHERE deleted_at IS NULL) AS classes,
      (SELECT COUNT(*)::int FROM attendance WHERE attendance_date = CURRENT_DATE AND status = 'present') AS present_today
  `);

  return rows[0];
}

async function getSchoolProfile(organizationId) {
  if (!organizationId) return null;

  const { rows } = await query(`
    SELECT school_name, school_logo, city, country, motto, brand_colors
    FROM organizations
    WHERE id = $1 AND deleted_at IS NULL
  `, [organizationId]);

  return rows[0] || null;
}

async function getRoleDashboardData(user) {
  const organizationId = user.organizationId;
  const base = await query(`
    SELECT
      (SELECT COUNT(*)::int FROM students WHERE organization_id = $1 AND deleted_at IS NULL) AS students,
      (SELECT COUNT(*)::int FROM staff WHERE organization_id = $1 AND deleted_at IS NULL) AS staff,
      (SELECT COUNT(*)::int FROM classes WHERE organization_id = $1 AND deleted_at IS NULL) AS classes,
      (SELECT COUNT(*)::int FROM attendance WHERE organization_id = $1 AND attendance_date = CURRENT_DATE AND status = 'present') AS presentToday
  `, [organizationId]);

  const data = base.rows[0] || {};
  if (['finance', 'school_admin', 'parent'].includes(user.role)) {
    const finance = await query(`
      SELECT
        COALESCE(SUM(amount), 0)::numeric AS feesCollected,
        COALESCE(SUM(balance), 0)::numeric AS outstandingFees,
        COUNT(*) FILTER (WHERE balance > 0)::int AS unpaidInvoices
      FROM invoices
      WHERE organization_id = $1
    `, [organizationId]);
    Object.assign(data, finance.rows[0] || {});
  }

  if (['class_teacher', 'teacher'].includes(user.role)) {
    const assigned = await query(`
      SELECT
        COUNT(DISTINCT c.id)::int AS assignedClasses,
        COUNT(DISTINCT s.id)::int AS assignedStudents
      FROM staff st
      LEFT JOIN class_teachers ct ON ct.staff_id = st.id
      LEFT JOIN classes c ON c.id = ct.class_id AND c.organization_id = st.organization_id AND c.deleted_at IS NULL
      LEFT JOIN students s ON s.organization_id = st.organization_id AND s.class_id = c.id AND s.deleted_at IS NULL
      WHERE st.user_id = $1 AND st.deleted_at IS NULL
    `, [user.id]);
    Object.assign(data, assigned.rows[0] || {});
  }

  if (user.role === 'parent') {
    const children = await query(`
      SELECT COUNT(*)::int AS children
      FROM parent_students
      WHERE organization_id = $1 AND parent_user_id = $2
    `, [organizationId, user.id]);
    Object.assign(data, children.rows[0] || {});
  }

  return data;
}

module.exports = { getDashboardSummary, getSchoolProfile, getRoleDashboardData };
