# Petroleum Lightsail Deployment

This is the active deployment path for `Petroleum`.

Deploy the current application to a single AWS Lightsail instance:

- `apps/web-mui` built to static files and served by Nginx
- `apps/api` running as a long-lived Node.js service on port `4000`
- PostgreSQL provided through `DATABASE_URL`

## Runtime Shape

- Web root: `apps/web-mui/dist`
- API process: `node apps/api/src/server.js`
- API health: `/health`
- Public domain: same host for SPA and API

The frontend can use either:

- `VITE_API_BASE_URL=` empty, when the browser should call same-origin API routes proxied by Nginx
- `VITE_API_BASE_URL=https://your-domain`, if you want the built frontend to use the full public origin explicitly

## Required Environment Variables

At minimum, set these for the API service on the Lightsail instance:

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/petroleum
PORT=4000
WEB_BASE_URL=https://your-domain
PETROLEUM_SECRET_KEY=local-dev-secret
```

Optional variables used by features already in the app:

```text
EIA_API_KEY=your-eia-key
OPIS_USERNAME=your-opis-username
OPIS_PASSWORD=your-opis-password
OAUTH_GOOGLE_CLIENT_ID=your-google-client-id
OAUTH_GOOGLE_CLIENT_SECRET=your-google-client-secret
OAUTH_GOOGLE_CALLBACK_URL=https://your-domain/auth/oauth/google/callback
```

Prototype note:

- This repo currently keeps a prototype fallback key in `apps/api/src/secrets.js`.
- Keep the same `PETROLEUM_SECRET_KEY` on Lightsail unless you intentionally want to re-save encrypted jobber secrets in Admin.

## One-Time Server Setup

Install the base packages you need on the instance:

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Clone the repo and install dependencies:

```bash
git clone https://github.com/wannlynx/wl-portal.git
cd wl-portal
npm install
```

## Deploy Or Update

From the repo root on the Lightsail instance:

```bash
git fetch origin
git checkout <branch>
git pull
npm install
npm --workspace apps/web-mui run build
npm --workspace apps/api run build
sudo systemctl restart petroleum-api
sudo nginx -t
sudo systemctl reload nginx
```

## Systemd Service

Create `/etc/systemd/system/petroleum-api.service`:

```ini
[Unit]
Description=Petroleum API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/wl-portal
Environment=NODE_ENV=production
Environment=PORT=4000
Environment=DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/petroleum
Environment=WEB_BASE_URL=https://your-domain
Environment=PETROLEUM_SECRET_KEY=local-dev-secret
ExecStart=/usr/bin/node /home/ubuntu/wl-portal/apps/api/src/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable petroleum-api
sudo systemctl start petroleum-api
sudo systemctl status petroleum-api
```

If you prefer, move the sensitive values into an EnvironmentFile such as `/etc/petroleum/petroleum.env` and reference that from the service instead of hardcoding them in the unit.

## Nginx

Use [wl-portal.nginx.conf](../wl-portal.nginx.conf) as the checked-in example. It serves the SPA from `apps/web-mui/dist` and proxies active API route groups to `127.0.0.1:4000`.

Typical install flow:

```bash
sudo cp /home/ubuntu/wl-portal/wl-portal.nginx.conf /etc/nginx/sites-available/wl-portal
sudo ln -sf /etc/nginx/sites-available/wl-portal /etc/nginx/sites-enabled/wl-portal
sudo nginx -t
sudo systemctl reload nginx
```

Then add TLS:

```bash
sudo certbot --nginx -d your-domain
```

## Verification

After each deploy, verify:

```bash
curl -I https://your-domain/
curl https://your-domain/health
```

Expected API health shape:

```json
{
  "ok": true,
  "service": "petroleum-api",
  "dbConfigured": true,
  "apiVersion": "3.0.0"
}
```

## Notes

- `apps/web-mui` is the active frontend. `apps/web` remains legacy.
- If encrypted jobber secrets stop decrypting after a move, re-save them in Admin under the active key.
- This repo is not using Render or Railway as the active deployment target.
