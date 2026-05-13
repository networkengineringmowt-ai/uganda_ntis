import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, ZoomControl } from 'react-leaflet';
import { ESRI_TILE_URLS, ESRI_ATTRIBUTIONS } from '../../shared/mapSymbols';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Video, Wifi, WifiOff, RefreshCw, Camera, Film,
  AlertCircle, ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import type { Feature, FeatureCollection, LineString } from 'geojson';

// ── Types ─────────────────────────────────────────────────────────────────────
interface YearInfo { has_pave: boolean; has_360: boolean; frame_count: number }

interface RomdasEntry {
  original_name: string;
  years: Record<string, YearInfo>;
}

interface LinkMeta {
  road_no:   string;
  link_id:   string;
  link_name: string;
  length_km: number;
  surface:   string;
  region:    string;
}

interface SelectedLink {
  romdasKey:    string;
  originalName: string;
  years:        Record<string, YearInfo>;
}

type ViewType = 'PAVE' | '360';

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT      = '#ff6b35';
const ACCENT_RGB  = '255,107,53';
const MAP_CENTER: [number, number] = [1.3733, 32.2903];
const MAP_ZOOM    = 8;
const TILE_URL    = ESRI_TILE_URLS.imagery;
const ATTRIBUTION = ESRI_ATTRIBUTIONS.imagery;
const PROBE_KEY   = 'ACHOLIBUR_ASWA';
const PROBE_YEAR  = '2021-22';
const SURVEY_YEARS = ['2025-26', '2023-24', '2022-23', '2021-22'];

// ── Normalisation for ROMDAS key matching ─────────────────────────────────────
function normStr(s: string): string {
  return s.replace(/\s*-\s*/g, ' ').replace(/_/g, ' ')
          .replace(/\s+/g, ' ').toLowerCase().trim();
}

// ── Frame URL builder ─────────────────────────────────────────────────────────
function frameUrl(year: string, key: string, type: ViewType, frame: number): string {
  const subDir = `${type}-0`;
  const pad    = String(frame).padStart(5, '0');
  return `/romdas/${year}/${encodeURIComponent(key)}/${subDir}/${encodeURIComponent(`${key}-${subDir}-${pad}.jpg`)}`;
}

// ── Line style helpers ────────────────────────────────────────────────────────
const styleNoVideo  = (): L.PathOptions => ({ color: 'rgba(100,116,139,0.25)', weight: 1.5, opacity: 0.5  });
const styleVideo    = (): L.PathOptions => ({ color: ACCENT,                   weight: 4,   opacity: 0.9, interactive: true  });
const styleSelected = (): L.PathOptions => ({ color: '#ffd23f',                weight: 6,   opacity: 1,   interactive: true  });
const styleHover    = (): L.PathOptions => ({ color: ACCENT,                   weight: 6,   opacity: 1,   interactive: true  });

// ── Top bar ───────────────────────────────────────────────────────────────────
const topBarStyle: React.CSSProperties = {
  position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000,
  display: 'flex', alignItems: 'center', gap: 14,
  padding: '8px 16px',
  background: 'rgba(2,5,8,0.85)',
  backdropFilter: 'blur(8px)',
  borderBottom: `1px solid rgba(${ACCENT_RGB},0.14)`,
};

