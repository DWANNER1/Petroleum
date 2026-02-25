# Petroleum Monitoring Dashboard

MVP scaffold for a multi-site gas station monitoring platform based on:

- `data/CODEX_BUILD_SPEC.md`
- `data/sample_site_config.yaml`
- `data/sample_layout.json`

## Stack

- `apps/web`: React + Vite dashboard
- `apps/api`: Node.js + Express API + SSE + PostgreSQL
- `apps/worker`: Node.js simulator worker (local/dev)

## Database

The API requires `DATABASE_URL` and persists all app data in PostgreSQL.

## Quick Start (Local)

1. Install dependencies:

```bash
npm install
```

2. Seed data from sample config/layout:

```bash
npm run seed
```

2a. Set a local database URL before seeding/running API:

```bash
set DATABASE_URL=postgres://postgres:postgres@localhost:5432/petroleum
```

3. Start all apps:

```bash
npm run dev
```

Services:

- Web: `http://localhost:5173`
- API: `http://localhost:4000`

Demo users:

- Manager: `manager@demo.com` / `demo123`
- Service Tech: `tech@demo.com` / `demo123`
- Operator: `operator@demo.com` / `demo123`

## Deployment (Free): Netlify + Railway

### API on Railway

1. In Railway, create a new project from this GitHub repo.
2. Set service root to repository root (default).
3. Railway reads `railway.json` and uses:
   - Build: `npm install && npm --workspace apps/api run build`
   - Start: `npm --workspace apps/api run start`
4. Add a PostgreSQL service in Railway and attach/connect it to the API service so `DATABASE_URL` is available.
5. After first deploy, copy the API URL (for example `https://petroleum-api-production.up.railway.app`).

### Web on Netlify

1. In Netlify, import this repository.
2. Build settings:
   - Base directory: *(leave empty)*
   - Build command: `npm install && npm --workspace apps/web run build`
   - Publish directory: `apps/web/dist`
3. Add environment variable:
   - `VITE_API_BASE_URL` = your Railway API URL
4. Deploy site.

`netlify.toml` is included with SPA redirect support.

## Notes

- Auth/JWT is simplified for MVP scaffold.
- API data is durable only when backed by PostgreSQL (`DATABASE_URL`).
- Ingestion protocols (ATG/Gilbarco) are simulator-only in this iteration.
- Forecourt layout editor and layout version save are implemented in MVP form.
