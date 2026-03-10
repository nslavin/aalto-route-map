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
index.html                    — single-file web app (~2100 lines: CSS + HTML + JS)
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
- **Dev server**: Python `http.server` on port 8080
- **No build tools** — vanilla HTML/CSS/JS, single-file app

## Running locally

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Architecture notes

- **Single-file app**: all CSS, HTML, JS in `index.html` (~2100 lines)
- **Function stub pattern**: 5 functions (`renderRouteSection`, `calculateAllSegments`, `highlightRouteStop`, `updatePanelLayout`, `renderList`) declared as empty stubs before `map.on('load')`, reassigned with real implementations inside the callback for cross-scope access
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

- **Mapbox**: public token stored in `index.html` (scoped to this app, owner: `nslavin`)
- **Google Maps**: API key in `<script>` tag (used for DirectionsService only)

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
