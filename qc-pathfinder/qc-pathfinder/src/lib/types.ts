import { z } from 'zod';

export type PlaceKind = 'building' | 'custom';
export type PlaceCategory = 'class' | 'food' | 'study' | 'hangout' | 'other';

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  category: PlaceCategory;
  lngLat: [number, number];
  buildingId?: string;
  emoji?: string;
  notes?: string;
}

export interface Stop {
  id: string;
  title: string;
  placeId: string;
  room?: string;
  type: PlaceCategory;
  days: number[]; // 0 = Monday ... 6 = Sunday
  start: string;  // "HH:mm" (24-hour)
  end: string;    // "HH:mm" (24-hour)
  notes?: string;
}

export type WalkingSpeedProfile = 'slow' | 'normal' | 'fast';
export type WalkingSpeed = WalkingSpeedProfile;

export interface UserSettings {
  speed: WalkingSpeedProfile;
  speedMps: number; // default 1.3 m/s (slow: 1.0, normal: 1.3, fast: 1.6)
  bufferMinutes: number; // default 2
  accessible: boolean; // default false
}

export interface RouteResult {
  found: boolean;
  coordinates: Array<[number, number]>;
  distanceMeters: number;
  walkSeconds: number;
  hasStairs: boolean;
  reason?: string;
  legs?: Array<{
    distance: number;
    isStairs: boolean;
  }>;
}

export interface SnapResult {
  snapped: boolean;
  nodeId?: string;
  coordinates?: [number, number];
  distanceMeters?: number;
  error?: string;
}

export type TimelineLegStatus = 'comfortable' | 'tight' | 'impossible' | 'no-route' | 'same-building';

export interface TimelineLeg {
  fromStop: Stop;
  toStop: Stop;
  fromPlace?: Place;
  toPlace?: Place;
  sameBuilding: boolean;
  route?: RouteResult;
  walkMinutes: number;
  gapMinutes: number;
  slackMinutes: number;
  leaveByTime: string;
  status: TimelineLegStatus;
  statusLabel: string;
}

export interface BuildingInfo {
  id: string;
  osmId: number;
  name: string;
  aliases: string[];
  center: [number, number];
  accessNodeIds: string[];
}

export interface GraphNode {
  id: string;
  lng: number;
  lat: number;
  componentId?: number;
}

export interface GraphEdge {
  target: string;
  distance: number;
  isStairs: boolean;
  wheelchairNo: boolean;
  costMultiplier: number;
  cost: number;
}

export interface CampusGraphData {
  nodes: Record<string, GraphNode>;
  adjacency: Record<string, GraphEdge[]>;
  buildings: BuildingInfo[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    componentCount: number;
    largestComponentNodes: number;
    largestComponentEdges: number;
    largestComponentEdgePercent: number;
    landmarksFound: number;
    landmarksTotal: number;
    landmarkResults: Array<{
      name: string;
      found: boolean;
      matchedName?: string;
      id?: string;
    }>;
  };
  attribution: string;
}

// Zod Schemas for local storage validation
export const PlaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['building', 'custom']),
  category: z.enum(['class', 'food', 'study', 'hangout', 'other']),
  lngLat: z.tuple([z.number(), z.number()]),
  buildingId: z.string().optional(),
  emoji: z.string().optional(),
  notes: z.string().optional(),
});

export const StopSchema = z.object({
  id: z.string(),
  title: z.string(),
  placeId: z.string(),
  room: z.string().optional(),
  type: z.enum(['class', 'food', 'study', 'hangout', 'other']),
  days: z.array(z.number().min(0).max(6)),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().optional(),
});

export const UserSettingsSchema = z.object({
  speed: z.enum(['slow', 'normal', 'fast']),
  speedMps: z.number().positive(),
  bufferMinutes: z.number().nonnegative(),
  accessible: z.boolean(),
});

export const SavedAppDataSchema = z.object({
  version: z.literal(1),
  customPlaces: z.array(PlaceSchema),
  favorites: z.array(z.string()),
  stops: z.array(StopSchema),
  settings: UserSettingsSchema,
});

export type SavedAppData = z.infer<typeof SavedAppDataSchema>;

// Geolocation & Live Navigation Types
export interface UserLocation {
  lngLat: [number, number];
  accuracyMeters: number;
  heading: number | null; // degrees (0-360) or null
  speed: number | null; // m/s or null
  timestamp: number;
  isSimulated?: boolean;
}

export type GeolocationStatus =
  | 'idle'
  | 'prompting'
  | 'watching'
  | 'off_campus'
  | 'weak_signal'
  | 'permission_denied'
  | 'position_unavailable'
  | 'timeout'
  | 'insecure_context'
  | 'error';

export interface ActiveNavigationState {
  isActive: boolean;
  destinationId: string;
  destinationName: string;
  destinationCoords: [number, number];
  destinationAccessPoints: Array<[number, number]>;
  stopId?: string;
  nextStopId?: string;
  targetArrivalTime?: string; // "HH:mm"
  remainingDistanceMeters: number;
  remainingSeconds: number;
  hasArrived: boolean;
  isOffRoute: boolean;
  lastRerouteTimestamp: number;
  routeCoordinates: Array<[number, number]>;
  walkedCoordinates: Array<[number, number]>;
  remainingCoordinates: Array<[number, number]>;
}

export interface SimulationConfig {
  isSimulating: boolean;
  isPlayingWalk: boolean;
  speedMultiplier: number; // 1, 2, 4
  simulatedBuildingId?: string;
  mockCoords?: [number, number];
  mockAccuracy?: number;
  mockHeading?: number;
}
