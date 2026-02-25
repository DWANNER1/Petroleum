# API (MVP)

Base URL: `http://localhost:4000`

## Auth

- `POST /auth/login`
- `GET /auth/me`

## Sites

- `GET /sites`
- `GET /sites/:id`
- `POST /sites`
- `PATCH /sites/:id`

## Integrations

- `GET /sites/:id/integrations`
- `PATCH /sites/:id/integrations`

## Assets

- `GET /sites/:id/pumps`
- `POST /sites/:id/pumps`
- `GET /sites/:id/tanks`
- `POST /sites/:id/tanks`

## Layout

- `GET /sites/:id/layout`
- `POST /sites/:id/layout`

## Alerts / History

- `GET /alerts`
- `POST /alerts/:id/ack`
- `GET /history/tanks`

## Realtime

- `GET /events?channels=site:{siteId}:alerts`
