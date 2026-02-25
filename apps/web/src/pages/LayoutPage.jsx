import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { LayoutCanvas } from "../components/LayoutCanvas";

export function LayoutPage() {
  const { siteId } = useParams();
  const [layout, setLayout] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getLayout(siteId).then(setLayout).catch((err) => setError(err.message));
  }, [siteId]);

  if (error) return <div className="card severity-critical">{error}</div>;
  if (!layout) return <div className="card">Loading layout...</div>;

  return (
    <div>
      <h2>Forecourt Layout</h2>
      <div className="card">
        <div>Site: {siteId}</div>
        <div>Version: {layout.version}</div>
        <div>Name: {layout.name}</div>
        <div className="inline">
          <Link to={`/sites/${siteId}/layout/edit`}>Open Editor</Link>
        </div>
      </div>
      <LayoutCanvas layout={layout} />
    </div>
  );
}
