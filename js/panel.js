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
    const esc = window.AaltoUtils.escHtml;
    const actionsEl = document.getElementById('panel-actions');
    const fid = feature.id;
    const p = feature.properties;
    const isFav = A.favs.has(fid);
    const isVis = A.visited.has(fid);
    const inRoute = A.routeStops.some(s => s.id === fid);
    actionsEl.innerHTML = `
      <button class="panel-action-btn${isFav ? ' active' : ''}" data-action="fav" title="${esc(A.t('tipBookmark'))}"><svg width="8" height="11" viewBox="0 0 11 14" fill="currentColor"><path d="M0 0h11v14l-5.5-4L0 14z"/></svg>${esc(A.t('bookmark'))}</button>
      <button class="panel-action-btn${isVis ? ' active' : ''}" data-action="visited" title="${esc(A.t('tipVisited'))}"><svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 6l3 3 5-6"/></svg>${esc(A.t('visited'))}</button>
      <button class="panel-action-btn${inRoute ? ' active' : ''}" data-action="route" title="${inRoute ? esc(A.t('tipRemoveRoute')) : esc(A.t('tipAddRoute'))}"><span class="panel-action-sym">${inRoute ? '−' : '+'}</span>${inRoute ? esc(A.t('removeFromRoute')) : esc(A.t('addToRoute'))}</button>`;
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
    const locals = det.local_images || {};
    const images = [];

    if (locals.cover?.medium) {
      const lc = locals.cover;
      images.push({
        medium: lc.medium,
        large: lc.large || lc.medium,
        thumb: lc.thumb || lc.medium,
        caption: (det.cover || {}).caption || '',
      });
    }

    (locals.gallery || []).forEach((gl, gi) => {
      if (gl?.medium) {
        images.push({
          medium: gl.medium,
          large: gl.large || gl.medium,
          thumb: gl.thumb || gl.medium,
          caption: (det.gallery || [])[gi]?.caption || '',
        });
      }
    });

    if (images.length === 0) {
      const cov = det.cover || {};
      if (cov.url) {
        images.push({ medium: cov.url, large: cov.url, thumb: cov.url, caption: cov.caption || '' });
      }
      (det.gallery || []).forEach((g, gi) => {
        if (g?.url) {
          images.push({ medium: g.url, large: g.url, thumb: g.url, caption: g.caption || '' });
        }
      });
    }

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
      imgEl.onerror = () => imgEl.classList.remove('loading');
      imgEl.src = item.medium;
      imgEl.alt = item.caption || '';
      capText.textContent = item.caption || '';
      capBar.style.display = (item.caption || images.length > 1) ? '' : 'none';
      capBar.style.left = item.caption ? '0' : '';
      capBar.style.background = item.caption ? 'rgba(255,255,255,0.8)' : 'transparent';
      navEl.style.background = item.caption ? 'transparent' : 'rgba(255,255,255,0.8)';
    }

    A.carouselImages = images;
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
    const esc = window.AaltoUtils.escHtml;
    const descEl = document.getElementById('panel-description');
    const desc = (isfi && det.description_fi ? det.description_fi : det.description) || '';
    if (desc) {
      const paras = desc.split('\n\n');
      let html = `<p>${esc(paras[0])}</p>`;
      if (paras.length > 1) {
        html += `<div class="desc-rest">${paras.slice(1).map(p => `<p>${esc(p)}</p>`).join('')}</div>`;
        html += `<button class="desc-toggle">${esc(A.t('readMore'))}</button>`;
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
    const esc = window.AaltoUtils.escHtml;
    const contactEl = document.getElementById('panel-contact');
    contactEl.innerHTML = '';
    if (det.phone) {
      contactEl.innerHTML += `
        <div class="panel-footer-row">
          <span class="panel-footer-label">${esc(A.t('phone'))}</span>
          <a class="panel-footer-value" href="tel:${esc(det.phone)}">${esc(det.phone)}</a>
        </div>`;
    }
    if (det.email) {
      contactEl.innerHTML += `
        <div class="panel-footer-row">
          <span class="panel-footer-label">Email</span>
          <a class="panel-footer-value" href="mailto:${esc(det.email)}">${esc(det.email)}</a>
        </div>`;
    }
    const websites = det.websites || [];
    if (websites.length) {
      websites.forEach(w => {
        const domain = w.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');
        contactEl.innerHTML += `
          <div class="panel-footer-row">
            <span class="panel-footer-label">${esc(w.label)}</span>
            <a class="panel-footer-value" href="${esc(w.url)}" target="_blank" rel="noopener">${esc(domain)}</a>
          </div>`;
      });
    } else if (det.website) {
      const domain = det.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');
      contactEl.innerHTML += `
        <div class="panel-footer-row">
          <span class="panel-footer-label">${esc(A.t('website'))}</span>
          <a class="panel-footer-value" href="${esc(det.website)}" target="_blank" rel="noopener">${esc(domain)}</a>
        </div>`;
    }
    const links = det.links || [];
    if (links.length) {
      links.forEach(l => {
        const domain = l.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');
        contactEl.innerHTML += `
          <div class="panel-footer-row">
            <span class="panel-footer-label">${esc(l.label)}</span>
            <a class="panel-footer-value" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(domain)}</a>
          </div>`;
      });
    }
    const socialEl = document.getElementById('panel-social');
    socialEl.innerHTML = '';
    const social = det.social || {};
    const socialMap = { instagram: 'Instagram', facebook: 'Facebook', twitter: 'X', pinterest: 'Pinterest' };
    Object.entries(socialMap).forEach(([key, label]) => {
      if (social[key]) {
        socialEl.innerHTML += `<a class="social-link" href="${esc(social[key])}" target="_blank" rel="noopener">${label}</a>`;
      }
    });
  }

  function renderPanel(feature) {
    const p = feature.properties;
    const detailsKey = String(feature.id);
    const det = A.details[detailsKey] || {};
    const isfi = A.lang === 'fi';

    document.getElementById('panel-name').textContent =
      (isfi && p.name_fi ? p.name_fi : p.name);

    const rawAddr = (isfi && p.address_fi ? p.address_fi : p.address) || '';
    const parts = rawAddr.split(',');
    document.getElementById('panel-address').textContent =
      parts.length > 2 ? parts.slice(-3).join(',').trim() : rawAddr;

    const nameForQuery = (isfi && p.name_fi ? p.name_fi : p.name) || '';
    const addrForQuery = (isfi && p.address_fi ? p.address_fi : p.address) || '';
    const coords = feature.geometry?.coordinates;
    const searchQuery = [nameForQuery, addrForQuery].filter(Boolean).join(' ');
    const gmapsUrl = searchQuery
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`
      : (coords ? `https://www.google.com/maps/search/?api=1&query=${coords[1]},${coords[0]}` : '#');
    const gmEl = document.getElementById('panel-gmaps');
    gmEl.href = gmapsUrl;
    gmEl.textContent = A.t('openGoogleMaps');
    gmEl.title = A.t('tipGoogleMaps');
    gmEl.style.display = gmapsUrl === '#' ? 'none' : '';

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
    panel.classList.add('open');
    A.updatePanelLayout();
    A.savePanels();
  }

  function closePanel() {
    const map = A.map;
    panel.classList.remove('open');
    panel.classList.remove('stacked');
    const mapEl = document.getElementById('map');
    mapEl.classList.remove('detail-open');
    if (map && A.selectedId != null) {
      map.setFeatureState({ source: 'aalto', id: A.selectedId }, { selected: false });
    }
    A.selectedId = null;
    A.currentFeature = null;
    A.updatePanelLayout();
    A.savePanels();
  }

  function selectFeature(feature, opts) {
    openPanel(feature);
    A.highlightListItem(feature.id, opts);
    A.highlightRouteStop(feature.id);
    const map = A.map;
    if (map && feature.geometry && feature.geometry.coordinates) {
      const randomBearing = Math.random() * 60 - 30;
      // Defer flyTo so map.resize() from openPanel/updatePanelLayout takes effect
      requestAnimationFrame(() => {
        const padding = A.getMapPadding ? A.getMapPadding() : { top: 40, bottom: 40, left: 40, right: 40 };
        map.flyTo({
          center: feature.geometry.coordinates,
          zoom: 18, pitch: 50, bearing: randomBearing, speed: 1.8,
          padding: padding,
        });
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
