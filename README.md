# EduPass

EduPass is a plain JavaScript Node.js/Express foundation for a multi-tenant school management and digital identity platform.

## Run locally

1. Create the PostgreSQL database:

   ```sql
   CREATE DATABASE schoolm;
   ```

2. Copy `.env.example` to `.env` and adjust credentials if your local PostgreSQL user differs.
3. Install dependencies and initialize the schema:

   ```powershell
   npm install
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```

Open `http://localhost:3000`. The health check is available at `http://localhost:3000/health`.

## Deploy to Render

1. Push this project to GitHub.
2. In Render, create a new Web Service and connect the repository.
3. Use the existing `npm start` command.
4. Add your environment variables in Render:
   - `NODE_ENV=production`
   - `DATABASE_URL=<your postgres connection string>`
   - `DATABASE_SSL=true`
   - `SESSION_SECRET=<a long random secret>`
   - `APP_URL=<your Render external URL>` or leave it unset and Render will provide `RENDER_EXTERNAL_URL`
5. Render will automatically expose the public URL. After the service starts, the app will use that external URL for invitation links and secure session cookies.

## Current foundation

- PostgreSQL-backed organization, staff, student, class, attendance, role, and audit tables
- Tenant-ready organization ownership on core records
- Server-side dashboard aggregation
- Green EduPass admin shell with responsive layout
- Environment-based database configuration

The next implementation slices are authentication and authorization, onboarding, digital IDs, and the student management workflows.
