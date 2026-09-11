const { initializeDatabase, pool } = require('../src/db');

async function migrate() {
  await initializeDatabase();
}

migrate().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
