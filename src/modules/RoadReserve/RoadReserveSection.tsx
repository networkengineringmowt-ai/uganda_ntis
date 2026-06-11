import { useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  Landmark, MapPin, FileText, Gavel, AlertTriangle, ShieldAlert, Download,
  Filter, ChevronRight, Building2, Sprout, Megaphone, Cable, X,
  ClipboardList, CheckCircle2, Clock,
} from 'lucide-react';
import { hexRgb } from '../../lib/chart3d';
import { ModuleNavBar } from '../../shared/ModuleNavBar';
import { CaptureButton } from '../../shared/CaptureButton';
import { useBMS } from '../../store/BMSContext';

// ── Color palette (matches platform convention) ──────────────────────────────
const C = {
  purple: '#b967ff', cyan: '#00f5ff', green: '#00ff88',
  blue: '#4d9fff', yellow: '#ffd23f', orange: '#ff6b35',
  pink: '#ff2d78', teal: '#00d4aa', red: '#ff3366', gray: '#94a3b8',
};

const card = (accent: string) => ({
  background: 'rgba(15,23,42,0.7)',
  border: `1px solid rgba(${hexRgb(accent)},0.2)`,
  borderRadius: 12,
  padding: '18px 20px',
  boxShadow: `0 0 20px rgba(${hexRgb(accent)},0.06)`,
});

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview', label: 'Overview',              icon: <Landmark size={13}/> },
  { id: 'map',      label: 'Reserve Map',           icon: <MapPin size={13}/> },
  { id: 'register', label: 'Encroachment Register', icon: <ShieldAlert size={13}/> },
  { id: 'gazette',  label: 'Gazette & Legal Status',icon: <Gavel size={13}/> },
  { id: 'permits',  label: 'Permits & Applications',icon: <ClipboardList size={13}/> },
] as const;
type TabId = typeof TABS[number]['id'];

// ── Reserve width policy by road class (visual proxy + reference table) ──────
const RESERVE_WIDTHS: Record<string, { min: number; max: number; label: string }> = {
  A: { min: 30, max: 60, label: 'National roads' },
  B: { min: 30, max: 60, label: 'National roads' },
  M: { min: 30, max: 60, label: 'National roads (dual/major)' },
  C: { min: 20, max: 30, label: 'District roads' },
  D: { min: 15, max: 20, label: 'Urban roads' },
};

// Polyline weight proportional to road class — visual proxy for reserve corridor width
const CLASS_WEIGHT: Record<string, number> = { A: 8, M: 8, B: 6, C: 4, D: 3 };
const CLASS_COLOR:  Record<string, string>  = { A: C.cyan, M: C.purple, B: C.blue, C: C.yellow, D: C.gray };

