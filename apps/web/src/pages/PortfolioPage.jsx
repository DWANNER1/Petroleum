import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export function PortfolioPage() {
  const [sites, setSites] = useState([]);
  const [error, setError] = useState("");
  const [selectedSite, setSelectedSite] = useState(null);

  useEffect(() => {
    api
      .getSites()
      .then((rows) => {
        setSites(rows);
        setSelectedSite(rows[0] || null);
      })
      .catch((err) => setError(err.message));
  }, []);

  const totals = sites.reduce(
    (acc, site) => {
      acc.critical += site.criticalCount || 0;
      acc.warn += site.warnCount || 0;
      return acc;
    },
    { critical: 0, warn: 0 }
  );

  return (
    <div>
      <div className="stats-row">
        <div className="metric-card">
          <div className="metric-label">Total Sites</div>
          <div className="metric-value">{sites.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Critical Alerts</div>
          <div className="metric-value severity-critical">{totals.critical}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Warning Alerts</div>
          <div className="metric-value severity-warn">{totals.warn}</div>
        </div>
      </div>

      {error && <div className="card severity-critical">{error}</div>}

      <div className="split-layout">
        <section className="card map-panel">
          <div className="section-header">
            <h3>Portfolio Map</h3>
            <span>Map-first overview</span>
          </div>
          <div className="mock-map">
            {sites.map((site) => (
              <button
                key={site.id}
                className={`map-pin ${selectedSite?.id === site.id ? "map-pin-active" : ""}`}
                style={{
                  left: `${20 + ((site.lon + 180) % 60)}%`,
                  top: `${20 + ((site.lat + 90) % 50)}%`
                }}
                onClick={() => setSelectedSite(site)}
              >
                {site.criticalCount > 0 ? "!" : "OK"}
              </button>
            ))}
          </div>
          {selectedSite && (
            <div className="drawer">
              <div className="drawer-title">{selectedSite.name}</div>
              <div>Site Code: {selectedSite.siteCode}</div>
              <div>
                Pump Sides: {selectedSite.pumpSidesConnected}/{selectedSite.pumpSidesExpected}
              </div>
              <div className="inline">
                <Link to={`/sites/${selectedSite.id}`}>Open Site Detail</Link>
                <Link to={`/sites/${selectedSite.id}/layout`}>Open Layout</Link>
              </div>
            </div>
          )}
        </section>

        <section className="card queue-panel">
          <div className="section-header">
            <h3>Needs Attention</h3>
            <span>By severity and connectivity</span>
          </div>
          <div className="stack">
            {sites.map((site) => (
              <button key={site.id} className="queue-item" onClick={() => setSelectedSite(site)}>
                <div>
                  <strong>{site.name}</strong>
                  <div className="queue-sub">Code {site.siteCode} | {site.region}</div>
                </div>
                <div className="queue-badges">
                  <span className="badge badge-critical">{site.criticalCount}</span>
                  <span className="badge badge-warn">{site.warnCount}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
