const crypto = require('crypto');
const { query, pool } = require('../src/db');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function seed() {
  const insertedOrgResult = await query(`
    INSERT INTO organizations (school_name, city, country, motto, brand_colors)
    SELECT 'Green Valley Secondary School', 'Kampala', 'Uganda', 'Excellence. Discipline. Service.', '{"primary":"#16A34A","deep":"#14532D"}'::jsonb
    WHERE NOT EXISTS (SELECT 1 FROM organizations)
    RETURNING id;
  `);

  let organizationId = insertedOrgResult.rows[0]?.id;
  if (!organizationId) {
    const existingOrgResult = await query(`
      SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1;
    `);
    organizationId = existingOrgResult.rows[0]?.id;
  }

  if (!organizationId) {
    throw new Error('No organization was available to create the super admin account.');
  }

  const superAdminRole = await query(`
    SELECT id FROM roles WHERE name = 'super_admin';
  `);

  if (!superAdminRole.rows[0]) {
    throw new Error('Super admin role is not configured. Run the database migration first.');
  }

  const existingUserResult = await query(`
    SELECT id FROM users
    WHERE lower(email) = lower($1) AND organization_id = $2
    LIMIT 1;
  `, ['buay@admin.com', organizationId]);

  if (!existingUserResult.rows[0]) {
    const passwordHash = hashPassword('buay102026');
    await query(`
      INSERT INTO users (organization_id, role_id, email, password_hash, full_name, is_active)
      VALUES ($1, $2, lower($3), $4, $5, true);
    `, [organizationId, superAdminRole.rows[0].id, 'buay@admin.com', passwordHash, 'Buay Khor']);
    console.log('Super administrator account is ready for buay@admin.com');
  } else {
    console.log('Super administrator account already exists for buay@admin.com');
  }

  console.log('EduPass demo organization is ready.');
}

seed().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
