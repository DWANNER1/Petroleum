import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export function PortfolioPage() {
  const [sites, setSites] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getSites().then(setSites).catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <h2>Portfolio</h2>
      {error && <div className="card severity-critical">{error}</div>}
      <div className="grid">
        {sites.map((site) => (
          <div className="card" key={site.id}>
            <h3>{site.name}</h3>
            <div>Code: {site.siteCode}</div>
            <div>Region: {site.region}</div>
            <div className="severity-critical">Critical: {site.criticalCount}</div>
            <div className="severity-warn">Warn: {site.warnCount}</div>
            <div>
              Sides Connected: {site.pumpSidesConnected}/{site.pumpSidesExpected}
            </div>
            <div className="inline">
              <Link to={`/sites/${site.id}`}>Site Detail</Link>
              <Link to={`/sites/${site.id}/layout`}>Layout</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
