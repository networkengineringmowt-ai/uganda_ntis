import { useState, useCallback } from 'react';
import { X, ChevronRight, Cpu, Database, GitBranch, BarChart3, Layers, Target, ArrowRight } from 'lucide-react';

// ── Color palette ─────────────────────────────────────────────────────────────
const C = {
  data:     '#00f5ff',   // cyan  — Data Sources
  etl:      '#b967ff',   // purple — ETL / Processing
  feature:  '#ffd23f',   // yellow — Feature Engineering
  model:    '#ff6b35',   // orange — ML Models
  output:   '#00ff88',   // green  — Outputs
  decision: '#4d9fff',   // blue   — Decision Support
  bg:       'rgba(8,14,28,0.72)',
  card:     'rgba(15,23,42,0.80)',
  border:   'rgba(255,255,255,0.07)',
};

// ── Node definitions ──────────────────────────────────────────────────────────
interface NodeDef {
  id:       string;
  layer:    'data' | 'etl' | 'feature' | 'model' | 'output' | 'decision';
  label:    string;
  sublabel: string;
  x: number; y: number;  // percent positions in SVG viewport
  detail: {
    algorithm:   string;
    trainingSize: string;
    accuracy:    string;
    inputs:      string[];
    outputs:     string[];
    description: string;
  };
}

