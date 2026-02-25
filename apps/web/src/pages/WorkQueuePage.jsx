import { useEffect, useState } from "react";
import { api } from "../api";

export function WorkQueuePage() {
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState("");

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

  return (
    <div>
      <h2>Work Queue</h2>
      {error && <div className="card severity-critical">{error}</div>}
      <table className="table">
        <thead>
          <tr>
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
          {alerts.map((alert) => (
            <tr key={alert.id}>
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
          {alerts.length === 0 && (
            <tr>
              <td colSpan={7}>No active alerts.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
