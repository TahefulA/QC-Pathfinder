import React, { useRef, useState } from 'react';
import { useAppStore } from '../lib/store';
import { WalkingSpeed } from '../lib/types';
import {
  AlertTriangle,
  Download,
  Footprints,
  RotateCcw,
  Settings,
  Upload,
  X,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    settings,
    simulation,
    updateSettings,
    setSimulation,
    stopWatchingLocation,
    exportDataJson,
    importDataJson,
    resetAllData,
  } = useAppStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{ success?: boolean; msg?: string } | null>(null);

  if (!isOpen) return null;

  const handleExport = () => {
    const json = exportDataJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qc_pathfinder_schedule_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importDataJson(content);
      if (res.success) {
        setImportStatus({ success: true, msg: 'Schedule imported successfully!' });
      } else {
        setImportStatus({ success: false, msg: res.error || 'Failed to parse JSON file' });
      }
    };
    reader.readAsText(file);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden text-neutral-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-sky-400" />
            <h2 className="text-lg font-bold text-neutral-100">Preferences & Data</h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Walking Speed */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-2 flex items-center gap-1.5">
              <Footprints className="w-4 h-4 text-sky-400" />
              <span>Walking Pace Profile</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'slow', label: 'Relaxed / Slow', speed: '1.0 m/s (~2.2 mph)' },
                { id: 'normal', label: 'Average / Normal', speed: '1.3 m/s (~2.9 mph)' },
                { id: 'fast', label: 'Brisk / Fast', speed: '1.6 m/s (~3.6 mph)' },
              ].map(opt => {
                const isSelected = settings.speed === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => updateSettings({ speed: opt.id as WalkingSpeed })}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'bg-sky-600/20 border-sky-500 text-sky-200 ring-1 ring-sky-500/50'
                        : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:bg-neutral-800/50'
                    }`}
                  >
                    <span className="text-xs font-semibold text-neutral-200">{opt.label}</span>
                    <span className="text-[10px] text-neutral-500 mt-1">{opt.speed}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Buffer Time */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Transition Arrival Buffer
            </label>
            <p className="text-xs text-neutral-400 mb-2">
              Minutes added to each walk leg to ensure you arrive before the professor starts lecture or to find a seat.
            </p>
            <div className="flex gap-2">
              {[0, 1, 2, 3, 5].map(mins => (
                <button
                  key={mins}
                  onClick={() => updateSettings({ bufferMinutes: mins })}
                  className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-all ${
                    settings.bufferMinutes === mins
                      ? 'bg-sky-600 text-white border-sky-500'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:bg-neutral-800'
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </div>

          {/* Accessible Mode */}
          <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.accessible}
                onChange={e => updateSettings({ accessible: e.target.checked })}
                className="mt-1 rounded border-neutral-700 text-sky-600 focus:ring-sky-500 bg-neutral-900"
              />
              <div>
                <span className="text-sm font-semibold text-neutral-200">
                  Avoid Outdoor Stairs (Best-effort Accessible Mode)
                </span>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  Routes will detour around flights of stairs mapped on OpenStreetMap.
                  Note: Never claim ADA compliance; terrain and conditions may vary.
                </p>
              </div>
            </label>
          </div>

          {/* Location Simulation Mode */}
          <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={simulation.isSimulating}
                onChange={e => {
                  if (e.target.checked) {
                    setSimulation({
                      isSimulating: true,
                      mockCoords: [-73.8166, 40.7365],
                      mockAccuracy: 8,
                      mockHeading: 45,
                    });
                  } else {
                    setSimulation({ isSimulating: false });
                    stopWatchingLocation();
                  }
                }}
                className="mt-1 rounded border-neutral-700 text-purple-600 focus:ring-purple-500 bg-neutral-900"
              />
              <div>
                <span className="text-sm font-semibold text-neutral-200 flex items-center gap-1.5">
                  <span>Location Simulation Mode</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Testing
                  </span>
                </span>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  Simulates a GPS position on Queens College campus for off-campus testing and demonstrations. Virtual walk playback is available in the Diagnostics tab.
                </p>
              </div>
            </label>
          </div>

          {/* Import / Export JSON */}
          <div className="pt-2 border-t border-neutral-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">
              Backup, Export & Import
            </h3>

            {importStatus && (
              <div
                className={`p-3 rounded-lg text-xs font-medium mb-3 border ${
                  importStatus.success
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                }`}
              >
                {importStatus.msg}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleExport}
                className="py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-sky-400" />
                <span>Export Schedule JSON</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-purple-400" />
                <span>Import Schedule JSON</span>
              </button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json"
                className="hidden"
              />
            </div>
          </div>

          {/* Reset */}
          <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-neutral-300">Clear All Stored Data</div>
              <div className="text-[11px] text-neutral-500">Remove all custom stops, places, and reset settings</div>
            </div>

            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to reset all your stops and places?')) {
                  resetAllData();
                  onClose();
                }
              }}
              className="py-1.5 px-3 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-rose-300 text-xs font-semibold transition-colors"
            >
              Reset Data
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-950/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
