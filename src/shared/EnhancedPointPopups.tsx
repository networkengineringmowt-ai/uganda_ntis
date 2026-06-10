import React from 'react';
import { Popup } from 'react-leaflet';
import { MapPin, Navigation, Info, AlertCircle } from 'lucide-react';

/**
 * Rich popup content components for all point features
 * - Enhanced with icons, structured data, and contextual information
 * - Sourced from unified database geometries
 */

interface PopupProps {
  properties: Record<string, any>;
  coordinates: [number, number];
  type: 'airport' | 'ferry' | 'bridge' | 'culvert' | 'maintenance_station' | 'traffic_count' | 'weighbridge' | 'protected_area';
}

export function AirportPopup({ properties, coordinates }: Omit<PopupProps, 'type'>) {
  const category = properties.Category || properties.category || 'Airfield';
  const name = properties.name || properties.F9 || 'Unknown Airport';
  const lat = properties.Lat || properties.latitude || coordinates[0];
  const lon = properties.Long || properties.longitude || coordinates[1];

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      maxWidth: '280px',
      fontFamily: "'Inter','Segoe UI',sans-serif",
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
        color: 'white',
        padding: '12px 14px',
        borderBottom: '2px solid #4f46e5',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
          ✈ {name}
        </div>
        <div style={{ fontSize: 11, opacity: 0.9 }}>
          {category}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '12px 14px', fontSize: 12 }}>
        {/* Location */}
        <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>
            Location
          </div>
          <div style={{ fontSize: 12, color: '#1f2937', fontWeight: 500 }}>
            {lat.toFixed(4)}°N, {lon.toFixed(4)}°E
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
            Click to open in maps
          </div>
        </div>

        {/* Category */}
        <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>
            Type
          </div>
          <div style={{
            display: 'inline-block',
            padding: '4px 8px',
            background: '#eef2ff',
            color: '#4f46e5',
            borderRadius: '4px',
            fontSize: 11,
            fontWeight: 600,
          }}>
            {category}
          </div>
        </div>

        {/* Additional properties if available */}
        {Object.keys(properties).length > 3 && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280' }}>
            <details style={{ cursor: 'pointer' }}>
              <summary style={{ fontWeight: 600, marginBottom: 6 }}>More Details</summary>
              {Object.entries(properties).slice(0, 5).map(([key, val]) => (
                <div key={key} style={{ marginTop: 4, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                  <span style={{ color: '#9ca3af' }}>{key}:</span>
                  <span style={{ color: '#374151', fontWeight: 500 }}>{String(val).substring(0, 20)}</span>
                </div>
              ))}
            </details>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        background: '#f9fafb',
        padding: '8px 14px',
        fontSize: 10,
        color: '#9ca3af',
        textAlign: 'center',
        borderTop: '1px solid #e5e7eb',
      }}>
        Source: Uganda Airports Database
      </div>
    </div>
  );
}

export function FerryPopup({ properties, coordinates }: Omit<PopupProps, 'type'>) {
  const name = properties.Ferry_cros || properties.name || 'Ferry Route';
  const waterBody = properties.Water_body || 'Unknown Water Body';
  const status = properties.Category || 'Operational';
  const remarks = properties.Remarks || '';
  const lat = coordinates[0];
  const lon = coordinates[1];

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      maxWidth: '300px',
      fontFamily: "'Inter','Segoe UI',sans-serif",
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
        color: 'white',
        padding: '12px 14px',
        borderBottom: '2px solid #0e7490',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
          ⛴ {name}
        </div>
        <div style={{ fontSize: 11, opacity: 0.9 }}>
          {waterBody}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '12px 14px', fontSize: 12 }}>
        {/* Status */}
        <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>
            Status
          </div>
          <div style={{
            display: 'inline-block',
            padding: '4px 8px',
            background: status === 'Operational' ? '#d1fae5' : '#fef3c7',
            color: status === 'Operational' ? '#065f46' : '#92400e',
            borderRadius: '4px',
            fontSize: 11,
            fontWeight: 600,
          }}>
            {status}
          </div>
        </div>

        {/* Location */}
        <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>
            Location
          </div>
          <div style={{ fontSize: 12, color: '#1f2937', fontWeight: 500 }}>
            {lat.toFixed(4)}°N, {lon.toFixed(4)}°E
          </div>
        </div>

        {/* Remarks */}
        {remarks && (
          <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>
              Route Information
            </div>
            <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.4 }}>
              {remarks}
            </div>
          </div>
        )}

        {/* Water Body */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>
            Water Body
          </div>
          <div style={{
            display: 'inline-block',
            padding: '4px 8px',
            background: '#cffafe',
            color: '#0c4a6e',
            borderRadius: '4px',
            fontSize: 11,
            fontWeight: 600,
          }}>
            {waterBody}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        background: '#f9fafb',
        padding: '8px 14px',
        fontSize: 10,
        color: '#9ca3af',
        textAlign: 'center',
        borderTop: '1px solid #e5e7eb',
      }}>
        Source: Uganda Ferry Routes Database
      </div>
    </div>
  );
}

