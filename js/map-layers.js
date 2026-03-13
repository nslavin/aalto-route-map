// ═══════════════════════════════════════════════════════
//  Map Layers — Sources, cluster & point layers, rebuildAaltoSource, updateClusterLabels
// Expects: map (Mapbox), data (GeoJSON), countriesData, citiesData, metroData, A (Aalto)
// ═══════════════════════════════════════════════════════
(function() {
  window.initMapLayers = function(map, data, countriesData, citiesData, metroData, A) {
    const zoom = typeof window.getLayerZoomConfig === 'function' ? window.getLayerZoomConfig() : {
      countries: { min: 0, max: 6.5 },
      cities: { min: 6.5, max: 13 },
      metro: { min: 11, max: 13 },
      aaltoClusters: { min: 13, max: 24 },
      aaltoPoints: { min: 13, max: 24 },
    };

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
    map.addSource('aalto-favs', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true, clusterMaxZoom: 12, clusterRadius: 22,
      clusterProperties: {
        min_num: ['min', ['to-number', ['get', 'num']]],
        max_num: ['max', ['to-number', ['get', 'num']]],
      },
    });
    map.addSource('aalto-visited', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true, clusterMaxZoom: 12, clusterRadius: 22,
      clusterProperties: {
        min_num: ['min', ['to-number', ['get', 'num']]],
        max_num: ['max', ['to-number', ['get', 'num']]],
      },
    });

    let _rebuildTimer = null;
    function _doRebuildAaltoSource() {
      const routeIds = new Set(A.routeStops.map(s => s.id));
      const routeOrder = {};
      A.routeStops.forEach((s, idx) => { routeOrder[s.id] = String(idx + 1); });
      const features = data.features.map((f, i) => {
        const onRoute = routeIds.has(i);
        const routeNum = routeOrder[i] ?? null;
        const _visited = A.visited.has(i);
        const _fav = A.favs.has(i);
        let _sortKey = 0;
        if (onRoute && routeNum) _sortKey = 1000 + (parseInt(routeNum, 10) || 0);
        else if (_fav) _sortKey = 100;
        else if (_visited) _sortKey = 50;
        const props = {
          ...f.properties,
          onRoute,
          _visited,
          _fav,
          _sortKey,
        };
        if (routeNum !== null) props.routeNum = routeNum;
        return { ...f, properties: props };
      });
      map.getSource('aalto').setData({ type: 'FeatureCollection', features });
      if (A.selectedId !== null)
        map.setFeatureState({ source: 'aalto', id: A.selectedId }, { selected: true });
    }
    A.rebuildAaltoSource = function() {
      clearTimeout(_rebuildTimer);
      _rebuildTimer = setTimeout(_doRebuildAaltoSource, 16);
    };

    const _clusterSymLayout = {
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 18, 11],
      'text-letter-spacing': 0.06,
      'text-transform': 'uppercase',
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'text-optional': true,
      'text-variable-anchor': ['left', 'top-left', 'bottom-left', 'top', 'bottom', 'right', 'top-right', 'bottom-right'],
      'text-radial-offset': 0.82,
      'text-justify': 'auto',
      'text-max-width': 14,
      'text-padding': 2,
    };
    const _clusterSymPaint = {
      'text-color': '#000',
      'text-halo-color': '#fff',
      'text-halo-width': 1.4,
    };


    (function() {
      const sz = 32;
      const c = document.createElement('canvas');
      c.width = c.height = sz;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, sz, sz);
      const scale = Math.min(sz / 11, sz / 14);
      const ox = (sz - 11 * scale) / 2;
      const oy = (sz - 14 * scale) / 2;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + 11 * scale, oy);
      ctx.lineTo(ox + 11 * scale, oy + 14 * scale);
      ctx.lineTo(ox + 5.5 * scale, oy + 10 * scale);
      ctx.lineTo(ox, oy + 14 * scale);
      ctx.closePath();
      ctx.fillStyle = '#000';
      ctx.fill();
      const d = ctx.getImageData(0, 0, sz, sz);
      map.addImage('aalto-bookmark', { width: sz, height: sz, data: d.data });
    })();

    (function() {
      const sz = 32;
      const c = document.createElement('canvas');
      c.width = c.height = sz;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, sz, sz);
      const scale = sz / 32;
      const px = 8 * scale;
      const poleW = 1.5 * scale;
      const py = 4 * scale;
      const ph = 24 * scale;
      const bw = 18 * scale;
      const bh = 8 * scale;
      const vDepth = 4 * scale;
      ctx.fillStyle = '#000';
      ctx.fillRect(px, py, poleW, ph);
      ctx.beginPath();
      ctx.moveTo(px + poleW, py);
      ctx.lineTo(px + poleW + bw, py);
      ctx.lineTo(px + poleW + bw - vDepth, py + bh / 2);
      ctx.lineTo(px + poleW + bw, py + bh);
      ctx.lineTo(px + poleW, py + bh);
      ctx.closePath();
      ctx.fill();
      const d = ctx.getImageData(0, 0, sz, sz);
      map.addImage('aalto-flag', { width: sz, height: sz, data: d.data });
    })();

    map.addLayer({
      id: 'country-clusters-stack', type: 'symbol', source: 'aalto-countries',
      slot: 'top',
      minzoom: zoom.countries.min, maxzoom: zoom.countries.max, filter: ['>', ['get', 'count'], 1],
      layout: { 'icon-image': 'aalto-dot', 'icon-size': 0.57, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
      paint: { 'icon-color': '#000', 'icon-opacity': 0.35, 'icon-halo-color': '#fff', 'icon-halo-width': 2, 'icon-translate': [2.5, -2.5] },
    });
    map.addLayer({
      id: 'country-clusters', type: 'symbol', source: 'aalto-countries',
      slot: 'top',
      minzoom: zoom.countries.min, maxzoom: zoom.countries.max,
      layout: { 'icon-image': 'aalto-dot', 'icon-size': 0.57, 'icon-allow-overlap': true, 'icon-ignore-placement': false },
      paint: { 'icon-color': '#000', 'icon-opacity': 0.9, 'icon-halo-color': '#fff', 'icon-halo-width': 2 },
    });
    map.addLayer({
      id: 'country-labels', type: 'symbol', source: 'aalto-countries',
      slot: 'top',
      minzoom: zoom.countries.min, maxzoom: zoom.countries.max,
      layout: {
        ..._clusterSymLayout,
        'text-field': ['concat', ['get', 'name'], ' (', ['to-string', ['get', 'count']], ')'],
        'symbol-sort-key': ['get', 'count'],
      },
      paint: _clusterSymPaint,
    });

    map.addLayer({
      id: 'city-clusters-stack', type: 'symbol', source: 'aalto-cities',
      slot: 'top',
      minzoom: zoom.cities.min, maxzoom: zoom.cities.max, filter: ['>', ['get', 'count'], 1],
      layout: { 'icon-image': 'aalto-dot', 'icon-size': 0.57, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
      paint: { 'icon-color': '#000', 'icon-opacity': 0.35, 'icon-halo-color': '#fff', 'icon-halo-width': 2, 'icon-translate': [2.5, -2.5] },
    });
    map.addLayer({
      id: 'city-clusters', type: 'symbol', source: 'aalto-cities',
      slot: 'top',
      minzoom: zoom.cities.min, maxzoom: zoom.cities.max,
      layout: { 'icon-image': 'aalto-dot', 'icon-size': 0.57, 'icon-allow-overlap': true, 'icon-ignore-placement': false },
      paint: { 'icon-color': '#000', 'icon-opacity': 0.9, 'icon-halo-color': '#fff', 'icon-halo-width': 2 },
    });
    map.addLayer({
      id: 'city-labels', type: 'symbol', source: 'aalto-cities',
      slot: 'top',
      minzoom: zoom.cities.min, maxzoom: zoom.cities.max,
      layout: {
        ..._clusterSymLayout,
        'text-field': ['concat', ['get', 'name'], ' (', ['to-string', ['get', 'count']], ')'],
        'symbol-sort-key': ['get', 'count'],
      },
      paint: _clusterSymPaint,
    });

    map.addLayer({
      id: 'metro-clusters-stack', type: 'symbol', source: 'aalto-metro',
      slot: 'top',
      minzoom: zoom.metro.min, maxzoom: zoom.metro.max, filter: ['>', ['get', 'count'], 1],
      layout: { 'icon-image': 'aalto-dot', 'icon-size': 0.57, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
      paint: { 'icon-color': '#000', 'icon-opacity': 0.35, 'icon-halo-color': '#fff', 'icon-halo-width': 2, 'icon-translate': [2.5, -2.5] },
    });
    map.addLayer({
      id: 'metro-clusters', type: 'symbol', source: 'aalto-metro',
      slot: 'top',
      minzoom: zoom.metro.min, maxzoom: zoom.metro.max,
      filter: ['>', ['get', 'count'], 1],
      layout: { 'icon-image': 'aalto-dot', 'icon-size': 0.57, 'icon-allow-overlap': true, 'icon-ignore-placement': false },
      paint: { 'icon-color': '#000', 'icon-opacity': 0.9, 'icon-halo-color': '#fff', 'icon-halo-width': 2 },
    });
    map.addLayer({
      id: 'metro-labels', type: 'symbol', source: 'aalto-metro',
      slot: 'top',
      minzoom: zoom.metro.min, maxzoom: zoom.metro.max,
      filter: ['>', ['get', 'count'], 1],
      layout: {
        ..._clusterSymLayout,
        'text-field': ['concat', ['get', 'name'], ' (', ['to-string', ['get', 'count']], ')'],
        'symbol-sort-key': ['get', 'count'],
      },
      paint: _clusterSymPaint,
    });

    map.addLayer({
      id: 'aalto-clusters-stack', type: 'symbol', source: 'aalto',
      slot: 'top',
      minzoom: zoom.aaltoClusters.min, maxzoom: zoom.aaltoClusters.max, filter: ['has', 'point_count'],
      layout: { 'icon-image': 'aalto-dot', 'icon-size': 0.57, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
      paint: { 'icon-color': '#000', 'icon-opacity': 0.35, 'icon-halo-color': '#fff', 'icon-halo-width': 2, 'icon-translate': [2.5, -2.5] },
    });
    map.addLayer({
      id: 'aalto-clusters', type: 'symbol', source: 'aalto',
      slot: 'top',
      minzoom: zoom.aaltoClusters.min, maxzoom: zoom.aaltoClusters.max,
      filter: ['has', 'point_count'],
      layout: { 'icon-image': 'aalto-dot', 'icon-size': 0.57, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
      paint: { 'icon-color': '#000', 'icon-opacity': 0.9, 'icon-halo-color': '#fff', 'icon-halo-width': 2 },
    });
    map.addLayer({
      id: 'aalto-cluster-labels', type: 'symbol', source: 'aalto',
      slot: 'top',
      minzoom: zoom.aaltoClusters.min, maxzoom: zoom.aaltoClusters.max,
      filter: ['has', 'point_count'],
      layout: {
        ..._clusterSymLayout,
        'text-field': ['concat', ['get', 'first_name'], ' +', ['to-string', ['-', ['get', 'point_count'], 1]]],
        'symbol-sort-key': ['get', 'point_count'],
      },
      paint: _clusterSymPaint,
    });

    map.addLayer({
      id: 'aalto-halo', type: 'circle', source: 'aalto',
      slot: 'top',
      minzoom: zoom.aaltoPoints.min, maxzoom: zoom.aaltoPoints.max,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 5, 18, 9],
        'circle-color': '#000', 'circle-opacity': 0,
        'circle-stroke-width': 0.5, 'circle-stroke-color': '#000',
        'circle-stroke-opacity': [
          'case',
          ['all', ['boolean', ['feature-state', 'selected'], false], ['!', ['has', 'routeNum']]], 1,
          ['boolean', ['feature-state', 'hover'], false], 0.2,
          0,
        ],
      },
    });
    map.addLayer({
      id: 'aalto-points', type: 'symbol', source: 'aalto',
      slot: 'top',
      minzoom: zoom.aaltoPoints.min, maxzoom: zoom.aaltoPoints.max,
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': 'aalto-dot',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.35, 13, 0.5, 16, 0.75, 19, 1],
        'icon-allow-overlap': true,
        'icon-ignore-placement': false,
        'symbol-sort-key': ['get', '_sortKey'],
        'text-field': [
          'case',
          ['has', 'routeNum'],
          ['concat', ['get', 'routeNum'], ' ', ['coalesce', ['get', 'name_fi'], ['get', 'name']], ['case', ['get', '_fav'], ' ★', ''], ['case', ['get', '_visited'], ' ✓', '']],
          ['concat', ['coalesce', ['get', 'name_fi'], ['get', 'name']], ['case', ['get', '_fav'], ' ★', ''], ['case', ['get', '_visited'], ' ✓', '']],
        ],
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          13, ['case', ['has', 'routeNum'], 11, 10],
          18, ['case', ['has', 'routeNum'], 12, 11],
        ],
        'text-letter-spacing': 0.06,
        'text-transform': 'uppercase',
        'text-variable-anchor': ['left', 'top-left', 'bottom-left', 'top', 'bottom', 'right', 'top-right', 'bottom-right'],
        'text-radial-offset': 0.88,
        'text-justify': 'auto',
        'text-max-width': 12,
        'text-optional': true,
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-padding': 2,
      },
      paint: {
        'icon-color': ['case', ['get', '_visited'], '#999', '#000'],
        'icon-opacity': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], 1,
          ['boolean', ['feature-state', 'hover'], false], 1,
          0.9,
        ],
        'icon-halo-color': '#fff',
        'icon-halo-width': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], 4,
          ['boolean', ['feature-state', 'hover'], false], 3,
          2,
        ],
        'text-color': '#000',
        'text-halo-color': '#fff',
        'text-halo-width': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], 2.5,
          1.4,
        ],
      },
    });

    map.addLayer({
      id: 'aalto-favs-cluster-markers', type: 'symbol', source: 'aalto-favs',
      slot: 'top',
      filter: ['has', 'point_count'],
      layout: {
        'icon-image': 'aalto-dot', 'icon-size': 1.14,
        'icon-allow-overlap': true, 'icon-ignore-placement': false,
        visibility: 'none',
      },
      paint: { 'icon-color': '#000', 'icon-halo-color': '#fff', 'icon-halo-width': 2 },
    });
    map.addLayer({
      id: 'aalto-favs-cluster-labels', type: 'symbol', source: 'aalto-favs',
      slot: 'top',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['concat', ['to-string', ['get', 'min_num']], '–', ['to-string', ['get', 'max_num']]],
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': 11,
        'text-letter-spacing': 0.06,
        'text-transform': 'uppercase',
        'text-variable-anchor': ['left', 'top-left', 'bottom-left', 'top', 'bottom', 'right', 'top-right', 'bottom-right'],
        'text-radial-offset': 0.82,
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-optional': true,
        'text-padding': 2,
        'symbol-sort-key': 10,
        visibility: 'none',
      },
      paint: { 'text-color': '#000', 'text-halo-color': '#fff', 'text-halo-width': 3.1 },
    });
    map.addLayer({
      id: 'aalto-favs-markers', type: 'symbol', source: 'aalto-favs',
      slot: 'top',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': 'aalto-dot',
        'icon-size': 1.14,
        'icon-allow-overlap': true,
        'icon-ignore-placement': false,
        visibility: 'none',
      },
      paint: { 'icon-color': '#000', 'icon-halo-color': '#fff', 'icon-halo-width': 2 },
    });
    map.addLayer({
      id: 'aalto-favs-numbers', type: 'symbol', source: 'aalto-favs',
      slot: 'top',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'text-field': ['get', 'num'],
        'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
        'text-size': 10,
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-optional': true,
        'text-padding': 2,
        'symbol-sort-key': 10,
        visibility: 'none',
      },
      paint: { 'text-color': '#fff' },
    });
    map.addLayer({
      id: 'aalto-favs-labels', type: 'symbol', source: 'aalto-favs',
      slot: 'top',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'text-field': ['concat', ['get', 'label'], ['case', ['get', '_fav'], ' ★', ''], ['case', ['get', '_visited'], ' ✓', '']],
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': 11,
        'text-letter-spacing': 0.06,
        'text-transform': 'uppercase',
        'text-variable-anchor': ['left', 'top-left', 'bottom-left', 'top', 'bottom', 'right', 'top-right', 'bottom-right'],
        'text-radial-offset': 0.82,
        'text-justify': 'auto',
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-optional': true,
        'text-max-width': 12,
        'text-padding': 2,
        'symbol-sort-key': 10,
        visibility: 'none',
      },
      paint: { 'text-color': '#000', 'text-halo-color': '#fff', 'text-halo-width': 3.1 },
    });
    map.addLayer({
      id: 'aalto-visited-cluster-markers', type: 'symbol', source: 'aalto-visited',
      slot: 'top',
      filter: ['has', 'point_count'],
      layout: {
        'icon-image': 'aalto-dot', 'icon-size': 1.14,
        'icon-allow-overlap': true, 'icon-ignore-placement': false,
        visibility: 'none',
      },
      paint: { 'icon-color': '#000', 'icon-halo-color': '#fff', 'icon-halo-width': 2 },
    });
    map.addLayer({
      id: 'aalto-visited-cluster-labels', type: 'symbol', source: 'aalto-visited',
      slot: 'top',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['concat', ['to-string', ['get', 'min_num']], '–', ['to-string', ['get', 'max_num']]],
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': 11,
        'text-letter-spacing': 0.06,
        'text-transform': 'uppercase',
        'text-variable-anchor': ['left', 'top-left', 'bottom-left', 'top', 'bottom', 'right', 'top-right', 'bottom-right'],
        'text-radial-offset': 0.82,
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-optional': true,
        'text-padding': 2,
        'symbol-sort-key': 10,
        visibility: 'none',
      },
      paint: { 'text-color': '#000', 'text-halo-color': '#fff', 'text-halo-width': 3.1 },
    });
    map.addLayer({
      id: 'aalto-visited-markers', type: 'symbol', source: 'aalto-visited',
      slot: 'top',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': 'aalto-dot',
        'icon-size': 1.14,
        'icon-allow-overlap': true,
        'icon-ignore-placement': false,
        visibility: 'none',
      },
      paint: { 'icon-color': '#000', 'icon-halo-color': '#fff', 'icon-halo-width': 2 },
    });
    map.addLayer({
      id: 'aalto-visited-numbers', type: 'symbol', source: 'aalto-visited',
      slot: 'top',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'text-field': ['get', 'num'],
        'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
        'text-size': 10,
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-optional': true,
        'text-padding': 2,
        'symbol-sort-key': 10,
        visibility: 'none',
      },
      paint: { 'text-color': '#fff' },
    });
    map.addLayer({
      id: 'aalto-visited-labels', type: 'symbol', source: 'aalto-visited',
      slot: 'top',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'text-field': ['concat', ['get', 'label'], ['case', ['get', '_fav'], ' ★', ''], ['case', ['get', '_visited'], ' ✓', '']],
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': 11,
        'text-letter-spacing': 0.06,
        'text-transform': 'uppercase',
        'text-variable-anchor': ['left', 'top-left', 'bottom-left', 'top', 'bottom', 'right', 'top-right', 'bottom-right'],
        'text-radial-offset': 0.82,
        'text-justify': 'auto',
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-optional': true,
        'text-max-width': 12,
        'text-padding': 2,
        'symbol-sort-key': 10,
        visibility: 'none',
      },
      paint: { 'text-color': '#000', 'text-halo-color': '#fff', 'text-halo-width': 3.1 },
    });

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

      if (map.getLayer('aalto-points')) {
        const tf = [
          'case',
          ['has', 'routeNum'],
          ['concat', ['get', 'routeNum'], ' ', ['coalesce', ['get', nk], ['get', 'name']], ['case', ['get', '_fav'], ' ★', ''], ['case', ['get', '_visited'], ' ✓', '']],
          ['concat', ['coalesce', ['get', nk], ['get', 'name']], ['case', ['get', '_fav'], ' ★', ''], ['case', ['get', '_visited'], ' ✓', '']],
        ];
        map.setLayoutProperty('aalto-points', 'text-field', tf);
      }
    }
    A.updateClusterLabels = updateClusterLabels;
    updateClusterLabels();

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

    A.rebuildAaltoSource();
    return { rebuildAaltoSource: A.rebuildAaltoSource, updateClusterLabels: A.updateClusterLabels };
  };
})();
