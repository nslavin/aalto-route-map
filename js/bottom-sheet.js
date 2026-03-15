// ═══════════════════════════════════════════════════════
//  Bottom Sheet — Mobile layout: snaps, gestures, reparenting
//  Height-based approach: sheet sits at bottom:0, grows upward
//  Expects: window.Aalto
// ═══════════════════════════════════════════════════════
(function () {
  var A = window.Aalto;

  window.initBottomSheet = function (map, mapEl, listRet) {
    var sheet = document.getElementById('bottom-sheet');
    var handle = sheet.querySelector('.bs-handle');
    var content = sheet.querySelector('.bs-content');
    var tabs = sheet.querySelectorAll('.bs-tab');
    var viewList = sheet.querySelector('.bs-view-list');
    var viewDetail = sheet.querySelector('.bs-view-detail');
    var viewRoute = sheet.querySelector('.bs-view-route');
    var detailContent = sheet.querySelector('.bs-detail-content');
    var closeBtn = sheet.querySelector('.bs-close');
    var searchRow = sheet.querySelector('.bs-search-row');
    var tabBar = sheet.querySelector('.bs-tabs');

    // ── Mobile detection ──
    var mql = window.matchMedia('(max-width: 767px)');
    A.isMobile = mql.matches;

    A.mobileState = {
      snap: 'peek',
      previousSnap: 'peek',
      activeTab: 'all',
      showingDetail: false,
    };

    // ── Viewport height ──
    function getViewportHeight() {
      if (window.visualViewport && typeof window.visualViewport.height === 'number') {
        return Math.min(window.visualViewport.height, window.innerHeight);
      }
      return window.innerHeight;
    }

    // ── Snap point system ──
    function getPeekHeight() {
      var h = handle.offsetHeight || 28;
      if (tabBar && tabBar.style.display !== 'none') h += tabBar.offsetHeight || 0;
      if (searchRow && searchRow.style.display !== 'none') h += searchRow.offsetHeight || 0;
      var rp = sheet.querySelector('.bs-route-preview');
      if (rp && rp.style.display !== 'none') h += rp.offsetHeight || 0;
      return Math.max(h + 10, 120);
    }

    function getHalfHeight() {
      var vh = getViewportHeight();
      var pct = A.mobileState.showingDetail ? 0.70 : 0.50;
      return Math.round(vh * pct);
    }

    function getFullHeight() {
      return getViewportHeight();
    }

    function resolveSnap(name) {
      if (name === 'peek') return getPeekHeight();
      if (name === 'half') return getHalfHeight();
      if (name === 'full') return getFullHeight();
      return getPeekHeight();
    }

    var SNAP_ORDER = ['peek', 'half', 'full'];

    function getSnapValues() {
      return {
        peek: getPeekHeight(),
        half: getHalfHeight(),
        full: getFullHeight(),
      };
    }

    // ── Apply height ──
    function applyHeight(px) {
      var maxH = getFullHeight();
      var minH = getPeekHeight();
      px = Math.max(minH, Math.min(maxH, px));
      sheet.style.height = px + 'px';
      document.documentElement.style.setProperty('--bs-height', px + 'px');
      return px;
    }

    // ── Set snap ──
    var resizeObserver = null;

    function setSnap(snapName, animated) {
      if (typeof animated === 'undefined') animated = true;
      var heightPx = resolveSnap(snapName);

      if (animated) {
        sheet.style.transition = 'height 0.35s cubic-bezier(0.32, 0.72, 0, 1)';
        document.body.classList.remove('bs-dragging');
      } else {
        sheet.style.transition = 'none';
      }

      applyHeight(heightPx);

      sheet.classList.remove('snap-peek', 'snap-half', 'snap-full');
      sheet.classList.add('snap-' + snapName);

      A.mobileState.snap = snapName;
      A.mobileState.currentSnapPx = heightPx;

      if (!animated) {
        map.resize();
      }
    }

    // Map resize via ResizeObserver — auto-resizes when map container changes
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(function () {
        if (A.isMobile && map) map.resize();
      });
      resizeObserver.observe(mapEl);
    }

    // Also resize map after sheet transition ends
    sheet.addEventListener('transitionend', function (e) {
      if (e.target !== sheet || e.propertyName !== 'height') return;
      if (map) map.resize();
    });

    // ── Touch gesture handling ──
    var dragState = {
      phase: 'idle',   // 'idle' | 'undecided' | 'scroll' | 'drag'
      startY: 0,
      startHeight: 0,
      startTime: 0,
      startScrollTop: 0,
      activeScroller: null,
    };
    var resizeScheduled = false;

    function getActiveScroller() {
      if (A.mobileState.showingDetail) return detailContent;
      if (A.mobileState.activeTab === 'route') {
        return document.getElementById('route-stops-list') || viewRoute;
      }
      return viewList;
    }

    function scheduleMapResize() {
      if (resizeScheduled) return;
      resizeScheduled = true;
      requestAnimationFrame(function () {
        if (map) map.resize();
        resizeScheduled = false;
      });
    }

    // -- Handle / tab bar drag (always drags sheet) --
    function onHandleTouchStart(e) {
      if (e.target && e.target.closest && e.target.closest('.bs-tab')) return;
      var touch = e.touches[0];
      dragState.phase = 'drag';
      dragState.startY = touch.clientY;
      dragState.startHeight = sheet.offsetHeight;
      dragState.startTime = Date.now();
      sheet.style.transition = 'none';
      document.body.classList.add('bs-dragging');
    }

    function onHandleTouchMove(e) {
      if (dragState.phase !== 'drag') return;
      e.preventDefault();
      var touch = e.touches[0];
      var deltaY = dragState.startY - touch.clientY; // positive = finger up = grow
      var newH = dragState.startHeight + deltaY;
      applyHeight(newH);
      scheduleMapResize();
    }

    function onHandleTouchEnd(e) {
      if (dragState.phase !== 'drag') return;
      document.body.classList.remove('bs-dragging');
      resolveSnapFromGesture(e);
      dragState.phase = 'idle';
    }

    handle.addEventListener('touchstart', onHandleTouchStart, { passive: true });
    handle.addEventListener('touchmove', onHandleTouchMove, { passive: false });
    handle.addEventListener('touchend', onHandleTouchEnd, { passive: true });
    tabBar.addEventListener('touchstart', onHandleTouchStart, { passive: true });
    tabBar.addEventListener('touchmove', onHandleTouchMove, { passive: false });
    tabBar.addEventListener('touchend', onHandleTouchEnd, { passive: true });

    // -- Content area: scroll vs drag disambiguation --
    content.addEventListener('touchstart', function (e) {
      dragState.phase = 'undecided';
      dragState.startY = e.touches[0].clientY;
      dragState.startHeight = sheet.offsetHeight;
      dragState.startTime = Date.now();
      dragState.activeScroller = getActiveScroller();
      dragState.startScrollTop = dragState.activeScroller ? dragState.activeScroller.scrollTop : 0;
    }, { passive: true });

    content.addEventListener('touchmove', function (e) {
      if (dragState.phase === 'idle' || dragState.phase === 'scroll') return;

      var touch = e.touches[0];
      var deltaY = touch.clientY - dragState.startY; // positive = finger moved down

      if (dragState.phase === 'undecided') {
        if (Math.abs(deltaY) < 10) return; // dead zone

        var atScrollTop = dragState.startScrollTop <= 1;
        var pullingDown = deltaY > 0;
        var pushingUp = deltaY < 0;
        var snap = A.mobileState.snap;

        // At peek: any touch on content should drag the sheet
        if (snap === 'peek') {
          dragState.phase = 'drag';
        }
        // At half/full: drag only if at scroll top and pulling down
        else if (atScrollTop && pullingDown) {
          dragState.phase = 'drag';
        }
        // At half: pushing up should expand to full (if at scroll top)
        else if (snap === 'half' && atScrollTop && pushingUp) {
          dragState.phase = 'drag';
        }
        else {
          dragState.phase = 'scroll';
          return;
        }

        // Entering drag mode
        sheet.style.transition = 'none';
        document.body.classList.add('bs-dragging');
      }

      if (dragState.phase === 'drag') {
        e.preventDefault();
        var dragDelta = dragState.startY - touch.clientY;
        var newH = dragState.startHeight + dragDelta;
        applyHeight(newH);
        scheduleMapResize();
      }
    }, { passive: false });

    content.addEventListener('touchend', function (e) {
      if (dragState.phase === 'drag') {
        document.body.classList.remove('bs-dragging');
        resolveSnapFromGesture(e);
      }
      dragState.phase = 'idle';
    }, { passive: true });

    // -- Velocity-based snap resolution --
    function resolveSnapFromGesture(e) {
      var touch = e.changedTouches[0];
      var endY = touch.clientY;
      var dt = Date.now() - dragState.startTime;
      var velocity = (endY - dragState.startY) / Math.max(dt, 1); // px/ms; positive = down

      var currentH = sheet.offsetHeight;
      var snaps = getSnapValues();
      var snapHeights = [snaps.peek, snaps.half, snaps.full];

      // Find closest snap to current position
      var closestIdx = 0;
      var minDist = Infinity;
      for (var i = 0; i < snapHeights.length; i++) {
        var d = Math.abs(currentH - snapHeights[i]);
        if (d < minDist) { minDist = d; closestIdx = i; }
      }

      var targetIdx;
      if (Math.abs(velocity) > 0.4) {
        // Fast swipe
        if (velocity > 0) {
          // Swiping down → shrink
          targetIdx = Math.max(0, closestIdx - 1);
        } else {
          // Swiping up → grow
          targetIdx = Math.min(SNAP_ORDER.length - 1, closestIdx + 1);
        }
      } else {
        // Slow drag → nearest
        targetIdx = closestIdx;
      }

      setSnap(SNAP_ORDER[targetIdx]);
    }

    // Handle tap on handle to toggle
    handle.addEventListener('click', function () {
      if (A.mobileState.snap === 'peek') setSnap('half');
      else if (A.mobileState.snap === 'half') setSnap('peek');
      else if (A.mobileState.snap === 'full') setSnap('half');
    });

    // ── DOM reparenting ──
    var _origSearchParent = null;
    var _origSearchNext = null;
    var _origSortParent = null;
    var _origSortNext = null;
    var _origListBodyParent = null;
    var _origListBodyNext = null;
    var _origRouteSectionBodyParent = null;
    var _origRouteSectionBodyNext = null;
    var _origListExportParent = null;
    var _origListExportNext = null;

    function enterMobileMode() {
      document.body.classList.add('is-mobile');

      // Move search
      var searchWrap = document.getElementById('list-search-wrap');
      if (searchWrap && searchWrap.parentNode !== searchRow) {
        _origSearchParent = searchWrap.parentNode;
        _origSearchNext = searchWrap.nextSibling;
        searchRow.appendChild(searchWrap);
      }

      // Move list body
      var listBody = document.getElementById('list-body');
      if (listBody && listBody.parentNode !== viewList) {
        _origListBodyParent = listBody.parentNode;
        _origListBodyNext = listBody.nextSibling;
        viewList.appendChild(listBody);
        listBody.style.display = '';
        listBody.style.overflow = 'visible';
      }

      // Move route section body
      var routeBody = document.getElementById('route-section-body');
      if (routeBody && routeBody.parentNode !== viewRoute) {
        _origRouteSectionBodyParent = routeBody.parentNode;
        _origRouteSectionBodyNext = routeBody.nextSibling;
        viewRoute.appendChild(routeBody);
        routeBody.style.display = '';
      }

      // Move route helper buttons + export dropdown into shared header row
      var rfb = document.getElementById('route-from-bookmarks');
      var rfv = document.getElementById('route-from-visible');
      var listExportDropdown = document.getElementById('list-export-dropdown');

      if (listExportDropdown) {
        _origListExportParent = listExportDropdown.parentNode;
        _origListExportNext = listExportDropdown.nextSibling;
      }

      var headerRow = document.createElement('div');
      headerRow.className = 'bs-bookmarks-header-row';
      headerRow.id = 'bs-bookmarks-header-row';
      if (rfb) headerRow.appendChild(rfb);
      if (listExportDropdown) headerRow.appendChild(listExportDropdown);
      viewList.insertBefore(headerRow, viewList.firstChild);

      if (rfv) {
        var listBody2 = document.getElementById('list-body');
        if (listBody2) viewList.insertBefore(rfv, listBody2);
      }

      // Move sort into list view
      var sortWrap = document.querySelector('.list-sort-wrap');
      if (sortWrap && sortWrap.parentNode !== viewList) {
        _origSortParent = sortWrap.parentNode;
        _origSortNext = sortWrap.nextSibling;
        viewList.insertBefore(sortWrap, viewList.firstChild);
      }

      map.resize();
      setSnap('peek', false);
      switchTab('all');
      A.updateFilterCounts();

      // Use saved map position when available (same as desktop); otherwise default "all" view
      var savedPos = null;
      try {
        var raw = localStorage.getItem('aalto_map_pos');
        if (raw) savedPos = JSON.parse(raw);
      } catch (e) { /* ignore */ }
      if (!savedPos) {
        var iv = A.initialView || { center: [19.96148, 57.70808], zoom: 2.687, bearing: 18.2, pitch: 50.9 };
        var pitch = A.getMobilePitch ? A.getMobilePitch(iv.zoom, iv.pitch) : iv.pitch;
        map.jumpTo({ center: iv.center, zoom: iv.zoom, bearing: iv.bearing, pitch: pitch, duration: 0 });
      }
    }

    function exitMobileMode() {
      document.body.classList.remove('is-mobile');

      // Restore panel content to #panel if it was moved to the sheet
      var panelEl = document.getElementById('panel');
      var panelInner = document.getElementById('panel-inner');
      if (panelInner && panelInner.parentNode === detailContent) {
        panelEl.appendChild(panelInner);
      }
      if (A.mobileState.showingDetail) {
        A.mobileState.showingDetail = false;
        viewDetail.classList.remove('active');
        viewList.classList.remove('slide-out');
        tabBar.style.display = '';
        searchRow.style.display = '';
        closeBtn.style.display = '';
      }

      // Restore search
      var searchWrap = document.getElementById('list-search-wrap');
      if (searchWrap && _origSearchParent) {
        if (_origSearchNext) _origSearchParent.insertBefore(searchWrap, _origSearchNext);
        else _origSearchParent.appendChild(searchWrap);
      }

      // Restore sort
      var sortWrap = document.querySelector('.list-sort-wrap');
      if (sortWrap && _origSortParent) {
        sortWrap.style.display = '';
        if (_origSortNext) _origSortParent.insertBefore(sortWrap, _origSortNext);
        else _origSortParent.appendChild(sortWrap);
      }

      // Restore list body
      var listBody = document.getElementById('list-body');
      if (listBody && _origListBodyParent) {
        if (_origListBodyNext) _origListBodyParent.insertBefore(listBody, _origListBodyNext);
        else _origListBodyParent.appendChild(listBody);
        listBody.style.display = A.listCollapsed ? 'none' : '';
      }

      // Restore route section body
      var routeBody = document.getElementById('route-section-body');
      if (routeBody && _origRouteSectionBodyParent) {
        if (_origRouteSectionBodyNext) _origRouteSectionBodyParent.insertBefore(routeBody, _origRouteSectionBodyNext);
        else _origRouteSectionBodyParent.appendChild(routeBody);
      }

      // Restore route helper buttons
      var rfb = document.getElementById('route-from-bookmarks');
      var rfv = document.getElementById('route-from-visible');
      var listHeader = document.getElementById('list-header');
      if (rfb && listHeader && listHeader.nextSibling) {
        listHeader.parentNode.insertBefore(rfb, listHeader.nextSibling);
      }
      if (rfv && rfb && rfb.nextSibling) {
        rfb.parentNode.insertBefore(rfv, rfb.nextSibling);
      }

      // Restore list export dropdown
      var listExportDropdown = document.getElementById('list-export-dropdown');
      var headerRow = document.getElementById('bs-bookmarks-header-row');
      if (listExportDropdown && _origListExportParent) {
        if (_origListExportNext) _origListExportParent.insertBefore(listExportDropdown, _origListExportNext);
        else _origListExportParent.appendChild(listExportDropdown);
      }
      if (headerRow) headerRow.remove();

      // Clear sheet inline styles
      sheet.style.height = '';
      sheet.style.transition = '';
      document.documentElement.style.removeProperty('--bs-height');
      map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
      map.resize();

      A.updatePanelLayout();
    }

    // ── Tab switching ──
    function switchTab(tabName) {
      A.mobileState.activeTab = tabName;
      tabs.forEach(function (t) {
        t.classList.toggle('active', t.dataset.tab === tabName);
      });

      if (tabName === 'route') {
        viewList.style.display = 'none';
        viewRoute.classList.add('active');
        viewRoute.style.display = 'block';
        viewDetail.classList.remove('active');
        viewList.classList.remove('slide-out');
        searchRow.style.display = '';
        if (typeof A.applyLang === 'function') A.applyLang();
        if (A.mobileState.snap === 'peek') {
          setSnap('half');
        } else {
          requestAnimationFrame(function () { setSnap('half', false); });
        }
        if (A.fitRouteOverview && A.routeStops && A.routeStops.length >= 2) {
          A.fitRouteOverview();
        } else if (A.routeStops && A.routeStops.length === 1 && map) {
          map.flyTo({ center: A.routeStops[0].coords, zoom: 14, pitch: 0, duration: 600 });
        }
      } else {
        viewRoute.classList.remove('active');
        viewRoute.style.display = 'none';
        viewList.style.display = 'block';
        viewList.style.visibility = 'visible';
        searchRow.style.display = '';
        if (!A.mobileState.showingDetail) {
          viewList.classList.remove('slide-out');
          viewDetail.classList.remove('active');
        }

        setSnap('half', false);

        var filterMap = { all: 'all', fav: 'fav', visited: 'visited' };
        var filter = filterMap[tabName];
        var switchFilter = A.switchToListFilter || (listRet && listRet.switchToFilter);
        if (typeof switchFilter === 'function') {
          switchFilter(filter);
        } else {
          var filterBtn = document.querySelector('.list-filter-btn[data-filter="' + filter + '"]');
          if (filterBtn) filterBtn.click();
        }
      }

      updateMobileExportRow(tabName);
      var sortWrap = document.querySelector('.list-sort-wrap');
      if (sortWrap && A.isMobile) {
        sortWrap.style.display = (tabName === 'all') ? '' : 'none';
      }
      A.updateFilterCounts();
      A.savePanels();
    }

    function updateMobileExportRow(tabName) {
      var headerRow = document.getElementById('bs-bookmarks-header-row');
      if (headerRow) headerRow.style.display = (tabName === 'fav') ? '' : 'none';
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function (e) {
        e.stopPropagation();
        switchTab(tab.dataset.tab);
      });
    });

    // ── Detail panel override ──
    var origOpenPanel = A.openPanel;
    var origClosePanel = A.closePanel;
    var origRenderPanel = A.renderPanel;

    A.openPanel = function (feature) {
      if (!A.isMobile) return origOpenPanel(feature);

      var panelEl = document.getElementById('panel');
      var panelInner = document.getElementById('panel-inner');

      if (map && A.selectedId != null)
        map.setFeatureState({ source: 'aalto', id: A.selectedId }, { selected: false });
      A.selectedId = feature.id;
      if (map && feature.id != null)
        map.setFeatureState({ source: 'aalto', id: feature.id }, { selected: true });
      A.currentFeature = feature;

      origRenderPanel(feature);

      if (panelInner) {
        detailContent.appendChild(panelInner);
      }

      var panelClose = document.getElementById('panel-close');
      if (panelClose) panelClose.style.display = 'none';

      viewRoute.classList.remove('active');
      viewRoute.style.display = 'none';
      tabBar.style.display = 'none';
      searchRow.style.display = 'none';
      A.mobileState.showingDetail = true;
      viewList.classList.add('slide-out');
      viewDetail.classList.add('active');

      detailContent.scrollTop = 0;

      requestAnimationFrame(function () {
        setSnap('full');
      });

      A.savePanels();
    };

    A.closePanel = function () {
      if (!A.isMobile) return origClosePanel();

      var panelEl = document.getElementById('panel');
      var panelInner = document.getElementById('panel-inner');
      if (panelInner && panelInner.parentNode === detailContent) {
        panelEl.appendChild(panelInner);
      }

      var panelClose = document.getElementById('panel-close');
      if (panelClose) panelClose.style.display = '';

      A.mobileState.showingDetail = false;
      viewList.classList.remove('slide-out');
      viewDetail.classList.remove('active');
      closeBtn.style.display = '';

      tabBar.style.display = '';
      searchRow.style.display = '';

      if (A.mobileState.activeTab === 'route') {
        viewList.style.display = 'none';
        viewRoute.classList.add('active');
        viewRoute.style.display = 'block';
      }

      setSnap('half');
      updateRoutePreview();

      if (map && A.selectedId != null) {
        map.setFeatureState({ source: 'aalto', id: A.selectedId }, { selected: false });
      }
      A.selectedId = null;
      A.currentFeature = null;
      A.savePanels();
    };

    closeBtn.addEventListener('click', function () {
      A.closePanel();
    });

    var carouselClose = document.querySelector('.bs-close-carousel');
    if (carouselClose) {
      carouselClose.addEventListener('click', function () {
        A.closePanel();
      });
    }

    // ── selectFeature override for mobile ──
    var origSelectFeature = A.selectFeature;
    A.selectFeature = function (feature, opts) {
      if (!A.isMobile) return origSelectFeature(feature, opts);

      A.openPanel(feature);
      A.highlightListItem(feature.id, opts);
      A.highlightRouteStop(feature.id);

      var routeSection = document.getElementById('route-section');
      if (routeSection && !routeSection.classList.contains('collapsed')) {
        routeSection.classList.add('collapsed');
        var ci = document.getElementById('route-collapsed-info');
        if (ci) ci.style.display = (A.routeStops && A.routeStops.length > 0) ? '' : 'none';
        if (typeof A.renderRouteSection === 'function') A.renderRouteSection();
        A.updatePanelLayout();
        A.savePanels();
      }

      if (map && feature.geometry && feature.geometry.coordinates) {
        requestAnimationFrame(function () {
          map.flyTo({
            center: feature.geometry.coordinates,
            zoom: 16,
            pitch: 45,
            speed: 1.8,
            padding: { top: 40, bottom: 20, left: 40, right: 40 },
          });
        });
      }
    };

    // ── Keyboard handling ──
    var searchInput = document.getElementById('list-search');
    if (searchInput) {
      searchInput.addEventListener('focus', function () {
        if (!A.isMobile) return;
        A.mobileState.previousSnap = A.mobileState.snap;
        setSnap('full');
      });
      searchInput.addEventListener('blur', function () {
        if (!A.isMobile) return;
        if (A.mobileState.snap === 'full') {
          setSnap(A.mobileState.previousSnap || 'half');
        }
      });
    }

    // visualViewport resize (keyboard appear/dismiss)
    if (window.visualViewport) {
      var lastVVHeight = window.visualViewport.height;
      window.visualViewport.addEventListener('resize', function () {
        if (!A.isMobile) return;
        var newH = window.visualViewport.height;
        var delta = lastVVHeight - newH;
        lastVVHeight = newH;

        // Keyboard appeared (viewport shrank significantly)
        if (delta > 100) {
          A.mobileState.preKeyboardSnap = A.mobileState.snap;
          setSnap('full', true);
          return;
        }
        // Keyboard dismissed (viewport grew significantly)
        if (delta < -100 && A.mobileState.preKeyboardSnap) {
          setSnap(A.mobileState.preKeyboardSnap, true);
          A.mobileState.preKeyboardSnap = null;
          return;
        }
        // Small resize: re-snap at current position
        setSnap(A.mobileState.snap, false);
      });
    }

    // ── Window resize ──
    window.addEventListener('resize', function () {
      if (A.isMobile) {
        setSnap(A.mobileState.snap, false);
      }
    });

    // ── Media query change ──
    mql.addEventListener('change', function (e) {
      A.isMobile = e.matches;
      if (e.matches) enterMobileMode();
      else exitMobileMode();
    });

    // Expose getSnapValues for layout.js getMapPadding
    window._bsGetSnapValues = getSnapValues;

    // Expose switchTab for state restore
    A.mobileSwitchTab = switchTab;

    // ── Initial setup ──
    if (A.isMobile) {
      enterMobileMode();
      requestAnimationFrame(function () {
        A.updateFilterCounts();
      });
    }

    // ── Route preview in peek state ──
    var routePreview = sheet.querySelector('.bs-route-preview');

    function updateRoutePreview() {
      if (!routePreview) return;
      var routeCount = A.routeStops ? A.routeStops.length : 0;
      var onRouteTab = A.mobileState.activeTab === 'route';
      if (routeCount === 0 || !onRouteTab || A.mobileState.showingDetail) {
        var wasVisible = routePreview.style.display !== 'none';
        routePreview.style.display = 'none';
        if (wasVisible && A.mobileState.snap === 'peek') setSnap('peek', true);
        return;
      }
      var totalDist = 0;
      var totalDur = 0;
      if (A.routeSegments) {
        A.routeSegments.forEach(function (seg) {
          if (seg && seg.distance) totalDist += seg.distance;
          if (seg && seg.duration) totalDur += seg.duration;
        });
      }
      var stopLabel = routeCount !== 1 ? A.t('stops') : A.t('stop');
      var summary = routeCount + ' ' + stopLabel;
      if (totalDist > 0) {
        summary += ' · ' + (totalDist >= 1000 ? Math.round(totalDist / 100) / 10 + ' km' : Math.round(totalDist) + ' m');
      }
      if (totalDur > 0) {
        var hrs = Math.floor(totalDur / 3600);
        var mins = Math.round((totalDur % 3600) / 60);
        summary += ' · ' + (hrs > 0 ? hrs + 'h ' : '') + mins + 'min';
      }
      routePreview.innerHTML = '<span class="bs-route-preview-text">' + summary + '</span><button class="bs-route-preview-clear">' + (A.t ? A.t('clear') : 'CLEAR') + '</button>';
      routePreview.style.display = '';

      if (A.mobileState.snap === 'peek') setSnap('peek', true);

      routePreview.querySelector('.bs-route-preview-text').onclick = function () {
        switchTab('route');
        if (A.mobileState.snap === 'peek') setSnap('half');
        if (A.routeStops && A.routeStops.length >= 2) A.fitRouteOverview();
      };
      routePreview.querySelector('.bs-route-preview-clear').onclick = function (e) {
        e.stopPropagation();
        A.routeStops.length = 0;
        A.routeSegments = [];
        A.saveRoute();
        A.rebuildAaltoSource();
        if (A.updateRouteOnMap) A.updateRouteOnMap();
        A.renderRouteSection();
        A.renderList();
        A.updateFilterCounts();
      };
    }

    // Wrap renderRouteSection to update preview on any route change
    var origRenderRouteSection = A.renderRouteSection;
    A.renderRouteSection = function () {
      origRenderRouteSection();
      if (A.isMobile) updateRoutePreview();
    };

    // ── Update tab counts and route tab styling ──
    var origUpdateFilterCounts = A.updateFilterCounts;
    if (origUpdateFilterCounts) {
      A.updateFilterCounts = function () {
        origUpdateFilterCounts();
        if (!A.isMobile) return;

        var allTab = sheet.querySelector('[data-tab="all"]');
        var favTab = sheet.querySelector('[data-tab="fav"]');
        var visitedTab = sheet.querySelector('[data-tab="visited"]');
        var routeTab = sheet.querySelector('[data-tab="route"]');
        var totalCount = A.total || 0;
        var favCount = A.favs ? A.favs.size : 0;
        var visitedCount = A.visited ? A.visited.size : 0;
        var routeCount = A.routeStops ? A.routeStops.length : 0;

        allTab.innerHTML = A.t('mobileTabAll') + (totalCount ? '<span class="bs-count">(' + totalCount + ')</span>' : '');
        favTab.innerHTML = A.t('mobileTabBookmarks') + (favCount ? '<span class="bs-count">(' + favCount + ')</span>' : '');
        visitedTab.innerHTML = A.t('mobileTabVisited') + (visitedCount ? '<span class="bs-count">(' + visitedCount + ')</span>' : '');
        routeTab.innerHTML = A.t('mobileTabRoute') + (routeCount ? '<span class="bs-count">(' + routeCount + ')</span>' : '');

        routeTab.classList.toggle('has-route', routeCount > 0);
        updateRoutePreview();
      };
    }
  };
})();
