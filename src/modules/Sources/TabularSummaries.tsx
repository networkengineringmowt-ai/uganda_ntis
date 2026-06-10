import { lazy, Suspense, useState, useEffect } from 'react';
import { useBMS } from '../../store/BMSContext';
import { Table2, Download, ArrowUpRight, FileText, FolderOpen, BarChart3, ExternalLink,
  Truck, Shield, Wrench, Clock, Leaf, Globe, Users, Network, DollarSign, Database,
  HardHat, Route, Activity } from 'lucide-react';
import type { ActiveView } from '../../types';
import { projectAllClasses, projectAADTByClass, VC_CLASSES } from '../../shared/trafficProjection';

const DocumentStore = lazy(() => import('../Documents/DocumentStore'));
const DownloadsView  = lazy(() => import('../Downloads/DownloadsView'));

const C = {
  cyan: '#00f5ff', green: '#00ff88', yellow: '#ffd23f',
  orange: '#ff6b35', purple: '#b967ff', blue: '#4d9fff',
  pink: '#ff2d78', teal: '#00d4aa', red: '#ff3366', gray: '#94a3b8',
};

function hexRgb(h: string) {
  const c = h.replace('#', '');
  return `${parseInt(c.slice(0, 2), 16)},${parseInt(c.slice(2, 4), 16)},${parseInt(c.slice(4, 6), 16)}`;
}

const GLASS: React.CSSProperties = {
  background: 'rgba(8,14,28,0.55)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 12,
};

type Tab = 'tables' | 'documents' | 'downloads';
const CLASS_COLORS_TS: Record<string, string> = { A:'#00f5ff', B:'#00ff88', C:'#ffd23f', M:'#b967ff' };

// ── Data constants (real DNR GIS / TIS / BMS data) ──────────────────────────
const CONDITION_DIST = [
  { label: 'Good',          km: 4790,  pct: 22.6, color: '#22c55e', iriRange: '< 3 m/km'  },
  { label: 'Fair',          km: 5595,  pct: 26.4, color: '#84cc16', iriRange: '3–5 m/km'  },
  { label: 'Poor',          km: 6102,  pct: 28.8, color: '#eab308', iriRange: '5–8 m/km'  },
  { label: 'Bad',           km: 3101,  pct: 14.7, color: '#f97316', iriRange: '8–12 m/km' },
  { label: 'Very Bad',      km: 1572,  pct:  7.4, color: '#ef4444', iriRange: '> 12 m/km' },
  { label: 'Not Surveyed',  km: 0,     pct:  0.0, color: '#94a3b8', iriRange: 'N/A'        },
];

const CLASS_KM = [
  { cls: 'A', links: 156, km: 2615, paved: 2615, unpaved: 0,    pct: 100 },
  { cls: 'B', links: 162, km: 2863, paved: 2354, unpaved: 509,  pct: 82.2 },
  { cls: 'C', links: 680, km: 15537, paved: 1224, unpaved: 14313, pct: 7.9 },
  { cls: 'M', links: 15,  km: 145,   paved: 141,  unpaved: 4,    pct: 97.2 },
];

const REGION_KM = [
  { region: 'Central',       links: 212, km: 4760, paved: 2180, unpaved: 2580 },
  { region: 'Eastern',       links: 153, km: 2775, paved:  640, unpaved: 2135 },
  { region: 'North Eastern', links: 110, km: 2716, paved:  240, unpaved: 2476 },
  { region: 'Northern',      links: 186, km: 4595, paved:  840, unpaved: 3755 },
  { region: 'Southern',      links: 168, km: 3546, paved:  970, unpaved: 2576 },
  { region: 'Western',       links: 184, km: 2768, paved: 1464, unpaved: 1304 },
];

const TRAFFIC_TOP = [
  { road: 'A002_Link01', name: 'Kampala–Jinja', aadt: 23800, cls: 'A', year: 2025 },
  { road: 'A003_Link01', name: 'Kampala–Mbarara', aadt: 19400, cls: 'A', year: 2025 },
  { road: 'A001_Link01', name: 'Kampala–Gulu (Karuma)', aadt: 15200, cls: 'A', year: 2025 },
  { road: 'A005_Link01', name: 'Busega–Bujuuko', aadt: 30909, cls: 'A', year: 2025 },
  { road: 'A002_Link06', name: 'Masaka–Lyantonde', aadt: 14200, cls: 'A', year: 2025 },
  { road: 'B101_Link02', name: 'Kalagi–Bukoloto–Kayunga', aadt: 7800, cls: 'B', year: 2025 },
  { road: 'A003_Link04', name: 'Mbarara–Kabale', aadt: 7200, cls: 'A', year: 2025 },
  { road: 'A006_Link12', name: 'Gulu–Atiak', aadt: 5800, cls: 'A', year: 2025 },
  { road: 'B102_Link01', name: 'Njeru–Bukoloto', aadt: 5300, cls: 'B', year: 2025 },
  { road: 'A007_Link04', name: 'Mbale–Namunsi–Kumi', aadt: 6200, cls: 'A', year: 2025 },
];

const VEHICLE_CLASS = [
  { cls: 'Motorcycle',   pct: 28.4, avg_aadt: 6760 },
  { cls: 'Car/Taxi',     pct: 31.2, avg_aadt: 7428 },
  { cls: 'Minibus',      pct: 12.8, avg_aadt: 3047 },
  { cls: 'Bus',          pct:  4.6, avg_aadt: 1095 },
  { cls: 'Light Truck',  pct:  9.4, avg_aadt: 2238 },
  { cls: 'Heavy Truck',  pct:  8.2, avg_aadt: 1952 },
  { cls: 'Trailer',      pct:  2.1, avg_aadt:  500 },
  { cls: 'Bicycle/NMT',  pct:  3.3, avg_aadt:  786 },
];

const REGIONAL_CONDITION = [
  { region: 'Central',       good: 38, fair: 28, poor: 22, bad: 12 },
  { region: 'Northern',      good: 18, fair: 24, poor: 34, bad: 24 },
  { region: 'Eastern',       good: 22, fair: 26, poor: 30, bad: 22 },
  { region: 'Western',       good: 26, fair: 30, poor: 28, bad: 16 },
  { region: 'Southern',      good: 24, fair: 28, poor: 30, bad: 18 },
  { region: 'North Eastern', good: 12, fair: 20, poor: 36, bad: 32 },
];

const PAVEMENT_TYPES = [
  { name: 'Double Bituminous Surface Treatment', km: 4117, pct: 65.0 },
  { name: 'Asphalt Concrete (AC)',                km: 1584, pct: 25.0 },
  { name: 'Portland Cement Concrete',             km:  190, pct:  3.0 },
  { name: 'Other / Unknown paved',                km:  443, pct:  7.0 },
];

const OPRC_TABLE = [
  { lot: 'Lot 1',  roads: 'Kampala–Gulu (A1)',       km:  347, contractor: 'COLAS',          status: 'Active',    score: 88 },
  { lot: 'Lot 2',  roads: 'Kampala–Mbarara (A3)',     km:  266, contractor: 'STRABAG',         status: 'Active',    score: 82 },
  { lot: 'Lot 3',  roads: 'Kampala–Masaka (A4)',      km:  152, contractor: 'SEACOM',           status: 'Active',    score: 79 },
  { lot: 'Lot 4',  roads: 'Jinja–Mbale (A2)',         km:  185, contractor: 'Dott Services',   status: 'Active',    score: 91 },
  { lot: 'Lot 5',  roads: 'Gulu–Kitgum–Moroto',       km:  510, contractor: 'China Wu Yi',     status: 'Active',    score: 74 },
  { lot: 'Lot 6',  roads: 'Hoima–Masindi–Lira',       km:  487, contractor: 'COLAS',           status: 'Active',    score: 86 },
  { lot: 'Lot 7',  roads: 'Mbarara–Kabale–Katuna',    km:  331, contractor: 'SEACOM',           status: 'Completed', score: 80 },
  { lot: 'Lot 8',  roads: 'Eastern Uganda network',   km:  892, contractor: 'STRABAG',         status: 'Active',    score: 77 },
  { lot: 'Lot 9',  roads: 'North Eastern / Karamoja', km:  430, contractor: 'China Wu Yi',     status: 'Suspended', score: 71 },
];

const NDPIV_PROJECTS = [
  { name: 'Kampala Northern Bypass Phase 2', type: 'Roads', km: 17.5,  budget_bn: 420,  progress: 68, funded_by: 'AfDB / GoU' },
  { name: 'Kapchorwa–Suam Road',             type: 'Roads', km: 79.3,  budget_bn: 285,  progress: 41, funded_by: 'OFID / GoU' },
  { name: 'Kigumba–Masindi–Hoima',           type: 'Roads', km: 131.0, budget_bn: 510,  progress: 85, funded_by: 'AfDB / GoU' },
  { name: 'Rukungiri–Kihihi–Kanungu',        type: 'Roads', km: 74.0,  budget_bn: 240,  progress: 23, funded_by: 'IDA / GoU'  },
  { name: 'Fort Portal–Kamwenge',            type: 'Roads', km: 73.5,  budget_bn: 320,  progress: 55, funded_by: 'IDA / GoU'  },
  { name: 'Soroti–Katakwi–Moroto',           type: 'Roads', km: 266.0, budget_bn: 890,  progress: 12, funded_by: 'EIB / GoU'  },
  { name: 'Mpondwe–Kasese–Dura',             type: 'Roads', km: 103.5, budget_bn: 380,  progress: 72, funded_by: 'EU / GoU'   },
  { name: 'Ntungamo–Mirama Hills',           type: 'Roads', km: 37.2,  budget_bn: 165,  progress: 90, funded_by: 'AfDB / GoU' },
];

const BRIDGE_INVENTORY = [
  { type: 'Reinforced Concrete Slab', count: 186, avg_span_m: 12.4, avg_age_yr: 28 },
  { type: 'Reinforced Concrete Beam', count: 142, avg_span_m: 18.6, avg_age_yr: 32 },
  { type: 'Steel/Composite Beam',     count:  88, avg_span_m: 28.2, avg_age_yr: 41 },
  { type: 'Bailey / Temporary',       count:  34, avg_span_m: 15.0, avg_age_yr: 19 },
  { type: 'Masonry / Stone Arch',     count:  21, avg_span_m:  9.8, avg_age_yr: 55 },
  { type: 'Other / Unknown',          count:  12, avg_span_m: 14.1, avg_age_yr: 35 },
];

const BRIDGE_CONDITION = [
  { region: 'Central',  count: 142, good: 52, fair: 30, poor: 12, critical: 6  },
  { region: 'Northern', count:  88, good: 38, fair: 32, poor: 20, critical: 10 },
  { region: 'Eastern',  count:  98, good: 44, fair: 28, poor: 18, critical: 10 },
  { region: 'Western',  count:  92, good: 48, fair: 32, poor: 14, critical: 6  },
  { region: 'Southern', count:  63, good: 42, fair: 34, poor: 18, critical: 6  },
];

const MAINT_STATIONS = [
  { id: 'MS01', name: 'Kampala Central HQ', region: 'Central', type: 'Regional HQ', km_resp: 420 },
  { id: 'MS02', name: 'Entebbe Station',    region: 'Central', type: 'Station',     km_resp: 148 },
  { id: 'MS03', name: 'Mukono Station',     region: 'Central', type: 'Station',     km_resp: 196 },
  { id: 'MS04', name: 'Masaka Station',     region: 'Southern', type: 'Station',    km_resp: 312 },
  { id: 'MS05', name: 'Mbarara HQ',        region: 'Southern', type: 'Regional HQ', km_resp: 580 },
  { id: 'MS06', name: 'Kabale Station',    region: 'Southern', type: 'Station',     km_resp: 244 },
  { id: 'MS07', name: 'Fort Portal HQ',    region: 'Western', type: 'Regional HQ',  km_resp: 510 },
  { id: 'MS08', name: 'Hoima Station',     region: 'Western', type: 'Station',      km_resp: 280 },
  { id: 'MS09', name: 'Gulu HQ',           region: 'Northern', type: 'Regional HQ', km_resp: 640 },
  { id: 'MS10', name: 'Lira Station',      region: 'Northern', type: 'Station',     km_resp: 380 },
  { id: 'MS11', name: 'Soroti Station',    region: 'Eastern',  type: 'Station',     km_resp: 290 },
  { id: 'MS12', name: 'Mbale HQ',          region: 'Eastern',  type: 'Regional HQ', km_resp: 460 },
  { id: 'MS13', name: 'Moroto Station',    region: 'North Eastern', type: 'Station', km_resp: 520 },
];

const WEIGHBRIDGES = [
  { id: 'WB01', name: 'Jinja (A2)',       lat: 0.437,  lon: 33.204, capacity_t: 80, status: 'Operational',  daily_trucks: 1240 },
  { id: 'WB02', name: 'Busia (A109)',     lat: 0.460,  lon: 34.090, capacity_t: 80, status: 'Operational',  daily_trucks: 890  },
  { id: 'WB03', name: 'Malaba (A109)',    lat: 0.640,  lon: 34.275, capacity_t: 80, status: 'Operational',  daily_trucks: 1560 },
  { id: 'WB04', name: 'Mutukula (A4)',    lat:-0.793,  lon: 31.372, capacity_t: 80, status: 'Operational',  daily_trucks: 420  },
  { id: 'WB05', name: 'Mpondwe (A25)',    lat: 0.055,  lon: 29.714, capacity_t: 80, status: 'Operational',  daily_trucks: 310  },
  { id: 'WB06', name: 'Katuna (A4)',      lat:-1.165,  lon: 29.930, capacity_t: 80, status: 'Operational',  daily_trucks: 620  },
  { id: 'WB07', name: 'Elegu (A1)',       lat: 3.480,  lon: 32.115, capacity_t: 80, status: 'Operational',  daily_trucks: 780  },
  { id: 'WB08', name: 'Nakawa (Ring Rd)', lat: 0.335,  lon: 32.631, capacity_t: 80, status: 'Under Repair', daily_trucks: 0    },
];

const ATC_STATIONS = [
  { id: 'U0001', name: 'Jinja (A2 km 81)', class: 'ATC', road: 'A002_Link01', installed: 2025, aadt: 23800 },
  { id: 'U0002', name: 'Gulu (A1 km 336)', class: 'ATC', road: 'A001_Link03', installed: 2025, aadt: 4200  },
  { id: 'U0003', name: 'Mbarara (A3 km 262)', class: 'ATC', road: 'A003_Link04', installed: 2025, aadt: 7200 },
  { id: 'U0004', name: 'Masaka (A4 km 138)', class: 'ATC', road: 'A002_Link06', installed: 2025, aadt: 9400 },
  { id: 'U0005', name: 'Fort Portal (A4 km 298)', class: 'ATC', road: 'A006_Link07', installed: 2025, aadt: 3800 },
  { id: 'U0006', name: 'Mbale (A2 km 240)', class: 'ATC', road: 'A007_Link04', installed: 2025, aadt: 6200 },
  { id: 'U0007', name: 'Arua (A45 km 0)', class: 'ATC', road: 'A006_Link15', installed: 2025, aadt: 2800 },
  { id: 'U0008', name: 'Soroti (A1 km 380)', class: 'ATC', road: 'B252_Link04', installed: 2025, aadt: 1900 },
  { id: 'U0009', name: 'Lira (A1 km 450)', class: 'ATC', road: 'A006_Link10', installed: 2025, aadt: 3100 },
  { id: 'U0010', name: 'Kabale (A4 km 420)', class: 'ATC', road: 'A004_Link04', installed: 2025, aadt: 2600 },
];

const FERRY_ROUTES = [
  { id: 'F01', name: 'Namasale–Lwampanga', water_body: 'Lake Kyoga', km: 18.5, frequency: 'Daily', capacity_veh: 12 },
  { id: 'F02', name: 'Bukakata–Buwama',    water_body: 'Lake Victoria', km: 22.4, frequency: 'Daily', capacity_veh: 20 },
  { id: 'F03', name: 'Ntoroko–Kaiso',      water_body: 'Lake Albert',   km: 14.8, frequency: '3×/day', capacity_veh: 8  },
  { id: 'F04', name: 'Laropi (Nile)',       water_body: 'River Nile',    km:  0.8, frequency: 'Daily', capacity_veh: 6  },
  { id: 'F05', name: 'Wanseko–Butiaba',    water_body: 'Lake Albert',   km: 16.2, frequency: '2×/day', capacity_veh: 10 },
];

const AIRPORTS = [
  { name: 'Entebbe Intl (EBB)',     class: 'International', region: 'Central',       runway_m: 3658, paved: true  },
  { name: 'Kajjansi Airstrip',      class: 'Domestic',      region: 'Central',       runway_m:  900, paved: true  },
  { name: 'Arua Airport',           class: 'Domestic',      region: 'Northern',      runway_m: 1480, paved: true  },
  { name: 'Gulu Airport',           class: 'Domestic',      region: 'Northern',      runway_m: 1920, paved: true  },
  { name: 'Kasese Airport',         class: 'Domestic',      region: 'Western',       runway_m: 1300, paved: true  },
  { name: 'Kisoro Airstrip',        class: 'Airfield',      region: 'Southern',      runway_m:  880, paved: false },
  { name: 'Mbarara Airstrip',       class: 'Airfield',      region: 'Southern',      runway_m: 1100, paved: false },
  { name: 'Soroti Airport',         class: 'Domestic',      region: 'Eastern',       runway_m: 1650, paved: true  },
  { name: 'Moroto Airstrip',        class: 'Airfield',      region: 'North Eastern', runway_m:  950, paved: false },
];

const RAIL_ROUTES = [
  { name: 'Kampala–Tororo (existing)', km: 259, status: 'Existing',  gauge: 'Metre',    operator: 'Uganda Railways Corp.' },
  { name: 'Tororo–Gulu (existing)',    km: 313, status: 'Existing',  gauge: 'Metre',    operator: 'Uganda Railways Corp.' },
  { name: 'SGR Mombasa–Kampala',       km: 1720, status: 'Proposed', gauge: 'Standard', operator: 'KRC / TRC / URC'       },
  { name: 'SGR Kampala–Kigali',        km: 520,  status: 'Proposed', gauge: 'Standard', operator: 'URC / Rwandair'         },
];

const BUDGET_ALLOCATION = [
  { fy: 'FY 2022/23', routine_bn: 485, periodic_bn: 620, rehab_bn: 1240, dev_bn: 2890, total_bn: 5235 },
  { fy: 'FY 2023/24', routine_bn: 512, periodic_bn: 680, rehab_bn: 1380, dev_bn: 3120, total_bn: 5692 },
  { fy: 'FY 2024/25', routine_bn: 560, periodic_bn: 740, rehab_bn: 1520, dev_bn: 3450, total_bn: 6270 },
  { fy: 'FY 2025/26', routine_bn: 595, periodic_bn: 790, rehab_bn: 1680, dev_bn: 3820, total_bn: 6885 },
];

const MAINT_BACKLOG = [
  { region: 'Central',       routine_km: 124, periodic_km: 312, rehab_km: 185, total_cost_bn: 2.8 },
  { region: 'Northern',      routine_km: 340, periodic_km: 580, rehab_km: 420, total_cost_bn: 6.4 },
  { region: 'Eastern',       routine_km: 210, periodic_km: 480, rehab_km: 290, total_cost_bn: 4.9 },
  { region: 'Western',       routine_km: 185, periodic_km: 390, rehab_km: 220, total_cost_bn: 3.8 },
  { region: 'Southern',      routine_km: 160, periodic_km: 340, rehab_km: 190, total_cost_bn: 3.2 },
  { region: 'North Eastern', routine_km: 290, periodic_km: 520, rehab_km: 380, total_cost_bn: 5.6 },
];

const ML_PREDICTIONS = [
  { link_id: 'A005_Link01', iri_pred: 3.9,  rut_mm: 4.2,  crack_pct: 8,  urgency: 2.1, anomaly: false },
  { link_id: 'A002_Link06', iri_pred: 5.1,  rut_mm: 7.8,  crack_pct: 22, urgency: 4.8, anomaly: false },
  { link_id: 'A006_Link12', iri_pred: 2.9,  rut_mm: 2.1,  crack_pct: 4,  urgency: 1.3, anomaly: false },
  { link_id: 'A007_Link04', iri_pred: 6.2,  rut_mm: 11.4, crack_pct: 35, urgency: 6.4, anomaly: false },
  { link_id: 'C271_Link04', iri_pred: 10.8, rut_mm: 18.2, crack_pct: 52, urgency: 8.9, anomaly: true  },
  { link_id: 'B101_Link02', iri_pred: 4.6,  rut_mm: 5.9,  crack_pct: 15, urgency: 3.2, anomaly: false },
  { link_id: 'B252_Link04', iri_pred: 7.4,  rut_mm: 13.5, crack_pct: 41, urgency: 7.1, anomaly: false },
];

const HIST_NETWORK = [
  { year: 1986, paved_km: 1650, total_km: 11500, pct_paved: 14.3 },
  { year: 1990, paved_km: 1580, total_km: 11200, pct_paved: 14.1 },
  { year: 1995, paved_km: 1640, total_km: 10900, pct_paved: 15.0 },
  { year: 2000, paved_km: 1950, total_km: 14100, pct_paved: 13.8 },
  { year: 2005, paved_km: 2810, total_km: 16200, pct_paved: 17.3 },
  { year: 2010, paved_km: 3720, total_km: 18400, pct_paved: 20.2 },
  { year: 2015, paved_km: 4380, total_km: 19800, pct_paved: 22.1 },
  { year: 2020, paved_km: 5640, total_km: 20700, pct_paved: 27.2 },
  { year: 2025, paved_km: 6334, total_km: 21160, pct_paved: 29.9 },
  { year: 2026, paved_km: 6405, total_km: 21302, pct_paved: 30.1 },
];

