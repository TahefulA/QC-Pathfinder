import fs from 'fs';
import path from 'path';

interface OsmNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

interface OsmWay {
  type: 'way';
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}

interface OsmRelation {
  type: 'relation';
  id: number;
  members: Array<{
    type: 'node' | 'way' | 'relation';
    ref: number;
    role: string;
  }>;
  tags?: Record<string, string>;
}

type OsmElement = OsmNode | OsmWay | OsmRelation;

interface OverpassResponse {
  elements: OsmElement[];
}

interface Overrides {
  buildingNames?: Record<string, string>;
  aliases?: Record<string, string[]>;
  extraBuildings?: Array<{
    name: string;
    lngLat: [number, number];
    aliases?: string[];
  }>;
  extraEdges?: Array<{
    from: [number, number];
    to: [number, number];
    stairs?: boolean;
    wheelchairNo?: boolean;
  }>;
  blockedWayIds?: number[];
}

function haversineMeters(lon1: number, lat1: number, lon2: number, lat2: number): number {
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

function calculateCentroid(coords: Array<[number, number]>): [number, number] {
  let sumLon = 0;
  let sumLat = 0;
  const count = coords.length;
  if (count === 0) return [-73.818, 40.736];
  for (const [lon, lat] of coords) {
    sumLon += lon;
    sumLat += lat;
  }
  return [sumLon / count, sumLat / count];
}

function computeBoundingBox(coords: Array<[number, number]>): {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
} {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLon, minLat, maxLon, maxLat };
}

const LANDMARKS = [
  'Kiely Hall',
  'Rosenthal Library',
  'Science Building',
  'Student Union',
  'Jefferson Hall',
  'Powdermaker Hall',
  'Razran Hall',
  'Delany Hall',
  'Klapper Hall',
  'Colden Auditorium',
];

const WALKABLE_HIGHWAYS = new Set([
  'footway',
  'path',
  'pedestrian',
  'steps',
  'corridor',
  'living_street',
  'service',
  'residential',
  'cycleway',
  'track',
  'tertiary',
  'unclassified',
]);

const EXCLUDED_HIGHWAYS = new Set([
  'motorway',
  'trunk',
  'primary',
  'secondary',
]);

