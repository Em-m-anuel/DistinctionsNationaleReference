/* ==========================================================================
   GAB-ORIENT — Adaptateur cartographique
   GOMap.create(el, venues, { onSelect }) renvoie { kind, select(id), filter(ids), destroy() }
   - kind 'leaflet'  : carte interactive réelle (Leaflet + fournisseur de tuiles
                       défini dans GO_DATA.config.map)
   - kind 'schema'   : repli lorsque Leaflet n'a pas pu être chargé. Le plan est
                       présenté explicitement comme un schéma de positions.
   Pour changer de fournisseur (Mapbox, IGN, serveur interne…), seule la
   fonction leaflet() ou la configuration des tuiles est à adapter.
   ========================================================================== */
window.GOMap = (function () {
  'use strict';
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-motion');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Attend la fin du chargement du script Leaflet (succès, échec ou délai).
  function ready(timeout) {
    return new Promise(resolve => {
      if (window.L) return resolve(true);
      const st = window.__leaflet;
      if (st === 'error') return resolve(false);
      const t0 = Date.now();
      const iv = setInterval(() => {
        if (window.L) { clearInterval(iv); resolve(true); }
        else if (window.__leaflet === 'error' || Date.now() - t0 > (timeout || 2500)) { clearInterval(iv); resolve(false); }
      }, 80);
    });
  }

  function notice(el, html) {
    const n = document.createElement('div');
    n.className = 'map-notice';
    n.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-alert-triangle"/></svg><span>' + html + '</span>';
    el.appendChild(n);
  }

  function leaflet(el, venues, opts, cfg) {
    el.innerHTML = '';
    el.classList.add('map-live');
    const L = window.L;
    const map = L.map(el, { scrollWheelZoom: false, zoomControl: true }).setView(cfg.center, cfg.zoom);
    const tiles = L.tileLayer(cfg.tileUrl, { maxZoom: 18, attribution: cfg.attribution, subdomains: 'abc' });
    let errors = 0, loaded = 0;
    tiles.on('tileload', () => { loaded++; });
    tiles.on('tileerror', () => {
      errors++;
      if (errors === 3 && loaded === 0) notice(el, 'Le fond de carte n’a pas pu être chargé (réseau ou fournisseur de tuiles). Les positions des lieux restent sélectionnables.');
    });
    tiles.addTo(map);
    const markers = {};
    venues.forEach(v => {
      const m = L.marker([v.lat, v.lng], {
        icon: L.divIcon({ className: 'map-pin', html: '<span></span>', iconSize: [26, 34], iconAnchor: [13, 32] }),
        title: v.name, alt: v.name, keyboard: true, riseOnHover: true
      }).addTo(map);
      m.bindTooltip(esc(v.name), { direction: 'top', offset: [0, -30] });
      m.on('click', () => opts.onSelect && opts.onSelect(v.id));
      m.on('keypress', e => { if (e.originalEvent.key === 'Enter') opts.onSelect && opts.onSelect(v.id); });
      markers[v.id] = m;
    });
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return {
      kind: 'leaflet',
      select(id) {
        Object.entries(markers).forEach(([k, m]) => { const e = m.getElement(); if (e) e.classList.toggle('is-active', k === id); });
        const v = venues.find(x => x.id === id);
        if (!v) return;
        if (reduce()) map.setView([v.lat, v.lng], 13); else map.flyTo([v.lat, v.lng], 13, { duration: 0.9 });
      },
      filter(ids) {
        Object.entries(markers).forEach(([k, m]) => { const show = ids.includes(k); if (show && !map.hasLayer(m)) m.addTo(map); if (!show && map.hasLayer(m)) m.remove(); });
      },
      destroy() { ro.disconnect(); map.remove(); }
    };
  }

  // Plan schématique : projection linéaire lat/long dans l'emprise du Gabon.
  function schema(el, venues, opts) {
    const B = { n: 2.4, s: -4.0, w: 8.6, e: 14.6 };
    const x = lng => ((lng - B.w) / (B.e - B.w)) * 100;
    const y = lat => ((B.n - lat) / (B.n - B.s)) * 100;
    let axes = '';
    for (let lng = 9; lng <= 14; lng++) axes += `<span class="schema-axis" style="left:${x(lng)}%;bottom:4px;transform:translateX(-50%)">${lng}°E</span>`;
    for (let lat = 2; lat >= -3; lat--) axes += `<span class="schema-axis" style="top:${y(lat)}%;left:6px;transform:translateY(-50%)">${lat === 0 ? '0°' : Math.abs(lat) + '°' + (lat > 0 ? 'N' : 'S')}</span>`;
    el.innerHTML = `<div class="schema" role="group" aria-label="Plan schématique des positions des lieux"><div class="schema-sea"></div>${axes}
      ${venues.map(v => `<button type="button" class="schema-pin" data-v="${v.id}" style="left:${x(v.lng)}%;top:${y(v.lat)}%" aria-label="${esc(v.name)}, ${esc(v.city)}"><span class="p"></span><span class="l">${esc(v.name)}</span></button>`).join('')}</div>`;
    notice(el, 'Carte interactive non chargée : plan schématique (positions relatives en latitude et longitude). Configurez le fournisseur cartographique pour afficher la carte.');
    el.querySelectorAll('.schema-pin').forEach(b => b.addEventListener('click', () => opts.onSelect && opts.onSelect(b.dataset.v)));
    return {
      kind: 'schema',
      select(id) { el.querySelectorAll('.schema-pin').forEach(b => b.classList.toggle('is-active', b.dataset.v === id)); },
      filter(ids) { el.querySelectorAll('.schema-pin').forEach(b => { b.hidden = !ids.includes(b.dataset.v); }); },
      destroy() { el.innerHTML = ''; }
    };
  }

  async function create(el, venues, opts) {
    const cfg = (window.GO_DATA && window.GO_DATA.config.map) || {};
    const ok = await ready(2500);
    if (ok && !opts.forceSchema) {
      try { return leaflet(el, venues, opts, cfg); } catch (e) { console.warn('Carte Leaflet indisponible', e); }
    }
    return schema(el, venues, opts);
  }

  return { create, ready };
})();
