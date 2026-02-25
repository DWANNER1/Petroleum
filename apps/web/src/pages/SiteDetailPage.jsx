import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";

export function SiteDetailPage() {
  const { siteId } = useParams();
  const [site, setSite] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getSite(siteId).then(setSite).catch((err) => setError(err.message));
  }, [siteId]);

  if (error) return <div className="card severity-critical">{error}</div>;
  if (!site) return <div className="card">Loading site...</div>;

  return (
    <div>
      <h2>{site.name}</h2>
      <div className="card">
        <div>Site Code: {site.siteCode}</div>
        <div>Region: {site.region}</div>
        <div>Address: {site.address}</div>
        <div>ATG Host: {site.integration?.atgHost || "-"}</div>
        <div>
          Pump Connectivity: {site.pumpSidesConnected}/{site.pumpSidesExpected}
        </div>
        <div className="inline">
          <Link to={`/sites/${siteId}/layout`}>Open Layout</Link>
          <Link to={`/sites/${siteId}/layout/edit`}>Edit Layout</Link>
        </div>
      </div>

      <h3>Tanks</h3>
      <div className="grid">
        {(site.tanks || []).map((tank) => (
          <div className="card" key={tank.id}>
            <strong>{tank.label}</strong>
            <div>Product: {tank.product}</div>
            <div>Capacity: {tank.capacityLiters} L</div>
          </div>
        ))}
      </div>

      <h3>Pumps</h3>
      <div className="grid">
        {(site.pumps || []).map((pump) => (
          <div className="card" key={pump.id}>
            <strong>{pump.label}</strong>
            <div>Pump Number: {pump.pumpNumber}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
