import React, { useMemo } from 'react';
import { useAppStore } from '../lib/store';
import { calculateRoute } from '../lib/routing';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Compass,
  Crosshair,
  Footprints,
  Info,
  Navigation,
  Sparkles,
  Zap,
} from 'lucide-react';

export const DirectionsPanel: React.FC = () => {
  const {
    graphData,
    customPlaces,
    directionsOrigin,
    directionsDestination,
    settings,
    userLocation,
    locationStatus,
    navigationState,
    setDirectionsOrigin,
    setDirectionsDestination,
    updateSettings,
    startWatchingLocation,
    startNavigation,
    endNavigation,
  } = useAppStore();

  const placesList = useMemo(() => {
    const items: Array<{ id: string; name: string; type: 'building' | 'custom' }> = [];
    const seen = new Set<string>();

    customPlaces.forEach(p => {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        items.push({ id: p.id, name: `${p.emoji || '📍'} ${p.name}`, type: 'custom' });
      }
    });

    if (graphData?.buildings) {
      graphData.buildings
        .filter(b => b.name && b.name.trim().length > 0)
        .forEach(b => {
          if (!seen.has(b.id)) {
            seen.add(b.id);
            items.push({ id: b.id, name: b.name, type: 'building' });
          }
        });
    }

    return items.sort((a, b) => a.name.localeCompare(b.name));
  }, [graphData, customPlaces]);

  // Compute active route between directionsOrigin and directionsDestination
  const routeResult = useMemo(() => {
    if (!graphData || !directionsOrigin || !directionsDestination) return null;

    function getTarget(id: string) {
      if (id === 'my-location') {
        if (userLocation) {
          return { type: 'coord' as const, lngLat: userLocation.lngLat, label: 'My Location' };
        }
        return { type: 'coord' as const, lngLat: [-73.8166, 40.7365] as [number, number], label: 'My Location' };
      }
      const cp = customPlaces.find(c => c.id === id);
      if (cp) return { type: 'coord' as const, lngLat: cp.lngLat };
      const b = graphData?.buildings.find(item => item.id === id);
      if (b) return { type: 'building' as const, buildingId: b.id };
      return null;
    }

    const originTarget = getTarget(directionsOrigin);
    const destTarget = getTarget(directionsDestination);

    if (!originTarget || !destTarget) return null;

    return calculateRoute(originTarget, destTarget, {
      campusGraph: graphData,
      accessible: settings.accessible,
      speedMps: settings.speedMps,
    });
  }, [graphData, customPlaces, directionsOrigin, directionsDestination, userLocation, settings.accessible, settings.speedMps]);

  const handleSwap = () => {
    const temp = directionsOrigin;
    setDirectionsOrigin(directionsDestination);
    setDirectionsDestination(temp);
  };

  return (
    <div className="flex flex-col h-full bg-neutral-900 border-r border-neutral-800 text-neutral-100 overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800 bg-neutral-900/90 backdrop-blur-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="w-5 h-5 text-sky-400" />
          <h2 className="text-base font-bold text-neutral-100">Campus Directions</h2>
        </div>
      </div>

      {/* Origin / Destination Selectors */}
      <div className="p-4 border-b border-neutral-800 bg-neutral-950/40 space-y-3">
        {/* Origin */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-neutral-400">
              From (Origin)
            </label>
            <button
              type="button"
              onClick={() => {
                if (!userLocation) {
                  startWatchingLocation();
                }
                setDirectionsOrigin('my-location');
              }}
              className={`text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                directionsOrigin === 'my-location'
                  ? 'text-sky-400'
                  : 'text-neutral-400 hover:text-sky-400'
              }`}
            >
              <Crosshair className="w-3 h-3" />
              <span>Start from my location</span>
            </button>
          </div>
          <select
            value={directionsOrigin || ''}
            onChange={e => setDirectionsOrigin(e.target.value || null)}
            className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-neutral-100 focus:outline-none focus:border-sky-500"
          >
            <option value="">Select origin place...</option>
            <option value="my-location">
              📍 My Location {userLocation ? '' : '(Locating...)'}
            </option>
            {placesList.map(p => (
              <option key={`orig-${p.id}`} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center -my-1">
          <button
            onClick={handleSwap}
            disabled={!directionsOrigin || !directionsDestination}
            className="p-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 text-neutral-300 border border-neutral-700 shadow-sm transition-colors"
            title="Swap Origin and Destination"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>

        {/* Destination */}
        <div>
          <label className="block text-xs font-semibold text-neutral-400 mb-1">
            To (Destination)
          </label>
          <select
            value={directionsDestination || ''}
            onChange={e => setDirectionsDestination(e.target.value || null)}
            className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-neutral-100 focus:outline-none focus:border-sky-500"
          >
            <option value="">Select destination place...</option>
            {placesList.map(p => (
              <option key={`dest-${p.id}`} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Accessible Mode Toggle */}
        <div className="pt-2">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={settings.accessible}
              onChange={e => updateSettings({ accessible: e.target.checked })}
              className="mt-0.5 rounded border-neutral-700 text-sky-600 focus:ring-sky-500 bg-neutral-900"
            />
            <div>
              <span className="text-xs font-semibold text-neutral-200">
                Avoids mapped stairs
              </span>
              <p className="text-[11px] text-neutral-400 leading-normal mt-0.5">
                Best-effort routing based on OpenStreetMap footway data. Does not guarantee ADA compliance.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Results Box */}
      <div className="flex-1 p-4">
        {!directionsOrigin || !directionsDestination ? (
          <div className="py-12 text-center text-neutral-400">
            <Compass className="w-10 h-10 mx-auto text-neutral-600 mb-2" />
            <p className="text-sm font-medium text-neutral-300">
              Select origin and destination
            </p>
            <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
              Choose any two buildings or dropped custom spots to see the fastest walking path across campus.
            </p>

            <div className="mt-6 flex flex-wrap gap-1.5 justify-center">
              <button
                onClick={() => {
                  setDirectionsOrigin('kiely-hall');
                  setDirectionsDestination('powdermaker-hall');
                }}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition-colors"
              >
                Kiely → Powdermaker
              </button>
              <button
                onClick={() => {
                  setDirectionsOrigin('student-union');
                  setDirectionsDestination('rosenthal-library');
                }}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition-colors"
              >
                Student Union → Library
              </button>
            </div>
          </div>
        ) : routeResult ? (
          routeResult.found ? (
            <div className="space-y-4">
              {/* Summary Card */}
              <div className="p-4 rounded-xl bg-sky-950/40 border border-sky-800/80 shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                    Walking Route
                  </span>
                  <span className="text-xs text-sky-300 font-mono">
                    {Math.round(routeResult.distanceMeters)} meters
                  </span>
                </div>

                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-3xl font-extrabold text-white">
                    {Math.ceil(routeResult.walkSeconds / 60)}
                  </span>
                  <span className="text-sm font-medium text-neutral-300">minutes walk</span>
                </div>

                <div className="flex items-center gap-3 text-xs text-neutral-300 pt-2 border-t border-sky-800/50">
                  <div className="flex items-center gap-1.5">
                    <Footprints className="w-3.5 h-3.5 text-sky-400" />
                    <span>Speed: {settings.speedMps} m/s ({settings.speed})</span>
                  </div>
                  {routeResult.hasStairs ? (
                    <div className="flex items-center gap-1 text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Includes stairs</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Stair-free</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Start Live Navigation Action Button */}
              <div>
                {navigationState?.isActive ? (
                  <div className="p-3 rounded-xl bg-sky-900/60 border border-sky-500/80 text-sky-200 flex items-center justify-between">
                    <div className="text-xs font-semibold flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
                      <span>Navigation in progress...</span>
                    </div>
                    <button
                      onClick={endNavigation}
                      className="px-3 py-1 text-xs rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-semibold transition-colors"
                    >
                      End Navigation
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      const destObj = placesList.find(p => p.id === directionsDestination);
                      const destName = destObj?.name || 'Destination';
                      const destCoord = routeResult.coordinates[routeResult.coordinates.length - 1];
                      startNavigation({
                        destinationId: directionsDestination,
                        destinationName: destName,
                        destinationCoords: destCoord,
                        routeCoords: routeResult.coordinates,
                      });
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>Start Walking Navigation</span>
                  </button>
                )}
              </div>

              {/* Route Characteristics */}
              <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800 text-xs text-neutral-400 space-y-2">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <p>
                    Routed across official OpenStreetMap footpaths and campus walkways with multi-entrance access selection.
                    {directionsOrigin === 'my-location' && ' Origin snapped to nearest walkway node with walking connector.'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-center">
              <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-rose-200 mb-1">No Route Found</h4>
              <p className="text-xs text-rose-300 leading-relaxed">
                {routeResult.reason || 'No walking path found between these campus locations.'}
              </p>
              {settings.accessible && (
                <button
                  onClick={() => updateSettings({ accessible: false })}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-rose-800 hover:bg-rose-700 text-white text-xs font-semibold transition-colors"
                >
                  Disable "Avoids stairs" mode to check for routes with stairs
                </button>
              )}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
};
