// ═══════════════════════════════════════════════════════
//  Layer Zoom Config — min/max zoom for countries, cities, metro, aalto clusters, aalto points
// Replaces debug panel. Persists to localStorage. Apply on init and when user changes values.
// ═══════════════════════════════════════════════════════
(function() {
  const STORAGE_KEY = 'aalto_layer_zoom_config';

  const DEFAULT = {
    countries: { min: 0, max: 6.5 },
    cities: { min: 6.5, max: 13 },
    metro: { min: 11, max: 13 },
    aaltoClusters: { min: 13, max: 24 },
    aaltoPoints: { min: 13, max: 24 },
  };

  const LAYER_GROUP_IDS = {
    countries: ['country-clusters-stack', 'country-clusters', 'country-labels'],
    cities: ['city-clusters-stack', 'city-clusters', 'city-labels'],
    metro: ['metro-clusters-stack', 'metro-clusters', 'metro-labels'],
    aaltoClusters: ['aalto-clusters-stack', 'aalto-clusters', 'aalto-cluster-labels'],
    aaltoPoints: ['aalto-halo', 'aalto-points'],
  };

  const GROUP_LABELS = {
    countries: 'Countries',
    cities: 'Cities',
    metro: 'Metro (Helsinki)',
    aaltoClusters: 'Aalto clusters',
    aaltoPoints: 'Aalto points',
  };

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
      for (const id of layerIds) {
        if (map.getLayer(id)) map.setLayerZoomRange(id, min, max);
      }
    }
  }

  window.initLayerZoomConfig = function(map) {
    const panel = document.getElementById('layer-zoom-panel');
    const toggleBtn = document.getElementById('layer-zoom-toggle');
    const body = document.getElementById('layer-zoom-body');
    const listEl = document.getElementById('layer-zoom-list');
    if (!panel || !listEl || !map) return;

    let config = getLayerZoomConfig();
    applyConfig(map, config);

    function render() {
      listEl.innerHTML = '';
      for (const [group, label] of Object.entries(GROUP_LABELS)) {
        const { min, max } = config[group];
        const row = document.createElement('div');
        row.className = 'layer-zoom-row';
        row.innerHTML = [
          '<span class="layer-zoom-label">' + label + '</span>',
          '<label class="layer-zoom-field"><span class="layer-zoom-minmax">min</span><input type="number" step="0.5" min="0" max="24" data-group="' + group + '" data-bound="min" value="' + min + '"></label>',
          '<label class="layer-zoom-field"><span class="layer-zoom-minmax">max</span><input type="number" step="0.5" min="0" max="24" data-group="' + group + '" data-bound="max" value="' + max + '"></label>',
        ].join('');
        listEl.appendChild(row);

        const minInput = row.querySelector('[data-bound="min"]');
        const maxInput = row.querySelector('[data-bound="max"]');
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
