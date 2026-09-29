import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { useAppStore } from '../lib/store';
import { calculateRoute } from '../lib/routing';
import { haversineMeters, snapToNearestNode } from '../lib/geo';
import { BuildingInfo, Place, Stop } from '../lib/types';
import {
  createAccuracyCircleGeoJson,
  isOffCampus,
  QC_CAMPUS_BOUNDS,
} from '../lib/navigation';
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Compass,
  Crosshair,
  Footprints,
  GripVertical,
  Maximize2,
  Navigation,
  Pencil,
  Play,
  Plus,
  Square,
  Star,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

const CAMPUS_BOUNDS: [[number, number], [number, number]] = [
  [-73.8245, 40.7320], // Southwest (QC campus area)
  [-73.8110, 40.7410], // Northeast
];

const MAX_PAN_BOUNDS: [[number, number], [number, number]] = [
  [-73.8340, 40.7250],
  [-73.8020, 40.7480],
];

const LEG_COLORS = [
  '#38bdf8', // sky-400
  '#a855f7', // purple-500
  '#34d399', // emerald-400
  '#fb923c', // orange-400
  '#f43f5e', // rose-500
  '#eab308', // yellow-500
  '#06b6d4', // cyan-500
];

// Physical building heights & structural landmark specifications (meters)
export const QC_BUILDING_HEIGHTS: Record<string, { height: number; levels: number; isLandmark?: boolean }> = {
  'kiely-hall': { height: 48, levels: 13, isLandmark: true }, // Main tower & iconic clock spire
  'rosenthal-library': { height: 36, levels: 6, isLandmark: true }, // Tiered atrium & glass skylight
  'science-building': { height: 28, levels: 5, isLandmark: true }, // High-ceiling research wing
  'the-summit': { height: 26, levels: 6, isLandmark: true }, // Student residence complex
  'powdermaker-hall': { height: 24, levels: 4, isLandmark: true }, // Liberal arts hall
  'colden-auditorium': { height: 24, levels: 3, isLandmark: true }, // Kupferberg Center
  'fitzgerald-gymnasium': { height: 22, levels: 3, isLandmark: true }, // Arena and athletics
  'aaron-copland-school-of-music': { height: 22, levels: 3, isLandmark: true }, // LeFrak Concert Hall
  'music-building': { height: 22, levels: 3, isLandmark: true },
  'townsend-harris-high-school': { height: 22, levels: 4, isLandmark: false },
  'goldstein-theater': { height: 20, levels: 3, isLandmark: true },
  'student-union': { height: 20, levels: 4, isLandmark: true },
  'remsen-hall': { height: 20, levels: 4, isLandmark: true },
  'razran-hall': { height: 20, levels: 4, isLandmark: true },
  'klapper-hall': { height: 20, levels: 4, isLandmark: true },
  'jefferson-hall': { height: 18, levels: 3, isLandmark: true },
  'queens-hall': { height: 18, levels: 3, isLandmark: false },
  'rathaus-hall': { height: 18, levels: 3, isLandmark: true },
  'delany-hall': { height: 16, levels: 3, isLandmark: true },
  'kissena-hall': { height: 16, levels: 3, isLandmark: true },
  'king-hall': { height: 16, levels: 3, isLandmark: true },
  'virginia-frese-hall': { height: 16, levels: 3, isLandmark: true },
  'frese-hall': { height: 16, levels: 3, isLandmark: true },
  'queens-college-indoor-tennis-center': { height: 16, levels: 2, isLandmark: false },
  'honors-hall': { height: 15, levels: 3, isLandmark: true },
  'colwin-hall': { height: 15, levels: 3, isLandmark: true },
  'alumni-hall': { height: 15, levels: 3, isLandmark: true },
  'campbell-dome': { height: 14, levels: 2, isLandmark: true }, // Geodesic dome
  'dining-hall': { height: 13, levels: 2, isLandmark: true },
  'g-building': { height: 13, levels: 2, isLandmark: true },
  'i-building': { height: 12, levels: 2, isLandmark: true },
  'gertz-center': { height: 12, levels: 2, isLandmark: true },
  'public-safety': { height: 10, levels: 1, isLandmark: false },
};

// Campus landmark priority tiers for collision-free labeling
const CAMPUS_LANDMARK_PRIORITIES: Record<string, { priority: number; label: string }> = {
  // Tier 1: Primary landmarks (visible from zoom 15.0)
  'kiely-hall': { priority: 1, label: 'Kiely Hall' },
  'rosenthal-library': { priority: 1, label: 'Rosenthal Library' },
  'science-building': { priority: 1, label: 'Science Building' },
  'student-union': { priority: 1, label: 'Student Union' },
  'jefferson-hall': { priority: 1, label: 'Jefferson Hall' },
  'powdermaker-hall': { priority: 1, label: 'Powdermaker Hall' },
  'fitzgerald-gymnasium': { priority: 1, label: 'Fitzgerald Gym' },

  // Tier 2: Core academic & major campus venues (visible from zoom 15.7)
  'dining-hall': { priority: 2, label: 'Dining Hall' },
  'remsen-hall': { priority: 2, label: 'Remsen Hall' },
  'razran-hall': { priority: 2, label: 'Razran Hall' },
  'delany-hall': { priority: 2, label: 'Delany Hall' },
  'klapper-hall': { priority: 2, label: 'Klapper Hall' },
  'colden-auditorium': { priority: 2, label: 'Colden Auditorium' },
  'rathaus-hall': { priority: 2, label: 'Rathaus Hall' },
  'music-building': { priority: 2, label: 'Music Building' },
  'campbell-dome': { priority: 2, label: 'Campbell Dome' },

  // Tier 3: Secondary campus facilities (visible from zoom 16.3)
  'king-hall': { priority: 3, label: 'King Hall' },
  'honors-hall': { priority: 3, label: 'Honors Hall' },
  'g-building': { priority: 3, label: 'G Building' },
  'colwin-hall': { priority: 3, label: 'Colwin Hall' },
  'alumni-hall': { priority: 3, label: 'Alumni Hall' },
  'frese-hall': { priority: 3, label: 'Frese Hall' },
  'kissena-hall': { priority: 3, label: 'Kissena Hall' },
  'quad': { priority: 3, label: 'The Quad' },
};

interface CampusMapProps {
  onAddStopWithPlace?: (placeId: string) => void;
  onOpenPinModal?: (coords: [number, number]) => void;
  onEditStop?: (stop: Stop) => void;
}

