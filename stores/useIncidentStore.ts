import { create } from 'zustand';

export interface IncidentState {
  hoveredIncidentId: string | null;
  selectedIncidentId: string | null;
  scrollToIncidentId: string | null;
  geoFencePolygon: [number, number][] | null; // Array of [lat, lng]
  isDrawingGeoFence: boolean;
  isSimulatedOffline: boolean;
  toastMessage: string | null;

  // Actions
  setHoveredIncidentId: (id: string | null) => void;
  setSelectedIncidentId: (id: string | null) => void;
  setScrollToIncidentId: (id: string | null) => void;
  setGeoFencePolygon: (polygon: [number, number][] | null) => void;
  setIsDrawingGeoFence: (isDrawing: boolean) => void;
  setIsSimulatedOffline: (offline: boolean) => void;
  setToastMessage: (msg: string | null) => void;
}

export const useIncidentStore = create<IncidentState>((set) => ({
  hoveredIncidentId: null,
  selectedIncidentId: null,
  scrollToIncidentId: null,
  geoFencePolygon: null,
  isDrawingGeoFence: false,
  isSimulatedOffline: false,
  toastMessage: null,

  setHoveredIncidentId: (id) => set({ hoveredIncidentId: id }),
  setSelectedIncidentId: (id) => set({ selectedIncidentId: id }),
  setScrollToIncidentId: (id) => set({ scrollToIncidentId: id }),
  setGeoFencePolygon: (polygon) => set({ geoFencePolygon: polygon }),
  setIsDrawingGeoFence: (isDrawing) => set({ isDrawingGeoFence: isDrawing }),
  setIsSimulatedOffline: (offline) => set({ isSimulatedOffline: offline }),
  setToastMessage: (msg) => set({ toastMessage: msg }),
}));