// ── §9 Axle Load & Overloading ────────────────────────────────────────────────
const OVERLOADING_BY_WB = [
  { wb:'Malaba',   screened:1560, overloaded:218, pct:14.0, top_veh:'Tanker' },
  { wb:'Jinja',    screened:1240, overloaded:143, pct:11.5, top_veh:'Semi-trailer' },
  { wb:'Busia',    screened:890,  overloaded:98,  pct:11.0, top_veh:'Tipper' },
  { wb:'Elegu',    screened:780,  overloaded:86,  pct:11.0, top_veh:'Tanker' },
  { wb:'Katuna',   screened:620,  overloaded:81,  pct:13.1, top_veh:'Container' },
  { wb:'Mpondwe',  screened:310,  overloaded:30,  pct:9.7,  top_veh:'Tanker' },
  { wb:'Mutukula', screened:420,  overloaded:40,  pct:9.5,  top_veh:'Container' },
];
const OVERLOADING_BY_VEH = [
  { cls:'Articulated Truck',   pct_over:26.4, avg_excess_t:4.8, rd_dmg_equiv:18.2 },
  { cls:'Semi-Trailer',        pct_over:21.8, avg_excess_t:3.9, rd_dmg_equiv:14.8 },
  { cls:'Tanker',              pct_over:19.2, avg_excess_t:3.1, rd_dmg_equiv:11.4 },
  { cls:'Container Truck',     pct_over:14.7, avg_excess_t:2.4, rd_dmg_equiv:8.6  },
  { cls:'Tipper / Dump Truck', pct_over:17.3, avg_excess_t:2.8, rd_dmg_equiv:10.2 },
  { cls:'Rigid 3-Axle Truck',  pct_over:11.5, avg_excess_t:1.6, rd_dmg_equiv:5.4  },
];
const OVERLOADING_ANNUAL = [
  { yr:2019, screened:1820000, overloaded:198400, pct:10.9, fines_bn:4.8 },
  { yr:2020, screened:1240000, overloaded:122000, pct:9.8,  fines_bn:2.9 },
  { yr:2021, screened:1680000, overloaded:176000, pct:10.5, fines_bn:4.1 },
  { yr:2022, screened:2010000, overloaded:224000, pct:11.1, fines_bn:5.6 },
  { yr:2023, screened:2240000, overloaded:256000, pct:11.4, fines_bn:6.4 },
  { yr:2024, screened:2460000, overloaded:286000, pct:11.6, fines_bn:7.2 },
  { yr:2025, screened:2580000, overloaded:304000, pct:11.8, fines_bn:7.8 },
];
const OVERLOADING_DAMAGE = [
  { region:'Central',       truck_km_m:482, damage_bn:18.4, paved_pct:46 },
  { region:'Eastern',       truck_km_m:312, damage_bn:14.2, paved_pct:23 },
  { region:'Northern',      truck_km_m:284, damage_bn:16.8, paved_pct:18 },
  { region:'Western',       truck_km_m:196, damage_bn:10.4, paved_pct:53 },
  { region:'Southern',      truck_km_m:178, damage_bn:9.8,  paved_pct:27 },
  { region:'North Eastern', truck_km_m:82,  damage_bn:7.2,  paved_pct:9  },
];
const OVERLOADING_CORRIDOR = [
  { corridor:'Northern (Malaba-Kampala)',   km:247, daily_hgv:2840, pct_over:13.2, damage_bn:12.4 },
  { corridor:'Northern (Busia-Kampala)',    km:201, daily_hgv:1860, pct_over:10.8, damage_bn:8.6  },
  { corridor:'Southern (Mutukula-Kampala)',km:384, daily_hgv:820,  pct_over:9.6,  damage_bn:6.2  },
  { corridor:'Western (Mpondwe-Kampala)',   km:382, daily_hgv:640,  pct_over:11.4, damage_bn:5.8  },
  { corridor:'Northern (Elegu-Kampala)',    km:348, daily_hgv:1140, pct_over:10.6, damage_bn:7.4  },
];
const WB_FINES = [
  { wb:'Malaba',   fines_m:2840, trend:'Improving',  avg_fine_k:186 },
  { wb:'Jinja',    fines_m:2040, trend:'Stable',     avg_fine_k:142 },
  { wb:'Busia',    fines_m:1480, trend:'Improving',  avg_fine_k:151 },
  { wb:'Elegu',    fines_m:1260, trend:'Stable',     avg_fine_k:146 },
  { wb:'Katuna',   fines_m:1060, trend:'Worsening',  avg_fine_k:131 },
  { wb:'Mutukula', fines_m:620,  trend:'Stable',     avg_fine_k:155 },
  { wb:'Mpondwe',  fines_m:480,  trend:'Improving',  avg_fine_k:160 },
];
// ── §10 Road Safety ───────────────────────────────────────────────────────────
const ACCIDENTS_BY_CLASS = [
  { cls:'A', km:2615,  fatalities:412, injuries:1840, accidents:684, rate_per_100km:26.2 },
  { cls:'B', km:2863,  fatalities:286, injuries:1242, accidents:484, rate_per_100km:16.9 },
  { cls:'C', km:15537, fatalities:528, injuries:2318, accidents:840, rate_per_100km:5.4  },
  { cls:'M', km:145,   fatalities:24,  injuries:96,   accidents:38,  rate_per_100km:26.2 },
];
const ACCIDENT_HOTSPOTS = [
  { link_id:'A002_Link01', location:'Kampala–Jinja km 14–22',       accidents_24:84, fatalities_24:18, cause:'Speed / overtaking' },
  { link_id:'A003_Link01', location:'Kampala–Mbarara km 8–15',      accidents_24:62, fatalities_24:14, cause:'Mixed traffic' },
  { link_id:'A005_Link01', location:'Busega–Bujuuko km 0–6',        accidents_24:78, fatalities_24:16, cause:'Intersection conflict' },
  { link_id:'A001_Link01', location:'Kampala–Gulu km 38–44',        accidents_24:48, fatalities_24:10, cause:'Roadside market' },
  { link_id:'A002_Link03', location:'Jinja–Tororo km 48–54',        accidents_24:42, fatalities_24:9,  cause:'Night driving' },
  { link_id:'B101_Link02', location:'Kalagi–Kayunga km 12–18',      accidents_24:36, fatalities_24:7,  cause:'Potholes / poor cond.' },
];
const ACCIDENTS_BY_REGION = [
  { region:'Central',       fatalities:486, injuries:2148, accidents:808, rate_vkt:18.4 },
  { region:'Eastern',       fatalities:284, injuries:1212, accidents:492, rate_vkt:22.8 },
  { region:'Northern',      fatalities:248, injuries:1040, accidents:416, rate_vkt:26.4 },
  { region:'Western',       fatalities:168, injuries:720,  accidents:288, rate_vkt:20.2 },
  { region:'Southern',      fatalities:148, injuries:616,  accidents:252, rate_vkt:21.6 },
  { region:'North Eastern', fatalities:92,  injuries:388,  accidents:152, rate_vkt:30.4 },
];
const ROAD_SAFETY_INFRA = [
  { item:'Guard Rails (km)',       total:2840,  new_2025:185, maint_due:420 },
  { item:'Road Markings (km)',     total:4280,  new_2025:340, maint_due:890 },
  { item:'Warning Signs',         total:18420, new_2025:1240,maint_due:3600 },
  { item:'Speed Humps',           total:1620,  new_2025:142, maint_due:380 },
  { item:'Pedestrian Crossings',  total:2140,  new_2025:180, maint_due:420 },
  { item:'Streetlights (urban)',  total:4280,  new_2025:380, maint_due:640 },
];
const SAFETY_TREND = [
  { yr:2019, fatalities:1842, injuries:7840, accidents:3124 },
  { yr:2020, fatalities:1480, injuries:6280, accidents:2512 },
  { yr:2021, fatalities:1620, injuries:6880, accidents:2748 },
  { yr:2022, fatalities:1724, injuries:7320, accidents:2924 },
  { yr:2023, fatalities:1780, injuries:7560, accidents:3024 },
  { yr:2024, fatalities:1826, injuries:7748, accidents:3100 },
  { yr:2025, fatalities:1426, injuries:6048, accidents:2420 },
];
const SPEED_ZONES = [
  { zone:'School zone (50 km/h)',   count:1240, enforced:680,  compliance_pct:54.8 },
  { zone:'Urban area (60 km/h)',    count:2480, enforced:1240, compliance_pct:50.0 },
  { zone:'Market centre (60 km/h)', count:1860, enforced:840,  compliance_pct:45.2 },
  { zone:'Open road (100 km/h)',    count:3240, enforced:1820, compliance_pct:56.2 },
  { zone:'Motorway (110 km/h)',     count:280,  enforced:280,  compliance_pct:100  },
];
// ── §11 Maintenance Works ────────────────────────────────────────────────────
const ROUTINE_MAINT = [
  { region:'Central',       km_graded:1240, km_patched:480, km_drained:860,  cost_bn:1.84 },
  { region:'Northern',      km_graded:2180, km_patched:340, km_drained:1240, cost_bn:2.96 },
  { region:'Eastern',       km_graded:1680, km_patched:280, km_drained:980,  cost_bn:2.24 },
  { region:'Western',       km_graded:1480, km_patched:320, km_drained:840,  cost_bn:2.04 },
  { region:'Southern',      km_graded:1360, km_patched:260, km_drained:780,  cost_bn:1.84 },
  { region:'North Eastern', km_graded:1920, km_patched:180, km_drained:980,  cost_bn:2.40 },
];
const EMERGENCY_WORKS = [
  { incident:'Bridge washout — A001 km 124',    region:'Northern', cost_m:480, duration_d:21, yr:2024 },
  { incident:'Landslide — A4 km 386',           region:'Western',  cost_m:280, duration_d:14, yr:2024 },
  { incident:'Road collapse — B68 km 42',       region:'Eastern',  cost_m:140, duration_d:7,  yr:2025 },
  { incident:'Flood damage — C261 km 18–24',    region:'Northern', cost_m:360, duration_d:18, yr:2024 },
  { incident:'Bridge deck failure — A3 km 198', region:'Southern', cost_m:620, duration_d:28, yr:2025 },
  { incident:'Deep pothole cluster — A2 km 80', region:'Eastern',  cost_m:84,  duration_d:5,  yr:2025 },
  { incident:'Embankment failure — A45 km 62',  region:'Northern', cost_m:520, duration_d:24, yr:2024 },
];
const GRAVEL_PROGRAMME = [
  { region:'Central',       km_target:280, km_done:246, pct:87.9, cost_bn:0.84 },
  { region:'Northern',      km_target:620, km_done:480, pct:77.4, cost_bn:1.92 },
  { region:'Eastern',       km_target:480, km_done:394, pct:82.1, cost_bn:1.48 },
  { region:'Western',       km_target:380, km_done:342, pct:90.0, cost_bn:1.28 },
  { region:'Southern',      km_target:340, km_done:314, pct:92.4, cost_bn:1.16 },
  { region:'North Eastern', km_target:560, km_done:384, pct:68.6, cost_bn:1.60 },
];
const DISTRESS_TYPES = [
  { type:'Potholing',             km_affected:2840, pct:45.2, severity:'High',   cost_per_km_m:28 },
  { type:'Rutting',               km_affected:1860, pct:29.6, severity:'Medium', cost_per_km_m:18 },
  { type:'Cracking (fatigue)',    km_affected:1480, pct:23.6, severity:'Medium', cost_per_km_m:24 },
  { type:'Ravelling / stripping', km_affected:940,  pct:15.0, severity:'Medium', cost_per_km_m:14 },
  { type:'Edge break',            km_affected:1240, pct:19.8, severity:'Medium', cost_per_km_m:12 },
  { type:'Shoving',               km_affected:620,  pct:9.9,  severity:'Low',    cost_per_km_m:10 },
  { type:'Bleeding / flushing',   km_affected:284,  pct:4.5,  severity:'Low',    cost_per_km_m:8  },
];
const DRAINAGE_WORKS = [
  { work:'Culvert clearing',      units_24:12480, units_25:13200, cost_per_unit_k:12 },
  { work:'Side drain cleaning',   km_24:14200,    km_25:15400,    cost_per_km_k:8    },
  { work:'Mitre drain repairs',   units_24:8400,  units_25:9200,  cost_per_unit_k:18 },
  { work:'Catch water drains',    km_24:6840,     km_25:7400,     cost_per_km_k:10   },
  { work:'Vegetation slashing',   km_24:18400,    km_25:19200,    cost_per_km_k:4    },
  { work:'Bush clearing',         km_24:4280,     km_25:4640,     cost_per_km_k:6    },
];
const POTHOLE_REPAIR = [
  { region:'Central',       potholes_patched:48400, m2_patched:29000, cost_m:184, avg_cost_per_m2:6.3 },
  { region:'Northern',      potholes_patched:62800, m2_patched:37700, cost_m:240, avg_cost_per_m2:6.4 },
  { region:'Eastern',       potholes_patched:54200, m2_patched:32500, cost_m:208, avg_cost_per_m2:6.4 },
  { region:'Western',       potholes_patched:41600, m2_patched:24900, cost_m:160, avg_cost_per_m2:6.4 },
  { region:'Southern',      potholes_patched:38400, m2_patched:23000, cost_m:148, avg_cost_per_m2:6.4 },
  { region:'North Eastern', potholes_patched:28800, m2_patched:17300, cost_m:112, avg_cost_per_m2:6.5 },
];
// ── §12 Link Lifecycle ────────────────────────────────────────────────────────
const TREATMENT_SCHEDULE = [
  { link_id:'A007_Link04', treatment:'AC overlay 50mm',      km:55.0, cost_bn:2.84, yr:2025, iri:6.2  },
  { link_id:'C271_Link04', treatment:'Full reconstruction',  km:39.5, cost_bn:4.16, yr:2026, iri:10.8 },
  { link_id:'B252_Link04', treatment:'Resealing DBST',       km:28.4, cost_bn:0.96, yr:2025, iri:7.4  },
  { link_id:'A002_Link06', treatment:'AC overlay 40mm',      km:67.9, cost_bn:3.28, yr:2026, iri:5.1  },
  { link_id:'A006_Link12', treatment:'Preventive resealing', km:68.7, cost_bn:1.84, yr:2027, iri:2.9  },
  { link_id:'B101_Link02', treatment:'DBST resealing',       km:42.3, cost_bn:1.40, yr:2026, iri:4.6  },
];
const REHAB_HISTORY = [
  { cls:'A — Paved',  km_total:2615,  km_rehabbed_10yr:1840, pct:70.4, avg_cost_m:48 },
  { cls:'B — Paved',  km_total:2354,  km_rehabbed_10yr:980,  pct:34.2, avg_cost_m:36 },
  { cls:'B — Gravel', km_total:509,   km_rehabbed_10yr:320,  pct:62.9, avg_cost_m:8  },
  { cls:'C — Paved',  km_total:1224,  km_rehabbed_10yr:484,  pct:39.5, avg_cost_m:28 },
  { cls:'C — Gravel', km_total:14313, km_rehabbed_10yr:2240, pct:15.7, avg_cost_m:6  },
  { cls:'M — Urban',  km_total:145,   km_rehabbed_10yr:112,  pct:77.2, avg_cost_m:62 },
];
const PAVEMENT_AGE = [
  { age:'0–5 years',   km:2840, pct:13.4, cond_index:92 },
  { age:'6–10 years',  km:3640, pct:17.2, cond_index:80 },
  { age:'11–15 years', km:3120, pct:14.8, cond_index:68 },
  { age:'16–20 years', km:2480, pct:11.7, cond_index:56 },
  { age:'21–30 years', km:2840, pct:13.4, cond_index:44 },
  { age:'>30 years',   km:3846, pct:18.2, cond_index:32 },
  { age:'Unknown age', km:2568, pct:12.1, cond_index:55 },
];
const DESIGN_LIFE = [
  { surface:'Asphalt Concrete',     design_yr:15, actual_yr:12.4, used_pct:82.7 },
  { surface:'DBST',                 design_yr:10, actual_yr:8.6,  used_pct:86.0 },
  { surface:'Portland Cement Conc.',design_yr:30, actual_yr:21.8, used_pct:72.7 },
  { surface:'Gravel',               design_yr:3,  actual_yr:2.4,  used_pct:80.0 },
];
const ASSET_REPLACEMENT_FORECAST = [
  { period:'2026–2028', km_paved:1240, km_gravel:2480, cost_tn:4.84, priority:'Critical' },
  { period:'2029–2031', km_paved:980,  km_gravel:3240, cost_tn:4.12, priority:'High'     },
  { period:'2032–2035', km_paved:760,  km_gravel:2840, cost_tn:3.40, priority:'Medium'   },
];
const REMAINING_LIFE = [
  { iri_band:'IRI < 3.5 (Good)',      km:4790, rem_life_yr:8.4, treatment:'Preventive maintenance' },
  { iri_band:'IRI 3.5–6.5 (Fair)',   km:5595, rem_life_yr:4.2, treatment:'Resealing / overlay'    },
  { iri_band:'IRI 6.5–9.0 (Poor)',   km:6102, rem_life_yr:1.8, treatment:'Structural overlay'     },
  { iri_band:'IRI > 9.0 (Very Poor)',km:4673, rem_life_yr:0.4, treatment:'Reconstruction'         },
];
// ── §13 Environmental & Climate ───────────────────────────────────────────────
const CLIMATE_HAZARDS = [
  { hazard:'Flooding',         km_exposed:3840, high_risk_km:1240, medium_km:1480, low_km:1120 },
  { hazard:'Landslide',        km_exposed:840,  high_risk_km:280,  medium_km:360,  low_km:200  },
  { hazard:'Drought cracking', km_exposed:2480, high_risk_km:640,  medium_km:980,  low_km:860  },
  { hazard:'Extreme rainfall', km_exposed:8240, high_risk_km:2480, medium_km:3240, low_km:2520 },
  { hazard:'Soil erosion',     km_exposed:3120, high_risk_km:1040, medium_km:1280, low_km:800  },
  { hazard:'Thermal expansion',km_exposed:4680, high_risk_km:840,  medium_km:1860, low_km:1980 },
];
const FLOOD_LINKS = [
  { link_id:'A001_Link07', flood_freq_yr:4, max_depth_m:0.8, closure_days_yr:12, region:'Northern'      },
  { link_id:'C216_Link03', flood_freq_yr:6, max_depth_m:1.2, closure_days_yr:18, region:'Northern'      },
  { link_id:'B245_Link02', flood_freq_yr:3, max_depth_m:0.6, closure_days_yr:8,  region:'Eastern'       },
  { link_id:'C280_Link01', flood_freq_yr:8, max_depth_m:1.8, closure_days_yr:28, region:'North Eastern' },
  { link_id:'A003_Link06', flood_freq_yr:2, max_depth_m:0.4, closure_days_yr:6,  region:'Western'       },
  { link_id:'B102_Link04', flood_freq_yr:5, max_depth_m:0.9, closure_days_yr:14, region:'Eastern'       },
];
const RAINFALL_CONDITION = [
  { zone:'Lake Victoria Basin (>1200mm)',  km:3240, avg_iri:4.8, paved_pct:58, flood_pct:22 },
  { zone:'Highlands (>1000mm)',            km:1840, avg_iri:5.2, paved_pct:32, flood_pct:18 },
  { zone:'Central Savannah (800–1000mm)', km:6480, avg_iri:4.2, paved_pct:31, flood_pct:8  },
  { zone:'Northern Semi-arid (600–800mm)',km:4840, avg_iri:6.1, paved_pct:18, flood_pct:12 },
  { zone:'Karamoja Arid (<600mm)',         km:2840, avg_iri:7.4, paved_pct:9,  flood_pct:6  },
  { zone:'Rift Valley (variable)',         km:1920, avg_iri:5.8, paved_pct:28, flood_pct:14 },
];
const CARBON_EMISSIONS = [
  { activity:'Routine grading (gravel)', unit:'per km',     t_co2e:0.84, scope:'Scope 1'   },
  { activity:'Asphalt overlay',          unit:'per km',     t_co2e:48.4, scope:'Scope 1+3' },
  { activity:'Full reconstruction',      unit:'per km',     t_co2e:284,  scope:'Scope 1+3' },
  { activity:'Bridge construction',      unit:'per m span', t_co2e:12.4, scope:'Scope 1+3' },
  { activity:'DBST resealing',           unit:'per km',     t_co2e:18.4, scope:'Scope 1+3' },
  { activity:'Pothole patching',         unit:'per km',     t_co2e:4.8,  scope:'Scope 1'   },
];
const ENV_MITIGATION = [
  { measure:'Vegetation buffer (km)',      done_24:2480, done_25:2840, target_25:3200 },
  { measure:'Soil stabilisation (km)',     done_24:180,  done_25:212,  target_25:280  },
  { measure:'Rock traps / gabions',        done_24:284,  done_25:312,  target_25:380  },
  { measure:'Bioengineering slopes (km)',  done_24:84,   done_25:104,  target_25:140  },
  { measure:'Stream crossing upgrades',   done_24:1840, done_25:2040, target_25:2400 },
];
const PROTECTED_AREAS = [
  { park:'Bwindi Impenetrable NP',   access_road:'C-class gravel', km_to_gate:24, cond:'Fair',      detour_km:0   },
  { park:'Mgahinga Gorilla NP',      access_road:'C-class gravel', km_to_gate:18, cond:'Poor',      detour_km:0   },
  { park:'Rwenzori Mountains NP',    access_road:'B-class paved',  km_to_gate:12, cond:'Good',      detour_km:0   },
  { park:'Queen Elizabeth NP',       access_road:'B-class paved',  km_to_gate:8,  cond:'Fair',      detour_km:42  },
  { park:'Murchison Falls NP',       access_road:'A-class paved',  km_to_gate:45, cond:'Good',      detour_km:84  },
  { park:'Kidepo Valley NP',         access_road:'C-class gravel', km_to_gate:52, cond:'Poor',      detour_km:0   },
];
// ── §14 Cross-border Corridors ────────────────────────────────────────────────
const NORTHERN_CORRIDOR = [
  { segment:'Mombasa–Nairobi',       km:480, country:'Kenya',  cond:'Good', paved_pct:100 },
  { segment:'Nairobi–Malaba',        km:470, country:'Kenya',  cond:'Fair', paved_pct:100 },
  { segment:'Malaba–Kampala (A109)', km:247, country:'Uganda', cond:'Fair', paved_pct:100 },
  { segment:'Busia–Kampala',         km:201, country:'Uganda', cond:'Good', paved_pct:100 },
  { segment:'Kampala–Katuna (A4)',   km:419, country:'Uganda', cond:'Fair', paved_pct:100 },
  { segment:'Katuna–Kigali',         km:148, country:'Rwanda', cond:'Good', paved_pct:100 },
];
const CENTRAL_CORRIDOR = [
  { segment:'Dar es Salaam–Dodoma', km:480, country:'Tanzania', cond:'Fair', paved_pct:100 },
  { segment:'Dodoma–Isaka',         km:540, country:'Tanzania', cond:'Poor', paved_pct:64  },
  { segment:'Isaka–Mutukula',       km:344, country:'Tanzania', cond:'Poor', paved_pct:48  },
  { segment:'Mutukula–Masaka',      km:124, country:'Uganda',   cond:'Good', paved_pct:100 },
  { segment:'Masaka–Kampala',       km:138, country:'Uganda',   cond:'Good', paved_pct:100 },
];
const CORRIDOR_FREIGHT = [
  { corridor:'Northern Corridor', dir:'Import', annual_mt:12.4, top_cargo:'Fuel, Consumer goods', growth_pct:8.2  },
  { corridor:'Northern Corridor', dir:'Export', annual_mt:4.8,  top_cargo:'Coffee, Tea, Fish',    growth_pct:6.4  },
  { corridor:'Central Corridor',  dir:'Import', annual_mt:3.8,  top_cargo:'Fertiliser, Cement',   growth_pct:12.4 },
  { corridor:'Central Corridor',  dir:'Export', annual_mt:1.6,  top_cargo:'Minerals, Horticulture',growth_pct:9.2 },
  { corridor:'Western Corridor',  dir:'Import', annual_mt:1.4,  top_cargo:'Fuel, Consumer goods', growth_pct:4.8  },
  { corridor:'Western Corridor',  dir:'Export', annual_mt:0.6,  top_cargo:'Fish, Agricultural',   growth_pct:3.2  },
];
const BORDER_TRAFFIC = [
  { post:'Malaba',   country:'Kenya',    daily_veh:1560, pedestrians_d:4200, pct_hgv:82 },
  { post:'Busia',    country:'Kenya',    daily_veh:890,  pedestrians_d:8400, pct_hgv:64 },
  { post:'Mutukula', country:'Tanzania', daily_veh:420,  pedestrians_d:2800, pct_hgv:48 },
  { post:'Katuna',   country:'Rwanda',   daily_veh:620,  pedestrians_d:3400, pct_hgv:56 },
  { post:'Mpondwe',  country:'DRC',      daily_veh:310,  pedestrians_d:1800, pct_hgv:62 },
  { post:'Elegu',    country:'S.Sudan',  daily_veh:780,  pedestrians_d:2200, pct_hgv:72 },
  { post:'Oraba',    country:'DRC',      daily_veh:240,  pedestrians_d:1200, pct_hgv:48 },
];
const TRANSIT_TIME = [
  { route:'Mombasa–Kampala',      km:1027, days_avg:5.8, days_best:3.2, delay:'Customs / border' },
  { route:'Dar es Salaam–Kampala',km:1364, days_avg:7.2, days_best:4.8, delay:'Road condition'   },
  { route:'Kampala–Nairobi',      km:950,  days_avg:2.4, days_best:1.8, delay:'Weighbridge queue' },
  { route:'Kampala–Kigali',       km:560,  days_avg:1.6, days_best:1.2, delay:'Border formalities'},
  { route:'Kampala–Bujumbura',    km:640,  days_avg:2.8, days_best:1.6, delay:'DRC road condition'},
  { route:'Kampala–Juba',         km:840,  days_avg:4.2, days_best:2.8, delay:'Security / road'  },
];
const BORDER_INFRA = [
  { post:'Malaba–Busia', osbp:true,  scanners:2, lanes:8, parking_trucks:480, yr:2022 },
  { post:'Mutukula',     osbp:true,  scanners:1, lanes:4, parking_trucks:180, yr:2021 },
  { post:'Katuna',       osbp:true,  scanners:1, lanes:6, parking_trucks:240, yr:2023 },
  { post:'Elegu',        osbp:false, scanners:1, lanes:4, parking_trucks:120, yr:2025 },
  { post:'Mpondwe',      osbp:false, scanners:0, lanes:2, parking_trucks:60,  yr:null },
  { post:'Oraba',        osbp:false, scanners:0, lanes:2, parking_trucks:40,  yr:null },
];
// ── §15 Socioeconomic Impact ──────────────────────────────────────────────────
const POPULATION_ACCESS2 = [
  { region:'Central',       pop_m:10.8, km_road:4760, pop_per_km:2269, access_idx:84 },
  { region:'Eastern',       pop_m:8.4,  km_road:2775, pop_per_km:3027, access_idx:62 },
  { region:'Northern',      pop_m:7.2,  km_road:4595, pop_per_km:1567, access_idx:71 },
  { region:'Western',       pop_m:8.6,  km_road:2768, pop_per_km:3107, access_idx:58 },
  { region:'Southern',      pop_m:5.4,  km_road:3546, pop_per_km:1523, access_idx:66 },
  { region:'North Eastern', pop_m:2.8,  km_road:2716, pop_per_km:1031, access_idx:44 },
];
const AGRI_ACCESS = [
  { region:'Central',       farmland_km2:8420,  paved_pct:78, gravel_pct:18, no_road_pct:4  },
  { region:'Eastern',       farmland_km2:12840, paved_pct:38, gravel_pct:44, no_road_pct:18 },
  { region:'Northern',      farmland_km2:18240, paved_pct:22, gravel_pct:48, no_road_pct:30 },
  { region:'Western',       farmland_km2:10480, paved_pct:46, gravel_pct:42, no_road_pct:12 },
  { region:'Southern',      farmland_km2:9620,  paved_pct:52, gravel_pct:36, no_road_pct:12 },
  { region:'North Eastern', farmland_km2:24800, paved_pct:14, gravel_pct:38, no_road_pct:48 },
];
const RURAL_ACCESS = [
  { region:'Central',       rai:86, km_per_1000:12.4, target_rai:90 },
  { region:'Eastern',       rai:68, km_per_1000:8.6,  target_rai:80 },
  { region:'Northern',      rai:72, km_per_1000:14.2, target_rai:80 },
  { region:'Western',       rai:58, km_per_1000:8.4,  target_rai:75 },
  { region:'Southern',      rai:64, km_per_1000:14.8, target_rai:78 },
  { region:'North Eastern', rai:42, km_per_1000:18.6, target_rai:65 },
];
const HEALTH_ACCESS = [
  { region:'Central',       facilities:1284, within_2km_pct:92, good_road_pct:84 },
  { region:'Eastern',       facilities:968,  within_2km_pct:78, good_road_pct:62 },
  { region:'Northern',      facilities:840,  within_2km_pct:72, good_road_pct:54 },
  { region:'Western',       facilities:924,  within_2km_pct:80, good_road_pct:68 },
  { region:'Southern',      facilities:720,  within_2km_pct:76, good_road_pct:66 },
  { region:'North Eastern', facilities:384,  within_2km_pct:58, good_road_pct:38 },
];
const SCHOOL_ACCESS = [
  { region:'Central',       schools:4280, all_weather_pct:88, poor_road_pct:4,  no_road_pct:8  },
  { region:'Eastern',       schools:3840, all_weather_pct:68, poor_road_pct:18, no_road_pct:14 },
  { region:'Northern',      schools:3240, all_weather_pct:62, poor_road_pct:22, no_road_pct:16 },
  { region:'Western',       schools:3680, all_weather_pct:74, poor_road_pct:16, no_road_pct:10 },
  { region:'Southern',      schools:2840, all_weather_pct:76, poor_road_pct:14, no_road_pct:10 },
  { region:'North Eastern', schools:1240, all_weather_pct:44, poor_road_pct:32, no_road_pct:24 },
];
// ── §16 International Benchmarking ────────────────────────────────────────────
const EAC_NETWORK = [
  { country:'Uganda',   road_km:21302,  paved_km:6405,  paved_pct:30.1, pop_m:47.8, density:88.4  },
  { country:'Kenya',    road_km:63575,  paved_km:14028, paved_pct:22.1, pop_m:54.0, density:109.5 },
  { country:'Tanzania', road_km:145203, paved_km:12004, paved_pct:8.3,  pop_m:61.7, density:153.6 },
  { country:'Rwanda',   road_km:4700,   paved_km:1482,  paved_pct:31.5, pop_m:13.5, density:178.4 },
  { country:'Burundi',  road_km:12322,  paved_km:1286,  paved_pct:10.4, pop_m:12.6, density:462.5 },
  { country:'Ethiopia', road_km:110414, paved_km:13918, paved_pct:12.6, pop_m:124.1,density:100.0 },
  { country:'DRC',      road_km:152373, paved_km:2794,  paved_pct:1.8,  pop_m:100.0,density:65.0  },
];
const SSA_COMPARISON = [
  { country:'South Africa', paved_pct:80.4, cond_good_pct:72, spend_usd_km:12480 },
  { country:'Rwanda',       paved_pct:31.5, cond_good_pct:64, spend_usd_km:9840  },
  { country:'Uganda',       paved_pct:30.1, cond_good_pct:49, spend_usd_km:7620  },
  { country:'Ghana',        paved_pct:36.2, cond_good_pct:54, spend_usd_km:8840  },
  { country:'Kenya',        paved_pct:22.1, cond_good_pct:58, spend_usd_km:8240  },
  { country:'Ethiopia',     paved_pct:12.6, cond_good_pct:48, spend_usd_km:6240  },
  { country:'Nigeria',      paved_pct:15.4, cond_good_pct:32, spend_usd_km:4820  },
];
const ROAD_DENSITY = [
  { country:'Rwanda',   area_km2:26338,   road_km:4700,   density_per_km2:178.4 },
  { country:'Uganda',   area_km2:241038,  road_km:21302,  density_per_km2:88.4  },
  { country:'Kenya',    area_km2:580367,  road_km:63575,  density_per_km2:109.5 },
  { country:'Ethiopia', area_km2:1104300, road_km:110414, density_per_km2:100.0 },
  { country:'Tanzania', area_km2:945087,  road_km:145203, density_per_km2:153.6 },
  { country:'Zambia',   area_km2:752618,  road_km:40454,  density_per_km2:53.8  },
];
const MAINT_SPEND_COMPARISON = [
  { country:'South Africa', usd_paved:12480, usd_unpaved:4840, pct_gdp:2.8 },
  { country:'Kenya',        usd_paved:8240,  usd_unpaved:2840, pct_gdp:1.6 },
  { country:'Rwanda',       usd_paved:9840,  usd_unpaved:3240, pct_gdp:2.2 },
  { country:'Uganda',       usd_paved:7620,  usd_unpaved:1840, pct_gdp:1.2 },
  { country:'Tanzania',     usd_paved:6840,  usd_unpaved:1480, pct_gdp:1.0 },
  { country:'Ghana',        usd_paved:8840,  usd_unpaved:2640, pct_gdp:1.8 },
];
const IRI_BENCHMARKS = [
  { standard:'SSATP — Good (IRI < 3.5)',    ugx_pct:22.6, eac_avg_pct:28.4 },
  { standard:'SSATP — Fair (IRI 3.5–6)',   ugx_pct:26.4, eac_avg_pct:30.2 },
  { standard:'SSATP — Poor (IRI > 6)',     ugx_pct:51.0, eac_avg_pct:41.4 },
  { standard:'WB threshold (IRI < 4)',     ugx_pct:38.4, eac_avg_pct:42.8 },
  { standard:'WB threshold (IRI > 8)',     ugx_pct:22.1, eac_avg_pct:16.4 },
];
const TRAFFIC_BENCHMARKS = [
  { route_type:'Capital–port (national)', ugx_aadt:19400, eac_avg_aadt:14800, ssa_avg_aadt:10400 },
  { route_type:'Capital–2nd city',        ugx_aadt:15200, eac_avg_aadt:9600,  ssa_avg_aadt:6800  },
  { route_type:'National highway',        ugx_aadt:7400,  eac_avg_aadt:4800,  ssa_avg_aadt:3200  },
  { route_type:'Secondary road',          ugx_aadt:2800,  eac_avg_aadt:1600,  ssa_avg_aadt:1200  },
  { route_type:'Tertiary road',           ugx_aadt:840,   eac_avg_aadt:480,   ssa_avg_aadt:360   },
];
// ── §17 Asset Valuation ───────────────────────────────────────────────────────
const ASSET_REPL_VALUE = [
  { cls:'A — Paved',  km:2615,  cost_per_km_m:6.4, total_bn:167.4, depreciated_bn:112.8 },
  { cls:'B — Paved',  km:2354,  cost_per_km_m:5.2, total_bn:122.4, depreciated_bn:84.6  },
  { cls:'B — Gravel', km:509,   cost_per_km_m:0.84,total_bn:4.3,   depreciated_bn:2.8   },
  { cls:'C — Paved',  km:1224,  cost_per_km_m:4.8, total_bn:58.8,  depreciated_bn:36.4  },
  { cls:'C — Gravel', km:14313, cost_per_km_m:0.80,total_bn:114.5, depreciated_bn:62.8  },
  { cls:'M — Urban',  km:145,   cost_per_km_m:8.4, total_bn:12.2,  depreciated_bn:8.4   },
];
const ANNUAL_DEPRECIATION = [
  { asset:'Paved roads',    total_bn:361.4, dep_rate_pct:4.2, annual_dep_bn:15.2 },
  { asset:'Gravel roads',   total_bn:118.8, dep_rate_pct:18.4,annual_dep_bn:21.8 },
  { asset:'Bridges',        total_bn:84.6,  dep_rate_pct:2.8, annual_dep_bn:2.4  },
  { asset:'Road furniture', total_bn:12.4,  dep_rate_pct:8.4, annual_dep_bn:1.0  },
  { asset:'Drainage works', total_bn:28.4,  dep_rate_pct:3.8, annual_dep_bn:1.1  },
];
const BRIDGE_ASSET_VALUE = [
  { type:'RC Slab',           count:186, avg_span_m:12.4, unit_cost_m:4.8,  total_bn:11.1 },
  { type:'RC Beam',           count:142, avg_span_m:18.6, unit_cost_m:7.2,  total_bn:19.0 },
  { type:'Steel/Composite',   count:88,  avg_span_m:28.2, unit_cost_m:12.4, total_bn:30.8 },
  { type:'Bailey/Temporary',  count:34,  avg_span_m:15.0, unit_cost_m:2.4,  total_bn:1.2  },
  { type:'Masonry Arch',      count:21,  avg_span_m:9.8,  unit_cost_m:3.6,  total_bn:0.7  },
];
const CAPITAL_STOCK = [
  { yr:2000, paved_bn:84,  unpaved_bn:48,  bridges_bn:18, total_bn:150 },
  { yr:2005, paved_bn:112, unpaved_bn:52,  bridges_bn:24, total_bn:188 },
  { yr:2010, paved_bn:184, unpaved_bn:58,  bridges_bn:38, total_bn:280 },
  { yr:2015, paved_bn:264, unpaved_bn:82,  bridges_bn:56, total_bn:402 },
  { yr:2020, paved_bn:348, unpaved_bn:104, bridges_bn:72, total_bn:524 },
  { yr:2025, paved_bn:480, unpaved_bn:118, bridges_bn:84, total_bn:682 },
];
const ANNUAL_CONSUMPTION = [
  { yr:2021, road_bn:28.4, bridge_bn:2.1, total_bn:30.5, covered_by_budget_pct:62 },
  { yr:2022, road_bn:30.8, bridge_bn:2.2, total_bn:33.0, covered_by_budget_pct:64 },
  { yr:2023, road_bn:33.4, bridge_bn:2.3, total_bn:35.7, covered_by_budget_pct:68 },
  { yr:2024, road_bn:35.6, bridge_bn:2.4, total_bn:38.0, covered_by_budget_pct:72 },
  { yr:2025, road_bn:37.2, bridge_bn:2.5, total_bn:39.7, covered_by_budget_pct:76 },
];
const ROAD_FURNITURE_ASSET = [
  { category:'Road signs',          units:31260, unit_cost_k:480,  total_bn:15.0, dep_pct:22 },
  { category:'Guard rails (km)',    units:2840,  unit_cost_k:3200, total_bn:9.1,  dep_pct:18 },
  { category:'Road markings (km)',  units:4280,  unit_cost_k:840,  total_bn:3.6,  dep_pct:28 },
  { category:'Drainage structures', units:92400, unit_cost_k:84,   total_bn:7.8,  dep_pct:12 },
  { category:'Street lighting',     units:4280,  unit_cost_k:1200, total_bn:5.1,  dep_pct:15 },
  { category:'Roadside furniture',  units:18400, unit_cost_k:120,  total_bn:2.2,  dep_pct:20 },
];
// ── §18 Data Quality & Audit ──────────────────────────────────────────────────
const GEOJSON_COMPLETENESS = [
  { field:'link_id',    features:1013, filled:1013, pct:100.0 },
  { field:'road_class', features:1013, filled:1013, pct:100.0 },
  { field:'surface_ty', features:1013, filled:986,  pct:97.3  },
  { field:'length_km1', features:1013, filled:1013, pct:100.0 },
  { field:'maintena_1', features:1013, filled:998,  pct:98.5  },
  { field:'link_name',  features:1013, filled:824,  pct:81.3  },
  { field:'start_km',   features:1013, filled:912,  pct:90.0  },
  { field:'geometry',   features:1013, filled:1013, pct:100.0 },
];
const SURVEY_COVERAGE = [
  { region:'Central',       total_links:212, surveyed:186, pct:87.7, last_survey:'2024 Q3' },
  { region:'Eastern',       total_links:153, surveyed:118, pct:77.1, last_survey:'2024 Q2' },
  { region:'Northern',      total_links:186, surveyed:134, pct:72.0, last_survey:'2024 Q4' },
  { region:'Western',       total_links:184, surveyed:148, pct:80.4, last_survey:'2024 Q3' },
  { region:'Southern',      total_links:168, surveyed:126, pct:75.0, last_survey:'2024 Q2' },
  { region:'North Eastern', total_links:110, surveyed:68,  pct:61.8, last_survey:'2023 Q4' },
];
const DATA_VINTAGE = [
  { dataset:'Road network GeoJSON',   source:'DNR GIS Section',  vintage:'Jun 2025', features:1013 },
  { dataset:'Condition data (NAPR)',  source:'NAPR survey',      vintage:'Jul 2025', features:780  },
  { dataset:'Bridge BMS',             source:'BMS field survey', vintage:'Mar 2025', features:483  },
  { dataset:'TIS traffic counts',    source:'TIS / ATC',        vintage:'Apr 2025', features:298  },
  { dataset:'Weighbridge records',   source:'EACU weighbridge', vintage:'Jun 2025', features:8    },
  { dataset:'OPRC performance',      source:'DNR contracts',    vintage:'May 2025', features:9    },
  { dataset:'Road pave year history',source:'DNR archives',     vintage:'Dec 2024', features:313  },
];
const DATA_GAPS = [
  { gap:'27 links missing geometry coordinates',          severity:'Low',    priority:3 },
  { gap:'142 km official network not in GeoJSON',         severity:'Medium', priority:2 },
  { gap:'233 links without 2024 condition survey',       severity:'High',   priority:1 },
  { gap:'715 links AADT estimated by ML model',          severity:'Medium', priority:2 },
  { gap:'191 bridges with incomplete inspection',        severity:'High',   priority:1 },
  { gap:'Pavement age unknown for 12% of links',         severity:'Low',    priority:3 },
];
const KPI_VALIDATION = [
  { kpi:'Total network km',  value:'21,302', source:'DNR official', geojson:'21,160', delta:'+142',  ok:true },
  { kpi:'Total links',       value:'1,013',  source:'GeoJSON',      geojson:'1,013',  delta:'0',     ok:true },
  { kpi:'Paved km',          value:'6,334',  source:'DNR survey',   geojson:'6,193',  delta:'+141',  ok:true },
  { kpi:'Paved pct',         value:'30.1%',  source:'DNR official', geojson:'29.3%',  delta:'+0.4%', ok:true },
  { kpi:'Total bridges',     value:'483',    source:'BMS',          geojson:'483',    delta:'0',     ok:true },
  { kpi:'ATC stations',      value:'25',     source:'TIS database', geojson:'N/A',    delta:'N/A',   ok:true },
];
const DUPLICATE_CHECK = [
  { check:'Duplicate link_id values',     found:0,  action:'None needed',       status:'PASS' },
  { check:'Duplicate geometries',         found:2,  action:'Manual review',     status:'WARN' },
  { check:'Zero-length links',            found:0,  action:'None needed',       status:'PASS' },
  { check:'Links outside Uganda bbox',    found:0,  action:'None needed',       status:'PASS' },
  { check:'Invalid road_class values',    found:0,  action:'None needed',       status:'PASS' },
  { check:'Mismatched length_km1 vs geom',found:14, action:'Recalculate field', status:'WARN' },
  { check:'Orphan bridge coordinates',    found:3,  action:'Field verification',status:'WARN' },
];
// ── §19 Construction & Rehabilitation ────────────────────────────────────────
const ACTIVE_CONTRACTS = [
  { contract:'Gulu–Atiak–Nimule (A1)',  km:103, contractor:'China Wu Yi', cost_bn:486, progress_pct:28, yr:2024 },
  { contract:'Mpigi–Kanoni Road',        km:78,  contractor:'COLAS',       cost_bn:312, progress_pct:42, yr:2024 },
  { contract:'Kapchorwa–Suam',          km:79,  contractor:'STRABAG',     cost_bn:285, progress_pct:41, yr:2023 },
  { contract:'Luwero–Nakasongola',      km:83,  contractor:'Dott Svc',    cost_bn:248, progress_pct:34, yr:2024 },
  { contract:'Fort Portal–Kamwenge',    km:74,  contractor:'STRABAG',     cost_bn:320, progress_pct:55, yr:2022 },
  { contract:'Soroti–Katakwi–Moroto',   km:266, contractor:'China CC',    cost_bn:890, progress_pct:12, yr:2025 },
  { contract:'Ishaka–Kagamba',          km:30,  contractor:'COLAS',       cost_bn:128, progress_pct:68, yr:2024 },
];
const COMPLETED_REHAB = [
  { period:'2020/21', km_paved:128, km_gravel:842,  cost_bn:680,  contracts:14 },
  { period:'2021/22', km_paved:164, km_gravel:924,  cost_bn:840,  contracts:18 },
  { period:'2022/23', km_paved:196, km_gravel:1084, cost_bn:1020, contracts:22 },
  { period:'2023/24', km_paved:218, km_gravel:1124, cost_bn:1140, contracts:24 },
  { period:'2024/25', km_paved:248, km_gravel:1284, cost_bn:1284, contracts:26 },
];
const NEW_ROAD_BY_YEAR = [
  { yr:2015, paved_km:240, gravel_km:480,  invest_bn:480  },
  { yr:2018, paved_km:184, gravel_km:640,  invest_bn:520  },
  { yr:2020, paved_km:128, gravel_km:320,  invest_bn:340  },
  { yr:2022, paved_km:196, gravel_km:840,  invest_bn:680  },
  { yr:2024, paved_km:248, gravel_km:1120, invest_bn:880  },
  { yr:2025, paved_km:264, gravel_km:1280, invest_bn:1020 },
];
const CONTRACT_PERFORMANCE = [
  { contractor:'COLAS',        lots:3, quality_score:88, time_overrun_pct:12, claims_m:284 },
  { contractor:'STRABAG',      lots:2, quality_score:84, time_overrun_pct:18, claims_m:186 },
  { contractor:'Dott Services',lots:2, quality_score:82, time_overrun_pct:24, claims_m:142 },
  { contractor:'China Wu Yi',  lots:2, quality_score:76, time_overrun_pct:32, claims_m:384 },
  { contractor:'China CC',     lots:1, quality_score:74, time_overrun_pct:28, claims_m:210 },
  { contractor:'SEACOM',       lots:2, quality_score:80, time_overrun_pct:20, claims_m:128 },
];
const PROCUREMENT_TIMELINE = [
  { stage:'Advertisement to EOI',          avg_wks:4,  best_wks:2,  legal_min:2    },
  { stage:'EOI evaluation',                avg_wks:6,  best_wks:4,  legal_min:4    },
  { stage:'RFP issue to submission',       avg_wks:12, best_wks:8,  legal_min:8    },
  { stage:'Technical & financial review',  avg_wks:8,  best_wks:6,  legal_min:6    },
  { stage:'Approval & contract award',     avg_wks:16, best_wks:8,  legal_min:null },
  { stage:'Contract to mobilisation',      avg_wks:6,  best_wks:4,  legal_min:null },
];
const DESIGN_COMPLIANCE = [
  { standard:'Geometric design (UNSS)',    compliant_pct:84, non_compliant_pct:16, yr:2024 },
  { standard:'Pavement design (DNR manual)',compliant_pct:76, non_compliant_pct:24, yr:2024 },
  { standard:'Drainage design',           compliant_pct:68, non_compliant_pct:32, yr:2024 },
  { standard:'Bridge loading (IRC:6)',    compliant_pct:72, non_compliant_pct:28, yr:2024 },
  { standard:'Environmental compliance', compliant_pct:64, non_compliant_pct:36, yr:2024 },
];
// ── §20 Connectivity & Accessibility ─────────────────────────────────────────
const DISTRICT_CONN = [
  { district:'Kampala',     cls:'A', access_km:0,   all_weather:true,  pop_m:3.6 },
  { district:'Gulu',        cls:'A', access_km:336, all_weather:true,  pop_m:0.6 },
  { district:'Mbarara',     cls:'A', access_km:262, all_weather:true,  pop_m:0.8 },
  { district:'Mbale',       cls:'A', access_km:240, all_weather:true,  pop_m:0.5 },
  { district:'Arua',        cls:'A', access_km:482, all_weather:true,  pop_m:0.4 },
  { district:'Moroto',      cls:'B', access_km:580, all_weather:true,  pop_m:0.1 },
  { district:'Kotido',      cls:'C', access_km:640, all_weather:false, pop_m:0.1 },
  { district:'Abim',        cls:'C', access_km:520, all_weather:false, pop_m:0.1 },
];
const ALL_WEATHER_ACCESS = [
  { sub_region:'Buganda',    total_km:3840, all_weather_km:3480, pct:90.6 },
  { sub_region:'Busoga',     total_km:1840, all_weather_km:1480, pct:80.4 },
  { sub_region:'Teso',       total_km:1640, all_weather_km:1180, pct:72.0 },
  { sub_region:'Acholi',     total_km:2480, all_weather_km:1680, pct:67.7 },
  { sub_region:'Lango',      total_km:1840, all_weather_km:1240, pct:67.4 },
  { sub_region:'West Nile',  total_km:1680, all_weather_km:980,  pct:58.3 },
  { sub_region:'Karamoja',   total_km:2840, all_weather_km:1040, pct:36.6 },
  { sub_region:'Ankole',     total_km:2240, all_weather_km:1680, pct:75.0 },
];
const TRAVEL_TIME_MATRIX = [
  { to:'Gulu',         km:336, best_hr:4.2, typical_hr:5.8, road:'A1'     },
  { to:'Mbarara',      km:262, best_hr:3.2, typical_hr:4.4, road:'A3'     },
  { to:'Mbale',        km:240, best_hr:3.0, typical_hr:4.2, road:'A2'     },
  { to:'Arua',         km:482, best_hr:6.8, typical_hr:8.4, road:'A1/A45' },
  { to:'Kabale',       km:419, best_hr:5.4, typical_hr:7.2, road:'A4'     },
  { to:'Fort Portal',  km:298, best_hr:4.0, typical_hr:5.6, road:'A4'     },
  { to:'Soroti',       km:350, best_hr:4.6, typical_hr:6.4, road:'A1/B'   },
  { to:'Moroto',       km:580, best_hr:8.4, typical_hr:11.2,road:'A1/B'   },
];
const CONN_GAPS = [
  { gap:'Kotido–Kaabong (C-class, dry weather only)', km:84, pop_k:82,  priority:'High'   },
  { gap:'Kidepo access road (dry weather only)',       km:62, pop_k:48,  priority:'Medium' },
  { gap:'Nakapiripirit–Moroto (corrugated)',           km:68, pop_k:64,  priority:'High'   },
  { gap:'Yumbe–Moyo unpaved link',                    km:74, pop_k:124, priority:'High'   },
  { gap:'Kasese–Bugoye–Bundibugyo',                   km:86, pop_k:96,  priority:'Medium' },
  { gap:'Soroti–Katakwi (poor condition)',             km:86, pop_k:148, priority:'High'   },
];
const URBAN_ROADS = [
  { city:'Kampala',    urban_km:2140, paved_pct:68, signals:124, bus_routes:84 },
  { city:'Gulu',       urban_km:248,  paved_pct:42, signals:12,  bus_routes:18 },
  { city:'Mbarara',    urban_km:184,  paved_pct:52, signals:8,   bus_routes:14 },
  { city:'Jinja',      urban_km:196,  paved_pct:58, signals:14,  bus_routes:16 },
  { city:'Mbale',      urban_km:168,  paved_pct:48, signals:10,  bus_routes:12 },
  { city:'Fort Portal',urban_km:128,  paved_pct:46, signals:6,   bus_routes:8  },
];
const NATIONAL_PARKS_ACCESS = [
  { park:'Queen Elizabeth NP',  cls:'B', km_gate:8,  surface:'Paved',       visitors:48200 },
  { park:'Bwindi Impenetrable', cls:'C', km_gate:24, surface:'Gravel',      visitors:24800 },
  { park:'Murchison Falls NP',  cls:'A', km_gate:45, surface:'Paved/Gravel',visitors:62400 },
  { park:'Kidepo Valley NP',    cls:'C', km_gate:52, surface:'Gravel',      visitors:8400  },
  { park:'Lake Mburo NP',       cls:'B', km_gate:8,  surface:'Paved',       visitors:38600 },
  { park:'Rwenzori Mountains',  cls:'C', km_gate:12, surface:'Gravel',      visitors:14200 },
];
const OIL_ROADS = [
  { road:'Hoima–Buliisa (A1)',     km:112, surface:'Paved',  cls:'A', oil_pct:28, upgrade_yr:2024 },
  { road:'Buliisa–Masindi',        km:68,  surface:'Gravel', cls:'C', oil_pct:42, upgrade_yr:2025 },
  { road:'Kampala–Hoima (A1)',     km:186, surface:'Paved',  cls:'A', oil_pct:18, upgrade_yr:null },
  { road:'Kabaale–Buseruka',       km:38,  surface:'Paved',  cls:'B', oil_pct:64, upgrade_yr:2023 },
  { road:'Kiziranfumbi–Kikuube',   km:42,  surface:'Gravel', cls:'C', oil_pct:48, upgrade_yr:2026 },
];
const RESILIENCE_INDICATORS = [
  { metric:'Links with no detour route',       value:'184',  pct:'18.2%', risk:'High'     },
  { metric:'Links over flood-prone crossings', value:'94',   pct:'9.3%',  risk:'High'     },
  { metric:'Single-access districts',          value:'8',    pct:' — ',   risk:'Critical' },
  { metric:'Mean detour ratio (when available)',value:'1.84x',pct:' — ',  risk:'Medium'   },
  { metric:'Bridges critical to connectivity', value:'62',   pct:'12.8%', risk:'High'     },
  { metric:'Network redundancy index',         value:'0.72', pct:' — ',   risk:'Low'      },
];
const DETOUR_AVAILABILITY = [
  { cls:'A', total_links:156, have_detour:148, pct:94.9, avg_detour_km:42 },
  { cls:'B', total_links:162, have_detour:146, pct:90.1, avg_detour_km:68 },
  { cls:'C', total_links:680, have_detour:518, pct:76.2, avg_detour_km:94 },
  { cls:'M', total_links:15,  have_detour:14,  pct:93.3, avg_detour_km:22 },
];
const CRITICAL_LINKS = [
  { link_id:'C280_Link01', name:'Moroto–Nakapiripirit', reason:'No detour', pop_served_k:64,  closure_risk:'High'   },
  { link_id:'C297_Link02', name:'Kotido–Abim',          reason:'No detour', pop_served_k:82,  closure_risk:'High'   },
  { link_id:'B240_Link03', name:'Kidepo access',        reason:'No detour', pop_served_k:48,  closure_risk:'Medium' },
  { link_id:'A001_Link07', name:'Karuma Bridge approach',reason:'Bridge',   pop_served_k:2400,closure_risk:'High'   },
  { link_id:'A002_Link01', name:'Jinja / Owen Falls',   reason:'Bridge',    pop_served_k:4800,closure_risk:'High'   },
  { link_id:'A004_Link07', name:'Katuna mountain pass', reason:'No detour', pop_served_k:240, closure_risk:'Medium' },
];
const MARKET_CONNECTIVITY = [
  { market_type:'International (border / port)',  count:7,   all_paved_pct:100, avg_aadt:1240 },
  { market_type:'Regional wholesale markets',    count:24,  all_paved_pct:92,  avg_aadt:3840 },
  { market_type:'Town / district markets',       count:112, all_paved_pct:74,  avg_aadt:1480 },
  { market_type:'Sub-county markets',            count:840, all_paved_pct:38,  avg_aadt:420  },
  { market_type:'Village markets',               count:3200,all_paved_pct:12,  avg_aadt:84   },
];
const SERVICE_CENTERS = [
  { service:'District headquarters',   total:134, paved_access_pct:94, gravel_pct:5, no_road_pct:1 },
  { service:'Sub-county HQ',           total:1380,paved_access_pct:64, gravel_pct:28,no_road_pct:8 },
  { service:'Health centres (HCIV)',   total:248, paved_access_pct:72, gravel_pct:22,no_road_pct:6 },
  { service:'Secondary schools',       total:2840,paved_access_pct:58, gravel_pct:32,no_road_pct:10},
  { service:'Police stations',         total:548, paved_access_pct:82, gravel_pct:14,no_road_pct:4 },
  { service:'Cooperative stores',      total:1840,paved_access_pct:48, gravel_pct:38,no_road_pct:14},
];
const NETWORK_COMPLETENESS = [
  { dimension:'GeoJSON spatial coverage', target:'100%', achieved:'98.7%', gap:'142 km unmapped'       },
  { dimension:'Condition data coverage',  target:'100%', achieved:'77.0%', gap:'233 links unsurveyed'  },
  { dimension:'Traffic count coverage',   target:'100%', achieved:'29.4%', gap:'715 links model-only'  },
  { dimension:'Bridge inventory',         target:'100%', achieved:'84.1%', gap:'77 bridges incomplete' },
  { dimension:'Link name completeness',   target:'100%', achieved:'81.3%', gap:'189 links unnamed'     },
  { dimension:'Pave year recorded',       target:'100%', achieved:'88.0%', gap:'121 links unknown age' },
];

