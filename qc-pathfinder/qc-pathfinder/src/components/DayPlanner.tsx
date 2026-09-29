import React, { useMemo } from 'react';
import { useAppStore } from '../lib/store';
import { computeLeg, format12Hour, getLegDescription } from '../lib/time';
import { calculateRoute } from '../lib/routing';
import { Place, Stop, TimelineLeg } from '../lib/types';
import {
  AlertOctagon,
  AlertTriangle,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  Coffee,
  Edit2,
  Footprints,
  GraduationCap,
  HelpCircle,
  MapPin,
  Navigation,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  class: <GraduationCap className="w-3.5 h-3.5 text-sky-400" />,
  food: <Coffee className="w-3.5 h-3.5 text-amber-400" />,
  study: <Building className="w-3.5 h-3.5 text-emerald-400" />,
  hangout: <Users className="w-3.5 h-3.5 text-purple-400" />,
  other: <MapPin className="w-3.5 h-3.5 text-neutral-400" />,
};

interface DayPlannerProps {
  onOpenAddModal: (stopToEdit?: Stop) => void;
}

export const DayPlanner: React.FC<DayPlannerProps> = ({ onOpenAddModal }) => {
  const {
    stops,
    selectedDay,
    customPlaces,
    graphData,
    settings,
    selectedStopId,
    selectedLegIndex,
    userLocation,
    navigationState,
    setSelectedDay,
    setSelectedStopId,
    setSelectedLegIndex,
    deleteStop,
    loadSampleDay,
    startWatchingLocation,
    startNavigation,
  } = useAppStore();

  const dayStops = useMemo(() => {
    return stops
      .filter(s => s.days.includes(selectedDay))
      .sort((a, b) => a.start.localeCompare(b.start));
  }, [stops, selectedDay]);

  const handleNavigateToStop = (targetStop: Stop, stopIndex: number) => {
    const place = getPlace(targetStop.placeId);
    if (!place || !graphData) return;

    let destCoords: [number, number];
    let destAccessPoints: [number, number][] = [];
    if ('kind' in place && place.kind === 'building') {
      const b = graphData.buildings.find(item => item.id === place.id);
      destCoords = b ? b.center : [-73.8166, 40.7365];
      destAccessPoints =
        b?.accessNodeIds
          ?.map(nid => {
            const n = graphData.nodes[nid];
            return n ? ([n.lng, n.lat] as [number, number]) : null;
          })
          .filter((c): c is [number, number] => c !== null) || [destCoords];
    } else {
      destCoords = (place as Place).lngLat;
      destAccessPoints = [destCoords];
    }

    let originTarget;
    if (userLocation) {
      originTarget = { type: 'coord' as const, lngLat: userLocation.lngLat, label: 'My Location' };
    } else if (stopIndex > 0) {
      const prevStop = dayStops[stopIndex - 1];
      originTarget = getTarget(prevStop.placeId, graphData, customPlaces);
    } else {
      startWatchingLocation();
      originTarget = { type: 'coord' as const, lngLat: [-73.8166, 40.7365] as [number, number], label: 'Campus' };
    }

    const destTarget = getTarget(targetStop.placeId, graphData, customPlaces);
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
        destinationName: targetStop.title + (place.name ? ` (${place.name})` : ''),
        destinationCoords: destCoords,
        destinationAccessPoints: destAccessPoints,
        routeCoords: route.coordinates,
        stopId: targetStop.id,
        nextStopId: nextStop?.id,
        targetArrivalTime: targetStop.start,
      });
    }
  };

  // Compute legs between consecutive stops
  const legs: TimelineLeg[] = useMemo(() => {
    if (!graphData || dayStops.length < 2) return [];

    const result: TimelineLeg[] = [];

    for (let i = 0; i < dayStops.length - 1; i++) {
      const fromStop = dayStops[i];
      const toStop = dayStops[i + 1];

      const sameBuilding = fromStop.placeId === toStop.placeId;

      let route;
      if (!sameBuilding) {
        const fromTarget = getTarget(fromStop.placeId, graphData, customPlaces);
        const toTarget = getTarget(toStop.placeId, graphData, customPlaces);
        if (fromTarget && toTarget) {
          route = calculateRoute(fromTarget, toTarget, {
            campusGraph: graphData,
            accessible: settings.accessible,
            speedMps: settings.speedMps,
          });
        }
      }

      const leg = computeLeg(fromStop, toStop, route, settings.bufferMinutes, sameBuilding);
      result.push(leg);
    }

    return result;
  }, [dayStops, graphData, customPlaces, settings.accessible, settings.speedMps, settings.bufferMinutes]);

  function getPlace(id: string): Place | { id: string; name: string; kind: 'building' } | undefined {
    const cp = customPlaces.find(c => c.id === id);
    if (cp) return cp;
    const b = graphData?.buildings.find(item => item.id === id);
    if (b) return { id: b.id, name: b.name, kind: 'building' };
    return undefined;
  }

  function getTarget(id: string, graph: typeof graphData, customs: Place[]) {
    const cp = customs.find(c => c.id === id);
    if (cp) return { type: 'coord' as const, lngLat: cp.lngLat };
    const b = graph?.buildings.find(item => item.id === id);
    if (b) return { type: 'building' as const, buildingId: b.id };
    return null;
  }

  const todayIndex = (() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  })();

  return (
    <div className="flex flex-col h-full bg-neutral-900 border-r border-neutral-800 text-neutral-100 overflow-hidden">
      {/* Day Selector Tabs */}
      <div className="p-3 border-b border-neutral-800 bg-neutral-900/90 backdrop-blur-xs flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-bold tracking-tight text-neutral-200">Daily Schedule</h2>
          </div>

          <button
            onClick={() => setSelectedDay(todayIndex)}
            className={`text-[11px] px-2 py-0.5 rounded font-medium transition-colors ${
              selectedDay === todayIndex
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                : 'text-neutral-400 hover:text-neutral-200 bg-neutral-800 border border-neutral-700/60'
            }`}
          >
            Today
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 bg-neutral-950/60 p-1 rounded-lg border border-neutral-800/80">
          {DAYS.map((day, idx) => {
            const isSelected = selectedDay === idx;
            const hasStops = stops.some(s => s.days.includes(idx));
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(idx)}
                className={`flex flex-col items-center justify-center py-1.5 rounded-md transition-all text-xs font-semibold ${
                  isSelected
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
                }`}
              >
                <span>{day}</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full mt-1 ${
                    hasStops
                      ? isSelected
                        ? 'bg-white'
                        : 'bg-sky-400'
                      : 'bg-transparent'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Header: Add Stop & Day Summary */}
      <div className="px-4 py-2.5 bg-neutral-900/50 border-b border-neutral-800/80 flex items-center justify-between">
        <span className="text-xs text-neutral-400">
          {dayStops.length} {dayStops.length === 1 ? 'stop' : 'stops'} planned
        </span>

        <button
          onClick={() => onOpenAddModal()}
          className="flex items-center gap-1.5 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white px-2.5 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Stop</span>
        </button>
      </div>

      {/* Timeline Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {dayStops.length === 0 ? (
          <div className="text-center py-12 px-4 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-neutral-800/80 border border-neutral-700/80 flex items-center justify-center text-neutral-400 mb-3">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-200 mb-1">
              No stops scheduled for {DAYS[selectedDay]}
            </h3>
            <p className="text-xs text-neutral-400 max-w-xs mb-4 leading-relaxed">
              Add your classes, study sessions, or hangout spots to calculate your campus walking route and transition times.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs">
              <button
                onClick={() => onOpenAddModal()}
                className="flex-1 py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Class / Stop</span>
              </button>
              <button
                onClick={() => loadSampleDay()}
                className="py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Try Sample Day</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            {dayStops.map((stop, index) => {
              const place = getPlace(stop.placeId);
              const isSelected = selectedStopId === stop.id;
              const legToNext = legs[index];

              return (
                <div key={stop.id} className="relative">
                  {/* Stop Card */}
                  <div
                    onClick={() => setSelectedStopId(isSelected ? null : stop.id)}
                    className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-neutral-800 border-sky-500 ring-2 ring-sky-500/30 shadow-lg'
                        : 'bg-neutral-900/90 hover:bg-neutral-800/80 border-neutral-800 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-sky-950 text-sky-400 border border-sky-800/80 flex items-center justify-center text-xs font-bold shrink-0">
                          {index + 1}
                        </span>
                        <div>
                          <h4 className="text-sm font-semibold text-neutral-100 group-hover:text-sky-300 transition-colors">
                            {stop.title}
                          </h4>
                          <div className="flex items-center gap-1.5 text-xs text-neutral-400 mt-0.5">
                            {CATEGORY_ICONS[stop.type]}
                            <span>{place?.name || 'Unknown Location'}</span>
                            {stop.room && (
                              <span className="text-neutral-500">• {stop.room}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-mono font-medium text-neutral-300">
                          {format12Hour(stop.start)}
                        </div>
                        <div className="text-[11px] font-mono text-neutral-500">
                          {format12Hour(stop.end)}
                        </div>
                      </div>
                    </div>

                    {stop.notes && (
                      <p className="mt-2 text-[11px] text-neutral-400 italic bg-neutral-950/40 px-2 py-1 rounded border border-neutral-800/60">
                        "{stop.notes}"
                      </p>
                    )}

                    {/* Quick action buttons on hover / select */}
                    <div className="mt-2 pt-2 border-t border-neutral-800 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-neutral-500">
                        Repeats: {stop.days.map(d => DAYS[d]).join(', ')}
                      </span>
                      <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNavigateToStop(stop, index);
                          }}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
                            navigationState?.destinationId === stop.placeId && navigationState.isActive
                              ? 'bg-sky-500 text-white border-sky-400'
                              : 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border-sky-500/30'
                          }`}
                          title="Start walking navigation to this stop"
                        >
                          <Navigation className="w-3 h-3" />
                          <span>{navigationState?.destinationId === stop.placeId && navigationState.isActive ? 'Navigating' : 'Navigate'}</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStopId(stop.id);
                          }}
                          className="p-1 text-neutral-400 hover:text-amber-400 rounded hover:bg-neutral-700/50 transition-colors"
                          title="Locate & Move on 3D Map"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenAddModal(stop);
                          }}
                          className="p-1 text-neutral-400 hover:text-sky-400 rounded hover:bg-neutral-700/50 transition-colors"
                          title="Edit Stop Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteStop(stop.id);
                          }}
                          className="p-1 text-neutral-400 hover:text-rose-400 rounded hover:bg-neutral-700/50 transition-colors"
                          title="Delete Stop"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Transition Leg between consecutive stops */}
                  {legToNext && (
                    <div className="my-2 px-3 py-2 flex items-center justify-between">
                      <button
                        onClick={() => setSelectedLegIndex(selectedLegIndex === index ? null : index)}
                        className={`w-full flex items-center justify-between gap-2 p-2 rounded-lg border text-left transition-all ${
                          selectedLegIndex === index
                            ? 'bg-amber-500/10 border-amber-500/60 ring-1 ring-amber-500/40'
                            : 'bg-neutral-950/70 hover:bg-neutral-950 border-neutral-800/90'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Footprints className="w-4 h-4 text-neutral-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-neutral-200 font-medium truncate">
                              {getLegDescription(legToNext)}
                            </p>
                            <p className="text-[10px] text-neutral-500">
                              {legToNext.sameBuilding
                                ? 'No walking between stops'
                                : `${legToNext.route?.distanceMeters || 0}m route • Buffer: ${settings.bufferMinutes}m`}
                            </p>
                          </div>
                        </div>

                        {/* Status Tag with Label AND Icon */}
                        <div className="shrink-0 flex items-center gap-1">
                          {legToNext.status === 'comfortable' && (
                            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{legToNext.statusLabel}</span>
                            </span>
                          )}
                          {legToNext.status === 'tight' && (
                            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">
                              <AlertTriangle className="w-3 h-3" />
                              <span>{legToNext.statusLabel}</span>
                            </span>
                          )}
                          {legToNext.status === 'impossible' && (
                            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                              <AlertOctagon className="w-3 h-3" />
                              <span>{legToNext.statusLabel}</span>
                            </span>
                          )}
                          {legToNext.status === 'same-building' && (
                            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30">
                              <Building className="w-3 h-3" />
                              <span>{legToNext.statusLabel}</span>
                            </span>
                          )}
                          {legToNext.status === 'no-route' && (
                            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-700/50 text-neutral-400 border border-neutral-600/40">
                              <HelpCircle className="w-3 h-3" />
                              <span>{legToNext.statusLabel}</span>
                            </span>
                          )}
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="p-3 bg-neutral-950/80 border-t border-neutral-800 text-[11px] text-neutral-400 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-neutral-400" />
          <span>Buffer: {settings.bufferMinutes} min/stop</span>
        </span>
        <button
          onClick={() => loadSampleDay()}
          className="text-amber-400 hover:text-amber-300 transition-colors font-medium flex items-center gap-1"
        >
          <Sparkles className="w-3 h-3" />
          <span>Reset to Sample Schedule</span>
        </button>
      </div>
    </div>
  );
};
