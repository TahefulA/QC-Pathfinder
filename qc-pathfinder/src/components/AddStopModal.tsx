import React, { useState } from 'react';
import { useAppStore } from '../lib/store';
import { PlaceCategory, Stop } from '../lib/types';
import { timeStringToMinutes } from '../lib/time';
import {
  AlertTriangle,
  Building,
  Calendar,
  Clock,
  Coffee,
  GraduationCap,
  MapPin,
  Users,
  X,
} from 'lucide-react';

const DAYS = [
  { label: 'M', full: 'Mon', index: 0 },
  { label: 'T', full: 'Tue', index: 1 },
  { label: 'W', full: 'Wed', index: 2 },
  { label: 'Th', full: 'Thu', index: 3 },
  { label: 'F', full: 'Fri', index: 4 },
  { label: 'Sa', full: 'Sat', index: 5 },
  { label: 'Su', full: 'Sun', index: 6 },
];

const CATEGORIES: Array<{ id: PlaceCategory; label: string; icon: any }> = [
  { id: 'class', label: 'Class', icon: GraduationCap },
  { id: 'food', label: 'Food / Dining', icon: Coffee },
  { id: 'study', label: 'Study', icon: Building },
  { id: 'hangout', label: 'Hangout', icon: Users },
  { id: 'other', label: 'Other', icon: MapPin },
];

interface AddStopModalProps {
  isOpen: boolean;
  onClose: () => void;
  stopToEdit?: Stop;
  initialPlaceId?: string;
}