// ── §21 Global RMS Case Studies ──────────────────────────────────────────────
const GLOBAL_CASES_TABLE = [
  { id:1,  agency:'TANROADS',       country:'Tanzania',        flag:'🇹🇿', km:35000,  paved_pct:25, system:'RAMS / HDM-4 (IDA)',          yrs_active:'2015–now', budget_km_usd:8000,  innovation:'Tropical HDM-4 calibration (−18% treatment costs)',      dnr:'Uganda-specific calibration for Class C/B; ROMDAS + visual survey integration' },
  { id:2,  agency:'KeNHA',          country:'Kenya',           flag:'🇰🇪', km:11189,  paved_pct:22, system:'RAMS + dTIMS CT',              yrs_active:'2016–now', budget_km_usd:22000, innovation:'Mobile survey apps halved survey costs (KoboToolbox)',     dnr:'Mobile-first Class C survey; twice-yearly frequency achievable' },
  { id:3,  agency:'RTDA',           country:'Rwanda',          flag:'🇷🇼', km:4700,   paved_pct:31, system:'OPRC + Integrated RAMS',       yrs_active:'2018–now', budget_km_usd:24000, innovation:'Bundled emergency+routine in single OPRC lot',           dnr:'Lot 9 (Karamoja) emergency-response clause; rapid paving 18%→34%' },
  { id:4,  agency:'SANRAL',         country:'South Africa',    flag:'🇿🇦', km:21400,  paved_pct:95, system:'iRAMS (Integrated RAMS)',       yrs_active:'2010–now', budget_km_usd:48000, innovation:'Public condition portal builds political budget support',   dnr:'Simple public DNR dashboard strengthens case for maintenance funding' },
  { id:5,  agency:'Highways England',country:'United Kingdom', flag:'🇬🇧', km:7800,   paved_pct:100,system:'HAPMS',                        yrs_active:'2005–now', budget_km_usd:180000,innovation:'50-year planning horizon, ISO 55001 certified',            dnr:'10–15 yr rolling maintenance programme via HDM-4 multi-year analysis' },
  { id:6,  agency:'Austroads/DPTI', country:'Australia',       flag:'🇦🇺', km:33000,  paved_pct:88, system:'DNR RMS Engine (fmr. dTIMS CT)',yrs_active:'2000–now', budget_km_usd:95000, innovation:'AP-R359/556 low-cost sealed/unsealed roads research series',dnr:'AP-R359 directly applicable to Class B DBST; AP-R556 for wet-tropics C roads' },
  { id:7,  agency:'NZTA Waka Kotahi',country:'New Zealand',    flag:'🇳🇿', km:11000,  paved_pct:90, system:'ONE Network Framework',         yrs_active:'2014–now', budget_km_usd:68000, innovation:'Service-level targets by road class (ONRC)',               dnr:'Differentiated service levels for DNR Class A/B/C — explicit performance targets' },
  { id:8,  agency:'FHWA / DOTs',    country:'USA',             flag:'🇺🇸', km:900000, paved_pct:80, system:'FMIS / TAMP (MAP-21)',          yrs_active:'2012–now', budget_km_usd:280000,innovation:'Mandatory TAMP legislation (MAP-21/FAST Act)',              dnr:'Model for Uganda Transport Infrastructure Act: mandatory 10-yr AMP to Parliament' },
  { id:9,  agency:'NHAI / NRRDA',   country:'India',           flag:'🇮🇳', km:145000, paved_pct:65, system:'RCMS + Gati Shakti GIS',        yrs_active:'2021–now', budget_km_usd:12000, innovation:'RCMS mobile app for rural/gravel roads at scale',          dnr:'Scalable Class C monitoring with community participation in Northern Uganda' },
  { id:10, agency:'Trafikverket',   country:'Sweden',          flag:'🇸🇪', km:98000,  paved_pct:84, system:'PMS + LCC (12-yr plan)',        yrs_active:'2018–now', budget_km_usd:84000, innovation:'Seasonal rainfall cycle integrated in deterioration model',dnr:'Uganda bi-modal rainfall (MAM+OND) creates analogous cyclic damage patterns' },
  { id:11, agency:'Rijkswaterstaat',country:'Netherlands',     flag:'🇳🇱', km:5900,   paved_pct:100,system:'Predictive Asset Management',   yrs_active:'2015–now', budget_km_usd:180000,innovation:'Monthly Asset Health Index per link (single KPI to Parliament)',dnr:'DNR AHI simplifies MoWT reporting while retaining technical depth' },
  { id:12, agency:'MLIT',           country:'Japan',           flag:'🇯🇵', km:127000, paved_pct:92, system:'Bridge Inspection Law + RAMS',  yrs_active:'2014–now', budget_km_usd:124000,innovation:'Mandatory 5-yr bridge inspection cycle (Road Act 2014)',    dnr:'Legal mandatory inspection cycle model for Uganda Transport Infrastructure Act' },
  { id:13, agency:'DNIT',           country:'Brazil',          flag:'🇧🇷', km:75000,  paved_pct:80, system:'SGEPT / CREMA contracts',       yrs_active:'2010–now', budget_km_usd:18000, innovation:'CREMA OPRC on gravel roads (18% cheaper than traditional)',dnr:'Performance standards for Class C gravel with baseline condition safeguards' },
  { id:14, agency:'GHA',            country:'Ghana',           flag:'🇬🇭', km:15000,  paved_pct:36, system:'GHIAS (IDA P164887)',           yrs_active:'2018–2022',budget_km_usd:14000, innovation:'Phased RAMS: high-traffic paved first, then gravel',         dnr:'Phase rollout reduces costs; builds institutional capacity before full C-road expansion' },
  { id:15, agency:'ERA',            country:'Ethiopia',        flag:'🇪🇹', km:130000, paved_pct:13, system:'RRAMPS (AfDB-funded)',           yrs_active:'2019–2024',budget_km_usd:8000,  innovation:'Baseline→analysis→budget: exactly DNR\'s next phase',     dnr:'DNR already has good condition data; prioritise budget optimisation & programme generation now' },
];

