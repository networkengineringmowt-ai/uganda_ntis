/**
 * GlobalCaseStudiesSection — Global Road Management System Case Studies
 * 4 tabs: World Map | Case Studies | Comparative Analytics | Lessons & Recommendations
 * Visual language: dark neon glass, ESRI satellite tiles, recharts 3D bars
 */

import { useState, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { Globe, BarChart3, BookOpen, Lightbulb, Search, Download, Grid } from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Legend as ReChartLegend,
} from 'recharts';
import { ESRI_TILE_URLS, ESRI_ATTRIBUTIONS } from '../../shared/mapSymbols';
import { WaterLayers } from '../../shared/WaterLayers';
import { Chart3DWrap, Bar3D, TT_NEON, TICK } from '../../lib/chart3d';

// ── Colour helpers ────────────────────────────────────────────────────────────

function hexRgb(h: string): string {
  const c = h.replace('#', '');
  return `${parseInt(c.slice(0, 2), 16)},${parseInt(c.slice(2, 4), 16)},${parseInt(c.slice(4, 6), 16)}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CaseStudy {
  id: number;
  agency: string;
  country: string;
  flag: string;
  networkKm: number;
  system: string;
  pavedPct: number;
  rmsYears: number;
  budgetPerKmUsd: number;
  region: 'Africa' | 'Europe' | 'Asia-Pacific' | 'Americas' | 'Middle East';
  lat: number;
  lng: number;
  keyFeatures: string[];
  lessonsDNR: string;
  dataApproach: string;
  funding: string;
  metrics: string;
}

// ── Region colour map ─────────────────────────────────────────────────────────

const REGION_COLOR: Record<string, string> = {
  Africa: '#00ff88',
  Europe: '#4d9fff',
  'Asia-Pacific': '#ffd23f',
  Americas: '#ff6b35',
  'Middle East': '#b967ff',
};

// ── Case studies data — 150+ countries ───────────────────────────────────────

const CASE_STUDIES: CaseStudy[] = [
  // ── Detailed entries (original 15) ──────────────────────────────────────────
  {
    id: 1, agency: 'TANROADS', country: 'Tanzania', flag: '🇹🇿',
    networkKm: 35000, system: 'RAMS/HDM-4', pavedPct: 29, rmsYears: 15,
    budgetPerKmUsd: 18000, region: 'Africa', lat: -6.37, lng: 34.89,
    keyFeatures: [
      'HDM-4 calibrated to tropical heavy rainfall',
      'Annual ROMDAS surveys on trunk roads',
      'Performance-based road maintenance contracts (PBRMC)',
      'GIS linked to IFMIS',
    ],
    lessonsDNR: 'TANROADS demonstrated that HDM-4 calibration to local conditions reduced treatment cost estimates by 18%. DNR should prioritise Uganda-specific calibration for Class C and B roads.',
    dataApproach: 'Annual ROMDAS + manual condition assessments; Bentley OpenRoads Asset database; GIS portal.',
    funding: 'World Bank IDA, AfDB, GIZ, GoT',
    metrics: '68% paved in good/fair (2024); 12% reduction in road user costs 2018-2024',
  },
  {
    id: 2, agency: 'KeNHA', country: 'Kenya', flag: '🇰🇪',
    networkKm: 11189, system: 'RAMS + dTIMS CT', pavedPct: 74, rmsYears: 18,
    budgetPerKmUsd: 22000, region: 'Africa', lat: 0.02, lng: 37.91,
    keyFeatures: [
      'dTIMS CT for strategic analysis',
      'BMS covering 3,200+ bridges',
      'GPS-tracked maintenance gangs via mobile app',
      '48 WIM stations',
    ],
    lessonsDNR: "KeNHA's mobile data collection reduced survey costs by 40% and improved data frequency. DNR could adopt similar mobile-first approach for Class C/B network.",
    dataApproach: 'Continuous WIM monitoring; annual ROMDAS; bridge inspection database synced to RAMS.',
    funding: 'World Bank, AfDB, JICA, GoK',
    metrics: '74% paved serviceability ≥ 3.5 PSI; bridge safety compliance 89%',
  },
  {
    id: 3, agency: 'RTDA', country: 'Rwanda', flag: '🇷🇼',
    networkKm: 4700, system: 'RAMS + OPRC', pavedPct: 34, rmsYears: 12,
    budgetPerKmUsd: 28000, region: 'Africa', lat: -1.94, lng: 29.87,
    keyFeatures: [
      'Paved network grew 18% → 34% in 10 years',
      'Hybrid OPRC with real-time sensor enforcement',
      'GIS integrated with district planning',
      'Road safety audit in all approvals',
    ],
    lessonsDNR: "Rwanda's bundling of routine maintenance with emergency works under one OPRC contractor eliminated mobilisation delays. DNR's Lot 9 (Karamoja) should evaluate a similar bundled emergency-response clause.",
    dataApproach: 'Smartphone visual surveys by community monitors; drone for remote sections; annual ROMDAS for paved.',
    funding: 'World Bank, AfDB, EU, GoR',
    metrics: 'Avg IRI reduced 4.8 → 3.1 m/km (2015-2024); road sector GDP contribution +2.4%',
  },
  {
    id: 4, agency: 'SANRAL', country: 'South Africa', flag: '🇿🇦',
    networkKm: 21400, system: 'iRAMS', pavedPct: 92, rmsYears: 25,
    budgetPerKmUsd: 45000, region: 'Africa', lat: -28.47, lng: 24.68,
    keyFeatures: [
      'Whole-life cost optimisation across full network',
      'Automated LCCA per km for all treatments',
      'GPR for structural assessment',
      'Public road condition portal updated monthly',
    ],
    lessonsDNR: "SANRAL's iRAMS proved that publishing real-time condition data builds public trust. A simplified public dashboard from DNR would strengthen the case for maintenance funding.",
    dataApproach: 'Quarterly automated surveys; GPR structural assessment; climate risk overlays for flood/heat.',
    funding: 'National fiscus (toll revenue + fuel levy); bond-financed capital',
    metrics: '92% in acceptable condition; R3.2 benefit per R1 maintenance',
  },
  {
    id: 5, agency: 'Highways England', country: 'United Kingdom', flag: '🇬🇧',
    networkKm: 7800, system: 'HAPMS', pavedPct: 98, rmsYears: 30,
    budgetPerKmUsd: 180000, region: 'Europe', lat: 55.38, lng: -3.44,
    keyFeatures: [
      'Whole-life cost optimisation with 50-year horizon',
      'SCANNER surveys every 2 years on 100% of network',
      'Risk-based intervention (RBI) methodology',
      'Digital twins of major motorways',
    ],
    lessonsDNR: 'HAPMS demonstrates the value of long-horizon (10-15 year) rolling works programmes. DNR should develop a 10-year rolling maintenance programme using HDM-4 multi-year analysis.',
    dataApproach: 'SCANNER + surface skid resistance + structural GPR + deflectograph; HAPMS central database.',
    funding: 'Road Investment Strategy (RIS) — dedicated ring-fenced budget',
    metrics: '97.4% meeting serviceability standard; £6 return per £1 preventive maintenance',
  },
  {
    id: 6, agency: 'Austroads / DPTI', country: 'Australia', flag: '🇦🇺',
    networkKm: 33000, system: 'dTIMS CT', pavedPct: 88, rmsYears: 28,
    budgetPerKmUsd: 95000, region: 'Asia-Pacific', lat: -25.27, lng: 133.78,
    keyFeatures: [
      'dTIMS CT for strategic programming',
      'Evidence-based programming with uncertainty quantification',
      'Austroads AP-R series: 200+ research publications',
      'Climate adaptation guidelines',
    ],
    lessonsDNR: "The Austroads AP-R research series on low-volume roads is highly applicable to DNR's Class C network. AP-R359 on low-cost sealed roads and AP-R556 on unsealed roads translate directly to Uganda.",
    dataApproach: 'Annual road condition data by state agencies; aggregated nationally by Austroads; open data portal.',
    funding: 'State and federal funding; national productivity agreement',
    metrics: '88% meeting ride quality standard; A$4.2 VfM per A$1 maintenance',
  },
  {
    id: 7, agency: 'NZTA Waka Kotahi', country: 'New Zealand', flag: '🇳🇿',
    networkKm: 11000, system: 'ONRC + RAMM', pavedPct: 94, rmsYears: 22,
    budgetPerKmUsd: 120000, region: 'Asia-Pacific', lat: -40.90, lng: 174.89,
    keyFeatures: [
      'ONE Network Road Classification (ONRC)',
      'Risk-based prioritisation linking condition to failure consequence',
      'AMPs for every road controlling authority',
      'Resilience planning: flood/slip vulnerability',
    ],
    lessonsDNR: "NZTA's ONRC provides a useful framework for DNR to define differentiated service levels by road class (A/B/C) with explicit performance targets.",
    dataApproach: 'Annual network condition assessment; RAMM database; real-time incidents via Journey Planner API.',
    funding: 'National Land Transport Fund (fuel excise + RUC)',
    metrics: 'NZ$6.8 VfM per NZ$1 maintenance; 94% resilience target on SH network',
  },
  {
    id: 8, agency: 'FHWA / State DOTs', country: 'USA', flag: '🇺🇸',
    networkKm: 900000, system: 'FMIS/TAMP', pavedPct: 43, rmsYears: 35,
    budgetPerKmUsd: 85000, region: 'Americas', lat: 37.09, lng: -95.71,
    keyFeatures: [
      'Mandatory TAMPs for NHS',
      'Performance measures: IRI, cracking %, bridge condition',
      'FHWA INVEST sustainability tool',
      'Climate resilience framework',
    ],
    lessonsDNR: "MAP-21 requirement for states to publish TAMPs with 10-year horizon provides a strong legislative model. Uganda's Transport Infrastructure Act could be strengthened with similar mandatory AM plan requirements.",
    dataApproach: 'State-level PMS/BMS data aggregated to HPMS; NBI updated annually; publicly accessible.',
    funding: 'Federal Highway Trust Fund; IIJA Infrastructure Act',
    metrics: '43% NHS in good pavement condition (2023); IIJA targeting 10% improvement by 2030',
  },
  {
    id: 9, agency: 'NHAI / NRRDA', country: 'India', flag: '🇮🇳',
    networkKm: 145000, system: 'iRAM + RCMS', pavedPct: 62, rmsYears: 20,
    budgetPerKmUsd: 12000, region: 'Asia-Pacific', lat: 20.59, lng: 78.96,
    keyFeatures: [
      'PM Gati Shakti multi-modal national master plan',
      'RCMS for PMGSY rural roads',
      'Drone-based condition surveys at 30% lower cost',
      'NHAI One portal: real-time tolling & traffic',
    ],
    lessonsDNR: "India's PMGSY experience with RCMS for rural roads is highly relevant to DNR's Class C network. GIS-based maintenance monitoring with community participation provides a scalable model for Northern Uganda.",
    dataApproach: 'Annual surveys by NHAI-contracted firms; RCMS mobile app for rural roads; satellite change detection.',
    funding: 'Central Road Fund, NHAI bonds, WB/ADB/AIIB loans',
    metrics: '98% PMGSY connectivity target achieved; 62% NH in good condition (2024)',
  },
  {
    id: 10, agency: 'Trafikverket', country: 'Sweden', flag: '🇸🇪',
    networkKm: 98000, system: 'PMS + LCC', pavedPct: 91, rmsYears: 32,
    budgetPerKmUsd: 160000, region: 'Europe', lat: 60.13, lng: 18.64,
    keyFeatures: [
      'Long-term National Infrastructure Plan (12-year horizon)',
      'Full LCC over 40-year period',
      'Predictive maintenance using road weather stations',
      'Carbon-neutral target: new construction by 2030',
    ],
    lessonsDNR: "Sweden's integration of climate data into pavement deterioration models mirrors what DNR should do with Uganda's rainfall seasonality. The bi-modal rainfall pattern (MAM+OND) creates analogous cyclic damage.",
    dataApproach: 'Automated condition surveys twice yearly; 980 road weather stations; BIM models for major structures.',
    funding: 'Parliamentary appropriation; dedicated infrastructure fund',
    metrics: '91% main roads in acceptable condition; SEK 9.2 bn annual maintenance',
  },
  {
    id: 11, agency: 'Rijkswaterstaat', country: 'Netherlands', flag: '🇳🇱',
    networkKm: 5900, system: 'Predictive AMS', pavedPct: 99, rmsYears: 40,
    budgetPerKmUsd: 250000, region: 'Europe', lat: 52.13, lng: 5.29,
    keyFeatures: [
      'Asset health index (AHI) updated monthly per segment',
      'ML deterioration models on 30+ years of data',
      'Digital twin of entire motorway network',
      'Predictive maintenance reducing reactive works by 60%',
    ],
    lessonsDNR: "RWS's monthly AHI providing a single condition number per link is an excellent model for DNR — simplifying reporting to MoWT and Parliament while retaining full technical detail.",
    dataApproach: 'Continuous embedded pavement sensors + drone surveys + FWD; national road data warehouse with public API.',
    funding: 'Rijksbegroting (national budget); Infrastructure Fund',
    metrics: '99.2% availability; predictive maintenance savings €180m/yr',
  },
  {
    id: 12, agency: 'MLIT', country: 'Japan', flag: '🇯🇵',
    networkKm: 127000, system: 'Bridge Inspection Law + RMC', pavedPct: 78, rmsYears: 25,
    budgetPerKmUsd: 110000, region: 'Asia-Pacific', lat: 36.20, lng: 138.25,
    keyFeatures: [
      'Mandatory 5-year bridge inspection cycle (amended Road Act 2014)',
      '720,000 structures managed',
      'AI image recognition for crack detection',
      'Preventive maintenance target: 50% of all works by 2030',
    ],
    lessonsDNR: "Japan's legally mandated 5-year bridge inspection cycle provides a powerful legal framework model. DNR should advocate for a similar regulatory requirement in Uganda's Transport Infrastructure Act.",
    dataApproach: 'Digitised paper inspection to national DB; tablet/drone inspection apps; AI-assisted defect classification.',
    funding: 'Ministry of Finance road budget; local government grants; disaster prevention allocation',
    metrics: '78% bridges in good condition (2024, up from 59% in 2014); target 85% by 2030',
  },
  {
    id: 13, agency: 'DNIT', country: 'Brazil', flag: '🇧🇷',
    networkKm: 75000, system: 'SGEPT + CREMA', pavedPct: 64, rmsYears: 22,
    budgetPerKmUsd: 35000, region: 'Americas', lat: -14.24, lng: -51.93,
    keyFeatures: [
      'Performance-based concession on 22,000 km federal highways',
      'SGEPT national PMS',
      'SICRO standardised unit costs',
      'CREMA output-based contracts on 45% of federal network',
    ],
    lessonsDNR: "Brazil's CREMA contracts on dirt/gravel roads with performance standards for surface condition and drainage are a good model for DNR's Class C network in Northern Uganda.",
    dataApproach: 'Annual laser profilometer + video surveys; SGEPT shared with concession contractors via API; public SNV portal.',
    funding: 'CIDE fuel tax; BNDES development bank; private concession investment',
    metrics: '64% federal network in good/fair condition (2024); CREMA 18% cheaper than traditional works',
  },
  {
    id: 14, agency: 'GHA', country: 'Ghana', flag: '🇬🇭',
    networkKm: 15000, system: 'GHIAS', pavedPct: 58, rmsYears: 8,
    budgetPerKmUsd: 14000, region: 'Africa', lat: 7.95, lng: -1.02,
    keyFeatures: [
      'World Bank-funded RAMS (P164887) 2018-2022',
      '3 survey cycles: 2019, 2021, 2023',
      'OPRC pilots on A1 and A2 corridors',
      'Bridge inventory of 1,240 structures',
    ],
    lessonsDNR: "Ghana's GHIAS phased rollout starting with highest-traffic paved network reduced initial costs while building institutional capacity — matches DNR's current stage.",
    dataApproach: 'ROMDAS on paved; visual surveys on gravel; integrated into national GIS; shared annually with MRH.',
    funding: 'World Bank IDA (US$200m TSRP), AfDB, JICA, GoG Road Fund',
    metrics: '58% paved in good/fair; 22% reduction in avg roughness 2019-2023',
  },
  {
    id: 15, agency: 'ERA', country: 'Ethiopia', flag: '🇪🇹',
    networkKm: 130000, system: 'RRAMPS + HDM-4', pavedPct: 71, rmsYears: 10,
    budgetPerKmUsd: 9000, region: 'Africa', lat: 9.15, lng: 40.49,
    keyFeatures: [
      'AfDB-funded RAMS on 15,000 km Phase 1',
      'HDM-4 linked to 10-year investment plan',
      'Road Asset Management Policy 2021',
      'Performance-based maintenance on key corridors',
    ],
    lessonsDNR: "Ethiopia's RRAMPS phased approach — first establishing a condition baseline, then building the analysis framework, then linking to budget — matches DNR's current stage exactly.",
    dataApproach: 'Annual ROMDAS on paved; bi-annual visual on gravel; ERA survey vehicles with video and GPS.',
    funding: 'AfDB loan (UA 120m), World Bank, GoE Road Fund',
    metrics: '71% federal paved roads in good condition (2024); 35% reduction in maintenance backlog since 2019',
  },

  // ── Sub-Saharan Africa ───────────────────────────────────────────────────────
  { id:16, agency:'FERMA/FMWH', country:'Nigeria', flag:'🇳🇬', networkKm:35000, system:'NRAMP + HDM-4', pavedPct:49, rmsYears:8, budgetPerKmUsd:11000, region:'Africa', lat:9.08, lng:8.68,
    keyFeatures:['Federal Roads Maintenance Agency managing 35,000 km national network','OPRC pilots on Lagos–Ibadan and Abuja–Kaduna corridors'],
    lessonsDNR:'Nigeria\'s shift from input-based to OPRC on high-traffic corridors achieved 22% cost reduction — directly applicable to DNR\'s Class A corridors.',
    dataApproach:'Road condition survey vehicles + GPS; data shared with state road authorities', funding:'Federal Government + World Bank SURP', metrics:'49% federal network in good/fair (2024)' },

  { id:17, agency:'ANE', country:'Mozambique', flag:'🇲🇿', networkKm:30200, system:'RAMS + HDM-4', pavedPct:27, rmsYears:12, budgetPerKmUsd:10500, region:'Africa', lat:-18.67, lng:35.53,
    keyFeatures:['HDM-4 calibrated for tropical coastal conditions','Annual ROMDAS on paved national roads (N1–N14)'],
    lessonsDNR:'Mozambique\'s N1 corridor OPRC with built-in emergency response for cyclone damage is a model for DNR\'s Karamoja lot emergency works provisions.',
    dataApproach:'Annual laser profilometer; visual survey on unpaved; GIS database in Maputo', funding:'World Bank, AfDB, EU, GoM Road Fund', metrics:'27% paved; 62% N1 in good condition (2024)' },

  { id:18, agency:'DNA/INEA', country:'Angola', flag:'🇦🇴', networkKm:26000, system:'PMS + Bentley', pavedPct:24, rmsYears:7, budgetPerKmUsd:18000, region:'Africa', lat:-11.20, lng:17.87,
    keyFeatures:['Post-conflict reconstruction of 26,000 km national network','Bentley OpenRoads Asset management system'],
    lessonsDNR:'Angola\'s rapid network rebuild after conflict shows the importance of establishing a GIS baseline before procurement — DNR\'s GeoJSON provides exactly that foundation.',
    dataApproach:'Visual + GPS condition surveys; satellite imagery for remote sections', funding:'Government oil revenue + Chinese financing', metrics:'24% paved; 18,000 km under active maintenance' },

  { id:19, agency:'ZINARA/DDF', country:'Zimbabwe', flag:'🇿🇼', networkKm:18338, system:'RAMS', pavedPct:47, rmsYears:10, budgetPerKmUsd:8500, region:'Africa', lat:-19.02, lng:29.15,
    keyFeatures:['Toll-funded ZINARA road maintenance model','Annual condition survey using modified ROMDAS'],
    lessonsDNR:'Zimbabwe\'s toll-funded road maintenance model provides a revenue diversification lesson for DNR beyond fuel levy dependence.',
    dataApproach:'Annual visual + roughness surveys; toll stations linked to maintenance budgets', funding:'ZINARA toll revenue + GoZ', metrics:'47% paved in good/fair; UGX-equivalent fund growing' },

  { id:20, agency:'RDA Zambia', country:'Zambia', flag:'🇿🇲', networkKm:67000, system:'ROSY + HDM-4', pavedPct:25, rmsYears:13, budgetPerKmUsd:9200, region:'Africa', lat:-13.13, lng:27.85,
    keyFeatures:['Roads Development Agency managing 67,000 km network','Community Road Maintenance Scheme (CRMS) for rural roads'],
    lessonsDNR:'Zambia\'s CRMS — paying local communities to maintain rural Class C gravel roads — is highly adaptable to Uganda\'s Northern and Eastern low-volume road network.',
    dataApproach:'ROMDAS on paved trunk; visual on gravel; GIS inventory linked to budget', funding:'World Bank, AfDB, JICA, Road Development Levy', metrics:'25% paved; CRMS covering 8,400 km of rural roads' },

  { id:21, agency:'MoTPW Malawi', country:'Malawi', flag:'🇲🇼', networkKm:14600, system:'NRMP + HDM-4', pavedPct:28, rmsYears:9, budgetPerKmUsd:7800, region:'Africa', lat:-13.25, lng:34.30,
    keyFeatures:['AfDB-funded National Roads Management Programme','Road Fund Administration Board managing maintenance budget'],
    lessonsDNR:'Malawi\'s Road Fund Administration provides a governance model for independent maintenance budget management — relevant to DNR\'s MTEF planning.',
    dataApproach:'Annual visual condition surveys; data stored in Roads Authority PMS', funding:'World Bank, AfDB, Road Fund levy', metrics:'28% paved; 68% in maintainable condition' },

  { id:22, agency:'RAMSB Botswana', country:'Botswana', flag:'🇧🇼', networkKm:25798, system:'RAMSB', pavedPct:33, rmsYears:15, budgetPerKmUsd:21000, region:'Africa', lat:-22.33, lng:24.68,
    keyFeatures:['RAMSB — Roads Asset Management System Botswana — custom-built','Climate-adjusted deterioration models for semi-arid conditions'],
    lessonsDNR:'Botswana\'s climate-adjusted pavement models for arid heat cycles are instructive for Uganda\'s bi-modal rainfall calibration of HDM-4.',
    dataApproach:'Annual automated surveys + FWD deflection testing', funding:'Government of Botswana + diamond revenue', metrics:'33% paved; 74% of paved network in good condition' },

  { id:23, agency:'Roads Authority Namibia', country:'Namibia', flag:'🇳🇦', networkKm:48875, system:'HAMS', pavedPct:14, rmsYears:14, budgetPerKmUsd:12000, region:'Africa', lat:-22.96, lng:18.49,
    keyFeatures:['HAMS Highway Asset Management System','Extensive gravel network with annual blading programme (40,000+ km)'],
    lessonsDNR:'Namibia\'s annual motor grader blading programme on 40,000+ km of gravel roads — with performance targets per km — is the most applicable model for DNR\'s Class C unsealed roads.',
    dataApproach:'Annual visual + roughness on paved; GPS-tracked motor graders on gravel', funding:'Road Fund of Namibia + GoN', metrics:'14% paved; 82% gravel in maintainable condition' },

  { id:24, agency:'MoPublicWorks Lesotho', country:'Lesotho', flag:'🇱🇸', networkKm:5940, system:'PMS', pavedPct:20, rmsYears:6, budgetPerKmUsd:14000, region:'Africa', lat:-29.61, lng:28.23,
    keyFeatures:['Mountain road management for high-altitude network','Frost and erosion deterioration models'],
    lessonsDNR:'Lesotho\'s frost and erosion-adjusted pavement models are applicable to DNR\'s Kabale and Mt Elgon highland roads.',
    dataApproach:'Annual visual surveys; GIS database maintained at Ministry level', funding:'World Bank, SACU revenues', metrics:'20% paved; 65% in acceptable condition' },

  { id:25, agency:'Roads Dept Eswatini', country:'Eswatini', flag:'🇸🇿', networkKm:3594, system:'RAMPAS', pavedPct:41, rmsYears:7, budgetPerKmUsd:16500, region:'Africa', lat:-26.52, lng:31.47,
    keyFeatures:['Small network, high-quality data management','OPRC pilot on MR1 and MR3 main roads'],
    lessonsDNR:'Eswatini\'s small-network OPRC shows that performance contracts are viable even on shorter corridors — applicable to DNR\'s Urban Bypass OPRC lots.',
    dataApproach:'Annual ROMDAS + visual; shared SADC database', funding:'GoE + donor grants', metrics:'41% paved; 71% good/fair' },

  { id:26, agency:'MATP Madagascar', country:'Madagascar', flag:'🇲🇬', networkKm:31640, system:'GRIS + HDM-4', pavedPct:12, rmsYears:8, budgetPerKmUsd:6500, region:'Africa', lat:-18.77, lng:46.87,
    keyFeatures:['Cyclone-resilient road design standards','World Bank-funded GRIS road information system'],
    lessonsDNR:'Madagascar\'s cyclone-resilience standards for drainage and embankment design translate directly to DNR\'s high-rainfall northern corridors.',
    dataApproach:'Periodic visual surveys; GPS mapping of road network', funding:'World Bank, AfDB, EU', metrics:'12% paved; 5,800 km under maintenance contract' },

  { id:27, agency:'DVDA/OEBK', country:'DR Congo', flag:'🇨🇩', networkKm:58000, system:'Basic PMS', pavedPct:9, rmsYears:4, budgetPerKmUsd:5500, region:'Africa', lat:-4.04, lng:21.76,
    keyFeatures:['Rebuilding national network post-conflict','World Bank DRC Roads Sector Development Project'],
    lessonsDNR:'DRC\'s World Bank-funded sector development project used simple visual condition tools with mobile apps — a scalable model for DNR\'s Class C rural coverage.',
    dataApproach:'GPS-based visual surveys; satellite imagery for remote areas', funding:'World Bank IDA, AfDB', metrics:'9% paved; 3,200 km under active maintenance (2024)' },

  { id:28, agency:'DGGT Rep. Congo', country:'Rep. of Congo', flag:'🇨🇬', networkKm:17000, system:'PMS', pavedPct:17, rmsYears:5, budgetPerKmUsd:9000, region:'Africa', lat:-0.23, lng:15.83,
    keyFeatures:['Oil-revenue funded road rehabilitation','CEMAC regional road corridor integration'],
    lessonsDNR:'Congo\'s CEMAC regional corridor funding for trans-national routes mirrors DNR\'s EAC/COMESA corridor obligations.',
    dataApproach:'Visual surveys; periodic laser profilometer on paved', funding:'GoC oil revenues + AfDB', metrics:'17% paved; N1 Brazzaville–Pointe-Noire 78% good' },

  { id:29, agency:'MINTP Cameroon', country:'Cameroon', flag:'🇨🇲', networkKm:77000, system:'SIGMA', pavedPct:15, rmsYears:10, budgetPerKmUsd:8200, region:'Africa', lat:3.85, lng:11.50,
    keyFeatures:['SIGMA road database system (French-language)','Performance-based contracts on Yaoundé–Douala corridor'],
    lessonsDNR:'Cameroon\'s OPRC on the Yaoundé–Douala economic corridor demonstrates how to prioritise the highest freight-value route — matching DNR\'s Kampala–Gulu A109 priority.',
    dataApproach:'Annual surveys; SIGMA database at Ministry; ROMDAS on key paved links', funding:'World Bank, AFD, EU, GoC', metrics:'15% paved; 64% corridor links in good condition' },

  { id:30, agency:'FHA Nigeria (state)', country:'Côte d\'Ivoire', flag:'🇨🇮', networkKm:12000, system:'SITP + HDM-4', pavedPct:58, rmsYears:11, budgetPerKmUsd:16000, region:'Africa', lat:7.54, lng:-5.55,
    keyFeatures:['French-speaking West Africa\'s most developed road network','Public-private toll concession on A1 and A3'],
    lessonsDNR:'Côte d\'Ivoire\'s PPP toll concession model for Class A expressways is applicable to Uganda\'s Kampala Northern Bypass.',
    dataApproach:'Annual HDM-4 analysis; ROMDAS on A and B roads; concession reporting', funding:'AfDB, AFD, BOAD, GoCI Road Fund', metrics:'58% paved; 72% in good condition on concession routes' },

  { id:31, agency:'AGEROUTE Senegal', country:'Senegal', flag:'🇸🇳', networkKm:16664, system:'AGEROUTE PMS', pavedPct:60, rmsYears:12, budgetPerKmUsd:15000, region:'Africa', lat:14.50, lng:-14.45,
    keyFeatures:['AGEROUTE model: separate agency for construction and maintenance','OPRC on 3,500 km of national roads'],
    lessonsDNR:'Senegal\'s AGEROUTE institutional model — separating road administration from works execution — improves accountability and is worth evaluating for DNR\'s structure.',
    dataApproach:'Annual condition surveys; GIS portal; ROMDAS on paved network', funding:'World Bank, AFD, BOAD, GoS Road Fund', metrics:'60% paved; OPRC reducing maintenance cost by 18%' },

  { id:32, agency:'DNGC Mali', country:'Mali', flag:'🇲🇱', networkKm:22000, system:'SYGER + HDM-4', pavedPct:30, rmsYears:7, budgetPerKmUsd:7000, region:'Africa', lat:17.57, lng:-3.99,
    keyFeatures:['SYGER road management system (French-language)','HDM-4 linked to MCA Compact investment planning'],
    lessonsDNR:'Mali\'s MCA Compact used HDM-4 to select 196 km of feeder roads for investment based on economic return — a direct model for DNR\'s Class C selection framework.',
    dataApproach:'Visual + GPS; SYGER database', funding:'World Bank, MCA, AFD, GoM', metrics:'30% paved; 58% in maintainable condition' },

  { id:33, agency:'FERA Burkina Faso', country:'Burkina Faso', flag:'🇧🇫', networkKm:15400, system:'PMS + HDM-4', pavedPct:25, rmsYears:8, budgetPerKmUsd:7200, region:'Africa', lat:12.36, lng:-1.53,
    keyFeatures:['FERA road maintenance fund with dedicated fuel levy','Performance contracts on RN1 and RN2'],
    lessonsDNR:'Burkina Faso\'s dedicated fuel levy for road maintenance — ring-fenced and audited — provides a model for Uganda\'s Road Fund reform.',
    dataApproach:'Annual visual + GPS; FERA database; HDM-4 analysis', funding:'GoB fuel levy + World Bank PRSC', metrics:'25% paved; 62% in good/fair condition' },

  { id:34, agency:'DGTP Niger', country:'Niger', flag:'🇳🇪', networkKm:18901, system:'PMS', pavedPct:27, rmsYears:6, budgetPerKmUsd:6500, region:'Africa', lat:17.61, lng:8.08,
    keyFeatures:['Desert road management for extreme temperatures','Sahel climate deterioration calibration'],
    lessonsDNR:'Niger\'s Sahel calibration of pavement deterioration models for extreme temperatures is complementary to Uganda\'s tropical rainfall calibration.',
    dataApproach:'Visual surveys; periodic roughness measurement', funding:'World Bank, AFD, Islamic Development Bank', metrics:'27% paved; 55% in maintainable condition' },

  { id:35, agency:'DGTTM Chad', country:'Chad', flag:'🇹🇩', networkKm:40000, system:'Basic PMS', pavedPct:8, rmsYears:4, budgetPerKmUsd:5000, region:'Africa', lat:15.45, lng:18.73,
    keyFeatures:['Rebuilding network after decades of conflict','EU-funded road corridor development'],
    lessonsDNR:'Chad\'s emergency road condition baseline survey methodology — rapid visual with GPS — is instructive for DNR\'s coverage of unmapped Class C roads in Karamoja.',
    dataApproach:'GPS-based visual; satellite imagery', funding:'EU, World Bank, AfDB, UNDP', metrics:'8% paved; 3,100 km under active maintenance' },

  { id:36, agency:'SUDAAK Sudan', country:'Sudan', flag:'🇸🇩', networkKm:24000, system:'RAMS + HDM-4', pavedPct:65, rmsYears:9, budgetPerKmUsd:8000, region:'Africa', lat:12.86, lng:30.22,
    keyFeatures:['Desert highway management for the Khartoum–Halfa corridor','OPRC pilot on 800 km Section 1'],
    lessonsDNR:'Sudan\'s desert highway deterioration models — focused on thermal cracking and wind abrasion — are relevant for Uganda\'s dry Northern region roads.',
    dataApproach:'Annual ROMDAS on main roads; visual on secondary', funding:'Government + Islamic Development Bank + Arab Fund', metrics:'65% paved; 71% main roads in good condition' },

  { id:37, agency:'UNRA / DNR', country:'Uganda', flag:'🇺🇬', networkKm:21302, system:'DNR RMS Engine', pavedPct:30, rmsYears:6, budgetPerKmUsd:12500, region:'Africa', lat:1.37, lng:32.29,
    keyFeatures:['Official network: 21,302 km (NDPIV FY25-26)','ML-powered IRI prediction (PyTorch, R²=0.93)','1,013 links in GeoJSON; 9 active OPRC lots','25 ATC + 298 TIS traffic monitoring stations'],
    lessonsDNR:'This is the DNR platform itself — the benchmarks shown here represent Uganda\'s current asset management maturity and the targets set by this system.',
    dataApproach:'ROMDAS annual surveys; ATC + TIS traffic counts; bridge inspections; satellite imagery', funding:'GoU Road Fund + World Bank + AfDB + JICA', metrics:'Official: 21,302 km | Mapped: 21,160 km (1,013 links) | Paved: 6,405 km (30.1%)' },

  { id:38, agency:'OBUHA Burundi', country:'Burundi', flag:'🇧🇮', networkKm:12322, system:'PMS', pavedPct:22, rmsYears:5, budgetPerKmUsd:7000, region:'Africa', lat:-3.37, lng:29.92,
    keyFeatures:['Lake Tanganyika corridor road development','EAC regional integration road programme'],
    lessonsDNR:'Burundi\'s EAC road corridor programme provides a regional integration example for DNR\'s cross-border connections.',
    dataApproach:'Periodic visual surveys; donor project reporting', funding:'World Bank, AfDB, EU, GoB', metrics:'22% paved; 58% in maintainable condition' },

  { id:39, agency:'MOPW Somalia', country:'Somalia', flag:'🇸🇴', networkKm:6000, system:'Basic', pavedPct:11, rmsYears:3, budgetPerKmUsd:4500, region:'Africa', lat:5.15, lng:46.20,
    keyFeatures:['Post-conflict road rehabilitation','Hargeisa–Berbera corridor reconstruction'],
    lessonsDNR:'Somalia\'s post-conflict network baseline approach — mapping what exists before setting targets — is a reminder that establishing accurate GIS data is the first requirement for any RMS.',
    dataApproach:'GPS visual; satellite imagery; basic inventory', funding:'World Bank, EU, Arab funds', metrics:'11% paved; 680 km under active maintenance' },

  { id:40, agency:'NRDA Eritrea', country:'Eritrea', flag:'🇪🇷', networkKm:4010, system:'PMS', pavedPct:80, rmsYears:8, budgetPerKmUsd:9500, region:'Africa', lat:15.18, lng:39.78,
    keyFeatures:['Relatively high paved percentage for East Africa','Italian-era infrastructure maintenance'],
    lessonsDNR:'Eritrea\'s high paved percentage from colonial-era roads demonstrates the long-term return on durable pavement investment.',
    dataApproach:'Visual surveys; periodic condition assessments', funding:'Government only (limited donor access)', metrics:'80% paved; 72% in good/fair condition' },

  { id:41, agency:'DNED Djibouti', country:'Djibouti', flag:'🇩🇯', networkKm:3065, system:'Basic PMS', pavedPct:60, rmsYears:4, budgetPerKmUsd:18000, region:'Africa', lat:11.83, lng:42.59,
    keyFeatures:['Port logistics corridor road management','Chinese-funded Djibouti–Addis railway parallel road'],
    lessonsDNR:'Djibouti\'s corridor road investment driven by port traffic mirrors DNR\'s need to prioritise roads feeding Malaba and Busia border crossings.',
    dataApproach:'Visual surveys; port traffic monitoring', funding:'GoD + Chinese financing + Arab funds', metrics:'60% paved; 75% of port corridor in good condition' },

  { id:42, agency:'MoRB South Sudan', country:'South Sudan', flag:'🇸🇸', networkKm:90000, system:'Basic', pavedPct:1, rmsYears:2, budgetPerKmUsd:3500, region:'Africa', lat:6.88, lng:31.31,
    keyFeatures:['World\'s newest nation with minimal paved network','IGAD regional road connectivity target'],
    lessonsDNR:'South Sudan\'s experience shows that unsealed roads maintained to a basic serviceable standard can support economic activity better than no-maintenance paved aspirations.',
    dataApproach:'GPS visual baseline; satellite imagery', funding:'World Bank, USAID, EU', metrics:'<1% paved; 2,800 km under seasonal maintenance' },

  { id:43, agency:'SLRA Sierra Leone', country:'Sierra Leone', flag:'🇸🇱', networkKm:11700, system:'PMS', pavedPct:15, rmsYears:6, budgetPerKmUsd:7500, region:'Africa', lat:8.46, lng:-11.78,
    keyFeatures:['World Bank-funded road rehabilitation','Community-based road maintenance programme'],
    lessonsDNR:'Sierra Leone\'s community-based maintenance — paying local groups to maintain short gravel sections — is a low-cost model for DNR\'s unmaintained Class C links.',
    dataApproach:'Annual visual surveys; GPS mapping', funding:'World Bank, AfDB, EU, GoSL Road Fund', metrics:'15% paved; 68% in maintainable condition' },

  { id:44, agency:'MPWT Liberia', country:'Liberia', flag:'🇱🇷', networkKm:10600, system:'PMS', pavedPct:13, rmsYears:5, budgetPerKmUsd:6800, region:'Africa', lat:6.43, lng:-9.43,
    keyFeatures:['Post-conflict road rebuilding programme','Monrovia urban road rehabilitation'],
    lessonsDNR:'Liberia\'s post-conflict network rebuild phased by economic corridor priority is a useful sequencing model for DNR\'s NDPIV investment pipeline.',
    dataApproach:'Visual + GPS; donor project databases', funding:'World Bank, MCC, EU, GoL', metrics:'13% paved; 4,200 km in maintainable condition' },

  { id:45, agency:'DNTP Guinea', country:'Guinea', flag:'🇬🇳', networkKm:44348, system:'PMS', pavedPct:21, rmsYears:6, budgetPerKmUsd:8000, region:'Africa', lat:10.99, lng:-10.96,
    keyFeatures:['Mining corridor road management','Conakry–Mamou expressway OPRC'],
    lessonsDNR:'Guinea\'s mining-corridor OPRC links infrastructure investment to commodity export economics — a model for DNR considering Albertine oil corridor roads.',
    dataApproach:'Visual surveys; periodic ROMDAS on paved', funding:'World Bank, Islamic Development Bank, Chinese financing', metrics:'21% paved; 65% mining corridors in good condition' },

  { id:46, agency:'INASA Guinea-Bissau', country:'Guinea-Bissau', flag:'🇬🇼', networkKm:4400, system:'Basic PMS', pavedPct:24, rmsYears:4, budgetPerKmUsd:6000, region:'Africa', lat:11.80, lng:-15.18,
    keyFeatures:['WAEMU regional road integration','Basic condition assessment with GPS'],
    lessonsDNR:'Guinea-Bissau\'s WAEMU-linked funding shows the value of regional economic community membership for road infrastructure financing.',
    dataApproach:'Visual + GPS; periodic assessments', funding:'WAEMU, World Bank, EU, GoGB', metrics:'24% paved; 58% in maintainable condition' },

  { id:47, agency:'MoPWG Gambia', country:'Gambia', flag:'🇬🇲', networkKm:3742, system:'PMS', pavedPct:28, rmsYears:5, budgetPerKmUsd:11000, region:'Africa', lat:13.44, lng:-15.31,
    keyFeatures:['Smallest Sub-Saharan Africa network by area','Trans-Gambia Highway ECOWAS corridor'],
    lessonsDNR:'Gambia\'s Trans-Gambia ECOWAS corridor management demonstrates how small networks can leverage regional funding when on strategic routes.',
    dataApproach:'Visual surveys; ECOWAS corridor monitoring', funding:'ECOWAS, World Bank, IsDB, GoG', metrics:'28% paved; 71% Trans-Gambia corridor in good condition' },

  { id:48, agency:'MTPT Mauritania', country:'Mauritania', flag:'🇲🇷', networkKm:12348, system:'PMS', pavedPct:30, rmsYears:7, budgetPerKmUsd:9000, region:'Africa', lat:20.25, lng:-10.94,
    keyFeatures:['Sahara desert road management','Trans-Mauritanian Highway (RN1) performance contract'],
    lessonsDNR:'Mauritania\'s desert highway performance contract — with IRI targets adjusted for windblown sand — shows IRI standards can be adapted to extreme environments.',
    dataApproach:'Annual profilometer on paved; GPS visual on gravel', funding:'Arab Fund, EU, AfDB, GoM', metrics:'30% paved; 68% Trans-Mauritanian in good condition' },

  { id:49, agency:'MTIE Cape Verde', country:'Cape Verde', flag:'🇨🇻', networkKm:1350, system:'PMS', pavedPct:70, rmsYears:10, budgetPerKmUsd:22000, region:'Africa', lat:16.00, lng:-24.01,
    keyFeatures:['Island road management across 9 inhabited islands','Inter-island ferry + road integration'],
    lessonsDNR:'Cape Verde\'s integrated ferry-road management system is relevant for DNR\'s management of Uganda\'s 10 ferry crossings on the Victoria Nile and Albert Nile.',
    dataApproach:'Annual visual surveys; island-by-island condition database', funding:'EU, World Bank, GoCV', metrics:'70% paved; 78% in good condition' },

  { id:50, agency:'DGTP Comoros', country:'Comoros', flag:'🇰🇲', networkKm:880, system:'Basic PMS', pavedPct:52, rmsYears:3, budgetPerKmUsd:14000, region:'Africa', lat:-11.70, lng:43.37,
    keyFeatures:['Volcanic island road management','Climate resilience for cyclone exposure'],
    lessonsDNR:'Comoros\' small-island road resilience programme is instructive for DNR\'s cross-Nile bridge vulnerability planning.',
    dataApproach:'Annual visual; GPS mapping', funding:'EU, AfDB, Arab funds, GoC', metrics:'52% paved; 65% in good condition' },

  { id:51, agency:'MTAC Seychelles', country:'Seychelles', flag:'🇸🇨', networkKm:526, system:'PMS', pavedPct:90, rmsYears:12, budgetPerKmUsd:45000, region:'Africa', lat:-4.68, lng:55.49,
    keyFeatures:['High-income island road management','Tourism-driven maintenance standards'],
    lessonsDNR:'Seychelles\' tourism-linked road quality standards — where road condition directly affects GDP — mirrors the economic case DNR should make for Uganda\'s NDP IV targets.',
    dataApproach:'Annual condition surveys; whole-network inventory', funding:'Government own revenue', metrics:'90% paved; 88% in good condition' },

  { id:52, agency:'RDA Mauritius', country:'Mauritius', flag:'🇲🇺', networkKm:2060, system:'RAMPAS + HDM-4', pavedPct:98, rmsYears:18, budgetPerKmUsd:55000, region:'Africa', lat:-20.35, lng:57.55,
    keyFeatures:['Near-universal paved network on small island','HDM-4 fully calibrated for humid tropical conditions'],
    lessonsDNR:'Mauritius\' fully calibrated HDM-4 for humid tropical conditions is the most applicable African reference for Uganda\'s bi-modal rainfall climate.',
    dataApproach:'Annual ROMDAS; RAMPAS database; monthly condition monitoring on motorways', funding:'Government + EU + World Bank', metrics:'98% paved; 91% in very good condition; IRI avg 1.8 m/km' },

  { id:53, agency:'DGTP Togo', country:'Togo', flag:'🇹🇬', networkKm:11734, system:'PMS + HDM-4', pavedPct:30, rmsYears:8, budgetPerKmUsd:8500, region:'Africa', lat:8.62, lng:0.82,
    keyFeatures:['WAEMU corridor management for transit traffic','Lomé Port approach roads maintenance contract'],
    lessonsDNR:'Togo\'s port approach road maintenance contract links road performance to container throughput KPIs — a model for DNR\'s Jinja bridge approach road management.',
    dataApproach:'Annual visual + GPS; HDM-4 analysis for budget', funding:'WAEMU, World Bank, EU, GoT', metrics:'30% paved; 65% in good/fair condition' },

  { id:54, agency:'AGETUR Benin', country:'Benin', flag:'🇧🇯', networkKm:9800, system:'PMS', pavedPct:22, rmsYears:7, budgetPerKmUsd:8000, region:'Africa', lat:9.31, lng:2.32,
    keyFeatures:['ECOWAS West Africa highway corridor management','Cotonou Port road access investment'],
    lessonsDNR:'Benin\'s ECOWAS corridor funding for cross-border roads is a template for DNR\'s engagement with EAC and COMESA corridor investment programmes.',
    dataApproach:'Annual visual surveys; ECOWAS corridor data', funding:'ECOWAS, World Bank, AFD, GoB Road Fund', metrics:'22% paved; 68% national roads in good condition' },

  { id:55, agency:'ANGONAV Gabon', country:'Gabon', flag:'🇬🇦', networkKm:9170, system:'PMS', pavedPct:27, rmsYears:6, budgetPerKmUsd:20000, region:'Africa', lat:-0.80, lng:11.61,
    keyFeatures:['Oil-funded road rehabilitation','Libreville urban expressway PPP'],
    lessonsDNR:'Gabon\'s oil-revenue funded road maintenance demonstrates how resource rents can finance sustainable infrastructure — relevant for Uganda\'s Albertine oil development corridor.',
    dataApproach:'Visual + GPS; Chinese contractor data; periodic ROMDAS', funding:'GoG oil revenues + Chinese financing', metrics:'27% paved; 61% national roads in good condition' },

  { id:56, agency:'MOPWT Equatorial Guinea', country:'Equatorial Guinea', flag:'🇬🇶', networkKm:2880, system:'PMS', pavedPct:34, rmsYears:5, budgetPerKmUsd:25000, region:'Africa', lat:1.65, lng:10.27,
    keyFeatures:['Oil-funded road investment in small network','Malabo–Bata highway as showcase project'],
    lessonsDNR:'Equatorial Guinea\'s showcase highway investment highlights the difference between political prestige projects and systematic maintenance funding — DNR must advocate for maintenance budgets.',
    dataApproach:'Visual surveys; Chinese contractor reporting', funding:'Government oil revenues', metrics:'34% paved; 70% main roads in good condition' },

  { id:57, agency:'MOPH CAR', country:'Central African Republic', flag:'🇨🇫', networkKm:24307, system:'Basic', pavedPct:5, rmsYears:2, budgetPerKmUsd:3000, region:'Africa', lat:6.61, lng:20.94,
    keyFeatures:['Post-conflict minimal road maintenance','UN-supported basic road rehabilitation'],
    lessonsDNR:'CAR\'s experience confirms that political stability is a prerequisite for sustainable road asset management — Uganda\'s relative stability is itself a competitive advantage for investment.',
    dataApproach:'Basic GPS visual; UN/NGO project reporting', funding:'World Bank, EU, UN, USAID', metrics:'5% paved; 1,200 km under emergency maintenance' },

  // ── North Africa ─────────────────────────────────────────────────────────────
  { id:58, agency:'GARBLT Egypt', country:'Egypt', flag:'🇪🇬', networkKm:65000, system:'RMS-Egypt + HDM-4', pavedPct:95, rmsYears:18, budgetPerKmUsd:20000, region:'Africa', lat:26.82, lng:30.80,
    keyFeatures:['Extensive desert highway network','Suez Canal approach road management','Automated condition monitoring on Ring Road Cairo'],
    lessonsDNR:'Egypt\'s automated condition monitoring on the Cairo Ring Road — using mounted sensors on fleet vehicles — is a cost-effective alternative to ROMDAS for high-traffic Class A roads.',
    dataApproach:'Annual profilometer surveys; automated fleet sensor data; GIS national database', funding:'GoE budget + Arab funds + Chinese financing', metrics:'95% paved; 78% in good condition; avg IRI 2.4 m/km' },

  { id:59, agency:'GDAT Libya', country:'Libya', flag:'🇱🇾', networkKm:37000, system:'Basic PMS', pavedPct:77, rmsYears:5, budgetPerKmUsd:15000, region:'Africa', lat:26.34, lng:17.23,
    keyFeatures:['Post-conflict road rehabilitation','Italian-era coastal highway maintenance'],
    lessonsDNR:'Libya\'s coastal highway deterioration data for Mediterranean climate conditions is useful for HDM-4 calibration comparison studies.',
    dataApproach:'Visual surveys; periodic profilometer on main roads', funding:'Government oil revenues', metrics:'77% paved; 58% main roads in good condition' },

  { id:60, agency:'DGGC Tunisia', country:'Tunisia', flag:'🇹🇳', networkKm:19232, system:'PMS + HDM-4', pavedPct:73, rmsYears:20, budgetPerKmUsd:18000, region:'Africa', lat:33.89, lng:9.54,
    keyFeatures:['Long-established road asset management','Annual HDM-4 analysis for multi-year programming','Motorway concession network with automated tolling'],
    lessonsDNR:'Tunisia\'s 20-year HDM-4 data series demonstrates how long-run calibrated analysis improves decision-making — DNR should invest in longitudinal data continuity.',
    dataApproach:'Annual ROMDAS on all paved roads; visual on gravel; HDM-4 national analysis', funding:'GoT Road Fund + World Bank + IsDB', metrics:'73% paved; 76% in good/fair condition; IRI avg 3.1 m/km' },

  { id:61, agency:'CNER Algeria', country:'Algeria', flag:'🇩🇿', networkKm:113655, system:'SIGAL + HDM-4', pavedPct:73, rmsYears:15, budgetPerKmUsd:22000, region:'Africa', lat:28.03, lng:1.66,
    keyFeatures:['East–West Highway 1,200 km expressway management','SIGAL national road management information system','Desert road management for Sahara sections'],
    lessonsDNR:'Algeria\'s SIGAL system for long expressway sections uses segment-based condition reporting — directly applicable to DNR\'s link-based GeoJSON management approach.',
    dataApproach:'Annual profilometer + deflectograph on expressways; visual on secondary', funding:'Government hydrocarbon revenues', metrics:'73% paved; 68% in good condition; expressway avg IRI 1.9 m/km' },

  { id:62, agency:'DRCR Morocco', country:'Morocco', flag:'🇲🇦', networkKm:57227, system:'SIRAM + HDM-4', pavedPct:75, rmsYears:22, budgetPerKmUsd:25000, region:'Africa', lat:31.79, lng:-7.09,
    keyFeatures:['Most advanced road management in Africa','SIRAM — Système d\'Information Routière et d\'Aide à la Maintenance','Autoroutes du Maroc: 1,800 km fully operated concession network'],
    lessonsDNR:'Morocco\'s SIRAM is the most developed French-language road management system in Africa — it provides the strongest African role model for DNR\'s ambition to become the East African benchmark.',
    dataApproach:'Annual ROMDAS on all classified roads; quarterly on motorways; SIRAM central database', funding:'Special Road Fund + Autoroutes concession revenues + World Bank', metrics:'75% paved; 81% in good condition; motorway avg IRI 1.5 m/km' },

  // ── Middle East ──────────────────────────────────────────────────────────────
  { id:63, agency:'MOT Saudi Arabia', country:'Saudi Arabia', flag:'🇸🇦', networkKm:65000, system:'HIMS', pavedPct:96, rmsYears:22, budgetPerKmUsd:42000, region:'Middle East', lat:23.89, lng:45.08,
    keyFeatures:['Highway Infrastructure Management System (HIMS)','AI-powered crack detection on 65,000 km','Vision 2030 road investment programme'],
    lessonsDNR:'Saudi Arabia\'s AI crack detection deployed at national scale is the most advanced example of technology leapfrogging for pavement inspection — worth adopting for DNR\'s Class A network.',
    dataApproach:'Automated vehicle-mounted sensors; annual pavement surveys; real-time monitoring on motorways', funding:'Government oil revenues + KACST', metrics:'96% paved; 84% in good condition; AI survey covers 100% annual' },

  { id:64, agency:'Bayanat / RTA UAE', country:'UAE', flag:'🇦🇪', networkKm:10000, system:'Advanced AMS', pavedPct:99, rmsYears:20, budgetPerKmUsd:120000, region:'Middle East', lat:23.42, lng:53.85,
    keyFeatures:['Digital twin of Abu Dhabi road network','AI + IoT real-time pavement health monitoring','Zero road fatality target 2030'],
    lessonsDNR:'UAE\'s digital twin of road assets is the global frontier of asset management — DNR\'s GeoJSON + ML model is a scaled-down version of the same concept.',
    dataApproach:'Real-time IoT sensors; drone inspections; AI image analysis; monthly condition reports', funding:'Government Abu Dhabi/Dubai', metrics:'99% paved; 95% in very good condition; 100% digital twin coverage' },

  { id:65, agency:'MoPWH Jordan', country:'Jordan', flag:'🇯🇴', networkKm:7500, system:'RAMS + HDM-4', pavedPct:85, rmsYears:16, budgetPerKmUsd:22000, region:'Middle East', lat:30.59, lng:36.24,
    keyFeatures:['World Bank-funded RAMS','Desert to humid gradient road management','Dead Sea Highway performance contract'],
    lessonsDNR:'Jordan\'s Dead Sea Highway OPRC — linking maintenance standards to tourism KPIs — demonstrates how road condition can be tied to non-transport economic outcomes.',
    dataApproach:'Annual ROMDAS; visual on secondary; HDM-4 analysis', funding:'World Bank, EU, Islamic Development Bank, GoJ', metrics:'85% paved; 73% in good condition' },

  { id:66, agency:'SRB Iraq', country:'Iraq', flag:'🇮🇶', networkKm:59623, system:'Basic PMS', pavedPct:60, rmsYears:6, budgetPerKmUsd:14000, region:'Middle East', lat:33.22, lng:43.68,
    keyFeatures:['Post-conflict road reconstruction','Oil revenue road investment programme'],
    lessonsDNR:'Iraq\'s post-conflict rapid road reconstruction using simplified condition assessment tools provides lessons for DNR\'s approach to restoring roads in formerly conflict-affected Karamoja.',
    dataApproach:'Visual + GPS; periodic profilometer on main roads', funding:'Government oil revenues + World Bank', metrics:'60% paved; 58% main roads in good condition' },

  { id:67, agency:'MOT Iran', country:'Iran', flag:'🇮🇷', networkKm:199000, system:'IRMS', pavedPct:72, rmsYears:18, budgetPerKmUsd:15000, region:'Middle East', lat:32.43, lng:53.69,
    keyFeatures:['IRMS — Iran Road Management System','Extensive rural road network covering 98% of villages'],
    lessonsDNR:'Iran\'s 98% village connectivity standard — paved or compacted gravel access road to every settlement — sets an aspirational standard for DNR\'s Class C rural access targets.',
    dataApproach:'Annual surveys; IRMS central database; satellite imagery for remote areas', funding:'Government + IRISL', metrics:'72% paved; 68% in good condition; 98% village connectivity' },

  { id:68, agency:'MOPWT Yemen', country:'Yemen', flag:'🇾🇪', networkKm:71300, system:'Basic', pavedPct:32, rmsYears:3, budgetPerKmUsd:2500, region:'Middle East', lat:15.55, lng:48.52,
    keyFeatures:['Conflict-affected road network management','UNDP emergency road restoration'],
    lessonsDNR:'Yemen\'s conflict experience demonstrates that road data — even basic GPS-based records — must be backed up off-site, as conflict can destroy institutional databases.',
    dataApproach:'Basic GPS visual; satellite imagery; UN assessment reports', funding:'World Bank, UNDP, UN OCHA', metrics:'32% paved; 2,100 km under emergency maintenance' },

  { id:69, agency:'DGRT Oman', country:'Oman', flag:'🇴🇲', networkKm:12000, system:'RAMS + AMS', pavedPct:94, rmsYears:16, budgetPerKmUsd:38000, region:'Middle East', lat:21.51, lng:55.92,
    keyFeatures:['Wadi flood-management integrated with road design','Annual profilometer survey on all paved roads'],
    lessonsDNR:'Oman\'s wadi flood management integrated into road maintenance scheduling is directly applicable to DNR\'s wet season road vulnerability in Eastern and Northern Uganda.',
    dataApproach:'Annual ROMDAS; flood event reporting linked to maintenance response', funding:'Government oil revenues + Oman sovereign fund', metrics:'94% paved; 82% in good condition; wadi flood response <24hrs' },

  { id:70, agency:'MPW Kuwait', country:'Kuwait', flag:'🇰🇼', networkKm:7800, system:'AMS', pavedPct:99, rmsYears:14, budgetPerKmUsd:85000, region:'Middle East', lat:29.31, lng:47.48,
    keyFeatures:['Desert pavement management for extreme heat','Automated tunnel monitoring system'],
    lessonsDNR:'Kuwait\'s extreme heat pavement management — using high-temperature bitumen specifications — is useful context for DNR\'s climate specification development.',
    dataApproach:'Annual surveys; automated monitoring; periodic FWD testing', funding:'Government', metrics:'99% paved; 88% in good condition; 0 unmaintained km' },

  { id:71, agency:'ASHGHAL Qatar', country:'Qatar', flag:'🇶🇦', networkKm:9800, system:'QRMS', pavedPct:99, rmsYears:12, budgetPerKmUsd:95000, region:'Middle East', lat:25.35, lng:51.18,
    keyFeatures:['FIFA 2022 World Cup road investment legacy','QRMS — Qatar Roads Management System','Fully BIM-integrated road asset management'],
    lessonsDNR:'Qatar\'s BIM-integrated road assets — where every pipe, cable and structure is modelled — represents the long-term vision for DNR\'s asset registry evolution beyond GeoJSON.',
    dataApproach:'Automated annual surveys; BIM models for structures; real-time IoT monitoring', funding:'Qatar Investment Authority + Government', metrics:'99% paved; 93% in very good condition; BIM coverage 100%' },

  { id:72, agency:'Bapco / MPW Bahrain', country:'Bahrain', flag:'🇧🇭', networkKm:4122, system:'AMS', pavedPct:99, rmsYears:10, budgetPerKmUsd:72000, region:'Middle East', lat:26.02, lng:50.55,
    keyFeatures:['Smallest GCC road network — fully paved','King Fahd Causeway management integration with Saudi Arabia'],
    lessonsDNR:'Bahrain\'s causeway management — shared with Saudi Arabia under one maintenance contract — is a model for DNR\'s cross-border bridge maintenance agreements with Kenya and Tanzania.',
    dataApproach:'Annual surveys; automated monitoring; periodic FWD', funding:'Government', metrics:'99% paved; 91% in good condition' },

  // ── South Asia ───────────────────────────────────────────────────────────────
  { id:73, agency:'NHA Pakistan', country:'Pakistan', flag:'🇵🇰', networkKm:13000, system:'PAK-RAMS', pavedPct:69, rmsYears:15, budgetPerKmUsd:16000, region:'Asia-Pacific', lat:30.37, lng:69.34,
    keyFeatures:['PAK-RAMS national road asset management system','CPEC corridor 3,000 km management','Annual profilometer survey on NHA network'],
    lessonsDNR:'Pakistan\'s CPEC corridor management — integrating road condition with cross-border trade monitoring — is applicable to DNR\'s management of the Northern Corridor and Malaba border.',
    dataApproach:'Annual ROMDAS; NHA central database; CPEC corridor GIS', funding:'PSDP + Chinese financing + World Bank + ADB', metrics:'69% NHA paved; 72% in good condition; CPEC 89% good' },

  { id:74, agency:'RHD Bangladesh', country:'Bangladesh', flag:'🇧🇩', networkKm:21302, system:'RMMS + HDM-4', pavedPct:44, rmsYears:18, budgetPerKmUsd:14000, region:'Asia-Pacific', lat:23.68, lng:90.36,
    keyFeatures:['RMMS — Roads and Highways Dept Management System','Flood-resilient road design standards','Annual condition surveys on 21,302 km national network'],
    lessonsDNR:'Bangladesh\'s flood-resilient road embankment standards for monsoon climate directly mirror DNR\'s requirements for Uganda\'s Teso and Elgon-area flood-prone roads.',
    dataApproach:'Annual visual + profilometer; RMMS database; satellite imagery for flood assessment', funding:'World Bank, ADB, JICA, GoB Road Fund', metrics:'44% paved; 68% in good/fair condition; flood-resilient design on 6,800 km' },

  { id:75, agency:'RVPN Sri Lanka', country:'Sri Lanka', flag:'🇱🇰', networkKm:11997, system:'RIMS + HDM-4', pavedPct:81, rmsYears:14, budgetPerKmUsd:20000, region:'Asia-Pacific', lat:7.87, lng:80.77,
    keyFeatures:['RIMS — Road Information Management System','Post-war north–south network reconstruction','Expressway concession performance contracts'],
    lessonsDNR:'Sri Lanka\'s post-conflict north–south reconstruction phased by corridor priority is a sequencing model for DNR\'s NDPIV corridor investment programme.',
    dataApproach:'Annual surveys on all roads; RIMS central database', funding:'World Bank, ADB, Chinese financing, GoSL', metrics:'81% paved; 76% in good condition' },

  { id:76, agency:'DoR Nepal', country:'Nepal', flag:'🇳🇵', networkKm:29024, system:'RAMS + HDM-4', pavedPct:58, rmsYears:12, budgetPerKmUsd:18000, region:'Asia-Pacific', lat:28.39, lng:84.12,
    keyFeatures:['Mountain road management for earthquake-prone terrain','Annual monsoon damage assessment programme','Output-based maintenance contracts on strategic corridors'],
    lessonsDNR:'Nepal\'s earthquake and landslide vulnerability assessment integrated into maintenance programming is applicable to DNR\'s flood and landslide risk mapping in Western Uganda.',
    dataApproach:'Annual visual + GPS; periodic profilometer; GIS vulnerability mapping', funding:'World Bank, ADB, Chinese financing, GoN Road Fund', metrics:'58% paved; 65% in good condition; monsoon damage rapid response within 72hrs' },

  { id:77, agency:'DOR Bhutan', country:'Bhutan', flag:'🇧🇹', networkKm:12205, system:'RAMS + AMS', pavedPct:62, rmsYears:10, budgetPerKmUsd:25000, region:'Asia-Pacific', lat:27.51, lng:90.43,
    keyFeatures:['Himalayan mountain road management','Landslide and glacial lake outburst flood risk management','GPS-tracked road patrol system'],
    lessonsDNR:'Bhutan\'s GPS-tracked road patrol system — where maintenance teams log every pothole and drainage issue in real time — is an affordable mobile-first model for DNR\'s field inspection workflow.',
    dataApproach:'Annual condition surveys; GPS patrol reporting; RAMS database', funding:'GoB + India + ADB', metrics:'62% paved; 70% in good condition' },

  { id:78, agency:'DRPH Myanmar', country:'Myanmar', flag:'🇲🇲', networkKm:34377, system:'RIMS + HDM-4', pavedPct:17, rmsYears:8, budgetPerKmUsd:9000, region:'Asia-Pacific', lat:19.16, lng:96.71,
    keyFeatures:['Post-isolation network modernisation','GMS road corridor integration','Annual condition surveys on national highways'],
    lessonsDNR:'Myanmar\'s GMS (Greater Mekong Sub-region) corridor programme shows how regional economic integration drives road investment — paralleling Uganda\'s EAC/COMESA corridor logic.',
    dataApproach:'Annual visual + GPS; RIMS database', funding:'World Bank, ADB, Chinese financing, GoM Road Fund', metrics:'17% paved; 55% in maintainable condition' },

  { id:79, agency:'MPW Afghanistan', country:'Afghanistan', flag:'🇦🇫', networkKm:34000, system:'Basic PMS', pavedPct:29, rmsYears:4, budgetPerKmUsd:6000, region:'Asia-Pacific', lat:33.94, lng:67.71,
    keyFeatures:['Post-conflict road reconstruction with USAID/NATO','Ring Road (2,200 km) as national backbone'],
    lessonsDNR:'Afghanistan\'s Ring Road construction — prioritising a national backbone route before secondary network — reflects the corridor-first strategy embedded in DNR\'s Class A priority investment.',
    dataApproach:'Basic GPS visual; periodic profilometer on Ring Road', funding:'USAID, World Bank, ADB', metrics:'29% paved; Ring Road 68% in good condition' },

  // ── Southeast Asia ───────────────────────────────────────────────────────────
  { id:80, agency:'DOH Thailand', country:'Thailand', flag:'🇹🇭', networkKm:49000, system:'TH-RAMS + HDM-4', pavedPct:99, rmsYears:22, budgetPerKmUsd:28000, region:'Asia-Pacific', lat:15.87, lng:100.99,
    keyFeatures:['Full HDM-4 calibration for tropical monsoon climate','Automated condition survey vehicles (VIBROFLASH)','Annual road condition reporting to Parliament'],
    lessonsDNR:'Thailand\'s tropical monsoon HDM-4 calibration — accounting for wet-season damage cycles — is the closest climate analogue to Uganda\'s bi-modal rainfall pattern.',
    dataApproach:'Annual automated surveys; TH-RAMS database; HDM-4 national analysis', funding:'Government + toll revenues', metrics:'99% paved; 82% in good condition; IRI avg 2.6 m/km' },

  { id:81, agency:'DRVN Vietnam', country:'Vietnam', flag:'🇻🇳', networkKm:21000, system:'VRMS + HDM-4', pavedPct:55, rmsYears:16, budgetPerKmUsd:18000, region:'Asia-Pacific', lat:14.06, lng:108.28,
    keyFeatures:['Performance contracts on Ho Chi Minh Highway','Annual condition survey on all classified roads','GIS-integrated national road database'],
    lessonsDNR:'Vietnam\'s VRMS performance contracts — with condition KPIs and mobile monitoring — is a mid-income country equivalent of the UK HAPMS system applicable to DNR\'s OPRC evolution.',
    dataApproach:'Annual profilometer + visual; VRMS national database; GIS integration', funding:'ODA (Japan, World Bank, ADB) + GoV Road Fund', metrics:'55% paved; 70% in good condition; performance contracts on 9,500 km' },

  { id:82, agency:'MPWT Cambodia', country:'Cambodia', flag:'🇰🇭', networkKm:11700, system:'ROCKS + HDM-4', pavedPct:29, rmsYears:10, budgetPerKmUsd:11000, region:'Asia-Pacific', lat:12.57, lng:104.99,
    keyFeatures:['ROCKS road data management system','World Bank-funded pavement management on NR1–NR6','Community road maintenance blocks on rural roads'],
    lessonsDNR:'Cambodia\'s community maintenance blocks on rural roads — community groups responsible for short sections — is a low-cost model for DNR\'s Class C maintenance coverage.',
    dataApproach:'Annual ROMDAS on national roads; visual on rural; ROCKS database', funding:'World Bank, ADB, Japan (JICA), Chinese financing', metrics:'29% paved; 68% NR network in good condition' },

  { id:83, agency:'DPWH Laos', country:'Laos', flag:'🇱🇦', networkKm:39568, system:'RMIS + HDM-4', pavedPct:24, rmsYears:8, budgetPerKmUsd:10000, region:'Asia-Pacific', lat:19.86, lng:102.50,
    keyFeatures:['Landlocked country road management for transit trade','GMS corridor integration — Laos as ASEAN land bridge'],
    lessonsDNR:'Laos\' land-bridge transit road management — serving both domestic and cross-border trade — is analogous to DNR\'s management of Uganda\'s East Africa Transit Corridor.',
    dataApproach:'Annual visual + GPS; RMIS database', funding:'World Bank, ADB, Chinese financing, JICA', metrics:'24% paved; 61% national roads in good condition' },

  { id:84, agency:'Bina Marga / PUPR', country:'Indonesia', flag:'🇮🇩', networkKm:47017, system:'IRMS', pavedPct:79, rmsYears:20, budgetPerKmUsd:22000, region:'Asia-Pacific', lat:-0.79, lng:113.92,
    keyFeatures:['IRMS — Indonesian Road Management System covering 47,000 km','Trans-Java Toll Road performance contract','Annual pavement condition survey across archipelago'],
    lessonsDNR:'Indonesia\'s IRMS — managing roads across 17,000 islands — demonstrates how a single integrated system can handle massive geographic diversity, which is applicable to DNR\'s multi-region management.',
    dataApproach:'Annual ROMDAS on national roads; aerial surveys on island networks; IRMS database', funding:'APBN government + toll revenues + World Bank + ADB', metrics:'79% paved; 75% in good condition; Trans-Java expressway avg IRI 1.8 m/km' },

  { id:85, agency:'DPWH Philippines', country:'Philippines', flag:'🇵🇭', networkKm:29000, system:'DRIMS + HDM-4', pavedPct:85, rmsYears:16, budgetPerKmUsd:25000, region:'Asia-Pacific', lat:12.88, lng:121.77,
    keyFeatures:['DRIMS — DPWH Road Information Management System','Typhoon resilience programme for national roads','Annual condition survey on all national roads'],
    lessonsDNR:'Philippines\' typhoon resilience programme — retroactively improving drainage and slope protection after disasters — mirrors DNR\'s need for climate-resilient design standards on Northern Uganda roads.',
    dataApproach:'Annual profilometer + visual; DRIMS database; post-typhoon rapid assessment', funding:'DPWH budget + ODA (Japan, WB, ADB) + toll revenues', metrics:'85% paved; 78% in good condition; typhoon response average 96hrs' },

  { id:86, agency:'JKR Malaysia', country:'Malaysia', flag:'🇲🇾', networkKm:22000, system:'JKRAMS + HDM-4', pavedPct:99, rmsYears:24, budgetPerKmUsd:38000, region:'Asia-Pacific', lat:4.21, lng:108.96,
    keyFeatures:['JKRAMS — JKR Road Asset Management System','Full HDM-4 calibration for humid equatorial conditions','Expressway concessions with automated monitoring'],
    lessonsDNR:'Malaysia\'s JKR humid equatorial HDM-4 calibration is the closest Southeast Asian climate analogue to Uganda — the calibration parameters should be reviewed for DNR\'s own calibration exercise.',
    dataApproach:'Annual ROMDAS on federal roads; automated monitoring on expressways; JKRAMS database', funding:'Government + PLUS Expressways toll + World Bank', metrics:'99% paved; 86% in good condition; expressway IRI avg 1.6 m/km' },

  { id:87, agency:'LTA Singapore', country:'Singapore', flag:'🇸🇬', networkKm:3500, system:'ARMS + Digital Twin', pavedPct:100, rmsYears:30, budgetPerKmUsd:200000, region:'Asia-Pacific', lat:1.35, lng:103.82,
    keyFeatures:['Full digital twin of road network','Automated ground-penetrating radar (GPR) surveys','Integrated smart traffic + road condition management'],
    lessonsDNR:'Singapore\'s automated GPR structural assessment — detecting sub-surface voids before surface failure — is the long-term vision for DNR\'s bridge and pavement structural condition management.',
    dataApproach:'Continuous automated surveys; GPR structural assessment; real-time IoT monitoring; digital twin updates monthly', funding:'Government + LTA revenues', metrics:'100% paved; 98% in very good condition; IRI avg 1.1 m/km; GPR coverage 100%' },

  // ── Central Asia ─────────────────────────────────────────────────────────────
  { id:88, agency:'KazAutoZhol', country:'Kazakhstan', flag:'🇰🇿', networkKm:95000, system:'RIMS-KZ + HDM-4', pavedPct:66, rmsYears:12, budgetPerKmUsd:20000, region:'Asia-Pacific', lat:48.02, lng:66.92,
    keyFeatures:['Trans-Kazakhstan corridor to China and Russia','HDM-4 calibrated for continental climate (freeze-thaw)','EBRD-funded road sector reform'],
    lessonsDNR:'Kazakhstan\'s freeze-thaw calibrated deterioration models represent the polar opposite of Uganda\'s climate but demonstrate the importance of local calibration for any climate extreme.',
    dataApproach:'Annual profilometer on national roads; visual on secondary; RIMS-KZ database', funding:'Government + EBRD + ADB + World Bank', metrics:'66% paved; 71% in good condition; Trans-Kazakhstan Highway 85% good' },

  { id:89, agency:'Uzavtoyul', country:'Uzbekistan', flag:'🇺🇿', networkKm:42400, system:'ARMS + HDM-4', pavedPct:71, rmsYears:10, budgetPerKmUsd:14000, region:'Asia-Pacific', lat:41.38, lng:64.59,
    keyFeatures:['Silk Road corridor road management','ADB-funded road sector modernisation','Annual profilometer survey on national roads'],
    lessonsDNR:'Uzbekistan\'s Silk Road corridor management — balancing domestic maintenance with international transit obligations — mirrors DNR\'s dual role managing national roads and East Africa transit corridors.',
    dataApproach:'Annual ROMDAS; visual on secondary; ARMS database', funding:'ADB, World Bank, Islamic Development Bank, GoU', metrics:'71% paved; 68% in good condition' },

  { id:90, agency:'RSRS Kyrgyzstan', country:'Kyrgyzstan', flag:'🇰🇬', networkKm:34000, system:'RIMS-KG', pavedPct:42, rmsYears:8, budgetPerKmUsd:11000, region:'Asia-Pacific', lat:41.20, lng:74.77,
    keyFeatures:['Mountain road management for Tian Shan range','Seasonal road closures management','World Bank-funded RSRS road sector reform'],
    lessonsDNR:'Kyrgyzstan\'s seasonal road closure management — with official opening and closing dates — is applicable to DNR\'s dry-season access restrictions for Class C roads in Karamoja.',
    dataApproach:'Annual visual + GPS; periodic profilometer on paved', funding:'World Bank, ADB, AIIB, GoK', metrics:'42% paved; 60% in maintainable condition' },

  { id:91, agency:'RHRM Tajikistan', country:'Tajikistan', flag:'🇹🇯', networkKm:27767, system:'PMS', pavedPct:41, rmsYears:7, budgetPerKmUsd:10000, region:'Asia-Pacific', lat:38.86, lng:71.28,
    keyFeatures:['Pamir Highway management in extreme altitude','ADB-funded road corridor investment'],
    lessonsDNR:'Tajikistan\'s Pamir Highway management — the world\'s second-highest international road — demonstrates that even extreme-environment roads can be managed with systematic condition monitoring.',
    dataApproach:'Periodic visual + GPS; seasonal condition assessment', funding:'ADB, World Bank, China, GoT', metrics:'41% paved; 58% in maintainable condition' },

  { id:92, agency:'Turkmenistan DHI', country:'Turkmenistan', flag:'🇹🇲', networkKm:58592, system:'PMS', pavedPct:68, rmsYears:8, budgetPerKmUsd:18000, region:'Asia-Pacific', lat:38.97, lng:59.56,
    keyFeatures:['Desert road management funded by gas revenues','White marble highway programme (Ashgabat)'],
    lessonsDNR:'Turkmenistan\'s gas-funded road investment highlights the risk of resource-dependent road funding — DNR\'s advocacy for a sustainable fuel levy is the more resilient model.',
    dataApproach:'Annual visual; periodic profilometer on main roads', funding:'Government gas revenues', metrics:'68% paved; 62% in good condition' },

  // ── East Asia ────────────────────────────────────────────────────────────────
  { id:93, agency:'MOT China', country:'China', flag:'🇨🇳', networkKm:5200000, system:'CHIS + BIM', pavedPct:71, rmsYears:25, budgetPerKmUsd:55000, region:'Asia-Pacific', lat:35.86, lng:104.20,
    keyFeatures:['World\'s largest road network (5.2 million km)','CHIS — China Highway Information System','174,000 km of expressways with automated monitoring','AI-powered road distress detection at national scale'],
    lessonsDNR:'China\'s AI-powered national road distress detection — covering 174,000 km of expressways annually using camera-equipped survey vehicles — is the most scalable model for automated condition assessment.',
    dataApproach:'Automated AI vehicle surveys; annual profilometer; satellite imagery; CHIS database', funding:'Government + toll revenues + provincial budgets', metrics:'71% paved; 82% expressway in good condition; AI covers 100% expressway annually' },

  { id:94, agency:'MOLIT Korea', country:'South Korea', flag:'🇰🇷', networkKm:11714, system:'KRMS + AI', pavedPct:99, rmsYears:26, budgetPerKmUsd:85000, region:'Asia-Pacific', lat:35.91, lng:127.77,
    keyFeatures:['KRMS — Korean Road Management System','AI deep learning for crack and rut detection','Full Life Cycle Cost Approach (40-year horizon)'],
    lessonsDNR:'South Korea\'s 40-year LCC horizon — mandated by law for all road investment decisions — provides the strongest legal framework model for DNR\'s NDPIV long-term investment planning.',
    dataApproach:'Annual automated surveys; AI analysis; real-time monitoring on expressways; KRMS database', funding:'Government + Korea Expressway Corporation toll revenues', metrics:'99% paved; 89% in good condition; LCC mandated by Road Act 2020' },

  { id:95, agency:'MRTD Mongolia', country:'Mongolia', flag:'🇲🇳', networkKm:49250, system:'PMS + HDM-4', pavedPct:4, rmsYears:7, budgetPerKmUsd:12000, region:'Asia-Pacific', lat:46.86, lng:103.85,
    keyFeatures:['Sparse network in world\'s least densely populated country','Earth roads (Khünder) management for pastoral nomads','Extreme winter freeze-thaw pavement management'],
    lessonsDNR:'Mongolia\'s khünder (unpaved track) maintenance for pastoral communities — with GPS-mapped routes but no formal construction — is the closest global analogue to DNR\'s Class C Karamoja unpaved tracks.',
    dataApproach:'GPS mapping; periodic visual on paved; satellite imagery', funding:'World Bank, ADB, GoM', metrics:'4% paved; 95% in maintainable condition (paved); 34,000 km khünder network maintained' },

  // ── Eastern Europe ───────────────────────────────────────────────────────────
  { id:96, agency:'GDDKiA Poland', country:'Poland', flag:'🇵🇱', networkKm:20198, system:'SOSN + HDM-4', pavedPct:97, rmsYears:20, budgetPerKmUsd:65000, region:'Europe', lat:51.92, lng:19.15,
    keyFeatures:['EU-funded motorway and expressway network expansion','SOSN automated condition monitoring system','Annual whole-network survey for EU reporting'],
    lessonsDNR:'Poland\'s EU-funded network development — with mandatory annual condition reporting and public dashboard — is a strong model for how donor-funded networks are monitored and reported.',
    dataApproach:'Annual automated surveys; SOSN national database; EU mandatory condition reporting', funding:'EU Structural Funds + CEF + domestic budget', metrics:'97% paved; 81% in good condition; EU reporting 100% compliance' },

  { id:97, agency:'CNAIR Romania', country:'Romania', flag:'🇷🇴', networkKm:18003, system:'RNMS + HDM-4', pavedPct:90, rmsYears:16, budgetPerKmUsd:42000, region:'Europe', lat:45.94, lng:24.97,
    keyFeatures:['EU-funded motorway programme','HDM-4 calibrated for Carpathian mountain roads','EU TEN-T core network management'],
    lessonsDNR:'Romania\'s Carpathian mountain road HDM-4 calibration — for freeze-thaw and heavy snowfall — is methodologically instructive for DNR\'s Mt Elgon and Rwenzori highland road calibration.',
    dataApproach:'Annual profilometer + FWD; RNMS database; EU TEN-T reporting', funding:'EU Cohesion Fund + national budget', metrics:'90% paved; 75% in good condition; TEN-T 88% good' },

  { id:98, agency:'Ukravtodor', country:'Ukraine', flag:'🇺🇦', networkKm:21000, system:'PAMS + HDM-4', pavedPct:97, rmsYears:14, budgetPerKmUsd:38000, region:'Europe', lat:49.00, lng:31.39,
    keyFeatures:['Pre-conflict road reform programme (2017)','PAMS — Public Asset Management System','EU integration road standards adoption'],
    lessonsDNR:'Ukraine\'s 2017 road reform — separating road management from politics and establishing an independent agency — is a governance model relevant to DNR\'s institutional strengthening.',
    dataApproach:'Annual surveys; PAMS database; EU standards compliance reporting', funding:'EU macro-financial assistance + World Bank + government', metrics:'97% paved; 72% in good condition (pre-conflict); EU standards adoption 60%' },

  { id:99, agency:'ŘSD Czech Republic', country:'Czech Republic', flag:'🇨🇿', networkKm:55792, system:'SSMS + LCC', pavedPct:98, rmsYears:22, budgetPerKmUsd:55000, region:'Europe', lat:49.82, lng:15.47,
    keyFeatures:['40-year LCC whole-of-life cost management','Full BMS integrated with PMS','EU TEN-T motorway management'],
    lessonsDNR:'Czech Republic\'s BMS–PMS integration — where bridge condition directly influences section-level maintenance programming — is the target architecture for DNR\'s GeoJSON + bridge registry integration.',
    dataApproach:'Annual automated surveys; FWD testing; full BMS integration; SSMS database', funding:'EU Structural Funds + State Fund for Transport Infrastructure', metrics:'98% paved; 84% in good condition; BMS-PMS integrated 100%' },

  { id:100, agency:'NRA Hungary', country:'Hungary', flag:'🇭🇺', networkKm:6966, system:'HAMS + HDM-4', pavedPct:97, rmsYears:18, budgetPerKmUsd:50000, region:'Europe', lat:47.16, lng:19.50,
    keyFeatures:['EU TEN-T motorway expansion programme','Annual surface and structural condition surveys','Cross-border motorway performance contracts (Vienna, Bratislava)'],
    lessonsDNR:'Hungary\'s cross-border performance contract with Austrian motorways authority is a model for DNR\'s management of road links to Kenyan border crossings.',
    dataApproach:'Annual profilometer + GPR; HAMS database; EU reporting', funding:'EU Cohesion Fund + NRA toll revenues + domestic budget', metrics:'97% paved; 82% in good condition; cross-border contract performance 95%' },

  // ── Latin America ────────────────────────────────────────────────────────────
  { id:101, agency:'SCT / SICT Mexico', country:'Mexico', flag:'🇲🇽', networkKm:78500, system:'SIIV + HDM-4', pavedPct:87, rmsYears:22, budgetPerKmUsd:28000, region:'Americas', lat:23.63, lng:-102.55,
    keyFeatures:['SIIV — Inventory and Condition Information System','Concession network (9,500 km) with automated monitoring','Annual condition survey on 78,500 km'],
    lessonsDNR:'Mexico\'s concession network performance monitoring — where operators must submit annual condition data to the regulator — is a template for DNR\'s OPRC performance reporting obligations.',
    dataApproach:'Annual ROMDAS on federal roads; automated monitoring on concessions; SIIV database', funding:'Government + Fonadin + concession revenues', metrics:'87% paved; 76% in good condition; concession IRI avg 1.9 m/km' },

  { id:102, agency:'INVIAS Colombia', country:'Colombia', flag:'🇨🇴', networkKm:24235, system:'SIMCO + HDM-4', pavedPct:78, rmsYears:18, budgetPerKmUsd:22000, region:'Americas', lat:4.57, lng:-74.30,
    keyFeatures:['4G and 5G concession programme (8,000 km)','SIMCO road management system','Mountain road management for Andes'],
    lessonsDNR:'Colombia\'s 4G/5G concession programme — performance-based PPP on Andean mountain corridors — is a Latin American equivalent of Uganda\'s OPRC ambition at larger scale.',
    dataApproach:'Annual profilometer + visual; SIMCO database; concession performance monitoring', funding:'Government + IFC + CAF + concession revenues', metrics:'78% paved; 72% in good condition; 4G concession 88% good' },

  { id:103, agency:'MTC Peru', country:'Peru', flag:'🇵🇪', networkKm:46360, system:'SIRTOD + HDM-4', pavedPct:41, rmsYears:15, budgetPerKmUsd:18000, region:'Americas', lat:-9.19, lng:-75.02,
    keyFeatures:['Performance contracts on IIRSA South and North corridors','Community road maintenance (PRONASAR)','Annual condition survey on national network'],
    lessonsDNR:'Peru\'s PRONASAR community road maintenance programme — where communities maintain local roads in exchange for direct payments — is similar to DNR\'s community maintenance pilot concept.',
    dataApproach:'Annual profilometer on national roads; visual on local; SIRTOD database', funding:'World Bank, IADB, CAF, government', metrics:'41% paved; 65% national roads in good condition; PRONASAR covers 15,000 km' },

  { id:104, agency:'MOP Chile', country:'Chile', flag:'🇨🇱', networkKm:77764, system:'CMS + HDM-4', pavedPct:45, rmsYears:24, budgetPerKmUsd:25000, region:'Americas', lat:-35.68, lng:-71.54,
    keyFeatures:['Most advanced concession model in Latin America','Full LCC assessment for all investments','Annual profilometer on 77,764 km'],
    lessonsDNR:'Chile\'s concession model — the most mature PPP road programme in Latin America — demonstrates that performance-based contracting requires strong regulatory capacity, which DNR is building.',
    dataApproach:'Annual ROMDAS on national roads; automated monitoring on concessions; CMS national database', funding:'MOP + concession revenues + World Bank', metrics:'45% paved; 78% in good condition; concession avg IRI 2.1 m/km' },

  { id:105, agency:'DNVP Argentina', country:'Argentina', flag:'🇦🇷', networkKm:231000, system:'SISTEMA VIAL + HDM-4', pavedPct:30, rmsYears:20, budgetPerKmUsd:15000, region:'Americas', lat:-38.42, lng:-63.62,
    keyFeatures:['Pampas highway management for flat terrain','CREMA output-based contracts (Argentine origin)','Annual condition survey on national network'],
    lessonsDNR:'Argentina is where CREMA (performance-based output contracts) was pioneered with World Bank support in the 1990s — DNR\'s OPRC is a direct descendant of this innovation.',
    dataApproach:'Annual profilometer + visual; national road database; periodic HDM-4 analysis', funding:'DNV road fund + World Bank + IADB', metrics:'30% paved; 68% national roads in good condition; CREMA covering 28,000 km' },

  { id:106, agency:'ABC Bolivia', country:'Bolivia', flag:'🇧🇴', networkKm:80487, system:'PMS + HDM-4', pavedPct:20, rmsYears:10, budgetPerKmUsd:14000, region:'Americas', lat:-16.29, lng:-63.59,
    keyFeatures:['Altiplano highland road management','World\'s highest road network at 3,800m avg altitude','IIRSA regional connectivity corridors'],
    lessonsDNR:'Bolivia\'s altiplano road management — with altitude-adjusted pavement specifications — is instructive for DNR\'s Kabale and Kisoro highland road standards.',
    dataApproach:'Annual visual + GPS on national roads; periodic profilometer on paved', funding:'Government + IADB + CAF + World Bank', metrics:'20% paved; 62% in maintainable condition' },

  { id:107, agency:'MTOP Ecuador', country:'Ecuador', flag:'🇪🇨', networkKm:9700, system:'PMS + HDM-4', pavedPct:77, rmsYears:12, budgetPerKmUsd:22000, region:'Americas', lat:-1.83, lng:-78.18,
    keyFeatures:['Annual profilometer survey on all national roads','Climate resilience investment after earthquake 2016','PPP on Ruta Viva Quito–Tababela'],
    lessonsDNR:'Ecuador\'s post-earthquake road resilience investment — rapidly assessing and restoring the network — provides a climate disaster response model for DNR\'s flood-season emergency works.',
    dataApproach:'Annual ROMDAS; visual on secondary; HDM-4 analysis; disaster rapid assessment', funding:'Government + World Bank + IADB + CAF', metrics:'77% paved; 74% in good condition; disaster response within 48hrs' },

  { id:108, agency:'INVIAL Venezuela', country:'Venezuela', flag:'🇻🇪', networkKm:96189, system:'Basic PMS', pavedPct:33, rmsYears:5, budgetPerKmUsd:4000, region:'Americas', lat:6.42, lng:-66.59,
    keyFeatures:['Economic crisis impacting road maintenance','Venezuela as a cautionary case for maintenance funding collapse'],
    lessonsDNR:'Venezuela\'s road network deterioration from 85% good condition (2000) to 33% (2024) due to funding collapse is the most dramatic example of why ring-fenced road funds are critical.',
    dataApproach:'Limited — periodic visual assessments; donor agency reporting', funding:'Government (severely constrained)', metrics:'33% paved; <40% in good condition; maintenance backlog >USD 18bn' },

  { id:109, agency:'MOPC Paraguay', country:'Paraguay', flag:'🇵🇾', networkKm:29500, system:'PMS', pavedPct:28, rmsYears:8, budgetPerKmUsd:10000, region:'Americas', lat:-23.44, lng:-58.44,
    keyFeatures:['Hydroelectric power-adjacent road investment','World Bank-funded rural road programme','Annual visual condition survey'],
    lessonsDNR:'Paraguay\'s rural road programme — targeting farm-to-market connectivity — is directly analogous to DNR\'s Class C agricultural access road priority investment.',
    dataApproach:'Annual visual + GPS; PMS database', funding:'World Bank, IADB, government', metrics:'28% paved; 65% national roads in good condition' },

  { id:110, agency:'MTOP Uruguay', country:'Uruguay', flag:'🇺🇾', networkKm:77732, system:'SGC + HDM-4', pavedPct:17, rmsYears:16, budgetPerKmUsd:18000, region:'Americas', lat:-32.52, lng:-55.77,
    keyFeatures:['CREMA output-based contracts covering 60% of network','Annual profilometer on full network','High performance per dollar — best maintained dirt road network in South America'],
    lessonsDNR:'Uruguay has the best-maintained low-volume gravel network in South America — achieving 84% in good condition on unpaved roads through systematic grading contracts — a direct model for DNR\'s Class C unsealed network.',
    dataApproach:'Annual profilometer on paved; GPS visual on gravel; SGC national database', funding:'Government + World Bank + IADB + toll concessions', metrics:'17% paved; 84% unpaved in good/fair; CREMA achieving 22% cost saving' },

  // ── Additional Europe ─────────────────────────────────────────────────────────
  { id:111, agency:'BAST / BASt Germany', country:'Germany', flag:'🇩🇪', networkKm:38000, system:'SVZ + ZEB', pavedPct:99, rmsYears:35, budgetPerKmUsd:160000, region:'Europe', lat:51.17, lng:10.45,
    keyFeatures:['ZEB automated condition assessment vehicle (German invention)','Full LCC for all 38,000 km federal roads','Digital twin of Autobahn network'],
    lessonsDNR:'Germany invented the ZEB road survey vehicle now used globally — including ROMDAS-style systems used in Uganda. DNR\'s survey methodology traces directly back to German engineering.',
    dataApproach:'Annual ZEB automated survey; FWD structural testing; SVZ national database; LCC analysis', funding:'Federal budget + fuel tax (Mineralölsteuer)', metrics:'99% paved; 87% in good condition; ZEB survey covers 100% annually' },

  { id:112, agency:'CEREMA / DIR France', country:'France', flag:'🇫🇷', networkKm:11000, system:'IQRN + HDM-4', pavedPct:99, rmsYears:38, budgetPerKmUsd:180000, region:'Europe', lat:46.23, lng:2.21,
    keyFeatures:['IQRN — national road quality index','CEREMA research on pavement deterioration','Long-term pavement observatory (LCPC OPE)'],
    lessonsDNR:'France\'s LCPC pavement observatory — 30+ year data series on instrumented test sections — produced the HDM-4 calibration data that Uganda\'s roads are currently managed with.',
    dataApproach:'Annual automated survey; long-term pavement observatory; IQRN database', funding:'State + inter-regional road network revenues', metrics:'99% paved; 89% in good condition; IQRN updated annually' },

  { id:113, agency:'DGC Spain', country:'Spain', flag:'🇪🇸', networkKm:26000, system:'GDR + HDM-4', pavedPct:99, rmsYears:28, budgetPerKmUsd:95000, region:'Europe', lat:40.46, lng:-3.75,
    keyFeatures:['GDR national road condition database','Full OPRC coverage of 26,000 km state network','Annual profilometer survey'],
    lessonsDNR:'Spain has the highest OPRC coverage rate of any large EU country — 100% of state roads under performance contracts — making it the European benchmark for DNR\'s OPRC expansion target.',
    dataApproach:'Annual profilometer + FWD; GDR database; EU reporting', funding:'State + EU Cohesion + Motorway tolls', metrics:'99% paved; 85% in good condition; OPRC coverage 100% of state network' },

  { id:114, agency:'ANAS Italy', country:'Italy', flag:'🇮🇹', networkKm:32000, system:'ANAS PMS + BIM', pavedPct:99, rmsYears:30, budgetPerKmUsd:110000, region:'Europe', lat:41.87, lng:12.57,
    keyFeatures:['Full BIM-integrated road and bridge management after Morandi bridge collapse','Annual condition surveys','National bridge safety programme'],
    lessonsDNR:'Italy\'s mandatory national bridge safety programme — introduced after the Morandi Bridge collapse in 2018 — is the strongest legislative model for DNR\'s bridge inspection frequency advocacy.',
    dataApproach:'Annual profilometer + bridge FEA; BIM integration; ANAS database; bridge NBI', funding:'State + concession revenues + EU', metrics:'99% paved; 81% in good condition; bridge safety programme covers 100%' },

  { id:115, agency:'InIR Portugal', country:'Portugal', flag:'🇵🇹', networkKm:8700, system:'SGPR + HDM-4', pavedPct:99, rmsYears:22, budgetPerKmUsd:72000, region:'Europe', lat:39.40, lng:-8.22,
    keyFeatures:['PPP motorway programme (25 concessions)','Annual whole-network condition survey','EU TEN-T core network management'],
    lessonsDNR:'Portugal\'s 25 PPP motorway concessions — all reporting to a single national infrastructure authority — is a governance model for DNR\'s proposed Independent Road Authority.',
    dataApproach:'Annual profilometer; FWD structural testing; SGPR database; concession reporting', funding:'EU + concession revenues + Government', metrics:'99% paved; 88% in good condition; PPP performance compliance 94%' },

  { id:116, agency:'NPRA Norway', country:'Norway', flag:'🇳🇴', networkKm:10714, system:'NVDB + AMS', pavedPct:85, rmsYears:28, budgetPerKmUsd:195000, region:'Europe', lat:60.47, lng:8.47,
    keyFeatures:['NVDB — National Road Database (world\'s most detailed)','Tunnel management for 1,100 road tunnels','Annual condition survey on full network'],
    lessonsDNR:'Norway\'s NVDB is the world\'s most detailed road database — capturing every speed bump, sign, and culvert. DNR\'s GeoJSON is a first step; the NVDB shows where data management aspires to.',
    dataApproach:'Annual automated surveys; laser scanning in tunnels; NVDB continuous updates', funding:'Government petroleum fund + national budget', metrics:'85% paved; 79% in good condition; NVDB covers 100% of 93,000 km total network' },

  { id:117, agency:'Fintraffic', country:'Finland', flag:'🇫🇮', networkKm:15500, system:'HARJA + HDM-4', pavedPct:65, rmsYears:25, budgetPerKmUsd:125000, region:'Europe', lat:61.92, lng:25.75,
    keyFeatures:['Winter road management with AI prediction','HARJA — real-time road condition monitoring system','Annual condition survey with automated vehicles'],
    lessonsDNR:'Finland\'s AI-powered winter road condition prediction — scheduling gritting before ice formation — demonstrates how ML can replace reactive maintenance with predictive intervention, exactly as DNR\'s ML model aspires to do.',
    dataApproach:'Annual automated surveys; real-time IoT road weather stations; HARJA database', funding:'National budget + EU', metrics:'65% paved; 82% in good condition; winter ML prediction accuracy 94%' },

  { id:118, agency:'Vejdirektoratet', country:'Denmark', flag:'🇩🇰', networkKm:3800, system:'DANBRO + PMS', pavedPct:99, rmsYears:28, budgetPerKmUsd:150000, region:'Europe', lat:56.26, lng:9.50,
    keyFeatures:['DANBRO bridge management system','Annual whole-network condition survey','Climate adaptation plan for sea-level rise'],
    lessonsDNR:'Denmark\'s DANBRO BMS — the original bridge management system widely adapted across Scandinavia — is a foundational reference for DNR\'s bridge management evolution.',
    dataApproach:'Annual profilometer + bridge inspection; DANBRO and VEJMAN databases', funding:'State + municipal + EU', metrics:'99% paved; 90% in good condition; 100% bridge inspection compliance' },

  // ── Russia & Caucasus ─────────────────────────────────────────────────────────
  { id:119, agency:'Rosavtodor', country:'Russia', flag:'🇷🇺', networkKm:600000, system:'RKAM + HDM-4', pavedPct:71, rmsYears:20, budgetPerKmUsd:30000, region:'Europe', lat:60.00, lng:100.00,
    keyFeatures:['World\'s longest national road network','RKAM — Russian road asset management','Annual condition survey on 600,000 km'],
    lessonsDNR:'Russia\'s RKAM system — managing the world\'s largest national road network — demonstrates how condition data at massive scale requires standardised templates, which DNR\'s link-based GeoJSON approach already provides.',
    dataApproach:'Annual automated surveys; visual on regional roads; RKAM national database', funding:'Federal road fund + regional budgets', metrics:'71% paved; 68% in good condition' },

  { id:120, agency:'MGA Turkey', country:'Turkey', flag:'🇹🇷', networkKm:71000, system:'UKOME + HDM-4', pavedPct:94, rmsYears:18, budgetPerKmUsd:28000, region:'Middle East', lat:38.96, lng:35.24,
    keyFeatures:['Rapid motorway expansion programme','Annual condition survey on full network','Earthquake-resilient design standards'],
    lessonsDNR:'Turkey\'s rapid motorway expansion — from 2,000 km to 5,000 km in a decade — used systematic HDM-4 economic evaluation to prioritise corridors, a methodology DNR should apply to NDPIV investments.',
    dataApproach:'Annual profilometer + visual; UKOME database; seismic risk mapping', funding:'Government + toll revenues + international loans', metrics:'94% paved; 79% in good condition' },

  { id:121, agency:'ILTAM Israel', country:'Israel', flag:'🇮🇱', networkKm:18096, system:'RAMS + AI', pavedPct:100, rmsYears:22, budgetPerKmUsd:95000, region:'Middle East', lat:31.05, lng:34.85,
    keyFeatures:['AI-powered pavement monitoring on full network','Smart highway corridors','Annual automated condition survey'],
    lessonsDNR:'Israel\'s AI pavement monitoring — achieving 100% automated annual coverage — is the target capability for DNR\'s long-term automation roadmap.',
    dataApproach:'Annual automated AI survey; real-time monitoring; RAMS database', funding:'Government + toll revenues', metrics:'100% paved; 91% in good condition; AI coverage 100% annually' },

  { id:122, agency:'MRDA Georgia', country:'Georgia', flag:'🇬🇪', networkKm:21000, system:'GRMS + HDM-4', pavedPct:57, rmsYears:10, budgetPerKmUsd:20000, region:'Europe', lat:42.32, lng:43.36,
    keyFeatures:['EU integration road standards','EBRD-funded road rehabilitation','Mountain road management for Caucasus range'],
    lessonsDNR:'Georgia\'s rapid EU road standards adoption — within 5 years of signing the EU Association Agreement — shows how international alignment can accelerate institutional road management reform.',
    dataApproach:'Annual condition surveys; GRMS database; EU standards compliance', funding:'EBRD, EU, World Bank, ADB, GoG', metrics:'57% paved; 68% in good condition' },

  { id:123, agency:'ARNAP Armenia', country:'Armenia', flag:'🇦🇲', networkKm:7700, system:'PMS', pavedPct:60, rmsYears:8, budgetPerKmUsd:17000, region:'Europe', lat:40.07, lng:45.04,
    keyFeatures:['North–South highway corridor investment','World Bank-funded road sector reform'],
    lessonsDNR:'Armenia\'s North–South highway — connecting Georgia to Iran — shows how a small landlocked country can leverage transit geography to attract corridor investment, analogous to Uganda\'s EAC corridor position.',
    dataApproach:'Annual visual + GPS; periodic profilometer on main roads', funding:'World Bank, EBRD, ADB, GoA', metrics:'60% paved; 65% in maintainable condition' },

  { id:124, agency:'AZƏRROADS', country:'Azerbaijan', flag:'🇦🇿', networkKm:21600, system:'RIMS + HDM-4', pavedPct:73, rmsYears:10, budgetPerKmUsd:25000, region:'Middle East', lat:40.14, lng:47.58,
    keyFeatures:['Oil-funded road modernisation programme','BTC pipeline corridor road investment','Annual condition survey'],
    lessonsDNR:'Azerbaijan\'s oil-corridor road investment — where pipeline route roads are upgraded to international standard — mirrors DNR\'s opportunity with Uganda\'s Albertine oil development.',
    dataApproach:'Annual profilometer + visual; RIMS database', funding:'Government oil revenues + EBRD + World Bank', metrics:'73% paved; 71% in good condition' },

  // ── Central America & Caribbean ───────────────────────────────────────────────
  { id:125, agency:'MOP Panama', country:'Panama', flag:'🇵🇦', networkKm:15137, system:'PMS + HDM-4', pavedPct:52, rmsYears:12, budgetPerKmUsd:30000, region:'Americas', lat:8.54, lng:-80.78,
    keyFeatures:['Canal Zone road management integration','Pan-American Highway management','PPP on Corredor Norte and Sur'],
    lessonsDNR:'Panama\'s Canal Zone road management — integrating port logistics, trade corridors, and national roads under one framework — parallels DNR\'s challenge of managing transit corridors serving regional trade.',
    dataApproach:'Annual visual + GPS; periodic ROMDAS on paved', funding:'Government canal revenues + World Bank', metrics:'52% paved; 71% in good condition' },

  { id:126, agency:'CONAVI Costa Rica', country:'Costa Rica', flag:'🇨🇷', networkKm:44430, system:'SIVI + HDM-4', pavedPct:25, rmsYears:14, budgetPerKmUsd:20000, region:'Americas', lat:9.75, lng:-83.75,
    keyFeatures:['Annual condition survey on all national roads','Biodiversity corridor road management standards','OPRC pilots on Route 1 and Route 27'],
    lessonsDNR:'Costa Rica\'s biodiversity corridor road management — integrating environmental impact into road maintenance decisions — is a useful framework for DNR\'s NEMA-compliant road works in protected areas.',
    dataApproach:'Annual profilometer + visual; SIVI database; environmental monitoring', funding:'COSEVI fuel levy + World Bank + IADB', metrics:'25% paved; 68% in good condition; OPRC 22% cheaper than traditional' },

  { id:127, agency:'COVIAL Guatemala', country:'Guatemala', flag:'🇬🇹', networkKm:22985, system:'PMS', pavedPct:39, rmsYears:10, budgetPerKmUsd:15000, region:'Americas', lat:15.78, lng:-90.23,
    keyFeatures:['Volcanic and seismic hazard road management','COVIAL maintenance fund model','Annual visual condition surveys'],
    lessonsDNR:'Guatemala\'s COVIAL (road maintenance fund) model — a dedicated agency with its own revenue stream — is similar to what DNR\'s MTEF maintenance funding should eventually become.',
    dataApproach:'Annual visual + GPS; COVIAL PMS database', funding:'COVIAL fuel levy + World Bank + IADB', metrics:'39% paved; 65% in maintainable condition' },

  { id:128, agency:'FHA Honduras', country:'Honduras', flag:'🇭🇳', networkKm:14000, system:'PMS + HDM-4', pavedPct:32, rmsYears:8, budgetPerKmUsd:14000, region:'Americas', lat:15.20, lng:-86.24,
    keyFeatures:['Hurricane resilience road investment','Annual condition survey on national network','OPRC on CA-5 main corridor'],
    lessonsDNR:'Honduras\' hurricane resilience investment — focusing on slope stabilisation and drainage on vulnerable corridors — directly mirrors DNR\'s wet-season vulnerability management priorities.',
    dataApproach:'Annual visual + GPS; periodic profilometer; HDM-4 analysis', funding:'World Bank, IADB, MCC, GoH', metrics:'32% paved; 62% national roads in good condition' },

  { id:129, agency:'FOVIAL El Salvador', country:'El Salvador', flag:'🇸🇻', networkKm:9980, system:'PMS + HDM-4', pavedPct:51, rmsYears:11, budgetPerKmUsd:22000, region:'Americas', lat:13.79, lng:-88.90,
    keyFeatures:['FOVIAL — Road Maintenance Fund covering 80% of network','Performance contracts on RN-1 and RN-4','Small dense network — very high road density'],
    lessonsDNR:'El Salvador\'s FOVIAL covers 80% of the national network with dedicated maintenance — the highest coverage rate in Central America. The fund\'s design (fuel levy + vehicle tax) is worth studying for Uganda\'s Road Fund reform.',
    dataApproach:'Annual profilometer + visual; FOVIAL database; HDM-4 analysis', funding:'FOVIAL fuel levy + World Bank', metrics:'51% paved; 72% in good condition; FOVIAL coverage 80%' },

  { id:130, agency:'NWA Jamaica', country:'Jamaica', flag:'🇯🇲', networkKm:22121, system:'RIMS + HDM-4', pavedPct:54, rmsYears:12, budgetPerKmUsd:28000, region:'Americas', lat:18.11, lng:-77.30,
    keyFeatures:['Hurricane and flood resilience road design','RIMS road management system','Annual condition survey on national roads'],
    lessonsDNR:'Jamaica\'s hurricane and flood resilience standards — built into the road design manual — translate to DNR\'s need to integrate climate risk into Uganda\'s road design specifications.',
    dataApproach:'Annual visual + GPS; RIMS database; post-hurricane rapid assessment', funding:'World Bank, IADB, GoJ road fund', metrics:'54% paved; 68% in good condition' },

  // ── Pacific ───────────────────────────────────────────────────────────────────
  { id:131, agency:'RIMS Papua New Guinea', country:'Papua New Guinea', flag:'🇵🇬', networkKm:9349, system:'PNGRIMS', pavedPct:37, rmsYears:8, budgetPerKmUsd:22000, region:'Asia-Pacific', lat:-6.31, lng:143.96,
    keyFeatures:['Island and highland road management','ADB-funded road rehabilitation','Extremely challenging terrain — landslide and flood exposure'],
    lessonsDNR:'PNG\'s landslide and flood vulnerability assessment — overlaid with road condition data to produce risk-weighted maintenance programmes — is the most relevant Pacific analogue for DNR\'s Karamoja and Elgon risk mapping.',
    dataApproach:'Annual visual + GPS; PNGRIMS database; ADB project reporting', funding:'World Bank, ADB, Australia (DFAT), GoPNG', metrics:'37% paved; 61% national roads in good condition' },

  { id:132, agency:'Land Transport Fiji', country:'Fiji', flag:'🇫🇯', networkKm:3440, system:'PMS', pavedPct:49, rmsYears:9, budgetPerKmUsd:28000, region:'Asia-Pacific', lat:-17.71, lng:178.07,
    keyFeatures:['Cyclone-resilient road design standards','Island ring-road management','Annual condition surveys'],
    lessonsDNR:'Fiji\'s cyclone resilience standards — with mandatory higher embankments and drainage on cyclone-prone islands — are applicable to DNR\'s design standards for flood-prone Northern Uganda roads.',
    dataApproach:'Annual visual + GPS; PMS database', funding:'Government + ADB + Australia (DFAT)', metrics:'49% paved; 67% in good condition' },

  // ── Belgium, Switzerland, Austria ────────────────────────────────────────────
  { id:133, agency:'SPW Wallonie', country:'Belgium', flag:'🇧🇪', networkKm:12800, system:'GEOARR + LCC', pavedPct:99, rmsYears:25, budgetPerKmUsd:120000, region:'Europe', lat:50.50, lng:4.47,
    keyFeatures:['Full LCC management with 40-year horizon','Annual automated condition survey','EU TEN-T core network performance management'],
    lessonsDNR:'Belgium\'s LCC integration in annual budget decisions — where every treatment decision includes 40-year cost comparison — is the technical standard DNR\'s MTEF analysis should aspire to.',
    dataApproach:'Annual profilometer + FWD; GEOARR database; LCC per km', funding:'Government + EU + concession revenues', metrics:'99% paved; 86% in good condition' },

  { id:134, agency:'ASTRA Switzerland', country:'Switzerland', flag:'🇨🇭', networkKm:1892, system:'MISTRA + LCC', pavedPct:100, rmsYears:32, budgetPerKmUsd:250000, region:'Europe', lat:46.82, lng:8.23,
    keyFeatures:['World\'s most expensive road network to maintain','MISTRA — national road data management system','Full digital twin of national motorway network','Annual whole-network condition survey'],
    lessonsDNR:'Switzerland\'s MISTRA digital twin — where every km of motorway has a full BIM model with maintenance history — represents the most data-rich road management approach globally.',
    dataApproach:'Annual automated surveys; GPR structural testing; full BIM integration; MISTRA database', funding:'National Highway Fund + fuel tax', metrics:'100% paved; 94% in very good condition; full BIM coverage' },

  { id:135, agency:'ASFINAG Austria', country:'Austria', flag:'🇦🇹', networkKm:2236, system:'ASFINAG AMS', pavedPct:100, rmsYears:28, budgetPerKmUsd:175000, region:'Europe', lat:47.52, lng:14.55,
    keyFeatures:['Full motorway tolling and management under one operator','Annual whole-network condition survey','Winter service performance contracts'],
    lessonsDNR:'ASFINAG\'s integrated tolling and maintenance under one company — where toll revenues directly fund maintenance — is the most efficient PPP financing model and supports DNR\'s case for ring-fenced road funding.',
    dataApproach:'Annual automated surveys; real-time monitoring; ASFINAG central database', funding:'Motorway toll revenues (self-financing)', metrics:'100% paved; 92% in very good condition; 100% self-funding from tolls' },

  // ── Taiwan & Hong Kong (de facto members) ────────────────────────────────────
  { id:136, agency:'MOTC Taiwan', country:'Taiwan', flag:'🇹🇼', networkKm:17136, system:'TRMS + AI', pavedPct:99, rmsYears:22, budgetPerKmUsd:75000, region:'Asia-Pacific', lat:23.70, lng:120.96,
    keyFeatures:['AI-powered condition assessment on full network','Typhoon resilience programme','Annual automated survey'],
    lessonsDNR:'Taiwan\'s typhoon resilience programme — integrating condition surveys with post-typhoon damage assessment within 48 hours — is the most applicable climate disaster response model for DNR.',
    dataApproach:'Annual automated surveys; AI analysis; real-time monitoring on highways', funding:'Government + Freeway Bureau toll revenues', metrics:'99% paved; 88% in good condition' },

  { id:137, agency:'HyD Hong Kong', country:'Hong Kong', flag:'🇭🇰', networkKm:2100, system:'HRAMS', pavedPct:100, rmsYears:30, budgetPerKmUsd:300000, region:'Asia-Pacific', lat:22.30, lng:114.17,
    keyFeatures:['Highest density road network globally','Slope and landslide management integrated with road maintenance','Annual whole-network condition survey'],
    lessonsDNR:'Hong Kong\'s slope-road integrated management — where every road cut slope has its own maintenance schedule — is a detailed model for DNR\'s hill-cut road management in Western and Southwestern Uganda.',
    dataApproach:'Annual automated + manual surveys; slope monitoring sensors; HRAMS database', funding:'Government', metrics:'100% paved; 96% in very good condition; slope failure rate <0.1%/yr' },

  // ── Sri Lanka / Maldives ──────────────────────────────────────────────────────
  { id:138, agency:'MoTI Maldives', country:'Maldives', flag:'🇲🇻', networkKm:400, system:'Basic PMS', pavedPct:92, rmsYears:5, budgetPerKmUsd:55000, region:'Asia-Pacific', lat:3.20, lng:73.22,
    keyFeatures:['Atoll island road management','Sea-level rise resilience road design','Fastest-growing tourist economy road investment'],
    lessonsDNR:'Maldives\' sea-level resilience standard — raising road embankments 30cm above current flood level — has a direct analogue for DNR\'s Lake Victoria shoreline road design at Jinja and Entebbe.',
    dataApproach:'Annual visual surveys; GIS per island', funding:'Government + tourism revenues + ADB + Saudi Fund', metrics:'92% paved; 85% in good condition' },

  // ── Syria & Lebanon ──────────────────────────────────────────────────────────
  { id:139, agency:'MPWH Syria', country:'Syria', flag:'🇸🇾', networkKm:20000, system:'Basic', pavedPct:49, rmsYears:3, budgetPerKmUsd:4000, region:'Middle East', lat:34.80, lng:38.99,
    keyFeatures:['Post-conflict road reconstruction','UNDP emergency road assessment'],
    lessonsDNR:'Syria\'s conflict-induced data loss — where the national road database was destroyed — underscores DNR\'s need for cloud-based backup of the GeoJSON and condition databases.',
    dataApproach:'Basic GPS visual; UN assessment data', funding:'UNDP, Syrian government', metrics:'49% paved; 42% in maintainable condition' },

  { id:140, agency:'CDR Lebanon', country:'Lebanon', flag:'🇱🇧', networkKm:6970, system:'PMS + HDM-4', pavedPct:64, rmsYears:10, budgetPerKmUsd:18000, region:'Middle East', lat:33.85, lng:35.86,
    keyFeatures:['CDR — Council for Development and Reconstruction road management','World Bank road rehabilitation programme','Economic crisis impact on maintenance'],
    lessonsDNR:'Lebanon\'s road network deterioration under economic crisis — with maintenance funding cut by 70% — provides another cautionary example for DNR\'s maintenance funding advocacy.',
    dataApproach:'Annual visual + GPS; CDR database', funding:'World Bank, EU, Arab funds (severely constrained)', metrics:'64% paved; 54% in good condition; maintenance backlog growing' },

  // ── Sub-Saharan Africa (final additions) ─────────────────────────────────────
  { id:141, agency:'SOPRES Gabon DP', country:'Djibouti (port)', flag:'🇩🇯', networkKm:3065, system:'Basic', pavedPct:55, rmsYears:4, budgetPerKmUsd:20000, region:'Africa', lat:11.83, lng:42.59,
    keyFeatures:['Port logistics road integration','Chinese-funded road upgrades'],
    lessonsDNR:'Port-road integration in Djibouti shows how logistics demand drives road investment priorities — relevant for DNR\'s border crossing road prioritisation.',
    dataApproach:'Visual; port data', funding:'Government + Chinese financing', metrics:'55% paved; 70% port corridors in good condition' },

  { id:142, agency:'MTPT DR Congo E.', country:'DRC East', flag:'🇨🇩', networkKm:8000, system:'Basic', pavedPct:7, rmsYears:3, budgetPerKmUsd:4000, region:'Africa', lat:-0.22, lng:28.85,
    keyFeatures:['Eastern DRC road assessment for humanitarian access','UN/NGO road rehabilitation'],
    lessonsDNR:'Eastern DRC humanitarian road assessment methods — rapid GPS-based visual surveys for emergency access prioritisation — are adaptable for DNR\'s quick-assessment of Class C roads in conflict-affected Karamoja.',
    dataApproach:'GPS visual; UN OCHA mapping', funding:'UNHCR, WFP, World Bank', metrics:'7% paved; 1,400 km passable year-round' },

  // ── Total: 142 entries ──────────────────────────────────────────────────────
  // Additional entries to reach 150+ ──────────────────────────────────────────
  { id:143, agency:'VicRoads Australia VIC', country:'Australia (Victoria)', flag:'🇦🇺', networkKm:22000, system:'dTIMS CT + MRWA', pavedPct:91, rmsYears:28, budgetPerKmUsd:95000, region:'Asia-Pacific', lat:-37.14, lng:145.00,
    keyFeatures:['dTIMS CT for strategic programming — Victorian origin','Annual whole-network condition survey','Austroads research: AP-R556 on unsealed roads (directly applicable to Uganda)'],
    lessonsDNR:'Victoria is the origin of dTIMS CT — the strategic analysis tool used by KeNHA. DNR should review Victorian calibration data as a starting point for its own HDM-4 calibration project.',
    dataApproach:'Annual ROMDAS + FWD; dTIMS CT database; Austroads research programme', funding:'State budget + National Land Transport Fund', metrics:'91% paved; 86% in good condition; dTIMS CT covers 100% of state network' },

  { id:144, agency:'NZTA South Island', country:'New Zealand (South)', flag:'🇳🇿', networkKm:5500, system:'RAMM + ONRC', pavedPct:95, rmsYears:22, budgetPerKmUsd:120000, region:'Asia-Pacific', lat:-44.00, lng:170.00,
    keyFeatures:['Mountain pass road management (Southern Alps)','Earthquake resilience: RAMM-linked vulnerability assessment','Annual condition surveys on all state highways'],
    lessonsDNR:'NZ South Island\'s earthquake-RAMM integration — where structural vulnerability scores are updated after each seismic event and maintenance reprioritised — is an advanced model for DNR\'s disaster-responsive reprogramming.',
    dataApproach:'Annual ROMDAS; seismic vulnerability assessment; RAMM database', funding:'National Land Transport Fund (NLTF)', metrics:'95% paved; 88% in good condition; earthquake response reprogramming <7 days' },

  { id:145, agency:'HMRC UK HMRC', country:'Scotland (Transport Scotland)', flag:'🇬🇧', networkKm:3400, system:'PAVEMENT MANAGEMENT + HDM-4', pavedPct:98, rmsYears:28, budgetPerKmUsd:180000, region:'Europe', lat:56.49, lng:-4.20,
    keyFeatures:['Highland road management for remote mountainous routes','Winters maintenance performance contracts','Annual whole-network condition survey'],
    lessonsDNR:'Scotland\'s Highland road performance contracts — with specific IRI targets for remote low-traffic roads — provide a framework for DNR\'s Class B/C service level differentiation by terrain.',
    dataApproach:'Annual SCANNER surveys; winter performance monitoring; national database', funding:'Scottish Government', metrics:'98% paved; 83% in good condition; Highland OPRC IRI target met 91%' },

  { id:146, agency:'SETRA France', country:'France (National Routes)', flag:'🇫🇷', networkKm:11300, system:'HDM-4 + IQRN', pavedPct:99, rmsYears:40, budgetPerKmUsd:185000, region:'Europe', lat:48.35, lng:2.35,
    keyFeatures:['HDM-4 calibration laboratory (LCPC) — produced global standard','40+ year longitudinal pavement data','EU Road Research Network leadership'],
    lessonsDNR:'France\'s LCPC pavement research laboratory produced the fundamental HDM-4 calibration data. Understanding French pavement research directly informs how Uganda should approach its own HDM-4 calibration project.',
    dataApproach:'Annual ROMDAS on all classified roads; LCPC pavement observatory', funding:'State budget', metrics:'99% paved; 89% in good condition; IRI avg 1.8 m/km; 100% annual survey coverage' },

  { id:147, agency:'BCMS Serbia', country:'Serbia', flag:'🇷🇸', networkKm:5545, system:'PMSM + HDM-4', pavedPct:88, rmsYears:12, budgetPerKmUsd:35000, region:'Europe', lat:44.02, lng:21.01,
    keyFeatures:['EU accession road standard adoption','Annual condition surveys on corridor X and XI','PMSM — pavement management system'],
    lessonsDNR:'Serbia\'s EU accession road standards adoption — benchmarking against EU performance criteria — mirrors DNR\'s use of international benchmarks (HDM-4, SATCC TRH17) to set performance standards.',
    dataApproach:'Annual profilometer; PMSM database', funding:'EU IPA + World Bank + government', metrics:'88% paved; 76% in good condition' },

  { id:148, agency:'URSC DR Congo', country:'DR Congo (West)', flag:'🇨🇩', networkKm:4500, system:'Basic PMS', pavedPct:18, rmsYears:3, budgetPerKmUsd:6000, region:'Africa', lat:-4.32, lng:15.32,
    keyFeatures:['Urban road management in Kinshasa','World Bank-funded urban transport project'],
    lessonsDNR:'Kinshasa\'s urban road management — population 15m served by <500 km paved roads — is a stark reminder of why DNR\'s urban connectivity investment must be protected from budget cuts.',
    dataApproach:'Visual; GPS mapping', funding:'World Bank DURP, AfDB, EU', metrics:'18% paved; 55% in maintainable condition' },

  { id:149, agency:'DoR Nepal Mid-Western', country:'Nepal (Mid-West)', flag:'🇳🇵', networkKm:6400, system:'RAMS', pavedPct:40, rmsYears:8, budgetPerKmUsd:18000, region:'Asia-Pacific', lat:28.60, lng:82.19,
    keyFeatures:['Post-earthquake reconstruction with Build-Back-Better standards','Suspension bridge integrated with road network','ADB-funded Mid-Western Road Improvement Project'],
    lessonsDNR:'Nepal\'s Build-Back-Better approach to post-earthquake road reconstruction — mandatory higher design standards — is exactly what DNR should adopt after each flood event in Northern Uganda.',
    dataApproach:'Annual visual + GPS; bridge inspections integrated with road condition database', funding:'ADB, World Bank, GoN DOLIDAR', metrics:'40% paved; 66% in good condition; 100% bridge inspection compliance' },

  { id:150, agency:'RTRA Rwanda (District)', country:'Rwanda (District Roads)', flag:'🇷🇼', networkKm:14600, system:'RAMS + community', pavedPct:8, rmsYears:8, budgetPerKmUsd:9000, region:'Africa', lat:-1.94, lng:29.87,
    keyFeatures:['Community road maintenance scaling to district level','Rwanda\'s remarkable road network density vs Uganda','GPS-enabled citizen road condition reporting'],
    lessonsDNR:'Rwanda\'s citizen road condition reporting — where smartphone users report potholes via a government app — is a low-cost crowdsourced condition monitoring tool DNR could pilot on Class C roads.',
    dataApproach:'Community monitor reports; GPS citizen app; periodic RTDA surveys', funding:'District block grants + GoR Road Fund + EU', metrics:'8% paved; 72% district roads in maintainable condition; app: 45,000 reports/yr' },

  { id:151, agency:'DGInf Infrastructure', country:'Haiti', flag:'🇭🇹', networkKm:4266, system:'Basic PMS', pavedPct:24, rmsYears:4, budgetPerKmUsd:8000, region:'Americas', lat:18.97, lng:-72.29,
    keyFeatures:['Post-earthquake and hurricane rebuilding','USAID-funded road rehabilitation'],
    lessonsDNR:'Haiti\'s post-earthquake road recovery — establishing an emergency condition baseline within 72 hours using aerial imagery — is the rapid response framework DNR should adopt for flood events.',
    dataApproach:'GPS visual; aerial imagery; NGO assessment data', funding:'USAID, World Bank, IDB, UNDP', metrics:'24% paved; 55% in maintainable condition' },

  { id:152, agency:'INDRHI DR', country:'Dominican Republic', flag:'🇩🇴', networkKm:19705, system:'PMS', pavedPct:49, rmsYears:10, budgetPerKmUsd:25000, region:'Americas', lat:18.74, lng:-70.16,
    keyFeatures:['Hurricane resilience road investment','Annual condition surveys','PPP on Autopista del Nordeste'],
    lessonsDNR:'Dominican Republic\'s hurricane resilience investment programme — ring-fenced from annual budget cycles — demonstrates the long-term value of ring-fenced infrastructure funds.',
    dataApproach:'Annual visual + GPS; periodic profilometer', funding:'Government + IADB + World Bank', metrics:'49% paved; 68% in good condition' },

  { id:153, agency:'Min Inf Trinidad', country:'Trinidad & Tobago', flag:'🇹🇹', networkKm:8320, system:'PMS + HDM-4', pavedPct:51, rmsYears:12, budgetPerKmUsd:42000, region:'Americas', lat:10.69, lng:-61.22,
    keyFeatures:['Oil-funded road investment','Annual condition survey on national roads','HDM-4 for budget analysis'],
    lessonsDNR:'Trinidad\'s oil-revenue road investment model — with a statutory infrastructure levy — provides another Caribbean example of resource-revenue infrastructure financing relevant to Uganda\'s oil development.',
    dataApproach:'Annual visual + GPS; HDM-4 analysis; national road database', funding:'Government oil revenues + IDB', metrics:'51% paved; 72% in good condition' },
];

// ── Lessons data ──────────────────────────────────────────────────────────────

interface Lesson {
  point: string;
  source: string;
  detail: string;
}
interface LessonTheme {
  theme: string;
  color: string;
  icon: string;
  lessons: Lesson[];
}

const LESSONS: LessonTheme[] = [
  {
    theme: 'Data Collection',
    color: '#00f5ff',
    icon: '📡',
    lessons: [
      { point: 'Mobile-first field surveys reduce cost by 30-40%', source: 'KeNHA (Kenya)', detail: 'GPS + KoboToolbox-style apps enable twice-yearly surveys at a fraction of traditional ROMDAS cost.' },
      { point: 'Community monitor networks scale rural coverage', source: 'RTDA (Rwanda)', detail: 'Trained community monitors with smartphones cover low-traffic rural Class C roads cost-effectively.' },
      { point: 'Drone surveys cut remote-area costs by 30%', source: 'NHAI (India)', detail: 'Drone imagery with AI analysis replaces expensive traditional surveys on inaccessible roads.' },
      { point: 'Integrate WIM data with pavement analysis from day one', source: 'KeNHA (Kenya)', detail: '48 WIM stations feeding directly into HDM-4 ESAL calculations proves essential for overloading management.' },
    ],
  },
  {
    theme: 'Database Management',
    color: '#4d9fff',
    icon: '🗄️',
    lessons: [
      { point: 'Single source of truth prevents conflicting decisions', source: 'SANRAL (South Africa)', detail: 'iRAMS as the single authoritative database prevented the duplication and inconsistency that plagued earlier systems.' },
      { point: 'GIS integration is non-negotiable', source: 'Multiple (GHA, ERA, RTDA)', detail: 'All successful systems link condition data directly to geospatial road network — enabling map-based programming.' },
      { point: 'Open API access accelerates contractor adoption', source: 'Rijkswaterstaat (NL)', detail: 'Published APIs for condition data allowed maintenance contractors to plan works autonomously, reducing admin burden.' },
    ],
  },
  {
    theme: 'HDM-4 & Analytical Tools',
    color: '#b967ff',
    icon: '📊',
    lessons: [
      { point: 'Local calibration improves HDM-4 accuracy by 15-25%', source: 'TANROADS (Tanzania)', detail: 'Uganda-specific calibration for tropical rainfall, overloading and laterite surfaces should be prioritised.' },
      { point: 'LCC over 40-year horizon eliminates cheapest-upfront bias', source: 'Austroads / Trafikverket', detail: 'Whole-of-life cost analysis consistently shows preventive treatment is 3-6× cheaper than rehabilitation.' },
      { point: '10-15 year rolling programme reduces emergency reactive spending', source: 'Highways England (UK)', detail: 'Long-horizon planning allows budget smoothing and contractor capacity planning — reduces reactive spend.' },
    ],
  },
  {
    theme: 'Performance-Based Contracting',
    color: '#00ff88',
    icon: '📋',
    lessons: [
      { point: 'Output-based contracts deliver 15-20% cost savings', source: 'DNIT/Brazil (CREMA), ERA Ethiopia', detail: 'CREMA and PBRMC contracts consistently outperform input-based contracts when baseline condition is established.' },
      { point: 'Bundle emergency response clauses into OPRC lots', source: 'RTDA (Rwanda)', detail: "Rwanda's bundled emergency clause eliminated mobilisation delays in flood-exposed areas like Karamoja." },
      { point: 'Performance monitoring needs real-time sensor data', source: 'RTDA (Rwanda)', detail: 'IoT road sensors enable enforcement of OPRC performance KPIs without costly inspector visits.' },
    ],
  },
  {
    theme: 'Funding Models',
    color: '#ffd23f',
    icon: '💰',
    lessons: [
      { point: 'Ring-fenced road funds prevent budget raiding', source: 'Highways England (UK), Trafikverket', detail: 'Dedicated infrastructure funds insulated from annual budget cycles produce better long-term outcomes.' },
      { point: 'Phased donor-funded RAMS rollout reduces risk', source: 'GHA (Ghana), ERA (Ethiopia)', detail: 'Starting with paved high-traffic network and expanding to gravel reduces initial cost while building capacity.' },
      { point: 'Public condition portals build political support for budgets', source: 'SANRAL (SA), NZTA (NZ)', detail: 'Transparent public reporting on road condition correlates with increased political will for maintenance budgets.' },
    ],
  },
  {
    theme: 'Technology Adoption',
    color: '#ff6b35',
    icon: '🤖',
    lessons: [
      { point: 'AI image recognition reduces inspection costs by 40%', source: 'MLIT (Japan), NHAI (India)', detail: 'CNN-based crack and pothole detection from road video reduces manual review effort significantly.' },
      { point: 'Digital twins enable real-time operational decisions', source: 'Rijkswaterstaat (NL)', detail: 'Digital twin linked to embedded sensors and drone data provides continuous condition monitoring.' },
      { point: 'Asset Health Index (AHI) simplifies management reporting', source: 'Rijkswaterstaat (NL)', detail: 'Single composite score per road segment makes condition reporting accessible to non-technical management.' },
    ],
  },
];

// ── Tab definitions ───────────────────────────────────────────────────────────

type TabId = 'worldmap' | 'casestudies' | 'analytics' | 'lessons' | 'matrix';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'worldmap',    label: 'World Map',              icon: <Globe size={13} /> },
  { id: 'casestudies', label: 'Case Studies',           icon: <BookOpen size={13} /> },
  { id: 'analytics',   label: 'Comparative Analytics', icon: <BarChart3 size={13} /> },
  { id: 'lessons',     label: 'Lessons & Recommendations', icon: <Lightbulb size={13} /> },
  { id: 'matrix',      label: 'Literature Review Matrix', icon: <Grid size={13} /> },
];

type RegionFilter = 'All' | 'Africa' | 'Europe' | 'Asia-Pacific' | 'Americas' | 'Middle East';
const REGIONS: RegionFilter[] = ['All', 'Africa', 'Europe', 'Asia-Pacific', 'Americas', 'Middle East'];

// ── Shared style atoms ────────────────────────────────────────────────────────

const S = {
  wrap: {
    background: 'rgba(2,5,8,0.97)',
    minHeight: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    fontFamily: "'Inter', 'JetBrains Mono', monospace",
  },
  tabBar: {
    display: 'flex',
    gap: 2,
    padding: '0 14px',
    borderBottom: '1px solid rgba(0,245,255,0.15)',
    background: 'rgba(2,5,8,0.6)',
    flexShrink: 0,
  },
  tabBtn: (active: boolean) => ({
    padding: '10px 18px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: active ? 700 : 400,
    color: active ? '#00f5ff' : 'rgba(148,163,184,0.7)',
    borderBottom: active ? '2px solid #00f5ff' : '2px solid transparent',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    transition: 'color 0.15s',
    whiteSpace: 'nowrap' as const,
  }),
  card: (accent = 'rgba(255,255,255,0.07)') => ({
    background: 'rgba(8,14,28,0.7)',
    border: `1px solid ${accent}`,
    borderRadius: 12,
    padding: '16px 18px',
  }),
  sectionPad: {
    padding: '18px 16px',
    flex: 1,
    overflowY: 'auto' as const,
  },
  label: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    color: 'rgba(148,163,184,0.55)',
  },
  badge: (color: string) => ({
    fontSize: 9,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 4,
    background: `rgba(${hexRgb(color)},0.15)`,
    color,
    border: `1px solid rgba(${hexRgb(color)},0.25)`,
    display: 'inline-block',
  }),
};

// ── Tab 1: World Map ──────────────────────────────────────────────────────────

function WorldMapTab() {
  return (
    <div style={{ ...S.sectionPad, padding: 0, position: 'relative', height: '100%', minHeight: 540 }}>
      <MapContainer
        center={[20, 20]}
        zoom={2}
        style={{ width: '100%', height: '100%', minHeight: 540, background: '#020508' }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url={ESRI_TILE_URLS.imagery}
          attribution={ESRI_ATTRIBUTIONS.imagery}
          maxZoom={18}
        />
        <TileLayer
          url={ESRI_TILE_URLS.labels}
          attribution={ESRI_ATTRIBUTIONS.labels}
          maxZoom={18}
          opacity={0.6}
        />
        <WaterLayers />
        {CASE_STUDIES.map(cs => (
          <CircleMarker
            key={cs.id}
            center={[cs.lat, cs.lng]}
            radius={10}
            pathOptions={{
              color: REGION_COLOR[cs.region],
              fillColor: REGION_COLOR[cs.region],
              fillOpacity: 0.75,
              weight: 2,
            }}
          >
            <Popup>
              <div style={{
                background: 'rgba(2,5,8,0.97)',
                color: '#e2e8f0',
                fontSize: 11,
                minWidth: 200,
                padding: '4px 0',
              }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{cs.flag}</div>
                <div style={{ fontWeight: 800, fontSize: 13, color: REGION_COLOR[cs.region] }}>
                  {cs.agency}
                </div>
                <div style={{ color: 'rgba(148,163,184,0.9)', marginBottom: 6 }}>{cs.country}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div><span style={{ color: 'rgba(148,163,184,0.6)' }}>Network: </span>
                    <strong>{cs.networkKm.toLocaleString()} km</strong></div>
                  <div><span style={{ color: 'rgba(148,163,184,0.6)' }}>System: </span>
                    <span style={{ color: '#00f5ff' }}>{cs.system}</span></div>
                  <div><span style={{ color: 'rgba(148,163,184,0.6)' }}>Paved: </span>
                    <strong>{cs.pavedPct}%</strong></div>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Region legend overlay */}
      <div style={{
        position: 'absolute',
        bottom: 24,
        right: 16,
        zIndex: 1000,
        background: 'rgba(2,5,8,0.88)',
        border: '1px solid rgba(0,245,255,0.15)',
        borderRadius: 10,
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
          Region
        </div>
        {Object.entries(REGION_COLOR).map(([region, color]) => {
          const count = CASE_STUDIES.filter(cs => cs.region === region).length;
          return (
            <div key={region} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: color,
                boxShadow: `0 0 6px ${color}88`,
              }} />
              <span style={{ fontSize: 10, color: 'rgba(226,232,240,0.85)' }}>{region}</span>
              <span style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)' }}>({count})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab 2: Case Studies ───────────────────────────────────────────────────────

function CaseStudiesTab() {
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('All');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return CASE_STUDIES.filter(cs => {
      const matchRegion = regionFilter === 'All' || cs.region === regionFilter;
      const matchSearch = !q ||
        cs.agency.toLowerCase().includes(q) ||
        cs.country.toLowerCase().includes(q) ||
        cs.system.toLowerCase().includes(q);
      return matchRegion && matchSearch;
    });
  }, [search, regionFilter]);

  const regionCount = (r: RegionFilter) =>
    r === 'All' ? CASE_STUDIES.length : CASE_STUDIES.filter(cs => cs.region === r).length;

  return (
    <div style={S.sectionPad}>
      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(8,14,28,0.8)',
          border: '1px solid rgba(0,245,255,0.15)',
          borderRadius: 8, padding: '5px 10px', flex: '0 0 auto',
        }}>
          <Search size={12} color="rgba(148,163,184,0.5)" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search agency or country…"
            style={{
              background: 'none', border: 'none', outline: 'none',
              color: '#e2e8f0', fontSize: 11, width: 180,
            }}
          />
        </div>

        {/* Region pills */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {REGIONS.map(r => {
            const active = regionFilter === r;
            const color = r === 'All' ? '#00f5ff' : REGION_COLOR[r];
            return (
              <button
                key={r}
                onClick={() => setRegionFilter(r)}
                style={{
                  padding: '4px 11px',
                  borderRadius: 20,
                  fontSize: 10,
                  fontWeight: active ? 700 : 400,
                  cursor: 'pointer',
                  border: `1px solid rgba(${hexRgb(color)},${active ? '0.5' : '0.2'})`,
                  background: active ? `rgba(${hexRgb(color)},0.15)` : 'rgba(8,14,28,0.5)',
                  color: active ? color : 'rgba(148,163,184,0.7)',
                  transition: 'all 0.15s',
                }}
              >
                {r} <span style={{ opacity: 0.65 }}>({regionCount(r)})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 12,
      }}>
        {filtered.map(cs => {
          const regionColor = REGION_COLOR[cs.region];
          const expanded = expandedId === cs.id;
          return (
            <div
              key={cs.id}
              onClick={() => setExpandedId(expanded ? null : cs.id)}
              style={{
                ...S.card(),
                cursor: 'pointer',
                borderColor: expanded ? `rgba(${hexRgb(regionColor)},0.4)` : 'rgba(255,255,255,0.07)',
                background: expanded
                  ? `rgba(${hexRgb(regionColor)},0.05)`
                  : 'rgba(8,14,28,0.7)',
                boxShadow: expanded ? `0 0 18px rgba(${hexRgb(regionColor)},0.08)` : undefined,
                transition: 'all 0.2s',
              }}
            >
              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 26, lineHeight: 1 }}>{cs.flag}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: regionColor, marginBottom: 2 }}>
                    {cs.agency}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.8)' }}>{cs.country}</div>
                </div>
                <span style={S.badge(regionColor)}>{cs.region}</span>
              </div>

              {/* Key metrics row */}
              <div style={{ display: 'flex', gap: 6, marginBottom: expanded ? 12 : 0, flexWrap: 'wrap' }}>
                {[
                  { label: 'Network', value: cs.networkKm >= 1000 ? `${(cs.networkKm / 1000).toFixed(0)}k km` : `${cs.networkKm} km` },
                  { label: 'System', value: cs.system },
                  { label: 'Paved', value: `${cs.pavedPct}%` },
                ].map(m => (
                  <div key={m.label} style={{
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: 6, padding: '3px 8px',
                  }}>
                    <div style={S.label}>{m.label}</div>
                    <div style={{ fontSize: 10, color: '#e2e8f0', fontWeight: 600, marginTop: 1 }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Expanded content */}
              {expanded && (
                <div style={{ marginTop: 4 }}>
                  {/* Key features */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ ...S.label, marginBottom: 5 }}>Key Features</div>
                    <ul style={{ margin: 0, padding: '0 0 0 14px', listStyle: 'disc' }}>
                      {cs.keyFeatures.map((f, i) => (
                        <li key={i} style={{ fontSize: 10, color: 'rgba(226,232,240,0.8)', marginBottom: 3 }}>{f}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Data approach */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ ...S.label, marginBottom: 4 }}>Data Approach</div>
                    <p style={{ margin: 0, fontSize: 10, color: 'rgba(226,232,240,0.7)', lineHeight: 1.5 }}>{cs.dataApproach}</p>
                  </div>

                  {/* Funding */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ ...S.label, marginBottom: 4 }}>Funding</div>
                    <p style={{ margin: 0, fontSize: 10, color: 'rgba(226,232,240,0.7)' }}>{cs.funding}</p>
                  </div>

                  {/* Metrics */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ ...S.label, marginBottom: 4 }}>Key Metrics</div>
                    <p style={{ margin: 0, fontSize: 10, color: '#00ff88', fontWeight: 600 }}>{cs.metrics}</p>
                  </div>

                  {/* DNR lessons box */}
                  <div style={{
                    background: `rgba(${hexRgb(regionColor)},0.08)`,
                    border: `1px solid rgba(${hexRgb(regionColor)},0.25)`,
                    borderRadius: 8,
                    padding: '10px 12px',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: regionColor, marginBottom: 5 }}>
                      📌 How This Applies to DNR
                    </div>
                    <p style={{ margin: 0, fontSize: 10, color: 'rgba(226,232,240,0.85)', lineHeight: 1.55 }}>
                      {cs.lessonsDNR}
                    </p>
                  </div>
                </div>
              )}

              {/* Expand hint */}
              {!expanded && (
                <div style={{ marginTop: 8, fontSize: 9, color: 'rgba(148,163,184,0.45)', textAlign: 'right' }}>
                  Click to expand ▾
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', color: 'rgba(148,163,184,0.4)', fontSize: 12 }}>
            No case studies match your filter.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab 3: Comparative Analytics ─────────────────────────────────────────────

function AnalyticsTab() {
  // Sort by network size desc for chart 1, others independently
  const CHART_TOP = 30;

  const byNetwork = useMemo(() =>
    [...CASE_STUDIES].sort((a, b) => b.networkKm - a.networkKm).slice(0, CHART_TOP).map(cs => ({
      name: cs.flag + ' ' + cs.agency,
      value: cs.networkKm,
      color: REGION_COLOR[cs.region],
    })), []);

  const byPaved = useMemo(() =>
    [...CASE_STUDIES].sort((a, b) => b.pavedPct - a.pavedPct).slice(0, CHART_TOP).map(cs => ({
      name: cs.flag + ' ' + cs.agency,
      value: cs.pavedPct,
      color: REGION_COLOR[cs.region],
    })), []);

  const byYears = useMemo(() =>
    [...CASE_STUDIES].sort((a, b) => b.rmsYears - a.rmsYears).slice(0, CHART_TOP).map(cs => ({
      name: cs.flag + ' ' + cs.agency,
      value: cs.rmsYears,
      color: REGION_COLOR[cs.region],
    })), []);

  const byBudget = useMemo(() =>
    [...CASE_STUDIES].sort((a, b) => b.budgetPerKmUsd - a.budgetPerKmUsd).slice(0, CHART_TOP).map(cs => ({
      name: cs.flag + ' ' + cs.agency,
      value: cs.budgetPerKmUsd,
      color: REGION_COLOR[cs.region],
    })), []);

  const chartH = 400;
  const barSize = 14;

  function HorizBarChart({ data, unit, color }: {
    data: { name: string; value: number; color: string }[];
    unit: string;
    color?: string;
  }) {
    return (
      <Chart3DWrap tilt={0.8}>
        <ResponsiveContainer width="100%" height={chartH}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 28, left: 4, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" horizontal={false} />
            <XAxis
              type="number"
              tick={TICK}
              axisLine={{ stroke: 'rgba(148,163,184,0.08)' }}
              tickLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            />
            <YAxis
              dataKey="name"
              type="category"
              width={130}
              tick={{ fill: 'rgba(148,163,184,0.6)', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
            />
            <ReTooltip
              {...TT_NEON}
              formatter={(val: number) => [`${val.toLocaleString()} ${unit}`, '']}
            />
            <Bar dataKey="value" barSize={barSize} shape={<Bar3D />}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Chart3DWrap>
    );
  }

  const handleExportCSV = () => {
    const headers = ['Agency', 'Country', 'Region', 'Network (km)', 'System', 'Paved (%)', 'RMS Years', 'Budget/km (USD)', 'Metrics'];
    const rows = CASE_STUDIES.map(cs => [
      cs.agency, cs.country, cs.region, cs.networkKm, cs.system,
      cs.pavedPct, cs.rmsYears, cs.budgetPerKmUsd, cs.metrics,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'global_case_studies_comparison.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={S.sectionPad}>
      {/* 2×2 chart grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))',
        gap: 14,
        marginBottom: 20,
      }}>
        {/* Chart 1 — Network size */}
        <div style={S.card()}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#00f5ff', marginBottom: 2 }}>
            Network Size by Agency (km) — Top {CHART_TOP}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.45)', marginBottom: 8 }}>of {CASE_STUDIES.length} agencies total</div>
          <HorizBarChart data={byNetwork} unit="km" />
        </div>

        {/* Chart 2 — Paved % */}
        <div style={S.card()}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#00ff88', marginBottom: 2 }}>
            Paved Network (%) — Top {CHART_TOP}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.45)', marginBottom: 8 }}>highest paved percentage of {CASE_STUDIES.length} agencies</div>
          <HorizBarChart data={byPaved} unit="%" />
        </div>

        {/* Chart 3 — RMS Years */}
        <div style={S.card()}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#ffd23f', marginBottom: 2 }}>
            Years of RMS Operation — Top {CHART_TOP}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.45)', marginBottom: 8 }}>most experienced agencies of {CASE_STUDIES.length} total</div>
          <HorizBarChart data={byYears} unit="yrs" />
        </div>

        {/* Chart 4 — Budget/km */}
        <div style={S.card()}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#b967ff', marginBottom: 2 }}>
            Maintenance Budget per km (USD) — Top {CHART_TOP}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.45)', marginBottom: 8 }}>highest spending agencies of {CASE_STUDIES.length} total</div>
          <HorizBarChart data={byBudget} unit="USD/km" />
        </div>
      </div>

      {/* Full comparison table */}
      <div style={S.card()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
            Full Comparison Table — All {CASE_STUDIES.length} Agencies
          </div>
          <button
            onClick={handleExportCSV}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(0,245,255,0.1)',
              border: '1px solid rgba(0,245,255,0.3)',
              borderRadius: 7, padding: '5px 12px',
              color: '#00f5ff', fontSize: 10, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Download size={11} /> Export CSV
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,245,255,0.15)' }}>
                {['Flag', 'Agency', 'Country', 'Region', 'Network (km)', 'System', 'Paved (%)', 'RMS Yrs', 'Budget/km (USD)', 'Key Metric'].map(h => (
                  <th key={h} style={{
                    padding: '6px 10px', textAlign: 'left',
                    color: 'rgba(148,163,184,0.6)', fontWeight: 700,
                    fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CASE_STUDIES.map((cs, i) => {
                const rc = REGION_COLOR[cs.region];
                return (
                  <tr
                    key={cs.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '7px 10px', fontSize: 16 }}>{cs.flag}</td>
                    <td style={{ padding: '7px 10px', fontWeight: 700, color: rc, whiteSpace: 'nowrap' }}>{cs.agency}</td>
                    <td style={{ padding: '7px 10px', color: 'rgba(226,232,240,0.8)', whiteSpace: 'nowrap' }}>{cs.country}</td>
                    <td style={{ padding: '7px 10px' }}>
                      <span style={S.badge(rc)}>{cs.region}</span>
                    </td>
                    <td style={{ padding: '7px 10px', color: '#00f5ff', fontWeight: 600, textAlign: 'right' }}>
                      {cs.networkKm.toLocaleString()}
                    </td>
                    <td style={{ padding: '7px 10px', color: 'rgba(226,232,240,0.7)', maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {cs.system}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                      <div style={{
                        display: 'inline-block',
                        background: `rgba(${hexRgb(rc)},0.15)`,
                        color: rc,
                        fontWeight: 700,
                        borderRadius: 4, padding: '1px 7px',
                      }}>{cs.pavedPct}%</div>
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: '#ffd23f', fontWeight: 600 }}>
                      {cs.rmsYears}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: '#b967ff', fontWeight: 600 }}>
                      {cs.budgetPerKmUsd.toLocaleString()}
                    </td>
                    <td style={{ padding: '7px 10px', color: 'rgba(226,232,240,0.65)', maxWidth: 200, fontSize: 9 }}>
                      {cs.metrics.split(';')[0]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab 4: Lessons & Recommendations ─────────────────────────────────────────

function LessonsTab() {
  const [openTheme, setOpenTheme] = useState<string | null>(LESSONS[0].theme);

  const totalLessons = LESSONS.reduce((acc, t) => acc + t.lessons.length, 0);
  const totalCountries = CASE_STUDIES.length;

  return (
    <div style={S.sectionPad}>
      {/* Summary bar */}
      <div style={{
        display: 'flex', gap: 16, marginBottom: 18, flexWrap: 'wrap',
      }}>
        <div style={{
          ...S.card(),
          padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          flex: '0 0 auto',
        }}>
          <Lightbulb size={16} color="#ffd23f" />
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#ffd23f' }}>{totalLessons}</div>
            <div style={S.label}>Total Lessons</div>
          </div>
        </div>
        <div style={{
          ...S.card(),
          padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          flex: '0 0 auto',
        }}>
          <Globe size={16} color="#00f5ff" />
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#00f5ff' }}>{totalCountries}</div>
            <div style={S.label}>Countries Analysed</div>
          </div>
        </div>
        <div style={{
          ...S.card(),
          padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          flex: '0 0 auto',
        }}>
          <BookOpen size={16} color="#00ff88" />
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#00ff88' }}>{LESSONS.length}</div>
            <div style={S.label}>Themes</div>
          </div>
        </div>
      </div>

      {/* Theme cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {LESSONS.map(theme => {
          const open = openTheme === theme.theme;
          return (
            <div
              key={theme.theme}
              style={{
                ...S.card(),
                borderColor: open ? `rgba(${hexRgb(theme.color)},0.35)` : 'rgba(255,255,255,0.07)',
                background: open ? `rgba(${hexRgb(theme.color)},0.04)` : 'rgba(8,14,28,0.7)',
                transition: 'all 0.2s',
              }}
            >
              {/* Theme header */}
              <button
                onClick={() => setOpenTheme(open ? null : theme.theme)}
                style={{
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10, padding: 0,
                }}
              >
                <span style={{ fontSize: 18 }}>{theme.icon}</span>
                <span style={{ fontWeight: 800, fontSize: 13, color: theme.color, flex: 1, textAlign: 'left' }}>
                  {theme.theme}
                </span>
                <span style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)', marginRight: 4 }}>
                  {theme.lessons.length} lessons
                </span>
                <span style={{ fontSize: 12, color: theme.color, opacity: 0.7 }}>{open ? '▲' : '▼'}</span>
              </button>

              {/* Lessons list */}
              {open && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {theme.lessons.map((lesson, i) => (
                    <div
                      key={i}
                      style={{
                        background: 'rgba(0,0,0,0.25)',
                        border: `1px solid rgba(${hexRgb(theme.color)},0.12)`,
                        borderRadius: 8,
                        padding: '10px 12px',
                        borderLeft: `3px solid ${theme.color}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 700, fontSize: 11, color: '#e2e8f0', flex: 1 }}>
                          {lesson.point}
                        </div>
                        <span style={{
                          ...S.badge(theme.color),
                          flexShrink: 0,
                          whiteSpace: 'nowrap',
                        }}>
                          {lesson.source}
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.75)', lineHeight: 1.5 }}>
                        {lesson.detail}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      <div style={{
        marginTop: 18,
        padding: '12px 16px',
        background: 'rgba(0,245,255,0.04)',
        border: '1px solid rgba(0,245,255,0.12)',
        borderRadius: 10,
        fontSize: 11,
        color: 'rgba(148,163,184,0.7)',
        textAlign: 'center',
      }}>
        <strong style={{ color: '#00f5ff' }}>{totalLessons} total lessons</strong> synthesised from{' '}
        <strong style={{ color: '#00ff88' }}>{totalCountries} countries</strong> analysed across{' '}
        <strong style={{ color: '#ffd23f' }}>{LESSONS.length} themes</strong> — all directly applicable to DNR's Road Management System.
      </div>
    </div>
  );
}

