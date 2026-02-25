import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

const emptySiteForm = {
  siteCode: "",
  name: "",
  address: "",
  region: "",
  lat: "",
  lon: ""
};

const emptyTankForm = {
  atgTankId: "",
  label: "",
  product: "",
  capacityLiters: ""
};

const emptyPumpForm = {
  pumpNumber: "",
  label: "",
  sideAip: "",
  sideBip: "",
  port: "5201"
};

export function AdminPage() {
  const [sites, setSites] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [siteForm, setSiteForm] = useState(emptySiteForm);
  const [integrationForm, setIntegrationForm] = useState({
    atgHost: "",
    atgPort: "10001",
    atgPollIntervalSec: "60"
  });
  const [tankForm, setTankForm] = useState(emptyTankForm);
  const [pumpForm, setPumpForm] = useState(emptyPumpForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadSites() {
    try {
      const rows = await api.getSites();
      setSites(rows);
      if (!selectedSiteId && rows.length > 0) setSelectedSiteId(rows[0].id);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadSites();
  }, []);

  useEffect(() => {
    if (!selectedSiteId) return;
    api
      .getSite(selectedSiteId)
      .then((site) => {
        setIntegrationForm({
          atgHost: site.integration?.atgHost || "",
          atgPort: String(site.integration?.atgPort || 10001),
          atgPollIntervalSec: String(site.integration?.atgPollIntervalSec || 60)
        });
      })
      .catch((err) => setError(err.message));
  }, [selectedSiteId]);

  const selectedSite = useMemo(
    () => sites.find((s) => s.id === selectedSiteId) || null,
    [sites, selectedSiteId]
  );

  async function submitCreateSite(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const created = await api.createSite({
        siteCode: siteForm.siteCode.trim(),
        name: siteForm.name.trim(),
        address: siteForm.address.trim(),
        region: siteForm.region.trim(),
        lat: Number(siteForm.lat || 0),
        lon: Number(siteForm.lon || 0)
      });
      setMessage(`Created site ${created.name} (${created.id})`);
      setSiteForm(emptySiteForm);
      await loadSites();
      setSelectedSiteId(created.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitIntegration(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.updateIntegrations(selectedSiteId, {
        atgHost: integrationForm.atgHost.trim(),
        atgPort: Number(integrationForm.atgPort || 10001),
        atgPollIntervalSec: Number(integrationForm.atgPollIntervalSec || 60)
      });
      setMessage("Integration settings saved.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitTank(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.addTank(selectedSiteId, {
        atgTankId: tankForm.atgTankId.trim(),
        label: tankForm.label.trim(),
        product: tankForm.product.trim(),
        capacityLiters: Number(tankForm.capacityLiters || 0)
      });
      setMessage("Tank added.");
      setTankForm(emptyTankForm);
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitPump(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.addPump(selectedSiteId, {
        pumpNumber: Number(pumpForm.pumpNumber || 0),
        label: pumpForm.label.trim(),
        sides: {
          A: { ip: pumpForm.sideAip.trim(), port: Number(pumpForm.port || 5201) },
          B: { ip: pumpForm.sideBip.trim(), port: Number(pumpForm.port || 5201) }
        }
      });
      setMessage("Pump added.");
      setPumpForm(emptyPumpForm);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="admin-page">
      <div className="section-header">
        <h3>Admin</h3>
        <span>Create and configure stations/assets from GUI</span>
      </div>
      {message && <div className="card admin-success">{message}</div>}
      {error && <div className="card severity-critical">{error}</div>}

      <div className="grid">
        <section className="card">
          <h3>Create Site</h3>
          <form className="admin-form" onSubmit={submitCreateSite}>
            <input
              placeholder="Site Code (e.g. 1040)"
              value={siteForm.siteCode}
              onChange={(e) => setSiteForm((f) => ({ ...f, siteCode: e.target.value }))}
              required
            />
            <input
              placeholder="Site Name"
              value={siteForm.name}
              onChange={(e) => setSiteForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <input
              placeholder="Address"
              value={siteForm.address}
              onChange={(e) => setSiteForm((f) => ({ ...f, address: e.target.value }))}
            />
            <input
              placeholder="Region"
              value={siteForm.region}
              onChange={(e) => setSiteForm((f) => ({ ...f, region: e.target.value }))}
            />
            <div className="inline">
              <input
                placeholder="Latitude"
                value={siteForm.lat}
                onChange={(e) => setSiteForm((f) => ({ ...f, lat: e.target.value }))}
              />
              <input
                placeholder="Longitude"
                value={siteForm.lon}
                onChange={(e) => setSiteForm((f) => ({ ...f, lon: e.target.value }))}
              />
            </div>
            <button type="submit">Create Site</button>
          </form>
        </section>

        <section className="card">
          <h3>Manage Existing Site</h3>
          <select value={selectedSiteId} onChange={(e) => setSelectedSiteId(e.target.value)}>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name} ({site.siteCode})
              </option>
            ))}
          </select>
          {selectedSite && (
            <div className="admin-meta">
              <div><strong>{selectedSite.name}</strong></div>
              <div>{selectedSite.id}</div>
              <div>{selectedSite.address}</div>
            </div>
          )}
        </section>
      </div>

      {selectedSiteId && (
        <div className="grid">
          <section className="card">
            <h3>Integration Settings</h3>
            <form className="admin-form" onSubmit={submitIntegration}>
              <input
                placeholder="ATG Host"
                value={integrationForm.atgHost}
                onChange={(e) => setIntegrationForm((f) => ({ ...f, atgHost: e.target.value }))}
              />
              <div className="inline">
                <input
                  placeholder="ATG Port"
                  value={integrationForm.atgPort}
                  onChange={(e) => setIntegrationForm((f) => ({ ...f, atgPort: e.target.value }))}
                />
                <input
                  placeholder="Poll Interval (sec)"
                  value={integrationForm.atgPollIntervalSec}
                  onChange={(e) =>
                    setIntegrationForm((f) => ({ ...f, atgPollIntervalSec: e.target.value }))
                  }
                />
              </div>
              <button type="submit">Save Integrations</button>
            </form>
          </section>

          <section className="card">
            <h3>Add Tank</h3>
            <form className="admin-form" onSubmit={submitTank}>
              <input
                placeholder="ATG Tank ID"
                value={tankForm.atgTankId}
                onChange={(e) => setTankForm((f) => ({ ...f, atgTankId: e.target.value }))}
                required
              />
              <input
                placeholder="Tank Label"
                value={tankForm.label}
                onChange={(e) => setTankForm((f) => ({ ...f, label: e.target.value }))}
                required
              />
              <input
                placeholder="Product (Regular/Premium/etc)"
                value={tankForm.product}
                onChange={(e) => setTankForm((f) => ({ ...f, product: e.target.value }))}
                required
              />
              <input
                placeholder="Capacity Liters"
                value={tankForm.capacityLiters}
                onChange={(e) => setTankForm((f) => ({ ...f, capacityLiters: e.target.value }))}
                required
              />
              <button type="submit">Add Tank</button>
            </form>
          </section>

          <section className="card">
            <h3>Add Pump</h3>
            <form className="admin-form" onSubmit={submitPump}>
              <input
                placeholder="Pump Number"
                value={pumpForm.pumpNumber}
                onChange={(e) => setPumpForm((f) => ({ ...f, pumpNumber: e.target.value }))}
                required
              />
              <input
                placeholder="Pump Label"
                value={pumpForm.label}
                onChange={(e) => setPumpForm((f) => ({ ...f, label: e.target.value }))}
                required
              />
              <input
                placeholder="Side A IP"
                value={pumpForm.sideAip}
                onChange={(e) => setPumpForm((f) => ({ ...f, sideAip: e.target.value }))}
                required
              />
              <input
                placeholder="Side B IP"
                value={pumpForm.sideBip}
                onChange={(e) => setPumpForm((f) => ({ ...f, sideBip: e.target.value }))}
                required
              />
              <input
                placeholder="Port"
                value={pumpForm.port}
                onChange={(e) => setPumpForm((f) => ({ ...f, port: e.target.value }))}
              />
              <button type="submit">Add Pump</button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
