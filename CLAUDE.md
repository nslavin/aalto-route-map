# Aalto Map

Interactive web map to explore, bookmark, plan, and share routes through Alvar Aalto's architectural heritage. Built on Mapbox GL JS.

## Features

- Interactive Mapbox map with 72 Aalto sites across Finland and Europe
- Cluster layers: country → city → individual points at progressive zoom levels
- Dedicated bookmark/visited overlay layers (clustered GL sources, greying main layers when filter active)
- Detail panel: image carousel with lightbox, collapsible descriptions, contact & social info
- Bookmark & visited tracking (localStorage-persisted, filterable in list)
- Trip planner: multi-stop routing via Google Directions API
  - Modes: driving, walking, bicycling, transit (global + per-segment overrides)
  - Walk threshold: auto-switch short segments to walking
  - Drag-and-drop stop reordering, route optimization
  - Route overview layers at low zoom (zoom < 8) using simplified geometry
  - Google Maps export
- Bilingual: EN / FI language switch
- Adaptive layout: 3-column when list and detail panel both visible
- Local optimized images: thumb (300px), medium (800px), large (1600px) WebP versions

## Project structure

```
index.html                    — main HTML, loads external CSS/JS
styles.css                    — all app styles
icons/
  dot.svg                     — default map marker icon
  dot-route.svg               — route stop marker icon
js/
  state.js                    — route stops, favs, visited, persistence, toggle helpers
  toast.js                    — toast notification
  i18n.js                     — language (EN/FI), translations, applyLang
  lightbox.js                 — image lightbox
  utils.js                    — shared utilities (haversineKm, etc.)
  panel.js                    — detail panel (render, open/close, selectFeature)
  layout.js                   — updatePanelLayout, list/route collapse, fitRouteOverview
  export.js                   — share (clipboard) & print for bookmarks and route
  map-layers.js               — GL sources, cluster & point layers, rebuildAaltoSource, favs/visited overlays
  list-panel.js               — featureList, renderList, search/filter/sort, filter overlay logic
  route-planner.js            — route sources/layers, calculateAllSegments, renderRouteSection, mode bar
  map-init.js                 — Mapbox init, map.on('load'), orchestrates all modules
  layer-zoom-config.js        — externalized zoom breakpoints for layer groups, persisted to localStorage
  debug-layers.js             — dev panel to toggle visibility and z-order of map layers
data/
  aalto_route.geojson         — 72 features: name, name_fi, address, address_fi, url, url_fi, image
  aalto_details.json          — enriched building details (cover, gallery, description, contact, social, websites, links, email, local_images)
  images/                     — locally cached optimized images (thumb/medium/large WebP)
  aalto_route_enriched.geojson — intermediate enrichment output
  aalto_clusters_countries.geojson
  aalto_clusters_cities.geojson
  aalto_clusters_cities_merged.geojson
  aalto_clusters_helsinki_metropolitan.geojson
  en_fi_url_cache.json        — cache of EN→FI URL mappings
  enrich_cache.json           — enrichment scraping cache
  helsinki_districts.geojson   — cached WFS response for Helsinki district boundaries
scripts/
  extract_aalto_route.py      — scrapes Leaflet marker data from downloaded HTML pages, merges EN/FI
  enrich_aalto_route.py       — scrapes detail pages for descriptions, galleries, contact info
  cluster_geojson.py          — clusters route GeoJSON by country, city, Helsinki district
  merge_city_clusters.py      — merges city cluster variants
  download_images.py          — downloads & optimizes images (thumb 300px, medium 800px, large 1600px WebP)
```

## Stack

- **Map**: Mapbox GL JS v3.19.0, Standard style + CSS `grayscale(1) contrast(1.05)`
- **Routing**: Google Maps JavaScript API (DirectionsService)
- **Data**: static GeoJSON + `aalto_details.json` (enriched building details)
- **Dev server**: Python `http.server` — port 8081
- **No build tools** — vanilla HTML/CSS/JS, split into `styles.css` + `js/*.js`

## Running locally

```bash
python3 -m http.server 8081
# open http://localhost:8081
```

## Architecture notes

- **Modular app**: HTML in `index.html`, CSS in `styles.css`, JS split into `js/*.js`. Load order: state → toast → i18n → lightbox → utils → panel → layout → export → map-layers → list-panel → route-planner → layer-zoom-config → debug-layers → map-init.
- **Shared namespace**: `window.Aalto` holds state (routeStops, favs, visited, etc.) and callbacks; modules extend it.
- **Stub pattern**: `state.js` declares stub functions (`renderRouteSection`, `calculateAllSegments`, etc.); `map-init.js` assigns real implementations after `map.on('load')`.
- **Layout states**: normal (66.67vw map + 33.33vw list), detail-stacked (66.67vw map + 33.33vw right column split: list top + panel bottom, when list ≤50% viewport), detail-open (3×33.33vw, when list >50% viewport), both-collapsed (100vw map + minimized headers top-right)
- **Persistence**: localStorage keys `aalto_favs`, `aalto_visited`, `aalto_route`, `aalto_layer_zoom_config`, `aalto_debug_layer_order`, `aalto_debug_layer_visibility`
- **Feature state**: Mapbox `setFeatureState` for `selected`, `hover`, `fav`, `visited`
- **Overlay layers**: when "bookmarks" or "visited" filter is active, dedicated `aalto-favs` / `aalto-visited` clustered GL sources drive their own marker/label layers; main layers are greyed out
- **Route overview**: separate `route-line-overview` source feeds low-zoom (< 8) line layers using simplified `overview_path` geometry
- **Zoom breakpoints**: `layer-zoom-config.js` exposes `window.getLayerZoomConfig()` read by `map-layers.js` on init; `initLayerZoomConfig(map)` renders the dev UI panel

## Map design principles

- Laconic architectural aesthetic: black and white, no decoration
- Mapbox Standard style with CSS grayscale filter on canvas
- Markers: custom SVG dot icons (`icons/dot.svg`, `icons/dot-route.svg`) loaded as Mapbox image sprites
- Detail panel: 1px black border, no radius, grayscale images
- Typography: Helvetica Neue, uppercase tracking, minimal color

## API keys

Keys are stored in `index.html` (Google) and `js/map-init.js` (Mapbox). Do not commit secrets.

## Data pipeline (supporting tool)

### 1. Download HTML sources
```bash
curl -L "https://visit.alvaraalto.fi/en/alvar-aalto-route/" -o data/aalto_route.html
curl -L "https://visit.alvaraalto.fi/fi/alvar-aalto-reitti/" -o data/aalto_route_fi.html
```

### 2. Extract GeoJSON
```bash
pip install requests beautifulsoup4
python scripts/extract_aalto_route.py
```

### 3. Enrich with details
```bash
python scripts/enrich_aalto_route.py
```

### 4. Cluster
```bash
python scripts/cluster_geojson.py
```

## Key details

- All GeoJSON uses `ensure_ascii=False` (preserves ä, ö)
- Helsinki WFS endpoint: `kartta.hel.fi/ws/geoserver/avoindata/wfs` (type `avoindata:Kaupunginosajako`, EPSG:4326)
- 72 Aalto objects across Finland and Europe
