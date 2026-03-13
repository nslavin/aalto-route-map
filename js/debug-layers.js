// ═══════════════════════════════════════════════════════
//  Debug Layers — panel to toggle visibility and change z-order of map layers
// Expects: map (Mapbox) — init called from map-init.js after map load
// ═══════════════════════════════════════════════════════
(function() {
  const STORAGE_KEY_ORDER = 'aalto_debug_layer_order';
  const STORAGE_KEY_VISIBILITY = 'aalto_debug_layer_visibility';

  window.initDebugLayers = function(map) {
    const panel = document.getElementById('debug-layers-panel');
    const header = document.getElementById('debug-layers-header');
    const toggleBtn = document.getElementById('debug-layers-toggle');
    const body = document.getElementById('debug-layers-body');
    const listEl = document.getElementById('debug-layers-list');
    if (!panel || !listEl || !map) return;

    function getLayerIds() {
      const style = map.getStyle();
      if (!style || !style.layers) return [];
      return style.layers.map(l => l.id);
    }

    function getVisibilityOverrides() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_VISIBILITY);
        return raw ? JSON.parse(raw) : {};
      } catch (e) {
        return {};
      }
    }

    function setVisibilityOverrides(overrides) {
      try {
        localStorage.setItem(STORAGE_KEY_VISIBILITY, JSON.stringify(overrides));
      } catch (e) {}
    }

    function getStoredOrder() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_ORDER);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }

    function setStoredOrder(ids) {
      try {
        localStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(ids));
      } catch (e) {}
    }

    function applyStoredOrder() {
      const stored = getStoredOrder();
      if (!stored || !stored.length) return;
      const current = getLayerIds();
      const validStored = stored.filter(id => current.includes(id));
      if (validStored.length === 0) return;
      validStored.forEach(id => {
        if (map.getLayer(id)) map.moveLayer(id);
      });
    }

    function layoutValueStr(val) {
      if (val === undefined || val === null) return '—';
      if (typeof val === 'number') return String(val);
      if (Array.isArray(val)) return 'expr';
      return String(val);
    }

    function render() {
      const ids = getLayerIds();
      const overrides = getVisibilityOverrides();
      listEl.innerHTML = '';

      ids.forEach((id) => {
        const layer = map.getLayer(id);
        if (!layer) return;
        const isSymbol = layer.type === 'symbol';

        const row = document.createElement('div');
        row.className = 'debug-layer-row';
        row.dataset.layerId = id;

        const label = document.createElement('span');
        label.className = 'debug-layer-id';
        label.textContent = id;

        const visBtn = document.createElement('button');
        visBtn.type = 'button';
        visBtn.className = 'debug-layer-vis';
        visBtn.title = 'Toggle visibility';
        const visible = overrides[id] !== undefined ? overrides[id] : (map.getLayoutProperty(id, 'visibility') !== 'none');
        visBtn.textContent = visible ? 'ON' : 'OFF';
        visBtn.dataset.visible = visible ? '1' : '0';

        const upBtn = document.createElement('button');
        upBtn.type = 'button';
        upBtn.className = 'debug-layer-up';
        upBtn.textContent = '\u2191';
        upBtn.title = 'Move layer up (draw on top)';

        const downBtn = document.createElement('button');
        downBtn.type = 'button';
        downBtn.className = 'debug-layer-down';
        downBtn.textContent = '\u2193';
        downBtn.title = 'Move layer down';

        row.appendChild(label);
        row.appendChild(visBtn);
        row.appendChild(upBtn);
        row.appendChild(downBtn);

        if (isSymbol) {
          const iconSize = map.getLayoutProperty(id, 'icon-size');
          const textSize = map.getLayoutProperty(id, 'text-size');
          const sortKey = map.getLayoutProperty(id, 'symbol-sort-key');

          const debugRow = document.createElement('div');
          debugRow.className = 'debug-layer-debug-row';
          debugRow.innerHTML = '<span class="debug-layer-debug-label">icon:</span>';
          const iconInput = document.createElement('input');
          iconInput.type = 'text';
          iconInput.className = 'debug-layer-input';
          iconInput.placeholder = layoutValueStr(iconSize);
          iconInput.title = 'icon-size';
          iconInput.size = 4;
          if (typeof iconSize === 'number') iconInput.value = iconSize;
          iconInput.addEventListener('change', () => {
            const n = parseFloat(iconInput.value);
            if (!isNaN(n) && map.getLayer(id)) map.setLayoutProperty(id, 'icon-size', n);
            render();
          });
          debugRow.appendChild(iconInput);

          const sep1 = document.createElement('span');
          sep1.className = 'debug-layer-debug-sep';
          sep1.textContent = ' ';
          debugRow.appendChild(sep1);
          const textLabel = document.createElement('span');
          textLabel.className = 'debug-layer-debug-label';
          textLabel.textContent = 'text:';
          debugRow.appendChild(textLabel);
          const textInput = document.createElement('input');
          textInput.type = 'text';
          textInput.className = 'debug-layer-input';
          textInput.placeholder = layoutValueStr(textSize);
          textInput.title = 'text-size';
          textInput.size = 4;
          if (typeof textSize === 'number') textInput.value = textSize;
          textInput.addEventListener('change', () => {
            const n = parseFloat(textInput.value);
            if (!isNaN(n) && map.getLayer(id)) map.setLayoutProperty(id, 'text-size', n);
            render();
          });
          debugRow.appendChild(textInput);

          const sep2 = document.createElement('span');
          sep2.className = 'debug-layer-debug-sep';
          sep2.textContent = ' ';
          debugRow.appendChild(sep2);
          const prioLabel = document.createElement('span');
          prioLabel.className = 'debug-layer-debug-label';
          prioLabel.textContent = 'prio:';
          debugRow.appendChild(prioLabel);
          const prioInput = document.createElement('input');
          prioInput.type = 'text';
          prioInput.className = 'debug-layer-input';
          prioInput.placeholder = layoutValueStr(sortKey);
          prioInput.title = 'symbol-sort-key (placement priority)';
          prioInput.size = 3;
          if (typeof sortKey === 'number') prioInput.value = sortKey;
          prioInput.addEventListener('change', () => {
            const n = parseInt(prioInput.value, 10);
            if (!isNaN(n) && map.getLayer(id)) map.setLayoutProperty(id, 'symbol-sort-key', n);
            render();
          });
          debugRow.appendChild(prioInput);

          const zoomRow = document.createElement('div');
          zoomRow.className = 'debug-layer-debug-row';
          const minLblSym = document.createElement('span');
          minLblSym.className = 'debug-layer-debug-label';
          minLblSym.textContent = 'min:';
          zoomRow.appendChild(minLblSym);
          const minZoomInput = document.createElement('input');
          minZoomInput.type = 'text';
          minZoomInput.className = 'debug-layer-input debug-layer-zoom';
          minZoomInput.placeholder = layer.minzoom != null ? String(layer.minzoom) : '—';
          minZoomInput.title = 'minzoom';
          if (layer.minzoom != null) minZoomInput.value = layer.minzoom;
          minZoomInput.addEventListener('change', () => {
            const n = parseFloat(minZoomInput.value);
            if (!isNaN(n) && map.getLayer(id)) {
              const maxVal = maxZoomInput.value !== '' ? parseFloat(maxZoomInput.value) : 24;
              map.setLayerZoomRange(id, n, isNaN(maxVal) ? 24 : maxVal);
            }
            render();
          });
          zoomRow.appendChild(minZoomInput);
          const sepZoom = document.createElement('span');
          sepZoom.className = 'debug-layer-debug-sep';
          sepZoom.textContent = ' ';
          zoomRow.appendChild(sepZoom);
          const maxLblSym = document.createElement('span');
          maxLblSym.className = 'debug-layer-debug-label';
          maxLblSym.textContent = 'max:';
          zoomRow.appendChild(maxLblSym);
          const maxZoomInput = document.createElement('input');
          maxZoomInput.type = 'text';
          maxZoomInput.className = 'debug-layer-input debug-layer-zoom';
          maxZoomInput.placeholder = layer.maxzoom != null ? String(layer.maxzoom) : '—';
          maxZoomInput.title = 'maxzoom';
          if (layer.maxzoom != null) maxZoomInput.value = layer.maxzoom;
          maxZoomInput.addEventListener('change', () => {
            const n = parseFloat(maxZoomInput.value);
            if (!isNaN(n) && map.getLayer(id)) {
              const minVal = minZoomInput.value !== '' ? parseFloat(minZoomInput.value) : 0;
              map.setLayerZoomRange(id, isNaN(minVal) ? 0 : minVal, n);
            }
            render();
          });
          zoomRow.appendChild(maxZoomInput);

          const wrap = document.createElement('div');
          wrap.className = 'debug-layer-block';
          wrap.appendChild(row);
          wrap.appendChild(debugRow);
          wrap.appendChild(zoomRow);
          listEl.appendChild(wrap);
        } else {
          const zoomRow = document.createElement('div');
          zoomRow.className = 'debug-layer-debug-row';
          const minLbl = document.createElement('span');
          minLbl.className = 'debug-layer-debug-label';
          minLbl.textContent = 'min:';
          zoomRow.appendChild(minLbl);
          const minZoomInput = document.createElement('input');
          minZoomInput.type = 'text';
          minZoomInput.className = 'debug-layer-input debug-layer-zoom';
          minZoomInput.placeholder = layer.minzoom != null ? String(layer.minzoom) : '—';
          minZoomInput.title = 'minzoom';
          if (layer.minzoom != null) minZoomInput.value = layer.minzoom;
          minZoomInput.addEventListener('change', () => {
            const n = parseFloat(minZoomInput.value);
            if (!isNaN(n) && map.getLayer(id)) {
              const maxVal = maxZoomInput.value !== '' ? parseFloat(maxZoomInput.value) : 24;
              map.setLayerZoomRange(id, n, isNaN(maxVal) ? 24 : maxVal);
            }
            render();
          });
          zoomRow.appendChild(minZoomInput);
          const sepZoom = document.createElement('span');
          sepZoom.className = 'debug-layer-debug-sep';
          sepZoom.textContent = ' ';
          zoomRow.appendChild(sepZoom);
          const maxLbl = document.createElement('span');
          maxLbl.className = 'debug-layer-debug-label';
          maxLbl.textContent = 'max:';
          zoomRow.appendChild(maxLbl);
          const maxZoomInput = document.createElement('input');
          maxZoomInput.type = 'text';
          maxZoomInput.className = 'debug-layer-input debug-layer-zoom';
          maxZoomInput.placeholder = layer.maxzoom != null ? String(layer.maxzoom) : '—';
          maxZoomInput.title = 'maxzoom';
          if (layer.maxzoom != null) maxZoomInput.value = layer.maxzoom;
          maxZoomInput.addEventListener('change', () => {
            const n = parseFloat(maxZoomInput.value);
            if (!isNaN(n) && map.getLayer(id)) {
              const minVal = minZoomInput.value !== '' ? parseFloat(minZoomInput.value) : 0;
              map.setLayerZoomRange(id, isNaN(minVal) ? 0 : minVal, n);
            }
            render();
          });
          zoomRow.appendChild(maxZoomInput);

          const wrap = document.createElement('div');
          wrap.className = 'debug-layer-block';
          wrap.appendChild(row);
          wrap.appendChild(zoomRow);
          listEl.appendChild(wrap);
        }

        visBtn.addEventListener('click', () => {
          const nowVisible = visBtn.dataset.visible !== '1';
          if (map.getLayer(id)) {
            map.setLayoutProperty(id, 'visibility', nowVisible ? 'visible' : 'none');
            overrides[id] = nowVisible;
            setVisibilityOverrides(overrides);
            visBtn.dataset.visible = nowVisible ? '1' : '0';
            visBtn.textContent = nowVisible ? 'ON' : 'OFF';
          }
        });

        upBtn.addEventListener('click', () => {
          const current = getLayerIds();
          const i = current.indexOf(id);
          if (i < 0 || i >= current.length - 1) return;
          const beforeId = current[i + 2] || undefined;
          if (map.getLayer(id)) map.moveLayer(id, beforeId);
          setStoredOrder(getLayerIds());
          render();
        });

        downBtn.addEventListener('click', () => {
          const current = getLayerIds();
          const i = current.indexOf(id);
          if (i <= 0) return;
          const beforeId = current[i - 1];
          if (map.getLayer(id)) map.moveLayer(id, beforeId);
          setStoredOrder(getLayerIds());
          render();
        });
      });
    }

    function applyStoredVisibility() {
      const overrides = getVisibilityOverrides();
      Object.keys(overrides).forEach(id => {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', overrides[id] ? 'visible' : 'none');
        }
      });
    }

    toggleBtn.addEventListener('click', () => {
      panel.classList.toggle('collapsed');
      toggleBtn.textContent = panel.classList.contains('collapsed') ? '\u9660' : '\u9650';
    });

    if (panel.classList.contains('collapsed')) {
      toggleBtn.textContent = '\u9660';
    } else {
      toggleBtn.textContent = '\u9650';
    }

    applyStoredOrder();
    applyStoredVisibility();
    render();
  };
})();