// ── §22 Category B International Standards ────────────────────────────────────
const CAT_B_STANDARDS = [
  { name:'HDM-4 Highway Development & Management Tool (v1.3)',          body:'World Bank / PIARC',              yr:'2000',    module:'HDM4, PMS, Budget',      status:'Active',   notes:'Core PMS analytical engine; Uganda-specific calibration 2023' },
  { name:'ISO 55001:2014 — Asset Management System Requirements',        body:'ISO / BSI',                       yr:'2014',    module:'RMS, BMS, PMS',          status:'Active',   notes:'DNR Asset Mgmt Policy 2017 aligned to ISO 55000 series' },
  { name:'SATCC TRH4 — Structural Design of Flexible Pavements (2020)', body:'SATCC / CSIR South Africa',       yr:'2020',    module:'PMS, HDM4, TIS',         status:'Active',   notes:'Source of ESAL factors; Truck Trailer 6ax = 5.86 CESAL' },
  { name:'World Bank Road Asset Management Guidelines (RAMP)',           body:'World Bank / IBRD',               yr:'2018',    module:'RMS, Budget, PMS',       status:'Active',   notes:'Framework for DNR RAMS procurement; referenced in RSDP I–IV' },
  { name:'AfDB Infrastructure Asset Management Policy Framework',        body:'African Development Bank',        yr:'2021',    module:'RMS, Budget',            status:'Active',   notes:'Applies to all AfDB-funded DNR projects (RSSP I-III, UTRP)' },
  { name:'AASHTO PP 104-20 — Pavement Preservation Design Guide',       body:'AASHTO',                          yr:'2020',    module:'PMS, HDM4',              status:'Active',   notes:'Supplementary design reference for Class A MEPDG approach' },
  { name:'FHWA TAMP Guidelines — Transportation Asset Management Plans', body:'FHWA (USA)',                      yr:'2019',    module:'RMS, Budget, BMS',       status:'Active',   notes:'Model for DNR 10-year Asset Management Plan to MoWT/Parliament' },
  { name:'Austroads AP-R615-20 — Asset Management for Road Networks',   body:'Austroads',                       yr:'2020',    module:'Lifecycle, Budget, RMS', status:'Active',   notes:'LCC methodology applied in DNR Lifecycle Management module' },
  { name:'Austroads AP-R359-09 — Low-Cost Sealed Roads',                body:'Austroads',                       yr:'2009',    module:'PMS',                    status:'Archived', notes:'Directly applicable to Uganda Class B/C DBST upgrade decisions' },
  { name:'PIARC Technical Report — Road Asset Management in Devg. Countries',body:'PIARC (World Road Association)',yr:'2019',  module:'RMS, Budget',            status:'Active',   notes:'PIARC TC 4.1 report on RAMS in developing countries; DNR context match' },
  { name:'IRC SP:19-2001 — Guidelines for Road Maintenance',            body:'Indian Roads Congress (IRC)',      yr:'2001',    module:'Budget, PMS',            status:'Archived', notes:'Maintenance cost norms applicable to DNR Class C maintenance stations' },
  { name:'MoWT Uganda Roads Design Manual (2023 Update)',               body:'Ministry of Works & Transport, UG',yr:'2023',   module:'PMS, BMS, HDM4',         status:'Active',   notes:'Primary Uganda national design standard; climate-resilient 2023 update' },
  { name:'MoWT Schedule of Rates FY 2025/26',                          body:'Ministry of Works & Transport, UG',yr:'2025',   module:'Budget, HDM4, PMS',      status:'Active',   notes:'2,000+ unit costs (UGX); updated annually; WB procurement compliant' },
  { name:'DNR Road Infrastructure Asset Management Policy 2017 (v1.4)',body:'Department of National Roads / DNR',yr:'2017',   module:'RMS, Budget, PMS, BMS',  status:'Active',   notes:'Foundational DNR policy; v1.4 incorporates OPRC performance requirements' },
  { name:'COMESA Road Design Standards',                                body:'COMESA / TTCA',                    yr:'2018',    module:'TIS, HDM4',              status:'Active',   notes:'10-tonne axle load standard; applied at all Uganda weighbridge stations' },
  { name:'SSATP Working Paper — Road Funds and Road Maintenance in Africa',body:'World Bank SSATP',            yr:'2016',    module:'Budget, RMS',            status:'Archived', notes:'Cross-country benchmarks for Uganda Road Fund adequacy' },
  { name:'EAC Technical Specifications for Road Design',                body:'East African Community',           yr:'2014',    module:'PMS, BMS, HDM4',         status:'Active',   notes:'Regional harmonisation; DNR designs must comply for cross-border links' },
  { name:'ERA Road Asset Management System Manual — Ethiopia',          body:'Ethiopian Roads Authority',        yr:'2021',    module:'RMS, PMS',               status:'Active',   notes:'AfDB-funded RAMS manual; phased rollout approach applicable to DNR stage 2' },
  { name:'TANROADS Road Asset Management Manual',                       body:'TANROADS Tanzania',                yr:'2020',    module:'RMS, HDM4',              status:'Active',   notes:'East Africa peer reference; calibration approach directly applicable to DNR' },
  { name:'Kenya KeNHA Asset Management Framework',                      body:'KeNHA Kenya',                      yr:'2022',    module:'RMS, BMS',               status:'Active',   notes:'Northern Corridor partner; AMP format model for DNR 10-year plan' },
];

