// ═══════════════════════════════════════════════════════
//  Map Init — Data, Layers, Interactions
// Expects window.Aalto (A) with: routeStops, routeSegments, favs, visited,
// globalMode, walkThreshold, details, lang, currentFeature, selectedId, t,
// toggleFav, toggleVisited, toggleRoute, renderPanel, closePanel, selectFeature,
// updateFilterCounts, saveRoute, showToast, i18n, modeOrder
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

  map.on('load', async () => {
    const [geoRes, detRes, countriesRes, citiesRes, metroRes] = await Promise.all([
      fetch('./data/aalto_route.geojson'),
      fetch('./data/aalto_details.json').catch(() => null),
      fetch('./data/aalto_clusters_countries.geojson'),
      fetch('./data/aalto_clusters_cities.geojson'),
      fetch('./data/aalto_clusters_helsinki_metropolitan.geojson'),
    ]);

    const data = await geoRes.json();
    if (detRes?.ok) A.details = await detRes.json();
    else if (!A.details) A.details = {};
    const countriesData = await countriesRes.json();
    const citiesData = await citiesRes.json();
    const metroData = await metroRes.json();

    window._aaltoTotal = data.features.length;

    // ── Sources ──
    map.addSource('aalto', {
      type: 'geojson', data, generateId: true,
      cluster: true, clusterMaxZoom: 14, clusterRadius: 40,
      clusterProperties: {
        first_name: [['coalesce', ['accumulated'], ['get', 'name']], ['get', 'name']],
        first_name_fi: [
          ['coalesce', ['accumulated'], ['coalesce', ['get', 'name_fi'], ['get', 'name']]],
          ['coalesce', ['get', 'name_fi'], ['get', 'name']],
        ],
      },
    });
    map.addSource('aalto-countries', { type: 'geojson', data: countriesData });
    map.addSource('aalto-cities', { type: 'geojson', data: citiesData });
    map.addSource('aalto-metro', { type: 'geojson', data: metroData });

    // Rebuild aalto source with fav/visited as data properties
    A.rebuildAaltoSource = function() {
      const routeIds = new Set(A.routeStops.map(s => s.id));
      const features = data.features.map((f, i) => ({
        ...f,
        properties: {
          ...f.properties,
          _symbol: (A.favs.has(i) ? ' ★' : '') + (A.visited.has(i) ? ' ✓' : ''),
          onRoute: routeIds.has(i),
          _visited: A.visited.has(i),
          _fav: A.favs.has(i),
        },
      }));
      map.getSource('aalto').setData({ type: 'FeatureCollection', features });
      if (A.selectedId !== null)
        map.setFeatureState({ source: 'aalto', id: A.selectedId }, { selected: true });
    };
    A.rebuildAaltoSource();

    // Restore saved position or use backup default
    const _savedPos = localStorage.getItem('aalto_map_pos');
    if (_savedPos) {
      try {
        const p = JSON.parse(_savedPos);
        map.jumpTo({ center: [p.lng, p.lat], zoom: p.zoom, bearing: p.bearing, pitch: p.pitch });
      } catch(e) { /* ignore corrupt data */ }
    } else {
      map.jumpTo({ center: [13.3217, 52.521], zoom: 4, bearing: -11, pitch: 42 });
    }

    const _clusterSymLayout = {
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
      'text-size': 11,
      'text-letter-spacing': 0.06,
      'text-transform': 'uppercase',
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'text-optional': true,
      'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
      'text-radial-offset': 1.4,
      'text-justify': 'auto',
      'text-max-width': 14,
    };
    const _clusterSymPaint = {
      'text-color': '#000',
      'text-halo-color': '#fff',
      'text-halo-width': 2.5,
    };

    // ── Custom SDF dot image ──
    (function() {
      const sz = 32;
      const c = document.createElement('canvas');
      c.width = c.height = sz;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, sz, sz);
      ctx.beginPath();
      ctx.arc(sz / 2, sz / 2, sz / 2 - 2, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      const d = ctx.getImageData(0, 0, sz, sz);
      map.addImage('aalto-dot', { width: sz, height: sz, data: d.data }, { sdf: true, pixelRatio: 2 });
    })();

    // ── Country cluster layers (zoom 0–6.5) ──
    map.addLayer({
      id: 'country-clusters-stack', type: 'symbol', source: 'aalto-countries',
      slot: 'top',
      maxzoom: 6.5, filter: ['>', ['get', 'count'], 1],
      layout: { 'icon-image': 'aalto-dot', 'icon-size': 0.57, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
      paint: { 'icon-color': '#000', 'icon-opacity': 0.35, 'icon-halo-color': '#fff', 'icon-halo-width': 2, 'icon-translate': [2.5, -2.5] },
    });
    map.addLayer({
      id: 'country-clusters', type: 'symbol', source: 'aalto-countries',
      slot: 'top',
      maxzoom: 6.5,
      layout: { 'icon-image': 'aalto-dot', 'icon-size': 0.57, 'icon-allow-overlap': true, 'icon-ignore-placement': false },
      paint: { 'icon-color': '#000', 'icon-opacity': 0.9, 'icon-halo-color': '#fff', 'icon-halo-width': 2 },
    });
    map.addLayer({
      id: 'country-labels', type: 'symbol', source: 'aalto-countries',
      slot: 'top',
      maxzoom: 6.5,
      layout: {
        ..._clusterSymLayout,
        'text-field': ['concat', ['get', 'name'], ' (', ['to-string', ['get', 'count']], ')'],
        'symbol-sort-key': ['get', 'count'],
      },
      paint: _clusterSymPaint,
    });

    // ── City cluster layers (zoom 6.5–13) ──
    map.addLayer({
      id: 'city-clusters-stack', type: 'symbol', source: 'aalto-cities',
      slot: 'top',
      minzoom: 6.5, maxzoom: 13, filter: ['>', ['get', 'count'], 1],
      layout: { 'icon-image': 'aalto-dot', 'icon-size': 0.57, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
      paint: { 'icon-color': '#000', 'icon-opacity': 0.35, 'icon-halo-color': '#fff', 'icon-halo-width': 2, 'icon-translate': [2.5, -2.5] },
    });
    map.addLayer({
      id: 'city-clusters', type: 'symbol', source: 'aalto-cities',
      slot: 'top',
      minzoom: 6.5, maxzoom: 13,
      layout: { 'icon-image': 'aalto-dot', 'icon-size': 0.57, 'icon-allow-overlap': true, 'icon-ignore-placement': false },
      paint: { 'icon-color': '#000', 'icon-opacity': 0.9, 'icon-halo-color': '#fff', 'icon-halo-width': 2 },
    });
    map.addLayer({
      id: 'city-labels', type: 'symbol', source: 'aalto-cities',
      slot: 'top',
      minzoom: 6.5, maxzoom: 13,
      layout: {
        ..._clusterSymLayout,
        'text-field': ['concat', ['get', 'name'], ' (', ['to-string', ['get', 'count']], ')'],
        'symbol-sort-key': ['get', 'count'],
      },
      paint: _clusterSymPaint,
    });

    // ── Helsinki metro district layers (zoom 11–13) ──
    map.addLayer({
      id: 'metro-clusters-stack', type: 'symbol', source: 'aalto-metro',
      slot: 'top',
      minzoom: 11, maxzoom: 13, filter: ['>', ['get', 'count'], 1],
      layout: { 'icon-image': 'aalto-dot', 'icon-size': 0.57, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
      paint: { 'icon-color': '#000', 'icon-opacity': 0.35, 'icon-halo-color': '#fff', 'icon-halo-width': 2, 'icon-translate': [2.5, -2.5] },
    });
    map.addLayer({
      id: 'metro-clusters', type: 'symbol', source: 'aalto-metro',
      slot: 'top',
      minzoom: 11, maxzoom: 13,
      filter: ['>', ['get', 'count'], 1],
      layout: { 'icon-image': 'aalto-dot', 'icon-size': 0.57, 'icon-allow-overlap': true, 'icon-ignore-placement': false },
      paint: { 'icon-color': '#000', 'icon-opacity': 0.9, 'icon-halo-color': '#fff', 'icon-halo-width': 2 },
    });
    map.addLayer({
      id: 'metro-labels', type: 'symbol', source: 'aalto-metro',
      slot: 'top',
      minzoom: 11, maxzoom: 13,
      filter: ['>', ['get', 'count'], 1],
      layout: {
        ..._clusterSymLayout,
        'text-field': ['concat', ['get', 'name'], ' (', ['to-string', ['get', 'count']], ')'],
        'symbol-sort-key': ['get', 'count'],
      },
      paint: _clusterSymPaint,
    });

    // ── GL-clustered dots (zoom 13+) ──
    map.addLayer({
      id: 'aalto-clusters-stack', type: 'symbol', source: 'aalto',
      slot: 'top',
      minzoom: 13, filter: ['has', 'point_count'],
      layout: { 'icon-image': 'aalto-dot', 'icon-size': 0.57, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
      paint: { 'icon-color': '#000', 'icon-opacity': 0.35, 'icon-halo-color': '#fff', 'icon-halo-width': 2, 'icon-translate': [2.5, -2.5] },
    });
    map.addLayer({
      id: 'aalto-clusters', type: 'symbol', source: 'aalto',
      slot: 'top',
      minzoom: 13,
      filter: ['has', 'point_count'],
      layout: { 'icon-image': 'aalto-dot', 'icon-size': 0.57, 'icon-allow-overlap': true, 'icon-ignore-placement': false },
      paint: { 'icon-color': '#000', 'icon-opacity': 0.9, 'icon-halo-color': '#fff', 'icon-halo-width': 2 },
    });
    map.addLayer({
      id: 'aalto-cluster-labels', type: 'symbol', source: 'aalto',
      slot: 'top',
      minzoom: 13,
      filter: ['has', 'point_count'],
      layout: {
        ..._clusterSymLayout,
        'text-field': ['concat', ['get', 'first_name'], ' +', ['to-string', ['-', ['get', 'point_count'], 1]]],
        'symbol-sort-key': ['get', 'point_count'],
      },
      paint: _clusterSymPaint,
    });

    // ── Individual point layers (zoom 11+, non-clustered) ──
    map.addLayer({
      id: 'aalto-halo', type: 'circle', source: 'aalto',
      slot: 'top',
      minzoom: 13,
      filter: ['all', ['!', ['has', 'point_count']], ['!', ['get', 'onRoute']]],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 5, 18, 9],
        'circle-color': '#000', 'circle-opacity': 0,
        'circle-stroke-width': 0.5, 'circle-stroke-color': '#000',
        'circle-stroke-opacity': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], 1,
          ['get', '_fav'], 0.4,
          ['boolean', ['feature-state', 'hover'], false], 0.2,
          0,
        ],
      },
    });
    map.addLayer({
      id: 'aalto-points', type: 'symbol', source: 'aalto',
      slot: 'top',
      minzoom: 13,
      filter: ['all', ['!', ['has', 'point_count']], ['!', ['get', 'onRoute']]],
      layout: {
        'icon-image': 'aalto-dot',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.375, 18, 0.875],
        'icon-allow-overlap': false,
        'icon-ignore-placement': false,
        'text-field': ['concat', ['get', 'name'], ['coalesce', ['get', '_symbol'], '']],
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': 11,
        'text-letter-spacing': 0.06,
        'text-transform': 'uppercase',
        'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
        'text-radial-offset': 1.4,
        'text-justify': 'auto',
        'text-max-width': 12,
        'text-optional': true,
        'text-allow-overlap': false,
        'text-ignore-placement': false,
      },
      paint: {
        'icon-color': ['case', ['get', '_visited'], '#999', '#000'],
        'icon-halo-color': '#fff',
        'icon-halo-width': 2,
        'text-color': '#000',
        'text-halo-color': '#fff',
        'text-halo-width': 2.5,
      },
    });

    // ── Language-aware label update ──
    function updateClusterLabels() {
      const nk = A.lang === 'fi' ? 'name_fi' : 'name';
      const ck = A.lang === 'fi' ? 'city_fi' : 'city';
      const ok = A.lang === 'fi' ? 'object_name_fi' : 'object_name';
      const fnk = A.lang === 'fi' ? 'first_name_fi' : 'first_name';

      if (map.getLayer('country-labels'))
        map.setLayoutProperty('country-labels', 'text-field', [
          'case', ['==', ['get', 'count'], 1],
          ['concat',
            ['coalesce', ['get', nk], ['get', 'name']], ', ',
            ['coalesce', ['get', ck], ['get', 'city'], ''], ' (1)'
          ],
          ['concat', ['coalesce', ['get', nk], ['get', 'name']], ' (', ['to-string', ['get', 'count']], ')'],
        ]);

      if (map.getLayer('city-labels'))
        map.setLayoutProperty('city-labels', 'text-field',
          ['concat', ['coalesce', ['get', nk], ['get', 'name']], ' (', ['to-string', ['get', 'count']], ')'],
        );

      if (map.getLayer('metro-labels'))
        map.setLayoutProperty('metro-labels', 'text-field', [
          'case', ['==', ['get', 'count'], 1],
          ['coalesce', ['get', ok], ['get', 'object_name'], ['coalesce', ['get', nk], ['get', 'name']]],
          ['concat', ['coalesce', ['get', nk], ['get', 'name']], ' (', ['to-string', ['get', 'count']], ')'],
        ]);

      if (map.getLayer('aalto-cluster-labels'))
        map.setLayoutProperty('aalto-cluster-labels', 'text-field',
          ['concat', ['coalesce', ['get', fnk], ['get', 'first_name']], ' +', ['to-string', ['-', ['get', 'point_count'], 1]]]);

      if (map.getLayer('aalto-points'))
        map.setLayoutProperty('aalto-points', 'text-field',
          ['concat', ['coalesce', ['get', nk], ['get', 'name']], ['coalesce', ['get', '_symbol'], '']]);
    }
    window._updateClusterLabels = updateClusterLabels;
    updateClusterLabels();

    // ── Hover: individual points ──
    let hoveredId = null;
    map.on('mouseenter', 'aalto-points', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      const id = e.features[0]?.id;
      if (id == null) return;
      if (hoveredId != null)
        map.setFeatureState({ source: 'aalto', id: hoveredId }, { hover: false });
      hoveredId = id;
      map.setFeatureState({ source: 'aalto', id: hoveredId }, { hover: true });
    });
    map.on('mouseleave', 'aalto-points', () => {
      map.getCanvas().style.cursor = '';
      if (hoveredId != null) {
        map.setFeatureState({ source: 'aalto', id: hoveredId }, { hover: false });
        hoveredId = null;
      }
    });

    // Helper: select a feature by name
    function selectFeatureByName(name, coords) {
      const match = featureList.find(f => f.name === name);
      if (match) A.selectFeature({ ...match.feature, id: match.id });
      else map.flyTo({ center: coords, zoom: 18, pitch: 50, speed: 1.8 });
    }

    // ── Click handlers ──
    let _skipMapClick = false;
    let _clusterClickEvt = null;

    const nameToCoords = {};
    data.features.forEach(f => { nameToCoords[f.properties.name] = f.geometry.coordinates; });

    const FINLAND_CLICK_STATE = { center: [24.8041, 60.8095], zoom: 6.62, bearing: 0, pitch: 0 };

    function handleClusterClick(props, coords, useFitBounds = false) {
      _skipMapClick = true;
      const objects = JSON.parse(props.objects || '[]');
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
      if (map.getZoom() < 17)
        map.flyTo({ center: e.features[0].geometry.coordinates, zoom: 18, pitch: 50, speed: 1.2 });
      A.selectFeature(e.features[0]);
    });
    map.on('mouseenter', 'aalto-points', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'aalto-points', () => { map.getCanvas().style.cursor = ''; });

    map.on('click', (e) => {
      if (_skipMapClick) { _skipMapClick = false; return; }
      const hits = map.queryRenderedFeatures(e.point, {
        layers: ['aalto-points', 'aalto-clusters', 'country-clusters', 'city-clusters', 'metro-clusters', 'route-stop-markers', 'route-stop-labels'],
      });
      if (!hits.length) A.closePanel();
    });

    // ═════════════════════════════════════════════════════
    //  List Panel
    // ═════════════════════════════════════════════════════
    function parseCityFromAddress(addr) {
      if (!addr) return '';
      const parts = addr.split(',').map(p => p.trim());
      if (parts.length < 2) return '';
      const beforeCountry = parts[parts.length - 2];
      const m = beforeCountry.match(/^\d{5}\s+(.+)$/);
      return m ? m[1].trim() : beforeCountry;
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

    function haversineKm(a, b) {
      const R = 6371;
      const dLat = (b[1] - a[1]) * Math.PI / 180;
      const dLon = (b[0] - a[0]) * Math.PI / 180;
      const lat1 = a[1] * Math.PI / 180, lat2 = b[1] * Math.PI / 180;
      const x = Math.sin(dLat/2)**2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2)**2;
      return 2 * R * Math.asin(Math.sqrt(x));
    }

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

    A.favs.forEach(id => map.setFeatureState({ source: 'aalto', id }, { fav: true }));
    A.visited.forEach(id => map.setFeatureState({ source: 'aalto', id }, { visited: true }));

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

    // closePanel override: clear list active state
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
      rfb.style.display = (activeFilter === 'fav' && A.favs.size >= 2) ? '' : 'none';
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

    let _renderListMoveTimer;
    map.on('moveend', () => {
      if (activeSortMode !== 'distance') return;
      clearTimeout(_renderListMoveTimer);
      _renderListMoveTimer = setTimeout(() => A.renderList(), 200);
    });

    const geoControl = {
      onAdd(map) {
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
              map.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: Math.max(map.getZoom(), 12), duration: 800 });
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
          if (A.routeStops.length >= 3 && getDirectionsService()) {
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

    // ═════════════════════════════════════════════════════
    //  Layout Management
    // ═════════════════════════════════════════════════════
    let listCollapsed = false;
    document.getElementById('list-section-header').onclick = () => {
      listCollapsed = !listCollapsed;
      document.getElementById('list-body').style.display = listCollapsed ? 'none' : '';
      document.getElementById('list-toggle').style.transform = listCollapsed ? 'rotate(-90deg)' : '';
      document.getElementById('list-panel').classList.toggle('list-collapsed', listCollapsed);
      A.updatePanelLayout();
    };

    function expandDestinations() {
      if (listCollapsed) {
        listCollapsed = false;
        document.getElementById('list-body').style.display = '';
        document.getElementById('list-toggle').style.transform = '';
        document.getElementById('list-panel').classList.remove('list-collapsed');
        A.updatePanelLayout();
      }
    }

    A.updatePanelLayout = function() {
      const routeCollapsed = document.getElementById('route-section').classList.contains('collapsed');
      const bothCollapsed = listCollapsed && routeCollapsed;
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
      } else if (panelOpen && !listCollapsed) {
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
      } else if (listCollapsed) {
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
        panelEl.style.top = ''; panelEl.style.height = '';
        panelEl.style.right = ''; panelEl.style.width = '';
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

    window._renderList = A.renderList;

    // ═════════════════════════════════════════════════════
    //  Route — State, Calculation & UI
    // ═════════════════════════════════════════════════════
    let directionsService = null;
    function getDirectionsService() {
      if (!directionsService && typeof google !== 'undefined' && google.maps) {
        directionsService = new google.maps.DirectionsService();
      }
      return directionsService;
    }

    map.addSource('route-line', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource('route-stops-src', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true, clusterMaxZoom: 12, clusterRadius: 22,
      clusterProperties: {
        min_num: ['min', ['to-number', ['get', 'num']]],
        max_num: ['max', ['to-number', ['get', 'num']]],
      },
    });

    map.addLayer({
      id: 'route-driving', type: 'line', source: 'route-line',
      slot: 'top',
      filter: ['==', ['get', 'mode'], 'DRIVING'],
      paint: { 'line-color': '#000', 'line-width': 1.5, 'line-opacity': 0.8 },
    }, 'country-clusters-stack');
    map.addLayer({
      id: 'route-walking', type: 'line', source: 'route-line',
      slot: 'top',
      filter: ['==', ['get', 'mode'], 'WALKING'],
      paint: {
        'line-color': '#000', 'line-width': 1.5, 'line-opacity': 0.8,
        'line-dasharray': [4, 3],
      },
    }, 'country-clusters-stack');
    map.addLayer({
      id: 'route-bicycling', type: 'line', source: 'route-line',
      slot: 'top',
      filter: ['==', ['get', 'mode'], 'BICYCLING'],
      paint: {
        'line-color': '#000', 'line-width': 1.5, 'line-opacity': 0.8,
        'line-dasharray': [1.5, 3],
      },
    }, 'country-clusters-stack');
    map.addLayer({
      id: 'route-transit', type: 'line', source: 'route-line',
      slot: 'top',
      filter: ['==', ['get', 'mode'], 'TRANSIT'],
      paint: {
        'line-color': '#000', 'line-width': 1.5, 'line-opacity': 0.8,
        'line-dasharray': [6, 2.5, 1.5, 2.5],
      },
    }, 'country-clusters-stack');

    map.addLayer({
      id: 'route-stop-cluster-markers', type: 'symbol', source: 'route-stops-src',
      slot: 'top',
      filter: ['has', 'point_count'],
      layout: { 'icon-image': 'aalto-dot', 'icon-size': 1.14, 'icon-allow-overlap': true, 'icon-ignore-placement': false },
      paint: { 'icon-color': '#000', 'icon-halo-color': '#fff', 'icon-halo-width': 2 },
    });
    map.addLayer({
      id: 'route-stop-cluster-labels', type: 'symbol', source: 'route-stops-src',
      slot: 'top',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['concat', ['to-string', ['get', 'min_num']], '–', ['to-string', ['get', 'max_num']]],
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': 11,
        'text-letter-spacing': 0.06,
        'text-transform': 'uppercase',
        'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
        'text-radial-offset': 0.9,
        'text-justify': 'auto',
        'text-allow-overlap': true,
        'text-ignore-placement': false,
      },
      paint: { 'text-color': '#000', 'text-halo-color': '#fff', 'text-halo-width': 2.5 },
    });

    map.addLayer({
      id: 'route-stop-markers', type: 'symbol', source: 'route-stops-src',
      slot: 'top',
      filter: ['!', ['has', 'point_count']],
      layout: { 'icon-image': 'aalto-dot', 'icon-size': 1.14, 'icon-allow-overlap': true, 'icon-ignore-placement': false },
      paint: { 'icon-color': '#000', 'icon-halo-color': '#fff', 'icon-halo-width': 2 },
    });
    map.addLayer({
      id: 'route-stop-numbers', type: 'symbol', source: 'route-stops-src',
      slot: 'top',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'text-field': ['get', 'num'],
        'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
        'text-size': 10,
        'text-allow-overlap': true,
        'text-ignore-placement': false,
      },
      paint: { 'text-color': '#fff' },
    });
    map.addLayer({
      id: 'route-stop-labels', type: 'symbol', source: 'route-stops-src',
      slot: 'top',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': 11,
        'text-letter-spacing': 0.06,
        'text-transform': 'uppercase',
        'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
        'text-radial-offset': 0.9,
        'text-justify': 'auto',
        'text-allow-overlap': true,
        'text-ignore-placement': false,
      },
      paint: { 'text-color': '#000', 'text-halo-color': '#fff', 'text-halo-width': 2.5 },
    });

    function handleRouteStopClick(e) {
      _skipMapClick = true;
      const stopId = e.features[0].properties.stopId;
      const item = featureList.find(f => f.id === stopId);
      if (item) A.selectFeature({ ...item.feature, id: item.id }, { skipExpand: true });
    }
    map.on('click', 'route-stop-markers', handleRouteStopClick);
    map.on('click', 'route-stop-labels', handleRouteStopClick);
    map.on('mouseenter', 'route-stop-markers', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'route-stop-markers', () => { map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', 'route-stop-labels', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'route-stop-labels', () => { map.getCanvas().style.cursor = ''; });

    function getDefaultMode(from, to) {
      if (A.globalMode === 'WALKING') return 'WALKING';
      if (A.walkThreshold <= 0) return A.globalMode;
      const R = 6371000;
      const dLat = (to[1] - from[1]) * Math.PI / 180;
      const dLng = (to[0] - from[0]) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(from[1]*Math.PI/180) * Math.cos(to[1]*Math.PI/180) * Math.sin(dLng/2)**2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return dist < A.walkThreshold ? 'WALKING' : A.globalMode;
    }

    async function calculateSegment(from, to, mode) {
      if (!getDirectionsService()) {
        return null;
      }
      return new Promise((resolve) => {
        getDirectionsService().route({
          origin: new google.maps.LatLng(from[1], from[0]),
          destination: new google.maps.LatLng(to[1], to[0]),
          travelMode: google.maps.TravelMode[mode],
        }, (result, status) => {
          if (status === 'OK' && result.routes.length) {
            const path = result.routes[0].overview_path.map(p => [p.lng(), p.lat()]);
            const leg = result.routes[0].legs[0];
            resolve({
              geometry: path,
              distance: leg.distance.value,
              duration: leg.duration.value,
              distanceText: leg.distance.text,
              durationText: leg.duration.text,
            });
          } else {
            resolve(null);
          }
        });
      });
    }

    A.calculateAllSegments = async function() {
      const loadingEl = document.getElementById('route-loading');
      if (A.routeStops.length < 2) {
        A.routeSegments = [];
        updateRouteOnMap();
        A.renderRouteSection();
        if (loadingEl) loadingEl.style.display = 'none';
        return;
      }
      if (loadingEl) loadingEl.style.display = '';
      const newSegments = [];
      for (let i = 0; i < A.routeStops.length - 1; i++) {
        const existing = A.routeSegments[i];
        const mode = (existing && existing.modeOverride) || getDefaultMode(A.routeStops[i].coords, A.routeStops[i+1].coords);
        const result = await calculateSegment(A.routeStops[i].coords, A.routeStops[i+1].coords, mode);
        newSegments.push({
          fromIdx: i, toIdx: i + 1,
          mode,
          modeOverride: existing ? existing.modeOverride : null,
          ...(result || { geometry: [A.routeStops[i].coords, A.routeStops[i+1].coords], distance: 0, duration: 0, distanceText: '?', durationText: '?' }),
        });
      }
      A.routeSegments = newSegments;
      updateRouteOnMap();
      A.renderRouteSection();
      if (loadingEl) loadingEl.style.display = 'none';
    };

    function updateRouteOnMap() {
      const lineFeatures = A.routeSegments.map(seg => ({
        type: 'Feature',
        properties: { mode: seg.mode },
        geometry: { type: 'LineString', coordinates: seg.geometry },
      }));
      map.getSource('route-line').setData({ type: 'FeatureCollection', features: lineFeatures });

      const stopFeatures = A.routeStops.map((s, i) => ({
        type: 'Feature',
        properties: { num: String(i + 1), stopId: s.id, name: s.name },
        geometry: { type: 'Point', coordinates: s.coords },
      }));
      map.getSource('route-stops-src').setData({ type: 'FeatureCollection', features: stopFeatures });
    }

    function fmtDuration(sec) {
      if (sec < 60) return `${sec}s`;
      const h = Math.floor(sec / 3600);
      const m = Math.round((sec % 3600) / 60);
      return h ? `${h}h ${m}min` : `${m} min`;
    }

    function buildRouteStopRow(stop, i, stopsList) {
      const row = document.createElement('div');
      row.className = 'route-stop-row';
      row.draggable = true;
      row.dataset.idx = i;
      row.dataset.id = stop.id;

      const isFav = A.favs.has(stop.id);
      const isVis = A.visited.has(stop.id);
      const indicators =
        (isFav ? `<span class="route-stop-indicator" title="${A.t('tipBookmarked')}"><svg width="8" height="10" viewBox="0 0 11 14" fill="currentColor"><path d="M0 0h11v14l-5.5-4L0 14z"/></svg></span>` : '') +
        (isVis ? `<span class="route-stop-indicator" title="${A.t('tipVisitedMark')}"><svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 6l3 3 5-6"/></svg></span>` : '');

      row.innerHTML = `
        <span class="route-stop-handle" title="${A.t('tipDragReorder')}" style="cursor:grab">&#9776;</span>
        <span class="route-stop-num">${i + 1}</span>
        <span class="route-stop-name">${stop.name}</span>
        ${indicators}
        <button class="route-stop-remove" title="${A.t('tipRemoveStop')}" data-idx="${i}">&times;</button>`;
      stopsList.appendChild(row);

      row.onclick = (e) => {
        if (e.target.closest('.route-stop-remove') || e.target.closest('.route-stop-handle')) return;
        const item = featureList.find(f => String(f.id) === String(stop.id));
        if (item) A.selectFeature({ ...item.feature, id: item.id }, { skipExpand: true });
      };
      row.querySelector('.route-stop-remove').onclick = (e) => {
        e.stopPropagation();
        A.routeStops.splice(i, 1);
        A.saveRoute();
        A.renderList();
        A.renderRouteSection();
        A.calculateAllSegments();
      };

      row.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', String(i));
        row.style.opacity = '0.4';
      });
      row.addEventListener('dragend', () => { row.style.opacity = ''; });
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        row.style.borderTop = '2px solid #000';
      });
      row.addEventListener('dragleave', () => { row.style.borderTop = ''; });
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.style.borderTop = '';
        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
        const toIdx = i;
        if (fromIdx !== toIdx) {
          const [moved] = A.routeStops.splice(fromIdx, 1);
          A.routeStops.splice(toIdx, 0, moved);
          A.routeSegments = [];
          A.saveRoute();
          A.renderRouteSection();
          A.calculateAllSegments();
        }
      });
    }

    function buildRouteSegmentRow(seg, i, stopsList) {
      const segRow = document.createElement('div');
      segRow.className = 'route-segment-info';
      const ml = A.i18n[A.lang].modeLabels;
      segRow.innerHTML = `
        <span class="seg-mode-wrap">
          <span class="seg-arrow seg-prev" title="${A.t('tipPrevMode')}" data-seg="${i}"><svg width="5" height="8" viewBox="0 0 5 8" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M4 1L1 4l3 3"/></svg></span>
          <span class="seg-mode-label" title="${A.t('tipChangeMode')}" data-mode="${seg.mode}">${ml[seg.mode] || seg.mode}</span>
          <span class="seg-arrow seg-next" title="${A.t('tipNextMode')}" data-seg="${i}"><svg width="5" height="8" viewBox="0 0 5 8" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M1 1l3 3-3 3"/></svg></span>
        </span>
        <span class="seg-details">&middot; ${seg.distanceText || '...'} &middot; ${seg.durationText || '...'}</span>`;
      stopsList.appendChild(segRow);

      function cycleSegMode(direction) {
        const curIdx = A.modeOrder.indexOf(seg.mode);
        const nextMode = A.modeOrder[(curIdx + direction + A.modeOrder.length) % A.modeOrder.length];
        A.routeSegments[i].mode = nextMode;
        A.routeSegments[i].modeOverride = nextMode;
        A.saveRoute();
        calculateSegment(A.routeStops[i].coords, A.routeStops[i+1].coords, nextMode).then(result => {
          if (result) Object.assign(A.routeSegments[i], result);
          updateRouteOnMap();
          A.renderRouteSection();
        });
      }
      segRow.querySelector('.seg-prev').onclick = (e) => { e.stopPropagation(); cycleSegMode(-1); };
      segRow.querySelector('.seg-next').onclick = (e) => { e.stopPropagation(); cycleSegMode(1); };
      segRow.querySelector('.seg-mode-label').onclick = (e) => { e.stopPropagation(); cycleSegMode(1); };
    }

    A.renderRouteSection = function() {
      const section = document.getElementById('route-section');
      const summary = document.getElementById('route-summary');
      const summaryRow = document.getElementById('route-summary-row');
      const stopsList = document.getElementById('route-stops-list');
      const thresholdRow = document.getElementById('route-walk-threshold');
      const actionsBar = document.getElementById('route-actions-bar');
      const collapsedInfo = document.getElementById('route-collapsed-info');
      const collapsedSummary = document.getElementById('route-collapsed-summary');

      if (A.routeStops.length === 0) {
        summary.textContent = '';
        stopsList.innerHTML = `<div class="route-empty-hint">${A.t('routeEmpty')}</div>`;
        actionsBar.style.display = 'none';
        summaryRow.style.display = 'none';
        collapsedInfo.style.display = 'none';
        thresholdRow.classList.add('hidden');
        updateModeBar(false);
        return;
      }
      actionsBar.style.display = '';
      summaryRow.style.display = '';

      thresholdRow.classList.toggle('hidden', A.globalMode === 'WALKING');
      document.getElementById('walk-threshold-input').value = A.walkThreshold > 0 ? String(A.walkThreshold) : '';

      const isMixed = A.routeSegments.some(seg => seg.modeOverride && seg.modeOverride !== A.globalMode);
      updateModeBar(isMixed);

      const totalDist = A.routeSegments.reduce((s, seg) => s + (seg.distance || 0), 0);
      const totalDur = A.routeSegments.reduce((s, seg) => s + (seg.duration || 0), 0);
      const distKm = (totalDist / 1000).toFixed(1);
      const modeText = isMixed ? ` \u00b7 ${A.t('mixed')}` : '';
      summary.textContent = A.routeStops.length > 1
        ? `${A.routeStops.length} ${A.t('stops')} \u00b7 ${distKm} km \u00b7 ${fmtDuration(totalDur)}${modeText}`
        : `${A.routeStops.length} ${A.t('stop')}`;

      collapsedSummary.textContent = summary.textContent;
      const isCollapsed = section.classList.contains('collapsed');
      collapsedInfo.style.display = isCollapsed ? '' : 'none';

      stopsList.innerHTML = '';
      A.routeStops.forEach((stop, i) => {
        buildRouteStopRow(stop, i, stopsList);
        if (i < A.routeSegments.length) {
          buildRouteSegmentRow(A.routeSegments[i], i, stopsList);
        }
      });
    };

    A.highlightRouteStop = function(id) {
      document.querySelectorAll('.route-stop-row').forEach(r => r.classList.remove('active'));
      const sid = String(id);
      const idx = A.routeStops.findIndex(s => String(s.id) === sid);
      if (idx >= 0) {
        const rows = document.querySelectorAll('.route-stop-row');
        if (rows[idx]) {
          rows[idx].classList.add('active');
          rows[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          document.getElementById('route-section').classList.remove('collapsed');
          A.updatePanelLayout();
        }
      }
    };

    function updateModeBar(isMixed) {
      document.querySelectorAll('.route-mode-btn').forEach(b => {
        if (isMixed) {
          b.classList.remove('active');
        } else {
          b.classList.toggle('active', b.dataset.mode === A.globalMode);
        }
      });
    }

    document.getElementById('route-section-header').onclick = (e) => {
      const routeSection = document.getElementById('route-section');
      routeSection.classList.toggle('collapsed');
      const collapsed = routeSection.classList.contains('collapsed');
      const ci = document.getElementById('route-collapsed-info');
      ci.style.display = (collapsed && A.routeStops.length > 0) ? '' : 'none';
      A.updatePanelLayout();
    };

    document.getElementById('route-clear').onclick = (e) => {
      A.routeStops.length = 0;
      A.routeSegments = [];
      A.saveRoute();
      updateRouteOnMap();
      A.renderRouteSection();
      A.renderList();
    };

    document.querySelectorAll('.route-mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        A.globalMode = btn.dataset.mode;
        A.saveRoute();
        A.routeSegments.forEach(seg => { seg.modeOverride = null; seg.mode = null; });
        A.calculateAllSegments();
      });
    });

    const walkInput = document.getElementById('walk-threshold-input');
    function applyWalkThreshold() {
      const val = parseInt(walkInput.value) || 0;
      walkInput.value = val > 0 ? String(val) : '';
      if (val === A.walkThreshold) return;
      A.walkThreshold = val;
      A.saveRoute();
      A.routeSegments.forEach(seg => { if (!seg.modeOverride) seg.mode = null; });
      A.calculateAllSegments();
    }
    walkInput.addEventListener('blur', applyWalkThreshold);
    walkInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); walkInput.blur(); }
    });

    document.getElementById('route-optimize').onclick = () => {
      if (A.routeStops.length < 3 || !getDirectionsService()) return;
      const first = A.routeStops[0];
      const last = A.routeStops[A.routeStops.length - 1];
      const waypoints = A.routeStops.slice(1, -1).map(s => ({
        location: new google.maps.LatLng(s.coords[1], s.coords[0]),
      }));
      getDirectionsService().route({
        origin: new google.maps.LatLng(first.coords[1], first.coords[0]),
        destination: new google.maps.LatLng(last.coords[1], last.coords[0]),
        waypoints,
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode[A.globalMode],
      }, (result, status) => {
        if (status === 'OK') {
          const order = result.routes[0].waypoint_order;
          const middle = A.routeStops.slice(1, -1);
          const reordered = [first, ...order.map(i => middle[i]), last];
          A.routeStops.length = 0;
          A.routeStops.push(...reordered);
          A.routeSegments = [];
          A.saveRoute();
          A.calculateAllSegments();
          A.renderList();
        } else {
          A.showToast(A.t('optimizationFailed'), 4000);
        }
      });
    };

    const gmapsHandler = () => {
      if (A.routeStops.length < 2) return;
      const origin = A.routeStops[0];
      const dest = A.routeStops[A.routeStops.length - 1];
      const modeMap = { DRIVING: 'driving', WALKING: 'walking', BICYCLING: 'bicycling', TRANSIT: 'transit' };

      const isMixed = A.routeSegments.some(seg =>
        (seg.modeOverride && seg.modeOverride !== A.globalMode) ||
        (seg.mode && seg.mode !== A.globalMode));
      let effectiveMode = A.globalMode;

      function openGmaps() {
        const travelmode = modeMap[effectiveMode] || 'driving';
        let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.coords[1]},${origin.coords[0]}&destination=${dest.coords[1]},${dest.coords[0]}&travelmode=${travelmode}`;
        if (A.routeStops.length > 2) {
          const waypoints = A.routeStops.slice(1, -1).map(s => `${s.coords[1]},${s.coords[0]}`).join('|');
          url += `&waypoints=${encodeURIComponent(waypoints)}`;
        }
        window.open(url, '_blank');
      }

      if (isMixed) {
        const modeCounts = {};
        A.routeSegments.forEach(seg => { modeCounts[seg.mode] = (modeCounts[seg.mode] || 0) + 1; });
        effectiveMode = Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0][0];
        const ml = A.i18n[A.lang].modeLabels;
        A.showToast(A.t('mixedModeWarning').replace('{mode}', ml[effectiveMode] || effectiveMode), 5000);
        setTimeout(openGmaps, 3000);
      } else {
        openGmaps();
      }
    };
    document.getElementById('route-gmaps').onclick = gmapsHandler;
    document.getElementById('route-collapsed-gmaps').onclick = gmapsHandler;

    document.querySelectorAll('.route-mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === A.globalMode);
    });
    document.getElementById('walk-threshold-input').value = A.walkThreshold > 0 ? String(A.walkThreshold) : '';

    A.renderRouteSection();
    if (A.routeStops.length >= 2) {
      function tryCalculateRoute() {
        if (getDirectionsService()) {
          A.calculateAllSegments();
        } else {
          setTimeout(tryCalculateRoute, 200);
        }
      }
      tryCalculateRoute();
    }

    A.renderList();
  });
})();
