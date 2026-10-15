/* ==========================================================================
   GAB-ORIENT — Vue « Cérémonies » : calendrier mensuel, fiche de cérémonie,
   négociation de date et proposition soumise à validation.
   ========================================================================== */
(function (GO) {
  'use strict';
  const { $, $$, esc, icon, D, fmtDate, plural, norm } = GO;
  const ui = GO.ui;

  const CAL = { y: GO.REF.getFullYear(), m: GO.REF.getMonth(), sel: null, ev: null, focus: null };
  const PF = { q: '', venue: null, dossier: null, date: '', time: '10:00' };
  let mapApi = null, mapTok = 0;
  const DOW = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const TIMES = ['09:00', '09:30', '10:00', '10:30', '11:00', '14:30', '15:00', '15:30', '16:00'];
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const hm = t => t.replace(':', ' h ');

  function render(main, r) {
    if (mapApi) { mapApi.destroy(); mapApi = null; }
    const tab = r.id === 'proposer' && GO.can('propose') ? 'prop' : 'cal';
    applyRoute(r);
    main.innerHTML = `
      ${ui.head({ eyebrow: 'Organisation', title: 'Cérémonies',
        sub: 'Calendrier des remises de distinctions, états de validation et proposition de nouvelles dates.',
        actions: `<div class="tabs" role="tablist" aria-label="Vues des cérémonies"><span class="tab-ink" aria-hidden="true"></span>
          <button class="tab" role="tab" type="button" id="tb-cal" data-tab="cal" aria-controls="tp-cal" aria-selected="${tab === 'cal'}">${icon('calendar', 'ic-sm')}Calendrier</button>
          ${GO.can('propose') ? `<button class="tab" role="tab" type="button" id="tb-prop" data-tab="prop" aria-controls="tp-prop" aria-selected="${tab === 'prop'}">${icon('pin', 'ic-sm')}Proposer un lieu et une date</button>` : ''}
        </div>` })}
      <div id="tp-cal" role="tabpanel" aria-labelledby="tb-cal" ${tab === 'cal' ? '' : 'hidden'}></div>
      <div id="tp-prop" role="tabpanel" aria-labelledby="tb-prop" ${tab === 'prop' ? '' : 'hidden'}></div>`;
    GO.tabs(main, t => {
      if (t === 'prop') GO.setHash('#/ceremonies/proposer' + (PF.dossier ? '?dossier=' + PF.dossier : ''));
      else GO.setHash(CAL.ev ? '#/ceremonies/' + CAL.ev : '#/ceremonies');
      showTab(t);
    });
    showTab(tab, true);
  }

  function applyRoute(r) {
    if (r.id && r.id !== 'proposer') {
      const c = GO.getCer(r.id);
      if (c && GO.myCers().includes(c)) { const d = GO.parseISO(c.date); CAL.y = d.getFullYear(); CAL.m = d.getMonth(); CAL.ev = c.id; CAL.sel = c.date; }
      else GO.toast('error', 'Cérémonie introuvable', esc(r.id));
    }
    if (r.id === 'proposer') {
      if (r.params.get('dossier')) PF.dossier = r.params.get('dossier');
      if (r.params.get('date')) PF.date = r.params.get('date');
    }
  }

  function showTab(t, first) {
    const cal = $('#tp-cal'), prop = $('#tp-prop');
    cal.hidden = t !== 'cal';
    if (prop) prop.hidden = t !== 'prop';
    const panel = t === 'cal' ? cal : prop;
    panel.classList.remove('tab-panel'); void panel.offsetWidth; if (!first) panel.classList.add('tab-panel');
    if (t === 'cal') drawCalendar(); else drawProposer();
  }

  /* ======================= CALENDRIER ======================= */
  const eventsOn = date => GO.myCers().filter(c => c.date === date).sort((a, b) => a.time.localeCompare(b.time));

  function drawCalendar(dir) {
    const host = $('#tp-cal');
    if (!host.firstElementChild) {
      host.innerHTML = `<div class="cal-layout">
        <div class="stack">
          <section class="card" aria-labelledby="cal-title">
            <div class="cal-head">
              <h2 class="cal-title" id="cal-title" aria-live="polite"></h2>
              <div class="cal-nav">
                <button class="icon-btn" type="button" data-cal="prev" aria-label="Mois précédent">${icon('chevron-left')}</button>
                <button class="btn btn-secondary btn-sm" type="button" data-cal="today">Aujourd’hui</button>
                <button class="icon-btn" type="button" data-cal="next" aria-label="Mois suivant">${icon('chevron-right')}</button>
              </div>
              <div class="cal-legend" aria-label="Légende">
                <span><i class="lg-propose"></i>Proposée</span><span><i class="lg-negociation"></i>Négociation</span><span><i class="lg-confirme"></i>Confirmée</span>
                <span><i class="lg-termine"></i>Terminée</span><span><i class="lg-conflit"></i>Conflit</span><span><i class="lg-closed"></i>Indisponible</span>
              </div>
            </div>
            <div class="cal-viewport"><div class="cal-grid" id="cal-grid"></div></div>
          </section>
          <section class="card" aria-labelledby="ml-t"><div class="card-head"><h2 class="card-title" id="ml-t">${icon('list')}<span id="ml-title"></span></h2></div><ul class="month-list" id="month-list"></ul></section>
        </div>
        <aside class="card cal-detail" id="cal-detail" aria-live="polite" aria-label="Détail de la sélection"></aside>
      </div>`;
      host.addEventListener('click', onCalClick);
      host.addEventListener('keydown', onCalKey);
    }
    const first = new Date(CAL.y, CAL.m, 1);
    const offset = (first.getDay() + 6) % 7;
    const dim = new Date(CAL.y, CAL.m + 1, 0).getDate();
    const weeks = Math.ceil((offset + dim) / 7);
    $('#cal-title').textContent = `${GO.MONTHS[CAL.m]} ${CAL.y}`;
    const focusDate = CAL.focus || CAL.sel || (CAL.y === GO.REF.getFullYear() && CAL.m === GO.REF.getMonth() ? GO.REF_ISO : GO.iso(first));
    let cells = DOW.map(d => `<div class="cal-dow" aria-hidden="true">${d}</div>`).join('');
    for (let i = 0; i < weeks * 7; i++) {
      const day = new Date(CAL.y, CAL.m, 1 - offset + i), ds = GO.iso(day);
      const out = day.getMonth() !== CAL.m, past = ds < GO.REF_ISO, today = ds === GO.REF_ISO, cl = GO.closure(ds);
      const evs = eventsOn(ds);
      const label = `${GO.fmtDate(ds, 'full')}${today ? ', aujourd’hui' : ''}${cl ? ', indisponible : ' + cl.reason : ''}${evs.length ? ', ' + plural(evs.length, 'cérémonie', 'cérémonies') : ''}`;
      cells += `<div class="cal-cell ${out ? 'is-out' : ''} ${past ? 'is-past' : ''} ${today ? 'is-today' : ''} ${cl ? 'is-closed' : ''} ${CAL.sel === ds ? 'is-selected' : ''}" data-date="${ds}">
        <button type="button" class="cal-day" data-day="${ds}" tabindex="${ds === focusDate && !out ? 0 : -1}" aria-label="${esc(label)}" aria-pressed="${CAL.sel === ds}">${day.getDate()}</button>
        ${cl && !out ? `<span class="cal-closed-label">${esc(cl.reason)}</span>` : ''}
        ${evs.slice(0, 2).map(c => { const o = GO.org(GO.getDossier(c.dossier).org); return `<button type="button" class="cal-ev st-${c.state} ${CAL.ev === c.id ? 'is-active' : ''}" data-ev="${c.id}" tabindex="-1" aria-label="${esc(c.id)}, ${esc(o.short)}, ${hm(c.time)}, ${esc(D.ceremonyStates[c.state].label)}">${c.state === 'conflit' ? icon('alert-triangle') : c.state === 'termine' ? icon('check') : ''}<span class="t">${c.time}</span><span class="n">${esc(o.short)}</span></button>`; }).join('')}
        ${evs.length > 2 ? `<button type="button" class="cal-more" data-day="${ds}" tabindex="-1">+ ${evs.length - 2} autre${evs.length > 3 ? 's' : ''}</button>` : ''}
      </div>`;
    }
    const grid = $('#cal-grid');
    grid.setAttribute('aria-label', `Calendrier de ${GO.MONTHS[CAL.m]} ${CAL.y}`);
    grid.innerHTML = cells;
    grid.classList.remove('anim-next', 'anim-prev');
    if (dir) { void grid.offsetWidth; grid.classList.add(dir === 1 ? 'anim-next' : 'anim-prev'); }
    if (!$('.cal-day[tabindex="0"]', grid)) { const f = $('.cal-cell:not(.is-out) .cal-day', grid); if (f) f.tabIndex = 0; }
    if (CAL.focus) { const b = $(`.cal-day[data-day="${CAL.focus}"]`, grid); if (b) b.focus(); CAL.focus = null; }
    const monthKey = `${CAL.y}-${GO.pad(CAL.m + 1)}`;
    const monthEvs = GO.myCers().filter(c => c.date.startsWith(monthKey)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    $('#ml-title').textContent = `Cérémonies de ${GO.MONTHS[CAL.m]} ${CAL.y}`;
    $('#month-list').innerHTML = monthEvs.length ? monthEvs.map(c => { const d = GO.parseISO(c.date), o = GO.org(GO.getDossier(c.dossier).org), v = GO.venue(c.venue); return `
      <li data-ev="${c.id}" tabindex="0" role="button" aria-label="${esc(c.id)}, ${esc(o.name)}, ${GO.fmtDate(c.date)}"><span class="date-tile"><b>${d.getDate()}</b><span>${GO.MONTHS_S[d.getMonth()]}</span></span>
        <span><strong style="display:block;font-size:13.5px;color:var(--navy-900)">${esc(o.name)}</strong><span class="muted" style="font-size:12px">${hm(c.time)} · ${esc(v.name)}</span></span>${GO.cerBadge(c.state)}</li>`; }).join('')
      : `<li style="cursor:default;display:block">${GO.empty('calendar', 'Aucune cérémonie ce mois-ci', 'Utilisez les flèches pour parcourir les autres mois.')}</li>`;
    drawDetail();
  }

  function moveMonth(delta, focus) {
    const d = new Date(CAL.y, CAL.m + delta, 1);
    CAL.y = d.getFullYear(); CAL.m = d.getMonth();
    if (focus) CAL.focus = focus;
    drawCalendar(delta > 0 ? 1 : -1);
  }

  function onCalClick(e) {
    const c = e.target.closest('[data-cal]');
    if (c) {
      if (c.dataset.cal === 'prev') moveMonth(-1);
      if (c.dataset.cal === 'next') moveMonth(1);
      if (c.dataset.cal === 'today') { const dir = (GO.REF.getFullYear() * 12 + GO.REF.getMonth()) - (CAL.y * 12 + CAL.m); CAL.y = GO.REF.getFullYear(); CAL.m = GO.REF.getMonth(); CAL.sel = GO.REF_ISO; CAL.ev = null; GO.setHash('#/ceremonies'); drawCalendar(dir ? Math.sign(dir) : 0); }
      return;
    }
    const ev = e.target.closest('[data-ev]');
    if (ev) { selectEvent(ev.dataset.ev); return; }
    const day = e.target.closest('[data-day]');
    if (day) selectDay(day.dataset.day);
    const act = e.target.closest('[data-cact]');
    if (act) CER_ACTIONS[act.dataset.cact](GO.getCer(act.dataset.id));
  }
  function onCalKey(e) {
    const li = e.target.closest('.month-list [data-ev]');
    if (li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectEvent(li.dataset.ev); return; }
    const b = e.target.closest('.cal-day');
    if (!b) return;
    const map = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (map[e.key] || e.key === 'PageUp' || e.key === 'PageDown' || e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const cur = GO.parseISO(b.dataset.day);
      let next;
      if (map[e.key]) next = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + map[e.key]);
      else if (e.key === 'PageUp' || e.key === 'PageDown') next = new Date(cur.getFullYear(), cur.getMonth() + (e.key === 'PageUp' ? -1 : 1), Math.min(cur.getDate(), 28));
      else next = e.key === 'Home' ? new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - ((cur.getDay() + 6) % 7)) : new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + (6 - (cur.getDay() + 6) % 7));
      const ns = GO.iso(next);
      if (next.getMonth() !== CAL.m || next.getFullYear() !== CAL.y) { moveMonth((next.getFullYear() * 12 + next.getMonth()) - (CAL.y * 12 + CAL.m), ns); return; }
      $$('#cal-grid .cal-day').forEach(x => { x.tabIndex = x.dataset.day === ns ? 0 : -1; });
      const t = $(`#cal-grid .cal-day[data-day="${ns}"]`); if (t) t.focus();
    }
  }

  function selectDay(ds) {
    CAL.sel = ds;
    const evs = eventsOn(ds);
    CAL.ev = evs.length ? evs[0].id : null;
    GO.setHash(CAL.ev ? '#/ceremonies/' + CAL.ev : '#/ceremonies');
    const d = GO.parseISO(ds);
    if (d.getMonth() !== CAL.m) { CAL.focus = ds; moveMonth((d.getFullYear() * 12 + d.getMonth()) - (CAL.y * 12 + CAL.m), ds); return; }
    syncSelection(); drawDetail();
  }
  function selectEvent(id) {
    const c = GO.getCer(id); if (!c) return;
    CAL.ev = id; CAL.sel = c.date;
    GO.setHash('#/ceremonies/' + id);
    const d = GO.parseISO(c.date);
    if (d.getMonth() !== CAL.m || d.getFullYear() !== CAL.y) { CAL.y = d.getFullYear(); CAL.m = d.getMonth(); drawCalendar(1); return; }
    syncSelection(); drawDetail();
    if (window.matchMedia('(max-width: 1060px)').matches) $('#cal-detail').scrollIntoView({ behavior: GO.reduced() ? 'auto' : 'smooth', block: 'start' });
  }
  function syncSelection() {
    $$('#cal-grid .cal-cell').forEach(c => c.classList.toggle('is-selected', c.dataset.date === CAL.sel));
    $$('#cal-grid .cal-day').forEach(b => { b.setAttribute('aria-pressed', b.dataset.day === CAL.sel); });
    $$('#cal-grid .cal-ev').forEach(b => b.classList.toggle('is-active', b.dataset.ev === CAL.ev));
  }

  const STATE_ALERT = { propose: 'alert-info', negociation: 'alert-warn', confirme: 'alert-success', termine: '', conflit: 'alert-error' };
  const STATE_ICON = { propose: 'clock', negociation: 'message', confirme: 'check-circle', termine: 'check', conflit: 'alert-triangle' };
  function cerSteps(c) {
    return {
      propose: ['Examen de la proposition par le Service des Distinctions', 'Validation de la date par l’autorité compétente', 'Envoi de la convocation au demandeur'],
      negociation: ['Arrêter une date avec le lieu et le demandeur', c.note ? 'Alternative en discussion : ' + c.note : 'Faire valider la date retenue'],
      confirme: ['Préparer les médailles et la liste d’appel à la régie', 'Confirmer la présence des récipiendaires', 'Enregistrer la remise effective après la cérémonie'],
      termine: ['Archiver le procès-verbal de remise'],
      conflit: ['Proposer une autre date ou un autre lieu', c.note || 'Vérifier les réservations du lieu']
    }[c.state];
  }

  function drawDetail() {
    const host = $('#cal-detail'); if (!host) return;
    const c = CAL.ev && GO.getCer(CAL.ev);
    if (c) {
      const d = GO.getDossier(c.dossier), o = GO.org(d.org), v = GO.venue(c.venue), dt = GO.parseISO(c.date);
      const same = eventsOn(c.date).filter(x => x.id !== c.id);
      const rem = GO.remiseOf(d.ref), or = GO.receiptOrder(d.ref), wd = GO.withdrawalOf(d.ref);
      const remEffective = rem && (rem.state === 'remise' || rem.state === 'retrait');
      const acts = [];
      const canCoordinate = GO.can('coordinate');
      const canValidate = GO.can('valider_ceremonie');
      if (canCoordinate && (c.state === 'propose' || c.state === 'negociation')) acts.push(`<button class="btn btn-secondary btn-sm" type="button" data-cact="negotiate" data-id="${c.id}">${icon('message', 'ic-sm')}${c.state === 'propose' ? 'Ouvrir la négociation' : 'Poursuivre la négociation'}</button>`);
      if (canCoordinate && (c.state === 'propose' || c.state === 'negociation')) acts.push(`<button class="btn btn-primary btn-sm" type="button" data-cact="validate" data-id="${c.id}">${icon('check', 'ic-sm')}Enregistrer la validation reçue</button>`);
      if (canValidate && (c.state === 'propose' || c.state === 'negociation')) acts.push(`<button class="btn btn-primary btn-sm" type="button" data-cact="validate" data-id="${c.id}">${icon('shield', 'ic-sm')}Valider la date de cérémonie</button>`);
      if (GO.can('propose') && c.state === 'conflit') acts.push(`<a class="btn btn-primary btn-sm" href="#/ceremonies/proposer?dossier=${c.dossier}">${icon('pin', 'ic-sm')}Proposer une autre date</a>`);
      if (GO.can('remise') && c.state === 'confirme') acts.push(`<a class="btn btn-secondary btn-sm" href="#/remises">${icon('medal', 'ic-sm')}${rem ? 'Suivre la remise' : 'Préparer les médailles'}</a>`);
      if (canCoordinate && c.state === 'confirme' && c.date <= GO.REF_ISO) {
        if (remEffective) acts.push(`<button class="btn btn-primary btn-sm" type="button" data-cact="done" data-id="${c.id}">${icon('check', 'ic-sm')}Marquer comme terminée</button>`);
        else acts.push(`<span data-tip="La remise effective doit d’abord être enregistrée par la Régie des médailles." tabindex="0"><button class="btn btn-secondary btn-sm" type="button" disabled>${icon('clock', 'ic-sm')}Clôture en attente de la remise</button></span>`);
        void rem;
      }
      host.innerHTML = `<div class="cal-detail-body">
        <div class="ev-hero">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">${GO.cerBadge(c.state)}<span class="ref">${esc(c.id)}</span></div>
          <h3>Remise des médailles — ${esc(o.short)}</h3>
          <div class="ev-when"><span class="date-tile"><b>${dt.getDate()}</b><span>${GO.MONTHS_S[dt.getMonth()]}</span></span>
            <div><strong style="display:block;color:var(--navy-900)">${esc(cap(GO.fmtDate(c.date, 'full')))}</strong><span class="muted" style="font-size:13px">${hm(c.time)} · ${esc(v.city)}</span></div></div>
        </div>
        <div class="alert ${STATE_ALERT[c.state]} state-explain" style="margin-top:14px">${icon(STATE_ICON[c.state])}<div><strong>${esc(D.ceremonyStates[c.state].label)}.</strong> ${esc(D.ceremonyStates[c.state].desc)}${c.state === 'propose' || c.state === 'negociation' ? ' Une proposition ne vaut pas confirmation.' : ''}</div></div>
        <dl class="ev-rows">
          <div class="ev-row">${icon('folder')}<dt>Dossier</dt><dd>${GO.refChip(c.dossier)}</dd></div>
          <div class="ev-row">${icon('building')}<dt>Demandeur</dt><dd>${esc(o.name)}</dd></div>
          <div class="ev-row">${icon('pin')}<dt>Lieu</dt><dd>${esc(v.name)}<br><span class="muted" style="font-weight:400;font-size:12px">${esc(v.address)}</span></dd></div>
          <div class="ev-row">${icon('users')}<dt>Récipiendaires</dt><dd>${d.recipients.length}</dd></div>
          <div class="ev-row">${icon('shield')}<dt>Validation</dt><dd>${c.validation ? esc(c.validation) : '<span class="muted" style="font-weight:500">Non validée</span>'}</dd></div>
          <div class="ev-row">${icon('medal')}<dt>Remise</dt><dd>${rem ? GO.dictBadge(D.remiseStates, rem.state) : '<span class="muted" style="font-weight:500">Non préparée</span>'}</dd></div>
          <div class="ev-row">${icon('cash')}<dt>Ordre de recette</dt><dd>${or ? `${GO.dictBadge(D.recetteStates, or.state)}<br><span class="muted" style="font-weight:400;font-size:12px">${esc(or.amount)}</span>` : '<span class="muted" style="font-weight:500">Non émis</span>'}</dd></div>
          ${wd ? `<div class="ev-row">${icon('medal')}<dt>Retrait sans cérémonie</dt><dd>${GO.dictBadge(D.withdrawalStates, wd.state)}</dd></div>` : ''}
          ${same.length ? `<div class="ev-row">${icon('calendar')}<dt>Même jour</dt><dd>${same.map(x => `<button class="link-btn" type="button" data-ev="${x.id}">${esc(x.id)}</button> (${hm(x.time)})`).join(', ')}</dd></div>` : ''}
        </dl>
        <div class="card-body" style="border-top:1px solid var(--line-soft)"><h4 style="font-size:13px;margin-bottom:6px">Prochaines étapes</h4><ul class="next-steps">${cerSteps(c).map(s => `<li>${icon('chevron-right')}<span style="font-size:13.5px">${esc(s)}</span></li>`).join('')}</ul></div>
        ${c.state === 'confirme' || c.state === 'termine' ? `<div class="card-body" style="border-top:1px solid var(--line-soft)"><p class="hint">${icon('info', 'ic-sm')} Le paiement et la remise sont suivis séparément : la régie prépare les médailles sur cérémonie confirmée et n’enregistre la remise effective qu’après la remise aux récipiendaires.</p></div>` : ''}
        ${acts.length ? `<div class="card-foot" style="justify-content:flex-end;flex-wrap:wrap;gap:8px">${acts.join('')}</div>` : ''}
      </div>`;
      return;
    }
    const ds = CAL.sel || GO.REF_ISO, cl = GO.closure(ds), past = ds < GO.REF_ISO, dt = GO.parseISO(ds);
    const st = cl ? ['alert-warn', 'alert-triangle', `Jour indisponible : ${cl.reason}.`] : past ? ['', 'clock', 'Date passée.'] : ['alert-success', 'check-circle', 'Aucune cérémonie prévue : date disponible pour une proposition.'];
    host.innerHTML = `<div class="cal-detail-body">
      <div class="ev-hero"><span class="pill">${icon('calendar', 'ic-sm')}Journée sélectionnée</span>
        <div class="ev-when"><span class="date-tile"><b>${dt.getDate()}</b><span>${GO.MONTHS_S[dt.getMonth()]}</span></span><strong style="color:var(--navy-900)">${esc(cap(GO.fmtDate(ds, 'full')))}</strong></div></div>
      <div class="card-body"><div class="alert ${st[0]}">${icon(st[1])}<div>${esc(st[2])}</div></div>
        ${!cl && !past && GO.can('propose') ? `<a class="btn btn-primary btn-block mt" href="#/ceremonies/proposer?date=${ds}">${icon('pin')}Proposer une cérémonie ce jour</a>` : ''}
        <p class="muted mt" style="font-size:12.5px">Sélectionnez une cérémonie dans le calendrier ou dans la liste du mois pour afficher son détail.</p></div>
    </div>`;
  }

  const CER_ACTIONS = {
    async negotiate(c) {
      GO.formModal({
        title: c.state === 'propose' ? 'Ouvrir la négociation de date' : 'Poursuivre la négociation', icon: 'message', tone: 'yellow',
        intro: `<p>La proposition ${esc(c.id)} (${fmtDate(c.date)} à ${hm(c.time)}, ${esc(GO.venue(c.venue).name)}) passe à l’état « En négociation ». Le demandeur et le lieu sont informés que la date est en discussion.</p>`,
        fields: [{ id: 'note', label: 'Point de discussion', type: 'textarea', rows: 3, required: true, value: c.note || '', validate: v => v.length >= 5 ? '' : 'Précisez le point en discussion.' }],
        submit: 'Enregistrer la négociation', iconSubmit: 'message', kind: 'secondary',
        run: v => {
          c.state = 'negociation'; c.note = v.note;
          const d = GO.getDossier(c.dossier);
          GO.addHistory(d, 'ceremonie', 'Négociation de la date de cérémonie ouverte', undefined, { detail: v.note });
          GO.notify({ type: 'ceremonie', aud: 'org:' + d.org, ref: d.ref, title: 'Date de cérémonie en discussion', msg: `${c.id} — ${v.note}` });
          GO.commit(); drawCalendar();
          GO.toast('success', 'Négociation ouverte', esc(c.id));
        }
      });
    },
    validate(c) {
      const d = GO.getDossier(c.dossier);
      const byAuthority = GO.can('valider_ceremonie');
      GO.formModal({
        title: byAuthority ? 'Valider la date de cérémonie' : 'Enregistrer la validation reçue', icon: 'shield', tone: 'green',
        intro: `<div class="alert alert-info">${icon('info')}<div>${byAuthority
          ? `Vous validez la date <strong>au nom de ${esc(GO.actorName())}</strong>. La validation rend la cérémonie « confirmée » et déclenche la convocation du demandeur.`
          : 'Vous enregistrez la validation <strong>décidée par l’autorité compétente</strong> et reçue par courrier. Cette saisie ne vaut pas décision.'}</div></div>
          <dl class="modal-summary mt"><div><dt>Dossier</dt><dd class="ref">${esc(d.ref)}</dd></div><div><dt>Date proposée</dt><dd>${fmtDate(c.date)} · ${hm(c.time)}</dd></div><div><dt>Lieu</dt><dd>${esc(GO.venue(c.venue).name)}</dd></div><div><dt>Récipiendaires</dt><dd>${d.recipients.length}</dd></div></dl>`,
        fields: [
          { id: 'ref', label: 'Référence de la validation', type: 'text', required: true, placeholder: `Exemple : Validation du ${fmtDate(GO.REF_ISO)}`, validate: v => v.length >= 4 ? '' : 'Saisissez la référence de la validation.' },
          { id: 'obs', label: 'Observation (facultatif)', type: 'textarea', rows: 2 }
        ],
        submit: 'Confirmer la cérémonie', iconSubmit: 'check',
        run: v => {
          c.state = 'confirme'; c.validation = v.ref;
          c.validatedBy = `${GO.actorName()} — ${GO.role().label}`;
          delete c.note;
          GO.addHistory(d, 'ceremonie', 'Date de cérémonie confirmée', c.validatedBy, { detail: v.ref });
          GO.newDoc({ dossier: d.ref, kind: 'convocation', type: 'sortant', title: 'Convocation à la cérémonie de remise', date: GO.REF_ISO, from: GO.actorName(), state: 'envoye', number: GO.nextDocNumber() });
          GO.notify({ type: 'ceremonie', aud: 'org:' + d.org, ref: d.ref, title: 'Cérémonie confirmée', msg: `${c.id} est confirmée le ${fmtDate(c.date)} à ${GO.venue(c.venue).name}.` });
          GO.notify({ type: 'ceremonie', aud: 'regie', ref: d.ref, title: 'Médailles à préparer', msg: `${c.id} — ${plural(d.recipients.length, 'récipiendaire', 'récipiendaires')} le ${fmtDate(c.date)}.` });
          GO.notify({ type: 'ceremonie', aud: 'service', ref: d.ref, title: 'Cérémonie confirmée', msg: `${c.id} — ${v.ref}` });
          GO.commit(); drawCalendar();
          GO.toast('success', 'Cérémonie confirmée', `${esc(c.id)} — convocation adressée au demandeur.`);
          void v.obs;
        }
      });
    },
    async done(c) {
      const d = GO.getDossier(c.dossier), rem = GO.remiseOf(d.ref);
      const ok = await GO.confirmDialog({ title: 'Marquer la cérémonie comme terminée ?', tone: 'green', icon: 'check-circle', confirm: 'Marquer comme terminée',
        message: `<p>${esc(c.id)} du ${fmtDate(c.date)} sera archivée et le dossier ${esc(d.ref)} clôturé.</p>
          <div class="modal-summary" style="margin-top:10px"><div><dt>Remise enregistrée</dt><dd>${rem ? GO.dictBadge(D.remiseStates, rem.state) : '—'}</dd></div><div><dt>Date de remise</dt><dd>${rem ? fmtDate(rem.date) : '—'}</dd></div></div>` });
      if (!ok) return;
      c.state = 'termine';
      GO.addHistory(d, 'ceremonie', 'Cérémonie de remise effectuée — dossier clôturé');
      GO.commit(); drawCalendar();
      GO.toast('success', 'Cérémonie terminée', esc(c.id));
    }
  };

  /* ======================= PROPOSITION LIEU + DATE ======================= */
  const eligible = () => GO.myDossiers().filter(d => d.status === 'approuve' && !GO.activeCer(d.ref) && !(GO.cersOf(d.ref)[0] && GO.cersOf(d.ref)[0].state === 'termine'));
  const venues = () => { const q = norm(PF.q.trim()); return D.venues.filter(v => !q || norm(`${v.name} ${v.city} ${v.province} ${v.kind}`).includes(q)); };

  function drawProposer() {
    const host = $('#tp-prop'); if (!host) return;
    const el = eligible();
    if (PF.dossier && !el.find(d => d.ref === PF.dossier)) { if (GO.getDossier(PF.dossier)) GO.toast('info', 'Dossier non éligible', `${esc(PF.dossier)} a déjà une cérémonie en cours ou n’est pas approuvé.`); PF.dossier = null; }
    if (!PF.dossier && el[0]) PF.dossier = el[0].ref;
    if (!PF.venue && PF.dossier) { const city = GO.org(GO.getDossier(PF.dossier).org).city; const v = D.venues.find(x => x.city === city); if (v) PF.venue = v.id; }
    host.innerHTML = `<div class="venue-layout">
      <section class="card" aria-labelledby="pv-t">
        <div class="card-head"><div><h2 class="card-title" id="pv-t">${icon('building')}Lieux de cérémonie</h2><p class="card-sub" id="pv-count"></p></div></div>
        <div style="padding:12px 12px 4px"><div class="search-field"><label class="sr-only" for="pv-q">Rechercher un lieu</label>${icon('search')}<input class="input" id="pv-q" type="search" placeholder="Nom, ville, province…" value="${esc(PF.q)}" autocomplete="off"></div></div>
        <div class="venue-list" id="pv-list" role="group" aria-label="Résultats de lieux"></div>
      </section>
      <section class="card map-card" aria-labelledby="pm-t">
        <div class="card-head"><div><h2 class="card-title" id="pm-t">${icon('pin')}Situation du lieu</h2><p class="card-sub" id="pm-sub">Chargement de la carte…</p></div></div>
        <div class="map" id="pv-map" aria-label="Carte des lieux de cérémonie"></div>
        <div id="pv-fiche"></div>
      </section>
      <section class="card venue-request" aria-labelledby="pr-t">
        <div class="card-head"><div><h2 class="card-title" id="pr-t">${icon('calendar')}Demande de cérémonie</h2><p class="card-sub">Proposition soumise à validation</p></div></div>
        ${el.length ? `<div class="card-body">
          <div class="stack" style="gap:14px">
            <div class="field"><label class="label" for="pr-dossier">Dossier approuvé <span class="req" aria-hidden="true">*</span></label>
              <select class="select" id="pr-dossier">${el.map(d => `<option value="${d.ref}" ${d.ref === PF.dossier ? 'selected' : ''}>${d.ref} — ${esc(GO.org(d.org).short)}${GO.cersOf(d.ref)[0] && GO.cersOf(d.ref)[0].state === 'conflit' ? ' (date en conflit)' : ''}</option>`).join('')}</select></div>
            <div class="form-grid" style="margin-top:0;grid-template-columns:1.4fr 1fr">
              <div class="field"><label class="label" for="pr-date">Date proposée <span class="req" aria-hidden="true">*</span></label><input class="input" type="date" id="pr-date" min="${GO.REF_ISO}" value="${PF.date}"></div>
              <div class="field"><label class="label" for="pr-time">Heure</label><select class="select" id="pr-time">${TIMES.map(t => `<option value="${t}" ${t === PF.time ? 'selected' : ''}>${hm(t)}</option>`).join('')}</select></div>
            </div>
          </div>
          <div>
            <h3 style="font-size:13px;margin:16px 0 4px">Vérifications</h3>
            <ul class="check-list" id="pr-checks" aria-live="polite"></ul>
            <h3 style="font-size:13px;margin:14px 0 8px">Récapitulatif</h3>
            <dl class="recap" id="pr-recap"></dl>
            <button class="btn btn-primary btn-block mt" type="button" id="pr-submit">${icon('send')}Soumettre la proposition</button>
            <p class="hint" style="margin-top:8px">La date restera « proposée » tant qu’elle n’a pas été validée par l’autorité compétente.</p>
          </div>
        </div>` : `<div class="card-body">${GO.empty('check-circle', 'Aucun dossier à programmer', 'Tous les dossiers approuvés disposent déjà d’une cérémonie proposée, confirmée ou effectuée.')}</div>`}
      </section>
    </div>`;
    drawVenueList();
    drawFiche();
    $('#pv-q', host).addEventListener('input', GO.debounce(e => { PF.q = e.target.value; drawVenueList(); }, 120));
    $('#pv-list', host).addEventListener('click', e => { const b = e.target.closest('[data-venue]'); if (b) selectVenue(b.dataset.venue); });
    if (el.length) {
      $('#pr-dossier', host).addEventListener('change', e => { PF.dossier = e.target.value; GO.setHash('#/ceremonies/proposer?dossier=' + PF.dossier); drawChecks(); });
      ['date', 'time'].forEach(k => { const sel = $(k === 'date' ? '#pr-date' : '#pr-time', host); ['change', 'input'].forEach(ev => sel.addEventListener(ev, e => { PF[k] = e.target.value; drawChecks(); })); });
      $('#pr-submit', host).addEventListener('click', submitProposal);
      drawChecks();
    }
    if (mapApi) { mapApi.destroy(); mapApi = null; }
    {
      const mapEl = $('#pv-map', host), tok = ++mapTok;
      GOMap.create(mapEl, D.venues, { onSelect: id => selectVenue(id, true) }).then(api => {
        if (tok !== mapTok || !mapEl.isConnected) { api.destroy(); return; }
        mapApi = api;
        $('#pm-sub').textContent = api.kind === 'leaflet' ? 'Carte interactive · positions indicatives à vérifier' : 'Plan schématique · carte interactive non chargée';
        api.filter(venues().map(v => v.id));
        if (PF.venue) api.select(PF.venue);
      });
    }
  }

  function drawVenueList() {
    const list = venues();
    $('#pv-count').textContent = `${plural(list.length, 'lieu', 'lieux')}${PF.q ? ' correspondant à la recherche' : ' référencés'}`;
    $('#pv-list').innerHTML = list.length ? list.map((v, i) => `<button type="button" class="venue-opt row-in" style="--i:${i}" data-venue="${v.id}" aria-pressed="${PF.venue === v.id}">
      <span class="v-ico">${icon(v.kind === 'Mairie' ? 'building' : v.kind === 'Gouvernorat' ? 'flag' : 'medal')}</span>
      <span><strong>${esc(v.name)}</strong><span>${esc(v.city)} · ${esc(v.kind)} · ${v.capacity} places</span></span></button>`).join('')
      : GO.empty('search', 'Aucun lieu trouvé', `Aucun lieu ne correspond à « ${esc(PF.q)} ».`);
    if (mapApi) mapApi.filter(list.map(v => v.id));
  }

  function selectVenue(id, fromMap) {
    PF.venue = id;
    $$('#pv-list [data-venue]').forEach(b => b.setAttribute('aria-pressed', b.dataset.venue === id));
    if (fromMap) { const b = $(`#pv-list [data-venue="${id}"]`); if (b) b.scrollIntoView({ block: 'nearest', behavior: GO.reduced() ? 'auto' : 'smooth' }); }
    if (mapApi) mapApi.select(id);
    drawFiche(); drawChecks();
  }

  function drawFiche() {
    const host = $('#pv-fiche'); if (!host) return;
    const v = PF.venue && GO.venue(PF.venue);
    if (!v) { host.innerHTML = `<div style="padding:16px 18px;border-top:1px solid var(--line-soft)">${GO.empty('pin', 'Aucun lieu sélectionné', 'Choisissez un lieu dans la liste ou sur la carte pour afficher sa fiche.')}</div>`; return; }
    const upcoming = GO.S.ceremonies.filter(c => c.venue === v.id && c.date >= GO.REF_ISO && c.state !== 'termine').sort((a, b) => a.date.localeCompare(b.date));
    host.innerHTML = `<div class="venue-fiche" aria-live="polite">
      <div class="venue-visual" role="img" aria-label="Emplacement réservé à la photographie du lieu">${icon('building')}<span>Photographie officielle du lieu<br>à fournir</span></div>
      <div>
        <span class="pill">${esc(v.kind)} · ${esc(v.province)}</span>
        <h3 style="margin-top:8px">${esc(v.name)}</h3>
        <p class="muted" style="font-size:13px">${esc(v.address)}</p>
        <dl class="venue-facts"><div><dt>Capacité déclarée</dt><dd>${v.capacity} places</dd></div><div><dt>Ville</dt><dd>${esc(v.city)}</dd></div><div><dt>Coordonnées</dt><dd class="tnum">≈ ${v.lat.toFixed(3)}, ${v.lng.toFixed(3)}</dd></div></dl>
        <div class="feature-tags">${v.features.map(f => `<span class="pill">${esc(f)}</span>`).join('')}</div>
        <p style="font-size:12.5px;margin-top:10px" class="muted">${upcoming.length ? `Réservations à venir : ${upcoming.map(c => `${fmtDate(c.date, 'dm')} (${esc(D.ceremonyStates[c.state].label.toLowerCase())})`).join(', ')}` : 'Aucune réservation à venir dans ce lieu.'}</p>
      </div></div>`;
  }

  function checks() {
    const out = [];
    const d = PF.dossier && GO.getDossier(PF.dossier), v = PF.venue && GO.venue(PF.venue);
    out.push(d ? ['ok', `Dossier approuvé : ${plural(d.recipients.length, 'récipiendaire', 'récipiendaires')}`] : ['err', 'Sélectionnez un dossier approuvé']);
    out.push(v ? ['ok', `Lieu sélectionné : ${v.name}`] : ['wait', 'Sélectionnez un lieu']);
    if (!PF.date) out.push(['wait', 'Choisissez une date']);
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(PF.date)) out.push(['err', 'Date invalide']);
    else if (PF.date <= GO.REF_ISO) out.push(['err', 'La date doit être postérieure à aujourd’hui']);
    else if (GO.closure(PF.date)) out.push(['err', `Jour indisponible : ${GO.closure(PF.date).reason}`]);
    else out.push(['ok', `Date disponible au calendrier (${GO.fmtDate(PF.date, 'full')})`]);
    if (v && PF.date && PF.date > GO.REF_ISO) {
      const own = GO.cersOf(PF.dossier)[0];
      if (own && own.state === 'conflit') out.push(['warn', `La date proposée remplacera celle en conflit de ${own.id}`]);
      const clash = GO.S.ceremonies.find(c => c.venue === v.id && c.date === PF.date && c.state !== 'termine' && c !== own && c.state !== 'conflit');
      out.push(clash ? ['err', `Conflit : ${clash.id} est déjà prévue dans ce lieu le ${fmtDate(clash.date, 'dm')} à ${hm(clash.time)}`] : ['ok', 'Aucune autre cérémonie dans ce lieu ce jour-là']);
      const other = GO.S.ceremonies.filter(c => c.date === PF.date && c.venue !== v.id && c.state !== 'termine' && c !== own);
      if (other.length) out.push(['warn', `Autre cérémonie le même jour : ${other.map(c => `${c.id} (${GO.venue(c.venue).city})`).join(', ')}`]);
    }
    return out;
  }

  function drawChecks() {
    const list = $('#pr-checks'); if (!list) return;
    const c = checks();
    const ic = { ok: 'check-circle', err: 'alert-circle', warn: 'alert-triangle', wait: 'clock' };
    list.innerHTML = c.map(([k, t], i) => `<li class="ck-${k}" style="--i:${i}">${icon(ic[k])}<span>${esc(t)}</span><span class="sr-only"> (${{ ok: 'vérifié', err: 'bloquant', warn: 'à vérifier', wait: 'en attente' }[k]})</span></li>`).join('');
    const d = PF.dossier && GO.getDossier(PF.dossier), v = PF.venue && GO.venue(PF.venue);
    $('#pr-recap').innerHTML = `
      <div><dt>Dossier</dt><dd>${d ? `<span class="ref">${d.ref}</span>` : '—'}</dd></div>
      <div><dt>Demandeur</dt><dd>${d ? esc(GO.org(d.org).name) : '—'}</dd></div>
      <div><dt>Autorité destinataire</dt><dd>${d ? esc(GO.authority(d.authority).short) : '—'}</dd></div>
      <div><dt>Lieu</dt><dd>${v ? esc(v.name) : '—'}</dd></div>
      <div><dt>Date et heure</dt><dd>${PF.date ? `${fmtDate(PF.date, 'short')} · ${hm(PF.time)}` : '—'}</dd></div>
      <div><dt>État après envoi</dt><dd>${GO.cerBadge('propose')}</dd></div>`;
    const ok = !c.some(([k]) => k === 'err' || k === 'wait');
    $('#pr-submit').disabled = !ok;
  }

  async function submitProposal() {
    const d = GO.getDossier(PF.dossier), v = GO.venue(PF.venue);
    const ok = await GO.confirmDialog({
      title: 'Soumettre la proposition de cérémonie ?', tone: 'blue', icon: 'send', confirm: 'Soumettre la proposition',
      message: `<dl class="modal-summary"><div><dt>Dossier</dt><dd>${d.ref} — ${esc(GO.org(d.org).short)}</dd></div><div><dt>Lieu</dt><dd>${esc(v.name)}</dd></div><div><dt>Date</dt><dd>${esc(cap(GO.fmtDate(PF.date, 'full')))} · ${hm(PF.time)}</dd></div><div><dt>Récipiendaires</dt><dd>${d.recipients.length}</dd></div></dl>
        <div class="alert alert-info" style="margin-top:12px">${icon('info')}<div>Il s’agit d’une <strong>proposition</strong>. La cérémonie ne sera confirmée qu’après validation par l’autorité compétente.</div></div>`
    });
    if (!ok) return;
    let c = GO.cersOf(d.ref).find(x => x.state === 'conflit');
    if (c) {
      Object.assign(c, { date: PF.date, time: PF.time, venue: PF.venue, state: 'propose' });
      delete c.note;
    } else {
      const n = Math.max(0, ...GO.S.ceremonies.map(x => +x.id.split('-')[2])) + 1;
      c = { id: `CER-2026-${GO.pad(n)}`, dossier: d.ref, date: PF.date, time: PF.time, venue: PF.venue, state: 'propose', proposedBy: `${GO.actorName()} — ${GO.role().label}` };
      GO.S.ceremonies.push(c);
    }
    GO.addHistory(d, 'ceremonie', `Date proposée pour la cérémonie : ${fmtDate(PF.date, 'dm')}, ${v.name}`);
    GO.notify(GO.external()
      ? { type: 'ceremonie', aud: 'service', ref: d.ref, title: 'Proposition de cérémonie reçue', msg: `${GO.org(d.org).name} propose le ${fmtDate(PF.date)} (${v.name}).` }
      : { type: 'ceremonie', aud: 'org:' + d.org, ref: d.ref, title: 'Date de cérémonie proposée', msg: `Le ${fmtDate(PF.date)} à ${v.name}, sous réserve de validation.` });
    GO.notify({ type: 'ceremonie', aud: 'authority:' + d.authority, ref: d.ref, title: 'Date de cérémonie à valider', msg: `${c.id} — ${fmtDate(PF.date)} à ${GO.venue(PF.venue).name}, proposée par ${GO.actorName()}.` });
    GO.commit();
    GO.toast('success', 'Proposition enregistrée', `${esc(c.id)} apparaît au calendrier comme « date proposée ».`);
    const d0 = GO.parseISO(PF.date); CAL.y = d0.getFullYear(); CAL.m = d0.getMonth(); CAL.ev = c.id; CAL.sel = c.date;
    PF.dossier = null; PF.date = ''; PF.venue = null;
    GO.setHash('#/ceremonies/' + c.id);
    const tb = $('#tb-cal'); if (tb) tb.click();
  }

  GO.views.ceremonies = {
    render,
    update(r) {
      applyRoute(r);
      const want = r.id === 'proposer' && GO.can('propose') ? 'prop' : 'cal';
      const btn = $(want === 'prop' ? '#tb-prop' : '#tb-cal');
      if (btn && btn.getAttribute('aria-selected') !== 'true') btn.click();
      else if (want === 'cal') drawCalendar(); else drawProposer();
    }
  };
  void ui;
})(window.GO);
