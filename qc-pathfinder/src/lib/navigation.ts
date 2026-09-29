import { haversineMeters } from './geo';

export interface CampusBounds {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

// Default Queens College Campus Bounds
export const QC_CAMPUS_BOUNDS: [[number, number], [number, number]] = [
  [-73.8260, 40.7305], // South-West [lng, lat]
  [-73.8110, 40.7425], // North-East [lng, lat]
];

/**
 * Checks if a position is more than thresholdMeters (default 300m) outside the campus bounds.
 */
export function isOffCampus(
  coords: [number, number],
  bounds: [[number, number], [number, number]] = QC_CAMPUS_BOUNDS,
  thresholdMeters: number = 300
): boolean {
  const [lng, lat] = coords;
  const [[minLng, minLat], [maxLng, maxLat]] = bounds;

  // If inside the bounding box, not off-campus
  if (lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat) {
    return false;
  }

  // Find the closest point on the bounding box to the given coordinates
  const clampedLng = Math.max(minLng, Math.min(maxLng, lng));
  const clampedLat = Math.max(minLat, Math.min(maxLat, lat));

  // Compute distance from coordinates to clamped boundary point
  const distanceToCampus = haversineMeters(lng, lat, clampedLng, clampedLat);
  return distanceToCampus > thresholdMeters;
}

/**
 * Evaluates GPS accuracy reading.
 * Readings with accuracy worse than 100m are considered weak and ignored for navigation.
 */
export function filterAccuracy(
  accuracyMeters: number,
  maxAllowedAccuracy: number = 100
): { validForNav: boolean; weakSignal: boolean } {
  if (isNaN(accuracyMeters) || accuracyMeters < 0) {
    return { validForNav: false, weakSignal: true };
  }
  const weakSignal = accuracyMeters > maxAllowedAccuracy;
  return {
    validForNav: !weakSignal,
    weakSignal,
  };
}

/**
 * Calculate perpendicular distance and projection of a point onto a line segment.
 * Coordinates are in [lng, lat].
 */
export function projectPointOnSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): { distanceMeters: number; projectedPoint: [number, number]; t: number } {
  // Convert spherical coords to local metric plane around 'a'
  const latMid = ((a[1] + b[1] + p[1]) / 3) * (Math.PI / 180);
  const metersPerDegLat = 111139;
  const metersPerDegLng = 111139 * Math.cos(latMid);

  const px = (p[0] - a[0]) * metersPerDegLng;
  const py = (p[1] - a[1]) * metersPerDegLat;
  const bx = (b[0] - a[0]) * metersPerDegLng;
  const by = (b[1] - a[1]) * metersPerDegLat;

  const segLengthSq = bx * bx + by * by;
  if (segLengthSq === 0) {
    return {
      distanceMeters: haversineMeters(p[0], p[1], a[0], a[1]),
      projectedPoint: a,
      t: 0,
    };
  }

  // Projection factor t clamped to [0, 1]
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / segLengthSq));

  const projLng = a[0] + t * (b[0] - a[0]);
  const projLat = a[1] + t * (b[1] - a[1]);

  return {
    distanceMeters: haversineMeters(p[0], p[1], projLng, projLat),
    projectedPoint: [projLng, projLat],
    t,
  };
}

/**
 * Calculates the shortest distance from a point to a polyline path.
 */
export function distanceToPolyline(
  point: [number, number],
  polyline: Array<[number, number]>
): {
  minDistanceMeters: number;
  segmentIndex: number;
  projectedPoint: [number, number];
} {
  if (polyline.length === 0) {
    return {
      minDistanceMeters: Infinity,
      segmentIndex: -1,
      projectedPoint: point,
    };
  }

  if (polyline.length === 1) {
    return {
      minDistanceMeters: haversineMeters(point[0], point[1], polyline[0][0], polyline[0][1]),
      segmentIndex: 0,
      projectedPoint: polyline[0],
    };
  }

  let minDistanceMeters = Infinity;
  let bestSegmentIndex = 0;
  let bestProjectedPoint = polyline[0];

  for (let i = 0; i < polyline.length - 1; i++) {
    const proj = projectPointOnSegment(point, polyline[i], polyline[i + 1]);
    if (proj.distanceMeters < minDistanceMeters) {
      minDistanceMeters = proj.distanceMeters;
      bestSegmentIndex = i;
      bestProjectedPoint = proj.projectedPoint;
    }
  }

  return {
    minDistanceMeters,
    segmentIndex: bestSegmentIndex,
    projectedPoint: bestProjectedPoint,
  };
}

