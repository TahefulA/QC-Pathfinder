# QC Pathfinder

**Interactive 3D campus map, walking navigation, and day planner for Queens College.**

QC Pathfinder helps students, faculty, and visitors navigate Queens College with a live 3D campus map, turn-by-turn walking directions, and a schedule-aware day planner. Users can locate buildings, plan routes, manage class stops, move stops directly on the map, and simulate walking routes for testing or demonstrations.

---

## Overview

QC Pathfinder combines campus geospatial data, a walkway routing graph, live location support, and a 3D building map into a single web application. It is designed for daily campus navigation, class scheduling, and route planning around Queens College.

The app includes:

- A 3D campus map with extruded buildings and landmark height data
- Live GPS location support with walkway snapping
- Walking navigation with distance, ETA, and off-route warnings
- A day planner for class stops and campus destinations
- Direct stop editing and drag-and-drop stop repositioning on the 3D map
- Simulation tools for testing location and walking routes without leaving campus

---

## Features

### Interactive 3D Campus Map

- Hardware-accelerated 3D building extrusions using MapLibre `fill-extrusion`
- Real-world height data for Queens College landmarks and surrounding buildings
- Landmark color highlighting:
  - Campus landmarks: collegiate royal blue `#2563eb`
  - Inspected buildings: glowing sky blue `#38bdf8`
  - Navigation destinations: emerald beacon `#34d399`
- Directional sunlight and ambient shading using MapLibre lighting
- `fill-extrusion-vertical-gradient` for roof-to-wall depth
- 3D isometric camera starting at approximately `52°` pitch and `-18°` bearing
- Free orbit controls:
  - Right-click drag or two-finger drag to rotate and tilt
  - Tilt up to `70°`
- Bottom-right 3D control stack:
  - 3D / 2D toggle
  - Live 3D compass
  - Pitch angle cycle: `0°`, `45°`, `55°`, `68°`
  - Reset campus view
- Priority landmark labels float above rooftops
- Route lines and walkways render through plazas between buildings

### Live Location & Walking Navigation

- “Start from my location” support in the directions panel and schedule stop cards
- GPS coordinates snap to the nearest campus walkway node
- Active walking navigation includes:
  - Real-time distance countdown
  - Dynamic arrival ETA
  - Off-route warnings
  - Auto-advance to the next class stop on arrival
- Direct “Navigate” actions on schedule stop cards
- Route recalculation after moving a stop

### Day Planner & Stop Management

- Add, edit, and remove schedule stops
- Stop details include:
  - Course title
  - Campus location
  - Room number
  - Category
  - Scheduled days
  - Start and end times
  - Notes
- Click any stop on the 3D map to open its stop card
- Edit stop details from the stop card
- Move stops on the 3D map:
  - Drag and drop stop markers directly on the map
  - Real-time snapping against extruded building roofs and facades
  - Target buildings illuminate in amber with a 5 m elevation pop
  - Live HUD shows the snap target, such as Rosenthal Library, Kiely Hall, or open campus green
  - Routes recalculate automatically after dropping a stop
- “Move on Map” mode:
  - Crosshair targeting
  - Top guidance bar
  - Click any 3D building or campus spot to relocate the stop
  - Cancel with the button or `Esc`
- Instant building reassignment using the building selector in the stop card
- Day Planner items include direct actions:
  - “Locate & Move on 3D Map”
  - “Edit Stop Details”
- Selecting a stop in the Day Planner glides the camera to the stop, highlights its marker, and opens its details card

### Simulation & Diagnostics

- Location Simulation Mode toggle in Preferences
- GPS Location & Walking Simulation suite in the Diagnostics tab
- One-tap teleportation to preset campus landmarks:
  - Quad Center
  - Kiely Hall
  - Powdermaker Steps
  - Rosenthal Library
  - Off-Campus
- Accuracy radius and compass orientation sliders
- Virtual route walking player with `1x`, `2x`, and `4x` speed multipliers
- Useful for off-campus testing, demonstrations, and route validation

---

## Tech Stack

- **React**
- **TypeScript**
- **Vite**
- **MapLibre GL JS**
- **Vitest**
- **GeoJSON**
- **Node-based data build scripts**
- **Centralized application store** in `src/lib/store.ts`

---

## Project Structure

```text
.
├── data/
│   └── overrides.json
├── public/
│   ├── assets/
│   └── data/
│       ├── campus.geojson
│       └── graph.json
├── scripts/
│   └── build-data.ts
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── AboutModal.tsx
│   │   ├── AddCustomPinModal.tsx
│   │   ├── AddStopModal.tsx
│   │   ├── CampusMap.tsx
│   │   ├── DayPlanner.tsx
│   │   ├── DebugView.tsx
│   │   ├── DirectionsPanel.tsx
│   │   ├── Header.tsx
│   │   ├── PlacesPanel.tsx
│   │   └── SettingsModal.tsx
│   ├── lib/
│   │   ├── __tests__/
│   │   ├── geo.ts
│   │   ├── navigation.ts
│   │   ├── routing.ts
│   │   ├── store.ts
│   │   ├── time.ts
│   │   └── types.ts
│   ├── index.css
│   └── main.tsx
├── index.html
├── metadata.json
├── package.json
├── tsconfig.json
└── vite.config.ts
