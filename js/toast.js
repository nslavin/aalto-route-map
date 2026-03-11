// ═══════════════════════════════════════════════════════
//  Toast
// ═══════════════════════════════════════════════════════
window.Aalto.showToast = function(msg, duration = 3000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('visible'), duration);
};
