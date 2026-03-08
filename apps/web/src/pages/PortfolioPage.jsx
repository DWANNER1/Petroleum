import { Component, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { SiteMap } from "../components/SiteMap";

class MapErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Portfolio map failed to render", error);
  }

  render() {
    const { hasError } = this.state;
    const { fallback, children } = this.props;
    return hasError ? fallback : children;
  }
}

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
          <MapErrorBoundary
            fallback={
              <div className="card portfolio-map-fallback">
                <strong>Map unavailable</strong>
                <div>The site list is still available below while the map is unavailable.</div>
              </div>
            }
          >
            <SiteMap sites={sites} selectedSiteId={selectedSite?.id} onSelect={setSelectedSite} />
          </MapErrorBoundary>
          {selectedSite && (
            <div className="drawer">
              <div className="drawer-title">{selectedSite.name}</div>
              <div>Site Code: {selectedSite.siteCode}</div>
              <div>
                Address: {selectedSite.address || "n/a"} {selectedSite.postalCode || ""}
              </div>
              <div>
                Pump Sides: {selectedSite.pumpSidesConnected}/{selectedSite.pumpSidesExpected}
              </div>
              <div className="inline">
                <Link to={`/sites/${selectedSite.id}`}>Open Site Detail</Link>
                <Link to={`/sites/${selectedSite.id}/layout`}>Open Layout</Link>
                <Link to={`/work-queue?siteId=${encodeURIComponent(selectedSite.id)}`}>Alerts</Link>
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

      <section className="card portfolio-site-table">
        <div className="section-header">
          <h3>Site Directory</h3>
          <span>Always-visible portfolio summary</span>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Site</th>
                <th>Code</th>
                <th>Region</th>
                <th>Address</th>
                <th>Alerts</th>
              </tr>
            </thead>
            <tbody>
              {sites.length ? (
                sites.map((site) => (
                  <tr key={site.id}>
                    <td>
                      <button className="table-link-button" onClick={() => setSelectedSite(site)}>
                        {site.name}
                      </button>
                    </td>
                    <td>{site.siteCode}</td>
                    <td>{site.region || "n/a"}</td>
                    <td>{[site.address, site.postalCode].filter(Boolean).join(" ") || "n/a"}</td>
                    <td>{(site.criticalCount || 0) + (site.warnCount || 0)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>No sites available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
