import { useEffect, useState } from 'react';

interface GeoJSONData {
  type: string;
  features: unknown[];
}

interface WaterLayers {
  lakes: GeoJSONData | null;
  rivers: GeoJSONData | null;
  loading: boolean;
}

// Module-level cache — shared across all map instances
let _lakes: GeoJSONData | null = null;
let _rivers: GeoJSONData | null = null;
let _promise: Promise<void> | null = null;

function loadWaterData(): Promise<void> {
  if (_promise) return _promise;
  const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL;
  _promise = Promise.all([
    fetch(`${base}data/uganda_lakes.geojson`).then(r => r.json()).catch(() => null),
    fetch(`${base}data/uganda_rivers.geojson`).then(r => r.json()).catch(() => null),
  ]).then(([lakes, rivers]) => {
    _lakes  = lakes;
    _rivers = rivers;
  });
  return _promise;
}

export function useWaterLayers(): WaterLayers {
  const [ready, setReady] = useState(_lakes !== null && _rivers !== null);

  useEffect(() => {
    if (ready) return;
    loadWaterData().then(() => setReady(true));
  }, [ready]);

  return { lakes: _lakes, rivers: _rivers, loading: !ready };
}