export function ProtectedAreaPopup({ properties, coordinates }: Omit<PopupProps, 'type'>) {
  const name = properties.name || properties.Name || 'Protected Area';
  const areaType = properties.type || properties.Type || 'Protected Area';
  const lat = coordinates[0];
  const lon = coordinates[1];

  const getAreaColor = (type: string) => {
    if (type.includes('Forest')) return { bg: '#dcfce7', text: '#166534', label: 'Forest Reserve' };
    if (type.includes('National Park')) return { bg: '#dbeafe', text: '#0c4a6e', label: 'National Park' };
    if (type.includes('Wetland')) return { bg: '#d1fae5', text: '#065f46', label: 'Wetland' };
    return { bg: '#f3e8ff', text: '#6b21a8', label: 'Protected Area' };
  };

  const areaColor = getAreaColor(areaType);

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      maxWidth: '300px',
      fontFamily: "'Inter','Segoe UI',sans-serif",
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
        color: 'white',
        padding: '12px 14px',
        borderBottom: '2px solid #166534',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
          🌳 {name}
        </div>
        <div style={{ fontSize: 11, opacity: 0.9 }}>
          {areaType}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '12px 14px', fontSize: 12 }}>
        {/* Type */}
        <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>
            Category
          </div>
          <div style={{
            display: 'inline-block',
            padding: '4px 8px',
            background: areaColor.bg,
            color: areaColor.text,
            borderRadius: '4px',
            fontSize: 11,
            fontWeight: 600,
          }}>
            {areaColor.label}
          </div>
        </div>

        {/* Location */}
        <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>
            Approximate Center
          </div>
          <div style={{ fontSize: 12, color: '#1f2937', fontWeight: 500 }}>
            {lat.toFixed(4)}°N, {lon.toFixed(4)}°E
          </div>
        </div>

        {/* Info */}
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #dcfce7',
          borderRadius: '4px',
          padding: '8px',
          fontSize: 11,
          color: '#166534',
          display: 'flex',
          gap: '8px',
        }}>
          <span style={{ fontSize: 14 }}>ℹ</span>
          <span>This area is protected under Uganda's environmental conservation laws.</span>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        background: '#f9fafb',
        padding: '8px 14px',
        fontSize: 10,
        color: '#9ca3af',
        textAlign: 'center',
        borderTop: '1px solid #e5e7eb',
      }}>
        Source: Uganda Protected Areas Database
      </div>
    </div>
  );
}

export function BridgePopup({ properties, coordinates }: Omit<PopupProps, 'type'>) {
  const name = properties.bridge_name || properties.name || 'Bridge';
  const linkId = properties.link_id || 'Unknown';
  const structureType = properties.structure_type || 'Bridge Structure';
  const span = properties.span_m || 'Unknown';
  const condition = properties.condition_rating || 'Unknown';
  const yearBuilt = properties.year_built || 'Unknown';
  const lat = coordinates[0] || properties.latitude;
  const lon = coordinates[1] || properties.longitude;

  const getConditionColor = (cond: any) => {
    const rating = parseInt(String(cond));
    if (rating === 5) return { bg: '#dcfce7', text: '#166534', label: 'Excellent' };
    if (rating === 4) return { bg: '#fef3c7', text: '#92400e', label: 'Good' };
    if (rating === 3) return { bg: '#fed7aa', text: '#92400e', label: 'Fair' };
    if (rating === 2) return { bg: '#fecaca', text: '#7f1d1d', label: 'Poor' };
    if (rating === 1) return { bg: '#fca5a5', text: '#7f1d1d', label: 'Critical' };
    return { bg: '#e5e7eb', text: '#374151', label: 'Unknown' };
  };

  const condColor = getConditionColor(condition);

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      maxWidth: '320px',
      fontFamily: "'Inter','Segoe UI',sans-serif",
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)',
        color: 'white',
        padding: '12px 14px',
        borderBottom: '2px solid #0e7490',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
          🌉 {name}
        </div>
        <div style={{ fontSize: 11, opacity: 0.9 }}>
          {structureType}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '12px 14px', fontSize: 12 }}>
        {/* Condition */}
        <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>
            Condition Rating
          </div>
          <div style={{
            display: 'inline-block',
            padding: '4px 8px',
            background: condColor.bg,
            color: condColor.text,
            borderRadius: '4px',
            fontSize: 11,
            fontWeight: 600,
          }}>
            {condition} / 5 — {condColor.label}
          </div>
        </div>

        {/* Road Link */}
        <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>
            Road Link
          </div>
          <div style={{ fontSize: 12, color: '#1f2937', fontWeight: 500 }}>
            {linkId}
          </div>
        </div>

        {/* Specifications */}
        <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>
            Specifications
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: 11 }}>
            <div>
              <div style={{ color: '#9ca3af', fontSize: 9 }}>Span</div>
              <div style={{ color: '#1f2937', fontWeight: 600 }}>{span}m</div>
            </div>
            <div>
              <div style={{ color: '#9ca3af', fontSize: 9 }}>Built</div>
              <div style={{ color: '#1f2937', fontWeight: 600 }}>{yearBuilt}</div>
            </div>
          </div>
        </div>

        {/* Location */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>
            Coordinates
          </div>
          <div style={{ fontSize: 11, color: '#1f2937' }}>
            {lat.toFixed(4)}°N, {lon.toFixed(4)}°E
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        background: '#f9fafb',
        padding: '8px 14px',
        fontSize: 10,
        color: '#9ca3af',
        textAlign: 'center',
        borderTop: '1px solid #e5e7eb',
      }}>
        Source: Bridge Inspection Database
      </div>
    </div>
  );
}