export const AddStopModal: React.FC<AddStopModalProps> = ({
  isOpen,
  onClose,
  stopToEdit,
  initialPlaceId,
}) => {
  const {
    stops,
    selectedDay,
    graphData,
    customPlaces,
    addStop,
    updateStop,
  } = useAppStore();

  const [title, setTitle] = useState(stopToEdit?.title || '');
  const [placeId, setPlaceId] = useState(stopToEdit?.placeId || initialPlaceId || 'kiely-hall');
  const [room, setRoom] = useState(stopToEdit?.room || '');
  const [type, setType] = useState<PlaceCategory>(stopToEdit?.type || 'class');
  const [days, setDays] = useState<number[]>(stopToEdit?.days || [selectedDay]);
  const [start, setStart] = useState(stopToEdit?.start || '09:00');
  const [end, setEnd] = useState(stopToEdit?.end || '10:15');
  const [notes, setNotes] = useState(stopToEdit?.notes || '');
  const [error, setError] = useState<string | null>(null);

  // Compile list of available locations (must be called unconditionally before any return)
  const availablePlaces = React.useMemo(() => {
    const list: Array<{ id: string; name: string; isCustom: boolean }> = [];
    const seen = new Set<string>();

    customPlaces.forEach(p => {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        list.push({
          id: p.id,
          name: `${p.emoji || '📍'} ${p.name}`,
          isCustom: true,
        });
      }
    });

    if (graphData?.buildings) {
      const namedBuildings = graphData.buildings
        .filter(b => b.name && b.name.trim().length > 0)
        .sort((a, b) => a.name.localeCompare(b.name));

      namedBuildings.forEach(b => {
        if (!seen.has(b.id)) {
          seen.add(b.id);
          list.push({
            id: b.id,
            name: b.name,
            isCustom: false,
          });
        }
      });
    }

    return list;
  }, [customPlaces, graphData]);

  // Synchronize form fields when opening modal or editing different stops
  React.useEffect(() => {
    if (isOpen) {
      setTitle(stopToEdit?.title || '');
      setPlaceId(stopToEdit?.placeId || initialPlaceId || 'kiely-hall');
      setRoom(stopToEdit?.room || '');
      setType(stopToEdit?.type || 'class');
      setDays(stopToEdit?.days || [selectedDay]);
      setStart(stopToEdit?.start || '09:00');
      setEnd(stopToEdit?.end || '10:15');
      setNotes(stopToEdit?.notes || '');
      setError(null);
    }
  }, [isOpen, stopToEdit, initialPlaceId, selectedDay]);

  // Early return only after ALL hooks have been executed
  if (!isOpen) return null;

  const toggleDay = (dayIndex: number) => {
    if (days.includes(dayIndex)) {
      if (days.length > 1) {
        setDays(days.filter(d => d !== dayIndex));
      }
    } else {
      setDays([...days, dayIndex].sort());
    }
  };

  // Check for overlaps (warning, not blocking)
  const overlaps = days.flatMap(d => {
    const startMins = timeStringToMinutes(start);
    const endMins = timeStringToMinutes(end);

    return stops
      .filter(s => s.id !== stopToEdit?.id && s.days.includes(d))
      .filter(s => {
        const sStart = timeStringToMinutes(s.start);
        const sEnd = timeStringToMinutes(s.end);
        return (startMins < sEnd && endMins > sStart);
      })
      .map(s => ({
        day: DAYS[d].full,
        stopTitle: s.title,
        time: `${s.start}-${s.end}`,
      }));
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Please provide a title for the stop.');
      return;
    }

    if (!placeId) {
      setError('Please choose a campus location.');
      return;
    }

    const startMins = timeStringToMinutes(start);
    const endMins = timeStringToMinutes(end);

    if (endMins <= startMins) {
      setError('End time must be later than start time.');
      return;
    }

    if (days.length === 0) {
      setError('Please select at least one day.');
      return;
    }

    if (stopToEdit) {
      updateStop(stopToEdit.id, {
        title: title.trim(),
        placeId,
        room: room.trim() || undefined,
        type,
        days,
        start,
        end,
        notes: notes.trim() || undefined,
      });
    } else {
      addStop({
        title: title.trim(),
        placeId,
        room: room.trim() || undefined,
        type,
        days,
        start,
        end,
        notes: notes.trim() || undefined,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden text-neutral-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-sky-400" />
            <h3 className="font-bold text-base text-neutral-100">
              {stopToEdit ? 'Edit Campus Stop' : 'Add Campus Stop'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 p-1 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Stop Title / Course Name *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. CSCI 211, Lunch with study group"
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-lg text-sm text-neutral-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* Place Picker */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Campus Location *
            </label>
            <select
              value={placeId}
              onChange={e => setPlaceId(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-lg text-sm text-neutral-100 focus:outline-none focus:border-sky-500"
            >
              {availablePlaces.map(p => (
                <option key={p.id} value={p.id}>
                  {p.isCustom ? `[Custom Spot] ${p.name}` : p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Room Number */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Room / Detail (optional)
            </label>
            <input
              type="text"
              value={room}
              onChange={e => setRoom(e.target.value)}
              placeholder="e.g. Room 205, Lecture Hall C, Quad Bench"
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-lg text-sm text-neutral-100 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Category Type */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Category
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const isSelected = type === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setType(cat.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-sky-600/20 border-sky-500 text-sky-300'
                        : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                    }`}
                  >
                    <Icon className="w-4 h-4 mb-1" />
                    <span className="text-[11px] truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Repeating Days */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Days of Week
            </label>
            <div className="grid grid-cols-7 gap-1">
              {DAYS.map(d => {
                const isSelected = days.includes(d.index);
                return (
                  <button
                    key={d.index}
                    type="button"
                    onClick={() => toggleDay(d.index)}
                    className={`py-2 rounded-md font-semibold text-xs transition-colors ${
                      isSelected
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Start and End Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                <span>Start Time</span>
              </label>
              <input
                type="time"
                required
                value={start}
                onChange={e => setStart(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-lg text-sm text-neutral-100 font-mono focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                <span>End Time</span>
              </label>
              <input
                type="time"
                required
                value={end}
                onChange={e => setEnd(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-lg text-sm text-neutral-100 font-mono focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Overlap Warning (doesn't block) */}
          {overlaps.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Schedule Overlap Warning:</span> Overlaps with{' '}
                {overlaps.map(o => `"${o.stopTitle}" (${o.day} ${o.time})`).join(', ')}.
                You can still save this stop.
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Personal Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Bring syllabus, Professor office hours after class"
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-lg text-sm text-neutral-100 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Submit */}
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
              className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md transition-colors"
            >
              {stopToEdit ? 'Save Changes' : 'Add to Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