async function fetchOsmData(south: number, west: number, north: number, east: number): Promise<OverpassResponse | null> {
  const query = `[out:json][timeout:90];
(
  way["highway"](${south},${west},${north},${east});
  way["building"](${south},${west},${north},${east});
  node["entrance"](${south},${west},${north},${east});
  relation["building"](${south},${west},${north},${east});
);
out body;
>;
out skel qt;`;

  console.log(`📡 Fetching OSM data from Overpass API (bbox: ${south}, ${west}, ${north}, ${east})...`);
  
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Trying ${endpoint}...`);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'QCPathfinder/1.0 (Queens College Campus Map)',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(60000),
      });

      if (!res.ok) {
        console.warn(`Endpoint ${endpoint} returned status ${res.status}`);
        continue;
      }

      const data = await res.json() as OverpassResponse;
      if (data && data.elements && data.elements.length > 0) {
        console.log(`✅ Successfully fetched ${data.elements.length} elements from ${endpoint}`);
        return data;
      }
    } catch (err) {
      console.warn(`Failed with ${endpoint}:`, (err as Error).message);
    }
  }

  return null;
}

function cleanBuildingSlug(name: string, fallbackId: number | string): string {
  if (!name) return `b-${fallbackId}`;
  // Remove parenthetical codes like (KY) or (JH)
  const cleaned = name.replace(/\([A-Z0-9\s]+\)/g, '').trim();
  const slug = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || `b-${fallbackId}`;
}

async function main() {
  const rootDir = process.cwd();
  const rawDir = path.join(rootDir, 'data', 'raw');
  const rawPath = path.join(rawDir, 'osm.json');
  const overridesPath = path.join(rootDir, 'data', 'overrides.json');
  const publicDataDir = path.join(rootDir, 'public', 'data');

  fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(publicDataDir, { recursive: true });

  let overrides: Overrides = {};
  if (fs.existsSync(overridesPath)) {
    try {
      overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
      console.log('Loaded overrides from data/overrides.json');
    } catch (e) {
      console.error('Warning: could not parse overrides.json:', e);
    }
  }

  const south = 40.7310;
  const west = -73.8260;
  const north = 40.7425;
  const east = -73.8090;

  let osmData: OverpassResponse | null = null;

  // Prefer local raw file if already fetched
  if (fs.existsSync(rawPath)) {
    console.log(`Reading existing raw data from ${rawPath}...`);
    try {
      osmData = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
    } catch (e) {
      console.error('Error reading existing raw osm.json:', e);
    }
  }

  // If not local, try network fetch
  if (!osmData) {
    try {
      osmData = await fetchOsmData(south, west, north, east);
      if (osmData) {
        fs.writeFileSync(rawPath, JSON.stringify(osmData, null, 2), 'utf8');
        console.log(`Saved raw OSM response to ${rawPath}`);
      }
    } catch (e) {
      console.warn('Network fetch encountered error:', e);
    }
  }

  if (!osmData || !osmData.elements || osmData.elements.length === 0) {
    console.error(`❌ ERROR: No raw OSM data available.`);
    process.exit(1);
  }

  console.log(`Processing ${osmData.elements.length} OSM elements...`);

  // Index nodes, ways, relations
  const nodesMap = new Map<number, OsmNode>();
  const waysMap = new Map<number, OsmWay>();
  const relations: OsmRelation[] = [];
  const entranceNodes: OsmNode[] = [];

  for (const el of osmData.elements) {
    if (el.type === 'node') {
      nodesMap.set(el.id, el);
      if (el.tags && (el.tags.entrance || el.tags.barrier === 'entrance')) {
        entranceNodes.push(el);
      }
    } else if (el.type === 'way') {
      waysMap.set(el.id, el);
    } else if (el.type === 'relation') {
      relations.push(el);
    }
  }

  // Collect Buildings
  interface ProcessedBuilding {
    id: string;
    osmId: number;
    osmType: 'way' | 'relation';
    name: string;
    aliases: string[];
    polygon: Array<Array<[number, number]>>;
    bbox: { minLon: number; minLat: number; maxLon: number; maxLat: number };
    center: [number, number];
    levels?: string;
  }

  const buildings: ProcessedBuilding[] = [];
  const processedWayIds = new Set<number>();
  const blockedWayIds = new Set(overrides.blockedWayIds || []);
  const usedBuildingIds = new Set<string>();

  function getUniqueBuildingId(baseId: string): string {
    if (!usedBuildingIds.has(baseId)) {
      usedBuildingIds.add(baseId);
      return baseId;
    }
    let counter = 2;
    while (usedBuildingIds.has(`${baseId}-${counter}`)) {
      counter++;
    }
    const uniqueId = `${baseId}-${counter}`;
    usedBuildingIds.add(uniqueId);
    return uniqueId;
  }

  // 1. First process Relation Multipolygons for buildings (e.g. Kiely Hall, Remsen Hall)
  for (const rel of relations) {
    if (!rel.tags || !rel.tags.building) continue;

    // Find outer ways
    const outerWays = rel.members.filter(m => m.type === 'way' && (m.role === 'outer' || !m.role));
    if (outerWays.length === 0) continue;

    // Use the primary outer way for the polygon
    const outerWay = waysMap.get(outerWays[0].ref);
    if (!outerWay) continue;

    processedWayIds.add(outerWay.id);

    const coords: Array<[number, number]> = [];
    for (const nId of outerWay.nodes) {
      const node = nodesMap.get(nId);
      if (node) coords.push([node.lon, node.lat]);
    }
    if (coords.length < 3) continue;

    if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
      coords.push([coords[0][0], coords[0][1]]);
    }

    let name = rel.tags.name || outerWay.tags?.name || '';
    if (overrides.buildingNames && overrides.buildingNames[String(rel.id)]) {
      name = overrides.buildingNames[String(rel.id)];
    }

    const baseSlug = cleanBuildingSlug(name, rel.id);
    const bId = getUniqueBuildingId(baseSlug);
    const bAliases: string[] = [];
    if (overrides.aliases && overrides.aliases[bId]) {
      bAliases.push(...overrides.aliases[bId]);
    }
    if (overrides.aliases && overrides.aliases[baseSlug] && baseSlug !== bId) {
      bAliases.push(...overrides.aliases[baseSlug]);
    }
    if (rel.tags.short_name) bAliases.push(rel.tags.short_name);
    if (rel.tags.alt_name) bAliases.push(rel.tags.alt_name);

    const center = calculateCentroid(coords);
    const bbox = computeBoundingBox(coords);

    buildings.push({
      id: bId,
      osmId: rel.id,
      osmType: 'relation',
      name,
      aliases: Array.from(new Set(bAliases)),
      polygon: [coords],
      bbox,
      center,
      levels: rel.tags['building:levels'],
    });
  }

  // 2. Process Way buildings
  for (const [wayId, way] of waysMap.entries()) {
    if (!way.tags || !way.tags.building) continue;
    if (processedWayIds.has(wayId) || blockedWayIds.has(wayId)) continue;

    const coords: Array<[number, number]> = [];
    for (const nId of way.nodes) {
      const node = nodesMap.get(nId);
      if (node) coords.push([node.lon, node.lat]);
    }
    if (coords.length < 3) continue;

    if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
      coords.push([coords[0][0], coords[0][1]]);
    }

    let name = way.tags.name || '';
    if (overrides.buildingNames && overrides.buildingNames[String(way.id)]) {
      name = overrides.buildingNames[String(way.id)];
    }

    const baseSlug = cleanBuildingSlug(name, way.id);
    const bId = getUniqueBuildingId(baseSlug);
    const bAliases: string[] = [];
    if (overrides.aliases && overrides.aliases[bId]) {
      bAliases.push(...overrides.aliases[bId]);
    }
    if (overrides.aliases && overrides.aliases[baseSlug] && baseSlug !== bId) {
      bAliases.push(...overrides.aliases[baseSlug]);
    }
    if (way.tags.short_name) bAliases.push(way.tags.short_name);
    if (way.tags.alt_name) bAliases.push(way.tags.alt_name);

    const center = calculateCentroid(coords);
    const bbox = computeBoundingBox(coords);

    buildings.push({
      id: bId,
      osmId: way.id,
      osmType: 'way',
      name,
      aliases: Array.from(new Set(bAliases)),
      polygon: [coords],
      bbox,
      center,
      levels: way.tags['building:levels'],
    });
  }

  // Add extra buildings from overrides
  if (overrides.extraBuildings) {
    for (const eb of overrides.extraBuildings) {
      const bId = getUniqueBuildingId(cleanBuildingSlug(eb.name, 'extra'));
      const delta = 0.00015;
      const [lon, lat] = eb.lngLat;
      const polyCoords: Array<[number, number]> = [
        [lon - delta, lat - delta],
        [lon + delta, lat - delta],
        [lon + delta, lat + delta],
        [lon - delta, lat + delta],
        [lon - delta, lat - delta],
      ];
      buildings.push({
        id: bId,
        osmId: 999000 + Math.floor(Math.random() * 1000),
        osmType: 'way',
        name: eb.name,
        aliases: eb.aliases || (overrides.aliases && overrides.aliases[bId]) || [],
        polygon: [polyCoords],
        bbox: computeBoundingBox(polyCoords),
        center: eb.lngLat,
      });
    }
  }

  // 3. Landmark check
  console.log('\n=========================================');
  console.log('🏛️  LANDMARK VERIFICATION REPORT');
  console.log('=========================================');

  const landmarkResults: Array<{
    name: string;
    found: boolean;
    matchedName?: string;
    id?: string;
    center?: [number, number];
  }> = [];

  for (const landmark of LANDMARKS) {
    const lLower = landmark.toLowerCase();
    let matched: ProcessedBuilding | undefined = undefined;

    for (const b of buildings) {
      if (!b.name) continue;
      const bNameLower = b.name.toLowerCase();
      const bIdLower = b.id.toLowerCase();
      const aliasMatches = b.aliases.some(a => a.toLowerCase().includes(lLower) || lLower.includes(a.toLowerCase()));

      if (
        bNameLower.includes(lLower) ||
        lLower.includes(bNameLower) ||
        bIdLower.includes(lLower.replace(/\s+/g, '-')) ||
        aliasMatches
      ) {
        matched = b;
        break;
      }
    }

    if (matched) {
      landmarkResults.push({
        name: landmark,
        found: true,
        matchedName: matched.name,
        id: matched.id,
        center: matched.center,
      });
      console.log(`✅ FOUND:   "${landmark}" -> Matched: "${matched.name}" (ID: ${matched.id})`);
    } else {
      landmarkResults.push({
        name: landmark,
        found: false,
      });
      console.log(`❌ MISSING: "${landmark}"`);
    }
  }

  const foundCount = landmarkResults.filter(r => r.found).length;
  console.log(`-----------------------------------------`);
  console.log(`Summary: ${foundCount} / ${LANDMARKS.length} landmarks verified.`);
  console.log('=========================================\n');

  // Build Routing Graph
  interface GraphNode {
    id: string;
    lng: number;
    lat: number;
    componentId?: number;
  }

  interface GraphEdge {
    target: string;
    distance: number;
    isStairs: boolean;
    wheelchairNo: boolean;
    costMultiplier: number;
    cost: number;
  }

  const graphNodes = new Map<string, GraphNode>();
  const adjacency = new Map<string, GraphEdge[]>();

  function addNode(id: string, lng: number, lat: number) {
    if (!graphNodes.has(id)) {
      graphNodes.set(id, { id, lng, lat });
      adjacency.set(id, []);
    }
  }

  function addEdge(
    u: string,
    v: string,
    distance: number,
    isStairs: boolean,
    wheelchairNo: boolean,
    costMultiplier: number
  ) {
    const cost = distance * costMultiplier;
    const listU = adjacency.get(u)!;
    const listV = adjacency.get(v)!;

    if (!listU.some(e => e.target === v)) {
      listU.push({ target: v, distance, isStairs, wheelchairNo, costMultiplier, cost });
    }
    if (!listV.some(e => e.target === u)) {
      listV.push({ target: u, distance, isStairs, wheelchairNo, costMultiplier, cost });
    }
  }

  interface GeoJsonFeature {
    type: 'Feature';
    geometry: {
      type: string;
      coordinates: any;
    };
    properties: Record<string, any>;
  }

  const geoJsonFeatures: GeoJsonFeature[] = [];

  const QC_BUILDING_HEIGHTS: Record<string, { height: number; levels?: number; isLandmark?: boolean }> = {
    'kiely-hall': { height: 48, levels: 13, isLandmark: true },
    'rosenthal-library': { height: 36, levels: 6, isLandmark: true },
    'science-building': { height: 28, levels: 5, isLandmark: true },
    'the-summit': { height: 26, levels: 6, isLandmark: true },
    'powdermaker-hall': { height: 24, levels: 4, isLandmark: true },
    'colden-auditorium': { height: 24, levels: 3, isLandmark: true },
    'fitzgerald-gymnasium': { height: 22, levels: 3, isLandmark: true },
    'aaron-copland-school-of-music': { height: 22, levels: 3, isLandmark: true },
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
    'campbell-dome': { height: 14, levels: 2, isLandmark: true },
    'dining-hall': { height: 13, levels: 2, isLandmark: true },
    'g-building': { height: 13, levels: 2, isLandmark: true },
    'i-building': { height: 12, levels: 2, isLandmark: true },
    'gertz-center': { height: 12, levels: 2, isLandmark: true },
    'public-safety': { height: 10, levels: 1, isLandmark: false },
  };

  // Add building polygons to GeoJSON with 3D height metadata
  for (const b of buildings) {
    const known = QC_BUILDING_HEIGHTS[b.id];
    let h = 12;
    let isLandmark = false;
    let lvls = b.levels ? parseInt(b.levels, 10) : undefined;

    if (known) {
      h = known.height;
      lvls = known.levels;
      isLandmark = !!known.isLandmark;
    } else if (lvls && !isNaN(lvls) && lvls > 0) {
      h = Math.max(8, lvls * 3.8);
    } else {
      // Estimate based on bounding box
      const widthMeters = haversineMeters(b.bbox.minLon, b.bbox.minLat, b.bbox.maxLon, b.bbox.minLat);
      const heightMeters = haversineMeters(b.bbox.minLon, b.bbox.minLat, b.bbox.minLon, b.bbox.maxLat);
      const approxArea = widthMeters * heightMeters;
      if (approxArea < 160) h = 8.5;
      else if (approxArea < 450) h = 12;
      else if (approxArea < 1200) h = 16;
      else h = 20;
    }

    geoJsonFeatures.push({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: b.polygon,
      },
      properties: {
        type: 'building',
        id: b.id,
        osmId: b.osmId,
        name: b.name,
        aliases: b.aliases,
        center: b.center,
        levels: lvls || Math.round(h / 3.5),
        height: h,
        min_height: 0,
        isCampusLandmark: isLandmark,
      },
    });
  }

  // Walkway edges
  for (const way of waysMap.values()) {
    if (!way.tags || !way.tags.highway) continue;
    if (blockedWayIds.has(way.id)) continue;

    const hw = way.tags.highway.toLowerCase();
    if (!WALKABLE_HIGHWAYS.has(hw)) continue;
    if (EXCLUDED_HIGHWAYS.has(hw)) continue;

    const footTag = (way.tags.foot || '').toLowerCase();
    const accessTag = (way.tags.access || '').toLowerCase();
    if (footTag === 'no') continue;
    if (accessTag === 'private' || accessTag === 'no') continue;

    const isStairs = hw === 'steps';
    const wheelchairTag = (way.tags.wheelchair || '').toLowerCase();
    const wheelchairNo = wheelchairTag === 'no' || isStairs;

    let costMultiplier = 1.0;
    if (isStairs) {
      costMultiplier = 1.8;
    } else if (['service', 'residential', 'living_street', 'tertiary', 'unclassified', 'track', 'cycleway'].includes(hw)) {
      costMultiplier = 1.25;
    }

    const wayLineCoords: Array<[number, number]> = [];

    for (let i = 0; i < way.nodes.length; i++) {
      const nId = way.nodes[i];
      const node = nodesMap.get(nId);
      if (!node) continue;

      const strId = `n-${node.id}`;
      addNode(strId, node.lon, node.lat);
      wayLineCoords.push([node.lon, node.lat]);

      if (i > 0) {
        const prevId = way.nodes[i - 1];
        const prevNode = nodesMap.get(prevId);
        if (prevNode) {
          const prevStrId = `n-${prevNode.id}`;
          const dist = haversineMeters(prevNode.lon, prevNode.lat, node.lon, node.lat);
          addEdge(prevStrId, strId, dist, isStairs, wheelchairNo, costMultiplier);
        }
      }
    }

    if (wayLineCoords.length >= 2) {
      geoJsonFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: wayLineCoords,
        },
        properties: {
          type: 'walkway',
          id: way.id,
          highway: hw,
          isStairs,
          wheelchairNo,
        },
      });
    }
  }

  // Extra edges from overrides
  if (overrides.extraEdges) {
    let extraEdgeIdx = 1;
    for (const ee of overrides.extraEdges) {
      const uId = `extra-${extraEdgeIdx}-a`;
      const vId = `extra-${extraEdgeIdx}-b`;
      addNode(uId, ee.from[0], ee.from[1]);
      addNode(vId, ee.to[0], ee.to[1]);
      const dist = haversineMeters(ee.from[0], ee.from[1], ee.to[0], ee.to[1]);
      addEdge(uId, vId, dist, !!ee.stairs, !!ee.wheelchairNo, ee.stairs ? 1.8 : 1.0);

      geoJsonFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [ee.from, ee.to],
        },
        properties: {
          type: 'walkway',
          id: `extra-edge-${extraEdgeIdx}`,
          highway: ee.stairs ? 'steps' : 'footway',
          isStairs: !!ee.stairs,
          wheelchairNo: !!ee.wheelchairNo,
        },
      });
      extraEdgeIdx++;
    }
  }

  // Entrance features
  for (const ent of entranceNodes) {
    geoJsonFeatures.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [ent.lon, ent.lat],
      },
      properties: {
        type: 'entrance',
        id: ent.id,
        entranceType: ent.tags?.entrance || 'yes',
      },
    });
  }

  // Connected Components
  const visited = new Set<string>();
  const components: Array<string[]> = [];

  for (const nodeId of graphNodes.keys()) {
    if (visited.has(nodeId)) continue;
    const comp: string[] = [];
    const queue: string[] = [nodeId];
    visited.add(nodeId);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      comp.push(curr);
      const neighbors = adjacency.get(curr) || [];
      for (const edge of neighbors) {
        if (!visited.has(edge.target)) {
          visited.add(edge.target);
          queue.push(edge.target);
        }
      }
    }
    components.push(comp);
  }

  components.sort((a, b) => b.length - a.length);

  for (let cIdx = 0; cIdx < components.length; cIdx++) {
    for (const nId of components[cIdx]) {
      graphNodes.get(nId)!.componentId = cIdx;
    }
  }

  const largestComponent = components[0] || [];
  const largestNodeSet = new Set(largestComponent);

  let totalEdges = 0;
  let largestComponentEdges = 0;

  for (const [u, edges] of adjacency.entries()) {
    totalEdges += edges.length;
    if (largestNodeSet.has(u)) {
      for (const e of edges) {
        if (largestNodeSet.has(e.target)) {
          largestComponentEdges++;
        }
      }
    }
  }

  const uniqueTotalEdges = Math.round(totalEdges / 2);
  const uniqueLargestEdges = Math.round(largestComponentEdges / 2);
  const edgeCoveragePercent =
    uniqueTotalEdges > 0 ? (uniqueLargestEdges / uniqueTotalEdges) * 100 : 0;

  console.log('📊 GRAPH STATS:');
  console.log(`Total Nodes: ${graphNodes.size}`);
  console.log(`Total Edges: ${uniqueTotalEdges}`);
  console.log(`Total Components: ${components.length}`);
  console.log(`Largest Component: ${largestComponent.length} nodes (${((largestComponent.length / graphNodes.size) * 100).toFixed(1)}%)`);
  console.log(`Largest Component Edges: ${uniqueLargestEdges} edges (${edgeCoveragePercent.toFixed(1)}%)`);

  // Fast building access point calculation
  // Spatial filtering: only check nodes within 0.001 deg (~100m) of building bounding box
  interface BuildingAccessInfo {
    id: string;
    osmId: number;
    name: string;
    aliases: string[];
    center: [number, number];
    accessNodeIds: string[];
  }

  const buildingAccessList: BuildingAccessInfo[] = [];

  for (const b of buildings) {
    const accessNodeIds: string[] = [];

    // Check entrance nodes within 30m of building center
    for (const ent of entranceNodes) {
      const d = haversineMeters(ent.lon, ent.lat, b.center[0], b.center[1]);
      if (d <= 50) {
        const strId = `n-${ent.id}`;
        if (largestNodeSet.has(strId)) {
          accessNodeIds.push(strId);
        }
      }
    }

    if (accessNodeIds.length === 0) {
      // Find nearest 3 nodes in largest component within 80m
      const candidates: Array<{ id: string; dist: number }> = [];
      const margin = 0.0012; // ~100m
      const minLon = b.bbox.minLon - margin;
      const maxLon = b.bbox.maxLon + margin;
      const minLat = b.bbox.minLat - margin;
      const maxLat = b.bbox.maxLat + margin;

      for (const nId of largestComponent) {
        const node = graphNodes.get(nId)!;
        if (node.lng < minLon || node.lng > maxLon || node.lat < minLat || node.lat > maxLat) {
          continue;
        }

        // Check distance to center
        const dist = haversineMeters(node.lng, node.lat, b.center[0], b.center[1]);
        if (dist <= 80) {
          candidates.push({ id: nId, dist });
        }
      }

      candidates.sort((a, b) => a.dist - b.dist);
      accessNodeIds.push(...candidates.slice(0, 3).map(c => c.id));
    }

    buildingAccessList.push({
      id: b.id,
      osmId: b.osmId,
      name: b.name,
      aliases: b.aliases,
      center: b.center,
      accessNodeIds: Array.from(new Set(accessNodeIds)),
    });
  }

  const buildingsWithAccess = buildingAccessList.filter(b => b.accessNodeIds.length > 0).length;
  console.log(`Buildings with valid access points: ${buildingsWithAccess} / ${buildings.length}`);

  // Build JSON Outputs
  const geojsonOutput = {
    type: 'FeatureCollection',
    features: geoJsonFeatures,
  };

  const graphOutput = {
    nodes: Object.fromEntries(graphNodes.entries()),
    adjacency: Object.fromEntries(adjacency.entries()),
    buildings: buildingAccessList,
    components: components.map((c, idx) => ({ id: idx, size: c.length })),
    stats: {
      totalNodes: graphNodes.size,
      totalEdges: uniqueTotalEdges,
      componentCount: components.length,
      largestComponentNodes: largestComponent.length,
      largestComponentEdges: uniqueLargestEdges,
      largestComponentEdgePercent: Number(edgeCoveragePercent.toFixed(1)),
      landmarksFound: foundCount,
      landmarksTotal: LANDMARKS.length,
      landmarkResults,
    },
    attribution: '© OpenStreetMap contributors',
  };

  const geojsonPath = path.join(publicDataDir, 'campus.geojson');
  const graphJsonPath = path.join(publicDataDir, 'graph.json');

  fs.writeFileSync(geojsonPath, JSON.stringify(geojsonOutput), 'utf8');
  fs.writeFileSync(graphJsonPath, JSON.stringify(graphOutput), 'utf8');

  console.log(`\n🎉 Generated:`);
  console.log(`  - ${geojsonPath} (${(fs.statSync(geojsonPath).size / 1024).toFixed(1)} KB)`);
  console.log(`  - ${graphJsonPath} (${(fs.statSync(graphJsonPath).size / 1024).toFixed(1)} KB)`);
  console.log('\nData generation successfully completed!');
}

main().catch(err => {
  console.error('Fatal build-data error:', err);
  process.exit(1);
});