// ── Literature Review Matrix ──────────────────────────────────────────────────

const AM_COMPONENTS = [
  'Network Inventory & GIS',
  'Condition Assessment (PMS)',
  'Bridge Management (BMS)',
  'Traffic Monitoring',
  'HDM-4 / Lifecycle Analysis',
  'Maintenance Management',
  'Asset Valuation',
  'Climate Resilience',
  'Road Safety Management',
  'Overload Control',
  'Procurement (OPRC/PBC)',
  'Digital/AI Integration',
];

const SCORE_COLORS = ['#ef4444', '#f97316', '#22c55e', '#00ff88'];
const SCORE_LABELS = ['Missing', 'Partial', 'Implemented', 'Best Practice'];

function computeScores(cs: CaseStudy): number[] {
  const kf  = cs.keyFeatures.join(' ').toLowerCase();
  const sys  = cs.system.toLowerCase();
  const fund = cs.funding.toLowerCase();
  const data = cs.dataApproach.toLowerCase();

  const isHighIncome  = ['united kingdom','australia','new zealand','netherlands','sweden','usa','japan','singapore','south korea','germany','france','finland','norway','denmark'].includes(cs.country.toLowerCase());
  const isGCC         = ['uae','saudi arabia','qatar','kuwait','bahrain','oman'].includes(cs.country.toLowerCase());
  const isNorthAfrica = ['morocco','tunisia','algeria','egypt'].includes(cs.country.toLowerCase());
  const isAdvanced    = ['south africa','mauritius','kenya','rwanda','namibia','botswana'].includes(cs.country.toLowerCase());
  const isFragile     = ['somalia','south sudan','central african republic','yemen','chad','dr congo','liberia','sierra leone','guinea-bissau'].includes(cs.country.toLowerCase());
  const hasHDM4       = sys.includes('hdm') || kf.includes('hdm');
  const hasROMADS     = kf.includes('romdas') || data.includes('romdas') || data.includes('profilometer') || data.includes('scanner');
  const hasOPRC       = kf.includes('oprc') || kf.includes('performance-based') || kf.includes('performance based');
  const hasDonors     = fund.includes('world bank') || fund.includes('afdb') || fund.includes('adb');
  const hasBridge     = kf.includes('bridge') || kf.includes('bms') || kf.includes('structure');
  const hasTraffic    = kf.includes('traffic') || kf.includes('wim') || kf.includes('atc') || kf.includes('aadt');
  const hasDigital    = kf.includes('digital') || kf.includes('ai') || kf.includes('iot') || kf.includes('ml') || kf.includes('bim') || kf.includes('twin');
  const hasClimate    = kf.includes('climate') || kf.includes('resilien') || kf.includes('disaster') || kf.includes('flood') || kf.includes('seismic') || kf.includes('earthquake');
  const hasSafety     = kf.includes('safety') || kf.includes('crash') || kf.includes('accident') || kf.includes('blackspot');
  const hasOverload   = kf.includes('weighbridge') || kf.includes('axle') || kf.includes('overload') || kf.includes('wim');

  const base =
    isHighIncome  ? 3 :
    isGCC         ? 3 :
    isNorthAfrica ? 2 :
    isAdvanced    ? 2 :
    isFragile     ? 0 : 1;

  const yr = cs.rmsYears >= 20 ? 1 : 0;
  const bgt = cs.budgetPerKmUsd >= 50000 ? 1 : 0;

  return [
    Math.max(0, Math.min(3, base + (data.includes('gis') ? 1 : 0))),               // 1 Network Inventory & GIS
    Math.max(0, Math.min(3, base + (hasROMADS ? 1 : 0))),                          // 2 Condition Assessment (PMS)
    Math.max(0, Math.min(3, base + (hasBridge ? 1 : 0))),                          // 3 Bridge Management (BMS)
    Math.max(0, Math.min(3, base + (hasTraffic ? 1 : 0))),                         // 4 Traffic Monitoring
    Math.max(0, Math.min(3, base + (hasHDM4 ? 1 : 0) + yr)),                       // 5 HDM-4 / Lifecycle Analysis
    Math.max(0, Math.min(3, base + (hasOPRC ? 1 : 0))),                            // 6 Maintenance Management
    Math.max(0, Math.min(3, base + bgt)),                                          // 7 Asset Valuation
    Math.max(0, Math.min(3, Math.max(0, base - (isFragile ? 1 : 0)) + (hasClimate ? 1 : 0))), // 8 Climate Resilience
    Math.max(0, Math.min(3, base + (hasSafety ? 1 : 0))),                          // 9 Road Safety Management
    Math.max(0, Math.min(3, base + (hasOverload ? 1 : 0))),                        // 10 Overload Control
    Math.max(0, Math.min(3, base + (hasOPRC ? 1 : 0) + (hasDonors ? 1 : 0) - (isHighIncome || isGCC ? 1 : 0))), // 11 Procurement (OPRC/PBC)
    Math.max(0, Math.min(3, base + bgt + (hasDigital ? 1 : 0))),                   // 12 Digital/AI Integration
  ];
}

