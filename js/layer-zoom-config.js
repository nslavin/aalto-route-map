// ═══════════════════════════════════════════════════════
//  Layer Zoom Config — min/max zoom for countries, cities, metro, aalto clusters, aalto points
// Replaces debug panel. Persists to localStorage. Apply on init and when user changes values.
// ═══════════════════════════════════════════════════════
(function() {
  const STORAGE_KEY = 'aalto_layer_zoom_config_v2';

  const DEFAULT = {
    countries: { min: 0, max: 5.5 },
    cities: { min: 5.5, max: 11 },
    metro: { min: 11, max: 12 },
    aaltoClusters: { min: 12, max: 20 },
    aaltoPoints: { min: 12, max: 20 },
  };

  const LAYER_GROUP_IDS = {
    countries: ['country-clusters', 'country-labels'],
    cities: ['city-clusters-stack', 'city-clusters', 'city-labels'],
    metro: ['metro-clusters-stack', 'metro-clusters', 'metro-labels'],
    aaltoClusters: ['aalto-clusters-stack', 'aalto-clusters', 'aalto-cluster-labels'],
    aaltoPoints: ['aalto-halo', 'aalto-points'],
  };

  // Icon-only layers that render 1 zoom earlier than their group's label min
  const ICON_EARLY_IDS = new Set([
    'city-clusters-stack', 'city-clusters',
  ]);

  // Layers that are circle type
  const LAYER_CIRCLE_IDS = new Set(['aalto-halo']);

  // Symbol layers that carry a text-field label
  const LAYER_LABEL_IDS = new Set([
    'country-labels',
    'city-labels',
    'metro-labels',
    'aalto-cluster-labels',
    'aalto-points',
  ]);

  const GROUP_LABELS = {
    countries: 'Countries',
    cities: 'Cities',
    metro: 'Metro (Helsinki)',
    aaltoClusters: 'Aalto clusters',
    aaltoPoints: 'Aalto points',
  };

  const GROUP_COLORS = {
    countries:    'hsl(137, 92%, 40%)',
    cities:       'hsl(4, 92%, 40%)',
    metro:        'hsl(41, 92%, 40%)',
    aaltoClusters:'hsl(198, 92%, 40%)',
    aaltoPoints:  'hsl(271, 92%, 40%)',
  };
  let debugColorsEnabled = false;
  const _origPaint = {};

  function saveOriginalColors(map) {
    LAYER_LABEL_IDS.forEach(id => {
      if (map.getLayer(id) && !_origPaint[id]) {
        _origPaint[id] = map.getPaintProperty(id, 'text-color') ?? '#000';
      }
    });
  }

  function applyGroupColors(map) {
    if (!map) return;
    saveOriginalColors(map);
    Object.entries(LAYER_GROUP_IDS).forEach(([group, ids]) => {
      const debugColor = GROUP_COLORS[group];
      ids.forEach(id => {
        const layer = map.getLayer(id);
        if (!layer) {
          console.warn('[layer-debug] layer not found:', id);
          return;
        }
        if (LAYER_LABEL_IDS.has(id)) {
          const color = debugColorsEnabled ? debugColor : (_origPaint[id] ?? '#000');
          try {
            map.setPaintProperty(id, 'text-color', color);
            map.setPaintProperty(id, 'text-halo-color', debugColorsEnabled ? 'rgba(255,255,255,0.85)' : '#fff');
            console.log('[layer-debug] set text-color', id, '→', color);
          } catch (e) {
            console.error('[layer-debug] setPaintProperty failed for', id, e);
          }
        }
      });
    });
  }

  function getStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setStored(config) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {}
  }

  window.getLayerZoomConfig = function() {
    const stored = getStored();
    if (!stored) return { ...DEFAULT };
    const out = {};
    for (const key of Object.keys(DEFAULT)) {
      out[key] = {
        min: typeof stored[key]?.min === 'number' ? stored[key].min : DEFAULT[key].min,
        max: typeof stored[key]?.max === 'number' ? stored[key].max : DEFAULT[key].max,
      };
    }
    return out;
  };

  function applyConfig(map, config) {
    if (!map || !config) return;
    for (const [group, layerIds] of Object.entries(LAYER_GROUP_IDS)) {
      const { min, max } = config[group] || DEFAULT[group];
      const iconMin = Math.max(0, min - 1);
      for (const id of layerIds) {
        if (!map.getLayer(id)) continue;
        if (ICON_EARLY_IDS.has(id)) {
          map.setLayerZoomRange(id, iconMin, max);
        } else {
          map.setLayerZoomRange(id, min, max);
        }
      }
    }
  }

  window.initLayerZoomConfig = function(map) {
    const panel = document.getElementById('layer-zoom-panel');
    const toggleBtn = document.getElementById('layer-zoom-toggle');
    const body = document.getElementById('layer-zoom-body');
    const listEl = document.getElementById('layer-zoom-list');
    const zoomEl = document.getElementById('layer-zoom-zoom');
    if (!panel || !listEl || !map) return;

    let config = getLayerZoomConfig();
    applyConfig(map, config);
    applyGroupColors(map);

    let _reapplyTimer;
    function _scheduleReapply() {
      if (!debugColorsEnabled) return;
      clearTimeout(_reapplyTimer);
      _reapplyTimer = setTimeout(() => applyGroupColors(map), 0);
    }
    map.on('style.load', _scheduleReapply);
    map.on('data', e => { if (e.dataType === 'style') _scheduleReapply(); });
    map.on('zoomend', _scheduleReapply);

    function updateZoom() {
      if (zoomEl) zoomEl.textContent = 'z:' + map.getZoom().toFixed(2);
    }
    map.on('zoom', updateZoom);
    map.on('load', updateZoom);
    updateZoom();

    function render() {
      listEl.innerHTML = '';
      for (const [group, label] of Object.entries(GROUP_LABELS)) {
        const { min, max } = config[group];
        const color = GROUP_COLORS[group];

        const row = document.createElement('div');
        row.className = 'layer-zoom-row';

        const swatch = document.createElement('span');
        swatch.className = 'layer-zoom-swatch';
        swatch.style.background = color;
        swatch.title = color + ' — click to toggle debug colors';
        swatch.addEventListener('click', () => {
          debugColorsEnabled = !debugColorsEnabled;
          applyGroupColors(map);
          render();
        });

        const lbl = document.createElement('span');
        lbl.className = 'layer-zoom-label';
        lbl.textContent = label;

        const minField = document.createElement('label');
        minField.className = 'layer-zoom-field';
        minField.innerHTML = '<span class="layer-zoom-minmax">min</span>';
        const minInput = document.createElement('input');
        minInput.type = 'number';
        minInput.step = '0.5';
        minInput.min = '0';
        minInput.max = '24';
        minInput.value = min;
        minField.appendChild(minInput);

        const maxField = document.createElement('label');
        maxField.className = 'layer-zoom-field';
        maxField.innerHTML = '<span class="layer-zoom-minmax">max</span>';
        const maxInput = document.createElement('input');
        maxInput.type = 'number';
        maxInput.step = '0.5';
        maxInput.min = '0';
        maxInput.max = '24';
        maxInput.value = max;
        maxField.appendChild(maxInput);

        row.appendChild(swatch);
        row.appendChild(lbl);
        row.appendChild(minField);
        row.appendChild(maxField);
        listEl.appendChild(row);

        function update() {
          const minVal = parseFloat(minInput.value);
          const maxVal = parseFloat(maxInput.value);
          if (!isNaN(minVal) && !isNaN(maxVal) && minVal <= maxVal) {
            config[group] = { min: minVal, max: maxVal };
            applyConfig(map, config);
            setStored(config);
          }
        }
        minInput.addEventListener('change', update);
        maxInput.addEventListener('change', update);
      }

      const colorToggleRow = document.createElement('div');
      colorToggleRow.style.cssText = 'padding:5px 0 2px; display:flex; align-items:center; gap:6px; border-top:1px solid #eee; margin-top:2px;';
      colorToggleRow.innerHTML = '<span style="font-size:8px;color:#888;flex:1">DEBUG COLORS</span>';
      const colorToggleBtn = document.createElement('button');
      colorToggleBtn.type = 'button';
      colorToggleBtn.style.cssText = 'font-size:8px;padding:1px 6px;border:1px solid #ccc;background:none;cursor:pointer;font-family:inherit;letter-spacing:0.05em;text-transform:uppercase;';
      colorToggleBtn.textContent = debugColorsEnabled ? 'ON' : 'OFF';
      colorToggleBtn.addEventListener('click', () => {
        debugColorsEnabled = !debugColorsEnabled;
        applyGroupColors(map);
        render();
      });
      colorToggleRow.appendChild(colorToggleBtn);
      listEl.appendChild(colorToggleRow);

      const copyRow = document.createElement('div');
      copyRow.style.cssText = 'padding:4px 0 0; display:flex; gap:4px; border-top:1px solid #eee; margin-top:2px;';
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.style.cssText = 'flex:1;font-size:8px;padding:2px 6px;border:1px solid #ccc;background:none;cursor:pointer;font-family:inherit;letter-spacing:0.05em;text-transform:uppercase;';
      copyBtn.textContent = 'COPY STATE';
      copyBtn.addEventListener('click', () => {
        const state = {
          zoom: parseFloat(map.getZoom().toFixed(3)),
          center: [parseFloat(map.getCenter().lng.toFixed(5)), parseFloat(map.getCenter().lat.toFixed(5))],
          bearing: parseFloat(map.getBearing().toFixed(1)),
          pitch: parseFloat(map.getPitch().toFixed(1)),
          layerZoom: config,
          debugColors: debugColorsEnabled,
          colors: GROUP_COLORS,
          paintApplied: Object.fromEntries(
            [...LAYER_LABEL_IDS].map(id => [id, map.getLayer(id) ? map.getPaintProperty(id, 'text-color') : 'MISSING'])
          ),
        };
        const text = JSON.stringify(state, null, 2);
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.textContent = 'COPIED ✓';
          setTimeout(() => { copyBtn.textContent = 'COPY STATE'; }, 1500);
        }).catch(() => {
          prompt('Copy this:', text);
        });
      });
      copyRow.appendChild(copyBtn);
      listEl.appendChild(copyRow);
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        panel.classList.toggle('collapsed');
        toggleBtn.textContent = panel.classList.contains('collapsed') ? '\u9660' : '\u9650';
      });
      if (panel.classList.contains('collapsed')) toggleBtn.textContent = '\u9660';
      else toggleBtn.textContent = '\u9650';
    }

    render();
  };
})();
