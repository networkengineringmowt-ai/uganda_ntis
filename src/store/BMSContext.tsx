import React, { createContext, useContext, useReducer, useEffect, useCallback, startTransition } from 'react';
import type { AppState, AppAction, ActiveView, Inspection, WorkOrder, BridgeDocument, Structure } from '../types';
import {
  loadAllStructures,
  generateSampleInspections,
  generateSampleWorkOrders,
  generateSampleDocuments,
} from '../data/generateData';

// ─── Initial state ────────────────────────────────────────────────────────────
const initialState: AppState = {
  structures:          [],
  inspections:         [],
  workOrders:          [],
  documents:           [],
  activeView:          'platform',
  selectedStructureId: null,
  isLoading:           true,
  viewHistory:         ['platform'],
  historyIndex:        0,
};

// ─── Reducer ──────────────────────────────────────────────────────────────────
function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_STRUCTURES':
      return { ...state, structures: action.payload, isLoading: false };

    case 'SET_ACTIVE_VIEW': {
      // Push to history, discarding any forward entries (like a real browser)
      const newHistory = [...state.viewHistory.slice(0, state.historyIndex + 1), action.payload];
      return {
        ...state,
        activeView:   action.payload,
        viewHistory:  newHistory,
        historyIndex: newHistory.length - 1,
      };
    }

    case 'NAVIGATE_BACK': {
      if (state.historyIndex <= 0) return state;
      const idx = state.historyIndex - 1;
      return { ...state, historyIndex: idx, activeView: state.viewHistory[idx] };
    }

    case 'NAVIGATE_FORWARD': {
      if (state.historyIndex >= state.viewHistory.length - 1) return state;
      const idx = state.historyIndex + 1;
      return { ...state, historyIndex: idx, activeView: state.viewHistory[idx] };
    }

    case 'SELECT_STRUCTURE':
      return { ...state, selectedStructureId: action.payload };

    case 'SEED_ALL_DATA':
      return {
        ...state,
        inspections: action.payload.inspections,
        workOrders:  action.payload.workOrders,
        documents:   action.payload.documents,
      };

    case 'ADD_INSPECTION': {
      const inspections = [action.payload, ...state.inspections];
      return { ...state, inspections };
    }

    case 'ADD_WORK_ORDER': {
      const workOrders = [action.payload, ...state.workOrders];
      return { ...state, workOrders };
    }

    case 'UPDATE_WORK_ORDER': {
      const workOrders = state.workOrders.map(w =>
        w.id === action.payload.id ? action.payload : w,
      );
      return { ...state, workOrders };
    }

    case 'ADD_DOCUMENT': {
      const documents = [action.payload, ...state.documents];
      return { ...state, documents };
    }

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'UPDATE_STRUCTURE': {
      const structures = state.structures.map(s =>
        s.id === action.payload.id ? { ...s, ...action.payload } : s,
      );
      return { ...state, structures };
    }

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────
interface BMSContextType {
  state:           AppState;
  dispatch:        React.Dispatch<AppAction>;
  navigate:        (view: ActiveView) => void;
  goBack:          () => void;
  goForward:       () => void;
  canGoBack:       boolean;
  canGoForward:    boolean;
  selectStructure: (id: string | null) => void;
}

const BMSContext = createContext<BMSContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function BMSProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load data on mount — try localStorage first, then generate fresh
  useEffect(() => {
    async function init() {
      dispatch({ type: 'SET_LOADING', payload: true });

      const STORAGE_KEY = 'bms_structures_v3';
      const INSP_KEY    = 'bms_inspections_v3';
      const WO_KEY      = 'bms_workorders_v3';
      const DOC_KEY     = 'bms_documents_v3';

      try {
        // Always reload structures fresh from GeoJSON (they're deterministic)
        const structures = await loadAllStructures();
        dispatch({ type: 'SET_STRUCTURES', payload: structures });

        // For user-generated data (inspections, work orders, docs) prefer localStorage
        const savedInsp = localStorage.getItem(INSP_KEY);
        const savedWO   = localStorage.getItem(WO_KEY);
        const savedDocs = localStorage.getItem(DOC_KEY);

        const inspections = savedInsp
          ? JSON.parse(savedInsp) as Inspection[]
          : generateSampleInspections(structures);

        const workOrders = savedWO
          ? JSON.parse(savedWO) as WorkOrder[]
          : generateSampleWorkOrders(structures);

        const documents = savedDocs
          ? JSON.parse(savedDocs) as BridgeDocument[]
          : generateSampleDocuments(structures);

        // Seed cache for next visit
        if (!savedInsp)  localStorage.setItem(INSP_KEY, JSON.stringify(inspections));
        if (!savedWO)    localStorage.setItem(WO_KEY,   JSON.stringify(workOrders));
        if (!savedDocs)  localStorage.setItem(DOC_KEY,  JSON.stringify(documents));
        localStorage.setItem(STORAGE_KEY, '1');

        // Single batch dispatch — replaces 290+ individual re-renders with one
        dispatch({ type: 'SEED_ALL_DATA', payload: { inspections, workOrders, documents } });

      } catch (err) {
        console.error('BMS data load error:', err);
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }

    void init();
  }, []);

  // Persist user mutations
  useEffect(() => {
    if (state.inspections.length > 0) {
      localStorage.setItem('bms_inspections_v3', JSON.stringify(state.inspections));
    }
  }, [state.inspections]);

  useEffect(() => {
    if (state.workOrders.length > 0) {
      localStorage.setItem('bms_workorders_v3', JSON.stringify(state.workOrders));
    }
  }, [state.workOrders]);

  useEffect(() => {
    if (state.documents.length > 0) {
      localStorage.setItem('bms_documents_v3', JSON.stringify(state.documents));
    }
  }, [state.documents]);

  const navigate = useCallback((view: ActiveView) => {
    // startTransition keeps the current view visible while the new lazy chunk loads,
    // preventing the "content disappears" flash between navigations.
    startTransition(() => {
      dispatch({ type: 'SET_ACTIVE_VIEW', payload: view });
    });
  }, []);

  const goBack = useCallback(() => {
    dispatch({ type: 'NAVIGATE_BACK' });
  }, []);

  const goForward = useCallback(() => {
    dispatch({ type: 'NAVIGATE_FORWARD' });
  }, []);

  const selectStructure = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_STRUCTURE', payload: id });
  }, []);

  return (
    <BMSContext.Provider value={{
      state, dispatch, navigate, selectStructure,
      goBack, goForward,
      canGoBack:    state.historyIndex > 0,
      canGoForward: state.historyIndex < state.viewHistory.length - 1,
    }}>
      {children}
    </BMSContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useBMS(): BMSContextType {
  const ctx = useContext(BMSContext);
  if (!ctx) throw new Error('useBMS must be used within BMSProvider');
  return ctx;
}

// ─── Derived selector hooks ───────────────────────────────────────────────────

export function useStructures(): Structure[] {
  return useBMS().state.structures;
}

export function useSelectedStructure(): Structure | null {
  const { state } = useBMS();
  return state.structures.find(s => s.id === state.selectedStructureId) ?? null;
}