/**
 * Checks if the user has drifted more than thresholdMeters (default 30m) off the route path.
 */
export function isOffRoute(
  point: [number, number],
  routeCoordinates: Array<[number, number]>,
  thresholdMeters: number = 30
): boolean {
  if (routeCoordinates.length < 2) return false;
  const { minDistanceMeters } = distanceToPolyline(point, routeCoordinates);
  return minDistanceMeters > thresholdMeters;
}

/**
 * Checks if user is within arrivalThresholdMeters (default 25m) of any destination access point or centroid.
 */
export function isArrived(
  point: [number, number],
  destinationAccessPoints: Array<[number, number]>,
  arrivalThresholdMeters: number = 25
): boolean {
  if (!destinationAccessPoints || destinationAccessPoints.length === 0) return false;

  for (const target of destinationAccessPoints) {
    const dist = haversineMeters(point[0], point[1], target[0], target[1]);
    if (dist <= arrivalThresholdMeters) {
      return true;
    }
  }

  return false;
}

/**
 * Calculates walked vs remaining coordinates and remaining distance along a polyline.
 */
export function calculateRemainingAlongRoute(
  point: [number, number],
  routeCoordinates: Array<[number, number]>
): {
  remainingDistanceMeters: number;
  walkedDistanceMeters: number;
  remainingCoordinates: Array<[number, number]>;
  walkedCoordinates: Array<[number, number]>;
} {
  if (routeCoordinates.length < 2) {
    return {
      remainingDistanceMeters: 0,
      walkedDistanceMeters: 0,
      remainingCoordinates: [...routeCoordinates],
      walkedCoordinates: [],
    };
  }

  const { segmentIndex, projectedPoint } = distanceToPolyline(point, routeCoordinates);

  // Walked coordinates: polyline from 0 to segmentIndex, plus the projected point
  const walkedCoordinates: Array<[number, number]> = [];
  for (let i = 0; i <= segmentIndex; i++) {
    walkedCoordinates.push(routeCoordinates[i]);
  }
  walkedCoordinates.push(projectedPoint);

  // Remaining coordinates: projected point followed by remaining vertices
  const remainingCoordinates: Array<[number, number]> = [projectedPoint];
  for (let i = segmentIndex + 1; i < routeCoordinates.length; i++) {
    remainingCoordinates.push(routeCoordinates[i]);
  }

  // Calculate sum of distances for walked and remaining
  let walkedDistanceMeters = 0;
  for (let i = 0; i < walkedCoordinates.length - 1; i++) {
    walkedDistanceMeters += haversineMeters(
      walkedCoordinates[i][0],
      walkedCoordinates[i][1],
      walkedCoordinates[i + 1][0],
      walkedCoordinates[i + 1][1]
    );
  }

  let remainingDistanceMeters = 0;
  for (let i = 0; i < remainingCoordinates.length - 1; i++) {
    remainingDistanceMeters += haversineMeters(
      remainingCoordinates[i][0],
      remainingCoordinates[i][1],
      remainingCoordinates[i + 1][0],
      remainingCoordinates[i + 1][1]
    );
  }

  return {
    remainingDistanceMeters,
    walkedDistanceMeters,
    remainingCoordinates,
    walkedCoordinates,
  };
}

export interface AccuracyCircleFeature {
  type: 'Feature';
  properties: { radiusMeters: number };
  geometry: {
    type: 'Polygon';
    coordinates: Array<Array<[number, number]>>;
  };
}

/**
 * Creates a circular GeoJSON Polygon to represent GPS accuracy bounds on the map.
 */
export function createAccuracyCircleGeoJson(
  center: [number, number],
  radiusMeters: number,
  points: number = 48
): AccuracyCircleFeature {
  const [lng, lat] = center;
  const coords: Array<[number, number]> = [];
  const km = radiusMeters / 1000;
  const distanceLat = (km / 111.139);
  const distanceLng = (km / (111.139 * Math.cos((lat * Math.PI) / 180)));

  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const pLng = lng + distanceLng * Math.cos(theta);
    const pLat = lat + distanceLat * Math.sin(theta);
    coords.push([pLng, pLat]);
  }

  return {
    type: 'Feature',
    properties: { radiusMeters },
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
  };
}
