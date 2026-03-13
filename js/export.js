// ═══════════════════════════════════════════════════════
//  Export — Share (clipboard) & Print for bookmarks and route
// ═══════════════════════════════════════════════════════
(function() {
  const A = window.Aalto;

  function buildBookmarksText(featureList, favs, lang) {
    const items = [...favs]
      .map(id => featureList.find(f => f.id === id))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (items.length === 0) return '';
    const title = lang === 'fi'
      ? `Alvar Aallon suosikit (${items.length})`
      : `My Alvar Aalto bookmarks (${items.length})`;
    const lines = [title, ''];
    items.forEach((item, i) => {
      const name = (lang === 'fi' && item.name_fi) ? item.name_fi : item.name;
      const city = (lang === 'fi' && item.city_fi) ? item.city_fi : item.city;
      const addr = (lang === 'fi' && item.feature?.properties?.address_fi)
        ? item.feature.properties.address_fi
        : item.feature?.properties?.address || '';
      const url = (lang === 'fi' && item.feature?.properties?.url_fi)
        ? item.feature.properties.url_fi
        : item.feature?.properties?.url || '';
      lines.push(`${i + 1}. ${name}${city ? ' – ' + city : ''}`);
      if (addr) lines.push(`   ${addr}`);
      if (url) lines.push(`   ${url}`);
      lines.push('');
    });
    return lines.join('\n').trim();
  }

  function buildRouteText(routeStops, routeSegments, featureList, lang, gmapsUrl) {
    if (!routeStops || routeStops.length === 0) return '';
    const n = routeStops.length;
    const title = lang === 'fi'
      ? `Alvar Aallon reitti (${n} ${n === 1 ? 'pysäkki' : 'pysäkkiä'})`
      : `My Alvar Aalto route (${n} ${n === 1 ? 'stop' : 'stops'})`;
    const lines = [title, ''];
    const ml = A.i18n?.[lang]?.modeLabels || A.i18n?.en?.modeLabels || {};
    routeStops.forEach((stop, i) => {
      const name = stop.name;
      let line = `${i + 1}. ${name}`;
      if (i < routeSegments.length) {
        const seg = routeSegments[i];
        const modeLabel = ml[seg.mode] || seg.mode;
        const dist = seg.distanceText || '';
        const dur = seg.durationText || '';
        if (dist || dur) line += `  · ${modeLabel} · ${dist} · ${dur}`;
      }
      lines.push(line);
    });
    if (routeStops.length >= 2 && gmapsUrl) {
      lines.push('');
      lines.push(lang === 'fi' ? 'Avaa Google Mapsissa: ' + gmapsUrl : 'Open in Google Maps: ' + gmapsUrl);
    }
    return lines.join('\n');
  }

  function getGmapsUrl(routeStops, routeSegments) {
    if (!routeStops || routeStops.length < 2) return null;
    const origin = routeStops[0];
    const dest = routeStops[routeStops.length - 1];
    const modeMap = { DRIVING: 'driving', WALKING: 'walking', BICYCLING: 'bicycling', TRANSIT: 'transit' };
    const isMixed = routeSegments.some(seg =>
      (seg.modeOverride && seg.modeOverride !== A.globalMode) || (seg.mode && seg.mode !== A.globalMode));
    let effectiveMode = A.globalMode;
    if (isMixed) {
      const modeCounts = {};
      routeSegments.forEach(seg => { modeCounts[seg.mode] = (modeCounts[seg.mode] || 0) + 1; });
      effectiveMode = Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0][0];
    }
    const travelmode = modeMap[effectiveMode] || 'driving';
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.coords[1]},${origin.coords[0]}&destination=${dest.coords[1]},${dest.coords[0]}&travelmode=${travelmode}`;
    if (routeStops.length > 2) {
      const waypoints = routeStops.slice(1, -1).map(s => `${s.coords[1]},${s.coords[0]}`).join('|');
      url += `&waypoints=${encodeURIComponent(waypoints)}`;
    }
    return url;
  }

  function shareToClipboard(text, onSuccess, onFail) {
    if (!text) {
      if (onFail) onFail('Nothing to share');
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => { if (onSuccess) onSuccess(); })
        .catch(() => { if (onFail) onFail(); });
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:0;left:0;width:2em;height:2em;padding:0;border:none;outline:none;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        if (onSuccess) onSuccess();
      } catch (e) {
        if (onFail) onFail();
      }
      document.body.removeChild(ta);
    }
  }

  async function printBookmarks(opts) {
    if (opts && opts.before) await Promise.resolve(opts.before());
    const title = A.lang === 'fi' ? 'Alvar Aallon Reitti – Suosikit' : 'Alvar Aalto Route – My Bookmarks';
    document.body.classList.add('print-mode', 'print-bookmarks');
    document.body.dataset.printTitle = title;
    const oldTitle = document.title;
    document.title = title;
    window.print();
    function cleanup() {
      window.removeEventListener('afterprint', cleanup);
      document.body.classList.remove('print-mode', 'print-bookmarks');
      delete document.body.dataset.printTitle;
      document.title = oldTitle;
      if (opts && opts.after) opts.after();
    }
    window.addEventListener('afterprint', cleanup);
  }

  async function printRoute(opts) {
    if (opts && opts.before) await Promise.resolve(opts.before());
    const title = A.lang === 'fi' ? 'Alvar Aallon Reitti – Matka' : 'Alvar Aalto Route – My Trip';
    document.body.classList.add('print-mode', 'print-route');
    document.body.dataset.printTitle = title;
    const oldTitle = document.title;
    document.title = title;
    window.print();
    function cleanup() {
      window.removeEventListener('afterprint', cleanup);
      document.body.classList.remove('print-mode', 'print-route');
      delete document.body.dataset.printTitle;
      document.title = oldTitle;
      if (opts && opts.after) opts.after();
    }
    window.addEventListener('afterprint', cleanup);
  }

  A.buildBookmarksText = buildBookmarksText;
  A.buildRouteText = buildRouteText;
  A.getGmapsUrl = getGmapsUrl;
  A.shareToClipboard = shareToClipboard;
  A.printBookmarks = printBookmarks;
  A.printRoute = printRoute;
})();
