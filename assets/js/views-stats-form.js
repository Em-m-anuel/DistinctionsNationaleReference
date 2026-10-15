/* ==========================================================================
   GAB-ORIENT — Vues « Statistiques », « Nouveau dossier » (formulaire en
   quatre étapes) et « Profil ».
   ========================================================================== */
(function (GO) {
  'use strict';
  const { $, $$, esc, icon, D, fmtDate, plural } = GO;

  /* ======================= STATISTIQUES ======================= */
  const SF = { period: 'year', sector: 'all' };
  const SPERIODS = { year: 'Année 2026 (à date)', T1: '1ᵉʳ trimestre 2026', T2: '2ᵉ trimestre 2026', T3: '3ᵉ trimestre 2026', T4: '4ᵉ trimestre 2026 (à date)' };
  const STATUS_COLORS = { recu: '#8a97a8', en_cours: '#3a75c4', complement: '#e9bf10', transmis: '#16305a', approuve: '#009e60', refuse: '#b4442f' };
  const MEDAL_COLORS = { argent: '#9aa5b4', vermeil: '#b4442f', or: '#e7b416', 'grand-or': '#9a7000' };

  function periodMonths() {
    const last = GO.REF.getMonth();
    if (SF.period === 'year') return Array.from({ length: last + 1 }, (_, i) => i);
    const q = +SF.period.slice(1);
    return [0, 1, 2].map(i => (q - 1) * 3 + i).filter(m => m <= last);
  }
  function statData() {
    const months = periodMonths();
    const list = GO.myDossiers().filter(d => d.depot.startsWith('2026') && months.includes(GO.parseISO(d.depot).getMonth()) && (SF.sector === 'all' || GO.org(d.org).sector === SF.sector));
    return { months, list };
  }
  function decisionDate(d) { const h = d.history.find(x => x.kind === 'decision'); return h && h.date; }

  function renderStats(main) {
    const sectors = [...new Set(GO.myDossiers().map(d => GO.org(d.org).sector))].sort();
    main.innerHTML = `
      <section class="page-head reveal">
        <div><div class="page-eyebrow">Pilotage</div><h1 class="page-title">Statistiques</h1>
          <p class="page-sub">Indicateurs calculés à partir des dossiers enregistrés dans GAB-ORIENT. Les filtres s’appliquent à la date de dépôt.</p></div>
        <div class="page-actions" style="align-items:flex-end">
          <div class="field" style="min-width:200px"><label class="mini-label" for="st-period">Période</label><select class="select" id="st-period">${Object.entries(SPERIODS).map(([k, v]) => `<option value="${k}" ${k === SF.period ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <div class="field" style="min-width:200px"><label class="mini-label" for="st-sector">Secteur</label><select class="select" id="st-sector"><option value="all">Tous les secteurs</option>${sectors.map(s => `<option ${s === SF.sector ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
        </div>
      </section>
      <section class="card reveal" style="--i:1"><div class="kpi-strip" id="st-kpis"></div></section>
      <div class="grid grid-2 mt">
        ${chartCard('dep', 'Dossiers déposés par mois', 'Volume mensuel des dépôts', 2)}
        ${chartCard('cum', 'Récipiendaires proposés — cumul', 'Évolution cumulée sur la période', 3)}
        ${chartCard('sta', 'Répartition des statuts', 'Situation actuelle des dossiers déposés sur la période', 4)}
        ${chartCard('med', 'Échelons proposés', 'Nombre de récipiendaires par échelon de médaille', 5)}
        ${chartCard('sec', 'Dossiers par secteur', 'Comparaison des secteurs demandeurs', 6)}
        ${chartCard('fun', 'Avancement dans le circuit', 'Part des dossiers ayant atteint chaque étape', 7)}
      </div>`;
    $('#st-period', main).addEventListener('change', e => { SF.period = e.target.value; drawStats(main); });
    $('#st-sector', main).addEventListener('change', e => { SF.sector = e.target.value; drawStats(main); });
    main.addEventListener('click', e => {
      const b = e.target.closest('[data-tbl]'); if (!b) return;
      const box = $('#tbl-' + b.dataset.tbl, main); const open = box.hidden;
      box.hidden = !open; b.setAttribute('aria-expanded', open); b.textContent = open ? 'Masquer les données' : 'Voir les données';
    });
    drawStats(main);
  }
  function chartCard(id, title, sub, i) {
    return `<section class="card reveal" style="--i:${i}" aria-labelledby="ct-${id}">
      <div class="card-head"><div><h2 class="card-title" id="ct-${id}">${esc(title)}</h2><p class="card-sub">${esc(sub)}</p></div>
        <button class="btn btn-ghost btn-xs" type="button" data-tbl="${id}" aria-expanded="false" aria-controls="tbl-${id}">Voir les données</button></div>
      <div class="card-body"><div class="chart" id="ch-${id}"></div><div class="mini-table data-toggle-table" id="tbl-${id}" hidden></div></div></section>`;
  }
  const tbl = (head, rows) => `<table><thead><tr>${head.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

  function drawStats(main) {
    const { months, list } = statData();
    const recips = list.reduce((a, d) => a + d.recipients.length, 0);
    const decided = list.filter(d => d.status === 'approuve' || d.status === 'refuse');
    const appr = decided.filter(d => d.status === 'approuve').length;
    const delays = decided.map(d => GO.daysBetween(d.depot, decisionDate(d))).filter(n => n >= 0);
    const avg = delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : null;
    $('#st-kpis', main).innerHTML = `
      <div class="kpi"><div class="kpi-label">Dossiers déposés</div><div class="kpi-value" data-c="${list.length}">0</div><div class="kpi-note">${esc(SPERIODS[SF.period])}</div></div>
      <div class="kpi"><div class="kpi-label">Récipiendaires proposés</div><div class="kpi-value" data-c="${recips}">0</div><div class="kpi-note">${list.length ? `soit ${(recips / list.length).toFixed(1).replace('.', ',')} par dossier en moyenne` : 'aucun dossier'}</div></div>
      <div class="kpi"><div class="kpi-label">Taux d’approbation</div><div class="kpi-value">${decided.length ? `<span data-c="${Math.round(appr / decided.length * 100)}">0</span><small>%</small>` : '—'}</div><div class="kpi-note">${decided.length ? `${appr} approuvé${appr > 1 ? 's' : ''} sur ${plural(decided.length, 'décision', 'décisions')}` : 'aucune décision sur la période'}</div></div>
      <div class="kpi"><div class="kpi-label">Délai moyen dépôt → décision</div><div class="kpi-value">${avg !== null ? `<span data-c="${avg}">0</span><small>jours</small>` : '—'}</div><div class="kpi-note">${delays.length ? `calculé sur ${plural(delays.length, 'dossier décidé', 'dossiers décidés')}` : 'aucun dossier décidé'}</div></div>`;
    $$('[data-c]', main).forEach(n => GO.countUp(n, +n.dataset.c));

    const labels = months.map(m => GO.MONTHS[m] + ' 2026'), short = months.map(m => GO.MONTHS_S[m].replace('.', ''));
    const perMonth = months.map(m => list.filter(d => GO.parseISO(d.depot).getMonth() === m).length);
    GOCharts.mount($('#ch-dep', main), 'bar', { labels, short, values: perMonth, unit: 'dossier(s)', color: 'var(--navy-800)', aria: 'Dossiers déposés par mois' });
    $('#tbl-dep', main).innerHTML = tbl(['Mois', 'Dossiers déposés'], labels.map((l, i) => [l, perMonth[i]]));

    let acc = 0; const cum = months.map(m => (acc += list.filter(d => GO.parseISO(d.depot).getMonth() === m).reduce((a, d) => a + d.recipients.length, 0)));
    GOCharts.mount($('#ch-cum', main), 'line', { labels, short, values: cum, unit: 'récipiendaire(s) cumulé(s)', color: 'var(--blue-600)', aria: 'Récipiendaires proposés, cumul mensuel' });
    $('#tbl-cum', main).innerHTML = tbl(['Mois', 'Cumul des récipiendaires'], labels.map((l, i) => [l, cum[i]]));

    const st = D.statusOrder.map(s => ({ label: D.statuses[s].label, value: list.filter(d => d.status === s).length, color: STATUS_COLORS[s] }));
    if (list.length) GOCharts.mount($('#ch-sta', main), 'donut', { items: st, centerLabel: 'dossiers', aria: 'Répartition des dossiers par statut' });
    else $('#ch-sta', main).innerHTML = GO.empty('chart', 'Aucune donnée', 'Aucun dossier déposé sur cette période.');
    $('#tbl-sta', main).innerHTML = tbl(['Statut', 'Dossiers'], st.map(x => [x.label, x.value]));

    const med = D.medals.map(m => ({ label: m.short, value: list.reduce((a, d) => a + d.recipients.filter(r => r.medal === m.id).length, 0), color: MEDAL_COLORS[m.id] }));
    GOCharts.mount($('#ch-med', main), 'hbar', { items: med, unit: 'récipiendaire(s)' });
    $('#tbl-med', main).innerHTML = tbl(['Échelon', 'Récipiendaires'], med.map(x => [x.label, x.value]));

    const bySector = SF.sector === 'all';
    const keys = [...new Set(list.map(d => bySector ? GO.org(d.org).sector : GO.org(d.org).name))];
    const sec = keys.map(k => ({ label: k, value: list.filter(d => (bySector ? GO.org(d.org).sector : GO.org(d.org).name) === k).length })).sort((a, b) => b.value - a.value);
    $('#ct-sec', main).textContent = bySector ? 'Dossiers par secteur' : 'Dossiers par organisme';
    if (sec.length) GOCharts.mount($('#ch-sec', main), 'hbar', { items: sec, unit: 'dossier(s)', color: 'var(--navy-800)' });
    else $('#ch-sec', main).innerHTML = GO.empty('chart', 'Aucune donnée', 'Aucun dossier déposé sur cette période.');
    $('#tbl-sec', main).innerHTML = tbl([bySector ? 'Secteur' : 'Organisme', 'Dossiers'], sec.map(x => [x.label, x.value]));

    const reached = D.steps.map((s, i) => ({ s, n: list.filter(d => { const st = GO.stepInfo(d); return st.cur > i || (st.cur === i && st.stop); }).length }));
    $('#ch-fun', main).innerHTML = list.length ? `<ul class="funnel">${reached.map((x, i) => { const p = Math.round(x.n / list.length * 100); return `<li><span>${esc(x.s)}</span><span class="bar-track" data-tip="<strong>${esc(x.s)}</strong>${x.n} dossier(s) ont franchi cette étape"><span class="bar-fill" style="--i:${i};background:${i === 5 ? 'var(--gold-1)' : 'var(--green-600)'}" data-w="${p}"></span></span><span>${x.n} · ${p} %</span></li>`; }).join('')}</ul>`
      : GO.empty('chart', 'Aucune donnée', 'Aucun dossier déposé sur cette période.');
    requestAnimationFrame(() => requestAnimationFrame(() => $$('#ch-fun .bar-fill', main).forEach(b => { b.style.width = b.dataset.w + '%'; })));
    $('#tbl-fun', main).innerHTML = tbl(['Étape franchie', 'Dossiers', 'Part'], reached.map(x => [x.s, x.n, list.length ? Math.round(x.n / list.length * 100) + ' %' : '—']));
  }
  GO.views.statistiques = { render: renderStats };

  /* ======================= NOUVEAU DOSSIER ======================= */
  const STEPS = [['Demandeur', 'Organisme et contact'], ['Récipiendaires', 'Personnes proposées'], ['Documents', 'Pièces justificatives'], ['Récapitulatif', 'Vérification et envoi']];
  const PIECES = [['demande', 'Courrier de demande', 'Signé par le responsable de l’organisme', true], ['liste', 'Liste nominative des récipiendaires', 'Noms, fonctions et dates d’entrée', true], ['attestations', 'Attestations d’ancienneté', 'Une attestation par récipiendaire, regroupées en un fichier', true], ['autres', 'Autres pièces', 'Tout document utile à l’instruction', false]];
  const blankR = () => ({ nom: '', prenom: '', fonction: '', entree: '', medal: '' });
  let F = null;
  function freshForm() {
    const o = GO.role().scope ? GO.org(GO.role().scope) : null;
    return { step: 0, max: 0, dir: 1, done: null, submitted: false, errors: {},
      data: { org: o ? o.name : '', type: o ? o.type : '', sector: o ? o.sector : '', city: o ? o.city : '', contact: o ? o.contact : '', contactRole: o ? o.contactRole : '', email: o ? o.email : '', phone: o ? o.phone : '',
        recipients: [blankR()], files: { demande: null, liste: null, attestations: null, autres: null }, certify: false } };
  }
  const SECTORS = ['Administration publique', 'Banque et assurance', 'Énergie', 'Forêt et bois', 'Industrie', 'Mines', 'Santé', 'Télécommunications', 'Transport et logistique', 'Autre'];

  function renderForm(main) {
    if (!F || F.done || F.role !== GO.S.role) { F = freshForm(); F.role = GO.S.role; }
    main.innerHTML = `
      <section class="page-head reveal">
        <div><div class="page-eyebrow">Dossiers</div><h1 class="page-title">Nouveau dossier de distinction</h1>
          <p class="page-sub">Préparez la demande en quatre étapes. Les informations saisies sont conservées lorsque vous passez d’une étape à l’autre.</p></div>
        <div class="page-actions"><a class="btn btn-secondary" href="#/dossiers">Annuler</a></div>
      </section>
      <div class="form-layout">
        <section class="card reveal" style="--i:1" aria-labelledby="wz-title">
          <div class="wizard-steps" id="wz-steps" role="list" aria-label="Progression du formulaire"></div>
          <div class="wz-progress" aria-hidden="true"><i id="wz-bar" style="width:0"></i></div>
          <form id="wz-form" novalidate><div class="wz-body" id="wz-body"></div>
            <div class="wz-foot" id="wz-foot"></div></form>
        </section>
        <aside class="card help-card reveal" style="--i:2" aria-labelledby="help-t">
          <div class="card-head"><h2 class="card-title" id="help-t">${icon('info')}Aide</h2></div>
          <div class="card-body" id="wz-help"></div>
        </aside>
      </div>`;
    const form = $('#wz-form', main);
    form.addEventListener('input', onInput);
    form.addEventListener('change', onInput);
    form.addEventListener('submit', e => { e.preventDefault(); next(); });
    form.addEventListener('click', onClick);
    $('#wz-steps', main).addEventListener('click', e => { const b = e.target.closest('[data-step]'); if (b && +b.dataset.step <= F.max && !F.done) go(+b.dataset.step); });
    drawStep(true);
  }

  function drawStep(first) {
    const steps = $('#wz-steps');
    steps.innerHTML = STEPS.map(([t, s], i) => {
      const cls = F.done ? 'is-done' : i < F.step ? 'is-done' : i === F.step ? 'is-current' : '';
      return `<button type="button" class="wz-step ${cls}" role="listitem" data-step="${i}" data-reachable="${i <= F.max && !F.done}" ${i > F.max || F.done ? 'tabindex="-1" aria-disabled="true"' : ''} ${i === F.step && !F.done ? 'aria-current="step"' : ''}>
        <span class="wz-num">${cls === 'is-done' ? icon('check') : i + 1}</span><span class="wz-txt"><b>${t}</b><span>${s}</span></span></button>`;
    }).join('');
    $('#wz-bar').style.width = (F.done ? 100 : ((F.step + 1) / STEPS.length) * 100) + '%';
    const body = $('#wz-body');
    if (F.done) { body.innerHTML = successHTML(); $('#wz-foot').hidden = true; $('#wz-help').innerHTML = '<p class="muted" style="font-size:13px">Le dossier est désormais suivi depuis la liste des dossiers.</p>'; return; }
    $('#wz-foot').hidden = false;
    body.innerHTML = `<div class="wz-panel ${F.dir < 0 ? 'back' : ''}">${[stepDemandeur, stepRecips, stepDocs, stepRecap][F.step]()}</div>`;
    $('#wz-foot').innerHTML = `<button type="button" class="btn btn-secondary" data-nav="prev" ${F.step === 0 ? 'disabled' : ''}>${icon('chevron-left')}Précédent</button>
      <span class="muted" style="font-size:12.5px;align-self:center">Étape ${F.step + 1} sur ${STEPS.length}</span>
      ${F.step < 3 ? `<button type="submit" class="btn btn-primary">Suivant${icon('chevron-right')}</button>` : `<button type="submit" class="btn btn-primary" id="wz-submit">${icon('send')}Soumettre le dossier</button>`}`;
    $('#wz-help').innerHTML = helpFor(F.step);
    Object.entries(F.errors).forEach(([k, m]) => showErr(k, m));
    if (!first) { const h = $('.wz-panel h2', body); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } $('#wz-form').closest('.card').scrollIntoView({ behavior: GO.reduced() ? 'auto' : 'smooth', block: 'start' }); }
  }

  const field = (id, label, ctl, req = true, cls = '', hint = '') => `<div class="field ${cls}" data-f="${id}"><label class="label" for="${id}">${label}${req ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>${ctl}${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
  const inp = (id, val, attrs = '') => `<input class="input" id="${id}" name="${id}" value="${esc(val)}" ${attrs}>`;

  function stepDemandeur() {
    const x = F.data, locked = !!GO.role().scope;
    return `<h2 id="wz-title">Informations du demandeur</h2><p>Organisme qui propose les récipiendaires et interlocuteur pour le suivi du dossier. Les champs marqués <span class="req" style="color:var(--red-600)">*</span> sont obligatoires.</p>
      <div class="form-grid">
        ${field('f-org', 'Raison sociale de l’organisme', inp('f-org', x.org, `list="org-list" autocomplete="organization" required ${locked ? 'readonly' : ''}`), true, 'span-2', locked ? 'Organisme rattaché à votre compte.' : 'Saisissez le nom complet ; un organisme déjà connu est proposé automatiquement.')}
        <datalist id="org-list">${D.organisations.map(o => `<option value="${esc(o.name)}">`).join('')}</datalist>
        ${field('f-type', 'Type d’organisme', `<select class="select" id="f-type" required><option value="">Sélectionner…</option>${['Entreprise', 'Ministère', 'Établissement public', 'Collectivité'].map(t => `<option ${t === x.type ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}
        ${field('f-sector', 'Secteur d’activité', `<select class="select" id="f-sector" required><option value="">Sélectionner…</option>${SECTORS.map(t => `<option ${t === x.sector ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}
        ${field('f-city', 'Ville', inp('f-city', x.city, 'autocomplete="address-level2" required'))}
        ${field('f-contact', 'Nom de l’interlocuteur', inp('f-contact', x.contact, 'autocomplete="name" required'))}
        ${field('f-contactRole', 'Fonction de l’interlocuteur', inp('f-contactRole', x.contactRole, 'autocomplete="organization-title"'), false)}
        ${field('f-email', 'Adresse électronique', inp('f-email', x.email, 'type="email" autocomplete="email" required'))}
        ${field('f-phone', 'Téléphone', inp('f-phone', x.phone, 'type="tel" autocomplete="tel" required placeholder="+241 …"'), true, '', 'Indicatif international accepté.')}
      </div>`;
  }
  function stepRecips() {
    const rs = F.data.recipients;
    return `<h2 id="wz-title">Récipiendaires proposés</h2><p>Renseignez chaque personne proposée. L’ancienneté est calculée à partir de la date d’entrée et sera vérifiée lors de l’instruction.</p>
      <div id="recips">${rs.map((r, i) => recipCard(r, i, rs.length)).join('')}</div>
      <button type="button" class="btn btn-secondary mt" data-add-r>${icon('plus')}Ajouter un récipiendaire</button>
      <p class="hint" style="margin-top:8px" aria-live="polite" id="r-count">${plural(rs.length, 'récipiendaire', 'récipiendaires')} sur ce dossier</p>`;
  }
  function recipCard(r, i, n) {
    const s = GO.seniority(r.entree);
    return `<fieldset class="recip-card" data-r="${i}" style="border:1px solid var(--line)"><legend class="sr-only">Récipiendaire ${i + 1}</legend>
      <div class="recip-head"><strong><span class="idx">${i + 1}</span>${r.nom || r.prenom ? esc(`${r.prenom} ${r.nom}`.trim()) : 'Nouveau récipiendaire'}</strong>
        ${n > 1 ? `<button type="button" class="btn btn-ghost btn-xs" data-del-r="${i}" aria-label="Retirer le récipiendaire ${i + 1}">${icon('trash', 'ic-sm')}Retirer</button>` : ''}</div>
      <div class="recip-grid">
        ${field(`r${i}-nom`, 'Nom', inp(`r${i}-nom`, r.nom, `data-rk="nom" data-ri="${i}" autocomplete="family-name"`))}
        ${field(`r${i}-prenom`, 'Prénom', inp(`r${i}-prenom`, r.prenom, `data-rk="prenom" data-ri="${i}" autocomplete="given-name"`))}
        ${field(`r${i}-fonction`, 'Fonction', inp(`r${i}-fonction`, r.fonction, `data-rk="fonction" data-ri="${i}"`))}
        ${field(`r${i}-entree`, 'Date d’entrée dans l’organisme', inp(`r${i}-entree`, r.entree, `type="date" max="${GO.REF_ISO}" data-rk="entree" data-ri="${i}"`), true, '', `<span class="seniority" id="r${i}-sen">${s !== null && s >= 0 ? `Ancienneté : ${s} an${s > 1 ? 's' : ''}` : ''}</span>`)}
        ${field(`r${i}-medal`, 'Médaille proposée', `<select class="select" id="r${i}-medal" data-rk="medal" data-ri="${i}"><option value="">Sélectionner…</option>${D.medals.map(m => `<option value="${m.id}" ${m.id === r.medal ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select>`, true, 'span-2')}
      </div></fieldset>`;
  }
  function stepDocs() {
    const up = D.config.upload;
    return `<h2 id="wz-title">Pièces justificatives</h2><p>Joignez les pièces numérisées (${up.acceptLabel}, ${up.maxMb} Mo maximum par fichier). Vous pouvez déposer un fichier par glisser-déposer.</p>
      <div class="mt">${PIECES.map(([k, t, s, req]) => { const f = F.data.files[k]; return `
        <div class="dropzone ${f ? 'is-filled' : ''}" data-f="f-${k}" data-drop="${k}">
          <span class="dz-ico">${icon(f ? 'check' : 'upload')}</span>
          <div class="dz-main"><strong>${t}${req ? ' <span class="req" style="color:var(--red-600)" aria-hidden="true">*</span>' : ' <span class="muted" style="font-weight:400">(facultatif)</span>'}</strong>
            <span>${f ? `${esc(f.name)} · ${(f.size / 1024).toFixed(0)} Ko` : esc(s)}</span></div>
          <div style="display:flex;gap:6px">${f ? `<button type="button" class="btn btn-ghost btn-xs" data-rm-f="${k}" aria-label="Retirer le fichier ${esc(t)}">${icon('trash', 'ic-sm')}Retirer</button>` : ''}
            <label class="btn btn-secondary btn-sm" for="f-${k}">${f ? 'Remplacer' : 'Choisir un fichier'}</label>
            <input type="file" id="f-${k}" data-file="${k}" accept="${up.accept.join(',')}" ${req ? 'aria-required="true"' : ''} aria-label="${esc(t)}"></div>
        </div>`; }).join('')}</div>`;
  }
  function stepRecap() {
    const x = F.data;
    const block = (title, step, html) => `<section class="summary-block"><header><h3>${title}</h3><button type="button" class="btn btn-ghost btn-xs" data-goto="${step}">${icon('edit', 'ic-sm')}Modifier</button></header>${html}</section>`;
    return `<h2 id="wz-title">Récapitulatif</h2><p>Vérifiez les informations avant l’envoi au Service des Distinctions.</p>
      ${block('Demandeur', 0, `<dl class="dl-grid"><div><dt>Organisme</dt><dd>${esc(x.org)}</dd></div><div><dt>Type · secteur</dt><dd>${esc(x.type)} · ${esc(x.sector)}</dd></div><div><dt>Interlocuteur</dt><dd>${esc(x.contact)}${x.contactRole ? ', ' + esc(x.contactRole) : ''}</dd></div><div><dt>Contact</dt><dd>${esc(x.email)}<br>${esc(x.phone)}</dd></div></dl>`)}
      ${block(`Récipiendaires (${x.recipients.length})`, 1, `<div style="padding:0"><table class="data-table"><thead><tr><th>Nom</th><th>Fonction</th><th>Ancienneté</th><th>Médaille</th></tr></thead><tbody>${x.recipients.map(r => `<tr><td><strong>${esc(r.nom.toUpperCase())}</strong> ${esc(r.prenom)}</td><td>${esc(r.fonction)}</td><td>${GO.seniority(r.entree)} ans</td><td>${esc(GO.medal(r.medal).short)}</td></tr>`).join('')}</tbody></table></div>`)}
      ${block('Pièces jointes', 2, `<ul class="list-plain">${PIECES.filter(([k]) => x.files[k]).map(([k, t]) => `<li><span>${icon('paperclip', 'ic-sm')} ${esc(t)}</span><span class="muted" style="font-size:12px">${esc(x.files[k].name)}</span></li>`).join('')}</ul>`)}
      <div class="field mt" data-f="f-certify"><label class="check"><input type="checkbox" id="f-certify" ${x.certify ? 'checked' : ''}> <span>Je certifie l’exactitude des informations transmises et la conformité des pièces jointes. <span class="req" style="color:var(--red-600)">*</span></span></label></div>`;
  }
  function helpFor(step) {
    const items = [
      ['Utilisez la raison sociale exacte, telle qu’elle figure sur le courrier de demande.', 'L’interlocuteur recevra les demandes de complément et les convocations.', 'Le téléphone peut être saisi avec l’indicatif +241.'],
      ['Ajoutez autant de récipiendaires que nécessaire.', 'La date d’entrée permet de calculer l’ancienneté affichée.', 'Les conditions d’attribution sont vérifiées pendant l’instruction.'],
      ['Trois pièces sont obligatoires : courrier, liste nominative, attestations.', `Formats acceptés : ${D.config.upload.acceptLabel}.`, 'Une numérisation lisible évite une demande de complément.'],
      ['Chaque section peut être modifiée avant l’envoi.', 'Après l’envoi, le dossier apparaît au statut « Reçu — à traiter ».', 'Vous serez notifié à chaque étape de l’instruction.']][step];
    return `<ul>${items.map(t => `<li>${icon('check')}<span>${esc(t)}</span></li>`).join('')}</ul>`;
  }
  function successHTML() {
    return `<div class="success-panel" role="status"><div class="success-mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17 19 7"/></svg></div>
      <h2 style="font-size:20px">Dossier enregistré</h2>
      <p class="muted" style="max-width:52ch;font-size:14px">Le dossier <span class="ref">${F.done}</span> a été transmis au Service des Distinctions. Il figure dans la liste des dossiers au statut « Reçu — à traiter ».</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:8px"><a class="btn btn-primary" href="#/dossiers/${F.done}">${icon('folder')}Ouvrir le dossier</a><button class="btn btn-secondary" type="button" data-again>${icon('plus')}Créer un autre dossier</button></div></div>`;
  }

  function onInput(e) {
    const t = e.target, x = F.data;
    if (t.dataset.rk) {
      const r = x.recipients[+t.dataset.ri]; r[t.dataset.rk] = t.value;
      if (t.dataset.rk === 'entree') { const s = GO.seniority(t.value); $(`#r${t.dataset.ri}-sen`).textContent = s !== null && s >= 0 && t.value ? `Ancienneté : ${s} an${s > 1 ? 's' : ''}` : ''; }
      if (t.dataset.rk === 'nom' || t.dataset.rk === 'prenom') { const h = t.closest('.recip-card').querySelector('.recip-head strong'); h.lastChild.textContent = `${r.prenom} ${r.nom}`.trim() || 'Nouveau récipiendaire'; }
    } else if (t.dataset.file && e.type === 'change') { setFile(t.dataset.file, t.files[0]); return; }
    else if (t.id === 'f-certify') x.certify = t.checked;
    else if (t.id && t.id.startsWith('f-')) {
      const k = t.id.slice(2); x[k] = t.value;
      if (k === 'org' && e.type === 'change') { const o = D.organisations.find(o => o.name.toLowerCase() === t.value.trim().toLowerCase()); if (o && F.knownOrg !== o.id) { F.knownOrg = o.id; Object.assign(x, { type: o.type, sector: SECTORS.includes(o.sector) ? o.sector : 'Autre', city: o.city, contact: o.contact, contactRole: o.contactRole, email: o.email, phone: o.phone }); setTimeout(() => { drawStep(true); const n = $('#f-type'); if (n) n.focus(); }, 0); GO.toast('info', 'Organisme reconnu', 'Les coordonnées connues ont été reprises. Vérifiez-les.'); } }
    }
    if (F.errors[t.id]) { const m = validateField(t.id); if (!m) { delete F.errors[t.id]; showErr(t.id, ''); } }
  }
  function setFile(k, f) {
    const up = D.config.upload;
    if (!f) return;
    const err = !up.accept.includes(f.type) ? `Format non accepté. Formats possibles : ${up.acceptLabel}.` : f.size > up.maxMb * 1048576 ? `Le fichier dépasse la taille maximale de ${up.maxMb} Mo.` : '';
    if (err) { F.errors['f-' + k] = err; drawStep(true); return; }
    F.data.files[k] = { name: f.name, size: f.size, type: f.type };
    delete F.errors['f-' + k];
    drawStep(true);
    GO.toast('success', 'Fichier ajouté', esc(f.name));
  }
  function onClick(e) {
    const t = e.target;
    if (t.closest('[data-nav="prev"]')) return go(F.step - 1);
    if (t.closest('[data-add-r]')) {
      F.data.recipients.push(blankR());
      const i = F.data.recipients.length - 1;
      $('#recips').insertAdjacentHTML('beforeend', recipCard(F.data.recipients[i], i, F.data.recipients.length));
      $('#r-count').textContent = `${plural(F.data.recipients.length, 'récipiendaire', 'récipiendaires')} sur ce dossier`;
      if (F.data.recipients.length === 2) refreshRecips();
      $(`#r${i}-nom`).focus();
      return;
    }
    const del = t.closest('[data-del-r]');
    if (del) {
      const i = +del.dataset.delR, card = del.closest('.recip-card');
      card.classList.add('is-removing');
      setTimeout(() => { F.data.recipients.splice(i, 1); Object.keys(F.errors).filter(k => k.startsWith('r')).forEach(k => delete F.errors[k]); refreshRecips(); GO.toast('info', 'Récipiendaire retiré'); }, GO.reduced() ? 0 : 240);
      return;
    }
    const rm = t.closest('[data-rm-f]'); if (rm) { F.data.files[rm.dataset.rmF] = null; drawStep(true); return; }
    const g = t.closest('[data-goto]'); if (g) return go(+g.dataset.goto);
    if (t.closest('[data-again]')) { F = freshForm(); F.role = GO.S.role; drawStep(true); }
  }
  function refreshRecips() { const rs = F.data.recipients; $('#recips').innerHTML = rs.map((r, i) => recipCard(r, i, rs.length)).join(''); $('#r-count').textContent = `${plural(rs.length, 'récipiendaire', 'récipiendaires')} sur ce dossier`; }

  // Glisser-déposer des pièces
  document.addEventListener('dragover', e => { const z = e.target.closest && e.target.closest('[data-drop]'); if (z) { e.preventDefault(); z.classList.add('is-over'); } });
  document.addEventListener('dragleave', e => { const z = e.target.closest && e.target.closest('[data-drop]'); if (z) z.classList.remove('is-over'); });
  document.addEventListener('drop', e => { const z = e.target.closest && e.target.closest('[data-drop]'); if (z) { e.preventDefault(); z.classList.remove('is-over'); setFile(z.dataset.drop, e.dataTransfer.files[0]); } });

  function validateField(id) {
    const x = F.data, v = k => String(x[k] || '').trim();
    const rm = /^r(\d+)-(\w+)$/.exec(id);
    if (rm) {
      const r = x.recipients[+rm[1]]; if (!r) return '';
      const val = String(r[rm[2]] || '').trim();
      if (rm[2] === 'entree') { if (!val) return 'Indiquez la date d’entrée.'; if (val >= GO.REF_ISO) return 'La date d’entrée doit être antérieure à aujourd’hui.'; if (val < '1950-01-01') return 'Vérifiez l’année saisie.'; return ''; }
      if (rm[2] === 'medal') return val ? '' : 'Choisissez la médaille proposée.';
      return val.length >= 2 ? '' : { nom: 'Indiquez le nom.', prenom: 'Indiquez le prénom.', fonction: 'Indiquez la fonction.' }[rm[2]];
    }
    switch (id) {
      case 'f-org': return v('org').length >= 2 ? '' : 'Indiquez la raison sociale de l’organisme.';
      case 'f-type': return v('type') ? '' : 'Sélectionnez le type d’organisme.';
      case 'f-sector': return v('sector') ? '' : 'Sélectionnez le secteur d’activité.';
      case 'f-city': return v('city').length >= 2 ? '' : 'Indiquez la ville.';
      case 'f-contact': return v('contact').length >= 2 ? '' : 'Indiquez le nom de l’interlocuteur.';
      case 'f-email': return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('email')) ? '' : 'Saisissez une adresse électronique valide (exemple : nom@organisme.ga).';
      case 'f-phone': return (v('phone').replace(/\D/g, '').length >= 8 && /^[+\d\s().-]+$/.test(v('phone'))) ? '' : 'Saisissez un numéro de téléphone valide (8 chiffres minimum).';
      case 'f-certify': return x.certify ? '' : 'Cette attestation est nécessaire pour soumettre le dossier.';
    }
    const fm = /^f-(demande|liste|attestations)$/.exec(id);
    if (fm) return x.files[fm[1]] ? '' : 'Cette pièce est obligatoire.';
    return '';
  }
  function fieldsOf(step) {
    if (step === 0) return ['f-org', 'f-type', 'f-sector', 'f-city', 'f-contact', 'f-email', 'f-phone'];
    if (step === 1) return F.data.recipients.flatMap((_, i) => ['nom', 'prenom', 'fonction', 'entree', 'medal'].map(k => `r${i}-${k}`));
    if (step === 2) return ['f-demande', 'f-liste', 'f-attestations'];
    return ['f-certify'];
  }
  function showErr(id, msg) {
    const f = $(`[data-f="${id}"]`); if (!f) return;
    if (f.classList.contains('dropzone')) {
      f.classList.toggle('has-error', !!msg);
      $$('.error-msg', f).forEach(n => n.remove());
      if (msg) $('.dz-main', f).insertAdjacentHTML('beforeend', `<p class="error-msg" id="${id}-err">${icon('alert-circle')}${esc(msg)}</p>`);
      const i = $('input[type=file]', f); if (i) { if (msg) { i.setAttribute('aria-invalid', 'true'); i.setAttribute('aria-describedby', id + '-err'); } else { i.removeAttribute('aria-invalid'); i.removeAttribute('aria-describedby'); } }
      return;
    }
    GO.fieldError(f, msg);
  }
  function validateStep() {
    const errs = {};
    fieldsOf(F.step).forEach(id => { const m = validateField(id); if (m) errs[id] = m; });
    Object.keys(F.errors).forEach(k => { if (fieldsOf(F.step).includes(k) && !errs[k]) showErr(k, ''); });
    F.errors = errs;
    $$('.form-errors').forEach(n => n.remove());
    const keys = Object.keys(errs);
    keys.forEach(k => showErr(k, errs[k]));
    if (keys.length) {
      const labelOf = id => { const l = $(`label[for="${id}"]`) || $(`[data-f="${id}"] strong`); return l ? l.textContent.replace('*', '').trim() : id; };
      const box = document.createElement('div');
      box.className = 'alert alert-error form-errors'; box.tabIndex = -1; box.setAttribute('role', 'alert');
      box.innerHTML = `${icon('alert-circle')}<div><strong>${plural(keys.length, 'champ à corriger', 'champs à corriger')}</strong><ul style="margin-top:4px;display:grid;gap:2px">${keys.slice(0, 6).map(k => `<li><a href="#${k}" data-jump="${k}">${esc(labelOf(k))}</a> — ${esc(errs[k])}</li>`).join('')}${keys.length > 6 ? `<li>et ${keys.length - 6} autre(s)…</li>` : ''}</ul></div>`;
      $('.wz-panel').prepend(box);
      box.addEventListener('click', e => { const a = e.target.closest('[data-jump]'); if (a) { e.preventDefault(); const el = document.getElementById(a.dataset.jump); if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); } } });
      box.focus();
      return false;
    }
    return true;
  }
  function go(step) { if (step < 0 || step > 3) return; F.dir = step >= F.step ? 1 : -1; F.step = step; F.errors = {}; drawStep(); }
  async function next() {
    if (!validateStep()) return;
    if (F.step < 3) { F.max = Math.max(F.max, F.step + 1); return go(F.step + 1); }
    const x = F.data;
    const ok = await GO.confirmDialog({ title: 'Soumettre le dossier ?', tone: 'green', icon: 'send', confirm: 'Soumettre',
      message: `<p>Le dossier de <strong>${esc(x.org)}</strong> pour <strong>${plural(x.recipients.length, 'récipiendaire', 'récipiendaires')}</strong> sera transmis au Service des Distinctions. Vous ne pourrez plus le modifier ; des compléments pourront vous être demandés.</p>` });
    if (!ok) return;
    const b = $('#wz-submit');
    b.disabled = true; b.innerHTML = '<span class="spinner"></span>Envoi en cours…';
    await GO.wait(1100);
    const ref = createDossier();
    F.done = ref;
    drawStep();
    GO.toast('success', 'Dossier transmis', `${ref} est enregistré au statut « Reçu — à traiter ».`);
  }
  function createDossier() {
    const S = GO.S, x = F.data;
    let o = D.organisations.find(o => o.name.toLowerCase() === x.org.trim().toLowerCase());
    if (!o) {
      o = { id: 'o' + Date.now().toString(36), name: x.org.trim(), short: x.org.trim().split(/\s+/).slice(0, 3).join(' '), type: x.type, sector: x.sector, city: x.city, contact: x.contact, contactRole: x.contactRole, email: x.email, phone: x.phone };
      S.orgs = S.orgs || []; S.orgs.push(o); D.organisations.push(o);
    }
    const n = Math.max(...S.dossiers.map(d => +d.ref.split('-')[2])) + 1;
    const ref = 'DNG-2026-' + GO.pad(n).padStart(3, '0');
    const s = GO.stamp();
    S.dossiers.push({ ref, org: o.id, depot: GO.REF_ISO, status: 'recu', agent: null, complementSince: null,
      recipients: x.recipients.map((r, i) => ({ id: `${ref}-R${i + 1}`, nom: r.nom.trim(), prenom: r.prenom.trim(), fonction: r.fonction.trim(), entree: r.entree, medal: r.medal })),
      history: [{ date: s.date, time: s.time, actor: o.name, kind: 'depot', label: 'Demande déposée en ligne' }], observations: [] });
    PIECES.forEach(([k, t]) => { const f = x.files[k]; if (f) GO.newDoc({ id: 'd' + Date.now().toString(36) + k, dossier: ref, kind: 'upload', type: k === 'demande' ? 'entrant' : 'piece', title: t, date: GO.REF_ISO, from: o.name, state: 'depose', file: f }); });
    GO.notify({ type: 'depot', aud: 'service', ref, title: 'Nouveau dossier reçu', msg: `${o.name} propose ${plural(x.recipients.length, 'récipiendaire', 'récipiendaires')}.` });
    if (GO.role().scope === o.id) GO.notify({ type: 'depot', aud: 'org:' + o.id, ref, title: 'Votre dossier a été transmis', msg: 'Le Service des Distinctions procédera à son enregistrement.' });
    GO.commit();
    return ref;
  }
  GO.views.nouveau = { render: renderForm, state: () => F };

  /* ======================= PROFIL ======================= */
  function renderProfile(main) {
    const u = GO.user(), r = GO.role();
    main.innerHTML = `
      <section class="page-head reveal"><div><div class="page-eyebrow">Compte</div><h1 class="page-title">Mon profil</h1><p class="page-sub">Identité, droits du profil de travail et préférences d’affichage sur ce poste.</p></div></section>
      <div class="grid grid-2">
        <div class="stack">
          <section class="card reveal" style="--i:1" aria-labelledby="pf-t">
            <div class="profile-head"><span class="avatar lg">${esc(u.initials)}</span><div><h2 id="pf-t" style="font-size:18px">${esc(u.name)}</h2><p class="muted" style="font-size:13px">${esc(u.title)} · ${esc(u.unit)}</p><p style="font-size:13px;margin-top:2px"><a href="mailto:${esc(u.email)}">${esc(u.email)}</a></p></div></div>
            <div class="card-foot"><span class="muted" style="font-size:12.5px">Profil de travail</span><span class="badge tone-green">${esc(r.label)}</span></div>
          </section>
          <section class="card reveal" style="--i:2" aria-labelledby="pm-t2">
            <div class="card-head"><div><h2 class="card-title" id="pm-t2">${icon('shield')}Droits du profil</h2><p class="card-sub">Actions autorisées pour « ${esc(r.label)} »</p></div></div>
            <ul class="perm-list">${Object.entries(D.permissionLabels).map(([k, l]) => `<li><span>${esc(l)}</span>${r.can[k] ? `<span class="perm-yes">${icon('check', 'ic-sm')}Autorisé</span>` : `<span class="perm-no">${icon('x', 'ic-sm')}Non</span>`}</li>`).join('')}</ul>
          </section>
        </div>
        <div class="stack">
          <section class="card reveal" style="--i:3" aria-labelledby="pp-t">
            <div class="card-head"><h2 class="card-title" id="pp-t">${icon('sliders')}Préférences d’affichage</h2></div>
            <div class="switch-row"><div><strong id="sw1-l">Réduire les animations</strong><span>Supprime les transitions et apparitions animées.</span></div><span class="switch"><input type="checkbox" id="sw-motion" aria-labelledby="sw1-l" ${GO.S.prefs.reduceMotion ? 'checked' : ''}><i></i></span></div>
            <div class="switch-row"><div><strong id="sw2-l">Tableaux compacts</strong><span>Réduit la hauteur des lignes des listes.</span></div><span class="switch"><input type="checkbox" id="sw-compact" aria-labelledby="sw2-l" ${GO.S.prefs.compact ? 'checked' : ''}><i></i></span></div>
          </section>
          <section class="card reveal" style="--i:4" aria-labelledby="pd-t">
            <div class="card-head"><h2 class="card-title" id="pd-t">${icon('refresh')}Données du poste</h2></div>
            <div class="card-body"><p style="font-size:13.5px" class="muted">Les actions effectuées (dossiers créés, visas, décisions, propositions, lectures) sont conservées dans le navigateur de ce poste. Aucune donnée d’identification n’y est enregistrée.</p>
              <button class="btn btn-danger mt" type="button" data-action="reset">${icon('refresh')}Réinitialiser les données du poste</button></div>
          </section>
        </div>
      </div>`;
    $('#sw-motion', main).addEventListener('change', e => { GO.S.prefs.reduceMotion = e.target.checked; GO.save(); GO.renderShell(); GO.toast('success', 'Préférence enregistrée', e.target.checked ? 'Animations réduites.' : 'Animations activées.'); });
    $('#sw-compact', main).addEventListener('change', e => { GO.S.prefs.compact = e.target.checked; GO.save(); GO.renderShell(); GO.toast('success', 'Préférence enregistrée', e.target.checked ? 'Tableaux compacts.' : 'Tableaux standards.'); });
  }
  GO.views.profil = { render: renderProfile };
})(window.GO);
