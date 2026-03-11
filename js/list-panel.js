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

    A.renderList = function() {
      const isfi = A.lang === 'fi';
      const query = document.getElementById('list-search').value.toLowerCase();
      listBody.innerHTML = '';

      const ref = userLocation || map.getCenter();
      const refCoords = userLocation ? [userLocation.lng, userLocation.lat] : [ref.lng, ref.lat];

      sortedCountries.forEach(country => {
        let items = groups[country].filter(item => {
          const name = (isfi && item.name_fi ? item.name_fi : item.name).toLowerCase();
          if (query && !name.includes(query)) return false;
          if (activeFilter === 'fav' && !A.favs.has(item.id)) return false;
          if (activeFilter === 'visited' && !A.visited.has(item.id)) return false;
          return true;
        });
        if (!items.length) return;

        if (activeSortMode === 'distance') {
          items = items.map(item => ({ ...item, _dist: haversineKm(refCoords, item.coords) }));
          items.sort((a, b) => a._dist - b._dist);
        } else {
          items = [...items].sort((a, b) => a.name.localeCompare(b.name));
        }

        const header = document.createElement('div');
        header.className = 'list-group-header';
        const isCollapsed = collapsedGroups.has(country);
        if (isCollapsed) header.classList.add('collapsed');
        header.innerHTML = `<span>${country} (${items.length})</span><span class="list-group-arrow"><svg width="8" height="5" viewBox="0 0 8 5" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M1 1l3 3 3-3"/></svg></span>`;
        header.onclick = () => {
          if (collapsedGroups.has(country)) collapsedGroups.delete(country);
          else collapsedGroups.add(country);
          A.renderList();
        };
        listBody.appendChild(header);

        if (isCollapsed) return;

        items.forEach(item => {
          const row = document.createElement('div');
          row.className = 'list-item';
          row.dataset.id = item.id;
          if (A.selectedId === item.id) row.classList.add('active');

          const nameSpan = document.createElement('span');
          nameSpan.className = 'list-item-name';
          const displayName = isfi && item.name_fi ? item.name_fi : item.name;
          const city = isfi && item.city_fi ? item.city_fi : item.city;
          const distKm = item._dist != null ? item._dist.toFixed(1) : null;
          nameSpan.innerHTML = displayName + (city ? `<span class="list-item-meta">, ${city}</span>` : '') + (distKm != null ? `<span class="list-item-meta">, ${distKm} km</span>` : '');

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
      });
      if (listBody.children.length === 0 && query) {
        const noRes = document.createElement('div');
        noRes.className = 'route-empty-hint';
        noRes.textContent = A.t('noResults');
        listBody.appendChild(noRes);
      }
      updateListCount();
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
        const containerRect = listBody.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const currentScroll = listBody.scrollTop;
        const elTopInContainer = elRect.top - containerRect.top + currentScroll;
        const firstItem = listBody.querySelector('.list-item, .list-group-header');
        const itemHeight = firstItem ? firstItem.getBoundingClientRect().height + 1 : 44;
        listBody.scrollTo({ top: Math.max(0, elTopInContainer - itemHeight), behavior: 'smooth' });
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
    }
    updateRouteFromBookmarksBtn();

    document.querySelectorAll('.list-filter-btn[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.list-filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
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
            A.printBookmarks({
              before: () => {
                activeFilter = 'fav';
                document.querySelectorAll('.list-filter-btn[data-filter]').forEach(b =>
                  b.classList.toggle('active', b.dataset.filter === 'fav'));
                if (A.listCollapsed) {
                  A.listCollapsed = false;
                  document.getElementById('list-body').style.display = '';
                  document.getElementById('list-toggle').style.transform = '';
                  document.getElementById('list-panel').classList.remove('list-collapsed');
                }
                collapsedGroups.clear();
                A.renderList();
              },
              after: () => {
                activeFilter = prevFilter;
                document.querySelectorAll('.list-filter-btn[data-filter]').forEach(b =>
                  b.classList.toggle('active', b.dataset.filter === prevFilter));
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
      if (activeSortMode !== 'distance') return;
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

    window._renderList = A.renderList;
    return { renderList: A.renderList, highlightListItem: A.highlightListItem, featureList };
  };
})();
