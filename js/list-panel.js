// ═══════════════════════════════════════════════════════
//  List Panel — featureList, renderList, highlightListItem, search/filter/sort/export
// Expects: map, data, A (Aalto), expandDestinations fn
// Uses: window.AaltoUtils.haversineKm
// ═══════════════════════════════════════════════════════
(function() {
  window.initListPanel = function(map, data, A, expandDestinations) {
    function parseCityFromAddress(addr) {
      if (!addr) return '';
      const parts = addr.split(',').map(p => p.trim());
      if (parts.length < 2) return '';
      const beforeCountry = parts[parts.length - 2];
      const m = beforeCountry.match(/^\d{5}\s+(.+)$/);
      return m ? m[1].trim() : beforeCountry;
    }

    const haversineKm = window.AaltoUtils.haversineKm;
    const ROUTE_LAYER_IDS = ['route-driving', 'route-walking', 'route-walking-arrows', 'route-bicycling', 'route-transit', 'route-stop-cluster-markers', 'route-stop-cluster-labels', 'route-stop-markers', 'route-stop-numbers', 'route-stop-labels'];

    const FAV_LAYER_IDS = ['aalto-favs-cluster-markers', 'aalto-favs-cluster-labels', 'aalto-favs-markers', 'aalto-favs-numbers', 'aalto-favs-labels'];
    const VISITED_LAYER_IDS = ['aalto-visited-cluster-markers', 'aalto-visited-cluster-labels', 'aalto-visited-markers', 'aalto-visited-numbers', 'aalto-visited-labels'];
    const MAIN_LAYER_IDS = ['country-clusters-stack', 'country-clusters', 'country-labels', 'city-clusters-stack', 'city-clusters', 'city-labels', 'metro-clusters-stack', 'metro-clusters', 'metro-labels', 'aalto-clusters-stack', 'aalto-clusters', 'aalto-cluster-labels', 'aalto-halo', 'aalto-points'];

    const AALTO_POINTS_FILTER_BASE = ['!', ['has', 'point_count']];
    const AALTO_HALO_FILTER_BASE = ['!', ['has', 'point_count']];
    const GREY_PAINT_LAYERS = [
      { id: 'country-clusters-stack', icon: true, defOpacity: 0.35 }, { id: 'country-clusters', icon: true, defOpacity: 0.9 },
      { id: 'country-labels', text: true },
      { id: 'city-clusters-stack', icon: true, defOpacity: 0.35 }, { id: 'city-clusters', icon: true, defOpacity: 0.9 },
      { id: 'city-labels', text: true },
      { id: 'metro-clusters-stack', icon: true, defOpacity: 0.35 }, { id: 'metro-clusters', icon: true, defOpacity: 0.9 },
      { id: 'metro-labels', text: true },
      { id: 'aalto-clusters-stack', icon: true, defOpacity: 0.35 }, { id: 'aalto-clusters', icon: true, defOpacity: 0.9 },
      { id: 'aalto-cluster-labels', text: true },
      { id: 'aalto-halo', stroke: true },
      { id: 'aalto-points', icon: true, text: true, defOpacity: 0.9 },
    ];

    function setMainLayersGrey(grey) {
      GREY_PAINT_LAYERS.forEach(({ id, icon, text, stroke, defOpacity }) => {
        if (!map.getLayer(id)) return;
        if (icon) map.setPaintProperty(id, 'icon-opacity', grey ? 0.3 : (defOpacity ?? 0.9));
        if (text) map.setPaintProperty(id, 'text-color', grey ? '#999' : '#000');
        if (stroke) map.setPaintProperty(id, 'circle-stroke-color', grey ? '#999' : '#000');
      });
      if (map.getLayer('aalto-points') && !grey) {
        map.setPaintProperty('aalto-points', 'icon-opacity', [
          'case',
          ['boolean', ['feature-state', 'selected'], false], 1,
          ['boolean', ['feature-state', 'hover'], false], 1,
          0.9,
        ]);
      }
    }

    function setAaltoPointsFilter(excludeFav, excludeVisited) {
      let filter = AALTO_POINTS_FILTER_BASE;
      if (excludeFav) filter = ['all', filter, ['!', ['get', '_fav']]];
      if (excludeVisited) filter = ['all', filter, ['!', ['get', '_visited']]];
      if (map.getLayer('aalto-points')) map.setFilter('aalto-points', filter);
      if (map.getLayer('aalto-halo')) map.setFilter('aalto-halo', filter);
          }

    function updateFavsOverlay() {
      const src = map.getSource('aalto-favs');
      if (!src) return;
      if (activeFilter === 'fav' && A.favs.size > 0) {
        const favItems = [];
        sortedCountries.forEach(country => {
          favItems.push(...groups[country].filter(item => A.favs.has(item.id)));
        });
        const isfi = A.lang === 'fi';
        const getKey = (a) => (isfi && a.name_fi ? a.name_fi : a.name) || '';
        favItems.sort((a, b) => getKey(a).localeCompare(getKey(b)));
        const favFeatures = favItems.map((item, i) => {
          const baseLabel = (isfi && item.name_fi) ? item.name_fi : item.name;
          const routeIdx = A.routeStops.findIndex(s => s.id === item.id);
          const routeNum = routeIdx >= 0 ? String(routeIdx + 1) : null;
          const label = routeNum ? routeNum + ' · ' + baseLabel : baseLabel;
          return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: item.coords },
            properties: {
              id: item.id,
              name: item.name,
              name_fi: item.name_fi,
              label,
              num: String(i + 1),
              _fav: true,
              _visited: A.visited.has(item.id),
            },
          };
        });
        src.setData({ type: 'FeatureCollection', features: favFeatures });
        MAIN_LAYER_IDS.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible'); });
        setMainLayersGrey(true);
        setAaltoPointsFilter(true, false);
        FAV_LAYER_IDS.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible'); });
        map.getSource('aalto-visited')?.setData?.({ type: 'FeatureCollection', features: [] });
        VISITED_LAYER_IDS.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none'); });
      } else {
        src.setData({ type: 'FeatureCollection', features: [] });
        FAV_LAYER_IDS.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none'); });
        if (activeFilter !== 'visited') {
          setMainLayersGrey(false);
          setAaltoPointsFilter(false, false);
        }
        map.getSource('aalto-visited')?.setData?.({ type: 'FeatureCollection', features: [] });
        VISITED_LAYER_IDS.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none'); });
      }
    }

    function updateVisitedOverlay() {
      const src = map.getSource('aalto-visited');
      if (!src) return;
      if (activeFilter === 'visited' && A.visited.size > 0) {
        const visitedItems = [];
        sortedCountries.forEach(country => {
          visitedItems.push(...groups[country].filter(item => A.visited.has(item.id)));
        });
        const isfi = A.lang === 'fi';
        const getKey = (a) => (isfi && a.name_fi ? a.name_fi : a.name) || '';
        visitedItems.sort((a, b) => getKey(a).localeCompare(getKey(b)));
        const visitedFeatures = visitedItems.map((item, i) => {
          const baseLabel = (isfi && item.name_fi) ? item.name_fi : item.name;
          const routeIdx = A.routeStops.findIndex(s => s.id === item.id);
          const routeNum = routeIdx >= 0 ? String(routeIdx + 1) : null;
          const label = routeNum ? routeNum + ' · ' + baseLabel : baseLabel;
          return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: item.coords },
            properties: {
              id: item.id,
              name: item.name,
              name_fi: item.name_fi,
              label,
              num: String(i + 1),
              _fav: A.favs.has(item.id),
              _visited: true,
            },
          };
        });
        src.setData({ type: 'FeatureCollection', features: visitedFeatures });
        MAIN_LAYER_IDS.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible'); });
        setMainLayersGrey(true);
        setAaltoPointsFilter(false, true);
        map.getSource('aalto-favs')?.setData?.({ type: 'FeatureCollection', features: [] });
        FAV_LAYER_IDS.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none'); });
        VISITED_LAYER_IDS.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible'); });
      } else {
        src.setData({ type: 'FeatureCollection', features: [] });
        VISITED_LAYER_IDS.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none'); });
        if (activeFilter !== 'fav') {
          setMainLayersGrey(false);
          setAaltoPointsFilter(false, false);
        }
        map.getSource('aalto-favs')?.setData?.({ type: 'FeatureCollection', features: [] });
        FAV_LAYER_IDS.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none'); });
      }
    }

    function updateMapVisibilityForFilter() {
      if (activeFilter === 'fav') {
        updateFavsOverlay();
      } else if (activeFilter === 'visited') {
        updateVisitedOverlay();
      } else {
        /* ALL: always clear grey and show all points; hide fav/visited overlays */
        MAIN_LAYER_IDS.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible'); });
        setMainLayersGrey(false);
        setAaltoPointsFilter(false, false);
        map.getSource('aalto-favs')?.setData?.({ type: 'FeatureCollection', features: [] });
        map.getSource('aalto-visited')?.setData?.({ type: 'FeatureCollection', features: [] });
        FAV_LAYER_IDS.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none'); });
        VISITED_LAYER_IDS.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none'); });
      }
    }
    const featureList = data.features.map((f, i) => {
      const p = f.properties;
      const cityEn = p.city || parseCityFromAddress(p.address);
      const cityFi = p.city_fi || parseCityFromAddress(p.address_fi || p.address);
      return {
        id: i,
        name: p.name,
        name_fi: p.name_fi,
        country: p.country || 'Finland',
        city: cityEn,
        city_fi: cityFi,
        feature: f,
        coords: f.geometry.coordinates,
      };
    });

    A.featureList = featureList;
    const groups = {};
    featureList.forEach(item => {
      if (!groups[item.country]) groups[item.country] = [];
      groups[item.country].push(item);
    });
    const sortedCountries = Object.keys(groups).sort((a, b) => {
      if (a === 'Finland') return -1;
      if (b === 'Finland') return 1;
      return a.localeCompare(b);
    });

    const listBody = document.getElementById('list-body');
    let activeFilter = 'all';
    let activeSortMode = 'distance';
    let userLocation = null;
    const collapsedGroups = new Set();
    let viewBeforeFavVisitedMode = null;

    function saveViewBeforeFavVisited() {
      const c = map.getCenter();
      viewBeforeFavVisitedMode = { center: [c.lng, c.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
    }
    function restoreViewBeforeFavVisited() {
      if (viewBeforeFavVisitedMode) {
        map.flyTo({ ...viewBeforeFavVisitedMode, duration: 600 });
        viewBeforeFavVisitedMode = null;
      }
    }

    A.renderList = function() {
      updateMapVisibilityForFilter();
      const isfi = A.lang === 'fi';
      const query = document.getElementById('list-search').value.toLowerCase();
      listBody.innerHTML = '';

      const ref = userLocation || map.getCenter();
      const refCoords = userLocation ? [userLocation.lng, userLocation.lat] : [ref.lng, ref.lat];

      const isFavOrVisited = activeFilter === 'fav' || activeFilter === 'visited';
      const effectiveSortByDistance = isFavOrVisited ? false : (activeSortMode === 'distance');

      function renderItems(items, listNumOffset) {
        const esc = window.AaltoUtils.escHtml;
        items.forEach((item, idx) => {
          const listNum = listNumOffset != null ? listNumOffset + idx + 1 : null;
          const row = document.createElement('div');
          row.className = 'list-item';
          row.dataset.id = item.id;
          if (A.selectedId === item.id) row.classList.add('active');

          const nameSpan = document.createElement('span');
          nameSpan.className = 'list-item-name';
          const displayName = isfi && item.name_fi ? item.name_fi : item.name;
          const city = isfi && item.city_fi ? item.city_fi : item.city;
          const showDist = activeFilter === 'all' && item._dist != null;
          const distKm = showDist ? item._dist.toFixed(1) : null;
          const numPrefix = listNum != null ? `<span class="list-item-num">${listNum}</span>` : '';
          nameSpan.innerHTML = numPrefix + esc(displayName) + (city ? `<span class="list-item-meta">, ${esc(city)}</span>` : '') + (distKm != null ? `<span class="list-item-meta">, ${distKm} km</span>` : '');

          const actions = document.createElement('span');
          actions.className = 'list-actions';

          const favBtn = document.createElement('button');
          favBtn.className = 'list-action-btn' + (A.favs.has(item.id) ? ' active' : '');
          favBtn.innerHTML = '<svg width="9" height="12" viewBox="0 0 11 14" fill="currentColor"><path d="M0 0h11v14l-5.5-4L0 14z"/></svg>';
          favBtn.title = A.t('tipBookmark');
          favBtn.onclick = (e) => {
            e.stopPropagation();
            A.toggleFav(item.id);
            favBtn.classList.toggle('active');
            if (activeFilter === 'fav') A.renderList();
            if (A.currentFeature && A.currentFeature.id === item.id) A.renderPanel(A.currentFeature);
          };

          const visitBtn = document.createElement('button');
          visitBtn.className = 'list-action-btn' + (A.visited.has(item.id) ? ' active' : '');
          visitBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 6l3 3 5-6"/></svg>';
          visitBtn.title = A.t('tipVisited');
          visitBtn.onclick = (e) => {
            e.stopPropagation();
            A.toggleVisited(item.id);
            visitBtn.classList.toggle('active');
            if (activeFilter === 'visited') A.renderList();
            if (A.currentFeature && A.currentFeature.id === item.id) A.renderPanel(A.currentFeature);
          };

          const routeBtn = document.createElement('button');
          const inRoute = A.routeStops.some(s => s.id === item.id);
          routeBtn.className = 'list-action-btn' + (inRoute ? ' active' : '');
          routeBtn.innerHTML = inRoute ? '&#8722;' : '&#43;';
          routeBtn.title = inRoute ? A.t('tipRemoveRoute') : A.t('tipAddRoute');
          routeBtn.style.fontSize = '14px';
          routeBtn.onclick = (e) => {
            e.stopPropagation();
            A.toggleRoute(item.id, item.coords, item.name);
            A.renderList();
          };

          actions.appendChild(favBtn);
          actions.appendChild(visitBtn);
          actions.appendChild(routeBtn);
          row.appendChild(nameSpan);
          row.appendChild(actions);
          listBody.appendChild(row);

          row.onclick = () => A.selectFeature({ ...item.feature, id: item.id });
        });
      }

        if (isFavOrVisited) {
        const esc = window.AaltoUtils.escHtml;
        const collectItems = activeFilter === 'fav' ? (item) => A.favs.has(item.id) : (item) => A.visited.has(item.id);
        let items = [];
        sortedCountries.forEach(country => {
          items.push(...groups[country].filter(item => {
            const name = (isfi && item.name_fi ? item.name_fi : item.name).toLowerCase();
            if (query && !name.includes(query)) return false;
            if (!collectItems(item)) return false;
            return true;
          }));
        });
        const getKey = (a) => (isfi && a.name_fi ? a.name_fi : a.name) || '';
        items.sort((a, b) => getKey(a).localeCompare(getKey(b)));

        const tabLabel = activeFilter === 'fav' ? A.t('filterBookmarks') : A.t('filterVisited');
        const header = document.createElement('div');
        header.className = 'list-group-header';
        header.innerHTML = `<span>${esc(tabLabel)} (${items.length})</span><span class="list-group-arrow"><svg width="8" height="5" viewBox="0 0 8 5" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M1 1l3 3 3-3"/></svg></span>`;
        listBody.appendChild(header);
        renderItems(items, 0);
      } else {
        sortedCountries.forEach(country => {
          let items = groups[country].filter(item => {
            const name = (isfi && item.name_fi ? item.name_fi : item.name).toLowerCase();
            if (query && !name.includes(query)) return false;
            return true;
          });
          if (!items.length) return;

          if (effectiveSortByDistance) {
            items = items.map(item => ({ ...item, _dist: haversineKm(refCoords, item.coords) }));
            items.sort((a, b) => a._dist - b._dist);
          } else {
            items = [...items].sort((a, b) => a.name.localeCompare(b.name));
          }

          const esc = window.AaltoUtils.escHtml;
          const header = document.createElement('div');
          header.className = 'list-group-header';
          const isCollapsed = collapsedGroups.has(country);
          if (isCollapsed) header.classList.add('collapsed');
          header.innerHTML = `<span>${esc(country)} (${items.length})</span><span class="list-group-arrow"><svg width="8" height="5" viewBox="0 0 8 5" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M1 1l3 3 3-3"/></svg></span>`;
          header.onclick = () => {
            if (collapsedGroups.has(country)) collapsedGroups.delete(country);
            else collapsedGroups.add(country);
            A.renderList();
          };
          listBody.appendChild(header);

          if (!isCollapsed) renderItems(items, null);
        });
      }

      if (listBody.children.length === 0 && query) {
        const noRes = document.createElement('div');
        noRes.className = 'route-empty-hint';
        noRes.textContent = A.t('noResults');
        listBody.appendChild(noRes);
      }
      updateListCount();
      if (A.selectedId != null) {
        requestAnimationFrame(() => {
          const el = listBody.querySelector(`.list-item[data-id="${A.selectedId}"]`);
          if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
        });
      }
      A.updatePanelLayout();
    };

    function updateListCount() {
      const countEl = document.getElementById('list-count');
      if (countEl) {
        const items = listBody.querySelectorAll('.list-item');
        countEl.textContent = items.length ? `(${items.length})` : '';
      }
    }

    A.highlightListItem = function(id, opts) {
      A.renderList();
      if (!(opts && opts.skipExpand)) expandDestinations();
      const item = featureList.find(f => f.id === id);
      if (item && collapsedGroups.has(item.country)) {
        collapsedGroups.delete(item.country);
        A.renderList();
      }
      listBody.querySelectorAll('.list-item.active').forEach(el => el.classList.remove('active'));
      let el = listBody.querySelector(`.list-item[data-id="${id}"]`);
      if (!el && activeFilter !== 'all') {
        activeFilter = 'all';
        document.querySelectorAll('.list-filter-btn[data-filter]').forEach(b =>
          b.classList.toggle('active', b.dataset.filter === 'all'));
        updateRouteFromBookmarksBtn();
        A.renderList();
        el = listBody.querySelector(`.list-item[data-id="${id}"]`);
      }
      if (el) {
        el.classList.add('active');
        requestAnimationFrame(() => {
          el.scrollIntoView({ block: 'start', behavior: 'smooth' });
        });
      }
    };

    const _origClosePanel = A.closePanel;
    A.closePanel = function() {
      _origClosePanel();
      listBody.querySelectorAll('.list-item.active').forEach(el => el.classList.remove('active'));
    };
    document.getElementById('panel-close').removeEventListener('click', _origClosePanel);
    document.getElementById('panel-close').addEventListener('click', A.closePanel);

    A.updateFilterCounts();

    const searchInput = document.getElementById('list-search');
    const searchClear = document.getElementById('list-search-clear');
    searchInput.addEventListener('input', () => {
      searchClear.style.display = searchInput.value ? 'block' : 'none';
      if (searchInput.value) expandDestinations();
      A.renderList();
    });
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchClear.style.display = 'none';
      A.renderList();
      searchInput.focus();
    });

    function getVisibleInViewport() {
      const bounds = map.getBounds();
      if (!bounds) return [];
      return featureList.filter(item => bounds.contains(item.coords));
    }

    function updateRouteFromBookmarksBtn() {
      const rfb = document.getElementById('route-from-bookmarks');
      if (rfb) rfb.style.display = (activeFilter === 'fav' && A.favs.size >= 2) ? '' : 'none';
      const listExport = document.getElementById('list-export-dropdown');
      if (listExport) {
        if (activeFilter === 'fav') {
          listExport.style.display = '';
        } else {
          listExport.style.display = 'none';
          listExport.classList.remove('open');
        }
      }
      updateRouteFromVisibleBtn();
    }

    function updateRouteFromVisibleBtn() {
      const rfv = document.getElementById('route-from-visible');
      if (!rfv) return;
      rfv.style.display = activeFilter === 'all' ? '' : 'none';
    }

    updateRouteFromBookmarksBtn();

    document.querySelectorAll('.list-filter-btn[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        const prevFilter = activeFilter;
        const newFilter = btn.dataset.filter;
        document.querySelectorAll('.list-filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = newFilter;
        updateMapVisibilityForFilter();
        if (newFilter === 'all' && (prevFilter === 'fav' || prevFilter === 'visited')) {
          restoreViewBeforeFavVisited();
        }
        if (activeFilter === 'fav' && A.favs.size > 0) {
          if (prevFilter === 'all') saveViewBeforeFavVisited();
          const isfi = A.lang === 'fi';
          const getKey = (a) => (isfi && a.name_fi ? a.name_fi : a.name);
          const favItems = [];
          sortedCountries.forEach(country => {
            const items = groups[country].filter(item => A.favs.has(item.id));
            items.sort((a, b) => getKey(a).localeCompare(getKey(b)));
            favItems.push(...items);
          });
          if (favItems.length === 1) {
            map.flyTo({ center: favItems[0].coords, zoom: 14, pitch: 0, duration: 600 });
          } else {
            const bounds = new mapboxgl.LngLatBounds();
            favItems.forEach(item => bounds.extend(item.coords));
            map.fitBounds(bounds, { padding: 80, pitch: 0, duration: 600, maxZoom: 14 });
          }
        }
        if (activeFilter === 'visited' && A.visited.size > 0) {
          if (prevFilter === 'all') saveViewBeforeFavVisited();
          const isfi = A.lang === 'fi';
          const getKey = (a) => (isfi && a.name_fi ? a.name_fi : a.name);
          const visitedItems = [];
          sortedCountries.forEach(country => {
            const items = groups[country].filter(item => A.visited.has(item.id));
            items.sort((a, b) => getKey(a).localeCompare(getKey(b)));
            visitedItems.push(...items);
          });
          if (visitedItems.length === 1) {
            map.flyTo({ center: visitedItems[0].coords, zoom: 14, pitch: 0, duration: 600 });
          } else {
            const bounds = new mapboxgl.LngLatBounds();
            visitedItems.forEach(item => bounds.extend(item.coords));
            map.fitBounds(bounds, { padding: 80, pitch: 0, duration: 600, maxZoom: 14 });
          }
        }
        expandDestinations();
        A.renderList();
        updateRouteFromBookmarksBtn();
      });
    });

    const sortDropdown = document.getElementById('list-sort-dropdown');
    const sortTrigger = document.getElementById('list-sort-trigger');
    const sortValueEl = document.getElementById('list-sort-value');
    const sortMenu = document.getElementById('list-sort-menu');
    if (sortDropdown && sortTrigger && sortMenu) {
      const updateSortDisplay = () => {
        sortValueEl.textContent = activeSortMode === 'distance' ? A.t('sortDistance') : A.t('sortAlphabet');
        sortMenu.querySelectorAll('.list-sort-option').forEach(o => {
          o.classList.toggle('active', o.dataset.sort === activeSortMode);
        });
      };
      updateSortDisplay();
      sortTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        sortDropdown.classList.toggle('open');
      });
      sortMenu.addEventListener('click', (e) => e.stopPropagation());
      sortMenu.querySelectorAll('.list-sort-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          activeSortMode = opt.dataset.sort;
          updateSortDisplay();
          sortDropdown.classList.remove('open');
          A.renderList();
        });
      });
      document.addEventListener('click', () => sortDropdown.classList.remove('open'));
    }

    const listExportDropdown = document.getElementById('list-export-dropdown');
    const listExportTrigger = document.getElementById('list-export-trigger');
    const listExportMenu = document.getElementById('list-export-menu');
    if (listExportDropdown && listExportTrigger && listExportMenu) {
      const updateListExportLabels = () => {
        const val = document.getElementById('list-export-value');
        if (val) val.textContent = A.t('exportLabel');
        listExportMenu.querySelectorAll('.list-export-option').forEach(o => {
          if (o.dataset.action === 'share-bookmarks') o.textContent = A.t('shareBookmarks');
          if (o.dataset.action === 'print-bookmarks') o.textContent = A.t('printBookmarks');
          o.disabled = A.favs.size === 0;
        });
      };
      updateListExportLabels();
      listExportTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        listExportDropdown.classList.toggle('open');
      });
      listExportMenu.addEventListener('click', (e) => e.stopPropagation());
      listExportMenu.querySelectorAll('.list-export-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          if (opt.disabled) return;
          listExportDropdown.classList.remove('open');
          if (opt.dataset.action === 'share-bookmarks') {
            const text = A.buildBookmarksText(featureList, A.favs, A.lang);
            if (!text) { A.showToast(A.t('shareFailed'), 3000); return; }
            A.shareToClipboard(text,
              () => A.showToast(A.t('sharedToClipboard'), 2000),
              () => A.showToast(A.t('shareFailed'), 3000));
          } else if (opt.dataset.action === 'print-bookmarks') {
            const prevFilter = activeFilter;
            const prevSort = activeSortMode;
            let savedMapState = null;
            A.printBookmarks({
              before: async () => {
                activeFilter = 'fav';
                activeSortMode = 'alphabet';
                document.querySelectorAll('.list-filter-btn[data-filter]').forEach(b =>
                  b.classList.toggle('active', b.dataset.filter === 'fav'));
                if (A.listCollapsed) {
                  A.listCollapsed = false;
                  document.getElementById('list-body').style.display = '';
                  document.getElementById('list-toggle').style.transform = '';
                  document.getElementById('list-panel').classList.remove('list-collapsed');
                }
                document.querySelectorAll('.list-sort-option[data-sort]').forEach(o =>
                  o.classList.toggle('active', o.dataset.sort === 'alphabet'));
                collapsedGroups.clear();
                A.renderList();
                document.querySelectorAll('#list-body .list-item').forEach((row, i) => {
                  const nameEl = row.querySelector('.list-item-name');
                  if (nameEl && !nameEl.querySelector('.list-item-print-num')) {
                    const num = document.createElement('span');
                    num.className = 'list-item-print-num';
                    num.textContent = (i + 1) + '. ';
                    nameEl.insertBefore(num, nameEl.firstChild);
                  }
                });
                if (A.favs.size >= 1 && map) {
                  document.querySelectorAll('#print-bookmarks-map').forEach(el => el.remove());
                  const c = map.getCenter();
                  savedMapState = { center: [c.lng, c.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
                  const isfi = A.lang === 'fi';
                  const getKey = (a) => (isfi && a.name_fi ? a.name_fi : a.name);
                  const favItems = [];
                  sortedCountries.forEach(country => {
                    const items = groups[country].filter(item => A.favs.has(item.id));
                    items.sort((a, b) => getKey(a).localeCompare(getKey(b)));
                    favItems.push(...items);
                  });
                  const printFeatures = favItems.map((item, i) => ({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: item.coords },
                    properties: { num: String(i + 1), name: (isfi && item.name_fi) ? item.name_fi : item.name },
                  }));
                  const printData = { type: 'FeatureCollection', features: printFeatures };
                  if (!map.getSource('print-bookmarks-src')) {
                    map.addSource('print-bookmarks-src', { type: 'geojson', data: printData });
                    map.addLayer({
                      id: 'print-bookmarks-circles', type: 'symbol', source: 'print-bookmarks-src',
                      slot: 'top',
                      layout: {
                        'icon-image': 'aalto-dot', 'icon-size': 1.14,
                        'icon-allow-overlap': true, 'icon-ignore-placement': false,
                      },
                      paint: { 'icon-color': '#000' },
                    });
                  } else {
                    map.getSource('print-bookmarks-src').setData(printData);
                  }
                  ROUTE_LAYER_IDS.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none'); });
                  if (map.getLayer('aalto-favs-markers')) map.setLayoutProperty('aalto-favs-markers', 'visibility', 'none');
                  const bounds = new mapboxgl.LngLatBounds();
                  favItems.forEach(item => bounds.extend(item.coords));
                  map.fitBounds(bounds, { padding: 80, pitch: 0, duration: 500 });
                  await new Promise(r => map.once('moveend', r));
                  await new Promise(r => map.once('idle', r));
                  const dataUrl = map.getCanvas().toDataURL('image/png');
                  const container = document.createElement('div');
                  container.id = 'print-bookmarks-map';
                  container.innerHTML = '<span class="print-map-label">BOOKMARKS</span><img src="' + dataUrl + '" alt="Bookmarks map">';
                  document.body.appendChild(container);
                }
              },
              after: () => {
                document.querySelectorAll('#print-bookmarks-map').forEach(el => el.remove());
                ROUTE_LAYER_IDS.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible'); });
                updateMapVisibilityForFilter();
                if (map && map.getSource('print-bookmarks-src')) {
                  map.getSource('print-bookmarks-src').setData({ type: 'FeatureCollection', features: [] });
                }
                if (savedMapState) map.flyTo({ ...savedMapState, duration: 500 });
                activeFilter = prevFilter;
                activeSortMode = prevSort;
                document.querySelectorAll('.list-filter-btn[data-filter]').forEach(b =>
                  b.classList.toggle('active', b.dataset.filter === prevFilter));
                document.querySelectorAll('.list-sort-option[data-sort]').forEach(o =>
                  o.classList.toggle('active', o.dataset.sort === prevSort));
                A.renderList();
                updateRouteFromBookmarksBtn();
              }
            });
          }
        });
      });
      document.addEventListener('click', () => listExportDropdown.classList.remove('open'));
      A.updateExportDropdowns = function() { updateListExportLabels(); };
    }

    let _renderListMoveTimer;
    map.on('moveend', () => {
      updateRouteFromVisibleBtn();
      const needsRerender = activeSortMode === 'distance' || activeFilter === 'fav' || activeFilter === 'visited';
      if (!needsRerender) return;
      clearTimeout(_renderListMoveTimer);
      _renderListMoveTimer = setTimeout(() => A.renderList(), 200);
    });

    const geoControl = {
      onAdd(m) {
        const el = document.createElement('div');
        el.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mapboxgl-ctrl-icon map-geolocate-btn';
        btn.setAttribute('aria-label', A.t('tipUseMyLocation'));
        btn.title = A.t('tipUseMyLocation');
        btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10" cy="10" r="3"/><path d="M10 2v4M10 14v4M2 10h4M14 10h4"/></svg>';
        el.appendChild(btn);
        btn.onclick = () => {
          if (userLocation) {
            userLocation = null;
            btn.classList.remove('active');
            A.renderList();
            return;
          }
          if (!navigator.geolocation) {
            A.showToast(A.t('locationUnavailable'));
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              userLocation = { lng: pos.coords.longitude, lat: pos.coords.latitude };
              btn.classList.add('active');
              A.renderList();
              m.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: Math.max(m.getZoom(), 12), duration: 800 });
            },
            () => {
              userLocation = null;
              A.showToast(A.t('locationUnavailable'));
            }
          );
        };
        return el;
      },
      onRemove() {},
    };
    map.addControl(geoControl, 'bottom-left');

    document.getElementById('route-from-bookmarks').onclick = (e) => {
      e.stopPropagation();
      A.routeStops.length = 0;
      A.routeSegments = [];
      [...A.favs].forEach(id => {
        const item = featureList.find(f => f.id === id);
        if (item) A.routeStops.push({ id: item.id, coords: item.coords, name: item.name });
      });
      if (A.routeStops.length >= 2) {
        A.saveRoute();
        document.getElementById('route-section').classList.remove('collapsed');
        A.updatePanelLayout();
        A.renderRouteSection();
        A.renderList();
        A.calculateAllSegments().then(() => {
          if (A.routeStops.length >= 3 && typeof google !== 'undefined' && google.maps) {
            document.getElementById('route-optimize').click();
          }
        });
        A.fitRouteOverview();
      } else {
        A.saveRoute();
        A.renderRouteSection();
        A.renderList();
      }
    };

    document.getElementById('route-from-visible').onclick = (e) => {
      e.stopPropagation();
      const visible = getVisibleInViewport();
      const routeIds = new Set(A.routeStops.map(s => s.id));
      const toAdd = visible.filter(item => !routeIds.has(item.id));
      if (toAdd.length === 0) {
        A.showToast(A.t('allVisibleInRoute'), 2500);
        return;
      }
      toAdd.forEach(item => A.routeStops.push({ id: item.id, coords: item.coords, name: item.name }));
      A.saveRoute();
      document.getElementById('route-section').classList.remove('collapsed');
      A.updatePanelLayout();
      A.rebuildAaltoSource();
      A.renderRouteSection();
      A.renderList();
      A.calculateAllSegments().then(() => {
        if (A.routeStops.length >= 3 && typeof google !== 'undefined' && google.maps) {
          document.getElementById('route-optimize').click();
        }
      });
      A.fitRouteOverview();
    };

    // A.renderList is already on window.Aalto; no separate global needed

    function getActiveFilter() {
      return activeFilter;
    }
    function switchToFilter(filter) {
      const prevFilter = activeFilter;
      activeFilter = filter;
      document.querySelectorAll('.list-filter-btn[data-filter]').forEach(b =>
        b.classList.toggle('active', b.dataset.filter === filter));
      updateMapVisibilityForFilter();
      if (filter === 'all' && (prevFilter === 'fav' || prevFilter === 'visited')) {
        restoreViewBeforeFavVisited();
      }
      A.renderList();
      updateRouteFromBookmarksBtn();
    }

    return { renderList: A.renderList, highlightListItem: A.highlightListItem, featureList, getActiveFilter, switchToFilter };
  };
})();
