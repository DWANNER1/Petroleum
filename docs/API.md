# API

Base URL: `http://localhost:4000`

This file is a current high-level route map for the local API in `apps/api/src/server.js`. It is not a full schema reference.

## Health And Market Data

- `GET /health`
- `GET /market/pricing`
- `GET /market/opis`
- `GET /market/opis/raw`

## Auth

- `POST /auth/login`
- `GET /auth/me`
- `GET /auth/oauth/providers`
- `GET /auth/oauth/:provider/start`
- `GET /auth/oauth/:provider/callback`

## Jobber And Secret Management

- `GET /jobber`
- `PATCH /jobber`
- `GET /jobber/pricing-configs`
- `PUT /jobber/pricing-configs`
- `GET /jobber/opis-credentials`
- `PUT /jobber/opis-credentials`
- `GET /jobber/eia-credentials`
- `PUT /jobber/eia-credentials`

## Customer Pricing

- `GET /customers`
- `POST /customers`
- `GET /customers/:id`
- `PATCH /customers/:id`
- `GET /customers/:id/pricing-profile`
- `PUT /customers/:id/pricing-profile`
- `POST /customers/:id/contacts`
- `PATCH /customers/:id/contacts/:contactId`
- `DELETE /customers/:id/contacts/:contactId`

## Pricing Sources, Taxes, Rules, And Outputs

- `GET /pricing/sources`
- `POST /pricing/sources`
- `GET /pricing/sources/:id`
- `POST /pricing/sources/:id/values`
- `GET /pricing/taxes`
- `PUT /pricing/taxes`
- `GET /pricing/rules`
- `POST /pricing/rules`
- `GET /pricing/rules/:id`
- `PATCH /pricing/rules/:id`
- `PUT /pricing/rules/:id/components`
- `PUT /pricing/rules/:id/vendor-sets`
- `POST /pricing/runs/preview`
- `POST /pricing/runs`
- `GET /pricing/runs/:date`
- `GET /pricing/outputs`
- `GET /pricing/outputs/:id`

## Management

- `GET /management/overview`
- `POST /management/users`
- `PATCH /management/users/:id`
- `DELETE /management/users/:id`
- `POST /management/jobbers`

## Sites And Site Configuration

- `GET /sites`
- `GET /sites/:id`
- `POST /sites`
- `PATCH /sites/:id`
- `DELETE /sites/:id`
- `GET /sites/:id/integrations`
- `PATCH /sites/:id/integrations`
- `GET /sites/:id/pricing-configs`
- `PUT /sites/:id/pricing-configs`
- `GET /sites/:id/pumps`
- `POST /sites/:id/pumps`
- `PATCH /pumps/:id`
- `DELETE /pumps/:id`
- `GET /sites/:id/tanks`
- `POST /sites/:id/tanks`
- `PATCH /tanks/:id`
- `DELETE /tanks/:id`
- `GET /sites/:id/layout`
- `POST /sites/:id/layout`

## Allied Transactions

- `GET /sites/:id/allied-transactions/summary`
- `GET /sites/:id/allied-transactions`
- `GET /sites/:id/allied-transactions/export`
- `GET /allied-transactions/portfolio-summary`

## Alerts, History, And Streaming

- `GET /alerts`
- `POST /alerts/:id/ack`
- `GET /history/tanks`
- `GET /tank-information`
- `GET /events?channels=site:{siteId}:alerts`

## Important Runtime Notes

- `GET /market/pricing` requires a valid EIA key from `EIA_API_KEY` or encrypted jobber storage.
- `GET /market/opis` and `GET /market/opis/raw` require valid OPIS credentials from `OPIS_USERNAME` / `OPIS_PASSWORD` or encrypted jobber storage.
- Encrypted jobber secrets depend on a stable `PETROLEUM_SECRET_KEY` or `APP_ENCRYPTION_KEY`. If that key changes, previously saved OPIS and EIA values must be re-saved.
