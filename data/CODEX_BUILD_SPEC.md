# Gas Station Monitoring Dashboard — Build Spec (for Codex)

## 0) Goal
Build a multi-site web dashboard to monitor:
- **Tanks** via **Veeder-Root ATG** over **TCP/IP polling** (standard ATG port per site).
- **Pumps** via **Gilbarco/FlexPay** alert connections over **TCP port 5201**, **one connection per pump side** (**Side A** and **Side B** each has its own IP).

The system must support:
- **Portfolio-level** (multi-site) map-first overview with drill-down to a site.
- **Site-level** monitoring (alerts, tanks, pumps).
- A **Forecourt Layout** (graphic top-down) viewer + editor to replicate station geometry:
  - Store can be between islands.
  - Islands can be mixed orientation (vertical/horizontal) and rotated independently.
  - Pumps are placed onto islands; each pump has 2 sides (A/B) with components: screen, printer, card reader.
- **Role-based access**: Operator (single store), Service Tech (errors + history across assigned sites), Manager (all).

---

## 1) Personas & Permissions (RBAC)

### Roles
1. **Manager**
   - View **all sites**.
   - Edit assets: stations, islands, pumps, tanks, labels.
   - Edit integration settings (ATG poll settings, pump endpoints).
   - View all history and portfolio trends.
   - Admin: manage users and site assignments.

2. **Service Tech**
   - View **assigned sites** (or assigned regions).
   - Primary surfaces: **Work Queue** (active errors) + history/diagnostics.
   - Can add/edit stations, pumps/tanks, labels, and forecourt layout.
   - Integration settings editability: **allowed** (default) but can be feature-flagged.

3. **Operator**
   - View **only their store**.
   - Can acknowledge alerts and add notes.
   - View forecourt layout (read-only) with live status overlays.
   - No editing of stations/assets/integrations.

### Audit & Governance (required)
- Every configuration change creates an **audit event**: who/when/before/after.
- Forecourt layout has **versioning** and **rollback**.
- Integration settings changes require optional “Reason / Ticket #”.

---

## 2) High-level Architecture

### Runtime components
- **Web App** (React/Next.js + TypeScript + Tailwind/shadcn)
- **API** (FastAPI or Node/Express; choose one; include websocket/SSE)
- **Postgres** for relational data + events
- Optional: **TimescaleDB** extension or separate table partitioning for metrics
- **Ingestion Workers**
  - ATG Poller per site
  - Pump Side Socket Listener per pump side endpoint (TCP:5201)

### Data Flow
1. ATG Poller periodically connects to `site.atg.host:site.atg.port` and pulls inventory + alarms.
2. Pump Listener maintains long-lived sockets to each `pumpSide.ip:5201` and receives alert messages.
3. Normalize both into:
   - **Events**: alarms raised/cleared, connectivity state changes, delivery events.
   - **Measurements**: tank inventory snapshots (volume/height/water/temp).
4. API serves:
   - Current “read model” (active alarms, latest measurements, connectivity)
   - History queries
   - Forecourt layout objects
5. Web app uses:
   - REST for initial loads
   - Websocket/SSE for real-time updates

### Offline/Connectivity Logic
- ATG “stale” if `now - last_successful_poll > max(2*poll_interval, stale_threshold_seconds)`
- Pump Side “disconnected” if socket not connected or no messages/heartbeat for `stale_threshold_seconds`
- Site “offline” if both ATG and pump connectivity are stale; otherwise partial.

---

## 3) Core Domain Model

### Entities
- **Organization**
- **User** (role, site assignments)
- **Site (Station)**
  - location (lat/lon), region, name/label
  - integration settings: ATG host/port/poll interval
- **Tank**
  - atgTankId, label, product, capacity
- **Pump**
  - pumpNumber, label
  - belongs to one site
- **PumpSide**
  - sideId: "A" or "B"
  - ip, port=5201, connection policy
- **ForecourtLayout**
  - versioned JSON describing store/islands/pumps placement

### Events / Measurements
- **AlarmEvent**
  - source: ATG or PumpSide
  - siteId, pumpId, sideId, tankId (nullable)
  - component (screen/printer/cardreader/atg/other)
  - severity (info/warn/critical)
  - state (raised/cleared/acknowledged)
  - message, code (if available), rawPayload
  - timestamps: raisedAt, clearedAt, ackAt
- **TankMeasurement**
  - siteId, tankId, ts
  - fuelVolume, fuelHeight, waterHeight, temperature, ullage
- **DeliveryEvent** (optional MVP)
  - siteId, tankId, tsStart, tsEnd, volumeChange

---

## 4) Database Schema (proposed)

