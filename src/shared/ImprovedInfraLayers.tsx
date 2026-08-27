import { fetchJson } from '../utils/fetchCache';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { GeoJSON, CircleMarker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { AirportPopup, FerryPopup } from './EnhancedPointPopups';

/**
 * InfrastructureLayersComponent - Renders infrastructure features from unified DB
 * - Airports (point features) with enhanced popups
 * - Ferry routes (line/point features) with enhanced popups
 *
 * Protected areas are intentionally not rendered here — the base map
 * already shows that data, so this overlay would be redundant.
 *
 * All data is sourced from unified_db via exported GeoJSON files
 */

export function ImprovedInfraLayers() {
  const [airports, setAirports] = useState<GeoJSON.FeatureCollection | null>(null);
  const [ferries, setFerries] = useState<GeoJSON.FeatureCollection | null>(null);
  const [selectedAirport, setSelectedAirport] = useState<number | null>(null);
  const [selectedFerry, setSelectedFerry] = useState<number | null>(null);

  useEffect(() => {
    // Load infrastructure geometries
    Promise.all([
      fetchJson(`${import.meta.env.BASE_URL}data/airports.geojson`).catch(() => null),
      fetchJson(`${import.meta.env.BASE_URL}data/ferries.geojson`).catch(() => null),
    ]).then(([ap, fer]) => {
      if (ap) setAirports(ap);
      if (fer) setFerries(fer);
    });
  }, []);

  // Style for ferry routes
  const ferryStyle = (feature?: GeoJSON.Feature): L.PathOptions => {
    const geomType = feature?.geometry?.type;

    if (geomType === 'LineString') {
      return {
        color: '#06b6d4',
        weight: 3,
        opacity: 0.7,
        dashArray: '5, 5',
      };
    }
    // Point fallback
    return {};
  };

  return (
    <>
      {/* Ferry Routes (Lines/Points) */}
      {ferries && (
        <GeoJSON
          data={ferries as GeoJSON.GeoJsonObject}
          style={ferryStyle}
          pointToLayer={(feature, latlng) => {
            const props = feature.properties as Record<string, any>;
            const idx = ferries.features.indexOf(feature);
            const marker = L.circleMarker(latlng, {
              radius: 6, color: '#06b6d4', fillColor: '#06b6d4', fillOpacity: 0.8, weight: 2,
            });
            marker.on('click', () => setSelectedFerry(selectedFerry === idx ? null : idx));
            const div = document.createElement('div');
            div.style.maxWidth = '300px';
            const root = ReactDOM.createRoot(div);
            root.render(<FerryPopup properties={props} coordinates={[latlng.lat, latlng.lng]}/>);
            marker.bindPopup(div, { maxWidth: 320 });
            return marker;
          }}
          onEachFeature={(feature, layer) => {
            if (feature.geometry.type === 'LineString') {
              const props = feature.properties as { name?: string };
              const name = props.name || 'Ferry Route';
              layer.bindTooltip(name, { permanent: false });

              // Add click popup for lines
              const coords = (feature.geometry as any).coordinates || [[0, 0]];
              const midpoint = coords[Math.floor(coords.length / 2)];
              layer.bindPopup(() => {
                const div = document.createElement('div');
                const root = ReactDOM.createRoot(div);
                root.render(
                  <FerryPopup
                    properties={props}
                    coordinates={[midpoint[1] || 0, midpoint[0] || 0]}
                  />
                );
                return div;
              }, {
                maxWidth: 320,
                maxHeight: 400,
                className: 'enhanced-popup',
              });
            }
          }}
        />
      )}

      {/* Airports (Points) */}
      {airports && airports.features.map((feature, idx) => {
        const coords = (feature.geometry as any).coordinates;
        const props = feature.properties as Record<string, any>;

        return (
          <CircleMarker
            key={idx}
            center={[coords[1], coords[0]]}
            radius={7}
            pathOptions={{
              color: '#818cf8',
              fillColor: '#818cf8',
              fillOpacity: 0.85,
              weight: 2,
            }}
            eventHandlers={{
              click: () => setSelectedAirport(selectedAirport === idx ? null : idx),
            }}
          >
            {selectedAirport === idx && (
              <Popup position={[coords[1], coords[0]]}>
                <div style={{ maxWidth: 300 }}>
                  <AirportPopup
                    properties={props}
                    coordinates={[coords[1], coords[0]]}
                  />
                </div>
              </Popup>
            )}
          </CircleMarker>
        );
      })}
    </>
  );
}

// (ReactDOM reference removed — duplicate import cleaned up)
