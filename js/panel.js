// ═══════════════════════════════════════════════════════
//  Detail Panel
// Uses window.Aalto (state, i18n, lightbox). Aalto.map set by map-init.js
// ═══════════════════════════════════════════════════════
(function() {
  const A = window.Aalto;
  const panel = document.getElementById('panel');
  A.currentFeature = null;
  A.selectedId = null;

  function renderPanelActions(feature) {
    const actionsEl = document.getElementById('panel-actions');
    const fid = feature.id;
    const p = feature.properties;
    const isFav = A.favs.has(fid);
    const isVis = A.visited.has(fid);
    const inRoute = A.routeStops.some(s => s.id === fid);
    actionsEl.innerHTML = `
      <button class="panel-action-btn${isFav ? ' active' : ''}" data-action="fav" title="${A.t('tipBookmark')}"><svg width="9" height="12" viewBox="0 0 11 14" fill="currentColor"><path d="M0 0h11v14l-5.5-4L0 14z"/></svg> ${A.t('bookmark')}</button>
      <button class="panel-action-btn${isVis ? ' active' : ''}" data-action="visited" title="${A.t('tipVisited')}"><svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 6l3 3 5-6"/></svg> ${A.t('visited')}</button>
      <button class="panel-action-btn${inRoute ? ' active' : ''}" data-action="route" title="${inRoute ? A.t('tipRemoveRoute') : A.t('tipAddRoute')}">${inRoute ? '− ' + A.t('removeFromRoute') : '+ ' + A.t('addToRoute')}</button>`;
    actionsEl.querySelector('[data-action="fav"]').onclick = () => {
      A.toggleFav(fid);
      A.renderPanel(feature);
      A.renderList();
    };
    actionsEl.querySelector('[data-action="visited"]').onclick = () => {
      A.toggleVisited(fid);
      A.renderPanel(feature);
      A.renderList();
    };
    actionsEl.querySelector('[data-action="route"]').onclick = () => {
      const coords = feature.geometry && feature.geometry.coordinates ? feature.geometry.coordinates : null;
      A.toggleRoute(fid, coords, p.name);
      A.renderPanel(feature);
      A.renderList();
    };
  }

  function renderPanelCarousel(feature, det) {
    const p = feature.properties;
    const cover = det.cover || {};
    const coverUrl = cover.url || p.image || '';
    let coverCaption = cover.caption || '';
    if (!coverCaption) {
      const match = (det.gallery || []).find(g => g.url === coverUrl && g.caption);
      if (match) coverCaption = match.caption;
    }
    const images = [];
    if (coverUrl) images.push({ url: coverUrl, caption: coverCaption });
    (det.gallery || []).forEach(item => {
      if (item.url && item.url !== coverUrl) images.push(item);
    });

    const carEl = document.getElementById('panel-carousel');
    const imgEl = document.getElementById('carousel-img');
    const capBar = document.getElementById('carousel-caption');
    const capText = document.getElementById('carousel-caption-text');
    const navEl = document.getElementById('carousel-nav');
    let carouselIdx = 0;

    function showSlide(n) {
      carouselIdx = (n + images.length) % images.length;
      const item = images[carouselIdx];
      imgEl.classList.add('loading');
      imgEl.onload = () => imgEl.classList.remove('loading');
      imgEl.src = item.url;
      imgEl.alt = item.caption || '';
      capText.textContent = item.caption || '';
      capBar.style.display = (item.caption || images.length > 1) ? '' : 'none';
      capBar.style.left = item.caption ? '0' : '';
      capBar.style.background = item.caption ? 'rgba(255,255,255,0.8)' : 'transparent';
      navEl.style.background = item.caption ? 'transparent' : 'rgba(255,255,255,0.8)';
    }

    window._carouselImages = images;
    if (images.length) {
      carEl.style.display = '';
      navEl.style.display = images.length > 1 ? '' : 'none';
      showSlide(0);
      document.getElementById('carousel-prev').onclick = (e) => { e.stopPropagation(); showSlide(carouselIdx - 1); };
      document.getElementById('carousel-next').onclick = (e) => { e.stopPropagation(); showSlide(carouselIdx + 1); };
      imgEl.onclick = () => A.openLightbox(carouselIdx);
    } else {
      carEl.style.display = 'none';
    }
  }

  function renderPanelDescription(det, isfi) {
    const descEl = document.getElementById('panel-description');
    const desc = (isfi && det.description_fi ? det.description_fi : det.description) || '';
    if (desc) {
      const paras = desc.split('\n\n');
      let html = `<p>${paras[0]}</p>`;
      if (paras.length > 1) {
        html += `<div class="desc-rest">${paras.slice(1).map(p => `<p>${p}</p>`).join('')}</div>`;
        html += `<button class="desc-toggle">${A.t('readMore')}</button>`;
      }
      descEl.innerHTML = html;
      const restEl = descEl.querySelector('.desc-rest');
      const toggleBtn = descEl.querySelector('.desc-toggle');
      if (restEl && toggleBtn) {
        toggleBtn.onclick = () => {
          const expanded = restEl.classList.toggle('expanded');
          toggleBtn.textContent = expanded ? A.t('showLess') : A.t('readMore');
        };
      }
      descEl.classList.add('visible');
    } else {
      descEl.innerHTML = '';
      descEl.classList.remove('visible');
    }
  }

  function renderPanelContact(det) {
    const contactEl = document.getElementById('panel-contact');
    contactEl.innerHTML = '';
    if (det.phone) {
      contactEl.innerHTML += `
        <div class="panel-footer-row">
          <span class="panel-footer-label">${A.t('phone')}</span>
          <a class="panel-footer-value" href="tel:${det.phone}">${det.phone}</a>
        </div>`;
    }
    if (det.website) {
      const domain = det.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
      contactEl.innerHTML += `
        <div class="panel-footer-row">
          <span class="panel-footer-label">${A.t('website')}</span>
          <a class="panel-footer-value" href="${det.website}" target="_blank" rel="noopener">${domain}</a>
        </div>`;
    }
    const socialEl = document.getElementById('panel-social');
    socialEl.innerHTML = '';
    const social = det.social || {};
    const socialMap = { instagram: 'Instagram', facebook: 'Facebook', twitter: 'X' };
    Object.entries(socialMap).forEach(([key, label]) => {
      if (social[key]) {
        socialEl.innerHTML += `<a class="social-link" href="${social[key]}" target="_blank" rel="noopener">${label}</a>`;
      }
    });
  }

  function renderPanel(feature) {
    const p = feature.properties;
    const det = A.details[String(feature.id)] || {};
    const isfi = A.lang === 'fi';

    document.getElementById('panel-name').textContent =
      (isfi && p.name_fi ? p.name_fi : p.name);

    const rawAddr = (isfi && p.address_fi ? p.address_fi : p.address) || '';
    const parts = rawAddr.split(',');
    document.getElementById('panel-address').textContent =
      parts.length > 2 ? parts.slice(-3).join(',').trim() : rawAddr;

    renderPanelActions(feature);
    renderPanelCarousel(feature, det);
    renderPanelDescription(det, isfi);
    renderPanelContact(det);
  }

  function openPanel(feature) {
    const map = A.map;
    if (!map || feature.id == null) return;
    if (A.selectedId != null)
      map.setFeatureState({ source: 'aalto', id: A.selectedId }, { selected: false });
    A.selectedId = feature.id;
    map.setFeatureState({ source: 'aalto', id: A.selectedId }, { selected: true });
    A.currentFeature = feature;
    renderPanel(feature);
    const panelBody = document.getElementById('panel-body');
    if (panelBody) panelBody.scrollTop = 0;
    panel.scrollTop = 0;
    const mapEl = document.getElementById('map');
    mapEl.style.transition = 'none';
    mapEl.classList.add('detail-open');
    map.resize();
    requestAnimationFrame(() => { mapEl.style.transition = ''; });
    panel.classList.add('open');
    A.updatePanelLayout();
  }

  function closePanel() {
    const map = A.map;
    panel.classList.remove('open');
    const mapEl = document.getElementById('map');
    mapEl.style.transition = 'none';
    mapEl.classList.remove('detail-open');
    if (map) map.resize();
    requestAnimationFrame(() => { mapEl.style.transition = ''; });
    if (map && A.selectedId != null) {
      map.setFeatureState({ source: 'aalto', id: A.selectedId }, { selected: false });
    }
    A.selectedId = null;
    A.currentFeature = null;
    A.updatePanelLayout();
  }

  function selectFeature(feature, opts) {
    openPanel(feature);
    A.highlightListItem(feature.id, opts);
    A.highlightRouteStop(feature.id);
    const map = A.map;
    if (map && feature.geometry && feature.geometry.coordinates) {
      const randomBearing = Math.random() * 60 - 30;
      map.flyTo({
        center: feature.geometry.coordinates,
        zoom: 18, pitch: 50, bearing: randomBearing, speed: 1.8,
      });
    }
  }

  A.renderPanel = renderPanel;
  A.openPanel = openPanel;
  A.closePanel = closePanel;
  A.selectFeature = selectFeature;

  document.getElementById('panel-close').addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
})();
