// ═══════════════════════════════════════════════════════
//  Map Init — Orchestrator: create map, load data, wire modules, click handlers
// Expects: window.Aalto, initMapLayers, initListPanel, initRoutePlanner, initLayout
// ═══════════════════════════════════════════════════════
(function() {
  const A = window.Aalto;
  const mapEl = document.getElementById('map');

  mapboxgl.accessToken = 'pk.eyJ1IjoibnNsYXZpbiIsImEiOiJjbW1sNWxtMnYwMzUwMnBzNzhkMTljbGNsIn0.fkor-RTU_VQKCE4icVJSJg';

  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/nslavin/cmml8edyr004101r1fxw306px',
    center: [13.3217, 52.521],
    zoom: 4,
    bearing: -11,
    pitch: 42,
    minZoom: 3,
  });

  A.map = map;

  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-left');

  let _savePosTimer;
  map.on('moveend', () => {
    clearTimeout(_savePosTimer);
    _savePosTimer = setTimeout(() => {
      const c = map.getCenter();
      localStorage.setItem('aalto_map_pos', JSON.stringify({
        lng: c.lng, lat: c.lat, zoom: map.getZoom(),
        bearing: map.getBearing(), pitch: map.getPitch(),
      }));
    }, 400);
  });

  map.once('style.load', () => map.resize());

  let _skipMapClick = false;
  let _clusterClickEvt = null;

  map.on('load', async () => {
    let geoRes, detRes, countriesRes, citiesRes, metroRes;
    try {
      [geoRes, detRes, countriesRes, citiesRes, metroRes] = await Promise.all([
        fetch('./data/aalto_route.geojson'),
        fetch('./data/aalto_details.json').catch(() => null),
        fetch('./data/aalto_clusters_countries.geojson'),
        fetch('./data/aalto_clusters_cities.geojson'),
        fetch('./data/aalto_clusters_helsinki_metropolitan.geojson'),
      ]);
    } catch (e) {
      A.showToast('Failed to load map data. Please refresh.', 8000);
      return;
    }

    let data, countriesData, citiesData, metroData;
    try {
      data = await geoRes.json();
      if (detRes?.ok) A.details = await detRes.json();
      else if (!A.details) A.details = {};
      countriesData = await countriesRes.json();
      citiesData = await citiesRes.json();
      metroData = await metroRes.json();
    } catch (e) {
      A.showToast('Failed to parse map data. Please refresh.', 8000);
      return;
    }

    A.total = data.features.length;

    const _loadImg = url => new Promise((res, rej) => {
      const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = url;
    });
    const [_dotImg, _dotRouteImg] = await Promise.all([
      _loadImg('icons/dot.svg'),
      _loadImg('icons/dot-route.svg'),
    ]);
    map.addImage('aalto-dot', _dotImg, { sdf: true, pixelRatio: 2 });
    map.addImage('aalto-dot-route', _dotRouteImg, { pixelRatio: 2 });

    window.initMapLayers(map, data, countriesData, citiesData, metroData, A);

    const _savedPos = localStorage.getItem('aalto_map_pos');
    if (_savedPos) {
      try {
        const p = JSON.parse(_savedPos);
        map.jumpTo({ center: [p.lng, p.lat], zoom: p.zoom, bearing: p.bearing, pitch: p.pitch });
      } catch (e) { /* ignore corrupt data */ }
    } else {
      map.jumpTo({ center: [13.3217, 52.521], zoom: 4, bearing: -11, pitch: 42 });
    }

    const layoutRet = window.initLayout(map, mapEl, A);
    const expandDestinations = layoutRet.expandDestinations;

    const listRet = window.initListPanel(map, data, A, expandDestinations);
    const featureList = listRet.featureList;

    const setSkipMapClick = (v) => { _skipMapClick = v; };
    window.initRoutePlanner(map, A, featureList, setSkipMapClick);

    (function applyLayerOrder() {
      const routeLayerIds = ['route-stop-cluster-markers', 'route-stop-cluster-labels', 'route-stop-markers', 'route-stop-numbers', 'route-stop-labels'];
      routeLayerIds.forEach(id => {
        if (map.getLayer(id)) map.moveLayer(id);
      });
    })();

    if (window.initLayerZoomConfig) window.initLayerZoomConfig(map);

    const nameToCoords = {};
    data.features.forEach(f => { nameToCoords[f.properties.name] = f.geometry.coordinates; });

    const FINLAND_CLICK_STATE = { center: [24.8041, 60.8095], zoom: 6.62, bearing: 0, pitch: 0 };

    function selectFeatureByName(name, coords) {
      const match = featureList.find(f => f.name === name);
      if (match) A.selectFeature({ ...match.feature, id: match.id });
      else map.flyTo({ center: coords, zoom: 18, pitch: 50, speed: 1.8 });
    }

    function handleClusterClick(props, coords, useFitBounds = false) {
      _skipMapClick = true;
      const objects = typeof props.objects === 'string'
        ? JSON.parse(props.objects || '[]')
        : (Array.isArray(props.objects) ? props.objects : []);
      if (props.count === 1) {
        selectFeatureByName(objects[0]?.name, coords);
      } else {
        if (useFitBounds && (props.name === 'Finland' || props.name_fi === 'Suomi')) {
          map.flyTo({ ...FINLAND_CLICK_STATE, speed: 1.4 });
          return;
        }
        const pts = objects.map(o => nameToCoords[o.name]).filter(Boolean);
        if (pts.length >= 2) {
          const lons = pts.map(c => c[0]);
          const lats = pts.map(c => c[1]);
          const bounds = [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
          if (useFitBounds) {
            const cam = map.cameraForBounds(bounds, { padding: { top: 40, bottom: 160, left: 80, right: 80 } });
            map.flyTo({ center: cam.center, zoom: 7, bearing: 0, pitch: 0, speed: 1.4 });
          } else {
            const cam = map.cameraForBounds(bounds, { padding: 80 });
            map.flyTo({ center: cam.center, zoom: Math.max(cam.zoom, 6.5), bearing: 0, pitch: 0, speed: 1.4 });
          }
        } else {
          map.flyTo({ center: coords, zoom: map.getZoom() + 3, pitch: 0, speed: 1.4 });
        }
      }
    }

    const countryClusterLayerIds = ['country-clusters', 'country-labels', 'country-clusters-stack'];
    const cityClusterLayerIds = ['city-clusters', 'city-labels', 'city-clusters-stack'];
    const metroClusterLayerIds = ['metro-clusters', 'metro-labels', 'metro-clusters-stack'];

    countryClusterLayerIds.forEach(id => {
      map.on('click', id, (e) => {
        if (e.originalEvent === _clusterClickEvt) return;
        _clusterClickEvt = e.originalEvent;
        handleClusterClick(e.features[0].properties, e.features[0].geometry.coordinates, true);
      });
      map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
    });

    cityClusterLayerIds.forEach(id => {
      map.on('click', id, (e) => {
        if (e.originalEvent === _clusterClickEvt) return;
        _clusterClickEvt = e.originalEvent;
        handleClusterClick(e.features[0].properties, e.features[0].geometry.coordinates);
      });
      map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
    });

    metroClusterLayerIds.forEach(id => {
      map.on('click', id, (e) => {
        if (e.originalEvent === _clusterClickEvt) return;
        _clusterClickEvt = e.originalEvent;
        handleClusterClick(e.features[0].properties, e.features[0].geometry.coordinates);
      });
      map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
    });

    const handleAaltoClusterClick = (e) => {
      _skipMapClick = true;
      const f = e.features[0];
      const clusterId = f.properties?.cluster_id ?? f.id;
      if (clusterId == null) {
        map.flyTo({ center: f.geometry.coordinates, zoom: map.getZoom() + 2, pitch: 0 });
        return;
      }
      const source = map.getSource('aalto');
      if (!source || typeof source.getClusterLeaves !== 'function') {
        map.flyTo({ center: f.geometry.coordinates, zoom: map.getZoom() + 2, pitch: 0 });
        return;
      }
      source.getClusterLeaves(clusterId, 500, 0, (err, leaves) => {
        if (err || !leaves || leaves.length === 0) {
          map.flyTo({ center: f.geometry.coordinates, zoom: map.getZoom() + 2, pitch: 0 });
          return;
        }
        const coords = leaves
          .map(leaf => leaf.geometry?.coordinates)
          .filter(c => Array.isArray(c) && c.length >= 2);
        if (coords.length === 0) {
          map.flyTo({ center: f.geometry.coordinates, zoom: map.getZoom() + 2, pitch: 0 });
          return;
        }
        const lons = coords.map(c => c[0]);
        const lats = coords.map(c => c[1]);
        const bounds = [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
        map.fitBounds(bounds, { padding: 80, pitch: 0, duration: 800, maxZoom: 16 });
      });
    };

    ['aalto-clusters', 'aalto-clusters-stack', 'aalto-cluster-labels'].forEach(id => {
      map.on('click', id, handleAaltoClusterClick);
    });
    map.on('mouseenter', 'aalto-clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'aalto-clusters', () => { map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', 'aalto-clusters-stack', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'aalto-clusters-stack', () => { map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', 'aalto-cluster-labels', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'aalto-cluster-labels', () => { map.getCanvas().style.cursor = ''; });

    map.on('click', 'aalto-points', (e) => {
      _skipMapClick = true;
      const filter = listRet.getActiveFilter();
      if (filter === 'fav' || filter === 'visited') {
        listRet.switchToFilter('all');
      }
      if (map.getZoom() < 17)
        map.flyTo({ center: e.features[0].geometry.coordinates, zoom: 18, pitch: 50, speed: 1.2 });
      A.selectFeature(e.features[0]);
    });
    map.on('mouseenter', 'aalto-points', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'aalto-points', () => { map.getCanvas().style.cursor = ''; });

    function handleFilteredMarkerClick(e) {
      _skipMapClick = true;
      const feat = e.features[0];
      const fid = feat.properties?.id;
      const match = typeof fid === 'number' ? featureList.find(f => f.id === fid) : null;
      if (match) {
        const filter = listRet.getActiveFilter();
        if (filter === 'fav' || filter === 'visited') {
          listRet.switchToFilter('all');
        } else if (map.getZoom() < 17) {
          map.flyTo({ center: feat.geometry.coordinates, zoom: 18, pitch: 50, speed: 1.2 });
        }
        A.selectFeature({ ...match.feature, id: match.id });
      }
    }
    function handleFavVisitedClusterClick(e) {
      _skipMapClick = true;
      const f = e.features[0];
      const clusterId = f.id;
      const sourceId = f.layer.id.startsWith('aalto-favs') ? 'aalto-favs' : 'aalto-visited';
      const source = map.getSource(sourceId);
      if (!source || typeof source.getClusterExpansionZoom !== 'function') {
        map.flyTo({ center: f.geometry.coordinates, zoom: map.getZoom() + 2, pitch: 0 });
        return;
      }
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        map.flyTo({ center: f.geometry.coordinates, zoom: zoom, pitch: 0, duration: 500 });
      });
    }
    ['aalto-favs-cluster-markers', 'aalto-favs-cluster-labels', 'aalto-visited-cluster-markers', 'aalto-visited-cluster-labels'].forEach(id => {
      map.on('click', id, handleFavVisitedClusterClick);
      map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
    });
    ['aalto-favs-markers', 'aalto-favs-numbers', 'aalto-favs-labels', 'aalto-visited-markers', 'aalto-visited-numbers', 'aalto-visited-labels'].forEach(id => {
      map.on('click', id, handleFilteredMarkerClick);
      map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
    });

    map.on('click', (e) => {
      if (_skipMapClick) { _skipMapClick = false; return; }
      const hits = map.queryRenderedFeatures(e.point, {
        layers: ['aalto-points', 'aalto-clusters', 'country-clusters', 'city-clusters', 'metro-clusters', 'route-stop-markers', 'route-stop-labels', 'route-stop-cluster-markers', 'route-stop-cluster-labels', 'aalto-favs-cluster-markers', 'aalto-favs-cluster-labels', 'aalto-favs-markers', 'aalto-favs-numbers', 'aalto-favs-labels', 'aalto-visited-cluster-markers', 'aalto-visited-cluster-labels', 'aalto-visited-markers', 'aalto-visited-numbers', 'aalto-visited-labels'],
      });
      if (!hits.length) A.closePanel();
    });

    A.favs.forEach(id => map.setFeatureState({ source: 'aalto', id }, { fav: true }));
    A.visited.forEach(id => map.setFeatureState({ source: 'aalto', id }, { visited: true }));

    A.updateFilterCounts();

    A.renderRouteSection();
    if (A.routeStops.length >= 2) {
      let _googleMapsRetries = 0;
      const _googleMapsMaxRetries = 25;
      function tryCalculateRoute() {
        if (typeof google !== 'undefined' && google.maps) {
          A.calculateAllSegments();
        } else if (_googleMapsRetries < _googleMapsMaxRetries) {
          _googleMapsRetries++;
          setTimeout(tryCalculateRoute, 200);
        } else {
          A.showToast('Route directions unavailable — Google Maps failed to load', 5000);
        }
      }
      tryCalculateRoute();
    }

    A.renderList();

    const savedPanels = A.loadPanels();
    if (savedPanels) {
      A.listCollapsed = savedPanels.listCollapsed;
      document.getElementById('list-body').style.display = A.listCollapsed ? 'none' : '';
      document.getElementById('list-toggle').style.transform = A.listCollapsed ? 'rotate(-90deg)' : '';
      document.getElementById('list-panel').classList.toggle('list-collapsed', A.listCollapsed);

      const routeSection = document.getElementById('route-section');
      if (savedPanels.routeCollapsed) {
        routeSection.classList.add('collapsed');
        const ci = document.getElementById('route-collapsed-info');
        ci.style.display = A.routeStops.length > 0 ? '' : 'none';
      } else {
        routeSection.classList.remove('collapsed');
      }

      if (savedPanels.panelOpen && savedPanels.selectedId != null) {
        const item = featureList.find(f => f.id == savedPanels.selectedId);
        if (item) A.selectFeature({ ...item.feature, id: item.id }, { skipExpand: true });
      }

      A.updatePanelLayout();
    }
  });
})();
