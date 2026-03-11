// ═══════════════════════════════════════════════════════
//  Map Layers — Sources, cluster & point layers, rebuildAaltoSource, updateClusterLabels
// Expects: map (Mapbox), data (GeoJSON), countriesData, citiesData, metroData, A (Aalto)
// ═══════════════════════════════════════════════════════
(function() {
  window.initMapLayers = function(map, data, countriesData, citiesData, metroData, A) {
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
    return { rebuildAaltoSource: A.rebuildAaltoSource, updateClusterLabels };
  };
})();