function classGroup(cls: string): 'national' | 'regional' | 'district' {
  if (cls === 'A' || cls === 'M') return 'national';
  if (cls === 'B') return 'regional';
  return 'district';
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK / PLACEHOLDER DATA — no real road-reserve dataset exists yet.
// TODO: replace with Supabase query — table `road_reserve_records` (see
// supabase_schema.sql) is provisioned and ready to receive real survey /
// enforcement data once the Lands & Surveys / DNR Legal teams supply it.
// ─────────────────────────────────────────────────────────────────────────────

type EncroachmentType = 'Structure' | 'Cultivation' | 'Billboard' | 'Utility';
type EncroachmentStatus = 'Active' | 'Notice issued' | 'Evicted' | 'Resolved';

interface EncroachmentRecord {
  id: string;
  link_id: string;
  road_no: string;
  location: string;
  chainage_km: number;
  type: EncroachmentType;
  date_reported: string;
  status: EncroachmentStatus;
  region: string;
  road_class: string;
  notes: string;
}

// TODO: replace with Supabase query — table `road_reserve_encroachments` (see supabase_schema.sql).
//   Columns map 1:1 to EncroachmentRecord:
//   SELECT id, link_id, road_no, location, chainage_km, type, date_reported,
//          status, region, road_class, notes
//   FROM road_reserve_encroachments
//   ORDER BY date_reported DESC;
const ENCROACHMENT_RECORDS: EncroachmentRecord[] = [
  { id: 'ENC-2026-001', link_id: 'A001_Link01', road_no: 'A001', location: 'Mukono Town Centre',         chainage_km: 21.4, type: 'Structure',   date_reported: '2026-01-12', status: 'Notice issued', region: 'Central',  road_class: 'A', notes: 'Permanent shop structure built within 12m of carriageway centreline' },
  { id: 'ENC-2026-002', link_id: 'A001_Link01', road_no: 'A001', location: 'Najjera roundabout approach', chainage_km: 8.2,  type: 'Billboard',   date_reported: '2026-02-03', status: 'Active',        region: 'Central',  road_class: 'A', notes: 'Unlicensed advertising billboard erected on shoulder' },
  { id: 'ENC-2026-003', link_id: 'B014_Link02', road_no: 'B014', location: 'Bugiri – Busia corridor',     chainage_km: 47.6, type: 'Cultivation', date_reported: '2025-11-20', status: 'Resolved',      region: 'Eastern',  road_class: 'B', notes: 'Maize gardens encroaching drainage reserve — cleared after notice' },
  { id: 'ENC-2026-004', link_id: 'M3N2_Link01', road_no: 'M3N2', location: 'Munyonyo spur junction',      chainage_km: 3.1,  type: 'Utility',     date_reported: '2026-03-08', status: 'Active',        region: 'Central',  road_class: 'M', notes: 'Telecom mast and fibre cabinet sited within service strip' },
  { id: 'ENC-2026-005', link_id: 'C228_Link04', road_no: 'C228', location: 'Kabale – Kisoro section',     chainage_km: 64.0, type: 'Structure',   date_reported: '2025-09-15', status: 'Evicted',       region: 'Western',  road_class: 'C', notes: 'Temporary kiosk removed by district enforcement team' },
  { id: 'ENC-2026-006', link_id: 'A104_Link01', road_no: 'A104', location: 'Karuma – Pakwach',            chainage_km: 112.5,type: 'Cultivation', date_reported: '2026-01-29', status: 'Notice issued', region: 'Northern', road_class: 'A', notes: 'Sugarcane plantation extends 9m into gazetted reserve' },
  { id: 'ENC-2026-007', link_id: 'B077_Link03', road_no: 'B077', location: 'Soroti – Katakwi',            chainage_km: 18.9, type: 'Billboard',   date_reported: '2026-02-22', status: 'Active',        region: 'Eastern',  road_class: 'B', notes: 'Two large-format billboards within sight-distance triangle' },
  { id: 'ENC-2026-008', link_id: 'A009_Link02', road_no: 'A009', location: 'Mbarara bypass',              chainage_km: 5.7,  type: 'Structure',   date_reported: '2025-12-04', status: 'Notice issued', region: 'Western',  road_class: 'A', notes: 'Fuel station canopy encroaches shoulder by 4.5m' },
  { id: 'ENC-2026-009', link_id: 'C310_Link01', road_no: 'C310', location: 'Lira – Otuke road',           chainage_km: 33.2, type: 'Utility',     date_reported: '2026-03-19', status: 'Active',        region: 'Northern', road_class: 'C', notes: 'Water pipeline laid through culvert headwall without permit' },
  { id: 'ENC-2026-010', link_id: 'A001_Link03', road_no: 'A001', location: 'Jinja – Iganga corridor',     chainage_km: 76.8, type: 'Cultivation', date_reported: '2025-10-02', status: 'Resolved',      region: 'Eastern',  road_class: 'A', notes: 'Banana plantation cleared from drainage easement' },
  { id: 'ENC-2026-011', link_id: 'B045_Link01', road_no: 'B045', location: 'Hoima – Kigumba',             chainage_km: 41.0, type: 'Structure',   date_reported: '2026-04-01', status: 'Active',        region: 'Western',  road_class: 'B', notes: 'Roadside market stalls erected on shoulder during trading days' },
  { id: 'ENC-2026-012', link_id: 'A104_Link04', road_no: 'A104', location: 'Gulu – Atiak',                chainage_km: 58.3, type: 'Billboard',   date_reported: '2026-01-05', status: 'Evicted',       region: 'Northern', road_class: 'A', notes: 'Illegal signage removed following joint DNR/UNRA operation' },
];

interface GazetteRecord {
  road_no: string;
  road_name: string;
  gazette_no: string;
  date_gazetted: string;
  reserve_width_m: number;
  survey_status: 'Up to date' | 'Outdated' | 'Not surveyed';
  remarks: string;
  road_class: string;
}

// TODO: replace with Supabase query — table `road_reserve_gazette` (see supabase_schema.sql).
//   Columns map 1:1 to GazetteRecord (the table's auto `id` is omitted here):
//   SELECT road_no, road_name, gazette_no, date_gazetted, reserve_width_m,
//          survey_status, remarks, road_class
//   FROM road_reserve_gazette
//   ORDER BY date_gazetted;
const GAZETTE_RECORDS: GazetteRecord[] = [
  { road_no: 'A001', road_name: 'Kampala – Jinja – Busia',     gazette_no: 'GN 47/1964', date_gazetted: '1964-06-12', reserve_width_m: 50, survey_status: 'Outdated',    remarks: 'Re-survey scheduled FY2026/27 ahead of expressway works', road_class: 'A' },
  { road_no: 'A009', road_name: 'Kampala – Mbarara – Kabale',  gazette_no: 'GN 112/1971', date_gazetted: '1971-09-03', reserve_width_m: 50, survey_status: 'Up to date',  remarks: 'Boundary pillars re-established 2024 along bypass sections', road_class: 'A' },
  { road_no: 'A104', road_name: 'Karuma – Gulu – Nimule',      gazette_no: 'GN 88/1968', date_gazetted: '1968-04-22', reserve_width_m: 50, survey_status: 'Outdated',    remarks: 'Survey markers lost in several sections post-conflict era', road_class: 'A' },
  { road_no: 'M3N2', road_name: 'Munyonyo Spur (dual)',        gazette_no: 'GN 03/2016', date_gazetted: '2016-02-18', reserve_width_m: 60, survey_status: 'Up to date',  remarks: 'Modern dual-carriageway gazette with full survey package', road_class: 'M' },
  { road_no: 'B014', road_name: 'Bugiri – Busia',              gazette_no: 'GN 65/1979', date_gazetted: '1979-11-30', reserve_width_m: 30, survey_status: 'Not surveyed', remarks: 'Original gazette traced; no modern survey on record', road_class: 'B' },
  { road_no: 'B045', road_name: 'Hoima – Kigumba',             gazette_no: 'GN 21/1985', date_gazetted: '1985-07-09', reserve_width_m: 30, survey_status: 'Outdated',    remarks: 'Encroachment pressure from oil-roads development corridor', road_class: 'B' },
  { road_no: 'B077', road_name: 'Soroti – Katakwi – Moroto',   gazette_no: 'GN 54/1981', date_gazetted: '1981-03-14', reserve_width_m: 30, survey_status: 'Not surveyed', remarks: 'Pending Lands Ministry verification of original alignment', road_class: 'B' },
  { road_no: 'C228', road_name: 'Kabale – Kisoro',             gazette_no: 'GN 19/1992', date_gazetted: '1992-05-27', reserve_width_m: 25, survey_status: 'Up to date',  remarks: 'Re-surveyed 2023 alongside DRIP-3 design works', road_class: 'C' },
  { road_no: 'C310', road_name: 'Lira – Otuke',                gazette_no: 'GN 38/1998', date_gazetted: '1998-10-08', reserve_width_m: 25, survey_status: 'Not surveyed', remarks: 'Awaiting district land office boundary confirmation', road_class: 'C' },
  { road_no: 'A001', road_name: 'Kampala Northern Bypass',     gazette_no: 'GN 07/2004', date_gazetted: '2004-01-20', reserve_width_m: 60, survey_status: 'Up to date',  remarks: 'High-pressure urban corridor; pillars monitored quarterly', road_class: 'A' },
];

// TODO: replace with Supabase query — aggregate of road_reserve_gazette by gazette year:
//   SELECT EXTRACT(YEAR FROM date_gazetted)::int AS year, COUNT(*) AS gazetted
//   FROM road_reserve_gazette
//   GROUP BY 1 ORDER BY 1;
const GAZETTE_TIMELINE = [
  { year: '1964', gazetted: 1 }, { year: '1968', gazetted: 1 }, { year: '1971', gazetted: 1 },
  { year: '1979', gazetted: 1 }, { year: '1981', gazetted: 1 }, { year: '1985', gazetted: 1 },
  { year: '1992', gazetted: 1 }, { year: '1998', gazetted: 1 }, { year: '2004', gazetted: 1 },
  { year: '2016', gazetted: 1 }, { year: '2023', gazetted: 0 }, { year: '2024', gazetted: 0 },
];

// ─────────────────────────────────────────────────────────────────────────────
// MOWT "Road Reserve Usage" online applications (Survey123 "Form 2":
// APPLICATION FOR TEMPORARY USE OF NATIONAL ROAD, ROAD RESERVE OR FERRY
// LANDING FACILITY). Fields mirror the official form Parts A–E — see the
// road_reserve_applications table in supabase_schema.sql.
// ─────────────────────────────────────────────────────────────────────────────

type ApplicationStatus = 'Draft' | 'Submitted' | 'Under Review' | 'Recommended' | 'Approved' | 'Rejected';

interface ApplicationRecord {
  application_number: string;      // auto-generated by the portal
  application_date: string;
  status: ApplicationStatus;
  registered_name: string;         // Part A — applicant
  applicant_tin: string;
  nature_of_activity: string;      // Advertising / Utility line / Parking / ...
  nature_of_structure: string;     // Billboard / LED / Optical Fibre Cable / Power Cable / Signpost / ...
  district: string;
  road_name: string;
  road_or_highway: 'road' | 'highway';
  size_summary: string;            // human-readable dimensions (length×width×height, or Ø + coverage)
  final_recommendation: 'Suitable' | 'Not Suitable' | 'Pending';   // Part E
  file_reference_number: string;
}

// TODO: replace with Supabase query — table `road_reserve_applications` (see supabase_schema.sql).
//   Writes go through the service_role write-back server (PII) — reads only via anon:
//   SELECT application_number, application_date, status, registered_name, applicant_tin,
//          nature_of_activity, nature_of_structure, district, road_name, road_or_highway,
//          final_recommendation, file_reference_number
//   FROM road_reserve_applications ORDER BY application_date DESC;
const ROAD_RESERVE_APPLICATIONS: ApplicationRecord[] = [
  { application_number: 'RRU-2026-00142', application_date: '2026-05-28', status: 'Under Review', registered_name: 'Alliance Media (U) Ltd',     applicant_tin: '1000345672', nature_of_activity: 'Advertising',  nature_of_structure: 'Billboard',           district: 'Wakiso',   road_name: 'Kampala – Entebbe Expressway', road_or_highway: 'highway', size_summary: '12.0 × 6.0 m · h 9.0 m',  final_recommendation: 'Pending',      file_reference_number: 'DRIP/ADV/2026/142' },
  { application_number: 'RRU-2026-00138', application_date: '2026-05-21', status: 'Approved',     registered_name: 'MTN Uganda Ltd',            applicant_tin: '1000019283', nature_of_activity: 'Utility line', nature_of_structure: 'Optical Fibre Cable', district: 'Mukono',   road_name: 'Kampala – Jinja (A109)',       road_or_highway: 'road',    size_summary: 'Ø 48 mm · 14.2 km',       final_recommendation: 'Suitable',     file_reference_number: 'DRIP/UTL/2026/138' },
  { application_number: 'RRU-2026-00131', application_date: '2026-05-14', status: 'Recommended',  registered_name: 'Next Media Services',       applicant_tin: '1000456781', nature_of_activity: 'Advertising',  nature_of_structure: 'LED',                 district: 'Kampala',  road_name: 'Kampala Northern Bypass (A001)',road_or_highway: 'highway', size_summary: '8.0 × 4.0 m · h 7.5 m',  final_recommendation: 'Suitable',     file_reference_number: 'DRIP/ADV/2026/131' },
  { application_number: 'RRU-2026-00125', application_date: '2026-05-09', status: 'Approved',     registered_name: 'Umeme Ltd',                 applicant_tin: '1000022914', nature_of_activity: 'Utility line', nature_of_structure: 'Power Cable',         district: 'Jinja',    road_name: 'Jinja – Iganga (A109)',        road_or_highway: 'road',    size_summary: 'Ø 120 mm · 6.8 km',       final_recommendation: 'Suitable',     file_reference_number: 'DRIP/UTL/2026/125' },
  { application_number: 'RRU-2026-00119', application_date: '2026-04-30', status: 'Rejected',     registered_name: 'Bright Outdoor Ltd',        applicant_tin: '1000567892', nature_of_activity: 'Advertising',  nature_of_structure: 'Billboard',           district: 'Mbarara',  road_name: 'Kampala – Mbarara (A009)',     road_or_highway: 'highway', size_summary: '10.0 × 5.0 m · h 8.0 m', final_recommendation: 'Not Suitable', file_reference_number: 'DRIP/ADV/2026/119' },
  { application_number: 'RRU-2026-00112', application_date: '2026-04-22', status: 'Submitted',    registered_name: 'Roke Telkom Ltd',           applicant_tin: '1000334451', nature_of_activity: 'Utility line', nature_of_structure: 'Optical Fibre Cable', district: 'Mbale',    road_name: 'Mbale – Soroti (A104)',        road_or_highway: 'road',    size_summary: 'Ø 36 mm · 22.0 km',       final_recommendation: 'Pending',      file_reference_number: 'DRIP/UTL/2026/112' },
  { application_number: 'RRU-2026-00104', application_date: '2026-04-15', status: 'Under Review', registered_name: 'Vision Group',              applicant_tin: '1000118822', nature_of_activity: 'Advertising',  nature_of_structure: 'Price Board',         district: 'Masaka',   road_name: 'Kampala – Masaka (A007)',      road_or_highway: 'road',    size_summary: '3.0 × 2.0 m · h 4.0 m',  final_recommendation: 'Pending',      file_reference_number: 'DRIP/ADV/2026/104' },
  { application_number: 'RRU-2026-00098', application_date: '2026-04-03', status: 'Approved',     registered_name: 'Kampala Parking Ltd',       applicant_tin: '1000771230', nature_of_activity: 'Parking',      nature_of_structure: 'Signpost',            district: 'Kampala',  road_name: 'Jinja Road Service Lane',      road_or_highway: 'road',    size_summary: '0.6 × 0.9 m · h 2.4 m',  final_recommendation: 'Suitable',     file_reference_number: 'DRIP/PRK/2026/098' },
  { application_number: 'RRU-2026-00091', application_date: '2026-03-27', status: 'Recommended',  registered_name: 'Airtel Uganda Ltd',         applicant_tin: '1000044556', nature_of_activity: 'Utility line', nature_of_structure: 'Optical Fibre Cable', district: 'Gulu',     road_name: 'Karuma – Gulu (A104)',         road_or_highway: 'road',    size_summary: 'Ø 42 mm · 31.5 km',       final_recommendation: 'Suitable',     file_reference_number: 'DRIP/UTL/2026/091' },
  { application_number: 'RRU-2026-00084', application_date: '2026-03-18', status: 'Draft',        registered_name: 'Standard Signs (U) Ltd',    applicant_tin: '1000662019', nature_of_activity: 'Advertising',  nature_of_structure: 'Billboard',           district: 'Fort Portal',road_name: 'Mubende – Fort Portal (A109)', road_or_highway: 'road',    size_summary: '6.0 × 3.0 m · h 6.0 m',  final_recommendation: 'Pending',      file_reference_number: '—' },
];

const APP_STATUS_COLOR: Record<ApplicationStatus, string> = {
  Draft: C.gray, Submitted: C.blue, 'Under Review': C.yellow,
  Recommended: C.teal, Approved: C.green, Rejected: C.red,
};

const ENC_TYPE_ICON: Record<EncroachmentType, React.ReactNode> = {
  Structure:   <Building2 size={12}/>,
  Cultivation: <Sprout size={12}/>,
  Billboard:   <Megaphone size={12}/>,
  Utility:     <Cable size={12}/>,
};

const ENC_STATUS_COLOR: Record<EncroachmentStatus, string> = {
  Active: C.red, 'Notice issued': C.yellow, Evicted: C.blue, Resolved: C.green,
};

// ── Quick-nav chips ───────────────────────────────────────────────────────────
const QUICK_LINKS: { label: string; view: string; color: string; icon: React.ReactNode }[] = [
  { label: 'RMS — Road Network',      view: 'rms',      color: C.cyan,   icon: <ChevronRight size={11}/> },
  { label: 'Bridge Management',       view: 'bms',      color: C.blue,   icon: <ChevronRight size={11}/> },
  { label: 'Sources & Evidence',      view: 'sources',  color: C.gray,   icon: <ChevronRight size={11}/> },
  { label: 'Admin Tools',             view: 'admin',    color: C.purple, icon: <ChevronRight size={11}/> },
];

// ── KPI helpers (computed from mock data — would be backed by network_stats / reserve table) ──
function useReserveKpis() {
  return useMemo(() => {
    // TODO: replace with Supabase query — these aggregate KPIs should come from
    // `road_reserve_records` (gazetted_width_m, reserve_status, encroachment_count,
    // encroachment_area_sqm, enforcement_status) plus COUNT/SUM over
    // `road_reserve_encroachments` and `road_reserve_gazette` once populated.
    // Until then they're derived from OFFICIAL_NETWORK_KM and the mock arrays.
    const totalKm = 21302;
    const avgWidthM = 38; // weighted placeholder average across classes
    const gazettedAreaSqKm = +(totalKm * avgWidthM / 1000).toFixed(1);
    const titledPct = +((GAZETTE_RECORDS.filter(g => g.survey_status === 'Up to date').length / GAZETTE_RECORDS.length) * 100).toFixed(0);
    const activeEncroachments = ENCROACHMENT_RECORDS.filter(e => e.status === 'Active').length;
    const noticesIssued = ENCROACHMENT_RECORDS.filter(e => e.status === 'Notice issued').length;
    return { gazettedAreaSqKm, titledPct, activeEncroachments, noticesIssued };
  }, []);
}

// ─────────────────────────────────────────────────────────────────────────────
export default function RoadReserveSection() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const { dispatch } = useBMS();
  const kpis = useReserveKpis();

  return (
    <div style={{ padding: '20px 18px', minHeight: '100%',
      background: 'linear-gradient(180deg, rgba(8,14,28,0.4) 0%, transparent 100%)' }}>

      <ModuleNavBar module="Road Reserve" />

      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: `linear-gradient(135deg, rgba(${hexRgb(C.teal)},0.25), rgba(${hexRgb(C.green)},0.1))`,
            border: `1px solid rgba(${hexRgb(C.teal)},0.45)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Landmark size={16} style={{ color: C.teal }}/>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#e2eaf4', letterSpacing: '-0.01em' }}>
              Road Reserve Management
            </div>
            <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.65)', marginTop: 1 }}>
              Gazette status · Encroachment register · Reserve mapping · Usage permits (MOWT Form 2) · Legal enforcement
            </div>
          </div>
        </div>
      </div>

      {/* ── Capture screen launcher ── */}
      <CaptureButton capture="encroachment" label="road-reserve field data" accent={C.teal} />

      {/* ── Tab bar ── */}
      <div style={{
        display: 'flex', gap: 2, marginBottom: 20, flexShrink: 0,
        borderBottom: '1px solid rgba(77,159,255,0.15)',
        background: 'rgba(4,9,18,0.85)', marginLeft: -20, marginRight: -20, paddingLeft: 14,
      }}>
        {TABS.map(t => {
          const isActive = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px 11px', fontSize: 11, fontWeight: isActive ? 800 : 500,
              background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
              color: isActive ? '#4d9fff' : 'rgba(148,163,184,0.70)',
              borderBottom: isActive ? '2px solid #4d9fff' : '2px solid transparent',
              transition: 'all 0.13s',
            }}>
              {t.icon} {t.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' && (
        <OverviewTab kpis={kpis} onNavigate={(view) => dispatch({ type: 'SET_ACTIVE_VIEW', payload: view as any })} />
      )}
      {activeTab === 'map'      && <ReserveMapTab />}
      {activeTab === 'register' && <EncroachmentRegisterTab />}
      {activeTab === 'gazette'  && <GazetteTab />}
      {activeTab === 'permits'  && <PermitsTab />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 1 — OVERVIEW
// ═════════════════════════════════════════════════════════════════════════════
function OverviewTab({ kpis, onNavigate }: {
  kpis: { gazettedAreaSqKm: number; titledPct: number; activeEncroachments: number; noticesIssued: number };
  onNavigate: (view: string) => void;
}) {
  const KPI_CARDS = [
    { label: 'Total gazetted reserve area', value: `${kpis.gazettedAreaSqKm.toLocaleString()} km²`, sub: 'Estimated · weighted by class width', color: C.teal,   icon: <Landmark size={16}/> },
    { label: '% with valid land titles',    value: `${kpis.titledPct}%`,                            sub: 'Of sampled gazette records (mock)',  color: C.green,  icon: <FileText size={16}/> },
    { label: 'Encroachment incidents',      value: `${kpis.activeEncroachments}`,                   sub: 'Active cases — mock register',       color: C.red,    icon: <ShieldAlert size={16}/> },
    { label: 'Eviction notices issued',     value: `${kpis.noticesIssued}`,                         sub: 'Pending action — mock register',     color: C.yellow, icon: <Megaphone size={16}/> },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {KPI_CARDS.map(k => (
          <div key={k.label} style={card(k.color)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8,
                background: `rgba(${hexRgb(k.color)},0.12)`, border: `1px solid rgba(${hexRgb(k.color)},0.3)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.color }}>
                {k.icon}
              </div>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(148,163,184,0.75)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {k.label}
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#e2eaf4', letterSpacing: '-0.02em' }}>{k.value}</div>
            <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.55)', marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* Definition card */}
        <div style={{ ...card(C.teal), gridColumn: 'span 2' }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: C.teal, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            What is a Road Reserve?
          </div>
          <p style={{ fontSize: 11, color: 'rgba(196,210,225,0.85)', lineHeight: 1.7, margin: 0 }}>
            The road reserve is the land corridor legally gazetted for road use — encompassing the
            carriageway, shoulders, drains, slopes, service strips, and space reserved for future
            expansion. It is protected under the Uganda Roads Act and Land Act to preserve safety
            sight-lines, enable maintenance access, and secure land for long-term network growth.
          </p>
          <p style={{ fontSize: 11, color: 'rgba(196,210,225,0.85)', lineHeight: 1.7, margin: '10px 0 0' }}>
            Encroachment — through permanent structures, cultivation, billboards, or utilities —
            erodes this corridor, creates road-safety hazards, and raises the cost and complexity
            of future upgrading and widening projects.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 16 }}>
            {[
              { cls: 'National roads', width: '30 – 60 m', color: C.cyan },
              { cls: 'District roads', width: '20 – 30 m', color: C.yellow },
              { cls: 'Urban roads',    width: '15 – 20 m', color: C.pink },
            ].map(r => (
              <div key={r.cls} style={{ background: `rgba(${hexRgb(r.color)},0.06)`,
                border: `1px solid rgba(${hexRgb(r.color)},0.2)`, borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.7)', fontWeight: 700, marginBottom: 4 }}>{r.cls}</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: r.color }}>{r.width}</div>
                <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)', marginTop: 2 }}>Gazetted reserve width</div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick navigation */}
        <div style={card(C.blue)}>
          <div style={{ fontSize: 11, fontWeight: 900, color: C.blue, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            Related Sections
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {QUICK_LINKS.map(q => (
              <button key={q.view} onClick={() => onNavigate(q.view)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                padding: '9px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                background: `rgba(${hexRgb(q.color)},0.06)`, border: `1px solid rgba(${hexRgb(q.color)},0.2)`,
                color: '#d4dde8', fontSize: 11, fontWeight: 700,
              }}>
                {q.label}
                <span style={{ color: q.color, display: 'flex' }}>{q.icon}</span>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)', marginTop: 12, lineHeight: 1.6 }}>
            Navigate to related modules to cross-reference road links, structures, and
            evidence sources relevant to reserve enforcement and gazette verification.
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 2 — RESERVE MAP
// ═════════════════════════════════════════════════════════════════════════════
interface LinkProps {
  link_id: string; road_no: string; road_class: string; length_km1: number;
  link_nam_1?: string; surface_ty?: string; maintena_1?: string;
}

function gazetteStatusFor(linkId: string): 'Gazetted' | 'Pending' | 'Unknown' {
  // TODO: replace with Supabase query — join road_links.link_id = road_reserve_records.link_id,
  //        return road_reserve_records.reserve_status (Gazetted / Pending Gazettement / Disputed)
  const hash = linkId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const m = hash % 3;
  return m === 0 ? 'Gazetted' : m === 1 ? 'Pending' : 'Unknown';
}

function encroachmentCountFor(linkId: string): number {
  return ENCROACHMENT_RECORDS.filter(e => e.link_id === linkId).length;
}

function ReserveMapTab() {
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [selected, setSelected] = useState<LinkProps | null>(null);
  const [showCorridor, setShowCorridor] = useState(true);
  const [showEncroachment, setShowEncroachment] = useState(true);
  const [showTitles, setShowTitles] = useState(false);

  useState(() => {
    const base = (import.meta as any).env?.BASE_URL ?? '/';
    fetch(`${base}data/network2026.geojson`)
      .then(r => r.json())
      .then(d => setGeoData(d))
      .catch(() => setGeoData(null));
    return undefined;
  });

  const styleFeature = useCallback((feature?: GeoJSON.Feature): L.PathOptions => {
    const p = (feature?.properties ?? {}) as any;
    const cls = String(p.road_class ?? 'C');
    if (!showCorridor) return { opacity: 0.35, weight: 1.5, color: 'rgba(148,163,184,0.4)' };
    return {
      color: CLASS_COLOR[cls] ?? C.gray,
      weight: CLASS_WEIGHT[cls] ?? 3,
      opacity: 0.55,
    };
  }, [showCorridor]);

  const onEachFeature = useCallback((feature: GeoJSON.Feature, layer: L.Layer) => {
    const p = feature.properties as any;
    layer.on({
      click: () => setSelected({
        link_id: p.link_id, road_no: p.road_no, road_class: p.road_class,
        length_km1: p.length_km1, link_nam_1: p.link_nam_1,
        surface_ty: p.surface_ty, maintena_1: p.maintena_1,
      }),
      mouseover: (e: any) => e.target.setStyle({ weight: (CLASS_WEIGHT[p.road_class] ?? 3) + 2, opacity: 0.9 }),
      mouseout:  (e: any) => e.target.setStyle(styleFeature(feature)),
    });
  }, [styleFeature]);

  const detail = selected ? {
    width: RESERVE_WIDTHS[selected.road_class] ?? RESERVE_WIDTHS.C,
    gazette: gazetteStatusFor(selected.link_id),
    encroachments: encroachmentCountFor(selected.link_id),
  } : null;

  return (
    <div style={{ display: 'flex', gap: 14, height: 'calc(100vh - 260px)', minHeight: 520 }}>
      {/* Map */}
      <div style={{ flex: 1, position: 'relative', borderRadius: 12, overflow: 'hidden',
        border: '1px solid rgba(0,212,170,0.2)' }}>
        <MapContainer center={[1.4, 32.3]} zoom={7} zoomControl={false}
          style={{ width: '100%', height: '100%', background: '#0a1120' }}>
          <ZoomControl position="bottomright" />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution="&copy; CARTO &copy; OpenStreetMap contributors"
          />
          {geoData && (
            <GeoJSON data={geoData} style={styleFeature} onEachFeature={onEachFeature} />
          )}
        </MapContainer>

        {/* Layer toggles */}
        <div style={{
          position: 'absolute', top: 12, left: 12, zIndex: 1000,
          background: 'rgba(8,14,28,0.92)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7,
          fontSize: 10, color: '#d4dde8', minWidth: 178,
        }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: 'rgba(148,163,184,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
            Layers
          </div>
          {[
            { key: 'corridor',     label: 'Show reserve corridor',     val: showCorridor,     set: setShowCorridor },
            { key: 'encroachment', label: 'Show encroachment points',  val: showEncroachment, set: setShowEncroachment },
            { key: 'titles',       label: 'Show title boundaries',     val: showTitles,       set: setShowTitles },
          ].map(t => (
            <label key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
              <input type="checkbox" checked={t.val} onChange={() => t.set(v => !v)} style={{ accentColor: C.teal }} />
              {t.label}
            </label>
          ))}
          <div style={{ fontSize: 8.5, color: 'rgba(148,163,184,0.45)', marginTop: 2, lineHeight: 1.5 }}>
            Corridor weight is a visual proxy for reserve width: national = 8px, regional = 6px, district = 4px.
          </div>
        </div>

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 12, left: 12, zIndex: 1000,
          background: 'rgba(8,14,28,0.92)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, padding: '8px 12px', display: 'flex', gap: 12, fontSize: 9.5, color: '#d4dde8',
        }}>
          {[
            { cls: 'A / M — National', color: C.cyan },
            { cls: 'B — Regional',     color: C.blue },
            { cls: 'C — District',     color: C.yellow },
          ].map(l => (
            <div key={l.cls} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 16, height: 4, borderRadius: 2, background: l.color, display: 'inline-block' }} />
              {l.cls}
            </div>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      <div style={{ width: 290, flexShrink: 0, ...card(C.teal), overflow: 'auto' }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: C.teal, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
          Link Detail
        </div>
        {!selected && (
          <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)', lineHeight: 1.7 }}>
            Click any road link on the map to view its reserve corridor details — width policy,
            gazette status, and recorded encroachments.
          </div>
        )}
        {selected && detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#e2eaf4' }}>{selected.link_id}</div>
              <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.65)' }}>{selected.link_nam_1 || selected.road_no}</div>
            </div>
            {[
              { label: 'Road class',       value: selected.road_class, color: CLASS_COLOR[selected.road_class] ?? C.gray },
              { label: 'Reserve width (m)', value: `${detail.width.min} – ${detail.width.max} m (${detail.width.label})`, color: C.cyan },
              { label: 'Gazette status',   value: detail.gazette, color: detail.gazette === 'Gazetted' ? C.green : detail.gazette === 'Pending' ? C.yellow : C.gray },
              { label: 'Encroachment count', value: `${detail.encroachments}`, color: detail.encroachments > 0 ? C.red : C.green },
              { label: 'Length',           value: `${Number(selected.length_km1).toFixed(1)} km`, color: '#d4dde8' },
              { label: 'Surface',          value: selected.surface_ty || '—', color: '#d4dde8' },
              { label: 'Region',           value: selected.maintena_1 || '—', color: '#d4dde8' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.65)' }}>{r.label}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: r.color }}>{r.value}</span>
              </div>
            ))}
            <div style={{ fontSize: 8.5, color: 'rgba(148,163,184,0.45)', marginTop: 6, lineHeight: 1.6 }}>
              Gazette status and encroachment counts are illustrative placeholders.
              {/* TODO: replace with Supabase query — road_reserve_records (reserve_status, encroachment_count) joined on link_id */}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 3 — ENCROACHMENT REGISTER
// ═════════════════════════════════════════════════════════════════════════════
function exportToCsv(rows: EncroachmentRecord[]) {
  const headers = ['ID', 'Road Link', 'Location/Chainage', 'Type', 'Date Reported', 'Status', 'Region', 'Class', 'Notes'];
  const lines = rows.map(r => [
    r.id, r.link_id, `${r.location} (km ${r.chainage_km})`, r.type, r.date_reported, r.status, r.region, r.road_class, r.notes,
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'encroachment_register.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function EncroachmentRegisterTab() {
  const [statusFilter, setStatusFilter] = useState<'all' | EncroachmentStatus>('all');
  const [classFilter, setClassFilter] = useState<'all' | string>('all');
  const [regionFilter, setRegionFilter] = useState<'all' | string>('all');

  const regions = useMemo(() => Array.from(new Set(ENCROACHMENT_RECORDS.map(r => r.region))).sort(), []);
  const classes = useMemo(() => Array.from(new Set(ENCROACHMENT_RECORDS.map(r => r.road_class))).sort(), []);

  const filtered = useMemo(() => ENCROACHMENT_RECORDS.filter(r =>
    (statusFilter === 'all' || r.status === statusFilter) &&
    (classFilter === 'all' || r.road_class === classFilter) &&
    (regionFilter === 'all' || r.region === regionFilter)
  ), [statusFilter, classFilter, regionFilter]);

  const totalActive   = ENCROACHMENT_RECORDS.filter(r => r.status === 'Active').length;
  const noticesIssued = ENCROACHMENT_RECORDS.filter(r => r.status === 'Notice issued').length;
  const thisYear = '2026';
  const resolvedThisYear = ENCROACHMENT_RECORDS.filter(r => r.status === 'Resolved' && r.date_reported.startsWith(thisYear.slice(0, 3))).length
    || ENCROACHMENT_RECORDS.filter(r => r.status === 'Resolved').length;

  const selStyle: React.CSSProperties = {
    background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(148,163,184,0.25)',
    borderRadius: 7, color: '#d4dde8', fontSize: 10.5, fontWeight: 700, padding: '6px 10px', cursor: 'pointer',
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {[
          { label: 'Total active', value: totalActive, color: C.red, icon: <AlertTriangle size={14}/> },
          { label: 'Notices issued', value: noticesIssued, color: C.yellow, icon: <Megaphone size={14}/> },
          { label: 'Resolved this year', value: resolvedThisYear, color: C.green, icon: <ShieldAlert size={14}/> },
        ].map(s => (
          <div key={s.label} style={{ ...card(s.color), flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px' }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `rgba(${hexRgb(s.color)},0.12)`,
              border: `1px solid rgba(${hexRgb(s.color)},0.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#e2eaf4' }}>{s.value}</div>
              <div style={{ fontSize: 9.5, color: 'rgba(148,163,184,0.65)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters + export */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'rgba(148,163,184,0.6)', fontWeight: 700 }}>
          <Filter size={12}/> Filter:
        </div>
        <select style={selStyle} value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
          <option value="all">All statuses</option>
          {(['Active', 'Notice issued', 'Evicted', 'Resolved'] as EncroachmentStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select style={selStyle} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
          <option value="all">All road classes</option>
          {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
        </select>
        <select style={selStyle} value={regionFilter} onChange={e => setRegionFilter(e.target.value)}>
          <option value="all">All regions</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={() => exportToCsv(filtered)} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7,
          background: `rgba(${hexRgb(C.teal)},0.12)`, border: `1px solid rgba(${hexRgb(C.teal)},0.35)`,
          color: C.teal, fontSize: 10.5, fontWeight: 800, cursor: 'pointer',
        }}>
          <Download size={13}/> Export to CSV
        </button>
      </div>

      {/* Table */}
      <div style={{ ...card(C.teal), padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
            <thead>
              <tr style={{ background: 'rgba(0,212,170,0.06)', borderBottom: '1px solid rgba(0,212,170,0.2)' }}>
                {['Road Link', 'Location / Chainage', 'Type', 'Date Reported', 'Status', 'Action'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: 'rgba(148,163,184,0.75)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 9.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 ? 'rgba(255,255,255,0.012)' : 'transparent' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 800, color: '#d4dde8' }}>{r.link_id}<div style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)', fontWeight: 500 }}>{r.road_no} · Class {r.road_class} · {r.region}</div></td>
                  <td style={{ padding: '10px 14px', color: '#c4d2e1' }}>{r.location}<div style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)' }}>Chainage km {r.chainage_km.toFixed(1)}</div></td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999,
                      background: 'rgba(148,163,184,0.1)', color: '#d4dde8', fontWeight: 700, fontSize: 9.5 }}>
                      {ENC_TYPE_ICON[r.type]} {r.type}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#c4d2e1' }}>{r.date_reported}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 9.5, fontWeight: 800,
                      color: ENC_STATUS_COLOR[r.status], background: `rgba(${hexRgb(ENC_STATUS_COLOR[r.status])},0.12)`,
                      border: `1px solid rgba(${hexRgb(ENC_STATUS_COLOR[r.status])},0.3)` }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={actionBtnStyle(C.blue)} title="View / edit record">View</button>
                      <button style={actionBtnStyle(C.yellow)} title="Issue or update notice">Notice</button>
                      <button style={actionBtnStyle(C.green)} title="Mark resolved">Resolve</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'rgba(148,163,184,0.5)', fontSize: 11 }}>
                  No encroachment records match the selected filters.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '8px 14px', fontSize: 8.5, color: 'rgba(148,163,184,0.4)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          Showing {filtered.length} of {ENCROACHMENT_RECORDS.length} mock records.
          {/* TODO: replace with Supabase query — SELECT id, link_id, road_no, location, chainage_km, type, date_reported, status, region, road_class, notes FROM road_reserve_encroachments */}
        </div>
      </div>
    </div>
  );
}

function actionBtnStyle(color: string): React.CSSProperties {
  return {
    padding: '4px 9px', borderRadius: 6, fontSize: 9, fontWeight: 800, cursor: 'pointer',
    background: `rgba(${hexRgb(color)},0.1)`, border: `1px solid rgba(${hexRgb(color)},0.3)`, color,
  };
}

function selectStyle(): React.CSSProperties {
  return {
    background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(148,163,184,0.25)',
    borderRadius: 7, color: '#d4dde8', fontSize: 10.5, fontWeight: 700, padding: '6px 10px', cursor: 'pointer',
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 4 — GAZETTE & LEGAL STATUS
// ═════════════════════════════════════════════════════════════════════════════
const SURVEY_COLOR: Record<GazetteRecord['survey_status'], string> = {
  'Up to date': C.green, 'Outdated': C.yellow, 'Not surveyed': C.red,
};

function GazetteTab() {
  const pctGazetted   = 100; // all mock roads have a gazette number on record
  const pctSurveyed   = +((GAZETTE_RECORDS.filter(g => g.survey_status === 'Up to date').length / GAZETTE_RECORDS.length) * 100).toFixed(0);
  const pctEncroached = +((new Set(ENCROACHMENT_RECORDS.map(e => e.road_no)).size / GAZETTE_RECORDS.length) * 100).toFixed(0);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        {[
          { label: '% Gazetted',           value: `${pctGazetted}%`, color: C.teal, icon: <Gavel size={15}/> },
          { label: '% With updated surveys', value: `${pctSurveyed}%`, color: C.cyan, icon: <FileText size={15}/> },
          { label: '% With encroachments',  value: `${pctEncroached}%`, color: C.red, icon: <AlertTriangle size={15}/> },
        ].map(s => (
          <div key={s.label} style={{ ...card(s.color), display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `rgba(${hexRgb(s.color)},0.12)`,
              border: `1px solid rgba(${hexRgb(s.color)},0.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#e2eaf4' }}>{s.value}</div>
              <div style={{ fontSize: 9.5, color: 'rgba(148,163,184,0.65)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(280px, 1fr)', gap: 16 }}>
        {/* Gazette table */}
        <div style={{ ...card(C.teal), padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px 8px', fontSize: 11, fontWeight: 900, color: C.teal, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Gazette & Legal Status Register
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
              <thead>
                <tr style={{ background: 'rgba(0,212,170,0.06)', borderBottom: '1px solid rgba(0,212,170,0.2)' }}>
                  {['Road Name', 'Gazette No.', 'Date Gazetted', 'Reserve Width', 'Survey Status', 'Remarks'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '9px 14px', color: 'rgba(148,163,184,0.75)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 9.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {GAZETTE_RECORDS.map((g, i) => (
                  <tr key={`${g.road_no}-${g.gazette_no}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 ? 'rgba(255,255,255,0.012)' : 'transparent' }}>
                    <td style={{ padding: '9px 14px', fontWeight: 800, color: '#d4dde8' }}>{g.road_name}<div style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)', fontWeight: 500 }}>{g.road_no} · Class {g.road_class}</div></td>
                    <td style={{ padding: '9px 14px', color: '#c4d2e1', fontFamily: 'monospace' }}>{g.gazette_no}</td>
                    <td style={{ padding: '9px 14px', color: '#c4d2e1' }}>{g.date_gazetted}</td>
                    <td style={{ padding: '9px 14px', color: '#c4d2e1' }}>{g.reserve_width_m} m</td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 9.5, fontWeight: 800,
                        color: SURVEY_COLOR[g.survey_status], background: `rgba(${hexRgb(SURVEY_COLOR[g.survey_status])},0.12)`,
                        border: `1px solid rgba(${hexRgb(SURVEY_COLOR[g.survey_status])},0.3)` }}>
                        {g.survey_status}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px', color: 'rgba(196,210,225,0.75)', maxWidth: 260 }}>{g.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '8px 14px', fontSize: 8.5, color: 'rgba(148,163,184,0.4)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            {/* TODO: replace with Supabase query — SELECT road_no, road_name, gazette_no, date_gazetted, reserve_width_m, survey_status, remarks, road_class FROM road_reserve_gazette */}
            Mock gazette records for illustration — Lands & Surveys verification pending for several entries.
          </div>
        </div>

        {/* Timeline chart */}
        <div style={card(C.cyan)}>
          <div style={{ fontSize: 11, fontWeight: 900, color: C.cyan, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
            Gazette Activity by Year
          </div>
          <div style={{ fontSize: 9.5, color: 'rgba(148,163,184,0.55)', marginBottom: 10 }}>
            Number of road sections gazetted, by year of gazette notice (mock timeline)
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={GAZETTE_TIMELINE} margin={{ top: 4, right: 8, left: -22, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 9, fill: 'rgba(148,163,184,0.6)' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: 'rgba(148,163,184,0.6)' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'rgba(8,14,28,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, fontSize: 10 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Bar dataKey="gazetted" name="Gazette notices" fill={C.cyan} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 8.5, color: 'rgba(148,163,184,0.4)', marginTop: 8 }}>
            {/* TODO: replace with Supabase query — SELECT EXTRACT(YEAR FROM date_gazetted)::int AS year, COUNT(*) AS gazetted FROM road_reserve_gazette GROUP BY 1 ORDER BY 1 */}
            Aggregated from mock gazette register above.
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 5 — PERMITS & APPLICATIONS  (MOWT "Road Reserve Usage" — Form 2)
// ═════════════════════════════════════════════════════════════════════════════

function exportApplicationsToCsv(rows: ApplicationRecord[]) {
  const headers = ['Application No', 'Date', 'Status', 'Applicant', 'TIN', 'Activity', 'Structure', 'District', 'Road', 'Road/Highway', 'Dimensions', 'Recommendation', 'File Ref'];
  const lines = rows.map(r => [
    r.application_number, r.application_date, r.status, r.registered_name, r.applicant_tin,
    r.nature_of_activity, r.nature_of_structure, r.district, r.road_name, r.road_or_highway,
    r.size_summary, r.final_recommendation, r.file_reference_number,
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'road_reserve_applications.csv'; a.click();
  URL.revokeObjectURL(url);
}

function PermitsTab() {
  const [statusFilter, setStatusFilter] = useState<'all' | ApplicationStatus>('all');
  const [activityFilter, setActivityFilter] = useState<'all' | string>('all');

  const activities = useMemo(() => Array.from(new Set(ROAD_RESERVE_APPLICATIONS.map(a => a.nature_of_activity))), []);

  const filtered = ROAD_RESERVE_APPLICATIONS.filter(a =>
    (statusFilter === 'all' || a.status === statusFilter) &&
    (activityFilter === 'all' || a.nature_of_activity === activityFilter)
  );

  const total       = ROAD_RESERVE_APPLICATIONS.length;
  const pending     = ROAD_RESERVE_APPLICATIONS.filter(a => a.status === 'Submitted' || a.status === 'Under Review').length;
  const approved    = ROAD_RESERVE_APPLICATIONS.filter(a => a.status === 'Approved').length;
  const notSuitable = ROAD_RESERVE_APPLICATIONS.filter(a => a.final_recommendation === 'Not Suitable').length;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
        {[
          { label: 'Total applications', value: total,       color: C.blue,  icon: <ClipboardList size={15}/> },
          { label: 'Pending review',     value: pending,     color: C.yellow,icon: <Clock size={15}/> },
          { label: 'Approved',           value: approved,    color: C.green, icon: <CheckCircle2 size={15}/> },
          { label: 'Found not suitable', value: notSuitable, color: C.red,   icon: <AlertTriangle size={15}/> },
        ].map(s => (
          <div key={s.label} style={{ ...card(s.color), display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `rgba(${hexRgb(s.color)},0.12)`,
              border: `1px solid rgba(${hexRgb(s.color)},0.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#e2eaf4' }}>{s.value}</div>
              <div style={{ fontSize: 9.5, color: 'rgba(148,163,184,0.65)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters + export */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Filter size={13} style={{ color: 'rgba(148,163,184,0.6)' }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={selectStyle()}>
          <option value="all">All statuses</option>
          {(['Draft', 'Submitted', 'Under Review', 'Recommended', 'Approved', 'Rejected'] as ApplicationStatus[]).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={activityFilter} onChange={e => setActivityFilter(e.target.value)} style={selectStyle()}>
          <option value="all">All activities</option>
          {activities.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={() => exportApplicationsToCsv(filtered)} style={actionBtnStyle(C.teal)}>
          <Download size={12}/> Export CSV
        </button>
      </div>

      {/* Applications table */}
      <div style={{ ...card(C.blue), padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px 8px', fontSize: 11, fontWeight: 900, color: C.blue, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Road Reserve Usage Applications — MOWT Form 2
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
            <thead>
              <tr style={{ background: 'rgba(77,159,255,0.06)', borderBottom: '1px solid rgba(77,159,255,0.2)' }}>
                {['Application No.', 'Date', 'Applicant', 'Activity / Structure', 'Location', 'Dimensions', 'Status', 'Recommendation'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '9px 14px', color: 'rgba(148,163,184,0.75)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 9.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => {
                const recColor = a.final_recommendation === 'Suitable' ? C.green : a.final_recommendation === 'Not Suitable' ? C.red : C.gray;
                return (
                  <tr key={a.application_number} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 ? 'rgba(255,255,255,0.012)' : 'transparent' }}>
                    <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#c4d2e1' }}>{a.application_number}
                      <div style={{ fontSize: 8.5, color: 'rgba(148,163,184,0.5)' }}>{a.file_reference_number}</div>
                    </td>
                    <td style={{ padding: '9px 14px', color: '#c4d2e1' }}>{a.application_date}</td>
                    <td style={{ padding: '9px 14px', fontWeight: 800, color: '#d4dde8' }}>{a.registered_name}
                      <div style={{ fontSize: 8.5, color: 'rgba(148,163,184,0.5)', fontWeight: 500 }}>TIN {a.applicant_tin}</div>
                    </td>
                    <td style={{ padding: '9px 14px', color: '#c4d2e1' }}>{a.nature_of_structure}
                      <div style={{ fontSize: 8.5, color: 'rgba(148,163,184,0.5)' }}>{a.nature_of_activity}</div>
                    </td>
                    <td style={{ padding: '9px 14px', color: 'rgba(196,210,225,0.85)' }}>{a.road_name}
                      <div style={{ fontSize: 8.5, color: 'rgba(148,163,184,0.5)' }}>{a.district} · {a.road_or_highway}</div>
                    </td>
                    <td style={{ padding: '9px 14px', color: 'rgba(196,210,225,0.8)', fontSize: 9.5 }}>{a.size_summary}</td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 9.5, fontWeight: 800,
                        color: APP_STATUS_COLOR[a.status], background: `rgba(${hexRgb(APP_STATUS_COLOR[a.status])},0.12)`,
                        border: `1px solid rgba(${hexRgb(APP_STATUS_COLOR[a.status])},0.3)` }}>
                        {a.status}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ fontWeight: 800, color: recColor }}>{a.final_recommendation}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '8px 14px', fontSize: 8.5, color: 'rgba(148,163,184,0.4)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          Showing {filtered.length} of {ROAD_RESERVE_APPLICATIONS.length} mock applications.
          {/* TODO: replace with Supabase query — SELECT application_number, application_date, status, registered_name, applicant_tin, nature_of_activity, nature_of_structure, district, road_name, road_or_highway, final_recommendation, file_reference_number FROM road_reserve_applications ORDER BY application_date DESC. Writes (Form 2 Parts A–E) go through the service_role write-back server — see road_reserve_applications / road_reserve_applicants in supabase_schema.sql and WRITABLE_TABLES in server/index.js */}
        </div>
      </div>
    </div>
  );
}
