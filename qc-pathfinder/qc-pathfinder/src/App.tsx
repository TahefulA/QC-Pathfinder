import React, { useEffect, useState } from 'react';
import { useAppStore } from './lib/store';
import { Header } from './components/Header';
import { CampusMap } from './components/CampusMap';
import { DayPlanner } from './components/DayPlanner';
import { DirectionsPanel } from './components/DirectionsPanel';
import { PlacesPanel } from './components/PlacesPanel';
import { DebugView } from './components/DebugView';
import { AddStopModal } from './components/AddStopModal';
import { AddCustomPinModal } from './components/AddCustomPinModal';
import { SettingsModal } from './components/SettingsModal';
import { AboutModal } from './components/AboutModal';
import { Stop } from './lib/types';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Compass,
  Layers,
  Loader2,
  MapPin,
  Sparkles,
} from 'lucide-react';

export default function App() {
  const {
    activeTab,
    isLoadingData,
    dataError,
    graphData,
    loadCampusData,
    setActiveTab,
    setIsDroppingPin,
  } = useAppStore();

  const [isAddStopOpen, setIsAddStopOpen] = useState(false);
  const [stopToEdit, setStopToEdit] = useState<Stop | undefined>(undefined);
  const [initialPlaceId, setInitialPlaceId] = useState<string | undefined>(undefined);

  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinCoords, setPinCoords] = useState<[number, number] | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  // Mobile bottom sheet expanded state
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(true);

  // Load campus data on mount
  useEffect(() => {
    loadCampusData();
  }, []);

  const handleOpenAddModal = (stop?: Stop, placeId?: string) => {
    setStopToEdit(stop);
    setInitialPlaceId(placeId);
    setIsAddStopOpen(true);
  };

  const handleOpenPinModal = (coords: [number, number]) => {
    setPinCoords(coords);
    setIsPinModalOpen(true);
  };

  if (isLoadingData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-neutral-100 p-6">
        <div className="w-12 h-12 rounded-2xl bg-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400 mb-4 animate-pulse">
          <Compass className="w-6 h-6 animate-spin" />
        </div>
        <h2 className="text-lg font-bold text-neutral-200">Loading QC Pathfinder...</h2>
        <p className="text-xs text-neutral-400 mt-1 max-w-sm text-center">
          Building campus topology and OpenStreetMap footpath routing graph for Queens College...
        </p>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-neutral-100 p-6">
        <div className="w-12 h-12 rounded-2xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-neutral-200">Failed to Load Campus Data</h2>
        <p className="text-xs text-rose-300 mt-1 max-w-sm text-center font-mono">
          {dataError}
        </p>
        <button
          onClick={() => loadCampusData()}
          className="mt-4 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white"
        >
          Retry Loading
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-screen bg-neutral-950 overflow-hidden font-sans text-neutral-100">
      {/* Header Bar */}
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAbout={() => setIsAboutOpen(true)}
      />

      {/* Main Content Area */}
      {activeTab === 'debug' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-neutral-900 border-b border-neutral-800 px-4 py-2 flex items-center justify-between shrink-0">
            <button
              onClick={() => setActiveTab('planner')}
              className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Campus Map</span>
            </button>
            <span className="text-xs text-neutral-400">
              Graph Diagnostics & Landmark Health
            </span>
          </div>
          <DebugView />
        </div>
      ) : (
        <div className="flex-1 relative flex flex-col md:flex-row overflow-hidden">
          {/* Desktop Left Sidebar / Mobile Bottom Sheet */}
          <div
            className={`
              z-20 md:relative md:w-96 lg:w-[420px] md:h-full md:flex shrink-0 transition-transform duration-300
              ${
                isMobilePanelOpen
                  ? 'fixed inset-x-0 bottom-0 h-[60vh] md:h-full flex flex-col rounded-t-2xl md:rounded-none shadow-2xl md:shadow-none'
                  : 'fixed inset-x-0 bottom-0 h-12 md:h-full flex flex-col'
              }
            `}
          >
            {/* Mobile Sheet Toggle Bar */}
            <div className="md:hidden bg-neutral-900 border-t border-neutral-800 px-4 py-2 flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold text-neutral-200 capitalize">
                {activeTab} Panel
              </span>
              <button
                onClick={() => setIsMobilePanelOpen(!isMobilePanelOpen)}
                className="p-1 text-neutral-400 hover:text-neutral-200"
              >
                {isMobilePanelOpen ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronUp className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Sidebar View Switcher */}
            <div className={`flex-1 overflow-hidden ${!isMobilePanelOpen ? 'hidden md:flex flex-col' : 'flex flex-col'}`}>
              {activeTab === 'planner' && (
                <DayPlanner onOpenAddModal={(stop) => handleOpenAddModal(stop)} />
              )}
              {activeTab === 'directions' && <DirectionsPanel />}
              {activeTab === 'places' && (
                <PlacesPanel onAddStopWithPlace={(pId) => handleOpenAddModal(undefined, pId)} />
              )}
            </div>
          </div>

          {/* Interactive Map Area */}
          <div className="flex-1 h-full relative overflow-hidden">
            <CampusMap
              onAddStopWithPlace={(placeId) => handleOpenAddModal(undefined, placeId)}
              onOpenPinModal={(coords) => handleOpenPinModal(coords)}
              onEditStop={(stop) => handleOpenAddModal(stop)}
            />
          </div>
        </div>
      )}

      {/* Modals */}
      <AddStopModal
        isOpen={isAddStopOpen}
        onClose={() => {
          setIsAddStopOpen(false);
          setStopToEdit(undefined);
          setInitialPlaceId(undefined);
        }}
        stopToEdit={stopToEdit}
        initialPlaceId={initialPlaceId}
      />

      <AddCustomPinModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPinCoords(null);
        }}
        coordinates={pinCoords}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />
    </div>
  );
}
