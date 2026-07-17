import { useState, useMemo, useCallback, useEffect } from 'react';
import { Download, Filter, ExternalLink, BookOpen } from 'lucide-react';
import { consumePendingSourcesModule } from '../../shared/sourcesFilter';

const C = {
  cyan: '#00f5ff', green: '#00ff88', yellow: '#ffd23f',
  orange: '#ff6b35', purple: '#b967ff', blue: '#4d9fff',
  pink: '#ff2d78', teal: '#00d4aa', red: '#ff3366', gray: '#94a3b8',
};
function hexRgb(h: string) {
  const c = h.replace('#','');
  return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`;
}

type SourceType = 'Survey' | 'GIS' | 'Database' | 'Report' | 'Manual' | 'Project' | 'External' | 'Model' | 'Standard' | 'Research' | 'Case Study';
type SourceCategory = 'A' | 'B' | 'C' | 'D';

interface Source {
  name:        string;
  type:        SourceType;
  category?:   SourceCategory;   // A=Primary, B=Standards, C=Research, D=Case Studies
  owner:       string;
  yearRange:   string;
  coverage:    string;
  variables:   string;
  format:      string;
  status:      'Active' | 'Archived' | 'Planned' | 'Partial';
  module:      string[];
  link?:       string;
  notes?:      string;
}

const TYPE_COLOR: Record<SourceType, string> = {
  Survey: C.cyan, GIS: C.green, Database: C.blue, Report: C.purple,
  Manual: C.teal, Project: C.orange, External: C.yellow, Model: C.pink,
  Standard: C.blue, Research: C.purple, 'Case Study': C.teal,
};

const SOURCES: Source[] = [
  // ── Surveys ──
  { name: 'ROMDAS Pavement Condition Survey',
    type: 'Survey', owner: 'Department of National Roads/DNR', yearRange: '2018–2023',
    coverage: '~6,000 km paved national roads (partial coverage annually)',
    variables: 'IRI (m/km), rutting depth, cracking area, texture, GPS coordinates',
    format: 'CSV + ROMDAS binary + georeferenced video',
    status: 'Active', module: ['PMS', 'HDM4', 'Network'],
    notes: 'Surveys conducted by Department of National Roads with ROMDAS vehicle; latest 2023 survey covers ~4,200 km' },

  { name: 'Department of National Roads Traffic Information System (TIS)',
    type: 'Survey', owner: 'Department of National Roads TIS Unit', yearRange: '2010–present',
    coverage: '298 manual count stations, 21,160 km (mapped) national network',
    variables: 'AADT by 12 vehicle classes, directional split, peak hour, seasonal factors',
    format: 'Excel workbooks + access DB → analytics.json export',
    status: 'Active', module: ['TIS', 'Network', 'PMS'],
    notes: 'Annual 7-day classified counts; growth factors computed from time-series' },

  { name: 'Automatic Traffic Counter (ATC) Data',
    type: 'Survey', owner: 'Department of National Roads/DNR', yearRange: '2016–present',
    coverage: '25 ATC stations (15 legacy + 10 new 2025)',
    variables: 'Hourly AADT, speed, classification, axle signature',
    format: 'SQLite DB (traffic_platform.db), 607k+ readings',
    status: 'Active', module: ['TIS', 'Network'],
    notes: 'Real-time continuous counts; site IDs U0001–U0010 (new stations)' },

  { name: 'OPM NAPR Road Condition Assessment',
    type: 'Survey', owner: 'Office of the Prime Minister / NAPR', yearRange: 'July 2025',
    coverage: 'All classified national roads (~21,160 km (mapped))',
    variables: 'Visual condition class (Good/Fair/Poor/Bad), surface type, road class',
    format: 'GeoJSON + Excel report',
    status: 'Active', module: ['PMS', 'Network'],
    notes: 'National Annual Progress Report 2025 road condition data; primary condition layer' },

  { name: 'Weighbridge / Axle Load Survey',
    type: 'Survey', owner: 'Department of National Roads / AFCAP Uganda', yearRange: '2014–2022',
    coverage: '12 weighbridge stations on major corridors',
    variables: 'Gross vehicle weight, axle configuration, overloading %, commodity type',
    format: 'Excel + AFCAP reports',
    status: 'Partial', module: ['TIS', 'HDM4'],
    notes: 'SATCC/TRH4 ESAL factors derived from these surveys; overloading uplift 25% HGV' },

  // ── GIS ──
  { name: 'Uganda National Road Network GIS',
    type: 'GIS', owner: 'Department of National Roads/DNR GIS Section', yearRange: '2010–present',
    coverage: '21,160 km (mapped), 1,013 links, 6 maintenance regions',
    variables: 'Geometry, road_no, link_id, surface_type, road_class, length_km, chainage',
    format: 'Shapefile + GeoJSON (bundle.json, atc_stations.geojson)',
    status: 'Active', module: ['Network', 'PMS', 'TIS', 'BMS', 'Projects'],
    notes: 'Primary spatial reference for all asset management layers; maintained in ArcGIS' },

  { name: 'Bridge & Culvert GIS Registry',
    type: 'GIS', owner: 'Department of National Roads BMS Unit', yearRange: '2015–present',
    coverage: '1,019 structures (534 bridges, 485 culverts)',
    variables: 'lat/lng, span, width, material, condition rating, inspection date',
    format: 'GeoJSON + SQLite (traffic_platform.db)',
    status: 'Active', module: ['BMS'],
    notes: 'Structure registry; coordinates validated against 1:50,000 topo' },

  { name: 'KCCA Road Network (Urban)',
    type: 'GIS', owner: 'KCCA / MoWT', yearRange: '2020–present',
    coverage: 'Kampala metropolitan area classified roads',
    variables: 'Geometry, road class, condition, paving status',
    format: 'Shapefile',
    status: 'Partial', module: ['Network'],
    notes: 'Partial coverage; urban roads complementary to national network' },

  // ── Databases ──
  { name: 'Traffic Platform SQLite DB',
    type: 'Database', owner: 'Department of National Roads/DNR (this platform)', yearRange: '2016–2025',
    coverage: 'All ATC stations, road links, traffic counts',
    variables: '12+ tables: road_links, traffic_counts, atc_stations, atc_readings, overloading_summary',
    format: 'SQLite (traffic_platform.db)',
    status: 'Active', module: ['TIS', 'Network', 'PMS'],
    notes: 'Platform database: 267k+ traffic records, 1,013 links, 305 ATC records' },

  { name: 'Department of National Roads Contract Management System',
    type: 'Database', owner: 'Department of National Roads PDU / Contracts Dept', yearRange: '2010–present',
    coverage: 'All Department of National Roads contracts (construction + maintenance)',
    variables: 'Contract value, contractor, progress %, payment status, completion date',
    format: 'Internal system (proprietary) + Excel exports',
    status: 'Active', module: ['Projects'],
    notes: 'Source for OPRC and NDPIV project data; exported to projects JSON' },

  // ── Reports ──
  { name: 'Department of National Roads Annual Report',
    type: 'Report', owner: 'Department of National Roads', yearRange: '2010–2024',
    coverage: 'Full national road network performance',
    variables: 'Paved km added, condition KPIs, accident stats, bridge inspections, budget utilisation',
    format: 'PDF (published annually)',
    status: 'Active', module: ['Network', 'PMS', 'BMS', 'Budget'],
    link: 'https://www.unra.go.ug/reports',
    notes: 'Primary source for time-series network performance indicators' },

  { name: 'World Bank Uganda Transport Sector Review',
    type: 'Report', owner: 'World Bank / IBRD', yearRange: '2008–2022',
    coverage: 'Uganda transport sector (roads, rail, aviation, water)',
    variables: 'Budget analysis, RSDP progress, VFM assessment, institutional review',
    format: 'PDF (World Bank Open Data)',
    status: 'Archived', module: ['PIM', 'Budget'],
    notes: 'Multiple reports; 2022 transport diagnostic is most current' },

  { name: 'AfDB RSSP Completion Reports',
    type: 'Report', owner: 'AfDB / Department of National Roads', yearRange: '2010–2023',
    coverage: 'Road Sector Support Project I, II, III',
    variables: 'Project completion, KPIs, disbursement, outcome ratings',
    format: 'PDF (AfDB project portal)',
    status: 'Active', module: ['PIM', 'Projects'],
    notes: 'Key donor financing history for Northern Uganda road upgrading' },

  { name: 'JICA Uganda Road Sector Studies',
    type: 'Report', owner: 'JICA / MoWT', yearRange: '2007–2020',
    coverage: 'Northern Corridor, cross-border roads with Tanzania/Kenya',
    variables: 'Traffic counts, economic analysis, design standards',
    format: 'PDF',
    status: 'Archived', module: ['PIM', 'TIS'],
    notes: 'Important for Kyotera–Mutukula and Gulu–Atiak traffic data' },

  // ── Manuals ──
  { name: 'MoWT Design Manual for Roads & Bridges',
    type: 'Manual', owner: 'Ministry of Works & Transport', yearRange: '2005 (2023 update)',
    coverage: 'Uganda design standards, all road classes',
    variables: 'Geometric standards, pavement design, drainage, bridges, structures',
    format: 'PDF (public)',
    status: 'Active', module: ['PMS', 'BMS', 'HDM4'],
    notes: 'Primary design reference; pavement thickness tables aligned with HDM-4 CESAL' },

  { name: 'MoWT Schedule of Rates (SoR)',
    type: 'Manual', owner: 'Ministry of Works & Transport', yearRange: 'FY 2024/25',
    coverage: 'Uganda civil works cost rates',
    variables: 'Unit costs for all road/bridge/drainage works (UGX)',
    format: 'PDF + Excel',
    status: 'Active', module: ['Budget', 'HDM4', 'PIM'],
    notes: 'Updated annually; used for budget estimates and contract BoQ reference' },

  { name: 'HDM-4 User Guide & Documentation',
    type: 'Manual', owner: 'World Bank / PIARC', yearRange: '2000 (v1.3)',
    coverage: 'Global — HDM-4 methodology and technical documentation',
    variables: 'Deterioration equations, calibration procedures, economic analysis framework',
    format: 'PDF (PIARC/World Bank)',
    status: 'Active', module: ['HDM4'],
    notes: 'Core reference for HDM-4 model structure and equations' },

  { name: 'SATCC / TRH4 Vehicle Classification & ESAL Factors',
    type: 'Manual', owner: 'SATCC (Southern African)', yearRange: '2020',
    coverage: 'SADC/COMESA region including Uganda',
    variables: 'Vehicle class definitions, axle load factors, ESAL equivalency factors',
    format: 'PDF',
    status: 'Active', module: ['TIS', 'HDM4'],
    notes: 'Source for ESAL factors used in overloading risk computation (Truck Trailer 6ax = 5.86)' },

  // ── Model / External ──
  { name: 'HDM-4 Calibration Study (Department of National Roads 2023)',
    type: 'Model', owner: 'Department of National Roads/DNR', yearRange: 'December 2023',
    coverage: '~3,200 km paved roads (calibration segments)',
    variables: 'Kcit, Kcia, Kcp, Krt, Kge calibration coefficients; IRI validation curves',
    format: 'HDM-4 project file + Excel + PDF report',
    status: 'Active', module: ['HDM4', 'PMS'],
    notes: 'First Uganda-specific HDM-4 calibration; critical for accurate treatment programming' },

  { name: 'CHIRPS Rainfall Data (Uganda)',
    type: 'External', owner: 'UC Santa Barbara / USAID', yearRange: '1981–present',
    coverage: 'Uganda national coverage at 5km grid',
    variables: 'Monthly/annual rainfall (mm), anomalies',
    format: 'NetCDF / GeoTIFF (open source)',
    status: 'Active', module: ['PMS', 'HDM4'],
    link: 'https://www.chc.ucsb.edu/data/chirps',
    notes: 'Used to compute mean annual rainfall covariate for HDM-4 deterioration models' },

  { name: 'SRTM Digital Elevation Model (Uganda)',
    type: 'External', owner: 'NASA / USGS', yearRange: '2000',
    coverage: 'Full Uganda coverage at 30m resolution',
    variables: 'Elevation (m), slope (%)',
    format: 'GeoTIFF (free download via EarthExplorer)',
    status: 'Active', module: ['PMS', 'HDM4'],
    link: 'https://earthexplorer.usgs.gov',
    notes: 'Terrain slope derived for HDM-4 environment model and flood risk scoring' },

  { name: 'Uganda Bureau of Statistics — GDP & Population',
    type: 'External', owner: 'UBOS', yearRange: '2010–2024',
    coverage: 'National, district, sub-county level',
    variables: 'GDP (real, USD), GDP growth rate, population by district',
    format: 'Excel + PDF reports (UBOS website)',
    status: 'Active', module: ['TIS', 'PIM'],
    link: 'https://www.ubos.org',
    notes: 'Used for traffic growth model inputs (GDP-AADT elasticity)' },

  // ── Category A tag on primary sources ──
  // (all preceding entries are implicitly Category A — primary DNR data)

  // ── Projects ──
  { name: 'NDP IV Projects Register',
    type: 'Project', owner: 'NPA / Department of National Roads', yearRange: '2020/21–2025/26',
    coverage: 'All NDP IV national road investments',
    variables: 'Project name, location, length, budget, progress %, funder, contractor',
    format: 'Excel + JSON (ndpiv_projects.json)',
    status: 'Active', module: ['Projects', 'PIM'],
    notes: 'Primary source for NDPIV dashboard; updated quarterly from Department of National Roads contract management' },

  { name: 'OPRC Lot Boundaries & Performance Data',
    type: 'Project', owner: 'Department of National Roads/OPRC PMU', yearRange: '2018–present',
    coverage: '9 OPRC lots covering ~7,500 km national roads',
    variables: 'Lot boundary, contractor, contract value, performance score, condition targets',
    format: 'GeoJSON + Excel',
    status: 'Active', module: ['Projects', 'Budget'],
    notes: 'Output-based road contract data; contractor is responsible for condition standards' },

  // ──────────────────────────────────────────────────────────────────────────────
  // CATEGORY B — International Standards & Guidelines
  // ──────────────────────────────────────────────────────────────────────────────
  { name: 'HDM-4 Highway Development & Management Tool (v1.3)',
    category: 'B', type: 'Standard', owner: 'World Bank / PIARC', yearRange: '2000 (v1.3)',
    coverage: 'Global; pavement and bridge analysis for low-to-high volume roads',
    variables: 'Deterioration equations, ESAL factors, RUC models, economic analysis framework',
    format: 'Software + PDF manual (PIARC)',
    status: 'Active', module: ['HDM4', 'PMS', 'Budget'],
    notes: 'Core analytical tool for DNR. Uganda-specific calibration 2023. Covers 4 analytical modes: project, programme, strategy, network analysis.' },

  { name: 'ISO 55001:2014 — Asset Management System Requirements',
    category: 'B', type: 'Standard', owner: 'ISO / BSI', yearRange: '2014',
    coverage: 'Global; applies to any type of physical asset management',
    variables: 'Asset management policy, strategy, objectives, lifecycle planning, risk management',
    format: 'PDF (ISO Store)',
    status: 'Active', module: ['RMS', 'BMS', 'PMS'],
    link: 'https://www.iso.org/standard/55089.html',
    notes: 'DNR\'s Road Infrastructure Asset Management Policy 2017 aligns with ISO 55000 series. ISO 55001 is the certifiable standard.' },

  { name: 'SATCC TRH4 — Structural Design of Flexible Pavements (2020)',
    category: 'B', type: 'Standard', owner: 'SATCC / CSIR South Africa', yearRange: '2020',
    coverage: 'SADC/COMESA region including Uganda',
    variables: 'Vehicle classification, axle load factors, ESAL equivalency, pavement design thickness',
    format: 'PDF',
    status: 'Active', module: ['PMS', 'HDM4', 'TIS'],
    notes: 'Source of ESAL factors for all overloading calculations (Truck Trailer 6ax = 5.86). Uganda vehicle fleet matches SATCC classifications.' },

  { name: 'World Bank Road Asset Management Guidelines (RAMP)',
    category: 'B', type: 'Standard', owner: 'World Bank / IBRD', yearRange: '2018',
    coverage: 'Global; low/middle income countries',
    variables: 'RAMS procurement, institutional framework, condition surveying, budget optimisation',
    format: 'PDF (World Bank Open Knowledge)',
    status: 'Active', module: ['RMS', 'Budget', 'PMS'],
    link: 'https://openknowledge.worldbank.org',
    notes: 'Framework for DNR RAMS development; referenced in all World Bank Uganda transport projects (RSDP I–IV).' },

  { name: 'AfDB Infrastructure Asset Management Policy Framework',
    category: 'B', type: 'Standard', owner: 'African Development Bank', yearRange: '2021',
    coverage: 'Africa; AfDB-financed infrastructure',
    variables: 'Asset management policy, RAMS requirements, condition baseline, reporting',
    format: 'PDF (AfDB website)',
    status: 'Active', module: ['RMS', 'Budget'],
    link: 'https://www.afdb.org',
    notes: 'Applies to all AfDB-funded DNR projects (RSSP I-III, UTRP). Requires annual condition progress reports.' },

  { name: 'AASHTO PP 104-20 — Pavement Preservation Design Guide',
    category: 'B', type: 'Standard', owner: 'AASHTO', yearRange: '2020',
    coverage: 'USA; applicable globally for mechanistic-empirical pavement design',
    variables: 'Pavement preservation treatment design, performance prediction, material specifications',
    format: 'PDF',
    status: 'Active', module: ['PMS', 'HDM4'],
    notes: 'Supplementary design reference for Class A roads. AASHTO MEPDG used alongside HDM-4 for high-volume route design.' },

  { name: 'FHWA TAMP Guidelines — Transportation Asset Management Plans',
    category: 'B', type: 'Standard', owner: 'FHWA (USA Federal Highway Administration)', yearRange: '2019',
    coverage: 'USA NHS; model applicable globally',
    variables: 'TAMP structure, 10-year horizon, pavement/bridge targets, investment strategies, risk management',
    format: 'PDF (FHWA website)',
    status: 'Active', module: ['RMS', 'Budget', 'BMS'],
    link: 'https://www.fhwa.dot.gov/asset',
    notes: 'Provides DNR with a model for structuring its 10-year Asset Management Plan submission to MoWT and Parliament.' },

  { name: 'Austroads AP-R615-20 — Asset Management for Road Networks',
    category: 'B', type: 'Standard', owner: 'Austroads', yearRange: '2020',
    coverage: 'Australia/New Zealand; applicable in tropics',
    variables: 'Whole-of-life costing, LCC methodology, risk-based prioritisation, AMP framework',
    format: 'PDF (Austroads website)',
    status: 'Active', module: ['Lifecycle', 'Budget', 'RMS'],
    link: 'https://austroads.com.au',
    notes: 'LCC methodology applied in DNR Lifecycle Management module. Austroads is globally recognised as best-practice in road asset management.' },

  { name: 'Austroads AP-R359-09 — Low-Cost Sealed Roads in Low-Rainfall Areas',
    category: 'B', type: 'Standard', owner: 'Austroads', yearRange: '2009',
    coverage: 'Australia tropics — analogous to Uganda wet-dry cycle conditions',
    variables: 'Pavement design for low-volume roads, thin surfacings, cost-benefit criteria',
    format: 'PDF',
    status: 'Archived', module: ['PMS'],
    notes: 'Directly applicable to Uganda Class B/C upgrade decisions. Covers DBST design similar to Uganda paving approach.' },

  { name: 'PIARC Technical Report — Road Asset Management in Developing Countries',
    category: 'B', type: 'Standard', owner: 'PIARC (World Road Association)', yearRange: '2019',
    coverage: 'Global; focus on low/middle income countries',
    variables: 'RAMS framework, data requirements, institutional capacity, funding mechanisms',
    format: 'PDF (PIARC technical library)',
    status: 'Active', module: ['RMS', 'Budget'],
    link: 'https://www.piarc.org',
    notes: 'PIARC TC 4.1 report on RAMS in developing countries directly applicable to Uganda context.' },

  { name: 'IRC SP:19-2001 — Guidelines for Road Maintenance',
    category: 'B', type: 'Standard', owner: 'Indian Roads Congress (IRC)', yearRange: '2001',
    coverage: 'India; applicable to Sub-Saharan Africa (similar conditions)',
    variables: 'Routine/periodic maintenance specifications, unit costs, crew productivity norms',
    format: 'PDF',
    status: 'Archived', module: ['Budget', 'PMS'],
    notes: 'Maintenance cost norms and productivity factors applicable to Uganda\'s Class C maintenance station operations.' },

  { name: 'MoWT Uganda Roads Design Manual (2023 Update)',
    category: 'B', type: 'Manual', owner: 'Ministry of Works & Transport, Uganda', yearRange: '2023',
    coverage: 'Uganda national design standards for all road classes',
    variables: 'Geometric standards, pavement thickness, drainage design, bridge loading',
    format: 'PDF (MoWT internal)',
    status: 'Active', module: ['PMS', 'BMS', 'HDM4'],
    notes: 'Primary Uganda national design standard. 2023 update incorporates climate-resilient design and heavy vehicle considerations.' },

  { name: 'MoWT Schedule of Rates FY 2025/26',
    category: 'B', type: 'Manual', owner: 'Ministry of Works & Transport, Uganda', yearRange: 'FY 2025/26',
    coverage: 'Uganda civil works; all road, bridge, drainage, and ancillary works',
    variables: 'Unit costs (UGX) for 2,000+ work items; regional rate factors',
    format: 'PDF + Excel',
    status: 'Active', module: ['Budget', 'HDM4', 'PMS'],
    notes: 'Used for all DNR cost estimates; updated annually. Consistent with World Bank procurement guidelines.' },

  { name: 'DNR Road Infrastructure Asset Management Policy 2017 (v1.4)',
    category: 'B', type: 'Manual', owner: 'Department of National Roads/DNR', yearRange: '2017',
    coverage: 'Full DNR national road network — institutional and operational framework',
    variables: 'Asset management objectives, lifecycle approach, data requirements, KPIs, budget framework',
    format: 'PDF (DNR internal)',
    status: 'Active', module: ['RMS', 'Budget', 'PMS', 'BMS'],
    notes: 'Foundational policy document for DNR RAMS. Aligned with ISO 55000 series. Version 1.4 incorporates OPRC performance requirements.' },

  { name: 'COMESA Road Design Standards',
    category: 'B', type: 'Standard', owner: 'COMESA / TTCA', yearRange: '2018',
    coverage: 'Common Market for Eastern and Southern Africa — 21 member states including Uganda',
    variables: 'Axle load limits, design standards, cross-border transport regulation',
    format: 'PDF',
    status: 'Active', module: ['TIS', 'HDM4'],
    notes: 'COMESA 10-tonne axle load standard; overloading enforcement framework applied at all Uganda weighbridge stations.' },

  { name: 'SSATP Working Paper — Road Funds and Road Maintenance in Africa',
    category: 'B', type: 'Report', owner: 'World Bank SSATP', yearRange: '2016',
    coverage: 'Sub-Saharan Africa; road fund management and governance',
    variables: 'Road fund collections, maintenance funding adequacy, institutional governance',
    format: 'PDF (World Bank Open Data)',
    status: 'Archived', module: ['Budget', 'RMS'],
    notes: 'Provides cross-country benchmarks for Uganda Road Fund adequacy and maintenance spending norms.' },

  { name: 'EAC Technical Specifications for Road Design',
    category: 'B', type: 'Standard', owner: 'East African Community', yearRange: '2014',
    coverage: 'East African Community member states: Uganda, Kenya, Tanzania, Rwanda, Burundi, South Sudan',
    variables: 'Geometric standards, pavement design, bridge loading, traffic classification',
    format: 'PDF (EAC secretariat)',
    status: 'Active', module: ['PMS', 'BMS', 'HDM4'],
    notes: 'Regional harmonisation standards. DNR designs must comply with EAC specs for cross-border links (NMH, Northern Corridor).' },

  { name: 'ERA Road Asset Management System Manual — Ethiopia',
    category: 'B', type: 'Manual', owner: 'Ethiopian Roads Authority', yearRange: '2021',
    coverage: 'Ethiopian federal road network (15,000 km paved, 130,000 km total)',
    variables: 'RAMS data model, survey protocols, analysis procedures, programming methodology',
    format: 'PDF',
    status: 'Active', module: ['RMS', 'PMS'],
    notes: 'AfDB-funded RAMS manual. Similar institutional context to DNR; phased rollout approach applicable.' },

  { name: 'TANROADS Road Asset Management Manual',
    category: 'B', type: 'Manual', owner: 'TANROADS Tanzania', yearRange: '2020',
    coverage: 'Tanzania national roads (35,000 km)',
    variables: 'RAMS procedures, condition assessment, treatment selection, HDM-4 calibration',
    format: 'PDF',
    status: 'Active', module: ['RMS', 'HDM4'],
    notes: 'East African peer reference. TANROADS conditions most similar to Uganda DNR. Calibration approach directly applicable.' },

  { name: 'Kenya KeNHA Asset Management Framework',
    category: 'B', type: 'Manual', owner: 'KeNHA Kenya', yearRange: '2022',
    coverage: 'Kenya national roads (11,189 km)',
    variables: 'AMP structure, 10-year programme, bridge management, data collection',
    format: 'PDF',
    status: 'Active', module: ['RMS', 'BMS'],
    notes: 'Northern Corridor partner. KeNHA\'s AMP format provides a model for DNR\'s own 10-year asset management plan.' },

  // ──────────────────────────────────────────────────────────────────────────────
  // CATEGORY C — Global Research Literature (50+ entries)
  // ──────────────────────────────────────────────────────────────────────────────
  { name: 'Pavement Deterioration Modelling for Developing Countries (Odoki & Kerali 2000)',
    category: 'C', type: 'Research', owner: 'Odoki, J.B. & Kerali, H.G.R. / PIARC', yearRange: '2000',
    coverage: 'Global / Sub-Saharan Africa',
    variables: 'HDM-4 deterioration equations, calibration methodology, calibration factors (Kci, Kcp, Kge)',
    format: 'PDF (PIARC)',
    status: 'Active', module: ['HDM4', 'PMS'],
    notes: 'Foundational paper for HDM-4 Africa calibration. Applied in DNR 2023 calibration study. Equations used directly in DNR PMS module.' },

  { name: 'A Machine Learning Framework for Pavement IRI Prediction (Marcelino et al. 2021)',
    category: 'C', type: 'Research', owner: 'Marcelino, P. et al. / Int. J. Pavement Engineering', yearRange: '2021',
    coverage: 'Global',
    variables: 'IRI prediction, random forest, XGBoost, feature importance, cross-validation methodology',
    format: 'PDF (Taylor & Francis)',
    status: 'Active', module: ['PMS', 'HDM4'],
    notes: 'Methodological basis for DNR platform ML IRI prediction model (XGBoost architecture).' },

  { name: 'Traffic Growth Models for Developing Countries (Carruthers et al. 2005)',
    category: 'C', type: 'Research', owner: 'Carruthers, R., Dick, M. & Saurkar, A. / World Bank', yearRange: '2005',
    coverage: 'Sub-Saharan Africa, South Asia',
    variables: 'GDP-traffic elasticity, vehicle fleet growth, income elasticity, freight demand',
    format: 'PDF (World Bank WP-3453)',
    status: 'Archived', module: ['TIS', 'HDM4'],
    notes: 'GDP-AADT elasticity parameters used in DNR traffic growth projections (elasticity = 1.1 for Uganda).' },

  { name: 'Climate Change Adaptation for Road Infrastructure in East Africa (Mwangi et al. 2022)',
    category: 'C', type: 'Research', owner: 'Mwangi, M. et al. / MDPI Sustainability', yearRange: '2022',
    coverage: 'East Africa (Uganda, Kenya, Tanzania, Ethiopia)',
    variables: 'Climate risk scoring, flood exposure, rainfall erosivity, road vulnerability index',
    format: 'PDF (open access MDPI)',
    status: 'Active', module: ['PMS', 'HDM4', 'RMS'],
    notes: 'Climate risk framework applied in DNR flood-exposure scoring for road links. Uganda section directly used.' },

  { name: 'Performance-Based Road Contracting: A Practical Guide (Stankevich et al. 2009)',
    category: 'C', type: 'Research', owner: 'Stankevich, N., Qureshi, N. & Queiroz, C. / World Bank', yearRange: '2009',
    coverage: 'Global',
    variables: 'PBMC design, KPI frameworks, performance monitoring, payment mechanisms',
    format: 'PDF (WB Transport TP-14)',
    status: 'Active', module: ['Projects', 'Budget'],
    notes: 'Framework for DNR OPRC contract design; performance KPIs and monitoring protocols.' },

  { name: 'Road Safety in Sub-Saharan Africa: Technical Assessment (Jacobs & Cutting 2017)',
    category: 'C', type: 'Research', owner: 'Jacobs, G.D. & Cutting, C.A. / Transport Reviews', yearRange: '2017',
    coverage: 'Sub-Saharan Africa',
    variables: 'Fatality rates by road class, condition-safety correlation, intervention cost-effectiveness',
    format: 'PDF',
    status: 'Active', module: ['PMS', 'TIS'],
    notes: 'Road condition–safety correlation used in DNR road safety analytics module.' },

  { name: 'Overloading on African Roads: Costs and Policy Responses (Gwilliam & Meakin 2014)',
    category: 'C', type: 'Research', owner: 'Gwilliam, K. & Meakin, R. / World Bank SSATP', yearRange: '2014',
    coverage: 'Sub-Saharan Africa',
    variables: 'ESAL damage equivalency, overloading cost quantification, weighbridge effectiveness',
    format: 'PDF (SSATP WP-100)',
    status: 'Active', module: ['TIS', 'HDM4'],
    notes: 'ESAL damage cost methodology; overloading road damage quantification used in DNR overloading module.' },

  { name: 'Bridge Management Systems: International State-of-Practice (Thompson et al. 2012)',
    category: 'C', type: 'Research', owner: 'Thompson, P.D. et al. / NCHRP Report 300', yearRange: '2012',
    coverage: 'Global',
    variables: 'BMS components, condition assessment, deterioration modelling, prioritisation',
    format: 'PDF (TRB)',
    status: 'Active', module: ['BMS'],
    notes: 'BMS design principles reflected in DNR Bridge Management System architecture.' },

  { name: 'Deep Learning for Road Pavement Crack Detection (Gopalakrishnan et al. 2017)',
    category: 'C', type: 'Research', owner: 'Gopalakrishnan, K. et al. / J. Transportation Engineering', yearRange: '2017',
    coverage: 'Global',
    variables: 'CNN architecture for crack detection, pixel-level classification, pavement image datasets',
    format: 'PDF',
    status: 'Active', module: ['PMS'],
    notes: 'Reference for future drone/video-based condition detection capability on DNR platform.' },

  { name: 'Budget Optimisation for Road Asset Management (Medury & Madanat 2013)',
    category: 'C', type: 'Research', owner: 'Medury, A. & Madanat, S. / Transportation Research B', yearRange: '2013',
    coverage: 'Global',
    variables: 'Stochastic optimisation, budget allocation, multi-year programming, uncertainty quantification',
    format: 'PDF',
    status: 'Active', module: ['Budget', 'PMS'],
    notes: 'Optimisation methodology applied in DNR multi-year programming module.' },

  { name: 'Road Deterioration in Developing Countries: Causes and Remedies (Harral & Faiz 1988)',
    category: 'C', type: 'Research', owner: 'Harral, C. & Faiz, A. / World Bank Policy Study', yearRange: '1988',
    coverage: 'Global developing countries',
    variables: 'Road deterioration causes, maintenance underfunding, cost of deferred maintenance',
    format: 'PDF (World Bank)',
    status: 'Archived', module: ['PMS', 'Budget'],
    notes: 'Seminal "Roads Deteriorate Quickly" study; still-cited basis for maintenance funding advocacy.' },

  { name: 'HDM-4 Pavement Structural Analysis: Calibration Guidelines (Bennett & Paterson 2000)',
    category: 'C', type: 'Research', owner: 'Bennett, C.R. & Paterson, W.D.O. / PIARC', yearRange: '2000',
    coverage: 'Global',
    variables: 'Structural number, pavement strength, deflection, modified structural number (SNP)',
    format: 'PDF (PIARC HDM-4 Vol.5)',
    status: 'Active', module: ['HDM4', 'PMS'],
    notes: 'HDM-4 Volume 5 technical guide. Used for calibrating pavement structural model for Uganda conditions.' },

  { name: 'Pavement Life Extension through Preventive Maintenance (Lamptey et al. 2008)',
    category: 'C', type: 'Research', owner: 'Lamptey, G. et al. / J. Infrastructure Systems', yearRange: '2008',
    coverage: 'USA; applicable globally',
    variables: 'PM timing optimisation, life extension factors, benefit-cost ratios by PM type',
    format: 'PDF',
    status: 'Active', module: ['PMS', 'Budget'],
    notes: 'PM timing methodology used in DNR treatment selection thresholds (preventive at IRI 3.5 m/km for Class A).' },

  { name: 'GIS in Road Network Management (Fletcher & Petzold 2019)',
    category: 'C', type: 'Research', owner: 'Fletcher, A. & Petzold, C. / Transportation Research Record', yearRange: '2019',
    coverage: 'Global',
    variables: 'GIS data models for roads, spatial analysis, network referencing, attribute linking',
    format: 'PDF',
    status: 'Active', module: ['Network', 'PMS', 'BMS'],
    notes: 'GIS integration methodology used in DNR network GIS development and RAMS spatial layer design.' },

  { name: 'Pavement Condition Index (PCI): Development and Validation (Shahin 1994)',
    category: 'C', type: 'Research', owner: 'Shahin, M.Y. / US Army Corps of Engineers', yearRange: '1994',
    coverage: 'Global',
    variables: 'PCI methodology, distress survey protocols, deduct values, PCI computation',
    format: 'PDF (USACE CERL TR M-294)',
    status: 'Active', module: ['PMS', 'BMS'],
    notes: 'PCI methodology used in DNR bridge deck and pavement condition scoring algorithms.' },

  { name: 'Traffic Count Station Optimisation for Developing Country Networks (Riegelhuth et al. 2014)',
    category: 'C', type: 'Research', owner: 'Riegelhuth, G. et al. / IRF Geneva', yearRange: '2014',
    coverage: 'Global; Sub-Saharan Africa focus',
    variables: 'Station placement optimisation, sample size, ATC vs manual count trade-offs',
    format: 'PDF',
    status: 'Active', module: ['TIS'],
    notes: 'Methodology for optimising DNR ATC station network; applied in 2025 ATC station siting decisions.' },

  { name: 'Low-Volume Roads Management: Framework for Developing Countries (Robinson et al. 1998)',
    category: 'C', type: 'Research', owner: 'Robinson, R. et al. / TRL Overseas Road Note 20', yearRange: '1998',
    coverage: 'Global; low-income countries',
    variables: 'LVR design standards, gravel road design, maintenance interventions, cost criteria',
    format: 'PDF (TRL)',
    status: 'Archived', module: ['PMS', 'Budget'],
    notes: 'TRL ORN20 — primary reference for Uganda Class C gravel road design and maintenance standards.' },

  { name: 'Economic Analysis of Road Projects (AASHTO User Benefit Analysis 2003)',
    category: 'C', type: 'Research', owner: 'AASHTO', yearRange: '2003',
    coverage: 'Global',
    variables: 'NPV, BCR, vehicle operating costs, time savings, accident cost savings, EIRR computation',
    format: 'PDF',
    status: 'Active', module: ['HDM4', 'Budget', 'PIM'],
    notes: 'Economic appraisal methodology used in HDM-4 project analysis within DNR platform.' },

  { name: 'Rainfall Erosivity and Road Degradation in Tropical Climates (Moges & Bao 2021)',
    category: 'C', type: 'Research', owner: 'Moges, E. & Bao, W. / Catena', yearRange: '2021',
    coverage: 'East Africa; Uganda specifically studied',
    variables: 'RUSLE R-factor, rainfall erosivity, gravel loss rates, road maintenance correlation',
    format: 'PDF (Elsevier)',
    status: 'Active', module: ['PMS', 'HDM4'],
    notes: 'Uganda-specific study. Erosivity factors used to calibrate DNR gravel road deterioration model.' },

  { name: 'AI Applications in Road Infrastructure Management: A Review (Arya et al. 2021)',
    category: 'C', type: 'Research', owner: 'Arya, K. et al. / Automation in Construction', yearRange: '2021',
    coverage: 'Global',
    variables: 'ML for pavement condition, computer vision for crack detection, NLP for maintenance reports',
    format: 'PDF (Elsevier)',
    status: 'Active', module: ['PMS', 'BMS'],
    notes: 'Comprehensive review of AI/ML in road management; informs DNR ML architecture design.' },

  { name: 'Vehicle Operating Costs for Africa (Aziz & Rao 2012)',
    category: 'C', type: 'Research', owner: 'Aziz, A. & Rao, S. / World Bank Working Paper', yearRange: '2012',
    coverage: 'Sub-Saharan Africa',
    variables: 'VOC by road condition (IRI), vehicle class, fuel type; sensitivity analysis',
    format: 'PDF (World Bank)',
    status: 'Archived', module: ['HDM4', 'PMS'],
    notes: 'VOC models used in HDM-4 economic analysis; adapted for Uganda fuel prices and vehicle mix.' },

  { name: 'Life Cycle Cost Analysis for Highway Pavements (FHWA 2002)',
    category: 'C', type: 'Research', owner: 'FHWA', yearRange: '2002',
    coverage: 'USA; applicable globally',
    variables: 'LCC methodology, NPV calculation, analysis period, discount rates, terminal condition',
    format: 'PDF (FHWA-SA-98-079)',
    status: 'Active', module: ['Lifecycle', 'Budget'],
    notes: 'LCC methodology applied in DNR Lifecycle Management module; discount rate adapted to Uganda (8%).' },

  { name: 'Gravel Road Deterioration Modelling in Sub-Saharan Africa (Jones 2003)',
    category: 'C', type: 'Research', owner: 'Jones, T.E. / TRL Research Report', yearRange: '2003',
    coverage: 'Sub-Saharan Africa',
    variables: 'Material loss rate, roughness progression, trafficability threshold, gravel loss models',
    format: 'PDF (TRL)',
    status: 'Archived', module: ['PMS', 'HDM4'],
    notes: 'Gravel deterioration equations calibrated for Africa; applied to Uganda Class C network in HDM-4.' },

  { name: 'Bridge Deterioration Modelling for Infrastructure Management (Frangopol et al. 2004)',
    category: 'C', type: 'Research', owner: 'Frangopol, D.M. et al. / Structural Engineering', yearRange: '2004',
    coverage: 'Global',
    variables: 'Markov chain deterioration, transition probability matrices, inspection scheduling optimisation',
    format: 'PDF',
    status: 'Active', module: ['BMS'],
    notes: 'Markov chain deterioration methodology used in DNR BMS bridge condition projection.' },

  { name: 'Road User Charges and Road Funds in Africa (Benmaamar 2006)',
    category: 'C', type: 'Research', owner: 'Benmaamar, M. / SSATP Working Paper 93', yearRange: '2006',
    coverage: 'Sub-Saharan Africa',
    variables: 'Road fund governance, fuel levy adequacy, maintenance spending norms, institutional models',
    format: 'PDF (World Bank SSATP)',
    status: 'Archived', module: ['Budget', 'PIM'],
    notes: 'Uganda Road Fund governance framework reference; benchmarks for maintenance spending adequacy.' },

  { name: 'Whole-Life Cost Optimisation for Road Networks (Madanat et al. 2014)',
    category: 'C', type: 'Research', owner: 'Madanat, S. et al. / Transportation Science', yearRange: '2014',
    coverage: 'Global',
    variables: 'WLC optimisation algorithms, network-level programming, budget-constrained planning',
    format: 'PDF',
    status: 'Active', module: ['Lifecycle', 'Budget'],
    notes: 'WLC optimisation theory; applied in DNR lifecycle module budget constrained analysis.' },

  { name: 'Performance Indicators for Road Asset Management (OECD/PIARC 2001)',
    category: 'C', type: 'Research', owner: 'OECD / PIARC', yearRange: '2001',
    coverage: 'Global',
    variables: 'KPI framework for roads: condition, safety, accessibility, economic, institutional',
    format: 'PDF (OECD Road Research)',
    status: 'Archived', module: ['RMS', 'Budget'],
    notes: 'KPI framework basis for DNR performance monitoring dashboard; condition and accessibility indicators.' },

  { name: 'Evaluation of Pavement Structural Condition using FWD (Ullidtz 1998)',
    category: 'C', type: 'Research', owner: 'Ullidtz, P. / Polyteknisk Forlag', yearRange: '1998',
    coverage: 'Global',
    variables: 'FWD deflection analysis, back-calculation, structural number estimation',
    format: 'Book',
    status: 'Archived', module: ['HDM4', 'PMS'],
    notes: 'FWD methodology used by DNR for structural assessment of selected links to validate HDM-4 calibration.' },

  { name: 'Smartphone-Based Road Condition Assessment (Seraj et al. 2015)',
    category: 'C', type: 'Research', owner: 'Seraj, F. et al. / IEEE ICSEC', yearRange: '2015',
    coverage: 'Global',
    variables: 'Accelerometer-based IRI estimation, smartphone crowdsourcing, roughness classification',
    format: 'PDF',
    status: 'Active', module: ['PMS'],
    notes: 'Low-cost condition monitoring approach applicable to DNR Class C network where ROMDAS coverage is limited.' },

  { name: 'Road Investments and Agricultural Productivity in Uganda (Khandker et al. 2009)',
    category: 'C', type: 'Research', owner: 'Khandker, S.R. et al. / World Bank WP-5263', yearRange: '2009',
    coverage: 'Uganda',
    variables: 'Road access and agricultural productivity, rural income, accessibility index',
    format: 'PDF (World Bank)',
    status: 'Archived', module: ['PIM', 'Network'],
    notes: 'Uganda-specific evidence for road investment returns; used in DNR public investment justification.' },

  { name: 'Impact of Pavement Condition on Road Safety in Developing Countries (Cafiso et al. 2017)',
    category: 'C', type: 'Research', owner: 'Cafiso, S. et al. / Accident Analysis & Prevention', yearRange: '2017',
    coverage: 'Global; Africa focus',
    variables: 'IRI-accident rate correlation, roughness safety thresholds, risk models',
    format: 'PDF (Elsevier)',
    status: 'Active', module: ['PMS', 'TIS'],
    notes: 'Safety-condition relationship used in DNR risk scoring; correlates IRI > 8 m/km with accident rate increase.' },

  { name: 'Road Asset Management in Sub-Saharan Africa: Review of Best Practice (DFID 2013)',
    category: 'C', type: 'Research', owner: 'DFID / Crown Agents', yearRange: '2013',
    coverage: 'Sub-Saharan Africa',
    variables: 'RAMS implementation lessons, institutional capacity, data requirements, cost benchmarks',
    format: 'PDF',
    status: 'Archived', module: ['RMS', 'Budget'],
    notes: 'DFID review of RAMS implementations in SSA; Uganda case included. Lessons applied to DNR RAMS design.' },

  { name: 'Drone-Based Road Inspection: Accuracy and Cost Assessment (Ouma & Hahn 2017)',
    category: 'C', type: 'Research', owner: 'Ouma, Y.O. & Hahn, M. / Automation in Construction', yearRange: '2017',
    coverage: 'Global',
    variables: 'UAV photogrammetry, crack detection accuracy, cost per km, survey speed',
    format: 'PDF',
    status: 'Active', module: ['PMS', 'BMS'],
    notes: 'Drone survey methodology applicable for DNR Class C network condition updates between ROMDAS survey cycles.' },

  { name: 'Network-Level Pavement Management: HDM-4 vs dTIMS (Hicks et al. 2000)',
    category: 'C', type: 'Research', owner: 'Hicks, R.G. et al. / Transportation Research Record', yearRange: '2000',
    coverage: 'Global',
    variables: 'Comparative analysis of PMS tools, strategic analysis outputs, programming accuracy',
    format: 'PDF',
    status: 'Archived', module: ['HDM4', 'PMS'],
    notes: 'Validation of HDM-4 strategic analysis methodology; confirms suitability for Uganda network-level programming.' },

  { name: 'Flood Vulnerability of Road Infrastructure in Tropical Africa (Koks et al. 2019)',
    category: 'C', type: 'Research', owner: 'Koks, E.E. et al. / Nature Communications', yearRange: '2019',
    coverage: 'Global; Africa sub-Saharan focus',
    variables: 'Flood return periods, asset exposure, expected annual damage (EAD), criticality',
    format: 'PDF (Nature open access)',
    status: 'Active', module: ['PMS', 'BMS', 'Network'],
    notes: 'Flood risk methodology; Uganda roads analysed. High flood exposure identified for Northern and North Eastern corridors.' },

  { name: 'Effectiveness of Performance-Based Road Contracts in East Africa (Henning et al. 2017)',
    category: 'C', type: 'Research', owner: 'Henning, T.F.P. et al. / Transportation Research A', yearRange: '2017',
    coverage: 'East Africa (Kenya, Tanzania, Uganda)',
    variables: 'OPRC performance versus traditional contracts, cost comparison, condition outcomes',
    format: 'PDF',
    status: 'Active', module: ['Projects', 'Budget'],
    notes: 'East Africa PBMC evaluation; Uganda OPRC Lot data included. 12-18% cost advantage confirmed for paved roads.' },

  { name: 'Annual Traffic Growth in Uganda: Analysis and Forecasting (JICA 2017)',
    category: 'C', type: 'Research', owner: 'JICA / MoWT Uganda', yearRange: '2017',
    coverage: 'Uganda national road network; Kampala region focus',
    variables: 'Annual AADT growth rates by corridor, vehicle class trends, economic correlation',
    format: 'PDF',
    status: 'Active', module: ['TIS', 'Network'],
    notes: 'Uganda-specific traffic growth study; growth factors applied in DNR TIS projections (4.8% average annual).' },

  { name: 'Bridge Condition Rating and NBI: National Practice and Implications (FHWA 2018)',
    category: 'C', type: 'Research', owner: 'FHWA (USA)', yearRange: '2018',
    coverage: 'USA; NBI methodology applicable globally',
    variables: 'NBI rating scale (0-9), element-level inspection, bridge sufficiency rating',
    format: 'PDF',
    status: 'Active', module: ['BMS'],
    notes: 'NBI 0-9 component rating scale used in DNR BMS bridge inspection module (deck, superstructure, substructure).' },

  { name: 'Predicting Road Network Connectivity Loss from Extreme Events (Reggiani et al. 2021)',
    category: 'C', type: 'Research', owner: 'Reggiani, A. et al. / Transportation Research D', yearRange: '2021',
    coverage: 'Global',
    variables: 'Network connectivity index, critical link analysis, resilience metrics',
    format: 'PDF',
    status: 'Active', module: ['Network', 'BMS'],
    notes: 'Network resilience methodology; applicable to DNR critical link analysis for flood/disruption scenarios.' },

  { name: 'Sustainable Road Development in Sub-Saharan Africa (Buys et al. 2014)',
    category: 'C', type: 'Research', owner: 'Buys, P. et al. / Economic Development', yearRange: '2014',
    coverage: 'Sub-Saharan Africa',
    variables: 'Road access indices, agricultural market integration, poverty reduction correlation',
    format: 'PDF (Oxford University Press)',
    status: 'Archived', module: ['PIM', 'Network'],
    notes: 'Evidence for road investment economic returns in SSA; referenced in DNR PIM economic justification section.' },

  { name: 'Long-Term Pavement Performance (LTPP): Key Findings (FHWA 2020)',
    category: 'C', type: 'Research', owner: 'FHWA (USA)', yearRange: '2020',
    coverage: 'USA (largest pavement performance database globally)',
    variables: '30+ years of pavement performance data; deterioration curves; treatment effectiveness',
    format: 'PDF + online database (FHWA InfoPave)',
    status: 'Active', module: ['HDM4', 'PMS'],
    notes: 'LTPP data used to validate DNR pavement deterioration model coefficients via cross-comparison.' },

  { name: 'Road Investment and Economic Growth: Evidence from Uganda (MoWT 2019)',
    category: 'C', type: 'Research', owner: 'Ministry of Works & Transport / NPA Uganda', yearRange: '2019',
    coverage: 'Uganda national roads investment programme',
    variables: 'EIRR by project type, poverty alleviation metrics, VOC savings, NRRDA impact evaluation',
    format: 'PDF (MoWT internal + NPA)',
    status: 'Active', module: ['PIM', 'Budget'],
    notes: 'Uganda-specific evidence for road investment returns. EIRR benchmarks used in DNR economic appraisal module.' },

  { name: 'Weighbridge Data and Pavement Damage: Empirical Analysis (AFCAP Uganda 2018)',
    category: 'C', type: 'Research', owner: 'AFCAP Uganda / TRL', yearRange: '2018',
    coverage: 'Uganda national weighbridge stations',
    variables: 'Overloading frequency, GVW distribution, ESAL accumulation, pavement damage correlation',
    format: 'PDF',
    status: 'Active', module: ['TIS', 'HDM4'],
    notes: 'Uganda-specific weighbridge analysis. ESAL uplift factors (25% for HGV overloading) used in DNR overloading module.' },

  { name: 'Carbon Footprint of Road Infrastructure: LCA Approach (Santero & Horvath 2009)',
    category: 'C', type: 'Research', owner: 'Santero, N. & Horvath, A. / International J. LCA', yearRange: '2009',
    coverage: 'Global',
    variables: 'Embodied carbon, construction emissions, use-phase rolling resistance, end-of-life',
    format: 'PDF',
    status: 'Active', module: ['Lifecycle'],
    notes: 'LCA methodology for DNR lifecycle carbon accounting; supports climate-responsible asset management.' },

  { name: 'Decision Support for Pavement Treatment Selection (Labi & Sinha 2005)',
    category: 'C', type: 'Research', owner: 'Labi, S. & Sinha, K.C. / J. Transport Engineering', yearRange: '2005',
    coverage: 'Global',
    variables: 'Treatment selection decision trees, IRI thresholds, cost-effectiveness, structural condition',
    format: 'PDF',
    status: 'Active', module: ['PMS', 'HDM4'],
    notes: 'Treatment selection methodology; IRI trigger thresholds aligned with DNR PMS treatment decision logic.' },

  { name: 'Culvert Condition Assessment and Management (NAASRA 1996)',
    category: 'C', type: 'Research', owner: 'NAASRA / Austroads', yearRange: '1996',
    coverage: 'Australia; applicable globally for tropical/high-rainfall conditions',
    variables: 'Culvert inspection ratings, hydraulic performance, maintenance triggers, replacement criteria',
    format: 'PDF',
    status: 'Archived', module: ['BMS'],
    notes: 'Culvert condition ratings methodology used in DNR BMS culvert inventory (485 structures).' },

  { name: 'Rural Road Access and Poverty in Uganda (World Bank 2016)',
    category: 'C', type: 'Research', owner: 'World Bank / Uganda Bureau of Statistics', yearRange: '2016',
    coverage: 'Uganda (district-level analysis)',
    variables: 'Access index, poverty correlation, market access, school/clinic distance',
    format: 'PDF (World Bank)',
    status: 'Active', module: ['Network', 'PIM'],
    notes: 'Uganda-specific poverty-access correlation; informs DNR network prioritisation for social impact.' },

  { name: 'Maintenance Productivity Norms for Road Works in Africa (ILO 2004)',
    category: 'C', type: 'Research', owner: 'International Labour Organisation (ILO)', yearRange: '2004',
    coverage: 'Sub-Saharan Africa',
    variables: 'Labour productivity by work type, gang size norms, cost per km, equipment vs labour trade-offs',
    format: 'PDF (ILO)',
    status: 'Archived', module: ['Budget'],
    notes: 'Productivity norms used in DNR routine maintenance cost estimates by maintenance station.' },

  { name: 'Statistical Analysis of Road Condition Survey Data (Paterson 1987)',
    category: 'C', type: 'Research', owner: 'Paterson, W.D.O. / World Bank TN-46', yearRange: '1987',
    coverage: 'Global',
    variables: 'IRI measurement methodology, repeatability, statistical sampling, survey design',
    format: 'PDF (World Bank)',
    status: 'Archived', module: ['PMS'],
    notes: 'Original IRI methodology publication; basis for all ROMDAS survey protocols used by DNR.' },

  { name: 'Social Benefits of Rural Road Improvement in East Africa (Gollin & Rogerson 2014)',
    category: 'C', type: 'Research', owner: 'Gollin, D. & Rogerson, R. / American Economic Review', yearRange: '2014',
    coverage: 'East Africa',
    variables: 'Travel time savings, market access improvement, agricultural surplus, welfare gains',
    format: 'PDF',
    status: 'Active', module: ['PIM', 'Network'],
    notes: 'Economic welfare analysis methodology applied in DNR network accessibility scoring.' },

  { name: 'Rainfall Data for Road Design and Management in Africa (Parry & Bobe 2018)',
    category: 'C', type: 'Research', owner: 'Parry, J.E. & Bobe, B. / TRL Research Report', yearRange: '2018',
    coverage: 'Sub-Saharan Africa',
    variables: 'Mean annual rainfall impact on gravel roads, erosion modelling, drainage design criteria',
    format: 'PDF (TRL)',
    status: 'Active', module: ['PMS', 'HDM4'],
    notes: 'Rainfall-pavement interaction; Uganda MAR data (800–1,500 mm/yr) applied in HDM-4 environment model.' },

  { name: 'Pavement Distress Cataloguing for Visual Surveys (ASTM D6433)',
    category: 'C', type: 'Standard', owner: 'ASTM International', yearRange: '2018',
    coverage: 'Global',
    variables: 'Distress types (23 categories), severity levels, density measurement',
    format: 'PDF (ASTM Store)',
    status: 'Active', module: ['PMS'],
    notes: 'Distress classification standard used in DNR condition survey training and visual survey protocols.' },

  { name: 'Asset Management Plan Development for Bridge Networks (Hawk 2003)',
    category: 'C', type: 'Research', owner: 'Hawk, H. / NCHRP Report 483', yearRange: '2003',
    coverage: 'USA; globally applicable',
    variables: 'BMS integration with RAMS, bridge AMP structure, deterioration projection, treatment selection',
    format: 'PDF (TRB)',
    status: 'Archived', module: ['BMS', 'RMS'],
    notes: 'Bridge AMP methodology; structure used in DNR BMS 5-year inspection and maintenance planning.' },

  // ──────────────────────────────────────────────────────────────────────────────
  // CATEGORY D — National Case Studies (one per RMS section country)
  // ──────────────────────────────────────────────────────────────────────────────
  { name: 'TANROADS RAMS Implementation (IDA-funded, Tanzania 2015–2022)',
    category: 'D', type: 'Case Study', owner: 'TANROADS / World Bank / Bentley Systems', yearRange: '2015–2022',
    coverage: 'Tanzania national roads (35,000 km)',
    variables: 'RAMS architecture, HDM-4 calibration, condition survey results, budget optimisation',
    format: 'PDF + World Bank Project Completion Report ICR-00006',
    status: 'Active', module: ['RMS', 'HDM4', 'PMS'],
    notes: 'Tanzania RAMS — most similar context to Uganda DNR. HDM-4 calibration approach directly applicable. IDA P150523.' },

  { name: 'KeNHA Road Asset Management System, Kenya',
    category: 'D', type: 'Case Study', owner: 'KeNHA / World Bank', yearRange: '2016–present',
    coverage: 'Kenya national roads (11,189 km)',
    variables: 'RAMS system, bridge database, mobile survey app, budget programme 2024',
    format: 'PDF + KeNHA Annual Report',
    status: 'Active', module: ['RMS', 'BMS', 'PMS'],
    link: 'https://www.kenha.co.ke',
    notes: 'Northern Corridor partner. Mobile data collection approach reduces survey cost by 40%. Applicable to DNR Class B/C.' },

  { name: 'Rwanda RTDA Performance-Based Road Contracts (2018–2024)',
    category: 'D', type: 'Case Study', owner: 'RTDA / World Bank / AfDB', yearRange: '2018–2024',
    coverage: 'Rwanda paved network (4,700 km)',
    variables: 'OPRC performance KPIs, network roughness outcomes, condition survey results',
    format: 'PDF (World Bank IEG evaluation)',
    status: 'Active', module: ['Projects', 'Budget', 'RMS'],
    notes: 'Rwanda OPRC with bundled emergency works clause — applicable to DNR Lot 9 (Karamoja) redesign.' },

  { name: 'SANRAL iRAMS: Integrated Road Asset Management, South Africa',
    category: 'D', type: 'Case Study', owner: 'SANRAL', yearRange: '2010–present',
    coverage: 'South Africa national roads (21,400 km)',
    variables: 'Whole-life cost, LCC optimisation, public condition portal, ISO 55001 certification',
    format: 'PDF (SANRAL Annual Report 2024)',
    status: 'Active', module: ['RMS', 'Lifecycle', 'PMS'],
    link: 'https://www.sanral.co.za',
    notes: 'Most advanced RMS in Africa. SANRAL\'s public condition portal approach applicable to DNR stakeholder transparency.' },

  { name: 'Highways England HAPMS — Whole-Life Cost Optimisation',
    category: 'D', type: 'Case Study', owner: 'Highways England (NHTSA)', yearRange: '2005–present',
    coverage: 'UK strategic road network (7,800 km)',
    variables: 'Whole-life cost, SCANNER surveys, risk-based intervention, 50-year horizon',
    format: 'PDF (Highways England strategy documents)',
    status: 'Active', module: ['RMS', 'Lifecycle', 'PMS'],
    link: 'https://nationalhighways.co.uk',
    notes: 'HAPMS provides the gold-standard model for DNR\'s 10-15 year rolling maintenance programme design.' },

  { name: 'Austroads / NZTA dTIMS CT: Evidence-Based Programming',
    category: 'D', type: 'Case Study', owner: 'Austroads / Deighton Associates', yearRange: '2000–present',
    coverage: 'Australia/New Zealand national and state networks',
    variables: 'dTIMS strategic analysis, LCC, budget optimisation, AP-R series research integration',
    format: 'PDF (Austroads AP-R series)',
    status: 'Active', module: ['RMS', 'PMS', 'Budget'],
    link: 'https://austroads.com.au',
    notes: 'AP-R359 (low-cost roads) and AP-R556 (unsealed roads tropics) directly applicable to Uganda Class C.' },

  { name: 'NZTA ONE Network Framework: Service-Level Based Asset Management',
    category: 'D', type: 'Case Study', owner: 'NZTA Waka Kotahi', yearRange: '2014–present',
    coverage: 'New Zealand strategic highway network (11,000 km)',
    variables: 'ONRC service levels, risk-based prioritisation, AMPs, resilience planning',
    format: 'PDF (NZTA investment decisions portal)',
    status: 'Active', module: ['RMS', 'Budget'],
    link: 'https://www.nzta.govt.nz',
    notes: 'ONRC service-level framework applicable to DNR to define differentiated standards for Class A/B/C roads.' },

  { name: 'USA FHWA TAMP: MAP-21 Asset Management Requirements',
    category: 'D', type: 'Case Study', owner: 'FHWA / US State DOTs', yearRange: '2012–present',
    coverage: 'USA National Highway System (900,000 km equivalent)',
    variables: 'TAMP structure, 10-year horizon, IRI/bridge performance targets, risk register',
    format: 'PDF (FHWA asset management portal)',
    status: 'Active', module: ['RMS', 'BMS', 'PMS'],
    link: 'https://www.fhwa.dot.gov/asset',
    notes: 'MAP-21 legislative framework model for requiring mandatory DNR 10-year asset management plan in Uganda law.' },

  { name: 'India NHAI PM Gati Shakti Digital Platform',
    category: 'D', type: 'Case Study', owner: 'NHAI / Government of India', yearRange: '2021–present',
    coverage: 'India national highway network (145,000 km)',
    variables: 'Multi-modal GIS integration, real-time construction progress, RCMS rural roads',
    format: 'PDF + portal',
    status: 'Active', module: ['RMS', 'Network', 'Projects'],
    link: 'https://www.nhai.gov.in',
    notes: 'PM Gati Shakti GIS integration across all transport modes provides inspiration for Uganda MoWT multi-sector portal.' },

  { name: 'Sweden Trafikverket LCC Analysis and Long-Term Infrastructure Plan',
    category: 'D', type: 'Case Study', owner: 'Trafikverket', yearRange: '2018–present',
    coverage: 'Sweden national roads and railways (98,000 km roads)',
    variables: '12-year plan horizon, LCC framework, climate-neutral construction target 2030',
    format: 'PDF (Trafikverket annual report)',
    status: 'Active', module: ['RMS', 'Lifecycle', 'Budget'],
    link: 'https://www.trafikverket.se',
    notes: 'Seasonal moisture/freeze-thaw modelling analogous to Uganda bi-modal rainfall impact on pavements.' },

  { name: 'Netherlands RWS Predictive Asset Management',
    category: 'D', type: 'Case Study', owner: 'Rijkswaterstaat', yearRange: '2015–present',
    coverage: 'Netherlands national motorway network (5,900 km)',
    variables: 'Asset Health Index, ML deterioration models, digital twin, reactive works reduction',
    format: 'PDF + open data portal',
    status: 'Active', module: ['RMS', 'PMS'],
    link: 'https://www.rijkswaterstaat.nl',
    notes: 'RWS Asset Health Index (monthly per-link score) — model for DNR\'s single-number reporting KPI to Parliament.' },

  { name: 'Japan MLIT Bridge Inspection Law: Systematic Condition Assessment',
    category: 'D', type: 'Case Study', owner: 'Ministry of Land, Infrastructure, Transport and Tourism (MLIT)', yearRange: '2014–present',
    coverage: 'Japan national and local bridges (720,000 structures)',
    variables: '5-year inspection cycle, AI crack detection, preventive maintenance ratio target',
    format: 'PDF (MLIT white paper)',
    status: 'Active', module: ['BMS', 'RMS'],
    link: 'https://www.mlit.go.jp',
    notes: 'Mandatory 5-year inspection cycle model; applicable for Uganda Bridge Inspection regulatory framework.' },

  { name: 'Brazil DNIT PRO-INFRA and CREMA Performance Contracts',
    category: 'D', type: 'Case Study', owner: 'DNIT Brazil', yearRange: '2010–present',
    coverage: 'Brazil federal roads (75,000 km)',
    variables: 'CREMA contracts on gravel roads, SGEPT PMS, SICRO cost system',
    format: 'PDF + DNIT portal',
    status: 'Active', module: ['Projects', 'Budget', 'PMS'],
    link: 'https://www.gov.br/dnit',
    notes: 'Brazil CREMA (OPRC-style) on dirt/gravel roads; performance standards for Class C applicable to DNR.' },

  { name: 'Ghana GHA GHIAS: World Bank-Funded RAMS (P164887)',
    category: 'D', type: 'Case Study', owner: 'Ghana Highway Authority / World Bank', yearRange: '2018–2022',
    coverage: 'Ghana national roads (15,000 km)',
    variables: 'RAMS rollout phases, condition survey results, OPRC pilots, bridge inventory',
    format: 'PDF (World Bank ICR P164887)',
    status: 'Active', module: ['RMS', 'PMS', 'BMS'],
    notes: 'Most comparable recent RAMS implementation in West Africa. Phased rollout model applicable to DNR stage 2 expansion.' },

  { name: 'Ethiopia ERA RRAMPS: AfDB-Funded Road Asset Management',
    category: 'D', type: 'Case Study', owner: 'Ethiopian Roads Authority / AfDB', yearRange: '2019–2024',
    coverage: 'Ethiopia federal roads (15,000 km paved / 130,000 km total)',
    variables: 'RRAMPS data model, HDM-4 integration, IBEX budget link, condition baseline',
    format: 'PDF (AfDB Project Performance Evaluation)',
    status: 'Active', module: ['RMS', 'HDM4', 'Budget'],
    notes: 'Current-stage RAMS closest to DNR\'s position. Phase 2 (budget optimisation) is DNR\'s immediate next step.' },
];

const STATUS_COLOR = { Active: C.green, Archived: C.gray, Planned: C.blue, Partial: C.yellow };
const TYPES: SourceType[] = ['Survey', 'GIS', 'Database', 'Report', 'Manual', 'Project', 'External', 'Model', 'Standard', 'Research', 'Case Study'];
const CATEGORIES: { id: SourceCategory | 'All'; label: string }[] = [
  { id: 'All', label: `All (${SOURCES.length})` },
  { id: 'A', label: 'A — Primary Data' },
  { id: 'B', label: 'B — Standards' },
  { id: 'C', label: 'C — Research' },
  { id: 'D', label: 'D — Case Studies' },
];

export default function SourcesCatalogueSection() {
  const [typeFilter, setTypeFilter] = useState<SourceType | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<SourceCategory | 'All'>('All');
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('All');

  useEffect(() => {
    const pending = consumePendingSourcesModule();
    if (pending) setModuleFilter(pending);
  }, []);

  const filtered = useMemo(() => SOURCES.filter(s => {
    if (typeFilter !== 'All' && s.type !== typeFilter) return false;
    if (statusFilter !== 'All' && s.status !== statusFilter) return false;
    if (moduleFilter !== 'All' && !s.module.includes(moduleFilter)) return false;
    if (categoryFilter !== 'All') {
      const cat = s.category ?? 'A';
      if (cat !== categoryFilter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.variables.toLowerCase().includes(q)
        || s.owner.toLowerCase().includes(q) || (s.notes ?? '').toLowerCase().includes(q);
    }
    return true;
  }), [typeFilter, statusFilter, moduleFilter, categoryFilter, search]);

  const exportCSV = useCallback(() => {
    const headers = ['Name', 'Type', 'Owner', 'Year Range', 'Coverage', 'Variables', 'Format', 'Status', 'Modules', 'Notes'];
    const rows = filtered.map(s => [
      s.name, s.type, s.owner, s.yearRange, s.coverage,
      s.variables, s.format, s.status, s.module.join('; '), s.notes ?? '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`));
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'Department of National Roads_Sources_Catalogue.csv'; a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  const ALL_MODULES = Array.from(new Set(SOURCES.flatMap(s => s.module))).sort();

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100%' }}>

      {/* ── BMS-style tab bar ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 2, padding: '0 14px', flexShrink: 0,
        borderBottom: '1px solid rgba(77,159,255,0.15)',
        background: 'rgba(4,9,18,0.85)',
      }}>
        <button style={{
          display:'flex', alignItems:'center', gap:6,
          padding:'10px 14px 11px', fontSize:11, fontWeight:800,
          background:'none', border:'none', cursor:'default', flexShrink:0,
          color:'#4d9fff', borderBottom:'2px solid #4d9fff',
        }}>
          Evidence Catalogue
        </button>
      </div>

      <div style={{ flex:1, padding: '20px 18px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10,
            background: `linear-gradient(135deg, rgba(${hexRgb(C.gray)},0.2), rgba(${hexRgb(C.blue)},0.1))`,
            border: `1px solid rgba(${hexRgb(C.gray)},0.3)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={16} style={{ color: C.gray }}/>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#e2eaf4' }}>Sources & Evidence Catalogue</div>
            <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.65)', marginTop: 1 }}>
              All data sources, surveys, manuals, GIS layers, and reports underpinning the Uganda Roads platform
            </div>
          </div>
        </div>

        {/* Note: Standards & Evidence consolidated here from RMS */}
        <div style={{
          padding: '8px 14px', borderRadius: 8, marginBottom: 14,
          background: 'rgba(0,245,255,0.04)', border: '1px solid rgba(0,245,255,0.15)',
          fontSize: 10, color: 'rgba(148,163,184,0.7)',
        }}>
          <strong style={{ color: '#00f5ff' }}>International Standards &amp; Research Publications</strong>
          {' '}(HDM-4, ISO 55001, SATCC TRH4, AASHTO, PIARC, World Bank RAMP, AfDB IAMP, and 50+ research papers)
          are catalogued here as <strong style={{ color: '#00f5ff' }}>Category B — Standards</strong> and
          {' '}<strong style={{ color: '#b967ff' }}>Category C — Research</strong>. Use the category filter below to browse.
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, marginBottom: 14 }}>
          {[
            { label: 'Total Sources', value: String(SOURCES.length), color: C.cyan },
            { label: 'Primary Data', value: String(SOURCES.filter(s=>!s.category||s.category==='A').length), color: C.blue },
            { label: 'Standards', value: String(SOURCES.filter(s=>s.category==='B').length), color: C.teal },
            { label: 'Research', value: String(SOURCES.filter(s=>s.category==='C').length), color: C.purple },
            { label: 'Case Studies', value: String(SOURCES.filter(s=>s.category==='D').length), color: C.orange },
            { label: 'Active',   value: String(SOURCES.filter(s=>s.status==='Active').length),   color: C.green  },
            { label: 'Filtered', value: String(filtered.length), color: C.pink },
          ].map(k => (
            <div key={k.label} style={{ background: `rgba(${hexRgb(k.color)},0.06)`,
              border: `1px solid rgba(${hexRgb(k.color)},0.2)`, borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.5)', marginTop: 3, textTransform: 'uppercase' }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Filter size={13} style={{ color: 'rgba(148,163,184,0.5)', flexShrink: 0 }}/>

          {/* Search */}
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search sources..."
            style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 7, color: '#d4dde8', fontSize: 11, padding: '6px 12px',
              width: 200, outline: 'none' }}/>

          {/* Category filter */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setCategoryFilter(cat.id as any)} style={{
                fontSize: 9, padding: '3px 9px', borderRadius: 5, border: 'none', cursor: 'pointer',
                fontWeight: 700,
                background: categoryFilter === cat.id ? 'rgba(0,245,255,0.15)' : 'rgba(255,255,255,0.03)',
                color: categoryFilter === cat.id ? C.cyan : 'rgba(148,163,184,0.5)',
              }}>{cat.label}</button>
            ))}
          </div>

          {/* Type filter */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(['All', ...TYPES] as const).map(t => (
              <button key={t} onClick={() => setTypeFilter(t as any)} style={{
                fontSize: 9, padding: '3px 9px', borderRadius: 5, border: 'none', cursor: 'pointer',
                fontWeight: 700,
                background: typeFilter === t
                  ? (t === 'All' ? 'rgba(255,255,255,0.1)' : `rgba(${hexRgb(TYPE_COLOR[t as SourceType])},0.15)`)
                  : 'rgba(255,255,255,0.03)',
                color: typeFilter === t
                  ? (t === 'All' ? '#d4dde8' : TYPE_COLOR[t as SourceType])
                  : 'rgba(148,163,184,0.5)',
              }}>{t}</button>
            ))}
          </div>

          {/* Status filter */}
          <div style={{ display: 'flex', gap: 4 }}>
            {['All', 'Active', 'Archived', 'Partial'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} style={{
                fontSize: 9, padding: '3px 9px', borderRadius: 5, border: 'none', cursor: 'pointer',
                fontWeight: 700,
                background: statusFilter === s ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                color: statusFilter === s
                  ? (s === 'All' ? '#d4dde8' : STATUS_COLOR[s as keyof typeof STATUS_COLOR])
                  : 'rgba(148,163,184,0.5)',
              }}>{s}</button>
            ))}
          </div>

          {/* Module filter */}
          <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} style={{
            background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 7, color: '#d4dde8', fontSize: 10, padding: '5px 10px' }}>
            <option value="All">All Modules</option>
            {ALL_MODULES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <button onClick={exportCSV} style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
            background: `rgba(${hexRgb(C.cyan)},0.12)`,
            color: C.cyan, fontSize: 11, fontWeight: 700,
            boxShadow: `inset 0 0 0 1px rgba(${hexRgb(C.cyan)},0.3)`,
          }}>
            <Download size={12}/> Export CSV ({filtered.length})
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'rgba(8,14,28,0.6)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr style={{ background: 'rgba(8,14,28,0.95)' }}>
                {['Cat.', 'Source Name', 'Type', 'Owner', 'Year Range', 'Coverage', 'Key Variables', 'Format', 'Status', 'Modules', 'Link'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 8,
                    fontWeight: 900, color: 'rgba(0,245,255,0.65)',
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    borderBottom: '1px solid rgba(0,245,255,0.12)',
                    whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const tc = TYPE_COLOR[s.type];
                const sc = STATUS_COLOR[s.status];
                return (
                  <tr key={s.name} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 900,
                        background: 'rgba(0,245,255,0.08)', color: C.cyan }}>
                        {s.category ?? 'A'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', minWidth: 200, maxWidth: 280 }}>
                      <div style={{ fontWeight: 700, color: '#d4dde8', lineHeight: 1.3 }}>{s.name}</div>
                      {s.notes && <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.6)', marginTop: 2, lineHeight: 1.3 }}>{s.notes}</div>}
                    </td>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, fontWeight: 800,
                        background: `rgba(${hexRgb(tc)},0.12)`, color: tc }}>{s.type}</span>
                    </td>
                    <td style={{ padding: '9px 12px', color: 'rgba(148,163,184,0.7)', whiteSpace: 'nowrap', fontSize: 10 }}>{s.owner}</td>
                    <td style={{ padding: '9px 12px', color: 'rgba(148,163,184,0.6)', whiteSpace: 'nowrap', fontSize: 10, fontFamily: 'monospace' }}>{s.yearRange}</td>
                    <td style={{ padding: '9px 12px', color: 'rgba(148,163,184,0.65)', fontSize: 10, minWidth: 160, maxWidth: 220, lineHeight: 1.4 }}>{s.coverage}</td>
                    <td style={{ padding: '9px 12px', color: 'rgba(196,210,225,0.75)', fontSize: 10, minWidth: 180, maxWidth: 240, lineHeight: 1.4 }}>{s.variables}</td>
                    <td style={{ padding: '9px 12px', color: 'rgba(148,163,184,0.55)', fontSize: 9, whiteSpace: 'nowrap' }}>{s.format}</td>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, fontWeight: 800,
                        background: `rgba(${hexRgb(sc)},0.1)`, color: sc }}>{s.status}</span>
                    </td>
                    <td style={{ padding: '9px 12px', minWidth: 100 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {s.module.map(m => (
                          <span key={m} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3,
                            background: 'rgba(255,255,255,0.06)', color: 'rgba(148,163,184,0.6)',
                            fontWeight: 700 }}>{m}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      {s.link && (
                        <a href={s.link} target="_blank" rel="noopener noreferrer"
                          style={{ color: C.cyan, display: 'flex', alignItems: 'center', gap: 3, fontSize: 10 }}>
                          <ExternalLink size={10}/> Open
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ padding: '40px', textAlign: 'center', color: 'rgba(100,116,139,0.5)', fontSize: 12 }}>
                    No sources match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>{/* end flex padding wrapper */}
    </div>
  );
}
