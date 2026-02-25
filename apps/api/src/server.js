const express = require("express");
const cors = require("cors");
const { authMiddleware, encodeToken } = require("./auth");
const { readStore, withStore, writeStore } = require("./store");
const { buildSeedStore } = require("./seed");
const { requireAuth, requireSiteAccess, requireRole, canAccessSite } = require("./rbac");
const { registerClient, sendEvent, broadcast } = require("./events");

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(authMiddleware);

function ensureStore() {
  let store = readStore();
  if (!store) {
    store = buildSeedStore();
    writeStore(store);
  }
  return store;
}

function currentUserRecord(store, req) {
  if (!req.user) return null;
  return store.users.find((u) => u.id === req.user.userId) || null;
}

function siteSummary(store, site) {
  const siteAlerts = store.alerts.filter((a) => a.siteId === site.id && a.state === "raised");
  const criticalCount = siteAlerts.filter((a) => a.severity === "critical").length;
  const warnCount = siteAlerts.filter((a) => a.severity === "warn").length;
  const sides = store.pumpSides.filter((ps) => {
    const pump = store.pumps.find((p) => p.id === ps.pumpId);
    return pump?.siteId === site.id;
  });
  const sideIds = new Set(sides.map((s) => s.id));
  const sideConn = store.connectionStatus.filter(
    (c) => c.kind === "pump_side" && sideIds.has(c.targetId)
  );
  const atgConn = store.connectionStatus.find((c) => c.kind === "atg" && c.siteId === site.id);
  return {
    id: site.id,
    siteCode: site.siteCode,
    name: site.name,
    address: site.address,
    region: site.region,
    lat: site.lat,
    lon: site.lon,
    criticalCount,
    warnCount,
    pumpSidesConnected: sideConn.filter((c) => c.status === "connected").length,
    pumpSidesExpected: sideConn.length,
    atgLastSeenAt: atgConn?.lastSeenAt || null
  };
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "petroleum-api" });
});

app.post("/auth/login", (req, res) => {
  const store = ensureStore();
  const { email, password } = req.body || {};
  const user = store.users.find((u) => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const token = encodeToken({
    userId: user.id,
    role: user.role,
    orgId: user.orgId,
    siteIds: user.siteIds || []
  });
  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      siteIds: user.siteIds || []
    }
  });
});

app.get("/auth/me", requireAuth, (req, res) => {
  const store = ensureStore();
  const user = currentUserRecord(store, req);
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    siteIds: user.siteIds || []
  });
});

app.get("/sites", requireAuth, (req, res) => {
  const store = ensureStore();
  const allowed = store.sites.filter((s) => canAccessSite(req.user, s.id));
  return res.json(allowed.map((s) => siteSummary(store, s)));
});

app.get("/sites/:id", requireAuth, requireSiteAccess, (req, res) => {
  const store = ensureStore();
  const site = store.sites.find((s) => s.id === req.params.id);
  if (!site) return res.status(404).json({ error: "Site not found" });
  return res.json({
    ...siteSummary(store, site),
    integration: store.integrations.find((i) => i.siteId === site.id) || null,
    tanks: store.tanks.filter((t) => t.siteId === site.id),
    pumps: store.pumps.filter((p) => p.siteId === site.id)
  });
});