// ── Main component ─────────────────────────────────────────────────────────────
export default function RoadVideoView() {
  // ── Raw data ───────────────────────────────────────────────────────────────
  const [geoJsonData,  setGeoJsonData]  = useState<FeatureCollection | null>(null);
  const [linksData,    setLinksData]    = useState<LinkMeta[]>([]);
  const [romdasIndex,  setRomdasIndex]  = useState<Record<string, RomdasEntry>>({});

  // ── UI state ───────────────────────────────────────────────────────────────
  const [serverOnline,  setServerOnline]  = useState<boolean | null>(null);
  const [selectedLink,  setSelectedLink]  = useState<SelectedLink | null>(null);
  const [selectedYear,  setSelectedYear]  = useState<string>(PROBE_YEAR);
  const [viewType,      setViewType]      = useState<ViewType>('PAVE');
  const [frame,         setFrame]         = useState(1);
  const [imgError,      setImgError]      = useState(false);

  const geoJsonRef = useRef<L.GeoJSON | null>(null);
  const selectedKeyRef = useRef<string | null>(null);

  // ── Server probe ───────────────────────────────────────────────────────────
  const probeServer = useCallback(() => {
    setServerOnline(null);
    const url = frameUrl(PROBE_YEAR, PROBE_KEY, 'PAVE', 1);
    const img = new Image();
    const tid = setTimeout(() => { img.src = ''; setServerOnline(false); }, 4000);
    img.onload  = () => { clearTimeout(tid); setServerOnline(true);  };
    img.onerror = () => { clearTimeout(tid); setServerOnline(false); };
    img.src = url;
  }, []);

  // ── Fetch all data on mount ────────────────────────────────────────────────
  useEffect(() => {
    probeServer();

    Promise.all([
      fetch(`${import.meta.env.BASE_URL}roads.geojson`).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}road_links_ndpiv.json`).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}romdas_index.json`).then(r => r.json()),
    ]).then(([geo, ndpiv, romdas]) => {
      setGeoJsonData(geo as FeatureCollection);
      setLinksData((ndpiv as { links: LinkMeta[] }).links);
      setRomdasIndex(romdas as Record<string, RomdasEntry>);
    }).catch(console.error);
  }, [probeServer]);

  // ── Build normalised lookup: normStr(link_name) → RomdasEntry + key ────────
  const romdasByNorm = useMemo(() => {
    const map = new Map<string, { key: string; entry: RomdasEntry }>();
    for (const [key, entry] of Object.entries(romdasIndex)) {
      map.set(normStr(key), { key, entry });
    }
    return map;
  }, [romdasIndex]);

  // ── Build enriched GeoJSON: merge link metadata + romdas coverage flag ─────
  const enrichedGeoJson = useMemo<FeatureCollection | null>(() => {
    if (!geoJsonData || linksData.length === 0 || romdasByNorm.size === 0) return null;

    const features = geoJsonData.features.map((feat, i) => {
      const meta   = linksData[i] as LinkMeta | undefined;
      const lname  = meta?.link_name ?? '';
      const match  = romdasByNorm.get(normStr(lname));

      return {
        ...feat,
        properties: {
          ...(feat.properties ?? {}),
          link_id:    meta?.link_id    ?? '',
          link_name:  lname,
          region:     meta?.region     ?? '',
          romdasKey:  match?.key        ?? null,
          hasVideo:   !!match,
          originalName: match?.entry.original_name ?? lname,
          years:      match?.entry.years            ?? {},
        },
      } as Feature<LineString>;
    });

    return { type: 'FeatureCollection', features };
  }, [geoJsonData, linksData, romdasByNorm]);

  // Count video-linked features
  const videoCount = useMemo(
    () => enrichedGeoJson?.features.filter(f => f.properties?.hasVideo).length ?? 0,
    [enrichedGeoJson],
  );

  // ── Reset frame / imgError when selection changes ──────────────────────────
  useEffect(() => { setFrame(1); setImgError(false); }, [selectedLink, selectedYear, viewType]);

  // ── Keyboard navigation ────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedLink) return;
    const yearInfo   = selectedLink.years[selectedYear];
    const frameCount = yearInfo?.frame_count ?? 0;

    function handler(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft')  setFrame(f => Math.max(1, f - 1));
      if (e.key === 'ArrowRight') setFrame(f => Math.min(frameCount, f + 1));
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedLink, selectedYear]);

  // ── GeoJSON layer styling + interaction ───────────────────────────────────
  const onEachFeature = useCallback((feat: Feature, layer: L.Layer) => {
    const props = feat.properties ?? {};
    if (!props.hasVideo) return;                    // no interaction for grey links

    const path = layer as L.Path;
    path.on('mouseover', () => {
      if (props.romdasKey !== selectedKeyRef.current) {
        path.setStyle(styleHover());
      }
    });
    path.on('mouseout', () => {
      if (props.romdasKey !== selectedKeyRef.current) {
        path.setStyle(styleVideo());
      }
    });
    path.on('click', () => {
      // Restore previous selected layer to video colour
      if (geoJsonRef.current) {
        geoJsonRef.current.eachLayer(l => {
          const f = (l as L.GeoJSON & { feature?: Feature }).feature;
          if (f?.properties?.hasVideo && f.properties.romdasKey !== props.romdasKey) {
            (l as L.Path).setStyle(styleVideo());
          }
        });
      }

      selectedKeyRef.current = props.romdasKey;
      path.setStyle(styleSelected());

      const entry: SelectedLink = {
        romdasKey:    props.romdasKey,
        originalName: props.originalName,
        years:        props.years,
      };
      setSelectedLink(entry);

      // Pick best available year
      const preferred = SURVEY_YEARS.find(y => props.years[y]);
      if (preferred) setSelectedYear(preferred);
    });
  }, []);

  const styleFeature = useCallback((feat?: Feature) => {
    const props = feat?.properties ?? {};
    if (props.romdasKey && props.romdasKey === selectedKeyRef.current) return styleSelected();
    return props.hasVideo ? styleVideo() : styleNoVideo();
  }, []);

  // ── Derived side-panel values ──────────────────────────────────────────────
  const yearInfo   = selectedLink?.years[selectedYear];
  const frameCount = yearInfo?.frame_count ?? 0;
  const canPrev    = frame > 1;
  const canNext    = frame < frameCount;
  const hasTypeData = viewType === 'PAVE' ? yearInfo?.has_pave : yearInfo?.has_360;
  const availYears  = selectedLink ? SURVEY_YEARS.filter(y => y in selectedLink.years) : [];

  const panelOpen = !!selectedLink;

  // ── Status badge (inline render, no nested component) ─────────────────────
  function renderStatus() {
    if (serverOnline === null) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#ffd23f' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ffd23f' }}/>
          Connecting…
        </div>
      );
    }
    if (serverOnline) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#00ff88' }}>
          <Wifi size={11}/> Online
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#ff3366' }}>
        <WifiOff size={11}/> Offline
        <button
          onClick={probeServer}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 10, fontWeight: 700,
            background: 'rgba(255,51,102,0.1)', border: '1px solid rgba(255,51,102,0.3)', color: '#ff3366',
          }}
        >
          <RefreshCw size={9}/> Retry
        </button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', overflow: 'hidden' }}>

      {/* ── Map fills flex: 1 ── */}
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>

        {/* Top bar */}
        <div style={topBarStyle}>
          {/* Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <Video size={15} style={{ color: ACCENT }}/>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT, textShadow: `0 0 16px rgba(${ACCENT_RGB},0.4)` }}>
                Road Survey Video
              </div>
              <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.5)' }}>
                Frame-by-frame pavement survey · Uganda
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', flexShrink: 0 }}>
            <span style={{ color: ACCENT, fontWeight: 800 }}>{videoCount}</span> links indexed
          </div>

          <div style={{ flex: 1 }}/>

          {/* Connectivity */}
          {renderStatus()}
        </div>

        {/* Legend — bottom-left */}
        <div style={{
          position: 'absolute', bottom: 24, left: 12, zIndex: 1000,
          background: 'rgba(2,5,8,0.82)', backdropFilter: 'blur(6px)',
          border: `1px solid rgba(${ACCENT_RGB},0.15)`,
          borderRadius: 8, padding: '8px 12px',
          fontSize: 10, color: '#94a3b8',
          display: 'flex', flexDirection: 'column', gap: 5,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 20, height: 2, background: ACCENT, borderRadius: 1 }}/>
            <span>Has survey video <span style={{ color: ACCENT, fontWeight: 700 }}>({videoCount})</span></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 20, height: 2, background: 'rgba(100,116,139,0.5)', borderRadius: 1 }}/>
            <span>No video data</span>
          </div>
        </div>

        {/* Map */}
        <MapContainer
          center={MAP_CENTER}
          zoom={MAP_ZOOM}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
          attributionControl={true}
        >
          <TileLayer url={TILE_URL} attribution={ATTRIBUTION}/>
          <TileLayer url={ESRI_TILE_URLS.labels} attribution={ESRI_ATTRIBUTIONS.labels} opacity={0.7}/>
          <ZoomControl position="bottomright"/>

          {enrichedGeoJson && (
            <GeoJSON
              key={enrichedGeoJson ? 'loaded' : 'empty'}
              data={enrichedGeoJson}
              style={styleFeature}
              onEachFeature={onEachFeature}
              ref={geoJsonRef}
            />
          )}
        </MapContainer>
      </div>

      {/* ── Side panel ── */}
      <div style={{
        width: 400, flexShrink: 0,
        transform: panelOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s ease',
        position: 'relative', zIndex: 900,
        display: 'flex', flexDirection: 'column',
        background: 'rgba(2,5,8,0.97)',
        borderLeft: `1px solid rgba(${ACCENT_RGB},0.14)`,
        overflow: 'hidden',
      }}>

        {selectedLink && (
          <>
            {/* Panel header */}
            <div style={{
              padding: '14px 14px 10px',
              borderBottom: `1px solid rgba(${ACCENT_RGB},0.1)`,
              flexShrink: 0,
            }}>
              {/* Close + name row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 800, color: ACCENT,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {selectedLink.originalName}
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.5)', marginTop: 2 }}>
                    {selectedLink.romdasKey}
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedLink(null); selectedKeyRef.current = null; }}
                  style={{
                    padding: 4, borderRadius: 6, cursor: 'pointer', flexShrink: 0,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#94a3b8', display: 'flex', alignItems: 'center',
                  }}
                  title="Close panel"
                >
                  <X size={13}/>
                </button>
              </div>

              {/* Year tabs */}
              <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
                {SURVEY_YEARS.map(y => {
                  const avail = availYears.includes(y);
                  const active = selectedYear === y && avail;
                  return (
                    <button
                      key={y}
                      disabled={!avail}
                      onClick={() => { setSelectedYear(y); setImgError(false); }}
                      style={{
                        padding: '3px 9px', borderRadius: 7, fontSize: 10, fontWeight: 700,
                        cursor: avail ? 'pointer' : 'default', opacity: avail ? 1 : 0.3,
                        background: active ? `rgba(${ACCENT_RGB},0.15)` : 'rgba(255,255,255,0.04)',
                        border: active ? `1px solid rgba(${ACCENT_RGB},0.4)` : '1px solid rgba(255,255,255,0.08)',
                        color: active ? ACCENT : 'rgba(148,163,184,0.7)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {y}
                    </button>
                  );
                })}
              </div>

              {/* View type tabs */}
              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                {(['PAVE', '360'] as ViewType[]).map(t => {
                  const avail  = t === 'PAVE' ? yearInfo?.has_pave : yearInfo?.has_360;
                  const active = viewType === t && avail;
                  return (
                    <button
                      key={t}
                      disabled={!avail}
                      onClick={() => { setViewType(t); setImgError(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '3px 9px', borderRadius: 7, fontSize: 10, fontWeight: 700,
                        cursor: avail ? 'pointer' : 'default', opacity: avail ? 1 : 0.3,
                        background: active ? 'rgba(0,245,255,0.1)' : 'rgba(255,255,255,0.04)',
                        border: active ? '1px solid rgba(0,245,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
                        color: active ? '#00f5ff' : 'rgba(148,163,184,0.7)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {t === 'PAVE' ? <Camera size={10}/> : <Video size={10}/>}
                      {t === 'PAVE' ? 'Pavement' : '360°'}
                    </button>
                  );
                })}
                {yearInfo && (
                  <span style={{
                    marginLeft: 'auto', fontSize: 9,
                    color: `rgba(${ACCENT_RGB},0.7)`, fontWeight: 700,
                    alignSelf: 'center',
                  }}>
                    {frameCount.toLocaleString()} frames
                  </span>
                )}
              </div>
            </div>

            {/* Panel body: frame viewer */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: 12, gap: 10 }}>

              {/* Offline notice */}
              {serverOnline === false && (
                <div style={{
                  padding: '8px 12px', borderRadius: 8, flexShrink: 0,
                  background: 'rgba(255,51,102,0.08)', border: '1px solid rgba(255,51,102,0.2)',
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'rgba(255,51,102,0.8)',
                }}>
                  <AlertCircle size={12}/>
                  <span style={{ flex: 1 }}>Video server not reachable. Connect to the internal network and retry.</span>
                  <button
                    onClick={probeServer}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                      padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                      background: 'rgba(255,51,102,0.12)', border: '1px solid rgba(255,51,102,0.35)',
                      color: '#ff3366', fontSize: 10, fontWeight: 700,
                    }}
                  >
                    <RefreshCw size={9}/> Retry
                  </button>
                </div>
              )}

              {/* No data for type/year */}
              {!hasTypeData && (
                <div style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column', gap: 8, color: 'rgba(148,163,184,0.4)', fontSize: 12,
                }}>
                  <Film size={28} style={{ opacity: 0.3 }}/>
                  <div>No {viewType === 'PAVE' ? 'pavement' : '360°'} footage for {selectedYear}</div>
                </div>
              )}

              {/* Frame image + controls */}
              {hasTypeData && (
                <>
                  {/* Image box */}
                  <div style={{
                    flex: 1, minHeight: 0, position: 'relative',
                    background: 'rgba(0,0,0,0.5)',
                    border: `1px solid rgba(${ACCENT_RGB},0.12)`,
                    borderRadius: 10, overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {imgError ? (
                      <div style={{ textAlign: 'center', color: 'rgba(148,163,184,0.5)', fontSize: 12, padding: 24 }}>
                        <Film size={28} style={{ opacity: 0.3, marginBottom: 10 }}/>
                        <div>Frame {frame} not available</div>
                        <div style={{ fontSize: 10, marginTop: 4, color: 'rgba(100,116,139,0.4)' }}>
                          {serverOnline === false ? 'Server not reachable' : 'File may not exist'}
                        </div>
                      </div>
                    ) : (
                      <img
                        key={`${selectedLink.romdasKey}-${selectedYear}-${viewType}-${frame}`}
                        src={frameUrl(selectedYear, selectedLink.romdasKey, viewType, frame)}
                        alt={`Frame ${frame}`}
                        onError={() => setImgError(true)}
                        onLoad={() => setImgError(false)}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
                      />
                    )}

                    {/* Frame counter badge */}
                    <div style={{
                      position: 'absolute', top: 8, left: 8,
                      padding: '3px 8px', borderRadius: 6,
                      background: 'rgba(2,5,8,0.78)', border: `1px solid rgba(${ACCENT_RGB},0.2)`,
                      fontSize: 9, fontWeight: 800, color: ACCENT,
                    }}>
                      {String(frame).padStart(5, '0')} / {String(frameCount).padStart(5, '0')}
                    </div>

                    {/* View type badge */}
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      padding: '3px 8px', borderRadius: 6,
                      background: 'rgba(2,5,8,0.78)', border: '1px solid rgba(0,245,255,0.2)',
                      fontSize: 9, fontWeight: 800, color: '#00f5ff',
                    }}>
                      {viewType === 'PAVE' ? 'PAVEMENT' : '360°'}
                    </div>
                  </div>

                  {/* Navigation controls */}
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => { if (canPrev) { setFrame(f => f - 1); setImgError(false); } }}
                      disabled={!canPrev}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                        padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                        cursor: canPrev ? 'pointer' : 'default', opacity: canPrev ? 1 : 0.4,
                        background: canPrev ? `rgba(${ACCENT_RGB},0.1)` : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${canPrev ? `rgba(${ACCENT_RGB},0.3)` : 'rgba(255,255,255,0.06)'}`,
                        color: canPrev ? ACCENT : 'rgba(100,116,139,0.3)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <ChevronLeft size={13}/> Prev
                    </button>

                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="range" min={1} max={frameCount || 1} value={frame}
                        onChange={e => { setFrame(Number(e.target.value)); setImgError(false); }}
                        style={{ flex: 1, height: 4, accentColor: ACCENT, cursor: 'pointer' }}
                      />
                      <input
                        type="number" min={1} max={frameCount} value={frame}
                        onChange={e => {
                          const v = Math.max(1, Math.min(frameCount, Number(e.target.value)));
                          setFrame(v); setImgError(false);
                        }}
                        className="bms-input"
                        style={{ width: 60, textAlign: 'center', fontSize: 11, padding: '4px 6px' }}
                      />
                    </div>

                    <button
                      onClick={() => { if (canNext) { setFrame(f => f + 1); setImgError(false); } }}
                      disabled={!canNext}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                        padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                        cursor: canNext ? 'pointer' : 'default', opacity: canNext ? 1 : 0.4,
                        background: canNext ? `rgba(${ACCENT_RGB},0.1)` : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${canNext ? `rgba(${ACCENT_RGB},0.3)` : 'rgba(255,255,255,0.06)'}`,
                        color: canNext ? ACCENT : 'rgba(100,116,139,0.3)',
                        transition: 'all 0.15s',
                      }}
                    >
                      Next <ChevronRight size={13}/>
                    </button>
                  </div>

                  {/* Keyboard hint */}
                  <div style={{ flexShrink: 0, fontSize: 9, color: 'rgba(100,116,139,0.4)', textAlign: 'center' }}>
                    ← → arrow keys to navigate frames
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* Placeholder when panel is "closed" but still in DOM for transition */}
        {!selectedLink && (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 10, color: 'rgba(148,163,184,0.3)',
          }}>
            <Film size={32} style={{ opacity: 0.3 }}/>
            <div style={{ fontSize: 11 }}>Click an orange link on the map</div>
          </div>
        )}
      </div>
    </div>
  );
}
