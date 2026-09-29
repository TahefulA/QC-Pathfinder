import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { haversineMeters, snapToNearestNode } from '../geo';
import { calculateRoute, findShortestPath } from '../routing';
import { computeLeg, minutesToTimeString, timeStringToMinutes } from '../time';
import { CampusGraphData, GraphEdge, GraphNode, Stop } from '../types';

describe('Graph & Snapping Logic', () => {
  const mockNodes: Record<string, GraphNode> = {
    'n1': { id: 'n1', lng: -73.8180, lat: 40.7360, componentId: 0 },
    'n2': { id: 'n2', lng: -73.8182, lat: 40.7362, componentId: 0 },
    'n3': { id: 'n3', lng: -73.8185, lat: 40.7365, componentId: 0 },
  };

  it('snaps point to nearest node when within 80 meters', () => {
    // A point very close to n1 (~10 meters away)
    const testPoint: [number, number] = [-73.81805, 40.73605];
    const snap = snapToNearestNode(testPoint, mockNodes, 80);
    expect(snap.snapped).toBe(true);
    expect(snap.nodeId).toBe('n1');
    expect(snap.distanceMeters).toBeLessThan(20);
  });

  it('refuses to snap when point is farther than 80 meters', () => {
    // A point far away (~500 meters)
    const farPoint: [number, number] = [-73.8300, 40.7450];
    const snap = snapToNearestNode(farPoint, mockNodes, 80);
    expect(snap.snapped).toBe(false);
    expect(snap.error).toContain('too far');
  });
});

describe('A* Routing Algorithm on Synthetic Graph', () => {
  // Build a test graph with:
  // A <-> B (100m, normal)
  // B <-> C (50m, stairs)
  // B <-> D (80m, normal)
  // D <-> C (80m, normal)
  // E (isolated node)
  const nodes: Record<string, GraphNode> = {
    A: { id: 'A', lng: 0.0, lat: 0.0 },
    B: { id: 'B', lng: 0.001, lat: 0.0 },
    C: { id: 'C', lng: 0.002, lat: 0.0 },
    D: { id: 'D', lng: 0.0015, lat: 0.001 },
    E: { id: 'E', lng: 0.01, lat: 0.01 },
  };

  const adjacency: Record<string, GraphEdge[]> = {
    A: [{ target: 'B', distance: 100, isStairs: false, wheelchairNo: false, costMultiplier: 1.0, cost: 100 }],
    B: [
      { target: 'A', distance: 100, isStairs: false, wheelchairNo: false, costMultiplier: 1.0, cost: 100 },
      { target: 'C', distance: 50, isStairs: true, wheelchairNo: true, costMultiplier: 1.8, cost: 90 },
      { target: 'D', distance: 80, isStairs: false, wheelchairNo: false, costMultiplier: 1.0, cost: 80 },
    ],
    C: [
      { target: 'B', distance: 50, isStairs: true, wheelchairNo: true, costMultiplier: 1.8, cost: 90 },
      { target: 'D', distance: 80, isStairs: false, wheelchairNo: false, costMultiplier: 1.0, cost: 80 },
    ],
    D: [
      { target: 'B', distance: 80, isStairs: false, wheelchairNo: false, costMultiplier: 1.0, cost: 80 },
      { target: 'C', distance: 80, isStairs: false, wheelchairNo: false, costMultiplier: 1.0, cost: 80 },
    ],
    E: [],
  };

  it('finds shortest path via stairs when accessible mode is false', () => {
    const result = findShortestPath(
      [{ id: 'A', initialDist: 0, initialCost: 0 }],
      new Set(['C']),
      [0.002, 0.0],
      { nodes, adjacency },
      { accessible: false, speedMps: 1.3 }
    );
    expect(result.found).toBe(true);
    expect(result.nodePath).toEqual(['A', 'B', 'C']);
    expect(result.hasStairs).toBe(true);
  });

  it('avoids stairs and takes detour via D when accessible mode is true', () => {
    const result = findShortestPath(
      [{ id: 'A', initialDist: 0, initialCost: 0 }],
      new Set(['C']),
      [0.002, 0.0],
      { nodes, adjacency },
      { accessible: true, speedMps: 1.3 }
    );
    expect(result.found).toBe(true);
    expect(result.nodePath).toEqual(['A', 'B', 'D', 'C']);
    expect(result.hasStairs).toBe(false);
  });

  it('returns found=false when target is unreachable', () => {
    const result = findShortestPath(
      [{ id: 'A', initialDist: 0, initialCost: 0 }],
      new Set(['E']),
      [0.01, 0.01],
      { nodes, adjacency },
      { accessible: false, speedMps: 1.3 }
    );
    expect(result.found).toBe(false);
  });
});