export const CampusMap: React.FC<CampusMapProps> = ({
  onAddStopWithPlace,
  onOpenPinModal,
  onEditStop,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const labelItemsRef = useRef<Array<{
    marker: maplibregl.Marker;
    element: HTMLElement;
    priority: number;
    center: [number, number];
  }>>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  const {
    graphData,
    geoJsonData,
    selectedDay,
    stops,
    customPlaces,
    favorites,
    settings,
    activeTab,
    selectedStopId,
    selectedLegIndex,
    inspectedBuildingId,
    directionsOrigin,
    directionsDestination,
    isDroppingPin,
    userLocation,
    locationStatus,
    locationErrorMessage,
    isLocateActive,
    navigationState,
    simulation,
    setSelectedStopId,
    setSelectedLegIndex,
    setInspectedBuildingId,
    setDirectionsOrigin,
    setDirectionsDestination,
    setActiveTab,
    toggleFavorite,
    setIsDroppingPin,
    startWatchingLocation,
    stopWatchingLocation,
    startNavigation,
    endNavigation,
    advanceToNextNavigationStop,
    playSimulatedWalk,
    stopSimulatedWalk,
    setSimulation,
    setLocationStatus,
    updateStop,
    deleteStop,
    addCustomPlace,
  } = useAppStore();

  const [currentZoom, setCurrentZoom] = useState(16.2);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [is3DMode, setIs3DMode] = useState(true);
  const [compassBearing, setCompassBearing] = useState(-18);
  const [currentPitch, setCurrentPitch] = useState(52);
  const [dismissedNotice, setDismissedNotice] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    stopTitle: string;
    targetName?: string;
    targetBuildingId?: string;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const hasFlownToUserRef = useRef(false);

  // Auto-dismiss notification toasts
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Initialize MapLibre with true 3D isometric view and OpenStreetMap basemap underneath
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          // Reliable OpenStreetMap basemap tiles
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            maxzoom: 19,
            attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
          },
        },
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: {
              'background-color': '#080c14',
            },
          },
          {
            id: 'osm-tiles-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 20,
            paint: {
              'raster-opacity': 0.85,
              'raster-saturation': -0.75,
              'raster-contrast': 0.28,
              'raster-brightness-max': 0.65,
            },
          },
        ],
      },
      center: [-73.8166, 40.7360],
      zoom: 16.2,
      pitch: 52, // 3D Isometric axonometric tilt
      bearing: -18, // Angled along Queens College main campus quad
      minZoom: 14.0,
      maxZoom: 19.8,
      maxPitch: 70, // Allow steep dramatic 3D angles
      minPitch: 0,
      pitchWithRotate: true,
      dragRotate: true,
      touchPitch: true,
      maxBounds: MAX_PAN_BOUNDS,
      attributionControl: false,
    });

    map.on('load', () => {
      setMapLoaded(true);
      // Directional sunlight coming from SW at 45deg creating realistic 3D shadows and highlights
      map.setLight({
        anchor: 'map',
        color: '#ffffff',
        intensity: 0.60,
        position: [1.5, 215, 45],
      });
      map.fitBounds(CAMPUS_BOUNDS, {
        padding: 40,
        duration: 800,
        pitch: 52,
        bearing: -18,
      });
      console.log('[QC Pathfinder] 3D volumetric map initialized with directional lighting and 52deg pitch.');
    });

    // Gracefully handle any transient tile network errors without breaking app
    map.on('error', (e) => {
      if (e && e.error) {
        console.warn('[QC Pathfinder] Map resource warning handled gracefully:', e.error.message || e.error);
      }
    });

    map.on('zoom', () => {
      setCurrentZoom(map.getZoom());
    });

    map.on('rotate', () => {
      setCompassBearing(Math.round(map.getBearing()));
    });

    map.on('pitch', () => {
      const p = Math.round(map.getPitch());
      setCurrentPitch(p);
      setIs3DMode(p > 15);
    });

    // 3D Building hover cursor
    map.on('mouseenter', 'campus-buildings-3d', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'campus-buildings-3d', () => {
      map.getCanvas().style.cursor = '';
    });

    // Handle map clicks
    map.on('click', (e: any) => {
      const state = useAppStore.getState();

      if (state.isDroppingPin) {
        if (onOpenPinModal) {
          onOpenPinModal([e.lngLat.lng, e.lngLat.lat]);
        }
        return;
      }

      // Check if a 3D building feature was clicked
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['campus-buildings-3d'],
      });

      if (features.length > 0) {
        const feat = features[0];
        const bId = feat.properties?.id;
        if (bId) {
          state.setInspectedBuildingId(bId);
          showBuildingPopup(bId, [e.lngLat.lng, e.lngLat.lat]);
        }
      } else {
        if (popupRef.current) {
          popupRef.current.remove();
        }
        state.setInspectedBuildingId(null);
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Set up GeoJSON Sources and Layers once map and data are ready
  // Volumetric 3D building extrusions, walkways, routes, and precision overlays
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !geoJsonData) return;

    // Add or update campus source
    if (!map.getSource('campus-data')) {
      map.addSource('campus-data', {
        type: 'geojson',
        data: geoJsonData,
      });

      // 1. Walkways overlay from OSM footpath data (ground level)
      map.addLayer({
        id: 'campus-walkways',
        type: 'line',
        source: 'campus-data',
        filter: [
          'all',
          ['==', ['get', 'type'], 'walkway'],
          ['!=', ['get', 'isStairs'], true],
        ],
        paint: {
          'line-color': '#93c5fd',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15, 1.5,
            17, 2.5,
            19, 4.0,
          ],
          'line-opacity': 0.75,
        },
      });

      // 2. Outdoor stairs overlay (dashed amber lines)
      map.addLayer({
        id: 'campus-stairs',
        type: 'line',
        source: 'campus-data',
        filter: [
          'all',
          ['==', ['get', 'type'], 'walkway'],
          ['==', ['get', 'isStairs'], true],
        ],
        paint: {
          'line-color': '#f59e0b',
          'line-width': 2.5,
          'line-dasharray': [1, 1],
          'line-opacity': 0.95,
        },
      });

      // 3. Source for routes
      map.addSource('routes-data', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Route glow / casing layer
      map.addLayer({
        id: 'routes-casing',
        type: 'line',
        source: 'routes-data',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': ['get', 'glowColor'],
          'line-width': ['get', 'glowWidth'],
          'line-opacity': 0.55,
        },
      });

      // Main route line (bright, crisp, above ground paths)
      map.addLayer({
        id: 'routes-line',
        type: 'line',
        source: 'routes-data',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['get', 'width'],
          'line-opacity': 0.95,
        },
      });

      // 4. Source for snap connectors (dashed lines from custom pins to graph)
      map.addSource('snap-lines', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'snap-lines-layer',
        type: 'line',
        source: 'snap-lines',
        paint: {
          'line-color': '#c084fc',
          'line-width': 2.0,
          'line-dasharray': [2, 2],
          'line-opacity': 0.85,
        },
      });

      // 5. Source and layer for GPS accuracy circle
      map.addSource('user-accuracy-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'user-accuracy-layer',
        type: 'fill',
        source: 'user-accuracy-source',
        paint: {
          'fill-color': '#0284c7',
          'fill-opacity': 0.15,
        },
      });

      map.addLayer({
        id: 'user-accuracy-stroke',
        type: 'line',
        source: 'user-accuracy-source',
        paint: {
          'line-color': '#38bdf8',
          'line-width': 1.5,
          'line-opacity': 0.4,
        },
      });

      // 6. Volumetric 3D Building Extrusions with ambient occlusion & realistic height
      map.addLayer({
        id: 'campus-buildings-3d',
        type: 'fill-extrusion',
        source: 'campus-data',
        filter: ['==', ['get', 'type'], 'building'],
        paint: {
          'fill-extrusion-color': [
            'case',
            ['==', ['get', 'id'], inspectedBuildingId || ''],
            '#38bdf8', // Radiant sky-blue highlight for inspected building
            ['==', ['get', 'id'], navigationState?.destinationId || ''],
            '#34d399', // Emerald beacon for navigation destination
            ['==', ['get', 'id'], directionsOrigin || ''],
            '#c084fc', // Purple beacon for route start
            ['==', ['get', 'id'], directionsDestination || ''],
            '#34d399', // Emerald beacon for route end
            ['==', ['get', 'isCampusLandmark'], true],
            '#2563eb', // Rich Queens College royal blue
            '#1e293b', // Modern graphite-slate for surrounding neighborhood
          ],
          'fill-extrusion-height': [
            'case',
            ['==', ['get', 'id'], inspectedBuildingId || ''],
            ['+', ['coalesce', ['get', 'height'], 14], 3.5], // Dynamic elevation pop when inspected
            ['coalesce', ['get', 'height'], 14],
          ],
          'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
          'fill-extrusion-opacity': [
            'case',
            ['==', ['get', 'id'], inspectedBuildingId || ''],
            0.98,
            ['==', ['get', 'isCampusLandmark'], true],
            0.92,
            0.82,
          ],
          'fill-extrusion-vertical-gradient': true, // Natural shading gradient from rooftop to base
        },
      });

      // Log layer hierarchy for inspection
      const renderedLayers = map.getStyle().layers.map(l => `${l.id} (${l.type})`);
      console.log('[QC Pathfinder] 3D building extrusions and walkway layers rendered:', renderedLayers);
    }
  }, [mapLoaded, geoJsonData]);

  // Update dynamic 3D building highlights and elevation pops
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !map.getLayer('campus-buildings-3d')) return;

    map.setPaintProperty('campus-buildings-3d', 'fill-extrusion-color', [
      'case',
      ['==', ['get', 'id'], dragState?.targetBuildingId || ''],
      '#f59e0b', // Radiant amber target highlight when dragging a stop over building
      ['==', ['get', 'id'], inspectedBuildingId || ''],
      '#38bdf8',
      ['==', ['get', 'id'], navigationState?.destinationId || ''],
      '#34d399',
      ['==', ['get', 'id'], directionsOrigin || ''],
      '#c084fc',
      ['==', ['get', 'id'], directionsDestination || ''],
      '#34d399',
      ['==', ['get', 'isCampusLandmark'], true],
      '#2563eb',
      '#1e293b',
    ]);

    map.setPaintProperty('campus-buildings-3d', 'fill-extrusion-height', [
      'case',
      ['==', ['get', 'id'], dragState?.targetBuildingId || ''],
      ['+', ['coalesce', ['get', 'height'], 14], 5], // Elevation pop when hovered
      ['==', ['get', 'id'], inspectedBuildingId || ''],
      ['+', ['coalesce', ['get', 'height'], 14], 3.5],
      ['coalesce', ['get', 'height'], 14],
    ]);

    map.setPaintProperty('campus-buildings-3d', 'fill-extrusion-opacity', [
      'case',
      ['==', ['get', 'id'], dragState?.targetBuildingId || ''],
      1.0,
      ['==', ['get', 'id'], inspectedBuildingId || ''],
      0.98,
      ['==', ['get', 'isCampusLandmark'], true],
      0.92,
      0.82,
    ]);
  }, [inspectedBuildingId, navigationState?.destinationId, directionsOrigin, directionsDestination, dragState?.targetBuildingId, mapLoaded]);

  // Create Prioritized DOM building labels (with collision avoidance)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !graphData) return;

    // Clear old labels
    labelItemsRef.current.forEach(item => item.marker.remove());
    labelItemsRef.current = [];

    // Filter to known campus buildings or buildings inside campus bounds with distinct names
    const campusBuildings = graphData.buildings.filter(b => {
      if (!b.name || b.name.trim().length === 0) return false;
      // Is it one of our recognized priority landmarks?
      if (CAMPUS_LANDMARK_PRIORITIES[b.id]) return true;

      // Or inside main campus bounding box?
      const [lng, lat] = b.center;
      const inBounds =
        lng >= -73.8240 && lng <= -73.8120 &&
        lat >= 40.7325 && lat <= 40.7405;

      return inBounds;
    });

    campusBuildings.forEach(b => {
      const priorityInfo = CAMPUS_LANDMARK_PRIORITIES[b.id] || { priority: 4, label: b.name.replace(/\s*\([A-Z0-9]+\)/, '') };

      const el = document.createElement('div');
      el.className = `building-label pointer-events-auto cursor-pointer transition-opacity duration-200 font-sans text-[11px] font-bold text-neutral-200 bg-neutral-900/90 hover:bg-neutral-800 hover:text-white px-2 py-0.5 rounded-md border border-neutral-700/80 shadow-md backdrop-blur-xs whitespace-nowrap`;
      el.innerText = priorityInfo.label;

      // Click to inspect building
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setInspectedBuildingId(b.id);
        showBuildingPopup(b.id, b.center);
      });

      const bHeight = QC_BUILDING_HEIGHTS[b.id]?.height || 16;
      // In 3D isometric view, project label marker above 3D rooftop
      const yOffset = is3DMode ? -Math.min(36, Math.max(12, Math.round(bHeight * 0.55))) : -6;

      const marker = new maplibregl.Marker({
        element: el,
        anchor: 'bottom',
        offset: [0, yOffset],
      })
        .setLngLat(b.center)
        .addTo(map);

      labelItemsRef.current.push({
        marker,
        element: el,
        priority: priorityInfo.priority,
        center: b.center,
      });
    });

    // Run initial collision resolution
    resolveLabelCollisions();
  }, [mapLoaded, graphData, is3DMode]);

  // Dynamic collision resolution and zoom gating
  const resolveLabelCollisions = () => {
    const map = mapRef.current;
    if (!map || labelItemsRef.current.length === 0) return;

    const zoom = map.getZoom();
    const placedPoints: Array<{ x: number; y: number }> = [];

    // Sort: Priority 1 first, then 2, 3, etc.
    const sorted = [...labelItemsRef.current].sort((a, b) => a.priority - b.priority);

    sorted.forEach(item => {
      // 1. Zoom threshold check:
      // Zoom < 15.4: Only Priority 1
      // Zoom < 16.3: Priority 1 and 2
      // Zoom >= 16.3: All priorities
      if (zoom < 15.4 && item.priority > 1) {
        item.element.style.display = 'none';
        return;
      }
      if (zoom < 16.3 && item.priority > 2) {
        item.element.style.display = 'none';
        return;
      }

      // 2. Collision detection in screen coordinates:
      const screenPt = map.project(item.center);

      // Check distance against already placed higher-priority labels
      const collides = placedPoints.some(p => {
        const dx = p.x - screenPt.x;
        const dy = p.y - screenPt.y;
        return Math.sqrt(dx * dx + dy * dy) < 60; // 60px minimum spacing between labels
      });

      if (collides) {
        item.element.style.display = 'none';
      } else {
        item.element.style.display = 'block';
        placedPoints.push(screenPt);
      }
    });
  };

  // Attach collision resolution to map move and zoom events
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    map.on('move', resolveLabelCollisions);
    map.on('zoom', resolveLabelCollisions);

    return () => {
      map.off('move', resolveLabelCollisions);
      map.off('zoom', resolveLabelCollisions);
    };
  }, [mapLoaded]);

  // Helper to show building popup
  const showBuildingPopup = (buildingId: string, lngLat: [number, number]) => {
    const map = mapRef.current;
    if (!map || !graphData) return;

    const b = graphData.buildings.find(item => item.id === buildingId);
    if (!b) return;

    const isFav = favorites.includes(b.id);

    if (popupRef.current) popupRef.current.remove();

    const popupNode = document.createElement('div');
    popupNode.className = 'p-3 bg-neutral-900 text-neutral-100 rounded-xl shadow-2xl border border-neutral-700 min-w-[220px] max-w-[280px]';
    popupNode.innerHTML = `
      <div class="flex items-start justify-between gap-2 mb-1.5">
        <h4 class="font-bold text-sm text-neutral-100 leading-tight">${b.name || 'Campus Building'}</h4>
        <button id="btn-fav" class="text-neutral-400 hover:text-amber-400 transition-colors p-1">
          <svg class="w-4 h-4 ${isFav ? 'text-amber-400 fill-amber-400' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </button>
      </div>
      <p class="text-[11px] text-neutral-400 mb-3">${b.aliases?.length ? 'Aliases: ' + b.aliases.join(', ') : 'Queens College Landmark'}</p>
      <div class="grid grid-cols-2 gap-1.5 text-xs">
        <button id="btn-add-stop" class="col-span-2 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold transition-colors">
          <span>+ Add as Stop</span>
        </button>
        <button id="btn-dir-from" class="py-1 px-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-center font-medium transition-colors">
          From here
        </button>
        <button id="btn-dir-to" class="py-1 px-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-center font-medium transition-colors">
          To here
        </button>
      </div>
    `;

    // Hook listeners
    popupNode.querySelector('#btn-fav')?.addEventListener('click', () => {
      toggleFavorite(b.id);
      showBuildingPopup(buildingId, lngLat);
    });

    popupNode.querySelector('#btn-add-stop')?.addEventListener('click', () => {
      if (onAddStopWithPlace) {
        onAddStopWithPlace(b.id);
      }
      popupRef.current?.remove();
    });

    popupNode.querySelector('#btn-dir-from')?.addEventListener('click', () => {
      setDirectionsOrigin(b.id);
      setActiveTab('directions');
      popupRef.current?.remove();
    });

    popupNode.querySelector('#btn-dir-to')?.addEventListener('click', () => {
      setDirectionsDestination(b.id);
      setActiveTab('directions');
      popupRef.current?.remove();
    });

    const popup = new maplibregl.Popup({
      offset: 14,
      closeButton: false,
      maxWidth: '320px',
      className: 'qc-map-popup',
    })
      .setLngLat(lngLat)
      .setDOMContent(popupNode)
      .addTo(map);

    popupRef.current = popup;
  };

  // Helper to find nearest building or custom place within radius
  const findNearestBuildingOrPlace = (
    point: [number, number],
    buildings: BuildingInfo[],
    customs: Place[],
    maxDistMeters = 85
  ): { type: 'building' | 'custom'; item: BuildingInfo | Place; dist: number } | null => {
    let nearest: { type: 'building' | 'custom'; item: BuildingInfo | Place; dist: number } | null = null;
    let minDist = maxDistMeters;

    for (const b of buildings) {
      const d = haversineMeters(point[0], point[1], b.center[0], b.center[1]);
      if (d < minDist) {
        minDist = d;
        nearest = { type: 'building', item: b, dist: d };
      }
    }

    for (const cp of customs) {
      const d = haversineMeters(point[0], point[1], cp.lngLat[0], cp.lngLat[1]);
      if (d < minDist) {
        minDist = d;
        nearest = { type: 'custom', item: cp, dist: d };
      }
    }

    return nearest;
  };

  // Helper to start live navigation directly to a stop
  const handleNavigateToStop = (targetStop: Stop, stopIndex: number) => {
    if (!graphData) return;
    const placeInfo = getPlaceOrBuilding(targetStop.placeId, graphData, customPlaces);
    if (!placeInfo) return;

    let destCoords: [number, number] = placeInfo.center;
    let destAccessPoints: [number, number][] = [destCoords];

    const b = graphData.buildings.find(item => item.id === targetStop.placeId);
    if (b && b.accessNodeIds && b.accessNodeIds.length > 0) {
      destAccessPoints = b.accessNodeIds
        .map(nid => {
          const n = graphData.nodes[nid];
          return n ? ([n.lng, n.lat] as [number, number]) : null;
        })
        .filter((c): c is [number, number] => c !== null);
      if (destAccessPoints.length === 0) destAccessPoints = [destCoords];
    }

    const dayStops = stops
      .filter(s => s.days.includes(selectedDay))
      .sort((a, b) => a.start.localeCompare(b.start));

    let originTarget;
    if (userLocation) {
      originTarget = { type: 'coord' as const, lngLat: userLocation.lngLat, label: 'My Location' };
    } else if (stopIndex > 0) {
      const prevStop = dayStops[stopIndex - 1];
      originTarget = getTargetFromId(prevStop.placeId, graphData, customPlaces);
    } else {
      originTarget = { type: 'coord' as const, lngLat: [-73.8166, 40.7365] as [number, number], label: 'Campus' };
    }

    const destTarget = getTargetFromId(targetStop.placeId, graphData, customPlaces);
    if (!originTarget || !destTarget) return;

    const route = calculateRoute(originTarget, destTarget, {
      campusGraph: graphData,
      accessible: settings.accessible,
      speedMps: settings.speedMps,
    });

    if (route.found && route.coordinates.length > 0) {
      const nextStop = dayStops[stopIndex + 1];
      startNavigation({
        destinationId: targetStop.placeId,
        destinationName: targetStop.title + (placeInfo.name ? ` (${placeInfo.name})` : ''),
        destinationCoords: destCoords,
        destinationAccessPoints: destAccessPoints,
        routeCoords: route.coordinates,
        stopId: targetStop.id,
        nextStopId: nextStop?.id,
        targetArrivalTime: targetStop.start,
      });
    }
  };

  // Helper to show rich Stop Card popup on the 3D map
  const showStopPopup = (stop: Stop, stopIndex: number, lngLat: [number, number]) => {
    const map = mapRef.current;
    if (!map || !graphData) return;

    const placeInfo = getPlaceOrBuilding(stop.placeId, graphData, customPlaces);
    const color = LEG_COLORS[stopIndex % LEG_COLORS.length];

    if (popupRef.current) popupRef.current.remove();

    const popupNode = document.createElement('div');
    popupNode.className = 'p-3.5 bg-neutral-900/95 text-neutral-100 rounded-2xl shadow-2xl border border-neutral-700 min-w-[270px] max-w-[320px] backdrop-blur-md';
    popupNode.innerHTML = `
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="flex items-center gap-2">
          <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0" style="background-color: ${color}">
            ${stopIndex + 1}
          </span>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-neutral-800 text-sky-400 border border-neutral-700">
            ${stop.type}
          </span>
        </div>
        <button id="btn-close-popup" class="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-800 transition-colors">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <h4 class="font-extrabold text-sm text-white leading-tight mb-1">${stop.title}</h4>
      <div class="text-xs text-neutral-300 flex items-center gap-1.5 mb-1">
        <span>📍 ${placeInfo?.name || 'Campus Location'}</span>
        ${stop.room ? `<span class="text-neutral-500">•</span><span class="text-sky-300 font-medium">Room ${stop.room}</span>` : ''}
      </div>
      <div class="text-xs text-neutral-400 font-mono mb-2 flex items-center gap-1.5">
        <span>🕒 ${stop.start} - ${stop.end}</span>
      </div>
      ${stop.notes ? `<p class="text-[11px] text-neutral-400 italic mb-2.5 bg-neutral-950/60 p-2 rounded-lg border border-neutral-800/80 leading-relaxed">${stop.notes}</p>` : ''}

      <div class="p-2 mb-3 rounded-xl bg-sky-950/40 border border-sky-800/50 text-[11px] text-sky-200 flex items-center gap-2">
        <span class="text-sm">🖐️</span>
        <span class="leading-tight"><strong>Drag marker</strong> anywhere on 3D map to snap to another building!</span>
      </div>

      <!-- Action buttons -->
      <div class="grid grid-cols-2 gap-1.5 text-xs font-semibold">
        <button id="btn-edit-stop" class="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors cursor-pointer">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          <span>Edit Details</span>
        </button>

        <button id="btn-nav-stop" class="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white transition-colors cursor-pointer">
          <svg class="w-3.5 h-3.5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          <span>Navigate</span>
        </button>

        <div class="col-span-2 flex items-center justify-between pt-2 border-t border-neutral-800 text-[11px]">
          <span class="text-neutral-400">Reassign location:</span>
          <select id="select-change-building" class="bg-neutral-800 text-neutral-200 border border-neutral-700 rounded px-2 py-0.5 text-[11px] max-w-[155px] truncate cursor-pointer">
            <option value="">Move to building...</option>
            ${graphData.buildings
              .filter(b => b.name && b.name.trim().length > 0)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(b => `<option value="${b.id}" ${b.id === stop.placeId ? 'selected' : ''}>${b.name.replace(/\s*\([A-Z0-9]+\)/, '')}</option>`)
              .join('')}
          </select>
        </div>

        <button id="btn-delete-stop" class="col-span-2 flex items-center justify-center gap-1 py-1 text-neutral-500 hover:text-rose-400 transition-colors text-[11px] mt-1 cursor-pointer">
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          <span>Delete this stop</span>
        </button>
      </div>
    `;

    popupNode.querySelector('#btn-close-popup')?.addEventListener('click', () => {
      popupRef.current?.remove();
    });

    popupNode.querySelector('#btn-edit-stop')?.addEventListener('click', () => {
      popupRef.current?.remove();
      if (onEditStop) {
        onEditStop(stop);
      }
    });

    popupNode.querySelector('#btn-nav-stop')?.addEventListener('click', () => {
      popupRef.current?.remove();
      handleNavigateToStop(stop, stopIndex);
    });

    popupNode.querySelector('#select-change-building')?.addEventListener('change', (e) => {
      const newBId = (e.target as HTMLSelectElement).value;
      if (newBId && newBId !== stop.placeId) {
        updateStop(stop.id, { placeId: newBId });
        const b = graphData.buildings.find(item => item.id === newBId);
        setToastMessage(`✓ Moved "${stop.title}" to ${b?.name || 'new building'}`);
        popupRef.current?.remove();
      }
    });

    popupNode.querySelector('#btn-delete-stop')?.addEventListener('click', () => {
      if (window.confirm(`Delete "${stop.title}" from schedule?`)) {
        deleteStop(stop.id);
        popupRef.current?.remove();
        setToastMessage(`Deleted "${stop.title}"`);
      }
    });

    const popup = new maplibregl.Popup({
      offset: 14,
      closeButton: false,
      maxWidth: '340px',
      className: 'qc-map-popup',
    })
      .setLngLat(lngLat)
      .setDOMContent(popupNode)
      .addTo(map);

    popupRef.current = popup;
  };

  // Sync user location marker and accuracy circle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // 1. Update accuracy circle
    const accuracySource = map.getSource('user-accuracy-source') as maplibregl.GeoJSONSource;
    if (accuracySource) {
      if (userLocation && userLocation.accuracyMeters > 0) {
        const accuracyCircle = createAccuracyCircleGeoJson(
          userLocation.lngLat,
          userLocation.accuracyMeters
        );
        accuracySource.setData(accuracyCircle as any);
      } else {
        accuracySource.setData({ type: 'FeatureCollection', features: [] });
      }
    }

    // 2. Update user marker
    if (!userLocation) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      return;
    }

    if (!userMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'user-location-marker-container pointer-events-none';
      el.innerHTML = `
        <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
          <!-- Pulse animation ring -->
          <div class="absolute w-8 h-8 rounded-full bg-sky-400/30 animate-ping"></div>
          <!-- Heading direction arrow -->
          <div id="user-heading-arrow" class="absolute -top-3 w-4 h-4 flex items-center justify-center transition-transform duration-300" style="display: none; transform-origin: center 18px;">
            <svg class="w-3.5 h-3.5 text-sky-400 drop-shadow" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="12 2 22 22 12 17 2 22 12 2"></polygon>
            </svg>
          </div>
          <!-- Center dot -->
          <div class="relative w-4 h-4 rounded-full bg-sky-500 border-2 border-white shadow-xl ring-2 ring-sky-400/50"></div>
        </div>
      `;

      userMarkerRef.current = new maplibregl.Marker({
        element: el,
      })
        .setLngLat(userLocation.lngLat)
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat(userLocation.lngLat);
    }

    // Update heading orientation if available
    const markerEl = userMarkerRef.current.getElement();
    const headingEl = markerEl.querySelector('#user-heading-arrow') as HTMLElement | null;
    if (headingEl) {
      if (typeof userLocation.heading === 'number' && !isNaN(userLocation.heading)) {
        headingEl.style.display = 'flex';
        headingEl.style.transform = `rotate(${userLocation.heading}deg)`;
      } else {
        headingEl.style.display = 'none';
      }
    }

    // Center/fly map on initial locate
    if (isLocateActive && !hasFlownToUserRef.current) {
      hasFlownToUserRef.current = true;
      if (!isOffCampus(userLocation.lngLat, QC_CAMPUS_BOUNDS, 300)) {
        map.flyTo({ center: userLocation.lngLat, zoom: 17, duration: 800 });
      }
    }
  }, [userLocation, mapLoaded, isLocateActive]);

  // Compute and draw routes & markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !graphData) return;

    // Remove existing stop/pin markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const routeFeatures: any[] = [];
    const snapFeatures: any[] = [];

    // 0. Draw Active Live Navigation Mode (Highest Priority)
    if (navigationState?.isActive) {
      // Dimmed walked coordinates
      if (navigationState.walkedCoordinates.length > 1) {
        routeFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: navigationState.walkedCoordinates,
          },
          properties: {
            color: '#64748b',
            width: 3.5,
            glowColor: '#475569',
            glowWidth: 6.0,
          },
        });
      }

      // Bright accent remaining coordinates
      if (navigationState.remainingCoordinates.length > 1) {
        routeFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: navigationState.remainingCoordinates,
          },
          properties: {
            color: '#38bdf8',
            width: 6.0,
            glowColor: '#0284c7',
            glowWidth: 12.0,
          },
        });

        // Dashed connector from user's current location to the path
        if (userLocation) {
          snapFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [userLocation.lngLat, navigationState.remainingCoordinates[0]],
            },
          });
        }
      }

      // Destination Marker
      const destEl = document.createElement('div');
      destEl.className = 'cursor-pointer flex flex-col items-center group';
      destEl.innerHTML = `
        <div class="px-2.5 py-1 rounded-lg bg-sky-600 border border-sky-300 text-white font-bold text-xs shadow-xl flex items-center gap-1.5 animate-bounce">
          <span>🏁</span>
          <span>${navigationState.destinationName}</span>
        </div>
        <div class="w-2 h-2 rotate-45 -mt-1 bg-sky-600 border-r border-b border-sky-300"></div>
      `;
      const destMarker = new maplibregl.Marker({ element: destEl, anchor: 'bottom' })
        .setLngLat(navigationState.destinationCoords)
        .addTo(map);
      markersRef.current.push(destMarker);
    }

    // 1. Draw custom pins and snap connectors
    customPlaces.forEach(place => {
      const snap = snapToNearestNode(place.lngLat, graphData.nodes, 80);

      if (snap.snapped && snap.coordinates) {
        snapFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [place.lngLat, snap.coordinates],
          },
        });
      }

      // Marker element
      const pinEl = document.createElement('div');
      pinEl.className = 'cursor-pointer group flex flex-col items-center';
      pinEl.innerHTML = `
        <div class="px-2 py-1 bg-purple-600 border border-purple-400 text-white text-xs font-bold rounded-lg shadow-lg flex items-center gap-1 group-hover:scale-110 transition-transform">
          <span>${place.emoji || '📍'}</span>
          <span>${place.name}</span>
        </div>
        <div class="w-1.5 h-1.5 bg-purple-500 rounded-full mt-0.5"></div>
      `;

      pinEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onAddStopWithPlace) {
          onAddStopWithPlace(place.id);
        }
      });

      const marker = new maplibregl.Marker({
        element: pinEl,
        anchor: 'bottom',
      })
        .setLngLat(place.lngLat)
        .addTo(map);

      markersRef.current.push(marker);
    });

    // 2. Draw Schedule Route & Stop Markers (When in planner mode or default, unless active navigation is running)
    if (!navigationState?.isActive && (activeTab === 'planner' || activeTab === 'places' || !activeTab)) {
      const dayStops = stops
        .filter(s => s.days.includes(selectedDay))
        .sort((a, b) => a.start.localeCompare(b.start));

      // Stop markers
      dayStops.forEach((stop, idx) => {
        const placeInfo = getPlaceOrBuilding(stop.placeId, graphData, customPlaces);
        if (!placeInfo) return;

        const isSelected = selectedStopId === stop.id;
        const color = LEG_COLORS[idx % LEG_COLORS.length];

        const markerEl = document.createElement('div');
        markerEl.className = 'cursor-grab active:cursor-grabbing flex flex-col items-center group select-none transition-transform duration-150';
        markerEl.title = 'Drag to move stop location • Click to edit details';
        markerEl.innerHTML = `
          <div class="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border shadow-2xl transition-all duration-200 group-hover:scale-105 group-hover:border-sky-400 ${
            isSelected
              ? 'bg-neutral-900 border-sky-400 text-sky-300 ring-2 ring-sky-400/80 scale-110 shadow-sky-500/30'
              : 'bg-neutral-900/95 border-neutral-700 text-neutral-100 hover:border-neutral-500'
          }">
            <span class="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-xs" style="background-color: ${color}">
              ${idx + 1}
            </span>
            <div class="flex flex-col text-left min-w-0">
              <span class="text-xs font-bold leading-none truncate max-w-[110px] sm:max-w-[140px]">${stop.title}</span>
              <span class="text-[9px] text-neutral-400 leading-none mt-0.5 font-mono">${stop.start} • ${placeInfo.name.replace(/\s*\([A-Z0-9]+\)/, '')}</span>
            </div>
            <!-- Move handle grip -->
            <div class="text-neutral-500 group-hover:text-amber-400 transition-colors ml-0.5" title="Drag to move this stop">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
              </svg>
            </div>
          </div>
          <div class="w-2 h-2 rotate-45 -mt-1 border-r border-b" style="background-color: #171717; border-color: ${isSelected ? '#38bdf8' : '#404040'}"></div>
        `;

        const marker = new maplibregl.Marker({
          element: markerEl,
          anchor: 'bottom',
          draggable: true,
        })
          .setLngLat(placeInfo.center)
          .addTo(map);

        let wasDragged = false;

        marker.on('dragstart', () => {
          wasDragged = true;
          if (popupRef.current) popupRef.current.remove();
          markerEl.classList.add('scale-125', 'ring-4', 'ring-amber-400', 'shadow-2xl', 'z-50');
          setDragState({
            isDragging: true,
            stopTitle: stop.title,
            targetName: placeInfo.name,
            targetBuildingId: undefined,
          });
        });

        marker.on('drag', () => {
          const currentLngLat = marker.getLngLat();
          const nearest = findNearestBuildingOrPlace(
            [currentLngLat.lng, currentLngLat.lat],
            graphData.buildings,
            customPlaces,
            85
          );

          if (nearest) {
            setDragState({
              isDragging: true,
              stopTitle: stop.title,
              targetName: nearest.item.name,
              targetBuildingId: nearest.type === 'building' ? nearest.item.id : undefined,
            });
          } else {
            setDragState({
              isDragging: true,
              stopTitle: stop.title,
              targetName: 'Custom Campus Spot',
              targetBuildingId: undefined,
            });
          }
        });

        marker.on('dragend', () => {
          markerEl.classList.remove('scale-125', 'ring-4', 'ring-amber-400', 'shadow-2xl', 'z-50');
          const dropLngLat = marker.getLngLat();
          const nearest = findNearestBuildingOrPlace(
            [dropLngLat.lng, dropLngLat.lat],
            graphData.buildings,
            customPlaces,
            85
          );

          if (nearest) {
            updateStop(stop.id, { placeId: nearest.item.id });
            setToastMessage(`✓ Moved "${stop.title}" to ${nearest.item.name}`);
          } else {
            const newCustomId = addCustomPlace({
              name: `${stop.title} (Campus Spot)`,
              category: stop.type,
              lngLat: [dropLngLat.lng, dropLngLat.lat],
              emoji: stop.type === 'food' ? '☕' : stop.type === 'study' ? '📚' : stop.type === 'hangout' ? '🌳' : '📍',
              notes: `Moved on map from ${placeInfo.name}`,
            });
            updateStop(stop.id, { placeId: newCustomId });
            setToastMessage(`✓ Moved "${stop.title}" to custom campus spot`);
          }

          setDragState(null);
          setTimeout(() => { wasDragged = false; }, 100);
        });

        markerEl.addEventListener('click', (e) => {
          e.stopPropagation();
          if (wasDragged) return;
          setSelectedStopId(stop.id);
          showStopPopup(stop, idx, placeInfo.center);
        });

        markersRef.current.push(marker);
      });

      // Sequential walking routes between stops
      for (let i = 0; i < dayStops.length - 1; i++) {
        const fromStop = dayStops[i];
        const toStop = dayStops[i + 1];

        if (fromStop.placeId === toStop.placeId) continue; // Same building

        const originTarget = getTargetFromId(fromStop.placeId, graphData, customPlaces);
        const destTarget = getTargetFromId(toStop.placeId, graphData, customPlaces);
        if (!originTarget || !destTarget) continue;

        const route = calculateRoute(originTarget, destTarget, {
          campusGraph: graphData,
          accessible: settings.accessible,
          speedMps: settings.speedMps,
        });

        if (route.found && route.coordinates.length > 0) {
          const isSelectedLeg = selectedLegIndex === i;
          const legColor = LEG_COLORS[i % LEG_COLORS.length];

          routeFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: route.coordinates,
            },
            properties: {
              color: isSelectedLeg ? '#38bdf8' : legColor,
              width: isSelectedLeg ? 5.5 : 3.5,
              glowColor: isSelectedLeg ? '#0284c7' : legColor,
              glowWidth: isSelectedLeg ? 10.0 : 6.0,
              legIndex: i,
            },
          });
        }
      }
    }

    // 3. Draw Point-to-Point Directions Route (When in directions mode and not navigating)
    if (!navigationState?.isActive && activeTab === 'directions' && directionsOrigin && directionsDestination) {
      const origTarget = getTargetFromId(directionsOrigin, graphData, customPlaces);
      const destTarget = getTargetFromId(directionsDestination, graphData, customPlaces);

      if (origTarget && destTarget) {
        const route = calculateRoute(origTarget, destTarget, {
          campusGraph: graphData,
          accessible: settings.accessible,
          speedMps: settings.speedMps,
        });

        if (route.found && route.coordinates.length > 0) {
          routeFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: route.coordinates,
            },
            properties: {
              color: '#38bdf8',
              width: 5.0,
              glowColor: '#0284c7',
              glowWidth: 9.0,
            },
          });

          // Origin marker
          const origInfo = getPlaceOrBuilding(directionsOrigin, graphData, customPlaces);
          if (origInfo) {
            const el = document.createElement('div');
            el.className = 'px-2 py-1 rounded bg-emerald-600 text-white font-bold text-xs shadow-md border border-emerald-400';
            el.innerText = 'Start';
            const m = new maplibregl.Marker({ element: el, anchor: 'bottom' })
              .setLngLat(origInfo.center)
              .addTo(map);
            markersRef.current.push(m);
          }

          // If origin is user location, draw dashed snap line to the path start
          if (directionsOrigin === 'my-location' && userLocation) {
            snapFeatures.push({
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [userLocation.lngLat, route.coordinates[0]],
              },
            });
          }

          // Destination marker
          const destInfo = getPlaceOrBuilding(directionsDestination, graphData, customPlaces);
          if (destInfo) {
            const el = document.createElement('div');
            el.className = 'px-2 py-1 rounded bg-rose-600 text-white font-bold text-xs shadow-md border border-rose-400';
            el.innerText = 'End';
            const m = new maplibregl.Marker({ element: el, anchor: 'bottom' })
              .setLngLat(destInfo.center)
              .addTo(map);
            markersRef.current.push(m);
          }

          // Fit bounds to the route without flattening 3D perspective
          const bounds = new maplibregl.LngLatBounds();
          route.coordinates.forEach(c => bounds.extend(c));
          map.fitBounds(bounds, {
            padding: 80,
            duration: 600,
            pitch: map.getPitch(),
            bearing: map.getBearing(),
          });
        }
      }
    }

    // Update routes source
    const routeSource = map.getSource('routes-data') as maplibregl.GeoJSONSource;
    if (routeSource) {
      routeSource.setData({
        type: 'FeatureCollection',
        features: routeFeatures,
      });
    }

    // Update snap source
    const snapSource = map.getSource('snap-lines') as maplibregl.GeoJSONSource;
    if (snapSource) {
      snapSource.setData({
        type: 'FeatureCollection',
        features: snapFeatures,
      });
    }
  }, [
    mapLoaded,
    graphData,
    customPlaces,
    stops,
    selectedDay,
    activeTab,
    selectedStopId,
    selectedLegIndex,
    directionsOrigin,
    directionsDestination,
    settings.accessible,
    settings.speedMps,
    navigationState,
    userLocation,
  ]);

  // Focus zoom when selectedLegIndex changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || selectedLegIndex === null || !graphData) return;

    const dayStops = stops
      .filter(s => s.days.includes(selectedDay))
      .sort((a, b) => a.start.localeCompare(b.start));

    const fromStop = dayStops[selectedLegIndex];
    const toStop = dayStops[selectedLegIndex + 1];
    if (!fromStop || !toStop) return;

    const originTarget = getTargetFromId(fromStop.placeId, graphData, customPlaces);
    const destTarget = getTargetFromId(toStop.placeId, graphData, customPlaces);
    if (!originTarget || !destTarget) return;

    const route = calculateRoute(originTarget, destTarget, {
      campusGraph: graphData,
      accessible: settings.accessible,
      speedMps: settings.speedMps,
    });

    if (route.found && route.coordinates.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      route.coordinates.forEach(c => bounds.extend(c));
      map.fitBounds(bounds, {
        padding: 90,
        duration: 600,
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      });
    }
  }, [selectedLegIndex]);

  // Helper resolvers
  function getPlaceOrBuilding(
    id: string,
    graph: typeof graphData,
    customs: Place[]
  ): { name: string; center: [number, number] } | null {
    if (id === 'my-location') {
      return {
        name: 'My Location',
        center: userLocation ? userLocation.lngLat : [-73.8166, 40.7365],
      };
    }
    const cp = customs.find(c => c.id === id);
    if (cp) return { name: cp.name, center: cp.lngLat };
    const b = graph?.buildings.find(item => item.id === id);
    if (b) return { name: b.name, center: b.center };
    return null;
  }

  function getTargetFromId(
    id: string,
    graph: typeof graphData,
    customs: Place[]
  ): any | null {
    if (id === 'my-location' && userLocation) {
      return { type: 'coord', lngLat: userLocation.lngLat, label: 'My Location' };
    }
    const cp = customs.find(c => c.id === id);
    if (cp) return { type: 'coord', lngLat: cp.lngLat, label: cp.name };
    const b = graph?.buildings.find(item => item.id === id);
    if (b) return { type: 'building', buildingId: b.id };
    return null;
  }

  return (
    <div className="relative w-full h-full bg-neutral-950 overflow-hidden select-none">
      {/* Map Container */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Pin Drop Notice Banner when active */}
      {isDroppingPin && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-purple-600/95 text-white px-4 py-2 rounded-full shadow-2xl border border-purple-300/40 text-xs font-medium flex items-center gap-2 backdrop-blur-md animate-bounce">
          <span>📍 Click anywhere on campus to drop your custom place</span>
          <button
            onClick={() => setIsDroppingPin(false)}
            className="ml-2 bg-purple-800/80 hover:bg-purple-900 text-purple-200 px-2 py-0.5 rounded-full text-[11px] transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Active Navigation Floating Top Banner */}
      {navigationState?.isActive && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md bg-neutral-900/95 border border-sky-500/80 rounded-2xl shadow-2xl p-4 text-neutral-100 backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                  Walking Navigation
                </span>
                {navigationState.isOffRoute && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold text-[10px]">
                    Off Route (Rerouting...)
                  </span>
                )}
              </div>
              <h3 className="text-base font-extrabold text-white leading-tight truncate">
                {navigationState.destinationName}
              </h3>

              {navigationState.hasArrived ? (
                <div className="mt-2 p-2 rounded-lg bg-emerald-950/60 border border-emerald-700/80 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>You've arrived at your destination!</span>
                </div>
              ) : (
                <div className="flex items-baseline gap-3 mt-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-sky-400">
                      {Math.round(navigationState.remainingDistanceMeters)}
                    </span>
                    <span className="text-xs text-neutral-400 font-medium">m</span>
                  </div>
                  <span className="text-neutral-500">•</span>
                  <div className="text-xs text-neutral-300 font-medium">
                    ETA: ~{Math.ceil(navigationState.remainingSeconds / 60)} min
                  </div>
                  {navigationState.targetArrivalTime && (
                    <>
                      <span className="text-neutral-500">•</span>
                      <span className="text-xs text-neutral-400 font-mono">
                        Target: {navigationState.targetArrivalTime}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={endNavigation}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors shrink-0"
              title="End Navigation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Banner action controls */}
          <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-neutral-800 text-xs font-semibold">
            {navigationState.hasArrived && navigationState.nextStopId ? (
              <button
                onClick={advanceToNextNavigationStop}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-md transition-colors flex items-center gap-1.5"
              >
                <span>Advance to Next Stop</span>
                <Navigation className="w-3.5 h-3.5" />
              </button>
            ) : null}
            <button
              onClick={endNavigation}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
            >
              End Navigation
            </button>
          </div>
        </div>
      )}

      {/* Simulation Controls Floating Widget */}
      {simulation.isSimulating && (
        <div className="absolute top-4 left-4 z-30 bg-neutral-900/90 border border-purple-500/60 rounded-xl shadow-xl px-3 py-2 text-xs text-neutral-200 backdrop-blur-xs flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
          <span className="font-semibold text-purple-300">Simulation</span>

          {simulation.isPlayingWalk ? (
            <button
              onClick={stopSimulatedWalk}
              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center gap-1 text-[11px] font-medium transition-colors"
              title="Pause simulated walk"
            >
              <Square className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span>Pause</span>
            </button>
          ) : (
            <button
              onClick={playSimulatedWalk}
              className="px-2 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1 text-[11px] font-medium transition-colors"
              title="Play walk along route"
            >
              <Play className="w-3 h-3 fill-white" />
              <span>Play Walk</span>
            </button>
          )}

          <button
            onClick={() => {
              const next = simulation.speedMultiplier === 1 ? 2 : simulation.speedMultiplier === 2 ? 4 : 1;
              setSimulation({ speedMultiplier: next });
            }}
            className="px-1.5 py-0.5 rounded bg-neutral-800 text-[10px] font-mono text-neutral-300 hover:text-white"
            title="Toggle simulation speed"
          >
            {simulation.speedMultiplier}x
          </button>
        </div>
      )}

      {/* Notice Toast Banner for location errors or warnings */}
      {locationErrorMessage && dismissedNotice !== locationErrorMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md bg-neutral-900/95 border border-amber-600/80 rounded-xl shadow-2xl p-3 text-xs text-amber-200 backdrop-blur-md flex items-start gap-2.5 animate-in fade-in duration-200">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            <p>{locationErrorMessage}</p>
            {locationStatus === 'permission_denied' && (
              <p className="mt-1 text-[11px] text-neutral-400">
                To re-enable: click the tune or lock icon in your browser's address bar and allow Location access.
              </p>
            )}
          </div>
          <button
            onClick={() => setDismissedNotice(locationErrorMessage)}
            className="text-neutral-400 hover:text-white p-1 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3D Perspective Badge & Orbit Hint */}
      {is3DMode && (
        <div className="absolute right-4 top-4 z-20 hidden sm:flex items-center gap-2 bg-neutral-900/90 border border-sky-500/30 rounded-full px-3 py-1 text-xs font-medium text-neutral-200 shadow-xl backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
          <span className="font-bold text-sky-300">3D Isometric View</span>
          <span className="text-neutral-500">•</span>
          <span className="text-neutral-400 text-[11px]">Right-click drag to orbit</span>
        </div>
      )}

      {/* Map Control Buttons */}
      <div className="absolute right-4 bottom-8 z-20 flex flex-col gap-2">
        {/* 3D / 2D Perspective Toggle */}
        <button
          onClick={() => {
            const map = mapRef.current;
            if (!map) return;
            if (is3DMode) {
              map.easeTo({ pitch: 0, bearing: 0, duration: 750 });
            } else {
              map.easeTo({ pitch: 52, bearing: -18, duration: 750 });
            }
          }}
          className={`w-9 h-9 rounded-lg border shadow-md flex items-center justify-center transition-all backdrop-blur-xs font-black text-xs ${
            is3DMode
              ? 'bg-sky-600 text-white border-sky-400 ring-2 ring-sky-500/50 shadow-sky-500/30'
              : 'bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 border-neutral-700/80'
          }`}
          title={is3DMode ? 'Switch to 2D Top-Down View' : 'Switch to 3D Isometric View'}
        >
          {is3DMode ? '3D' : '2D'}
        </button>

        {/* Dynamic 3D Compass & North Reset */}
        <button
          onClick={() => {
            const map = mapRef.current;
            if (!map) return;
            map.easeTo({ bearing: 0, duration: 500 });
          }}
          className="w-9 h-9 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 border border-neutral-700/80 shadow-md flex items-center justify-center transition-colors backdrop-blur-xs"
          title={`Compass Bearing: ${compassBearing}° • Click to Reset North`}
        >
          <div
            className="transition-transform duration-150 flex items-center justify-center"
            style={{ transform: `rotate(${-compassBearing}deg)` }}
          >
            <Compass className="w-4 h-4 text-sky-400" />
          </div>
        </button>

        {/* Tilt / Pitch Angle Cycle */}
        <button
          onClick={() => {
            const map = mapRef.current;
            if (!map) return;
            // Cycle angles: 0 -> 45 -> 55 -> 68 -> 0
            const nextPitch = currentPitch < 30 ? 45 : currentPitch < 50 ? 55 : currentPitch < 65 ? 68 : 0;
            const nextBearing = nextPitch === 0 ? 0 : (map.getBearing() || -18);
            map.easeTo({ pitch: nextPitch, bearing: nextBearing, duration: 600 });
          }}
          className="w-9 h-9 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 border border-neutral-700/80 shadow-md flex items-center justify-center transition-colors backdrop-blur-xs text-[10px] font-bold font-mono"
          title={`Pitch: ${currentPitch}° • Tap to cycle 3D angles (0°, 45°, 55°, 68°)`}
        >
          <span>{currentPitch}°</span>
        </button>

        {/* Locate Me (GPS) Button */}
        <button
          onClick={() => {
            if (isLocateActive && userLocation) {
              if (!isOffCampus(userLocation.lngLat, QC_CAMPUS_BOUNDS, 300)) {
                mapRef.current?.flyTo({ center: userLocation.lngLat, zoom: 17, duration: 600 });
              } else {
                setLocationStatus('off_campus', "You're not on campus, so showing campus view.");
              }
            } else {
              hasFlownToUserRef.current = false;
              startWatchingLocation();
            }
          }}
          className={`w-9 h-9 rounded-lg border shadow-md flex items-center justify-center transition-all backdrop-blur-xs ${
            isLocateActive
              ? 'bg-sky-600 text-white border-sky-400 ring-2 ring-sky-500/50 shadow-sky-500/30'
              : locationStatus === 'prompting'
              ? 'bg-neutral-800 text-sky-400 border-sky-600 animate-pulse'
              : 'bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 border-neutral-700/80'
          }`}
          title={
            isLocateActive
              ? 'Location tracking active • Tap to re-center'
              : 'Locate me (GPS) • Stays on your device'
          }
        >
          <Crosshair className="w-4 h-4" />
        </button>

        <button
          onClick={() => {
            const map = mapRef.current;
            if (map) map.zoomIn();
          }}
          className="w-9 h-9 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 border border-neutral-700/80 shadow-md flex items-center justify-center transition-colors backdrop-blur-xs"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            const map = mapRef.current;
            if (map) map.zoomOut();
          }}
          className="w-9 h-9 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 border border-neutral-700/80 shadow-md flex items-center justify-center transition-colors backdrop-blur-xs"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            const map = mapRef.current;
            if (map) {
              map.fitBounds(CAMPUS_BOUNDS, {
                padding: 40,
                duration: 700,
                pitch: is3DMode ? 52 : 0,
                bearing: is3DMode ? -18 : 0,
              });
            }
          }}
          className="w-9 h-9 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 border border-neutral-700/80 shadow-md flex items-center justify-center transition-colors backdrop-blur-xs"
          title="Reset View to Campus"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Visible Attribution Requirement */}
      <div className="absolute left-3 bottom-2 z-10 text-[10px] text-neutral-400 bg-neutral-950/85 px-2.5 py-1 rounded border border-neutral-800/80 backdrop-blur-xs flex items-center gap-1.5 shadow-md">
        <span>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline hover:text-neutral-300">OpenStreetMap contributors</a></span>
        <span>• Unofficial QC Pathfinder</span>
      </div>
    </div>
  );
};
