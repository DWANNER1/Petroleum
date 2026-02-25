import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";

function cloneLayout(layout) {
  return JSON.parse(JSON.stringify(layout));
}

export function LayoutEditorPage() {
  const { siteId } = useParams();
  const [layout, setLayout] = useState(null);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [drag, setDrag] = useState(null);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    api
      .getLayout(siteId)
      .then((data) => {
        const copy = cloneLayout(data);
        setLayout(copy);
        setSelectedId(copy.json?.objects?.[0]?.id || "");
      })
      .catch((err) => setError(err.message));
  }, [siteId]);

  const selected = useMemo(
    () => layout?.json?.objects?.find((obj) => obj.id === selectedId) || null,
    [layout, selectedId]
  );

  function updateObject(id, patch) {
    setLayout((prev) => {
      if (!prev) return prev;
      const copy = cloneLayout(prev);
      copy.json.objects = copy.json.objects.map((obj) =>
        obj.id === id ? { ...obj, ...patch } : obj
      );
      return copy;
    });
  }

  function onPointerDown(e, id) {
    const rect = e.currentTarget.getBoundingClientRect();
    const obj = layout?.json?.objects?.find((o) => o.id === id);
    if (!obj) return;
    setSelectedId(id);
    setDrag({
      id,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      startX: obj.x || 0,
      startY: obj.y || 0
    });
  }

  function onPointerMove(e) {
    if (!drag) return;
    const canvas = document.getElementById("layout-editor-canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left - drag.offsetX);
    const y = Math.round(e.clientY - rect.top - drag.offsetY);
    updateObject(drag.id, { x, y });
  }

  function onPointerUp() {
    setDrag(null);
  }

  async function saveLayout() {
    if (!layout) return;
    setSaveMessage("Saving...");
    try {
      const payload = {
        name: `Layout v${layout.version + 1}`,
        json: layout.json
      };
      const result = await api.saveLayout(siteId, payload);
      setLayout(cloneLayout(result));
      setSaveMessage(`Saved version ${result.version}.`);
    } catch (err) {
      setSaveMessage(`Save failed: ${err.message}`);
    }
  }

  if (error) return <div className="card severity-critical">{error}</div>;
  if (!layout) return <div className="card">Loading layout editor...</div>;

  return (
    <div>
      <h2>Forecourt Layout Editor</h2>
      <div className="card inline">
        <div>Site: {siteId}</div>
        <div>Version: {layout.version}</div>
        <button onClick={saveLayout}>Save New Version</button>
        <Link to={`/sites/${siteId}/layout`}>Viewer</Link>
        <span>{saveMessage}</span>
      </div>

      <div className="editor-grid">
        <div
          id="layout-editor-canvas"
          className="layout-canvas"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {layout.json.objects.map((obj) => (
            <div
              key={obj.id}
              className={`layout-object object-${obj.type} ${selectedId === obj.id ? "selected" : ""}`}
              style={{
                left: obj.x ?? 40,
                top: obj.y ?? 40,
                width: obj.w ?? 120,
                height: obj.h ?? 80,
                transform: `rotate(${obj.rotation || 0}deg)`
              }}
              onPointerDown={(e) => onPointerDown(e, obj.id)}
            >
              {obj.label || obj.type}
            </div>
          ))}
        </div>

        <div className="card">
          <h3>Properties</h3>
          {!selected && <div>Select an object</div>}
          {selected && (
            <>
              <div>ID: {selected.id}</div>
              <div>Type: {selected.type}</div>
              <div className="inline">
                <button onClick={() => updateObject(selected.id, { x: (selected.x || 0) - 10 })}>Left</button>
                <button onClick={() => updateObject(selected.id, { x: (selected.x || 0) + 10 })}>Right</button>
                <button onClick={() => updateObject(selected.id, { y: (selected.y || 0) - 10 })}>Up</button>
                <button onClick={() => updateObject(selected.id, { y: (selected.y || 0) + 10 })}>Down</button>
              </div>
              <div className="inline">
                <button
                  onClick={() =>
                    updateObject(selected.id, { rotation: ((selected.rotation || 0) + 90) % 360 })
                  }
                >
                  Rotate 90
                </button>
                <button onClick={() => updateObject(selected.id, { w: Math.max(40, (selected.w || 120) - 20) })}>
                  Width -
                </button>
                <button onClick={() => updateObject(selected.id, { w: (selected.w || 120) + 20 })}>Width +</button>
                <button onClick={() => updateObject(selected.id, { h: Math.max(30, (selected.h || 80) - 20) })}>
                  Height -
                </button>
                <button onClick={() => updateObject(selected.id, { h: (selected.h || 80) + 20 })}>Height +</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