app.post("/sites", requireAuth, requireRole("manager", "service_tech"), (req, res) => {
  const body = req.body || {};
  if (!body.siteCode || !body.name) {
    return res.status(400).json({ error: "siteCode and name are required" });
  }
  const id = `site-${body.siteCode}`;
  const now = new Date().toISOString();
  const updated = withStore((store) => {
    if (store.sites.some((s) => s.id === id)) {
      throw new Error("Site already exists");
    }
    const site = {
      id,
      orgId: req.user.orgId,
      siteCode: body.siteCode,
      name: body.name,
      address: body.address || "",
      region: body.region || "",
      lat: body.lat || 0,
      lon: body.lon || 0,
      timezone: body.timezone || "America/New_York",
      createdAt: now,
      updatedAt: now
    };
    store.sites.push(site);
    store.integrations.push({
      siteId: id,
      atgHost: "",
      atgPort: 10001,
      atgPollIntervalSec: 60,
      atgTimeoutSec: 5,
      atgRetries: 3,
      atgStaleSec: 180,
      pumpTimeoutSec: 5,
      pumpKeepaliveEnabled: true,
      pumpReconnectEnabled: true,
      pumpStaleSec: 180
    });
    store.auditLog.push({
      id: `audit-${Date.now()}`,
      orgId: req.user.orgId,
      userId: req.user.userId,
      siteId: id,
      entityType: "site",
      entityId: id,
      action: "create",
      beforeJson: null,
      afterJson: site,
      reason: body.reason || "",
      createdAt: now
    });
    return store;
  });
  const site = updated.sites.find((s) => s.id === id);
  return res.status(201).json(site);
});

app.patch("/sites/:id", requireAuth, requireSiteAccess, requireRole("manager", "service_tech"), (req, res) => {
  const body = req.body || {};
  const now = new Date().toISOString();
  const updated = withStore((store) => {
    const site = store.sites.find((s) => s.id === req.params.id);
    if (!site) throw new Error("Site not found");
    const before = { ...site };
    Object.assign(site, {
      name: body.name ?? site.name,
      address: body.address ?? site.address,
      region: body.region ?? site.region,
      lat: body.lat ?? site.lat,
      lon: body.lon ?? site.lon,
      updatedAt: now
    });
    store.auditLog.push({
      id: `audit-${Date.now()}`,
      orgId: req.user.orgId,
      userId: req.user.userId,
      siteId: site.id,
      entityType: "site",
      entityId: site.id,
      action: "update",
      beforeJson: before,
      afterJson: site,
      reason: body.reason || "",
      createdAt: now
    });
    return store;
  });
  return res.json(updated.sites.find((s) => s.id === req.params.id));
});

app.get("/sites/:id/integrations", requireAuth, requireSiteAccess, (req, res) => {
  const store = ensureStore();
  return res.json(store.integrations.find((i) => i.siteId === req.params.id) || null);
});

app.patch(
  "/sites/:id/integrations",
  requireAuth,
  requireSiteAccess,
  requireRole("manager", "service_tech"),
  (req, res) => {
    const body = req.body || {};
    const now = new Date().toISOString();
    const updated = withStore((store) => {
      const integration = store.integrations.find((i) => i.siteId === req.params.id);
      if (!integration) throw new Error("Integration not found");
      const before = { ...integration };
      Object.assign(integration, body);
      store.auditLog.push({
        id: `audit-${Date.now()}`,
        orgId: req.user.orgId,
        userId: req.user.userId,
        siteId: req.params.id,
        entityType: "site_integrations",
        entityId: req.params.id,
        action: "update",
        beforeJson: before,
        afterJson: integration,
        reason: body.reason || "",
        createdAt: now
      });
      return store;
    });
    return res.json(updated.integrations.find((i) => i.siteId === req.params.id));
  }
);

app.get("/sites/:id/pumps", requireAuth, requireSiteAccess, (req, res) => {
  const store = ensureStore();
  const pumps = store.pumps
    .filter((p) => p.siteId === req.params.id)
    .map((pump) => ({
      ...pump,
      sides: store.pumpSides.filter((ps) => ps.pumpId === pump.id)
    }));
  return res.json(pumps);
});