### RBAC
- `orgs(id, name)`
- `users(id, org_id, email, name, role, password_hash, created_at, last_login_at)`
- `user_site_assignments(user_id, site_id)` (operators: 1 row; techs: many; managers optional)

### Sites/Assets
- `sites(id, org_id, site_code, name, address, region, lat, lon, timezone, created_at, updated_at)`
- `site_integrations(site_id, atg_host, atg_port, atg_poll_interval_sec, atg_timeout_sec, atg_retries, atg_stale_sec,
                     pump_timeout_sec, pump_keepalive_enabled, pump_reconnect_enabled, pump_stale_sec)`
- `tanks(id, site_id, atg_tank_id, label, product, capacity_liters, active)`
- `pumps(id, site_id, pump_number, label, active)`
- `pump_sides(id, pump_id, side, ip, port, active)`  -- side ∈ {A,B}

### Layout (versioned)
- `forecourt_layouts(id, site_id, version, name, json, created_by, created_at, is_active)`
- Optional: `forecourt_templates(id, org_id, name, json, created_by, created_at)`

### Events & Measurements
- `alarm_events(id, site_id, source_type, tank_id, pump_id, side, component,
                severity, state, code, message, raw_payload, raised_at, cleared_at,
                ack_at, ack_by, assigned_to, created_at)`
- `tank_measurements(id, site_id, tank_id, ts, fuel_volume_l, fuel_height_mm, water_height_mm, temp_c, ullage_l, raw_payload)`
- `connection_status(id, site_id, kind, target_id, status, last_seen_at, details_json)`  
  - kind: atg | pump_side
  - target_id: null for atg, pump_side.id for pump side

### Audit
- `audit_log(id, org_id, user_id, site_id, entity_type, entity_id, action, before_json, after_json, reason, created_at)`

---

## 5) UI/UX Requirements

### 5.1 Portfolio (Map-first) — Manager
**Route:** `/portfolio`
- Map pins: worst severity per site.
- Cluster bubbles show worst severity + count.
- Right panel queue: “Needs Attention” across all sites with filters.

**Pin tooltip** includes:
- site name/code
- critical/warn counts
- pump sides connected: `connected/expected`
- ATG last poll age
- runout risk (optional)

**Click pin** opens **Site Drawer** with summary + quick actions, and “Open Site Detail”.

### 5.2 Work Queue — Service Tech
**Route:** `/work-queue`
- Queue table: Age, Severity, Site, Device, Side, Component, Message, SLA
- Filters: severity, state, category/component, region, assigned_to
- Selecting row shows detail panel (timeline, similar alerts, raw payload)
- “Open device” deep-links to Pump Detail at that side.

### 5.3 Site Detail (All roles, filtered by permissions)
**Route:** `/sites/:siteId`
Tabs:
- Overview
- Alerts
- Tanks
- Pumps
- History
- Forecourt Layout
- Configuration (Manager/Tech only)

Overview includes:
- Active alerts list (top)
- Tanks summary (2–3)
- Pump health grid (5–8) with per-side statuses
- Data freshness strip (ATG last poll, pump sides connected, last message)

### 5.4 Forecourt Layout (Viewer + Editor)
**Routes:**
- Viewer: `/sites/:siteId/layout`
- Editor: `/sites/:siteId/layout/edit` (Manager/Tech only)

#### Viewer behavior
- Shows top-down station geometry (Store + Islands + Pumps)
- Pumps show **Side A** and **Side B** indicators and worst status overlay.
- Clicking a side opens Pump Detail focused to that side.

#### Editor behavior (free-form)
- Canvas supports drag/drop, resize, rotate (90° increments at minimum).
- Objects: Store, Canopy (optional), Drive lanes (optional), Island, Pump (2-side), Note.
- Island has slots; pumps “snap” into slots.
- Store can be between islands; islands can be any rotation and mixed orientations.

**Properties panel** (for selected pump):
- pump label
- side A endpoint: IP + port 5201 + Test
- side B endpoint: IP + port 5201 + Test
- swap A/B toggle (for physical orientation mismatches)

**Validation** on save:
- each placed pump must have both side IPs
- no duplicate IPs within site (warn/error configurable)
- no pump placed twice
- assets defined but not placed → warning

**Templates**
- Save layout as template.
- Create site from template; then fill in IPs/labels.

### 5.5 Configuration (Manager/Tech)
**Route:** `/sites/:siteId/config`
Sections:
1) Site profile (name, region, address, lat/lon)
2) Integrations
   - ATG host/port, poll interval, timeout, retries, stale threshold, test connection, poll now
   - Pump endpoints: per pump side IP/port 5201, timeout, keepalive, reconnect, stale threshold, test side