function columnAverages(rows: { cs: CaseStudy; scores: number[] }[]): number[] {
  if (rows.length === 0) return AM_COMPONENTS.map(() => 0);
  return AM_COMPONENTS.map((_, i) =>
    rows.reduce((sum, r) => sum + r.scores[i], 0) / rows.length
  );
}

function downloadMatrixCSV(rows: { cs: CaseStudy; scores: number[] }[]) {
  const header = ['Country', 'Agency', 'Region', 'System', 'Years', ...AM_COMPONENTS].join(',');
  const body = rows.map(({ cs, scores }) =>
    [cs.country, cs.agency, cs.region, `"${cs.system}"`, cs.rmsYears, ...scores].join(',')
  ).join('\n');
  const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url; a.download = 'am_lit_review_matrix.csv';
  a.click(); URL.revokeObjectURL(url);
}

function RadarPanel({ countries, onClose }: { countries: CaseStudy[]; onClose: () => void }) {
  const data = AM_COMPONENTS.map((comp, i) => {
    const entry: Record<string, string | number> = { comp: comp.replace(' / ', '/').replace('. ', '.') };
    countries.forEach(cs => { entry[cs.country] = computeScores(cs)[i]; });
    return entry;
  });
  const colors = ['#00f5ff', '#ff6b35'];
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'rgba(8,14,28,0.97)', border: '1px solid rgba(0,245,255,0.2)',
        borderRadius: 16, padding: 24, width: 540, maxWidth: '95vw',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#00f5ff' }}>
            AM Component Radar — {countries.map(c => c.flag + ' ' + c.country).join(' vs ')}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
        <RadarChart cx={240} cy={200} outerRadius={150} width={480} height={400} data={data}>
          <PolarGrid stroke="rgba(255,255,255,0.08)" />
          <PolarAngleAxis dataKey="comp" tick={{ fill: '#94a3b8', fontSize: 9 }} />
          <PolarRadiusAxis domain={[0, 3]} tick={false} axisLine={false} />
          {countries.map((cs, i) => (
            <Radar
              key={cs.id}
              name={cs.flag + ' ' + cs.country}
              dataKey={cs.country}
              stroke={colors[i] ?? '#aaa'}
              fill={colors[i] ?? '#aaa'}
              fillOpacity={0.18}
            />
          ))}
          <ReChartLegend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
        </RadarChart>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8 }}>
          {SCORE_LABELS.map((lbl, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: SCORE_COLORS[i] }} />
              <span style={{ fontSize: 9, color: '#94a3b8' }}>{i} = {lbl}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LiteratureMatrixTab() {
  const [selected, setSelected]       = useState<CaseStudy | null>(null);
  const [compareA, setCompareA]       = useState<CaseStudy | null>(null);
  const [compareB, setCompareB]       = useState<CaseStudy | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('All');
  const [radarOpen, setRadarOpen]     = useState(false);

  const rows = useMemo(() =>
    CASE_STUDIES
      .filter(cs => regionFilter === 'All' || cs.region === regionFilter)
      .map(cs => ({ cs, scores: computeScores(cs) })),
    [regionFilter]
  );

  const colAverages = useMemo(() => columnAverages(rows), [rows]);

  const handleRowClick = (cs: CaseStudy) => {
    if (!compareMode) {
      setSelected(cs);
      setRadarOpen(true);
    } else {
      if (!compareA) { setCompareA(cs); }
      else if (!compareB && cs.id !== compareA.id) { setCompareB(cs); setRadarOpen(true); }
      else { setCompareA(cs); setCompareB(null); }
    }
  };

  const closeRadar = () => { setRadarOpen(false); if (!compareMode) setSelected(null); };

  const radarCountries =
    compareMode && compareA && compareB ? [compareA, compareB]
    : selected ? [selected] : [];

  return (
    <div style={{ ...S.sectionPad, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {radarOpen && radarCountries.length > 0 && (
        <RadarPanel countries={radarCountries} onClose={closeRadar} />
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <button
          onClick={() => downloadMatrixCSV(rows)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: 7, cursor: 'pointer',
            background: 'rgba(0,245,255,0.1)', border: '1px solid rgba(0,245,255,0.25)',
            color: '#00f5ff', fontSize: 10, fontWeight: 700,
          }}
        >
          <Download size={12} /> Download CSV
        </button>
        <button
          onClick={() => { setCompareMode(m => !m); setCompareA(null); setCompareB(null); setRadarOpen(false); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: 7, cursor: 'pointer',
            background: compareMode ? 'rgba(255,107,53,0.15)' : 'rgba(8,14,28,0.7)',
            border: `1px solid ${compareMode ? 'rgba(255,107,53,0.4)' : 'rgba(255,255,255,0.1)'}`,
            color: compareMode ? '#ff6b35' : 'rgba(148,163,184,0.7)', fontSize: 10, fontWeight: 700,
          }}
        >
          Compare {compareMode ? `(${compareA ? '1' : '0'}/2 selected)` : '2 Countries'}
        </button>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginLeft: 4 }}>
          {REGIONS.map(r => {
            const active = regionFilter === r;
            const color  = r === 'All' ? '#00f5ff' : REGION_COLOR[r];
            return (
              <button key={r} onClick={() => setRegionFilter(r)} style={{
                padding: '3px 9px', borderRadius: 14, fontSize: 9, fontWeight: active ? 700 : 400,
                cursor: 'pointer',
                border: `1px solid rgba(${hexRgb(color)},${active ? '0.5' : '0.15'})`,
                background: active ? `rgba(${hexRgb(color)},0.12)` : 'rgba(8,14,28,0.5)',
                color: active ? color : 'rgba(148,163,184,0.6)',
              }}>{r}</button>
            );
          })}
        </div>
        <span style={{ fontSize: 9, color: 'rgba(148,163,184,0.45)', marginLeft: 'auto' }}>
          {rows.length} countries · click row for radar · {compareMode ? 'select 2 to compare' : 'toggle Compare for side-by-side'}
        </span>
      </div>

      {/* Score key */}
      <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
        {SCORE_LABELS.map((lbl, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: SCORE_COLORS[i] }} />
            <span style={{ fontSize: 9, color: '#94a3b8' }}>{i} = {lbl}</span>
          </div>
        ))}
      </div>

      {/* Scrollable grid */}
      <div style={{ flex: 1, overflow: 'auto', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
          <thead>
            <tr style={{ background: 'rgba(8,14,28,0.95)', position: 'sticky', top: 0, zIndex: 2 }}>
              <th style={{ ...thStyle, position: 'sticky', left: 0, zIndex: 3, background: 'rgba(8,14,28,0.97)', minWidth: 160, textAlign: 'left', paddingLeft: 10 }}>
                Country / Agency
              </th>
              <th style={{ ...thStyle, minWidth: 60 }}>Region</th>
              {AM_COMPONENTS.map(c => (
                <th key={c} style={{ ...thStyle, minWidth: 72, padding: '6px 4px', textAlign: 'center', lineHeight: 1.2 }}>
                  {c}
                </th>
              ))}
              <th style={{ ...thStyle, minWidth: 50 }}>Avg</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ cs, scores }) => {
              const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
              const isCompA = compareA?.id === cs.id;
              const isCompB = compareB?.id === cs.id;
              const highlight = isCompA ? 'rgba(0,245,255,0.08)' : isCompB ? 'rgba(255,107,53,0.08)' : '';
              return (
                <tr
                  key={cs.id}
                  onClick={() => handleRowClick(cs)}
                  style={{
                    cursor: 'pointer',
                    background: highlight || 'transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { if (!highlight) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { if (!highlight) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <td style={{ ...tdStyle, position: 'sticky', left: 0, background: highlight || 'rgba(8,14,28,0.92)', zIndex: 1, paddingLeft: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14 }}>{cs.flag}</span>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#e2e8f0' }}>{cs.country}</div>
                        <div style={{ fontSize: 8, color: '#64748b' }}>{cs.agency}</div>
                      </div>
                      {(isCompA || isCompB) && (
                        <span style={{ fontSize: 8, fontWeight: 700, color: isCompA ? '#00f5ff' : '#ff6b35', marginLeft: 2 }}>
                          {isCompA ? 'A' : 'B'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{ fontSize: 8, color: REGION_COLOR[cs.region] ?? '#94a3b8', fontWeight: 700 }}>
                      {cs.region.replace('Asia-Pacific', 'A-P').replace('Americas', 'AMER').replace('Middle East', 'ME').replace('Africa', 'AFR').replace('Europe', 'EUR')}
                    </span>
                  </td>
                  {scores.map((score, si) => (
                    <td key={si} style={{ ...tdStyle, textAlign: 'center', padding: '4px 3px' }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 4, margin: '0 auto',
                        background: SCORE_COLORS[score],
                        opacity: score === 0 ? 0.4 : 0.85,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 8, fontWeight: 800, color: score <= 1 ? '#fff' : '#000',
                      }}>
                        {score}
                      </div>
                    </td>
                  ))}
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, fontSize: 11, color: '#00f5ff' }}>{avg}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: 'rgba(0,245,255,0.06)', position: 'sticky', bottom: 0, borderTop: '2px solid rgba(0,245,255,0.2)' }}>
              <td style={{ ...tdStyle, position: 'sticky', left: 0, background: 'rgba(8,20,32,0.97)', fontWeight: 800, color: '#00f5ff', paddingLeft: 10 }}>
                Column Average ({rows.length} countries)
              </td>
              <td style={tdStyle} />
              {colAverages.map((avgVal, ai) => (
                <td key={ai} style={{ ...tdStyle, textAlign: 'center', padding: '4px 3px' }}>
                  <div style={{
                    width: 28, height: 20, borderRadius: 4, margin: '0 auto',
                    border: `1px solid ${SCORE_COLORS[Math.round(avgVal)]}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 800, color: SCORE_COLORS[Math.round(avgVal)],
                  }}>
                    {avgVal.toFixed(1)}
                  </div>
                </td>
              ))}
              <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, fontSize: 11, color: '#00f5ff' }}>
                {(colAverages.reduce((a, b) => a + b, 0) / colAverages.length).toFixed(1)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
  color: 'rgba(148,163,184,0.55)', padding: '8px 4px', borderBottom: '1px solid rgba(255,255,255,0.08)',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '5px 4px', fontSize: 10, color: '#d4dde8',
};

// ── Main component ────────────────────────────────────────────────────────────

export default function GlobalCaseStudiesSection() {
  const [tab, setTab] = useState<TabId>('worldmap');

  return (
    <div style={S.wrap}>
      {/* Header */}
      <div style={{
        padding: '14px 18px 10px',
        borderBottom: '1px solid rgba(0,245,255,0.1)',
        background: 'rgba(2,5,8,0.8)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Globe size={18} color="#00f5ff" />
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#00f5ff', letterSpacing: '-0.01em' }}>
              Global Road Management — Case Studies
            </div>
            <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', marginTop: 1 }}>
              {CASE_STUDIES.length} agencies · {Object.keys(REGION_COLOR).length} regions · International best practice for DNR
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={S.tabBar}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={S.tabBtn(tab === t.id)}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: tab === 'worldmap' ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column' }}>
        {tab === 'worldmap'    && <WorldMapTab />}
        {tab === 'casestudies' && <CaseStudiesTab />}
        {tab === 'analytics'   && <AnalyticsTab />}
        {tab === 'lessons'     && <LessonsTab />}
        {tab === 'matrix'      && <LiteratureMatrixTab />}
      </div>
    </div>
  );
}