app.post("/sites/:id/pumps", requireAuth, requireSiteAccess, requireRole("manager", "service_tech"), (req, res) => {
  const body = req.body || {};
  const now = new Date().toISOString();
  if (body.pumpNumber == null || !body.label) {
    return res.status(400).json({ error: "pumpNumber and label are required" });
  }
  const updated = withStore((store) => {
    const pumpId = `pump-${req.params.id}-${body.pumpNumber}`;
    if (store.pumps.some((p) => p.id === pumpId)) throw new Error("Pump already exists");
    const pump = {
      id: pumpId,
      siteId: req.params.id,
      pumpNumber: body.pumpNumber,
      label: body.label,
      active: true
    };
    store.pumps.push(pump);
    for (const side of ["A", "B"]) {
      const sideCfg = body.sides?.[side] || {};
      store.pumpSides.push({
        id: `ps-${pumpId}-${side.toLowerCase()}`,
        pumpId,
        side,
        ip: sideCfg.ip || "",
        port: sideCfg.port || 5201,
        active: true
      });
    }
    store.auditLog.push({
      id: `audit-${Date.now()}`,
      orgId: req.user.orgId,
      userId: req.user.userId,
      siteId: req.params.id,
      entityType: "pump",
      entityId: pumpId,
      action: "create",
      beforeJson: null,
      afterJson: pump,
      reason: body.reason || "",
      createdAt: now
    });
    return store;
  });
  const pump = updated.pumps.find((p) => p.siteId === req.params.id && p.pumpNumber === body.pumpNumber);
  return res.status(201).json(pump);
});

app.get("/sites/:id/tanks", requireAuth, requireSiteAccess, (req, res) => {
  const store = ensureStore();
  return res.json(store.tanks.filter((t) => t.siteId === req.params.id));
});

app.post("/sites/:id/tanks", requireAuth, requireSiteAccess, requireRole("manager", "service_tech"), (req, res) => {
  const body = req.body || {};
  if (!body.atgTankId || !body.label || !body.product) {
    return res.status(400).json({ error: "atgTankId, label, product are required" });
  }
  const updated = withStore((store) => {
    const tank = {
      id: `tank-${req.params.id}-${body.atgTankId}`,
      siteId: req.params.id,
      atgTankId: body.atgTankId,
      label: body.label,
      product: body.product,
      capacityLiters: Number(body.capacityLiters || 0),
      active: true
    };
    store.tanks.push(tank);
    return store;
  });
  return res.status(201).json(updated.tanks[updated.tanks.length - 1]);
});

app.get("/sites/:id/layout", requireAuth, requireSiteAccess, (req, res) => {
  const store = ensureStore();
  const active = store.layouts.find((l) => l.siteId === req.params.id && l.isActive);
  if (!active) return res.status(404).json({ error: "Layout not found" });
  return res.json(active);
});

app.post("/sites/:id/layout", requireAuth, requireSiteAccess, requireRole("manager", "service_tech"), (req, res) => {
  const body = req.body || {};
  if (!body.json) return res.status(400).json({ error: "json is required" });
  const now = new Date().toISOString();
  const updated = withStore((store) => {
    const layouts = store.layouts.filter((l) => l.siteId === req.params.id);
    const maxVersion = layouts.reduce((acc, item) => Math.max(acc, item.version), 0);
    store.layouts.forEach((l) => {
      if (l.siteId === req.params.id) l.isActive = false;
    });
    const next = {
      id: `layout-${req.params.id}-v${maxVersion + 1}`,
      siteId: req.params.id,
      version: maxVersion + 1,
      name: body.name || `Layout v${maxVersion + 1}`,
      json: body.json,
      createdBy: req.user.userId,
      createdAt: now,
      isActive: true
    };
    store.layouts.push(next);
    store.auditLog.push({
      id: `audit-${Date.now()}`,
      orgId: req.user.orgId,
      userId: req.user.userId,
      siteId: req.params.id,
      entityType: "forecourt_layout",
      entityId: next.id,
      action: "create_version",
      beforeJson: null,
      afterJson: next,
      reason: body.reason || "",
      createdAt: now
    });
    return store;
  });
  return res.status(201).json(updated.layouts.find((l) => l.siteId === req.params.id && l.isActive));
});