3) Assets
   - Tanks add/edit
   - Pumps add/edit (and sides)
4) Access
   - assign operators, assign tech groups/users

---

## 6) API Contract (MVP)

### Auth
- `POST /auth/login` -> JWT
- `GET /auth/me`
- Middleware enforces org + role + site scopes.

### Portfolio & Sites
- `GET /sites` (scoped by user) -> list with status summary
- `GET /sites/:id` -> site detail
- `POST /sites` (manager/tech) -> create
- `PATCH /sites/:id` (manager/tech) -> update

### Integrations/Assets
- `GET /sites/:id/integrations`
- `PATCH /sites/:id/integrations`
- `GET /sites/:id/pumps` / `POST /sites/:id/pumps`
- `PATCH /pumps/:id`
- `GET /pumps/:id/sides` / `PATCH /pump-sides/:id`
- `GET /sites/:id/tanks` / `POST /sites/:id/tanks`
- `PATCH /tanks/:id`

### Layout
- `GET /sites/:id/layout` -> active layout json + version
- `POST /sites/:id/layout` -> create new version (manager/tech)
- `POST /layout/templates` / `GET /layout/templates`

### Alerts & History
- `GET /alerts?siteId=&state=active&severity=&component=&pumpId=&side=`  
- `POST /alerts/:id/ack` (operator/tech/manager)
- `POST /alerts/:id/assign`
- `GET /history/alerts?siteId=&from=&to=`
- `GET /history/tanks?siteId=&tankId=&from=&to=`

### Realtime
- Websocket/SSE channels:
  - `site:{siteId}:alerts`
  - `site:{siteId}:connectivity`
  - `site:{siteId}:tank_measurements`
  - `portfolio:{orgId}:summary` (manager)

---

## 7) Ingestion Details (implementation notes)

### 7.1 ATG Poller (TCP)
- Config per site: host, port, poll interval, timeout, retries.
- Poll results saved as:
  - TankMeasurement snapshots
  - AlarmEvents (raised/cleared) as derived from ATG alarm state
  - ConnectionStatus updates for ATG

**Protocol parsing**
- MVP: treat payload as opaque and support a **pluggable parser**:
  - `parseAtgPayload(raw_bytes) -> {measurements, alarms}`
- Include a simulator mode for development:
  - random walk tank levels + synthetic alarms.

### 7.2 Pump Side Listener (TCP:5201)
- One socket per pump side IP.
- Maintain reconnect loop with backoff.
- On message received:
  - normalize into AlarmEvent (and possibly connectivity heartbeat)
  - store raw payload
- Parser is pluggable:
  - `parsePumpAlert(raw_bytes) -> {component, severity, code, message, state}`
- If no structured state is provided, assume messages represent “raised”; clear requires explicit clear message or manual clear logic (configurable).

---

## 8) Implementation Plan (Codex tasks)

### Repo layout (suggested)
- `/apps/web` (Next.js, TS)
- `/apps/api` (FastAPI or Node)
- `/apps/worker` (pollers/listeners)
- `/docker-compose.yml` (postgres, api, web, worker)

### Web tasks
1. Auth + RBAC gating
2. Portfolio map-first page + site drawer
3. Site detail pages (overview, alerts)
4. Forecourt layout viewer
5. Forecourt layout editor (canvas)
6. Configuration pages (integrations/assets)
7. Work Queue (service tech)

### API tasks
1. Auth endpoints + JWT middleware
2. CRUD: sites, pumps, pump_sides, tanks
3. CRUD: layouts + templates + versioning
4. Alerts queries + ack/assign + history
5. Realtime: websocket/SSE broadcast
6. Audit logging on all mutations

### Worker tasks
1. ATG poll scheduler (per site)
2. Pump side socket manager (N sockets)
3. Normalization + persistence
4. Simulator endpoints or mock mode for dev

---

## 9) Acceptance Criteria (MVP)
- Manager can create a site, set ATG host/port/poll interval, add pumps with side A/B IPs, add tanks.
- Manager/Tech can build a forecourt layout: place store, add islands (mixed rotations), place pumps on islands.
- Operators can view only their site with layout + live status overlays and acknowledge alerts.
- Service tech sees Work Queue across assigned sites with filters; can drill to pump side history.
- Real-time updates reflected on UI within ~2 seconds of ingest (websocket/SSE).
- Audit log records all changes (assets, labels, integration settings, layouts).

---

## 10) Deliverables Codex should produce
- Running stack via `docker compose up`:
  - web UI
  - API
  - postgres
  - worker
- Seed script with 2–3 sample sites and layouts
- Documentation:
  - `README.md` with setup and dev workflow
  - `sample_config.yaml` format
  - API docs (OpenAPI if FastAPI)

