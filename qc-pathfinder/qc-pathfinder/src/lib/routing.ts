import { haversineMeters, snapToNearestNode } from './geo';
import {
  BuildingInfo,
  CampusGraphData,
  GraphEdge,
  GraphNode,
  RouteResult,
} from './types';

export interface RouteOptions {
  accessible?: boolean;
  speedMps?: number; // default 1.3 m/s
  campusGraph: CampusGraphData;
}

export type RouteTarget =
  | { type: 'building'; buildingId: string }
  | { type: 'node'; nodeId: string }
  | { type: 'coord'; lngLat: [number, number]; label?: string };

// Priority Queue implementation for A*
class PriorityQueue<T> {
  private items: Array<{ element: T; priority: number }> = [];

  enqueue(element: T, priority: number) {
    let added = false;
    // Simple binary insertion for fast sorting
    let low = 0;
    let high = this.items.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (this.items[mid].priority > priority) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }
    this.items.splice(low, 0, { element, priority });
  }

  dequeue(): T | undefined {
    return this.items.shift()?.element;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}

/**
 * Pure A* search function on the Queens College routing graph.
 * Supports virtual multi-origin and multi-destination sets (e.g. multiple building entrances).
 */
export function findShortestPath(
  startNodes: Array<{ id: string; initialDist: number; initialCost: number }>,
  targetNodes: Set<string>,
  targetCoordinates: [number, number],
  graph: {
    nodes: Record<string, GraphNode>;
    adjacency: Record<string, GraphEdge[]>;
  },
  options: {
    accessible: boolean;
    speedMps: number;
  }
): {
  found: boolean;
  nodePath: string[];
  totalDistanceMeters: number;
  totalCost: number;
  hasStairs: boolean;
} {
  const { nodes, adjacency } = graph;
  const { accessible } = options;

  if (startNodes.length === 0 || targetNodes.size === 0) {
    return {
      found: false,
      nodePath: [],
      totalDistanceMeters: 0,
      totalCost: 0,
      hasStairs: false,
    };
  }

  // Quick check if any start node is already a target node
  for (const s of startNodes) {
    if (targetNodes.has(s.id)) {
      return {
        found: true,
        nodePath: [s.id],
        totalDistanceMeters: s.initialDist,
        totalCost: s.initialCost,
        hasStairs: false,
      };
    }
  }

  const gScore = new Map<string, number>();
  const distScore = new Map<string, number>();
  const cameFrom = new Map<string, { prev: string; edge: GraphEdge }>();
  const pq = new PriorityQueue<string>();

  // Heuristic: Haversine distance to target centroid / closest target node
  function heuristic(nodeId: string): number {
    const node = nodes[nodeId];
    if (!node) return 0;
    return haversineMeters(node.lng, node.lat, targetCoordinates[0], targetCoordinates[1]);
  }

  // Initialize all start nodes
  for (const s of startNodes) {
    if (!nodes[s.id]) continue;
    gScore.set(s.id, s.initialCost);
    distScore.set(s.id, s.initialDist);
    const fScore = s.initialCost + heuristic(s.id);
    pq.enqueue(s.id, fScore);
  }

  let bestTargetReached: string | null = null;

  while (!pq.isEmpty()) {
    const current = pq.dequeue()!;

    if (targetNodes.has(current)) {
      bestTargetReached = current;
      break;
    }

    const currentG = gScore.get(current) ?? Infinity;
    const currentDist = distScore.get(current) ?? 0;
    const edges = adjacency[current] || [];

    for (const edge of edges) {
      // Accessible mode filter
      if (accessible && (edge.isStairs || edge.wheelchairNo)) {
        continue;
      }

      const neighborId = edge.target;
      if (!nodes[neighborId]) continue;

      const tentativeG = currentG + edge.cost;
      const prevNeighborG = gScore.get(neighborId);

      if (prevNeighborG === undefined || tentativeG < prevNeighborG) {
        gScore.set(neighborId, tentativeG);
        distScore.set(neighborId, currentDist + edge.distance);
        cameFrom.set(neighborId, { prev: current, edge });
        const f = tentativeG + heuristic(neighborId);
        pq.enqueue(neighborId, f);
      }
    }
  }

  if (!bestTargetReached) {
    return {
      found: false,
      nodePath: [],
      totalDistanceMeters: 0,
      totalCost: 0,
      hasStairs: false,
    };
  }

  // Reconstruct path
  const nodePath: string[] = [bestTargetReached];
  let curr = bestTargetReached;
  let hasStairs = false;

  while (cameFrom.has(curr)) {
    const step = cameFrom.get(curr)!;
    if (step.edge.isStairs) hasStairs = true;
    curr = step.prev;
    nodePath.unshift(curr);
  }

  return {
    found: true,
    nodePath,
    totalDistanceMeters: distScore.get(bestTargetReached) || 0,
    totalCost: gScore.get(bestTargetReached) || 0,
    hasStairs,
  };
}

/**
 * Resolve target to access nodes and coordinates
 */
