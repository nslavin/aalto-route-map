// ═══════════════════════════════════════════════════════
//  Bottom Sheet — Mobile layout: snaps, gestures, reparenting
//  Expects: window.Aalto
// ═══════════════════════════════════════════════════════
(function () {
  const A = window.Aalto;

  window.initBottomSheet = function (map, mapEl, listRet) {
    const sheet = document.getElementById('bottom-sheet');
    const handle = sheet.querySelector('.bs-handle');
    const content = sheet.querySelector('.bs-content');
    const tabs = sheet.querySelectorAll('.bs-tab');
    const viewList = sheet.querySelector('.bs-view-list');
    const viewDetail = sheet.querySelector('.bs-view-detail');
    const viewRoute = sheet.querySelector('.bs-view-route');
    const detailContent = sheet.querySelector('.bs-detail-content');
    const closeBtn = sheet.querySelector('.bs-close');
    const searchRow = sheet.querySelector('.bs-search-row');

    // ── Mobile detection ──
    const mql = window.matchMedia('(max-width: 767px)');
    A.isMobile = mql.matches;

    A.mobileState = {
      snap: 'peek',
      previousSnap: 'peek',
      activeTab: 'all',
      showingDetail: false,
      isLandscape: false,
    };

    // ── Snap point values ──
    function getPeekHeight() {
      var h = handle.offsetHeight || 28;
      var tabBarEl = sheet.querySelector('.bs-tabs');
      if (tabBarEl && tabBarEl.style.display !== 'none') h += tabBarEl.offsetHeight;
      if (searchRow && searchRow.style.display !== 'none') h += searchRow.offsetHeight;
      var rp = sheet.querySelector('.bs-route-preview');
      if (rp && rp.style.display !== 'none') h += rp.offsetHeight;
      return Math.max(h + 10, 120);
    }

    function getVisibleViewportHeight() {
      var vv = window.visualViewport && typeof window.visualViewport.height === 'number' ? window.visualViewport.height : null;
      var ih = window.innerHeight;
      return vv != null ? Math.min(vv, ih) : ih;
    }

    function getSnapValues() {
      if (A.mobileState.isLandscape) {
        return { dismissed: 0, peek: 0, half: 0, full: 0 };
      }
      var vh = getVisibleViewportHeight();
      var halfPct = A.mobileState.showingDetail ? 0.75 : 0.55;
      return {
        dismissed: 0,
        peek: getPeekHeight(),
        half: Math.round(vh * halfPct),
        full: vh,
      };
    }

    // Set sheet height to visible viewport so panel bottom always ends on screen
    function setSheetHeight() {
      if (!A.isMobile || !sheet) return;
      var h = Math.max(100, getVisibleViewportHeight());
      sheet.style.height = h + 'px';
      sheet.style.maxHeight = '';
    }

    // Measure actual content height for fit-to-content in list/route mode
    function getContentFitHeight() {
      var chrome = handle.offsetHeight;
      var tabBarEl = sheet.querySelector('.bs-tabs');
      if (tabBarEl && tabBarEl.style.display !== 'none') chrome += tabBarEl.offsetHeight;
      if (searchRow && searchRow.style.display !== 'none') chrome += searchRow.offsetHeight;
      var routePreviewEl = sheet.querySelector('.bs-route-preview');
      if (routePreviewEl && routePreviewEl.style.display !== 'none') chrome += routePreviewEl.offsetHeight;

      // Measure actual content children (not the abs-positioned view container)
      var contentH = 0;
      if (A.mobileState.activeTab === 'route') {
        var routeBody = document.getElementById('route-section-body');
        contentH = routeBody ? routeBody.scrollHeight : 0;
      } else {
        var listBody = document.getElementById('list-body');
        contentH = listBody ? listBody.scrollHeight : 0;
        // Add route helper buttons if visible
        var rfb = document.getElementById('route-from-bookmarks');
        var rfv = document.getElementById('route-from-visible');
        if (rfb && rfb.offsetHeight) contentH += rfb.offsetHeight;
        if (rfv && rfv.offsetHeight) contentH += rfv.offsetHeight;
      }

      var total = chrome + contentH;
      var maxH = Math.round(getVisibleViewportHeight() * 0.55);
      var minH = getPeekHeight();
      return Math.max(minH, Math.min(total, maxH));
    }

    function setSnap(snapName, animated) {
      if (typeof animated === 'undefined') animated = true;
      // Keep sheet height in sync with viewport so full/half/peek transforms are correct
      if (A.isMobile && !A.mobileState.isLandscape) setSheetHeight();
      var snaps = getSnapValues();

      if (A.mobileState.isLandscape) {
        sheet.classList.remove('bs-dismissed', 'snap-peek', 'snap-half', 'snap-full');
        if (snapName === 'dismissed') {
          sheet.classList.add('bs-dismissed');
        } else {
          sheet.classList.add('snap-' + snapName);
        }
        A.mobileState.snap = snapName;
        A.mobileState.currentSnapPx = 0;
        updateMapPadding();
        return;
      }

      sheet.style.transition = animated
        ? 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)'
        : 'none';

      sheet.classList.remove('bs-dismissed', 'snap-peek', 'snap-half', 'snap-full');

      var sheetHeight = sheet.offsetHeight;
      if (snapName === 'dismissed') {
        sheet.style.transform = 'translateY(' + sheetHeight + 'px)';
        sheet.classList.add('bs-dismissed');
        A.mobileState.currentSnapPx = 0;
      } else {
        var px = snaps[snapName];
        // For list/route mode at half snap, use fit-to-content (with minimum so panel is usable)
        if (snapName === 'half' && !A.mobileState.showingDetail) {
          px = Math.max(getContentFitHeight(), Math.round(getVisibleViewportHeight() * 0.35));
        }
        // Don't show more than "full" (no invisible bottom): ty >= sheetHeight - full; allow half/peek (positive ty)
        var full = snaps.full;
        var ty = sheetHeight - px;
        var minTy = sheetHeight - full;
        if (ty < minTy) ty = minTy;
        sheet.style.transform = 'translateY(' + ty + 'px)';
        sheet.classList.add('snap-' + snapName);
        A.mobileState.currentSnapPx = px;
      }

      A.mobileState.snap = snapName;
      updateContentScroll(snapName);
      updateMapPadding();
    }

    function updateContentScroll(snapName) {
      // Keep content non-scrollable so only the inner .bs-view scrolls (single scroll container)
      content.style.overflowY = 'hidden';
    }

    // targetSheetPx: known visible sheet height (from setSnap or drag).
    // When omitted, reads the sheet's actual position via getBoundingClientRect.
    function syncMapToSheet(targetSheetPx) {
      if (!A.isMobile || !map) return;

      if (A.mobileState.isLandscape) {
        mapEl.style.height = '';
        var snapName = A.mobileState.snap;
        map.setPadding({ top: 0, bottom: 0, left: snapName === 'dismissed' ? 0 : Math.round(window.innerWidth * 0.4) + 10, right: 0 });
      } else {
        var mapH;
        if (typeof targetSheetPx === 'number') {
          mapH = window.innerHeight - targetSheetPx;
        } else {
          // Fallback: read actual sheet position (for transitionend, etc.)
          var sheetTop = sheet.getBoundingClientRect().top;
          if (sheetTop >= window.innerHeight) sheetTop = window.innerHeight;
          mapH = sheetTop;
        }
        mapEl.style.height = Math.max(mapH, 0) + 'px';
        map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
      }
      map.resize();
      // Second resize after layout has settled to avoid blank/gray area; defer if camera is animating
      requestAnimationFrame(function () {
        if (map.isMoving()) {
          map.once('moveend', function () { map.resize(); });
        } else {
          map.resize();
        }
      });
    }

    function updateMapPadding() { syncMapToSheet(A.mobileState.currentSnapPx || 0); }

    // Sync map after any sheet CSS transition finishes (safety net)
    sheet.addEventListener('transitionend', function (e) {
      if (e.target !== sheet) return;
      if (map.isMoving()) {
        map.once('moveend', function () { syncMapToSheet(); });
      } else {
        syncMapToSheet();
      }
    });

    // ── Touch gesture handling ──
    var touchStartY = 0;
    var touchStartTranslateY = 0;
    var touchStartTime = 0;
    var isDragging = false;

    function getCurrentTranslateY() {
      var style = window.getComputedStyle(sheet);
      var matrix = new DOMMatrix(style.transform);
      return matrix.m42;
    }

    function handleTouchStart(e) {
      if (A.mobileState.isLandscape) return;
      if (e.target && e.target.closest && e.target.closest('.bs-tab')) return;
      var touch = e.touches[0];
      touchStartY = touch.clientY;
      touchStartTranslateY = getCurrentTranslateY();
      touchStartTime = Date.now();
      isDragging = true;
      sheet.classList.add('bs-dragging');
      mapEl.classList.add('bs-dragging-map');
    }

    function handleTouchMove(e) {
      if (!isDragging || A.mobileState.isLandscape) return;
      var touch = e.touches[0];
      var delta = touch.clientY - touchStartY;
      var newY = touchStartTranslateY + delta;
      var sh = sheet.offsetHeight;
      var snaps = getSnapValues();
      // Clamp so we never show more than full (maxY = sh - full) and can go down to peek (minY = sh - peek)
      var maxY = sh - snaps.full;
      var minY = sh - getPeekHeight();
      newY = Math.max(minY, Math.min(maxY, newY));
      sheet.style.transform = 'translateY(' + newY + 'px)';

      // Resize map to match during drag — visible sheet height = innerHeight - newY
      syncMapToSheet(window.innerHeight - newY);
    }

    function handleTouchEnd(e) {
      if (!isDragging || A.mobileState.isLandscape) return;
      isDragging = false;
      sheet.classList.remove('bs-dragging');
      mapEl.classList.remove('bs-dragging-map');

      var touch = e.changedTouches[0];
      var endY = touch.clientY;
      var dt = Date.now() - touchStartTime;
      var velocity = (endY - touchStartY) / Math.max(dt, 1);

      var currentTranslateY = getCurrentTranslateY();
      var currentHeight = window.innerHeight - currentTranslateY;
      var snaps = getSnapValues();
      var snapOrder = ['peek', 'half', 'full'];
      var snapValues = [snaps.peek, snaps.half, snaps.full];

      // Fast swipe: snap to next in direction
      if (Math.abs(velocity) > 0.4) {
        var currentIdx = 0;
        var minDist = Infinity;
        for (var i = 0; i < snapValues.length; i++) {
          var d = Math.abs(currentHeight - snapValues[i]);
          if (d < minDist) { minDist = d; currentIdx = i; }
        }
        if (velocity > 0) {
          // Swiping down
          setSnap(snapOrder[Math.max(0, currentIdx - 1)]);
        } else {
          // Swiping up
          setSnap(snapOrder[Math.min(snapOrder.length - 1, currentIdx + 1)]);
        }
        return;
      }

      // Slow drag: snap to nearest
      var nearest = 'peek';
      var nearestDist = Infinity;
      for (var j = 0; j < snapValues.length; j++) {
        var dist = Math.abs(currentHeight - snapValues[j]);
        if (dist < nearestDist) { nearestDist = dist; nearest = snapOrder[j]; }
      }
      setSnap(nearest);
    }

    handle.addEventListener('touchstart', handleTouchStart, { passive: true });
    handle.addEventListener('touchmove', handleTouchMove, { passive: false });
    handle.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Also allow dragging from tab area
    var tabBar = sheet.querySelector('.bs-tabs');
    tabBar.addEventListener('touchstart', handleTouchStart, { passive: true });
    tabBar.addEventListener('touchmove', handleTouchMove, { passive: false });
    tabBar.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Content scroll vs sheet drag disambiguation
    var contentTouchStartY = 0;
    var contentDragging = false;

    content.addEventListener('touchstart', function (e) {
      if (A.mobileState.isLandscape) return;
      contentTouchStartY = e.touches[0].clientY;
      contentDragging = false;
    }, { passive: true });

    content.addEventListener('touchmove', function (e) {
      if (A.mobileState.isLandscape) return;
      var snap = A.mobileState.snap;
      if (snap === 'peek' || snap === 'dismissed') {
        // Prevent scroll, start sheet drag
        e.preventDefault();
        if (!contentDragging) {
          contentDragging = true;
          touchStartY = contentTouchStartY;
          touchStartTranslateY = getCurrentTranslateY();
          touchStartTime = Date.now();
          isDragging = true;
          sheet.classList.add('bs-dragging');
          mapEl.classList.add('bs-dragging-map');
        }
        handleTouchMove(e);
        return;
      }

      // At half/full: start sheet drag when at scroll top and user pulls down (collapse) or up (expand)
      var delta = e.touches[0].clientY - contentTouchStartY;

      var activeView = null;
      if (A.mobileState.showingDetail) {
        activeView = detailContent;
      } else if (A.mobileState.activeTab === 'route') {
        activeView = document.getElementById('route-section-body');
      } else {
        activeView = content.querySelector('.bs-view-list:not(.slide-out)');
      }
      var viewScrollTop = activeView ? activeView.scrollTop : 0;
      var atTop = viewScrollTop <= 0;

      // When not at top and swiping up, let native scroll handle it
      if (!atTop && delta < 0 && !contentDragging) return;

      if (atTop && Math.abs(delta) > 15 && !contentDragging) {
        contentDragging = true;
        touchStartY = contentTouchStartY;
        touchStartTranslateY = getCurrentTranslateY();
        touchStartTime = Date.now();
        isDragging = true;
        sheet.classList.add('bs-dragging');
        mapEl.classList.add('bs-dragging-map');
      }

      if (contentDragging) {
        e.preventDefault();
        handleTouchMove(e);
      }
    }, { passive: false });

    content.addEventListener('touchend', function (e) {
      if (contentDragging) {
        contentDragging = false;
        handleTouchEnd(e);
      }
    }, { passive: true });

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
      setSheetHeight();

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

      // Move sort into list view (All tab) so it's only visible when list is shown
      var sortWrap = document.querySelector('.list-sort-wrap');
      if (sortWrap && sortWrap.parentNode !== viewList) {
        _origSortParent = sortWrap.parentNode;
        _origSortNext = sortWrap.nextSibling;
        viewList.insertBefore(sortWrap, viewList.firstChild);
      }

      // Keep route-actions-bar inside route-section-body so it can be sticky at bottom when scrolling
      // (no reparenting — bar stays in flow for "always visible with active route")

      map.resize();
      setSnap('peek', false);
      switchTab('all');
      A.updateFilterCounts();

      // Fit all sites on initial mobile load
      if (A.allFeatures && A.allFeatures.length > 0) {
        var bounds = new mapboxgl.LngLatBounds();
        A.allFeatures.forEach(function (f) { bounds.extend(f.geometry.coordinates); });
        map.fitBounds(bounds, { padding: { top: 40, bottom: 200, left: 40, right: 40 }, pitch: 0, duration: 0 });
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

      // Restore sort dropdown to list-filters
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

      // route-actions-bar was left inside route-section-body on mobile (no restore needed)

      // Clear sheet height so CSS applies on desktop
      sheet.style.height = '';
      // Reset map height and padding
      mapEl.style.height = '';
      map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
      map.resize();

      // Restore desktop layout
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
        // Zoom to fit route stops
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

        // Always snap to half so map is correctly sized for fitBounds
        setSnap('half', false);

        // Apply filter: use A.switchToListFilter (set by map-init) or listRet; avoids reliance on hidden #list-panel
        var filterMap = { all: 'all', fav: 'fav', visited: 'visited' };
        var filter = filterMap[tabName];
        var switchFilter = A.switchToListFilter || (listRet && listRet.switchToFilter);
        if (typeof switchFilter === 'function') {
          switchFilter(filter);
        } else {
          var filterBtn = document.querySelector('.list-filter-btn[data-filter="' + filter + '"]');
          if (filterBtn) filterBtn.click();
        }

        // Re-snap after content height changes from filter
        if (filter === 'all') {
          // Immediate re-snap for 'all' (no fitBounds to interrupt)
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              if (A.mobileState.snap === 'half') setSnap('half', false);
            });
          });
        } else {
          // For fav/visited, delay re-snap so fitBounds animation (600ms) completes first
          setTimeout(function () {
            if (A.mobileState.snap === 'half') setSnap('half', true);
          }, 700);
        }
      }

      // Show/hide list export row based on tab
      updateMobileExportRow(tabName);
      // On mobile, show sort only in the All tab
      var sortWrap = document.querySelector('.list-sort-wrap');
      if (sortWrap && A.isMobile) {
        sortWrap.style.display = (tabName === 'all') ? '' : 'none';
      }
      A.updateFilterCounts();
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

      // Set feature state
      if (map && A.selectedId != null)
        map.setFeatureState({ source: 'aalto', id: A.selectedId }, { selected: false });
      A.selectedId = feature.id;
      if (map && feature.id != null)
        map.setFeatureState({ source: 'aalto', id: feature.id }, { selected: true });
      A.currentFeature = feature;

      // Render into panel (nodes still in #panel), then move #panel-inner into sheet
      origRenderPanel(feature);

      if (panelInner) {
        detailContent.appendChild(panelInner);
      }

      // Hide redundant panel-close when in sheet (bs-close is the single close)
      var panelClose = document.getElementById('panel-close');
      if (panelClose) panelClose.style.display = 'none';

      // Show detail view only (route panel must not overlay — one of route or info at a time)
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

    function rerenderDetail(feature) {
      origRenderPanel(feature);
      A.updateFilterCounts();
    }

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

      // Restore route panel if we're on the route tab (so we show route or info, never both)
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

    // Close button (top-right; hidden on mobile)
    closeBtn.addEventListener('click', function () {
      A.closePanel();
    });

    // Carousel close (mobile only; next to arrows)
    var carouselClose = document.querySelector('.bs-close-carousel');
    if (carouselClose) {
      carouselClose.addEventListener('click', function () {
        A.closePanel();
      });
    }

    // ── selectFeature override for mobile padding ──
    var origSelectFeature = A.selectFeature;
    A.selectFeature = function (feature, opts) {
      if (!A.isMobile) return origSelectFeature(feature, opts);

      A.openPanel(feature);
      A.highlightListItem(feature.id, opts);
      A.highlightRouteStop(feature.id);

      // Collapse route section when opening detail so the info tab takes focus
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

    // ── Resize ──
    window.addEventListener('resize', function () {
      if (A.isMobile) {
        setSheetHeight();
        map.resize();
        setSnap(A.mobileState.snap, false);
      }
    });

    // When keyboard or browser chrome changes visible viewport, keep sheet height in sync
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function () {
        if (A.isMobile) {
          setSheetHeight();
          map.resize();
          setSnap(A.mobileState.snap, false);
        }
      });
    }

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
      // Update counts and route preview for any existing data
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
      // Build summary text
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

      // Re-snap if at peek so height adjusts for preview bar
      if (A.mobileState.snap === 'peek') setSnap('peek', true);

      // Bind events
      routePreview.querySelector('.bs-route-preview-text').onclick = function () {
        switchTab('route');
        if (A.mobileState.snap === 'peek' || A.mobileState.snap === 'dismissed') setSnap('half');
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

    // ── Wrap renderRouteSection to update preview on any route change ──
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

        // Route tab in black when route has stops
        routeTab.classList.toggle('has-route', routeCount > 0);

        // Update route preview
        updateRoutePreview();
      };
    }
  };
})();