describe('Time Math & Slack Thresholds', () => {
  it('correctly parses and formats time strings', () => {
    expect(timeStringToMinutes('00:00')).toBe(0);
    expect(timeStringToMinutes('09:15')).toBe(555);
    expect(timeStringToMinutes('14:30')).toBe(870);

    expect(minutesToTimeString(555)).toBe('09:15');
    expect(minutesToTimeString(870)).toBe('14:30');
  });

  const baseStop1: Stop = {
    id: 's1',
    title: 'CSCI 111',
    placeId: 'kiely-hall',
    type: 'class',
    days: [0],
    start: '09:00',
    end: '10:15',
  };

  it('marks leg as comfortable when slack is >= 3 minutes', () => {
    // Gap: 10:30 - 10:15 = 15 min. Walk: 5 min. Buffer: 2 min. Slack = 15 - 5 - 2 = 8 min
    const stop2: Stop = {
      id: 's2',
      title: 'MATH 120',
      placeId: 'powdermaker-hall',
      type: 'class',
      days: [0],
      start: '10:30',
      end: '11:45',
    };

    const mockRoute = {
      found: true,
      coordinates: [],
      distanceMeters: 300,
      walkSeconds: 300, // 5 min
      hasStairs: false,
    };

    const leg = computeLeg(baseStop1, stop2, mockRoute, 2);
    expect(leg.status).toBe('comfortable');
    expect(leg.slackMinutes).toBe(8);
    expect(leg.leaveByTime).toBe('10:23');
  });

  it('marks leg as tight when slack is between 0 and 3 minutes', () => {
    // Gap: 10:23 - 10:15 = 8 min. Walk: 5 min. Buffer: 2 min. Slack = 8 - 5 - 2 = 1 min
    const stop2: Stop = {
      id: 's2',
      title: 'ENGL 110',
      placeId: 'klapper-hall',
      type: 'class',
      days: [0],
      start: '10:23',
      end: '11:30',
    };

    const mockRoute = {
      found: true,
      coordinates: [],
      distanceMeters: 300,
      walkSeconds: 300, // 5 min
      hasStairs: false,
    };

    const leg = computeLeg(baseStop1, stop2, mockRoute, 2);
    expect(leg.status).toBe('tight');
    expect(leg.slackMinutes).toBe(1);
  });

  it('marks leg as impossible (won\'t make it) when slack is negative', () => {
    // Gap: 10:20 - 10:15 = 5 min. Walk: 5 min. Buffer: 2 min. Slack = 5 - 5 - 2 = -2 min
    const stop2: Stop = {
      id: 's2',
      title: 'PHYS 145',
      placeId: 'science-building',
      type: 'class',
      days: [0],
      start: '10:20',
      end: '11:30',
    };

    const mockRoute = {
      found: true,
      coordinates: [],
      distanceMeters: 300,
      walkSeconds: 300, // 5 min
      hasStairs: false,
    };

    const leg = computeLeg(baseStop1, stop2, mockRoute, 2);
    expect(leg.status).toBe('impossible');
    expect(leg.slackMinutes).toBe(-2);
  });
});

describe('Integration Tests with Real Campus graph.json', () => {
  const graphPath = path.resolve(process.cwd(), 'public/data/graph.json');
  const graphData: CampusGraphData = JSON.parse(fs.readFileSync(graphPath, 'utf8'));

  it('has valid stats and large connected component', () => {
    expect(graphData.stats.totalNodes).toBeGreaterThan(1000);
    expect(graphData.stats.largestComponentEdgePercent).toBeGreaterThanOrEqual(90);
  });

  const testPairs = [
    { from: 'kiely-hall', to: 'rosenthal-library' },
    { from: 'powdermaker-hall', to: 'science-building' },
    { from: 'student-union', to: 'jefferson-hall' },
    { from: 'razran-hall', to: 'klapper-hall' },
    { from: 'delany-hall', to: 'colden-auditorium' },
  ];

  for (const pair of testPairs) {
    it(`successfully routes between ${pair.from} and ${pair.to}`, () => {
      const route = calculateRoute(
        { type: 'building', buildingId: pair.from },
        { type: 'building', buildingId: pair.to },
        { campusGraph: graphData, accessible: false }
      );

      expect(route.found).toBe(true);
      expect(route.distanceMeters).toBeGreaterThan(30);
      expect(route.distanceMeters).toBeLessThan(1500);
      expect(route.coordinates.length).toBeGreaterThan(2);
      expect(route.walkSeconds).toBeGreaterThan(20);
    });
  }
});