function resolveTarget(
  target: RouteTarget,
  graph: CampusGraphData
): {
  nodeIds: string[];
  centroid: [number, number];
  leadCoord?: [number, number];
  leadDist: number;
  error?: string;
} {
  if (target.type === 'building') {
    const b = graph.buildings.find(
      item => item.id === target.buildingId || item.osmId === Number(target.buildingId)
    );
    if (!b) {
      return {
        nodeIds: [],
        centroid: [0, 0],
        leadDist: 0,
        error: `Building ${target.buildingId} not found in campus database.`,
      };
    }
    if (!b.accessNodeIds || b.accessNodeIds.length === 0) {
      return {
        nodeIds: [],
        centroid: b.center,
        leadDist: 0,
        error: `No accessible walkway entrances mapped for ${b.name || 'this building'}.`,
      };
    }
    return {
      nodeIds: b.accessNodeIds,
      centroid: b.center,
      leadDist: 0,
    };
  }

  if (target.type === 'node') {
    const n = graph.nodes[target.nodeId];
    if (!n) {
      return {
        nodeIds: [],
        centroid: [0, 0],
        leadDist: 0,
        error: `Graph node ${target.nodeId} does not exist.`,
      };
    }
    return {
      nodeIds: [n.id],
      centroid: [n.lng, n.lat],
      leadDist: 0,
    };
  }

  // Coordinate (e.g. custom place)
  const snap = snapToNearestNode(target.lngLat, graph.nodes, 80);
  if (!snap.snapped || !snap.nodeId) {
    return {
      nodeIds: [],
      centroid: target.lngLat,
      leadDist: 0,
      error: snap.error || 'Point cannot be snapped to any walkway within 80m.',
    };
  }

  return {
    nodeIds: [snap.nodeId],
    centroid: target.lngLat,
    leadCoord: target.lngLat,
    leadDist: snap.distanceMeters || 0,
  };
}

/**
 * High-level routing function that accepts origin and destination
 * (either building ID or coordinate), computes shortest path with virtual multi-entrance routing,
 * handles accessible mode, and formats the result.
 */
export function calculateRoute(
  origin: RouteTarget,
  destination: RouteTarget,
  options: RouteOptions
): RouteResult {
  const { campusGraph, accessible = false, speedMps = 1.3 } = options;

  // Resolve origin
  const originResolved = resolveTarget(origin, campusGraph);
  if (originResolved.error) {
    return {
      found: false,
      coordinates: [],
      distanceMeters: 0,
      walkSeconds: 0,
      hasStairs: false,
      reason: originResolved.error,
    };
  }

  // Resolve destination
  const destResolved = resolveTarget(destination, campusGraph);
  if (destResolved.error) {
    return {
      found: false,
      coordinates: [],
      distanceMeters: 0,
      walkSeconds: 0,
      hasStairs: false,
      reason: destResolved.error,
    };
  }

  // Check if same building or same place
  if (
    origin.type === 'building' &&
    destination.type === 'building' &&
    origin.buildingId === destination.buildingId
  ) {
    return {
      found: true,
      coordinates: [originResolved.centroid],
      distanceMeters: 0,
      walkSeconds: 0,
      hasStairs: false,
      reason: 'Same building',
    };
  }

  const startNodes = originResolved.nodeIds.map(id => ({
    id,
    initialDist: originResolved.leadDist,
    initialCost: originResolved.leadDist,
  }));

  const targetNodeSet = new Set(destResolved.nodeIds);

  const searchResult = findShortestPath(
    startNodes,
    targetNodeSet,
    destResolved.centroid,
    campusGraph,
    { accessible, speedMps }
  );

  if (!searchResult.found) {
    let reason = 'No walking path found between these locations.';
    if (accessible) {
      // Test if an inaccessible route exists to provide clear feedback
      const normalSearch = findShortestPath(
        startNodes,
        targetNodeSet,
        destResolved.centroid,
        campusGraph,
        { accessible: false, speedMps }
      );
      if (normalSearch.found) {
        reason =
          'No stair-free accessible route available between these locations. The mapped route requires stairs.';
      }
    }

    return {
      found: false,
      coordinates: [],
      distanceMeters: 0,
      walkSeconds: 0,
      hasStairs: false,
      reason,
    };
  }

  // Build full coordinate path
  const coords: Array<[number, number]> = [];

  // If origin had a custom lead coordinate, prepend it
  if (originResolved.leadCoord) {
    coords.push(originResolved.leadCoord);
  }

  for (const nId of searchResult.nodePath) {
    const node = campusGraph.nodes[nId];
    if (node) {
      coords.push([node.lng, node.lat]);
    }
  }

  // If destination had a custom lead coordinate, append it
  if (destResolved.leadCoord) {
    coords.push(destResolved.leadCoord);
  }

  const totalDistance = Math.round(searchResult.totalDistanceMeters + destResolved.leadDist);
  // Walk time = sum(edge length x multiplier) / speedMps
  const totalCost = searchResult.totalCost + destResolved.leadDist;
  const walkSeconds = Math.max(1, Math.round(totalCost / speedMps));

  return {
    found: true,
    coordinates: coords,
    distanceMeters: totalDistance,
    walkSeconds,
    hasStairs: searchResult.hasStairs,
  };
}
