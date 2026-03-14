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
    const landscapeMql = window.matchMedia('(max-width: 767px) and (orientation: landscape)');
    A.isMobile = mql.matches;

    A.mobileState = {
      snap: 'peek',
      previousSnap: 'peek',
      activeTab: 'all',
      showingDetail: false,
      isLandscape: landscapeMql.matches,
    };

    // ── Snap point values ──
    function getSnapValues() {
      if (A.mobileState.isLandscape) {
        return { dismissed: 0, peek: 0, half: 0, full: 0 };
      }
      var vh = window.innerHeight;
      var halfPct = A.mobileState.showingDetail ? 0.75 : 0.55;
      return {
        dismissed: 0,
        peek: 180,
        half: Math.round(vh * halfPct),
        full: vh,
      };
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
      var maxH = Math.round(window.innerHeight * 0.55);
      return Math.min(total, maxH);
    }

    function setSnap(snapName, animated) {
      if (typeof animated === 'undefined') animated = true;
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
        // For list/route mode at half snap, use fit-to-content
        if (snapName === 'half' && !A.mobileState.showingDetail) {
          px = getContentFitHeight();
        }
        sheet.style.transform = 'translateY(' + (sheetHeight - px) + 'px)';
        sheet.classList.add('snap-' + snapName);
        A.mobileState.currentSnapPx = px;
      }

      A.mobileState.snap = snapName;
      updateContentScroll(snapName);
      updateMapPadding();
    }

    function updateContentScroll(snapName) {
      if (snapName === 'full' || snapName === 'half') {
        content.style.overflowY = 'auto';
      } else {
        content.style.overflowY = 'hidden';
      }
    }

    function updateMapPadding() {
      if (!A.isMobile || !map) return;
      var snapName = A.mobileState.snap;
      var bottomPad = 40;
      if (snapName === 'half') bottomPad = (A.mobileState.currentSnapPx || getSnapValues().half) + 10;
      else if (snapName === 'full') bottomPad = getSnapValues().full;
      else if (snapName === 'peek') bottomPad = getSnapValues().peek + 10;

      if (A.mobileState.isLandscape) {
        map.setPadding({ top: 0, bottom: 0, left: snapName === 'dismissed' ? 0 : Math.round(window.innerWidth * 0.4) + 10, right: 0 });
      } else {
        map.setPadding({ top: 0, bottom: bottomPad, left: 0, right: 0 });
      }
    }

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
      var touch = e.touches[0];
      touchStartY = touch.clientY;
      touchStartTranslateY = getCurrentTranslateY();
      touchStartTime = Date.now();
      isDragging = true;
      sheet.classList.add('bs-dragging');
    }

    function handleTouchMove(e) {
      if (!isDragging || A.mobileState.isLandscape) return;
      var touch = e.touches[0];
      var delta = touch.clientY - touchStartY;
      var newY = touchStartTranslateY + delta;
      var maxY = window.innerHeight;
      var minY = window.innerHeight - getSnapValues().full;
      newY = Math.max(minY, Math.min(maxY, newY));
      sheet.style.transform = 'translateY(' + newY + 'px)';
    }

    function handleTouchEnd(e) {
      if (!isDragging || A.mobileState.isLandscape) return;
      isDragging = false;
      sheet.classList.remove('bs-dragging');

      var touch = e.changedTouches[0];
      var endY = touch.clientY;
      var dt = Date.now() - touchStartTime;
      var velocity = (endY - touchStartY) / Math.max(dt, 1);

      var currentTranslateY = getCurrentTranslateY();
      var currentHeight = window.innerHeight - currentTranslateY;
      var snaps = getSnapValues();
      var snapOrder = ['dismissed', 'peek', 'half', 'full'];
      var snapValues = [snaps.dismissed, snaps.peek, snaps.half, snaps.full];

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
        }
        handleTouchMove(e);
        return;
      }

      // At half/full: if at scroll top and dragging down, start sheet drag
      var activeView = content.querySelector('.bs-view.active') || content.querySelector('.bs-view-list:not(.slide-out)');
      var scrollTop = activeView ? activeView.scrollTop : 0;
      var delta = e.touches[0].clientY - contentTouchStartY;

      if (scrollTop <= 0 && delta > 10 && !contentDragging) {
        contentDragging = true;
        touchStartY = contentTouchStartY;
        touchStartTranslateY = getCurrentTranslateY();
        touchStartTime = Date.now();
        isDragging = true;
        sheet.classList.add('bs-dragging');
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
      else if (A.mobileState.snap === 'dismissed') setSnap('peek');
      else if (A.mobileState.snap === 'half') setSnap('peek');
      else if (A.mobileState.snap === 'full') setSnap('half');
    });

    // ── DOM reparenting ──
    var _origSearchParent = null;
    var _origSearchNext = null;
    var _origListBodyParent = null;
    var _origListBodyNext = null;
    var _origRouteSectionBodyParent = null;
    var _origRouteSectionBodyNext = null;

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

      // Move route helper buttons into list view
      var rfb = document.getElementById('route-from-bookmarks');
      var rfv = document.getElementById('route-from-visible');
      if (rfb && viewList.firstChild !== rfb) {
        viewList.insertBefore(rfb, viewList.firstChild);
      }
      if (rfv) {
        var listBody2 = document.getElementById('list-body');
        if (listBody2) viewList.insertBefore(rfv, listBody2);
      }

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

      // Restore search
      var searchWrap = document.getElementById('list-search-wrap');
      if (searchWrap && _origSearchParent) {
        if (_origSearchNext) _origSearchParent.insertBefore(searchWrap, _origSearchNext);
        else _origSearchParent.appendChild(searchWrap);
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

      // Reset map padding
      map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });

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
        searchRow.style.display = 'none';
        if (A.mobileState.snap === 'peek') setSnap('half');
      } else {
        viewRoute.classList.remove('active');
        viewRoute.style.display = 'none';
        viewList.style.display = '';
        searchRow.style.display = '';
        if (!A.mobileState.showingDetail) {
          viewList.classList.remove('slide-out');
          viewDetail.classList.remove('active');
        }
        // Trigger filter
        var filterMap = { all: 'all', fav: 'fav', visited: 'visited' };
        var filterBtn = document.querySelector('.list-filter-btn[data-filter="' + filterMap[tabName] + '"]');
        if (filterBtn) filterBtn.click();

        // Re-snap after content height changes from filter
        requestAnimationFrame(function () {
          if (A.mobileState.snap === 'half') setSnap('half', false);
        });
      }
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function (e) {
        e.stopPropagation();
        var tabName = tab.dataset.tab;
        switchTab(tabName);
        if (A.mobileState.snap === 'dismissed') setSnap('half');
      });
    });

    // ── Detail panel override ──
    var origOpenPanel = A.openPanel;
    var origClosePanel = A.closePanel;
    var origRenderPanel = A.renderPanel;

    A.openPanel = function (feature) {
      if (!A.isMobile) return origOpenPanel(feature);

      // Run the original render but don't show desktop panel
      var panelEl = document.getElementById('panel');

      // Set feature state
      if (map && A.selectedId != null)
        map.setFeatureState({ source: 'aalto', id: A.selectedId }, { selected: false });
      A.selectedId = feature.id;
      if (map && feature.id != null)
        map.setFeatureState({ source: 'aalto', id: feature.id }, { selected: true });
      A.currentFeature = feature;

      // Render into desktop panel (hidden), then move content
      origRenderPanel(feature);

      // Clone panel content to bottom sheet detail
      var panelCarousel = document.getElementById('panel-carousel');
      var panelBody = document.getElementById('panel-body');
      detailContent.innerHTML = '';
      if (panelCarousel) detailContent.appendChild(panelCarousel.cloneNode(true));
      if (panelBody) detailContent.appendChild(panelBody.cloneNode(true));

      // Rebind carousel events in the clone
      rebindCarousel(detailContent, feature);
      rebindActions(detailContent, feature);

      // Show detail view — hide tabs, search, and route view
      A.mobileState.showingDetail = true;
      viewList.classList.add('slide-out');
      viewDetail.classList.add('active');
      viewRoute.style.display = 'none';
      tabBar.style.display = 'none';
      searchRow.style.display = 'none';

      // Snap to half (75vh for detail) or re-snap to update height
      if (A.mobileState.snap === 'peek' || A.mobileState.snap === 'dismissed') {
        setSnap('half');
      } else {
        setSnap(A.mobileState.snap);
      }

      A.savePanels();
    };

    // Lighter re-render for action buttons (no transition, just re-clone content)
    function rerenderDetail(feature) {
      origRenderPanel(feature);
      var panelCarousel = document.getElementById('panel-carousel');
      var panelBody = document.getElementById('panel-body');
      detailContent.innerHTML = '';
      if (panelCarousel) detailContent.appendChild(panelCarousel.cloneNode(true));
      if (panelBody) detailContent.appendChild(panelBody.cloneNode(true));
      rebindCarousel(detailContent, feature);
      rebindActions(detailContent, feature);
      A.updateFilterCounts();
    }

    A.closePanel = function () {
      if (!A.isMobile) return origClosePanel();

      A.mobileState.showingDetail = false;
      viewList.classList.remove('slide-out');
      viewDetail.classList.remove('active');

      // Restore tabs and search
      tabBar.style.display = '';
      if (A.mobileState.activeTab !== 'route') {
        searchRow.style.display = '';
      }

      // Re-snap to recalculate height (now 55vh / fit-content)
      setSnap('half');
      updateRoutePreview();

      if (map && A.selectedId != null) {
        map.setFeatureState({ source: 'aalto', id: A.selectedId }, { selected: false });
      }
      A.selectedId = null;
      A.currentFeature = null;
      A.savePanels();
    };

    function rebindCarousel(container, feature) {
      var carousel = container.querySelector('#panel-carousel');
      if (!carousel) return;
      var imgs = A.carouselImages || [];
      var idx = 0;
      var imgEl = carousel.querySelector('#carousel-img');
      var capText = carousel.querySelector('#carousel-caption-text');
      var prevBtn = carousel.querySelector('#carousel-prev');
      var nextBtn = carousel.querySelector('#carousel-next');
      if (!imgEl) return;

      // cloneNode doesn't copy onload handlers — remove loading class and re-set handler
      imgEl.classList.remove('loading');
      imgEl.onload = function () { imgEl.classList.remove('loading'); };
      imgEl.onerror = function () { imgEl.classList.remove('loading'); };

      // Force reload: if src is already set but image didn't load in the clone
      if (imgEl.src && !imgEl.complete) {
        imgEl.src = imgEl.src;
      }

      if (imgs.length <= 1 || !prevBtn || !nextBtn) return;

      function show(n) {
        idx = (n + imgs.length) % imgs.length;
        imgEl.classList.add('loading');
        imgEl.src = imgs[idx].medium;
        imgEl.alt = imgs[idx].caption || '';
        if (capText) capText.textContent = imgs[idx].caption || '';
      }
      prevBtn.onclick = function (e) { e.stopPropagation(); show(idx - 1); };
      nextBtn.onclick = function (e) { e.stopPropagation(); show(idx + 1); };
      if (imgEl) imgEl.onclick = function () { A.openLightbox(idx); };
    }

    function rebindActions(container, feature) {
      var btns = container.querySelectorAll('[data-action]');
      btns.forEach(function (btn) {
        var action = btn.dataset.action;
        if (action === 'fav') {
          btn.onclick = function () {
            A.toggleFav(feature.id);
            rerenderDetail(feature);
            A.renderList();
          };
        } else if (action === 'visited') {
          btn.onclick = function () {
            A.toggleVisited(feature.id);
            rerenderDetail(feature);
            A.renderList();
          };
        } else if (action === 'route') {
          btn.onclick = function () {
            var coords = feature.geometry && feature.geometry.coordinates ? feature.geometry.coordinates : null;
            A.toggleRoute(feature.id, coords, feature.properties.name);
            rerenderDetail(feature);
            A.renderList();
          };
        }
      });
    }

    // Close button
    closeBtn.addEventListener('click', function () {
      A.closePanel();
    });

    // ── selectFeature override for mobile padding ──
    var origSelectFeature = A.selectFeature;
    A.selectFeature = function (feature, opts) {
      if (!A.isMobile) return origSelectFeature(feature, opts);

      A.openPanel(feature);
      A.highlightListItem(feature.id, opts);
      A.highlightRouteStop(feature.id);

      if (map && feature.geometry && feature.geometry.coordinates) {
        requestAnimationFrame(function () {
          var snaps = getSnapValues();
          var bottomPad = A.mobileState.snap === 'half' ? snaps.half : snaps.peek;
          map.flyTo({
            center: feature.geometry.coordinates,
            zoom: 16,
            pitch: 45,
            speed: 1.8,
            padding: { top: 40, bottom: bottomPad + 20, left: 40, right: 40 },
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

    // ── Orientation change ──
    landscapeMql.addEventListener('change', function (e) {
      A.mobileState.isLandscape = e.matches;
      if (A.isMobile) {
        if (e.matches) {
          setSnap('half', false);
        } else {
          setSnap(A.mobileState.snap, false);
        }
      }
    });

    // ── Resize ──
    window.addEventListener('resize', function () {
      if (A.isMobile) setSnap(A.mobileState.snap, false);
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
      if (routeCount === 0 || A.mobileState.activeTab === 'route' || A.mobileState.showingDetail) {
        routePreview.style.display = 'none';
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

      // Bind events
      routePreview.querySelector('.bs-route-preview-text').onclick = function () {
        switchTab('route');
        if (A.mobileState.snap === 'peek' || A.mobileState.snap === 'dismissed') setSnap('half');
      };
      routePreview.querySelector('.bs-route-preview-clear').onclick = function (e) {
        e.stopPropagation();
        A.routeStops.length = 0;
        A.routeSegments = [];
        A.saveRoute();
        A.rebuildAaltoSource();
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

        allTab.textContent = A.t('mobileTabAll') + ' (' + totalCount + ')';
        favTab.textContent = A.t('mobileTabBookmarks') + ' (' + favCount + ')';
        visitedTab.textContent = A.t('mobileTabVisited') + ' (' + visitedCount + ')';
        routeTab.textContent = A.t('mobileTabRoute') + ' (' + routeCount + ')';

        // Route tab in black when route has stops
        routeTab.classList.toggle('has-route', routeCount > 0);

        // Update route preview
        updateRoutePreview();
      };
    }
  };
})();
