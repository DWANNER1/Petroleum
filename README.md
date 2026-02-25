# Petroleum Monitoring Dashboard

MVP scaffold for a multi-site gas station monitoring platform based on:

- `data/CODEX_BUILD_SPEC.md`
- `data/sample_site_config.yaml`
- `data/sample_layout.json`

## Stack

- `apps/web`: React + Vite dashboard
- `apps/api`: Node.js + Express API + SSE
- `apps/worker`: Node.js simulator worker
- `data/store.json`: JSON persistence file used by API/worker

## Quick Start (Local)

1. Install dependencies:

```bash
npm install
```

2. Seed data from sample config/layout:

```bash
npm run seed
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

## Render Deployment

This repo includes `render.yaml` with:

- API web service
- Web static site
- Worker background service

Deploy with Render Blueprint using this repository.

## Notes

- Auth/JWT is simplified for MVP scaffold.
- Ingestion protocols (ATG/Gilbarco) are simulator-only in this iteration.
- Forecourt layout editor is a next-phase task; viewer is implemented.
This is a gas station support tool
