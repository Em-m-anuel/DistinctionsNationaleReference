/* ==========================================================================
   GAB-ORIENT — Noyau de l'application
   - utilitaires (dates, formats, échappement)
   - état local (données de référence + modifications persistées sur le poste)
   - composants partagés (badges, toasts, modales, panneau latéral, menus,
     infobulles, compteurs animés, apparition au défilement)
   - coquille (en-tête, navigation, recherche, compte) et routeur
   Les vues sont enregistrées dans GO.views par les fichiers views-*.js.
   ========================================================================== */
window.GO = (function () {
  'use strict';
  const D = window.GO_DATA;
  const GO = { D, views: {} };
  const STORE_KEY = 'gab-orient.prototype.state';

  /* ---------- Utilitaires ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const pad = n => String(n).padStart(2, '0');
  const parseISO = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const REF_ISO = D.config.referenceDate;
  const REF = parseISO(REF_ISO);
  const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MONTHS_S = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  function fmtDate(s, mode = 'long') {
    if (!s) return '—';
    const d = parseISO(s);
    if (mode === 'short') return `${d.getDate()} ${MONTHS_S[d.getMonth()]} ${d.getFullYear()}`;
    if (mode === 'dm') return `${d.getDate()} ${MONTHS_S[d.getMonth()]}`;
    if (mode === 'full') return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    if (mode === 'num') return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }
  const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
  const ageDays = s => daysBetween(s, REF_ISO);
  function relDay(s) {
    const n = ageDays(s);
    if (n === 0) return 'aujourd’hui';
    if (n === 1) return 'hier';
    if (n > 1 && n < 7) return `il y a ${n} jours`;
    if (n === -1) return 'demain';
    if (n < 0 && n > -7) return `dans ${-n} jours`;
    return fmtDate(s, 'short');
  }
  const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-motion');
  const wait = ms => new Promise(r => setTimeout(r, reduced() ? Math.min(ms, 40) : ms));
  function stamp() { const d = new Date(); return { date: REF_ISO, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }; }
  function seniority(entree) {
    if (!entree) return null;
    const a = parseISO(entree), b = REF;
    let y = b.getFullYear() - a.getFullYear();
    if (b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())) y--;
    return y;
  }

  /* ---------- État ---------- */
  let S;
  function freshState() {
    const s = JSON.parse(JSON.stringify(D.seed));
    s.version = D.config.dataVersion; s.role = 'chef'; s.prefs = { reduceMotion: false, compact: false };
    return s;
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) { const p = JSON.parse(raw); if (p && p.version === D.config.dataVersion) return p; }
    } catch (e) { /* stockage indisponible : on repart des données de référence */ }
    return freshState();
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* ignoré */ } }
  function resetState() { S = freshState(); GO.S = S; try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignoré */ } }

  const role = () => D.roles[S.role];
  const can = k => !!role().can[k];
  const user = () => D.users[role().user];
  const org = id => D.organisations.find(o => o.id === id);
  const venue = id => D.venues.find(v => v.id === id);
  const medal = id => D.medals.find(m => m.id === id);
  const getDossier = ref => S.dossiers.find(d => d.ref === ref);
  const getDoc = id => S.documents.find(d => d.id === id);
  const getCer = id => S.ceremonies.find(c => c.id === id);
  const myDossiers = () => S.dossiers.filter(d => !role().scope || d.org === role().scope);
  const myDocs = () => S.documents.filter(doc => { const d = getDossier(doc.dossier); return d && (!role().scope || (d.org === role().scope && !doc.internal)); });
  const myNotifs = () => S.notifications.filter(n => role().scope ? n.aud === 'org:' + role().scope : n.aud === 'service');
  const myCers = () => S.ceremonies.filter(c => { const d = getDossier(c.dossier); return d && (!role().scope || d.org === role().scope); });
  const sortHist = h => h.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const lastActivity = d => sortHist(d.history).at(-1);
  const docsOf = ref => S.documents.filter(x => x.dossier === ref);
  const cersOf = ref => S.ceremonies.filter(c => c.dossier === ref).sort((a, b) => b.date.localeCompare(a.date));
  const activeCer = ref => S.ceremonies.find(c => c.dossier === ref && ['propose', 'negociation', 'confirme'].includes(c.state));
  const closure = date => D.closures.find(c => c.date === date);
  function actorName() { return S.role === 'demandeur' ? org(role().scope).name : S.role === 'chef' ? 'Chef du Service' : 'Service des Distinctions'; }
  function addHistory(d, kind, label, actor) { d.history.push(Object.assign(stamp(), { kind, label, actor: actor || actorName(), isNew: true })); }
  function notify(n) { S.notifications.unshift(Object.assign({ id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), read: false }, stamp(), n)); }
  function commit() { save(); renderCounts(); }

  // Position dans le circuit : 0 Dépôt … 5 Remise (6 = terminé)
  function stepInfo(d) {
    const map = { recu: 1, en_cours: 2, complement: 2, transmis: 3, refuse: 4, approuve: 5 };
    let cur = map[d.status];
    if (d.status === 'approuve') { const c = cersOf(d.ref)[0]; if (c && c.state === 'termine') cur = 6; }
    return { cur, wait: d.status === 'complement', stop: d.status === 'refuse' };
  }

  /* ---------- Composants ---------- */
  const badge = (label, tone, extra = '') => `<span class="badge tone-${tone} ${extra}">${esc(label)}</span>`;
  const statusBadge = (s, short) => badge(short ? D.statuses[s].short : D.statuses[s].label, D.statuses[s].tone);
  const cerBadge = s => badge(D.ceremonyStates[s].label, D.ceremonyStates[s].tone);
  const docBadge = s => badge(D.docStates[s].label, D.docStates[s].tone);
  const refChip = (ref, link = true) => link ? `<a class="ref-chip ref" href="#/dossiers/${esc(ref)}">${esc(ref)}</a>` : `<span class="ref-chip ref">${esc(ref)}</span>`;

  function stepMini(d) {
    const { cur, wait, stop } = stepInfo(d);
    const dots = D.steps.map((_, i) => `<i class="${i < cur ? 'done' : i === cur ? (stop ? 'stop' : wait ? 'wait' : 'cur') : ''}"></i>`).join('');
    const label = cur >= 6 ? 'Remise effectuée' : D.steps[cur];
    return `<div class="step-mini" title="Étape : ${esc(label)}"><span class="step-dots" aria-hidden="true">${dots}</span><span>${esc(label)}</span></div>`;
  }
  function stepper(d) {
    const { cur, wait, stop } = stepInfo(d);
    return `<ol class="stepper" style="--n:${D.steps.length}" aria-label="Étapes du circuit">${D.steps.map((s, i) => {
      const st = i < cur ? 'done' : i === cur ? (stop ? 'stop' : 'cur' + (wait ? ' wait' : '')) : '';
      const mark = i < cur ? icon('check') : stop && i === cur ? icon('x') : i + 1;
      const sr = i < cur ? 'terminée' : i === cur ? (stop ? 'décision de refus' : wait ? 'en attente de complément' : 'en cours') : 'à venir';
      return `<li class="stp ${st}" style="--i:${i}"><span class="stp-dot">${mark}</span><span class="stp-label">${s}<span class="sr-only"> — ${sr}</span></span></li>`;
    }).join('')}</ol>`;
  }
  const empty = (ic, title, text, action = '') => `<div class="empty"><div class="empty-mark">${icon(ic)}</div><h3>${esc(title)}</h3><p>${text}</p>${action}</div>`;
  function skeleton() {
    return `<div aria-hidden="true"><div class="skeleton sk-title"></div><div class="skeleton sk-line" style="width:340px"></div>
      <div class="grid grid-3 mt"><div class="skeleton sk-card"></div><div class="skeleton sk-card"></div><div class="skeleton sk-card"></div></div>
      <div class="skeleton sk-card mt" style="height:280px"></div></div><span class="sr-only">Chargement…</span>`;
  }

  /* Toasts */
  function toast(type, title, msg) {
    const host = $('#toasts');
    const el = document.createElement('div');
    const ic = { success: 'check-circle', error: 'alert-circle', info: 'info', warn: 'alert-triangle' }[type] || 'info';
    el.className = `toast t-${type}`;
    el.innerHTML = `${icon(ic)}<div><strong>${esc(title)}</strong>${msg ? `<span>${msg}</span>` : ''}</div><button class="icon-btn" type="button" aria-label="Fermer la notification">${icon('x', 'ic-sm')}</button>`;
    const close = () => { if (!el.isConnected) return; el.classList.add('is-leaving'); setTimeout(() => { el.remove(); document.body.classList.toggle('has-toasts', host.children.length > 0); }, 220); };
    el.querySelector('button').addEventListener('click', close);
    host.appendChild(el);
    document.body.classList.add('has-toasts');
    while (host.children.length > 3) host.firstChild.remove();
    setTimeout(close, 5200);
  }

  /* Couches (modales, panneau latéral, menu mobile) : inertie, focus, Échap */
  const layers = [];
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function pushLayer(el, onEscape) {
    const prev = layers.at(-1);
    if (prev) prev.el.inert = true;
    layers.push({ el, onEscape, returnFocus: document.activeElement });
    $('#app').inert = true;
    document.body.style.overflow = 'hidden';
  }
  function popLayer(el, restore = true) {
    const i = layers.findIndex(l => l.el === el);
    if (i < 0) return;
    const [entry] = layers.splice(i, 1);
    const top = layers.at(-1);
    if (top) top.el.inert = false;
    if (!layers.length) { $('#app').inert = false; document.body.style.overflow = ''; }
    if (!restore) return;
    if (entry.returnFocus && entry.returnFocus.isConnected && !entry.returnFocus.closest('[inert]')) entry.returnFocus.focus({ preventScroll: true });
    else if (top) { const f = $(FOCUSABLE, top.el) || top.el; f.focus({ preventScroll: true }); }
  }
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab' || !layers.length) return;
    const root = layers.at(-1).el;
    const f = $$(FOCUSABLE, root).filter(n => n.offsetParent !== null || n === document.activeElement);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
  });

  /* Modales */
  let mid = 0;
  function modal(o) {
    const id = 'm' + (++mid);
    const wrap = document.createElement('div');
    wrap.className = 'modal-layer';
    const tone = o.tone ? `<span class="modal-ico mi-${o.tone}">${icon(o.icon || 'info')}</span>` : '';
    wrap.innerHTML = `<div class="layer-backdrop" data-dismiss></div>
      <div class="modal ${o.size ? 'm-' + o.size : ''} ${o.cls || ''}" role="dialog" aria-modal="true" aria-labelledby="${id}-t" tabindex="-1">
        <header class="modal-head"><div class="modal-head-main">${tone}<h2 class="modal-title" id="${id}-t">${esc(o.title)}</h2></div>
          <button class="icon-btn" type="button" data-dismiss aria-label="Fermer">${icon('x')}</button></header>
        <div class="modal-body">${o.body || ''}</div>
        ${o.actions && o.actions.length ? `<footer class="modal-foot">${o.actions.map(a => `<button type="button" class="btn ${a.kind ? 'btn-' + a.kind : 'btn-secondary'}" data-act="${a.value}" ${a.disabled ? 'disabled' : ''}>${a.icon ? icon(a.icon) : ''}${esc(a.label)}</button>`).join('')}</footer>` : ''}
      </div>`;
    document.body.appendChild(wrap);
    let closed = false;
    const h = {
      el: wrap, body: $('.modal-body', wrap),
      close(result) {
        if (closed) return; closed = true;
        wrap.classList.add('is-leaving');
        popLayer(wrap, !o.noRestore);
        setTimeout(() => wrap.remove(), reduced() ? 0 : 180);
        if (o.onClose) o.onClose(result);
      },
      button: v => $(`[data-act="${v}"]`, wrap)
    };
    pushLayer(wrap, () => h.close(null));
    wrap.addEventListener('click', async e => {
      if (e.target.closest('[data-dismiss]')) return h.close(null);
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      const v = b.dataset.act;
      if (v === 'cancel') return h.close(null);
      if (o.onAction) { const r = await o.onAction(v, h, b); if (r === false) return; }
      h.close(v);
    });
    if (o.onOpen) o.onOpen(h);
    const target = (o.focus && $(o.focus, wrap)) || $('.modal-body ' + FOCUSABLE, wrap) || $('.modal-foot .btn-primary, .modal-foot .btn-navy', wrap) || $('.modal', wrap);
    requestAnimationFrame(() => target && target.focus());
    return h;
  }
  function confirmDialog(o) {
    return new Promise(resolve => {
      const check = o.check ? `<label class="check"><input type="checkbox" id="confirm-check"> <span>${o.check}</span></label>` : '';
      modal({
        title: o.title, tone: o.tone || 'green', icon: o.icon || 'check-circle', size: o.size,
        body: `<div>${o.message}</div>${check}`,
        actions: [{ label: o.cancel || 'Annuler', value: 'cancel' }, { label: o.confirm || 'Confirmer', value: 'ok', kind: o.danger ? 'danger' : 'primary', disabled: !!o.check }],
        focus: o.check ? '#confirm-check' : '.modal-foot [data-act="ok"]',
        onOpen: h => { const c = $('#confirm-check', h.el); if (c) c.addEventListener('change', () => { h.button('ok').disabled = !c.checked; }); },
        onClose: r => resolve(r === 'ok')
      });
    });
  }

  /* Panneau latéral */
  let drawer = null;
  function openDrawer(o) {
    if (drawer) { drawer.key = o.key; drawer.onClose = o.onClose; setDrawer(o.html); $('.drawer', drawer.el).scrollTop = 0; return drawer; }
    const wrap = document.createElement('div');
    wrap.className = 'layer';
    wrap.innerHTML = `<div class="layer-backdrop" data-dclose></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" tabindex="-1"></aside>`;
    document.body.appendChild(wrap);
    drawer = { el: wrap, key: o.key, onClose: o.onClose };
    setDrawer(o.html);
    pushLayer(wrap, () => closeDrawer());
    wrap.addEventListener('click', e => { if (e.target.closest('[data-dclose]')) closeDrawer(); });
    requestAnimationFrame(() => { const t = $('.drawer [data-dclose].icon-btn', wrap) || $('.drawer', wrap); t.focus(); });
    return drawer;
  }
  function setDrawer(html) { const a = $('.drawer', drawer.el); const top = a.scrollTop; a.innerHTML = html; a.scrollTop = top; }
  function closeDrawer(silent) {
    if (!drawer) return;
    const d = drawer; drawer = null;
    d.el.classList.add('is-leaving');
    popLayer(d.el, !silent);
    setTimeout(() => d.el.remove(), reduced() ? 0 : 260);
    if (d.onClose && !silent) d.onClose();
  }

  /* Menus déroulants */
  let openDD = null;
  const ddRenderers = {};
  function openDropdown(btn, viaKeyboard) {
    closeDropdown();
    const menu = document.getElementById(btn.dataset.dd);
    if (!menu) return;
    if (ddRenderers[menu.id]) ddRenderers[menu.id](menu);
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    openDD = { btn, menu };
    if (viaKeyboard) { const f = $(FOCUSABLE, menu); if (f) f.focus(); }
  }
  function closeDropdown(focusBtn) {
    if (!openDD) return;
    const { btn, menu } = openDD; openDD = null;
    btn.setAttribute('aria-expanded', 'false');
    menu.classList.add('is-leaving');
    setTimeout(() => { menu.hidden = true; menu.classList.remove('is-leaving'); }, reduced() ? 0 : 120);
    if (focusBtn) btn.focus();
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-dd]');
    if (b) { e.preventDefault(); if (openDD && openDD.btn === b) closeDropdown(); else openDropdown(b, e.detail === 0); return; }
    if (openDD) {
      if (!openDD.menu.contains(e.target)) closeDropdown();
      else if (e.target.closest('a, .menu-item, [data-close-dd]')) setTimeout(() => closeDropdown(), 0);
    }
  });
  document.addEventListener('keydown', e => {
    if (!openDD) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const items = $$(FOCUSABLE, openDD.menu);
      if (!items.length) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement);
      const n = e.key === 'ArrowDown' ? (i + 1) % items.length : (i <= 0 ? items.length - 1 : i - 1);
      items[n].focus();
    }
    if (e.key === 'Tab' && !openDD.menu.contains(document.activeElement) && document.activeElement !== openDD.btn) closeDropdown();
  });
  document.addEventListener('focusin', e => { if (openDD && !openDD.menu.contains(e.target) && e.target !== openDD.btn) closeDropdown(); });

  /* Échap : menu ouvert > couche du dessus */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    hideTip();
    if (openDD) { e.preventDefault(); closeDropdown(true); return; }
    const top = layers.at(-1);
    if (top && top.onEscape) { e.preventDefault(); top.onEscape(); }
  });

  /* Infobulles : tout élément portant data-tip */
  const tipEl = () => $('#tip');
  let tipFor = null;
  function showTip(t) {
    const tip = tipEl();
    tipFor = t;
    tip.innerHTML = t.dataset.tip;
    tip.hidden = false;
    const r = t.getBoundingClientRect(), tr = tip.getBoundingClientRect();
    let x = r.left + r.width / 2 - tr.width / 2, y = r.top - tr.height - 8;
    if (y < 8) y = r.bottom + 8;
    x = Math.max(8, Math.min(x, innerWidth - tr.width - 8));
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { tipFor = null; const t = tipEl(); if (t) t.hidden = true; }
  document.addEventListener('pointerover', e => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t && t !== tipFor) showTip(t); else if (!t && tipFor) hideTip(); });
  document.addEventListener('focusin', e => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t) showTip(t); else hideTip(); });
  window.addEventListener('scroll', hideTip, { passive: true });

  /* Compteurs animés */
  function countUp(el, to) {
    const from = parseInt(el.dataset.v ?? el.textContent, 10) || 0;
    el.dataset.v = to;
    if (reduced() || from === to) { el.textContent = to; return; }
    const t0 = performance.now(), dur = 650;
    const tick = t => { const p = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(from + (to - from) * e); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }

  /* Apparition au défilement */
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -40px 0px' }) : null;
  function reveal(root) { $$('.reveal:not(.is-in)', root).forEach(n => { if (io && !reduced()) io.observe(n); else n.classList.add('is-in'); }); }

  /* Onglets avec indicateur glissant */
  function tabs(root, onChange) {
    const list = $('[role=tablist]', root);
    const ink = $('.tab-ink', list);
    const btns = $$('[role=tab]', list);
    const place = b => { if (ink) { ink.style.width = b.offsetWidth + 'px'; ink.style.transform = `translateX(${b.offsetLeft - 4}px)`; } };
    const sel = (b, focus) => {
      btns.forEach(x => { const on = x === b; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; });
      place(b); if (focus) b.focus();
      onChange && onChange(b.dataset.tab);
    };
    btns.forEach(b => {
      b.addEventListener('click', () => sel(b));
      b.addEventListener('keydown', e => {
        const i = btns.indexOf(b);
        if (e.key === 'ArrowRight') { e.preventDefault(); sel(btns[(i + 1) % btns.length], true); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); sel(btns[(i - 1 + btns.length) % btns.length], true); }
      });
    });
    const cur = btns.find(b => b.getAttribute('aria-selected') === 'true') || btns[0];
    requestAnimationFrame(() => place(cur));
    new ResizeObserver(() => place(btns.find(b => b.getAttribute('aria-selected') === 'true'))).observe(list);
  }

  /* ---------- Coquille ---------- */
  const NAV = [
    { view: 'apercu', label: 'Vue d’ensemble', icon: 'grid' },
    { view: 'dossiers', label: 'Dossiers', icon: 'folder', menu: [
      { label: 'Tous les dossiers', href: '#/dossiers?status=all', icon: 'list' },
      { label: 'À traiter', href: '#/dossiers?status=recu', icon: 'inbox', can: 'instruct' },
      { label: 'Compléments attendus', href: '#/dossiers?status=complement', icon: 'alert-triangle' },
      { label: 'Nouveau dossier', href: '#/nouveau', icon: 'plus', can: 'create' }] },
    { view: 'courriers', label: 'Courriers', icon: 'mail' },
    { view: 'ceremonies', label: 'Cérémonies', icon: 'calendar', menu: [
      { label: 'Calendrier', href: '#/ceremonies', icon: 'calendar' },
      { label: 'Proposer un lieu et une date', href: '#/ceremonies/proposer', icon: 'pin', can: 'propose' }] },
    { view: 'statistiques', label: 'Statistiques', icon: 'chart' },
    { view: 'notifications', label: 'Notifications', icon: 'bell', count: true }
  ];
  const navFor = v => (v === 'nouveau' ? 'dossiers' : v);
  const unread = () => myNotifs().filter(n => !n.read).length;

  function renderNav() {
    const views = role().views;
    const active = navFor(current.view);
    const n = unread();
    $('#nav-list').innerHTML = NAV.filter(it => views.includes(it.view)).map(it => {
      const cur = it.view === active ? 'aria-current="page"' : '';
      const cnt = it.count ? `<span class="nav-count ${n ? '' : 'is-zero'}" data-nav-count>${n}</span>` : '';
      const menu = (it.menu || []).filter(m => !m.can || can(m.can));
      return `<li class="nav-item">
        <a class="nav-link" href="#/${it.view}" ${cur}>${icon(it.icon)}${it.label}${cnt}</a>
        ${menu.length > 1 ? `<button class="nav-caret" type="button" data-dd="nav-${it.view}" aria-expanded="false" aria-controls="nav-${it.view}" aria-label="Autres accès : ${esc(it.label)}">${icon('chevron-down')}</button>
          <div class="dd-menu" id="nav-${it.view}" hidden>${menu.map(m => `<a class="menu-item" href="${m.href}">${icon(m.icon)}${esc(m.label)}</a>`).join('')}</div>` : ''}
      </li>`;
    }).join('');
    $('#mobile-nav-list').innerHTML = NAV.filter(it => views.includes(it.view)).map(it => {
      const menu = (it.menu || []).filter(m => !m.can || can(m.can)).slice(1);
      return `<a href="#/${it.view}" ${it.view === active ? 'aria-current="page"' : ''}>${icon(it.icon)}${it.label}${it.count ? `<span class="nav-count ${n ? '' : 'is-zero'}">${n}</span>` : ''}</a>
        ${menu.length ? `<div class="mobile-nav-sub">${menu.map(m => `<a href="${m.href}">${esc(m.label)}</a>`).join('')}</div>` : ''}`;
    }).join('') + `<div class="menu-sep"></div><a href="#/profil" ${current.view === 'profil' ? 'aria-current="page"' : ''}>${icon('user')}Mon profil</a>`;
  }

  function renderAccount() {
    const u = user();
    $('#acc-initials').textContent = u.initials;
    $('#acc-name').textContent = u.name;
    $('#acc-role').textContent = role().scope ? org(role().scope).name : u.title;
    $('#account-btn').setAttribute('aria-label', `Compte : ${u.name}, ${role().label}`);
    $('#account-menu').innerHTML = `
      <div class="menu-head"><span class="avatar">${esc(u.initials)}</span><div><strong>${esc(u.name)}</strong><span>${esc(u.title)} · ${esc(u.unit)}</span></div></div>
      <div class="menu-sep"></div>
      <a class="menu-item" role="menuitem" href="#/profil">${icon('user')}Mon profil et préférences</a>
      <div class="menu-sep"></div>
      <div class="menu-label">Profil de travail</div>
      ${Object.entries(D.roles).map(([k, r]) => `<button class="menu-item" type="button" role="menuitemradio" aria-checked="${k === S.role}" data-role="${k}">${icon(k === S.role ? 'check' : 'swap')}${esc(r.label)}</button>`).join('')}
      <div class="menu-sep"></div>
      <button class="menu-item" type="button" role="menuitem" data-action="reset">${icon('refresh')}Réinitialiser les données du poste</button>
      <button class="menu-item" type="button" role="menuitem" data-action="logout">${icon('logout')}Se déconnecter</button>`;
  }

  ddRenderers['notif-menu'] = menu => {
    const list = myNotifs().slice().sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 5);
    const n = unread();
    menu.innerHTML = `<div class="dd-notif-head"><h2>Notifications</h2><span class="muted" style="font-size:12px">${n ? plural(n, 'non lue', 'non lues') : 'Tout est lu'}</span></div>
      <div class="dd-notif-list">${list.map(x => `<button type="button" class="dd-notif-item ${x.read ? '' : 'is-unread'}" data-notif-open="${x.id}">
        <span class="notif-ico ni-${x.type}" style="width:30px;height:30px;border-radius:8px">${icon(NOTIF_ICON[x.type] || 'bell', 'ic-sm')}</span>
        <span><strong>${esc(x.title)}</strong><span>${esc(x.ref || '')} · ${esc(relDay(x.date))} à ${esc(x.time)}</span></span></button>`).join('') || empty('bell', 'Aucune notification', 'Les nouvelles notifications s’afficheront ici.')}</div>
      <div class="dd-notif-foot"><a class="btn btn-secondary btn-sm btn-block" href="#/notifications">Voir toutes les notifications</a></div>`;
  };
  const NOTIF_ICON = { depot: 'inbox', visa: 'stamp', conflit: 'alert-triangle', complement: 'paperclip', ceremonie: 'medal', transmission: 'send', decision: 'check-circle' };
  GO.NOTIF_ICON = NOTIF_ICON;

  let lastCount = null;
  function renderCounts() {
    const n = unread();
    const b = $('#bell-count');
    b.hidden = n === 0;
    b.textContent = n > 9 ? '9+' : n;
    if (lastCount !== null && n !== lastCount && !b.hidden) { b.classList.remove('is-bump'); void b.offsetWidth; b.classList.add('is-bump'); }
    lastCount = n;
    $('#bell-btn').setAttribute('aria-label', n ? `Notifications, ${n} non lues` : 'Notifications, aucune non lue');
    $$('[data-nav-count], .mobile-nav-list .nav-count').forEach(el => { el.textContent = n; el.classList.toggle('is-zero', !n); });
  }

  // Ouverture d'une notification depuis le menu : marque comme lue et ouvre la cible.
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-notif-open]');
    if (!b) return;
    const n = S.notifications.find(x => x.id === b.dataset.notifOpen);
    if (!n) return;
    n.read = true; commit();
    closeDropdown();
    location.hash = n.doc && role().views.includes('courriers') && getDoc(n.doc) ? '#/courriers/' + n.doc : '#/dossiers/' + n.ref;
  });

  // Actions du menu compte
  document.addEventListener('click', async e => {
    const r = e.target.closest('[data-role]');
    if (r) {
      S.role = r.dataset.role; save();
      closeDrawer(true);
      renderShell();
      toast('info', 'Profil de travail modifié', esc(role().label));
      forceRoute('#/apercu');
      return;
    }
    const a = e.target.closest('[data-action]');
    if (!a) return;
    if (a.dataset.action === 'reset') {
      const ok = await confirmDialog({ title: 'Réinitialiser les données du poste ?', tone: 'yellow', icon: 'refresh', confirm: 'Réinitialiser', danger: true,
        message: '<p>Les dossiers créés, visas, décisions, propositions et lectures de notifications enregistrés sur ce poste seront effacés. Les données de référence seront restaurées.</p>' });
      if (ok) { const r0 = S.role; resetState(); S.role = r0; save(); renderShell(); forceRoute(location.hash || '#/apercu'); toast('success', 'Données restaurées', 'Le poste utilise de nouveau les données de référence.'); }
    }
    if (a.dataset.action === 'logout') {
      const ok = await confirmDialog({ title: 'Se déconnecter ?', tone: 'blue', icon: 'logout', confirm: 'Se déconnecter', message: '<p>Votre session sera fermée sur ce poste.</p>' });
      if (ok) { $('#logged-out').hidden = false; $('#app').inert = true; $('#relogin').focus(); }
    }
  });

  /* Recherche globale */
  function searchIndex() {
    const out = [];
    myDossiers().forEach(d => { const o = org(d.org); out.push({ g: 'Dossiers', ic: 'folder', t: d.ref, s: `${o.name} · ${D.statuses[d.status].label}`, k: `${d.ref} ${o.name} ${o.short} ${o.city}`, href: '#/dossiers/' + d.ref }); });
    if (role().views.includes('courriers')) myDocs().forEach(x => out.push({ g: 'Courriers et documents', ic: 'file', t: x.title, s: `${x.dossier} · ${D.docTypes[x.type]} · ${fmtDate(x.date, 'short')}`, k: `${x.title} ${x.dossier} ${x.from} ${x.number || ''}`, href: '#/courriers/' + x.id }));
    myCers().forEach(c => { const v = venue(c.venue); const o = org(getDossier(c.dossier).org); out.push({ g: 'Cérémonies', ic: 'calendar', t: `${c.id} · ${o.short}`, s: `${fmtDate(c.date)} · ${v.name} · ${D.ceremonyStates[c.state].label}`, k: `${c.id} ${c.dossier} ${v.name} ${v.city} ${o.name}`, href: '#/ceremonies/' + c.id }); });
    return out;
  }
  function highlight(text, q) {
    if (!q) return esc(text);
    const i = norm(text).indexOf(norm(q));
    if (i < 0) return esc(text);
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  }
  function openSearch() {
    closeDropdown();
    const idx = searchIndex();
    const h = modal({
      title: 'Recherche', cls: 'palette', size: 'lg', noRestore: false,
      body: `<div class="palette-input">${icon('search')}<input type="text" role="combobox" aria-expanded="true" aria-controls="pal-res" aria-autocomplete="list" aria-label="Rechercher un dossier, un courrier, une cérémonie" placeholder="Référence, organisme, courrier, lieu…" id="pal-q" autocomplete="off"></div>
        <div class="palette-results" id="pal-res" role="listbox" aria-label="Résultats"></div>
        <div class="palette-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> parcourir</span><span><kbd>Entrée</kbd> ouvrir</span><span><kbd>Échap</kbd> fermer</span></div>`,
      focus: '#pal-q'
    });
    const body = h.body; body.style.padding = '0'; body.style.gap = '0';
    const q = $('#pal-q', h.el), res = $('#pal-res', h.el);
    let items = [], sel = 0;
    const draw = () => {
      const v = q.value.trim();
      const nv = norm(v);
      items = v ? idx.filter(x => nv.split(/\s+/).every(t => norm(x.k + ' ' + x.t).includes(t))).slice(0, 12)
                : myDossiers().slice().sort((a, b) => { const la = lastActivity(a), lb = lastActivity(b); return (lb.date + lb.time).localeCompare(la.date + la.time); }).slice(0, 5).map(d => idx.find(x => x.href === '#/dossiers/' + d.ref));
      sel = 0;
      if (!items.length) { res.innerHTML = empty('search', 'Aucun résultat', `Aucun dossier, courrier ou cérémonie ne correspond à « ${esc(v)} ».`); return; }
      let g = '';
      res.innerHTML = (v ? '' : '<div class="palette-group">Activité récente</div>') + items.map((x, i) => {
        const head = v && x.g !== g ? `<div class="palette-group">${x.g}</div>` : ''; g = x.g;
        return `${head}<button type="button" class="palette-item" role="option" id="pal-${i}" aria-selected="${i === sel}" data-i="${i}"><span class="p-ico">${icon(x.ic)}</span><span><strong>${highlight(x.t, v)}</strong><span>${highlight(x.s, v)}</span></span>${icon('chevron-right', 'ic-sm')}</button>`;
      }).join('');
      q.setAttribute('aria-activedescendant', 'pal-0');
    };
    const move = d => {
      if (!items.length) return;
      sel = (sel + d + items.length) % items.length;
      $$('.palette-item', res).forEach((b, i) => b.setAttribute('aria-selected', i === sel));
      const cur = $('#pal-' + sel, res); cur.scrollIntoView({ block: 'nearest' });
      q.setAttribute('aria-activedescendant', 'pal-' + sel);
    };
    const go = i => { const x = items[i]; if (!x) return; h.close('go'); location.hash = x.href; };
    q.addEventListener('input', draw);
    q.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      if (e.key === 'Enter') { e.preventDefault(); go(sel); }
    });
    res.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) go(+b.dataset.i); });
    draw();
  }

  function openShortcuts() {
    modal({ title: 'Raccourcis clavier', tone: 'blue', icon: 'keyboard', actions: [{ label: 'Fermer', value: 'cancel', kind: 'navy' }],
      body: `<div class="modal-summary"><div><dt>Recherche globale</dt><dd><kbd>Ctrl</kbd> <kbd>K</kbd> ou <kbd>/</kbd></dd></div>
        <div><dt>Fermer un menu, un panneau ou une fenêtre</dt><dd><kbd>Échap</kbd></dd></div>
        <div><dt>Parcourir les jours du calendrier</dt><dd><kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd></dd></div>
        <div><dt>Mois précédent / suivant</dt><dd><kbd>Page ↑</kbd> <kbd>Page ↓</kbd></dd></div>
        <div><dt>Changer d’onglet</dt><dd><kbd>←</kbd> <kbd>→</kbd></dd></div>
        <div><dt>Cette aide</dt><dd><kbd>?</kbd></dd></div></div>` });
  }

  document.addEventListener('keydown', e => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (!layers.length) openSearch(); }
    else if (!typing && !layers.length && e.key === '/') { e.preventDefault(); openSearch(); }
    else if (!typing && !layers.length && e.key === '?') { e.preventDefault(); openShortcuts(); }
  });

  /* Navigation mobile */
  function openMobileNav() {
    const m = $('#mobile-nav');
    m.hidden = false;
    $('#nav-toggle').setAttribute('aria-expanded', 'true');
    pushLayer(m, closeMobileNav);
    requestAnimationFrame(() => { const a = $('a[aria-current]', m) || $('a', m); a && a.focus(); });
  }
  function closeMobileNav() {
    const m = $('#mobile-nav');
    if (m.hidden) return;
    m.hidden = true;
    $('#nav-toggle').setAttribute('aria-expanded', 'false');
    popLayer(m);
  }

  /* Défilement : barre tricolore, en-tête, retour en haut */
  function onScroll() {
    const h = document.documentElement;
    const max = h.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    $('#progress-fill').style.width = (p * 100).toFixed(2) + '%';
    $('#site-header').classList.toggle('is-scrolled', scrollY > 4);
    const t = $('#to-top');
    const show = scrollY > Math.max(480, innerHeight * 0.8);
    if (show && t.hidden) { t.hidden = false; requestAnimationFrame(() => t.classList.add('is-visible')); }
    if (!show && !t.hidden && t.classList.contains('is-visible')) { t.classList.remove('is-visible'); setTimeout(() => { if (!t.classList.contains('is-visible')) t.hidden = true; }, 240); }
    t.style.setProperty('--rot', (p * 360).toFixed(0) + 'deg');
  }
  let ticking = false;
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { onScroll(); ticking = false; }); } }, { passive: true });
  window.addEventListener('resize', debounce(onScroll, 100));

  function renderShell() {
    renderAccount(); renderNav(); renderCounts();
    document.documentElement.classList.toggle('reduce-motion', !!S.prefs.reduceMotion);
    document.body.classList.toggle('compact', !!S.prefs.compact);
  }

  /* ---------- Routeur ---------- */
  let current = { view: null };
  let routeTok = 0, firstRoute = true;
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '') || 'apercu';
    const [path, q = ''] = h.split('?');
    const parts = path.split('/').map(decodeURIComponent);
    return { view: parts[0] || 'apercu', id: parts[1] || null, params: new URLSearchParams(q), raw: h };
  }
  function allowed(v) { return role().views.includes(v) || (v === 'nouveau' && can('create')) || v === 'profil'; }
  function route(force) {
    const r = parseHash();
    if (!GO.views[r.view]) { location.replace('#/apercu'); return; }
    closeMobileNav();
    closeDropdown();
    if (!force && current.view === r.view && GO.views[r.view].update) {
      current = r; renderNav();
      GO.views[r.view].update(r);
      return;
    }
    closeDrawer(true);
    // Fermer d'éventuelles modales restées ouvertes
    $$('.modal-layer').forEach(m => { popLayer(m, false); m.remove(); });
    current = r;
    renderNav();
    const main = $('#view');
    const tok = ++routeTok;
    main.setAttribute('aria-busy', 'true');
    main.classList.remove('view-enter');
    main.innerHTML = skeleton();
    if (!firstRoute) window.scrollTo({ top: 0, behavior: 'auto' });
    setTimeout(() => {
      if (tok !== routeTok) return;
      main.innerHTML = '';
      if (!allowed(r.view)) {
        main.innerHTML = `<div class="card mt">${empty('shield', 'Accès non autorisé pour ce profil', `La page demandée n’est pas disponible pour le profil « ${esc(role().label)} ».`, '<a class="btn btn-secondary" href="#/apercu">Revenir à la vue d’ensemble</a>')}</div>`;
      } else {
        GO.views[r.view].render(main, r);
      }
      main.removeAttribute('aria-busy');
      void main.offsetWidth;
      main.classList.add('view-enter');
      reveal(main);
      const h1 = $('h1', main);
      document.title = (h1 ? h1.textContent.trim() + ' · ' : '') + 'GAB-ORIENT';
      if (!firstRoute && h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
      firstRoute = false;
      onScroll();
    }, firstRoute ? 120 : (reduced() ? 30 : 240));
  }
  function forceRoute(hash) { if (location.hash === hash) route(true); else { current.view = null; location.hash = hash; } }
  // Remplace le fragment sans déclencher de rechargement de vue
  function setHash(hash) { history.replaceState(null, '', hash); current = parseHash(); }

  function boot() {
    S = load(); GO.S = S;
    // Organismes créés depuis le formulaire et persistés sur le poste
    (S.orgs || []).forEach(o => { if (!D.organisations.find(x => x.id === o.id)) D.organisations.push(o); });
    renderShell();
    $('#footer-version').textContent = 'Version ' + D.config.dataVersion;
    $('#search-trigger').addEventListener('click', openSearch);
    $('#shortcuts-btn').addEventListener('click', openShortcuts);
    $('#nav-toggle').addEventListener('click', openMobileNav);
    $('#mobile-nav').addEventListener('click', e => { if (e.target.closest('[data-close-nav]')) closeMobileNav(); else if (e.target.closest('a')) closeMobileNav(); });
    $('#to-top').addEventListener('click', () => { window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); $('#view').focus({ preventScroll: true }); });
    $('#relogin').addEventListener('click', () => { $('#logged-out').hidden = true; $('#app').inert = false; toast('success', 'Session ouverte', esc(user().name)); $('#account-btn').focus(); });
    window.addEventListener('hashchange', () => route());
    if (!location.hash) history.replaceState(null, '', '#/apercu');
    route();
  }

  Object.assign(GO, {
    $, $$, esc, icon, pad, parseISO, iso, REF, REF_ISO, MONTHS, MONTHS_S, DAYS, fmtDate, daysBetween, ageDays, relDay, plural, norm, debounce, reduced, wait, stamp, seniority,
    save, commit, role, can, user, org, venue, medal, getDossier, getDoc, getCer, myDossiers, myDocs, myNotifs, myCers, sortHist, lastActivity, docsOf, cersOf, activeCer, closure,
    addHistory, notify, stepInfo, actorName,
    badge, statusBadge, cerBadge, docBadge, refChip, stepMini, stepper, empty, toast, modal, confirmDialog, openDrawer, setDrawer, closeDrawer, isDrawerOpen: () => !!drawer, drawerKey: () => drawer && drawer.key,
    countUp, reveal, tabs, renderCounts, renderNav, renderShell, setHash, forceRoute, current: () => current, boot, openSearch
  });
  return GO;
})();
