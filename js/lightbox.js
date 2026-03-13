// ═══════════════════════════════════════════════════════
//  Lightbox
// ═══════════════════════════════════════════════════════
(function() {
  window.Aalto.details = {};
  let lbIdx = 0;
  let lbImages = [];

  function openLightbox(startIdx) {
    lbImages = window.Aalto.carouselImages || [];
    lbIdx = startIdx;
    const thumbsEl = document.getElementById('lightbox-thumbs');
    thumbsEl.innerHTML = lbImages.length > 1
      ? lbImages.map((img, i) =>
          `<img class="lb-thumb" src="${img.thumb}" data-idx="${i}">`
        ).join('')
      : '';
    thumbsEl.querySelectorAll('.lb-thumb').forEach(t => {
      t.onclick = (e) => { e.stopPropagation(); showLbSlide(+t.dataset.idx); };
    });
    document.getElementById('lightbox').classList.add('open');
    showLbSlide(lbIdx);
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    document.getElementById('lightbox').classList.remove('open');
    document.body.style.overflow = '';
  }
  function showLbSlide(n) {
    lbIdx = (n + lbImages.length) % lbImages.length;
    const item = lbImages[lbIdx];
    const img = document.getElementById('lightbox-img');
    img.src = item.large;
    img.alt = item.caption || '';
    document.getElementById('lightbox-caption').textContent = item.caption || '';
    document.getElementById('lightbox-prev').style.display = lbImages.length > 1 ? '' : 'none';
    document.getElementById('lightbox-next').style.display = lbImages.length > 1 ? '' : 'none';
    document.querySelectorAll('.lb-thumb').forEach((t, i) => {
      t.classList.toggle('active', i === lbIdx);
    });
  }

  window.Aalto.openLightbox = openLightbox;
  window.Aalto.closeLightbox = closeLightbox;

  document.getElementById('lightbox-close').onclick = closeLightbox;
  document.getElementById('lightbox-prev').onclick = (e) => { e.stopPropagation(); showLbSlide(lbIdx - 1); };
  document.getElementById('lightbox-next').onclick = (e) => { e.stopPropagation(); showLbSlide(lbIdx + 1); };
  document.getElementById('lightbox').onclick = (e) => { if (e.target.id === 'lightbox') closeLightbox(); };
  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('lightbox').classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showLbSlide(lbIdx - 1);
    if (e.key === 'ArrowRight') showLbSlide(lbIdx + 1);
  });
})();
