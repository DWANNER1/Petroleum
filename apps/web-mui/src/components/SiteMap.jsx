import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { divIcon } from "leaflet";

const DEFAULT_CENTER = [37.7749, -122.4194];
const geocodeCache = new Map();

function siteQuery(site) {
  return [site.address, site.postalCode].filter(Boolean).join(" ").trim();
}

function hasStoredPoint(site) {
  return Number(site?.lat) !== 0 && Number(site?.lon) !== 0 && Number.isFinite(Number(site?.lat)) && Number.isFinite(Number(site?.lon));
}

async function geocodeSite(site) {
  if (hasStoredPoint(site)) {
    return { lat: Number(site.lat), lon: Number(site.lon) };
  }

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
    const bounds = points.map((point) => [point.lat, point.lon]);
    map.fitBounds(bounds, { padding: [36, 36] });
  }, [map, points]);
  return null;
}

function FocusSelectedPoint({ point }) {
  const map = useMap();
  useEffect(() => {
    if (!point) return;
    map.flyTo([point.lat, point.lon], Math.max(map.getZoom(), 11), {
      animate: true,
      duration: 1.1
    });
  }, [map, point]);
  return null;
}

const selectedSitePin = divIcon({
  className: "site-map-selected-pin-wrap",
  html: '<div style="width:18px;height:18px;border-radius:999px;background:#0b5fff;border:4px solid white;box-shadow:0 4px 16px rgba(11,95,255,.45)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9]
});

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

  const keyed = useMemo(() => points.map((point) => ({ ...point, key: point.site.id })), [points]);
  const selectedPoint = useMemo(() => keyed.find((point) => point.site.id === selectedSiteId) || null, [keyed, selectedSiteId]);

  return (
    <MapContainer center={DEFAULT_CENTER} zoom={5} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToPoints points={keyed} />
      <FocusSelectedPoint point={selectedPoint} />
      {keyed.map(({ key, site, lat, lon }) => (
        <CircleMarker
          key={key}
          center={[lat, lon]}
          radius={8}
          pathOptions={{
            color: "#0f172a",
            fillColor: Number(site.criticalCount || 0) > 0 ? "#d14343" : Number(site.warnCount || 0) > 0 ? "#c77700" : "#0b5fff",
            fillOpacity: 0.88
          }}
          eventHandlers={{ click: () => onSelect(site) }}
        >
          <Popup>
            <strong>{site.name}</strong>
            <div>{site.siteCode}</div>
            <div>{site.address || "No address"}</div>
            <div>{site.postalCode || "ZIP n/a"}</div>
          </Popup>
        </CircleMarker>
      ))}
      {selectedPoint ? (
        <Marker position={[selectedPoint.lat, selectedPoint.lon]} icon={selectedSitePin}>
          <Popup>
            <strong>{selectedPoint.site.name}</strong>
            <div>{selectedPoint.site.siteCode}</div>
          </Popup>
        </Marker>
      ) : null}
    </MapContainer>
  );
}
