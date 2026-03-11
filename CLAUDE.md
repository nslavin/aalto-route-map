# Aalto Map

Interactive web map to explore, bookmark, plan, and share routes through Alvar Aalto's architectural heritage. Built on Mapbox GL JS.

## Features

- Interactive Mapbox map with 72 Aalto sites across Finland and Europe
- Cluster layers: country → city → individual points at progressive zoom levels
- Detail panel: image carousel with lightbox, collapsible descriptions, contact & social info
- Bookmark & visited tracking (localStorage-persisted, filterable in list)
- Trip planner: multi-stop routing via Google Directions API
  - Modes: driving, walking, bicycling, transit (global + per-segment overrides)
  - Walk threshold: auto-switch short segments to walking
  - Drag-and-drop stop reordering, route optimization
  - Google Maps export
- Bilingual: EN / FI language switch
- Three-column layout: map | detail panel | list panel (33.33vw each)

## Project structure

```
index.html                    — main HTML (production keys), loads external CSS/JS
index-test.html               — copy with test API keys (gitignored, do not commit)
styles.css                    — all app styles
js/
  state.js                    — route stops, favs, visited, persistence, toggle helpers
  toast.js                    — toast notification
  i18n.js                     — language (EN/FI), translations, applyLang
  lightbox.js                 — image lightbox
  panel.js                    — detail panel (render, open/close, selectFeature)
  map-init.js                 — Mapbox init, map.on('load'), layers, list, route
data/
  aalto_route.geojson         — 72 features: name, name_fi, address, address_fi, url, url_fi, image
  aalto_details.json          — enriched building details (cover, gallery, description, contact, social)
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
```

## Stack

- **Map**: Mapbox GL JS v3.9.0, Standard style + CSS `grayscale(1) contrast(1.05)`
- **Routing**: Google Maps JavaScript API (DirectionsService)
- **Data**: static GeoJSON + `aalto_details.json` (enriched building details)
- **Dev server**: Python `http.server` — port 8081 (prod), port 8082 (test)
- **No build tools** — vanilla HTML/CSS/JS, split into `styles.css` + `js/*.js`

## Running locally

```bash
# Production (index.html, prod keys)
python3 -m http.server 8081
# open http://localhost:8081

# Test (index-test.html, test keys)
python3 -m http.server 8082
# open http://localhost:8082/index-test.html
```

## index-test.html workflow

`index-test.html` is a gitignored copy of `index.html` with test API keys. To sync after editing:

```bash
cp index.html index-test.html
# Replace Google API key in script src (edit or use sed with your prod/test key strings)
cp js/map-init.js js/map-init-test.js
# Replace Mapbox token in map-init-test.js with test token
sed -i '' 's|js/map-init.js|js/map-init-test.js|' index-test.html
```

## Architecture notes

- **Modular app**: HTML in `index.html`, CSS in `styles.css`, JS split into `js/*.js` (state, toast, i18n, lightbox, panel, map-init). Load order: state → toast → i18n → lightbox → panel → map-init.
- **Shared namespace**: `window.Aalto` holds state (routeStops, favs, visited, etc.) and callbacks; modules extend it.
- **Stub pattern**: `state.js` declares stub functions (`renderRouteSection`, `calculateAllSegments`, etc.); `map-init.js` assigns real implementations after `map.on('load')`.
- **Layout states**: normal (66.67vw map + 33.33vw list), detail-open (3×33.33vw), both-collapsed (100vw map + minimized headers top-right)
- **Persistence**: localStorage keys `aalto_favs`, `aalto_visited`, `aalto_route`
- **Feature state**: Mapbox `setFeatureState` for `selected`, `hover`, `fav`, `visited`

## Map design principles

- Laconic architectural aesthetic: black and white, no decoration
- Mapbox Standard style with CSS grayscale filter on canvas
- Markers: small black circles (GL circle layer)
- Detail panel: 1px black border, no radius, grayscale images
- Typography: Helvetica Neue, uppercase tracking, minimal color

## API keys

Keys are stored in `index.html` (Google) and `js/map-init.js` (Mapbox). Use separate prod/test keys for production vs local testing. Do not commit secrets.

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
