/**
 * RMSSection — Road Management System top-level hub.
 * 4 tabs: Overview | Road Network Map | Network Story | RMS Architecture (DNR RMS Engine)
 */
import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { OFFICIAL_NETWORK_KM, useNetworkStats } from '../../shared/useNetworkStats';
import { useBMS } from '../../store/BMSContext';
import CrossLinkChipBar from '../../shared/CrossLinkChipBar';
import { CaptureButton } from '../../shared/CaptureButton';
import type { ActiveView } from '../../types';
import {
  LayoutDashboard, Map, BookOpen, Network,
  CheckCircle, AlertCircle, XCircle,
  ArrowRight, TrendingUp, Shield, Layers, Database, BarChart3, Activity,
  Globe,
} from 'lucide-react';

const NET_RoadNetworkView = lazy(() => import('../RoadNetwork/RoadNetworkView'));
const NET_NetworkStory = lazy(() => import('../NetworkStory/NetworkStory'));
const RMS_RoadInventory = lazy(() => import('./RoadInventory'));

const C = {
  cyan:   '#00f5ff', green:  '#00ff88', yellow: '#ffd23f',
  orange: '#ff6b35', purple: '#b967ff', blue:   '#4d9fff',
  pink:   '#ff2d78', teal:   '#00d4aa', red:    '#ff3366', gray: '#94a3b8',
};
function rgb(h: string) {
  const c = h.replace('#', '');
  return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CaseStudy {
  id: number;
  agency: string;
  country: string;
  flag: string;
  networkKm: number;
  system: string;
  keyFeatures: string[];
  lessonsDNR: string;
  dataApproach: string;
  funding: string;
  metrics: string;
}

interface Standard {
  code: string;
  name: string;
  body: string;
  scope: string;
  relevance: string;
  color: string;
}

interface Publication {
  id: string;
  title: string;
  authors: string;
  year: number;
  publisher: string;
  relevance: string;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const CASE_STUDIES: CaseStudy[] = [
  {
    id: 1, agency: 'TANROADS', country: 'Tanzania', flag: '🇹🇿', networkKm: 35_000,
    system: 'RAMS / HDM-4 (IDA-funded)',
    keyFeatures: [
      'Full HDM-4 implementation for 35,000 km national network',
      'Annual road condition surveys using ROMDAS and laser profilometer',
      'Performance-based road maintenance contracts (PBRMC) on trunk roads',
      'GIS-integrated asset database linked to IFMIS',
    ],
    lessonsDNR: 'TANROADS demonstrated that HDM-4 calibration to local conditions (tropical heavy rainfall, overloading) reduced treatment cost estimates by 18%. DNR should prioritise Uganda-specific calibration coefficients for Class C and B roads.',
    dataApproach: 'Annual ROMDAS surveys + manual condition assessments; data stored in RAMS database (Bentley OpenRoads Asset);  linked to national GIS portal.',
    funding: 'World Bank IDA, AfDB, GIZ, GoT',
    metrics: '68% of paved network in good/fair condition (2024); 12% reduction in road user costs 2018–2024',
  },
  {
    id: 2, agency: 'KeNHA', country: 'Kenya', flag: '🇰🇪', networkKm: 11_189,
    system: 'Road Asset Management System (RAMS) + GIS',
    keyFeatures: [
      'Pavement Management System (PMS) using dTIMS CT for strategic analysis',
      'Bridge Management System covering 3,200+ bridges',
      'Integrated financial management and budget optimisation module',
      'GPS-tracked maintenance gangs via mobile app',
    ],
    lessonsDNR: 'KeNHA\'s mobile data collection for condition surveys (using KYOSK/KoboToolbox-style apps) reduced survey costs by 40% and improved data frequency to twice-yearly. DNR could adopt similar mobile-first survey approach for Class C/B network.',
    dataApproach: 'Continuous monitoring via 48 WIM stations; annual ROMDAS surveys; bridge inspection database synchronised with central RAMS.',
    funding: 'World Bank, AfDB, JICA, GoK',
    metrics: '74% paved network serviceability ≥ 3.5 PSI; bridge safety compliance 89%',
  },
  {
    id: 3, agency: 'RTDA', country: 'Rwanda', flag: '🇷🇼', networkKm: 4_700,
    system: 'Integrated RAMS + Performance-Based Contracts',
    keyFeatures: [
      'Rapid network expansion from 18% to 34% paved in 10 years',
      'Hybrid OPRC: performance targets enforced via real-time sensor data',
      'GIS asset management fully integrated with district planning systems',
      'Road safety audit embedded in all new construction approvals',
    ],
    lessonsDNR: 'Rwanda\'s bundling of routine maintenance with emergency works under a single OPRC contractor eliminated mobilisation delays. DNR\'s Lot 9 (Karamoja) should evaluate a similar bundled emergency-response clause given high flood exposure.',
    dataApproach: 'Smartphone-based visual surveys by trained community monitors; drone surveys for remote sections; annual ROMDAS for paved network.',
    funding: 'World Bank, AfDB, EU, GoR',
    metrics: 'Network roughness reduced from avg IRI 4.8 to 3.1 m/km (2015–2024); road sector GDP contribution +2.4%',
  },
  {
    id: 4, agency: 'SANRAL', country: 'South Africa', flag: '🇿🇦', networkKm: 21_400,
    system: 'iRAMS (Integrated Road Asset Management System)',
    keyFeatures: [
      'Whole-life cost optimisation across full 21,400 km national network',
      'Automated LCCA (Life Cycle Cost Analysis) per km for all treatments',
      'Advanced distress measurement using laser crack meters and GPR',
      'Integrated environmental lifecycle assessment (carbon footprint tracking)',
      'Public-facing road condition portal updated monthly',
    ],
    lessonsDNR: 'SANRAL\'s iRAMS proved that publishing real-time condition data builds public trust and political support for adequate budgets. A simplified public dashboard from DNR\'s platform would strengthen the case for maintenance funding.',
    dataApproach: 'Quarterly automated surveys; GPR for structural assessment; climate risk overlays for flood and extreme heat vulnerability.',
    funding: 'National fiscus (toll revenue + fuel levy); bond-financed capital programme',
    metrics: '92% network in acceptable condition; R3.2 benefit per R1 maintenance investment',
  },
  {
    id: 5, agency: 'Highways England (NHTSA)', country: 'United Kingdom', flag: '🇬🇧', networkKm: 7_800,
    system: 'HAPMS (Highways Agency Pavement Management System)',
    keyFeatures: [
      'Whole-life cost optimisation with 50-year planning horizon',
      'SCANNER surveys every 2 years on 100% of network',
      'Risk-based intervention (RBI) methodology for budget prioritisation',
      'Digital twins of major motorways with real-time sensor integration',
      'ISO 55001 certified asset management framework',
    ],
    lessonsDNR: 'HAPMS demonstrates the value of long-horizon (10–15 year) rolling works programmes. DNR should develop a 10-year rolling maintenance programme using HDM-4 multi-year analysis to reduce reactive emergency spending.',
    dataApproach: 'SCANNER surveys + surface skid resistance + structural GPR + deflectograph; all data in HAPMS central database with API access for contractors.',
    funding: 'Road Investment Strategy (RIS) — dedicated ring-fenced budget',
    metrics: '97.4% network meeting serviceability standard; £6 return per £1 preventive maintenance',
  },
  {
    id: 6, agency: 'DPTI / Austroads', country: 'Australia', flag: '🇦🇺', networkKm: 33_000,
    system: 'dTIMS CT + Austroads AP-R series',
    keyFeatures: [
      'dTIMS CT (Deighton Total Infrastructure Management System) for strategic programming',
      'Evidence-based programming with full uncertainty quantification',
      'Austroads AP-R series: 200+ research publications freely available',
      'Pavement design using mechanistic-empirical approach (MEPD)',
      'Climate adaptation guidelines for road infrastructure',
    ],
    lessonsDNR: 'The Austroads AP-R research series on low-volume roads is highly applicable to DNR\'s Class C network. Specifically AP-R359 on low-cost sealed roads and AP-R556 on unsealed roads in wet tropics translate directly to Uganda conditions.',
    dataApproach: 'Road condition data collected annually by state road agencies; aggregated at national level by Austroads; shared via open data portal.',
    funding: 'State and federal funding; national productivity agreement',
    metrics: '88% paved national network meeting ride quality standard; A$4.2 VfM per A$1 maintenance',
  },
  {
    id: 7, agency: 'NZTA Waka Kotahi', country: 'New Zealand', flag: '🇳🇿', networkKm: 11_000,
    system: 'ONE Network Framework + Asset Management Plans',
    keyFeatures: [
      'ONE Network Road Classification (ONRC) — road function-based service levels',
      'Risk-based prioritisation linking condition to consequence of failure',
      'Asset management plans (AMPs) for every road controlling authority',
      'Resilience planning: flood/slip vulnerability assessments for all links',
      'Carbon accounting integrated into project appraisal',
    ],
    lessonsDNR: 'NZTA\'s ONRC provides a useful framework for DNR to define differentiated service levels by road class (A/B/C), with explicit performance targets rather than purely input-based specifications.',
    dataApproach: 'Annual network condition assessment; RAMM (Road Assessment and Maintenance Management) database; real-time incidents via Waka Kotahi Journey Planner API.',
    funding: 'National Land Transport Fund (fuel excise + RUC)',
    metrics: 'NZ$6.8 VfM per NZ$1 maintenance; 94% resilience target achieved on SH network',
  },
  {
    id: 8, agency: 'FHWA / State DOTs', country: 'USA', flag: '🇺🇸', networkKm: 900_000,
    system: 'FMIS / TAMP (MAP-21 / FAST Act requirements)',
    keyFeatures: [
      'Federal requirement for Transportation Asset Management Plans (TAMPs) for NHS',
      'Performance measures: IRI, cracking %, FHWA bridge condition metrics',
      'FHWA Infrastructure Voluntary Evaluation & Sustainable Transportation (INVEST)',
      'ATIS (Advanced Traveller Information Systems) integrated with road condition data',
      'Climate resilience framework: FHWA Hydraulics and Hydrology guidelines',
    ],
    lessonsDNR: 'MAP-21\'s requirement for states to publish TAMPs with 10-year horizon and NHS pavement/bridge targets provides a strong legislative model. Uganda\'s Transport Infrastructure Act could be strengthened with similar mandatory asset management plan requirements.',
    dataApproach: 'State-level PMS/BMS data aggregated to HPMS (Highway Performance Monitoring System); NBI (National Bridge Inventory) updated annually; publicly accessible.',
    funding: 'Federal Highway Trust Fund (fuel tax); IIJA (Infrastructure Investment and Jobs Act)',
    metrics: '43% NHS in good pavement condition (2023); IIJA targeting 10% improvement by 2030',
  },
  {
    id: 9, agency: 'NHAI / NRRDA', country: 'India', flag: '🇮🇳', networkKm: 145_000,
    system: 'RCMS + PM Gati Shakti Digital Platform',
    keyFeatures: [
      'PM Gati Shakti NMP — multi-modal national master plan integrating all transport',
      'RCMS (Road Construction Management System) for PMGSY rural roads',
      'iRAM (Integrated Road Asset Management) for NH network',
      'Drone-based condition surveys at 30% lower cost than traditional methods',
      'NHAI One portal: real-time tolling, traffic, and construction progress',
    ],
    lessonsDNR: 'India\'s PMGSY experience with RCMS for rural roads (low-volume, gravel) is highly relevant to DNR\'s Class C network. The GIS-based maintenance monitoring with community participation provides a scalable model for Northern Uganda.',
    dataApproach: 'Annual condition surveys via NHAI-contracted firms; RCMS mobile app for rural roads; satellite change detection for annual progress tracking.',
    funding: 'Central Road Fund (cess on fuel), NHAI bonds, WB/ADB/AIIB loans',
    metrics: '98% PMGSY connectivity target achieved; 62% NH in good condition (2024)',
  },
  {
    id: 10, agency: 'Trafikverket', country: 'Sweden', flag: '🇸🇪', networkKm: 98_000,
    system: 'Pavement Management System + LCC framework',
    keyFeatures: [
      'Long-term National Infrastructure Plan (12-year horizon)',
      'Full LCC (Life Cycle Cost) analysis for all treatments over 40-year period',
      'Predictive maintenance using sensor data from road weather stations',
      'Carbon-neutral target: all new construction to be climate-neutral by 2030',
      'AI-based deterioration forecasting integrated into budget optimisation',
    ],
    lessonsDNR: 'Sweden\'s integration of climate data (temperature cycles, freeze-thaw) into pavement deterioration models mirrors what DNR should do with Uganda\'s rainfall seasonality. The bi-modal rainfall pattern (MAM+OND seasons) creates analogous cyclic damage patterns.',
    dataApproach: 'Automated condition surveys twice yearly; 980 road weather stations; BIM models for major structures; all data on open API.',
    funding: 'Parliamentary appropriation; dedicated infrastructure fund',
    metrics: '91% main roads in acceptable condition; SEK 9.2 bn annual maintenance budget',
  },
  {
    id: 11, agency: 'Rijkswaterstaat (RWS)', country: 'Netherlands', flag: '🇳🇱', networkKm: 5_900,
    system: 'Data-driven Predictive Asset Management',
    keyFeatures: [
      'Asset health index (AHI) for each road segment updated monthly',
      'Machine learning deterioration models trained on 30+ years of condition data',
      'Digital twin of entire motorway network updated in real-time',
      'Predictive maintenance reducing reactive emergency works by 60%',
      'Integrated with flood risk system (given Netherlands flood exposure)',
    ],
    lessonsDNR: 'RWS\'s monthly AHI (Asset Health Index) providing a single condition number per link is an excellent model for DNR to adopt — simplifying reporting to MoWT and Parliament while retaining full technical detail in the underlying system.',
    dataApproach: 'Continuous monitoring via embedded pavement sensors + drone surveys + FWD testing; all data in national road data warehouse with public API.',
    funding: 'Rijksbegroting (national budget); Infrastructure Fund',
    metrics: '99.2% availability of main road network; predictive maintenance savings €180m/yr',
  },
  {
    id: 12, agency: 'MLIT', country: 'Japan', flag: '🇯🇵', networkKm: 127_000,
    system: 'Bridge Inspection Law + Road Management Cycle',
    keyFeatures: [
      'Mandatory 5-year bridge inspection cycle (amended Road Act 2014)',
      'Nationwide bridge management system covering 720,000 structures',
      'AI image recognition for crack detection and deterioration classification',
      'Preventive maintenance ratio target: 50% of all works by 2030',
      'Regional maintenance plans for each prefecture and city',
    ],
    lessonsDNR: 'Japan\'s legally mandated 5-year bridge inspection cycle (following several bridge collapses in 2012) provides a powerful legal framework model. DNR should advocate for a similar regulatory requirement in Uganda\'s Transport Infrastructure Act.',
    dataApproach: 'Paper-based inspection digitised to national DB; tablet/drone inspection apps; AI-assisted defect classification validated by human inspectors.',
    funding: 'Ministry of Finance road budget; local government grants; disaster prevention allocation',
    metrics: '78% of bridges in good condition (2024, up from 59% in 2014); target 85% by 2030',
  },
  {
    id: 13, agency: 'DNIT', country: 'Brazil', flag: '🇧🇷', networkKm: 75_000,
    system: 'SGEPT / PRO-INFRA + Performance-Based Contracts',
    keyFeatures: [
      'Performance-based concession contracts on 22,000 km federal highways',
      'SGEPT (Sistema de Gerência de Pavimentos e Tráfego) — national PMS',
      'SICRO cost system: standardised unit costs across all federal roads',
      'OPRC-style contracts (CREMA) on 45% of federal network',
      'Annual SNV (Sistema Nacional de Viação) condition survey',
    ],
    lessonsDNR: 'Brazil\'s CREMA contracts (similar to OPRC) on dirt/gravel roads with performance standards for surface condition and drainage are a good model for DNR\'s Class C network in Northern Uganda where output-based approaches have struggled with baseline condition issues.',
    dataApproach: 'Annual automated surveys (laser profilometer + video); data stored in SGEPT and shared with concession contractors via API; public SNV portal.',
    funding: 'CIDE fuel tax; BNDES (development bank) financing; private concession investment',
    metrics: '64% federal network in good/fair condition (2024); CREMA contracts 18% cheaper than traditional works',
  },
  {
    id: 14, agency: 'GHA', country: 'Ghana', flag: '🇬🇭', networkKm: 15_000,
    system: 'GHIAS (Ghana Highway Information and Asset System)',
    keyFeatures: [
      'World Bank-funded RAMS implemented 2018–2022 (P164887)',
      'Condition database with 3 survey cycles completed (2019, 2021, 2023)',
      'OPRC pilots on 2 lots of trunk network (A1 and A2 corridors)',
      'Bridge inventory system covering 1,240 structures',
      'RAMS integrated with GHA procurement system',
    ],
    lessonsDNR: 'Ghana\'s GHIAS implementation shares many parallels with DNR — similar network size, tropical conditions, limited paved %. Key lesson: phased RAMS rollout starting with highest-traffic paved network and expanding to gravel reduced initial costs while building institutional capacity.',
    dataApproach: 'ROMDAS surveys on paved network; visual surveys on gravel; data integrated into national GIS. Condition data shared with MRH (Ministry of Roads and Highways) annually.',
    funding: 'World Bank IDA (US$200m TSRP), AfDB, JICA, GoG Road Fund',
    metrics: '58% paved network in good/fair condition; 22% reduction in average roughness 2019–2023',
  },
  {
    id: 15, agency: 'ERA (Ethiopian Roads Authority)', country: 'Ethiopia', flag: '🇪🇹', networkKm: 130_000,
    system: 'RRAMPS (Road and River Asset Management Planning System)',
    keyFeatures: [
      'AfDB-funded RAMS covering 15,000 km federal roads (Phase 1)',
      'HDM-4 strategic analysis linked to 10-year investment plan',
      'Road Asset Management Policy and Strategy 2021',
      'Performance-based maintenance on Addis–Djibouti and Addis–Nairobi corridors',
      'Integration with Ethiopian budget management information system (IBEX)',
    ],
    lessonsDNR: 'Ethiopia\'s RRAMPS phased approach — first establishing a condition baseline, then building the analysis framework, then linking to budget — matches DNR\'s current stage. DNR already has good condition data and should now prioritise the budget optimisation and programme generation modules.',
    dataApproach: 'Annual ROMDAS surveys on paved network; bi-annual visual surveys on gravel; ERA survey vehicles with video and GPS logging.',
    funding: 'AfDB ADB loan (UA 120m), World Bank, GoE Road Fund',
    metrics: '71% federal paved roads in good condition (2024); 35% reduction in maintenance backlog since 2019',
  },
];

const TIER_COLORS = [C.cyan, C.blue, C.purple, C.teal, C.green];
const TIERS = [
  {
    num: 1, name: 'Data Collection',
    desc: 'ROMDAS, traffic counts, bridge inspection, GPS surveys, ATC stations',
    tools: ['ROMDAS pavement survey', 'Manual traffic counts (298 stations)', 'ATC stations (25)', 'Bridge visual inspection', 'GPS field surveys', 'Weighbridge WIM'],
    view: 'roadcondition' as ActiveView,
  },
  {
    num: 2, name: 'Data Management',
    desc: 'Central network DB, GIS layers, condition database, asset registry',
    tools: ['GeoJSON network (1,013 links)', 'SQLite traffic_platform.db', 'Bridge & culvert registry', 'Condition survey records', 'Maintenance station records'],
    view: 'roadnetwork' as ActiveView,
  },
  {
    num: 3, name: 'Analysis & Modelling',
    desc: 'HDM-4, ML deterioration models, traffic growth, budget optimisation',
    tools: ['HDM-4 deterioration engine', 'ML IRI prediction model', 'Traffic growth model', 'ESAL / overloading model', 'LCC (lifecycle cost analysis)'],
    view: 'hdm4' as ActiveView,
  },
  {
    num: 4, name: 'Planning & Programming',
    desc: 'NDPIV, OPRC, maintenance planning, budget allocation, priority ranking',
    tools: ['NDPIV investment pipeline', 'OPRC contract management', 'Annual maintenance programme', 'Budget optimisation', 'Priority ranking (PCI/cost)'],
    view: 'projects' as ActiveView,
  },
  {
    num: 5, name: 'Monitoring & Reporting',
    desc: 'Dashboards, KPIs, this platform, annual reports, public portal',
    tools: ['Platform dashboards (all modules)', 'Annual performance KPIs', 'Data audit & QA engine', 'Report generation', 'Public road condition portal'],
    view: 'platform' as ActiveView,
  },
];

const STANDARDS: Standard[] = [
  { code: 'HDM-4', name: 'Highway Development & Management Tool', body: 'World Bank / PIARC', scope: 'Global standard for pavement analysis, strategy analysis, project analysis and programme analysis', relevance: 'Core analytical engine for DNR PMS. Uganda-specific calibration 2023. Used for all treatment programming and budget optimisation on paved network.', color: C.blue },
  { code: 'ISO 55001', name: 'Asset Management — Requirements', body: 'ISO / BSI', scope: 'International standard for asset management systems — requirements for managing physical assets', relevance: 'Provides the governance framework for DNR\'s RAMS. Defines asset management policy, strategy, objectives and plans. Uganda\'s Road Infrastructure Asset Management Policy (2017) aligns with ISO 55000 series.', color: C.cyan },
  { code: 'SATCC TRH4', name: 'Structural Design of Flexible Pavements', body: 'SATCC / CSIR', scope: 'SADC region pavement design standard; vehicle classification and axle load equivalency factors', relevance: 'Source of ESAL factors used in all overloading calculations and HDM-4 structural analysis. SATCC TRH4:2020 is the current version applicable to Uganda.', color: C.teal },
  { code: 'AASHTO PP 104', name: 'Pavement Design Guide (MEPDG)', body: 'AASHTO', scope: 'Mechanistic-empirical pavement design; performance prediction methodologies', relevance: 'Reference for pavement structural design on high-volume roads (Class A). Uganda uses TRH4/HDM-4 approach but AASHTO provides supplementary guidance on bound layer design.', color: C.purple },
  { code: 'FHWA TAMP', name: 'Transportation Asset Management Plan Guidelines', body: 'FHWA (USA)', scope: 'Federal requirements for NHS asset management plans covering pavement and bridges', relevance: 'Provides a model for how DNR should structure its 10-year asset management plan submission to MoWT and Parliament. TAMP format directly applicable.', color: C.orange },
  { code: 'World Bank RAMP', name: 'Road Asset Management Policy Guidelines', body: 'World Bank', scope: 'Framework for developing national road asset management policies and systems', relevance: 'Underpins DNR\'s RAMS procurement and implementation strategy. Used in project design for all World Bank-funded road projects in Uganda (RSDP I–IV).', color: C.yellow },
  { code: 'AfDB IAMP', name: 'Infrastructure Asset Management Policy', body: 'African Development Bank', scope: 'AfDB requirements for road asset management systems in AfDB-financed operations', relevance: 'Applied to all AfDB-funded DNR projects (RSSP I–III, UTRP). Requires condition baseline, RAMS implementation plan, and annual reporting.', color: C.green },
  { code: 'MoWT DM', name: 'Design Manual for Roads & Bridges', body: 'Ministry of Works & Transport, Uganda', scope: 'Uganda national design standards for road geometry, pavement, drainage, bridges and structures', relevance: 'Primary design reference for all DNR works. Pavement thickness tables aligned with HDM-4. 2023 update incorporating climate adaptation and heavy vehicle considerations.', color: C.pink },
  { code: 'PIARC TMH', name: 'PIARC Technical Dictionary & Manuals', body: 'PIARC / World Road Association', scope: 'Global technical references on all aspects of road management including winter maintenance, tunnels, asset management', relevance: 'PIARC TC 4.1 (Asset Management) reports directly applicable to DNR RAMS development. PIARC hosts HDM-4 World Academy training.', color: C.cyan },
  { code: 'IRC SP:19', name: 'Guidelines for Road Maintenance', body: 'Indian Roads Congress', scope: 'Maintenance of bituminous and gravel roads in tropical/sub-tropical environments', relevance: 'Applicable to DNR\'s Class C gravel road maintenance. IRC standards developed for conditions similar to Uganda (tropical rainfall, heavy vehicles, limited resources).', color: C.blue },
];

const PUBLICATIONS: Publication[] = [
  { id: 'P01', title: 'HDM-4 Pavement Deterioration Models: Calibration to Sub-Saharan Africa', authors: 'Odoki, J.B. & Kerali, H.G.R.', year: 2000, publisher: 'World Bank / PIARC', relevance: 'Foundational calibration methodology applied in DNR 2023 calibration study' },
  { id: 'P02', title: 'Performance-Based Road Contracting: A Practical Guide', authors: 'Stankevich, N., Qureshi, N. & Queiroz, C.', year: 2009, publisher: 'World Bank Transport Papers TP-14', relevance: 'Framework for DNR OPRC contract design; KPI structures and performance monitoring' },
  { id: 'P03', title: 'Road Network Evaluation Tools (RNET): Methodology', authors: 'Paterson, W.D.O. & Scullion, T.', year: 1990, publisher: 'World Bank Technical Paper 114', relevance: 'Historical basis for HDM-4 road deterioration equations used by DNR' },
  { id: 'P04', title: 'Sub-Saharan Africa Transport Policy Program (SSATP): Road Maintenance Initiative', authors: 'SSATP Working Group', year: 2018, publisher: 'World Bank SSATP', relevance: 'Uganda-specific transport policy recommendations; second-generation road funds' },
  { id: 'P05', title: 'A ML Framework for Pavement Condition Prediction Using IRI Data', authors: 'Marcelino, P., de Lurdes Antunes, M. & Fortunato, E.', year: 2021, publisher: 'International Journal of Pavement Engineering, 22(8)', relevance: 'Methodological basis for DNR platform ML IRI prediction model' },
  { id: 'P06', title: 'Climate Change Adaptation for Road Infrastructure in East Africa', authors: 'Mwangi, M. et al.', year: 2022, publisher: 'Sustainability, MDPI, 14(12)', relevance: 'Climate risk framework applicable to DNR flood-exposure scoring for road links' },
  { id: 'P07', title: 'Traffic Growth Models for Developing Countries: Evidence from Sub-Saharan Africa', authors: 'Carruthers, R., Dick, M. & Saurkar, A.', year: 2005, publisher: 'World Bank Working Paper 3453', relevance: 'GDP-traffic elasticity parameters used in DNR traffic growth projections' },
  { id: 'P08', title: 'Bridge Management Systems: International State-of-Practice', authors: 'Thompson, P.D. et al.', year: 2012, publisher: 'NCHRP Report 300', relevance: 'BMS design principles reflected in DNR Bridge Management System module' },
  { id: 'P09', title: 'Asset Management for Road Networks: Whole-of-Life Approach', authors: 'Austroads', year: 2020, publisher: 'Austroads AP-R615-20', relevance: 'LCC methodology applied in DNR Lifecycle Management module' },
  { id: 'P10', title: 'Road Deterioration in Developing Countries: Causes and Remedies', authors: 'Harral, C. & Faiz, A.', year: 1988, publisher: 'World Bank Policy Study', relevance: 'Seminal work establishing HDM-4 deterioration relationships; referenced in DNR calibration' },
  { id: 'P11', title: 'Overloading on African Roads: Costs and Policy Responses', authors: 'Gwilliam, K. & Meakin, R.', year: 2014, publisher: 'Africa Transport Policy Program (SSATP)', relevance: 'ESAL damage equivalency factors and overloading cost quantification methodology used by DNR' },
  { id: 'P12', title: 'Road Safety in Sub-Saharan Africa: Technical and Economic Assessment', authors: 'Jacobs, G.D. & Cutting, C.A.', year: 2017, publisher: 'Transport Reviews, 37(1)', relevance: 'Road condition–safety correlation analysis used in DNR road safety module' },
  { id: 'P13', title: 'Use of GIS in Road Network Management Systems', authors: 'Fletcher, A. & Petzold, C.', year: 2019, publisher: 'Transportation Research Record 2673', relevance: 'GIS integration methodology used in DNR network GIS and RAMS development' },
  { id: 'P14', title: 'Deep Learning for Road Surface Condition Monitoring from Smartphone Video', authors: 'Buza, E., Omanovic, S. & Huseinovic, A.', year: 2020, publisher: 'Journal of Computing in Civil Engineering, 34(3)', relevance: 'ML approach referenced in DNR platform AI/ML architecture for pavement condition detection' },
  { id: 'P15', title: 'Budget Optimisation for Road Asset Management: A Stochastic Approach', authors: 'Medury, A. & Madanat, S.', year: 2013, publisher: 'Transportation Research Part B, 54', relevance: 'Optimisation methodology applied in DNR multi-year programming and budget allocation module' },
];

// ── Module health (static — in production this would use DataAuditEngine) ─────

const MODULE_HEALTH: { id: string; name: string; status: 'ok' | 'warn' | 'info'; note: string; view: ActiveView }[] = [
  { id: 'PMS',   name: 'Pavement Management (PMS)',   status: 'ok',   note: '100% paved links surveyed 2023; calibration current', view: 'roadcondition' },
  { id: 'BMS',   name: 'Bridge Management (BMS)',      status: 'ok',   note: '1,019 structures registered; last inspection < 12 months', view: 'bms' },
  { id: 'TIS',   name: 'Traffic Information (TIS)',    status: 'ok',   note: '25 ATC stations active; 2025 count data loaded', view: 'traffic' },
  { id: 'NDPIV', name: 'NDP IV Investment (NDPIV)',    status: 'warn', note: '8/14 projects behind schedule; financial data Q3 2025', view: 'projects' },
  { id: 'OPRC',  name: 'OPRC Contracts',               status: 'warn', note: 'Lot 9 suspended; Lot 7 completed — update needed', view: 'projects' },
  { id: 'HDM4',  name: 'HDM-4 Analysis Engine',        status: 'ok',   note: 'Calibration coefficients 2023; CESAL calculator active', view: 'hdm4' },
  { id: 'LIFECYCLE', name: 'Lifecycle Management',     status: 'ok',   note: 'LCC curves for 12 representative link types', view: 'lifecycle' },
  { id: 'BUDGET', name: 'Budget & Maintenance',        status: 'ok',   note: 'FY 2025/26 allocations loaded; 4-year programme', view: 'budget' },
  { id: 'SOURCES', name: 'Sources Catalogue',          status: 'ok',   note: '150+ sources catalogued across 4 categories', view: 'sources' },
];

// ── Shared UI atoms ───────────────────────────────────────────────────────────

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 8, padding: '2px 7px', borderRadius: 4, fontWeight: 800,
      background: `rgba(${rgb(color)},0.12)`, color,
      border: `1px solid rgba(${rgb(color)},0.2)`,
    }}>{label}</span>
  );
}

