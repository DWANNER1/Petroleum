import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

const emptyCreateSiteForm = {
  siteCode: "",
  name: "",
  address: "",
  postalCode: "",
  region: ""
};

const emptyEditSiteForm = {
  name: "",
  address: "",
  postalCode: "",
  region: ""
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
  const [createSiteForm, setCreateSiteForm] = useState(emptyCreateSiteForm);
  const [editSiteForm, setEditSiteForm] = useState(emptyEditSiteForm);
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
        setEditSiteForm({
          name: site.name || "",
          address: site.address || "",
          postalCode: site.postalCode || "",
          region: site.region || ""
        });
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

  function clearStatus() {
    setError("");
    setMessage("");
  }

  async function submitCreateSite(e) {
    e.preventDefault();
    clearStatus();
    try {
      const created = await api.createSite({
        siteCode: createSiteForm.siteCode.trim(),
        name: createSiteForm.name.trim(),
        address: createSiteForm.address.trim(),
        postalCode: createSiteForm.postalCode.trim(),
        region: createSiteForm.region.trim()
      });
      setMessage(`Created site ${created.name} (${created.id}).`);
      setCreateSiteForm(emptyCreateSiteForm);
      await loadSites();
      setSelectedSiteId(created.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitEditSite(e) {
    e.preventDefault();
    clearStatus();
    if (!selectedSiteId) {
      setError("Select a station before editing station information.");
      return;
    }
    try {
      await api.updateSite(selectedSiteId, {
        name: editSiteForm.name.trim(),
        address: editSiteForm.address.trim(),
        postalCode: editSiteForm.postalCode.trim(),
        region: editSiteForm.region.trim()
      });
      setMessage("Station information updated.");
      await loadSites();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitIntegration(e) {
    e.preventDefault();
    clearStatus();
    if (!selectedSiteId) {
      setError("Select a station before updating integration settings.");
      return;
    }
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
    clearStatus();
    if (!selectedSiteId) {
      setError("Select a station before adding tanks.");
      return;
    }
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
    clearStatus();
    if (!selectedSiteId) {
      setError("Select a station before adding pumps.");
      return;
    }
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
        <span>Create and manage stations from GUI</span>
      </div>
      {message && <div className="card admin-success">{message}</div>}
      {error && <div className="card severity-critical">{error}</div>}

      <div className="grid">
        <section className="card">
          <h3>Create Station</h3>
          <form className="admin-form" onSubmit={submitCreateSite}>
            <input
              placeholder="Site Code (e.g. 1040)"
              value={createSiteForm.siteCode}
              onChange={(e) => setCreateSiteForm((f) => ({ ...f, siteCode: e.target.value }))}
              required
            />
            <input
              placeholder="Station Name"
              value={createSiteForm.name}
              onChange={(e) => setCreateSiteForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <input
              placeholder="Street/City/State Address"
              value={createSiteForm.address}
              onChange={(e) => setCreateSiteForm((f) => ({ ...f, address: e.target.value }))}
              required
            />
            <input
              placeholder="ZIP Code"
              value={createSiteForm.postalCode}
              onChange={(e) => setCreateSiteForm((f) => ({ ...f, postalCode: e.target.value }))}
              required
            />
            <input
              placeholder="Region"
              value={createSiteForm.region}
              onChange={(e) => setCreateSiteForm((f) => ({ ...f, region: e.target.value }))}
            />
            <button type="submit">Create Station</button>
          </form>
        </section>

        <section className="card">
          <h3>Select Station</h3>
          <select value={selectedSiteId} onChange={(e) => setSelectedSiteId(e.target.value)}>
            <option value="">Select station...</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name} ({site.siteCode})
              </option>
            ))}
          </select>
          {selectedSite ? (
            <div className="admin-meta">
              <div><strong>{selectedSite.name}</strong></div>
              <div>{selectedSite.id}</div>
              <div>{selectedSite.address}</div>
              <div>{selectedSite.postalCode || "ZIP n/a"}</div>
            </div>
          ) : (
            <div className="admin-warning">You must select a station before editing station, pump, tank, or integration data.</div>
          )}
        </section>
      </div>

      <div className={`grid ${!selectedSiteId ? "grid-disabled" : ""}`}>
        <section className="card">
          <h3>Edit Station Info</h3>
          <form className="admin-form" onSubmit={submitEditSite}>
            <input
              placeholder="Station Name"
              value={editSiteForm.name}
              onChange={(e) => setEditSiteForm((f) => ({ ...f, name: e.target.value }))}
              required
              disabled={!selectedSiteId}
            />
            <input
              placeholder="Street/City/State Address"
              value={editSiteForm.address}
              onChange={(e) => setEditSiteForm((f) => ({ ...f, address: e.target.value }))}
              required
              disabled={!selectedSiteId}
            />
            <input
              placeholder="ZIP Code"
              value={editSiteForm.postalCode}
              onChange={(e) => setEditSiteForm((f) => ({ ...f, postalCode: e.target.value }))}
              required
              disabled={!selectedSiteId}
            />
            <input
              placeholder="Region"
              value={editSiteForm.region}
              onChange={(e) => setEditSiteForm((f) => ({ ...f, region: e.target.value }))}
              disabled={!selectedSiteId}
            />
            <button type="submit" disabled={!selectedSiteId}>Save Station</button>
          </form>
        </section>

        <section className="card">
          <h3>Integration Settings</h3>
          <form className="admin-form" onSubmit={submitIntegration}>
            <input
              placeholder="ATG Host"
              value={integrationForm.atgHost}
              onChange={(e) => setIntegrationForm((f) => ({ ...f, atgHost: e.target.value }))}
              disabled={!selectedSiteId}
            />
            <div className="inline">
              <input
                placeholder="ATG Port"
                value={integrationForm.atgPort}
                onChange={(e) => setIntegrationForm((f) => ({ ...f, atgPort: e.target.value }))}
                disabled={!selectedSiteId}
              />
              <input
                placeholder="Poll Interval (sec)"
                value={integrationForm.atgPollIntervalSec}
                onChange={(e) =>
                  setIntegrationForm((f) => ({ ...f, atgPollIntervalSec: e.target.value }))
                }
                disabled={!selectedSiteId}
              />
            </div>
            <button type="submit" disabled={!selectedSiteId}>Save Integrations</button>
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
              disabled={!selectedSiteId}
            />
            <input
              placeholder="Tank Label"
              value={tankForm.label}
              onChange={(e) => setTankForm((f) => ({ ...f, label: e.target.value }))}
              required
              disabled={!selectedSiteId}
            />
            <input
              placeholder="Product (Regular/Premium/etc)"
              value={tankForm.product}
              onChange={(e) => setTankForm((f) => ({ ...f, product: e.target.value }))}
              required
              disabled={!selectedSiteId}
            />
            <input
              placeholder="Capacity Liters"
              value={tankForm.capacityLiters}
              onChange={(e) => setTankForm((f) => ({ ...f, capacityLiters: e.target.value }))}
              required
              disabled={!selectedSiteId}
            />
            <button type="submit" disabled={!selectedSiteId}>Add Tank</button>
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
              disabled={!selectedSiteId}
            />
            <input
              placeholder="Pump Label"
              value={pumpForm.label}
              onChange={(e) => setPumpForm((f) => ({ ...f, label: e.target.value }))}
              required
              disabled={!selectedSiteId}
            />
            <input
              placeholder="Side A IP"
              value={pumpForm.sideAip}
              onChange={(e) => setPumpForm((f) => ({ ...f, sideAip: e.target.value }))}
              required
              disabled={!selectedSiteId}
            />
            <input
              placeholder="Side B IP"
              value={pumpForm.sideBip}
              onChange={(e) => setPumpForm((f) => ({ ...f, sideBip: e.target.value }))}
              required
              disabled={!selectedSiteId}
            />
            <input
              placeholder="Port"
              value={pumpForm.port}
              onChange={(e) => setPumpForm((f) => ({ ...f, port: e.target.value }))}
              disabled={!selectedSiteId}
            />
            <button type="submit" disabled={!selectedSiteId}>Add Pump</button>
          </form>
        </section>
      </div>
    </div>
  );
}
