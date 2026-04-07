# Petroleum AWS Migration Handoff

This document describes the recommended AWS target architecture and the cutover steps for moving `Petroleum` from the current local / Railway / Netlify style setup into AWS.

## Recommended AWS Target

- Frontend: AWS Amplify Hosting
- API: AWS App Runner
- Database: Amazon RDS for PostgreSQL
- Secrets: AWS Secrets Manager

This maps cleanly to the current repository structure:

- `apps/web-mui` is the current Vite SPA frontend and is a good fit for Amplify Hosting
- `apps/api` is a simple Node.js + Express service and is a good fit for App Runner
- PostgreSQL is already the system of record, so RDS PostgreSQL is the natural replacement

## Repo-Specific Runtime Requirements

These settings matter during migration because they affect whether the app will actually start and whether saved credentials will still work:

- `DATABASE_URL` must point to the AWS RDS PostgreSQL instance
- `WEB_BASE_URL` must match the final frontend origin for OAuth redirects
- `VITE_API_BASE_URL` must point to the final API URL
- `PETROLEUM_SECRET_KEY` must remain stable across deployments

Important:

- Saved OPIS and EIA credentials in `jobber_secrets` are encrypted with `PETROLEUM_SECRET_KEY` or `APP_ENCRYPTION_KEY`
- If the key changes, previously saved secrets will no longer decrypt
- If that happens, OPIS and EIA credentials must be re-saved from the Admin UI after cutover

## AWS Environment Variables

### API Service

Create these for the App Runner API service:

```text
DATABASE_URL=postgresql://USER:PASSWORD@RDS-ENDPOINT:5432/petroleum
PORT=4000
WEB_BASE_URL=https://app.yourdomain.com
PETROLEUM_SECRET_KEY=your-existing-stable-key
EIA_API_KEY=your-eia-key
OPIS_USERNAME=your-opis-username
OPIS_PASSWORD=your-opis-password
OAUTH_GOOGLE_CLIENT_ID=your-google-client-id
OAUTH_GOOGLE_CLIENT_SECRET=your-google-client-secret
OAUTH_GOOGLE_CALLBACK_URL=https://api.yourdomain.com/auth/oauth/google/callback
```

Notes:

- Do not set `PGSSL=disable` in AWS. The app already enables SSL automatically unless `PGSSL=disable` is explicitly set.
- Keep `PETROLEUM_SECRET_KEY` the same as the environment that created the currently saved encrypted jobber secrets if you want those to keep working.
- If you are not using Google OAuth immediately, the Google values can remain empty until that flow is enabled.

### Frontend

Create this for Amplify Hosting:

```text
VITE_API_BASE_URL=https://api.yourdomain.com
```

## AWS Build And Run Settings

### App Runner

Use these service settings for `apps/api`:

- Source: GitHub repository
- Runtime: Node.js
- Build command: `npm install && npm --workspace apps/api run build`
- Start command: `npm --workspace apps/api run start`
- Port: `4000`
- Health check path: `/health`

### Amplify Hosting

Use Amplify to build only the frontend app from the monorepo.

Recommended `amplify.yml`:

```yaml
version: 1
applications:
  - appRoot: apps/web-mui
    frontend:
      phases:
        preBuild:
          commands:
            - npm install
        build:
          commands:
            - npm --workspace apps/web-mui run build
      artifacts:
        baseDirectory: apps/web-mui/dist
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
```

Amplify SPA rewrite:

- source: `</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|svg|txt|woff|webp|map)$)([^.]+$)/>`
- target: `/index.html`
- type: `200`

A standard catch-all rewrite to `/index.html` is also acceptable if that is how the hosting team prefers to configure SPAs.

## AWS Network Layout

Recommended networking:

1. Create a VPC.
2. Create at least two subnets for the database.
3. Put RDS in private subnets.
4. Create a security group for App Runner access.
5. Create a security group for RDS that allows PostgreSQL `5432` only from the App Runner security group.
6. Create an App Runner VPC connector so the API can reach private RDS.

Recommended posture:

- Keep RDS private
- Do not open PostgreSQL to the public internet unless there is a specific operational reason

## Migration Steps

### Phase 1: Prepare AWS

1. Create the VPC, subnets, route tables, and security groups.
2. Create the RDS PostgreSQL instance.
3. Create the Secrets Manager entries for the API secrets.
4. Connect the repository to App Runner and Amplify.

### Phase 2: Move Data

1. Export the current PostgreSQL data from the active environment.
2. Restore that data into the new RDS database.
3. Verify that the following data came across correctly:
   - users
   - jobbers
   - sites
   - `jobber_secrets`
   - `jobber_pricing_configs`
   - customer pricing tables
   - Allied transaction data if required
