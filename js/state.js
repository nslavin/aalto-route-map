// ═══════════════════════════════════════════════════════
//  State & Persistence
// ═══════════════════════════════════════════════════════
(function() {
  function _safeParseJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  const _savedRoute = _safeParseJSON('aalto_route', null);
  window.Aalto = {
    routeStops: _savedRoute ? _savedRoute.stops : [],
    routeSegments: [],
    savedSegmentOverrides: _savedRoute?.segments || [],
    globalMode: _savedRoute ? (_savedRoute.globalMode || 'DRIVING') : 'DRIVING',
    walkThreshold: _savedRoute ? (_savedRoute.walkThreshold != null ? _savedRoute.walkThreshold : 1000) : 1000,
    favs: new Set(_safeParseJSON('aalto_favs', [])),
    visited: new Set(_safeParseJSON('aalto_visited', [])),
    modeOrder: ['DRIVING', 'WALKING', 'TRANSIT', 'BICYCLING'],
  };

  function saveFavs() {
    localStorage.setItem('aalto_favs', JSON.stringify([...window.Aalto.favs]));
  }
  function saveVisited() {
    localStorage.setItem('aalto_visited', JSON.stringify([...window.Aalto.visited]));
  }
  function saveRoute() {
    const A = window.Aalto;
    localStorage.setItem('aalto_route', JSON.stringify({
      stops: A.routeStops.map(s => ({ id: s.id, coords: s.coords, name: s.name })),
      globalMode: A.globalMode,
      walkThreshold: A.walkThreshold,
      segments: A.routeSegments.map(s => ({ modeOverride: s.modeOverride, returnToCar: s.returnToCar })),
    }));
  }
  function updateFilterCounts() {
    const A = window.Aalto;
    const fs = document.querySelector('[data-filter="fav"] .filter-count');
    const vs = document.querySelector('[data-filter="visited"] .filter-count');
    if (fs) fs.textContent = A.favs.size ? `(${A.favs.size})` : '';
    if (vs) vs.textContent = A.visited.size ? `(${A.visited.size})` : '';
    if (A.updateExportDropdowns) A.updateExportDropdowns();
  }

  function loadPanels() {
    try {
      const raw = localStorage.getItem('aalto_panels');
      if (!raw) return null;
      const p = JSON.parse(raw);
      return {
        listCollapsed: !!p.listCollapsed,
        routeCollapsed: !!p.routeCollapsed,
        panelOpen: !!p.panelOpen,
      selectedId: (typeof p.selectedId === 'number' ? p.selectedId : null),
      activeListFilter: (p.activeListFilter === 'fav' || p.activeListFilter === 'visited') ? p.activeListFilter : 'all',
    };
  } catch (e) {
      return null;
    }
  }
  function savePanels() {
    const A = window.Aalto;
    const routeEl = document.getElementById('route-section');
    const panelEl = document.getElementById('panel');
    if (!routeEl || !panelEl) return;
    const state = {
      listCollapsed: !!A.listCollapsed,
      routeCollapsed: routeEl.classList.contains('collapsed'),
      panelOpen: panelEl.classList.contains('open'),
      selectedId: A.selectedId != null ? A.selectedId : null,
      activeListFilter: A.activeListFilter || 'all',
    };
    localStorage.setItem('aalto_panels', JSON.stringify(state));
  }

  window.Aalto.saveFavs = saveFavs;
  window.Aalto.saveVisited = saveVisited;
  window.Aalto.saveRoute = saveRoute;
  window.Aalto.loadPanels = loadPanels;
  window.Aalto.savePanels = savePanels;
  window.Aalto.updateFilterCounts = updateFilterCounts;

  // Stubs — reassigned in map-init.js after map loads
  window.Aalto.renderRouteSection = function() {};
  window.Aalto.calculateAllSegments = function() { return Promise.resolve(); };
  window.Aalto.highlightRouteStop = function() {};
  window.Aalto.updatePanelLayout = function() {};
  window.Aalto.highlightListItem = function() {};
  window.Aalto.rebuildAaltoSource = function() {};
  window.Aalto.renderList = function() {};
  window.Aalto.fitRouteOverview = function() {};

  function toggleFav(id) {
    const A = window.Aalto;
    if (A.favs.has(id)) A.favs.delete(id); else A.favs.add(id);
    saveFavs();
    A.rebuildAaltoSource();
    updateFilterCounts();
  }
  function toggleVisited(id) {
    const A = window.Aalto;
    if (A.visited.has(id)) A.visited.delete(id); else A.visited.add(id);
    saveVisited();
    A.rebuildAaltoSource();
    updateFilterCounts();
  }
  function toggleRoute(id, coords, name) {
    const A = window.Aalto;
    const idx = A.routeStops.findIndex(s => s.id === id);
    const wasAdding = idx < 0;
    if (idx >= 0) {
      A.routeStops.splice(idx, 1);
    } else {
      if (!coords) return false;
      A.routeStops.push({ id, coords, name });
      document.getElementById('route-section').classList.remove('collapsed');
      A.updatePanelLayout();
    }
    saveRoute();
    A.rebuildAaltoSource();
    A.renderRouteSection();
    A.calculateAllSegments();
    if (wasAdding) A.fitRouteOverview();
    return wasAdding;
  }

  window.Aalto.toggleFav = toggleFav;
  window.Aalto.toggleVisited = toggleVisited;
  window.Aalto.toggleRoute = toggleRoute;
})();
