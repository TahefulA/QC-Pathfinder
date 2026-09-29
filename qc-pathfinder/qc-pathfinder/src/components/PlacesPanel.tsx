import React from 'react';
import { useAppStore } from '../lib/store';
import { Place } from '../lib/types';
import {
  Coffee,
  GraduationCap,
  MapPin,
  Navigation,
  Plus,
  Star,
  Trash2,
  Users,
} from 'lucide-react';

interface PlacesPanelProps {
  onAddStopWithPlace: (placeId: string) => void;
}

export const PlacesPanel: React.FC<PlacesPanelProps> = ({ onAddStopWithPlace }) => {
  const {
    customPlaces,
    favorites,
    graphData,
    isDroppingPin,
    setIsDroppingPin,
    deleteCustomPlace,
    toggleFavorite,
    setDirectionsDestination,
    setActiveTab,
  } = useAppStore();

  const favoriteBuildings = (graphData?.buildings || []).filter(b =>
    favorites.includes(b.id)
  );

  return (
    <div className="flex flex-col h-full bg-neutral-900 border-r border-neutral-800 text-neutral-100 overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800 bg-neutral-900/90 backdrop-blur-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-purple-400" />
          <h2 className="text-base font-bold text-neutral-100">Saved Campus Places</h2>
        </div>

        <button
          onClick={() => setIsDroppingPin(!isDroppingPin)}
          className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-sm transition-all cursor-pointer ${
            isDroppingPin
              ? 'bg-purple-700 text-white ring-2 ring-purple-400 animate-pulse'
              : 'bg-purple-600 hover:bg-purple-500 text-white'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isDroppingPin ? 'Click Map to Pin' : 'Drop Pin'}</span>
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Custom Places Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Custom Pins & Hangouts ({customPlaces.length})
            </h3>
          </div>

          {customPlaces.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-neutral-800 text-center text-xs text-neutral-400">
              <p className="mb-2">No custom places added yet.</p>
              <button
                onClick={() => setIsDroppingPin(true)}
                className="text-purple-400 hover:text-purple-300 font-semibold"
              >
                Click "Drop Pin" to save a hangout lawn or bench!
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {customPlaces.map(place => (
                <div
                  key={place.id}
                  className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/90 hover:border-neutral-700 flex flex-col gap-2 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl p-1 bg-neutral-900 rounded-lg border border-neutral-800">
                        {place.emoji || '📍'}
                      </span>
                      <div>
                        <h4 className="text-sm font-semibold text-neutral-100">
                          {place.name}
                        </h4>
                        <span className="text-[11px] text-purple-400 capitalize">
                          {place.category}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => deleteCustomPlace(place.id)}
                      className="p-1 text-neutral-500 hover:text-rose-400 transition-colors"
                      title="Delete place"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {place.notes && (
                    <p className="text-xs text-neutral-400 italic bg-neutral-900/50 p-1.5 rounded">
                      "{place.notes}"
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-1 text-xs">
                    <button
                      onClick={() => onAddStopWithPlace(place.id)}
                      className="flex-1 py-1 px-2 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-center transition-colors font-medium text-[11px]"
                    >
                      + Add to Schedule
                    </button>
                    <button
                      onClick={() => {
                        setDirectionsDestination(place.id);
                        setActiveTab('directions');
                      }}
                      className="flex-1 py-1 px-2 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-center transition-colors font-medium text-[11px] flex items-center justify-center gap-1"
                    >
                      <Navigation className="w-3 h-3 text-sky-400" />
                      <span>Directions</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Favorite Buildings Section */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
            Starred Buildings ({favoriteBuildings.length})
          </h3>

          {favoriteBuildings.length === 0 ? (
            <p className="text-xs text-neutral-500 italic">
              Star any building on the map popup to quickly access it here.
            </p>
          ) : (
            <div className="space-y-1.5">
              {favoriteBuildings.map(b => (
                <div
                  key={b.id}
                  className="p-2.5 rounded-lg bg-neutral-950/40 border border-neutral-800 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <GraduationCap className="w-4 h-4 text-sky-400 shrink-0" />
                    <span className="text-xs font-medium text-neutral-200 truncate">
                      {b.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onAddStopWithPlace(b.id)}
                      className="text-[11px] px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
                    >
                      + Stop
                    </button>
                    <button
                      onClick={() => toggleFavorite(b.id)}
                      className="p-1 text-amber-400 hover:text-neutral-400 transition-colors"
                      title="Unstar"
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