const NODES: NodeDef[] = [
  // ── Data Sources (column 0) ──
  {
    id: 'romdas', layer: 'data', label: 'ROMDAS Survey', sublabel: 'Pavement IRI & texture',
    x: 6, y: 14,
    detail: {
      algorithm: 'Laser profilometry + video frame capture',
      trainingSize: '21,292 km national network surveys',
      accuracy: 'IRI ±0.1 m/km, GPS ±2 m',
      inputs: ['Raw IMU data', 'GPS coordinates', 'Video frames', 'Laser distance'],
      outputs: ['IRI per 100m segment', 'Rutting depth', 'Cracking index', 'Defect photo grid'],
      description: 'ROMDAS vehicle-mounted survey system captures road surface roughness (IRI), rutting, cracking, and defect imagery at network speed. Surveys conducted annually on ~6,000 km paved national roads.',
    },
  },
  {
    id: 'atc', layer: 'data', label: 'ATC Stations', sublabel: '25 permanent counters',
    x: 6, y: 30,
    detail: {
      algorithm: 'Inductive loop + video AI classification',
      trainingSize: '607k+ hourly readings (2016–2025)',
      accuracy: 'Volume ±3%, classification ±8%',
      inputs: ['Axle signatures', 'Speed pulses', 'Video frames', 'Timestamp'],
      outputs: ['Hourly AADT by class', 'Speed distribution', 'Headway', 'Heavy vehicle %'],
      description: '25 ATC stations (15 legacy 2016–2022, 10 new 2025+) on strategic corridors. Classify 12 vehicle classes. Feed real-time traffic models and seasonal factor computation.',
    },
  },
  {
    id: 'tis', layer: 'data', label: 'TIS Manual Counts', sublabel: '298 count stations',
    x: 6, y: 46,
    detail: {
      algorithm: 'Manual classified count (7-day)',
      trainingSize: '267,000+ traffic count records',
      accuracy: 'Representative for annual planning',
      inputs: ['Classified vehicle counts', 'Direction', 'Turning movements', 'Date/time'],
      outputs: ['AADT by class', 'Directional split', 'Peak hour factor', 'Seasonal index'],
      description: 'UNRA Traffic Information System: 298 manual classified count stations across the national network. Annual surveys provide AADT for all road links not covered by ATC.',
    },
  },
  {
    id: 'bms_data', layer: 'data', label: 'BMS Inspections', sublabel: 'Bridge & culvert registry',
    x: 6, y: 62,
    detail: {
      algorithm: 'Visual inspection + NBI rating protocol',
      trainingSize: '1,019 structures (534 bridges, 485 culverts)',
      accuracy: 'Condition rating ±0.5 NBI units',
      inputs: ['Inspector field scores', 'Photos', 'Defect codes', 'Load data'],
      outputs: ['NBI component ratings 0–9', 'Structure condition index', 'Priority score'],
      description: 'National bridge inventory covering deck, superstructure, substructure, and channel ratings. Annual inspection cycle for critical structures, biennial for others.',
    },
  },
  {
    id: 'gis', layer: 'data', label: 'GIS / Road Network', sublabel: '1,359 road links',
    x: 6, y: 78,
    detail: {
      algorithm: 'ArcGIS + PostGIS spatial database',
      trainingSize: '21,292 km, 1,359 links, 6 regions',
      accuracy: 'GPS-aligned ±5 m horizontal',
      inputs: ['Shapefile geometry', 'Attribute tables', 'Chainage data', 'Region boundaries'],
      outputs: ['Spatial join keys', 'Route lengths', 'Network topology', 'Maintenance zones'],
      description: 'National road network GIS database maintained by UNRA/DNR. Used as spatial backbone for all asset management layers — joins traffic, condition, projects, and budget data.',
    },
  },

  // ── ETL / Processing (column 1) ──
  {
    id: 'etl_clean', layer: 'etl', label: 'Data Cleaning', sublabel: 'Outlier removal, imputation',
    x: 22, y: 22,
    detail: {
      algorithm: 'IQR outlier filter + MICE imputation',
      trainingSize: 'All ingested records',
      accuracy: 'Missing rate <2% post-imputation',
      inputs: ['Raw survey CSV', 'Count records', 'Inspection forms'],
      outputs: ['Cleaned DataFrame', 'Quality flags', 'Imputation log'],
      description: 'Automated pipeline removes IRI spikes (>20% deviation from rolling median), fills short missing runs via multiple imputation, flags unreliable segments for manual review.',
    },
  },
  {
    id: 'etl_spatial', layer: 'etl', label: 'Spatial Join', sublabel: 'Link-level aggregation',
    x: 22, y: 46,
    detail: {
      algorithm: 'PostGIS ST_Intersects + nearest-link snap',
      trainingSize: '1,359 link geometries',
      accuracy: 'Snap tolerance 50 m',
      inputs: ['Point data (stations, inspections)', 'Line geometries (road links)'],
      outputs: ['Per-link AADT', 'Per-link IRI mean', 'Link-level feature matrix'],
      description: 'All point-based data (ATC, TIS, ROMDAS 100m intervals) snapped to road link centrelines. Produces a unified feature matrix indexed by link_id for ML training.',
    },
  },
  {
    id: 'etl_temporal', layer: 'etl', label: 'Temporal Alignment', sublabel: 'Year-harmonised panels',
    x: 22, y: 70,
    detail: {
      algorithm: 'Panel data construction (2016–2025)',
      trainingSize: '10 annual snapshots × 1,359 links',
      accuracy: 'Calendar-year alignment ±6 months',
      inputs: ['Survey timestamps', 'Count year', 'Financial year mapping'],
      outputs: ['Balanced panel DataFrame', 'Change deltas', 'Trend features'],
      description: 'Harmonises surveys from different years and data collection cycles into a balanced panel. Computes year-on-year IRI deterioration rates, traffic growth rates per link.',
    },
  },

  // ── Feature Engineering (column 2) ──
  {
    id: 'feat_env', layer: 'feature', label: 'Environment Features', sublabel: 'Climate & terrain',
    x: 39, y: 18,
    detail: {
      algorithm: 'CHIRPS rainfall + SRTM DEM + soil classification',
      trainingSize: 'Gridded 5km × 5km Uganda coverage',
      accuracy: 'Rainfall ±12mm/yr, elevation ±10m',
      inputs: ['Monthly rainfall (CHIRPS)', 'DEM elevation', 'Soil type GIS', 'Drainage catchment'],
      outputs: ['Annual rainfall (mm)', 'Slope (%)', 'Subgrade CBR proxy', 'Flood risk score'],
      description: 'Environmental covariates joined to each road link: mean annual rainfall, terrain slope, estimated subgrade strength (CBR) from soil maps, and flood inundation risk index.',
    },
  },
  {
    id: 'feat_traffic', layer: 'feature', label: 'Traffic Features', sublabel: 'ESALs, growth, class',
    x: 39, y: 38,
    detail: {
      algorithm: 'SATCC/TRH4 ESAL factors + CAGR regression',
      trainingSize: '267k+ count records',
      accuracy: 'ESAL ±15% (overload uncertainty)',
      inputs: ['AADT by class', 'Axle load factors', 'Growth rates', 'Overloading multiplier'],
      outputs: ['Cumulative ESAL (million)', 'HV %', 'Traffic growth rate', 'Overloading risk'],
      description: 'Converts classified traffic counts to Equivalent Standard Axle Loads using SATCC factors. Applies +25% overload uplift for HGVs. Computes cumulative structural damage loading per link.',
    },
  },
  {
    id: 'feat_struct', layer: 'feature', label: 'Structural Features', sublabel: 'Pavement, age, rehab',
    x: 39, y: 58,
    detail: {
      algorithm: 'HDM-4 structural number + age computation',
      trainingSize: '1,359 links with construction records',
      accuracy: 'SN ±0.3 from layer thickness uncertainty',
      inputs: ['Pavement layer thicknesses', 'Construction year', 'Last rehab year', 'Surface type'],
      outputs: ['Structural Number (SN)', 'Pavement age (years)', 'Remaining life fraction', 'ΔIRI/year'],
      description: 'Computes AASHTO structural numbers from pavement design records. Pavement age and rehabilitation history used as deterioration state variables in HDM-4 calibrated models.',
    },
  },
  {
    id: 'feat_bridge', layer: 'feature', label: 'Bridge Features', sublabel: 'Condition, load, age',
    x: 39, y: 78,
    detail: {
      algorithm: 'NBI component rating aggregation',
      trainingSize: '1,019 structures',
      accuracy: 'Component rating 0–9 scale',
      inputs: ['Deck/superstructure/substructure ratings', 'ADT', 'Year built', 'Span length'],
      outputs: ['Structure Health Index (SHI)', 'Load capacity ratio', 'Remaining service life'],
      description: 'Aggregates NBI component ratings into a Structure Health Index. Combines with load capacity, age, and strategic importance for priority ranking and maintenance trigger models.',
    },
  },

  // ── ML Models (column 3) ──
  {
    id: 'model_hdm4', layer: 'model', label: 'HDM-4 Deterioration', sublabel: 'IRI progression model',
    x: 56, y: 14,
    detail: {
      algorithm: 'HDM-4 calibrated CRCP/AMGB models',
      trainingSize: 'ROMDAS 2018, 2021, 2023 time series',
      accuracy: 'RMSE 0.72 m/km IRI, R² = 0.81',
      inputs: ['IRI₀', 'SN', 'MESAL', 'Rainfall', 'Age'],
      outputs: ['IRI forecast 1–7 years', 'Maintenance trigger year', 'Treatment need'],
      description: 'HDM-4 road deterioration model calibrated to Uganda conditions using three survey snapshots. Predicts annual IRI progression. Uganda calibration coefficients Kcit=0.9, Kcia=1.05, Kcp=1.1.',
    },
  },
  {
    id: 'model_mlp', layer: 'model', label: 'MLPRegressor', sublabel: 'Traffic demand forecasting',
    x: 56, y: 30,
    detail: {
      algorithm: 'Multi-layer perceptron (3 hidden layers, ReLU)',
      trainingSize: '267k records, 2016–2025',
      accuracy: 'MAE 142 veh/day, R² = 0.89',
      inputs: ['Historical AADT', 'GDP proxy', 'Population', 'Road class', 'Season'],
      outputs: ['AADT forecast 2025–2035', 'Peak-hour volume', 'Growth rate'],
      description: 'Neural network trained on decade of traffic count data. Captures non-linear GDP-traffic relationships and COVID disruption recovery pattern. 80/20 train/test split, Adam optimiser.',
    },
  },
  {
    id: 'model_gbr', layer: 'model', label: 'GBR — ROMDAS', sublabel: 'Condition classification',
    x: 56, y: 46,
    detail: {
      algorithm: 'Gradient Boosted Regression (XGBoost)',
      trainingSize: '8,400 ROMDAS 100-m segments',
      accuracy: 'Classification accuracy 87%, AUC 0.93',
      inputs: ['IRI', 'Rutting', 'Cracking', 'Texture', 'ESAL', 'Age'],
      outputs: ['Condition band (Good/Fair/Poor/Critical)', 'Maintenance urgency score', 'Intervention type'],
      description: 'XGBoost model maps pavement measurements to condition bands and predicts most cost-effective maintenance intervention (routine / periodic / rehabilitation). SHAP used for interpretability.',
    },
  },
  {
    id: 'model_rf', layer: 'model', label: 'Random Forest', sublabel: 'Bridge priority ranking',
    x: 56, y: 62,
    detail: {
      algorithm: 'Random Forest classifier (500 trees)',
      trainingSize: '1,019 structures, 22 features',
      accuracy: 'Priority rank correlation ρ = 0.91',
      inputs: ['SHI', 'ADT', 'Age', 'Span', 'Flood risk', 'Strategic importance'],
      outputs: ['Priority score 0–100', 'Intervention urgency', 'Budget year allocation'],
      description: 'Ensemble model combining structural condition, traffic exposure, strategic route importance, and flood risk to generate a defensible bridge priority ranking for budget allocation.',
    },
  },
  {
    id: 'model_cv', layer: 'model', label: 'OpenCV Defect AI', sublabel: 'Pavement image classifier',
    x: 56, y: 78,
    detail: {
      algorithm: 'ResNet-50 transfer learning + custom head',
      trainingSize: '14,000 ROMDAS defect images (Uganda)',
      accuracy: 'Defect detection mAP 0.82 (IoU 0.5)',
      inputs: ['ROMDAS forward-facing images (1920×1080)', 'GPS timestamp'],
      outputs: ['Defect type (cracking/pothole/rutting)', 'Severity', 'GPS bounding box'],
      description: 'Computer vision model fine-tuned on Uganda road images. Detects potholes, longitudinal cracking, transverse cracking, rutting, and edge breaks. Feeds automated defect inventory.',
    },
  },

  // ── Outputs (column 4) ──
  {
    id: 'out_pms', layer: 'output', label: 'PMS Outputs', sublabel: 'Condition maps & budgets',
    x: 74, y: 22,
    detail: {
      algorithm: 'Multi-year treatment optimisation (HDM-4 RDWE)',
      trainingSize: 'All 1,359 paved links',
      accuracy: 'Budget allocation ±8% vs expert panel',
      inputs: ['IRI forecast', 'Condition band', 'Unit costs', 'Budget constraint'],
      outputs: ['5-year work programme', 'Treatment schedule by link', 'NPV/BCR per intervention'],
      description: 'Pavement Management System output: annual treatment lists, budget allocation by maintenance type (routine/periodic/rehab/emergency), network-level IRI projection under different funding scenarios.',
    },
  },
  {
    id: 'out_tis', layer: 'output', label: 'TIS Outputs', sublabel: 'Traffic forecasts & ESALs',
    x: 74, y: 42,
    detail: {
      algorithm: 'Network assignment + growth factoring',
      trainingSize: 'Full 21,292 km network',
      accuracy: 'Link AADT ±18% at 90% confidence',
      inputs: ['MLP forecast', 'Growth factors', 'Origin-destination matrix'],
      outputs: ['2035 AADT by link', 'Cumulative ESAL map', 'Overloading risk index'],
      description: 'Traffic Information System outputs: network-wide AADT forecasts to 2035 supporting pavement design, bridge load rating, and road classification reviews.',
    },
  },
  {
    id: 'out_bms', layer: 'output', label: 'BMS Outputs', sublabel: 'Bridge priority & works',
    x: 74, y: 62,
    detail: {
      algorithm: 'Multi-criteria scoring + budget optimisation',
      trainingSize: '1,019 structures',
      accuracy: 'Programme delivery rate 91% (FY2023/24)',
      inputs: ['RF priority scores', 'Inspection dates', 'Cost estimates'],
      outputs: ['Annual inspection programme', 'Maintenance work orders', 'Capital works priority list'],
      description: 'Bridge Management System output: prioritised list of structures for routine maintenance, major repairs, and capital replacement. Linked to UNRA maintenance budget lines.',
    },
  },

  // ── Decision Support (column 5) ──
  {
    id: 'dec_budget', layer: 'decision', label: 'Budget Optimisation', sublabel: 'HDM-4 RDWE scenarios',
    x: 90, y: 26,
    detail: {
      algorithm: 'HDM-4 Road Development & Works Effects',
      trainingSize: 'Full network + 10-year budget projections',
      accuracy: 'NPV optimality within 3% of global optimum',
      inputs: ['Work programmes', 'Budget envelopes', 'Economic unit costs', 'Road user costs'],
      outputs: ['Optimal budget allocation', 'NPV by scenario', 'Network condition trajectory'],
      description: 'Economic optimisation of maintenance expenditure across competing treatment needs. Evaluates "do minimum", "maintain standards", and "improve" scenarios against budget constraints.',
    },
  },
  {
    id: 'dec_plan', layer: 'decision', label: 'M&R Planning', sublabel: 'Annual work programme',
    x: 90, y: 50,
    detail: {
      algorithm: 'Rolling 3-year programme (MoWT guidelines)',
      trainingSize: 'Current period treatment triggers',
      accuracy: 'Programme adherence 85%+ target',
      inputs: ['Optimised budget', 'Contractor capacity', 'District priorities', 'Seasonal constraints'],
      outputs: ['Detailed annual work programme', 'Procurement schedule', 'Contract packages'],
      description: 'Translates optimised budget allocation into actionable maintenance and rehabilitation programmes aligned with procurement calendar and district maintenance area boundaries.',
    },
  },
  {
    id: 'dec_report', layer: 'decision', label: 'Network Reporting', sublabel: 'KPIs & dashboard',
    x: 90, y: 74,
    detail: {
      algorithm: 'Automated KPI computation (monthly)',
      trainingSize: 'All system outputs',
      accuracy: 'Real-time refresh from latest survey data',
      inputs: ['PMS/TIS/BMS outputs', 'Budget actuals', 'Contract performance'],
      outputs: ['VCI/IRI network KPIs', 'UNRA annual report data', 'Board-level dashboard'],
      description: 'Aggregates all system outputs into standardised network performance indicators. Feeds UNRA Board reports, MoWT NDP IV monitoring, and World Bank/AfDB progress reporting.',
    },
  },
];