// ── §23 Category C Research Literature ───────────────────────────────────────
const CAT_C_RESEARCH = [
  { ref:'P01', author:'Odoki & Kerali / PIARC',                yr:'2000', title:'Pavement Deterioration Modelling for Developing Countries',               notes:'Foundational HDM-4 Africa calibration; DNR 2023 calibration study' },
  { ref:'P02', author:'Marcelino et al. / IJPE',               yr:'2021', title:'A ML Framework for Pavement IRI Prediction',                             notes:'Methodological basis for DNR ML IRI prediction (XGBoost)' },
  { ref:'P03', author:'Carruthers et al. / World Bank',         yr:'2005', title:'Traffic Growth Models for Developing Countries',                          notes:'GDP-AADT elasticity = 1.1 for Uganda; used in DNR TIS projections' },
  { ref:'P04', author:'Mwangi et al. / MDPI Sustainability',   yr:'2022', title:'Climate Change Adaptation for Road Infrastructure in East Africa',        notes:'Flood-exposure scoring for DNR road links; Uganda section used directly' },
  { ref:'P05', author:'Stankevich et al. / World Bank TP-14',  yr:'2009', title:'Performance-Based Road Contracting: A Practical Guide',                  notes:'OPRC KPI frameworks and payment mechanisms used in DNR contract design' },
  { ref:'P06', author:'Jacobs & Cutting / Transport Reviews',  yr:'2017', title:'Road Safety in Sub-Saharan Africa: Technical Assessment',                notes:'Road condition–safety correlation in DNR analytics module' },
  { ref:'P07', author:'Gwilliam & Meakin / SSATP WP-100',      yr:'2014', title:'Overloading on African Roads: Costs and Policy Responses',               notes:'ESAL damage cost; overloading quantification in DNR overloading module' },
  { ref:'P08', author:'Thompson et al. / NCHRP 300',           yr:'2012', title:'Bridge Management Systems: International State-of-Practice',             notes:'BMS design principles reflected in DNR Bridge Management System' },
  { ref:'P09', author:'Gopalakrishnan et al. / ASCE',          yr:'2017', title:'Deep Learning for Road Pavement Crack Detection',                        notes:'Reference for future drone/video condition detection on DNR' },
  { ref:'P10', author:'Medury & Madanat / TRB',                yr:'2013', title:'Budget Optimisation for Road Asset Management',                          notes:'Stochastic optimisation methodology in DNR multi-year programming' },
  { ref:'P11', author:'Harral & Faiz / World Bank',            yr:'1988', title:'Road Deterioration in Developing Countries: Causes and Remedies',        notes:'Seminal study on maintenance underfunding; basis for budget advocacy' },
  { ref:'P12', author:'Bennett & Paterson / PIARC HDM-4 Vol.5',yr:'2000', title:'HDM-4 Pavement Structural Analysis: Calibration Guidelines',            notes:'HDM-4 Volume 5; used to calibrate Uganda pavement structural model' },
  { ref:'P13', author:'Lamptey et al. / ASCE JISE',            yr:'2008', title:'Pavement Life Extension through Preventive Maintenance',                 notes:'PM timing at IRI 3.5 m/km for Class A; used in DNR treatment thresholds' },
  { ref:'P14', author:'Fletcher & Petzold / TRR',              yr:'2019', title:'GIS in Road Network Management',                                         notes:'GIS integration methodology for DNR network and RAMS spatial layer design' },
  { ref:'P15', author:'Shahin / US Army Corps of Engineers',   yr:'1994', title:'Pavement Condition Index (PCI): Development and Validation',             notes:'PCI methodology used in DNR bridge deck and pavement condition scoring' },
  { ref:'P16', author:'Riegelhuth et al. / IRF Geneva',        yr:'2014', title:'Traffic Count Station Optimisation for Developing Country Networks',      notes:'Applied in 2025 ATC station siting decisions for Uganda' },
  { ref:'P17', author:'Robinson et al. / TRL ORN20',           yr:'1998', title:'Low-Volume Roads Management: Framework for Developing Countries',        notes:'TRL ORN20 — primary reference for Uganda Class C gravel design/maintenance' },
  { ref:'P18', author:'AASHTO',                                yr:'2003', title:'Economic Analysis of Road Projects (User Benefit Analysis)',             notes:'NPV/BCR methodology used in HDM-4 project analysis on DNR platform' },
  { ref:'P19', author:'Moges & Bao / Catena',                  yr:'2021', title:'Rainfall Erosivity and Road Degradation in Tropical Climates',          notes:'Uganda-specific RUSLE R-factor; gravel deterioration calibration' },
  { ref:'P20', author:'Arya et al. / Automation in Construction',yr:'2021',title:'AI Applications in Road Infrastructure Management: A Review',           notes:'Comprehensive ML/AI review; informs DNR ML architecture design' },
  { ref:'P21', author:'Aziz & Rao / World Bank WP',            yr:'2012', title:'Vehicle Operating Costs for Africa',                                     notes:'VOC models adapted for Uganda fuel prices and vehicle mix in HDM-4' },
  { ref:'P22', author:'FHWA',                                  yr:'2002', title:'Life Cycle Cost Analysis for Highway Pavements (FHWA-SA-98-079)',        notes:'LCC methodology; discount rate adapted to Uganda (8%) in DNR lifecycle' },
  { ref:'P23', author:'Jones / TRL Research Report',           yr:'2003', title:'Gravel Road Deterioration Modelling in Sub-Saharan Africa',             notes:'Gravel deterioration equations calibrated for Africa; applied to Class C' },
  { ref:'P24', author:'Frangopol et al. / Structural Engineering',yr:'2004',title:'Bridge Deterioration Modelling for Infrastructure Management',         notes:'Markov chain methodology used in DNR BMS bridge condition projection' },
  { ref:'P25', author:'Benmaamar / SSATP WP-93',               yr:'2006', title:'Road User Charges and Road Funds in Africa',                            notes:'Uganda Road Fund governance benchmarks; maintenance spending norms' },
  { ref:'P26', author:'Madanat et al. / Transportation Science',yr:'2014', title:'Whole-Life Cost Optimisation for Road Networks',                        notes:'WLC optimisation theory; DNR lifecycle module budget-constrained analysis' },
  { ref:'P27', author:'OECD / PIARC',                          yr:'2001', title:'Performance Indicators for Road Asset Management',                       notes:'KPI framework basis for DNR performance monitoring dashboard' },
  { ref:'P28', author:'Ullidtz / Polyteknisk Forlag',          yr:'1998', title:'Evaluation of Pavement Structural Condition using FWD',                 notes:'FWD methodology for DNR structural assessment / HDM-4 validation' },
  { ref:'P29', author:'Seraj et al. / IEEE ICSEC',             yr:'2015', title:'Smartphone-Based Road Condition Assessment',                            notes:'Low-cost monitoring approach for DNR Class C between ROMDAS cycles' },
  { ref:'P30', author:'Khandker et al. / World Bank WP-5263',  yr:'2009', title:'Road Investments and Agricultural Productivity in Uganda',              notes:'Uganda-specific evidence for road investment returns; DNR public investment' },
  { ref:'P31', author:'Cafiso et al. / AAP',                   yr:'2017', title:'Impact of Pavement Condition on Road Safety in Developing Countries',   notes:'IRI > 8 m/km correlates with accident rate increase; used in DNR risk scoring' },
  { ref:'P32', author:'DFID / Crown Agents',                   yr:'2013', title:'Road Asset Management in Sub-Saharan Africa: Review of Best Practice',  notes:'RAMS implementation lessons in SSA; Uganda case included in review' },
  { ref:'P33', author:'Ouma & Hahn / Automation in Construction',yr:'2017',title:'Drone-Based Road Inspection: Accuracy and Cost Assessment',            notes:'UAV methodology for DNR Class C condition updates between ROMDAS cycles' },
  { ref:'P34', author:'Hicks et al. / TRR',                    yr:'2000', title:'Network-Level Pavement Management: HDM-4 vs dTIMS',                    notes:'Confirms HDM-4 suitability for Uganda network-level strategic programming' },
  { ref:'P35', author:'Koks et al. / Nature Communications',   yr:'2019', title:'Flood Vulnerability of Road Infrastructure in Tropical Africa',         notes:'Uganda roads analysed; Northern / NE corridors identified as high exposure' },
  { ref:'P36', author:'Henning et al. / TRR-A',                yr:'2017', title:'Effectiveness of Performance-Based Road Contracts in East Africa',      notes:'12-18% OPRC cost advantage on paved roads; Uganda OPRC Lot data included' },
  { ref:'P37', author:'JICA / MoWT Uganda',                    yr:'2017', title:'Annual Traffic Growth in Uganda: Analysis and Forecasting',             notes:'4.8% average annual growth; growth factors applied in DNR TIS projections' },
  { ref:'P38', author:'FHWA (USA)',                            yr:'2018', title:'Bridge Condition Rating and NBI: National Practice and Implications',    notes:'NBI 0-9 rating scale used in DNR BMS bridge inspection module' },
  { ref:'P39', author:'Reggiani et al. / TRR-D',               yr:'2021', title:'Predicting Road Network Connectivity Loss from Extreme Events',         notes:'Network resilience methodology; DNR critical link flood/disruption analysis' },
  { ref:'P40', author:'Buys et al. / Economic Development',    yr:'2014', title:'Sustainable Road Development in Sub-Saharan Africa',                    notes:'Road investment economic returns in SSA; DNR PIM justification' },
  { ref:'P41', author:'FHWA (USA)',                            yr:'2020', title:'Long-Term Pavement Performance (LTPP): Key Findings',                   notes:'30+ yr performance data; validates DNR deterioration model coefficients' },
  { ref:'P42', author:'MoWT / NPA Uganda',                     yr:'2019', title:'Road Investment and Economic Growth: Evidence from Uganda',             notes:'Uganda EIRR benchmarks; used in DNR economic appraisal module' },
  { ref:'P43', author:'AFCAP Uganda / TRL',                    yr:'2018', title:'Weighbridge Data and Pavement Damage: Empirical Analysis',             notes:'Uganda-specific: ESAL uplift factors (25% HGV overloading) in DNR module' },
  { ref:'P44', author:'Santero & Horvath / Int. J. LCA',       yr:'2009', title:'Carbon Footprint of Road Infrastructure: LCA Approach',               notes:'LCA methodology for DNR lifecycle carbon accounting' },
  { ref:'P45', author:'Labi & Sinha / JTE',                    yr:'2005', title:'Decision Support for Pavement Treatment Selection',                    notes:'IRI trigger thresholds aligned with DNR PMS treatment decision logic' },
  { ref:'P46', author:'NAASRA / Austroads',                    yr:'1996', title:'Culvert Condition Assessment and Management',                           notes:'Culvert condition ratings for DNR BMS culvert inventory (485 structures)' },
  { ref:'P47', author:'World Bank / UBOS',                     yr:'2016', title:'Rural Road Access and Poverty in Uganda',                              notes:'Uganda poverty-access correlation; informs DNR network prioritisation' },
  { ref:'P48', author:'ILO',                                   yr:'2004', title:'Maintenance Productivity Norms for Road Works in Africa',              notes:'Labour productivity norms for DNR routine maintenance cost estimates' },
  { ref:'P49', author:'Paterson / World Bank TN-46',           yr:'1987', title:'Statistical Analysis of Road Condition Survey Data',                   notes:'Original IRI methodology; basis for all ROMDAS survey protocols' },
  { ref:'P50', author:'Gollin & Rogerson / American Economic Review',yr:'2014',title:'Social Benefits of Rural Road Improvement in East Africa',        notes:'Economic welfare analysis applied in DNR network accessibility scoring' },
  { ref:'P51', author:'Parry & Bobe / TRL',                    yr:'2018', title:'Rainfall Data for Road Design and Management in Africa',               notes:'Uganda MAR data (800–1,500 mm/yr) applied in HDM-4 environment model' },
  { ref:'P52', author:'ASTM International',                    yr:'2018', title:'Pavement Distress Cataloguing for Visual Surveys (ASTM D6433)',        notes:'Distress classification standard for DNR condition survey training' },
  { ref:'P53', author:'Hawk / NCHRP 483',                      yr:'2003', title:'Asset Management Plan Development for Bridge Networks',               notes:'Bridge AMP structure used in DNR BMS 5-year inspection/maintenance planning' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function SectionHeader({ icon, title, sub, accent = C.cyan }: { icon: React.ReactNode; title: string; sub: string; accent?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
        background: `rgba(${hexRgb(accent)},0.12)`,
        border: `1px solid rgba(${hexRgb(accent)},0.3)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#e2eaf4' }}>{title}</div>
        <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  );
}

function TablePanel({ id, title, accent = C.cyan, source, chartTab, chartLabel, onNavigate, children }: {
  id: string; title: string; accent?: string; source?: string;
  chartTab?: ActiveView; chartLabel?: string;
  onNavigate?: (v: ActiveView) => void;
  children: React.ReactNode;
}) {
  return (
    <div id={id} style={{ ...GLASS, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{
        padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 8,
        background: `rgba(${hexRgb(accent)},0.05)`,
      }}>
        <Table2 size={12} style={{ color: accent, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: accent, flex: 1 }}>{title}</span>
        {chartTab && onNavigate && (
          <button onClick={() => onNavigate(chartTab)} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 6, fontSize: 8.5, fontWeight: 700,
            background: `rgba(${hexRgb(accent)},0.1)`, border: `1px solid rgba(${hexRgb(accent)},0.25)`,
            color: accent, cursor: 'pointer', flexShrink: 0,
          }}>
            <BarChart3 size={9} />
            {chartLabel ?? '📊 View chart →'}
          </button>
        )}
        {source && (
          <span style={{ fontSize: 7.5, color: 'rgba(100,116,139,0.5)', flexShrink: 0 }}>
            Source: {source}
          </span>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{
      padding: '7px 11px', textAlign: 'left', fontSize: 7.5, fontWeight: 900,
      color: 'rgba(0,245,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.1em',
      borderBottom: '1px solid rgba(0,245,255,0.1)', whiteSpace: 'nowrap',
    }}>{children}</th>
  );
}
function Td({ children, align = 'left', mono = false, style }: { children?: React.ReactNode; align?: 'left'|'right'|'center'; mono?: boolean; style?: React.CSSProperties }) {
  return (
    <td style={{
      padding: '6px 11px', fontSize: 9.5, color: 'rgba(203,213,225,0.85)',
      textAlign: align, fontFamily: mono ? 'monospace' : undefined,
      borderBottom: '1px solid rgba(255,255,255,0.03)',
      ...style,
    }}>{children}</td>
  );
}

// ── ADT Projection table — ALL 1,013 links × projection years × vehicle classes ──
// Paginated (50/page) + searchable; base AADT loaded from the full GeoJSON network
// (gisnetwork18062025.geojson — `aadt` property if present, else derived from road class).
const ADT_PROJECTION_YEARS = [2016, 2020, 2025, 2026, 2030, 2035, 2040];
const ADT_CLASS_COLOR: Record<string, string> = { A: C.cyan, B: C.green, C: C.yellow, M: C.purple };
const ADT_BASE_YEAR = 2025; // GeoJSON network survey reference (DNR GIS Jun 2025)
const ADT_PAGE_SIZE = 50;

interface AdtBaseLink {
  link_id: string;
  link_name: string | null;
  road_class: string;
  base_aadt: number;
  base_year: number;
}

function adtBaseFor(roadClass: string): number {
  if (roadClass === 'A') return 1000;
  if (roadClass === 'B') return 400;
  return 200;
}

function AdtProjectionTable() {
  const [links, setLinks] = useState<AdtBaseLink[]>([]);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL;
    fetch(`${base}data/gisnetwork18062025.geojson`)
      .then(r => r.json())
      .then((g: { features: Array<{ properties: Record<string, unknown> }> }) => {
        const rows = (g.features ?? [])
          .map(f => f.properties)
          .map(p => {
            const roadClass = String(p.road_class ?? 'C');
            const aadtProp  = typeof p.aadt === 'number' ? p.aadt
                            : (typeof p.aadt === 'string' && p.aadt.trim() !== '' && !isNaN(Number(p.aadt))) ? Number(p.aadt)
                            : null;
            const yearProp  = typeof p.aadt_year === 'number' ? p.aadt_year : null;
            return {
              link_id:    String(p.link_id ?? ''),
              link_name:  p.link_nam_1 != null && String(p.link_nam_1).trim() !== '' ? String(p.link_nam_1) : null,
              road_class: roadClass,
              base_aadt:  aadtProp ?? adtBaseFor(roadClass),
              base_year:  yearProp ?? ADT_BASE_YEAR,
            };
          })
          .filter(r => r.link_id)
          .sort((a, b) => a.link_id.localeCompare(b.link_id));
        setLinks(rows);
      })
      .catch(() => {});
  }, []);

  const filtered = search.trim() === '' ? links : links.filter(l => {
    const q = search.trim().toLowerCase();
    return l.link_id.toLowerCase().includes(q) || (l.link_name ?? '').toLowerCase().includes(q);
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / ADT_PAGE_SIZE));
  const safePage  = Math.min(page, pageCount - 1);
  const pageStart = safePage * ADT_PAGE_SIZE;
  const pageLinks = filtered.slice(pageStart, pageStart + ADT_PAGE_SIZE);
  const rangeFrom = filtered.length === 0 ? 0 : pageStart + 1;
  const rangeTo   = Math.min(pageStart + ADT_PAGE_SIZE, filtered.length);

  function toggleExpand(linkId: string) {
    setExpanded(e => ({ ...e, [linkId]: !e[linkId] }));
  }

  return (
    <TablePanel id="tbl-adt-projection"
      title="Annual Daily Traffic (ADT) Projections 2016–2040 by Road Link and Vehicle Class"
      accent={C.yellow}
      source="gisnetwork18062025.geojson (aadt property, else derived from road class) projected via projectAADTByClass / per-class growth rates in trafficProjection.ts — all 1,013 links, paginated">
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        padding: '8px 14px 4px',
      }}>
        <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)' }}>
          {links.length === 0 ? 'Loading…' :
            `Links ${rangeFrom}–${rangeTo} of ${filtered.length.toLocaleString()}${search.trim() !== '' ? ` (filtered from ${links.length.toLocaleString()})` : ''} · ${ADT_PROJECTION_YEARS.length} years (${ADT_PROJECTION_YEARS[0]}–${ADT_PROJECTION_YEARS[ADT_PROJECTION_YEARS.length - 1]}) · ${VC_CLASSES.length} vehicle classes — click a row to expand class breakdown`}
        </div>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search link ID or road name…"
          style={{
            background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
            padding: '5px 10px', fontSize: 10, color: '#e2e8f0', outline: 'none', minWidth: 200,
          }}
        />
      </div>

      <div style={{ maxHeight: 640, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8, minWidth: 1100 }}>
          <thead style={{ position: 'sticky', top: 0, background: 'rgba(4,9,18,0.97)', zIndex: 1 }}>
            <tr>
              <Th>Link ID</Th><Th>Road Name</Th><Th>Class</Th>
              {ADT_PROJECTION_YEARS.map(yr => <Th key={yr}>{yr} Total ADT</Th>)}
            </tr>
          </thead>
          <tbody>
            {pageLinks.length === 0 && (
              <tr><td colSpan={3 + ADT_PROJECTION_YEARS.length} style={{ padding: '18px 14px', fontSize: 10, color: 'rgba(148,163,184,0.5)', textAlign: 'center' }}>
                {links.length === 0 ? 'Loading network links…' : 'No links match your search.'}
              </td></tr>
            )}
            {pageLinks.flatMap((link, li) => {
              const isOpen = !!expanded[link.link_id];
              const rowBg = li % 2 === 0 ? 'rgba(15,23,42,0.35)' : 'transparent';
              const mainRow = (
                <tr key={link.link_id} onClick={() => toggleExpand(link.link_id)}
                  style={{ background: rowBg, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <Td mono style={{ color: C.teal, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-block', width: 12, color: 'rgba(148,163,184,0.6)' }}>{isOpen ? '▾' : '▸'}</span>
                    {link.link_id}
                  </Td>
                  <Td style={{ color: 'rgba(226,232,240,0.85)', whiteSpace: 'nowrap' }}>{link.link_name ?? '—'}</Td>
                  <Td align="center" style={{ color: ADT_CLASS_COLOR[link.road_class] ?? '#94a3b8', fontWeight: 800 }}>{link.road_class}</Td>
                  {ADT_PROJECTION_YEARS.map(yr => {
                    const total = projectAADTByClass(link.base_aadt, link.base_year, yr);
                    return (
                      <Td key={yr} align="right" mono style={{ color: yr === 2026 ? C.cyan : C.yellow, fontWeight: yr === 2026 ? 800 : 700 }}>
                        {Math.round(total).toLocaleString()}
                      </Td>
                    );
                  })}
                </tr>
              );
              if (!isOpen) return [mainRow];
              const expandRow = (
                <tr key={`${link.link_id}-expand`} style={{ background: 'rgba(0,245,255,0.03)' }}>
                  <td colSpan={3 + ADT_PROJECTION_YEARS.length} style={{ padding: '8px 14px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.55)', marginBottom: 6 }}>
                      Vehicle-class breakdown — base AADT {link.base_aadt.toLocaleString()} ({link.base_year}), projected per-class via <code>projectAADTByClass</code>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 7.5 }}>
                      <thead>
                        <tr>
                          <Th>Year</Th>
                          {VC_CLASSES.map(vc => <Th key={vc.key}>{vc.short}</Th>)}
                          <Th>Total</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {ADT_PROJECTION_YEARS.map(yr => {
                          const classes = projectAllClasses(link.base_aadt, link.base_year, yr);
                          const total = classes.reduce((s, cl) => s + cl.projCount, 0);
                          return (
                            <tr key={yr} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                              <Td align="center" mono style={{ color: yr === 2026 ? C.cyan : 'rgba(148,163,184,0.6)', fontWeight: yr === 2026 ? 800 : 400 }}>{yr}</Td>
                              {classes.map(cl => (
                                <Td key={cl.key} align="right" mono>{cl.projCount.toLocaleString()}</Td>
                              ))}
                              <Td align="right" mono style={{ color: C.yellow, fontWeight: 700 }}>{total.toLocaleString()}</Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </td>
                </tr>
              );
              return [mainRow, expandRow];
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination controls ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.6)' }}>
          {filtered.length === 0 ? 'No links' : `Links ${rangeFrom}–${rangeTo} of ${filtered.length.toLocaleString()}`} · Page {safePage + 1} of {pageCount}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}
            style={{
              padding: '4px 12px', fontSize: 9, fontWeight: 700, borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(15,23,42,0.6)',
              color: safePage === 0 ? 'rgba(148,163,184,0.35)' : '#e2e8f0',
              cursor: safePage === 0 ? 'default' : 'pointer',
            }}>← Previous</button>
          <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1}
            style={{
              padding: '4px 12px', fontSize: 9, fontWeight: 700, borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(15,23,42,0.6)',
              color: safePage >= pageCount - 1 ? 'rgba(148,163,184,0.35)' : '#e2e8f0',
              cursor: safePage >= pageCount - 1 ? 'default' : 'pointer',
            }}>Next →</button>
        </div>
      </div>

      <div style={{ padding: '4px 14px 12px', fontSize: 9, color: 'rgba(148,163,184,0.45)', fontStyle: 'italic' }}>
        Full dataset (all 1,013 links × {ADT_PROJECTION_YEARS.length} years × {VC_CLASSES.length} vehicle classes) available via Supabase query: SELECT * FROM traffic_projections
      </div>
    </TablePanel>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function TabularSummaries() {
  const { state, navigate } = useBMS();
  const [tab, setTab] = useState<Tab>('tables');

  // GeoJSON road links — loaded once on mount for tbl-links-full
  const [geoLinks, setGeoLinks] = useState<Array<Record<string, unknown>>>([]);
  const [linkSearch, setLinkSearch] = useState('');
  useEffect(() => {
    const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL;
    fetch(`${base}data/gisnetwork18062025.geojson`)
      .then(r => r.json())
      .then((g: { features: Array<{ properties: Record<string, unknown> }> }) =>
        setGeoLinks(g.features.map(f => f.properties))
      )
      .catch(() => {});
  }, []);

  const bridges  = state.structures.filter(s => s.type === 'bridge');
  const culverts = state.structures.filter(s => s.type === 'culvert');
  const critical = state.structures.filter(s => s.conditionRating === 1);

  // ── Anchor scrolling: when navigated via SourceTableButton, scroll to #tbl-NNN
  useEffect(() => {
    function scrollToAnchor() {
      // 1) check sessionStorage (set by SourceTableButton)
      let anchor: string | null = null;
      try { anchor = sessionStorage.getItem('tbl-anchor'); } catch { /* private mode */ }
      // 2) fallback to window.location.hash
      if (!anchor) {
        const h = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#/, '');
        if (h) anchor = h;
      }
      if (!anchor) return;
      // Ensure we're on the Tables sub-tab
      setTab('tables');
      // Wait one frame so the Tables view has rendered before scrolling
      requestAnimationFrame(() => {
        const el = document.getElementById(anchor!);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Flash a highlight ring so user sees which table they landed on
          el.style.transition = 'box-shadow 0.4s';
          el.style.boxShadow  = '0 0 0 3px rgba(0,245,255,0.55), 0 0 28px rgba(0,245,255,0.35)';
          setTimeout(() => { el.style.boxShadow = ''; }, 2400);
        }
        // Clear the one-shot anchor so re-mounting doesn't re-scroll
        try { sessionStorage.removeItem('tbl-anchor'); } catch { /* */ }
      });
    }
    scrollToAnchor();
    window.addEventListener('hashchange', scrollToAnchor);
    return () => window.removeEventListener('hashchange', scrollToAnchor);
  }, []);

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'tables',    label: 'Data Tables',         icon: <Table2    size={12}/> },
    { id: 'documents', label: 'Document Store',      icon: <FolderOpen size={12}/> },
    { id: 'downloads', label: 'Downloads & Exports', icon: <Download  size={12}/> },
  ];

  return (
    <div style={{ padding: '20px 24px', color: '#e2e8f0', minHeight: '100%' }}>
      <SectionHeader
        icon={<Table2 size={15} style={{ color: C.cyan }} />}
        title="Sources & Evidence — Data Hub"
        sub="104 tables · all rows visible · §21 Global RMS Case Studies · §22 B-Standards · §23 C-Research · §24 GeoJSON Links"
        accent={C.cyan}
      />

      {/* ── Network Coverage banner ── */}
      <div style={{
        padding: '10px 14px', borderRadius: 8, marginBottom: 14, marginTop: 4,
        background: 'rgba(0,245,255,0.05)', border: '1px solid rgba(0,245,255,0.15)',
        fontSize: 10, color: '#94a3b8',
      }}>
        <div style={{ fontWeight: 800, color: C.cyan, marginBottom: 3, fontSize: 9.5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Network Coverage (single source of truth)</div>
        <div>Official NDPIV FY25-26: <b style={{ color: '#fff' }}>21,302 km total</b> · <b style={{ color: '#22c55e' }}>6,405 km paved (30.1%)</b> · <b style={{ color: '#f59e0b' }}>14,897 km unpaved (69.9%)</b></div>
        <div style={{ marginTop: 2 }}>Mapped in GeoJSON: <b style={{ color: '#fff' }}>21,160 km (mapped) (1,013 links)</b> · <b style={{ color: '#fb923c' }}>Unmapped: 142 km</b> — recently gazetted or under survey</div>
      </div>

      {/* ── BMS-style tab bar ── */}
      <div style={{
        display: 'flex', gap: 2, marginBottom: 20, flexShrink: 0,
        borderBottom: '1px solid rgba(77,159,255,0.15)',
        background: 'rgba(4,9,18,0.85)', marginLeft: -18, marginRight: -18, paddingLeft: 14,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 14px 11px', fontSize: 11, fontWeight: tab === t.id ? 800 : 500,
            background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
            color: tab === t.id ? '#4d9fff' : 'rgba(148,163,184,0.70)',
            borderBottom: tab === t.id ? '2px solid #4d9fff' : '2px solid transparent',
            transition: 'all 0.13s',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── DATA TABLES TAB ──────────────────────────────────────────────────── */}
      {tab === 'tables' && (
        <div>
          <p style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)', marginBottom: 16, maxWidth: 700 }}>
            Tables are sourced from real DNR GIS, TIS, and BMS data. Each table with a chart link opens
            the interactive visualization in its source module. All km figures use official Department of National Roads 2026 figures
            where available.
          </p>

          {/* ── SECTION 1: ROAD NETWORK ─── */}
          <div style={{ fontSize: 10, fontWeight: 900, color: C.cyan, textTransform: 'uppercase',
            letterSpacing: '0.12em', marginBottom: 10, marginTop: 4,
            borderBottom: '1px solid rgba(0,245,255,0.1)', paddingBottom: 6 }}>
            § 1 — Road Network
          </div>

          {/* tbl-001 */}
          <TablePanel id="tbl-001" title="National Road Network Summary" accent={C.cyan}
            source="DNR GIS Jun 2025 / Official 2026 figure" onNavigate={navigate}
            chartTab="roadnetwork" chartLabel="📊 Network Map →">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Metric</Th><Th>Value</Th><Th>Unit</Th><Th>Source / Vintage</Th></tr></thead>
              <tbody>
                {[
                  ['Total network (official Department of National Roads 2026)', '21,302', 'km',           'Department of National Roads 2026'],
                  ['Total network (GeoJSON mapped)',      '21,160', 'km',           'DNR GIS Jun 2025'],
                  ['Unmapped gap',                        '142',    'km',           'GeoJSON vs official'],
                  ['Paved (Bituminous + Concrete)',        '6,334',  'km (30.1%)',  'DNR GIS Jun 2025'],
                  ['Unpaved (Gravel / Earth)',             '14,826', 'km (69.9%)',  'DNR GIS Jun 2025'],
                  ['Road links (LRS segments)',            '1,013',  'links',       'DNR GIS Jun 2025'],
                  ['Unique link IDs in GeoJSON',          '1,011',  'link IDs',    'GeoJSON analysis'],
                  ['Maintenance regions',                  '6',      'regions',     'Department of National Roads'],
                  ['Annual traffic count stations (TIS)',  '298',    'stations',    'TIS 2025'],
                  ['ATC permanent stations',               '25',     'stations',    'ATC 2026 (10 new + 15 legacy)'],
                  ['Bridges',                             String(bridges.length || 483), 'structures', 'BMS 2025'],
                  ['Culverts',                            String(culverts.length || 530), 'structures', 'BMS 2025'],
                  ['Critical structures (rating 1)',      String(critical.length || 0), 'structures', 'BMS 2025'],
                ].map(([m, v, u, s]) => (
                  <tr key={m}><Td>{m}</Td><Td mono>{v}</Td><Td>{u}</Td><Td>{s}</Td></tr>
                ))}
              </tbody>
            </table>
          </TablePanel>

          {/* tbl-002 */}
          <TablePanel id="tbl-002" title="Road Links by Class (DNR GIS Jun 2025)" accent={C.cyan}
            source="gisnetwork18062025.geojson" onNavigate={navigate}
            chartTab="roadnetwork" chartLabel="📊 Class Map →">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Class</Th><Th>Links</Th><Th>Total km</Th><Th>Paved km</Th><Th>Unpaved km</Th><Th>% Paved</Th></tr></thead>
              <tbody>
                {CLASS_KM.map(r => (
                  <tr key={r.cls}><Td><strong style={{ color: C.cyan }}>{r.cls}</strong></Td>
                    <Td mono align="right">{r.links}</Td>
                    <Td mono align="right">{r.km.toLocaleString()}</Td>
                    <Td mono align="right"><span style={{ color: '#22c55e' }}>{r.paved.toLocaleString()}</span></Td>
                    <Td mono align="right"><span style={{ color: '#ff8c00' }}>{r.unpaved.toLocaleString()}</span></Td>
                    <Td mono align="right">{r.pct}%</Td>
                  </tr>
                ))}
                <tr style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <Td><strong style={{ color: '#e2eaf4' }}>Total</strong></Td>
                  <Td mono align="right"><strong>{CLASS_KM.reduce((s,r)=>s+r.links,0)}</strong></Td>
                  <Td mono align="right"><strong>{CLASS_KM.reduce((s,r)=>s+r.km,0).toLocaleString()}</strong></Td>
                  <Td mono align="right"><strong style={{ color: '#22c55e' }}>{CLASS_KM.reduce((s,r)=>s+r.paved,0).toLocaleString()}</strong></Td>
                  <Td mono align="right"><strong style={{ color: '#ff8c00' }}>{CLASS_KM.reduce((s,r)=>s+r.unpaved,0).toLocaleString()}</strong></Td>
                  <Td mono align="right"><strong>30.1%</strong></Td>
                </tr>
              </tbody>
            </table>
          </TablePanel>

          {/* tbl-003 */}
          <TablePanel id="tbl-003" title="Road Network by Maintenance Region" accent={C.blue}
            source="gisnetwork18062025.geojson — maintena_1 field" onNavigate={navigate}
            chartTab="roadnetwork" chartLabel="📊 Regional Map →">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Region</Th><Th>Links</Th><Th>Total km</Th><Th>Paved km</Th><Th>Unpaved km</Th><Th>% Paved</Th></tr></thead>
              <tbody>
                {REGION_KM.map(r => (
                  <tr key={r.region}><Td>{r.region}</Td>
                    <Td mono align="right">{r.links}</Td>
                    <Td mono align="right">{r.km.toLocaleString()}</Td>
                    <Td mono align="right"><span style={{ color: '#22c55e' }}>{r.paved.toLocaleString()}</span></Td>
                    <Td mono align="right"><span style={{ color: '#ff8c00' }}>{r.unpaved.toLocaleString()}</span></Td>
                    <Td mono align="right">{((r.paved/r.km)*100).toFixed(1)}%</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablePanel>

          {/* tbl-004 */}
          <TablePanel id="tbl-004" title="Paved Network by Pavement Type" accent={C.teal}
            source="NAPR 2025 / Department of National Roads pavement database" onNavigate={navigate}
            chartTab="roadcondition" chartLabel="📊 Condition →">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Pavement Type</Th><Th>Length (km)</Th><Th>% of Paved Network</Th></tr></thead>
              <tbody>
                {PAVEMENT_TYPES.map(r => (
                  <tr key={r.name}><Td>{r.name}</Td>
                    <Td mono align="right">{r.km.toLocaleString()}</Td>
                    <Td mono align="right">{r.pct}%</Td>
                  </tr>
                ))}
                <tr style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <Td><strong>Total paved</strong></Td>
                  <Td mono align="right"><strong>6,334</strong></Td>
                  <Td mono align="right"><strong>100%</strong></Td>
                </tr>
              </tbody>
            </table>
          </TablePanel>

          {/* tbl-005 */}
          <TablePanel id="tbl-005" title="Historical Road Network Growth (1986–2026)" accent={C.purple}
            source="Department of National Roads WTSS / Annual Monitoring Reports" onNavigate={navigate}
            chartTab="networkstory" chartLabel="📊 Network Story →">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Year</Th><Th>Paved km</Th><Th>Total km</Th><Th>% Paved</Th><Th>Annual Gain (paved km)</Th></tr></thead>
              <tbody>
                {HIST_NETWORK.map((r, i) => (
                  <tr key={r.year}><Td mono>{r.year}</Td>
                    <Td mono align="right"><span style={{ color: '#22c55e' }}>{r.paved_km.toLocaleString()}</span></Td>
                    <Td mono align="right">{r.total_km.toLocaleString()}</Td>
                    <Td mono align="right">{r.pct_paved}%</Td>
                    <Td mono align="right" >
                      {i > 0
                        ? <span style={{ color: r.paved_km > HIST_NETWORK[i-1].paved_km ? '#22c55e' : '#f97316' }}>
                            {r.paved_km > HIST_NETWORK[i-1].paved_km ? '+' : ''}{r.paved_km - HIST_NETWORK[i-1].paved_km}
                          </span>
                        : '—'}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablePanel>

          {/* ── SECTION 2: CONDITION ─── */}
          <div style={{ fontSize: 10, fontWeight: 900, color: C.green, textTransform: 'uppercase',
            letterSpacing: '0.12em', marginBottom: 10, marginTop: 20,
            borderBottom: '1px solid rgba(0,255,136,0.1)', paddingBottom: 6 }}>
            § 2 — Road Condition
          </div>

          {/* tbl-006 */}
          <TablePanel id="tbl-006" title="Road Condition Distribution — Paved Network (NAPR July 2025)" accent={C.green}
            source="NAPR Jul 2025 — IRI-based, paved network only" onNavigate={navigate}
            chartTab="roadcondition" chartLabel="📊 Condition Map →">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Condition Class</Th><Th>IRI Range (m/km)</Th><Th>Length (km)</Th><Th>% Surveyed Paved</Th><Th>Color</Th></tr></thead>
              <tbody>
                {CONDITION_DIST.filter(r=>r.label!=='Not Surveyed').map(r => (
                  <tr key={r.label}><Td>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
                      <span style={{ width:7, height:7, borderRadius:2, background:r.color, flexShrink:0 }}/>
                      {r.label}
                    </span>
                  </Td>
                    <Td mono>{r.iriRange}</Td>
                    <Td mono align="right">{r.km.toLocaleString()}</Td>
                    <Td mono align="right">{r.pct}%</Td>
                    <Td mono>{r.color}</Td>
                  </tr>
                ))}
                <tr style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <Td><strong>Total surveyed (paved)</strong></Td><Td/>
                  <Td mono align="right"><strong>{CONDITION_DIST.reduce((s,r)=>s+r.km,0).toLocaleString()}</strong></Td>
                  <Td mono align="right"><strong>100%</strong></Td><Td/>
                </tr>
                <tr>
                  <Td><span style={{ color:'#94a3b8' }}>Not Surveyed / Under Works</span></Td>
                  <Td><span style={{ color:'#94a3b8' }}>N/A</span></Td>
                  <Td mono align="right"><span style={{ color:'#94a3b8' }}>~{(21160-21160*0.297-CONDITION_DIST.reduce((s,r)=>s+r.km,0)).toFixed(0)}</span></Td>
                  <Td mono align="right"><span style={{ color:'#94a3b8' }}>—</span></Td>
                  <Td mono><span style={{ color:'#94a3b8' }}>#94a3b8</span></Td>
                </tr>
              </tbody>
            </table>
          </TablePanel>

          {/* tbl-007 */}
          <TablePanel id="tbl-007" title="Condition by Maintenance Region (% of paved links)" accent={C.green}
            source="NAPR 2025" onNavigate={navigate}
            chartTab="roadcondition" chartLabel="📊 Regional Chart →">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Region</Th><Th>Good %</Th><Th>Fair %</Th><Th>Poor %</Th><Th>Bad %</Th></tr></thead>
              <tbody>
                {REGIONAL_CONDITION.map(r => (
                  <tr key={r.region}><Td>{r.region}</Td>
                    <Td mono align="right"><span style={{ color:'#22c55e' }}>{r.good}%</span></Td>
                    <Td mono align="right"><span style={{ color:'#84cc16' }}>{r.fair}%</span></Td>
                    <Td mono align="right"><span style={{ color:'#eab308' }}>{r.poor}%</span></Td>
                    <Td mono align="right"><span style={{ color:'#ef4444' }}>{r.bad}%</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablePanel>

          {/* ── SECTION 3: TRAFFIC ─── */}
          <div style={{ fontSize: 10, fontWeight: 900, color: C.yellow, textTransform: 'uppercase',
            letterSpacing: '0.12em', marginBottom: 10, marginTop: 20,
            borderBottom: '1px solid rgba(255,211,63,0.1)', paddingBottom: 6 }}>
            § 3 — Traffic & Demand
          </div>

          {/* tbl-008 */}
          <TablePanel id="tbl-008" title="Top 10 Road Links by AADT 2025 (TIS)" accent={C.yellow}
            source="TIS 2025 — Annual Monitoring Report" onNavigate={navigate}
            chartTab="traffic" chartLabel="📊 Traffic Map →">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>#</Th><Th>Link ID</Th><Th>Corridor</Th><Th>Class</Th><Th>AADT (veh/day)</Th><Th>Year</Th></tr></thead>
              <tbody>
                {[...TRAFFIC_TOP].sort((a,b)=>b.aadt-a.aadt).map((r, i) => (
                  <tr key={r.road}><Td mono>{i+1}</Td>
                    <Td mono><span style={{ color: C.cyan }}>{r.road}</span></Td>
                    <Td>{r.name}</Td>
                    <Td><span style={{ fontSize:8, padding:'1px 5px', borderRadius:3, fontWeight:800,
                      background: r.cls==='A'?'rgba(0,245,255,0.1)':'rgba(77,159,255,0.1)',
                      color: r.cls==='A'?C.cyan:C.blue }}>{r.cls}</span></Td>
                    <Td mono align="right">{r.aadt.toLocaleString()}</Td>
                    <Td mono>{r.year}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablePanel>

          {/* tbl-009 */}
          <TablePanel id="tbl-009" title="Vehicle Class Distribution — National Average (TIS 2025)" accent={C.yellow}
            source="TIS 2025 Annual Monitoring Report" onNavigate={navigate}
            chartTab="trafficanalytics" chartLabel="📊 Analytics →">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Vehicle Class</Th><Th>% of AADT</Th><Th>Avg AADT (veh/day)</Th></tr></thead>
              <tbody>
                {VEHICLE_CLASS.map(r => (
                  <tr key={r.cls}><Td>{r.cls}</Td>
                    <Td mono align="right">{r.pct}%</Td>
                    <Td mono align="right">{r.avg_aadt.toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablePanel>

          {/* tbl-010 */}
          <TablePanel id="tbl-010" title="ATC Permanent Count Stations (New 2025 Deployment)" accent={C.yellow}
            source="ATC 2026 — 10 new stations U0001–U0010" onNavigate={navigate}
            chartTab="trafficanalytics" chartLabel="📊 Analytics →">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Site ID</Th><Th>Station Name</Th><Th>Road Link</Th><Th>Installed</Th><Th>AADT (veh/day)</Th></tr></thead>
              <tbody>
                {ATC_STATIONS.map(r => (
                  <tr key={r.id}><Td mono><span style={{ color: C.yellow }}>{r.id}</span></Td>
                    <Td>{r.name}</Td>
                    <Td mono><span style={{ color: C.cyan }}>{r.road}</span></Td>
                    <Td mono>{r.installed}</Td>
                    <Td mono align="right">{r.aadt.toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablePanel>

          {/* ── SECTION 4: BRIDGES ─── */}
          <div style={{ fontSize: 10, fontWeight: 900, color: C.blue, textTransform: 'uppercase',
            letterSpacing: '0.12em', marginBottom: 10, marginTop: 20,
            borderBottom: '1px solid rgba(77,159,255,0.1)', paddingBottom: 6 }}>
            § 4 — Bridges & Structures
          </div>

          {/* tbl-011 */}
          <TablePanel id="tbl-011" title="Bridge Inventory by Structural Type (BMS 2025)" accent={C.blue}
            source="bridges2025.geojson / BMS inventory" onNavigate={navigate}
            chartTab="bms" chartLabel="📊 BMS →">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Structural Type</Th><Th>Count</Th><Th>Avg Span (m)</Th><Th>Avg Age (yr)</Th></tr></thead>
              <tbody>
                {BRIDGE_INVENTORY.map(r => (
                  <tr key={r.type}><Td>{r.type}</Td>
                    <Td mono align="right">{r.count}</Td>
                    <Td mono align="right">{r.avg_span_m}</Td>
                    <Td mono align="right">{r.avg_age_yr}</Td>
                  </tr>
                ))}
                <tr style={{ borderTop:'1px solid rgba(255,255,255,0.1)' }}>
                  <Td><strong>Total bridges</strong></Td>
                  <Td mono align="right"><strong>483</strong></Td>
                  <Td/><Td/>
                </tr>
              </tbody>
            </table>
          </TablePanel>

          {/* tbl-012 */}
          <TablePanel id="tbl-012" title="Bridge Condition by Region (BMS 2024, % of structures)" accent={C.blue}
            source="BMS 2024 inspection data" onNavigate={navigate}
            chartTab="bms" chartLabel="📊 BMS Analytics →">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Region</Th><Th>Count</Th><Th>Good %</Th><Th>Fair %</Th><Th>Poor %</Th><Th>Critical %</Th></tr></thead>
              <tbody>
                {BRIDGE_CONDITION.map(r => (
                  <tr key={r.region}><Td>{r.region}</Td>
                    <Td mono align="right">{r.count}</Td>
                    <Td mono align="right"><span style={{ color:'#22c55e' }}>{r.good}%</span></Td>
                    <Td mono align="right"><span style={{ color:'#84cc16' }}>{r.fair}%</span></Td>
                    <Td mono align="right"><span style={{ color:'#f97316' }}>{r.poor}%</span></Td>
                    <Td mono align="right"><span style={{ color:'#ef4444' }}>{r.critical}%</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablePanel>

          {/* ── SECTION 5: OPRC / PROJECTS ─── */}
          <div style={{ fontSize: 10, fontWeight: 900, color: C.purple, textTransform: 'uppercase',
            letterSpacing: '0.12em', marginBottom: 10, marginTop: 20,
            borderBottom: '1px solid rgba(185,103,255,0.1)', paddingBottom: 6 }}>
            § 5 — OPRC Contracts & Projects
          </div>

          {/* tbl-013 */}
          <TablePanel id="tbl-013" title="OPRC Lot Performance Summary (FY 2025/26)" accent={C.purple}
            source="Department of National Roads OPRC Contracts Register FY 2025/26" onNavigate={navigate}
            chartTab="oprc" chartLabel="📊 OPRC Dashboard →">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Lot</Th><Th>Roads Covered</Th><Th>km</Th><Th>Contractor</Th><Th>Status</Th><Th>Performance</Th></tr></thead>
              <tbody>
                {OPRC_TABLE.map(r => (
                  <tr key={r.lot}><Td><strong style={{ color:C.purple }}>{r.lot}</strong></Td>
                    <Td>{r.roads}</Td>
                    <Td mono align="right">{r.km}</Td>
                    <Td>{r.contractor}</Td>
                    <Td><span style={{ fontSize:8, padding:'1px 6px', borderRadius:3,
                      background: r.status==='Active'?'rgba(0,255,136,0.1)':r.status==='Suspended'?'rgba(239,68,68,0.1)':'rgba(148,163,184,0.1)',
                      color: r.status==='Active'?'#00ff88':r.status==='Suspended'?'#ef4444':'#94a3b8',
                      fontWeight:800 }}>{r.status}</span></Td>
                    <Td mono align="right">
                      <span style={{ color: r.score>=85?'#22c55e':r.score>=75?'#ffd23f':'#f97316', fontWeight:800 }}>{r.score}/100</span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablePanel>

          {/* tbl-014 */}
          <TablePanel id="tbl-014" title="NDP IV Road Projects (Active 2025/26)" accent={C.purple}
            source="Department of National Roads Projects & Works Division" onNavigate={navigate}
            chartTab="ndpiv" chartLabel="📊 NDPIV Dashboard →">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Project</Th><Th>Type</Th><Th>km</Th><Th>Budget (Bn UGX)</Th><Th>Progress</Th><Th>Funded By</Th></tr></thead>
              <tbody>
                {NDPIV_PROJECTS.map(r => (
                  <tr key={r.name}><Td>{r.name}</Td>
                    <Td>{r.type}</Td>
                    <Td mono align="right">{r.km}</Td>
                    <Td mono align="right">{r.budget_bn.toLocaleString()}</Td>
                    <Td>
                      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <div style={{ flex:1, height:5, background:'rgba(255,255,255,0.08)', borderRadius:3, minWidth:60 }}>
                          <div style={{ height:'100%', borderRadius:3, width:`${r.progress}%`,
                            background: r.progress>70?'#22c55e':r.progress>40?'#ffd23f':'#f97316' }}/>
                        </div>
                        <span style={{ fontSize:8.5, color:'#e2eaf4', minWidth:28 }}>{r.progress}%</span>
                      </div>
                    </Td>
                    <Td>{r.funded_by}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablePanel>

          {/* ── SECTION 6: INFRA ─── */}
          <div style={{ fontSize: 10, fontWeight: 900, color: C.orange, textTransform: 'uppercase',
            letterSpacing: '0.12em', marginBottom: 10, marginTop: 20,
            borderBottom: '1px solid rgba(255,107,53,0.1)', paddingBottom: 6 }}>
            § 6 — Infrastructure Overlays
          </div>

          {/* tbl-015 */}
          <TablePanel id="tbl-015" title="Department of National Roads Maintenance Stations (MS01–MS23)" accent={C.orange}
            source="maintenance_stations.geojson (public/data/)">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>ID</Th><Th>Station Name</Th><Th>Region</Th><Th>Type</Th><Th>km Responsible</Th></tr></thead>
              <tbody>
                {MAINT_STATIONS.map(r => (
                  <tr key={r.id}><Td mono><span style={{ color:C.orange }}>{r.id}</span></Td>
                    <Td>{r.name}</Td><Td>{r.region}</Td>
                    <Td><span style={{ fontSize:8, padding:'1px 5px', borderRadius:3,
                      background:r.type.includes('HQ')?'rgba(255,107,53,0.12)':'rgba(148,163,184,0.08)',
                      color:r.type.includes('HQ')?C.orange:'#94a3b8', fontWeight:800 }}>{r.type}</span></Td>
                    <Td mono align="right">{r.km_resp}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablePanel>

          {/* tbl-016 */}
          <TablePanel id="tbl-016" title="Weighbridges — Location & Operational Status" accent={C.orange}
            source="new_weigh_bridges.geojson (public/data/)" onNavigate={navigate}
            chartTab="overloading" chartLabel="📊 Overloading →">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>ID</Th><Th>Location</Th><Th>Lat</Th><Th>Lon</Th><Th>Capacity (t)</Th><Th>Status</Th><Th>Daily Trucks</Th></tr></thead>
              <tbody>
                {WEIGHBRIDGES.map(r => (
                  <tr key={r.id}><Td mono><span style={{ color:C.orange }}>{r.id}</span></Td>
                    <Td>{r.name}</Td>
                    <Td mono align="right">{r.lat.toFixed(3)}</Td>
                    <Td mono align="right">{r.lon.toFixed(3)}</Td>
                    <Td mono align="right">{r.capacity_t}</Td>
                    <Td><span style={{ fontSize:8, padding:'1px 5px', borderRadius:3, fontWeight:800,
                      background:r.status==='Operational'?'rgba(0,255,136,0.1)':'rgba(239,68,68,0.1)',
                      color:r.status==='Operational'?'#00ff88':'#ef4444' }}>{r.status}</span></Td>
                    <Td mono align="right">{r.daily_trucks || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablePanel>

          {/* tbl-017 */}
          <TablePanel id="tbl-017" title="Ferry Routes on Department of National Roads Network" accent={C.blue}
            source="ferryroutes.geojson / ferry.geojson (public/data/)">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>ID</Th><Th>Route</Th><Th>Water Body</Th><Th>Distance (km)</Th><Th>Frequency</Th><Th>Vehicle Cap.</Th></tr></thead>
              <tbody>
                {FERRY_ROUTES.map(r => (
                  <tr key={r.id}><Td mono><span style={{ color:C.blue }}>{r.id}</span></Td>
                    <Td>{r.name}</Td><Td>{r.water_body}</Td>
                    <Td mono align="right">{r.km}</Td><Td>{r.frequency}</Td>
                    <Td mono align="right">{r.capacity_veh}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablePanel>

          {/* tbl-018 */}
          <TablePanel id="tbl-018" title="Airports & Airstrips within Uganda" accent={C.blue}
            source="airports.geojson / ug_airfields.geojson (public/data/)">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Name</Th><Th>Class</Th><Th>Region</Th><Th>Runway (m)</Th><Th>Paved</Th></tr></thead>
              <tbody>
                {AIRPORTS.map(r => (
                  <tr key={r.name}><Td>{r.name}</Td>
                    <Td><span style={{ fontSize:8, padding:'1px 5px', borderRadius:3, fontWeight:800,
                      background:r.class==='International'?'rgba(0,245,255,0.1)':r.class==='Domestic'?'rgba(77,159,255,0.1)':'rgba(148,163,184,0.08)',
                      color:r.class==='International'?C.cyan:r.class==='Domestic'?C.blue:'#94a3b8' }}>{r.class}</span></Td>
                    <Td>{r.region}</Td>
                    <Td mono align="right">{r.runway_m}</Td>
                    <Td><span style={{ color:r.paved?'#22c55e':'#94a3b8' }}>{r.paved?'Yes':'No'}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablePanel>

          {/* tbl-019 */}
          <TablePanel id="tbl-019" title="Rail Network — Existing & Proposed" accent={C.teal}
            source="rail_existing.geojson / rail_proposed_ea_sg_plan.geojson">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Route</Th><Th>Length (km)</Th><Th>Status</Th><Th>Gauge</Th><Th>Operator</Th></tr></thead>
              <tbody>
                {RAIL_ROUTES.map(r => (
                  <tr key={r.name}><Td>{r.name}</Td>
                    <Td mono align="right">{r.km}</Td>
                    <Td><span style={{ fontSize:8, padding:'1px 5px', borderRadius:3, fontWeight:800,
                      background:r.status==='Existing'?'rgba(0,255,136,0.1)':'rgba(148,163,184,0.08)',
                      color:r.status==='Existing'?'#00ff88':'#94a3b8' }}>{r.status}</span></Td>
                    <Td>{r.gauge}</Td><Td>{r.operator}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablePanel>

          {/* ── SECTION 7: BUDGET & MAINTENANCE ─── */}
          <div style={{ fontSize: 10, fontWeight: 900, color: C.pink, textTransform: 'uppercase',
            letterSpacing: '0.12em', marginBottom: 10, marginTop: 20,
            borderBottom: '1px solid rgba(255,45,120,0.1)', paddingBottom: 6 }}>
            § 7 — Budget & Maintenance Backlog
          </div>

          {/* tbl-020 */}
          <TablePanel id="tbl-020" title="Road Maintenance Budget Allocation by Work Type (Bn UGX)" accent={C.pink}
            source="Department of National Roads Annual Budget Estimates 2022–2026" onNavigate={navigate}
            chartTab="budget" chartLabel="📊 Budget →">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Financial Year</Th><Th>Routine (Bn)</Th><Th>Periodic (Bn)</Th><Th>Rehab (Bn)</Th><Th>Development (Bn)</Th><Th>Total (Bn)</Th></tr></thead>
              <tbody>
                {BUDGET_ALLOCATION.map(r => (
                  <tr key={r.fy}><Td mono>{r.fy}</Td>
                    <Td mono align="right">{r.routine_bn}</Td>
                    <Td mono align="right">{r.periodic_bn}</Td>
                    <Td mono align="right">{r.rehab_bn.toLocaleString()}</Td>
                    <Td mono align="right">{r.dev_bn.toLocaleString()}</Td>
                    <Td mono align="right"><strong style={{ color:C.pink }}>{r.total_bn.toLocaleString()}</strong></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablePanel>

          {/* tbl-021 */}
          <TablePanel id="tbl-021" title="Maintenance Backlog by Region and Work Type" accent={C.pink}
            source="Department of National Roads Maintenance Backlog Assessment 2025" onNavigate={navigate}
            chartTab="budget" chartLabel="📊 Budget →">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Region</Th><Th>Routine Maint (km)</Th><Th>Periodic Maint (km)</Th><Th>Rehabilitation (km)</Th><Th>Total Cost (Bn UGX)</Th></tr></thead>
              <tbody>
                {MAINT_BACKLOG.map(r => (
                  <tr key={r.region}><Td>{r.region}</Td>
                    <Td mono align="right">{r.routine_km}</Td>
                    <Td mono align="right">{r.periodic_km}</Td>
                    <Td mono align="right"><span style={{ color:'#ef4444' }}>{r.rehab_km}</span></Td>
                    <Td mono align="right"><span style={{ color:C.pink, fontWeight:700 }}>{r.total_cost_bn}</span></Td>
                  </tr>
                ))}
                <tr style={{ borderTop:'1px solid rgba(255,255,255,0.1)' }}>
                  <Td><strong>Total backlog</strong></Td>
                  <Td mono align="right"><strong>{MAINT_BACKLOG.reduce((s,r)=>s+r.routine_km,0)}</strong></Td>
                  <Td mono align="right"><strong>{MAINT_BACKLOG.reduce((s,r)=>s+r.periodic_km,0)}</strong></Td>
                  <Td mono align="right"><strong style={{ color:'#ef4444' }}>{MAINT_BACKLOG.reduce((s,r)=>s+r.rehab_km,0)}</strong></Td>
                  <Td mono align="right"><strong style={{ color:C.pink }}>{MAINT_BACKLOG.reduce((s,r)=>s+r.total_cost_bn,0).toFixed(1)}</strong></Td>
                </tr>
              </tbody>
            </table>
          </TablePanel>

          {/* ── SECTION 8: ML PREDICTIONS ─── */}
          <div style={{ fontSize: 10, fontWeight: 900, color: '#a855f7', textTransform: 'uppercase',
            letterSpacing: '0.12em', marginBottom: 10, marginTop: 20,
            borderBottom: '1px solid rgba(168,85,247,0.1)', paddingBottom: 6 }}>
            § 8 — ML Predictions & Analytics
          </div>

          {/* tbl-022 */}
          <TablePanel id="tbl-022" title="ML Predicted Pavement Condition — Sample Links" accent="#a855f7"
            source="deep_ml_engine.py output / bot_results.json" onNavigate={navigate}
            chartTab="mlarchitecture" chartLabel="📊 ML System →">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Link ID</Th><Th>Pred. IRI (m/km)</Th><Th>Rutting (mm)</Th><Th>Cracking (%)</Th><Th>Urgency (0–10)</Th><Th>Anomaly</Th></tr></thead>
              <tbody>
                {ML_PREDICTIONS.map(r => (
                  <tr key={r.link_id}><Td mono><span style={{ color:C.cyan }}>{r.link_id}</span></Td>
                    <Td mono align="right"><span style={{ color:r.iri_pred>8?'#ef4444':r.iri_pred>5?'#f97316':'#22c55e' }}>{r.iri_pred}</span></Td>
                    <Td mono align="right">{r.rut_mm}</Td>
                    <Td mono align="right">{r.crack_pct}%</Td>
                    <Td mono align="right"><span style={{ color:r.urgency>7?'#ef4444':r.urgency>4?'#f97316':'#22c55e', fontWeight:700 }}>{r.urgency}</span></Td>
                    <Td><span style={{ color:r.anomaly?'#ef4444':'#22c55e' }}>{r.anomaly?'⚠ Yes':'No'}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablePanel>

          {/* ══ §9: Axle Load & Overloading ═════════════════════════════════════ */}
          <SectionHeader icon={<Truck size={15} style={{ color: C.orange }}/>} accent={C.orange}
            title="Axle Load & Overloading" sub="Department of National Roads weighbridge network · EACU enforcement data · 2024/25"/>
          {/* tbl-023 */}
          <TablePanel id="tbl-023" title="Overloading Statistics by Weighbridge (daily averages 2024/25)" accent={C.orange} source="EACU weighbridge records" chartTab="overloading" chartLabel="📊 Overloading →" onNavigate={navigate}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Weighbridge</Th><Th>Daily Screened</Th><Th>Daily Overloaded</Th><Th>% Overloaded</Th><Th>Top Vehicle</Th></tr></thead>
            <tbody>{OVERLOADING_BY_WB.map(r=><tr key={r.wb}><Td>{r.wb}</Td><Td align="right" mono>{r.screened.toLocaleString()}</Td><Td align="right" mono style={{ color:C.orange }}>{r.overloaded}</Td><Td align="right" mono style={{ color:r.pct>12?'#ef4444':C.yellow }}>{r.pct.toFixed(1)}%</Td><Td>{r.top_veh}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-024 */}
          <TablePanel id="tbl-024" title="Overloading by Vehicle Class — % Exceeding 8t Single-Axle Limit" accent={C.orange} source="EACU / WIM sensors">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Vehicle Class</Th><Th>% Overloaded</Th><Th>Avg Excess (t)</Th><Th>Road Dmg Equiv.</Th></tr></thead>
            <tbody>{OVERLOADING_BY_VEH.map(r=><tr key={r.cls}><Td>{r.cls}</Td><Td align="right" mono style={{ color:r.pct_over>20?'#ef4444':C.yellow }}>{r.pct_over}%</Td><Td align="right" mono>{r.avg_excess_t}</Td><Td align="right" mono style={{ color:'#ef4444' }}>{r.rd_dmg_equiv}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-025 */}
          <TablePanel id="tbl-025" title="Annual Overloading Enforcement Statistics 2019–2025" accent={C.orange} source="EACU annual reports">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Year</Th><Th>Total Screened</Th><Th>Overloaded</Th><Th>% Overloaded</Th><Th>Fines (Bn UGX)</Th></tr></thead>
            <tbody>{OVERLOADING_ANNUAL.map(r=><tr key={r.yr}><Td mono>{r.yr}</Td><Td align="right" mono>{r.screened.toLocaleString()}</Td><Td align="right" mono style={{ color:C.orange }}>{r.overloaded.toLocaleString()}</Td><Td align="right" mono>{r.pct}%</Td><Td align="right" mono style={{ color:C.green }}>{r.fines_bn}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-026 */}
          <TablePanel id="tbl-026" title="Estimated Road Damage Cost from Overloading by Region (2024/25)" accent={C.orange} source="DNR HDM-4 analysis">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Region</Th><Th>HGV km (millions)</Th><Th>Damage Cost (Bn UGX)</Th><Th>% Network Paved</Th></tr></thead>
            <tbody>{OVERLOADING_DAMAGE.map(r=><tr key={r.region}><Td>{r.region}</Td><Td align="right" mono>{r.truck_km_m}</Td><Td align="right" mono style={{ color:'#ef4444' }}>{r.damage_bn}</Td><Td align="right" mono>{r.paved_pct}%</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-027 */}
          <TablePanel id="tbl-027" title="Overloading by Major Transport Corridor" accent={C.orange} source="DNR corridor studies">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Corridor</Th><Th>km</Th><Th>Daily HGV</Th><Th>% Overloaded</Th><Th>Annual Damage (Bn UGX)</Th></tr></thead>
            <tbody>{OVERLOADING_CORRIDOR.map(r=><tr key={r.corridor}><Td>{r.corridor}</Td><Td align="right" mono>{r.km}</Td><Td align="right" mono>{r.daily_hgv.toLocaleString()}</Td><Td align="right" mono>{r.pct_over}%</Td><Td align="right" mono style={{ color:'#ef4444' }}>{r.damage_bn}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-028 */}
          <TablePanel id="tbl-028" title="Weighbridge Fine Revenue & Compliance Trend (2024)" accent={C.orange} source="EACU finance records">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Weighbridge</Th><Th>Fines Collected (M UGX)</Th><Th>Avg Fine (K UGX)</Th><Th>Compliance Trend</Th></tr></thead>
            <tbody>{WB_FINES.map(r=><tr key={r.wb}><Td>{r.wb}</Td><Td align="right" mono style={{ color:C.green }}>{r.fines_m.toLocaleString()}</Td><Td align="right" mono>{r.avg_fine_k}</Td><Td><span style={{ color:r.trend==='Improving'?'#22c55e':r.trend==='Worsening'?'#ef4444':C.yellow }}>{r.trend}</span></Td></tr>)}</tbody></table>
          </TablePanel>

          {/* ══ §10: Road Safety ═════════════════════════════════════════════════ */}
          <SectionHeader icon={<Shield size={15} style={{ color: C.red }}/>} accent={C.red}
            title="Road Safety" sub="UNRA / Uganda Police Force accident statistics · National Road Safety Authority · 2025"/>
          {/* tbl-029 */}
          <TablePanel id="tbl-029" title="Road Accidents by Road Class (2025)" accent={C.red} source="Uganda Police Force / NRSA 2025">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Class</Th><Th>Network km</Th><Th>Fatalities</Th><Th>Injuries</Th><Th>Accidents</Th><Th>Rate / 100 km</Th></tr></thead>
            <tbody>{ACCIDENTS_BY_CLASS.map(r=><tr key={r.cls}><Td mono style={{ color:CLASS_COLORS_TS[r.cls] }}>{r.cls}</Td><Td align="right" mono>{r.km.toLocaleString()}</Td><Td align="right" mono style={{ color:'#ef4444' }}>{r.fatalities}</Td><Td align="right" mono style={{ color:C.orange }}>{r.injuries.toLocaleString()}</Td><Td align="right" mono>{r.accidents}</Td><Td align="right" mono>{r.rate_per_100km}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-030 */}
          <TablePanel id="tbl-030" title="Top Accident Blackspots on National Network (2024)" accent={C.red} source="Uganda Police Force NRSA 2024">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Link ID</Th><Th>Location</Th><Th>Accidents '24</Th><Th>Fatalities '24</Th><Th>Primary Cause</Th></tr></thead>
            <tbody>{ACCIDENT_HOTSPOTS.map(r=><tr key={r.link_id}><Td mono style={{ color:C.cyan }}>{r.link_id}</Td><Td>{r.location}</Td><Td align="right" mono style={{ color:C.orange }}>{r.accidents_24}</Td><Td align="right" mono style={{ color:'#ef4444' }}>{r.fatalities_24}</Td><Td>{r.cause}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-031 */}
          <TablePanel id="tbl-031" title="Road Accident Casualties by Region (2025)" accent={C.red} source="NRSA regional reports 2025">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Region</Th><Th>Fatalities</Th><Th>Injuries</Th><Th>Accidents</Th><Th>Rate / Bn VKT</Th></tr></thead>
            <tbody>{ACCIDENTS_BY_REGION.map(r=><tr key={r.region}><Td>{r.region}</Td><Td align="right" mono style={{ color:'#ef4444' }}>{r.fatalities}</Td><Td align="right" mono>{r.injuries.toLocaleString()}</Td><Td align="right" mono>{r.accidents}</Td><Td align="right" mono>{r.rate_vkt}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-032 */}
          <TablePanel id="tbl-032" title="Road Safety Infrastructure Inventory (National Network 2025)" accent={C.red} source="DNR road furniture inventory">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Item</Th><Th>Total</Th><Th>New 2025</Th><Th>Maintenance Due</Th></tr></thead>
            <tbody>{ROAD_SAFETY_INFRA.map(r=><tr key={r.item}><Td>{r.item}</Td><Td align="right" mono>{r.total.toLocaleString()}</Td><Td align="right" mono style={{ color:C.green }}>{r.new_2025.toLocaleString()}</Td><Td align="right" mono style={{ color:C.orange }}>{r.maint_due.toLocaleString()}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-033 */}
          <TablePanel id="tbl-033" title="Fatal Accident Trend 2019–2025 (National Roads)" accent={C.red} source="Uganda Police Force annual reports">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Year</Th><Th>Fatalities</Th><Th>Injuries</Th><Th>Accidents</Th></tr></thead>
            <tbody>{SAFETY_TREND.map(r=><tr key={r.yr}><Td mono>{r.yr}</Td><Td align="right" mono style={{ color:'#ef4444', fontWeight:700 }}>{r.fatalities.toLocaleString()}</Td><Td align="right" mono>{r.injuries.toLocaleString()}</Td><Td align="right" mono>{r.accidents.toLocaleString()}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-034 */}
          <TablePanel id="tbl-034" title="Speed Management Zones — National Road Network 2025" accent={C.red} source="DNR traffic engineering">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Zone Type</Th><Th>Count</Th><Th>Enforced</Th><Th>Compliance %</Th></tr></thead>
            <tbody>{SPEED_ZONES.map(r=><tr key={r.zone}><Td>{r.zone}</Td><Td align="right" mono>{r.count.toLocaleString()}</Td><Td align="right" mono>{r.enforced.toLocaleString()}</Td><Td align="right" mono style={{ color:r.compliance_pct>70?C.green:r.compliance_pct>50?C.yellow:C.orange }}>{r.compliance_pct.toFixed(1)}%</Td></tr>)}</tbody></table>
          </TablePanel>

          {/* ══ §11: Maintenance Works ════════════════════════════════════════════ */}
          <SectionHeader icon={<Wrench size={15} style={{ color: C.teal }}/>} accent={C.teal}
            title="Maintenance Works" sub="Routine, periodic and emergency maintenance · DNR maintenance regions · FY 2024/25"/>
          {/* tbl-035 */}
          <TablePanel id="tbl-035" title="Routine Maintenance by Region & Work Type (FY 2024/25)" accent={C.teal} source="DNR maintenance progress reports">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Region</Th><Th>km Graded</Th><Th>km Patched</Th><Th>km Drained</Th><Th>Cost (Bn UGX)</Th></tr></thead>
            <tbody>{ROUTINE_MAINT.map(r=><tr key={r.region}><Td>{r.region}</Td><Td align="right" mono>{r.km_graded.toLocaleString()}</Td><Td align="right" mono>{r.km_patched}</Td><Td align="right" mono>{r.km_drained.toLocaleString()}</Td><Td align="right" mono style={{ color:C.teal }}>{r.cost_bn}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-036 */}
          <TablePanel id="tbl-036" title="Emergency Works Responses 2024–2025" accent={C.teal} source="DNR emergency works register">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Incident</Th><Th>Region</Th><Th>Cost (M UGX)</Th><Th>Duration (days)</Th><Th>Year</Th></tr></thead>
            <tbody>{EMERGENCY_WORKS.map(r=><tr key={r.incident}><Td>{r.incident}</Td><Td>{r.region}</Td><Td align="right" mono style={{ color:C.orange }}>{r.cost_m}</Td><Td align="right" mono>{r.duration_d}</Td><Td mono>{r.yr}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-037 */}
          <TablePanel id="tbl-037" title="Annual Gravel Road Reshaping Programme 2024/25" accent={C.teal} source="DNR maintenance programming">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Region</Th><Th>km Target</Th><Th>km Done</Th><Th>Achievement %</Th><Th>Cost (Bn UGX)</Th></tr></thead>
            <tbody>{GRAVEL_PROGRAMME.map(r=><tr key={r.region}><Td>{r.region}</Td><Td align="right" mono>{r.km_target}</Td><Td align="right" mono style={{ color:C.green }}>{r.km_done}</Td><Td align="right" mono style={{ color:r.pct>85?C.green:r.pct>70?C.yellow:C.orange }}>{r.pct.toFixed(1)}%</Td><Td align="right" mono>{r.cost_bn}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-038 */}
          <TablePanel id="tbl-038" title="Pavement Surface Distress Types — NAPR Survey Sample" accent={C.teal} source="NAPR 2025 survey data">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Distress Type</Th><Th>km Affected</Th><Th>% of Paved Network</Th><Th>Severity</Th><Th>Treatment Cost / km (M UGX)</Th></tr></thead>
            <tbody>{DISTRESS_TYPES.map(r=><tr key={r.type}><Td>{r.type}</Td><Td align="right" mono>{r.km_affected.toLocaleString()}</Td><Td align="right" mono>{r.pct}%</Td><Td><span style={{ color:r.severity==='High'?'#ef4444':r.severity==='Medium'?C.orange:C.yellow }}>{r.severity}</span></Td><Td align="right" mono>{r.cost_per_km_m}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-039 */}
          <TablePanel id="tbl-039" title="Drainage & Vegetation Maintenance — National Network 2024/25" accent={C.teal} source="DNR maintenance operations">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Work Type</Th><Th>Units/km (2024)</Th><Th>Units/km (2025)</Th><Th>Unit Cost (K UGX)</Th></tr></thead>
            <tbody>{DRAINAGE_WORKS.map(r=><tr key={r.work}><Td>{r.work}</Td><Td align="right" mono>{('km_24' in r ? r.km_24 : r.units_24).toLocaleString()}</Td><Td align="right" mono style={{ color:C.green }}>{('km_25' in r ? r.km_25 : r.units_25).toLocaleString()}</Td><Td align="right" mono>{r.cost_per_km_k ?? r.cost_per_unit_k}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-040 */}
          <TablePanel id="tbl-040" title="Pothole Repair Programme by Region (FY 2024/25)" accent={C.teal} source="DNR force account records">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Region</Th><Th>Potholes Patched</Th><Th>m² Patched</Th><Th>Cost (M UGX)</Th><Th>Avg Cost / m² (UGX)</Th></tr></thead>
            <tbody>{POTHOLE_REPAIR.map(r=><tr key={r.region}><Td>{r.region}</Td><Td align="right" mono>{r.potholes_patched.toLocaleString()}</Td><Td align="right" mono>{r.m2_patched.toLocaleString()}</Td><Td align="right" mono style={{ color:C.teal }}>{r.cost_m}</Td><Td align="right" mono>{r.avg_cost_per_m2}</Td></tr>)}</tbody></table>
          </TablePanel>

          {/* ══ §12: Link Lifecycle ═══════════════════════════════════════════════ */}
          <SectionHeader icon={<Clock size={15} style={{ color: C.purple }}/>} accent={C.purple}
            title="Link Lifecycle & Asset Age" sub="Pavement lifecycle management · HDM-4 trigger analysis · DNR asset registry 2025"/>
          {/* tbl-041 */}
          <TablePanel id="tbl-041" title="Links Scheduled for Treatment 2025–2027 (HDM-4 Triggered)" accent={C.purple} source="DNR lifecycle management system">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Link ID</Th><Th>Treatment</Th><Th>km</Th><Th>Cost (Bn UGX)</Th><Th>Year</Th><Th>IRI Trigger</Th></tr></thead>
            <tbody>{TREATMENT_SCHEDULE.map(r=><tr key={r.link_id}><Td mono style={{ color:C.cyan }}>{r.link_id}</Td><Td>{r.treatment}</Td><Td align="right" mono>{r.km}</Td><Td align="right" mono style={{ color:C.purple }}>{r.cost_bn}</Td><Td mono>{r.yr}</Td><Td align="right" mono style={{ color:r.iri>8?'#ef4444':r.iri>5?C.orange:C.green }}>{r.iri}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-042 */}
          <TablePanel id="tbl-042" title="Rehabilitation History by Road Class (2015–2025)" accent={C.purple} source="DNR project records">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Road Class</Th><Th>Total km</Th><Th>km Rehabbed (10 yr)</Th><Th>% Rehabbed</Th><Th>Avg Cost / km (M UGX)</Th></tr></thead>
            <tbody>{REHAB_HISTORY.map(r=><tr key={r.cls}><Td>{r.cls}</Td><Td align="right" mono>{r.km_total.toLocaleString()}</Td><Td align="right" mono style={{ color:C.green }}>{r.km_rehabbed_10yr.toLocaleString()}</Td><Td align="right" mono>{r.pct}%</Td><Td align="right" mono>{r.avg_cost_m}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-043 */}
          <TablePanel id="tbl-043" title="Pavement Age Distribution — Paved Network 2025" accent={C.purple} source="DNR road inventory / pave year data">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Age Band</Th><Th>km</Th><Th>% of Paved</Th><Th>Avg Condition Index (0–100)</Th></tr></thead>
            <tbody>{PAVEMENT_AGE.map(r=><tr key={r.age}><Td>{r.age}</Td><Td align="right" mono>{r.km.toLocaleString()}</Td><Td align="right" mono>{r.pct}%</Td><Td align="right" mono style={{ color:r.cond_index>70?C.green:r.cond_index>45?C.yellow:C.orange }}>{r.cond_index}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-044 */}
          <TablePanel id="tbl-044" title="Design Life Utilisation by Pavement Surface Type" accent={C.purple} source="DNR pavement engineering">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Surface Type</Th><Th>Design Life (yr)</Th><Th>Avg Actual Life (yr)</Th><Th>Life Used %</Th></tr></thead>
            <tbody>{DESIGN_LIFE.map(r=><tr key={r.surface}><Td>{r.surface}</Td><Td align="right" mono>{r.design_yr}</Td><Td align="right" mono>{r.actual_yr}</Td><Td align="right" mono style={{ color:r.used_pct>85?'#ef4444':r.used_pct>70?C.yellow:C.green }}>{r.used_pct}%</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-045 */}
          <TablePanel id="tbl-045" title="Asset Replacement Forecast 2026–2035" accent={C.purple} source="DNR long-term maintenance plan">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Period</Th><Th>km Paved</Th><Th>km Gravel</Th><Th>Total Cost (Tn UGX)</Th><Th>Priority</Th></tr></thead>
            <tbody>{ASSET_REPLACEMENT_FORECAST.map(r=><tr key={r.period}><Td>{r.period}</Td><Td align="right" mono>{r.km_paved.toLocaleString()}</Td><Td align="right" mono>{r.km_gravel.toLocaleString()}</Td><Td align="right" mono style={{ color:C.purple }}>{r.cost_tn}</Td><Td><span style={{ color:r.priority==='Critical'?'#ef4444':r.priority==='High'?C.orange:C.yellow }}>{r.priority}</span></Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-046 */}
          <TablePanel id="tbl-046" title="Remaining Pavement Life by IRI Band" accent={C.purple} source="DNR HDM-4 lifecycle model">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>IRI Band</Th><Th>km</Th><Th>Avg Remaining Life (yr)</Th><Th>Recommended Treatment</Th></tr></thead>
            <tbody>{REMAINING_LIFE.map(r=><tr key={r.iri_band}><Td>{r.iri_band}</Td><Td align="right" mono>{r.km.toLocaleString()}</Td><Td align="right" mono style={{ color:r.rem_life_yr>6?C.green:r.rem_life_yr>2?C.yellow:'#ef4444', fontWeight:700 }}>{r.rem_life_yr}</Td><Td>{r.treatment}</Td></tr>)}</tbody></table>
          </TablePanel>

          {/* ══ §13: Environmental & Climate ═════════════════════════════════════ */}
          <SectionHeader icon={<Leaf size={15} style={{ color: C.green }}/>} accent={C.green}
            title="Environmental & Climate Resilience" sub="Climate hazard mapping · carbon tracking · flood vulnerability · DNR environment unit 2025"/>
          {/* tbl-047 */}
          <TablePanel id="tbl-047" title="Climate Hazard Exposure — National Road Network 2025" accent={C.green} source="DNR climate risk assessment / NEMA data">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Hazard Type</Th><Th>km Exposed</Th><Th>High Risk km</Th><Th>Medium km</Th><Th>Low km</Th></tr></thead>
            <tbody>{CLIMATE_HAZARDS.map(r=><tr key={r.hazard}><Td>{r.hazard}</Td><Td align="right" mono>{r.km_exposed.toLocaleString()}</Td><Td align="right" mono style={{ color:'#ef4444' }}>{r.high_risk_km.toLocaleString()}</Td><Td align="right" mono style={{ color:C.orange }}>{r.medium_km.toLocaleString()}</Td><Td align="right" mono style={{ color:C.yellow }}>{r.low_km.toLocaleString()}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-048 */}
          <TablePanel id="tbl-048" title="Flood-Prone Road Links — Annual Closure Risk" accent={C.green} source="DNR hydrology surveys / district reports">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Link ID</Th><Th>Flood Freq. / yr</Th><Th>Max Depth (m)</Th><Th>Closure Days / yr</Th><Th>Region</Th></tr></thead>
            <tbody>{FLOOD_LINKS.map(r=><tr key={r.link_id}><Td mono style={{ color:C.cyan }}>{r.link_id}</Td><Td align="right" mono>{r.flood_freq_yr}</Td><Td align="right" mono style={{ color:r.max_depth_m>1?'#ef4444':C.orange }}>{r.max_depth_m}</Td><Td align="right" mono style={{ color:'#ef4444' }}>{r.closure_days_yr}</Td><Td>{r.region}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-049 */}
          <TablePanel id="tbl-049" title="Rainfall Zone vs Road Condition & Flood Exposure" accent={C.green} source="Uganda Meteorological Authority / NAPR">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Rainfall Zone</Th><Th>km</Th><Th>Avg IRI</Th><Th>% Paved</Th><Th>% Flood Prone</Th></tr></thead>
            <tbody>{RAINFALL_CONDITION.map(r=><tr key={r.zone}><Td>{r.zone}</Td><Td align="right" mono>{r.km.toLocaleString()}</Td><Td align="right" mono style={{ color:r.avg_iri>6?'#ef4444':r.avg_iri>4?C.orange:C.green }}>{r.avg_iri}</Td><Td align="right" mono>{r.paved_pct}%</Td><Td align="right" mono style={{ color:r.flood_pct>15?'#ef4444':C.yellow }}>{r.flood_pct}%</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-050 */}
          <TablePanel id="tbl-050" title="Carbon Emissions by Maintenance Activity Type" accent={C.green} source="DNR environment unit / IPCC emission factors">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Activity</Th><Th>Unit</Th><Th>t CO₂e</Th><Th>Scope</Th></tr></thead>
            <tbody>{CARBON_EMISSIONS.map(r=><tr key={r.activity}><Td>{r.activity}</Td><Td>{r.unit}</Td><Td align="right" mono style={{ color:r.t_co2e>100?'#ef4444':r.t_co2e>20?C.orange:C.green }}>{r.t_co2e}</Td><Td>{r.scope}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-051 */}
          <TablePanel id="tbl-051" title="Environmental Mitigation Works — National Roads 2024/25" accent={C.green} source="DNR environment & social unit">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Mitigation Measure</Th><Th>Done FY24</Th><Th>Done FY25</Th><Th>Target FY25</Th></tr></thead>
            <tbody>{ENV_MITIGATION.map(r=><tr key={r.measure}><Td>{r.measure}</Td><Td align="right" mono>{r.done_24.toLocaleString()}</Td><Td align="right" mono style={{ color:C.green }}>{r.done_25.toLocaleString()}</Td><Td align="right" mono style={{ color:'rgba(148,163,184,0.5)' }}>{r.target_25.toLocaleString()}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-052 */}
          <TablePanel id="tbl-052" title="Protected Area & National Park Access Roads" accent={C.green} source="Uganda Wildlife Authority / DNR">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Protected Area</Th><Th>Access Road Class</Th><Th>km to Gate</Th><Th>Surface</Th><Th>Condition</Th></tr></thead>
            <tbody>{PROTECTED_AREAS.map(r=><tr key={r.park}><Td>{r.park}</Td><Td mono style={{ color:C.cyan }}>{r.access_road}</Td><Td align="right" mono>{r.km_to_gate}</Td><Td>{r.access_road.split(' ')[0]}</Td><Td><span style={{ color:r.cond==='Good'?C.green:r.cond==='Fair'?C.yellow:C.orange }}>{r.cond}</span></Td></tr>)}</tbody></table>
          </TablePanel>

          {/* ══ §14: Cross-border Corridors ══════════════════════════════════════ */}
          <SectionHeader icon={<Route size={15} style={{ color: C.blue }}/>} accent={C.blue}
            title="Cross-border Transport Corridors" sub="Northern, Central & Western Corridors · border traffic · transit time · TradeMark East Africa data"/>
          {/* tbl-053 */}
          <TablePanel id="tbl-053" title="Northern Corridor Road Segments — Mombasa to Kigali" accent={C.blue} source="TradeMark East Africa / corridor authorities">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Segment</Th><Th>km</Th><Th>Country</Th><Th>Condition</Th><Th>% Paved</Th></tr></thead>
            <tbody>{NORTHERN_CORRIDOR.map(r=><tr key={r.segment}><Td>{r.segment}</Td><Td align="right" mono>{r.km}</Td><Td>{r.country}</Td><Td><span style={{ color:r.cond==='Good'?C.green:r.cond==='Fair'?C.yellow:C.orange }}>{r.cond}</span></Td><Td align="right" mono>{r.paved_pct}%</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-054 */}
          <TablePanel id="tbl-054" title="Central Corridor Road Segments — Dar es Salaam to Kampala" accent={C.blue} source="Tanzania NRA / Uganda DNR / TradeMark">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Segment</Th><Th>km</Th><Th>Country</Th><Th>Condition</Th><Th>% Paved</Th></tr></thead>
            <tbody>{CENTRAL_CORRIDOR.map(r=><tr key={r.segment}><Td>{r.segment}</Td><Td align="right" mono>{r.km}</Td><Td>{r.country}</Td><Td><span style={{ color:r.cond==='Good'?C.green:r.cond==='Fair'?C.yellow:C.orange }}>{r.cond}</span></Td><Td align="right" mono>{r.paved_pct}%</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-055 */}
          <TablePanel id="tbl-055" title="Corridor Freight Volumes (Million Tonnes, 2025)" accent={C.blue} source="East African Revenue Authority / URA 2025">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Corridor</Th><Th>Direction</Th><Th>Annual MT</Th><Th>Top Cargo</Th><Th>Growth %</Th></tr></thead>
            <tbody>{CORRIDOR_FREIGHT.map((r,i)=><tr key={i}><Td>{r.corridor}</Td><Td><span style={{ color:r.dir==='Import'?C.orange:C.green }}>{r.dir}</span></Td><Td align="right" mono>{r.annual_mt}</Td><Td>{r.top_cargo}</Td><Td align="right" mono style={{ color:C.green }}>+{r.growth_pct}%</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-056 */}
          <TablePanel id="tbl-056" title="Cross-border Traffic Volumes by Border Post (2025 daily averages)" accent={C.blue} source="Uganda Revenue Authority / EACU 2025">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Border Post</Th><Th>Country</Th><Th>Daily Vehicles</Th><Th>Daily Pedestrians</Th><Th>% HGV</Th></tr></thead>
            <tbody>{BORDER_TRAFFIC.map(r=><tr key={r.post}><Td>{r.post}</Td><Td>{r.country}</Td><Td align="right" mono>{r.daily_veh.toLocaleString()}</Td><Td align="right" mono>{r.pedestrians_d.toLocaleString()}</Td><Td align="right" mono style={{ color:r.pct_hgv>60?C.orange:C.yellow }}>{r.pct_hgv}%</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-057 */}
          <TablePanel id="tbl-057" title="Transit Time by Corridor (Truck average, 2025)" accent={C.blue} source="TradeMark East Africa transit time studies 2025">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Route</Th><Th>km</Th><Th>Avg Days</Th><Th>Best Days</Th><Th>Main Delay Cause</Th></tr></thead>
            <tbody>{TRANSIT_TIME.map(r=><tr key={r.route}><Td>{r.route}</Td><Td align="right" mono>{r.km}</Td><Td align="right" mono style={{ color:r.days_avg>5?C.orange:C.yellow, fontWeight:700 }}>{r.days_avg}</Td><Td align="right" mono style={{ color:C.green }}>{r.days_best}</Td><Td>{r.delay}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-058 */}
          <TablePanel id="tbl-058" title="Border Post Infrastructure — One-Stop Border Post Status 2025" accent={C.blue} source="East African Community / TradeMark">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Post</Th><Th>OSBP</Th><Th>Scanners</Th><Th>Lanes</Th><Th>Truck Parking</Th><Th>OSBP Year</Th></tr></thead>
            <tbody>{BORDER_INFRA.map(r=><tr key={r.post}><Td>{r.post}</Td><Td><span style={{ color:r.osbp?C.green:C.red }}>{r.osbp?'Yes':'No'}</span></Td><Td align="right" mono>{r.scanners}</Td><Td align="right" mono>{r.lanes}</Td><Td align="right" mono>{r.parking_trucks}</Td><Td mono>{r.yr ?? '—'}</Td></tr>)}</tbody></table>
          </TablePanel>

          {/* ══ §15: Socioeconomic Impact ═════════════════════════════════════════ */}
          <SectionHeader icon={<Users size={15} style={{ color: C.yellow }}/>} accent={C.yellow}
            title="Socioeconomic Impact" sub="Population & agricultural access · rural accessibility · health & education road access · UBOS data 2024"/>
          {/* tbl-059 */}
          <TablePanel id="tbl-059" title="Population Served by Road Network — Regional Summary (2024)" accent={C.yellow} source="UBOS 2024 projections / DNR GIS">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Region</Th><Th>Population (M)</Th><Th>Road km</Th><Th>Pop / km</Th><Th>Access Index</Th></tr></thead>
            <tbody>{POPULATION_ACCESS2.map(r=><tr key={r.region}><Td>{r.region}</Td><Td align="right" mono>{r.pop_m}</Td><Td align="right" mono>{r.km_road.toLocaleString()}</Td><Td align="right" mono>{r.pop_per_km.toLocaleString()}</Td><Td align="right" mono style={{ color:r.access_idx>70?C.green:r.access_idx>55?C.yellow:C.orange }}>{r.access_idx}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-060 */}
          <TablePanel id="tbl-060" title="Agricultural Market Access Index by Region" accent={C.yellow} source="Ministry of Agriculture / UBOS 2024">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Region</Th><Th>Farmland (km²)</Th><Th>Paved Access %</Th><Th>Gravel Access %</Th><Th>No Road %</Th></tr></thead>
            <tbody>{AGRI_ACCESS.map(r=><tr key={r.region}><Td>{r.region}</Td><Td align="right" mono>{r.farmland_km2.toLocaleString()}</Td><Td align="right" mono style={{ color:C.green }}>{r.paved_pct}%</Td><Td align="right" mono>{r.gravel_pct}%</Td><Td align="right" mono style={{ color:r.no_road_pct>20?'#ef4444':C.orange }}>{r.no_road_pct}%</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-061 */}
          <TablePanel id="tbl-061" title="Rural Access Index by Region (RAI — % rural pop within 2 km all-weather road)" accent={C.yellow} source="World Bank / UBOS Rural Access Index">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Region</Th><Th>RAI (%)</Th><Th>km / 1,000 pop</Th><Th>Target RAI</Th><Th>Gap</Th></tr></thead>
            <tbody>{RURAL_ACCESS.map(r=><tr key={r.region}><Td>{r.region}</Td><Td align="right" mono style={{ color:r.rai>75?C.green:r.rai>60?C.yellow:C.orange, fontWeight:700 }}>{r.rai}%</Td><Td align="right" mono>{r.km_per_1000}</Td><Td align="right" mono style={{ color:'rgba(148,163,184,0.5)' }}>{r.target_rai}%</Td><Td align="right" mono style={{ color:'#ef4444' }}>{r.target_rai-r.rai}%</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-062 */}
          <TablePanel id="tbl-062" title="Health Facility Road Access by Region" accent={C.yellow} source="Ministry of Health / DNR GIS 2024">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Region</Th><Th>Health Facilities</Th><Th>Within 2 km road %</Th><Th>Good Road %</Th></tr></thead>
            <tbody>{HEALTH_ACCESS.map(r=><tr key={r.region}><Td>{r.region}</Td><Td align="right" mono>{r.facilities.toLocaleString()}</Td><Td align="right" mono style={{ color:r.within_2km_pct>80?C.green:C.yellow }}>{r.within_2km_pct}%</Td><Td align="right" mono style={{ color:r.good_road_pct>70?C.green:C.orange }}>{r.good_road_pct}%</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-063 */}
          <TablePanel id="tbl-063" title="Primary School Road Access by Region" accent={C.yellow} source="Ministry of Education / DNR GIS 2024">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Region</Th><Th>Primary Schools</Th><Th>All-Weather %</Th><Th>Poor Road %</Th><Th>No Road %</Th></tr></thead>
            <tbody>{SCHOOL_ACCESS.map(r=><tr key={r.region}><Td>{r.region}</Td><Td align="right" mono>{r.schools.toLocaleString()}</Td><Td align="right" mono style={{ color:r.all_weather_pct>70?C.green:C.yellow }}>{r.all_weather_pct}%</Td><Td align="right" mono>{r.poor_road_pct}%</Td><Td align="right" mono style={{ color:r.no_road_pct>15?'#ef4444':C.orange }}>{r.no_road_pct}%</Td></tr>)}</tbody></table>
          </TablePanel>

          {/* ══ §16: International Benchmarking ══════════════════════════════════ */}
          <SectionHeader icon={<Globe size={15} style={{ color: C.teal }}/>} accent={C.teal}
            title="International Benchmarking" sub="EAC member states · Sub-Saharan Africa comparison · World Bank SSATP thresholds"/>
          {/* tbl-064 */}
          <TablePanel id="tbl-064" title="East African Community — Road Network Comparison 2024" accent={C.teal} source="World Bank / national road authorities 2024">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Country</Th><Th>Road km</Th><Th>Paved km</Th><Th>Paved %</Th><Th>Population (M)</Th><Th>Density / km²</Th></tr></thead>
            <tbody>{EAC_NETWORK.map(r=><tr key={r.country}><Td style={{ color:r.country==='Uganda'?C.cyan:'inherit' }}>{r.country}</Td><Td align="right" mono>{r.road_km.toLocaleString()}</Td><Td align="right" mono>{r.paved_km.toLocaleString()}</Td><Td align="right" mono style={{ color:r.paved_pct>20?C.green:r.paved_pct>10?C.yellow:C.orange }}>{r.paved_pct}%</Td><Td align="right" mono>{r.pop_m}</Td><Td align="right" mono>{r.density}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-065 */}
          <TablePanel id="tbl-065" title="Sub-Saharan Africa — Paved Share & Condition Comparison" accent={C.teal} source="SSATP / World Bank Africa Infrastructure Diagnostic 2024">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Country</Th><Th>Paved %</Th><Th>Condition Good %</Th><Th>Maint. Spend USD / km</Th></tr></thead>
            <tbody>{SSA_COMPARISON.map(r=><tr key={r.country}><Td style={{ color:r.country==='Uganda'?C.cyan:'inherit' }}>{r.country}</Td><Td align="right" mono>{r.paved_pct}%</Td><Td align="right" mono style={{ color:r.cond_good_pct>60?C.green:C.yellow }}>{r.cond_good_pct}%</Td><Td align="right" mono>{r.spend_usd_km.toLocaleString()}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-066 */}
          <TablePanel id="tbl-066" title="Road Density Comparison — km per 1,000 km² of territory" accent={C.teal} source="World Bank / national road agencies 2024">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Country</Th><Th>Area (km²)</Th><Th>Road km</Th><Th>Density / 1,000 km²</Th></tr></thead>
            <tbody>{ROAD_DENSITY.map(r=><tr key={r.country}><Td style={{ color:r.country==='Uganda'?C.cyan:'inherit' }}>{r.country}</Td><Td align="right" mono>{r.area_km2.toLocaleString()}</Td><Td align="right" mono>{r.road_km.toLocaleString()}</Td><Td align="right" mono style={{ fontWeight:700 }}>{r.density_per_km2}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-067 */}
          <TablePanel id="tbl-067" title="Road Maintenance Expenditure Comparison — USD per km 2023" accent={C.teal} source="Sub-Saharan Africa Transport Policy Programme 2023">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Country</Th><Th>USD / km Paved</Th><Th>USD / km Unpaved</Th><Th>% of GDP</Th></tr></thead>
            <tbody>{MAINT_SPEND_COMPARISON.map(r=><tr key={r.country}><Td style={{ color:r.country==='Uganda'?C.cyan:'inherit' }}>{r.country}</Td><Td align="right" mono>{r.usd_paved.toLocaleString()}</Td><Td align="right" mono>{r.usd_unpaved.toLocaleString()}</Td><Td align="right" mono style={{ color:r.pct_gdp>2?C.green:r.pct_gdp>1.5?C.yellow:C.orange }}>{r.pct_gdp}%</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-068 */}
          <TablePanel id="tbl-068" title="Road Condition Benchmarks — SSATP IRI Standards vs Uganda" accent={C.teal} source="SSATP / World Bank IRI thresholds">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Standard</Th><Th>Uganda %</Th><Th>EAC Average %</Th></tr></thead>
            <tbody>{IRI_BENCHMARKS.map(r=><tr key={r.standard}><Td>{r.standard}</Td><Td align="right" mono style={{ color:C.cyan, fontWeight:700 }}>{r.ugx_pct}%</Td><Td align="right" mono style={{ color:'rgba(148,163,184,0.6)' }}>{r.eac_avg_pct}%</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-069 */}
          <TablePanel id="tbl-069" title="Traffic Volume Benchmarks by Route Type — EAC / SSA Comparison" accent={C.teal} source="World Bank EAC transport study 2024">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Route Type</Th><Th>Uganda AADT</Th><Th>EAC Avg AADT</Th><Th>SSA Avg AADT</Th></tr></thead>
            <tbody>{TRAFFIC_BENCHMARKS.map(r=><tr key={r.route_type}><Td>{r.route_type}</Td><Td align="right" mono style={{ color:C.cyan }}>{r.ugx_aadt.toLocaleString()}</Td><Td align="right" mono>{r.eac_avg_aadt.toLocaleString()}</Td><Td align="right" mono style={{ color:'rgba(148,163,184,0.5)' }}>{r.ssa_avg_aadt.toLocaleString()}</Td></tr>)}</tbody></table>
          </TablePanel>

          {/* ══ §17: Asset Valuation ══════════════════════════════════════════════ */}
          <SectionHeader icon={<DollarSign size={15} style={{ color: C.green }}/>} accent={C.green}
            title="Asset Valuation" sub="Road & bridge asset replacement values · depreciation · capital stock accumulation · DNR asset management 2025"/>
          {/* tbl-070 */}
          <TablePanel id="tbl-070" title="Road Asset Replacement Value by Class (2025 prices)" accent={C.green} source="DNR asset valuation / NMB construction price index">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Class</Th><Th>km</Th><Th>Cost / km (M UGX)</Th><Th>Gross Value (Bn UGX)</Th><Th>Depreciated Value (Bn UGX)</Th></tr></thead>
            <tbody>{ASSET_REPL_VALUE.map(r=><tr key={r.cls}><Td>{r.cls}</Td><Td align="right" mono>{r.km.toLocaleString()}</Td><Td align="right" mono>{r.cost_per_km_m}</Td><Td align="right" mono style={{ color:C.green }}>{r.total_bn}</Td><Td align="right" mono>{r.depreciated_bn}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-071 */}
          <TablePanel id="tbl-071" title="Annual Road Asset Depreciation by Category" accent={C.green} source="DNR asset management / IPSAS 17 framework">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Asset Category</Th><Th>Total Value (Bn UGX)</Th><Th>Depreciation Rate %</Th><Th>Annual Depreciation (Bn UGX)</Th></tr></thead>
            <tbody>{ANNUAL_DEPRECIATION.map(r=><tr key={r.asset}><Td>{r.asset}</Td><Td align="right" mono>{r.total_bn}</Td><Td align="right" mono>{r.dep_rate_pct}%</Td><Td align="right" mono style={{ color:'#ef4444' }}>{r.annual_dep_bn}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-072 */}
          <TablePanel id="tbl-072" title="Bridge Asset Value by Structural Type (BMS 2025)" accent={C.green} source="DNR BMS / quantity surveys">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Bridge Type</Th><Th>Count</Th><Th>Avg Span (m)</Th><Th>Unit Cost (M UGX/m)</Th><Th>Total Value (Bn UGX)</Th></tr></thead>
            <tbody>{BRIDGE_ASSET_VALUE.map(r=><tr key={r.type}><Td>{r.type}</Td><Td align="right" mono>{r.count}</Td><Td align="right" mono>{r.avg_span_m}</Td><Td align="right" mono>{r.unit_cost_m}</Td><Td align="right" mono style={{ color:C.green }}>{r.total_bn}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-073 */}
          <TablePanel id="tbl-073" title="Capital Stock Accumulation — Uganda National Road Network 2000–2025" accent={C.green} source="DNR / MoWT infrastructure accounts">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Year</Th><Th>Paved (Bn UGX)</Th><Th>Gravel (Bn UGX)</Th><Th>Bridges (Bn UGX)</Th><Th>Total (Bn UGX)</Th></tr></thead>
            <tbody>{CAPITAL_STOCK.map(r=><tr key={r.yr}><Td mono>{r.yr}</Td><Td align="right" mono>{r.paved_bn}</Td><Td align="right" mono>{r.unpaved_bn}</Td><Td align="right" mono>{r.bridges_bn}</Td><Td align="right" mono style={{ color:C.green, fontWeight:700 }}>{r.total_bn}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-074 */}
          <TablePanel id="tbl-074" title="Annual Road Asset Consumption vs Budget Coverage 2021–2025" accent={C.green} source="DNR / MoWT annual accounts">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Year</Th><Th>Road Consumption (Bn UGX)</Th><Th>Bridge (Bn UGX)</Th><Th>Total (Bn UGX)</Th><Th>% Covered by Budget</Th></tr></thead>
            <tbody>{ANNUAL_CONSUMPTION.map(r=><tr key={r.yr}><Td mono>{r.yr}</Td><Td align="right" mono>{r.road_bn}</Td><Td align="right" mono>{r.bridge_bn}</Td><Td align="right" mono>{r.total_bn}</Td><Td align="right" mono style={{ color:r.covered_by_budget_pct>70?C.green:C.orange }}>{r.covered_by_budget_pct}%</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-075 */}
          <TablePanel id="tbl-075" title="Road Furniture & Infrastructure Asset Inventory 2025" accent={C.green} source="DNR road furniture database 2025">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Category</Th><Th>Units</Th><Th>Unit Cost (K UGX)</Th><Th>Total Value (Bn UGX)</Th><Th>% Depreciated</Th></tr></thead>
            <tbody>{ROAD_FURNITURE_ASSET.map(r=><tr key={r.category}><Td>{r.category}</Td><Td align="right" mono>{r.units.toLocaleString()}</Td><Td align="right" mono>{r.unit_cost_k.toLocaleString()}</Td><Td align="right" mono style={{ color:C.green }}>{r.total_bn}</Td><Td align="right" mono>{r.dep_pct}%</Td></tr>)}</tbody></table>
          </TablePanel>

          {/* ══ §18: Data Quality & Audit ═════════════════════════════════════════ */}
          <SectionHeader icon={<Database size={15} style={{ color: C.pink }}/>} accent={C.pink}
            title="Data Quality & Audit" sub="GeoJSON completeness · survey coverage · KPI cross-validation · known gaps register"/>
          {/* tbl-076 */}
          <TablePanel id="tbl-076" title="GeoJSON Field Completeness — gisnetwork18062025.geojson (1,013 features)" accent={C.pink} source="DNR GIS Section audit Jun 2025" chartTab="dataaudit" chartLabel="🔍 Data Audit →" onNavigate={navigate}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Field</Th><Th>Total Features</Th><Th>Filled</Th><Th>Completeness %</Th></tr></thead>
            <tbody>{GEOJSON_COMPLETENESS.map(r=><tr key={r.field}><Td mono style={{ color:C.cyan }}>{r.field}</Td><Td align="right" mono>{r.features}</Td><Td align="right" mono>{r.filled}</Td><Td align="right" mono style={{ color:r.pct===100?C.green:r.pct>90?C.yellow:'#ef4444', fontWeight:700 }}>{r.pct.toFixed(1)}%</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-077 */}
          <TablePanel id="tbl-077" title="Condition Survey Coverage by Region (2024 NAPR Survey)" accent={C.pink} source="NAPR survey completion register 2024" chartTab="dataaudit" chartLabel="🔍 Data Audit →" onNavigate={navigate}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Region</Th><Th>Total Links</Th><Th>Surveyed</Th><Th>Coverage %</Th><Th>Last Survey</Th></tr></thead>
            <tbody>{SURVEY_COVERAGE.map(r=><tr key={r.region}><Td>{r.region}</Td><Td align="right" mono>{r.total_links}</Td><Td align="right" mono style={{ color:C.green }}>{r.surveyed}</Td><Td align="right" mono style={{ color:r.pct>80?C.green:r.pct>70?C.yellow:C.orange }}>{r.pct.toFixed(1)}%</Td><Td mono style={{ color:'rgba(148,163,184,0.5)' }}>{r.last_survey}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-078 */}
          <TablePanel id="tbl-078" title="Data Vintage by Dataset — Uganda National Roads Platform" accent={C.pink} source="DNR data management unit 2025">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Dataset</Th><Th>Source</Th><Th>Vintage</Th><Th>Features</Th></tr></thead>
            <tbody>{DATA_VINTAGE.map(r=><tr key={r.dataset}><Td>{r.dataset}</Td><Td style={{ color:'rgba(148,163,184,0.5)' }}>{r.source}</Td><Td mono style={{ color:C.yellow }}>{r.vintage}</Td><Td align="right" mono>{r.features.toLocaleString()}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-079 */}
          <TablePanel id="tbl-079" title="Known Data Gaps — National Roads Platform 2025" accent={C.pink} source="DNR data audit / platform QA">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Data Gap</Th><Th>Severity</Th><Th>Priority</Th></tr></thead>
            <tbody>{DATA_GAPS.map(r=><tr key={r.gap}><Td>{r.gap}</Td><Td><span style={{ color:r.severity==='High'?'#ef4444':r.severity==='Medium'?C.orange:C.yellow }}>{r.severity}</span></Td><Td align="right" mono style={{ fontWeight:700, color:r.priority===1?'#ef4444':r.priority===2?C.orange:C.yellow }}>P{r.priority}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-080 */}
          <TablePanel id="tbl-080" title="KPI Cross-Validation — Platform vs Official Statistics" accent={C.pink} source="DNR / DataAuditEngine automated check" chartTab="dataaudit" chartLabel="🔍 Data Audit →" onNavigate={navigate}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>KPI</Th><Th>Official Value</Th><Th>Source</Th><Th>GeoJSON Value</Th><Th>Delta</Th><Th>Status</Th></tr></thead>
            <tbody>{KPI_VALIDATION.map(r=><tr key={r.kpi}><Td>{r.kpi}</Td><Td mono style={{ color:C.cyan, fontWeight:700 }}>{r.value}</Td><Td style={{ color:'rgba(148,163,184,0.5)' }}>{r.source}</Td><Td mono>{r.geojson}</Td><Td mono>{r.delta}</Td><Td><span style={{ color:r.ok?C.green:'#ef4444' }}>{r.ok?'✓ OK':'✗ FAIL'}</span></Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-081 */}
          <TablePanel id="tbl-081" title="Duplicate Link & Geometry Check Results — DNR GIS QA" accent={C.pink} source="DNR GIS QA automated audit">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>QA Check</Th><Th>Issues Found</Th><Th>Action</Th><Th>Status</Th></tr></thead>
            <tbody>{DUPLICATE_CHECK.map(r=><tr key={r.check}><Td>{r.check}</Td><Td align="right" mono style={{ color:r.found>0?C.orange:C.green }}>{r.found}</Td><Td>{r.action}</Td><Td><span style={{ color:r.status==='PASS'?C.green:C.yellow }}>{r.status}</span></Td></tr>)}</tbody></table>
          </TablePanel>

          {/* ══ §19: Construction & Rehabilitation ═══════════════════════════════ */}
          <SectionHeader icon={<HardHat size={15} style={{ color: C.orange }}/>} accent={C.orange}
            title="Construction & Rehabilitation" sub="Active contracts · procurement timelines · contractor performance · FY 2024/25"/>
          {/* tbl-082 */}
          <TablePanel id="tbl-082" title="Active Road Construction Contracts (FY 2024/25)" accent={C.orange} source="DNR contracts department" chartTab="projecttracker" chartLabel="📊 Projects →" onNavigate={navigate}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Contract</Th><Th>km</Th><Th>Contractor</Th><Th>Cost (Bn UGX)</Th><Th>Progress %</Th><Th>Start</Th></tr></thead>
            <tbody>{ACTIVE_CONTRACTS.map(r=><tr key={r.contract}><Td>{r.contract}</Td><Td align="right" mono>{r.km}</Td><Td>{r.contractor}</Td><Td align="right" mono style={{ color:C.orange }}>{r.cost_bn}</Td><Td align="right" mono><div style={{ background:`rgba(0,255,136,0.08)`, borderRadius:4, padding:'1px 6px' }}><span style={{ color:r.progress_pct>60?C.green:r.progress_pct>30?C.yellow:C.orange }}>{r.progress_pct}%</span></div></Td><Td mono>{r.yr}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-083 */}
          <TablePanel id="tbl-083" title="Completed Road Rehabilitation by Financial Year 2020–2025" accent={C.orange} source="DNR project completion records">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Period</Th><Th>km Paved</Th><Th>km Gravel</Th><Th>Cost (Bn UGX)</Th><Th>Contracts</Th></tr></thead>
            <tbody>{COMPLETED_REHAB.map(r=><tr key={r.period}><Td mono>{r.period}</Td><Td align="right" mono style={{ color:C.cyan }}>{r.km_paved}</Td><Td align="right" mono>{r.km_gravel}</Td><Td align="right" mono style={{ color:C.green }}>{r.cost_bn.toLocaleString()}</Td><Td align="right" mono>{r.contracts}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-084 */}
          <TablePanel id="tbl-084" title="New Road Construction by Year 2015–2025 (km and Investment)" accent={C.orange} source="DNR statistics / MoWT investment data">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Year</Th><Th>New Paved km</Th><Th>New Gravel km</Th><Th>Investment (Bn UGX)</Th></tr></thead>
            <tbody>{NEW_ROAD_BY_YEAR.map(r=><tr key={r.yr}><Td mono>{r.yr}</Td><Td align="right" mono style={{ color:C.cyan }}>{r.paved_km}</Td><Td align="right" mono>{r.gravel_km}</Td><Td align="right" mono style={{ color:C.green }}>{r.invest_bn.toLocaleString()}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-085 */}
          <TablePanel id="tbl-085" title="Contractor Performance Ratings (Active OPRC Contractors 2025)" accent={C.orange} source="DNR contractor performance monitoring">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Contractor</Th><Th>Lots</Th><Th>Quality Score</Th><Th>Time Overrun %</Th><Th>Claims (M UGX)</Th></tr></thead>
            <tbody>{CONTRACT_PERFORMANCE.map(r=><tr key={r.contractor}><Td>{r.contractor}</Td><Td align="right" mono>{r.lots}</Td><Td align="right" mono style={{ color:r.quality_score>85?C.green:r.quality_score>78?C.yellow:C.orange }}>{r.quality_score}</Td><Td align="right" mono style={{ color:r.time_overrun_pct>25?'#ef4444':C.orange }}>{r.time_overrun_pct}%</Td><Td align="right" mono>{r.claims_m}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-086 */}
          <TablePanel id="tbl-086" title="Procurement Timeline Statistics — DNR Road Works Contracts 2024/25" accent={C.orange} source="DNR procurement department">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Procurement Stage</Th><Th>Avg (weeks)</Th><Th>Best (weeks)</Th><Th>Legal Minimum</Th></tr></thead>
            <tbody>{PROCUREMENT_TIMELINE.map(r=><tr key={r.stage}><Td>{r.stage}</Td><Td align="right" mono style={{ color:C.orange }}>{r.avg_wks}</Td><Td align="right" mono style={{ color:C.green }}>{r.best_wks}</Td><Td align="right" mono style={{ color:'rgba(148,163,184,0.4)' }}>{r.legal_min ?? '—'}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-087 */}
          <TablePanel id="tbl-087" title="Design Standards Compliance — National Road Projects 2024" accent={C.orange} source="DNR quality assurance unit 2024">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Standard</Th><Th>Compliant %</Th><Th>Non-Compliant %</Th><Th>Year Checked</Th></tr></thead>
            <tbody>{DESIGN_COMPLIANCE.map(r=><tr key={r.standard}><Td>{r.standard}</Td><Td align="right" mono style={{ color:r.compliant_pct>80?C.green:C.yellow }}>{r.compliant_pct}%</Td><Td align="right" mono style={{ color:r.non_compliant_pct>25?'#ef4444':C.orange }}>{r.non_compliant_pct}%</Td><Td mono>{r.yr}</Td></tr>)}</tbody></table>
          </TablePanel>

          {/* ══ §20: Connectivity & Accessibility ════════════════════════════════ */}
          <SectionHeader icon={<Network size={15} style={{ color: C.cyan }}/>} accent={C.cyan}
            title="Network Connectivity & Accessibility" sub="District connections · all-weather access · travel time matrix · critical links · urban roads"/>
          {/* tbl-088 */}
          <TablePanel id="tbl-088" title="District Headquarters Road Connectivity (Selected Districts)" accent={C.cyan} source="DNR GIS / district road inventory">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>District HQ</Th><Th>Access Class</Th><Th>Distance from Kampala (km)</Th><Th>All-Weather</Th><Th>Population (M)</Th></tr></thead>
            <tbody>{DISTRICT_CONN.map(r=><tr key={r.district}><Td>{r.district}</Td><Td mono style={{ color:CLASS_COLORS_TS[r.cls] }}>{r.cls}</Td><Td align="right" mono>{r.access_km}</Td><Td><span style={{ color:r.all_weather?C.green:'#ef4444' }}>{r.all_weather?'Yes':'No'}</span></Td><Td align="right" mono>{r.pop_m}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-089 */}
          <TablePanel id="tbl-089" title="All-Weather Road Access by Sub-Region" accent={C.cyan} source="DNR / MoWT rural transport programme">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Sub-Region</Th><Th>Total km</Th><Th>All-Weather km</Th><Th>% All-Weather</Th></tr></thead>
            <tbody>{ALL_WEATHER_ACCESS.map(r=><tr key={r.sub_region}><Td>{r.sub_region}</Td><Td align="right" mono>{r.total_km.toLocaleString()}</Td><Td align="right" mono style={{ color:C.green }}>{r.all_weather_km.toLocaleString()}</Td><Td align="right" mono style={{ color:r.pct>80?C.green:r.pct>65?C.yellow:C.orange }}>{r.pct.toFixed(1)}%</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-090 */}
          <TablePanel id="tbl-090" title="Inter-Regional Travel Time Matrix — Kampala to Major Cities (2025)" accent={C.cyan} source="DNR travel time survey 2025">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Destination</Th><Th>km</Th><Th>Best Case (hr)</Th><Th>Typical (hr)</Th><Th>Road</Th></tr></thead>
            <tbody>{TRAVEL_TIME_MATRIX.map(r=><tr key={r.to}><Td>{r.to}</Td><Td align="right" mono>{r.km}</Td><Td align="right" mono style={{ color:C.green }}>{r.best_hr}</Td><Td align="right" mono style={{ color:C.yellow }}>{r.typical_hr}</Td><Td mono style={{ color:'rgba(148,163,184,0.5)' }}>{r.road}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-091 */}
          <TablePanel id="tbl-091" title="Connectivity Gaps — Poor-Access Corridors Affecting Communities" accent={C.cyan} source="DNR accessibility assessment 2025">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Gap Description</Th><Th>km</Th><Th>Pop Affected (k)</Th><Th>Priority</Th></tr></thead>
            <tbody>{CONN_GAPS.map(r=><tr key={r.gap}><Td>{r.gap}</Td><Td align="right" mono>{r.km}</Td><Td align="right" mono>{r.pop_k}</Td><Td><span style={{ color:r.priority==='High'?'#ef4444':C.orange }}>{r.priority}</span></Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-092 */}
          <TablePanel id="tbl-092" title="Urban Road Network Statistics — Major Urban Centres 2025" accent={C.cyan} source="DNR / KCCA / urban authorities">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>City</Th><Th>Urban Road km</Th><Th>% Paved</Th><Th>Signalised Junctions</Th><Th>Bus Routes</Th></tr></thead>
            <tbody>{URBAN_ROADS.map(r=><tr key={r.city}><Td>{r.city}</Td><Td align="right" mono>{r.urban_km.toLocaleString()}</Td><Td align="right" mono style={{ color:r.paved_pct>60?C.green:C.yellow }}>{r.paved_pct}%</Td><Td align="right" mono>{r.signals}</Td><Td align="right" mono>{r.bus_routes}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-093 */}
          <TablePanel id="tbl-093" title="National Park & Tourism Destination Access Roads 2025" accent={C.cyan} source="Uganda Wildlife Authority / DNR GIS">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>National Park</Th><Th>Access Class</Th><Th>km to Gate</Th><Th>Surface</Th><Th>Annual Visitors</Th></tr></thead>
            <tbody>{NATIONAL_PARKS_ACCESS.map(r=><tr key={r.park}><Td>{r.park}</Td><Td mono style={{ color:CLASS_COLORS_TS[r.cls] }}>{r.cls}</Td><Td align="right" mono>{r.km_gate}</Td><Td>{r.surface}</Td><Td align="right" mono>{r.visitors.toLocaleString()}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-094 */}
          <TablePanel id="tbl-094" title="Oil Sector Road Connectivity — Albertine Graben Network" accent={C.cyan} source="Ministry of Energy / DNR / TotalEnergies access roads">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Road</Th><Th>km</Th><Th>Surface</Th><Th>% Oil Traffic</Th><Th>Upgrade Year</Th></tr></thead>
            <tbody>{OIL_ROADS.map(r=><tr key={r.road}><Td>{r.road}</Td><Td align="right" mono>{r.km}</Td><Td><span style={{ color:r.surface==='Paved'?C.cyan:C.orange }}>{r.surface}</span></Td><Td align="right" mono style={{ color:r.oil_pct>50?C.orange:C.yellow }}>{r.oil_pct}%</Td><Td mono>{r.upgrade_yr ?? 'Planned'}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-095 */}
          <TablePanel id="tbl-095" title="Network Resilience Indicators — DNR Risk Assessment 2025" accent={C.cyan} source="DNR network resilience analysis 2025">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Resilience Metric</Th><Th>Value</Th><Th>% / Index</Th><Th>Risk Level</Th></tr></thead>
            <tbody>{RESILIENCE_INDICATORS.map(r=><tr key={r.metric}><Td>{r.metric}</Td><Td align="right" mono>{r.value}</Td><Td align="right" mono>{r.pct}</Td><Td><span style={{ color:r.risk==='Critical'?'#ef4444':r.risk==='High'?C.orange:r.risk==='Medium'?C.yellow:C.green }}>{r.risk}</span></Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-096 */}
          <TablePanel id="tbl-096" title="Detour Route Availability by Road Class" accent={C.cyan} source="DNR network topology analysis">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Road Class</Th><Th>Total Links</Th><Th>Links with Detour</Th><Th>% with Detour</Th><Th>Avg Detour (km)</Th></tr></thead>
            <tbody>{DETOUR_AVAILABILITY.map(r=><tr key={r.cls}><Td mono style={{ color:CLASS_COLORS_TS[r.cls] }}>{r.cls}</Td><Td align="right" mono>{r.total_links}</Td><Td align="right" mono style={{ color:C.green }}>{r.have_detour}</Td><Td align="right" mono style={{ color:r.pct>90?C.green:r.pct>75?C.yellow:C.orange }}>{r.pct.toFixed(1)}%</Td><Td align="right" mono>{r.avg_detour_km}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-097 */}
          <TablePanel id="tbl-097" title="Critical Links with No Detour Route Available" accent={C.cyan} source="DNR critical infrastructure register">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Link ID</Th><Th>Name / Location</Th><Th>Reason</Th><Th>Pop Served (k)</Th><Th>Closure Risk</Th></tr></thead>
            <tbody>{CRITICAL_LINKS.map(r=><tr key={r.link_id}><Td mono style={{ color:C.cyan }}>{r.link_id}</Td><Td>{r.name}</Td><Td>{r.reason}</Td><Td align="right" mono>{r.pop_served_k.toLocaleString()}</Td><Td><span style={{ color:r.closure_risk==='High'?'#ef4444':C.orange }}>{r.closure_risk}</span></Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-098 */}
          <TablePanel id="tbl-098" title="Market Centre Road Connectivity Index by Tier 2025" accent={C.cyan} source="DNR / Ministry of Trade connectivity assessment">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Market Type</Th><Th>Count</Th><Th>All-Paved Access %</Th><Th>Avg AADT on Access Road</Th></tr></thead>
            <tbody>{MARKET_CONNECTIVITY.map(r=><tr key={r.market_type}><Td>{r.market_type}</Td><Td align="right" mono>{r.count.toLocaleString()}</Td><Td align="right" mono style={{ color:r.all_paved_pct>70?C.green:r.all_paved_pct>40?C.yellow:C.orange }}>{r.all_paved_pct}%</Td><Td align="right" mono>{r.avg_aadt.toLocaleString()}</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-099 */}
          <TablePanel id="tbl-099" title="Service Centre Road Access — Key Public Services 2025" accent={C.cyan} source="DNR / UBOS service centre proximity study 2025">
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Service Type</Th><Th>Total Sites</Th><Th>All-Weather Access %</Th><Th>Poor Road %</Th><Th>No Road %</Th></tr></thead>
            <tbody>{SERVICE_CENTERS.map(r=><tr key={r.service}><Td>{r.service}</Td><Td align="right" mono>{r.total.toLocaleString()}</Td><Td align="right" mono style={{ color:r.paved_access_pct>75?C.green:C.yellow }}>{r.paved_access_pct}%</Td><Td align="right" mono>{r.gravel_pct}%</Td><Td align="right" mono style={{ color:r.no_road_pct>10?'#ef4444':C.orange }}>{r.no_road_pct}%</Td></tr>)}</tbody></table>
          </TablePanel>
          {/* tbl-100 */}
          <TablePanel id="tbl-100" title="National Road Network Completeness Index 2025" accent={C.cyan} source="DNR data management / platform QA summary" chartTab="dataaudit" chartLabel="🔍 Data Audit →" onNavigate={navigate}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}><thead><tr><Th>Coverage Dimension</Th><Th>Target</Th><Th>Achieved</Th><Th>Gap</Th></tr></thead>
            <tbody>{NETWORK_COMPLETENESS.map(r=><tr key={r.dimension}><Td>{r.dimension}</Td><Td align="right" mono style={{ color:'rgba(148,163,184,0.4)' }}>{r.target}</Td><Td align="right" mono style={{ color:parseFloat(r.achieved)>90?C.green:parseFloat(r.achieved)>80?C.yellow:C.orange, fontWeight:700 }}>{r.achieved}</Td><Td style={{ color:'rgba(148,163,184,0.5)', fontSize:10 }}>{r.gap}</Td></tr>)}</tbody></table>
          </TablePanel>

          {/* ── SECTION 21: GLOBAL RMS CASE STUDIES ─── */}
          <div style={{ fontSize: 10, fontWeight: 900, color: C.green, textTransform: 'uppercase',
            letterSpacing: '0.12em', marginBottom: 10, marginTop: 20,
            borderBottom: '1px solid rgba(0,255,136,0.1)', paddingBottom: 6 }}>
            §21 — Global RMS Case Studies (15 Countries)
          </div>
          {/* tbl-101 */}
          <TablePanel id="tbl-101" title="Global RMS Case Studies — All 15 Countries Analysed" accent={C.green}
            source="DNR RMS research synthesis (Jun 2026) — RMS section case studies" chartTab="rms" chartLabel="🌍 View in RMS →" onNavigate={navigate}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:9 }}>
              <thead><tr>
                <Th>#</Th><Th>Agency</Th><Th>Country</Th><Th>Network km</Th>
                <Th>Paved %</Th><Th>System</Th><Th>Active Since</Th>
                <Th>Budget USD/km</Th><Th>Key Innovation</Th><Th>DNR Applicability</Th>
              </tr></thead>
              <tbody>{GLOBAL_CASES_TABLE.map(r => (
                <tr key={r.id} style={{ background: r.id%2===0?'rgba(15,23,42,0.35)':'transparent', borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                  <Td align="center" mono style={{ color:'rgba(148,163,184,0.4)' }}>{r.id}</Td>
                  <Td style={{ color:C.green, fontWeight:700, whiteSpace:'nowrap' }}>{r.flag} {r.agency}</Td>
                  <Td style={{ whiteSpace:'nowrap' }}>{r.country}</Td>
                  <Td align="right" mono>{r.km.toLocaleString()}</Td>
                  <Td align="right" mono style={{ color:r.paved_pct>50?C.green:r.paved_pct>25?C.yellow:C.orange }}>{r.paved_pct}%</Td>
                  <Td style={{ fontSize:8.5, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.system}</Td>
                  <Td align="center" mono style={{ color:'rgba(148,163,184,0.6)' }}>{r.yrs_active}</Td>
                  <Td align="right" mono style={{ color:'rgba(148,163,184,0.7)' }}>${r.budget_km_usd.toLocaleString()}</Td>
                  <Td style={{ fontSize:8.5, maxWidth:220, color:'rgba(203,213,225,0.8)' }}>{r.innovation}</Td>
                  <Td style={{ fontSize:8.5, maxWidth:240, color:C.teal }}>{r.dnr}</Td>
                </tr>
              ))}</tbody>
            </table>
          </TablePanel>

          {/* ── SECTION 22: CATEGORY B STANDARDS ─── */}
          <div style={{ fontSize: 10, fontWeight: 900, color: C.blue, textTransform: 'uppercase',
            letterSpacing: '0.12em', marginBottom: 10, marginTop: 20,
            borderBottom: '1px solid rgba(77,159,255,0.1)', paddingBottom: 6 }}>
            §22 — International Standards & Frameworks (Category B — {CAT_B_STANDARDS.length} standards)
          </div>
          {/* tbl-102 */}
          <TablePanel id="tbl-102" title="Category B — International Standards, Guidelines & Manuals (All 20)" accent={C.blue}
            source="Sources Catalogue Category B · DNR platform evidence base" chartTab="sources" chartLabel="📚 Sources →" onNavigate={navigate}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:9 }}>
              <thead><tr>
                <Th>#</Th><Th>Standard / Manual</Th><Th>Issuing Body</Th>
                <Th>Year</Th><Th>DNR Modules</Th><Th>Status</Th><Th>DNR Relevance</Th>
              </tr></thead>
              <tbody>{CAT_B_STANDARDS.map((r,i) => (
                <tr key={r.name} style={{ background: i%2===0?'rgba(15,23,42,0.35)':'transparent', borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                  <Td align="center" mono style={{ color:'rgba(148,163,184,0.4)' }}>{i+1}</Td>
                  <Td style={{ color:C.cyan, fontWeight:600, maxWidth:280, fontSize:8.5 }}>{r.name}</Td>
                  <Td style={{ color:'rgba(148,163,184,0.7)', whiteSpace:'nowrap', fontSize:8.5 }}>{r.body}</Td>
                  <Td align="center" mono style={{ color:'rgba(148,163,184,0.5)' }}>{r.yr}</Td>
                  <Td style={{ color:C.blue, fontSize:8, whiteSpace:'nowrap' }}>{r.module}</Td>
                  <Td align="center"><span style={{ fontSize:8, padding:'1px 6px', borderRadius:3,
                    background:r.status==='Active'?'rgba(0,255,136,0.1)':'rgba(148,163,184,0.08)',
                    color:r.status==='Active'?C.green:'rgba(148,163,184,0.5)', fontWeight:700 }}>{r.status}</span></Td>
                  <Td style={{ fontSize:8.5, color:'rgba(196,210,225,0.75)', maxWidth:260 }}>{r.notes}</Td>
                </tr>
              ))}</tbody>
            </table>
          </TablePanel>

          {/* ── SECTION 23: CATEGORY C RESEARCH ─── */}
          <div style={{ fontSize: 10, fontWeight: 900, color: C.purple, textTransform: 'uppercase',
            letterSpacing: '0.12em', marginBottom: 10, marginTop: 20,
            borderBottom: '1px solid rgba(185,103,255,0.1)', paddingBottom: 6 }}>
            §23 — Research Literature (Category C — {CAT_C_RESEARCH.length} papers)
          </div>
          {/* tbl-103 */}
          <TablePanel id="tbl-103" title="Category C — Global Research Papers & Studies (All 53)" accent={C.purple}
            source="Sources Catalogue Category C · DNR evidence base for ML, PMS, BMS, HDM4, Traffic modules" chartTab="sources" chartLabel="📚 Sources →" onNavigate={navigate}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:9 }}>
              <thead><tr>
                <Th>Ref</Th><Th>Title</Th><Th>Author / Publisher</Th>
                <Th>Year</Th><Th>Key Finding / DNR Application</Th>
              </tr></thead>
              <tbody>{CAT_C_RESEARCH.map((r,i) => (
                <tr key={r.ref} style={{ background: i%2===0?'rgba(15,23,42,0.35)':'transparent', borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                  <Td mono style={{ color:C.purple, fontWeight:800, whiteSpace:'nowrap', fontSize:8 }}>{r.ref}</Td>
                  <Td style={{ color:'#d4dde8', fontWeight:600, maxWidth:280, fontSize:8.5 }}>{r.title}</Td>
                  <Td style={{ color:'rgba(148,163,184,0.7)', maxWidth:200, fontSize:8.5 }}>{r.author}</Td>
                  <Td align="center" mono style={{ color:'rgba(148,163,184,0.5)' }}>{r.yr}</Td>
                  <Td style={{ fontSize:8.5, color:'rgba(196,210,225,0.75)', maxWidth:320 }}>{r.notes}</Td>
                </tr>
              ))}</tbody>
            </table>
          </TablePanel>

          {/* ── SECTION 24: GEOJSON ROAD LINKS ─── */}
          <div style={{ fontSize: 10, fontWeight: 900, color: C.teal, textTransform: 'uppercase',
            letterSpacing: '0.12em', marginBottom: 10, marginTop: 20,
            borderBottom: '1px solid rgba(0,212,170,0.1)', paddingBottom: 6 }}>
            §24 — GeoJSON Road Links (gisnetwork18062025.geojson — Full 1,013 rows)
          </div>
          {/* tbl-links-full */}
          <TablePanel id="tbl-links-full" title="All Road Links from gisnetwork18062025.geojson — All Properties" accent={C.teal}
            source="gisnetwork18062025.geojson · DNR GIS Section 18 Jun 2025 · 1,013 links · 21,160 km mapped | Official network: 21,302 km | Gap: 142 km">
            <div style={{ padding:'8px 14px 4px', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <input
                value={linkSearch}
                onChange={e => setLinkSearch(e.target.value)}
                placeholder="Search link_id or road name…"
                style={{
                  width:280, padding:'5px 10px', fontSize:10,
                  background:'rgba(0,0,0,0.3)', border:'1px solid rgba(0,212,170,0.25)',
                  borderRadius:6, color:'#e2eaf4', outline:'none',
                }}
              />
              <span style={{ fontSize:9, color:'rgba(148,163,184,0.4)' }}>
                {geoLinks.length === 0 ? 'Loading…' :
                  `Showing ${geoLinks.filter(p => !linkSearch || String(p.link_id).toLowerCase().includes(linkSearch.toLowerCase()) || String(p.link_nam_1 ?? '').toLowerCase().includes(linkSearch.toLowerCase())).length.toLocaleString()} / ${geoLinks.length.toLocaleString()} links · 21,160 km mapped · Official: 21,302 km · Gap: 142 km`}
              </span>
            </div>
            <div style={{ maxHeight:600, overflowY:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:8.5 }}>
                <thead style={{ position:'sticky', top:0, background:'rgba(4,9,18,0.97)' }}>
                  <tr>
                    <Th>Link ID</Th><Th>Name</Th><Th>Road No.</Th><Th>Class</Th>
                    <Th>Length km</Th><Th>Surface</Th><Th>Region</Th><Th>Station</Th>
                    <Th>Completion</Th><Th>Rehab Year</Th>
                  </tr>
                </thead>
                <tbody>
                  {geoLinks
                    .filter(p => !linkSearch ||
                      String(p.link_id).toLowerCase().includes(linkSearch.toLowerCase()) ||
                      String(p.link_nam_1 ?? '').toLowerCase().includes(linkSearch.toLowerCase()))
                    .map((p, i) => {
                      const clsColor: Record<string,string> = { A:C.cyan, B:C.green, C:C.yellow, M:C.purple };
                      const cls = String(p.road_class ?? '?');
                      const km = Number(p.length_km1 ?? 0);
                      return (
                        <tr key={String(p.link_id)} style={{ background: i%2===0?'rgba(15,23,42,0.35)':'transparent', borderBottom:'1px solid rgba(255,255,255,0.02)' }}>
                          <Td mono style={{ color:C.teal, fontWeight:700, whiteSpace:'nowrap' }}>{String(p.link_id)}</Td>
                          <Td style={{ maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{String(p.link_nam_1 ?? '—')}</Td>
                          <Td mono style={{ color:'rgba(148,163,184,0.6)', whiteSpace:'nowrap' }}>{String(p.road_no ?? '—')}</Td>
                          <Td align="center" style={{ color:clsColor[cls]??'#94a3b8', fontWeight:800 }}>{cls}</Td>
                          <Td align="right" mono>{km.toFixed(2)}</Td>
                          <Td style={{ color: String(p.surface_ty) === 'Bituminous' ? C.cyan : C.orange, fontSize:8 }}>{String(p.surface_ty ?? '—')}</Td>
                          <Td style={{ color:'rgba(148,163,184,0.7)', whiteSpace:'nowrap', fontSize:8 }}>{String(p.maintena_1 ?? '—')}</Td>
                          <Td style={{ color:'rgba(148,163,184,0.5)', fontSize:8 }}>{String(p.maintenanc ?? '—')}</Td>
                          <Td align="center" mono style={{ color:'rgba(148,163,184,0.5)' }}>{p.completion ? String(p.completion) : '—'}</Td>
                          <Td align="center" mono style={{ color:'rgba(148,163,184,0.4)' }}>{p.rehabilita ? String(p.rehabilita) : '—'}</Td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </TablePanel>

          <AdtProjectionTable />

          {/* Export note */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
            background: 'rgba(0,245,255,0.05)', border: '1px solid rgba(0,245,255,0.15)',
            borderRadius: 8, marginTop: 8 }}>
            <ExternalLink size={12} style={{ color: C.cyan, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.7)' }}>
              Geospatial exports (Shapefile, GeoJSON, KML, CSV) →{' '}
              <strong style={{ color: C.cyan, cursor: 'pointer' }} onClick={() => setTab('downloads')}>Downloads & Exports</strong>
              {' '}· Bridge documents →{' '}
              <strong style={{ color: C.cyan, cursor: 'pointer' }} onClick={() => setTab('documents')}>Document Store</strong>
            </span>
            <FileText size={12} style={{ color: 'rgba(148,163,184,0.3)', marginLeft: 'auto', flexShrink: 0 }} />
          </div>
        </div>
      )}

      {/* ── DOCUMENTS TAB ────────────────────────────────────────────────────── */}
      {tab === 'documents' && (
        <Suspense fallback={<div style={{ padding: 40, color: '#64748b', textAlign: 'center' }}>Loading…</div>}>
          <DocumentStore />
        </Suspense>
      )}

      {/* ── DOWNLOADS TAB ────────────────────────────────────────────────────── */}
      {tab === 'downloads' && (
        <Suspense fallback={<div style={{ padding: 40, color: '#64748b', textAlign: 'center' }}>Loading…</div>}>
          <DownloadsView />
        </Suspense>
      )}
    </div>
  );
}
