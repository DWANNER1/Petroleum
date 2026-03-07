import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function durationLabel(ms) {
  if (ms == null || ms < 0) return "-";
  const minutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function eventTs(alert) {
  return new Date(alert.eventAt || alert.raisedAt || alert.clearedAt || alert.createdAt).getTime();
}

function incidentKey(alert) {
  return [
    alert.siteId,
    alert.sourceType,
    alert.tankId || "-",
    alert.pumpId || "-",
    alert.side || "-",
    alert.component || "-",
    alert.alertTypeId || alert.code || alert.alertType || "-"
  ].join("|");
}

function isClearEvent(alert) {
  return alert.reportedState === "CLR" || alert.state === "cleared";
}

function normalizeAlerts(alerts) {
  const ascending = [...alerts].sort((a, b) => eventTs(a) - eventTs(b));
  const incidentState = new Map();
  const enriched = [];

  for (const alert of ascending) {
    const key = incidentKey(alert);
    const ts = eventTs(alert);
    const current = incidentState.get(key) || {
      firstSetAt: null,
      resolved: false,
      setIds: []
    };

    let durationMs = null;
    let canAcknowledge = false;
    let rowState = "default";

    if (alert.reportedState === "SET") {
      if (current.firstSetAt != null) {
        durationMs = ts - current.firstSetAt;
      }
      if (current.firstSetAt == null) {
        current.firstSetAt = ts;
      }
      current.resolved = false;
      current.setIds.push(alert.id);
      canAcknowledge = true;
      rowState = alert.state === "acknowledged" ? "acknowledged" : "set";
    } else if (isClearEvent(alert)) {
      durationMs = current.firstSetAt != null ? ts - current.firstSetAt : null;
      current.firstSetAt = null;
      current.resolved = true;
      current.setIds = [];
      rowState = "cleared";
    }

    incidentState.set(key, current);
    enriched.push({
      ...alert,
      incidentKey: key,
      durationMs,
      canAcknowledge,
      rowState
    });
  }

  const activeSetIds = new Set();
  for (const [, state] of incidentState) {
    if (!state.resolved) {
      for (const setId of state.setIds) activeSetIds.add(setId);
    }
  }

  return enriched
    .map((alert) => {
      let rowClass = "";
      if (alert.rowState === "acknowledged" && activeSetIds.has(alert.id)) rowClass = "queue-row-acknowledged";
      else if (alert.rowState === "set" && activeSetIds.has(alert.id)) rowClass = "queue-row-active-set";
      else if (alert.rowState === "cleared") rowClass = "queue-row-cleared";

      return {
        ...alert,
        canAcknowledge: alert.canAcknowledge && activeSetIds.has(alert.id),
        rowClass
      };
    })
    .sort((a, b) => eventTs(b) - eventTs(a));
}

export function WorkQueuePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSiteId = searchParams.get("siteId") || "";
  const [alerts, setAlerts] = useState([]);
  const [sites, setSites] = useState([]);
  const [siteAssets, setSiteAssets] = useState({ pumps: [], tanks: [] });
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    severity: "",
    component: "",
    siteId: initialSiteId,
    pumpId: "",
    tankId: ""
  });

  async function load() {
    try {
      const [alertRows, siteRows] = await Promise.all([
        api.getAlerts(),
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
    const siteIdFromUrl = searchParams.get("siteId") || "";
    setFilters((current) => {
      if (current.siteId === siteIdFromUrl) return current;
      return { ...current, siteId: siteIdFromUrl, pumpId: "", tankId: "" };
    });
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    if (filters.siteId) nextParams.set("siteId", filters.siteId);
    else nextParams.delete("siteId");
    const nextString = nextParams.toString();
    const currentString = searchParams.toString();
    if (nextString !== currentString) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [filters.siteId, searchParams, setSearchParams]);

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
  const normalizedAlerts = useMemo(() => normalizeAlerts(alerts), [alerts]);

  const filtered = normalizedAlerts.filter((alert) => {
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
          <select value={filters.severity} onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value }))}>
            <option value="">All Severity</option>
            <option value="critical">Critical</option>
            <option value="warn">Warn</option>
            <option value="info">Info</option>
          </select>
          <select value={filters.component} onChange={(e) => setFilters((f) => ({ ...f, component: e.target.value }))}>
            <option value="">All Components</option>
            <option value="cardreader">Card Reader</option>
            <option value="printer">Printer</option>
            <option value="atg">ATG</option>
          </select>
          <select value={filters.siteId} onChange={(e) => setFilters((f) => ({ ...f, siteId: e.target.value, pumpId: "", tankId: "" }))}>
            <option value="">All Stores</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>{site.siteCode} - {site.name}</option>
            ))}
          </select>
          {filters.siteId && (
            <>
              <select value={filters.pumpId} onChange={(e) => setFilters((f) => ({ ...f, pumpId: e.target.value }))}>
                <option value="">All Pumps</option>
                {siteAssets.pumps.map((pump) => (
                  <option key={pump.id} value={pump.id}>Pump {pump.pumpNumber}: {pump.label}</option>
                ))}
              </select>
              <select value={filters.tankId} onChange={(e) => setFilters((f) => ({ ...f, tankId: e.target.value }))}>
                <option value="">All Tanks</option>
                {siteAssets.tanks.map((tank) => (
                  <option key={tank.id} value={tank.id}>Tank {tank.atgTankId}: {tank.label}</option>
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
            <th>Event Time</th>
            <th>Alert Type</th>
            <th>Type ID</th>
            <th>Severity</th>
            <th>Reported</th>
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
              <tr key={alert.id} className={alert.rowClass}>
                <td>{alert.reportedState === "SET" || isClearEvent(alert) ? durationLabel(alert.durationMs) : "-"}</td>
                <td>{formatDateTime(alert.eventAt || alert.raisedAt || alert.createdAt)}</td>
                <td>{alert.alertType || "-"}</td>
                <td>{alert.alertTypeId || "-"}</td>
                <td className={alert.severity === "critical" ? "severity-critical" : alert.severity === "warn" ? "severity-warn" : ""}>{alert.severity}</td>
                <td>{alert.reportedState || "-"}</td>
                <td>{site?.siteCode || alert.siteId}</td>
                <td>{site?.name || "-"}</td>
                <td>{alert.pumpId || alert.tankId || "-"}</td>
                <td>{alert.side || "-"}</td>
                <td>{alert.component}</td>
                <td>{alert.message}</td>
                <td>{alert.canAcknowledge ? <button onClick={() => ack(alert.id)}>Acknowledge</button> : "-"}</td>
              </tr>
            );
          })}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={13}>No alert events matching filters.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
