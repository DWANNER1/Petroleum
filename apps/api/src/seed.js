const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { writeStore } = require("./store");

const root = path.resolve(__dirname, "../../../");
const siteYamlPath = path.join(root, "data", "sample_site_config.yaml");
const layoutPath = path.join(root, "data", "sample_layout.json");

function parseSampleFiles() {
  const siteYaml = fs.readFileSync(siteYamlPath, "utf8");
  const layoutJson = fs.readFileSync(layoutPath, "utf8");
  return {
    config: yaml.load(siteYaml),
    layout: JSON.parse(layoutJson)
  };
}

function buildSeedStore() {
  const { config, layout } = parseSampleFiles();
  const now = new Date().toISOString();
  const orgId = "org-demo";

  const users = [
    {
      id: "user-manager",
      orgId,
      email: "manager@demo.com",
      name: "Demo Manager",
      role: "manager",
      password: "demo123",
      siteIds: []
    },
    {
      id: "user-tech",
      orgId,
      email: "tech@demo.com",
      name: "Demo Tech",
      role: "service_tech",
      password: "demo123",
      siteIds: []
    },
    {
      id: "user-operator",
      orgId,
      email: "operator@demo.com",
      name: "Demo Operator",
      role: "operator",
      password: "demo123",
      siteIds: []
    }
  ];

  const sites = [];
  const integrations = [];
  const pumps = [];
  const pumpSides = [];
  const tanks = [];
  const layouts = [];
  const alerts = [];
  const tankMeasurements = [];
  const connectionStatus = [];
  const auditLog = [];

  for (const site of config.sites || []) {
    const siteId = `site-${site.site_code}`;
    sites.push({
      id: siteId,
      orgId,
      siteCode: site.site_code,
      name: site.name,
      address: site.address,
      region: site.region,
      lat: site.lat,
      lon: site.lon,
      timezone: "America/New_York",
      createdAt: now,
      updatedAt: now
    });

    integrations.push({
      siteId,
      atgHost: site.integrations?.atg_host || "",
      atgPort: site.integrations?.atg_port || 10001,
      atgPollIntervalSec:
        site.integrations?.atg_poll_interval_sec ||
        config.defaults?.atg?.poll_interval_sec ||
        60,
      atgTimeoutSec: config.defaults?.atg?.timeout_sec || 5,
      atgRetries: config.defaults?.atg?.retries || 3,
      atgStaleSec: config.defaults?.atg?.stale_sec || 180,
      pumpTimeoutSec: config.defaults?.pump_side?.timeout_sec || 5,
      pumpKeepaliveEnabled: !!config.defaults?.pump_side?.keepalive,
      pumpReconnectEnabled: !!config.defaults?.pump_side?.reconnect,
      pumpStaleSec: config.defaults?.pump_side?.stale_sec || 180
    });

    for (const tank of site.tanks || []) {
      const tankId = `tank-${site.site_code}-${tank.atg_tank_id}`;
      tanks.push({
        id: tankId,
        siteId,
        atgTankId: tank.atg_tank_id,
        label: tank.label,
        product: tank.product,
        capacityLiters: tank.capacity_liters,
        active: true
      });
      tankMeasurements.push({
        id: `tm-${tankId}`,
        siteId,
        tankId,
        ts: now,
        fuelVolumeL: Math.round(tank.capacity_liters * 0.68),
        fuelHeightMm: 1200,
        waterHeightMm: 20,
        tempC: 18.2,
        ullageL: Math.round(tank.capacity_liters * 0.32),
        rawPayload: "seed"
      });
    }

    for (const pump of site.pumps || []) {
      const pumpId = `pump-${site.site_code}-${pump.pump_number}`;
      pumps.push({
        id: pumpId,
        siteId,
        pumpNumber: pump.pump_number,
        label: pump.label,
        active: true
      });

      for (const side of ["A", "B"]) {
        const sideCfg = pump.sides?.[side] || {};
        const sideId = `ps-${pumpId}-${side.toLowerCase()}`;
        pumpSides.push({
          id: sideId,
          pumpId,
          side,
          ip: sideCfg.ip || "",
          port: sideCfg.port || 5201,
          active: true
        });

        connectionStatus.push({
          id: `conn-${sideId}`,
          siteId,
          kind: "pump_side",
          targetId: sideId,
          status: "connected",
          lastSeenAt: now,
          detailsJson: {}
        });
      }
    }

    connectionStatus.push({
      id: `conn-atg-${siteId}`,
      siteId,
      kind: "atg",
      targetId: null,
      status: "connected",
      lastSeenAt: now,
      detailsJson: {}
    });

    const layoutForSite =
      site.site_code === String(layout.siteId) ? layout : {
        ...layout,
        siteId: site.site_code,
        objects: layout.objects.filter((o) => o.type !== "pump")
      };

    layouts.push({
      id: `layout-${siteId}-v1`,
      siteId,
      version: 1,
      name: "Initial Layout",
      json: layoutForSite,
      createdBy: "user-manager",
      createdAt: now,
      isActive: true
    });
  }

  const firstSite = sites[0]?.id;
  users.find((u) => u.role === "operator").siteIds = firstSite ? [firstSite] : [];
  users.find((u) => u.role === "service_tech").siteIds = sites.map((s) => s.id);

  if (firstSite) {
    alerts.push({
      id: "alert-1",
      siteId: firstSite,
      sourceType: "PumpSide",
      tankId: null,
      pumpId: pumps[0]?.id || null,
      side: "A",
      component: "cardreader",
      severity: "warn",
      state: "raised",
      code: "CR-204",
      message: "Card reader timeout",
      rawPayload: "seed",
      raisedAt: now,
      clearedAt: null,
      ackAt: null,
      ackBy: null,
      assignedTo: null,
      createdAt: now
    });
  }

  return {
    orgs: [{ id: orgId, name: config.org?.name || "Demo Org" }],
    users,
    sites,
    integrations,
    tanks,
    pumps,
    pumpSides,
    layouts,
    alerts,
    tankMeasurements,
    connectionStatus,
    auditLog
  };
}

if (require.main === module) {
  const store = buildSeedStore();
  writeStore(store);
  console.log("Seed complete.");
}

module.exports = { buildSeedStore };
