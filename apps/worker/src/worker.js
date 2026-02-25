const fs = require("fs");
const path = require("path");

const storePath = path.resolve(__dirname, "../../../data/store.json");

function readStore() {
  if (!fs.existsSync(storePath)) return null;
  return JSON.parse(fs.readFileSync(storePath, "utf8"));
}

function writeStore(store) {
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");
}

function workerTick() {
  const store = readStore();
  if (!store) return;
  const now = new Date().toISOString();

  for (const conn of store.connectionStatus || []) {
    if (conn.kind === "pump_side" && Math.random() < 0.03) {
      conn.status = conn.status === "connected" ? "disconnected" : "connected";
      conn.lastSeenAt = now;
    }
  }

  if (Math.random() < 0.08 && (store.tanks || []).length > 0) {
    const tank = store.tanks[Math.floor(Math.random() * store.tanks.length)];
    store.alerts.push({
      id: `alert-worker-${Date.now()}`,
      siteId: tank.siteId,
      sourceType: "ATG",
      tankId: tank.id,
      pumpId: null,
      side: null,
      component: "atg",
      severity: "warn",
      state: "raised",
      code: "ATG-SIM",
      message: "Synthetic ATG variance alert",
      rawPayload: "worker-simulator",
      raisedAt: now,
      clearedAt: null,
      ackAt: null,
      ackBy: null,
      assignedTo: null,
      createdAt: now
    });
  }

  writeStore(store);
}

console.log("petroleum-worker simulator started");
setInterval(workerTick, 7000);
