const fs = require('fs');
const path = require('path');
const { query, pool } = require('../src/db');

async function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  await query(schema);
  console.log('EduPass database schema is ready.');
}

migrate().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
