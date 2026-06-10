import { lazy, Suspense, useMemo, useState } from 'react';
import { BMSProvider, useBMS } from './store/BMSContext';
import { BotHighlightContext } from './modules/AssetBot/types';
import { AuthProvider, useAuth } from './modules/Auth/AuthContext';
import { LoginPage } from './modules/Auth/LoginPage';
import Sidebar from './components/Layout/Sidebar';
import Header  from './components/Layout/Header';

const RoadAssetBot = lazy(() => import('./modules/AssetBot/RoadAssetBot'));

// ── Platform-level modules ────────────────────────────────────────────────────
const NetworkSection    = lazy(() => import('./modules/Network/NetworkSection'));
const PlatformDashboard = lazy(() => import('./modules/PlatformDashboard/PlatformDashboard'));
const NetworkStory      = lazy(() => import('./modules/NetworkStory/NetworkStory'));
const RoadNetworkView   = lazy(() => import('./modules/RoadNetwork/RoadNetworkView'));
const TrafficSection    = lazy(() => import('./modules/Traffic/TrafficSection'));
const RoadConditionView       = lazy(() => import('./modules/RoadCondition/RoadConditionView'));
const MaintenanceProgrammeView = lazy(() => import('./modules/RoadCondition/MaintenanceProgrammeView'));
const ProjectsView            = lazy(() => import('./modules/Projects/ProjectsView'));

// ── BMS sub-modules ───────────────────────────────────────────────────────────
const Dashboard            = lazy(() => import('./modules/Dashboard/Dashboard'));
const StructureRegistry    = lazy(() => import('./modules/Registry/StructureRegistry'));
const GISMapView           = lazy(() => import('./modules/GISMap/GISMapView'));
const InspectionManagement = lazy(() => import('./modules/Inspections/InspectionManagement'));
const ConditionAssessment  = lazy(() => import('./modules/Condition/ConditionAssessment'));
const MaintenanceWorks     = lazy(() => import('./modules/Maintenance/MaintenanceWorks'));
const Analytics            = lazy(() => import('./modules/Analytics/Analytics'));
const PriorityRanking      = lazy(() => import('./modules/Priority/PriorityRanking'));
const PhotoTwin            = lazy(() => import('./modules/PhotoTwin/PhotoTwin'));
const TrafficAnalytics     = lazy(() => import('./components/sections/TrafficAnalytics'));
const TrafficSummary       = lazy(() => import('./components/sections/TrafficSummary'));
const OprcSection          = lazy(() => import('./components/sections/OprcSection'));
const NdpivSection         = lazy(() => import('./components/sections/NdpivSection'));
const GrowthFactorsPanel   = lazy(() => import('./modules/Traffic/GrowthFactorsPanel'));
const OverloadingSection   = lazy(() => import('./modules/Traffic/OverloadingSection'));

// ── New 10-module sections ────────────────────────────────────────────────────
const MLArchitectureDiagram   = lazy(() => import('./modules/MLArchitecture/MLArchitectureDiagram'));
const HDM4Section             = lazy(() => import('./modules/HDM4/HDM4Section'));
const ProjectTracker          = lazy(() => import('./modules/Projects/ProjectTracker'));
const PublicInvestmentSection = lazy(() => import('./modules/PIM/PublicInvestmentSection'));
const BudgetSection           = lazy(() => import('./modules/Budget/BudgetSection'));
const LifecycleSection        = lazy(() => import('./modules/Lifecycle/LifecycleSection'));
const SourcesCatalogueSection = lazy(() => import('./modules/Sources/SourcesCatalogueSection'));
const TabularSummaries        = lazy(() => import('./modules/Sources/TabularSummaries'));
const SourcesSection          = lazy(() => import('./modules/Sources/SourcesSection'));

// ── Data entry ────────────────────────────────────────────────────────────────
const PendingSubmissions = lazy(() => import('./modules/DataEntry/PendingSubmissions').then(m => ({ default: m.PendingSubmissions })));
const DataCaptureHub     = lazy(() => import('./modules/DataEntry/DataCaptureHub'));

// ── BMS unified view ──────────────────────────────────────────────────────────
const BMSSection = lazy(() => import('./modules/BMS/BMSSection'));

// ── RMS top-level hub ─────────────────────────────────────────────────────────
const RMSSection            = lazy(() => import('./modules/RMS/RMSSection'));
const GlobalCaseStudiesSection = lazy(() => import('./modules/GlobalCaseStudies/GlobalCaseStudiesSection'));
const RoadReserveSection    = lazy(() => import('./modules/RoadReserve/RoadReserveSection'));

// ── Admin + unified wrappers ──────────────────────────────────────────────────
const AdminSection    = lazy(() => import('./modules/Admin/AdminSection'));
const DataAuditPanel  = lazy(() => import('./modules/DataAudit/DataAuditPanel'));
const MindMapSection  = lazy(() => import('./modules/MindMap/MindMapSection'));

