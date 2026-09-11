const dotenv = require('dotenv');

dotenv.config();

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required in production. Add it to the Render environment variables.');
}

const appUrl = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL !== 'false',
  sessionSecret: process.env.SESSION_SECRET || 'development-session-secret-change-me',
  demoOrganizationId: process.env.DEMO_ORGANIZATION_ID,
  appUrl,
};
