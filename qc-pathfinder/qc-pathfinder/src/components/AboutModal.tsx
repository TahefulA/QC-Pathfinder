import React from 'react';
import {
  AlertTriangle,
  Box,
  Code2,
  Compass,
  Footprints,
  Heart,
  Info,
  Layers,
  MapPin,
  ShieldAlert,
  X,
} from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden text-neutral-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-sky-400" />
            <h2 className="text-lg font-bold text-neutral-100">About QC Pathfinder</h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs sm:text-sm text-neutral-300 leading-relaxed">
          {/* Unofficial Disclaimer Banner */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Disclaimer & Project Scope:</span>
              <p className="mt-1 text-xs text-amber-200/90 leading-relaxed">
                QC Pathfinder is an independent, unofficial beta tool crafted for Queens College (CUNY) students.
                It is <strong>not</strong> officially affiliated with, endorsed by, or maintained by Queens College or the City University of New York (CUNY).
              </p>
            </div>
          </div>

          {/* How Routes Are Computed */}
          <div>
            <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2 mb-2">
              <Footprints className="w-4 h-4 text-sky-400" />
              <span>How Campus Routes Are Computed</span>
            </h3>
            <p>
              QC Pathfinder uses an in-memory <strong>A* (A-Star) search algorithm</strong> with a 
              great-circle <strong>Haversine heuristic</strong> running purely client-side in your browser. 
              The underlying routing graph is constructed from real OpenStreetMap topological footway data:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1.5 text-xs text-neutral-400 pl-2">
              <li>
                <strong>Multi-Entrance Snapping:</strong> Buildings are represented by their perimeter access points. 
                When you route from Kiely Hall to Powdermaker Hall, the router searches across all mapped building access nodes to select the shortest valid door-to-door path.
              </li>
              <li>
                <strong>Weight Model:</strong> Pedestrian walkways have standard 1.0x weight, roads have 1.25x weight, and outdoor stairs carry a 1.8x penalty to favor level walking.
              </li>
              <li>
                <strong>Travel Time & Slack:</strong> Walking speed is calibrated to user preferences (1.0 m/s slow, 1.3 m/s normal, 1.6 m/s brisk). Each leg calculates transition slack: <code className="font-mono text-sky-300">Slack = (Class 2 Start - Class 1 End) - Walk Time - Buffer</code>.
              </li>
            </ul>
          </div>

          {/* Accessibility & Best-Effort Limitations */}
          <div>
            <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Accessibility Mode Limits (NEVER Claim ADA Compliance)</span>
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              When "Avoids mapped stairs" is enabled, the router excludes graph edges tagged with 
              <code className="font-mono text-neutral-300"> highway=steps</code> or <code className="font-mono text-neutral-300">wheelchair=no</code>. 
              However, <strong>this is strictly best-effort</strong>. 
              OpenStreetMap tagging on university campuses may contain incomplete curb-ramp, surface incline, or door automation data. 
              This application <strong>does not claim Americans with Disabilities Act (ADA) compliance</strong>. 
              Students requiring official accommodations should consult QC Special Higher Education Services (SHES).
            </p>
          </div>

          {/* 3D Campus Modeling */}
          <div>
            <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2 mb-2">
              <Box className="w-4 h-4 text-sky-400" />
              <span>3D Campus Modeling & Spatial Architecture</span>
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Features authentic 3D building extrusions calibrated to real physical heights (from the 48m Kiely Hall clock tower to Rosenthal Library and the Quad). 
              Rendered with directional sunlight, ambient occlusion gradients, and full 3D camera orbit (right-click or two-finger drag to rotate and pitch).
            </p>
          </div>

          {/* OpenStreetMap & ODbL License */}
          <div>
            <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>OpenStreetMap & Data Attribution</span>
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Map and footpath data are sourced from <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer" className="underline text-emerald-400 hover:text-emerald-300">OpenStreetMap</a>. 
              Data is available under the <a href="https://opendatacommons.org/licenses/odbl/" target="_blank" rel="noreferrer" className="underline text-emerald-400 hover:text-emerald-300">Open Database License (ODbL)</a>. 
              © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline text-emerald-400 hover:text-emerald-300">OpenStreetMap contributors</a>.
            </p>
          </div>

          {/* Privacy & Zero-API Philosophy */}
          <div>
            <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2 mb-2">
              <Code2 className="w-4 h-4 text-purple-400" />
              <span>Zero-Backend, Local Storage Privacy</span>
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              QC Pathfinder requires <strong>no accounts, no cloud database, and zero third-party API keys</strong>. 
              All your schedules, favorites, and custom pins stay in your browser's local storage. You can backup or transfer your schedule anytime via JSON export in Settings.
            </p>
          </div>

          {/* Location Privacy Guarantee */}
          <div className="p-3.5 rounded-xl bg-sky-950/40 border border-sky-800/60 text-sky-200">
            <h3 className="text-sm font-bold text-sky-300 flex items-center gap-2 mb-1.5">
              <Compass className="w-4 h-4 text-sky-400" />
              <span>Location Privacy: Your Location Stays on Your Device</span>
            </h3>
            <p className="text-xs text-sky-200/90 leading-relaxed">
              Live location and walking navigation rely exclusively on your device's browser <strong>HTML5 Geolocation API</strong>.
              There is <strong>no IP lookup, no backend tracking, and no external location telemetry</strong>. 
              Your GPS coordinates are computed and processed entirely in local memory on your phone or laptop. 
              No location data is ever logged, stored, or transmitted to any server.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-950/60 flex items-center justify-between text-xs text-neutral-500">
          <span>QC Pathfinder v1.0.0 (Beta)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
