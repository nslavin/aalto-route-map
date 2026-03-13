// ═══════════════════════════════════════════════════════
//  Route Planner — sources, layers, calculateAllSegments, renderRouteSection, mode bar, export
// Expects: map, A (Aalto), featureList, setSkipMapClick fn
// Uses: A.getGmapsUrl
// ═══════════════════════════════════════════════════════
(function() {
  window.initRoutePlanner = function(map, A, featureList, setSkipMapClick) {
    let directionsService = null;
    function getDirectionsService() {
      if (!directionsService && typeof google !== 'undefined' && google.maps) {
        directionsService = new google.maps.DirectionsService();
      }
      return directionsService;
    }

    map.addSource('route-line', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource('route-line-overview', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource('route-stops-src', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true, clusterMaxZoom: 12, clusterRadius: 22,
      clusterProperties: {
        min_num: ['min', ['to-number', ['get', 'num']]],
        max_num: ['max', ['to-number', ['get', 'num']]],
      },
    });

    // Overview layers (zoom < 8): use simplified overview_path geometry
    map.addLayer({
      id: 'route-driving-ov', type: 'line', source: 'route-line-overview',
      slot: 'top', maxzoom: 8,
      filter: ['==', ['get', 'mode'], 'DRIVING'],
      paint: { 'line-color': '#000', 'line-width': 1.5, 'line-opacity': 0.8 },
    }, 'country-clusters-stack');
    map.addLayer({
      id: 'route-walking-ov', type: 'line', source: 'route-line-overview',
      slot: 'top', maxzoom: 8,
      filter: ['==', ['get', 'mode'], 'WALKING'],
      paint: {
        'line-color': '#000', 'line-width': 1.5, 'line-opacity': 0.8,
        'line-dasharray': [4, 3],
      },
    }, 'country-clusters-stack');
    map.addLayer({
      id: 'route-bicycling-ov', type: 'line', source: 'route-line-overview',
      slot: 'top', maxzoom: 8,
      filter: ['==', ['get', 'mode'], 'BICYCLING'],
      paint: {
        'line-color': '#000', 'line-width': 1.5, 'line-opacity': 0.8,
        'line-dasharray': [1.5, 3],
      },
    }, 'country-clusters-stack');
    map.addLayer({
      id: 'route-transit-ov', type: 'line', source: 'route-line-overview',
      slot: 'top', maxzoom: 8,
      filter: ['==', ['get', 'mode'], 'TRANSIT'],
      paint: {
        'line-color': '#000', 'line-width': 1.5, 'line-opacity': 0.8,
        'line-dasharray': [6, 2.5, 1.5, 2.5],
      },
    }, 'country-clusters-stack');

    // Detail layers (zoom >= 8): use full step-path geometry
    map.addLayer({
      id: 'route-driving', type: 'line', source: 'route-line',
      slot: 'top', minzoom: 8,
      filter: ['==', ['get', 'mode'], 'DRIVING'],
      paint: { 'line-color': '#000', 'line-width': 1.5, 'line-opacity': 0.8 },
    }, 'country-clusters-stack');
    map.addLayer({
      id: 'route-walking', type: 'line', source: 'route-line',
      slot: 'top', minzoom: 8,
      filter: ['==', ['get', 'mode'], 'WALKING'],
      paint: {
        'line-color': '#000', 'line-width': 1.5, 'line-opacity': 0.8,
        'line-dasharray': [4, 3],
      },
    }, 'country-clusters-stack');
    map.addLayer({
      id: 'route-walking-arrows', type: 'symbol', source: 'route-line',
      slot: 'top', minzoom: 8,
      filter: ['all', ['==', ['get', 'mode'], 'WALKING'], ['to-boolean', ['get', 'returnToCar']]],
      layout: {
        'symbol-placement': 'line-center',
        'text-field': '↔',
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 14, 18, 22],
        'text-offset': ['interpolate', ['linear'], ['zoom'], 10, ['literal', [0, 0.25]], 13, ['literal', [0, 0.5]], 16, ['literal', [0, 0.5]]],
        'text-rotation-alignment': 'map',
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: { 'text-color': '#000' },
    }, 'country-clusters-stack');
    map.addLayer({
      id: 'route-bicycling', type: 'line', source: 'route-line',
      slot: 'top', minzoom: 8,
      filter: ['==', ['get', 'mode'], 'BICYCLING'],
      paint: {
        'line-color': '#000', 'line-width': 1.5, 'line-opacity': 0.8,
        'line-dasharray': [1.5, 3],
      },
    }, 'country-clusters-stack');
    map.addLayer({
      id: 'route-transit', type: 'line', source: 'route-line',
      slot: 'top', minzoom: 8,
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
      layout: {
        'icon-image': 'aalto-dot-route',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 6, 0.9, 10, 1],
        'icon-allow-overlap': true, 'icon-ignore-placement': false,
        'symbol-sort-key': 0,
      },
      paint: {},
    });
    map.addLayer({
      id: 'route-stop-cluster-labels', type: 'symbol', source: 'route-stops-src',
      slot: 'top',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['concat', ['to-string', ['get', 'min_num']], '–', ['to-string', ['get', 'max_num']]],
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, 11, 18, 12],
        'text-letter-spacing': 0.06,
        'text-transform': 'uppercase',
        'text-variable-anchor': ['left', 'top-left', 'bottom-left', 'top', 'bottom', 'right', 'top-right', 'bottom-right'],
        'text-radial-offset': 0.98,
        'text-justify': 'auto',
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-optional': true,
        'text-padding': 2,
        'symbol-sort-key': 20,
      },
      paint: { 'text-color': '#000', 'text-halo-color': '#fff', 'text-halo-width': 1.4 },
    });
    map.addLayer({
      id: 'route-stop-markers', type: 'symbol', source: 'route-stops-src',
      slot: 'top',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': 'aalto-dot-route',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 6, 0.9, 10, 1],
        'icon-allow-overlap': true,
        'icon-ignore-placement': false,
        'symbol-sort-key': 0,
        visibility: 'none',
      },
      paint: {},
    });
    map.addLayer({
      id: 'route-stop-numbers', type: 'symbol', source: 'route-stops-src',
      slot: 'top',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'text-field': ['get', 'num'],
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': 10,
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-optional': true,
        'text-padding': 2,
        'symbol-sort-key': 20,
        visibility: 'none',
      },
      paint: { 'text-color': '#000' },
    });
    map.addLayer({
      id: 'route-stop-labels', type: 'symbol', source: 'route-stops-src',
      slot: 'top',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'text-field': ['get', 'name'],
        visibility: 'none',
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, 11, 18, 12],
        'text-letter-spacing': 0.06,
        'text-transform': 'uppercase',
        'text-variable-anchor': ['left', 'top-left', 'bottom-left', 'top', 'bottom', 'right', 'top-right', 'bottom-right'],
        'text-radial-offset': 0.98,
        'text-justify': 'auto',
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-optional': true,
        'text-padding': 2,
        'symbol-sort-key': 20,
      },
      paint: { 'text-color': '#000', 'text-halo-color': '#fff', 'text-halo-width': 1.4 },
    });

    function handleRouteStopClick(e) {
      setSkipMapClick(true);
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
      if (!getDirectionsService()) return null;
      return new Promise((resolve) => {
        getDirectionsService().route({
          origin: new google.maps.LatLng(from[1], from[0]),
          destination: new google.maps.LatLng(to[1], to[0]),
          travelMode: google.maps.TravelMode[mode],
        }, (result, status) => {
          if (status === 'OK' && result.routes.length) {
            const overviewPath = result.routes[0].overview_path.map(p => [p.lng(), p.lat()]);
            const detailPath = [];
            result.routes[0].legs.forEach(leg => {
              leg.steps.forEach(step => {
                step.path.forEach(p => detailPath.push([p.lng(), p.lat()]));
              });
            });
            const leg = result.routes[0].legs[0];
            resolve({
              geometry: detailPath,
              overviewGeometry: overviewPath,
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

    const ROUTE_STOP_LAYER_IDS = ['route-stop-cluster-markers', 'route-stop-cluster-labels', 'route-stop-markers', 'route-stop-numbers', 'route-stop-labels'];

    // Cached DOM references for renderRouteSection (static nodes that never change)
    const _domRefs = {
      section: document.getElementById('route-section'),
      summary: document.getElementById('route-summary'),
      summaryRow: document.getElementById('route-summary-row'),
      stopsList: document.getElementById('route-stops-list'),
      thresholdRow: document.getElementById('route-walk-threshold'),
      actionsBar: document.getElementById('route-actions-bar'),
      collapsedInfo: document.getElementById('route-collapsed-info'),
      collapsedSummary: document.getElementById('route-collapsed-summary'),
      loadingEl: document.getElementById('route-loading'),
      walkInput: document.getElementById('walk-threshold-input'),
    };

    function updateRouteOnMap() {
      const lineFeatures = A.routeSegments.map(seg => ({
        type: 'Feature',
        properties: { mode: seg.mode, returnToCar: seg.returnToCar || false },
        geometry: { type: 'LineString', coordinates: seg.geometry },
      }));
      const overviewFeatures = A.routeSegments.map(seg => ({
        type: 'Feature',
        properties: { mode: seg.mode, returnToCar: seg.returnToCar || false },
        geometry: { type: 'LineString', coordinates: seg.overviewGeometry || seg.geometry },
      }));
      map.getSource('route-line').setData({ type: 'FeatureCollection', features: lineFeatures });
      map.getSource('route-line-overview').setData({ type: 'FeatureCollection', features: overviewFeatures });

      const stopFeatures = A.routeStops.map((s, i) => ({
        type: 'Feature',
        properties: { num: String(i + 1), stopId: s.id, name: s.name, _fav: A.favs.has(s.id) },
        geometry: { type: 'Point', coordinates: s.coords },
      }));
      map.getSource('route-stops-src').setData({ type: 'FeatureCollection', features: stopFeatures });

      const visible = A.routeStops.length > 0 ? 'visible' : 'none';
      ROUTE_STOP_LAYER_IDS.forEach(id => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible);
      });
    }

    function fmtDuration(sec) {
      if (sec < 60) return `${sec}s`;
      const h = Math.floor(sec / 3600);
      const m = Math.round((sec % 3600) / 60);
      return h ? `${h}h ${m}min` : `${m} min`;
    }

    function getWalkingChainFromFirst(firstSegIndex) {
      const segments = A.routeSegments;
      const chain = [firstSegIndex];
      for (let k = firstSegIndex + 1; k < segments.length && segments[k].mode === 'WALKING'; k++) {
        chain.push(k);
      }
      return chain;
    }

    function buildRouteStopRow(stop, i, stopsList) {
      const esc = window.AaltoUtils.escHtml;
      const row = document.createElement('div');
      row.className = 'route-stop-row';
      row.draggable = true;
      row.dataset.idx = i;
      row.dataset.id = stop.id;

      const isFav = A.favs.has(stop.id);
      const isVis = A.visited.has(stop.id);
      const indicators =
        (isFav ? `<span class="route-stop-indicator" title="${esc(A.t('tipBookmarked'))}"><svg width="8" height="10" viewBox="0 0 11 14" fill="currentColor"><path d="M0 0h11v14l-5.5-4L0 14z"/></svg></span>` : '') +
        (isVis ? `<span class="route-stop-indicator" title="${esc(A.t('tipVisitedMark'))}"><svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 6l3 3 5-6"/></svg></span>` : '');

      row.innerHTML = `
        <span class="route-stop-handle" title="${esc(A.t('tipDragReorder'))}" style="cursor:grab">&#9776;</span>
        <span class="list-item-num">${i + 1}</span>
        <span class="list-item-name">${esc(stop.name)}</span>
        ${indicators}
        <button class="route-stop-remove" title="${esc(A.t('tipRemoveStop'))}" data-idx="${i}">&times;</button>`;
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
        A.rebuildAaltoSource();
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
        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const toIdx = i;
        if (isNaN(fromIdx) || fromIdx < 0 || fromIdx >= A.routeStops.length) return;
        if (fromIdx !== toIdx) {
          const [moved] = A.routeStops.splice(fromIdx, 1);
          A.routeStops.splice(toIdx, 0, moved);
          A.routeSegments = [];
          A.saveRoute();
          A.rebuildAaltoSource();
          A.renderRouteSection();
          A.calculateAllSegments();
        }
      });
    }

    function buildRouteSegmentRow(seg, i, stopsList) {
      const esc = window.AaltoUtils.escHtml;
      const segRow = document.createElement('div');
      segRow.className = 'route-segment-info';
      const ml = A.i18n[A.lang].modeLabels;
      const prevSeg = i > 0 ? A.routeSegments[i - 1] : null;
      const showReturnToCar = seg.mode === 'WALKING' && prevSeg && ['DRIVING', 'BICYCLING'].includes(prevSeg.mode);
      const returnLabel = prevSeg && prevSeg.mode === 'BICYCLING' ? A.t('returnToBicycle') : A.t('returnToCar');
      const returnTip = prevSeg && prevSeg.mode === 'BICYCLING' ? A.t('returnToBicycleTip') : A.t('returnToCarTip');
      const returnToCarHtml = showReturnToCar
        ? `<span class="seg-way-arrow" title="${esc(returnTip)}">↔</span><label class="seg-return-check" title="${esc(returnTip)}"><input type="checkbox" ${seg.returnToCar ? 'checked' : ''} data-seg="${i}"><span>${esc(returnLabel)}</span></label>`
        : '';
      segRow.innerHTML = `
        <span class="seg-mode-wrap">
          <span class="seg-arrow seg-prev" title="${esc(A.t('tipPrevMode'))}" data-seg="${i}"><svg width="5" height="8" viewBox="0 0 5 8" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M4 1L1 4l3 3"/></svg></span>
          <span class="seg-mode-label" title="${esc(A.t('tipChangeMode'))}" data-mode="${esc(seg.mode)}">${esc(ml[seg.mode] || seg.mode)}</span>
          <span class="seg-arrow seg-next" title="${esc(A.t('tipNextMode'))}" data-seg="${i}"><svg width="5" height="8" viewBox="0 0 5 8" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M1 1l3 3-3 3"/></svg></span>
        </span>
        ${returnToCarHtml}
        <span class="seg-details">&middot; ${esc(seg.distanceText || '...')} &middot; ${esc(seg.durationText || '...')}</span>`;
      stopsList.appendChild(segRow);

      if (showReturnToCar) {
        const cb = segRow.querySelector('input[type="checkbox"]');
        cb.addEventListener('change', (e) => {
          e.stopPropagation();
          const chainIndices = getWalkingChainFromFirst(i);
          chainIndices.forEach((j) => { A.routeSegments[j].returnToCar = cb.checked; });
          A.saveRoute();
          A.calculateAllSegments();
        });
      }

      function cycleSegMode(direction) {
        const curIdx = A.modeOrder.indexOf(seg.mode);
        const nextMode = A.modeOrder[(curIdx + direction + A.modeOrder.length) % A.modeOrder.length];
        A.routeSegments[i].mode = nextMode;
        A.routeSegments[i].modeOverride = nextMode;
        if (nextMode === 'WALKING' && i > 0) {
          const prevSeg = A.routeSegments[i - 1];
          if (prevSeg && ['DRIVING', 'BICYCLING'].includes(prevSeg.mode)) {
            A.routeSegments[i].returnToCar = true;
          }
        }
        A.saveRoute();
        A.calculateAllSegments();
      }
      segRow.querySelector('.seg-prev').onclick = (e) => { e.stopPropagation(); cycleSegMode(-1); };
      segRow.querySelector('.seg-next').onclick = (e) => { e.stopPropagation(); cycleSegMode(1); };
      segRow.querySelector('.seg-mode-label').onclick = (e) => { e.stopPropagation(); cycleSegMode(1); };
    }

    function updateModeBar(isMixed) {
      document.querySelectorAll('.route-mode-btn').forEach(b => {
        if (isMixed) {
          b.classList.remove('active');
        } else {
          b.classList.toggle('active', b.dataset.mode === A.globalMode);
        }
      });
    }

    A.calculateAllSegments = async function() {
      const loadingEl = _domRefs.loadingEl;
      if (A.routeStops.length < 2) {
        A.routeSegments = [];
        updateRouteOnMap();
        A.renderRouteSection();
        if (loadingEl) loadingEl.style.display = 'none';
        return;
      }
      if (loadingEl) loadingEl.style.display = '';

      const n = A.routeStops.length - 1;

      // Pass 1: resolve metadata (mode, returnToCar, effectiveFrom) for each segment.
      // This must be sequential because effectiveEndCoords depends on the previous segment.
      const meta = [];
      for (let i = 0; i < n; i++) {
        const existing = A.routeSegments[i] || (A.savedSegmentOverrides && A.savedSegmentOverrides[i] ? {
          modeOverride: A.savedSegmentOverrides[i].modeOverride,
          returnToCar: A.savedSegmentOverrides[i].returnToCar,
        } : null);
        const mode = (existing && existing.modeOverride) || getDefaultMode(A.routeStops[i].coords, A.routeStops[i+1].coords);
        const prevMeta = i > 0 ? meta[i - 1] : null;
        const atCarOrBike = prevMeta && (
          ['DRIVING', 'BICYCLING'].includes(prevMeta.mode) ||
          (prevMeta.mode === 'WALKING' && prevMeta.segReturnToCar)
        );
        const isWalkFromCar = mode === 'WALKING' && atCarOrBike;
        const wasAlreadyWalking = existing && existing.mode === 'WALKING';
        const returnToCar = (wasAlreadyWalking && existing.returnToCar !== undefined)
          ? existing.returnToCar
          : (isWalkFromCar ? true : false);
        const segReturnToCar = returnToCar && mode === 'WALKING';

        const effectiveFrom = (prevMeta && prevMeta.mode === 'WALKING' && prevMeta.segReturnToCar)
          ? prevMeta.effectiveEndCoords
          : A.routeStops[i].coords;
        const effectiveEndCoords = segReturnToCar ? A.routeStops[i].coords : A.routeStops[i + 1].coords;

        meta.push({ mode, existing, segReturnToCar, effectiveFrom, effectiveEndCoords });
      }

      // Pass 2: fire all API calls in parallel.
      const results = await Promise.all(meta.map(async (m, i) => {
        if (m.segReturnToCar) {
          const from = A.routeStops[i].coords;
          const to = A.routeStops[i + 1].coords;
          const [out, back] = await Promise.all([
            calculateSegment(from, to, 'WALKING'),
            calculateSegment(to, from, 'WALKING'),
          ]);
          if (out && back) {
            return {
              geometry: out.geometry,
              overviewGeometry: out.overviewGeometry,
              distance: out.distance + back.distance,
              duration: out.duration + back.duration,
              distanceText: out.distanceText ? `2× ${out.distanceText}` : '?',
              durationText: out.durationText ? `2× ${out.durationText}` : '?',
            };
          }
          return out || back;
        }
        return calculateSegment(m.effectiveFrom, A.routeStops[i + 1].coords, m.mode);
      }));

      const newSegments = meta.map((m, i) => ({
        fromIdx: i, toIdx: i + 1,
        mode: m.mode,
        modeOverride: m.existing ? m.existing.modeOverride : null,
        returnToCar: m.segReturnToCar,
        effectiveEndCoords: m.effectiveEndCoords,
        ...(results[i] || { geometry: [m.effectiveFrom, A.routeStops[i+1].coords], distance: 0, duration: 0, distanceText: '?', durationText: '?' }),
      }));

      A.savedSegmentOverrides = [];
      A.routeSegments = newSegments;
      updateRouteOnMap();
      A.renderRouteSection();
      if (loadingEl) loadingEl.style.display = 'none';
    };

    A.renderRouteSection = function() {
      const { section, summary, summaryRow, stopsList, thresholdRow, actionsBar, collapsedInfo, collapsedSummary } = _domRefs;

      if (A.routeStops.length === 0) {
        summary.textContent = '';
        stopsList.innerHTML = `<div class="route-empty-hint">${A.t('routeEmpty')}</div>`;
        actionsBar.style.display = 'none';
        summaryRow.style.display = 'none';
        collapsedInfo.style.display = 'none';
        thresholdRow.classList.add('hidden');
        updateModeBar(false);
        if (A.updateExportDropdowns) A.updateExportDropdowns();
        return;
      }
      actionsBar.style.display = '';
      summaryRow.style.display = '';

      thresholdRow.classList.toggle('hidden', A.globalMode === 'WALKING');
      _domRefs.walkInput.value = A.walkThreshold > 0 ? String(A.walkThreshold) : '';

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
      if (A.updateExportDropdowns) A.updateExportDropdowns();
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

    document.getElementById('route-section-header').onclick = () => {
      const routeSection = document.getElementById('route-section');
      routeSection.classList.toggle('collapsed');
      const collapsed = routeSection.classList.contains('collapsed');
      const ci = document.getElementById('route-collapsed-info');
      ci.style.display = (collapsed && A.routeStops.length > 0) ? '' : 'none';
      A.updatePanelLayout();
      A.savePanels();
    };

    document.getElementById('route-clear').onclick = () => {
      A.routeStops.length = 0;
      A.routeSegments = [];
      A.saveRoute();
      A.rebuildAaltoSource();
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

    const walkInput = _domRefs.walkInput;
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
          A.rebuildAaltoSource();
          A.calculateAllSegments();
          A.renderList();
        } else {
          A.showToast(A.t('optimizationFailed'), 4000);
        }
      });
    };

    const gmapsHandler = () => {
      const url = A.getGmapsUrl ? A.getGmapsUrl(A.routeStops, A.routeSegments) : null;
      if (!url || A.routeStops.length < 2) return;
      const isMixed = A.routeSegments.some(seg =>
        (seg.modeOverride && seg.modeOverride !== A.globalMode) ||
        (seg.mode && seg.mode !== A.globalMode));
      function openGmaps() { window.open(url, '_blank'); }
      if (isMixed) {
        const modeCounts = {};
        A.routeSegments.forEach(seg => { modeCounts[seg.mode] = (modeCounts[seg.mode] || 0) + 1; });
        const effectiveMode = Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0][0];
        const ml = A.i18n[A.lang].modeLabels;
        A.showToast(A.t('mixedModeWarning').replace('{mode}', ml[effectiveMode] || effectiveMode), 5000);
        setTimeout(openGmaps, 3000);
      } else {
        openGmaps();
      }
    };
    document.getElementById('route-gmaps').onclick = gmapsHandler;
    document.getElementById('route-collapsed-gmaps').onclick = gmapsHandler;

    const routeExportDropdown = document.getElementById('route-export-dropdown');
    const routeExportTrigger = document.getElementById('route-export-trigger');
    const routeExportMenu = document.getElementById('route-export-menu');
    if (routeExportDropdown && routeExportTrigger && routeExportMenu) {
      const updateRouteExportLabels = () => {
        const val = document.getElementById('route-export-value');
        if (val) val.textContent = A.t('exportLabel');
        routeExportMenu.querySelectorAll('.route-export-option').forEach(o => {
          if (o.dataset.action === 'share-route') o.textContent = A.t('shareRoute');
          if (o.dataset.action === 'print-route') o.textContent = A.t('printRoute');
          o.disabled = A.routeStops.length < 1;
        });
      };
      updateRouteExportLabels();
      routeExportTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        routeExportDropdown.classList.toggle('open');
      });
      routeExportMenu.addEventListener('click', (e) => e.stopPropagation());
      routeExportMenu.querySelectorAll('.route-export-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          if (opt.disabled) return;
          routeExportDropdown.classList.remove('open');
          if (opt.dataset.action === 'share-route') {
            const gmapsUrl = A.getGmapsUrl ? A.getGmapsUrl(A.routeStops, A.routeSegments) : null;
            const text = A.buildRouteText ? A.buildRouteText(A.routeStops, A.routeSegments, A.featureList || [], A.lang, gmapsUrl) : '';
            if (!text) { A.showToast(A.t('shareFailed'), 3000); return; }
            A.shareToClipboard(text,
              () => A.showToast(A.t('sharedToClipboard'), 2000),
              () => A.showToast(A.t('shareFailed'), 3000));
          } else if (opt.dataset.action === 'print-route') {
            const routeSection = document.getElementById('route-section');
            const wasCollapsed = routeSection.classList.contains('collapsed');
            A.printRoute({
              before: async () => {
                routeSection.classList.remove('collapsed');
                document.getElementById('route-collapsed-info').style.display = 'none';
                A.updatePanelLayout();
                if (A.routeStops.length >= 1 && map) {
                  const routeLayerIds = ['route-driving-ov', 'route-walking-ov', 'route-bicycling-ov', 'route-transit-ov', 'route-driving', 'route-walking', 'route-walking-arrows', 'route-bicycling', 'route-transit', 'route-stop-cluster-markers', 'route-stop-cluster-labels', 'route-stop-markers', 'route-stop-labels'];
                  routeLayerIds.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible'); });
                  if (A.routeStops.length >= 2 && A.fitRouteOverview) {
                    A.fitRouteOverview();
                  } else {
                    const c = A.routeStops[0].coords;
                    map.flyTo({ center: c, zoom: 14, pitch: 0, duration: 500 });
                  }
                  await new Promise(resolve => map.once('moveend', resolve));
                  await new Promise(resolve => map.once('idle', resolve));
                  const dataUrl = map.getCanvas().toDataURL('image/png');
                  const container = document.createElement('div');
                  container.id = 'print-map-overview';
                  container.innerHTML = '<span class="print-map-label">ROUTE OVERVIEW</span><img src="' + dataUrl + '" alt="Route map">';
                  document.body.appendChild(container);
                }
              },
              after: () => {
                const el = document.getElementById('print-map-overview');
                if (el) el.remove();
                if (wasCollapsed) routeSection.classList.add('collapsed');
                document.getElementById('route-collapsed-info').style.display =
                  A.routeStops.length > 0 ? '' : 'none';
                A.updatePanelLayout();
              },
            });
          }
        });
      });
      document.addEventListener('click', () => routeExportDropdown.classList.remove('open'));
      const prevUpdate = A.updateExportDropdowns;
      A.updateExportDropdowns = function() {
        if (prevUpdate) prevUpdate();
        updateRouteExportLabels();
      };
    }

    document.querySelectorAll('.route-mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === A.globalMode);
    });
    _domRefs.walkInput.value = A.walkThreshold > 0 ? String(A.walkThreshold) : '';

    A.renderRouteSection();
    return { renderRouteSection: A.renderRouteSection, calculateAllSegments: A.calculateAllSegments, highlightRouteStop: A.highlightRouteStop };
  };
})();