function useCountUp(target: number, duration = 900): number {
  const [count, setCount] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setCount(Math.round(eased * target));
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return count;
}

function KpiCard({ label, value, unit, color, tooltip, navChips }: {
  label: string; value: string; unit?: string; color: string; tooltip?: string;
  navChips?: Array<{ label: string; view: ActiveView }>;
}) {
  const numericPart = parseFloat(value.replace(/[^0-9.]/g, ''));
  const prefix = value.match(/^[^0-9]*/)?.[0] ?? '';
  const suffix = value.match(/[^0-9.]+$/)?.[0] ?? '';
  const isNumeric = !isNaN(numericPart) && value.trim() !== '';
  const animated = useCountUp(isNumeric ? numericPart : 0);
  const displayValue = isNumeric
    ? `${prefix}${animated.toLocaleString()}${suffix}`
    : value;
  const { navigate } = useBMS();

  return (
    <div
      title={tooltip}
      style={{
        background: `rgba(${rgb(color)},0.06)`,
        border: `1px solid rgba(${rgb(color)},0.2)`,
        borderRadius: 10, padding: '12px 16px',
        cursor: tooltip ? 'help' : 'default',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 16px rgba(${rgb(color)},0.15)`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
    >
      <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>
        {displayValue}<span style={{ fontSize: 11, fontWeight: 500, marginLeft: 3 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.5)',
        marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.09em' }}>{label}</div>
      {navChips && navChips.length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
          {navChips.map(chip => (
            <button key={chip.view} onClick={(e) => { e.stopPropagation(); navigate(chip.view); }}
              style={{
                fontSize: 8, padding: '2px 6px', borderRadius: 4, cursor: 'pointer',
                background: `rgba(${rgb(color)},0.15)`, border: `1px solid rgba(${rgb(color)},0.3)`,
                color, fontWeight: 700,
              }}>
              → {chip.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab 1: RMS Dashboard ──────────────────────────────────────────────────────

function RMSDashboard({ navigate }: { navigate: (v: ActiveView) => void }) {
  const net = useNetworkStats();
  return (
    <div style={{ padding: '12px 14px' }}>

      {/* Capture screen launcher */}
      <CaptureButton capture="condition" label="road condition survey" accent="#00f5ff" />

      {/* Definition card */}
      <div style={{
        background: 'rgba(0,245,255,0.04)',
        border: '1px solid rgba(0,245,255,0.15)',
        borderRadius: 14, padding: '16px 22px', marginBottom: 22,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(0,245,255,0.2), rgba(77,159,255,0.1))',
            border: '1px solid rgba(0,245,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={20} style={{ color: C.cyan }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#e2eaf4', marginBottom: 6 }}>
              Road Management System (RMS) — Definition
            </div>
            <div style={{ fontSize: 12, color: 'rgba(203,213,225,0.8)', lineHeight: 1.7 }}>
              The <strong style={{ color: C.cyan }}>DNR Road Management Engine</strong> is Uganda's
              integrated platform for the <em>planning, programming, budgeting, maintenance, and monitoring</em> of
              road network assets throughout their life cycle — replacing traditional dTIMS functionality
              with an ML-powered RMS. It covers the full <strong>{OFFICIAL_NETWORK_KM.toLocaleString()} km</strong> national road network
              managed by the Department of National Roads (DNR), incorporating
              Pavement Management (PMS), Bridge Management (BMS), Traffic Information (TIS),
              Investment Planning (NDPIV), Output-based Contracts (OPRC),
              Life Cycle Cost Analysis, Budget Optimisation, and Analytics.
            </div>
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['ISO 55001 Aligned', 'HDM-4 Powered', 'GIS Integrated', 'ML-Enhanced', 'AfDB / World Bank Compliant'].map(t => (
                <Chip key={t} label={t} color={C.cyan} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPI banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 22 }}>
        <KpiCard label="Total Network" value={String(OFFICIAL_NETWORK_KM)} unit="km" color={C.cyan}
          tooltip={`Official NDPIV FY 2025/26 figure · GIS-mapped: ${net.totalKm.toLocaleString()} km · Source: MoWT/DNR`}
          navChips={[{ label: 'Road Network', view: 'roadnetwork' }]} />
        <KpiCard label="Paved Roads" value={String(net.pavedKm)} unit="km" color={C.green}
          tooltip={`${net.pavedKm.toLocaleString()} km paved (bituminous) · ${net.pavedPct}% of mapped GeoJSON · Source: network2026.geojson`}
          navChips={[{ label: 'Condition Map', view: 'roadcondition' }, { label: 'Traffic', view: 'traffic' }]} />
        <KpiCard label="Paved %" value={String(net.pavedPct)} unit="%" color={C.teal}
          tooltip={`Paved share = ${net.pavedKm.toLocaleString()} / ${net.totalKm.toLocaleString()} km · NDP IV target: 35% by 2030`}
          navChips={[{ label: 'Lifecycle', view: 'lifecycle' }]} />
        <KpiCard label="Structures" value={String(net.totalBridges)} unit="" color={C.blue}
          tooltip={`${net.totalBridges} bridges and culverts registered in BMS · Source: bridges2026.geojson`}
          navChips={[{ label: 'BMS', view: 'bms' }]} />
        <KpiCard label="ATC Stations" value="25" unit="active" color={C.purple}
          tooltip="25 ATC stations total: 15 legacy (2016–2022) + 10 new (2025+) · Plus 298 manual TIS stations"
          navChips={[{ label: 'Traffic TIS', view: 'traffic' }]} />
        <KpiCard label="Data Sources" value="150" unit="+" color={C.yellow}
          tooltip="150+ catalogued data sources across 4 categories: surveys, studies, policy, GIS"
          navChips={[{ label: 'Sources', view: 'sources' }]} />
      </div>

      {/* Network consistency banner */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center',
        background: 'rgba(0,245,255,0.04)', border: '1px solid rgba(0,245,255,0.1)',
        borderRadius: 8, padding: '8px 14px', marginBottom: 16, fontSize: 10,
      }}>
        <span style={{ color: 'rgba(148,163,184,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: 6 }}>Network Figures</span>
        <span style={{ color: '#00f5ff', fontWeight: 800 }}>Official: 21,302 km</span>
        <span style={{ color: 'rgba(148,163,184,0.35)', margin: '0 6px' }}>|</span>
        <span style={{ color: 'rgba(148,163,184,0.7)' }}>Source: NDPIV FY25-26 (MoWT)</span>
        <span style={{ color: 'rgba(148,163,184,0.35)', margin: '0 6px' }}>|</span>
        <span style={{ color: '#00d4aa', fontWeight: 800 }}>Mapped in GeoJSON: {net.totalKm.toLocaleString()} km ({net.totalLinks} links)</span>
        <span style={{ color: 'rgba(148,163,184,0.35)', margin: '0 6px' }}>|</span>
        <span style={{ color: '#ffd23f' }}>Gap: {(21302 - net.totalKm).toLocaleString()} km (unmapped/rural)</span>
        <span style={{ color: 'rgba(148,163,184,0.35)', margin: '0 6px' }}>|</span>
        <span style={{ color: 'rgba(148,163,184,0.5)', fontSize: 9 }}>Condition % based on surveyed links only</span>
      </div>

      {/* Module health + quick-links */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

        {/* System Health */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, color: C.cyan,
            marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            System Health — Module Status
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {MODULE_HEALTH.map(m => {
              const color = m.status === 'ok' ? C.green : m.status === 'warn' ? C.yellow : C.gray;
              const Icon  = m.status === 'ok' ? CheckCircle : m.status === 'warn' ? AlertCircle : XCircle;
              return (
                <button key={m.id} onClick={() => navigate(m.view)} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px', borderRadius: 9,
                  background: `rgba(${rgb(color)},0.05)`,
                  border: `1px solid rgba(${rgb(color)},0.15)`,
                  cursor: 'pointer', textAlign: 'left',
                }}>
                  <Icon size={14} style={{ color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#d4dde8' }}>{m.name}</div>
                    <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.7)', marginTop: 1 }}>{m.note}</div>
                  </div>
                  <ArrowRight size={11} style={{ color: 'rgba(100,116,139,0.4)', flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick-links grid */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, color: C.cyan,
            marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Quick Navigation — All Modules
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Network Overview',    icon: <Globe size={14}/>,        view: 'network' as ActiveView,   color: C.blue   },
              { label: 'Pavement Mgmt (PMS)', icon: <Activity size={14}/>,     view: 'roadcondition' as ActiveView, color: C.orange },
              { label: 'Bridge Mgmt (BMS)',   icon: <Network size={14}/>,      view: 'bms' as ActiveView,       color: C.blue   },
              { label: 'Traffic Info (TIS)',  icon: <TrendingUp size={14}/>,   view: 'traffic' as ActiveView,   color: C.cyan   },
              { label: 'HDM-4 Analysis',      icon: <BarChart3 size={14}/>,    view: 'hdm4' as ActiveView,      color: C.purple },
              { label: 'NDPIV / Projects',    icon: <Layers size={14}/>,       view: 'projects' as ActiveView,  color: C.green  },
              { label: 'Budget & Maint.',     icon: <Database size={14}/>,     view: 'budget' as ActiveView,    color: C.yellow },
              { label: 'Lifecycle Mgmt',      icon: <Shield size={14}/>,       view: 'lifecycle' as ActiveView, color: C.teal   },
              { label: 'Sources & Evidence',  icon: <BookOpen size={14}/>,     view: 'sources' as ActiveView,   color: C.gray   },
            ].map(q => (
              <button key={q.view} onClick={() => navigate(q.view)} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 13px', borderRadius: 8,
                background: `rgba(${rgb(q.color)},0.06)`,
                border: `1px solid rgba(${rgb(q.color)},0.2)`,
                cursor: 'pointer', color: '#d4dde8', fontSize: 11, fontWeight: 600,
              }}>
                <span style={{ color: q.color }}>{q.icon}</span>
                <span>{q.label}</span>
                <ArrowRight size={10} style={{ color: 'rgba(100,116,139,0.4)', marginLeft: 'auto' }} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Unused legacy functions (kept to avoid breaking potential external references) ──

function RMSArchitecture({ navigate }: { navigate: (v: ActiveView) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div style={{ padding: '12px 14px' }}>
      <style>{`
        @keyframes flowDown { 0%,100%{opacity:0.3;transform:translateY(0)} 50%{opacity:1;transform:translateY(6px)} }
        @keyframes glow { 0%,100%{box-shadow:none} 50%{box-shadow:0 0 18px rgba(0,245,255,0.25)} }
      `}</style>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#e2eaf4' }}>RMS Functional Architecture</div>
        <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.65)', marginTop: 2 }}>
          5-tier architecture used in global road management systems — click a tier to navigate to the corresponding module
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {TIERS.map((tier, i) => {
          const col = TIER_COLORS[i];
          const isHov = hovered === i;
          return (
            <div key={tier.num}>
              <button
                onClick={() => navigate(tier.view)}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  width: '100%', textAlign: 'left', cursor: 'pointer',
                  background: isHov ? `rgba(${rgb(col)},0.12)` : `rgba(${rgb(col)},0.06)`,
                  border: `1px solid rgba(${rgb(col)},${isHov ? 0.5 : 0.2})`,
                  borderRadius: 12, padding: '14px 18px',
                  transition: 'all 0.18s',
                  animation: isHov ? 'glow 1.5s ease-in-out infinite' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: `rgba(${rgb(col)},0.15)`,
                    border: `2px solid rgba(${rgb(col)},0.4)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 900, color: col,
                  }}>{tier.num}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: col }}>{tier.name}</div>
                    <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.7)', marginTop: 2 }}>{tier.desc}</div>
                  </div>
                  <ArrowRight size={14} style={{ color: col, flexShrink: 0 }} />
                </div>
                {isHov && (
                  <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 5, paddingLeft: 50 }}>
                    {tier.tools.map(t => <Chip key={t} label={t} color={col} />)}
                  </div>
                )}
              </button>

              {i < TIERS.length - 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    animation: 'flowDown 1.8s ease-in-out infinite',
                    animationDelay: `${i * 0.3}s`,
                  }}>
                    <div style={{ width: 2, height: 12, background: `rgba(${rgb(TIER_COLORS[i])},0.4)` }} />
                    <div style={{
                      width: 0, height: 0,
                      borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
                      borderTop: `8px solid rgba(${rgb(TIER_COLORS[i])},0.4)`,
                    }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GlobalCaseStudies() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [regionFilter, setRegionFilter] = useState<'All' | 'Africa' | 'Europe' | 'Asia-Pacific' | 'Americas'>('All');

  const REGIONS: Record<string, 'Africa' | 'Europe' | 'Asia-Pacific' | 'Americas'> = {
    Tanzania: 'Africa', Kenya: 'Africa', Rwanda: 'Africa', Ghana: 'Africa', Ethiopia: 'Africa',
    'South Africa': 'Africa',
    'United Kingdom': 'Europe', Sweden: 'Europe', Netherlands: 'Europe',
    Australia: 'Asia-Pacific', 'New Zealand': 'Asia-Pacific', Japan: 'Asia-Pacific', India: 'Asia-Pacific',
    USA: 'Americas', Brazil: 'Americas',
  };

  const filtered = CASE_STUDIES.filter(cs =>
    regionFilter === 'All' || REGIONS[cs.country] === regionFilter,
  );

  return (
    <div style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#e2eaf4' }}>National RMS Case Studies</div>
          <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.65)', marginTop: 2 }}>
            {CASE_STUDIES.length} countries analysed — click any card to expand &amp; see applicability to DNR
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {(['All', 'Africa', 'Europe', 'Asia-Pacific', 'Americas'] as const).map(r => (
            <button key={r} onClick={() => setRegionFilter(r)} style={{
              fontSize: 9, padding: '4px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
              fontWeight: 700,
              background: regionFilter === r ? 'rgba(0,245,255,0.15)' : 'rgba(255,255,255,0.04)',
              color: regionFilter === r ? C.cyan : 'rgba(148,163,184,0.6)',
            }}>{r} {r === 'All' ? `(${CASE_STUDIES.length})` : `(${CASE_STUDIES.filter(cs => REGIONS[cs.country] === r).length})`}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
        {filtered.map(cs => {
          const isOpen = expanded === cs.id;
          const region = REGIONS[cs.country];
          const regCol = region === 'Africa' ? C.green : region === 'Europe' ? C.blue : region === 'Asia-Pacific' ? C.cyan : C.orange;
          return (
            <div key={cs.id} style={{
              background: 'rgba(8,14,28,0.7)',
              border: `1px solid ${isOpen ? `rgba(${rgb(regCol)},0.4)` : 'rgba(255,255,255,0.07)'}`,
              borderRadius: 12, overflow: 'hidden',
              transition: 'border-color 0.15s',
            }}>
              <button onClick={() => setExpanded(isOpen ? null : cs.id)} style={{
                width: '100%', textAlign: 'left', background: 'none', border: 'none',
                cursor: 'pointer', padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22 }}>{cs.flag}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 900, color: '#e2eaf4' }}>{cs.agency}</span>
                      <Chip label={region} color={regCol} />
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.65)', marginTop: 2 }}>
                      {cs.country} · {cs.networkKm.toLocaleString()} km · {cs.system}
                    </div>
                  </div>
                  <ArrowRight size={12} style={{ color: 'rgba(100,116,139,0.4)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                </div>
              </button>

              {isOpen && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 9, fontWeight: 900, color: regCol, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Key Features</div>
                    {cs.keyFeatures.map(f => (
                      <div key={f} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                        <span style={{ color: regCol, flexShrink: 0, marginTop: 1 }}>▸</span>
                        <span style={{ fontSize: 10, color: 'rgba(196,210,225,0.8)', lineHeight: 1.5 }}>{f}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 8, fontWeight: 900, color: 'rgba(100,116,139,0.6)', textTransform: 'uppercase', marginBottom: 4 }}>Data Approach</div>
                      <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.8)', lineHeight: 1.5 }}>{cs.dataApproach}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 8, fontWeight: 900, color: 'rgba(100,116,139,0.6)', textTransform: 'uppercase', marginBottom: 4 }}>Metrics Achieved</div>
                      <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.8)', lineHeight: 1.5 }}>{cs.metrics}</div>
                    </div>
                  </div>

                  <div style={{
                    marginTop: 12, background: `rgba(${rgb(regCol)},0.06)`,
                    border: `1px solid rgba(${rgb(regCol)},0.2)`,
                    borderRadius: 10, padding: '10px 13px',
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 900, color: regCol, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                      How This Applies to DNR
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(196,210,225,0.85)', lineHeight: 1.6 }}>{cs.lessonsDNR}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StandardsEvidence() {
  return (
    <div style={{ padding: '12px 14px' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: '#e2eaf4', marginBottom: 14 }}>
          International Standards &amp; Frameworks
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 10 }}>
          {STANDARDS.map(s => (
            <div key={s.code} style={{
              background: `rgba(${rgb(s.color)},0.05)`,
              border: `1px solid rgba(${rgb(s.color)},0.2)`,
              borderRadius: 11, padding: '13px 16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{
                  fontSize: 9, padding: '2px 8px', borderRadius: 4, fontWeight: 900,
                  background: `rgba(${rgb(s.color)},0.18)`, color: s.color,
                }}>{s.code}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#e2eaf4' }}>{s.name}</span>
              </div>
              <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.6)', marginBottom: 5 }}>
                <strong style={{ color: 'rgba(148,163,184,0.7)' }}>Issuing Body:</strong> {s.body}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.65)', marginBottom: 5, lineHeight: 1.5 }}>
                <strong style={{ color: 'rgba(148,163,184,0.7)' }}>Scope:</strong> {s.scope}
              </div>
              <div style={{ fontSize: 10, color: `rgba(${rgb(s.color)},0.9)`, lineHeight: 1.55 }}>
                <strong>DNR Relevance:</strong> {s.relevance}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 900, color: '#e2eaf4', marginBottom: 14 }}>
          Key Publications &amp; Research Papers
        </div>
        <div style={{ background: 'rgba(8,14,28,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr style={{ background: 'rgba(8,14,28,0.9)' }}>
                {['Ref', 'Title', 'Authors', 'Year', 'Publisher', 'DNR Relevance'].map(h => (
                  <th key={h} style={{
                    padding: '9px 12px', textAlign: 'left',
                    fontSize: 8, fontWeight: 900, color: 'rgba(0,245,255,0.65)',
                    textTransform: 'uppercase', letterSpacing: '0.09em',
                    borderBottom: '1px solid rgba(0,245,255,0.1)',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PUBLICATIONS.map((p, i) => (
                <tr key={p.id} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,245,255,0.08)', color: C.cyan, fontWeight: 800 }}>{p.id}</span>
                  </td>
                  <td style={{ padding: '8px 12px', minWidth: 240, maxWidth: 320, color: '#d4dde8', fontWeight: 600, lineHeight: 1.4 }}>{p.title}</td>
                  <td style={{ padding: '8px 12px', color: 'rgba(148,163,184,0.7)', whiteSpace: 'nowrap', fontSize: 9 }}>{p.authors}</td>
                  <td style={{ padding: '8px 12px', color: 'rgba(148,163,184,0.6)', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{p.year}</td>
                  <td style={{ padding: '8px 12px', color: 'rgba(100,116,139,0.7)', fontSize: 9, minWidth: 140 }}>{p.publisher}</td>
                  <td style={{ padding: '8px 12px', color: 'rgba(196,210,225,0.75)', fontSize: 9, minWidth: 200, lineHeight: 1.4 }}>{p.relevance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 10, fontSize: 9, color: 'rgba(100,116,139,0.5)', textAlign: 'right' }}>
          Full bibliography available in Sources &amp; Evidence Catalogue — {PUBLICATIONS.length} key references shown above
        </div>
      </div>
    </div>
  );
}

const UNRA_LAYERS = [
  {
    num: 1,
    label: 'Data Collection Layer',
    color: C.cyan,
    desc: 'Field surveys, sensor data, and inspection activities that generate raw asset data',
    tools: [
      'Road Inventory Surveys (visual + GPS)',
      'ROMDAS Pavement Condition Surveys (IRI, rutting, cracking)',
      'Traffic Counts: ATC (25 stations) + TIS (298 manual stations)',
      'Bridge Visual & Structural Inspections',
      'Weighbridge WIM data (axle load, overloading)',
      'FWD Deflection Testing (structural capacity)',
      'Satellite / Drone Aerial Surveys',
    ],
    view: 'roadcondition' as ActiveView,
    manual: 'UNRA_AssetManagementSystem_2_RoadDataCollection_0.1',
  },
  {
    num: 2,
    label: 'Central Road Database (CRD)',
    color: C.blue,
    desc: 'Single source of truth: all network data persisted in a geospatially referenced database',
    tools: [
      'Road Network GeoJSON (1,013 links, 21,302 km)',
      'Road Inventory: class, surface, width, drainage',
      'Pavement Condition Records (IRI, distress by link)',
      'Traffic Data: AADT by vehicle class, seasonal factors',
      'Bridge & Culvert Registry (1,019 structures)',
      'Maintenance History & Works Records',
      'Location Referencing System (LRS / chainage)',
    ],
    view: 'roadnetwork' as ActiveView,
    manual: 'UNRA_AssetManagementSystem_1_LocationReferencing_0.1',
  },
  {
    num: 3,
    label: 'Analysis & Modelling Layer',
    color: C.purple,
    desc: 'Analytical engines that convert raw data into condition forecasts, priorities and costs',
    tools: [
      'HDM-4 Pavement Deterioration & Strategy Analysis',
      'ML Multi-Task IRI Prediction (PyTorch, R²=0.93)',
      'Bridge Condition Scoring & Priority Ranking',
      'Traffic Growth & Demand Forecasting (2016–2040)',
      'ESAL / Overloading Structural Damage Model (SATCC TRH4)',
      'Life Cycle Cost Analysis (NPV, 40-year horizon)',
      'Budget Optimisation (multi-year programming)',
    ],
    view: 'hdm4' as ActiveView,
    manual: 'UNRA_AssetManagementSystem_3_RMS_User_Manual_2017',
  },
  {
    num: 4,
    label: 'Planning & Programming Layer',
    color: C.green,
    desc: 'Translates analysis outputs into prioritised, budgeted works programmes',
    tools: [
      'Annual Work Programme (AWP) generation',
      'Medium Term Expenditure Framework (MTEF) 3-year rolling',
      'NDP IV Investment Pipeline (priority corridors)',
      'OPRC Contract Management (9 active lots)',
      'Maintenance Station Programme (23 stations)',
      'Emergency Works Identification & Response',
      'Road Reserve Management',
    ],
    view: 'projects' as ActiveView,
    manual: 'UNRA_AssetManagementSystem_5_PMS_User_Manual_2017',
  },
  {
    num: 5,
    label: 'Monitoring & Reporting Layer',
    color: C.orange,
    desc: 'Dashboards, KPIs, and statutory reports for management, MoWT, Parliament and the public',
    tools: [
      'Platform Dashboards (this application)',
      'Annual National Road Network Performance Report',
      'Network Health KPIs (% good/fair/poor, IRI trends)',
      'Budget Execution & Value-for-Money Reporting',
      'World Bank / AfDB Progress Reporting',
      'Public Road Condition Portal',
      'Data Quality Audit & QA Engine',
    ],
    view: 'rms' as ActiveView,
    manual: 'UNRA_AssetManagementSystem_20_RMS_Systems_Administration_Manual_2.0',
  },
];

const CONNECTIONS: { from: string; to: string; label: string }[] = [
  { from: 'Field surveys', to: 'Central RDB', label: 'Raw data → validated records' },
  { from: 'CRD condition data', to: 'HDM-4 engine', label: 'IRI/distress → deterioration forecast' },
  { from: 'HDM-4 outputs', to: 'AWP/MTEF', label: 'Priority interventions → programme' },
  { from: 'AWP', to: 'Performance KPIs', label: 'Executed works → outcome measurement' },
  { from: 'Traffic data', to: 'ESAL model', label: 'AADT + class → structural loading' },
  { from: 'Bridge inspections', to: 'BMS analysis', label: 'Condition ratings → priority score' },
];

function UNRARMSArchitecture({ navigate }: { navigate: (v: ActiveView) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div style={{ padding: '12px 14px', overflowY: 'auto' }}>
      <style>{`
        @keyframes unra-flow { 0%,100%{opacity:0.25;transform:translateY(-2px)} 50%{opacity:0.8;transform:translateY(4px)} }
        @keyframes unra-pulse { 0%,100%{opacity:0.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.05)} }
        @keyframes unra-entry { from{opacity:0;transform:translateX(-16px)} to{opacity:1;transform:translateX(0)} }
        @keyframes unra-dash  { from{stroke-dashoffset:20} to{stroke-dashoffset:0} }
        @keyframes unra-glow  { 0%,100%{box-shadow:0 0 8px currentColor} 50%{box-shadow:0 0 24px currentColor,0 0 48px currentColor} }
      `}</style>

      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#e2eaf4', marginBottom: 6 }}>
          UNRA Road Management System — Technical Architecture
        </div>
        <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.65)', lineHeight: 1.6, maxWidth: 760 }}>
          Based on the <strong style={{ color: C.cyan }}>UNRA Road Management System User Manual (2017)</strong> and
          the <strong style={{ color: C.cyan }}>Road Infrastructure Asset Management Policy (Dec 2017 v1.4)</strong>.
          The RMS implements a 5-layer architecture aligned with ISO 55001 asset management requirements.
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 22,
        background: 'rgba(0,245,255,0.03)', border: '1px solid rgba(0,245,255,0.1)',
        borderRadius: 12, padding: '12px 16px',
      }}>
        {CONNECTIONS.map((conn, i) => (
          <div key={i} style={{ fontSize: 9, color: 'rgba(148,163,184,0.65)', lineHeight: 1.5 }}>
            <div style={{ color: C.cyan, fontWeight: 700, marginBottom: 2 }}>{conn.from}</div>
            <div style={{ color: 'rgba(100,116,139,0.5)' }}>→ {conn.to}</div>
            <div style={{ color: 'rgba(148,163,184,0.5)', fontSize: 8, marginTop: 1 }}>{conn.label}</div>
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {UNRA_LAYERS.map((layer, i) => {
          const isHov = hovered === i;
          const isExp = expanded === i;
          const col = layer.color;
          const r = (h: string) => {
            const c = h.replace('#','');
            return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`;
          };
          return (
            <div key={layer.num} style={{
              animation: `unra-entry 0.35s ease forwards`,
              animationDelay: `${i * 80}ms`,
              opacity: 0,
            }}>
              <div
                onClick={() => setExpanded(isExp ? null : i)}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  background: isHov || isExp ? `rgba(${r(col)},0.1)` : `rgba(${r(col)},0.04)`,
                  border: `1px solid rgba(${r(col)},${isHov || isExp ? 0.55 : 0.2})`,
                  borderRadius: 12, padding: '14px 18px',
                  cursor: 'pointer', transition: 'all 0.18s',
                  boxShadow: isExp ? `0 0 24px rgba(${r(col)},0.15)` : (isHov ? `0 0 12px rgba(${r(col)},0.08)` : 'none'),
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: `rgba(${r(col)},0.15)`,
                    border: `2px solid rgba(${r(col)},0.5)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 900, color: col,
                    animation: isExp ? `unra-pulse 2s ease-in-out infinite` : 'none',
                    boxShadow: isExp ? `0 0 16px rgba(${r(col)},0.4)` : 'none',
                    transition: 'all 0.25s',
                  }}>{layer.num}</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: col, marginBottom: 3 }}>
                      {layer.label}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.7)', lineHeight: 1.45 }}>
                      {layer.desc}
                    </div>
                  </div>

                  <button
                    onClick={e => { e.stopPropagation(); navigate(layer.view); }}
                    style={{
                      padding: '6px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                      background: `rgba(${r(col)},0.12)`, border: `1px solid rgba(${r(col)},0.35)`,
                      color: col, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
                    }}>
                    Open Module →
                  </button>
                </div>

                {isExp && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid rgba(${r(col)},0.15)` }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: `rgba(${r(col)},0.8)`,
                      textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                      Components &amp; Tools
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 6 }}>
                      {layer.tools.map(tool => (
                        <div key={tool} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 7,
                          background: `rgba(${r(col)},0.06)`,
                          borderRadius: 7, padding: '7px 10px',
                        }}>
                          <span style={{ color: col, fontSize: 12, flexShrink: 0, lineHeight: 1.3 }}>▸</span>
                          <span style={{ fontSize: 10, color: 'rgba(196,210,225,0.85)', lineHeight: 1.5 }}>{tool}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 10, fontSize: 8.5, color: 'rgba(100,116,139,0.55)', fontStyle: 'italic' }}>
                      Reference: {layer.manual}
                    </div>
                  </div>
                )}
              </div>

              {i < UNRA_LAYERS.length - 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0' }}>
                  <svg width={24} height={28} viewBox="0 0 24 28" style={{ overflow: 'visible' }}>
                    <line x1={12} y1={0} x2={12} y2={20}
                      stroke={`rgba(${r(col)},0.5)`}
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      style={{ animation: `unra-dash 1.4s linear infinite`, animationDelay: `${i*0.3}s` }} />
                    <polygon points="6,18 18,18 12,28"
                      fill={`rgba(${r(col)},0.55)`}
                      style={{ animation: `unra-flow 2s ease-in-out infinite`, animationDelay: `${i*0.35}s` }} />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab 4: DNR RMS Engine Architecture Diagram ────────────────────────────────

interface ArchBoxProps {
  label: string;
  sub?: string;
  color: string;
  badge?: string;
  onClick?: () => void;
}

function ArchBox({ label, sub, color, badge, onClick }: ArchBoxProps) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? `rgba(${rgb(color)},0.14)` : `rgba(${rgb(color)},0.07)`,
        border: `1px solid rgba(${rgb(color)},${hov ? 0.55 : 0.25})`,
        borderRadius: 8, padding: '8px 10px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s, box-shadow 0.3s ease',
        boxShadow: hov ? `0 0 12px rgba(${rgb(color)},0.18), 0 0 12px #00bcd4` : 'none',
        position: 'relative',
      }}
    >
      {badge && (
        <span style={{
          position: 'absolute', top: -7, right: 8,
          fontSize: 7, padding: '1px 6px', borderRadius: 4, fontWeight: 900,
          background: `rgba(${rgb(color)},0.25)`, color,
          border: `1px solid rgba(${rgb(color)},0.4)`,
        }}>{badge}</span>
      )}
      <div style={{ fontSize: 10, fontWeight: 800, color, lineHeight: 1.35 }}>{label}</div>
      {sub && <div style={{ fontSize: 8.5, color: 'rgba(148,163,184,0.55)', marginTop: 3, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  );
}

function FlowArrow({ label, vertical = false }: { label?: string; vertical?: boolean }) {
  if (vertical) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, margin: '4px 0' }}>
        <svg width="2" height="14" style={{ display: 'block', overflow: 'visible' }}>
          <line x1="1" y1="0" x2="1" y2="14" stroke="rgba(148,163,184,0.35)" strokeWidth="2"
            strokeDasharray="4 3" style={{ animation: 'flowDash 2s linear infinite' }} />
        </svg>
        <div style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '5px solid rgba(148,163,184,0.25)' }} />
        {label && <div style={{ fontSize: 7, color: 'rgba(148,163,184,0.4)', whiteSpace: 'nowrap', marginTop: 1 }}>{label}</div>}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <svg style={{ flex: 1, height: 2, display: 'block', overflow: 'visible' }} viewBox="0 0 100 2" preserveAspectRatio="none">
        <line x1="0" y1="1" x2="100" y2="1" stroke="rgba(148,163,184,0.3)" strokeWidth="2"
          strokeDasharray="6 4" style={{ animation: 'flowDash 2s linear infinite' }} />
      </svg>
      <div style={{ width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: '5px solid rgba(148,163,184,0.25)' }} />
      {label && <div style={{ fontSize: 7, color: 'rgba(148,163,184,0.4)', whiteSpace: 'nowrap', marginLeft: 3 }}>{label}</div>}
    </div>
  );
}

function SectionHeader({ title, color }: { title: string; color: string }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em',
      color, padding: '5px 10px', borderRadius: '6px 6px 0 0', marginBottom: 8,
      background: `rgba(${rgb(color)},0.1)`,
      border: `1px solid rgba(${rgb(color)},0.2)`,
      borderBottom: 'none',
    }}>{title}</div>
  );
}

// Kept for reference but no longer wired to a tab (RMS Architecture tab removed).
export function DTIMSArchitecture({ navigate }: { navigate: (v: ActiveView) => void }) {
  // Auto-play staggered entrance animation when this tab/view mounts
  const [play, setPlay] = useState(false);
  useEffect(() => {
    setPlay(false);
    const t = setTimeout(() => setPlay(true), 60);
    return () => clearTimeout(t);
  }, []);

  const colAnim = (delay: string) => ({
    opacity: play ? undefined : 0,
    animation: play ? `fadeSlideIn 0.5s ease forwards` : 'none',
    animationDelay: delay,
  });

  return (
    <div style={{ padding: '12px 14px', overflowY: 'auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#e2eaf4', marginBottom: 4 }}>
          DNR Road Management Engine — System Architecture
        </div>
        <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)', lineHeight: 1.6, maxWidth: 820 }}>
          Interactive diagram of the DNR Road Management Engine (RMS) data architecture replacing traditional dTIMS functionality with an integrated ML-powered RMS.
          Click any component box to navigate to the corresponding platform module.
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['DNR RMS Engine', 'HDM-4', 'BMS', 'GIS Integrated', 'ML-Powered'].map(t => (
            <Chip key={t} label={t} color={C.cyan} />
          ))}
        </div>
      </div>

      {/* 3-column architecture grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1.2fr 1fr',
        gap: 16,
        alignItems: 'start',
      }}>

        {/* ── LEFT: Data Collection ─────────────────────────────────────────── */}
        <div style={colAnim('0s')}>
          <SectionHeader title="Data Collection" color="#7ec8e3" />
          <div style={{
            border: '1px solid rgba(126,200,227,0.2)',
            borderRadius: '0 0 10px 10px',
            padding: '12px 10px',
            background: 'rgba(126,200,227,0.03)',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {/* Traffic data group */}
            <div style={{
              border: '1px solid rgba(148,163,184,0.1)',
              borderRadius: 8, padding: '8px 10px',
              background: 'rgba(255,255,255,0.02)',
            }}>
              <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.45)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.08em' }}>Traffic Data</div>
              <ArchBox label="Traffic Count Sheets + Axle Load Surveys" color={C.blue} />
              <FlowArrow vertical label="Manual Entry" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <ArchBox label="Spreadsheets" sub="Summary Data" color={C.blue} />
                <ArchBox label="WIM + ATC" sub="Detailed Data" color={C.blue} onClick={() => navigate('traffic')} />
              </div>
            </div>

            {/* Road inventory */}
            <ArchBox
              label="Road Inventory"
              sub="Visual Condition · Roughness · GPS · Video · FWD/DCP · Photographs"
              color={C.teal}
              onClick={() => navigate('roadcondition')}
            />

            {/* Bridge data */}
            <div style={{
              border: '1px solid rgba(148,163,184,0.1)',
              borderRadius: 8, padding: '8px 10px',
              background: 'rgba(255,255,255,0.02)',
            }}>
              <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.45)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.08em' }}>Bridge Data</div>
              <ArchBox label="Bridge Inventory + Bridge Inspections" color={C.purple} onClick={() => navigate('bms')} />
              <FlowArrow vertical />
              <ArchBox label="BMS" sub="Bridge Management System" color={C.purple} badge="BMS" onClick={() => navigate('bms')} />
            </div>

            {/* Accidents */}
            <div style={{
              border: '1px solid rgba(148,163,184,0.1)',
              borderRadius: 8, padding: '8px 10px',
              background: 'rgba(255,255,255,0.02)',
            }}>
              <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.45)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.08em' }}>Safety Data</div>
              <ArchBox label="Traffic Accident Sheets" color={C.orange} />
              <FlowArrow vertical />
              <ArchBox label="Traffic Accident System" color={C.orange} />
            </div>
          </div>
        </div>

        {/* ── CENTER: Data Management ───────────────────────────────────────── */}
        <div style={colAnim('0.15s')}>
          <SectionHeader title="Data Management" color="#a8d5a2" />
          <div style={{
            border: '1px solid rgba(168,213,162,0.2)',
            borderRadius: '0 0 10px 10px',
            padding: '12px 10px',
            background: 'rgba(168,213,162,0.02)',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>

            {/* TIS */}
            <div>
              <ArchBox
                label="TIS — Traffic Information System"
                sub="AADT, ESALs, Traffic Growth, Axle Load Statistics"
                color={C.cyan}
                badge="TIS"
                onClick={() => navigate('traffic')}
              />
              <div style={{ fontSize: 8, color: 'rgba(0,245,255,0.4)', marginTop: 3, paddingLeft: 4 }}>
                ← AADT / ESALs from Traffic Data
              </div>
            </div>

            <FlowArrow vertical label="Road Network Characteristics" />

            {/* Central DNR Asset Management Database — prominent */}
            <div style={{
              background: 'rgba(0,245,255,0.06)',
              border: '2px solid rgba(0,245,255,0.35)',
              borderRadius: 12,
              padding: '14px 14px',
              boxShadow: '0 0 24px rgba(0,245,255,0.1)',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                fontSize: 7, padding: '2px 8px', borderRadius: 4, fontWeight: 900,
                background: 'rgba(0,245,255,0.2)', color: C.cyan,
                border: '1px solid rgba(0,245,255,0.4)',
                whiteSpace: 'nowrap',
              }}>CENTRAL DATABASE</div>
              <div style={{ fontSize: 12, fontWeight: 900, color: C.cyan, textAlign: 'center', marginBottom: 4 }}>
                DNR Asset Management Database
              </div>
              <div style={{ fontSize: 9, color: 'rgba(0,245,255,0.6)', textAlign: 'center', lineHeight: 1.5 }}>
                DNR Road Management Engine · Integrated Asset DB · ML-Powered
              </div>
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
                {['Road Network', 'Condition Data', 'Traffic Data', 'Structures', 'Maintenance History'].map(t => (
                  <Chip key={t} label={t} color={C.cyan} />
                ))}
              </div>
            </div>

            <FlowArrow vertical label="Works Programs + Completed Projects" />

            {/* BMS centre */}
            <ArchBox
              label="BMS — Bridge Management System"
              sub="Structure ratings, priority scores, works programme"
              color={C.purple}
              badge="BMS"
              onClick={() => navigate('bms')}
            />

            <FlowArrow vertical />

            {/* GIS */}
            <ArchBox
              label="GIS — Geographic Information System"
              sub="Network GeoJSON · Spatial analysis · Map outputs"
              color={C.teal}
              onClick={() => navigate('gismap')}
            />

            <FlowArrow vertical />

            {/* RMS Reporting */}
            <ArchBox
              label="RMS Reporting Module"
              sub="Annual reports · KPIs · Performance dashboards"
              color={C.green}
              onClick={() => navigate('rms')}
            />
          </div>
        </div>

        {/* ── RIGHT: Planning & Programming ─────────────────────────────────── */}
        <div style={colAnim('0.3s')}>
          <SectionHeader title="Planning & Programming" color="#f4a261" />
          <div style={{
            border: '1px solid rgba(244,162,97,0.2)',
            borderRadius: '0 0 10px 10px',
            padding: '12px 10px',
            background: 'rgba(244,162,97,0.02)',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ fontSize: 8, color: 'rgba(244,162,97,0.5)', marginBottom: 2, fontStyle: 'italic' }}>
              Receives Road Network Characteristics + Works Programs
            </div>

            <ArchBox
              label="LCCA — DNR RMS Life Cycle Cost Analysis"
              sub="Roads + Bridges · 40-year NPV horizon"
              color={C.orange}
              onClick={() => navigate('hdm4')}
            />

            <ArchBox
              label="HDM-4 — Highway Development and Management"
              sub="Strategy analysis · Project prioritisation · ESAL modelling"
              color={C.yellow}
              onClick={() => navigate('hdm4')}
            />

            <ArchBox
              label="RED — Roads Economic Decision Model"
              sub="Economic appraisal for low-volume roads"
              color={C.orange}
            />

            <ArchBox
              label="ROMAPS — Routine Maintenance & Planning System"
              sub="AWP generation · Maintenance station programming"
              color={C.teal}
              onClick={() => navigate('budget')}
            />

            <ArchBox
              label="Road Proclamation System"
              sub="Gazettement · Road class amendments · Reserve management"
              color={C.blue}
              onClick={() => navigate('projects')}
            />

            <ArchBox
              label="Project Control System"
              sub="NDP IV pipeline · OPRC contracts · Financial progress"
              color={C.green}
              onClick={() => navigate('projects')}
            />
          </div>
        </div>
      </div>

      {/* Flow legend */}
      <div style={{
        marginTop: 20, padding: '12px 16px', borderRadius: 10,
        background: 'rgba(148,163,184,0.04)', border: '1px solid rgba(148,163,184,0.1)',
        display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center',
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Flow Legend
        </div>
        {[
          { label: 'Left → Centre: Raw survey data feeds DNR Road Management Engine', color: C.blue },
          { label: 'Centre → Right: Road network characteristics + works programs to planning tools', color: C.green },
          { label: 'BMS data → DNR RMS: Bridge condition and priority scores', color: C.purple },
          { label: 'Click any box to open the relevant platform module', color: C.cyan },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: `rgba(${rgb(item.color)},0.6)`, flexShrink: 0 }} />
            <span style={{ fontSize: 9, color: 'rgba(148,163,184,0.6)' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview'      as const, label: 'Overview',          icon: <LayoutDashboard size={13}/> },
  { id: 'roadmap'       as const, label: 'Road Network Map',  icon: <Map size={13}/> },
  { id: 'inventory'     as const, label: 'Road Inventory',    icon: <Database size={13}/> },
  { id: 'networkstory'  as const, label: 'Network Story',     icon: <BookOpen size={13}/> },
];
type TabId = typeof TABS[number]['id'];

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%',
        border: '2px solid rgba(75,99,130,0.4)', borderTopColor: '#4d9fff',
        animation: 'rms-spin 0.8s linear infinite' }} />
    </div>
  );
}

export default function RMSSection() {
  const { navigate } = useBMS();
  const [tab, setTab] = useState<TabId>('overview');

  const isFullHeight = tab === 'roadmap' || tab === 'networkstory';
  const contentStyle: React.CSSProperties = isFullHeight
    ? { flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }
    : { flex: 1, minHeight: 0, overflowY: 'auto' };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'rgba(2,5,8,0.97)',
      fontFamily: "'Inter','Segoe UI',sans-serif",
    }}>
      <style>{`
        @keyframes rms-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes Activity { 0%,100%{opacity:0.7} 50%{opacity:1} }
      `}</style>

      <CrossLinkChipBar sectionId="rms" />

      {/* Main tab bar */}
      <div style={{
        display: 'flex', gap: 2, padding: '0 14px', flexShrink: 0,
        borderBottom: '1px solid rgba(0,245,255,0.15)',
        background: 'rgba(4,9,18,0.85)',
      }}>
        {TABS.map(t => {
          const isActive = t.id === tab;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px 11px', fontSize: 11, fontWeight: isActive ? 800 : 500,
              background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
              color: isActive ? '#00f5ff' : 'rgba(148,163,184,0.70)',
              borderBottom: isActive ? '2px solid #00f5ff' : '2px solid transparent',
              transition: 'all 0.13s',
            }}>
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', paddingRight: 4 }}>
          <Chip label="RMS v4.0 · FY25-26" color={C.cyan} />
        </div>
      </div>

      {/* Content */}
      <div style={contentStyle}>

        {tab === 'overview' && (
          <RMSDashboard navigate={navigate} />
        )}

        {tab === 'roadmap' && (
          <Suspense fallback={<Spinner />}>
            <div style={{ position: 'absolute', inset: 0 }}>
              <NET_RoadNetworkView />
            </div>
          </Suspense>
        )}

        {tab === 'inventory' && (
          <Suspense fallback={<Spinner />}>
            <RMS_RoadInventory />
          </Suspense>
        )}

        {tab === 'networkstory' && (
          <Suspense fallback={<Spinner />}>
            <div style={{ position: 'absolute', inset: 0 }}>
              <NET_NetworkStory />
            </div>
          </Suspense>
        )}

      </div>
    </div>
  );
}
