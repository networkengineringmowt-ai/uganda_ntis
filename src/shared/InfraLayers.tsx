import { useEffect, useState } from 'react';
import { GeoJSON, CircleMarker, Popup } from 'react-leaflet';
import type { PathOptions } from 'leaflet';

interface GeoJSONData {
  type: string;
  features: { properties: Record<string, string | number | null>; geometry: unknown }[];
}

// ── Module-level singleton cache ───────────────────────────────────────────────
let _ferries: GeoJSONData | null = null;
let _airports: GeoJSONData | null = null;
let _railways: GeoJSONData | null = null;
let _infraPromise: Promise<void> | null = null;

function loadInfraData(): Promise<void> {
  if (_infraPromise) return _infraPromise;
  const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL;
  _infraPromise = Promise.all([
    fetch(`${base}data/uganda_ferries.geojson`).then(r => r.json()).catch(() => null),
    fetch(`${base}data/uganda_airports.geojson`).then(r => r.json()).catch(() => null),
    fetch(`${base}data/uganda_railways.geojson`).then(r => r.json()).catch(() => null),
  ]).then(([ferries, airports, railways]) => {
    _ferries  = ferries;
    _airports = airports;
    _railways = railways;
  });
  return _infraPromise;
}

function useInfraLayers() {
  const [ready, setReady] = useState(
    _ferries !== null && _airports !== null && _railways !== null,
  );
  useEffect(() => {
    if (ready) return;
    loadInfraData().then(() => setReady(true));
  }, [ready]);
  return { ferries: _ferries, airports: _airports, railways: _railways };
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const FERRY_STYLE: PathOptions = {
  color: '#22d3ee', weight: 1.8, opacity: 0.7, dashArray: '6 4',
  fill: false,
};

function railwayStyle(f: GeoJSONData['features'][number]): PathOptions {
  const { type, status } = f.properties as { type: string; status: string };
  if (type === 'SGR')                        return { color: '#fbbf24', weight: 2.5, opacity: 0.85, dashArray: '8 3' };
  if (type === 'MGR' && status === 'operational') return { color: '#d97706', weight: 2,   opacity: 0.65 };
  return { color: '#78716c', weight: 1.5, opacity: 0.4, dashArray: '4 4' };
}

// ── Component ──────────────────────────────────────────────────────────────────
export function InfraLayers() {
  const { ferries, airports, railways } = useInfraLayers();

  return (
    <>
      {railways && (
        <GeoJSON
          key="il-railways"
          data={railways as never}
          style={f => railwayStyle(f as GeoJSONData['features'][number])}
        />
      )}
      {ferries && (
        <GeoJSON
          key="il-ferries"
          data={ferries as never}
          style={() => FERRY_STYLE}
        />
      )}
      {airports?.features.map((f, i) => {
        const p = f.properties;
        const isIntl = p.type === 'international';
        const coords = (f.geometry as { coordinates: [number, number] }).coordinates;
        return (
          <CircleMarker
            key={`airport-${i}`}
            center={[coords[1], coords[0]]}
            radius={isIntl ? 8 : 5}
            pathOptions={{
              color: isIntl ? '#818cf8' : '#94a3b8',
              fillColor: isIntl ? '#818cf8' : '#94a3b8',
              fillOpacity: isIntl ? 0.85 : 0.6,
              weight: 1,
              opacity: 0.9,
            }}
          >
            <Popup>
              <div style={{ fontFamily: "'Inter','Segoe UI',sans-serif", fontSize: 12 }}>
                <strong>{p.name as string}</strong>
                {p.iata && <div style={{ color: '#64748b' }}>IATA: {p.iata as string}</div>}
                <div style={{ color: '#64748b', textTransform: 'capitalize' }}>
                  {p.type as string} · {p.region as string}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
