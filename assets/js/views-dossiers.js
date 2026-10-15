/* ==========================================================================
   GAB-ORIENT — Vues « Vue d'ensemble » et « Dossiers »
   Contient aussi le panneau de détail d'un dossier et les actions métier
   (instruction, complément, note, transmission, décision, relance…).
   ========================================================================== */
(function (GO) {
  'use strict';
  const { $, $$, esc, icon, D, fmtDate, relDay, plural, ageDays, norm } = GO;

  /* ======================= VUE D'ENSEMBLE ======================= */
  function pipelineNotes(list) {
    const by = s => list.filter(d => d.status === s);
    const pendingNotes = by('en_cours').filter(d => GO.docsOf(d.ref).some(x => x.kind === 'transmission' && x.state === 'attente_visa')).length;
    const comp = by('complement').map(d => ageDays(d.complementSince || d.depot));
    return {
      recu: `dont <b>${by('recu').filter(d => ageDays(d.depot) <= 7).length}</b> depuis 7 jours`,
      en_cours: pendingNotes ? `<b>${pendingNotes}</b> note${pendingNotes > 1 ? 's' : ''} à viser` : 'aucune note en attente',
      complement: comp.length ? `plus ancien : <b>${Math.max(...comp)} j</b>` : 'aucun en attente',
      transmis: 'en attente de décision',
      approuve: `<b>${by('approuve').reduce((a, d) => a + d.recipients.length, 0)}</b> récipiendaires`,
      refuse: 'décision notifiée'
    };
  }

  function priorities(list) {
    const out = [];
    list.forEach(d => {
      if (d.status === 'complement') { const n = ageDays(d.complementSince || d.depot); if (n >= 10) out.push({ d, sev: n > 20 ? 3 : 2, cls: 'r-warn', ic: 'alert-triangle', why: `Complément sans réponse depuis ${n} jours` }); }
      if (d.status === 'recu') { const n = ageDays(d.depot); out.push({ d, sev: n >= 7 ? 2 : 1, cls: 'r-info', ic: 'inbox', why: n ? `Reçu il y a ${n} jour${n > 1 ? 's' : ''}, instruction non ouverte` : 'Reçu aujourd’hui' }); }
      if (d.status === 'en_cours' && GO.docsOf(d.ref).some(x => x.kind === 'transmission' && x.state === 'attente_visa')) out.push({ d, sev: 2, cls: 'r-info', ic: 'stamp', why: 'Note de transmission à viser' });
      const c = GO.cersOf(d.ref)[0];
      if (c && c.state === 'conflit') out.push({ d, sev: 3, cls: 'r-alert', ic: 'calendar', why: `Conflit de date : ${fmtDate(c.date, 'dm')} — ${GO.venue(c.venue).name}` });
    });
    return out.sort((a, b) => b.sev - a.sev || ageDays(b.d.depot) - ageDays(a.d.depot)).slice(0, 6);
  }

  function renderApercu(main) {
    const S = GO.S, list = GO.myDossiers(), demandeur = !!GO.role().scope;
    const u = GO.user();
    const counts = Object.fromEntries(D.statusOrder.map(s => [s, list.filter(d => d.status === s).length]));
    const notes = pipelineNotes(list);
    const prio = priorities(list);
    const upcoming = GO.myCers().filter(c => c.date >= GO.REF_ISO && c.state !== 'termine').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const next = upcoming.find(c => c.state !== 'conflit') || upcoming[0];
    const activity = list.flatMap(d => d.history.map(h => Object.assign({ ref: d.ref }, h))).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 5);
    const queue = demandeur
      ? GO.myDocs().slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)
      : GO.myDocs().filter(x => x.state === 'attente_visa' || x.state === 'illisible');
    const first = u.name.split(' ')[0];

    main.innerHTML = `
      <section class="page-head reveal">
        <div>
          <div class="page-eyebrow">${esc(GO.fmtDate(GO.REF_ISO, 'full'))}</div>
          <h1 class="page-title">Vue d’ensemble</h1>
          <p class="page-sub">Bonjour ${esc(first)}. ${demandeur ? `Suivi des demandes de ${esc(GO.org(GO.role().scope).name)}.` : `Situation de l’instruction des distinctions au ${fmtDate(GO.REF_ISO)}.`}</p>
        </div>
        <div class="page-actions">
          ${GO.can('propose') ? `<a class="btn btn-secondary" href="#/ceremonies/proposer">${icon('pin')}Proposer une cérémonie</a>` : ''}
          ${GO.can('create') ? `<a class="btn btn-primary" href="#/nouveau">${icon('plus')}Nouveau dossier</a>` : ''}
        </div>
      </section>

      <section class="card reveal" style="--i:1" aria-labelledby="pipe-t">
        <div class="card-head"><div><h2 class="card-title" id="pipe-t">${icon('folder')}File d’instruction</h2><p class="card-sub">${plural(list.length, 'dossier', 'dossiers')} · répartition par statut · cliquer pour filtrer la liste</p></div>
          <a class="btn btn-ghost btn-sm" href="#/dossiers?status=all">Tous les dossiers ${icon('arrow-right', 'ic-sm')}</a></div>
        <div class="pipeline">
          <div class="pipe-bar" role="img" aria-label="Répartition des ${list.length} dossiers par statut">
            ${D.statusOrder.map(s => `<span class="pipe-seg tone-${D.statuses[s].tone}" data-grow="${counts[s]}" data-tip="<strong>${esc(D.statuses[s].label)}</strong>${counts[s]} dossier${counts[s] > 1 ? 's' : ''}"></span>`).join('')}
          </div>
          <div class="pipe-cells">
            ${D.statusOrder.map(s => `<button type="button" class="pipe-cell tone-${D.statuses[s].tone}" data-go="#/dossiers?status=${s}" aria-label="${esc(D.statuses[s].label)} : ${counts[s]} dossiers. Afficher la liste.">
              <span class="pipe-cell-label"><i></i>${esc(D.statuses[s].label)}</span>
              <span class="pipe-cell-value" data-count="${counts[s]}">0</span>
              <span class="pipe-cell-note">${notes[s]}</span></button>`).join('')}
          </div>
        </div>
      </section>

      <div class="grid grid-main mt">
        <section class="card reveal" style="--i:2" aria-labelledby="prio-t">
          <div class="card-head"><div><h2 class="card-title" id="prio-t">${icon('flag')}${demandeur ? 'Points d’attention' : 'Dossiers prioritaires'}</h2><p class="card-sub">Calculé à partir des délais et des étapes en attente</p></div></div>
          ${prio.length ? `<div class="table-wrap" style="border-top:0"><table class="data-table responsive"><thead><tr><th scope="col">Dossier</th><th scope="col">Demandeur</th><th scope="col">Motif</th><th scope="col"><span class="sr-only">Action</span></th></tr></thead><tbody>
            ${prio.map((p, i) => { const o = GO.org(p.d.org); return `<tr class="row-in" style="--i:${i}">
              <td data-label="Dossier"><span class="ref">${esc(p.d.ref)}</span></td>
              <td data-label="Demandeur"><div class="cell-org"><strong>${esc(o.short)}</strong><span>${esc(o.city)}</span></div></td>
              <td class="td-wide" data-label="Motif"><span class="prio-reason ${p.cls}">${icon(p.ic)}${esc(p.why)}</span></td>
              <td class="cell-actions"><a class="btn btn-secondary btn-sm" href="#/dossiers/${esc(p.d.ref)}">Ouvrir</a></td></tr>`; }).join('')}
            </tbody></table></div>` : GO.empty('check-circle', 'Aucun point bloquant', 'Tous les dossiers suivent leur circuit sans retard particulier.')}
        </section>

        <section class="card next-cer reveal" style="--i:3" aria-labelledby="next-t">
          ${next ? (() => { const v = GO.venue(next.venue), d = GO.getDossier(next.dossier), o = GO.org(d.org), n = GO.daysBetween(GO.REF_ISO, next.date); return `
          <div class="next-cer-main">
            <div>
              <span class="countdown">${n === 0 ? 'Aujourd’hui' : `dans <b>${n}</b> jour${n > 1 ? 's' : ''}`}</span>
              <h2 class="sr-only" id="next-t">Prochaine cérémonie</h2>
              <h3>Remise des médailles — ${esc(o.short)}</h3>
              ${GO.cerBadge(next.state)}
              <div class="next-cer-date">${esc(fmtDate(next.date, 'full').replace(/^\w/, c => c.toUpperCase()))}</div>
              <div class="next-cer-meta"><span>${icon('clock')}${esc(next.time.replace(':', ' h '))}</span><span>${icon('pin')}${esc(v.name)}, ${esc(v.city)}</span><span>${icon('users')}${plural(d.recipients.length, 'récipiendaire', 'récipiendaires')}</span></div>
            </div>
            <span class="rosette" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#i-star"/></svg></span>
          </div>`; })() : `<div class="card-head"><h2 class="card-title" id="next-t">${icon('calendar')}Prochaine cérémonie</h2></div>${GO.empty('calendar', 'Aucune cérémonie à venir', 'Les cérémonies proposées ou confirmées apparaîtront ici.')}`}
          <ul class="mini-agenda">${upcoming.filter(c => c !== next).slice(0, 3).map(c => { const d = GO.parseISO(c.date); const o = GO.org(GO.getDossier(c.dossier).org); return `
            <li><span class="date-tile"><b>${d.getDate()}</b><span>${GO.MONTHS_S[d.getMonth()]}</span></span>
              <span><strong>${esc(o.short)} · ${esc(c.id)}</strong><small>${esc(GO.venue(c.venue).name)}</small></span>${GO.cerBadge(c.state)}</li>`; }).join('')}</ul>
          <div class="card-foot"><span class="muted" style="font-size:12px">${plural(upcoming.length, 'cérémonie à venir', 'cérémonies à venir')}</span><a class="btn btn-ghost btn-sm" href="#/ceremonies">Calendrier ${icon('arrow-right', 'ic-sm')}</a></div>
        </section>
      </div>

      <div class="grid grid-3 mt">
        <section class="card reveal" style="--i:4" aria-labelledby="dep-t">
          <div class="card-head"><div><h2 class="card-title" id="dep-t">${icon('chart')}Dépôts mensuels</h2><p class="card-sub">Nombre de dossiers déposés en 2026</p></div>
            ${GO.role().views.includes('statistiques') ? `<a class="btn btn-ghost btn-sm" href="#/statistiques">Détails</a>` : ''}</div>
          <div class="card-body"><div class="chart" id="ch-dep"></div><dl class="dl-grid mt" id="dep-sum" style="grid-template-columns:repeat(3,minmax(0,1fr));padding-top:14px;border-top:1px solid var(--line-soft)"></dl></div>
        </section>
        <section class="card reveal" style="--i:5" aria-labelledby="act-t">
          <div class="card-head"><div><h2 class="card-title" id="act-t">${icon('clock')}Activité récente</h2><p class="card-sub">Derniers événements des dossiers</p></div></div>
          <div class="card-body"><ol class="timeline">${activity.map(h => `
            <li class="tl-item"><span class="tl-dot k-${esc(h.kind)}">${icon('check')}</span>
              <div class="tl-body"><strong>${esc(h.label)}</strong><div class="tl-meta">${GO.refChip(h.ref)}<span>${esc(h.actor)}</span><span>${esc(relDay(h.date))} · ${esc(h.time)}</span></div></div></li>`).join('')}</ol></div>
        </section>
        <section class="card reveal" style="--i:6" aria-labelledby="visa-t">
          <div class="card-head"><div><h2 class="card-title" id="visa-t">${icon(demandeur ? 'mail' : 'stamp')}${demandeur ? 'Courriers récents' : 'Courriers à traiter'}</h2><p class="card-sub">${demandeur ? 'Échanges avec le Service des Distinctions' : 'Visas attendus et pièces à renumériser'}</p></div></div>
          ${queue.length ? `<ul class="visa-queue">${queue.map(x => `<li><span class="doc-ico t-${x.type}">${icon(x.type === 'note' ? 'stamp' : 'file')}</span>
              <span><strong>${esc(x.title)}</strong><span>${esc(x.dossier)} · ${esc(fmtDate(x.date, 'short'))}</span><br>${GO.docBadge(x.state)}</span>
              <a class="btn btn-secondary btn-sm" href="#/courriers/${x.id}">Consulter</a></li>`).join('')}</ul>`
            : GO.empty('check-circle', 'Aucun courrier en attente', 'Les notes à viser et les pièces à renumériser apparaîtront ici.')}
        </section>
      </div>`;

    // Animations : barre segmentée et compteurs
    requestAnimationFrame(() => {
      $$('.pipe-seg', main).forEach(s => { s.style.flexGrow = s.dataset.grow; s.style.setProperty('--dot', getComputedStyle(s).getPropertyValue('--dot')); });
      $$('[data-count]', main).forEach(n => GO.countUp(n, +n.dataset.count));
    });
    $$('.pipe-cell', main).forEach(b => b.addEventListener('click', () => { location.hash = b.dataset.go; }));
    const months = []; for (let m = 0; m <= GO.REF.getMonth(); m++) months.push(m);
    const perMonth = months.map(m => list.filter(d => GO.parseISO(d.depot).getMonth() === m && d.depot.startsWith('2026')).length);
    const top = perMonth.indexOf(Math.max(...perMonth));
    const tot = perMonth.reduce((a, b) => a + b, 0);
    $('#dep-sum', main).innerHTML = `<div><dt>Total 2026</dt><dd>${plural(tot, 'dossier', 'dossiers')}</dd></div>
      <div><dt>Mois le plus actif</dt><dd>${tot ? esc(GO.MONTHS[months[top]]) + ' (' + perMonth[top] + ')' : '—'}</dd></div>
      <div><dt>Moyenne mensuelle</dt><dd>${(tot / months.length).toFixed(1).replace('.', ',')}</dd></div>`;
    GOCharts.mount($('#ch-dep', main), 'bar', {
      labels: months.map(m => GO.MONTHS[m] + ' 2026'), short: months.map(m => GO.MONTHS_S[m].replace('.', '')),
      values: perMonth,
      unit: 'dossier(s) déposé(s)', height: 200, color: 'var(--navy-800)', aria: 'Dossiers déposés par mois en 2026'
    });
  }
  GO.views.apercu = { render: renderApercu };

  /* ======================= DOSSIERS ======================= */
  const DF = { q: '', status: 'all', period: 'all', sort: 'activity' };
  const PERIODS = { all: 'Toutes les périodes', d30: '30 derniers jours', T4: '4ᵉ trimestre 2026', T3: '3ᵉ trimestre 2026', T2: '2ᵉ trimestre 2026', T1: '1ᵉʳ trimestre 2026' };
  const SORTS = { activity: 'Dernière activité', depot_desc: 'Dépôt le plus récent', depot_asc: 'Dépôt le plus ancien', ref: 'Référence', recips: 'Nombre de récipiendaires' };

  function inPeriod(d) {
    if (DF.period === 'all') return true;
    if (DF.period === 'd30') return ageDays(d.depot) <= 30 && ageDays(d.depot) >= 0;
    const q = +DF.period.slice(1), m = GO.parseISO(d.depot).getMonth();
    return d.depot.startsWith('2026') && Math.floor(m / 3) + 1 === q;
  }
  function filtered() {
    const q = norm(DF.q.trim());
    let list = GO.myDossiers().filter(d => {
      const o = GO.org(d.org);
      return (!q || norm(`${d.ref} ${o.name} ${o.short} ${o.city}`).includes(q)) && inPeriod(d);
    });
    const counts = Object.fromEntries(['all', ...D.statusOrder].map(s => [s, s === 'all' ? list.length : list.filter(d => d.status === s).length]));
    if (DF.status !== 'all') list = list.filter(d => d.status === DF.status);
    const la = d => { const h = GO.lastActivity(d); return h.date + h.time; };
    const sorters = { activity: (a, b) => la(b).localeCompare(la(a)), depot_desc: (a, b) => b.depot.localeCompare(a.depot), depot_asc: (a, b) => a.depot.localeCompare(b.depot), ref: (a, b) => a.ref.localeCompare(b.ref), recips: (a, b) => b.recipients.length - a.recipients.length };
    return { list: list.sort(sorters[DF.sort]), counts };
  }

  function renderDossiers(main, r) {
    if (r.params.get('status')) DF.status = r.params.get('status');
    if (!['all', ...D.statusOrder].includes(DF.status)) DF.status = 'all';
    main.innerHTML = `
      <section class="page-head reveal">
        <div><div class="page-eyebrow">Instruction</div><h1 class="page-title">Dossiers</h1>
          <p class="page-sub">${GO.role().scope ? 'Demandes déposées par votre organisme et leur avancement.' : 'Consultation et suivi des demandes de distinctions : recherche, filtres et détail de chaque dossier.'}</p></div>
        <div class="page-actions">${GO.can('create') ? `<a class="btn btn-primary" href="#/nouveau">${icon('plus')}Nouveau dossier</a>` : ''}</div>
      </section>
      <section class="card reveal" style="--i:1">
        <div class="toolbar">
          <div class="field grow"><label class="mini-label" for="df-q">Rechercher</label><div class="search-field">${icon('search')}<input id="df-q" class="input" type="search" placeholder="Référence ou demandeur…" value="${esc(DF.q)}" autocomplete="off"></div></div>
          <div class="field"><label class="mini-label" for="df-period">Période de dépôt</label><select id="df-period" class="select">${Object.entries(PERIODS).map(([k, v]) => `<option value="${k}" ${k === DF.period ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <div class="field"><label class="mini-label" for="df-sort">Trier par</label><select id="df-sort" class="select">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${k === DF.sort ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        </div>
        <div class="filter-bar">
          <div class="chip-row" role="group" aria-label="Filtrer par statut" id="df-chips"></div>
          <span class="result-count" id="df-count" aria-live="polite"></span>
        </div>
        <div class="table-wrap" id="df-wrap">
          <table class="data-table responsive" id="df-table">
            <caption class="sr-only">Liste des dossiers de distinction</caption>
            <thead><tr><th scope="col">Référence</th><th scope="col">Demandeur</th><th scope="col">Dépôt</th><th scope="col" class="num">Récip.</th><th scope="col">Étape</th><th scope="col">Statut</th><th scope="col">Dernière activité</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
            <tbody></tbody>
          </table>
          <div id="df-empty"></div>
        </div>
      </section>`;
    const refresh = () => drawList(main, true);
    const q = $('#df-q', main);
    q.addEventListener('input', GO.debounce(() => { DF.q = q.value; refresh(); }, 160));
    q.addEventListener('input', () => $('#df-wrap', main).classList.add('is-filtering'));
    $('#df-period', main).addEventListener('change', e => { DF.period = e.target.value; refresh(); });
    $('#df-sort', main).addEventListener('change', e => { DF.sort = e.target.value; refresh(); });
    $('#df-chips', main).addEventListener('click', e => {
      const c = e.target.closest('[data-s]'); if (!c) return;
      DF.status = c.dataset.s; GO.setHash('#/dossiers' + (DF.status !== 'all' ? '?status=' + DF.status : '')); refresh();
    });
    $('#df-table', main).addEventListener('click', e => {
      const btn = e.target.closest('[data-open]');
      const tr = e.target.closest('tr[data-ref]');
      if (btn || (tr && !e.target.closest('a,button'))) { location.hash = '#/dossiers/' + (btn ? btn.dataset.open : tr.dataset.ref); }
    });
    main.addEventListener('click', e => { if (e.target.closest('[data-reset-filters]')) { DF.q = ''; DF.status = 'all'; DF.period = 'all'; q.value = ''; $('#df-period', main).value = 'all'; GO.setHash('#/dossiers'); refresh(); q.focus(); } });
    drawList(main, false);
    if (r.id) openDossier(r.id);
  }

  function drawList(main, animate) {
    const { list, counts } = filtered();
    $('#df-chips', main).innerHTML = ['all', ...D.statusOrder].map(s => `<button type="button" class="chip ${s !== 'all' ? 'tone-' + D.statuses[s].tone : ''}" data-s="${s}" aria-pressed="${DF.status === s}">
      ${s !== 'all' ? '<span class="sdot"></span>' : ''}${s === 'all' ? 'Tous' : esc(D.statuses[s].short)}<span class="chip-n">${counts[s]}</span></button>`).join('');
    $('#df-count', main).innerHTML = `<strong>${list.length}</strong> ${list.length > 1 ? 'dossiers affichés' : 'dossier affiché'}`;
    const sel = GO.drawerKey();
    $('#df-table tbody', main).innerHTML = list.map((d, i) => {
      const o = GO.org(d.org), la = GO.lastActivity(d);
      return `<tr class="is-clickable ${animate !== false ? 'row-in' : ''} ${sel === d.ref ? 'is-selected' : ''}" style="--i:${i}" data-ref="${d.ref}">
        <td class="td-head" data-label="Référence"><span class="ref">${d.ref}</span></td>
        <td class="td-wide" data-label="Demandeur"><div class="cell-org"><strong>${esc(o.name)}</strong><span>${esc(o.sector)} · ${esc(o.city)}</span></div></td>
        <td data-label="Dépôt" class="tnum nowrap">${fmtDate(d.depot, 'short')}</td>
        <td data-label="Récipiendaires" class="num">${d.recipients.length}</td>
        <td data-label="Étape">${GO.stepMini(d)}</td>
        <td data-label="Statut">${GO.statusBadge(d.status)}</td>
        <td class="td-wide" data-label="Dernière activité"><div class="cell-org"><span style="color:var(--ink);font-size:13px">${esc(la.label)}</span><span>${esc(relDay(la.date))}</span></div></td>
        <td class="cell-actions"><button type="button" class="btn btn-secondary btn-sm" data-open="${d.ref}" aria-label="Ouvrir le dossier ${d.ref}">Ouvrir</button></td>
      </tr>`;
    }).join('');
    $('#df-table', main).hidden = !list.length;
    $('#df-empty', main).innerHTML = list.length ? '' : GO.empty('search', 'Aucun dossier ne correspond', 'Modifiez la recherche, la période ou le statut pour élargir les résultats.', '<button type="button" class="btn btn-secondary btn-sm" data-reset-filters>Réinitialiser les filtres</button>');
    $('#df-wrap', main).classList.remove('is-filtering');
  }

  function updateDossiers(r) {
    const main = $('#view');
    if (r.params.get('status') && r.params.get('status') !== DF.status) { DF.status = r.params.get('status'); drawList(main, true); }
    if (r.id) openDossier(r.id); else if (GO.isDrawerOpen()) GO.closeDrawer(true);
  }

  /* ---------- Panneau de détail ---------- */
  function openDossier(ref) {
    const d = GO.getDossier(ref);
    if (!d || !GO.myDossiers().includes(d)) { GO.toast('error', 'Dossier introuvable', `La référence ${esc(ref)} n’existe pas ou n’est pas accessible avec ce profil.`); GO.setHash('#/dossiers'); return; }
    GO.openDrawer({ key: ref, html: panelHTML(d), onClose: () => { GO.setHash('#/dossiers' + (DF.status !== 'all' ? '?status=' + DF.status : '')); markSelected(null); } });
    bindPanel(d);
    markSelected(ref);
  }
  function markSelected(ref) { $$('#df-table tbody tr').forEach(tr => tr.classList.toggle('is-selected', tr.dataset.ref === ref)); }

  function medalSummary(d) {
    const c = {}; d.recipients.forEach(r => { c[r.medal] = (c[r.medal] || 0) + 1; });
    return D.medals.filter(m => c[m.id]).map(m => `${c[m.id]} ${m.short}`).join(' · ');
  }
  function nextSteps(d) {
    const note = GO.docsOf(d.ref).find(x => x.kind === 'transmission');
    const c = GO.cersOf(d.ref)[0];
    switch (d.status) {
      case 'recu': return ['Vérifier la recevabilité de la demande et des pièces jointes', 'Ouvrir l’instruction ou demander un complément'];
      case 'en_cours': return !note ? ['Contrôler les récipiendaires et les pièces', 'Préparer la note de transmission à la hiérarchie']
        : note.state === 'attente_visa' ? ['Faire viser la note de transmission par le Chef du Service', 'Transmettre ensuite le dossier au Directeur général'] : ['Transmettre le dossier au Directeur général'];
      case 'complement': return [`Attendre le complément demandé le ${fmtDate(d.complementSince)}`, 'Relancer le demandeur si le délai se prolonge'];
      case 'transmis': return ['Attendre la décision de l’autorité compétente', 'Enregistrer la décision dès réception du courrier'];
      case 'approuve':
        if (!c) return ['Proposer une date et un lieu pour la cérémonie de remise'];
        if (c.state === 'termine') return [`Dossier clos : remise effectuée le ${fmtDate(c.date)}`];
        if (c.state === 'conflit') return ['Proposer une nouvelle date ou un autre lieu (conflit identifié)'];
        if (c.state === 'confirme') return [`Préparer la cérémonie du ${fmtDate(c.date)} (${GO.venue(c.venue).name})`, 'Préparer les médailles et la liste d’appel'];
        return [`Obtenir la validation de la date proposée (${fmtDate(c.date)})`];
      case 'refuse': return ['Informer le demandeur de la décision', 'Un recours reste possible selon les conditions prévues par la procédure'];
    }
    return [];
  }

  function actionsFor(d) {
    const a = [];
    const can = GO.can;
    const note = GO.docsOf(d.ref).find(x => x.kind === 'transmission');
    if (d.status === 'recu') {
      if (can('complement')) a.push(['complement', 'secondary', 'paperclip', 'Demander un complément']);
      if (can('instruct')) a.push(['instruct', 'primary', 'check', 'Ouvrir l’instruction']);
    }
    if (d.status === 'en_cours') {
      if (can('complement')) a.push(['complement', 'secondary', 'paperclip', 'Demander un complément']);
      if (!note && can('note')) a.push(['note', 'primary', 'file', 'Préparer la note de transmission']);
      if (note && note.state === 'attente_visa') {
        if (can('visa')) a.push(['visa', 'primary', 'stamp', 'Viser la note']);
        else if (can('note')) a.push(['', 'secondary', 'clock', 'Transmettre', 'La note doit d’abord être visée par le Chef du Service']);
      }
      if (note && note.state === 'vise') {
        if (can('transmit')) a.push(['transmit', 'primary', 'send', 'Transmettre à la hiérarchie']);
        else if (can('note')) a.push(['', 'secondary', 'send', 'Transmettre', 'Transmission réservée au Chef du Service']);
      }
    }
    if (d.status === 'complement') {
      if (can('relance')) a.push(['relance', 'secondary', 'refresh', 'Relancer le demandeur']);
      if (can('answer')) a.push(['answer', 'primary', 'upload', 'Déposer le complément']);
    }
    if (d.status === 'transmis' && can('decide')) a.push(['decide', 'primary', 'check-circle', 'Enregistrer la décision']);
    if (d.status === 'approuve') {
      const ac = GO.activeCer(d.ref), last = GO.cersOf(d.ref)[0];
      if (ac) a.push(['cer', 'secondary', 'calendar', 'Voir la cérémonie']);
      else if (!(last && last.state === 'termine') && can('propose')) a.push(['propose', 'primary', 'pin', last && last.state === 'conflit' ? 'Proposer une nouvelle date' : 'Programmer la cérémonie']);
      else if (last && last.state === 'termine') a.push(['cer', 'secondary', 'calendar', 'Voir la cérémonie']);
    }
    return a;
  }

  function panelHTML(d) {
    const o = GO.org(d.org), la = GO.lastActivity(d), docs = GO.docsOf(d.ref).filter(x => !GO.role().scope || !x.internal);
    const canDocs = GO.role().views.includes('courriers');
    const hist = GO.sortHist(d.history).reverse();
    const acts = actionsFor(d);
    const html = `
      <header class="drawer-head">
        <div class="drawer-head-top"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="ref-chip ref">${d.ref}</span><span id="dp-status">${GO.statusBadge(d.status)}</span></div>
          <button class="icon-btn" type="button" data-dclose aria-label="Fermer le détail du dossier">${icon('x')}</button></div>
        <h2 class="drawer-title" id="drawer-title">${esc(o.name)}</h2>
        <p class="drawer-sub">Déposé le ${fmtDate(d.depot)} · ${plural(d.recipients.length, 'récipiendaire', 'récipiendaires')} · ${d.agent ? 'instruit par ' + esc(d.agent) : 'agent instructeur non désigné'}</p>
      </header>
      <div class="drawer-body">
        <section class="d-section" style="--i:0" aria-labelledby="ds-id">
          <div class="d-section-head"><h3 id="ds-id">${icon('folder')}Identification du dossier</h3></div>
          ${GO.stepper(d)}
          <dl class="dl-grid mt">
            <div><dt>Référence</dt><dd class="ref">${d.ref}</dd></div>
            <div><dt>Date de dépôt</dt><dd>${fmtDate(d.depot)}</dd></div>
            <div><dt>Statut</dt><dd>${esc(D.statuses[d.status].label)}</dd></div>
            <div><dt>Dernière activité</dt><dd>${esc(la.label)} <span class="muted">· ${esc(relDay(la.date))}</span></dd></div>
            <div><dt>Médailles proposées</dt><dd>${esc(medalSummary(d))}</dd></div>
            <div><dt>Agent instructeur</dt><dd>${esc(d.agent || '—')}</dd></div>
          </dl>
        </section>
        <section class="d-section" style="--i:1" aria-labelledby="ds-dem">
          <div class="d-section-head"><h3 id="ds-dem">${icon('building')}Demandeur</h3></div>
          <dl class="dl-grid">
            <div><dt>Organisme</dt><dd>${esc(o.name)}</dd></div>
            <div><dt>Type · secteur</dt><dd>${esc(o.type)} · ${esc(o.sector)}</dd></div>
            <div><dt>Interlocuteur</dt><dd>${esc(o.contact)}<br><span class="muted" style="font-weight:400;font-size:12px">${esc(o.contactRole)}</span></dd></div>
            <div><dt>Coordonnées</dt><dd><a href="mailto:${esc(o.email)}">${esc(o.email)}</a><br><span class="tnum" style="font-weight:400">${esc(o.phone)}</span></dd></div>
          </dl>
        </section>
        <section class="d-section" style="--i:2" aria-labelledby="ds-rec">
          <div class="d-section-head"><h3 id="ds-rec">${icon('users')}Récipiendaires <span class="n">${d.recipients.length}</span></h3></div>
          <div class="mini-table"><table><thead><tr><th scope="col">Nom</th><th scope="col">Fonction</th><th scope="col">Ancienneté</th><th scope="col">Médaille</th></tr></thead><tbody>
            ${d.recipients.map(r => `<tr><td><strong style="color:var(--navy-900)">${esc(r.nom.toUpperCase())}</strong> ${esc(r.prenom)}</td><td>${esc(r.fonction)}</td><td class="tnum" title="Entrée le ${fmtDate(r.entree)}">${GO.seniority(r.entree)} ans</td><td>${esc(GO.medal(r.medal).short)}</td></tr>`).join('')}
          </tbody></table></div>
        </section>
        <section class="d-section" style="--i:3" aria-labelledby="ds-doc">
          <div class="d-section-head"><h3 id="ds-doc">${icon('paperclip')}Pièces jointes et courriers <span class="n">${docs.length}</span></h3>${canDocs && docs.length ? `<a class="btn btn-ghost btn-xs" href="#/courriers?dossier=${d.ref}">Tout consulter</a>` : ''}</div>
          ${docs.length ? docs.map(x => `<div class="doc-mini"><span class="doc-ico t-${x.type}">${icon('file')}</span><div><strong>${esc(x.title)}</strong><span>${esc(D.docTypes[x.type])} · ${fmtDate(x.date, 'short')} · ${esc(x.from)}</span><div style="margin-top:4px">${GO.docBadge(x.state)}</div></div>
            ${canDocs ? `<a class="btn btn-secondary btn-xs" href="#/courriers/${x.id}">${icon('eye', 'ic-sm')}Consulter</a>` : ''}</div>`).join('') : `<p class="muted" style="font-size:13px">Aucun courrier numérisé n’est rattaché à ce dossier.</p>`}
        </section>
        <section class="d-section" style="--i:4" aria-labelledby="ds-hist">
          <div class="d-section-head"><h3 id="ds-hist">${icon('send')}Historique des transmissions</h3></div>
          <ol class="timeline">${hist.map(h => `<li class="tl-item ${h.isNew ? 'is-new' : ''}"><span class="tl-dot k-${h.kind === 'decision' && /refus/i.test(h.label) ? 'refus' : esc(h.kind)}">${icon(h.kind === 'complement' || h.kind === 'relance' ? 'paperclip' : 'check')}</span>
            <div class="tl-body"><strong>${esc(h.label)}</strong><div class="tl-meta"><span>${esc(h.actor)}</span><span class="tnum">${fmtDate(h.date, 'short')} · ${esc(h.time)}</span></div></div></li>`).join('')}</ol>
        </section>
        <section class="d-section" style="--i:5" aria-labelledby="ds-obs">
          <div class="d-section-head"><h3 id="ds-obs">${icon('message')}Décisions et observations</h3></div>
          <div id="dp-obs">${d.observations.length ? d.observations.map(x => `<div class="obs"><div class="obs-meta">${esc(x.author)} · ${fmtDate(x.date, 'short')}</div>${esc(x.text)}</div>`).join('') : '<p class="muted" style="font-size:13px">Aucune observation enregistrée.</p>'}</div>
          ${GO.can('observe') ? `<form class="mt" id="dp-obs-form" novalidate><div class="field"><label class="label" for="dp-obs-text">Ajouter une observation</label>
            <textarea class="textarea" id="dp-obs-text" rows="2" placeholder="Observation visible par le service instructeur…" style="min-height:64px"></textarea></div>
            <div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn btn-secondary btn-sm" type="submit">${icon('plus', 'ic-sm')}Ajouter</button></div></form>` : ''}
        </section>
        <section class="d-section" style="--i:6" aria-labelledby="ds-next">
          <div class="d-section-head"><h3 id="ds-next">${icon('arrow-right')}Prochaines étapes</h3></div>
          <ul class="next-steps">${nextSteps(d).map(s => `<li>${icon('chevron-right')}<span>${esc(s)}</span></li>`).join('')}</ul>
        </section>
      </div>
      <footer class="drawer-foot">
        ${acts.length ? '' : `<span class="muted" style="font-size:13px">${GO.role().scope ? 'Aucune action attendue de votre part.' : 'Aucune action disponible pour ce profil à cette étape.'}</span>`}
        <span class="spacer"></span>
        ${acts.map(([k, kind, ic, label, tip]) => tip
          ? `<span data-tip="${esc(tip)}" tabindex="0"><button type="button" class="btn btn-${kind}" disabled>${icon(ic)}${esc(label)}</button></span>`
          : `<button type="button" class="btn btn-${kind}" data-act="${k}">${icon(ic)}${esc(label)}</button>`).join('')}
      </footer>`;
    d.history.forEach(h => { delete h.isNew; });
    return html;
  }

  function bindPanel(d) {
    const root = document.querySelector('.drawer');
    if (!root) return;
    root.onclick = e => { const b = e.target.closest('[data-act]'); if (b) ACTIONS[b.dataset.act](d, b); };
    const f = $('#dp-obs-form', root);
    if (f) f.onsubmit = e => {
      e.preventDefault();
      const t = $('#dp-obs-text', root), v = t.value.trim();
      const fld = t.closest('.field');
      $$('.error-msg', fld).forEach(n => n.remove());
      if (v.length < 5) { t.setAttribute('aria-invalid', 'true'); fld.insertAdjacentHTML('beforeend', `<p class="error-msg" id="obs-err">${icon('alert-circle')}Saisissez une observation d’au moins 5 caractères.</p>`); t.setAttribute('aria-describedby', 'obs-err'); t.focus(); return; }
      t.removeAttribute('aria-invalid');
      d.observations.push({ date: GO.REF_ISO, author: GO.user().name, text: v });
      GO.commit(); refreshDossier(d, false);
      GO.toast('success', 'Observation ajoutée', d.ref);
    };
  }

  function refreshDossier(d, flash = true) {
    if (GO.isDrawerOpen() && GO.drawerKey() === d.ref) {
      GO.setDrawer(panelHTML(d)); bindPanel(d);
      if (flash) { const b = $('#dp-status .badge'); if (b) b.classList.add('is-changed'); }
    }
    if (GO.current().view === 'dossiers') drawList($('#view'), false), markSelected(d.ref);
    const row = $(`#df-table tr[data-ref="${d.ref}"] .badge`);
    if (row && flash) row.classList.add('is-changed');
  }
  GO.refreshDossier = refreshDossier;

  function nextDocNumber() {
    const nums = GO.S.documents.map(x => /N° (\d+)\/SDN/.exec(x.number || '')).filter(Boolean).map(m => +m[1]);
    return `N° ${Math.max(100, ...nums) + 1}/SDN`;
  }
  function newDoc(o) { const doc = Object.assign({ id: 'd' + Date.now().toString(36), pages: 1 }, o); GO.S.documents.push(doc); return doc; }
  GO.newDoc = newDoc; GO.nextDocNumber = nextDocNumber;

  function fieldError(field, msg) {
    $$('.error-msg', field).forEach(n => n.remove());
    field.classList.toggle('has-error', !!msg);
    const ctl = $('input,textarea,select', field);
    if (msg) { const id = 'e' + Math.random().toString(36).slice(2, 7); field.insertAdjacentHTML('beforeend', `<p class="error-msg" id="${id}">${icon('alert-circle')}${esc(msg)}</p>`); if (ctl) { ctl.setAttribute('aria-invalid', 'true'); ctl.setAttribute('aria-describedby', id); } }
    else if (ctl) { ctl.removeAttribute('aria-invalid'); ctl.removeAttribute('aria-describedby'); }
  }
  GO.fieldError = fieldError;

  async function withLoading(btn, ms) {
    btn.classList.add('is-loading');
    const html = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span>${btn.textContent.trim()}`;
    await GO.wait(ms);
    btn.innerHTML = html; btn.classList.remove('is-loading');
  }
  GO.withLoading = withLoading;

  const ACTIONS = {
    async instruct(d, btn) {
      await withLoading(btn, 450);
      d.status = 'en_cours';
      d.agent = d.agent || (GO.user().name.split(' ')[0][0] + '. ' + GO.user().name.split(' ').slice(1).join(' '));
      GO.addHistory(d, 'instruction', 'Recevabilité confirmée — instruction ouverte');
      GO.notify({ type: 'transmission', aud: 'org:' + d.org, ref: d.ref, title: 'Instruction ouverte', msg: 'Votre dossier est recevable. L’instruction est en cours.' });
      GO.commit(); refreshDossier(d);
      GO.toast('success', 'Instruction ouverte', `${d.ref} passe à l’étape « Instruction ».`);
    },
    complement(d) {
      GO.modal({
        title: 'Demander un complément', tone: 'yellow', icon: 'paperclip', size: 'lg',
        body: `<p>Le demandeur <strong>${esc(GO.org(d.org).name)}</strong> recevra un courrier précisant les éléments attendus. Le dossier passera au statut « Complément demandé ».</p>
          <div class="field"><label class="label" for="cp-text">Éléments demandés <span class="req" aria-hidden="true">*</span></label>
            <textarea class="textarea" id="cp-text" required placeholder="Exemple : attestations d’ancienneté lisibles pour les récipiendaires proposés."></textarea>
            <span class="hint">Ce texte figurera dans le courrier adressé au demandeur.</span></div>`,
        actions: [{ label: 'Annuler', value: 'cancel' }, { label: 'Envoyer la demande', value: 'ok', kind: 'primary', icon: 'send' }],
        onAction: async (v, h, b) => {
          const t = $('#cp-text', h.el); const val = t.value.trim();
          if (val.length < 10) { fieldError(t.closest('.field'), 'Décrivez les éléments attendus (10 caractères minimum).'); t.focus(); return false; }
          await withLoading(b, 500);
          d.status = 'complement'; d.complementSince = GO.REF_ISO;
          const doc = newDoc({ dossier: d.ref, kind: 'complement', type: 'sortant', title: 'Demande de complément', date: GO.REF_ISO, from: 'Service des Distinctions', state: 'envoye', number: nextDocNumber(), request: val });
          GO.addHistory(d, 'complement', 'Complément demandé : ' + (val.length > 60 ? val.slice(0, 57) + '…' : val));
          GO.notify({ type: 'complement', aud: 'org:' + d.org, ref: d.ref, doc: doc.id, title: 'Complément demandé', msg: val });
          GO.commit(); refreshDossier(d);
          GO.toast('success', 'Demande de complément envoyée', `Courrier ${esc(doc.number)} adressé au demandeur.`);
        }
      });
    },
    async note(d, btn) {
      await withLoading(btn, 500);
      const doc = newDoc({ dossier: d.ref, kind: 'transmission', type: 'note', title: 'Note de transmission au Directeur général', date: GO.REF_ISO, from: 'Service des Distinctions', state: 'attente_visa', number: nextDocNumber(), internal: true });
      GO.addHistory(d, 'courrier', 'Note de transmission préparée — en attente de visa');
      GO.notify({ type: 'visa', aud: 'service', ref: d.ref, doc: doc.id, title: 'Note en attente de visa', msg: 'La note de transmission attend le visa du Chef du Service.' });
      GO.commit(); refreshDossier(d, false);
      GO.toast('success', 'Note de transmission préparée', `${esc(doc.number)} — en attente de visa.`);
    },
    visa(d) { const n = GO.docsOf(d.ref).find(x => x.kind === 'transmission' && x.state === 'attente_visa'); if (n) location.hash = '#/courriers/' + n.id; },
    async transmit(d) {
      const ok = await GO.confirmDialog({ title: 'Transmettre le dossier à la hiérarchie ?', tone: 'blue', icon: 'send', confirm: 'Transmettre',
        message: `<p>Le dossier <strong>${d.ref}</strong> et sa note de transmission visée seront adressés au Directeur général. Le dossier passera au statut « Transmis à la hiérarchie ».</p>` });
      if (!ok) return;
      d.status = 'transmis';
      GO.addHistory(d, 'transmission', 'Transmis au Directeur général');
      GO.notify({ type: 'transmission', aud: 'org:' + d.org, ref: d.ref, title: 'Dossier transmis', msg: 'Votre dossier a été transmis à la hiérarchie pour décision.' });
      GO.commit(); refreshDossier(d);
      GO.toast('success', 'Dossier transmis', `${d.ref} attend désormais la décision de l’autorité compétente.`);
    },
    decide(d) {
      GO.modal({
        title: 'Enregistrer la décision', tone: 'green', icon: 'check-circle', size: 'lg',
        body: `<div class="alert alert-info">${icon('info')}<div>Enregistre la décision <strong>rendue par l’autorité compétente</strong> et reçue par courrier. Cette action ne vaut pas décision.</div></div>
          <fieldset class="field" style="border:0;padding:0;margin:0"><legend class="label">Décision reçue <span class="req" aria-hidden="true">*</span></legend>
            <div class="radio-cards"><label class="radio-card"><input type="radio" name="dec" value="approuve"> Attribution approuvée</label><label class="radio-card"><input type="radio" name="dec" value="refuse"> Attribution refusée</label></div></fieldset>
          <div class="field"><label class="label" for="dec-ref">Référence du courrier de décision <span class="req" aria-hidden="true">*</span></label><input class="input" id="dec-ref" placeholder="Exemple : Décision n° 2026-091"></div>
          <div class="field"><label class="label" for="dec-obs">Observation <span class="muted" style="font-weight:400">(facultatif)</span></label><textarea class="textarea" id="dec-obs" rows="2" style="min-height:64px"></textarea></div>`,
        actions: [{ label: 'Annuler', value: 'cancel' }, { label: 'Enregistrer', value: 'ok', kind: 'primary' }],
        onAction: async (v, h, b) => {
          const dec = $('input[name=dec]:checked', h.el), ref = $('#dec-ref', h.el), obs = $('#dec-obs', h.el).value.trim();
          fieldError($('fieldset', h.el), dec ? '' : 'Indiquez la décision reçue.');
          fieldError(ref.closest('.field'), ref.value.trim().length >= 4 ? '' : 'Saisissez la référence du courrier de décision.');
          if (!dec || ref.value.trim().length < 4) return false;
          await withLoading(b, 500);
          d.status = dec.value;
          newDoc({ dossier: d.ref, kind: 'decision', type: 'decision', title: dec.value === 'approuve' ? 'Décision d’attribution' : 'Décision de refus', date: GO.REF_ISO, from: 'Autorité compétente', state: 'enregistre', number: ref.value.trim(), decision: dec.value });
          GO.addHistory(d, 'decision', dec.value === 'approuve' ? 'Décision d’attribution enregistrée' : 'Décision de refus enregistrée', 'Autorité compétente');
          if (obs) d.observations.push({ date: GO.REF_ISO, author: GO.user().name, text: obs });
          GO.notify({ type: 'decision', aud: 'org:' + d.org, ref: d.ref, title: dec.value === 'approuve' ? 'Distinctions attribuées' : 'Décision de refus', msg: dec.value === 'approuve' ? 'Une cérémonie de remise sera programmée.' : 'La décision vous sera notifiée par courrier.' });
          GO.commit(); refreshDossier(d);
          GO.toast('success', 'Décision enregistrée', `${d.ref} : ${dec.value === 'approuve' ? 'attribution approuvée' : 'attribution refusée'}.`);
        }
      });
    },
    async relance(d) {
      const n = ageDays(d.complementSince || d.depot);
      const ok = await GO.confirmDialog({ title: 'Relancer le demandeur ?', tone: 'yellow', icon: 'refresh', confirm: 'Envoyer la relance',
        message: `<p>Le complément a été demandé il y a <strong>${n} jours</strong>. Une relance sera adressée à <strong>${esc(GO.org(d.org).contact)}</strong> (${esc(GO.org(d.org).email)}).</p>` });
      if (!ok) return;
      GO.addHistory(d, 'relance', 'Relance adressée au demandeur');
      GO.notify({ type: 'complement', aud: 'org:' + d.org, ref: d.ref, title: 'Relance : complément attendu', msg: 'Merci de transmettre les éléments demandés.' });
      GO.commit(); refreshDossier(d, false);
      GO.toast('success', 'Relance envoyée', d.ref);
    },
    answer(d) {
      const up = D.config.upload;
      GO.modal({
        title: 'Déposer le complément', tone: 'blue', icon: 'upload', size: 'lg',
        body: `<p>Joignez les pièces demandées par le Service des Distinctions. Le dossier reprendra son instruction.</p>
          <div class="field"><label class="label" for="ans-file">Pièce justificative <span class="req" aria-hidden="true">*</span></label><input class="input" type="file" id="ans-file" accept="${up.accept.join(',')}" style="padding-top:7px"><span class="hint">${up.acceptLabel} · ${up.maxMb} Mo maximum</span></div>
          <div class="field"><label class="label" for="ans-msg">Message</label><textarea class="textarea" id="ans-msg" rows="2" style="min-height:64px"></textarea></div>`,
        actions: [{ label: 'Annuler', value: 'cancel' }, { label: 'Déposer', value: 'ok', kind: 'primary', icon: 'upload' }],
        onAction: async (v, h, b) => {
          const inp = $('#ans-file', h.el), f = inp.files[0];
          const err = !f ? 'Sélectionnez un fichier.' : !up.accept.includes(f.type) ? `Format non accepté : ${up.acceptLabel}.` : f.size > up.maxMb * 1048576 ? `Le fichier dépasse ${up.maxMb} Mo.` : '';
          fieldError(inp.closest('.field'), err);
          if (err) return false;
          await withLoading(b, 700);
          d.status = 'en_cours'; d.complementSince = null;
          newDoc({ dossier: d.ref, kind: 'upload', type: 'piece', title: 'Complément — ' + f.name, date: GO.REF_ISO, from: GO.org(d.org).name, state: 'depose', file: { name: f.name, size: f.size, type: f.type } });
          GO.addHistory(d, 'depot', 'Complément déposé par le demandeur');
          GO.notify({ type: 'depot', aud: 'service', ref: d.ref, title: 'Complément reçu', msg: `${GO.org(d.org).name} a déposé : ${f.name}.` });
          GO.commit(); refreshDossier(d);
          GO.toast('success', 'Complément déposé', 'Le dossier reprend son instruction.');
        }
      });
    },
    propose(d) { location.hash = '#/ceremonies/proposer?dossier=' + d.ref; },
    cer(d) { const c = GO.activeCer(d.ref) || GO.cersOf(d.ref)[0]; if (c) location.hash = '#/ceremonies/' + c.id; }
  };

  GO.views.dossiers = { render: renderDossiers, update: updateDossiers };
})(window.GO);
