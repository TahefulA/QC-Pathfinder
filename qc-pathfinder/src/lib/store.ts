import { create } from 'zustand';
import {
  ActiveNavigationState,
  CampusGraphData,
  GeolocationStatus,
  Place,
  SavedAppData,
  SavedAppDataSchema,
  SimulationConfig,
  Stop,
  UserLocation,
  UserSettings,
} from './types';
import {
  calculateRemainingAlongRoute,
  filterAccuracy,
  isArrived,
  isOffCampus,
  isOffRoute,
  QC_CAMPUS_BOUNDS,
} from './navigation';
import { haversineMeters } from './geo';
import { calculateRoute } from './routing';

const STORAGE_KEY = 'qc_pathfinder_data_v1';

export const DEFAULT_SETTINGS: UserSettings = {
  speed: 'normal',
  speedMps: 1.3,
  bufferMinutes: 2,
  accessible: false,
};

const SAMPLE_PLACES: Place[] = [
  {
    id: 'custom-quad-lawn',
    name: 'Campus Quad Lawn (Benches)',
    kind: 'custom',
    category: 'hangout',
    lngLat: [-73.8182, 40.7358],
    emoji: '🌳',
    notes: 'Sunny picnic table spot near the quad trees',
  },
  {
    id: 'custom-patio-coffee',
    name: 'Patio Coffee Spot',
    kind: 'custom',
    category: 'food',
    lngLat: [-73.8166, 40.7346],
    emoji: '☕',
    notes: 'Quick snack tables outside Student Union',
  },
];

const SAMPLE_STOPS: Stop[] = [
  {
    id: 'sample-1',
    title: 'CSCI 211: OOP in Java',
    placeId: 'kiely-hall',
    room: 'Room 205',
    type: 'class',
    days: [0, 2], // Mon, Wed
    start: '09:00',
    end: '10:15',
    notes: 'Bring laptop for lab quiz',
  },
  {
    id: 'sample-2',
    title: 'MATH 241: Probability & Stats',
    placeId: 'powdermaker-hall',
    room: 'Room 114',
    type: 'class',
    days: [0, 2], // Mon, Wed
    start: '10:20', // Deliberately tight: 5 min gap!
    end: '11:35',
    notes: 'Homework 3 due at start of class',
  },
  {
    id: 'sample-3',
    title: 'Lunch & Chill on the Quad',
    placeId: 'custom-quad-lawn',
    room: 'North Bench',
    type: 'hangout',
    days: [0, 2],
    start: '11:50',
    end: '12:45',
    notes: 'Bagel from cafeteria',
  },
  {
    id: 'sample-4',
    title: 'PHYS 145: Principles of Physics',
    placeId: 'science-building',
    room: 'Lecture Hall B',
    type: 'class',
    days: [0, 2],
    start: '13:00',
    end: '14:15',
    notes: 'Lab session',
  },
  {
    id: 'sample-5',
    title: 'Quiet Study & Readings',
    placeId: 'rosenthal-library',
    room: '3rd Floor Stacks',
    type: 'study',
    days: [0, 2],
    start: '14:30',
    end: '16:00',
    notes: 'Work on algorithm problem set',
  },
];

interface AppState {
  // Graph & Data
  graphData: CampusGraphData | null;
  geoJsonData: any | null;
  isLoadingData: boolean;
  dataError: string | null;

  // Planner State
  selectedDay: number; // 0=Mon..6=Sun
  stops: Stop[];
  customPlaces: Place[];
  favorites: string[]; // Place or building IDs
  settings: UserSettings;

  // Active Map / Navigation UI state
  activeTab: 'planner' | 'directions' | 'places' | 'about' | 'debug';
  selectedStopId: string | null;
  selectedLegIndex: number | null;
  inspectedBuildingId: string | null;
  searchQuery: string;

  // Directions state
  directionsOrigin: string | null; // ID of place or building
  directionsDestination: string | null;

  // Pin placement mode
  isDroppingPin: boolean;
  pendingPinLocation: [number, number] | null;

  // Geolocation & Live Navigation
  userLocation: UserLocation | null;
  locationStatus: GeolocationStatus;
  locationErrorMessage: string | null;
  isLocateActive: boolean;
  navigationState: ActiveNavigationState | null;
  simulation: SimulationConfig;

