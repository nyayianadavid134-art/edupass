const schoolRepository = require('../repositories/schoolRepository');
const { roleDashboards } = require('../dashboardConfig');

async function getDashboard(user) {
  const [summary, school] = await Promise.all([
    schoolRepository.getRoleDashboardData(user),
    schoolRepository.getSchoolProfile(user.organizationId),
  ]);

  return { summary, school, dashboard: roleDashboards[user.role] || roleDashboards.staff };
}

module.exports = { getDashboard };
