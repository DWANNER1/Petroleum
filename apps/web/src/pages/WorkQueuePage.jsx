import { useEffect, useState } from "react";
import { api } from "../api";

export function WorkQueuePage() {
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    severity: "",
    component: "",
    site: ""
  });

  async function load() {
    try {
      const rows = await api.getAlerts({ state: "raised" });
      setAlerts(rows);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function ack(id) {
    await api.ackAlert(id);
    await load();
  }

  const filtered = alerts.filter((alert) => {
    if (filters.severity && alert.severity !== filters.severity) return false;
    if (filters.component && alert.component !== filters.component) return false;
    if (filters.site && !alert.siteId.toLowerCase().includes(filters.site.toLowerCase())) return false;
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
          <input
            placeholder="Site filter"
            value={filters.site}
            onChange={(e) => setFilters((f) => ({ ...f, site: e.target.value }))}
          />
        </div>
      </div>

      {error && <div className="card severity-critical">{error}</div>}
      <table className="table">
        <thead>
          <tr>
            <th>Age</th>
            <th>Severity</th>
            <th>Site</th>
            <th>Device</th>
            <th>Side</th>
            <th>Component</th>
            <th>Message</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((alert) => (
            <tr key={alert.id}>
              <td>{alert.raisedAt ? `${Math.max(1, Math.round((Date.now() - new Date(alert.raisedAt).getTime()) / 60000))}m` : "-"}</td>
              <td className={alert.severity === "critical" ? "severity-critical" : "severity-warn"}>
                {alert.severity}
              </td>
              <td>{alert.siteId}</td>
              <td>{alert.pumpId || alert.tankId || "-"}</td>
              <td>{alert.side || "-"}</td>
              <td>{alert.component}</td>
              <td>{alert.message}</td>
              <td>
                <button onClick={() => ack(alert.id)}>Acknowledge</button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={8}>No active alerts matching filters.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