  // Actions
  loadCampusData: () => Promise<void>;
  setSelectedDay: (day: number) => void;
  setActiveTab: (tab: 'planner' | 'directions' | 'places' | 'about' | 'debug') => void;
  setSelectedStopId: (id: string | null) => void;
  setSelectedLegIndex: (idx: number | null) => void;
  setInspectedBuildingId: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  setDirectionsOrigin: (id: string | null) => void;
  setDirectionsDestination: (id: string | null) => void;
  setIsDroppingPin: (active: boolean) => void;
  setPendingPinLocation: (loc: [number, number] | null) => void;

  // Location Actions
  startWatchingLocation: () => void;
  stopWatchingLocation: () => void;
  setUserLocation: (loc: UserLocation | null) => void;
  setLocationStatus: (status: GeolocationStatus, msg?: string | null) => void;

  // Navigation Actions
  startNavigation: (params: {
    destinationId: string;
    destinationName: string;
    destinationCoords: [number, number];
    destinationAccessPoints?: Array<[number, number]>;
    stopId?: string;
    nextStopId?: string;
    targetArrivalTime?: string;
    routeCoords: Array<[number, number]>;
  }) => void;
  updateNavigationProgress: (coords: [number, number]) => void;
  advanceToNextNavigationStop: () => void;
  endNavigation: () => void;

  // Simulation Actions
  setSimulation: (config: Partial<SimulationConfig>) => void;
  setSimulatedLocation: (buildingIdOrCoords: string | [number, number]) => void;
  playSimulatedWalk: () => void;
  stopSimulatedWalk: () => void;

  // Stop CRUD
  addStop: (stop: Omit<Stop, 'id'>) => string;
  updateStop: (id: string, stop: Partial<Stop>) => void;
  deleteStop: (id: string) => void;

  // Custom Places CRUD
  addCustomPlace: (place: Omit<Place, 'id' | 'kind'>) => string;
  updateCustomPlace: (id: string, place: Partial<Place>) => void;
  deleteCustomPlace: (id: string) => void;

  // Favorites
  toggleFavorite: (placeOrBuildingId: string) => void;

  // Settings
  updateSettings: (newSettings: Partial<UserSettings>) => void;

  // Persistence / Import / Export / Sample
  loadSampleDay: () => void;
  exportDataJson: () => string;
  importDataJson: (jsonStr: string) => { success: boolean; error?: string };
  resetAllData: () => void;
}

// Safely load from localStorage with Zod
function loadPersistedState(): {
  customPlaces: Place[];
  favorites: string[];
  stops: Stop[];
  settings: UserSettings;
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        customPlaces: [],
        favorites: ['kiely-hall', 'rosenthal-library', 'student-union'],
        stops: [],
        settings: DEFAULT_SETTINGS,
      };
    }
    const parsed = JSON.parse(raw);
    const validated = SavedAppDataSchema.safeParse(parsed);
    if (validated.success) {
      return {
        customPlaces: validated.data.customPlaces,
        favorites: validated.data.favorites,
        stops: validated.data.stops,
        settings: validated.data.settings,
      };
    }
    console.warn('Persisted data failed validation, falling back to defaults:', validated.error);
  } catch (e) {
    console.error('Error reading localStorage:', e);
  }

  return {
    customPlaces: [],
    favorites: ['kiely-hall', 'rosenthal-library', 'student-union'],
    stops: [],
    settings: DEFAULT_SETTINGS,
  };
}

