// ═══════════════════════════════════════════════════════
//  Shared utilities
// ═══════════════════════════════════════════════════════
(function() {
  function haversineKm(a, b) {
    const R = 6371;
    const dLat = (b[1] - a[1]) * Math.PI / 180;
    const dLon = (b[0] - a[0]) * Math.PI / 180;
    const lat1 = a[1] * Math.PI / 180;
    const lat2 = b[1] * Math.PI / 180;
    const x = Math.sin(dLat/2)**2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2)**2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  window.AaltoUtils = { haversineKm, escHtml };
})();
