/* ==========================================================================
   GAB-ORIENT — Vues « Vue d'ensemble » et « Dossiers »
   Contient le panneau de détail d'un dossier et les actions métier permises
   par le profil de travail (instruction, vérifications, compléments, visa,
   transmission, décision, ordre de recette, remise effective, contrôle…).
   ========================================================================== */
(function (GO) {
  'use strict';
  const { $, $$, esc, icon, D, fmtDate, relDay, plural, ageDays, norm, parseISO } = GO;
  const ui = GO.ui;

  /* ---------- Formulaire générique en fenêtre modale ---------- */
  // fields : { id, label, type, value, options, required, hint, placeholder, rows, validate(v, values) }
  function formModal(o) {
    const body = (o.intro || '') + (o.fields || []).map(f => {
      const id = 'fm-' + f.id;
      let ctl;
      if (f.type === 'select') ctl = `<select class="select" id="${id}">${f.options.map(op => `<option value="${esc(op.value)}"${op.value === f.value ? ' selected' : ''}>${esc(op.label)}</option>`).join('')}</select>`;
      else if (f.type === 'textarea') ctl = `<textarea class="textarea" id="${id}" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || '')}">${esc(f.value || '')}</textarea>`;
      else if (f.type === 'checkbox') return `<label class="check" data-f="${id}"><input type="checkbox" id="${id}"${f.value ? ' checked' : ''}> <span>${f.label}${f.required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</span></label>`;
      else ctl = `<input class="input" id="${id}" type="${f.type || 'text'}" value="${esc(f.value == null ? '' : f.value)}" placeholder="${esc(f.placeholder || '')}"${f.min ? ` min="${f.min}"` : ''}${f.max ? ` max="${f.max}"` : ''}>`;
      return `<div class="field${f.cls ? ' ' + f.cls : ''}" data-f="${id}"><label class="label" for="${id}">${esc(f.label)}${f.required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>${ctl}${f.hint ? `<span class="hint">${f.hint}</span>` : ''}</div>`;
    }).join('');
    return GO.modal(Object.assign({
      title: o.title || 'Formulaire', icon: o.icon, tone: o.tone, size: 'lg', body,
      actions: [{ label: o.cancel || 'Annuler', value: 'cancel' }, { label: o.submit || 'Enregistrer', value: 'ok', kind: o.kind || 'primary', icon: o.iconSubmit }],
      onAction: async (v, h, btn) => {
        const values = {};
        let bad = null;
        (o.fields || []).forEach(f => {
          const el = $('#fm-' + f.id, h.el);
          values[f.id] = f.type === 'checkbox' ? el.checked : el.value.trim();
          if (bad) return;
          const msg = f.validate ? f.validate(values[f.id], values) : (f.required && !String(values[f.id]).trim() ? 'Ce champ est obligatoire.' : '');
          if (msg) { GO.fieldError(el.closest('[data-f]'), msg); bad = el; }
          else GO.fieldError(el.closest('[data-f]'), '');
        });
        if (bad) { bad.focus(); return false; }
        if (o.checks) { const msg = o.checks(values); if (msg) { GO.toast('warn', 'Vérification requise', msg); return false; } }
        await GO.withLoading(btn, o.delay || 420);
        o.run(values, h, btn);
      }
    }, o.modal || {}));
  }

  /* ---------- Briques partagées ---------- */
  function dtsOf(d) { return GO.myDts().filter(x => x.dossier === d.ref); }
  function dtsFor(d, recipientId) { return GO.S.dts.find(x => x.recipient === recipientId); }
  function docsOf(d, onlyVisible) {
    const list = GO.docsOf(d.ref).filter(x => !(onlyVisible && x.internal));
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }
  function recipientsTable(d, detailed) {
    const meds = detailed;
    return `<div class="table-wrap"><table class="data-table responsive"><caption class="sr-only">Récipiendaires proposés</caption>
      <thead><tr><th scope="col">Nom et prénom</th><th scope="col">Fonction</th><th scope="col">Ancienneté</th><th scope="col">Médaille${meds ? ' proposée' : ''}</th>${meds ? '<th scope="col">DTS</th>' : ''}</tr></thead>
      <tbody>${d.recipients.map(r => {
        const e = GO.eligibility(r), t = dtsFor(d, r.id);
        return `<tr>
          <td data-label="Nom et prénom"><strong style="color:var(--navy-900)">${esc(r.nom.toUpperCase())}</strong> ${esc(r.prenom)}</td>
          <td data-label="Fonction">${esc(r.fonction)}</td>
          <td data-label="Ancienneté" class="tnum nowrap" title="Entrée le ${fmtDate(r.entree)}">${e.years} ans${meds && !e.ok ? ' ' + GO.badge(e.above ? 'ancienneté supérieure' : 'écart ' + e.gap + ' an(s)', 'yellow') : ''}</td>
          <td data-label="Médaille" class="nowrap">${esc(GO.medal(r.medal).short)}</td>
          ${meds ? `<td data-label="DTS" class="nowrap">${t ? GO.dictBadge(D.dtsStates, t.state) : GO.badge('non saisie', 'slate')}</td>` : ''}</tr>`;
      }).join('')}</tbody></table></div>`;
  }
  const by = (list, s) => list.filter(d => d.status === s);
  function bindPipeline(main) {
    requestAnimationFrame(() => {
      $$('.pipe-seg', main).forEach(s => { s.style.flexGrow = s.dataset.grow; });
      $$('[data-count]', main).forEach(n => GO.countUp(n, +n.dataset.count));
      $$('.pipe-cell', main).forEach(b => b.addEventListener('click', () => { location.hash = b.dataset.go; }));
    });
  }

  function activityCard(list, i) {
    const act = list.flatMap(d => d.history.map(h => Object.assign({ ref: d.ref }, h)))
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 6);
    return ui.card({ i, icon: 'clock', title: 'Activité récente', sub: 'Derniers événements des dossiers',
      body: act.length ? ui.timeline(act.map(h => ({ ...h, icon: h.kind === 'complement' || h.kind === 'relance' ? 'paperclip' : 'check' }))) : GO.empty('clock', 'Aucune activité', 'Les événements des dossiers apparaîtront ici.') });
  }
  function nextCeremonyCard(list, i) {
    const upcoming = GO.myCers().filter(c => c.date >= GO.REF_ISO && c.state !== 'termine').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const next = upcoming.find(c => c.state !== 'conflit') || upcoming[0];
    if (!next) return ui.card({ i, icon: 'calendar', title: 'Prochaine cérémonie', body: GO.empty('calendar', 'Aucune cérémonie à venir', 'Les cérémonies proposées ou confirmées apparaîtront ici.') });
    const v = GO.venue(next.venue), d = GO.getDossier(next.dossier), o = GO.org(d.org), n = GO.daysBetween(GO.REF_ISO, next.date);
    return ui.card({ i, icon: 'medal', title: 'Prochaine cérémonie', cls: 'next-cer',
      sub: `${esc(v.name)}, ${esc(v.city)}`,
      body: `<div class="next-cer-main"><div>
          <span class="countdown">${n === 0 ? 'Aujourd’hui' : `dans <b>${n}</b> jour${n > 1 ? 's' : ''}`}</span>
          <h3>Remise des médailles — ${esc(o.short)}</h3>${GO.cerBadge(next.state)}
          <div class="next-cer-date">${esc(fmtDate(next.date, 'full').replace(/^\w/, c => c.toUpperCase()))}</div>
          <div class="next-cer-meta"><span>${icon('clock')}${esc(next.time.replace(':', ' h '))}</span><span>${icon('users')}${plural(d.recipients.length, 'récipiendaire', 'récipiendaires')}</span>${next.dossier !== undefined ? `<span>${GO.refChip(next.dossier)}</span>` : ''}</div>
        </div><span class="rosette" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#i-star"/></svg></span></div>
        <ul class="mini-agenda">${upcoming.filter(c => c !== next).slice(0, 3).map(c => { const dt = parseISO(c.date); return `<li><span class="date-tile"><b>${dt.getDate()}</b><span>${GO.MONTHS_S[dt.getMonth()]}</span></span>
          <span><strong>${esc(GO.org(GO.getDossier(c.dossier).org).short)} · ${esc(c.id)}</strong><small>${esc(GO.venue(c.venue).name)}</small></span>${GO.cerBadge(c.state)}</li>`; }).join('')}</ul>
        <div class="card-foot"><span class="muted" style="font-size:12px">${plural(upcoming.length, 'cérémonie à venir', 'cérémonies à venir')}</span><a class="btn btn-ghost btn-sm" href="#/ceremonies">Calendrier ${icon('arrow-right', 'ic-sm')}</a></div>` });
  }

  // Liste d'actions à mener, adaptée à chaque famille de profil.
  function todos() {
    const out = [];
    const L = GO.myDossiers();
    GO.myReceiptOrders().forEach(o => {
      const d = GO.getDossier(o.dossier);
      if (GO.can('deposer_recu') && (o.state === 'emis' || o.state === 'rejete')) out.push({ t: `Déposer le reçu du paiement ${o.id}`, s: `${o.dossier} · ${o.amount}`, ic: 'cash', href: '#/recettes', tone: 'yellow' });
      if (GO.can('paiement_verif') && o.state === 'recu_depose') out.push({ t: `Vérifier le reçu de ${o.id}`, s: `${o.dossier} · déposé le ${fmtDate(GO.receiptOf(o.dossier).date)}`, ic: 'shield', href: '#/recettes', tone: 'blue' });
      void d;
    });
    L.forEach(d => {
      if (d.status === 'complement' && GO.can('answer')) out.push({ t: `Répondre au complément — ${d.ref}`, s: GO.complementOf(d.ref) ? `demandé le ${fmtDate(GO.complementOf(d.ref).requested)}` : '', ic: 'paperclip', href: '#/dossiers/' + d.ref, tone: 'yellow' });
      if (d.status === 'complement' && GO.can('relance') && ageDays(d.complementSince || d.depot) >= 15) out.push({ t: `Relancer le demandeur — ${d.ref}`, s: `${ageDays(d.complementSince || d.depot)} jours sans réponse`, ic: 'refresh', href: '#/dossiers/' + d.ref, tone: 'yellow' });
      if (d.status === 'recu' && GO.can('instruct')) out.push({ t: `Ouvrir l’instruction — ${d.ref}`, s: `${GO.org(d.org).name} · reçu le ${fmtDate(d.depot, 'short')}`, ic: 'check', href: '#/dossiers/' + d.ref, tone: 'blue' });
      if (d.status === 'en_cours' && GO.can('visa') && GO.docsOf(d.ref).some(x => x.state === 'attente_visa')) out.push({ t: `Viser la note de transmission — ${d.ref}`, s: 'visa interne attendu', ic: 'stamp', href: '#/courriers', tone: 'blue' });
      if (d.status === 'en_cours' && GO.can('transmit') && GO.docsOf(d.ref).some(x => x.kind === 'transmission' && x.state === 'vise')) out.push({ t: `Transmettre à la hiérarchie — ${d.ref}`, s: `note visée, autorité : ${GO.authority(d.authority).short}`, ic: 'send', href: '#/dossiers/' + d.ref, tone: 'blue' });
      if (d.status === 'transmis' && GO.can('decide')) out.push({ t: `Enregistrer la décision — ${d.ref}`, s: `${GO.org(d.org).name}`, ic: 'stamp', href: '#/dossiers/' + d.ref, tone: 'navy' });
      if (d.status === 'approuve' && GO.can('recette') && !GO.receiptOrder(d.ref)) out.push({ t: `Émettre l’ordre de recette — ${d.ref}`, s: 'après décision d’attribution', ic: 'cash', href: '#/dossiers/' + d.ref, tone: 'blue' });
      if (d.status === 'approuve' && GO.can('propose') && !GO.activeCer(d.ref) && !(GO.cersOf(d.ref)[0] && GO.cersOf(d.ref)[0].state === 'termine')) out.push({ t: `Programmer la cérémonie — ${d.ref}`, s: `${d.recipients.length} récipiendaires`, ic: 'calendar', href: '#/ceremonies/proposer?dossier=' + d.ref, tone: 'green' });
      const c = GO.cersOf(d.ref)[0];
      if (c && (c.state === 'propose' || c.state === 'negociation') && GO.can('valider_ceremonie')) out.push({ t: `Valider la date de cérémonie — ${c.id}`, s: `${fmtDate(c.date)} · ${GO.venue(c.venue).name}`, ic: 'shield', href: '#/ceremonies/' + c.id, tone: 'green' });
      if (c && c.state === 'negociation' && GO.can('coordinate')) out.push({ t: `Poursuivre la négociation — ${c.id}`, s: c.note || 'date en discussion', ic: 'message', href: '#/ceremonies/' + c.id, tone: 'yellow' });
      if (c && c.state === 'confirme' && GO.can('remise') && !GO.remiseOf(d.ref)) out.push({ t: `Préparer les médailles — ${d.ref}`, s: `cérémonie ${c.id} du ${fmtDate(c.date)}`, ic: 'medal', href: '#/remises', tone: 'blue' });
      if (d.status === 'refuse' && GO.can('recours') && !GO.recoursOf(d.ref)) out.push({ t: `Recours possible — ${d.ref}`, s: 'décision de refus notifiée', ic: 'scale', href: '#/recours', tone: 'red' });
      const ctl = GO.controlOf(d.ref);
      if (ctl && ctl.state === 'anomalie' && GO.can('instruct')) out.push({ t: `Traiter les anomalies signalées — ${d.ref}`, s: `${ctl.findings.length} anomalie(s) · ${ctl.id}`, ic: 'shield', href: '#/controle', tone: 'red' });
    });
    GO.myWithdrawals().forEach(w => {
      if (w.state === 'demande' && GO.can('retrait_traitement')) out.push({ t: `Traiter la demande de retrait ${w.id}`, s: `${w.dossier} · ${w.recipients.length} récipiendaire(s)`, ic: 'medal', href: '#/retraits', tone: 'yellow' });
    });
    GO.myComplements().forEach(c => {
      if (c.state !== 'satisfait' && GO.can('relance') && ageDays(c.requested) >= 15) {
        const d = GO.getDossier(c.dossier);
        if (d && d.status === 'complement' && !out.some(x => x.t.includes(c.dossier))) out.push({ t: `Complément en retard — ${c.dossier}`, s: `demandé le ${fmtDate(c.requested)} (échéance ${fmtDate(c.due, 'short')})`, ic: 'alert-triangle', href: '#/complements', tone: 'red' });
      }
    });
    // Demandeur et bénéficiaire : rappel de suivi pour les dossiers sans action de leur part.
    if (GO.external()) {
      L.forEach(d => {
        const si = GO.stepInfo(d);
        if (si.cur >= 5 || out.some(x => x.t.includes(d.ref))) return;
        out.push({ t: `Suivre l’avancement — ${d.ref}`, s: `${D.steps[Math.min(si.cur, D.steps.length - 1)]} · ${D.statuses[d.status].label}`, ic: 'eye', href: '#/dossiers/' + d.ref, tone: 'blue' });
      });
    }
    const order = { red: 0, yellow: 1, blue: 2, navy: 3, green: 4 };
    return out.sort((a, b) => order[a.tone] - order[b.tone]);
  }

  function todoCard(i) {
    const list = todos();
    return ui.card({ i, icon: 'flag', title: 'Points d’attention', sub: 'Actions attendues de votre profil, calculées à partir des délais et des étapes en attente',
      tools: list.length > 6 ? `<span class="pill">${list.length - 6} autres</span>` : '',
      body: list.length ? `<ul class="list-plain">${list.slice(0, 6).map(t => `<li><span style="display:flex;gap:10px;align-items:flex-start;min-width:0">
          <span class="notif-ico ni-${t.tone === 'red' ? 'conflit' : t.tone === 'yellow' ? 'complement' : t.tone === 'green' ? 'ceremonie' : 'transmission'}" style="width:30px;height:30px;border-radius:8px">${icon(t.ic, 'ic-sm')}</span>
          <span style="min-width:0"><strong style="display:block;font-size:13.5px;color:var(--navy-900)">${esc(t.t)}</strong><span class="muted" style="font-size:12px">${esc(t.s)}</span></span></span>
        <a class="btn btn-secondary btn-xs" href="${t.href}">Ouvrir</a></li>`).join('')}</ul>`
        : GO.empty('check-circle', 'Aucune action en attente', 'Les actions attendues de votre profil apparaîtront ici dès qu’une étape vous concernera.') });
  }

  // Titre et phrase d'accueil par famille de profil (utilisés par la vue d'ensemble).
  const FAMILY_HEAD = {
    demandeur: ['Suivi des demandes', 'Votre espace de suivi : dossiers, récipiendaires, pièces justificatives, cérémonies et notifications.'],
    recipiendaire: ['Mes distinctions', 'Vos distinctions, les documents qui vous sont accessibles et les cérémonies qui vous concernent.'],
    secretariat: ['Registre de votre secrétariat', 'Réception, enregistrement, classement et transmission des courriers de votre autorité.'],
    service: ['Instruction des dossiers', 'Dossiers en cours d’instruction, échéances, compléments et suites à donner.'],
    inspection: ['Contrôle des dossiers', 'Dossiers à contrôler, pièces vérifiées, observations et anomalies signalées.'],
    autorite: ['Dossiers transmis pour décision', 'Dossiers qui relèvent de votre autorité : avis, décisions, recours et suites données.'],
    regie: ['Régie des médailles', 'Stock, ordres de recette, remises effectives et retraits sans cérémonie.'],
    administration: ['Administration de la plateforme', 'Comptes de démonstration, paramètres, référentiels et journaux.']
  };

  // Répartition des dossiers par statut : barre proportionnelle + compteurs.
  const PIPE_DOT = { recu: 'var(--faint)', en_cours: 'var(--blue-600)', complement: 'var(--yellow-600)', transmis: 'var(--navy-800)', approuve: 'var(--green-600)', refuse: 'var(--red-600)' };
  const PIPE_NOTE = {
    recu: 'recevabilité à confirmer', en_cours: 'instruction en cours', complement: 'pièces attendues du demandeur',
    transmis: 'décision de l’autorité attendue', approuve: 'cérémonie et remise à organiser', refuse: 'notification et recours possibles'
  };
  function pipelineCard(list) {
    const total = list.length;
    const n = s => list.filter(d => d.status === s).length;
    const bar = D.statusOrder.map(s => n(s) ? `<span class="pipe-seg" data-grow="${(n(s) / Math.max(1, total) * 100).toFixed(2)}" style="--dot:${PIPE_DOT[s]}" data-tip="<strong>${esc(D.statuses[s].label)}</strong>${plural(n(s), 'dossier', 'dossiers')} — ${esc(PIPE_NOTE[s])}"></span>` : '').join('');
    const cells = D.statusOrder.map(s => `<button class="pipe-cell" type="button" data-go="#/dossiers?status=${s}">
        <span class="pipe-cell-label"><i style="--dot:${PIPE_DOT[s]}" aria-hidden="true"></i>${esc(D.statuses[s].short)}</span>
        <span class="pipe-cell-value" data-count="${n(s)}">0</span>
        <span class="pipe-cell-note">${esc(PIPE_NOTE[s])}</span></button>`).join('');
    return ui.card({ i: 3, icon: 'chart', title: 'Circuit des dossiers', cls: 'mt',
      sub: total ? `${plural(total, 'dossier suivi', 'dossiers suivis')} — répartition par statut` : 'Aucun dossier suivi avec ce profil',
      body: `<div class="pipeline">
        <div class="pipe-bar" role="img" aria-label="${esc(total ? `Répartition de ${plural(total, 'dossier', 'dossiers')} par statut` : 'Aucun dossier')}">${bar}</div>
        <div class="pipe-cells">${cells}</div></div>` });
  }

  function renderApercu(main) {
    const fam = GO.family();
    const list = GO.myDossiers(), u = GO.user();
    const head = FAMILY_HEAD[fam] || FAMILY_HEAD.service;
    const first = u.name.split(' ')[0];
    const quick = [];
    if (GO.can('create')) quick.push(`<a class="btn btn-primary" href="#/nouveau">${icon('plus')}Nouveau dossier</a>`);
    if (GO.can('propose')) quick.push(`<a class="btn btn-secondary" href="#/ceremonies/proposer">${icon('pin')}Proposer une cérémonie</a>`);
    if (GO.can('recette')) quick.push(`<a class="btn btn-secondary" href="#/recettes">${icon('cash')}Ordres de recette</a>`);
    if (GO.can('stock')) quick.push(`<a class="btn btn-secondary" href="#/stock">${icon('box')}Stock des médailles</a>`);
    if (GO.can('control')) quick.push(`<a class="btn btn-secondary" href="#/controle">${icon('shield')}Nouveau contrôle</a>`);
    if (GO.can('admin')) quick.push(`<a class="btn btn-secondary" href="#/administration">${icon('database')}Administration</a>`);
    const showDeposits = isServiceOrAuthority(fam);

    main.innerHTML = `
      ${ui.head({ eyebrow: fmtDate(GO.REF_ISO, 'full'), title: 'Vue d’ensemble', sub: `Bonjour ${esc(first)}. ${esc(head[1])}`, actions: quick.join('') })}
      <section class="card reveal mt" style="--i:1">${ui.kpis(kpis(list, fam))}</section>
      <div class="grid grid-main mt">${todoCard(2)}${nextCeremonyCard(list, 3)}</div>
      ${pipelineCard(list)}
      <div class="grid ${showDeposits ? 'grid-2' : 'grid-3'} mt">
        ${showDeposits ? ui.card({ i: 4, icon: 'chart', title: 'Dépôts mensuels 2026', sub: 'Nombre de dossiers déposés par mois', tools: GO.role().views.includes('statistiques') ? `<a class="btn btn-ghost btn-sm" href="#/statistiques">Détails</a>` : '', body: `<div class="chart" id="ch-dep"></div>` }) : channelCard(fam, 4)}
        ${showDeposits ? channelCard(fam, 5) : activityCard(list, 5)}
        ${familyCard(fam, 6)}
      </div>`;
    bindPipeline(main);
    if (showDeposits) { const host = $('#ch-dep', main); if (host) drawDeposits(host, list); }
  }
  const isServiceOrAuthority = fam => fam === 'service' || fam === 'autorite' || fam === 'inspection';

  function kpis(list, fam) {
    const out = [];
    const pending = todos().length;
    out.push({ label: fam === 'recipiendaire' ? 'Distinctions' : 'Dossiers suivis', count: list.length, note: fam === 'recipiendaire' ? 'rattachées à votre profil' : 'visibles avec ce profil' });
    out.push({ label: 'Actions en attente', count: pending, note: pending ? 'voir les points d’attention' : 'aucune action de votre ressort' });
    if (fam === 'service') {
      const recips = list.reduce((a, d) => a + d.recipients.length, 0);
      out.push({ label: 'Récipiendaires proposés', count: recips, note: `${by(list, 'transmis').length} dossier(s) en attente de décision` });
      out.push({ label: 'Notes à viser', count: GO.myDocs().filter(x => x.state === 'attente_visa').length, note: 'visa interne du Chef du Service' });
    } else if (fam === 'secretariat') {
      out.push({ label: 'À enregistrer', count: GO.myTransmissions().filter(t => t.state === 'recu').length, note: 'courriers reçus' });
      out.push({ label: 'À transmettre', count: GO.myTransmissions().filter(t => t.state === 'enregistre').length, note: 'enregistrés, non transmis' });
    } else if (fam === 'regie') {
      out.push({ label: 'Médailles en stock', count: GO.stockTotal(), note: `${GO.S.stock.reduce((a, s) => a + s.reserved, 0)} réservées` });
      out.push({ label: 'Reçus à vérifier', count: GO.myReceiptOrders().filter(o => o.state === 'recu_depose').length, note: 'paiements déposés' });
    } else if (fam === 'administration') {
      out.push({ label: 'Comptes actifs', count: GO.S.accounts.filter(a => a.state === 'actif').length, note: `${GO.S.accounts.length} comptes référencés` });
      out.push({ label: 'Événements journalisés', count: GO.S.audit.length, note: 'journal technique' });
    } else if (fam === 'recipiendaire') {
      out.push({ label: 'Documents accessibles', count: GO.myDocs().length, note: 'versés à vos dossiers' });
      out.push({ label: 'Cérémonies à venir', count: GO.myCers().filter(c => c.date >= GO.REF_ISO && c.state !== 'termine').length, note: 'vous concernant' });
    } else if (fam === 'inspection') {
      out.push({ label: 'Anomalies ouvertes', count: GO.myControls().filter(c => c.state === 'anomalie' || c.state === 'correction').length, note: 'signalements en cours' });
      out.push({ label: 'Contrôles effectués', count: GO.myControls().length, note: 'depuis l’ouverture du registre' });
    } else if (fam === 'autorite') {
      out.push({ label: 'À décider', count: by(list, 'transmis').length, note: 'dossiers transmis' });
      out.push({ label: 'Recours à examiner', count: GO.myRecours().filter(r => r.state === 'depose' || r.state === 'en_examen').length, note: 'recours enregistrés' });
    } else {
      const decided = by(list, 'approuve').length + by(list, 'refuse').length;
      out.push({ label: 'Décisions notifiées', count: decided, note: `${by(list, 'approuve').length} attribution(s)` });
      out.push({ label: 'Courriers à traiter', count: GO.myDocs().filter(x => x.state === 'attente_visa' || x.state === 'illisible').length, note: 'visas et numérisations' });
    }
    out.push({ label: 'Notifications', count: GO.myNotifs().filter(n => !n.read).length, note: 'non lues pour ce profil' });
    return out;
  }

  function channelCard(fam, i) {
    if (fam === 'secretariat') {
      const reg = GO.myTransmissions();
      return ui.card({ i, icon: 'inbox', title: 'Registre du jour', sub: 'Courriers reçus pour l’autorité',
        tools: `<a class="btn btn-ghost btn-sm" href="#/transmissions">Registre complet ${icon('arrow-right', 'ic-sm')}</a>`,
        body: reg.length ? `<ul class="list-plain">${reg.slice(0, 5).map(t => `<li><span style="min-width:0"><span class="ref">${esc(t.id)}</span>
            <strong style="display:block;font-size:13.5px;color:var(--navy-900)">${esc(t.subject)}</strong>
            <span class="muted" style="font-size:12px">${esc(t.from)} → ${esc(t.to)}</span></span>
          <span style="text-align:right">${GO.dictBadge(D.transmissionStates, t.state)}<br><span class="muted" style="font-size:11.5px">${fmtDate(t.date, 'short')}</span></span></li>`).join('')}</ul>`
          : GO.empty('inbox', 'Aucun courrier au registre', 'Les courriers reçus pour votre autorité apparaîtront ici.') });
    }
    if (fam === 'regie') {
      const st = GO.S.stock;
      return ui.card({ i, icon: 'box', title: 'État du stock', sub: 'Physique, réservé et seuil d’alerte',
        tools: `<a class="btn btn-ghost btn-sm" href="#/stock">Gérer ${icon('arrow-right', 'ic-sm')}</a>`,
        body: `<div class="mini-table"><table><thead><tr><th scope="col">Médaille</th><th scope="col">Physique</th><th scope="col">Réservé</th><th scope="col">Seuil</th></tr></thead>
          <tbody>${st.map(s => `<tr><td>${esc(s.label)}</td><td class="tnum">${s.available}</td><td class="tnum">${s.reserved}</td>
            <td class="tnum">${s.available <= s.threshold ? GO.badge('seuil atteint', 'red') : s.threshold}</td></tr>`).join('')}</tbody></table></div>` });
    }
    if (fam === 'demandeur') {
      const docs = GO.myDocs().slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
      return ui.card({ i, icon: 'mail', title: 'Courriers récents', sub: 'Échanges avec le Service des Distinctions',
        tools: `<a class="btn btn-ghost btn-sm" href="#/courriers">Tous les courriers ${icon('arrow-right', 'ic-sm')}</a>`,
        body: docs.length ? docs.map(x => `<div class="doc-mini"><span class="doc-ico t-${x.type}">${icon(x.kind === 'decision' ? 'stamp' : 'mail')}</span>
          <div><strong>${esc(x.title)}</strong><span>${esc(x.number || D.docTypes[x.type])} · ${fmtDate(x.date, 'short')}</span><div style="margin-top:4px">${GO.docBadge(x.state)}</div></div>
          <a class="btn btn-secondary btn-xs" href="#/courriers/${x.id}">${icon('eye', 'ic-sm')}Consulter</a></div>`).join('')
          : GO.empty('mail', 'Aucun courrier', 'Les décisions et demandes de complément apparaîtront ici.') });
    }
    if (fam === 'autorite') {
      const att = GO.myDossiers().filter(d => d.status === 'transmis');
      return ui.card({ i, icon: 'stamp', title: 'Transmis pour décision', sub: `Dossiers en attente d’une décision de ${esc(GO.actorName())}`,
        tools: `<a class="btn btn-ghost btn-sm" href="#/decisions">Décisions ${icon('arrow-right', 'ic-sm')}</a>`,
        body: att.length ? `<ul class="list-plain">${att.slice(0, 5).map(d => `<li><span style="min-width:0"><span class="ref">${esc(d.ref)}</span>
            <strong style="display:block;font-size:13.5px;color:var(--navy-900)">${esc(GO.org(d.org).name)}</strong>
            <span class="muted" style="font-size:12px">${plural(d.recipients.length, 'récipiendaire', 'récipiendaires')} · transmis le ${fmtDate((d.history.find(h => h.kind === 'transmission') || {}).date || d.depot, 'short')}</span></span>
          <a class="btn btn-secondary btn-xs" href="#/dossiers/${d.ref}">Instruire</a></li>`).join('')}</ul>`
          : GO.empty('check-circle', 'Aucun dossier en attente', 'Les dossiers transmis pour votre décision apparaîtront ici.') });
    }
    if (fam === 'inspection') {
      const ctls = GO.myControls().slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
      return ui.card({ i, icon: 'shield', title: 'Contrôles récents', sub: 'Derniers contrôles menés',
        tools: `<a class="btn btn-ghost btn-sm" href="#/controle">Tous les contrôles ${icon('arrow-right', 'ic-sm')}</a>`,
        body: ctls.length ? `<ul class="list-plain">${ctls.map(c => `<li><span style="min-width:0"><span class="ref">${esc(c.id)}</span>
            <strong style="display:block;font-size:13.5px;color:var(--navy-900)">${esc(c.scope)} — ${esc(c.dossier)}</strong>
            <span class="muted" style="font-size:12px">${c.findings.length} observation(s) · ${fmtDate(c.date, 'short')}</span></span>
          ${GO.dictBadge(D.controlStates, c.state)}</li>`).join('')}</ul>`
          : GO.empty('shield', 'Aucun contrôle', 'Vos contrôles documentaires apparaîtront ici.') });
    }
    if (fam === 'administration') {
      const logs = GO.S.audit.slice(0, 5);
      return ui.card({ i, icon: 'clock', title: 'Journal technique', sub: 'Derniers événements enregistrés',
        tools: `<a class="btn btn-ghost btn-sm" href="#/journal">Journal complet ${icon('arrow-right', 'ic-sm')}</a>`,
        body: `<ul class="list-plain">${logs.map(l => `<li><span style="min-width:0"><span class="ref">${esc(l.id)}</span>
          <strong style="display:block;font-size:13.5px;color:var(--navy-900)">${esc(l.action)}</strong>
          <span class="muted" style="font-size:12px">${esc(l.actor)} · ${esc(l.role)}</span></span>
          <span class="muted tnum" style="font-size:12px">${fmtDate(l.date, 'short')} ${esc(l.time)}</span></li>`).join('')}</ul>` });
    }
    // service : courriers à traiter
    const queue = GO.myDocs().filter(x => x.state === 'attente_visa' || x.state === 'illisible');
    return ui.card({ i, icon: 'stamp', title: 'Courriers à traiter', sub: 'Visas attendus et pièces à renumériser',
      tools: `<a class="btn btn-ghost btn-sm" href="#/courriers">Courriers ${icon('arrow-right', 'ic-sm')}</a>`,
      body: queue.length ? `<ul class="visa-queue">${queue.map(x => `<li><span class="doc-ico t-${x.type}">${icon(x.type === 'note' ? 'stamp' : 'file')}</span>
        <span><strong>${esc(x.title)}</strong><span>${esc(x.dossier)} · ${esc(fmtDate(x.date, 'short'))}</span><br>${GO.docBadge(x.state)}</span>
        <a class="btn btn-secondary btn-sm" href="#/courriers/${x.id}">Consulter</a></li>`).join('')}</ul>`
        : GO.empty('check-circle', 'Aucun courrier en attente', 'Les notes à viser et les pièces à renumériser apparaîtront ici.') });
  }

  function familyCard(fam, i) {
    if (fam === 'recipiendaire') {
      const disc = GO.distinctOf(GO.S.person ? GO.S.person.ids[1] : null).concat(GO.S.person ? GO.distinctOf(GO.S.person.ids[0]) : []);
      return ui.card({ i, icon: 'medal', title: 'Mes distinctions', sub: 'Suivi des distinctions vous concernant',
        tools: `<a class="btn btn-ghost btn-sm" href="#/distinctions">Détail ${icon('arrow-right', 'ic-sm')}</a>`,
        body: disc.length ? `<ul class="list-plain">${disc.map(x => `<li><span style="min-width:0">
            <strong style="display:block;font-size:13.5px;color:var(--navy-900)">${esc(GO.medal(x.medal).short)} — ${x.year}</strong>
            <span class="muted" style="font-size:12px">${esc(x.id)} · dossier ${esc(x.dossier)}</span></span>
          ${x.state === 'remise' ? GO.badge('Remise effectuée', 'green') : GO.badge('Attribuée', 'blue')}</li>`).join('')}</ul>`
          : GO.empty('medal', 'Aucune distinction', 'Vos distinctions apparaîtront ici.') });
    }
    const recent = GO.myDossiers().slice().sort((a, b) => (GO.lastActivity(b).date).localeCompare(GO.lastActivity(a).date)).slice(0, 5);
    return ui.card({ i, icon: 'folder', title: 'Dossiers récents', sub: 'Derniers dossiers modifiés',
      tools: GO.role().views.includes('dossiers') ? `<a class="btn btn-ghost btn-sm" href="#/dossiers">Tous ${icon('arrow-right', 'ic-sm')}</a>` : '',
      body: recent.length ? `<ul class="list-plain">${recent.map(d => `<li><span style="min-width:0"><span class="ref">${esc(d.ref)}</span>
          <strong style="display:block;font-size:13.5px;color:var(--navy-900)">${esc(GO.org(d.org).short)}</strong>
          <span class="muted" style="font-size:12px">${esc(GO.lastActivity(d).label)} · ${esc(relDay(GO.lastActivity(d).date))}</span></span>
        ${GO.statusBadge(d.status)}</li>`).join('')}</ul>`
        : GO.empty('folder', 'Aucun dossier', 'Les dossiers visibles avec ce profil apparaîtront ici.') });
  }

  // Graphique des dépôts mensuels (services et autorités)
  function drawDeposits(host, list) {
    const months = []; for (let m = 0; m <= GO.REF.getMonth(); m++) months.push(m);
    const perMonth = months.map(m => list.filter(d => GO.parseISO(d.depot).getMonth() === m && d.depot.startsWith('2026')).length);
    if (window.GOCharts) GOCharts.mount(host, 'bar', { labels: months.map(m => GO.MONTHS[m] + ' 2026'), short: months.map(m => GO.MONTHS_S[m].replace('.', '')), values: perMonth, unit: 'dossier(s) déposé(s)', height: 200, color: 'var(--navy-800)', aria: 'Dossiers déposés par mois en 2026' });
  }
  GO.views.apercu = { render: renderApercu };

  /* ======================= DOSSIERS ======================= */
  const DF = { q: '', status: 'all', period: 'all', sort: 'activity', authority: 'all' };
  const PERIODS = { all: 'Toutes les périodes', d30: '30 derniers jours', T4: '4ᵉ trimestre 2026', T3: '3ᵉ trimestre 2026', T2: '2ᵉ trimestre 2026', T1: '1ᵉʳ trimestre 2026' };
  const SORTS = { activity: 'Dernière activité', depot_desc: 'Dépôt le plus récent', depot_asc: 'Dépôt le plus ancien', ref: 'Référence', recips: 'Nombre de récipiendaires' };

  function inPeriod(d) {
    if (DF.period === 'all') return true;
    if (DF.period === 'd30') return ageDays(d.depot) <= 30 && ageDays(d.depot) >= 0;
    const q = +DF.period.slice(1), m = GO.parseISO(d.depot).getMonth();
    return d.depot.startsWith('2026') && Math.floor(m / 3) + 1 === q;
  }
  function filteredDossiers() {
    const q = norm(DF.q.trim());
    const base = GO.myDossiers().filter(d => {
      const o = GO.org(d.org);
      return (!q || norm(`${d.ref} ${o.name} ${o.short} ${o.city} ${o.contact}`).includes(q))
        && inPeriod(d) && (DF.authority === 'all' || d.authority === DF.authority);
    });
    const counts = Object.fromEntries(['all', ...D.statusOrder].map(s => [s, s === 'all' ? base.length : base.filter(d => d.status === s).length]));
    let list = DF.status === 'all' ? base.slice() : base.filter(d => d.status === DF.status);
    const la = d => { const h = GO.lastActivity(d); return h.date + h.time; };
    const sorters = { activity: (a, b) => la(b).localeCompare(la(a)), depot_desc: (a, b) => b.depot.localeCompare(a.depot), depot_asc: (a, b) => a.depot.localeCompare(b.depot), ref: (a, b) => a.ref.localeCompare(b.ref), recips: (a, b) => b.recipients.length - a.recipients.length };
    return { list: list.sort(sorters[DF.sort]), counts };
  }

  function renderDossiers(main, r) {
    if (r.params.get('status')) DF.status = r.params.get('status');
    if (!['all', ...D.statusOrder].includes(DF.status)) DF.status = 'all';
    if (r.params.get('q')) DF.q = r.params.get('q');
    const auts = [...new Set(GO.myDossiers().map(d => d.authority))];
    main.innerHTML = `
      ${ui.head({ eyebrow: 'Instruction', title: GO.external() ? 'Mes dossiers' : 'Dossiers',
        sub: GO.external() ? 'Demandes déposées par votre organisme, leur avancement et les pièces échangées.' : 'Consultation et suivi des demandes de distinctions : recherche, filtres et détail de chaque dossier.',
        actions: GO.can('create') ? `<a class="btn btn-primary" href="#/nouveau">${icon('plus')}Nouveau dossier</a>` : '' })}
      <section class="card reveal" style="--i:1">
        ${ui.toolbar({
          search: { id: 'df-q', label: 'Rechercher', placeholder: 'Référence, organisme, ville…', value: DF.q },
          selects: [
            { id: 'df-status', label: 'Statut', value: DF.status, options: [{ value: 'all', label: 'Tous les statuts' }, ...D.statusOrder.map(s => ({ value: s, label: D.statuses[s].label }))] },
            { id: 'df-period', label: 'Période de dépôt', value: DF.period, options: Object.entries(PERIODS).map(([k, v]) => ({ value: k, label: v })) },
            ...(auts.length > 1 ? [{ id: 'df-authority', label: 'Autorité destinataire', value: DF.authority, options: [{ value: 'all', label: 'Toutes les autorités' }, ...auts.map(a => ({ value: a, label: GO.authority(a).short }))] }] : []),
            { id: 'df-sort', label: 'Trier par', value: DF.sort, options: Object.entries(SORTS).map(([k, v]) => ({ value: k, label: v })) }
          ]
        })}
        ${ui.filterBar(`<div class="chip-row" id="df-chips" role="group" aria-label="Filtrer par statut">${ui.chips(['all', ...D.statusOrder].map(s => ({ key: s, label: s === 'all' ? 'Tous' : D.statuses[s].short, n: filteredDossiers().counts[s], tone: s === 'all' ? null : D.statuses[s].tone })), DF.status, { attr: 'data-s' }).replace(/^<div class="chip-row"[^>]*>|<\/div>$/g, '')}</div>`, `<span id="df-count" aria-live="polite"></span>`)}
        <div class="table-wrap" id="df-wrap">
          <table class="data-table responsive" id="df-table">
            <caption class="sr-only">Liste des dossiers de distinction</caption>
            <thead><tr><th scope="col">Référence</th><th scope="col">Demandeur</th><th scope="col">Dépôt</th><th scope="col" class="num">Récip.</th><th scope="col">Étape</th><th scope="col">Statut</th><th scope="col">Autorité</th><th scope="col">Dernière activité</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
            <tbody></tbody>
          </table>
          <div id="df-empty"></div>
        </div>
      </section>`;
    const redraw = animate => drawList(main, animate);
    $('#df-chips', main).addEventListener('click', e => {
      const c = e.target.closest('[data-s]'); if (!c) return;
      DF.status = c.dataset.s; GO.setHash('#/dossiers' + (DF.status !== 'all' ? '?status=' + DF.status : '')); redraw(true);
    });
    $('#df-q', main).addEventListener('input', GO.debounce(e => { DF.q = e.target.value; redraw(true); }, 160));
    $('#df-q', main).addEventListener('input', () => $('#df-wrap', main).classList.add('is-filtering'));
    ['df-status', 'df-period', 'df-sort', 'df-authority'].forEach(id => { const el = $('#' + id, main); if (el) el.addEventListener('change', e => { DF[id.slice(3)] = e.target.value; redraw(true); }); });
    $('#df-table', main).addEventListener('click', e => {
      const btn = e.target.closest('[data-open]');
      const tr = e.target.closest('tr[data-ref]');
      if (btn || (tr && !e.target.closest('a,button'))) location.hash = '#/dossiers/' + (btn ? btn.dataset.open : tr.dataset.ref);
    });
    main.addEventListener('click', e => {
      if (e.target.closest('[data-reset-filters]')) {
        DF.q = ''; DF.status = 'all'; DF.period = 'all'; DF.authority = 'all'; $('#df-q', main).value = ''; GO.setHash('#/dossiers'); redraw(true); $('#df-q', main).focus();
      }
    });
    drawList(main, false);
    if (r.id) openDossier(r.id);
  }

  function drawList(main, animate) {
    const { list, counts } = filteredDossiers();
    const chips = $('#df-chips', main);
    if (chips) chips.innerHTML = ui.chips(['all', ...D.statusOrder].map(s => ({ key: s, label: s === 'all' ? 'Tous' : D.statuses[s].short, n: counts[s], tone: s === 'all' ? null : D.statuses[s].tone })), DF.status, { attr: 'data-s', label: 'Filtrer par statut' }).replace(/^<div class="chip-row"[^>]*>|<\/div>$/g, '');
    const cnt = $('#df-count', main);
    if (cnt) cnt.innerHTML = `<strong>${list.length}</strong> ${list.length > 1 ? 'dossiers affichés' : 'dossier affiché'}`;
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
        <td data-label="Autorité">${GO.authority(d.authority) ? GO.badge(GO.authority(d.authority).short, 'navy') : '—'}</td>
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
    if (r.params.get('status') && r.params.get('status') !== DF.status) { DF.status = r.params.get('status'); }
    if (r.id) openDossier(r.id); else if (GO.isDrawerOpen()) GO.closeDrawer(true);
    drawList(main, false);
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
    const c = GO.cersOf(d.ref)[0], or = GO.receiptOrder(d.ref), rcs = GO.recoursOf(d.ref);
    switch (d.status) {
      case 'recu': return ['Vérifier la recevabilité de la demande et des pièces jointes', 'Ouvrir l’instruction ou demander un complément'];
      case 'en_cours': return !note ? ['Contrôler les récipiendaires, les DTS et les pièces', 'Préparer la note de transmission à la hiérarchie']
        : note.state === 'attente_visa' ? ['Faire viser la note de transmission par le Chef du Service', `Transmettre ensuite à ${GO.authority(d.authority).label}`] : [`Transmettre le dossier à ${GO.authority(d.authority).label}`];
      case 'complement': return [`Attendre le complément demandé le ${fmtDate(d.complementSince)}`, 'Relancer le demandeur si le délai se prolonge'];
      case 'transmis': return [`Décision attendue de ${GO.authority(d.authority).label}`, 'Enregistrer la décision dès réception du courrier'];
      case 'approuve': {
        const out = [];
        if (!or) out.push('Émettre l’ordre de recette correspondant aux distinctions attribuées');
        else if (or.state !== 'verifie') out.push(`Paiement à suivre : ${or.id} (${D.recetteStates[or.state].label.toLowerCase()})`);
        if (!c) out.push('Proposer une date et un lieu pour la cérémonie de remise');
        else if (c.state === 'termine') out.push(`Dossier clos : remise enregistrée le ${fmtDate(GO.remiseOf(d.ref) ? GO.remiseOf(d.ref).date : c.date)}`);
        else if (c.state === 'conflit') out.push('Proposer une nouvelle date ou un autre lieu (conflit identifié)');
        else if (c.state === 'confirme') out.push(`Préparer la remise du ${fmtDate(c.date)} (${GO.venue(c.venue).name})`, 'Réserver et préparer les médailles à la régie');
        else out.push(`Validation de la date proposée (${fmtDate(c.date)}) par l’autorité compétente`);
        return out;
      }
      case 'refuse': return rcs ? [`Recours ${rcs.id} : ${D.recoursStates[rcs.state].label.toLowerCase()}`, 'Informer le demandeur de la suite donnée'] : ['Informer le demandeur de la décision', 'Un recours reste possible selon les conditions prévues par la procédure'];
    }
    return [];
  }

  function actionsFor(d) {
    const a = [], can = GO.can;
    const note = GO.docsOf(d.ref).find(x => x.kind === 'transmission');
    const or = GO.receiptOrder(d.ref), rec = or && GO.receiptOf(d.ref);
    const c = GO.cersOf(d.ref)[0], rem = GO.remiseOf(d.ref), wd = GO.withdrawalOf(d.ref);
    const ctl = GO.controlOf(d.ref), rcs = GO.recoursOf(d.ref);
    if (d.status === 'recu') {
      if (can('complement')) a.push(['complement', 'secondary', 'paperclip', 'Demander un complément']);
      if (can('instruct')) a.push(['instruct', 'primary', 'check', 'Ouvrir l’instruction']);
    }
    if (d.status === 'en_cours') {
      if (can('verify')) a.push(['verify', 'secondary', 'shield', 'Vérifier les bénéficiaires et les pièces']);
      if (can('complement')) a.push(['complement', 'secondary', 'paperclip', 'Demander un complément']);
      if (!note && can('note')) a.push(['note', 'primary', 'file', 'Préparer la note de transmission']);
      if (note && note.state === 'attente_visa') {
        if (can('visa')) a.push(['visa', 'primary', 'stamp', 'Viser la note de transmission']);
        else if (can('note')) a.push(['', 'secondary', 'clock', 'Transmettre', 'La note doit d’abord être visée par le Chef du Service']);
      }
      if (note && note.state === 'vise') {
        if (can('transmit')) a.push(['transmit', 'primary', 'send', 'Transmettre à ' + GO.authority(d.authority).short]);
        else if (can('note')) a.push(['', 'secondary', 'send', 'Transmettre', 'Transmission réservée au Chef du Service']);
      }
    }
    if (d.status === 'complement') {
      if (can('relance')) a.push(['relance', 'secondary', 'refresh', 'Relancer le demandeur']);
      if (can('answer')) a.push(['answer', 'primary', 'upload', 'Déposer le complément']);
    }
    if (d.status === 'transmis' && can('decide')) a.push(['decide', 'primary', 'check-circle', 'Enregistrer la décision']);
    if (d.status === 'transmis' && can('avis')) a.push(['avis', 'secondary', 'message', 'Consigner un avis hiérarchique']);
    if ((d.status === 'approuve' || d.status === 'refuse')) {
      if (can('recette') && d.status === 'approuve' && !or) a.push(['recette', 'primary', 'cash', 'Émettre l’ordre de recette']);
      if (can('deposer_recu') && or && (or.state === 'emis' || or.state === 'rejete')) a.push(['deposer_recu', 'primary', 'upload', 'Déposer le reçu de paiement']);
      if (can('paiement_verif') && or && or.state === 'recu_depose') a.push(['verif_recu', 'primary', 'shield', 'Vérifier le reçu de paiement']);
      if (can('propose') && d.status === 'approuve') {
        const ac = GO.activeCer(d.ref);
        if (ac) a.push(['cer', 'secondary', 'calendar', 'Voir la cérémonie']);
        else if (!(c && c.state === 'termine')) a.push(['propose', 'primary', 'pin', c && c.state === 'conflit' ? 'Proposer une nouvelle date' : 'Programmer la cérémonie']);
      }
      if (can('valider_ceremonie') && c && (c.state === 'propose' || c.state === 'negociation')) a.push(['valider_cer', 'primary', 'shield', 'Valider la date de cérémonie']);
      if (can('coordinate') && c && c.state === 'negociation') a.push(['negocier', 'secondary', 'message', 'Négocier la date']);
      const remEffective = rem && (rem.state === 'remise' || rem.state === 'retrait');
      if (can('coordinate') && c && c.state === 'confirme' && c.date <= GO.REF_ISO) {
        if (remEffective) a.push(['cer_done', 'primary', 'check', 'Clôturer la cérémonie']);
        else a.push(['cer_done', 'secondary', 'check', 'Clôturer la cérémonie', 'La remise effective doit d’abord être enregistrée par la Régie']);
      }
      if (can('recours') && d.status === 'refuse') a.push(['recours', 'secondary', 'scale', rcs ? 'Instruire le recours' : 'Recours déposé']);
    }
    if (can('remise') && d.status === 'approuve' && c && (c.state === 'confirme' || c.state === 'termine')) {
      if (!rem || rem.state === 'a_preparer') a.push(['remise_prep', 'secondary', 'box', 'Préparer et réserver les médailles']);
      else if (rem.state === 'preparee') a.push(['remise_ok', 'primary', 'medal', 'Enregistrer la remise effective']);
    }
    if (can('retrait') && d.status === 'approuve' && !wd && !remEffective) a.push(['retrait_demande', 'secondary', 'medal', 'Demander un retrait sans cérémonie']);
    if (can('retrait_traitement') && wd) {
      if (wd.state === 'demande') a.push(['retrait_valide', 'primary', 'check', 'Enregistrer l’autorisation de retrait']);
      else if (wd.state === 'valide') a.push(['retrait_remis', 'primary', 'medal', 'Enregistrer le retrait effectif']);
    }
    if (can('control')) a.push(['control', ctl ? 'secondary' : 'primary', 'shield', ctl ? 'Compléter le contrôle' : 'Effectuer un contrôle']);
    return a;
  }

  function panelHTML(d) {
    const o = GO.org(d.org), la = GO.lastActivity(d), a = GO.authority(d.authority);
    const visible = d => !(GO.external() && d.internal);
    const docs = docsOf(d, true).filter(visible);
    const canDocs = GO.role().views.includes('courriers');
    const hist = GO.sortHist(d.history).reverse();
    const acts = actionsFor(d);
    const dts = dtsOf(d);
    const or = GO.receiptOrder(d.ref), rec = or && GO.receiptOf(d.ref);
    const c = GO.cersOf(d.ref)[0], rem = GO.remiseOf(d.ref), wd = GO.withdrawalOf(d.ref), ctl = GO.controlOf(d.ref), rcs = GO.recoursOf(d.ref), cpl = GO.complementOf(d.ref);
    const trans = GO.S.transmissions.filter(t => t.dossier === d.ref).sort((x, y) => (y.date + y.time).localeCompare(x.date + x.time));
    const myRec = GO.S.person && GO.role().scope && GO.role().scope.kind === 'person' ? d.recipients.filter(r => (Array.isArray(GO.role().scope.value) ? GO.role().scope.value : [GO.role().scope.value]).includes(r.id)) : d.recipients;
    return `
      <header class="drawer-head">
        <div class="drawer-head-top"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="ref-chip ref">${d.ref}</span><span id="dp-status">${GO.statusBadge(d.status)}</span>${GO.badge(a.short, 'navy')}</div>
          <button class="icon-btn" type="button" data-dclose aria-label="Fermer le détail du dossier">${icon('x')}</button></div>
        <h2 class="drawer-title" id="drawer-title">${esc(o.name)}</h2>
        <p class="drawer-sub">Déposé le ${fmtDate(d.depot)} · ${plural(d.recipients.length, 'récipiendaire', 'récipiendaires')} · ${d.agent ? 'instruit par ' + esc(d.agent) : 'agent instructeur non désigné'}</p>
      </header>
      <div class="drawer-body">
        <section class="d-section" style="--i:0" aria-labelledby="ds-id">
          <div class="d-section-head"><h3 id="ds-id">${icon('folder')}Identification du dossier</h3></div>
          ${GO.stepper(d)}
          ${ui.dl([
            ['Référence', `<span class="ref">${d.ref}</span>`],
            ['Date de dépôt', fmtDate(d.depot)],
            ['Statut', esc(D.statuses[d.status].label)],
            ['Autorité destinataire', esc(a.label)],
            ['Voie de dépôt', esc(d.channel || '—')],
            ['Dernière activité', `${esc(la.label)} <span class="muted">· ${esc(relDay(la.date))}</span>`],
            ['Médailles proposées', esc(medalSummary(d))],
            ['Agent instructeur', esc(d.agent || '—')]
          ], 'mt')}
        </section>

        ${GO.external() ? `<section class="d-section" style="--i:1" aria-labelledby="ds-mine">
          <div class="d-section-head"><h3 id="ds-mine">${icon('user')}Personnes vous concernant <span class="n">${myRec.length}</span></h3></div>
          <div class="mini-table"><table><thead><tr><th scope="col">Nom</th><th scope="col">Fonction</th><th scope="col">Entrée</th><th scope="col">Médaille</th><th scope="col">DTS</th></tr></thead><tbody>
            ${myRec.map(r => { const t = dtsFor(d, r.id); return `<tr><td><strong style="color:var(--navy-900)">${esc(r.nom.toUpperCase())}</strong> ${esc(r.prenom)}</td><td>${esc(r.fonction)}</td>
              <td class="tnum">${fmtDate(r.entree, 'short')}</td><td>${esc(GO.medal(r.medal).short)}</td><td>${t ? GO.dictBadge(D.dtsStates, t.state) : GO.badge('DTS non saisie', 'slate')}</td></tr>`; }).join('')}
          </tbody></table></div></section>` : `
        <section class="d-section" style="--i:1" aria-labelledby="ds-dem">
          <div class="d-section-head"><h3 id="ds-dem">${icon('building')}Demandeur</h3></div>
          ${ui.dl([
            ['Organisme', esc(o.name)],
            ['Type · secteur', `${esc(o.type)} · ${esc(o.sector)}`],
            ['Interlocuteur', `${esc(o.contact)}<br><span class="muted" style="font-weight:400;font-size:12px">${esc(o.contactRole)}</span>`],
            ['Coordonnées', `<a href="mailto:${esc(o.email)}">${esc(o.email)}</a><br><span class="tnum" style="font-weight:400">${esc(o.phone)}</span>`]
          ])}
        </section>`}

        <section class="d-section" style="--i:2" aria-labelledby="ds-rec">
          <div class="d-section-head"><h3 id="ds-rec">${icon('users')}Récipiendaires <span class="n">${d.recipients.length}</span></h3>
            ${dts.length ? `<span class="muted" style="font-size:12px">${dts.filter(t => t.state === 'verifie').length}/${d.recipients.length} DTS vérifiées</span>` : ''}</div>
          ${recipientsTable(d, !GO.external())}
          ${!GO.external() && dts.length < d.recipients.length ? `<p class="hint mt">${plural(d.recipients.length - dts.length, 'DTS n’est pas encore saisie', 'DTS ne sont pas encore saisies')} pour ce dossier.</p>` : ''}
        </section>

        <section class="d-section" style="--i:3" aria-labelledby="ds-circuit">
          <div class="d-section-head"><h3 id="ds-circuit">${icon('inbox')}Circuit et transmissions <span class="n">${trans.length}</span></h3>
            <a class="btn btn-ghost btn-xs" href="#/transmissions?dossier=${d.ref}">Registre</a></div>
          ${trans.length ? `<div class="mini-table"><table><thead><tr><th scope="col">Référence</th><th scope="col">Sens</th><th scope="col">De → À</th><th scope="col">Objet</th><th scope="col">État</th></tr></thead><tbody>
            ${trans.slice(0, 6).map(t => `<tr><td class="ref">${esc(t.id)}</td><td>${t.direction === 'entrant' ? 'Entrant' : 'Sortant'}</td>
              <td>${esc(t.from)}<br><span class="muted">→ ${esc(t.to)}</span></td><td>${canDocs && t.file ? `<a href="#/courriers/${t.file}">${esc(t.subject)}</a>` : esc(t.subject)}</td>
              <td>${GO.dictBadge(D.transmissionStates, t.state)}</td></tr>`).join('')}</tbody></table></div>`
            : `<p class="muted" style="font-size:13px">Aucun courrier enregistré au registre pour ce dossier.</p>`}
        </section>

        ${(c || wd) ? `<section class="d-section" style="--i:4" aria-labelledby="ds-cer">
          <div class="d-section-head"><h3 id="ds-cer">${icon('calendar')}Cérémonie et remise</h3>${c ? `<a class="btn btn-ghost btn-xs" href="#/ceremonies/${c.id}">Ouvrir dans le calendrier</a>` : ''}</div>
          <dl class="dl-grid">
            ${c ? `<div><dt>Cérémonie</dt><dd><span class="ref">${esc(c.id)}</span> · ${fmtDate(c.date)} à ${esc(c.time.replace(':', ' h '))}<br><span class="muted">${esc(GO.venue(c.venue).name)}, ${esc(GO.venue(c.venue).city)}</span></dd></div>
            <div><dt>État</dt><dd>${GO.cerBadge(c.state)}${c.validation ? `<br><span class="muted" style="font-weight:400;font-size:12px">${esc(c.validation)}</span>` : ''}</dd></div>` : ''}
            <div><dt>Remise</dt><dd>${rem ? `${GO.dictBadge(D.remiseStates, rem.state)}<br><span class="muted" style="font-weight:400;font-size:12px">${esc(rem.mode)} · ${fmtDate(rem.date)}</span>` : '<span class="muted">Préparation non commencée</span>'}</dd></div>
            ${wd ? `<div><dt>Retrait sans cérémonie</dt><dd>${GO.dictBadge(D.withdrawalStates, wd.state)}<br><span class="muted" style="font-weight:400;font-size:12px">demandé le ${fmtDate(wd.date)}</span></dd></div>` : ''}
          </dl></section>` : ''}

        ${(or || cpl) ? `<section class="d-section" style="--i:5" aria-labelledby="ds-fact">
          <div class="d-section-head"><h3 id="ds-fact">${icon('cash')}Ordre de recette et paiement</h3></div>
          ${cpl && cpl.state !== 'satisfait' ? `<div class="alert alert-warn" style="margin-bottom:12px">${icon('paperclip')}<div><strong>Complément demandé le ${fmtDate(cpl.requested)}</strong><p style="margin-top:4px">${esc(cpl.items)}</p>
            <p class="muted" style="font-size:12px;margin-top:4px">Échéance : ${fmtDate(cpl.due)}${cpl.relances ? ` · ${plural(cpl.relances, 'relance envoyée', 'relances envoyées')}` : ''}</p></div></div>` : ''}
          ${or ? `<dl class="dl-grid">
            <div><dt>Ordre de recette</dt><dd><span class="ref">${esc(or.id)}</span><br><span class="muted">émis le ${fmtDate(or.issued)}</span></dd></div>
            <div><dt>Montant</dt><dd class="tnum">${esc(or.amount)}<br><span class="muted" style="font-weight:400;font-size:12px">échéance ${fmtDate(or.due, 'short')}</span></dd></div>
            <div><dt>État</dt><dd>${GO.dictBadge(D.recetteStates, or.state)}</dd></div>
            <div><dt>Reçu</dt><dd>${rec ? `déposé le ${fmtDate(rec.date)}<br><span class="muted" style="font-weight:400;font-size:12px">${esc(rec.file ? rec.file.name : '')}</span>${rec.verifiedBy ? `<br><span class="muted" style="font-weight:400;font-size:12px">vérifié par ${esc(rec.verifiedBy)} le ${fmtDate(rec.verifiedOn)}</span>` : ''}` : '<span class="muted">non déposé</span>'}</dd></div>
          </dl>
          <p class="hint mt">${icon('info', 'ic-sm')} Le paiement est effectué hors application. GAB-ORIENT enregistre l’ordre de recette, le reçu déposé et sa vérification.</p>` : ''}
        </section>` : ''}

        ${(ctl || rcs) ? `<section class="d-section" style="--i:6" aria-labelledby="ds-ctl">
          <div class="d-section-head"><h3 id="ds-ctl">${icon('shield')}Contrôle et recours</h3>${GO.role().views.includes('controle') ? `<a class="btn btn-ghost btn-xs" href="#/controle?dossier=${d.ref}">Contrôles</a>` : ''}</div>
          ${ctl ? `<div class="obs"><div class="obs-meta">${esc(ctl.id)} · ${esc(ctl.inspector)} · ${fmtDate(ctl.date)} · ${esc(ctl.scope)}</div>
            ${GO.dictBadge(D.controlStates, ctl.state)}
            ${ctl.findings.length ? `<ul class="list-plain mt" style="border:1px solid var(--line);border-radius:8px">${ctl.findings.map(f => `<li style="padding:8px 12px"><span>${esc(f.label)}</span>${GO.badge(f.severity, f.severity === 'majeure' ? 'red' : 'yellow')}</li>`).join('')}</ul>` : ''}
            ${ctl.note ? `<p class="muted mt" style="font-size:12.5px">${esc(ctl.note)}</p>` : ''}</div>` : ''}
          ${rcs ? `<div class="obs mt"><div class="obs-meta">${esc(rcs.id)} · déposé le ${fmtDate(rcs.date)} par ${esc(rcs.author)}</div>
            ${GO.dictBadge(D.recoursStates, rcs.state)}<p class="mt" style="font-size:13px">${esc(rcs.motif)}</p>
            ${GO.role().views.includes('recours') ? `<a class="btn btn-ghost btn-xs mt" href="#/recours/${rcs.id}">Ouvrir le recours ${icon('arrow-right', 'ic-sm')}</a>` : ''}</div>` : ''}
        </section>` : ''}

        <section class="d-section" style="--i:7" aria-labelledby="ds-doc">
          <div class="d-section-head"><h3 id="ds-doc">${icon('paperclip')}Pièces jointes et courriers <span class="n">${docs.length}</span></h3>${canDocs && docs.length ? `<a class="btn btn-ghost btn-xs" href="#/courriers?dossier=${d.ref}">Tout consulter</a>` : ''}</div>
          ${docs.length ? docs.map(x => `<div class="doc-mini"><span class="doc-ico t-${x.type}">${icon('file')}</span><div><strong>${esc(x.title)}</strong><span>${esc(D.docTypes[x.type])} · ${fmtDate(x.date, 'short')} · ${esc(x.from)}</span><div style="margin-top:4px">${GO.docBadge(x.state)}</div></div>
            ${canDocs ? `<a class="btn btn-secondary btn-xs" href="#/courriers/${x.id}">${icon('eye', 'ic-sm')}Consulter</a>` : ''}</div>`).join('') : `<p class="muted" style="font-size:13px">Aucun courrier numérisé n’est rattaché à ce dossier.</p>`}
        </section>

        <section class="d-section" style="--i:8" aria-labelledby="ds-hist">
          <div class="d-section-head"><h3 id="ds-hist">${icon('send')}Historique du dossier</h3></div>
          ${ui.timeline(hist.map(h => ({ ...h, icon: /refus/i.test(h.label) ? 'x' : h.kind === 'complement' || h.kind === 'relance' ? 'paperclip' : h.kind === 'ceremonie' ? 'medal' : 'check', kind: /refus/i.test(h.label) ? 'refus' : h.kind })))}
        </section>

        <section class="d-section" style="--i:9" aria-labelledby="ds-obs">
          <div class="d-section-head"><h3 id="ds-obs">${icon('message')}Observations</h3></div>
          <div id="dp-obs">${d.observations.length ? d.observations.map(x => `<div class="obs"><div class="obs-meta">${esc(x.author)} · ${fmtDate(x.date, 'short')}</div>${esc(x.text)}</div>`).join('') : '<p class="muted" style="font-size:13px">Aucune observation enregistrée.</p>'}</div>
          ${GO.can('observe') ? `<form class="mt" id="dp-obs-form" novalidate><div class="field"><label class="label" for="dp-obs-text">Ajouter une observation</label>
            <textarea class="textarea" id="dp-obs-text" rows="2" placeholder="Observation consignée dans le dossier…" style="min-height:64px"></textarea>
            <span class="hint">L’observation est horodatée et signée par votre profil. Elle ne vaut pas décision.</span></div>
            <div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn btn-secondary btn-sm" type="submit">${icon('plus', 'ic-sm')}Ajouter</button></div></form>` : ''}
        </section>

        <section class="d-section" style="--i:10" aria-labelledby="ds-next">
          <div class="d-section-head"><h3 id="ds-next">${icon('arrow-right')}Prochaines étapes</h3></div>
          <ul class="next-steps">${nextSteps(d).map(s => `<li>${icon('chevron-right')}<span>${esc(s)}</span></li>`).join('')}</ul>
        </section>
      </div>
      <footer class="drawer-foot">
        ${acts.length ? '' : `<span class="muted" style="font-size:13px">${GO.external() ? 'Aucune action attendue de votre part à cette étape.' : 'Aucune action disponible pour ce profil à cette étape.'}</span>`}
        <span class="spacer"></span>
        ${acts.map(([k, kind, ic, label, tip]) => tip
          ? `<span data-tip="${esc(tip)}" tabindex="0"><button type="button" class="btn btn-${kind}" disabled>${icon(ic)}${esc(label)}</button></span>`
          : `<button type="button" class="btn btn-${kind}" data-act="${k}">${icon(ic)}${esc(label)}</button>`).join('')}
      </footer>`;
  }

  function bindPanel(d) {
    const root = document.querySelector('.drawer');
    if (!root) return;
    root.onclick = e => { const b = e.target.closest('[data-act]'); if (b && b.dataset.act && ACTIONS[b.dataset.act]) ACTIONS[b.dataset.act](d, b); };
    const f = $('#dp-obs-form', root);
    if (f) f.onsubmit = e => {
      e.preventDefault();
      const t = $('#dp-obs-text', root), v = t.value.trim();
      if (v.length < 5) { GO.fieldError(t.closest('.field'), 'Saisissez une observation d’au moins 5 caractères.'); t.focus(); return; }
      GO.fieldError(t.closest('.field'), '');
      d.observations.push({ date: GO.REF_ISO, author: GO.actorName(), text: v });
      GO.addHistory(d, 'note', 'Observation ajoutée par ' + GO.role().label, undefined, { detail: v.slice(0, 80) });
      GO.commit(); refreshDossier(d, false);
      GO.toast('success', 'Observation ajoutée', d.ref);
    };
    d.history.forEach(h => { delete h.isNew; });
  }

  function refreshDossier(d, flash = true) {
    if (GO.isDrawerOpen() && GO.drawerKey() === d.ref) {
      GO.setDrawer(panelHTML(d));
      bindPanel(d);
      if (flash) { const b = $('#dp-status .badge'); if (b) b.classList.add('is-changed'); }
    }
    if (GO.current().view === 'dossiers') { const main = $('#view'); if ($('#df-table', main)) drawList(main, false); markSelected(d.ref); }
    if (GO.hooks.dossierChanged) GO.hooks.dossierChanged(d, flash);
    const row = $(`#df-table tr[data-ref="${d.ref}"] .badge`);
    if (row && flash) row.classList.add('is-changed');
  }
  GO.refreshDossier = refreshDossier;

  /* ---------- Actions métier ---------- */
  const ACTIONS = {
    async instruct(d, btn) {
      await GO.withLoading(btn, 450);
      d.status = 'en_cours';
      d.agent = d.agent || GO.user().name;
      GO.addHistory(d, 'instruction', 'Recevabilité confirmée — instruction ouverte');
      GO.notify({ type: 'transmission', aud: 'org:' + d.org, ref: d.ref, title: 'Instruction ouverte', msg: 'Votre dossier est recevable. L’instruction est en cours.' });
      if (GO.S.documents.some(x => x.dossier === d.ref && x.kind === 'transmission' && x.state === 'attente_visa')) { /* déjà une note */ }
      GO.commit(); refreshDossier(d);
      GO.toast('success', 'Instruction ouverte', `${d.ref} passe à l’étape « Instruction ».`);
    },
    verify(d) {
      const missing = d.recipients.filter(r => !dtsFor(d, r.id));
      formModal({
        title: 'Vérification des bénéficiaires et des pièces', icon: 'shield', tone: 'blue', intro:
          `<p>Le service instructeur vérifie l’ancienneté déclarée, la cohérence de la liste nominative et la présence des pièces. Les écarts constatés doivent être corrigés par un complément.</p>`,
        fields: [
          ...d.recipients.map((r, i) => { const t = dtsFor(d, r.id); const e = GO.eligibility(r); return { id: 'r' + i, label: `${r.prenom} ${r.nom} — ${r.fonction} (${e.years} ans, ${GO.medal(r.medal).short})`, type: 'select', value: t ? (t.state === 'verifie' ? 'verifie' : 'saisi') : 'absent', options: [
              { value: 'verifie', label: 'DTS vérifiée — pièces conformes' }, { value: 'anomalie', label: 'Anomalie à corriger' }, { value: 'absent', label: 'DTS non saisie' }] }; }),
          { id: 'note', label: 'Observation de vérification', type: 'textarea', rows: 2, placeholder: 'Écart constaté, pièce manquante…' }
        ],
        submit: 'Enregistrer la vérification', iconSubmit: 'check',
        run: v => {
          let verified = 0, anomalies = 0;
          d.recipients.forEach((r, i) => {
            let t = dtsFor(d, r.id);
            const val = v['r' + i];
            if (val === 'absent') return;
            if (!t) { t = { id: GO.nextRef('DTS-2026-', GO.S.dts, 1) + '', dossier: d.ref, recipient: r.id, employer: GO.org(d.org).name, position: r.fonction, start: r.entree, reference: '—', state: 'saisi', filed: GO.REF_ISO }; GO.S.dts.push(t); }
            t.state = val;
            if (val === 'verifie') { t.verifiedBy = GO.user().name; t.verifiedOn = GO.REF_ISO; verified++; }
            if (val === 'anomalie') { t.note = v.note || 'Écart signalé par le service instructeur.'; anomalies++; }
          });
          GO.addHistory(d, 'instruction', `Vérification des bénéficiaires — ${verified} conforme(s)${anomalies ? `, ${anomalies} anomalie(s)` : ''}`, undefined, { detail: v.note || '' });
          if (missing.length && verified) GO.notify({ type: 'transmission', aud: 'service', ref: d.ref, title: 'DTS vérifiées', msg: `${verified} déclaration(s) de travail et de salaire vérifiée(s).` });
          GO.commit(); refreshDossier(d);
          GO.toast(anomalies ? 'warn' : 'success', 'Vérification enregistrée', anomalies ? `${plural(anomalies, 'anomalie nécessite', 'anomalies nécessitent')} un complément.` : 'Les bénéficiaires et les pièces sont conformes.');
        }
      });
    },
    complement(d) {
      formModal({
        title: 'Demander un complément', icon: 'paperclip', tone: 'yellow',
        intro: `<p>Le demandeur <strong>${esc(GO.org(d.org).name)}</strong> recevra un courrier précisant les éléments attendus. Le dossier passera au statut « Complément demandé ».</p>`,
        fields: [
          { id: 'items', label: 'Éléments demandés', type: 'textarea', required: true, placeholder: 'Exemple : attestations d’ancienneté lisibles pour les récipiendaires proposés.', hint: 'Ce texte figurera dans le courrier adressé au demandeur.', validate: v => v.length >= 10 ? '' : 'Décrivez les éléments attendus (10 caractères minimum).' },
          { id: 'due', label: 'Échéance proposée', type: 'date', value: GO.iso(new Date(GO.REF.getTime() + 30 * 86400000)), min: GO.REF_ISO, required: true }
        ],
        submit: 'Envoyer la demande', iconSubmit: 'send',
        run: v => {
          d.status = 'complement'; d.complementSince = GO.REF_ISO;
          const doc = GO.newDoc({ dossier: d.ref, kind: 'complement', type: 'sortant', title: 'Demande de complément', date: GO.REF_ISO, from: GO.actorName(), state: 'envoye', number: GO.nextDocNumber(), request: v.items });
          GO.S.complements.push({ id: GO.nextRef('CPL-2026-', GO.S.complements, 1), dossier: d.ref, requested: GO.REF_ISO, due: v.due, doc: doc.id, items: v.items, state: 'attendu', relances: 0 });
          GO.addHistory(d, 'complement', 'Complément demandé : ' + (v.items.length > 60 ? v.items.slice(0, 57) + '…' : v.items), undefined, { detail: `échéance ${v.due}` });
          GO.notify({ type: 'complement', aud: 'org:' + d.org, ref: d.ref, doc: doc.id, title: 'Complément demandé', msg: v.items });
          GO.commit(); refreshDossier(d);
          GO.toast('success', 'Demande de complément envoyée', `Courrier ${esc(doc.number)} adressé au demandeur.`);
        }
      });
    },
    async relance(d) {
      const n = ageDays(d.complementSince || d.depot);
      const cpl = GO.complementOf(d.ref);
      const ok = await GO.confirmDialog({ title: 'Relancer le demandeur ?', tone: 'yellow', icon: 'refresh', confirm: 'Envoyer la relance',
        message: `<p>Le complément a été demandé il y a <strong>${n} jours</strong>${cpl ? ` (échéance ${fmtDate(cpl.due)})` : ''}. Une relance sera adressée à <strong>${esc(GO.org(d.org).contact)}</strong> (${esc(GO.org(d.org).email)}).</p>` });
      if (!ok) return;
      const doc = GO.newDoc({ dossier: d.ref, kind: 'relance', type: 'sortant', title: 'Relance — complément attendu', date: GO.REF_ISO, from: GO.actorName(), state: 'envoye', number: GO.nextDocNumber() });
      GO.S.relances.push({ id: GO.nextRef('REL-2026-', GO.S.relances, 21), dossier: d.ref, date: GO.REF_ISO, time: GO.stamp().time, from: GO.actorName(), to: GO.org(d.org).name, state: 'envoyee', note: `Relance à ${n} jours de la demande de complément.`, doc: doc.id });
      if (cpl) { cpl.state = 'relance'; cpl.relances = (cpl.relances || 0) + 1; }
      GO.addHistory(d, 'relance', 'Relance adressée au demandeur');
      GO.notify({ type: 'complement', aud: 'org:' + d.org, ref: d.ref, title: 'Relance : complément attendu', msg: 'Merci de transmettre les éléments demandés.' });
      GO.commit(); refreshDossier(d, false);
      GO.toast('success', 'Relance envoyée', d.ref);
    },
    async note(d, btn) {
      await GO.withLoading(btn, 500);
      const doc = GO.newDoc({ dossier: d.ref, kind: 'transmission', type: 'note', title: `Note de transmission — ${GO.authority(d.authority).short}`, date: GO.REF_ISO, from: GO.actorName(), state: 'attente_visa', number: GO.nextDocNumber(), internal: true });
      GO.addHistory(d, 'courrier', 'Note de transmission préparée — en attente de visa');
      GO.notify({ type: 'visa', aud: 'service', ref: d.ref, doc: doc.id, title: 'Note en attente de visa', msg: `La note de transmission ${doc.number} attend le visa du Chef du Service.` });
      GO.commit(); refreshDossier(d, false);
      GO.toast('success', 'Note de transmission préparée', `${esc(doc.number)} — en attente de visa.`);
    },
    visa(d) { const n = GO.docsOf(d.ref).find(x => x.kind === 'transmission' && x.state === 'attente_visa'); if (n) location.hash = '#/courriers/' + n.id; },
    async transmit(d) {
      const a = GO.authority(d.authority);
      const ok = await GO.confirmDialog({ title: 'Transmettre le dossier ?', tone: 'blue', icon: 'send', confirm: 'Transmettre',
        message: `<p>Le dossier <strong>${d.ref}</strong> et sa note de transmission visée seront adressés à <strong>${esc(a.label)}</strong>. Le dossier passera au statut « Transmis à la hiérarchie ».</p>` });
      if (!ok) return;
      d.status = 'transmis';
      GO.addHistory(d, 'transmission', `Transmis à ${a.label}`);
      GO.notify({ type: 'transmission', aud: 'authority:' + a.id, ref: d.ref, title: 'Dossier transmis pour décision', msg: `${GO.org(d.org).name} — ${d.recipients.length} récipiendaire(s) : décision attendue.` });
      GO.notify({ type: 'transmission', aud: 'org:' + d.org, ref: d.ref, title: 'Dossier transmis', msg: `Votre dossier a été transmis à ${a.label} pour décision.` });
      GO.commit(); refreshDossier(d);
      GO.toast('success', 'Dossier transmis', `${d.ref} attend désormais la décision de ${esc(a.short)}.`);
    },
    avis(d) {
      formModal({
        title: 'Consigner un avis hiérarchique', icon: 'message', tone: 'blue', kind: 'secondary',
        intro: `<p>L’avis est consigné dans le dossier et porté à la connaissance de l’autorité destinataire. Il ne constitue pas une décision.</p>`,
        fields: [{ id: 'avis', label: 'Avis', type: 'textarea', required: true, rows: 3, validate: v => v.length >= 10 ? '' : 'Formulez l’avis (10 caractères minimum).' },
          { id: 'dest', label: 'Destinataire de l’avis', type: 'select', options: D.authorities.filter(x => x.id !== d.authority).map(x => ({ value: x.id, label: x.label })) }],
        submit: 'Consigner l’avis',
        run: v => {
          d.observations.push({ date: GO.REF_ISO, author: `${GO.actorName()} — ${GO.role().label}`, text: `Avis hiérarchique : ${v.avis}` });
          GO.addHistory(d, 'note', 'Avis hiérarchique consigné', GO.actorName(), { detail: v.avis.slice(0, 80) });
          GO.notify({ type: 'decision', aud: 'authority:' + v.dest, ref: d.ref, title: 'Avis hiérarchique reçu', msg: v.avis });
          GO.commit(); refreshDossier(d, false);
          GO.toast('success', 'Avis consigné', `Transmis à ${esc(GO.authority(v.dest).short)}.`);
        }
      });
    },
    decide(d) {
      const a = GO.authority(d.authority);
      formModal({
        title: 'Enregistrer la décision', icon: 'stamp', tone: 'green',
        intro: `<div class="alert alert-info">${icon('info')}<div>La décision est enregistrée <strong>au nom de ${esc(a.label)}</strong> après réception du courrier de décision. L’application n’attribue pas la décision.</div></div>`,
        fields: [
          { id: 'dec', label: 'Décision reçue', type: 'select', required: true, options: [{ value: '', label: 'Sélectionner…' }, { value: 'approuve', label: 'Attribution approuvée' }, { value: 'refuse', label: 'Attribution refusée' }] },
          { id: 'ref', label: 'Référence du courrier de décision', type: 'text', required: true, placeholder: 'Exemple : Décision n° 2026-091', validate: v => v.length >= 4 ? '' : 'Saisissez la référence du courrier de décision.' },
          { id: 'date', label: 'Date de la décision', type: 'date', value: GO.REF_ISO, max: GO.REF_ISO, required: true },
          { id: 'obs', label: 'Observation (facultatif)', type: 'textarea', rows: 2 }
        ],
        submit: 'Enregistrer la décision', iconSubmit: 'check',
        run: v => {
          d.status = v.dec;
          GO.newDoc({ dossier: d.ref, kind: 'decision', type: 'decision', title: v.dec === 'approuve' ? 'Décision d’attribution' : 'Décision de refus', date: v.date, from: a.label, state: 'enregistre', number: v.ref, decision: v.dec });
          GO.addHistory(d, 'decision', v.dec === 'approuve' ? 'Décision d’attribution enregistrée' : 'Décision de refus enregistrée', `${a.label} (${GO.user().name})`, { detail: v.ref });
          if (v.obs) d.observations.push({ date: GO.REF_ISO, author: `${GO.user().name} — ${a.label}`, text: v.obs });
          GO.notify({ type: 'decision', aud: 'service', ref: d.ref, title: v.dec === 'approuve' ? 'Décision d’attribution' : 'Décision de refus', msg: `${v.ref} — à enregistrer au dossier et à notifier au demandeur.` });
          GO.notify({ type: 'decision', aud: 'org:' + d.org, ref: d.ref, title: v.dec === 'approuve' ? 'Distinctions attribuées' : 'Décision de refus', msg: v.dec === 'approuve' ? 'Une cérémonie de remise sera programmée ; l’ordre de recette vous sera adressé.' : 'La décision vous sera notifiée par courrier.' });
          GO.commit(); refreshDossier(d);
          GO.toast('success', 'Décision enregistrée', `${d.ref} : ${v.dec === 'approuve' ? 'attribution approuvée' : 'attribution refusée'}.`);
        }
      });
    },
    recette(d) {
      const count = d.recipients.reduce((a, r) => a + (r.medal === 'or' ? 3 : r.medal === 'argent' ? 2 : 1), 0);
      formModal({
        title: 'Émettre l’ordre de recette', icon: 'cash', tone: 'blue',
        intro: `<div class="alert alert-info">${icon('info')}<div>L’ordre de recette est un <strong>document de démonstration</strong> : l’application ne calcule aucun montant réglementaire et n’effectue aucune opération financière. Le paiement est réalisé hors application ; le reçu sera déposé par le demandeur puis vérifié par la régie.</div></div>`,
        fields: [
          { id: 'amount', label: 'Montant porté sur l’ordre de recette', type: 'text', required: true, placeholder: 'Exemple : 1 260 000 FCFA', hint: 'Saisi par le service ; aucune règle de tarification n’est appliquée par le prototype.', validate: v => v.length >= 4 ? '' : 'Indiquez le montant.' },
          { id: 'due', label: 'Échéance de paiement', type: 'date', required: true, min: GO.REF_ISO, value: GO.iso(new Date(GO.REF.getTime() + 30 * 86400000)) }
        ],
        submit: 'Émettre l’ordre de recette', iconSubmit: 'cash',
        run: v => {
          const id = GO.nextRef('OR-2026-', GO.S.receiptOrders, 115);
          GO.S.receiptOrders.push({ id, dossier: d.ref, amount: v.amount, issued: GO.REF_ISO, due: v.due, state: 'emis', reference: (GO.docsOf(d.ref).find(x => x.kind === 'decision') || {}).number || '—', receipts: [] });
          GO.newDoc({ dossier: d.ref, kind: 'recette', type: 'sortant', title: 'Ordre de recette', date: GO.REF_ISO, from: GO.actorName(), state: 'envoye', number: GO.nextDocNumber() });
          GO.addHistory(d, 'courrier', `Ordre de recette ${id} émis — ${v.amount}`);
          GO.notify({ type: 'paiement', aud: 'org:' + d.org, ref: d.ref, title: 'Ordre de recette à régler', msg: `${id} — ${v.amount}, échéance ${fmtDate(v.due)}. Le reçu est à déposer dans GAB-ORIENT.` });
          GO.notify({ type: 'paiement', aud: 'regie', ref: d.ref, title: 'Ordre de recette émis', msg: `${id} — ${v.amount} : reçu attendu du demandeur.` });
          GO.commit(); refreshDossier(d);
          GO.toast('success', 'Ordre de recette émis', `${id} — ${esc(v.amount)}.`);
          void count;
        }
      });
    },
    deposer_recu(d) {
      const or = GO.receiptOrder(d.ref);
      const up = D.config.upload;
      formModal({
        title: 'Déposer le reçu de paiement', icon: 'upload', tone: 'blue',
        intro: `<p>Ordre de recette <strong>${esc(or.id)}</strong> — ${esc(or.amount)} (échéance ${fmtDate(or.due)}). Joignez le reçu ou la quittance délivré après paiement.</p>`,
        fields: [
          { id: 'date', label: 'Date du paiement', type: 'date', required: true, value: GO.REF_ISO, max: GO.REF_ISO },
          { id: 'ref', label: 'Référence du reçu', type: 'text', required: true, placeholder: 'Exemple : Quittance n° 0042/TRÉSOR' },
          { id: 'file', label: 'Reçu numérisé', type: 'text', required: true, placeholder: 'recu-paiement.pdf', hint: `${up.acceptLabel} · ${up.maxMb} Mo maximum (fichier simulé dans le prototype).` },
          { id: 'note', label: 'Précision (facultatif)', type: 'textarea', rows: 2 }
        ],
        submit: 'Déposer le reçu', iconSubmit: 'upload',
        run: v => {
          const rec = { id: GO.nextRef('REC-2026-', or.receipts, 48), date: v.date, from: GO.org(d.org).name, file: { name: v.file, size: 268000, type: 'application/pdf' }, reference: v.ref, note: v.note };
          or.receipts = or.receipts || []; or.receipts.push(rec);
          or.state = 'recu_depose';
          const doc = GO.newDoc({ dossier: d.ref, kind: 'recu', type: 'piece', title: `Reçu de paiement ${or.id}`, date: v.date, from: GO.org(d.org).name, state: 'depose', file: rec.file, number: v.ref });
          GO.addHistory(d, 'courrier', `Reçu de paiement déposé — ${or.id}`, undefined, { detail: v.ref });
          GO.notify({ type: 'paiement', aud: 'regie', ref: d.ref, doc: doc.id, title: 'Reçu déposé — à vérifier', msg: `${or.id} : ${esc(v.ref)} déposé par ${GO.org(d.org).short}.` });
          GO.commit(); refreshDossier(d);
          GO.toast('success', 'Reçu déposé', `${or.id} — en attente de vérification par la régie.`);
        }
      });
    },
    verif_recu(d) {
      const or = GO.receiptOrder(d.ref), rec = GO.receiptOf(d.ref);
      formModal({
        title: 'Vérifier le reçu de paiement', icon: 'shield', tone: 'green',
        intro: `<p>Reçu <strong>${esc(rec.id)}</strong> déposé le ${fmtDate(rec.date)} par ${esc(rec.from)} ${rec.reference ? `(${esc(rec.reference)})` : ''} pour l’ordre de recette ${esc(or.id)} — ${esc(or.amount)}.</p>
          <div class="alert alert-info">${icon('info')}<div>La vérification atteste la conformité apparente du reçu (montant, référence, quittance). Aucun encaissement n’est effectué par l’application.</div></div>`,
        fields: [
          { id: 'montant', label: 'Montant lu sur le reçu', type: 'text', required: true, value: or.amount },
          { id: 'decision', label: 'Décision', type: 'select', options: [{ value: 'verifie', label: 'Reçu conforme — paiement vérifié' }, { value: 'rejete', label: 'Reçu non conforme — rejeté' }] },
          { id: 'note', label: 'Observation', type: 'textarea', rows: 2, required: true, validate: v => v.length >= 5 ? '' : 'Précisez le contrôle effectué.' }
        ],
        submit: 'Enregistrer la vérification', iconSubmit: 'check',
        run: v => {
          or.state = v.decision;
          rec.verifiedBy = GO.user().name; rec.verifiedOn = GO.REF_ISO; rec.note = v.note;
          GO.addHistory(d, 'courrier', v.decision === 'verifie' ? 'Paiement vérifié — reçu conforme' : 'Reçu rejeté — paiement à régulariser', undefined, { detail: v.note });
          GO.notify({ type: 'paiement', aud: 'org:' + d.org, ref: d.ref, title: v.decision === 'verifie' ? 'Paiement vérifié' : 'Reçu à régulariser', msg: v.note });
          if (v.decision === 'verifie') GO.notify({ type: 'paiement', aud: 'service', ref: d.ref, title: 'Paiement vérifié', msg: `${or.id} — la remise peut être préparée.` });
          GO.commit(); refreshDossier(d);
          GO.toast('success', v.decision === 'verifie' ? 'Paiement vérifié' : 'Reçu rejeté', v.note);
        }
      });
    },
    propose(d) { location.hash = '#/ceremonies/proposer?dossier=' + d.ref; },
    cer(d) { const c = GO.activeCer(d.ref) || GO.cersOf(d.ref)[0]; if (c) location.hash = '#/ceremonies/' + c.id; },
    valider_cer(d) { const c = GO.cersOf(d.ref)[0]; if (c) { location.hash = '#/ceremonies/' + c.id; GO.toast('info', 'Validation de la date', 'Utilisez « Valider la date de cérémonie » sur la fiche de la cérémonie.'); } },
    negocier(d) { const c = GO.cersOf(d.ref)[0]; if (c) location.hash = '#/ceremonies/' + c.id; },
    cer_done(d) {
      const c = GO.cersOf(d.ref)[0];
      GO.confirmDialog({ title: 'Clôturer la cérémonie ?', tone: 'green', icon: 'check-circle', confirm: 'Marquer comme terminée',
        check: 'La remise effective des médailles a été enregistrée par la Régie.',
        message: `<p>${esc(c.id)} du ${fmtDate(c.date)} sera marquée comme terminée et le suivi du dossier sera clôturé.</p>` }).then(ok => {
        if (!ok) return;
        c.state = 'termine';
        GO.addHistory(d, 'ceremonie', 'Cérémonie de remise terminée — dossier clôturé');
        GO.commit(); refreshDossier(d);
        GO.toast('success', 'Cérémonie clôturée', esc(c.id));
      });
    },
    answer(d) {
      const up = D.config.upload;
      formModal({
        title: 'Déposer le complément', icon: 'upload', tone: 'blue',
        intro: `<p>Joignez les pièces demandées par le Service des Distinctions. Le dossier reprendra son instruction dès réception.</p>${GO.complementOf(d.ref) ? `<div class="alert alert-warn">${icon('paperclip')}<div><strong>Éléments attendus</strong><p style="margin-top:4px">${esc(GO.complementOf(d.ref).items)}</p></div></div>` : ''}`,
        fields: [
          { id: 'file', label: 'Pièce justificative', type: 'text', required: true, placeholder: 'attestations-anciennete.pdf', hint: `${up.acceptLabel} · ${up.maxMb} Mo maximum (fichier simulé dans le prototype).` },
          { id: 'msg', label: 'Message au service', type: 'textarea', rows: 2 }
        ],
        submit: 'Déposer le complément', iconSubmit: 'upload', delay: 600,
        run: v => {
          d.status = 'en_cours'; d.complementSince = null;
          const cpl = GO.complementOf(d.ref); if (cpl) cpl.state = 'satisfait';
          GO.newDoc({ dossier: d.ref, kind: 'upload', type: 'piece', title: 'Complément — ' + v.file, date: GO.REF_ISO, from: GO.org(d.org).name, state: 'depose', file: { name: v.file, size: 384200, type: 'application/pdf' } });
          GO.addHistory(d, 'depot', 'Complément déposé par le demandeur', undefined, { detail: v.file });
          GO.notify({ type: 'depot', aud: 'service', ref: d.ref, title: 'Complément reçu', msg: `${GO.org(d.org).name} a déposé : ${v.file}.` });
          GO.commit(); refreshDossier(d);
          GO.toast('success', 'Complément déposé', 'Le dossier reprend son instruction.');
        }
      });
    },
    recours(d) {
      const rcs = GO.recoursOf(d.ref);
      if (rcs && GO.can('recours') && !GO.external()) return ACTIONS.recours_decide(d, null);
      formModal({
        title: 'Déposer un recours', icon: 'scale', tone: 'red',
        intro: `<p>Le recours est adressé à l’autorité compétente après notification de la décision. Il est enregistré au registre et versé au dossier.</p>`,
        fields: [
          { id: 'motif', label: 'Motif du recours', type: 'textarea', required: true, rows: 4, validate: v => v.length >= 20 ? '' : 'Détaillez le motif du recours (20 caractères minimum).' },
          { id: 'file', label: 'Pièce jointe', type: 'text', placeholder: 'recours-attestations.pdf', hint: 'Facultatif — pièces justificatives complémentaires.' }
        ],
        submit: 'Déposer le recours', iconSubmit: 'send', delay: 600,
        run: v => {
          const id = GO.nextRef('RCS-2026-', GO.S.recours, 1);
          const doc = GO.newDoc({ dossier: d.ref, kind: 'recours', type: 'entrant', title: 'Recours gracieux', date: GO.REF_ISO, from: GO.org(d.org).name, state: 'enregistre', number: 'Réf. ' + GO.org(d.org).short.replace(/\s+/g, '') + '/2026-' + String(GO.S.recours.length + 44) });
          GO.S.recours.push({ id, dossier: d.ref, date: GO.REF_ISO, author: GO.org(d.org).name, motif: v.motif, state: 'depose', authority: d.authority, doc: doc.id,
            history: [{ date: GO.REF_ISO, time: GO.stamp().time, actor: GO.actorName(), label: 'Recours déposé et enregistré au registre' }] });
          GO.addHistory(d, 'note', 'Recours déposé par le demandeur', undefined, { detail: v.motif.slice(0, 80) });
          GO.notify({ type: 'recours', aud: 'authority:' + d.authority, ref: d.ref, doc: doc.id, title: 'Recours déposé', msg: `${GO.org(d.org).name} — ${id}` });
          GO.notify({ type: 'recours', aud: 'service', ref: d.ref, title: 'Recours à instruire', msg: `${id} — ${GO.org(d.org).short}` });
          GO.commit(); refreshDossier(d);
          GO.toast('success', 'Recours enregistré', `${id} — transmis à ${esc(GO.authority(d.authority).short)}.`);
        }
      });
    },
    recours_decide(d) {
      const rcs = GO.recoursOf(d.ref);
      if (!rcs) { GO.toast('info', 'Aucun recours', 'Aucun recours n’est enregistré pour ce dossier.'); return; }
      formModal({
        title: 'Instruction du recours ' + rcs.id, icon: 'scale', tone: 'yellow',
        intro: `<div class="obs"><div class="obs-meta">Recours déposé le ${fmtDate(rcs.date)} par ${esc(rcs.author)}</div>${esc(rcs.motif)}</div>
          <div class="alert alert-info mt">${icon('info')}<div>La décision sur recours est enregistrée <strong>au nom de ${esc(GO.authority(rcs.authority).label)}</strong>. L’application n’instruit pas le recours.</div></div>`,
        fields: [
          { id: 'state', label: 'Suite donnée', type: 'select', options: [{ value: 'en_examen', label: 'Recours en examen — instruction ouverte' }, { value: 'accepte', label: 'Recours accepté — réexamen du dossier' }, { value: 'rejete', label: 'Recours rejeté — décision maintenue' }] },
          { id: 'ref', label: 'Référence du courrier', type: 'text', required: true, placeholder: 'Exemple : Décision n° 2026-104', validate: v => v.length >= 4 ? '' : 'Saisissez la référence du courrier.' },
          { id: 'note', label: 'Motivation', type: 'textarea', rows: 3, required: true, validate: v => v.length >= 10 ? '' : 'Motivez la suite donnée (10 caractères minimum).' }
        ],
        submit: 'Enregistrer la suite donnée', iconSubmit: 'check',
        run: v => {
          rcs.state = v.state; rcs.decidedOn = GO.REF_ISO; rcs.reference = v.ref; rcs.note = v.note;
          rcs.history = rcs.history || [];
          rcs.history.push({ date: GO.REF_ISO, time: GO.stamp().time, actor: GO.actorName(), label: `${D.recoursStates[v.state].label} — ${v.ref}` });
          if (v.state === 'accepte') d.status = 'en_cours';
          GO.newDoc({ dossier: d.ref, kind: 'recours', type: 'sortant', title: 'Réponse au recours', date: GO.REF_ISO, from: GO.actorName(), state: 'envoye', number: v.ref });
          GO.addHistory(d, 'decision', `${D.recoursStates[v.state].label} — recours ${rcs.id}`, GO.actorName(), { detail: v.ref });
          GO.notify({ type: 'recours', aud: 'org:' + d.org, ref: d.ref, title: D.recoursStates[v.state].label, msg: v.note });
          GO.commit(); refreshDossier(d);
          GO.toast('success', 'Recours mis à jour', D.recoursStates[v.state].label);
        }
      });
    },
    control(d) {
      const ctl = GO.controlOf(d.ref);
      formModal({
        title: ctl ? 'Compléter le contrôle ' + ctl.id : 'Effectuer un contrôle documentaire', icon: 'shield', tone: 'blue',
        intro: `<p>Le contrôle porte sur la vérification documentaire du dossier (liste nominative, attestations, cohérence des dates d’entrée). L’inspecteur ne prend aucune décision sur l’attribution.</p>`,
        fields: [
          { id: 'scope', label: 'Objet du contrôle', type: 'select', options: [{ value: 'Contrôle documentaire', label: 'Contrôle documentaire' }, { value: 'Vérification des bénéficiaires', label: 'Vérification des bénéficiaires' }, { value: 'Contrôle des pièces justificatives', label: 'Contrôle des pièces justificatives' }] },
          { id: 'state', label: 'Conclusion', type: 'select', options: [{ value: 'conforme', label: 'Contrôle conforme' }, { value: 'anomalie', label: 'Anomalies constatées' }, { value: 'correction', label: 'Correction demandée au service' }] },
          { id: 'an1', label: 'Anomalie principale (si constatée)', type: 'text', placeholder: 'Exemple : liste nominative non signée par l’autorité demanderesse', hint: 'Champ facultatif. Une anomalie exige une conclusion « Anomalies constatées ».' },
          { id: 'note', label: 'Observation', type: 'textarea', rows: 2, required: true, validate: v => v.length >= 5 ? '' : 'Consignez votre observation.' }
        ],
        submit: ctl ? 'Mettre à jour le contrôle' : 'Enregistrer le contrôle', iconSubmit: 'check', delay: 500,
        checks: v => (v.an1 && v.state === 'conforme') ? 'Une anomalie est décrite : choisissez « Anomalies constatées ».' : '',
        run: v => {
          const c = ctl || { id: GO.nextRef('CTL-2026-', GO.S.controls, 1), dossier: d.ref, date: GO.REF_ISO, inspector: GO.user().name, findings: [] };
          c.scope = v.scope; c.state = v.state; c.note = v.note; c.date = GO.REF_ISO; c.inspector = GO.user().name;
          if (v.an1) {
            const code = 'AN-' + String((c.findings.length || 0) + 1).padStart(2, '0');
            c.findings.push({ code, label: v.an1, severity: 'majeure' });
          }
          if (!ctl) GO.S.controls.push(c);
          GO.addHistory(d, 'instruction', `Contrôle ${c.id} — ${D.controlStates[v.state].label}`, GO.actorName(), { detail: v.note });
          GO.notify({ type: 'controle', aud: 'service', ref: d.ref, title: `Contrôle ${D.controlStates[v.state].label.toLowerCase()}`, msg: v.note });
          GO.commit(); refreshDossier(d);
          GO.toast('success', 'Contrôle enregistré', `${c.id} — ${D.controlStates[v.state].label}.`);
        }
      });
    },
    remise_prep(d) {
      const c = GO.cersOf(d.ref)[0];
      formModal({
        title: 'Préparer et réserver les médailles', icon: 'box', tone: 'blue',
        intro: `<p>La réservation immobilise les médailles pour la cérémonie${c ? ` ${esc(c.id)} du ${fmtDate(c.date)}` : ''}. Le stock physique n’est <strong>pas</strong> encore diminué : la remise effective sera enregistrée après la cérémonie.</p>${recapMeds(d)}`,
        fields: [
          { id: 'confirm', label: 'Les médailles et diplômes sont préparés et réservés au nom du dossier.', type: 'checkbox', required: true, validate: v => v ? '' : 'Confirmez la préparation.' },
          { id: 'note', label: 'Observation', type: 'textarea', rows: 2 }
        ],
        submit: 'Réserver les médailles', iconSubmit: 'box',
        run: v => {
          const s = GO.stamp();
          recSummary(d).forEach(m => GO.moveStock({ item: m.item, field: 'reserved', qty: m.n, reason: `Réservation — ${c ? c.id : d.ref}`, dossier: d.ref, note: v.note }));
          let rem = GO.remiseOf(d.ref);
          if (!rem) { rem = { id: GO.nextRef('REM-2026-', GO.S.remises, 1), dossier: d.ref, ceremony: c ? c.id : null, date: GO.REF_ISO, state: 'preparee', mode: 'cérémonie', recipients: d.recipients.map(r => r.id), recordedBy: GO.user().name, note: v.note }; GO.S.remises.push(rem); }
          else { rem.state = 'preparee'; rem.date = GO.REF_ISO; rem.recordedBy = GO.user().name; }
          GO.addHistory(d, 'ceremonie', 'Médailles préparées et réservées à la régie', undefined, { detail: v.note });
          GO.notify({ type: 'stock', aud: 'service', ref: d.ref, title: 'Médailles réservées', msg: `${recSummary(d).map(m => `${m.n} ${GO.medal(m.item).short}`).join(', ')} réservées.` });
          void s;
          GO.commit(); refreshDossier(d);
          GO.toast('success', 'Médailles réservées', `Stock réservé mis à jour pour ${esc(d.ref)}.`);
        }
      });
    },
    remise_ok(d) {
      const rem = GO.remiseOf(d.ref), c = GO.cersOf(d.ref)[0];
      const meds = recSummary(d);
      const missing = meds.filter(m => (GO.stockOf(m.item) || {}).available < m.n);
      formModal({
        title: 'Enregistrer la remise effective', icon: 'medal', tone: 'green',
        intro: `<p>La remise effective diminue le <strong>stock physique</strong> et libère la réservation. À confirmer uniquement lorsque les médailles ont été effectivement remises aux récipiendaires.</p>
          ${missing.length ? `<div class="alert alert-error">${icon('alert-circle')}<div><strong>Stock physique insuffisant</strong><p style="margin-top:4px">${missing.map(m => `${GO.medal(m.item).short} : ${(GO.stockOf(m.item) || {}).available} disponibles pour ${m.n} attendues`).join(' · ')}</p></div></div>` : ''}
          ${recapMeds(d)}`,
        fields: [
          { id: 'date', label: 'Date de la remise', type: 'date', required: true, value: GO.REF_ISO, max: GO.REF_ISO },
          { id: 'mode', label: 'Modalité', type: 'select', options: [{ value: 'cérémonie', label: 'Lors de la cérémonie' }, { value: 'retrait', label: 'Retrait à la régie' }] },
          { id: 'note', label: 'Observation (procès-verbal, liste d’appel…)', type: 'textarea', rows: 3, required: true, validate: v => v.length >= 5 ? '' : 'Consignez la référence de la remise.' }
        ],
        submit: 'Enregistrer la remise effective', iconSubmit: 'check', delay: 600,
        checks: () => missing.length ? 'Le stock physique est insuffisant pour enregistrer cette remise.' : '',
        run: v => {
          meds.forEach(m => {
            GO.moveStock({ item: m.item, field: 'available', qty: -m.n, reason: `Remise effective — ${c ? c.id : d.ref}`, dossier: d.ref, note: v.note });
            GO.moveStock({ item: m.item, field: 'reserved', qty: -m.n, reason: `Libération de réservation — ${c ? c.id : d.ref}`, dossier: d.ref, note: v.note });
          });
          const rem2 = GO.remiseOf(d.ref);
          const remState = v.mode === 'retrait' ? 'retrait' : 'remise';
          if (rem2) { rem2.state = remState; rem2.date = v.date; rem2.mode = v.mode; rem2.note = v.note; rem2.recordedBy = GO.user().name; }
          else GO.S.remises.push({ id: GO.nextRef('REM-2026-', GO.S.remises, 1), dossier: d.ref, ceremony: c ? c.id : null, date: v.date, state: remState, mode: v.mode, recipients: d.recipients.map(r => r.id), recordedBy: GO.user().name, note: v.note });
          // La cérémonie est clôturée par le service après la remise : on signale la remise enregistrée.
          if (c && c.state !== 'termine') GO.notify({ type: 'ceremonie', aud: 'service', ref: d.ref, title: 'Remise enregistrée — cérémonie à clôturer', msg: `${c.id} : la remise effective des médailles est enregistrée, la cérémonie peut être clôturée.` });
          d.recipients.forEach(r => {
            const ex = GO.S.distinctions.find(x => x.person === r.id && x.dossier === d.ref);
            if (ex) { ex.state = 'remise'; ex.date = v.date; }
          });
          GO.addHistory(d, 'ceremonie', `Remise effective enregistrée — ${meds.map(m => `${m.n} ${GO.medal(m.item).short}`).join(', ')}`, undefined, { detail: v.note });
          GO.notify({ type: 'remise', aud: 'service', ref: d.ref, title: 'Remise enregistrée', msg: `${meds.map(m => `${m.n} ${GO.medal(m.item).short}`).join(', ')} remises le ${fmtDate(v.date)}.` });
          GO.commit(); refreshDossier(d);
          GO.toast('success', 'Remise enregistrée', 'Stock physique et réservations mis à jour.');
        }
      });
    },
    retrait_demande(d) {
      formModal({
        title: 'Demander un retrait sans cérémonie', icon: 'medal', tone: 'blue',
        intro: `<p>Les récipiendaires qui ne peuvent pas participer à une cérémonie peuvent retirer leurs distinctions à la régie, sur autorisation enregistrée.</p>${recapMeds(d)}`,
        fields: [
          { id: 'just', label: 'Justification', type: 'textarea', required: true, rows: 3, validate: v => v.length >= 15 ? '' : 'Expliquez la raison du retrait (15 caractères minimum).' }
        ],
        submit: 'Envoyer la demande', iconSubmit: 'send',
        run: v => {
          const id = GO.nextRef('RET-2026-', GO.S.withdrawals, 1);
          GO.S.withdrawals.push({ id, dossier: d.ref, recipients: d.recipients.map(r => r.id), date: GO.REF_ISO, state: 'demande', requester: GO.actorName(), justification: v.just,
            history: [{ date: GO.REF_ISO, time: GO.stamp().time, actor: GO.actorName(), label: 'Demande de retrait sans cérémonie enregistrée' }] });
          GO.newDoc({ dossier: d.ref, kind: 'demande_retrait', type: 'entrant', title: 'Demande de retrait sans cérémonie', date: GO.REF_ISO, from: GO.org(d.org).name, state: 'enregistre' });
          GO.addHistory(d, 'ceremonie', 'Retrait sans cérémonie demandé', undefined, { detail: v.just.slice(0, 80) });
          GO.notify({ type: 'ceremonie', aud: 'regie', ref: d.ref, title: 'Retrait sans cérémonie demandé', msg: `${id} — ${d.recipients.length} récipiendaire(s).` });
          GO.commit(); refreshDossier(d);
          GO.toast('success', 'Demande enregistrée', `${id} — transmise à la régie.`);
        }
      });
    },
    retrait_valide(d) {
      const wd = GO.withdrawalOf(d.ref);
      formModal({
        title: 'Autoriser le retrait à la régie', icon: 'check', tone: 'blue',
        intro: `<div class="obs"><div class="obs-meta">${esc(wd.id)} · demandé le ${fmtDate(wd.date)} par ${esc(wd.requester)}</div>${esc(wd.justification)}</div>
          <p class="mt">L’autorisation ouvre la préparation des médailles. La remise effective sera enregistrée lors de la présentation des bénéficiaires à la régie.</p>`,
        fields: [
          { id: 'ref', label: 'Référence de l’autorisation', type: 'text', required: true, placeholder: 'Exemple : Autorisation n° 2026-014', validate: v => v.length >= 4 ? '' : 'Saisissez la référence.' },
          { id: 'rdv', label: 'Date de retrait proposée', type: 'date', required: true, min: GO.REF_ISO, value: GO.iso(new Date(GO.REF.getTime() + 7 * 86400000)) }
        ],
        submit: 'Enregistrer l’autorisation', iconSubmit: 'check',
        run: v => {
          wd.state = 'valide'; wd.reference = v.ref; wd.appointment = v.rdv;
          wd.history.push({ date: GO.REF_ISO, time: GO.stamp().time, actor: GO.actorName(), label: `Autorisation de retrait enregistrée — ${v.ref}` });
          GO.addHistory(d, 'ceremonie', `Retrait sans cérémonie autorisé — ${v.ref}`, undefined, { detail: `retrait le ${v.rdv}` });
          GO.notify({ type: 'ceremonie', aud: 'org:' + d.org, ref: d.ref, title: 'Retrait autorisé', msg: `${v.ref} — retrait à la régie le ${fmtDate(v.rdv)}.` });
          GO.commit(); refreshDossier(d);
          GO.toast('success', 'Autorisation enregistrée', `${esc(wd.id)} — retrait prévu le ${fmtDate(v.rdv)}.`);
        }
      });
    },
    retrait_remis(d) {
      const wd = GO.withdrawalOf(d.ref);
      const meds = recSummary(d);
      const missing = meds.filter(m => (GO.stockOf(m.item) || {}).available < m.n);
      formModal({
        title: 'Enregistrer le retrait effectif', icon: 'medal', tone: 'green',
        intro: `<p>Le retrait effectif diminue le stock physique et clôt la demande. À confirmer uniquement lorsque les distinctions ont été remises aux bénéficiaires.</p>
          ${missing.length ? `<div class="alert alert-error">${icon('alert-circle')}<div>Stock physique insuffisant : ${missing.map(m => `${GO.medal(m.item).short} (${(GO.stockOf(m.item) || {}).available} disponibles)`).join(', ')}.</div></div>` : ''}${recapMeds(d)}`,
        fields: [
          { id: 'date', label: 'Date du retrait', type: 'date', required: true, value: GO.REF_ISO, max: GO.REF_ISO },
          { id: 'who', label: 'Bénéficiaire(s) présent(s)', type: 'text', required: true, value: d.recipients.map(r => `${r.prenom} ${r.nom}`).join(', ') },
          { id: 'note', label: 'Observation', type: 'textarea', rows: 2, required: true, validate: v => v.length >= 5 ? '' : 'Consignez la remise.' }
        ],
        submit: 'Enregistrer le retrait effectif', iconSubmit: 'check', delay: 600,
        checks: () => missing.length ? 'Stock physique insuffisant.' : '',
        run: v => {
          meds.forEach(m => GO.moveStock({ item: m.item, field: 'available', qty: -m.n, reason: `Retrait sans cérémonie — ${wd.id}`, dossier: d.ref, note: v.note }));
          wd.state = 'remis'; wd.remisOn = v.date; wd.recordedBy = GO.user().name; wd.note = v.note;
          wd.history.push({ date: v.date, time: GO.stamp().time, actor: GO.actorName(), label: 'Retrait effectif enregistré' });
          GO.S.remises.push({ id: GO.nextRef('REM-2026-', GO.S.remises, 1), dossier: d.ref, ceremony: null, date: v.date, state: 'retrait', mode: 'retrait', recipients: wd.recipients, recordedBy: GO.user().name, note: v.note });
          d.recipients.forEach(r => { const ex = GO.S.distinctions.find(x => x.person === r.id && x.dossier === d.ref); if (ex) { ex.state = 'remise'; ex.date = v.date; } });
          GO.addHistory(d, 'ceremonie', 'Retrait sans cérémonie enregistré — remise effective', undefined, { detail: v.note });
          GO.notify({ type: 'remise', aud: 'org:' + d.org, ref: d.ref, title: 'Distinctions remises', msg: `Retrait effectué le ${fmtDate(v.date)} à la régie.` });
          GO.commit(); refreshDossier(d);
          GO.toast('success', 'Retrait enregistré', 'Stock physique mis à jour.');
        }
      });
    }
  };

  function recSummary(d) {
    const c = {}; d.recipients.forEach(r => { c[r.medal] = (c[r.medal] || 0) + 1; });
    const out = D.medals.filter(m => c[m.id]).map(m => ({ item: m.id, n: c[m.id] }));
    out.push({ item: 'diplome', n: d.recipients.length });
    return out;
  }
  function recapMeds(d) {
    return `<div class="mini-table mt"><table><thead><tr><th scope="col">Distinction</th><th scope="col">Quantité</th><th scope="col">Stock physique</th><th scope="col">Réservé</th></tr></thead><tbody>
      ${recSummary(d).map(m => { const s = GO.stockOf(m.item) || { available: 0, reserved: 0 }; return `<tr><td>${esc(GO.medal(m.item).short)}</td><td class="tnum">${m.n}</td>
        <td class="tnum">${s.available}${s.available < m.n ? ' ' + GO.badge('insuffisant', 'red') : ''}</td><td class="tnum">${s.reserved}</td></tr>`; }).join('')}</tbody></table></div>`;
  }

  GO.views.dossiers = { render: renderDossiers, update: updateDossiers };
  GO.dossierActions = ACTIONS;
  GO.formModal = formModal;
})(window.GO);