app.get("/alerts", requireAuth, (req, res) => {
  const store = ensureStore();
  const { siteId, state, severity, component, pumpId, side } = req.query;
  let alerts = store.alerts.filter((a) => canAccessSite(req.user, a.siteId));
  if (siteId) alerts = alerts.filter((a) => a.siteId === siteId);
  if (state) alerts = alerts.filter((a) => a.state === state);
  if (severity) alerts = alerts.filter((a) => a.severity === severity);
  if (component) alerts = alerts.filter((a) => a.component === component);
  if (pumpId) alerts = alerts.filter((a) => a.pumpId === pumpId);
  if (side) alerts = alerts.filter((a) => a.side === side);
  return res.json(alerts);
});

app.post("/alerts/:id/ack", requireAuth, (req, res) => {
  const now = new Date().toISOString();
  const updated = withStore((store) => {
    const alert = store.alerts.find((a) => a.id === req.params.id);
    if (!alert) throw new Error("Alert not found");
    if (!canAccessSite(req.user, alert.siteId)) throw new Error("Forbidden");
    alert.state = "acknowledged";
    alert.ackAt = now;
    alert.ackBy = req.user.userId;
    return store;
  });
  return res.json(updated.alerts.find((a) => a.id === req.params.id));
});

app.get("/history/tanks", requireAuth, (req, res) => {
  const store = ensureStore();
  const { siteId, tankId } = req.query;
  let rows = store.tankMeasurements.filter((row) => canAccessSite(req.user, row.siteId));
  if (siteId) rows = rows.filter((row) => row.siteId === siteId);
  if (tankId) rows = rows.filter((row) => row.tankId === tankId);
  return res.json(rows.slice(-300));
});

app.get("/events", requireAuth, (req, res) => {
  const channels = (req.query.channels || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
    "Cache-Control": "no-cache"
  });
  res.write("\n");

  const cleanup = registerClient(res, channels);
  sendEvent(res, "connected", { ok: true, ts: new Date().toISOString() });
  req.on("close", cleanup);
});

app.get("/audit", requireAuth, requireRole("manager", "service_tech"), (req, res) => {
  const store = ensureStore();
  res.json(store.auditLog.slice(-300));
});

function runSimulatorTick() {
  const now = new Date().toISOString();
  const updated = withStore((store) => {
    for (const t of store.tankMeasurements) {
      const drift = Math.round((Math.random() - 0.5) * 200);
      t.fuelVolumeL = Math.max(0, t.fuelVolumeL + drift);
      t.ullageL = Math.max(0, (t.ullageL || 0) - drift);
      t.ts = now;
    }
    if (Math.random() < 0.2 && store.pumps.length > 0) {
      const pump = store.pumps[Math.floor(Math.random() * store.pumps.length)];
      store.alerts.push({
        id: `alert-${Date.now()}`,
        siteId: pump.siteId,
        sourceType: "PumpSide",
        tankId: null,
        pumpId: pump.id,
        side: Math.random() < 0.5 ? "A" : "B",
        component: "printer",
        severity: Math.random() < 0.3 ? "critical" : "warn",
        state: "raised",
        code: "SIM-01",
        message: "Synthetic connectivity/print fault",
        rawPayload: "simulator",
        raisedAt: now,
        clearedAt: null,
        ackAt: null,
        ackBy: null,
        assignedTo: null,
        createdAt: now
      });
    }
    return store;
  });

  const siteIds = new Set(updated.sites.map((s) => s.id));
  for (const siteId of siteIds) {
    broadcast("site:update", {
      channel: `site:${siteId}:alerts`,
      siteId,
      ts: now
    });
  }
}

ensureStore();
setInterval(runSimulatorTick, 5000);

app.listen(port, () => {
  console.log(`petroleum-api listening on ${port}`);
});
