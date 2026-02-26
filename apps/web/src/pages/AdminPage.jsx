import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import pumpIcon from "../assets/pump.svg";
import tankIcon from "../assets/tank.svg";

const emptyCreateStation = {
  siteCode: "",
  name: "",
  address: "",
  postalCode: "",
  region: ""
};

const emptyStationEdit = { name: "", address: "", postalCode: "", region: "" };
const emptyConfig = { atgHost: "", atgPort: "10001", atgPollIntervalSec: "60" };
const emptyTank = { atgTankId: "", label: "", product: "", capacityLiters: "" };
const emptyPump = { pumpNumber: "", label: "", sideAip: "", sideBip: "", port: "5201" };

export function AdminPage() {
  const [sites, setSites] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [siteDetail, setSiteDetail] = useState(null);
  const [pumpsWithSides, setPumpsWithSides] = useState([]);
  const [activePanel, setActivePanel] = useState("station");
  const [selectedTankId, setSelectedTankId] = useState("");
  const [selectedPumpId, setSelectedPumpId] = useState("");
  const [createStationForm, setCreateStationForm] = useState(emptyCreateStation);
  const [stationEditForm, setStationEditForm] = useState(emptyStationEdit);
  const [configForm, setConfigForm] = useState(emptyConfig);
  const [tankForm, setTankForm] = useState(emptyTank);
  const [pumpForm, setPumpForm] = useState(emptyPump);
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

  async function loadSelectedSite(siteId) {
    if (!siteId) {
      setSiteDetail(null);
      setPumpsWithSides([]);
      return;
    }
    try {
      const [site, pumpRows] = await Promise.all([api.getSite(siteId), api.getPumps(siteId)]);
      setSiteDetail(site);
      setPumpsWithSides(pumpRows);
      setStationEditForm({
        name: site.name || "",
        address: site.address || "",
        postalCode: site.postalCode || "",
        region: site.region || ""
      });
      setConfigForm({
        atgHost: site.integration?.atgHost || "",
        atgPort: String(site.integration?.atgPort || 10001),
        atgPollIntervalSec: String(site.integration?.atgPollIntervalSec || 60)
      });
      setSelectedTankId("");
      setSelectedPumpId("");
      setTankForm(emptyTank);
      setPumpForm(emptyPump);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadSites();
  }, []);

  useEffect(() => {
    loadSelectedSite(selectedSiteId);
  }, [selectedSiteId]);

  const selectedSite = useMemo(
    () => sites.find((s) => s.id === selectedSiteId) || null,
    [sites, selectedSiteId]
  );

  const tanks = siteDetail?.tanks || [];
  const pumps = pumpsWithSides || [];

  function clearStatus() {
    setMessage("");
    setError("");
  }

  function requireStation() {
    if (!selectedSiteId) {
      setError("Select a station first.");
      return false;
    }
    return true;
  }

  async function submitCreateStation(e) {
    e.preventDefault();
    clearStatus();
    try {
      const created = await api.createSite({
        siteCode: createStationForm.siteCode.trim(),
        name: createStationForm.name.trim(),
        address: createStationForm.address.trim(),
        postalCode: createStationForm.postalCode.trim(),
        region: createStationForm.region.trim()
      });
      setMessage(`Created station ${created.siteCode}.`);
      setCreateStationForm(emptyCreateStation);
      await loadSites();
      setSelectedSiteId(created.id);
      setActivePanel("station");
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveStationEdit(e) {
    e.preventDefault();
    clearStatus();
    if (!requireStation()) return;
    try {
      await api.updateSite(selectedSiteId, {
        name: stationEditForm.name.trim(),
        address: stationEditForm.address.trim(),
        postalCode: stationEditForm.postalCode.trim(),
        region: stationEditForm.region.trim()
      });
      setMessage("Station updated.");
      await loadSites();
      await loadSelectedSite(selectedSiteId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteStation() {
    clearStatus();
    if (!requireStation()) return;
    if (!confirm("Delete this station and all its pumps/tanks/layouts?")) return;
    try {
      await api.deleteSite(selectedSiteId);
      setMessage("Station deleted.");
      setSelectedSiteId("");
      setSiteDetail(null);
      setPumpsWithSides([]);
      await loadSites();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveConfig(e) {
    e.preventDefault();
    clearStatus();
    if (!requireStation()) return;
    try {
      await api.updateIntegrations(selectedSiteId, {
        atgHost: configForm.atgHost.trim(),
        atgPort: Number(configForm.atgPort || 10001),
        atgPollIntervalSec: Number(configForm.atgPollIntervalSec || 60)
      });
      setMessage("Config saved.");
    } catch (err) {
      setError(err.message);
    }
  }

  function selectTank(tank) {
    setActivePanel("tank");
    setSelectedTankId(tank.id);
    setTankForm({
      atgTankId: tank.atgTankId || "",
      label: tank.label || "",
      product: tank.product || "",
      capacityLiters: String(tank.capacityLiters ?? "")
    });
  }

  function startAddTank() {
    if (!requireStation()) return;
    setActivePanel("tank");
    setSelectedTankId("");
    setTankForm(emptyTank);
  }

  async function saveTank(e) {
    e.preventDefault();
    clearStatus();
    if (!requireStation()) return;
    try {
      const payload = {
        atgTankId: tankForm.atgTankId.trim(),
        label: tankForm.label.trim(),
        product: tankForm.product.trim(),
        capacityLiters: Number(tankForm.capacityLiters || 0)
      };
      if (selectedTankId) {
        await api.updateTank(selectedTankId, payload);
        setMessage("Tank updated.");
      } else {
        await api.addTank(selectedSiteId, payload);
        setMessage("Tank added.");
      }
      await loadSelectedSite(selectedSiteId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteTank(tankId) {
    clearStatus();
    if (!requireStation()) return;
    if (!confirm("Delete this tank?")) return;
    try {
      await api.deleteTank(tankId);
      setMessage("Tank deleted.");
      if (selectedTankId === tankId) {
        setSelectedTankId("");
        setTankForm(emptyTank);
      }
      await loadSelectedSite(selectedSiteId);
    } catch (err) {
      setError(err.message);
    }
  }

  function pumpSideByCode(pump, code) {
    return (pump.sides || []).find((s) => s.side === code) || { ip: "", port: 5201 };
  }

  function selectPump(pump) {
    setActivePanel("pump");
    setSelectedPumpId(pump.id);
    const sideA = pumpSideByCode(pump, "A");
    const sideB = pumpSideByCode(pump, "B");
    setPumpForm({
      pumpNumber: String(pump.pumpNumber || ""),
      label: pump.label || "",
      sideAip: sideA.ip || "",
      sideBip: sideB.ip || "",
      port: String(sideA.port || sideB.port || 5201)
    });
  }

  function startAddPump() {
    if (!requireStation()) return;
    setActivePanel("pump");
    setSelectedPumpId("");
    setPumpForm(emptyPump);
  }

  async function savePump(e) {
    e.preventDefault();
    clearStatus();
    if (!requireStation()) return;
    try {
      const payload = {
        pumpNumber: Number(pumpForm.pumpNumber || 0),
        label: pumpForm.label.trim(),
        sides: {
          A: { ip: pumpForm.sideAip.trim(), port: Number(pumpForm.port || 5201) },
          B: { ip: pumpForm.sideBip.trim(), port: Number(pumpForm.port || 5201) }
        }
      };
      if (selectedPumpId) {
        await api.updatePump(selectedPumpId, payload);
        setMessage("Pump updated.");
      } else {
        await api.addPump(selectedSiteId, payload);
        setMessage("Pump added.");
      }
      await loadSelectedSite(selectedSiteId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function deletePump(pumpId) {
    clearStatus();
    if (!requireStation()) return;
    if (!confirm("Delete this pump?")) return;
    try {
      await api.deletePump(pumpId);
      setMessage("Pump deleted.");
      if (selectedPumpId === pumpId) {
        setSelectedPumpId("");
        setPumpForm(emptyPump);
      }
      await loadSelectedSite(selectedSiteId);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="admin-page">
      <div className="section-header">
        <h3>Admin</h3>
        <span>Manage stations, configs, tanks, and pumps</span>
      </div>

      {message && <div className="card admin-success">{message}</div>}
      {error && <div className="card severity-critical">{error}</div>}

      <div className="admin-top card">
        <div className="admin-top-row">
          <form className="admin-form create-station-form" onSubmit={submitCreateStation}>
            <strong>Create Station</strong>
            <input placeholder="Station Number / Site Code" value={createStationForm.siteCode} onChange={(e) => setCreateStationForm((f) => ({ ...f, siteCode: e.target.value }))} required />
            <input placeholder="Station Name" value={createStationForm.name} onChange={(e) => setCreateStationForm((f) => ({ ...f, name: e.target.value }))} required />
            <input placeholder="Address" value={createStationForm.address} onChange={(e) => setCreateStationForm((f) => ({ ...f, address: e.target.value }))} required />
            <input placeholder="ZIP Code" value={createStationForm.postalCode} onChange={(e) => setCreateStationForm((f) => ({ ...f, postalCode: e.target.value }))} required />
            <input placeholder="Region" value={createStationForm.region} onChange={(e) => setCreateStationForm((f) => ({ ...f, region: e.target.value }))} />
            <button type="submit">Create Station</button>
          </form>

          <div className="station-select-wrap">
            <strong>Select Station to Edit</strong>
            <select value={selectedSiteId} onChange={(e) => setSelectedSiteId(e.target.value)}>
              <option value="">Select station...</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.siteCode} - {site.name}
                </option>
              ))}
            </select>
            {selectedSite && (
              <div className="admin-meta">
                <div><strong>{selectedSite.siteCode} - {selectedSite.name}</strong></div>
                <div>{selectedSite.address}</div>
                <div>{selectedSite.postalCode || "ZIP n/a"}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="admin-layout">
        <aside className="card admin-left-pane">
          <div className="left-section-title">Edit Panel</div>
          <button className={`left-panel-btn ${activePanel === "station" ? "left-panel-btn-active" : ""}`} onClick={() => setActivePanel("station")} disabled={!selectedSiteId}>
            Station Info
          </button>
          <button className={`left-panel-btn ${activePanel === "config" ? "left-panel-btn-active" : ""}`} onClick={() => setActivePanel("config")} disabled={!selectedSiteId}>
            Config
          </button>

          <div className="left-section-title">Tanks</div>
          <div className="icon-grid">
            {tanks.map((tank, idx) => (
              <div key={tank.id} className={`icon-card ${selectedTankId === tank.id ? "icon-card-active" : ""}`} onClick={() => selectTank(tank)}>
                <button className="delete-x" onClick={(e) => { e.stopPropagation(); deleteTank(tank.id); }}>x</button>
                <img src={tankIcon} alt="tank" className="asset-icon" />
                <div>Tank {idx + 1}</div>
              </div>
            ))}
          </div>
          <button onClick={startAddTank} disabled={!selectedSiteId}>+ Add Tank</button>

          <div className="left-section-title">Pumps</div>
          <div className="icon-grid">
            {pumps.map((pump, idx) => (
              <div key={pump.id} className={`icon-card ${selectedPumpId === pump.id ? "icon-card-active" : ""}`} onClick={() => selectPump(pump)}>
                <button className="delete-x" onClick={(e) => { e.stopPropagation(); deletePump(pump.id); }}>x</button>
                <img src={pumpIcon} alt="pump" className="asset-icon" />
                <div>Pump {idx + 1}</div>
              </div>
            ))}
          </div>
          <button onClick={startAddPump} disabled={!selectedSiteId}>+ Add Pump</button>
        </aside>

        <section className={`card admin-right-pane ${!selectedSiteId ? "pane-disabled" : ""}`}>
          {!selectedSiteId && <div>Select a station to edit station/config/tank/pump data.</div>}

          {selectedSiteId && activePanel === "station" && (
            <form className="admin-form" onSubmit={saveStationEdit}>
              <h3>Station Info</h3>
              <input value={selectedSite?.siteCode || ""} readOnly placeholder="Station Number" />
              <input value={stationEditForm.name} onChange={(e) => setStationEditForm((f) => ({ ...f, name: e.target.value }))} placeholder="Station Name" required />
              <input value={stationEditForm.address} onChange={(e) => setStationEditForm((f) => ({ ...f, address: e.target.value }))} placeholder="Address" required />
              <input value={stationEditForm.postalCode} onChange={(e) => setStationEditForm((f) => ({ ...f, postalCode: e.target.value }))} placeholder="ZIP Code" required />
              <input value={stationEditForm.region} onChange={(e) => setStationEditForm((f) => ({ ...f, region: e.target.value }))} placeholder="Region" />
              <div className="inline">
                <button type="submit">Save Station</button>
                <button type="button" className="danger-btn" onClick={deleteStation}>Delete Station</button>
              </div>
            </form>
          )}

          {selectedSiteId && activePanel === "config" && (
            <form className="admin-form" onSubmit={saveConfig}>
              <h3>Configuration</h3>
              <input value={configForm.atgHost} onChange={(e) => setConfigForm((f) => ({ ...f, atgHost: e.target.value }))} placeholder="ATG Host" />
              <input value={configForm.atgPort} onChange={(e) => setConfigForm((f) => ({ ...f, atgPort: e.target.value }))} placeholder="ATG Port" />
              <input value={configForm.atgPollIntervalSec} onChange={(e) => setConfigForm((f) => ({ ...f, atgPollIntervalSec: e.target.value }))} placeholder="Poll Interval (sec)" />
              <button type="submit">Save Config</button>
            </form>
          )}

          {selectedSiteId && activePanel === "tank" && (
            <form className="admin-form" onSubmit={saveTank}>
              <h3>{selectedTankId ? "Edit Tank" : "Add Tank"}</h3>
              <input value={tankForm.atgTankId} onChange={(e) => setTankForm((f) => ({ ...f, atgTankId: e.target.value }))} placeholder="Tank Number (ATG ID)" required />
              <input value={tankForm.label} onChange={(e) => setTankForm((f) => ({ ...f, label: e.target.value }))} placeholder="Tank Label" required />
              <input value={tankForm.product} onChange={(e) => setTankForm((f) => ({ ...f, product: e.target.value }))} placeholder="Product" required />
              <input value={tankForm.capacityLiters} onChange={(e) => setTankForm((f) => ({ ...f, capacityLiters: e.target.value }))} placeholder="Capacity Liters" required />
              <button type="submit">{selectedTankId ? "Save Tank" : "Create Tank"}</button>
            </form>
          )}

          {selectedSiteId && activePanel === "pump" && (
            <form className="admin-form" onSubmit={savePump}>
              <h3>{selectedPumpId ? "Edit Pump" : "Add Pump"}</h3>
              <input value={pumpForm.pumpNumber} onChange={(e) => setPumpForm((f) => ({ ...f, pumpNumber: e.target.value }))} placeholder="Pump Number" required />
              <input value={pumpForm.label} onChange={(e) => setPumpForm((f) => ({ ...f, label: e.target.value }))} placeholder="Pump Label" required />
              <input value={pumpForm.sideAip} onChange={(e) => setPumpForm((f) => ({ ...f, sideAip: e.target.value }))} placeholder="Side A IP" required />
              <input value={pumpForm.sideBip} onChange={(e) => setPumpForm((f) => ({ ...f, sideBip: e.target.value }))} placeholder="Side B IP" required />
              <input value={pumpForm.port} onChange={(e) => setPumpForm((f) => ({ ...f, port: e.target.value }))} placeholder="Port" />
              <button type="submit">{selectedPumpId ? "Save Pump" : "Create Pump"}</button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
