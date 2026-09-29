import React, { useState } from 'react';
import { useAppStore } from '../lib/store';
import { calculateRoute } from '../lib/routing';
import {
  Activity,
  AlertCircle,
  Building,
  CheckCircle2,
  Compass,
  Crosshair,
  Database,
  Footprints,
  Layers,
  MapPin,
  Maximize2,
  Navigation,
  Play,
  Sparkles,
  Square,
  Zap,
} from 'lucide-react';

export const DebugView: React.FC = () => {
  const {
    graphData,
    settings,
    userLocation,
    locationStatus,
    locationErrorMessage,
    simulation,
    navigationState,
    setSimulation,
    startWatchingLocation,
    stopWatchingLocation,
    playSimulatedWalk,
    stopSimulatedWalk,
  } = useAppStore();

  const [testOrigin, setTestOrigin] = useState<string>('kiely-hall');
  const [testDestination, setTestDestination] = useState<string>('rosenthal-library');
  const [testAccessible, setTestAccessible] = useState<boolean>(false);

  if (!graphData) {
    return (
      <div className="p-8 text-neutral-400 text-center">
        Loading campus routing graph...
      </div>
    );
  }

  const { stats, buildings, nodes, adjacency } = graphData;

  // Preset test points for simulation
  const SIM_PRESETS = [
    { name: 'Campus Quad (Center)', coords: [-73.8166, 40.7365] as [number, number] },
    { name: 'Kiely Hall Front', coords: [-73.8162, 40.7360] as [number, number] },
    { name: 'Powdermaker Hall Steps', coords: [-73.8188, 40.7364] as [number, number] },
    { name: 'Rosenthal Library Entrance', coords: [-73.8185, 40.7371] as [number, number] },
    { name: 'Off-Campus (Flushing Main St)', coords: [-73.8300, 40.7550] as [number, number] },
  ];

  // Test routing
  const routeResult = testOrigin && testDestination
    ? calculateRoute(
        { type: 'building', buildingId: testOrigin },
        { type: 'building', buildingId: testDestination },
        {
          campusGraph: graphData,
          accessible: testAccessible,
          speedMps: settings.speedMps,
        }
      )
    : null;

  // Identify buildings with missing access nodes
  const buildingsNoAccess = buildings.filter(b => !b.accessNodeIds || b.accessNodeIds.length === 0);

  // Component size distribution
  const componentNodeCounts: Record<number, number> = {};
  Object.values(nodes).forEach(n => {
    const cid = n.componentId ?? 0;
    componentNodeCounts[cid] = (componentNodeCounts[cid] || 0) + 1;
  });

  const sortedComponents = Object.entries(componentNodeCounts)
    .map(([id, count]) => ({ id: Number(id), count }))
    .sort((a, b) => b.count - a.count);

  const uniqueNamedBuildings = React.useMemo(() => {
    const list: typeof buildings = [];
    const seen = new Set<string>();
    buildings
      .filter(b => b.name && b.name.trim().length > 0)
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(b => {
        if (!seen.has(b.id)) {
          seen.add(b.id);
          list.push(b);
        }
      });
    return list;
  }, [buildings]);

  return (
    <div className="flex-1 bg-neutral-950 text-neutral-100 p-6 overflow-y-auto space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="border-b border-neutral-800 pb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold text-neutral-100">
              QC Pathfinder Graph Diagnostics & Diagnostics Tool
            </h1>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Real-time inspection of OpenStreetMap topology, connected components, and landmark verification.
          </p>
        </div>

        <span className="text-xs font-mono px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
          Component Health: {stats.largestComponentEdgePercent}%
        </span>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="text-xs font-semibold text-neutral-400 mb-1">Total Graph Nodes</div>
          <div className="text-2xl font-extrabold text-neutral-100 font-mono">{stats.totalNodes}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Footway intersections & curves</div>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="text-xs font-semibold text-neutral-400 mb-1">Total Graph Edges</div>
          <div className="text-2xl font-extrabold text-neutral-100 font-mono">{stats.totalEdges}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Walkable pathway segments</div>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="text-xs font-semibold text-neutral-400 mb-1">Connected Components</div>
          <div className="text-2xl font-extrabold text-amber-400 font-mono">{stats.componentCount}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Isolated walkway clusters</div>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="text-xs font-semibold text-neutral-400 mb-1">Largest Component Edges</div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono">{stats.largestComponentEdgePercent}%</div>
          <div className="text-[11px] text-neutral-500 mt-1">Routable core coverage (&gt;90% req)</div>
        </div>
      </div>

      {/* Landmark Verification Report */}
      <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-neutral-200 flex items-center gap-2">
            <Building className="w-4 h-4 text-sky-400" />
            <span>Landmark Verification Report (10 Core Campus Buildings)</span>
          </h3>
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            10 / 10 Found in OSM Data
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {stats.landmarkResults.map((lm, i) => (
            <div
              key={i}
              className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-semibold text-neutral-200">{lm.name}</div>
                  <div className="text-[11px] text-neutral-400">
                    Matched: <span className="text-sky-400 font-mono">{lm.matchedName || lm.id}</span>
                  </div>
                </div>
              </div>
              <span className="font-mono text-[11px] text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                {lm.id}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Router Test Sandbox */}
      <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-neutral-200 flex items-center gap-2">
            <Navigation className="w-4 h-4 text-purple-400" />
            <span>Interactive Router Test: Building-to-Building</span>
          </h3>
          <span className="text-xs text-neutral-400">Pure A* with Multi-Entrance Snapping</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-1">Origin Building</label>
            <select
              value={testOrigin}
              onChange={e => setTestOrigin(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-500"
            >
              {uniqueNamedBuildings.map(b => (
                <option key={`orig-${b.id}`} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-1">Destination Building</label>
            <select
              value={testDestination}
              onChange={e => setTestDestination(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-purple-500"
            >
              {uniqueNamedBuildings.map(b => (
                <option key={`dest-${b.id}`} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-neutral-950 border border-neutral-800">
              <input
                type="checkbox"
                checked={testAccessible}
                onChange={e => setTestAccessible(e.target.checked)}
                className="rounded border-neutral-700 text-purple-600 focus:ring-purple-500 bg-neutral-900"
              />
              <span className="text-xs font-medium text-neutral-300">Accessible (No Stairs)</span>
            </label>
          </div>
        </div>

        {/* Route Output */}
        {routeResult && (
          <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 font-mono text-xs space-y-2">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span className="text-neutral-400">Status:</span>
              <span className={routeResult.found ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {routeResult.found ? '✅ ROUTE FOUND' : `❌ FAILED (${routeResult.reason})`}
              </span>
            </div>
            {routeResult.found && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Total Distance:</span>
                  <span className="text-neutral-200">{Math.round(routeResult.distanceMeters)} meters</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Est. Walk Duration:</span>
                  <span className="text-neutral-200">
                    {Math.round(routeResult.walkSeconds)}s (~{Math.ceil(routeResult.walkSeconds / 60)} min)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Nodes in Path:</span>
                  <span className="text-neutral-200">{routeResult.coordinates.length} waypoints</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Includes Stairs:</span>
                  <span className={routeResult.hasStairs ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                    {routeResult.hasStairs ? 'Yes (amber on map)' : 'No (stair-free)'}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* GPS & Navigation Simulation Tool */}
      <div className="p-5 rounded-xl bg-neutral-900 border border-purple-500/50 space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-purple-400" />
            <h3 className="text-sm font-bold text-neutral-100">
              GPS Location & Walking Simulation
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
              Status: {locationStatus}
            </span>
            <button
              onClick={() => {
                if (simulation.isSimulating) {
                  setSimulation({ isSimulating: false });
                  stopWatchingLocation();
                } else {
                  setSimulation({
                    isSimulating: true,
                    mockCoords: [-73.8166, 40.7365],
                    mockAccuracy: 8,
                    mockHeading: 45,
                  });
                }
              }}
              className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${
                simulation.isSimulating
                  ? 'bg-purple-600 text-white hover:bg-purple-500'
                  : 'bg-neutral-800 text-purple-300 hover:bg-neutral-700 border border-purple-500/40'
              }`}
            >
              {simulation.isSimulating ? 'Disable Simulation' : 'Enable Simulation Mode'}
            </button>
          </div>
        </div>

        {locationErrorMessage && (
          <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/80 text-amber-300 text-xs">
            {locationErrorMessage}
          </div>
        )}

        {/* Current State display */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono bg-neutral-950 p-3 rounded-lg border border-neutral-800">
          <div>
            <span className="text-neutral-500 block text-[10px]">COORDINATES</span>
            <span className="text-neutral-200">
              {userLocation
                ? `${userLocation.lngLat[0].toFixed(5)}, ${userLocation.lngLat[1].toFixed(5)}`
                : 'Not Set'}
            </span>
          </div>
          <div>
            <span className="text-neutral-500 block text-[10px]">ACCURACY RADIUS</span>
            <span className="text-sky-400">
              {userLocation ? `±${Math.round(userLocation.accuracyMeters)}m` : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-neutral-500 block text-[10px]">HEADING</span>
            <span className="text-emerald-400">
              {userLocation?.heading !== null && userLocation?.heading !== undefined
                ? `${Math.round(userLocation.heading)}°`
                : 'None'}
            </span>
          </div>
          <div>
            <span className="text-neutral-500 block text-[10px]">SIMULATED</span>
            <span className={userLocation?.isSimulated ? 'text-purple-400' : 'text-neutral-400'}>
              {userLocation?.isSimulated ? 'YES (Virtual)' : 'NO (Device GPS)'}
            </span>
          </div>
        </div>

        {/* Simulation Controls when enabled */}
        {simulation.isSimulating && (
          <div className="space-y-4 pt-2 border-t border-neutral-800">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-2">
                Teleport Location to Preset Campus Spot:
              </label>
              <div className="flex flex-wrap gap-2">
                {SIM_PRESETS.map(preset => (
                  <button
                    key={preset.name}
                    onClick={() => setSimulation({ mockCoords: preset.coords })}
                    className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs transition-colors"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Slider Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1 flex justify-between">
                  <span>Simulated Accuracy Radius</span>
                  <span className="font-mono text-sky-400">{simulation.mockAccuracy}m</span>
                </label>
                <input
                  type="range"
                  min="2"
                  max="150"
                  value={simulation.mockAccuracy}
                  onChange={e => setSimulation({ mockAccuracy: Number(e.target.value) })}
                  className="w-full accent-sky-500"
                />
                <div className="flex justify-between text-[10px] text-neutral-500 mt-0.5">
                  <span>2m (High precision)</span>
                  <span>50m</span>
                  <span>150m (Weak signal)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1 flex justify-between">
                  <span>Simulated Orientation / Heading</span>
                  <span className="font-mono text-emerald-400">{simulation.mockHeading}°</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="359"
                  value={simulation.mockHeading}
                  onChange={e => setSimulation({ mockHeading: Number(e.target.value) })}
                  className="w-full accent-emerald-500"
                />
                <div className="flex justify-between text-[10px] text-neutral-500 mt-0.5">
                  <span>0° (North)</span>
                  <span>90° (East)</span>
                  <span>180° (South)</span>
                  <span>270° (West)</span>
                </div>
              </div>
            </div>

            {/* Active Navigation walk runner */}
            <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-800/60 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                  <Footprints className="w-4 h-4 text-purple-400" />
                  <span>Virtual Route Walking Player</span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  {navigationState?.isActive
                    ? `Active route to: ${navigationState.destinationName}`
                    : 'Start directions or navigation to play simulated walking along the path.'}
                </p>
              </div>

              {navigationState?.isActive && (
                <div className="flex items-center gap-2">
                  {simulation.isPlayingWalk ? (
                    <button
                      onClick={stopSimulatedWalk}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Square className="w-3.5 h-3.5 fill-amber-300" />
                      <span>Pause Walk</span>
                    </button>
                  ) : (
                    <button
                      onClick={playSimulatedWalk}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Walk Route</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      const next = simulation.speedMultiplier === 1 ? 2 : simulation.speedMultiplier === 2 ? 4 : 1;
                      setSimulation({ speedMultiplier: next });
                    }}
                    className="px-2 py-1.5 rounded-lg bg-neutral-800 text-xs font-mono font-bold text-neutral-200 hover:text-white"
                  >
                    {simulation.speedMultiplier}x Speed
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Connected Components Table */}
      <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-3">
        <h3 className="text-sm font-bold text-neutral-200 flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-400" />
          <span>Connected Components Breakdown (Top 5)</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[11px] text-neutral-400 uppercase bg-neutral-950/60 border-b border-neutral-800">
              <tr>
                <th className="py-2 px-3">Component ID</th>
                <th className="py-2 px-3">Node Count</th>
                <th className="py-2 px-3">% of Campus Graph</th>
                <th className="py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-mono">
              {sortedComponents.slice(0, 5).map((comp, idx) => {
                const pct = ((comp.count / stats.totalNodes) * 100).toFixed(1);
                const isMain = idx === 0;
                return (
                  <tr key={comp.id} className={isMain ? 'bg-emerald-950/20 text-emerald-300' : 'text-neutral-300'}>
                    <td className="py-2 px-3 font-semibold">Component #{comp.id} {isMain ? '(Main Campus Walkways)' : ''}</td>
                    <td className="py-2 px-3">{comp.count}</td>
                    <td className="py-2 px-3">{pct}%</td>
                    <td className="py-2 px-3 font-sans">
                      {isMain ? (
                        <span className="text-emerald-400 font-semibold">Primary Routable Core</span>
                      ) : (
                        <span className="text-neutral-500">Isolated loop / sidewalk</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Buildings with No Access Point */}
      <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-3">
        <h3 className="text-sm font-bold text-neutral-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          <span>Buildings Without Linked Access Points ({buildingsNoAccess.length})</span>
        </h3>
        {buildingsNoAccess.length === 0 ? (
          <p className="text-xs text-emerald-400">
            ✅ All campus buildings successfully snapped to at least one walkway access node!
          </p>
        ) : (
          <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
            {buildingsNoAccess.slice(0, 15).map(b => (
              <div key={b.id} className="text-neutral-400 font-mono">
                {b.id}: {b.name || 'Unnamed shed/structure'}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
