# Sentinel Core

Sentinel Core is a policy intelligence and compliance monitoring platform. It
turns policy documents into actionable rules, records employee activity, and
surfaces potential compliance violations through a React dashboard.

The repository contains two supported application stacks:

- **Express stack:** React + Vite, Node.js + Express, and MongoDB.
- **Supabase stack:** Supabase PostgreSQL, Edge Functions, Storage, and the same
  React client.

## Features

- User registration, login, JWT sessions, and profile management
- PDF, DOCX, and plain-text policy parsing
- Deterministic rule extraction and compliance-risk scoring
- Policy, rule, activity log, and violation management
- Dashboard metrics, audits, monitoring alerts, workflows, and framework views
- Legacy Django PBKDF2 password verification alongside bcrypt
- Health and readiness endpoints for deployments
- Docker support for the unified Express deployment

## Architecture

```text
client/                  React 18 single-page application
  ├── pages/              Dashboard, policies, monitoring, audits, settings
  ├── components/        Shared layout and UI components
  └── services/          API client and authentication helpers

server/                  Express API and MongoDB implementation
  ├── controllers/        Request and business-logic handlers
  ├── models/             User, Policy, Rule, Log, and Violation schemas
  ├── routes/             REST API route definitions
  ├── services/           Document parser and rule engine
  ├── scripts/            Migration, backup, and provisioning utilities
  └── tests/              API and Supabase integration tests

supabase/                PostgreSQL migrations and Edge Functions
```

## Requirements

- Node.js 18 or newer
- npm
- MongoDB 7+ for the Express stack, or a Supabase project for the Supabase stack
- Docker and Docker Compose (optional)
- Supabase CLI (optional, for local Supabase development)

## Quick start: Express and MongoDB

1. Install dependencies:

   ```bash
   npm install
   npm run install:all
   ```

2. Create environment files:

   ```bash
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```

3. Configure `server/.env` with a MongoDB connection and a strong JWT secret:

   ```dotenv
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://127.0.0.1:27017/sentinel_compliance
   JWT_SECRET=replace_with_a_long_random_secret_at_least_32_characters
   CLIENT_URL=http://localhost:5173
   ```

4. Start the API and frontend in separate terminals:

   ```bash
   npm run dev:server
   npm run dev:client
   ```

   The API runs at `http://localhost:5000` and the Vite client at
   `http://localhost:5173`.

For a unified production-style process, build the client and start Express:

```bash
npm run build
npm start
```

Open `http://localhost:5000`.

## Supabase development

The Supabase implementation lives under `supabase/` and uses the same domain
logic as the Express API.

1. Install and authenticate with the [Supabase CLI](https://supabase.com/docs/guides/cli).
2. Start the local stack:

   ```bash
   supabase start
   ```

3. Apply migrations and seed data:

   ```bash
   supabase db reset
   ```

4. Configure the Supabase values in `server/.env` and `client/.env`. For local
   Edge Functions, use:

   ```dotenv
   VITE_API_URL=http://127.0.0.1:54321/functions/v1/api
   ```

5. Run the Supabase API server or deploy the functions as appropriate:

   ```bash
   npm run dev:supabase
   # or
   supabase functions serve api --no-verify-jwt
   ```

The local Supabase API is available on port `54321`; Studio is available on
port `54323`.

## Common commands

| Command | Description |
| --- | --- |
| `npm run dev:server` | Start the Express API with Nodemon |
| `npm run dev:client` | Start the Vite development server |
| `npm run build` | Build the React client |
| `npm start` | Start the Express server |
| `npm test` | Run the Express API test suite |
| `npm run test:supabase` | Run Supabase function tests |
| `npm run test:atlas` | Test the configured MongoDB Atlas connection |
| `npm run migrate:data` | Migrate legacy SQLite data to MongoDB |
| `npm run migrate:supabase` | Migrate data to Supabase |
| `npm run backup` | Create a backend data backup |
| `npm --prefix server run provision:demo` | Provision demo accounts |

## API overview

The Express API is mounted under `/api`:

| Area | Routes |
| --- | --- |
| Authentication | `/api/auth/register/`, `/api/auth/login/`, `/api/auth/me/`, `/api/auth/profile/` |
| Policies | `/api/policy-interpreter/`, `/api/policies/`, `/api/policies/save/` |
| Monitoring | `/api/dashboard/`, `/api/site-data/`, `/api/activity-demo/`, `/api/alerts/:id/resolve/` |
| Logs | `/api/logs/` |
| Violations | `/api/violations/` |

Operational endpoints:

- `GET /health` reports service and database status.
- `GET /health/ready` returns HTTP 503 until MongoDB is connected.

Authenticated routes use a bearer token:

```http
Authorization: Bearer <access-token>
```

## Docker

The production image builds the Vite client and serves it from Express:

```bash
docker compose up --build
```

The application is exposed on `http://localhost:5000`. MongoDB data and
uploaded policy files are stored in named Docker volumes. Set `JWT_SECRET` and
other deployment values in an environment file before using this setup in
production.

## Deployment

- **Unified server:** use the root `Dockerfile`, `Procfile`, or `npm run build && npm start`.
- **Frontend:** deploy `client/` as a Vite application; `client/vercel.json`
  provides SPA fallback routing.
- **Supabase:** apply the migrations in `supabase/migrations/` and deploy the
  Edge Functions under `supabase/functions/`.

Never commit `.env` files, service-role keys, database passwords, or JWT
secrets. Use the supplied `.env.example` files as templates and rotate any
secret that has been exposed.

## Data migration

The migration utilities preserve legacy records and support the original
SQLite-backed application:

```bash
npm run migrate:data
npm run migrate:supabase
```

Review the target database and take a backup before running migrations against
production data.

## License

This project currently uses the ISC license declared in `package.json`.