const FULL_VIEWS      = new Set(['gismap', 'roadnetwork']);
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
          <div className="text-slate-500 text-sm mt-1">Dept. of National Roads · Ministry of Works &amp; Transport</div>
          <div className="text-slate-600 text-xs mt-0.5">Initializing platform · Fetching network data from unified database · DNR GIS Jun 2025</div>
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
  const { state, navigate } = useBMS();
  const { activeView, isLoading } = state;

  const showHeaderSearch = useMemo(() =>
    ['registry', 'inspections', 'documents', 'priority', 'sources'].includes(activeView),
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
        <main className="flex-1 min-h-0 relative overflow-hidden">
          <Suspense fallback={<ModuleSpinner />}>

            {activeView === 'gismap'      && <GISMapView />}
            {activeView === 'roadnetwork' && <RoadNetworkView />}

            {SELF_SCROLL_VIEWS.has(activeView) && (
              <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                {activeView === 'networkstory' && <NetworkStory />}
              </div>
            )}

            {!isFullView && !SELF_SCROLL_VIEWS.has(activeView) && (
              <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 12 }}>
                {activeView === 'network'               && <NetworkSection />}
                {activeView === 'platform'              && <PlatformDashboard />}
                {activeView === 'traffic'               && <TrafficSection />}
                {activeView === 'roadcondition'         && <RoadConditionView />}
                {activeView === 'maintenanceprogramme'  && <MaintenanceProgrammeView />}
                {activeView === 'projects'              && <ProjectsView />}
                {activeView === 'dashboard'        && <Dashboard />}
                {activeView === 'registry'         && <StructureRegistry />}
                {activeView === 'inspections'      && <InspectionManagement />}
                {activeView === 'condition'        && <ConditionAssessment />}
                {activeView === 'maintenance'      && <MaintenanceWorks />}
                {activeView === 'analytics'        && <Analytics />}
                {activeView === 'priority'         && <PriorityRanking />}
                {activeView === 'phototwin'        && <PhotoTwin />}
                {activeView === 'trafficanalytics' && <TrafficAnalytics />}
                {activeView === 'trafficsummary'   && <TrafficSummary />}
                {activeView === 'growthfactors'    && <GrowthFactorsPanel />}
                {activeView === 'overloading'      && <OverloadingSection />}
                {activeView === 'oprc'             && <OprcSection />}
                {activeView === 'ndpiv'            && <NdpivSection />}
                {activeView === 'hdm4'             && <HDM4Section />}
                {activeView === 'tabularsummaries' && <TabularSummaries />}

                {activeView === 'mlarchitecture' && (
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#e2eaf4', marginBottom: 4 }}>
                        Asset Management ML Engine
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.65)' }}>
                        Interactive system architecture — click any node to inspect model details, inputs, and outputs
                      </div>
                    </div>
                    <MLArchitectureDiagram />
                  </div>
                )}

                {activeView === 'projecttracker' && <ProjectTracker />}
                {activeView === 'pim'            && <PublicInvestmentSection />}

                {activeView === 'budget' && <BudgetSection />}

                {activeView === 'rms'             && <RMSSection />}
                {activeView === 'roadreserve'    && <RoadReserveSection />}
                {activeView === 'casestudies'    && <GlobalCaseStudiesSection />}
                {activeView === 'lifecycle'       && <LifecycleSection />}
                {activeView === 'sources'         && <SourcesSection />}
                {activeView === 'tabularsummaries' && <TabularSummaries />}

                {activeView === 'admin' && (
                  <Suspense fallback={<ModuleSpinner />}>
                    <RequireLogin label="Admin Tools">
                      <AdminSection onNavigate={navigate} />
                    </RequireLogin>
                  </Suspense>
                )}

                {activeView === 'pendingsurveys' && (
                  <Suspense fallback={<ModuleSpinner />}>
                    <RequireLogin label="Pending Submissions">
                      <PendingSubmissions />
                    </RequireLogin>
                  </Suspense>
                )}

                {activeView === 'dataaudit' && (
                  <Suspense fallback={<ModuleSpinner />}>
                    <RequireLogin label="Data Audit">
                      <DataAuditPanel />
                    </RequireLogin>
                  </Suspense>
                )}

                {activeView === 'datacapture' && (
                  <Suspense fallback={<ModuleSpinner />}>
                    <DataCaptureHub />
                  </Suspense>
                )}

                {activeView === 'bms' && <BMSSection />}
              </div>
            )}

          </Suspense>
        </main>
      </div>
    </div>
  );
}

// ── Login gate for Admin Tools + all input/capture sections ───────────────────
function RequireLogin({ label, children }: { label: string; children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <>{children}</>;
  return (
    <div style={{ minHeight: '100%' }}>
      <div style={{ textAlign: 'center', padding: '18px 0 0', color: 'rgba(148,163,184,0.85)', fontSize: 12.5, fontWeight: 600 }}>
        🔒 {label} requires sign-in
      </div>
      <LoginPage />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [highlightedLinks, setHighlightedLinks] = useState<string[]>([]);

  return (
    <AuthProvider>
      <BotHighlightContext.Provider value={{ highlightedLinks, setHighlightedLinks }}>
        <BMSProvider>
          <AppShell />
          <Suspense fallback={null}>
            <RoadAssetBot />
          </Suspense>
        </BMSProvider>
      </BotHighlightContext.Provider>
    </AuthProvider>
  );
}
