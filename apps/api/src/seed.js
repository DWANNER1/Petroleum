const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { initDb, tx, query } = require("./db");

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

async function seedDatabase() {
  const { config, layout } = parseSampleFiles();
  const now = new Date().toISOString();
  const orgId = "org-demo";

  await initDb();
  await tx(async (client) => {
    await client.query("DELETE FROM user_site_assignments");
    await client.query("DELETE FROM alarm_events");
    await client.query("DELETE FROM tank_measurements");
    await client.query("DELETE FROM connection_status");
    await client.query("DELETE FROM forecourt_layouts");
    await client.query("DELETE FROM pump_sides");
    await client.query("DELETE FROM pumps");
    await client.query("DELETE FROM tanks");
    await client.query("DELETE FROM site_integrations");
    await client.query("DELETE FROM sites");
    await client.query("DELETE FROM audit_log");
    await client.query("DELETE FROM users");
    await client.query("DELETE FROM orgs");

    await client.query("INSERT INTO orgs(id, name) VALUES ($1, $2)", [
      orgId,
      config.org?.name || "Demo Org"
    ]);

    const users = [
      ["user-manager", orgId, "manager@demo.com", "Demo Manager", "manager", "demo123"],
      ["user-tech", orgId, "tech@demo.com", "Demo Tech", "service_tech", "demo123"],
      ["user-operator", orgId, "operator@demo.com", "Demo Operator", "operator", "demo123"]
    ];
    for (const row of users) {
      await client.query(
        "INSERT INTO users(id, org_id, email, name, role, password) VALUES ($1,$2,$3,$4,$5,$6)",
        row
      );
    }

    const siteIds = [];
    for (const site of config.sites || []) {
      const siteId = `site-${site.site_code}`;
      siteIds.push(siteId);
      await client.query(
        `INSERT INTO sites(id, org_id, site_code, name, address, region, lat, lon, timezone, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          siteId,
          orgId,
          site.site_code,
          site.name,
          site.address || "",
          site.region || "",
          Number(site.lat || 0),
          Number(site.lon || 0),
          "America/New_York",
          now,
          now
        ]
      );

      await client.query(
        `INSERT INTO site_integrations(
          site_id, atg_host, atg_port, atg_poll_interval_sec, atg_timeout_sec, atg_retries, atg_stale_sec,
          pump_timeout_sec, pump_keepalive_enabled, pump_reconnect_enabled, pump_stale_sec
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          siteId,
          site.integrations?.atg_host || "",
          Number(site.integrations?.atg_port || 10001),
          Number(site.integrations?.atg_poll_interval_sec || config.defaults?.atg?.poll_interval_sec || 60),
          Number(config.defaults?.atg?.timeout_sec || 5),
          Number(config.defaults?.atg?.retries || 3),
          Number(config.defaults?.atg?.stale_sec || 180),
          Number(config.defaults?.pump_side?.timeout_sec || 5),
          !!config.defaults?.pump_side?.keepalive,
          !!config.defaults?.pump_side?.reconnect,
          Number(config.defaults?.pump_side?.stale_sec || 180)
        ]
      );

      for (const tank of site.tanks || []) {
        const tankId = `tank-${site.site_code}-${tank.atg_tank_id}`;
        await client.query(
          `INSERT INTO tanks(id, site_id, atg_tank_id, label, product, capacity_liters, active)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            tankId,
            siteId,
            tank.atg_tank_id,
            tank.label,
            tank.product,
            Number(tank.capacity_liters || 0),
            true
          ]
        );
        await client.query(
          `INSERT INTO tank_measurements(
            id, site_id, tank_id, ts, fuel_volume_l, fuel_height_mm, water_height_mm, temp_c, ullage_l, raw_payload
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            `tm-${tankId}`,
            siteId,
            tankId,
            now,
            Math.round(Number(tank.capacity_liters || 0) * 0.68),
            1200,
            20,
            18.2,
            Math.round(Number(tank.capacity_liters || 0) * 0.32),
            "seed"
          ]
        );
      }

      for (const pump of site.pumps || []) {
        const pumpId = `pump-${site.site_code}-${pump.pump_number}`;
        await client.query(
          `INSERT INTO pumps(id, site_id, pump_number, label, active) VALUES ($1,$2,$3,$4,$5)`,
          [pumpId, siteId, Number(pump.pump_number), pump.label, true]
        );
        for (const side of ["A", "B"]) {
          const sideCfg = pump.sides?.[side] || {};
          const sideId = `ps-${pumpId}-${side.toLowerCase()}`;
          await client.query(
            `INSERT INTO pump_sides(id, pump_id, side, ip, port, active) VALUES ($1,$2,$3,$4,$5,$6)`,
            [sideId, pumpId, side, sideCfg.ip || "", Number(sideCfg.port || 5201), true]
          );
          await client.query(
            `INSERT INTO connection_status(id, site_id, kind, target_id, status, last_seen_at, details_json)
             VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
            [`conn-${sideId}`, siteId, "pump_side", sideId, "connected", now, "{}"]
          );
        }
      }

      await client.query(
        `INSERT INTO connection_status(id, site_id, kind, target_id, status, last_seen_at, details_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
        [`conn-atg-${siteId}`, siteId, "atg", null, "connected", now, "{}"]
      );

      const layoutForSite =
        site.site_code === String(layout.siteId)
          ? layout
          : { ...layout, siteId: site.site_code, objects: layout.objects.filter((o) => o.type !== "pump") };
      await client.query(
        `INSERT INTO forecourt_layouts(id, site_id, version, name, json, created_by, created_at, is_active)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)`,
        [
          `layout-${siteId}-v1`,
          siteId,
          1,
          "Initial Layout",
          JSON.stringify(layoutForSite),
          "user-manager",
          now,
          true
        ]
      );
    }

    if (siteIds.length > 0) {
      await client.query(
        "INSERT INTO user_site_assignments(user_id, site_id) VALUES ($1,$2)",
        ["user-operator", siteIds[0]]
      );
      for (const siteId of siteIds) {
        await client.query(
          "INSERT INTO user_site_assignments(user_id, site_id) VALUES ($1,$2)",
          ["user-tech", siteId]
        );
      }
    }

    if (siteIds.length > 0) {
      const firstSite = siteIds[0];
      const firstPump = await client.query("SELECT id FROM pumps WHERE site_id=$1 ORDER BY id LIMIT 1", [
        firstSite
      ]);
      await client.query(
        `INSERT INTO alarm_events(
          id, site_id, source_type, tank_id, pump_id, side, component, severity, state, code, message,
          raw_payload, raised_at, cleared_at, ack_at, ack_by, assigned_to, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [
          "alert-1",
          firstSite,
          "PumpSide",
          null,
          firstPump.rows[0]?.id || null,
          "A",
          "cardreader",
          "warn",
          "raised",
          "CR-204",
          "Card reader timeout",
          "seed",
          now,
          null,
          null,
          null,
          null,
          now
        ]
      );
    }
  });
}

async function seedIfEmpty() {
  await initDb();
  const result = await query("SELECT COUNT(*)::int AS count FROM users");
  if (result.rows[0].count === 0) {
    await seedDatabase();
    return true;
  }
  return false;
}

if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log("Seed complete.");
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { seedDatabase, seedIfEmpty };