function saveToLocalStorage(state: {
  customPlaces: Place[];
  favorites: string[];
  stops: Stop[];
  settings: UserSettings;
}) {
  try {
    const payload: SavedAppData = {
      version: 1,
      customPlaces: state.customPlaces,
      favorites: state.favorites,
      stops: state.stops,
      settings: state.settings,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

// Compute initial day of week: 0=Mon, ..., 6=Sun
function getTodayDayIndex(): number {
  const day = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  if (day === 0) return 6; // Sunday
  return day - 1; // Monday=0, Tuesday=1...
}

let geolocationWatchId: number | null = null;
let wakeLockSentinel: any = null;
let simulationInterval: any = null;

async function acquireWakeLock() {
  if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
    try {
      wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      wakeLockSentinel.addEventListener?.('release', () => {
        wakeLockSentinel = null;
      });
    } catch (err) {
      console.warn('Wake Lock request skipped:', err);
    }
  }
}

function releaseWakeLock() {
  if (wakeLockSentinel) {
    try {
      wakeLockSentinel.release();
    } catch {}
    wakeLockSentinel = null;
  }
}

export const useAppStore = create<AppState>((set, get) => {
  const initialData = loadPersistedState();

  return {
    graphData: null,
    geoJsonData: null,
    isLoadingData: true,
    dataError: null,

    selectedDay: getTodayDayIndex(),
    stops: initialData.stops,
    customPlaces: initialData.customPlaces,
    favorites: initialData.favorites,
    settings: initialData.settings,

    activeTab: 'planner',
    selectedStopId: null,
    selectedLegIndex: null,
    inspectedBuildingId: null,
    searchQuery: '',

    directionsOrigin: null,
    directionsDestination: null,

    isDroppingPin: false,
    pendingPinLocation: null,

    userLocation: null,
    locationStatus: 'idle',
    locationErrorMessage: null,
    isLocateActive: false,
    navigationState: null,
    simulation: {
      isSimulating: false,
      isPlayingWalk: false,
      speedMultiplier: 2,
    },

    loadCampusData: async () => {
      set({ isLoadingData: true, dataError: null });
      try {
        const [graphRes, geoJsonRes] = await Promise.all([
          fetch('/data/graph.json'),
          fetch('/data/campus.geojson'),
        ]);

        if (!graphRes.ok || !geoJsonRes.ok) {
          throw new Error('Failed to load campus graph or geojson data');
        }

        const graphData: CampusGraphData = await graphRes.json();
        const geoJsonData = await geoJsonRes.json();

        set({
          graphData,
          geoJsonData,
          isLoadingData: false,
        });

        // Check if sample query param is present in URL
        const params = new URLSearchParams(window.location.search);
        if (params.get('sample') === '1' && get().stops.length === 0) {
          get().loadSampleDay();
        }
      } catch (err) {
        console.error('Error loading campus data:', err);
        set({
          isLoadingData: false,
          dataError: (err as Error).message || 'Failed to load campus data',
        });
      }
    },

    setSelectedDay: (day: number) => set({ selectedDay: day, selectedLegIndex: null, selectedStopId: null }),
    setActiveTab: (tab) => set({ activeTab: tab }),
    setSelectedStopId: (id) => set({ selectedStopId: id, selectedLegIndex: null }),
    setSelectedLegIndex: (idx) => set({ selectedLegIndex: idx, selectedStopId: null }),
    setInspectedBuildingId: (id) => set({ inspectedBuildingId: id }),
    setSearchQuery: (q) => set({ searchQuery: q }),
    setDirectionsOrigin: (id) => set({ directionsOrigin: id }),
    setDirectionsDestination: (id) => set({ directionsDestination: id }),
    setIsDroppingPin: (active) => set({ isDroppingPin: active, pendingPinLocation: null }),
    setPendingPinLocation: (loc) => set({ pendingPinLocation: loc }),

    addStop: (stopInput) => {
      const id = `stop-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newStop: Stop = { ...stopInput, id };
      const updated = [...get().stops, newStop];
      set({ stops: updated });
      saveToLocalStorage({ ...get(), stops: updated });
      return id;
    },

    updateStop: (id, partial) => {
      const updated = get().stops.map(s => (s.id === id ? { ...s, ...partial } : s));
      set({ stops: updated });
      saveToLocalStorage({ ...get(), stops: updated });
    },

    deleteStop: (id) => {
      const updated = get().stops.filter(s => s.id !== id);
      set({ stops: updated, selectedStopId: null, selectedLegIndex: null });
      saveToLocalStorage({ ...get(), stops: updated });
    },

    addCustomPlace: (placeInput) => {
      const id = `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newPlace: Place = {
        ...placeInput,
        id,
        kind: 'custom',
      };
      const updated = [...get().customPlaces, newPlace];
      set({ customPlaces: updated, isDroppingPin: false, pendingPinLocation: null });
      saveToLocalStorage({ ...get(), customPlaces: updated });
      return id;
    },

    updateCustomPlace: (id, partial) => {
      const updated = get().customPlaces.map(p => (p.id === id ? { ...p, ...partial } : p));
      set({ customPlaces: updated });
      saveToLocalStorage({ ...get(), customPlaces: updated });
    },

    deleteCustomPlace: (id) => {
      const updated = get().customPlaces.filter(p => p.id !== id);
      // Also remove stops referencing this custom place
      const updatedStops = get().stops.filter(s => s.placeId !== id);
      set({ customPlaces: updated, stops: updatedStops });
      saveToLocalStorage({ ...get(), customPlaces: updated, stops: updatedStops });
    },

    toggleFavorite: (id) => {
      const cur = get().favorites;
      const updated = cur.includes(id) ? cur.filter(f => f !== id) : [...cur, id];
      set({ favorites: updated });
      saveToLocalStorage({ ...get(), favorites: updated });
    },

    updateSettings: (partial) => {
      const updated = { ...get().settings, ...partial };
      // Sync speedMps if speed profile changed
      if (partial.speed) {
        if (partial.speed === 'slow') updated.speedMps = 1.0;
        else if (partial.speed === 'normal') updated.speedMps = 1.3;
        else if (partial.speed === 'fast') updated.speedMps = 1.6;
      }
      set({ settings: updated });
      saveToLocalStorage({ ...get(), settings: updated });
    },

    loadSampleDay: () => {
      const samplePlaces = [...SAMPLE_PLACES];
      const sampleStops = [...SAMPLE_STOPS];
      set({
        customPlaces: samplePlaces,
        stops: sampleStops,
        selectedDay: 0, // Monday
      });
      saveToLocalStorage({
        ...get(),
        customPlaces: samplePlaces,
        stops: sampleStops,
      });
    },

    exportDataJson: () => {
      const payload: SavedAppData = {
        version: 1,
        customPlaces: get().customPlaces,
        favorites: get().favorites,
        stops: get().stops,
        settings: get().settings,
      };
      return JSON.stringify(payload, null, 2);
    },

    importDataJson: (jsonStr: string) => {
      try {
        const parsed = JSON.parse(jsonStr);
        const validated = SavedAppDataSchema.safeParse(parsed);
        if (!validated.success) {
          return {
            success: false,
            error: 'Invalid file format: ' + validated.error.issues.map(i => i.message).join(', '),
          };
        }
        set({
          customPlaces: validated.data.customPlaces,
          favorites: validated.data.favorites,
          stops: validated.data.stops,
          settings: validated.data.settings,
        });
        saveToLocalStorage(validated.data);
        return { success: true };
      } catch (e) {
        return {
          success: false,
          error: 'Failed to parse JSON file: ' + (e as Error).message,
        };
      }
    },

    setUserLocation: (loc) => set({ userLocation: loc }),

    setLocationStatus: (status, msg = null) =>
      set({ locationStatus: status, locationErrorMessage: msg }),

    startWatchingLocation: () => {
      // Toggle off if already actively watching
      if (get().isLocateActive) {
        get().stopWatchingLocation();
        return;
      }

      // Stop simulated walk if running
      if (get().simulation.isPlayingWalk) {
        get().stopSimulatedWalk();
      }

      const isLocalhost =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1');

      if (typeof window !== 'undefined' && !window.isSecureContext && !isLocalhost) {
        set({
          isLocateActive: false,
          locationStatus: 'insecure_context',
          locationErrorMessage: 'Geolocation requires a secure connection (HTTPS) or localhost.',
        });
        return;
      }

      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        set({
          isLocateActive: false,
          locationStatus: 'position_unavailable',
          locationErrorMessage: 'Geolocation is not supported by your browser.',
        });
        return;
      }

      set({
        isLocateActive: true,
        locationStatus: 'prompting',
        locationErrorMessage: null,
      });

      if (geolocationWatchId !== null) {
        navigator.geolocation.clearWatch(geolocationWatchId);
        geolocationWatchId = null;
      }

      geolocationWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { longitude, latitude, accuracy, heading, speed } = pos.coords;
          const coords: [number, number] = [longitude, latitude];
          const accuracyFilter = filterAccuracy(accuracy, 100);
          const offCampus = isOffCampus(coords, QC_CAMPUS_BOUNDS, 300);

          let status: GeolocationStatus = 'watching';
          let errorMsg: string | null = null;

          if (offCampus) {
            status = 'off_campus';
            errorMsg = "You're not on campus, so showing campus view.";
          } else if (accuracyFilter.weakSignal) {
            status = 'weak_signal';
            errorMsg = `Weak GPS signal (${Math.round(accuracy)}m accuracy).`;
          }

          set({
            userLocation: {
              lngLat: coords,
              accuracyMeters: accuracy,
              heading: typeof heading === 'number' && !isNaN(heading) ? heading : null,
              speed: typeof speed === 'number' && !isNaN(speed) ? speed : null,
              timestamp: pos.timestamp || Date.now(),
              isSimulated: false,
            },
            locationStatus: status,
            locationErrorMessage: errorMsg,
          });

          // Feed into active navigation
          if (get().navigationState?.isActive) {
            get().updateNavigationProgress(coords);
          }
        },
        (err) => {
          let status: GeolocationStatus = 'error';
          let errorMsg = err.message || 'Unable to retrieve your location.';

          if (err.code === 1) {
            // PERMISSION_DENIED
            status = 'permission_denied';
            errorMsg =
              "Location permission denied. To re-enable, click the tune/lock icon in your browser's address bar and set Location to 'Allow'.";
          } else if (err.code === 2) {
            // POSITION_UNAVAILABLE
            status = 'position_unavailable';
            errorMsg = 'Position unavailable. Please check that your device location services are enabled.';
          } else if (err.code === 3) {
            // TIMEOUT
            status = 'timeout';
            errorMsg = 'Location request timed out. Retrying...';
          }

          set({
            locationStatus: status,
            locationErrorMessage: errorMsg,
          });
        },
        {
          enableHighAccuracy: true,
          maximumAge: 2000,
          timeout: 10000,
        }
      );
    },

    stopWatchingLocation: () => {
      if (geolocationWatchId !== null && typeof navigator !== 'undefined') {
        navigator.geolocation.clearWatch(geolocationWatchId);
        geolocationWatchId = null;
      }
      set({
        isLocateActive: false,
        locationStatus: 'idle',
        locationErrorMessage: null,
      });
    },

    startNavigation: (params) => {
      acquireWakeLock();

      const userLoc = get().userLocation;
      const initialCoords = userLoc ? userLoc.lngLat : params.routeCoords[0];
      const remainingCalc = calculateRemainingAlongRoute(initialCoords, params.routeCoords);
      const remainingSeconds = remainingCalc.remainingDistanceMeters / get().settings.speedMps;

      set({
        navigationState: {
          isActive: true,
          destinationId: params.destinationId,
          destinationName: params.destinationName,
          destinationCoords: params.destinationCoords,
          destinationAccessPoints: params.destinationAccessPoints || [params.destinationCoords],
          stopId: params.stopId,
          nextStopId: params.nextStopId,
          targetArrivalTime: params.targetArrivalTime,
          remainingDistanceMeters: remainingCalc.remainingDistanceMeters,
          remainingSeconds,
          hasArrived: false,
          isOffRoute: false,
          lastRerouteTimestamp: 0,
          routeCoordinates: params.routeCoords,
          walkedCoordinates: remainingCalc.walkedCoordinates,
          remainingCoordinates: remainingCalc.remainingCoordinates,
        },
      });

      // If locate is not active and not simulated, prompt locate
      if (!get().isLocateActive && !get().simulation.isSimulating) {
        get().startWatchingLocation();
      }
    },

    updateNavigationProgress: (coords) => {
      const nav = get().navigationState;
      if (!nav || !nav.isActive) return;

      // 1. Check arrival (<25m from any destination access point)
      if (isArrived(coords, nav.destinationAccessPoints, 25)) {
        set({
          navigationState: {
            ...nav,
            hasArrived: true,
            remainingDistanceMeters: 0,
            remainingSeconds: 0,
            remainingCoordinates: [],
            walkedCoordinates: nav.routeCoordinates,
          },
        });
        return;
      }

      // 2. Check off-route (>30m from polyline)
      const offRoute = isOffRoute(coords, nav.routeCoordinates, 30);
      const now = Date.now();

      if (offRoute && now - nav.lastRerouteTimestamp >= 5000 && get().graphData) {
        // Recompute route from user coords to destination
        const newRoute = calculateRoute(
          { type: 'coord', lngLat: coords, label: 'My Location' },
          { type: 'coord', lngLat: nav.destinationCoords },
          {
            campusGraph: get().graphData!,
            accessible: get().settings.accessible,
            speedMps: get().settings.speedMps,
          }
        );

        if (newRoute.found && newRoute.coordinates.length > 1) {
          const newRemaining = calculateRemainingAlongRoute(coords, newRoute.coordinates);
          set({
            navigationState: {
              ...nav,
              routeCoordinates: newRoute.coordinates,
              remainingCoordinates: newRemaining.remainingCoordinates,
              walkedCoordinates: [coords],
              remainingDistanceMeters: newRoute.distanceMeters,
              remainingSeconds: newRoute.walkSeconds,
              lastRerouteTimestamp: now,
              isOffRoute: false,
            },
          });
          return;
        }
      }

      // 3. Normal progress along route
      const progress = calculateRemainingAlongRoute(coords, nav.routeCoordinates);
      const remainingSeconds = progress.remainingDistanceMeters / get().settings.speedMps;

      set({
        navigationState: {
          ...nav,
          remainingDistanceMeters: progress.remainingDistanceMeters,
          remainingSeconds,
          walkedCoordinates: progress.walkedCoordinates,
          remainingCoordinates: progress.remainingCoordinates,
          isOffRoute: offRoute,
        },
      });
    },

    advanceToNextNavigationStop: () => {
      const nav = get().navigationState;
      if (!nav || !nav.nextStopId || !get().graphData) {
        get().endNavigation();
        return;
      }

      const dayStops = get().stops
        .filter((s) => s.days.includes(get().selectedDay))
        .sort((a, b) => a.start.localeCompare(b.start));

      const nextStopIdx = dayStops.findIndex((s) => s.id === nav.nextStopId);
      if (nextStopIdx === -1) {
        get().endNavigation();
        return;
      }

      const targetStop = dayStops[nextStopIdx];
      const followingStop = dayStops[nextStopIdx + 1];

      const b = get().graphData?.buildings.find((item) => item.id === targetStop.placeId);
      const cp = get().customPlaces.find((c) => c.id === targetStop.placeId);
      const destCoords: [number, number] = b ? b.center : cp ? cp.lngLat : [0, 0];
      const accessPoints: Array<[number, number]> =
        b?.accessNodeIds
          ?.map((nid) => {
            const n = get().graphData?.nodes[nid];
            return n ? ([n.lng, n.lat] as [number, number]) : null;
          })
          .filter((c): c is [number, number] => c !== null) || [destCoords];

      const userCoords = get().userLocation?.lngLat || nav.destinationCoords;

      const route = calculateRoute(
        { type: 'coord', lngLat: userCoords, label: 'My Location' },
        b ? { type: 'building', buildingId: b.id } : { type: 'coord', lngLat: destCoords },
        {
          campusGraph: get().graphData!,
          accessible: get().settings.accessible,
          speedMps: get().settings.speedMps,
        }
      );

      if (route.found && route.coordinates.length > 1) {
        get().startNavigation({
          destinationId: targetStop.placeId,
          destinationName: targetStop.title,
          destinationCoords: destCoords,
          destinationAccessPoints: accessPoints,
          stopId: targetStop.id,
          nextStopId: followingStop?.id,
          targetArrivalTime: targetStop.start,
          routeCoords: route.coordinates,
        });
      } else {
        get().endNavigation();
      }
    },

    endNavigation: () => {
      releaseWakeLock();
      if (get().simulation.isPlayingWalk) {
        get().stopSimulatedWalk();
      }
      set({ navigationState: null });
    },

    setSimulation: (config) => {
      const updatedSim = { ...get().simulation, ...config };
      const currentLoc = get().userLocation;

      let nextLoc = currentLoc;
      if (updatedSim.isSimulating) {
        const coords = config.mockCoords || currentLoc?.lngLat || [-73.8166, 40.7365];
        const accuracy = typeof config.mockAccuracy === 'number' ? config.mockAccuracy : (currentLoc?.accuracyMeters ?? 8);
        const heading = typeof config.mockHeading === 'number' ? config.mockHeading : (currentLoc?.heading ?? 0);

        nextLoc = {
          lngLat: coords,
          accuracyMeters: accuracy,
          heading: heading,
          speed: get().settings.speedMps,
          timestamp: Date.now(),
          isSimulated: true,
        };
      }

      set({
        simulation: updatedSim,
        ...(nextLoc ? { userLocation: nextLoc } : {}),
      });

      if (updatedSim.isSimulating && nextLoc && get().navigationState?.isActive) {
        get().updateNavigationProgress(nextLoc.lngLat);
      }
    },

    setSimulatedLocation: (buildingIdOrCoords) => {
      let coords: [number, number] = [-73.816, 40.736];
      let bId: string | undefined = undefined;

      if (typeof buildingIdOrCoords === 'string') {
        bId = buildingIdOrCoords;
        const b = get().graphData?.buildings.find((item) => item.id === buildingIdOrCoords);
        if (b) coords = b.center;
      } else {
        coords = buildingIdOrCoords;
      }

      if (geolocationWatchId !== null && typeof navigator !== 'undefined') {
        navigator.geolocation.clearWatch(geolocationWatchId);
        geolocationWatchId = null;
      }

      set({
        isLocateActive: false,
        locationStatus: 'watching',
        locationErrorMessage: null,
        simulation: {
          ...get().simulation,
          isSimulating: true,
          simulatedBuildingId: bId,
        },
        userLocation: {
          lngLat: coords,
          accuracyMeters: 5,
          heading: 0,
          speed: get().settings.speedMps,
          timestamp: Date.now(),
          isSimulated: true,
        },
      });

      if (get().navigationState?.isActive) {
        get().updateNavigationProgress(coords);
      }
    },

    playSimulatedWalk: () => {
      if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
      }

      let routeCoords = get().navigationState?.routeCoordinates;

      if (!routeCoords || routeCoords.length < 2) {
        if (get().directionsOrigin && get().directionsDestination && get().graphData) {
          const originPlace = get().customPlaces.find((p) => p.id === get().directionsOrigin);
          const destPlace = get().customPlaces.find((p) => p.id === get().directionsDestination);
          const bOrig = get().graphData?.buildings.find((b) => b.id === get().directionsOrigin);
          const bDest = get().graphData?.buildings.find((b) => b.id === get().directionsDestination);

          const origTarget = originPlace
            ? { type: 'coord' as const, lngLat: originPlace.lngLat }
            : bOrig
            ? { type: 'building' as const, buildingId: bOrig.id }
            : null;
          const destTarget = destPlace
            ? { type: 'coord' as const, lngLat: destPlace.lngLat }
            : bDest
            ? { type: 'building' as const, buildingId: bDest.id }
            : null;

          if (origTarget && destTarget) {
            const r = calculateRoute(origTarget, destTarget, {
              campusGraph: get().graphData!,
              accessible: get().settings.accessible,
              speedMps: get().settings.speedMps,
            });
            if (r.found && r.coordinates.length > 1) {
              routeCoords = r.coordinates;
              const destCoords = bDest ? bDest.center : destPlace?.lngLat || r.coordinates[r.coordinates.length - 1];
              const destName = bDest ? bDest.name : destPlace?.name || 'Destination';
              get().startNavigation({
                destinationId: get().directionsDestination!,
                destinationName: destName,
                destinationCoords: destCoords,
                routeCoords: r.coordinates,
              });
            }
          }
        }
      }

      if (!routeCoords || routeCoords.length < 2) {
        const dayStops = get().stops
          .filter((s) => s.days.includes(get().selectedDay))
          .sort((a, b) => a.start.localeCompare(b.start));

        if (dayStops.length >= 2 && get().graphData) {
          const fromStop = dayStops[0];
          const toStop = dayStops[1];
          const bFrom = get().graphData?.buildings.find((b) => b.id === fromStop.placeId);
          const bTo = get().graphData?.buildings.find((b) => b.id === toStop.placeId);
          const cpFrom = get().customPlaces.find((c) => c.id === fromStop.placeId);
          const cpTo = get().customPlaces.find((c) => c.id === toStop.placeId);

          const fromTarget = bFrom
            ? { type: 'building' as const, buildingId: bFrom.id }
            : cpFrom
            ? { type: 'coord' as const, lngLat: cpFrom.lngLat }
            : null;
          const toTarget = bTo
            ? { type: 'building' as const, buildingId: bTo.id }
            : cpTo
            ? { type: 'coord' as const, lngLat: cpTo.lngLat }
            : null;

          if (fromTarget && toTarget) {
            const r = calculateRoute(fromTarget, toTarget, {
              campusGraph: get().graphData!,
              accessible: get().settings.accessible,
              speedMps: get().settings.speedMps,
            });
            if (r.found && r.coordinates.length > 1) {
              routeCoords = r.coordinates;
              const destCoords = bTo ? bTo.center : cpTo?.lngLat || r.coordinates[r.coordinates.length - 1];
              get().startNavigation({
                destinationId: toStop.placeId,
                destinationName: toStop.title,
                destinationCoords: destCoords,
                stopId: fromStop.id,
                nextStopId: dayStops[2]?.id,
                targetArrivalTime: toStop.start,
                routeCoords: r.coordinates,
              });
            }
          }
        }
      }

      if (!routeCoords || routeCoords.length < 2) {
        routeCoords = [
          [-73.816, 40.736],
          [-73.8165, 40.7362],
          [-73.8172, 40.7365],
          [-73.818, 40.7368],
          [-73.8188, 40.7371],
        ];
      }

      set({
        simulation: { ...get().simulation, isSimulating: true, isPlayingWalk: true },
        locationStatus: 'watching',
      });

      let currentSegment = 0;
      let distOnSegment = 0;
      const stepIntervalMs = 100;

      simulationInterval = setInterval(() => {
        if (!routeCoords || currentSegment >= routeCoords.length - 1) {
          get().stopSimulatedWalk();
          return;
        }

        const p1 = routeCoords[currentSegment];
        const p2 = routeCoords[currentSegment + 1];
        const segDist = haversineMeters(p1[0], p1[1], p2[0], p2[1]);

        const speedMps = get().settings.speedMps;
        const multiplier = get().simulation.speedMultiplier || 2;
        const stepDist = speedMps * multiplier * (stepIntervalMs / 1000);

        distOnSegment += stepDist;

        if (distOnSegment >= segDist) {
          currentSegment++;
          distOnSegment = 0;
          if (currentSegment >= routeCoords.length - 1) {
            const finalCoord = routeCoords[routeCoords.length - 1];
            set({
              userLocation: {
                lngLat: finalCoord,
                accuracyMeters: 4,
                heading: null,
                speed: 0,
                timestamp: Date.now(),
                isSimulated: true,
              },
            });
            get().updateNavigationProgress(finalCoord);
            get().stopSimulatedWalk();
            return;
          }
        }

        const curP1 = routeCoords[currentSegment];
        const curP2 = routeCoords[currentSegment + 1];
        const curSegDist = haversineMeters(curP1[0], curP1[1], curP2[0], curP2[1]);
        const fraction = curSegDist > 0 ? Math.min(1, distOnSegment / curSegDist) : 0;

        const lng = curP1[0] + fraction * (curP2[0] - curP1[0]);
        const lat = curP1[1] + fraction * (curP2[1] - curP1[1]);

        const dLng = curP2[0] - curP1[0];
        const dLat = curP2[1] - curP1[1];
        const headingRad = Math.atan2(dLng * Math.cos((lat * Math.PI) / 180), dLat);
        const headingDeg = ((headingRad * 180) / Math.PI + 360) % 360;

        const currentCoord: [number, number] = [lng, lat];

        set({
          userLocation: {
            lngLat: currentCoord,
            accuracyMeters: 5,
            heading: Math.round(headingDeg),
            speed: speedMps * multiplier,
            timestamp: Date.now(),
            isSimulated: true,
          },
        });

        if (get().navigationState?.isActive) {
          get().updateNavigationProgress(currentCoord);
        }
      }, stepIntervalMs);
    },

    stopSimulatedWalk: () => {
      if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
      }
      set({
        simulation: {
          ...get().simulation,
          isPlayingWalk: false,
        },
      });
    },

    resetAllData: () => {
      localStorage.removeItem(STORAGE_KEY);
      set({
        customPlaces: [],
        favorites: ['kiely-hall', 'rosenthal-library', 'student-union'],
        stops: [],
        settings: DEFAULT_SETTINGS,
      });
    },
  };
});
