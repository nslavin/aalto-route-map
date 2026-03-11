// ═══════════════════════════════════════════════════════
//  Layout — updatePanelLayout, list/route collapse, fitRouteOverview
// Expects: map, mapEl, A (Aalto)
// ═══════════════════════════════════════════════════════
(function() {
  window.initLayout = function(map, mapEl, A) {
    A.updatePanelLayout = function() {
      const routeCollapsed = document.getElementById('route-section').classList.contains('collapsed');
      const bothCollapsed = A.listCollapsed && routeCollapsed;
      const listPanel = document.getElementById('list-panel');
      const panelEl = document.getElementById('panel');
      const panelOpen = panelEl.classList.contains('open');

      listPanel.classList.toggle('minimized', bothCollapsed);
      panelEl.classList.remove('stacked');
      listPanel.classList.remove('stacked-host');

      if (bothCollapsed) {
        listPanel.style.height = '';
        const listHeight = listPanel.offsetHeight;
        panelEl.style.top = listHeight + 'px';
        panelEl.style.height = `calc(100vh - ${listHeight}px)`;
        panelEl.style.right = '0';
        panelEl.style.width = '33.33vw';
        mapEl.classList.remove('detail-open');
        mapEl.style.width = '100vw';
      } else if (panelOpen && !A.listCollapsed) {
        listPanel.style.height = '100vh';
        listPanel.style.background = '#fff';
        panelEl.style.top = '0';
        panelEl.style.height = '100vh';
        panelEl.style.background = '#fff';
        panelEl.style.right = '33.33vw';
        panelEl.style.width = '33.33vw';
        mapEl.style.width = '';
        if (!mapEl.classList.contains('detail-open'))
          mapEl.classList.add('detail-open');
      } else if (A.listCollapsed) {
        if (panelOpen) {
          listPanel.style.height = '100vh';
          listPanel.style.background = '#fff';
          panelEl.style.top = '0';
          panelEl.style.height = '100vh';
          panelEl.style.right = '33.33vw';
          panelEl.style.width = '33.33vw';
          panelEl.style.background = '#fff';
          mapEl.style.width = '';
          if (!mapEl.classList.contains('detail-open'))
            mapEl.classList.add('detail-open');
        } else {
          listPanel.style.height = '';
          listPanel.style.background = '';
          panelEl.style.top = '';
          panelEl.style.height = '';
          panelEl.style.right = '';
          panelEl.style.width = '';
          panelEl.style.background = '';
          mapEl.style.width = '100vw';
          mapEl.classList.remove('detail-open');
        }
      } else {
        listPanel.style.height = '';
        listPanel.style.background = '';
        panelEl.style.top = '';
        panelEl.style.height = '';
        panelEl.style.right = '';
        panelEl.style.width = '';
        panelEl.style.background = '';
        mapEl.style.width = '';
      }
      mapEl.style.transition = 'none';
      map.resize();
      requestAnimationFrame(() => { mapEl.style.transition = ''; });
    };

    window.addEventListener('resize', () => A.updatePanelLayout());

    A.fitRouteOverview = function() {
      if (A.routeStops.length < 2) return;
      const bounds = new mapboxgl.LngLatBounds();
      A.routeStops.forEach(s => bounds.extend(s.coords));
      map.fitBounds(bounds, { padding: 80, pitch: 0, duration: 1000 });
    };

    A.listCollapsed = false;
    function expandDestinations() {
      if (A.listCollapsed) {
        A.listCollapsed = false;
        document.getElementById('list-body').style.display = '';
        document.getElementById('list-toggle').style.transform = '';
        document.getElementById('list-panel').classList.remove('list-collapsed');
        A.updatePanelLayout();
        A.savePanels();
      }
    }
    document.getElementById('list-section-header').onclick = () => {
      A.listCollapsed = !A.listCollapsed;
      document.getElementById('list-body').style.display = A.listCollapsed ? 'none' : '';
      document.getElementById('list-toggle').style.transform = A.listCollapsed ? 'rotate(-90deg)' : '';
      document.getElementById('list-panel').classList.toggle('list-collapsed', A.listCollapsed);
      A.updatePanelLayout();
      A.savePanels();
    };

    return { updatePanelLayout: A.updatePanelLayout, fitRouteOverview: A.fitRouteOverview, expandDestinations };
  };
})();
