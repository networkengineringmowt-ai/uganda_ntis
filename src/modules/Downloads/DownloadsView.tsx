import { useState } from 'react';
import {
  Download, FileJson, Map, Table, Archive, Globe,
  FileText, Info, CheckCircle, ExternalLink,
} from 'lucide-react';
import { useBMS } from '../../store/BMSContext';
import {
  downloadCSV, downloadGeoJSON, downloadKML,
  downloadShapefileZip, downloadStaticFile,
} from '../../utils/downloads';

interface ExportCard {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge: string;
  badgeColor: string;
  action: () => void;
  size?: string;
}

export default function DownloadsView() {
  const { state } = useBMS();
  const { structures } = state;
  const [done, setDone] = useState<string | null>(null);

  const bridges  = structures.filter(s => s.type === 'bridge');
  const culverts = structures.filter(s => s.type === 'culvert');

  function withFeedback(key: string, fn: () => void) {
    return () => { fn(); setDone(key); setTimeout(() => setDone(null), 2500); };
  }

  const GEOSPATIAL: ExportCard[] = [
    {
      icon: <Archive size={18} />,
      title: 'Shapefile — All Structures',
      description: 'Point shapefile with full attribute table. Compatible with ArcGIS, QGIS, MapInfo.',
      badge: 'SHP',
      badgeColor: '#b967ff',
      action: withFeedback('shp-all', () => downloadShapefileZip('all')),
      size: '~68 KB',
    },
    {
      icon: <Archive size={18} />,
      title: 'Shapefile — Bridges only',
      description: `${bridges.length} bridge point features with span, material, condition attributes.`,
      badge: 'SHP',
      badgeColor: '#b967ff',
      action: withFeedback('shp-brg', () => downloadShapefileZip('bridges')),
      size: '~41 KB',
    },
    {
      icon: <Archive size={18} />,
      title: 'Shapefile — Culverts only',
      description: `${culverts.length} major culvert point features.`,
      badge: 'SHP',
      badgeColor: '#b967ff',
      action: withFeedback('shp-cul', () => downloadShapefileZip('culverts')),
      size: '~29 KB',
    },
    {
      icon: <FileJson size={18} />,
      title: 'GeoJSON — All Structures',
      description: 'Current app data as GeoJSON FeatureCollection. Live snapshot matching displayed structures.',
      badge: 'GeoJSON',
      badgeColor: '#00f5ff',
      action: withFeedback('geojson-all', () =>
        downloadGeoJSON(structures, `Department of National Roads_Structures_${new Date().toISOString().slice(0,10)}.geojson`)),
    },
    {
      icon: <FileJson size={18} />,
      title: 'GeoJSON — Static (pre-built)',
      description: 'Server-generated GeoJSON with all 1,019 structures. Use for full dataset including offline.',
      badge: 'GeoJSON',
      badgeColor: '#00f5ff',
      action: withFeedback('geojson-static', () =>
        downloadStaticFile('/downloads/structures_all.geojson', 'structures_all.geojson')),
      size: '~683 KB',
    },
    {
      icon: <Globe size={18} />,
      title: 'KML — Google Earth',
      description: 'Open in Google Earth Pro or Maps. Placemarks colour-coded by condition rating (1–5).',
      badge: 'KML',
      badgeColor: '#00ff88',
      action: withFeedback('kml', () =>
        downloadKML(structures, `Department of National Roads_Structures_${new Date().toISOString().slice(0,10)}.kml`)),
    },
  ];

  const TABULAR: ExportCard[] = [
    {
      icon: <Table size={18} />,
      title: 'Full Structure Registry — CSV',
      description: `All ${structures.length} structures with 21 attribute columns. Opens in Excel.`,
      badge: 'CSV',
      badgeColor: '#ffd23f',
      action: withFeedback('csv-all', () =>
        downloadCSV(structures, `Department of National Roads_Structures_Registry_${new Date().toISOString().slice(0,10)}.csv`)),
    },
    {
      icon: <Table size={18} />,
      title: 'Bridges CSV',
      description: `${bridges.length} bridge records with full physical and condition data.`,
      badge: 'CSV',
      badgeColor: '#ffd23f',
      action: withFeedback('csv-brg', () =>
        downloadCSV(bridges, `Department of National Roads_Bridges_${new Date().toISOString().slice(0,10)}.csv`)),
    },
    {
      icon: <Table size={18} />,
      title: 'Culverts CSV',
      description: `${culverts.length} major culvert records.`,
      badge: 'CSV',
      badgeColor: '#ffd23f',
      action: withFeedback('csv-cul', () =>
        downloadCSV(culverts, `Department of National Roads_Culverts_${new Date().toISOString().slice(0,10)}.csv`)),
    },
    {
      icon: <Table size={18} />,
      title: 'Full CSV — Static (pre-built)',
      description: 'Server-generated CSV matching the master dataset.',
      badge: 'CSV',
      badgeColor: '#ffd23f',
      action: withFeedback('csv-static', () =>
        downloadStaticFile('/downloads/structures_all.csv', 'structures_all.csv')),
      size: '~186 KB',
    },
  ];

  return (
    <div className="min-h-full bg-slate-950 text-slate-100 p-6 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <Download size={16} className="text-blue-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Downloads &amp; Exports</h1>
        </div>
        <p className="text-slate-400 text-sm ml-11">
          Export the complete Department of National Roads bridge and culvert inventory in multiple formats.
          Geospatial files use WGS84 (EPSG:4326). Shapefile ZIPs include .shp, .dbf, .shx, .prj, .cpg.
        </p>

        {/* Stats strip */}
        <div className="ml-11 mt-4 flex flex-wrap gap-4">
          {[
            { label: 'Total Structures', value: structures.length, color: '#00f5ff' },
            { label: 'Bridges',   value: bridges.length,  color: '#4d9fff' },
            { label: 'Culverts',  value: culverts.length, color: '#b967ff' },
            { label: 'Critical',  value: structures.filter(s => s.conditionRating === 1).length, color: '#ff2d78' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2">
              <div className="text-xs text-slate-500 mb-0.5">{label}</div>
              <div className="text-lg font-bold" style={{ color }}>{value.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Geospatial section */}
      <Section title="Geospatial Formats" icon={<Map size={15} />}>
        <CardGrid cards={GEOSPATIAL} done={done} />
      </Section>

      {/* Tabular section */}
      <Section title="Tabular Data" icon={<FileText size={15} />}>
        <CardGrid cards={TABULAR} done={done} />
      </Section>

      {/* Info note */}
      <div className="mt-8 flex items-start gap-3 bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm text-slate-400">
        <Info size={16} className="text-slate-500 mt-0.5 flex-shrink-0" />
        <div>
          <strong className="text-slate-300">Data source:</strong> Department of National Roads Bridge Management System —
          <em> Bridges and Culverts 2026.xlsx</em> (tblB-Bridge2 + MC Condition sheets) merged with
          <em> Bridges 18062025.xlsx</em> and <em>Major Culverts 18062025.xlsx</em>.
          Condition ratings are modelled from year-built using a 15-year degradation schedule
          with inspection frequency weighting. Coordinates are WGS84 decimal degrees.
          Pre-built files in <code className="text-slate-300">/public/downloads/</code> were
          generated by <code className="text-slate-300">scripts/build_master.py</code>.
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-slate-400">{icon}</span>
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function CardGrid({ cards, done }: { cards: ExportCard[]; done: string | null }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {cards.map((card, i) => {
        const key = `card-${i}-${card.title}`;
        const isDone = done === Object.keys({ ...card }).find(k => k === 'action');
        return (
          <ExportCardUI key={key} card={card} isDone={false} />
        );
      })}
    </div>
  );
}

function ExportCardUI({ card, isDone }: { card: ExportCard; isDone: boolean }) {
  const [clicked, setClicked] = useState(false);

  function handleClick() {
    card.action();
    setClicked(true);
    setTimeout(() => setClicked(false), 2000);
  }

  return (
    <div className="group bg-slate-900 border border-slate-700 hover:border-slate-500 rounded-xl p-5 transition-all duration-200 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 group-hover:text-slate-200 transition-colors">{card.icon}</span>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded"
            style={{
              color: card.badgeColor,
              background: `${card.badgeColor}18`,
              border: `1px solid ${card.badgeColor}40`,
            }}
          >
            {card.badge}
          </span>
        </div>
        {card.size && (
          <span className="text-xs text-slate-600">{card.size}</span>
        )}
      </div>

      <div>
        <div className="text-sm font-semibold text-slate-200 mb-1">{card.title}</div>
        <div className="text-xs text-slate-500 leading-relaxed">{card.description}</div>
      </div>

      <button
        onClick={handleClick}
        className="mt-auto flex items-center justify-center gap-2 w-full py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-150"
        style={{
          background: clicked ? 'rgba(0,255,136,0.12)' : 'rgba(59,130,246,0.12)',
          border: clicked ? '1px solid rgba(0,255,136,0.4)' : '1px solid rgba(59,130,246,0.35)',
          color: clicked ? '#00ff88' : '#60a5fa',
        }}
      >
        {clicked
          ? <><CheckCircle size={14} /> Downloaded</>
          : <><Download size={14} /> Download</>
        }
      </button>
    </div>
  );
}