4. Confirm that demo accounts still exist and can log in.

### Phase 3: Deploy API

1. Create the App Runner service for the API.
2. Set the environment variables and secret references.
3. Attach the VPC connector.
4. Deploy.
5. Verify:
   - `GET /health` returns `200`
   - App Runner can connect to RDS
   - the service starts cleanly without Postgres connection errors

### Phase 4: Deploy Frontend

1. Create the Amplify app.
2. Point it at the same repo.
3. Use the monorepo build settings and `amplify.yml`.
4. Set `VITE_API_BASE_URL` to the API service URL.
5. Deploy.
6. Verify:
   - login page loads
   - the app can reach the API
   - authenticated routes work

### Phase 5: Configure Domains

Recommended split:

- `app.yourdomain.com` -> Amplify frontend
- `api.yourdomain.com` -> App Runner API

Tasks:

1. Request ACM certificates.
2. Attach the custom domains.
3. Update DNS in Route 53 or the external DNS provider.
4. Update `WEB_BASE_URL` and `OAUTH_GOOGLE_CALLBACK_URL` to the final production values.
5. Update the Google OAuth app to allow the new callback URL.

## Validation Checklist Before Cutover

Minimum required checks:

1. `https://api.yourdomain.com/health` returns successfully.
2. The frontend loads successfully on the AWS URL.
3. Login works with a known user such as `manager@demo.com`.
4. `GET /market/pricing` works after authentication.
5. The Pricing page loads and shows expected data.
6. `GET /market/opis` and `GET /market/opis/raw` work if OPIS credentials are configured.
7. Customer pricing routes work.
8. Site detail, tanks, pumps, and layout routes work.
9. Allied pages work if those features are in scope for production.

Additional OAuth checks if Google login is enabled:

1. `GET /auth/oauth/providers` returns the provider list.
2. Google login redirects back to the frontend correctly.
3. The callback origin matches `WEB_BASE_URL`.

## Known High-Risk Migration Points

### 1. Encryption Key Drift

This is the highest-risk operational issue.

- If `PETROLEUM_SECRET_KEY` changes, saved OPIS and EIA credentials become undecryptable
- Symptoms include `500` responses from OPIS or EIA-backed flows and messages about re-saving credentials

Mitigation:

- Reuse the original stable key during AWS migration
- If that is not possible, plan a controlled re-save of credentials from Admin immediately after cutover

### 2. OAuth Callback Mismatch

If the callback URL or frontend origin is wrong:

- Google OAuth login will fail
- redirects may land on the wrong host

Mitigation:

- keep `WEB_BASE_URL`, `OAUTH_GOOGLE_CALLBACK_URL`, and Google OAuth console settings aligned

### 3. API / Frontend URL Mismatch

If `VITE_API_BASE_URL` points to the wrong host:

- login will fail
- API-backed pages will fail
- OAuth start URLs will point at the wrong API origin

Mitigation:

- verify the final API domain before building the frontend production artifact

### 4. RDS Connectivity

If the App Runner VPC connector or security groups are wrong:

- `/health` may still respond
- but database-backed routes will fail

Mitigation:

- explicitly test authenticated database-backed routes, not just `/health`

## Minimal-Downtime Cutover Plan

Recommended order:

1. Stand up AWS in parallel with the current environment.
2. Restore a fresh copy of the production or demo database into RDS.
3. Validate the AWS stack completely on AWS-hosted URLs.
4. Freeze writes briefly if needed.
5. Run a final database sync.
6. Switch DNS to the AWS frontend and API.
7. Re-run smoke tests immediately after DNS cutover.
8. Keep the old environment available for rollback for at least 24 to 48 hours.

## Suggested Handoff Sequence For The Next Engineer

1. Create AWS networking and RDS.
2. Restore the database.
3. Create all Secrets Manager secrets.
4. Deploy App Runner with the API.
5. Deploy Amplify with the frontend.
6. Configure domains and OAuth callback URLs.
7. Validate login, pricing, OPIS, and customer pricing.
8. Cut traffic over.
9. Re-save OPIS and EIA credentials in Admin if encrypted secret decryption fails.

## References

- Amplify monorepo hosting: `https://docs.aws.amazon.com/amplify/latest/userguide/monorepo-configuration.html`
- Amplify rewrites and redirects: `https://docs.aws.amazon.com/amplify/latest/userguide/redirects.html`
- App Runner VPC access: `https://docs.aws.amazon.com/apprunner/latest/dg/network-vpc.html`
- App Runner environment variables and secrets: `https://docs.aws.amazon.com/apprunner/latest/dg/env-variable.html`
- RDS security groups: `https://docs.aws.amazon.com/AmazonRDS/latest/gettingstartedguide/security-groups.html`
