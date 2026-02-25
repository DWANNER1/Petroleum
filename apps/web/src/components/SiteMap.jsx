import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";

const DEFAULT_CENTER = [39.8283, -98.5795];
const geocodeCache = new Map();

function siteQuery(site) {
  return [site.address, site.postalCode].filter(Boolean).join(" ").trim();
}

async function geocodeSite(site) {
  const query = siteQuery(site);
  if (!query) return null;
  if (geocodeCache.has(query)) return geocodeCache.get(query);

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) return null;
  const rows = await response.json();
  const point = rows?.[0]
    ? { lat: Number(rows[0].lat), lon: Number(rows[0].lon) }
    : null;
  geocodeCache.set(query, point);
  return point;
}

function FitToPoints({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lon], 12);
      return;
    }
    const bounds = points.map((p) => [p.lat, p.lon]);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points]);
  return null;
}

export function SiteMap({ sites, onSelect, selectedSiteId }) {
  const [points, setPoints] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const rows = await Promise.all(
        sites.map(async (site) => {
          const resolved = await geocodeSite(site);
          if (!resolved) return null;
          return { ...resolved, site };
        })
      );
      if (alive) setPoints(rows.filter(Boolean));
    })();
    return () => {
      alive = false;
    };
  }, [sites]);

  const keyed = useMemo(() => points.map((p) => ({ ...p, key: p.site.id })), [points]);

  return (
    <div className="real-map">
      <MapContainer center={DEFAULT_CENTER} zoom={4} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToPoints points={keyed} />
        {keyed.map(({ key, site, lat, lon }) => (
          <CircleMarker
            key={key}
            center={[lat, lon]}
            radius={selectedSiteId === site.id ? 10 : 8}
            pathOptions={{
              color: selectedSiteId === site.id ? "#0f3f5a" : "#276c90",
              fillColor: site.criticalCount > 0 ? "#c53e30" : "#2f7e4d",
              fillOpacity: 0.9
            }}
            eventHandlers={{ click: () => onSelect(site) }}
          >
            <Popup>
              <strong>{site.name}</strong>
              <div>{site.address}</div>
              <div>{site.postalCode || "ZIP n/a"}</div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
