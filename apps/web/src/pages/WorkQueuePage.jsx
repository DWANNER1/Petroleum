import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

function durationLabel(ts) {
  if (!ts) return "-";
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(ts).getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export function WorkQueuePage() {
  const [alerts, setAlerts] = useState([]);
  const [sites, setSites] = useState([]);
  const [siteAssets, setSiteAssets] = useState({ pumps: [], tanks: [] });
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    severity: "",
    component: "",
    siteId: "",
    pumpId: "",
    tankId: ""
  });

  async function load() {
    try {
      const [alertRows, siteRows] = await Promise.all([
        api.getAlerts({ state: "raised" }),
        api.getSites()
      ]);
      setAlerts(alertRows);
      setSites(siteRows);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!filters.siteId) {
      setSiteAssets({ pumps: [], tanks: [] });
      setFilters((f) => ({ ...f, pumpId: "", tankId: "" }));
      return;
    }
    api
      .getSite(filters.siteId)
      .then((site) => setSiteAssets({ pumps: site.pumps || [], tanks: site.tanks || [] }))
      .catch((err) => setError(err.message));
  }, [filters.siteId]);

  async function ack(id) {
    await api.ackAlert(id);
    await load();
  }

  const siteById = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);

  const filtered = alerts.filter((alert) => {
    if (filters.severity && alert.severity !== filters.severity) return false;
    if (filters.component && alert.component !== filters.component) return false;
    if (filters.siteId && alert.siteId !== filters.siteId) return false;
    if (filters.pumpId && alert.pumpId !== filters.pumpId) return false;
    if (filters.tankId && alert.tankId !== filters.tankId) return false;
    return true;
  });

  return (
    <div>
      <div className="card">
        <div className="section-header">
          <h3>Filters</h3>
          <span>Service tech queue controls</span>
        </div>
        <div className="filter-row">
          <select
            value={filters.severity}
            onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value }))}
          >
            <option value="">All Severity</option>
            <option value="critical">Critical</option>
            <option value="warn">Warn</option>
            <option value="info">Info</option>
          </select>
          <select
            value={filters.component}
            onChange={(e) => setFilters((f) => ({ ...f, component: e.target.value }))}
          >
            <option value="">All Components</option>
            <option value="cardreader">Card Reader</option>
            <option value="printer">Printer</option>
            <option value="atg">ATG</option>
          </select>
          <select
            value={filters.siteId}
            onChange={(e) => setFilters((f) => ({ ...f, siteId: e.target.value }))}
          >
            <option value="">All Stores</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.siteCode} - {site.name}
              </option>
            ))}
          </select>
          {filters.siteId && (
            <>
              <select
                value={filters.pumpId}
                onChange={(e) => setFilters((f) => ({ ...f, pumpId: e.target.value }))}
              >
                <option value="">All Pumps</option>
                {siteAssets.pumps.map((pump) => (
                  <option key={pump.id} value={pump.id}>
                    Pump {pump.pumpNumber}: {pump.label}
                  </option>
                ))}
              </select>
              <select
                value={filters.tankId}
                onChange={(e) => setFilters((f) => ({ ...f, tankId: e.target.value }))}
              >
                <option value="">All Tanks</option>
                {siteAssets.tanks.map((tank) => (
                  <option key={tank.id} value={tank.id}>
                    Tank {tank.atgTankId}: {tank.label}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {error && <div className="card severity-critical">{error}</div>}
      <table className="table">
        <thead>
          <tr>
            <th>Duration</th>
            <th>Severity</th>
            <th>Site</th>
            <th>Store Name</th>
            <th>Device</th>
            <th>Side</th>
            <th>Component</th>
            <th>Message</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((alert) => {
            const site = siteById.get(alert.siteId);
            return (
              <tr key={alert.id}>
                <td>{durationLabel(alert.raisedAt)}</td>
                <td className={alert.severity === "critical" ? "severity-critical" : "severity-warn"}>
                  {alert.severity}
                </td>
                <td>{site?.siteCode || alert.siteId}</td>
                <td>{site?.name || "-"}</td>
                <td>{alert.pumpId || alert.tankId || "-"}</td>
                <td>{alert.side || "-"}</td>
                <td>{alert.component}</td>
                <td>{alert.message}</td>
                <td>
                  <button onClick={() => ack(alert.id)}>Acknowledge</button>
                </td>
              </tr>
            );
          })}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={9}>No active alerts matching filters.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
