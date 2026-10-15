/* ==========================================================================
   GAB-ORIENT — Noyau de l'application
   - utilitaires (dates, formats, échappement)
   - état local (données de référence + modifications persistées sur le poste)
   - profils de travail : portées de visibilité, permissions, navigation
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
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
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

  const role = () => D.roles[S.role] || D.roles.chef;
  const can = k => !!role().can[k];
  const family = () => role().family;
  const isFamily = (...f) => f.includes(role().family);

  function user() {
    const r = role(), u = D.users[r.user] || {};
    if (r.scope && r.scope.kind === 'person' && S.person) {
      const p = S.person, o = D.organisations.find(x => x.id === p.org);
      return Object.assign({}, u, {
        name: `${p.prenom} ${p.nom}`, initials: `${p.prenom[0]}${p.nom[0]}`.toUpperCase(),
        title: p.fonction, unit: o ? o.name : u.unit, email: u.email
      });
    }
    return u;
  }
  const org = id => D.organisations.find(o => o.id === id);
  const venue = id => D.venues.find(v => v.id === id);
  // Un intitulé lisible pour tout article de stock (médailles et diplômes).
  const medal = id => D.medals.find(m => m.id === id) || (() => {
    const it = (D.seed.stock || []).find(s => s.item === id);
    return it ? { id, label: it.label, short: it.label.replace(/^Médaille /, ''), minYears: 0, maxYears: null } : { id, label: String(id), short: String(id), minYears: 0, maxYears: null };
  })();
  const authority = id => D.authorities.find(a => a.id === id);
  const scopeAuthority = () => (role().scope && role().scope.kind === 'authority') ? authority(role().scope.value) : null;
  const getDossier = ref => S.dossiers.find(d => d.ref === ref);
  const getDoc = id => S.documents.find(d => d.id === id);
  const getCer = id => S.ceremonies.find(c => c.id === id);

  // Visibilité : organisme demandeur, personne bénéficiaire ou autorité destinataire.
  function scopeMatch(d) {
    const s = role().scope;
    if (!s) return true;
    if (s.kind === 'org') return d.org === s.value;
    if (s.kind === 'person') { const ids = Array.isArray(s.value) ? s.value : [s.value]; return d.recipients.some(r => ids.includes(r.id)); }
    if (s.kind === 'authority') return d.authority === s.value;
    return true;
  }
  const external = () => isFamily('demandeur', 'recipiendaire');
  const myDossiers = () => S.dossiers.filter(scopeMatch);
  const myDocs = () => S.documents.filter(doc => { const d = getDossier(doc.dossier); return d && scopeMatch(d) && !(external() && doc.internal); });
  const myCers = () => S.ceremonies.filter(c => { const d = getDossier(c.dossier); return d && scopeMatch(d); });
  const myDts = () => S.dts.filter(x => { const d = getDossier(x.dossier); return d && scopeMatch(d); });
  const sortHist = h => h.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const lastActivity = d => sortHist(d.history).at(-1);
  const docsOf = ref => S.documents.filter(x => x.dossier === ref);
  const cersOf = ref => S.ceremonies.filter(c => c.dossier === ref).sort((a, b) => b.date.localeCompare(a.date));
  const activeCer = ref => S.ceremonies.find(c => c.dossier === ref && ['propose', 'negociation', 'confirme'].includes(c.state));
  const closure = date => D.closures.find(c => c.date === date);

  /* ---------- Objets métier (registre, recettes, stock, contrôle…) ---------- */
  const receiptOrder = ref => S.receiptOrders.find(o => o.dossier === ref);
  const myReceiptOrders = () => S.receiptOrders.filter(o => { const d = getDossier(o.dossier); return d && scopeMatch(d); });
  const receiptOf = ref => { const o = receiptOrder(ref); return o && o.receipts && o.receipts.length ? o.receipts[o.receipts.length - 1] : null; };
  const remiseOf = ref => S.remises.find(r => r.dossier === ref);
  const myRemises = () => S.remises.filter(r => { const d = getDossier(r.dossier); return d && scopeMatch(d); });
  const withdrawalOf = ref => S.withdrawals.find(w => w.dossier === ref);
  const myWithdrawals = () => S.withdrawals.filter(w => { const d = getDossier(w.dossier); return d && scopeMatch(d); });
  const controlOf = ref => S.controls.find(c => c.dossier === ref);
  const myControls = () => S.controls.filter(c => { const d = getDossier(c.dossier); return d && scopeMatch(d); });
  const recoursOf = ref => S.recours.find(r => r.dossier === ref);
  const myRecours = () => S.recours.filter(r => { const d = getDossier(r.dossier); return d && scopeMatch(d); });
  const complementOf = ref => S.complements.find(c => c.dossier === ref);
  const myComplements = () => S.complements.filter(c => { const d = getDossier(c.dossier); return d && scopeMatch(d); });
  const myRelances = () => S.relances.filter(r => { const d = getDossier(r.dossier); return d && scopeMatch(d); });
  const stockOf = item => S.stock.find(s => s.item === item);
  const stockTotal = () => S.stock.filter(s => s.item !== 'diplome').reduce((a, s) => a + s.available, 0);
  const distinctOf = personId => S.distinctions.filter(x => x.person === personId);
  // Registre des courriers : un secrétariat ou une autorité ne voit que son registre,
  // le demandeur et le bénéficiaire ne voient que les courriers de leurs dossiers.
  const myTransmissions = () => {
    const s = role().scope;
    if (s && s.kind === 'authority') return S.transmissions.filter(t => t.authority === s.value);
    if (external()) return S.transmissions.filter(t => {
      const doc = t.file && getDoc(t.file);
      const d = getDossier(t.dossier);
      return d && scopeMatch(d) && !(doc && doc.internal) && t.channel !== 'Navette interne';
    });
    return S.transmissions;
  };
  // Journal technique : scoped pour l'administrateur et les profils internes.
  const myAudit = () => {
    if (isFamily('administration')) return S.audit;
    if (isFamily('service', 'inspection')) return S.audit.filter(a => !role().scope ? true : true);
    const mine = new Set(myDossiers().map(d => d.ref));
    return S.audit.filter(a => !a.ref || mine.has(a.ref));
  };

  function actorName() {
    const r = role();
    if (r.scope && r.scope.kind === 'authority') return 'Secrétariat — ' + authority(r.scope.value).short;
    switch (r.family) {
      case 'service': return r.user === 'u1' ? 'Chef du Service' : 'Service des Distinctions';
      case 'inspection': return 'Inspection du travail';
      case 'regie': return 'Régie des médailles';
      case 'administration': return 'Administration GAB-ORIENT';
      case 'autorite': return authority(r.scope.value).label;
      case 'demandeur': return org(r.scope.value).name;
      case 'recipiendaire': return `${user().name} (bénéficiaire)`;
      default: return user().name;
    }
  }
  function addHistory(d, kind, label, actor, opts) {
    const entry = Object.assign(stamp(), { kind, label, actor: actor || actorName(), isNew: true });
    d.history.push(entry);
    audit(runActor(), label, (opts && opts.detail) || d.ref, opts && opts.level);
    return entry;
  }
  function runActor() { return `${user().name} (${role().label})`; }
  function notify(n) {
    S.notifications.unshift(Object.assign({ id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), read: false }, stamp(), n));
  }
  function audit(actor, action, detail, level) {
    S.audit = S.audit || [];
    S.audit.unshift({ id: 'LOG-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), date: REF_ISO, time: stamp().time, actor, role: role().label, action, detail: detail || '', level: level || 'info' });
    if (S.audit.length > 400) S.audit.length = 400;
  }
  function moveStock(o) {
    // field : 'available' (stock physique) ou 'reserved' (réservation réversible)
    const item = stockOf(o.item); if (!item) return null;
    item[o.field] += o.qty;
    const mv = Object.assign({ id: 'MV-2026-' + String(1000 + S.stockMovements.length + 1).slice(-4), date: REF_ISO, author: actorName() }, o);
    S.stockMovements.unshift(mv);
    audit(runActor(), 'Mouvement de stock', `${mv.id} · ${o.item} ${o.qty > 0 ? '+' : ''}${o.qty} (${o.field === 'reserved' ? 'réservation' : 'stock'})`, 'info');
    return mv;
  }
  function addTransmission(o) {
    const t = Object.assign({ id: 'TR-2026-' + String(149 + S.transmissions.length - 34 + 1).padStart(4, '0'), date: REF_ISO, time: stamp().time, authority: null }, o);
    S.transmissions.unshift(t);
    return t;
  }
  function nextRef(prefix, list, start) {
    const nums = list.map(x => +String(x.id).replace(/\D/g, '').slice(-4)).filter(n => !isNaN(n));
    const base = String(prefix).replace(/-+$/, '');
    const n = Math.max(start - 1, ...nums) + 1;
    return `${base}-${String(n).padStart(4, '0')}`;
  }
  function nextDocNumber() {
    const nums = S.documents.map(x => /N° (\d+)\/SDN/.exec(x.number || '')).filter(Boolean).map(m => +m[1]);
    return `N° ${Math.max(130, ...nums) + 1}/SDN`;
  }
  // Ajoute une ligne au registre tenu par le secrétariat de l'autorité destinataire.
  function registryAdd(doc, dossier) {
    const d = dossier || (doc && getDossier(doc.dossier));
    if (!d) return null;
    const row = doc ? D.registryDoc(doc) : D.registryDossier(d);
    if (!row) return null;
    const n = Math.max(149, ...S.transmissions.map(t => +String(t.id).slice(-4)) ) + 1;
    const t = Object.assign({ id: 'TR-2026-' + String(n).padStart(4, '0'), time: stamp().time }, row);
    S.transmissions.unshift(t);
    return t;
  }
  function newDoc(o) {
    const doc = Object.assign({ id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), pages: 1 }, o);
    S.documents.push(doc);
    registryAdd(doc);
    return doc;
  }
  async function withLoading(btn, ms) {
    if (!btn) { await wait(ms || 400); return; }
    btn.classList.add('is-loading');
    const html = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span>${btn.textContent.trim()}`;
    await wait(ms || 400);
    btn.innerHTML = html;
    btn.classList.remove('is-loading');
  }
  function fieldError(field, msg) {
    if (!field) return;
    $$('.error-msg', field).forEach(n => n.remove());
    field.classList.toggle('has-error', !!msg);
    const ctl = $('input,textarea,select', field);
    if (msg) {
      const id = 'e' + Math.random().toString(36).slice(2, 7);
      field.insertAdjacentHTML('beforeend', `<p class="error-msg" id="${id}">${icon('alert-circle')}${esc(msg)}</p>`);
      if (ctl) { ctl.setAttribute('aria-invalid', 'true'); ctl.setAttribute('aria-describedby', id); }
    } else if (ctl) { ctl.removeAttribute('aria-invalid'); ctl.removeAttribute('aria-describedby'); }
  }
  // Prévient la vue courante qu'un dossier a changé (liste, panneau, en-tête).
  const hooks = {};
  function refreshDossier(d, flash = true) { if (hooks.dossierChanged) hooks.dossierChanged(d, flash); }
  function commit() { save(); renderCounts(); }

  // Position dans le circuit : 0 Dépôt … 5 Remise (6 = terminé)
  function stepInfo(d) {
    const map = { recu: 1, en_cours: 2, complement: 2, transmis: 3, refuse: 4, approuve: 5 };
    let cur = map[d.status];
    if (d.status === 'approuve') { const c = cersOf(d.ref)[0]; if (c && c.state === 'termine') cur = 6; }
    return { cur, wait: d.status === 'complement', stop: d.status === 'refuse' };
  }

  // Ancienneté et échelon : repères de la maquette fonctionnelle
  // (Bronze 10-19 ans, Argent 20-29 ans, Or 30 ans et plus).
  function eligibility(r) {
    const years = seniority(r.entree);
    const declared = medal(r.medal) || D.medals[0];
    const expected = medal(D.medalForYears(years || 0));
    const ok = years !== null && years >= declared.minYears && (declared.maxYears === null || years <= declared.maxYears);
    return { years, declared, expected, ok, gap: ok ? 0 : Math.max(0, declared.minYears - (years || 0)), above: !!(declared.maxYears !== null && years !== null && years > declared.maxYears) };
  }

  /* ---------- Composants ---------- */
  const badge = (label, tone, extra = '') => `<span class="badge tone-${tone} ${extra}">${esc(label)}</span>`;
  const statusBadge = (s, short) => badge(D.statuses[s].short && short ? D.statuses[s].short : D.statuses[s].label, D.statuses[s].tone);
  const cerBadge = s => badge(D.ceremonyStates[s].label, D.ceremonyStates[s].tone);
  const docBadge = s => badge(D.docStates[s].label, D.docStates[s].tone);
  const dictBadge = (dict, key) => (dict && dict[key]) ? badge(dict[key].label, dict[key].tone) : badge(String(key || '—'), 'slate');
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

  /* ---------- Boîte à outils des vues (mêmes conventions graphiques) ---------- */
  const ui = {
    head(o) {
      return `<section class="page-head reveal">
        <div>${o.eyebrow ? `<div class="page-eyebrow">${esc(o.eyebrow)}</div>` : ''}<h1 class="page-title">${esc(o.title)}</h1>${o.sub ? `<p class="page-sub">${o.sub}</p>` : ''}</div>
        ${o.actions ? `<div class="page-actions">${o.actions}</div>` : ''}</section>`;
    },
    card(o) {
      return `<section class="card ${o.cls || ''} reveal" style="--i:${o.i ?? 1}"${o.id ? ` id="${o.id}"` : ''}${o.label ? ` aria-labelledby="${o.label}"` : ''}>
        <div class="card-head"><div><h2 class="card-title"${o.label ? ` id="${o.label}"` : ''}>${o.icon ? icon(o.icon) : ''}${esc(o.title)}</h2>${o.sub ? `<p class="card-sub">${o.sub}</p>` : ''}</div>${o.tools || ''}</div>
        ${o.body !== undefined ? o.body : ''}</section>`;
    },
    kpis(items, o = {}) {
      return `<div class="kpi-strip">${items.map(k => `<div class="kpi">
        <div class="kpi-label">${esc(k.label)}</div>
        <div class="kpi-value"${k.count !== undefined ? ` data-c="${k.count}"` : ''}>${k.count !== undefined ? k.count : (k.value || '—')}</div>
        <div class="kpi-note">${k.note || ''}</div></div>`).join('')}</div>`;
    },
    table(cols, rows, o = {}) {
      const head = cols.map(c => `<th scope="col"${c.cls ? ` class="${c.cls}"` : ''}>${c.head !== undefined ? c.head : (c.label ? esc(c.label) : '<span class="sr-only">Actions</span>')}</th>`).join('');
      const body = rows.map((r, i) => `<tr class="row-in${o.clickable ? ' is-clickable' : ''}" style="--i:${Math.min(i, 14)}"${o.rowAttrs ? ' ' + o.rowAttrs(r) : ''}>${cols.map(c => {
        const dl = c.mobile === false || !c.label ? '' : ` data-label="${esc(c.label)}"`;
        const cls = [c.cls, c.cellCls].filter(Boolean).join(' ');
        return `<td${dl}${cls ? ` class="${cls}"` : ''}>${c.cell(r, i)}</td>`;
      }).join('')}</tr>`).join('');
      return `<div class="table-wrap"><table class="data-table responsive">${o.caption ? `<caption class="sr-only">${esc(o.caption)}</caption>` : ''}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    },
    chips(items, active, o = {}) {
      return `<div class="chip-row" role="group" aria-label="${esc(o.label || 'Filtrer')}">${items.map(it => `<button type="button" class="chip${it.tone ? ' tone-' + it.tone : ''}" ${o.attr || 'data-f'}="${esc(it.key)}" aria-pressed="${it.key === active}">${it.tone ? '<span class="sdot"></span>' : ''}${esc(it.label)}<span class="chip-n">${it.n}</span></button>`).join('')}</div>`;
    },
    dl(items, cls = '') { return `<dl class="dl-grid ${cls}">${items.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v === undefined || v === null || v === '' ? '—' : v}</dd></div>`).join('')}</dl>`; },
    timeline(items, o = {}) {
      return `<ol class="timeline">${items.map(h => `<li class="tl-item ${h.isNew ? 'is-new' : ''}"><span class="tl-dot k-${esc(h.kind || 'courrier')}">${icon(h.icon || 'check')}</span>
        <div class="tl-body"><strong>${esc(h.label)}</strong><div class="tl-meta">${h.ref ? `<span class="ref">${esc(h.ref)}</span>` : ''}${h.actor ? `<span>${esc(h.actor)}</span>` : ''}${h.date ? `<span class="tnum">${fmtDate(h.date, 'short')}${h.time ? ' · ' + esc(h.time) : ''}</span>` : ''}</div></div></li>`).join('')}</ol>`;
    },
    toolbar(o) {
      return `<div class="toolbar">${o.search ? `<div class="field grow"><label class="mini-label" for="${o.search.id}">${esc(o.search.label || 'Rechercher')}</label><div class="search-field">${icon('search')}<input id="${o.search.id}" class="input" type="search" placeholder="${esc(o.search.placeholder || '')}" value="${esc(o.search.value || '')}" autocomplete="off"></div></div>` : ''}
        ${(o.selects || []).map(s => `<div class="field"><label class="mini-label" for="${s.id}">${esc(s.label)}</label><select class="select" id="${s.id}">${s.options.map(op => `<option value="${esc(op.value)}"${op.value === s.value ? ' selected' : ''}>${esc(op.label)}</option>`).join('')}</select></div>`).join('')}</div>`;
    },
    filterBar(chips, count) { return `<div class="filter-bar"${chips ? '' : ' style="justify-content:flex-end"'} >${chips || ''}<span class="result-count">${count || ''}</span></div>`; },
    kv(label, value) { return `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>`; }
  };

  /* ---------- Toasts ---------- */
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

  /* ---------- Couches (modales, panneau latéral, menu mobile) ---------- */
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
    // data-c : la valeur est déjà écrite, l'animation part de zéro.
    const from = el.dataset.v !== undefined ? (+el.dataset.v || 0) : (el.dataset.c !== undefined ? 0 : (parseInt(el.textContent, 10) || 0));
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
  // Sections de navigation : une page n'appartient qu'à une seule section.
  // Les libellés s'adaptent au profil (une section à page unique prend le
  // libellé de cette page).
  const NAV = [
    { key: 'apercu', label: 'Vue d’ensemble', icon: 'grid', pages: [{ view: 'apercu', label: 'Vue d’ensemble' }] },
    { key: 'dossiers', label: 'Dossiers', icon: 'folder', pages: [
      { view: 'dossiers', label: 'Tous les dossiers' },
      { view: 'nouveau', label: 'Nouveau dossier', can: 'create' },
      { view: 'instruction', label: 'File d’instruction' },
      { view: 'supervision', label: 'Supervision du service' },
      { view: 'beneficiaires', label: 'Bénéficiaires et récipiendaires' },
      { view: 'complements', label: 'Compléments et relances' }] },
    { key: 'decisions', label: 'Décisions', icon: 'stamp', pages: [
      { view: 'decisions', label: 'Dossiers transmis et décisions' },
      { view: 'recours', label: 'Recours' }] },
    { key: 'courriers', label: 'Courriers', icon: 'mail', pages: [{ view: 'courriers', label: 'Courriers et documents' }] },
    { key: 'registre', label: 'Registre', icon: 'inbox', pages: [{ view: 'transmissions', label: 'Registre des courriers' }] },
    { key: 'ceremonies', label: 'Cérémonies', icon: 'calendar', pages: [
      { view: 'ceremonies', label: 'Calendrier et propositions' },
      { view: 'remises', label: 'Remises des médailles' }] },
    { key: 'finances', label: 'Finances', icon: 'cash', pages: [
      { view: 'recettes', label: 'Ordres de recette et reçus' },
      { view: 'stock', label: 'Stock des médailles' }] },
    { key: 'suivi', label: 'Suivi', icon: 'medal', pages: [
      { view: 'distinctions', label: 'Mes distinctions' },
      { view: 'pieces', label: 'DTS et pièces justificatives' },
      { view: 'retraits', label: 'Retraits sans cérémonie' }] },
    { key: 'controle', label: 'Contrôle', icon: 'shield', pages: [{ view: 'controle', label: 'Contrôles et anomalies' }] },
    { key: 'statistiques', label: 'Statistiques', icon: 'chart', pages: [{ view: 'statistiques', label: 'Statistiques' }] },
    { key: 'journal', label: 'Journal', icon: 'clock', pages: [{ view: 'journal', label: 'Journal d’activité' }] },
    { key: 'administration', label: 'Administration', icon: 'database', pages: [{ view: 'administration', label: 'Comptes, paramètres et journaux' }] },
    { key: 'notifications', label: 'Notifications', icon: 'bell', pages: [{ view: 'notifications', label: 'Notifications' }], count: true }
  ];
  const SHORT_NAV = {
    recours: 'Recours', pieces: 'DTS et pièces', beneficiaires: 'Bénéficiaires', completions: 'Compléments',
    complements: 'Compléments', distinctions: 'Mes distinctions', retraits: 'Retraits', remises: 'Remises',
    stock: 'Stock', recettes: 'Ordres de recette', transmissions: 'Registre', decisions: 'Décisions',
    instruction: 'Instruction', supervision: 'Supervision', controle: 'Contrôle', journal: 'Journal',
    administration: 'Administration', courriers: 'Courriers', ceremonies: 'Cérémonies'
  };
  const navFor = v => (v === 'nouveau' ? 'dossiers' : v);
  function navSections() {
    const views = role().views;
    return NAV.map(sec => {
      const pages = sec.pages.filter(p => views.includes(p.view) && (!p.can || can(p.can)));
      if (!pages.length) return null;
      return Object.assign({}, sec, {
        pages, href: '#/' + pages[0].view,
        label: pages.length === 1 ? (SHORT_NAV[pages[0].view] || sec.label) : sec.label
      });
    }).filter(Boolean);
  }
  // Audiences de notification du profil courant
  function audiences() {
    const s = role().scope, out = [];
    if (s && s.kind === 'authority') out.push('authority:' + s.value);
    if (s && s.kind === 'org') out.push('org:' + s.value);
    if (s && s.kind === 'person') (Array.isArray(s.value) ? s.value : [s.value]).forEach(p => out.push('person:' + p));
    if (isFamily('service')) out.push('service');
    if (isFamily('inspection')) out.push('inspecteur');
    if (isFamily('regie')) out.push('regie');
    if (isFamily('administration')) out.push('admin');
    if (!out.length) out.push('service');
    return out;
  }
  const myNotifs = () => { const aud = audiences(); return S.notifications.filter(n => aud.includes(n.aud)); };
  const unread = () => myNotifs().filter(n => !n.read).length;

  function renderNav() {
    const secs = navSections();
    const active = navFor(current.view);
    const n = unread();
    $('#nav-list').innerHTML = secs.map(sec => {
      const cur = sec.pages.some(p => p.view === active) ? 'aria-current="page"' : '';
      const cnt = sec.count ? `<span class="nav-count ${n ? '' : 'is-zero'}" data-nav-count>${n}</span>` : '';
      const menu = sec.pages.length > 1 ? `<button class="nav-caret" type="button" data-dd="nav-${sec.key}" aria-expanded="false" aria-controls="nav-${sec.key}" aria-label="Autres accès : ${esc(sec.label)}">${icon('chevron-down')}</button>
          <div class="dd-menu" id="nav-${sec.key}" hidden>${sec.pages.map(p => `<a class="menu-item" href="${p.view === 'nouveau' ? '#/nouveau' : '#/' + p.view}">${icon(p.view === 'nouveau' ? 'plus' : sec.icon)}${esc(p.label)}</a>`).join('')}</div>` : '';
      return `<li class="nav-item">
        <a class="nav-link" href="${sec.href}" ${cur}>${icon(sec.icon)}${esc(sec.label)}${cnt}</a>${menu}</li>`;
    }).join('');
    $('#mobile-nav-list').innerHTML = secs.map(sec => `<a href="${sec.href}" ${sec.pages.some(p => p.view === active) ? 'aria-current="page"' : ''}>${icon(sec.icon)}${esc(sec.label)}${sec.count ? `<span class="nav-count ${n ? '' : 'is-zero'}">${n}</span>` : ''}</a>
        ${sec.pages.length > 1 ? `<div class="mobile-nav-sub">${sec.pages.slice(1).map(p => `<a href="${p.view === 'nouveau' ? '#/nouveau' : '#/' + p.view}">${esc(p.label)}</a>`).join('')}</div>` : ''}`).join('')
      + `<div class="menu-sep"></div><a href="#/profil" ${current.view === 'profil' ? 'aria-current="page"' : ''}>${icon('user')}Mon profil</a>`;
  }

  function renderAccount() {
    const u = user(), s = role().scope;
    $('#acc-initials').textContent = u.initials;
    $('#acc-name').textContent = u.name;
    $('#acc-role').textContent = s && s.kind === 'org' ? org(s.value).name : (s && s.kind === 'authority' ? authority(s.value).label : u.title);
    $('#account-btn').setAttribute('aria-label', `Compte : ${u.name}, ${role().label}`);
    $('#account-menu').innerHTML = `
      <div class="menu-head"><span class="avatar">${esc(u.initials)}</span><div><strong>${esc(u.name)}</strong><span>${esc(u.title)} · ${esc(u.unit)}</span></div></div>
      <div class="menu-sep"></div>
      <a class="menu-item" role="menuitem" href="#/profil">${icon('user')}Mon profil et préférences</a>
      <div class="menu-sep"></div>
      <div class="menu-label">Profil de travail</div>
      ${D.roleFamilies.map(f => `<div class="menu-label" style="padding-top:6px;font-weight:700;color:var(--muted)">${esc(f.label)}</div>
        ${f.roles.map(k => { const r = D.roles[k]; return `<button class="menu-item" type="button" role="menuitemradio" aria-checked="${k === S.role}" data-role="${k}" title="${esc(r.label)}">${icon(k === S.role ? 'check' : 'swap')}<span style="display:grid;gap:0"><span>${esc(r.label)}</span><span class="menu-hint" style="margin:0">${esc(r.short)}</span></span></button>`; }).join('')}`).join('')}
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
  const NOTIF_ICON = { depot: 'inbox', visa: 'stamp', conflit: 'alert-triangle', complement: 'paperclip', ceremonie: 'medal', transmission: 'send', decision: 'check-circle', recours: 'scale', stock: 'box', controle: 'shield', remise: 'medal', paiement: 'cash' };
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
    const views = role().views;
    if (n.doc && views.includes('courriers') && getDoc(n.doc)) location.hash = '#/courriers/' + n.doc;
    else if (n.ref && views.includes('dossiers')) location.hash = '#/dossiers/' + n.ref;
    else if (views.includes('journal')) location.hash = '#/journal';
    else location.hash = '#/notifications';
  });

  // Actions du menu compte
  document.addEventListener('click', async e => {
    const r = e.target.closest('[data-role]');
    if (r) {
      const prev = S.role;
      S.role = r.dataset.role;
      audit(`${user().name} (${D.roles[prev].label})`, 'Changement de profil de travail', `Nouveau profil : ${D.roles[S.role].label}`);
      save();
      closeDrawer(true);
      renderShell();
      toast('info', 'Profil de travail modifié', esc(role().label));
      const first = role().views.includes('apercu') ? 'apercu' : role().views[0];
      forceRoute('#/' + first);
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
    if (role().views.includes('transmissions')) myTransmissions().forEach(t => out.push({ g: 'Registre des courriers', ic: 'inbox', t: `${t.id} · ${t.subject}`, s: `${t.direction === 'entrant' ? 'Entrant' : 'Sortant'} · ${t.from} → ${t.to}`, k: `${t.id} ${t.subject} ${t.from} ${t.to} ${t.dossier || ''}`, href: '#/transmissions?q=' + encodeURIComponent(t.id) }));
    if (role().views.includes('recettes')) myReceiptOrders().forEach(o => out.push({ g: 'Ordres de recette', ic: 'cash', t: o.id, s: `${o.dossier} · ${o.amount} · ${D.recetteStates[o.state].label}`, k: `${o.id} ${o.dossier} ${o.amount}`, href: '#/recettes?q=' + encodeURIComponent(o.id) }));
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
        : myDossiers().slice().sort((a, b) => { const la = lastActivity(a), lb = lastActivity(b); return (lb.date + lb.time).localeCompare(la.date + la.time); }).slice(0, 5).map(d => idx.find(x => x.href === '#/dossiers/' + d.ref)).filter(Boolean);
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
    const first = role().views.includes('apercu') ? 'apercu' : role().views[0];
    if (!location.hash) history.replaceState(null, '', '#/' + first);
    route();
  }

  Object.assign(GO, {
    D, DATA: D,
    $, $$, esc, icon, pad, parseISO, iso, REF, REF_ISO, MONTHS, MONTHS_S, DAYS, fmtDate, daysBetween, ageDays, relDay, plural, norm, debounce, reduced, wait, stamp, seniority, eligibility,
    save, commit, audit, role, can, family, isFamily, user, org, venue, medal, authority, scopeAuthority, scopeMatch, external,
    getDossier, getDoc, getCer, myDossiers, myDocs, myCers, myDts, myNotifs, myTransmissions, myAudit, sortHist, lastActivity, docsOf, cersOf, activeCer, closure,
    receiptOrder, myReceiptOrders, receiptOf, remiseOf, myRemises, withdrawalOf, myWithdrawals, controlOf, myControls, recoursOf, myRecours,
    complementOf, myComplements, myRelances, stockOf, stockTotal, distinctOf, moveStock, addTransmission, nextRef,
    addHistory, notify, stepInfo, actorName, nextDocNumber, newDoc, registryAdd, withLoading, fieldError, refreshDossier, hooks,
    scopeOrg: () => { const s = role().scope; return s && s.kind === 'org' ? org(s.value) : null; },
    badge, statusBadge, cerBadge, docBadge, dictBadge, refChip, stepMini, stepper, empty, ui, toast, modal, confirmDialog, openDrawer, setDrawer, closeDrawer, isDrawerOpen: () => !!drawer, drawerKey: () => drawer && drawer.key,
    countUp, reveal, tabs, renderCounts, renderNav, renderShell, setHash, forceRoute, current: () => current, boot, openSearch, navSections, audiences
  });
  return GO;
})();
