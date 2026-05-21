import { lazy, Suspense, useMemo } from 'react';
import { BMSProvider, useBMS } from './store/BMSContext';
import Sidebar from './components/Layout/Sidebar';
import Header  from './components/Layout/Header';

// ── Platform-level modules ────────────────────────────────────────────────────
const PlatformDashboard = lazy(() => import('./modules/PlatformDashboard/PlatformDashboard'));
const NetworkStory      = lazy(() => import('./modules/NetworkStory/NetworkStory'));
const RoadNetworkView   = lazy(() => import('./modules/RoadNetwork/RoadNetworkView'));
const TrafficSection    = lazy(() => import('./modules/Traffic/TrafficSection'));
const RoadConditionView = lazy(() => import('./modules/RoadCondition/RoadConditionView'));
const ProjectsView      = lazy(() => import('./modules/Projects/ProjectsView'));

// ── BMS sub-modules ───────────────────────────────────────────────────────────
const Dashboard            = lazy(() => import('./modules/Dashboard/Dashboard'));
const StructureRegistry    = lazy(() => import('./modules/Registry/StructureRegistry'));
const GISMapView           = lazy(() => import('./modules/GISMap/GISMapView'));
const InspectionManagement = lazy(() => import('./modules/Inspections/InspectionManagement'));
const ConditionAssessment  = lazy(() => import('./modules/Condition/ConditionAssessment'));
const MaintenanceWorks     = lazy(() => import('./modules/Maintenance/MaintenanceWorks'));
const Analytics            = lazy(() => import('./modules/Analytics/Analytics'));
const PriorityRanking      = lazy(() => import('./modules/Priority/PriorityRanking'));
const DocumentStore        = lazy(() => import('./modules/Documents/DocumentStore'));
const PhotoTwin            = lazy(() => import('./modules/PhotoTwin/PhotoTwin'));
const RoadVideoView        = lazy(() => import('./modules/RoadVideoView/RoadVideoView'));
const DownloadsView        = lazy(() => import('./modules/Downloads/DownloadsView'));
const MediaSection         = lazy(() => import('./components/sections/MediaSection'));
const TrafficAnalytics     = lazy(() => import('./components/sections/TrafficAnalytics'));
const TrafficSummary       = lazy(() => import('./components/sections/TrafficSummary'));
const OprcSection          = lazy(() => import('./components/sections/OprcSection'));
const NdpivSection         = lazy(() => import('./components/sections/NdpivSection'));
const GrowthFactorsPanel   = lazy(() => import('./modules/Traffic/GrowthFactorsPanel'));
const OverloadingSection   = lazy(() => import('./modules/Traffic/OverloadingSection'));
const BridgeSection        = lazy(() => import('./components/sections/BridgeSection'));

// Views that hide the header and own the full content rectangle
const FULL_VIEWS = new Set(['gismap', 'roadnetwork', 'roadvideoview']);

// Views that manage their own scroll internally (don't wrap in a shared scroller)
const SELF_SCROLL_VIEWS = new Set(['networkstory']);

// ─────────────────────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-full w-full bg-slate-950">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto shadow-2xl shadow-blue-900/60">
          <svg viewBox="0 0 24 24" className="w-8 h-8 text-white fill-current">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
          </svg>
        </div>
        <div>
          <div className="text-white font-bold text-lg">Uganda National Roads Management Platform</div>
          <div className="text-slate-500 text-sm mt-1">
            Dept. of National Roads · Ministry of Works &amp; Transport
          </div>
          <div className="text-slate-600 text-xs mt-0.5">Loading 21,292 km network · 1,019 structures…</div>
        </div>
        <div className="flex justify-center gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ModuleSpinner() {
  return (
    <div className="flex items-center justify-center h-full w-full bg-slate-950">
      <div className="w-7 h-7 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function AppShell() {
  const { state } = useBMS();
  const { activeView, isLoading } = state;

  const showHeaderSearch = useMemo(() =>
    ['registry', 'inspections', 'documents', 'priority'].includes(activeView),
    [activeView],
  );

  const isFullView = FULL_VIEWS.has(activeView);

  if (isLoading && state.structures.length === 0) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-950">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {!isFullView && <Header showSearch={showHeaderSearch} />}

        {/* ── Content area ── */}
        {/* overflow-hidden so absolutely-positioned children clip correctly   */}
        <main className="flex-1 min-h-0 relative overflow-hidden">
          <Suspense fallback={<ModuleSpinner />}>

            {/* ── Full-bleed map views: no header, fill entire main area ── */}
            {activeView === 'gismap'        && <GISMapView />}
            {activeView === 'roadnetwork'   && <RoadNetworkView />}
            {activeView === 'roadvideoview' && <RoadVideoView />}

            {/* ── Self-scrolling views: positioned to fill main, own scroll ── */}
            {SELF_SCROLL_VIEWS.has(activeView) && (
              <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                {activeView === 'networkstory' && <NetworkStory />}
              </div>
            )}

            {/* ── Standard paginated views: shared outer scroll wrapper ── */}
            {!isFullView && !SELF_SCROLL_VIEWS.has(activeView) && (
              <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden' }}>
                {activeView === 'platform'      && <PlatformDashboard />}
                {activeView === 'traffic'       && <TrafficSection />}
                {activeView === 'roadcondition' && <RoadConditionView />}
                {activeView === 'projects'      && <ProjectsView />}
                {activeView === 'dashboard'     && <Dashboard />}
                {activeView === 'registry'      && <StructureRegistry />}
                {activeView === 'inspections'   && <InspectionManagement />}
                {activeView === 'condition'     && <ConditionAssessment />}
                {activeView === 'maintenance'   && <MaintenanceWorks />}
                {activeView === 'analytics'     && <Analytics />}
                {activeView === 'priority'      && <PriorityRanking />}
                {activeView === 'documents'     && <DocumentStore />}
                {activeView === 'phototwin'     && <PhotoTwin />}
                {activeView === 'media'             && <MediaSection />}
                {activeView === 'trafficanalytics' && <TrafficAnalytics />}
                {activeView === 'trafficsummary'   && <TrafficSummary />}
                {activeView === 'growthfactors'    && <GrowthFactorsPanel />}
                {activeView === 'overloading'      && <OverloadingSection />}
                {activeView === 'oprc'             && <OprcSection />}
                {activeView === 'ndpiv'            && <NdpivSection />}
                {activeView === 'downloads'         && <DownloadsView />}
                {activeView === 'bridgesection'    && <BridgeSection />}
              </div>
            )}

          </Suspense>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BMSProvider>
      <AppShell />
    </BMSProvider>
  );
}