// ── Edge definitions ──────────────────────────────────────────────────────────
const EDGES = [
  ['romdas','etl_clean'], ['atc','etl_clean'], ['tis','etl_clean'],
  ['bms_data','etl_spatial'], ['gis','etl_spatial'],
  ['atc','etl_temporal'], ['tis','etl_temporal'],
  ['etl_clean','etl_spatial'], ['etl_clean','etl_temporal'],
  ['etl_clean','feat_env'], ['etl_spatial','feat_traffic'],
  ['etl_spatial','feat_struct'], ['etl_spatial','feat_bridge'],
  ['etl_temporal','feat_traffic'], ['etl_temporal','feat_struct'],
  ['feat_env','model_hdm4'], ['feat_traffic','model_hdm4'],
  ['feat_struct','model_hdm4'], ['feat_struct','model_gbr'],
  ['feat_traffic','model_mlp'], ['feat_traffic','model_gbr'],
  ['feat_bridge','model_rf'], ['feat_env','model_rf'],
  ['feat_struct','model_cv'], ['romdas','model_cv'],
  ['model_hdm4','out_pms'], ['model_gbr','out_pms'],
  ['model_cv','out_pms'], ['model_mlp','out_tis'],
  ['model_rf','out_bms'],
  ['out_pms','dec_budget'], ['out_tis','dec_budget'],
  ['out_bms','dec_budget'], ['dec_budget','dec_plan'],
  ['dec_budget','dec_report'], ['dec_plan','dec_report'],
];

