import React, { useMemo, useState } from 'react';
import { useAppStore } from '../lib/store';
import { snapToNearestNode } from '../lib/geo';
import { PlaceCategory } from '../lib/types';
import { AlertTriangle, CheckCircle2, MapPin, X } from 'lucide-react';

interface AddCustomPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  coordinates: [number, number] | null;
}

const EMOJI_OPTIONS = ['🌳', '☕', '🍕', '📚', '🪑', '📍', '☀️', '🎒', '🥪', '🎨'];

export const AddCustomPinModal: React.FC<AddCustomPinModalProps> = ({
  isOpen,
  onClose,
  coordinates,
}) => {
  const { graphData, addCustomPlace, setIsDroppingPin } = useAppStore();

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🌳');
  const [category, setCategory] = useState<PlaceCategory>('hangout');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const snapInfo = useMemo(() => {
    if (!coordinates || !graphData) return null;
    return snapToNearestNode(coordinates, graphData.nodes, 80);
  }, [coordinates, graphData]);

  if (!isOpen || !coordinates) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide a name for this location.');
      return;
    }

    if (!snapInfo || !snapInfo.snapped) {
      setError(snapInfo?.error || 'This point is too far from campus walkways (max 80m).');
      return;
    }

    addCustomPlace({
      name: name.trim(),
      category,
      lngLat: coordinates,
      emoji,
      notes: notes.trim() || undefined,
    });

    setIsDroppingPin(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden text-neutral-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-base text-neutral-100">Save Custom Place</h3>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 p-1 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Snapping feedback */}
          {snapInfo?.snapped ? (
            <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Snaps {Math.round(snapInfo.distanceMeters || 0)}m to campus walkway network.</span>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Too far from campus paths (&gt;80m). Cannot route to this point.</span>
            </div>
          )}

          {/* Emoji Picker */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Choose Icon
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_OPTIONS.map(em => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setEmoji(em)}
                  className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center border transition-all ${
                    emoji === em
                      ? 'bg-purple-600/30 border-purple-500 scale-110'
                      : 'bg-neutral-950 border-neutral-800 hover:bg-neutral-800'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* Place Name */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Place Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Quad Picnic Table, Coffee Cart, Secret Bench"
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-lg text-sm text-neutral-100 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as PlaceCategory)}
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-lg text-sm text-neutral-100 focus:outline-none focus:border-purple-500"
            >
              <option value="hangout">Hangout / Social</option>
              <option value="food">Food & Coffee</option>
              <option value="study">Study Spot</option>
              <option value="class">Class / Lab</option>
              <option value="other">Other Spot</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Notes (optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Good shade under the tree, power outlet nearby"
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-lg text-sm text-neutral-100 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!snapInfo?.snapped}
              className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-semibold shadow-md transition-colors"
            >
              Save Place
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
