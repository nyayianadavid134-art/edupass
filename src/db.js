const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const config = require('./config');

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required. Add the Render PostgreSQL connection string to the service environment.');
}

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error.message);
});

async function query(text, params) {
  return pool.query(text, params);
}

async function checkConnection() {
  await query('SELECT 1');
  return true;
}

async function initializeDatabase() {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  await query(schema);
  console.log('EduPass database schema is ready.');
}

module.exports = { pool, query, checkConnection, initializeDatabase };