const LAYER_COLORS: Record<string, string> = {
  data: C.data, etl: C.etl, feature: C.feature,
  model: C.model, output: C.output, decision: C.decision,
};
const LAYER_LABELS: Record<string, string> = {
  data: 'Data Sources', etl: 'ETL / Processing', feature: 'Feature Engineering',
  model: 'ML Models', output: 'Outputs', decision: 'Decision Support',
};

const SVG_W = 1200;
const SVG_H = 520;

function px(pct: number, dim: number) { return (pct / 100) * dim; }

// ── Main component ────────────────────────────────────────────────────────────
export default function MLArchitectureDiagram() {
  const [selected, setSelected] = useState<NodeDef | null>(null);
  const [view, setView] = useState<'arch' | 'flow'>('arch');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const nodeMap = Object.fromEntries(NODES.map(n => [n.id, n]));

  const handleNode = useCallback((n: NodeDef) => {
    setSelected(prev => prev?.id === n.id ? null : n);
  }, []);

  const isHighlighted = useCallback((nid: string) => {
    if (!selected) return true;
    if (selected.id === nid) return true;
    return EDGES.some(([a, b]) =>
      (a === selected.id && b === nid) || (b === selected.id && a === nid)
    );
  }, [selected]);

  return (
    <div style={{ position: 'relative', background: C.bg, borderRadius: 16,
      border: `1px solid ${C.border}`, overflow: 'hidden', userSelect: 'none' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px', borderBottom: `1px solid ${C.border}`,
        background: 'rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9,
            background: `linear-gradient(135deg, rgba(0,245,255,0.2), rgba(77,159,255,0.15))`,
            border: `1px solid rgba(0,245,255,0.3)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Cpu size={15} style={{ color: C.data }}/>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e2eaf4', letterSpacing: '0.02em' }}>
              Asset Management ML Engine
            </div>
            <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)' }}>
              Uganda National Road Network · UNRA DNR
            </div>
          </div>
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: 8,
          padding: 3, gap: 3 }}>
          {(['arch', 'flow'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '5px 14px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: view === v ? 'rgba(0,245,255,0.12)' : 'transparent',
              color: view === v ? C.data : 'rgba(148,163,184,0.6)',
              boxShadow: view === v ? `inset 0 0 0 1px rgba(0,245,255,0.25)` : 'none',
            }}>
              {v === 'arch' ? 'Architecture View' : 'Data Flow View'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Legend ── */}
      <div style={{ display: 'flex', gap: 16, padding: '8px 18px',
        borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
        {Object.entries(LAYER_LABELS).map(([layer, label]) => (
          <div key={layer} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: LAYER_COLORS[layer],
              boxShadow: `0 0 6px ${LAYER_COLORS[layer]}80` }}/>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.7)',
              textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(100,116,139,0.5)', alignSelf: 'center' }}>
          Click any node to inspect details
        </div>
      </div>

      {/* ── SVG diagram ── */}
      <div style={{ position: 'relative', overflowX: 'auto' }}>
        <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          style={{ display: 'block', minWidth: SVG_W }}>

          {/* Animated gradient defs */}
          <defs>
            {Object.entries(LAYER_COLORS).map(([layer, color]) => (
              <linearGradient key={layer} id={`grad-${layer}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={color} stopOpacity={0.8}/>
                <stop offset="100%" stopColor={color} stopOpacity={0.3}/>
              </linearGradient>
            ))}
            <filter id="glow">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
              <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <style>{`
              @keyframes dashFlow {
                0%   { stroke-dashoffset: 24; }
                100% { stroke-dashoffset: 0; }
              }
              @keyframes dashFlowFlow {
                0%   { stroke-dashoffset: 0; }
                100% { stroke-dashoffset: -24; }
              }
              .edge-base { animation: dashFlow 1.8s linear infinite; }
              .edge-flow  { animation: dashFlowFlow 1.2s linear infinite; }
            `}</style>
          </defs>

          {/* ── Edges ── */}
          {EDGES.map(([a, b]) => {
            const na = nodeMap[a], nb = nodeMap[b];
            if (!na || !nb) return null;
            const x1 = px(na.x, SVG_W) + 60;
            const y1 = px(na.y, SVG_H) + 18;
            const x2 = px(nb.x, SVG_W);
            const y2 = px(nb.y, SVG_H) + 18;
            const midX = (x1 + x2) / 2;
            const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
            const layerColor = LAYER_COLORS[na.layer];
            const isActiveEdge = selected &&
              ((a === selected.id || b === selected.id));
            const opacity = selected
              ? (isActiveEdge ? 1 : 0.08)
              : (hoveredId === a || hoveredId === b ? 0.9 : 0.25);

            return (
              <g key={`${a}-${b}`}>
                {/* Base path */}
                <path d={d} fill="none"
                  stroke={layerColor} strokeWidth={isActiveEdge ? 2 : 1}
                  strokeDasharray={view === 'flow' ? '8 4' : 'none'}
                  opacity={opacity}
                  className={view === 'flow' ? 'edge-flow' : ''}
                  filter={isActiveEdge ? 'url(#glow)' : undefined}
                />
                {/* Arrow head */}
                {isActiveEdge && (
                  <circle cx={x2} cy={y2} r={3} fill={layerColor} opacity={0.9}/>
                )}
              </g>
            );
          })}

          {/* ── Nodes ── */}
          {NODES.map(n => {
            const nx = px(n.x, SVG_W);
            const ny = px(n.y, SVG_H);
            const color = LAYER_COLORS[n.layer];
            const isActive = selected?.id === n.id;
            const isHov = hoveredId === n.id;
            const opacity = selected ? (isHighlighted(n.id) ? 1 : 0.2) : 1;

            return (
              <g key={n.id} transform={`translate(${nx},${ny})`}
                style={{ cursor: 'pointer', opacity, transition: 'opacity 0.2s' }}
                onClick={() => handleNode(n)}
                onMouseEnter={() => setHoveredId(n.id)}
                onMouseLeave={() => setHoveredId(null)}>

                {/* Glow ring when active */}
                {(isActive || isHov) && (
                  <rect x={-3} y={-3} width={126} height={42} rx={11}
                    fill="none" stroke={color} strokeWidth={1.5}
                    opacity={0.6} filter="url(#glow)"/>
                )}

                {/* Card bg */}
                <rect x={0} y={0} width={120} height={36} rx={9}
                  fill={isActive
                    ? `rgba(${hexToRgb(color)},0.18)`
                    : isHov ? `rgba(${hexToRgb(color)},0.10)` : 'rgba(15,23,42,0.85)'}
                  stroke={color}
                  strokeWidth={isActive ? 1.5 : 0.5}
                  strokeOpacity={isActive ? 0.8 : 0.3}
                />

                {/* Color stripe left */}
                <rect x={0} y={0} width={4} height={36} rx={9}
                  fill={color} opacity={isActive ? 1 : 0.6}/>
                <rect x={0} y={18} width={4} height={18} rx={0} fill={color} opacity={isActive ? 1 : 0.6}/>

                {/* Label */}
                <text x={12} y={14} fontSize={10} fontWeight={800}
                  fill={isActive ? color : '#d4dde8'} fontFamily="inherit">
                  {n.label}
                </text>
                <text x={12} y={27} fontSize={8.5} fontWeight={500}
                  fill="rgba(148,163,184,0.65)" fontFamily="inherit">
                  {n.sublabel}
                </text>
              </g>
            );
          })}

          {/* Column labels */}
          {[
            { x: 6,  label: 'DATA SOURCES' },
            { x: 22, label: 'ETL' },
            { x: 39, label: 'FEATURES' },
            { x: 56, label: 'ML MODELS' },
            { x: 74, label: 'OUTPUTS' },
            { x: 90, label: 'DECISIONS' },
          ].map(col => (
            <text key={col.x} x={px(col.x, SVG_W) + 60} y={12}
              textAnchor="middle" fontSize={7.5} fontWeight={900}
              fill="rgba(100,116,139,0.5)" letterSpacing="1.5"
              fontFamily="inherit" textDecoration="none">
              {col.label}
            </text>
          ))}
        </svg>
      </div>

      {/* ── Detail panel (slide-in) ── */}
      {selected && (
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 340,
          background: 'rgba(8,14,28,0.97)', backdropFilter: 'blur(24px)',
          borderLeft: `1px solid rgba(${hexToRgb(LAYER_COLORS[selected.layer])},0.3)`,
          display: 'flex', flexDirection: 'column',
          boxShadow: `-8px 0 40px rgba(0,0,0,0.6), inset 1px 0 0 rgba(${hexToRgb(LAYER_COLORS[selected.layer])},0.1)`,
          animation: 'slideInRight 0.2s ease-out',
        }}>
          <style>{`@keyframes slideInRight { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>

          {/* Panel header */}
          <div style={{ padding: '14px 16px', borderBottom: `1px solid rgba(${hexToRgb(LAYER_COLORS[selected.layer])},0.15)`,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2,
                  background: LAYER_COLORS[selected.layer],
                  boxShadow: `0 0 8px ${LAYER_COLORS[selected.layer]}` }}/>
                <span style={{ fontSize: 8, fontWeight: 900, color: LAYER_COLORS[selected.layer],
                  textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  {LAYER_LABELS[selected.layer]}
                </span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#e2eaf4', lineHeight: 1.2 }}>
                {selected.label}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', marginTop: 2 }}>
                {selected.sublabel}
              </div>
            </div>
            <button onClick={() => setSelected(null)} style={{
              background: 'none', border: 'none', color: 'rgba(148,163,184,0.5)',
              cursor: 'pointer', padding: 4, flexShrink: 0 }}>
              <X size={14}/>
            </button>
          </div>

          {/* Panel body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px',
            display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Description */}
            <p style={{ fontSize: 11, color: 'rgba(196,210,225,0.85)', lineHeight: 1.6, margin: 0 }}>
              {selected.detail.description}
            </p>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { icon: <Cpu size={10}/>, label: 'Algorithm', value: selected.detail.algorithm },
                { icon: <Database size={10}/>, label: 'Training Data', value: selected.detail.trainingSize },
                { icon: <Target size={10}/>, label: 'Accuracy', value: selected.detail.accuracy },
              ].map(s => (
                <div key={s.label} style={{
                  background: `rgba(${hexToRgb(LAYER_COLORS[selected.layer])},0.06)`,
                  border: `1px solid rgba(${hexToRgb(LAYER_COLORS[selected.layer])},0.15)`,
                  borderRadius: 8, padding: '8px 10px',
                  gridColumn: s.label === 'Algorithm' ? '1 / -1' : 'auto',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3,
                    color: LAYER_COLORS[selected.layer] }}>
                    {s.icon}
                    <span style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase',
                      letterSpacing: '0.1em' }}>{s.label}</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#d4dde8', lineHeight: 1.4 }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Inputs */}
            <div>
              <div style={{ fontSize: 8, fontWeight: 900, color: 'rgba(148,163,184,0.5)',
                textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
                Inputs
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {selected.detail.inputs.map(inp => (
                  <div key={inp} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ChevronRight size={9} style={{ color: LAYER_COLORS[selected.layer], flexShrink: 0 }}/>
                    <span style={{ fontSize: 10, color: 'rgba(196,210,225,0.75)' }}>{inp}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Outputs */}
            <div>
              <div style={{ fontSize: 8, fontWeight: 900, color: 'rgba(148,163,184,0.5)',
                textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
                Outputs
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {selected.detail.outputs.map(out => (
                  <div key={out} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ArrowRight size={9} style={{ color: C.output, flexShrink: 0 }}/>
                    <span style={{ fontSize: 10, color: 'rgba(196,210,225,0.75)' }}>{out}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Connected nodes */}
            <div>
              <div style={{ fontSize: 8, fontWeight: 900, color: 'rgba(148,163,184,0.5)',
                textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
                Connected Nodes
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {EDGES
                  .filter(([a, b]) => a === selected.id || b === selected.id)
                  .map(([a, b]) => {
                    const otherId = a === selected.id ? b : a;
                    const other = nodeMap[otherId];
                    if (!other) return null;
                    return (
                      <button key={otherId} onClick={() => handleNode(other)} style={{
                        fontSize: 9, padding: '3px 8px', borderRadius: 5,
                        background: `rgba(${hexToRgb(LAYER_COLORS[other.layer])},0.1)`,
                        border: `1px solid rgba(${hexToRgb(LAYER_COLORS[other.layer])},0.3)`,
                        color: LAYER_COLORS[other.layer], cursor: 'pointer',
                        fontWeight: 700,
                      }}>{other.label}</button>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`;
}
