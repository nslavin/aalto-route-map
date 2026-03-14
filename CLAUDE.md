# Cursor / Claude instructions — Aalto Map

Instructions for AI assistants (Cursor, Claude, etc.) working in this repo. For human-facing project info and setup, see **README.md**.

## What this project is

- Interactive Mapbox web map for Alvar Aalto sites (72 across Finland and Europe).
- Vanilla stack: no build; `index.html` + `styles.css` + `js/*.js`. Mapbox GL JS v3, Google Directions for routing.
- Key concepts: cluster layers, bookmark/visited overlays, detail panel, trip planner, EN/FI i18n.

## Conventions to follow

- **No build tools** — Keep vanilla HTML/CSS/JS. Do not introduce bundlers, transpilers, or frameworks unless explicitly requested.
- **Load order** — Scripts in `index.html` must stay in this order: state → toast → i18n → lightbox → utils → panel → layout → export → map-layers → list-panel → route-planner → layer-zoom-config → debug-layers → map-init.
- **Shared namespace** — App state and callbacks live on `window.Aalto`; modules extend it, do not replace it.
- **Stub pattern** — `state.js` declares stubs (e.g. `renderRouteSection`, `calculateAllSegments`); `map-init.js` assigns real implementations after `map.on('load')`. When adding new cross-module callbacks, follow this pattern.
- **i18n** — All user-facing strings in `js/i18n.js` (EN + FI). Use keys and `applyLang`; no hardcoded UI copy in HTML/JS.
- **Data** — GeoJSON and JSON use `ensure_ascii=False` (preserve ä, ö). Helsinki WFS: `kartta.hel.fi/ws/geoserver/avoindata/wfs`, type `avoindata:Kaupunginosajako`, EPSG:4326.

## File roles (quick reference)

| File | Role |
|------|------|
| `state.js` | Route stops, favs, visited, persistence, toggle helpers, stubs for route/segment logic |
| `map-init.js` | Mapbox init, `map.on('load')`, wires modules and assigns stub implementations |
| `map-layers.js` | GL sources, cluster/point layers, `rebuildAaltoSource`, fav/visited overlays |
| `list-panel.js` | Feature list, search/filter/sort, filter overlay behaviour |
| `route-planner.js` | Route sources/layers, `calculateAllSegments`, `renderRouteSection`, mode bar |
| `layout.js` | `updatePanelLayout`, list/route collapse, `fitRouteOverview`, map resize / padding |
| `panel.js` | Detail panel render, open/close, `selectFeature` |
| `layer-zoom-config.js` | Zoom breakpoints for layer groups, persisted; `getLayerZoomConfig()`, `initLayerZoomConfig(map)` |

## Persistence (localStorage)

- `aalto_favs`, `aalto_visited`, `aalto_route` — user data.
- `aalto_layer_zoom_config`, `aalto_debug_layer_order`, `aalto_debug_layer_visibility` — map/debug settings.

Do not change these keys without updating all read/write sites.

## Map behaviour

- **Feature state**: Mapbox `setFeatureState` for `selected`, `hover`, `fav`, `visited`.
- **Overlays**: With “bookmarks” or “visited” filter active, `aalto-favs` / `aalto-visited` GL sources drive overlay layers; main layers are greyed out.
- **Route overview**: At zoom &lt; 8, `route-line-overview` source with simplified `overview_path` geometry is used for overview line layers.

## Design rules (map and UI)

- Laconic, architectural look: black and white, no decoration.
- Custom Mapbox style; markers = custom SVG dots in `icons/` (e.g. `dot.svg`, `dot-route.svg`) as image sprites.
- Detail panel: 1px black border, no radius, grayscale images.
- Typography: Helvetica Neue, uppercase tracking, minimal colour.

## When editing

- Prefer extending existing modules over new global state.
- Keep script load order and `window.Aalto` contract; document new public callbacks if they are part of the app contract.
- For new UI copy, add EN/FI entries in `i18n.js` and use the existing apply/refresh flow.
- API keys: Google in `index.html`, Mapbox in `js/map-init.js` — never commit secrets; mention in README or here if key handling changes.
