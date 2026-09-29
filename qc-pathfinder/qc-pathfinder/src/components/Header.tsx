import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../lib/store';
import {
  Activity,
  Calendar,
  Compass,
  GraduationCap,
  HelpCircle,
  MapPin,
  Navigation,
  Search,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenAbout: () => void;
  onSelectSearchResult?: (id: string, center: [number, number]) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onOpenAbout,
  onSelectSearchResult,
}) => {
  const {
    activeTab,
    graphData,
    customPlaces,
    searchQuery,
    setActiveTab,
    setSearchQuery,
    setInspectedBuildingId,
    loadSampleDay,
  } = useAppStore();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close search results dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter search results
  const searchResults = (() => {
    if (!searchQuery.trim() || !graphData) return [];

    const q = searchQuery.toLowerCase().trim();
    const results: Array<{
      id: string;
      name: string;
      sub: string;
      center: [number, number];
      isCustom: boolean;
      emoji?: string;
    }> = [];

    // Custom places
    const seenIds = new Set<string>();

    customPlaces.forEach(p => {
      if (
        (p.name.toLowerCase().includes(q) ||
        (p.notes && p.notes.toLowerCase().includes(q))) &&
        !seenIds.has(p.id)
      ) {
        seenIds.add(p.id);
        results.push({
          id: p.id,
          name: p.name,
          sub: `Custom ${p.category}`,
          center: p.lngLat,
          isCustom: true,
          emoji: p.emoji,
        });
      }
    });

    // Campus buildings
    graphData.buildings.forEach(b => {
      if (!b.name || seenIds.has(b.id)) return;
      const matchName = b.name.toLowerCase().includes(q);
      const matchAlias = b.aliases?.some(a => a.toLowerCase().includes(q));

      if (matchName || matchAlias) {
        seenIds.add(b.id);
        results.push({
          id: b.id,
          name: b.name,
          sub: b.aliases?.length ? `Aliases: ${b.aliases.join(', ')}` : 'Campus Building',
          center: b.center,
          isCustom: false,
        });
      }
    });

    return results.slice(0, 8);
  })();

  const handleSelectResult = (item: typeof searchResults[0]) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setInspectedBuildingId(item.id);
    if (onSelectSearchResult) {
      onSelectSearchResult(item.id, item.center);
    }
  };

  return (
    <header className="h-14 bg-neutral-900 border-b border-neutral-800 px-4 flex items-center justify-between gap-3 select-none shrink-0 z-30">
      {/* Brand */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('planner')}>
          <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white font-bold shadow-md shadow-sky-600/20">
            <Compass className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-neutral-100 tracking-tight">QC Pathfinder</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                Beta
              </span>
            </div>
            <span className="text-[10px] text-neutral-400 hidden sm:inline">
              Queens College Walkway Map & Schedule Router
            </span>
          </div>
        </div>
      </div>

      {/* Global Search Box with Instant Autocomplete */}
      <div ref={searchContainerRef} className="relative flex-1 max-w-md mx-2">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
            placeholder="Search Kiely, Library, Science Bldg, Quad..."
            className="w-full pl-9 pr-8 py-1.5 bg-neutral-950/80 border border-neutral-700/80 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setIsSearchOpen(false);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Results */}
        {isSearchOpen && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl overflow-hidden z-50 divide-y divide-neutral-800">
            {searchResults.map(item => (
              <button
                key={item.id}
                onClick={() => handleSelectResult(item)}
                className="w-full px-3 py-2 text-left hover:bg-neutral-800/80 transition-colors flex items-center gap-2.5"
              >
                <div className="p-1 rounded bg-neutral-800 text-sky-400 shrink-0">
                  {item.isCustom ? (
                    <span className="text-sm">{item.emoji || '📍'}</span>
                  ) : (
                    <GraduationCap className="w-3.5 h-3.5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-neutral-100 truncate">
                    {item.name}
                  </div>
                  <div className="text-[10px] text-neutral-400 truncate">
                    {item.sub}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 shrink-0">
        <nav className="flex items-center gap-1 bg-neutral-950/60 p-1 rounded-lg border border-neutral-800/80">
          <button
            onClick={() => setActiveTab('planner')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'planner'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Schedule</span>
          </button>

          <button
            onClick={() => setActiveTab('directions')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'directions'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Directions</span>
          </button>

          <button
            onClick={() => setActiveTab('places')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'places'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Places</span>
          </button>

          <button
            onClick={() => setActiveTab('debug')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'debug'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
            title="Open Graph Diagnostics"
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Debug</span>
          </button>
        </nav>

        {/* Sample Day Quick Button */}
        <button
          onClick={() => loadSampleDay()}
          className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-neutral-700 text-xs font-semibold transition-colors cursor-pointer"
          title="Load realistic sample schedule with classes and hangout"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden xl:inline">Sample Day</span>
        </button>

        {/* Settings & About Icons */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          title="Settings & Export"
        >
          <Settings className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenAbout}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          title="About & Disclaimers"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
