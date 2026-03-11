// ═══════════════════════════════════════════════════════
//  i18n
// ═══════════════════════════════════════════════════════
(function() {
  window.Aalto.lang = 'en';
  window.Aalto.i18n = {
    en: {
      headerTitle: 'Alvar Aalto Route',
      headerSub: 'Architectural Heritage Map',
      destinations: 'DESTINATIONS',
      tripPlanner: 'TRIP PLANNER',
      info: 'INFO',
      bookmark: 'BOOKMARK',
      visited: 'VISITED',
      addToRoute: 'ADD TO ROUTE',
      removeFromRoute: 'REMOVE FROM ROUTE',
      readMore: 'READ MORE',
      showLess: 'SHOW LESS',
      searchPlaceholder: 'Search…',
      noResults: 'No results',
      clear: 'CLEAR',
      optimizeRoute: 'OPTIMIZE ROUTE',
      openGoogleMaps: 'OPEN IN GOOGLE MAPS',
      newRouteFromBookmarks: 'NEW ROUTE FROM BOOKMARKS',
      stop: 'stop',
      stops: 'stops',
      mixed: 'MIXED',
      walkUnder: 'WALK UNDER',
      modeLabels: { DRIVING: 'CAR', WALKING: 'PEDESTRIAN', TRANSIT: 'PUBLIC TRANSPORT', BICYCLING: 'BICYCLE' },
      mixedModeWarning: 'Mixed modes — Google Maps will use {mode}. Opening in 3s…',
      routeEmpty: 'tap + to add stops',
      filterAll: 'All',
      filterBookmarks: 'Bookmarks',
      filterVisited: 'Visited',
      sortLabel: 'SORT:',
      sortDistance: 'Distance',
      sortAlphabet: 'Alphabet',
      tipUseMyLocation: 'Use my location',
      locationUnavailable: 'Location unavailable',
      phone: 'Phone',
      website: 'Website',
      optimizationFailed: 'ROUTE OPTIMIZATION NOT AVAILABLE',
      tipBookmark: 'Bookmark',
      tipVisited: 'Visited',
      tipAddRoute: 'Add to route',
      tipRemoveRoute: 'Remove from route',
      tipClose: 'Close',
      tipClear: 'Clear search',
      tipRemoveStop: 'Remove stop',
      tipDragReorder: 'Drag to reorder',
      tipPrevMode: 'Previous mode',
      tipNextMode: 'Next mode',
      tipChangeMode: 'Click to change mode',
      tipOptimize: 'Optimize route order',
      tipGoogleMaps: 'Open in Google Maps',
      tipClearRoute: 'Clear all stops',
      tipBookmarked: 'Bookmarked',
      tipVisitedMark: 'Visited',
      dataSource: 'Source: visit.alvaraalto.fi',
    },
    fi: {
      headerTitle: 'Alvar Aallon Reitti',
      headerSub: 'Arkkitehtoninen Perintökartta',
      destinations: 'KOHTEET',
      tripPlanner: 'REITTISUUNNITELMA',
      info: 'TIEDOT',
      bookmark: 'SUOSIKKI',
      visited: 'KÄYTY',
      addToRoute: 'LISÄÄ REITILLE',
      removeFromRoute: 'POISTA REITILTÄ',
      readMore: 'LUE LISÄÄ',
      showLess: 'NÄYTÄ VÄHEMMÄN',
      searchPlaceholder: 'Haku…',
      noResults: 'Ei tuloksia',
      clear: 'TYHJENNÄ',
      optimizeRoute: 'OPTIMOI REITTI',
      openGoogleMaps: 'AVAA GOOGLE MAPSISSA',
      newRouteFromBookmarks: 'UUSI REITTI SUOSIKEISTA',
      stop: 'pysäkki',
      stops: 'pysäkkiä',
      mixed: 'SEKOITETTU',
      walkUnder: 'KÄVELE JOS ALLE',
      modeLabels: { DRIVING: 'AUTO', WALKING: 'KÄVELY', TRANSIT: 'JULKINEN', BICYCLING: 'PYÖRÄ' },
      mixedModeWarning: 'Useita kulkutapoja — Google Maps käyttää {mode}. Avautuu 3 s…',
      routeEmpty: 'lisää kohteita painamalla +',
      filterAll: 'Kaikki',
      filterBookmarks: 'Suosikit',
      filterVisited: 'Käydyt',
      sortLabel: 'JÄRJESTÄ:',
      sortDistance: 'Etäisyys',
      sortAlphabet: 'Aakkosjärjestys',
      tipUseMyLocation: 'Käytä sijaintiani',
      locationUnavailable: 'Sijainti ei saatavilla',
      phone: 'Puhelin',
      website: 'Verkkosivu',
      optimizationFailed: 'REITIN OPTIMOINTI EI SAATAVILLA',
      tipBookmark: 'Suosikki',
      tipVisited: 'Käyty',
      tipAddRoute: 'Lisää reitille',
      tipRemoveRoute: 'Poista reitiltä',
      tipClose: 'Sulje',
      tipClear: 'Tyhjennä haku',
      tipRemoveStop: 'Poista pysäkki',
      tipDragReorder: 'Vedä järjestääksesi',
      tipPrevMode: 'Edellinen tapa',
      tipNextMode: 'Seuraava tapa',
      tipChangeMode: 'Vaihda kulkutapaa',
      tipOptimize: 'Optimoi reittijärjestys',
      tipGoogleMaps: 'Avaa Google Mapsissa',
      tipClearRoute: 'Tyhjennä kaikki pysäkit',
      tipBookmarked: 'Suosikeissa',
      tipVisitedMark: 'Käyty',
      dataSource: 'Lähde: visit.alvaraalto.fi',
    },
  };

  window.Aalto.t = function(key) {
    const A = window.Aalto;
    return A.i18n[A.lang][key] || A.i18n.en[key] || key;
  };

  window.Aalto.applyLang = function() {
    const A = window.Aalto;
    const lang = A.lang;
    const tr = A.i18n[lang];
    document.getElementById('header-title').textContent = tr.headerTitle;
    document.getElementById('header-sub').textContent = tr.headerSub;
    const srcLink = document.getElementById('header-source');
    if (srcLink) srcLink.textContent = tr.dataSource;
    document.querySelectorAll('.lang-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.lang === lang));
    const destHeader = document.querySelector('#list-section-header > span:nth-child(2)');
    if (destHeader) destHeader.textContent = tr.destinations;
    const routeTitle = document.querySelector('.route-title');
    if (routeTitle) routeTitle.textContent = tr.tripPlanner;
    const panelHeader = document.querySelector('#panel-header > span');
    if (panelHeader) panelHeader.textContent = tr.info;
    document.getElementById('list-search').placeholder = tr.searchPlaceholder;
    document.getElementById('list-search-clear').title = tr.tipClear;
    document.getElementById('panel-close').title = tr.tipClose;
    const filterAll = document.querySelector('[data-filter="all"]');
    if (filterAll) filterAll.textContent = tr.filterAll;
    const filterFav = document.querySelector('[data-filter="fav"]');
    if (filterFav) filterFav.innerHTML = '<svg width="10" height="12" viewBox="0 0 11 14" fill="currentColor"><path d="M0 0h11v14l-5.5-4L0 14z"/></svg> ' + tr.filterBookmarks + ' <span class="filter-count"></span>';
    const filterVis = document.querySelector('[data-filter="visited"]');
    if (filterVis) filterVis.innerHTML = '<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 6l3 3 5-6"/></svg> ' + tr.filterVisited + ' <span class="filter-count"></span>';
    const sortLabel = document.getElementById('list-sort-label');
    if (sortLabel) sortLabel.textContent = tr.sortLabel;
    const sortOptDistance = document.querySelector('.list-sort-option[data-sort="distance"]');
    const sortOptAlphabet = document.querySelector('.list-sort-option[data-sort="alphabet"]');
    if (sortOptDistance) sortOptDistance.textContent = tr.sortDistance;
    if (sortOptAlphabet) sortOptAlphabet.textContent = tr.sortAlphabet;
    const sortValueEl = document.getElementById('list-sort-value');
    const activeSortOpt = document.querySelector('.list-sort-option.active');
    if (sortValueEl) sortValueEl.textContent = activeSortOpt?.dataset.sort === 'alphabet' ? tr.sortAlphabet : tr.sortDistance;
    document.querySelectorAll('.map-geolocate-btn').forEach(b => { b.title = tr.tipUseMyLocation; b.setAttribute('aria-label', tr.tipUseMyLocation); });
    document.querySelectorAll('.route-mode-btn').forEach(b => {
      b.textContent = tr.modeLabels[b.dataset.mode] || b.dataset.mode;
    });
    const walkLabel = document.querySelector('#route-walk-threshold > span:first-child');
    if (walkLabel) walkLabel.textContent = tr.walkUnder;
    const optBtn = document.getElementById('route-optimize');
    if (optBtn) { optBtn.textContent = tr.optimizeRoute; optBtn.title = tr.tipOptimize; }
    const gmBtn = document.getElementById('route-gmaps');
    if (gmBtn) { gmBtn.textContent = tr.openGoogleMaps; gmBtn.title = tr.tipGoogleMaps; }
    const clrBtn = document.getElementById('route-clear');
    if (clrBtn) { clrBtn.textContent = tr.clear; clrBtn.title = tr.tipClearRoute; }
    const cgmBtn = document.getElementById('route-collapsed-gmaps');
    if (cgmBtn) cgmBtn.textContent = tr.openGoogleMaps;
    const rfb = document.getElementById('route-from-bookmarks');
    if (rfb) rfb.textContent = tr.newRouteFromBookmarks;
    A.updateFilterCounts();
    if (A.currentFeature) A.renderPanel(A.currentFeature);
    if (window._renderList) window._renderList();
    if (window._updateClusterLabels) window._updateClusterLabels();
    A.renderRouteSection();
  };

  document.querySelectorAll('.lang-btn').forEach(b =>
    b.addEventListener('click', () => {
      window.Aalto.lang = b.dataset.lang;
      window.Aalto.applyLang();
    }));
})();
