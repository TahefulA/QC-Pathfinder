import { GraphNode, SnapResult } from './types';

export const MAX_SNAP_DISTANCE_METERS = 80;

/**
 * Calculates Great-Circle distance between two coordinates using the Haversine formula.
 */
export function haversineMeters(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Snaps a given coordinate to the nearest graph node.
 * If distance exceeds maxDistanceMeters (default 80m), snapping fails with a clear message.
 */
export function snapToNearestNode(
  point: [number, number],
  nodes: Record<string, GraphNode> | GraphNode[],
  maxDistanceMeters: number = MAX_SNAP_DISTANCE_METERS,
  targetComponentId?: number
): SnapResult {
  const nodeList = Array.isArray(nodes) ? nodes : Object.values(nodes);

  if (nodeList.length === 0) {
    return {
      snapped: false,
      error: 'Routing graph has no walkable nodes.',
    };
  }

  let nearestNode: GraphNode | null = null;
  let minDistance = Infinity;

  for (const node of nodeList) {
    if (targetComponentId !== undefined && node.componentId !== undefined && node.componentId !== targetComponentId) {
      continue;
    }

    const dist = haversineMeters(point[0], point[1], node.lng, node.lat);
    if (dist < minDistance) {
      minDistance = dist;
      nearestNode = node;
    }
  }

  if (!nearestNode || minDistance > maxDistanceMeters) {
    const distText = minDistance !== Infinity ? `${Math.round(minDistance)}m` : 'no nodes found';
    return {
      snapped: false,
      distanceMeters: minDistance !== Infinity ? minDistance : undefined,
      error: `Location is too far from any campus walkway (${distText}). Walkway snap limit is ${maxDistanceMeters}m. Please place your pin closer to a campus path.`,
    };
  }

  return {
    snapped: true,
    nodeId: nearestNode.id,
    coordinates: [nearestNode.lng, nearestNode.lat],
    distanceMeters: minDistance,
  };
}
