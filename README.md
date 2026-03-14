# Aalto Map

Interactive web map to explore, bookmark, plan, and share routes through [Alvar Aalto](https://visit.alvaraalto.fi)’s architectural heritage. Built on Mapbox GL JS.

## Features

- **Interactive map** — 72 Aalto sites across Finland and Europe with cluster layers (country → city → points) at progressive zoom levels
- **Bookmarks & visited** — Track favourites and visited sites; localStorage-persisted, filterable in the list with dedicated overlay layers
- **Detail panel** — Image carousel with lightbox, collapsible descriptions, contact and social links
- **Trip planner** — Multi-stop routing via Google Directions API:
  - Modes: driving, walking, bicycling, transit (global + per-segment)
  - Walk threshold for short segments, drag-and-drop stop order, route optimization
  - Route overview at low zoom; export to Google Maps
- **Bilingual** — EN / FI language switch
- **Adaptive layout** — 3-column when list and detail panel are both open
- **Optimized images** — Local WebP: thumb (300px), medium (800px), large (1600px)

## Running locally

```bash
python3 -m http.server 8081
```

Then open **http://localhost:8081**.

## Stack

- **Map**: Mapbox GL JS v3.19.0, custom style
- **Routing**: Google Maps JavaScript API (DirectionsService)
- **Data**: Static GeoJSON + `data/aalto_details.json`
- **Frontend**: Vanilla HTML/CSS/JS — no build step; `index.html` + `styles.css` + `js/*.js`

## Project structure

| Path | Purpose |
|------|--------|
| `index.html` | Main HTML, script/style loading |
| `styles.css` | All app styles |
| `icons/` | Map marker SVGs (`dot.svg`, `dot-route.svg`, etc.) |
| `js/` | App modules: state, i18n, panel, layout, map-layers, list-panel, route-planner, map-init, … |
| `data/` | GeoJSON, `aalto_details.json`, cached images, cluster and enrichment outputs |
| `scripts/` | Python: extract, enrich, cluster, merge clusters, download images |

## Data pipeline (optional)

Used to refresh or rebuild data from the Alvar Aalto Route site:

1. **Download HTML**  
   `curl` the EN/FI route pages into `data/`.

2. **Extract GeoJSON**  
   `pip install requests beautifulsoup4` then `python scripts/extract_aalto_route.py`.

3. **Enrich**  
   `python scripts/enrich_aalto_route.py`.

4. **Cluster**  
   `python scripts/cluster_geojson.py` (and `merge_city_clusters.py` if needed).

5. **Images**  
   `python scripts/download_images.py` for thumb/medium/large WebP.

GeoJSON is written with `ensure_ascii=False` so Finnish characters (ä, ö) are preserved.

## API keys

- **Google** (Directions): in `index.html`
- **Mapbox**: in `js/map-init.js`

Do not commit secrets; use env or local config if needed.

## Licence

See repository or project metadata for licence terms.
