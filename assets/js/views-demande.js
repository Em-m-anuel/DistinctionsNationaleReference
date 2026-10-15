/* ==========================================================================
   GAB-ORIENT — Demandeur et bénéficiaires
   Vues : « Nouveau dossier » (dépôt en quatre étapes), « Bénéficiaires et
   récipiendaires », « DTS et pièces justificatives », « Mes distinctions ».
   ========================================================================== */
(function (GO) {
  'use strict';
  const { $, $$, esc, icon, D, fmtDate, relDay, plural, ageDays, norm } = GO;
  const ui = GO.ui;

  // Actions proposées par étape (aucune règle d’éligibilité n’est inventée :
  // l’écart entre l’ancienneté et l’échelon demandé est signalé, la décision
  // reste à l’instruction).
  function medalAdvice(years) {
    if (years === null || years < 0) return { tone: 'slate', text: 'Renseignez la date d’entrée pour calculer l’ancienneté.' };
    const m = GO.medal(D.medalForYears(years));
    return { tone: 'blue', text: `Repère d’échelon affiché : ${m.short} (${m.minYears}${m.maxYears ? '–' + m.maxYears : '+'} ans d’ancienneté). L’instruction vérifie les conditions réelles.` };
  }

  /* ======================= NOUVEAU DOSSIER ======================= */
  const STEPS = [
    ['Demandeur', 'Organisme, autorité et contact'],
    ['Récipiendaires', 'Personnes proposées'],
    ['Pièces et DTS', 'Justificatifs d’ancienneté'],
    ['Récapitulatif', 'Vérification et envoi']
  ];
  const PIECES = [
    ['demande', 'Courrier de demande', 'Signé par le responsable de l’organisme', true],
    ['liste', 'Liste nominative des récipiendaires', 'Noms, fonctions et dates d’entrée', true],
    ['attestations', 'Attestations d’ancienneté', 'Une attestation par récipiendaire, regroupées en un fichier', true],
    ['autres', 'Autres pièces', 'Tout document utile à l’instruction', false]
  ];
  const SECTORS = ['Administration publique', 'Banque et assurance', 'Énergie', 'Forêt et bois', 'Industrie', 'Mines', 'Santé', 'Télécommunications', 'Transport et logistique', 'Autre'];
  const blankR = () => ({ nom: '', prenom: '', fonction: '', entree: '', medal: '', dts: '' });
  let F = null;

  function freshForm() {
    const o = GO.scopeOrg();
    const isMin = GO.role().id === 'demandeur_ministere' || (o && o.type === 'Ministère');
    return {
      step: 0, max: 0, dir: 1, done: null, errors: {}, knownOrg: o ? o.id : null,
      data: {
        org: o ? o.name : '', type: o ? o.type : '', sector: o ? o.sector : '', city: o ? o.city : '',
        contact: o ? o.contact : '', contactRole: o ? o.contactRole : '', email: o ? o.email : '', phone: o ? o.phone : '',
        authority: 'dgt', channel: isMin ? 'Voie hiérarchique — ministère' : 'Dépôt du demandeur', ministry: isMin,
        recipients: [blankR()], files: { demande: null, liste: null, attestations: null, autres: null }, certify: false
      }
    };
  }

  function renderForm(main) {
    if (!F || F.done || F.role !== GO.S.role) { F = freshForm(); F.role = GO.S.role; }
    main.innerHTML = `
      ${ui.head({ eyebrow: 'Dossiers', title: 'Nouveau dossier de distinction',
        sub: 'Préparez la demande en quatre étapes. Les informations saisies sont conservées lorsque vous passez d’une étape à l’autre.',
        actions: `<a class="btn btn-secondary" href="#/dossiers">Annuler</a>` })}
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
    const x = F.data, locked = !!GO.scopeOrg();
    return `<h2 id="wz-title">Informations du demandeur</h2>
      <p>Organisme qui propose les récipiendaires, autorité destinataire et interlocuteur pour le suivi du dossier. Les champs marqués <span class="req" style="color:var(--red-600)">*</span> sont obligatoires.</p>
      <div class="form-grid">
        ${field('f-org', 'Raison sociale de l’organisme', inp('f-org', x.org, `list="org-list" autocomplete="organization" required ${locked ? 'readonly' : ''}`), true, 'span-2', locked ? 'Organisme rattaché à votre compte.' : 'Saisissez le nom complet ; un organisme déjà connu est proposé automatiquement.')}
        <datalist id="org-list">${D.organisations.map(o => `<option value="${esc(o.name)}">`).join('')}</datalist>
        ${field('f-type', 'Type d’organisme', `<select class="select" id="f-type" required><option value="">Sélectionner…</option>${['Entreprise', 'Ministère', 'Établissement public', 'Collectivité'].map(t => `<option ${t === x.type ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}
        ${field('f-sector', 'Secteur d’activité', `<select class="select" id="f-sector" required><option value="">Sélectionner…</option>${SECTORS.map(t => `<option ${t === x.sector ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}
        ${field('f-city', 'Ville', inp('f-city', x.city, 'autocomplete="address-level2" required'))}
        ${field('f-authority', 'Autorité destinataire', `<select class="select" id="f-authority" required>${D.authorities.map(a => `<option value="${a.id}" ${a.id === x.authority ? 'selected' : ''}>${esc(a.label)}</option>`).join('')}</select>`, true, 'span-2', 'Le dossier est enregistré au registre du secrétariat de cette autorité, qui le transmet au Service des Distinctions.')}
        ${field('f-contact', 'Nom de l’interlocuteur', inp('f-contact', x.contact, 'autocomplete="name" required'))}
        ${field('f-contactRole', 'Fonction de l’interlocuteur', inp('f-contactRole', x.contactRole, 'autocomplete="organization-title"'), false)}
        ${field('f-email', 'Adresse électronique', inp('f-email', x.email, 'type="email" autocomplete="email" required'))}
        ${field('f-phone', 'Téléphone', inp('f-phone', x.phone, 'type="tel" autocomplete="tel" required placeholder="+241 …"'), true, '', 'Indicatif international accepté.')}
      </div>
      ${x.ministry ? `<div class="alert alert-info mt">${icon('info')}<div><strong>Voie hiérarchique ministérielle.</strong> Votre demande est adressée à l’autorité choisie et enregistrée au registre de son secrétariat ; elle suit ensuite le circuit d’instruction habituel. La voie de dépôt est indiquée « ${esc(x.channel)} ».</div></div>` : ''}`;
  }

  function stepRecips() {
    const rs = F.data.recipients;
    return `<h2 id="wz-title">Récipiendaires proposés</h2><p>Renseignez chaque personne proposée et la référence de sa déclaration de travail et de salaire (DTS). L’ancienneté est calculée à partir de la date d’entrée et vérifiée lors de l’instruction.</p>
      <div id="recips">${rs.map((r, i) => recipCard(r, i, rs.length)).join('')}</div>
      <button type="button" class="btn btn-secondary mt" data-add-r>${icon('plus')}Ajouter un récipiendaire</button>
      <p class="hint" style="margin-top:8px" aria-live="polite" id="r-count">${plural(rs.length, 'récipiendaire', 'récipiendaires')} sur ce dossier</p>`;
  }
  function recipCard(r, i, n) {
    const s = GO.seniority(r.entree), adv = medalAdvice(s);
    return `<fieldset class="recip-card" data-r="${i}" style="border:1px solid var(--line)"><legend class="sr-only">Récipiendaire ${i + 1}</legend>
      <div class="recip-head"><strong><span class="idx">${i + 1}</span>${r.nom || r.prenom ? esc(`${r.prenom} ${r.nom}`.trim()) : 'Nouveau récipiendaire'}</strong>
        ${n > 1 ? `<button type="button" class="btn btn-ghost btn-xs" data-del-r="${i}" aria-label="Retirer le récipiendaire ${i + 1}">${icon('trash', 'ic-sm')}Retirer</button>` : ''}</div>
      <div class="recip-grid">
        ${field(`r${i}-nom`, 'Nom', inp(`r${i}-nom`, r.nom, `data-rk="nom" data-ri="${i}" autocomplete="family-name"`))}
        ${field(`r${i}-prenom`, 'Prénom', inp(`r${i}-prenom`, r.prenom, `data-rk="prenom" data-ri="${i}" autocomplete="given-name"`))}
        ${field(`r${i}-fonction`, 'Fonction', inp(`r${i}-fonction`, r.fonction, `data-rk="fonction" data-ri="${i}"`))}
        ${field(`r${i}-entree`, 'Date d’entrée dans l’organisme', inp(`r${i}-entree`, r.entree, `type="date" max="${GO.REF_ISO}" data-rk="entree" data-ri="${i}"`), true, '', `<span class="seniority" id="r${i}-sen">${s !== null && s >= 0 ? `Ancienneté : ${s} an${s > 1 ? 's' : ''}` : ''}</span>`)}
        ${field(`r${i}-medal`, 'Médaille proposée', `<select class="select" id="r${i}-medal" data-rk="medal" data-ri="${i}"><option value="">Sélectionner…</option>${D.medals.map(m => `<option value="${m.id}" ${m.id === r.medal ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select>`, true, '', `<span class="hint" id="r${i}-adv">${esc(adv.text)}</span>`)}
        ${field(`r${i}-dts`, 'Référence de la DTS', inp(`r${i}-dts`, r.dts, `data-rk="dts" data-ri="${i}" placeholder="Exemple : OE/DRH/DTS/2026-011"`), false, 'span-2', 'Déclaration de travail et de salaire produite par l’employeur. La DTS est vérifiée par le Service des Distinctions ; elle peut être complétée après le dépôt.')}
      </div></fieldset>`;
  }
  function stepDocs() {
    const up = D.config.upload;
    const rs = F.data.recipients;
    return `<h2 id="wz-title">Pièces justificatives et DTS</h2>
      <p>Joignez les pièces numérisées (${up.acceptLabel}, ${up.maxMb} Mo maximum par fichier). Vous pouvez déposer un fichier par glisser-déposer.</p>
      <div class="mt">${PIECES.map(([k, t, s, req]) => { const f = F.data.files[k]; return `
        <div class="dropzone ${f ? 'is-filled' : ''}" data-f="f-${k}" data-drop="${k}">
          <span class="dz-ico">${icon(f ? 'check' : 'upload')}</span>
          <div class="dz-main"><strong>${t}${req ? ' <span class="req" style="color:var(--red-600)" aria-hidden="true">*</span>' : ' <span class="muted" style="font-weight:400">(facultatif)</span>'}</strong>
            <span>${f ? `${esc(f.name)} · ${(f.size / 1024).toFixed(0)} Ko` : esc(s)}</span></div>
          <div style="display:flex;gap:6px">${f ? `<button type="button" class="btn btn-ghost btn-xs" data-rm-f="${k}" aria-label="Retirer le fichier ${esc(t)}">${icon('trash', 'ic-sm')}Retirer</button>` : ''}
            <label class="btn btn-secondary btn-sm" for="f-${k}">${f ? 'Remplacer' : 'Choisir un fichier'}</label>
            <input type="file" id="f-${k}" data-file="${k}" accept="${up.accept.join(',')}" ${req ? 'aria-required="true"' : ''} aria-label="${esc(t)}"></div>
        </div>`; }).join('')}</div>
      <h3 style="font-size:14px;margin:20px 0 6px">Déclarations de travail et de salaire</h3>
      <div class="mini-table"><table><thead><tr><th scope="col">Récipiendaire</th><th scope="col">Référence saisie</th><th scope="col">État</th></tr></thead><tbody>
        ${rs.map((r, i) => `<tr><td>${esc(`${r.prenom} ${r.nom}`.trim() || 'Récipiendaire ' + (i + 1))}</td>
          <td class="ref">${esc(r.dts || '—')}</td><td>${r.dts ? GO.badge('Sera transmise à l’instruction', 'blue') : GO.badge('Référence non saisie', 'slate')}</td></tr>`).join('')}
      </tbody></table></div>`;
  }
  function stepRecap() {
    const x = F.data;
    const block = (title, step, html) => `<section class="summary-block"><header><h3>${title}</h3><button type="button" class="btn btn-ghost btn-xs" data-goto="${step}">${icon('edit', 'ic-sm')}Modifier</button></header>${html}</section>`;
    const a = GO.authority(x.authority);
    return `<h2 id="wz-title">Récapitulatif</h2><p>Vérifiez les informations avant l’envoi au Service des Distinctions.</p>
      ${block('Demandeur et destinataire', 0, `<dl class="dl-grid">
        <div><dt>Organisme</dt><dd>${esc(x.org)}</dd></div><div><dt>Type · secteur</dt><dd>${esc(x.type)} · ${esc(x.sector)}</dd></div>
        <div><dt>Interlocuteur</dt><dd>${esc(x.contact)}${x.contactRole ? ', ' + esc(x.contactRole) : ''}</dd></div>
        <div><dt>Contact</dt><dd>${esc(x.email)}<br><span class="tnum">${esc(x.phone)}</span></dd></div>
        <div><dt>Autorité destinataire</dt><dd>${esc(a.label)}</dd></div>
        <div><dt>Voie de dépôt</dt><dd>${esc(x.channel)}</dd></div></dl>`)}
      ${block(`Récipiendaires (${x.recipients.length})`, 1, `<div style="padding:0"><table class="data-table"><thead><tr><th>Nom</th><th>Fonction</th><th>Ancienneté</th><th>Médaille</th><th>DTS</th></tr></thead><tbody>
        ${x.recipients.map(r => `<tr><td><strong>${esc(r.nom.toUpperCase())}</strong> ${esc(r.prenom)}</td><td>${esc(r.fonction)}</td><td class="tnum">${GO.seniority(r.entree)} ans</td><td>${esc(GO.medal(r.medal).short)}</td><td class="ref">${esc(r.dts || '—')}</td></tr>`).join('')}</tbody></table></div>`)}
      ${block('Pièces jointes', 2, `<ul class="list-plain">${PIECES.filter(([k]) => x.files[k]).map(([k, t]) => `<li><span>${icon('paperclip', 'ic-sm')} ${esc(t)}</span><span class="muted" style="font-size:12px">${esc(x.files[k].name)}</span></li>`).join('') || '<li><span class="muted">Aucune pièce jointe</span></li>'}</ul>`)}
      <div class="alert alert-info mt">${icon('info')}<div>Après l’envoi, le dossier est enregistré au registre du secrétariat de <strong>${esc(a.short)}</strong> puis transmis au Service des Distinctions. Vous serez notifié à chaque étape et pourrez répondre à une demande de complément.</div></div>
      <div class="field mt" data-f="f-certify"><label class="check"><input type="checkbox" id="f-certify" ${x.certify ? 'checked' : ''}> <span>Je certifie l’exactitude des informations transmises et la conformité des pièces jointes. <span class="req" style="color:var(--red-600)">*</span></span></label></div>`;
  }
  function helpFor(step) {
    const items = [
      ['Utilisez la raison sociale exacte, telle qu’elle figure sur le courrier de demande.', 'Choisissez l’autorité destinataire : c’est son secrétariat qui enregistre votre dossier.', 'L’interlocuteur recevra les demandes de complément et les convocations.'],
      ['Ajoutez autant de récipiendaires que nécessaire.', 'La date d’entrée permet de calculer l’ancienneté affichée.', 'Les conditions d’attribution sont vérifiées pendant l’instruction : aucun échelon n’est attribué automatiquement.'],
      ['Trois pièces sont obligatoires : courrier, liste nominative, attestations.', `Formats acceptés : ${D.config.upload.acceptLabel}.`, 'La DTS peut être complétée après le dépôt : elle est vérifiée par le service instructeur.'],
      ['Chaque section peut être modifiée avant l’envoi.', 'Après l’envoi, le dossier apparaît au statut « Reçu — à traiter ».', 'Vous serez notifié à chaque étape de l’instruction.']
    ][step];
    return `<ul>${items.map(t => `<li>${icon('check')}<span>${esc(t)}</span></li>`).join('')}</ul>`;
  }
  function successHTML() {
    const d = GO.getDossier(F.done);
    return `<div class="success-panel" role="status"><div class="success-mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17 19 7"/></svg></div>
      <h2 style="font-size:20px">Dossier enregistré</h2>
      <p class="muted" style="max-width:52ch;font-size:14px">Le dossier <span class="ref">${F.done}</span> a été transmis et enregistré au registre du secrétariat de <strong>${esc(d ? GO.authority(d.authority).label : '')}</strong>. Il apparaît au statut « Reçu — à traiter ».</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:8px"><a class="btn btn-primary" href="#/dossiers/${F.done}">${icon('folder')}Ouvrir le dossier</a><button class="btn btn-secondary" type="button" data-again>${icon('plus')}Créer un autre dossier</button></div></div>`;
  }

  function onInput(e) {
    const t = e.target, x = F.data;
    if (t.dataset.rk) {
      const r = x.recipients[+t.dataset.ri]; r[t.dataset.rk] = t.value;
      if (t.dataset.rk === 'entree') {
        const s = GO.seniority(t.value), adv = medalAdvice(s);
        const sen = $(`#r${t.dataset.ri}-sen`, document);
        if (sen) sen.textContent = s !== null && s >= 0 && t.value ? `Ancienneté : ${s} an${s > 1 ? 's' : ''}` : '';
        const a = $(`#r${t.dataset.ri}-adv`, document);
        if (a) a.textContent = adv.text;
      }
      if (t.dataset.rk === 'nom' || t.dataset.rk === 'prenom') { const h = t.closest('.recip-card').querySelector('.recip-head strong'); h.lastChild.textContent = `${r.prenom} ${r.nom}`.trim() || 'Nouveau récipiendaire'; }
    } else if (t.dataset.file && e.type === 'change') { setFile(t.dataset.file, t.files[0]); return; }
    else if (t.id === 'f-certify') x.certify = t.checked;
    else if (t.id && t.id.startsWith('f-')) {
      const k = t.id.slice(2); x[k] = t.value;
      if (k === 'org' && e.type === 'change') {
        const o = D.organisations.find(o => o.name.toLowerCase() === t.value.trim().toLowerCase());
        if (o && F.knownOrg !== o.id) {
          F.knownOrg = o.id;
          Object.assign(x, { type: o.type, sector: SECTORS.includes(o.sector) ? o.sector : 'Autre', city: o.city, contact: o.contact, contactRole: o.contactRole, email: o.email, phone: o.phone });
          setTimeout(() => { drawStep(true); const n = $('#f-type'); if (n) n.focus(); }, 0);
          GO.toast('info', 'Organisme reconnu', 'Les coordonnées connues ont été reprises. Vérifiez-les.');
        }
      }
      if (k === 'authority') { const a = GO.authority(x.authority); GO.toast('info', 'Autorité destinataire', `Dossier destiné à ${a.label}.`); }
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
      if (rm[2] === 'dts') return val && val.length < 5 ? 'Référence de DTS trop courte.' : '';
      return val.length >= 2 ? '' : { nom: 'Indiquez le nom.', prenom: 'Indiquez le prénom.', fonction: 'Indiquez la fonction.' }[rm[2]];
    }
    switch (id) {
      case 'f-org': return v('org').length >= 2 ? '' : 'Indiquez la raison sociale de l’organisme.';
      case 'f-type': return v('type') ? '' : 'Sélectionnez le type d’organisme.';
      case 'f-sector': return v('sector') ? '' : 'Sélectionnez le secteur d’activité.';
      case 'f-city': return v('city').length >= 2 ? '' : 'Indiquez la ville.';
      case 'f-authority': return v('authority') ? '' : 'Sélectionnez l’autorité destinataire.';
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
    if (step === 0) return ['f-org', 'f-type', 'f-sector', 'f-city', 'f-authority', 'f-contact', 'f-email', 'f-phone'];
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
      const i = $('input[type=file]', f);
      if (i) { if (msg) { i.setAttribute('aria-invalid', 'true'); i.setAttribute('aria-describedby', id + '-err'); } else { i.removeAttribute('aria-invalid'); i.removeAttribute('aria-describedby'); } }
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
      message: `<p>Le dossier de <strong>${esc(x.org)}</strong> pour <strong>${plural(x.recipients.length, 'récipiendaire', 'récipiendaires')}</strong> sera transmis et enregistré au registre du secrétariat de <strong>${esc(GO.authority(x.authority).label)}</strong>.</p>
        <div class="alert alert-info" style="margin-top:10px">${icon('info')}<div>Vous ne pourrez plus modifier le dossier ; des compléments pourront vous être demandés et un ordre de recette vous sera adressé après décision.</div></div>` });
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
    const dossier = {
      ref, org: o.id, depot: GO.REF_ISO, status: 'recu', agent: null, authority: x.authority, channel: x.channel, complementSince: null,
      recipients: x.recipients.map((r, i) => ({ id: `${ref}-R${i + 1}`, nom: r.nom.trim(), prenom: r.prenom.trim(), fonction: r.fonction.trim(), entree: r.entree, medal: r.medal })),
      history: [{ date: s.date, time: s.time, actor: o.name, kind: 'depot', label: 'Demande déposée en ligne', ref: null }],
      observations: []
    };
    S.dossiers.push(dossier);
    // Déclarations de travail et de salaire déclarées par le demandeur
    x.recipients.forEach((r, i) => {
      if (!r.dts) return;
      S.dts.push({ id: GO.nextRef('DTS-2026-', S.dts, 1), dossier: ref, recipient: `${ref}-R${i + 1}`, employer: o.name, position: r.fonction.trim(), start: r.entree, reference: r.dts.trim(), state: 'saisi', filed: GO.REF_ISO });
    });
    PIECES.forEach(([k, t]) => {
      const f = x.files[k];
      if (!f) return;
      GO.newDoc({ dossier: ref, kind: k === 'demande' ? 'demande' : (k === 'liste' ? 'liste' : (k === 'attestations' ? 'attestations' : 'upload')), type: k === 'demande' ? 'entrant' : 'piece', title: t, date: GO.REF_ISO, from: o.name, state: 'depose', file: f, pages: 2 });
    });
    // Registre du secrétariat de l'autorité destinataire
    GO.registryAdd(null, dossier);
    GO.notify({ type: 'depot', aud: 'authority:' + x.authority, ref, title: 'Nouveau dossier à enregistrer', msg: `${o.name} — ${plural(x.recipients.length, 'récipiendaire', 'récipiendaires')} (voie : ${x.channel}).` });
    GO.notify({ type: 'depot', aud: 'service', ref, title: 'Nouveau dossier reçu', msg: `${o.name} propose ${plural(x.recipients.length, 'récipiendaire', 'récipiendaires')}.` });
    if (GO.scopeOrg() && GO.scopeOrg().id === o.id) GO.notify({ type: 'depot', aud: 'org:' + o.id, ref, title: 'Votre dossier a été transmis', msg: `Enregistré au registre du secrétariat de ${GO.authority(x.authority).short}.` });
    GO.commit();
    return ref;
  }
  GO.views.nouveau = { render: renderForm, state: () => F };

  /* ======================= BÉNÉFICIAIRES ET RÉCIPIENDAIRES ======================= */
  const BF = { q: '', medal: 'all', status: 'all', dts: 'all' };
  function allRecipients() {
    const out = [];
    GO.myDossiers().forEach(d => d.recipients.forEach(r => {
      const t = GO.S.dts.find(x => x.recipient === r.id);
      const rem = GO.remiseOf(d.ref);
      const disc = GO.S.distinctions.find(x => x.person === r.id && x.dossier === d.ref);
      out.push({ r, d, dts: t, remise: rem && (rem.recipients || []).includes(r.id) ? rem : null, disc });
    }));
    return out;
  }
  function renderBeneficiaires(main, r) {
    const q0 = r.params.get('q'); if (q0) BF.q = q0;
    const rows = allRecipients();
    main.innerHTML = `
      ${ui.head({ eyebrow: 'Suivi', title: 'Bénéficiaires et récipiendaires',
        sub: 'Personnes proposées ou distinguées, ancienneté déclarée, pièces au dossier et suites du circuit.',
        actions: GO.can('create') ? `<a class="btn btn-primary" href="#/nouveau">${icon('plus')}Nouveau dossier</a>` : '' })}
      <section class="card reveal" style="--i:1">
        ${ui.toolbar({ search: { id: 'bf-q', label: 'Rechercher', placeholder: 'Nom, fonction, organisme, dossier…', value: BF.q },
          selects: [
            { id: 'bf-status', label: 'Statut du dossier', value: BF.status, options: [{ value: 'all', label: 'Tous les statuts' }, ...D.statusOrder.map(s => ({ value: s, label: D.statuses[s].label }))] },
            { id: 'bf-medal', label: 'Médaille', value: BF.medal, options: [{ value: 'all', label: 'Toutes les médailles' }, ...D.medals.map(m => ({ value: m.id, label: m.short }))] },
            { id: 'bf-dts', label: 'DTS', value: BF.dts, options: [{ value: 'all', label: 'Toutes les DTS' }, { value: 'verifie', label: 'Vérifiée' }, { value: 'saisi', label: 'Saisie, non vérifiée' }, { value: 'anomalie', label: 'Anomalie' }, { value: 'none', label: 'Non saisie' }] }
          ] })}
        ${ui.filterBar('', '<span id="bf-count" aria-live="polite"></span>')}
        <div class="table-wrap" id="bf-wrap"><table class="data-table responsive" id="bf-table">
          <caption class="sr-only">Récipiendaires et bénéficiaires</caption>
          <thead><tr><th scope="col">Nom et prénom</th><th scope="col">Organisme</th><th scope="col">Fonction</th><th scope="col">Ancienneté</th><th scope="col">Médaille</th><th scope="col">Dossier</th><th scope="col">DTS</th><th scope="col">Remise</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
          <tbody></tbody></table><div id="bf-empty"></div></div>
      </section>`;
    const draw = () => {
      const q = norm(BF.q.trim());
      const list = rows.filter(({ r, d, dts }) => {
        const o = GO.org(d.org);
        const okQ = !q || norm(`${r.nom} ${r.prenom} ${r.fonction} ${o.name} ${o.short} ${d.ref}`).includes(q);
        const okS = BF.status === 'all' || d.status === BF.status;
        const okM = BF.medal === 'all' || r.medal === BF.medal;
        const st = dts ? dts.state : 'none';
        const okD = BF.dts === 'all' || (BF.dts === 'verifie' ? st === 'verifie' : BF.dts === 'none' ? st === 'none' : st === BF.dts);
        return okQ && okS && okM && okD;
      });
      $('#bf-count').innerHTML = `<strong>${list.length}</strong> ${list.length > 1 ? 'personnes affichées' : 'personne affichée'} sur ${rows.length}`;
      $('#bf-table tbody').innerHTML = list.map(({ r, d, dts, remise }, i) => {
        const o = GO.org(d.org), e = GO.eligibility(r);
        return `<tr class="is-clickable row-in" style="--i:${i}" data-ref="${d.ref}">
          <td class="td-head" data-label="Nom et prénom"><strong style="color:var(--navy-900)">${esc(r.nom.toUpperCase())}</strong> ${esc(r.prenom)}</td>
          <td data-label="Organisme"><div class="cell-org"><strong>${esc(o.short)}</strong><span>${esc(o.city)}</span></div></td>
          <td data-label="Fonction">${esc(r.fonction)}</td>
          <td data-label="Ancienneté" class="tnum nowrap">${e.years} ans${!e.ok ? ' ' + GO.badge('écart', 'yellow') : ''}</td>
          <td data-label="Médaille" class="nowrap">${esc(GO.medal(r.medal).short)}</td>
          <td data-label="Dossier"><span class="ref">${esc(d.ref)}</span><br>${GO.statusBadge(d.status)}</td>
          <td data-label="DTS" class="nowrap">${dts ? GO.dictBadge(D.dtsStates, dts.state) : GO.badge('non saisie', 'slate')}</td>
          <td data-label="Remise" class="nowrap">${remise ? GO.dictBadge(D.remiseStates, remise.state) : '<span class="muted">—</span>'}</td>
          <td class="cell-actions"><button type="button" class="btn btn-secondary btn-sm" data-open="${d.ref}">Ouvrir</button></td>
        </tr>`;
      }).join('');
      $('#bf-table').hidden = !list.length;
      $('#bf-empty').innerHTML = list.length ? '' : GO.empty('users', 'Aucun bénéficiaire ne correspond', 'Modifiez la recherche ou les filtres pour élargir les résultats.');
    };
    $('#bf-q', main).addEventListener('input', GO.debounce(e => { BF.q = e.target.value; draw(); }, 150));
    $('#bf-status', main).addEventListener('change', e => { BF.status = e.target.value; draw(); });
    $('#bf-medal', main).addEventListener('change', e => { BF.medal = e.target.value; draw(); });
    $('#bf-dts', main).addEventListener('change', e => { BF.dts = e.target.value; draw(); });
    $('#bf-table', main).addEventListener('click', e => {
      const tr = e.target.closest('tr[data-ref]'); if (!tr) return;
      location.hash = '#/dossiers/' + tr.dataset.ref;
    });
    draw();
  }
  GO.views.beneficiaires = { render: renderBeneficiaires };

  /* ======================= DTS ET PIÈCES JUSTIFICATIVES ======================= */
  const PF = { q: '', state: 'all', dossier: 'all' };
  function renderPieces(main, r) {
    const service = GO.isFamily('service', 'inspection');
    const pers = GO.role().scope && GO.role().scope.kind === 'person';
    const dtsList = GO.myDts().slice().sort((a, b) => (b.filed || '').localeCompare(a.filed || ''));
    const docs = GO.myDocs().filter(x => x.type === 'piece' || x.kind === 'upload' || x.kind === 'liste' || x.kind === 'attestations' || x.state === 'illisible').sort((a, b) => b.date.localeCompare(a.date));
    const dossiers = [...new Set(GO.myDossiers().map(d => d.ref))].sort();
    main.innerHTML = `
      ${ui.head({ eyebrow: 'Instruction', title: pers ? 'Mes documents' : 'DTS et pièces justificatives',
        sub: pers ? 'Déclarations de travail et de salaire et pièces versées aux dossiers vous concernant.' : service ? 'Déclarations de travail et de salaire à vérifier et pièces jointes des dossiers dont vous avez la charge.' : 'Déclarations de travail et de salaire et pièces jointes de vos dossiers.',
        actions: GO.can('answer') ? `<button class="btn btn-primary" type="button" id="pc-add">${icon('plus')}Déposer une pièce</button>` : '' })}
      <section class="card reveal" style="--i:1">
        ${ui.toolbar({ search: { id: 'pc-q', label: 'Rechercher', placeholder: 'Nom, référence de DTS, organisme…', value: PF.q },
          selects: [
            { id: 'pc-state', label: 'État', value: PF.state, options: [{ value: 'all', label: 'Tous les états' }, ...Object.entries(D.dtsStates).map(([k, v]) => ({ value: k, label: v.label }))] },
            { id: 'pc-dossier', label: 'Dossier', value: PF.dossier, options: [{ value: 'all', label: 'Tous les dossiers' }, ...dossiers.map(d => ({ value: d, label: d }))] }
          ] })}
        ${ui.filterBar('', '<span id="pc-count" aria-live="polite"></span>')}
        <div class="table-wrap"><table class="data-table responsive" id="pc-table">
          <caption class="sr-only">Déclarations de travail et de salaire</caption>
          <thead><tr><th scope="col">Récipiendaire</th><th scope="col">Dossier</th><th scope="col">Référence de la DTS</th><th scope="col">Date d’entrée</th><th scope="col">Déposée le</th><th scope="col">État</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
          <tbody></tbody></table><div id="pc-empty"></div></div>
      </section>
      <section class="card reveal mt" style="--i:2" aria-labelledby="pc-docs-t">
        <div class="card-head"><div><h2 class="card-title" id="pc-docs-t">${icon('paperclip')}Pièces justificatives</h2>
          <p class="card-sub">${plural(docs.length, 'pièce versée', 'pièces versées')} aux dossiers</p></div></div>
        <div id="pc-docs">${docs.length ? docs.map(x => { const d = GO.getDossier(x.dossier); return `<div class="doc-mini"><span class="doc-ico t-${x.type}">${icon('paperclip')}</span>
          <div><strong>${esc(x.title)}</strong><span>${esc(x.dossier)} · ${esc(GO.org(d.org).short)} · ${fmtDate(x.date, 'short')} · ${esc(x.from)}</span><div style="margin-top:4px">${GO.docBadge(x.state)}</div></div>
          <div style="display:flex;gap:6px">${GO.role().views.includes('courriers') ? `<a class="btn btn-secondary btn-xs" href="#/courriers/${x.id}">${icon('eye', 'ic-sm')}Consulter</a>` : ''}
            ${service && x.state === 'illisible' ? `<button class="btn btn-secondary btn-xs" type="button" data-renum="${x.id}">${icon('refresh', 'ic-sm')}Renumériser</button>` : ''}</div></div>`; }).join('')
          : GO.empty('paperclip', 'Aucune pièce', 'Les pièces versées aux dossiers apparaîtront ici.')}</div>
      </section>`;
    const draw = () => {
      const q = norm(PF.q.trim());
      const list = dtsList.filter(t => {
        const d = GO.getDossier(t.dossier), rec = d.recipients.find(x => x.id === t.recipient) || {};
        const okQ = !q || norm(`${rec.nom || ''} ${rec.prenom || ''} ${t.reference} ${t.employer} ${t.dossier}`).includes(q);
        return okQ && (PF.state === 'all' || t.state === PF.state) && (PF.dossier === 'all' || t.dossier === PF.dossier);
      });
      $('#pc-count').innerHTML = `<strong>${list.length}</strong> ${list.length > 1 ? 'DTS affichées' : 'DTS affichée'}`;
      $('#pc-table tbody').innerHTML = list.map((t, i) => {
        const d = GO.getDossier(t.dossier), rec = d.recipients.find(x => x.id === t.recipient) || {};
        return `<tr class="row-in" style="--i:${i}">
          <td class="td-head" data-label="Récipiendaire"><strong style="color:var(--navy-900)">${esc((rec.nom || '').toUpperCase())}</strong> ${esc(rec.prenom || '')}<br><span class="muted" style="font-size:12px">${esc(t.employer)}</span></td>
          <td data-label="Dossier"><span class="ref">${esc(t.dossier)}</span></td>
          <td data-label="Référence" class="ref">${esc(t.reference || '—')}</td>
          <td data-label="Date d’entrée" class="tnum nowrap">${t.start ? fmtDate(t.start, 'short') : '—'}</td>
          <td data-label="Déposée le" class="tnum nowrap">${t.filed ? fmtDate(t.filed, 'short') : '—'}</td>
          <td data-label="État">${GO.dictBadge(D.dtsStates, t.state)}${t.verifiedBy ? `<br><span class="muted" style="font-size:11.5px">${esc(t.verifiedBy)} · ${fmtDate(t.verifiedOn, 'short')}</span>` : ''}${t.note ? `<br><span class="muted" style="font-size:11.5px">${esc(t.note)}</span>` : ''}</td>
          <td class="cell-actions">${service ? `<button class="btn btn-secondary btn-sm" type="button" data-verify="${t.id}">${icon('shield', 'ic-sm')}Vérifier</button>`
            : GO.external() ? `<button class="btn btn-secondary btn-sm" type="button" data-complete="${t.id}">${icon('edit', 'ic-sm')}Compléter</button>` : `<a class="btn btn-secondary btn-sm" href="#/dossiers/${t.dossier}">Ouvrir</a>`}</td>
        </tr>`;
      }).join('');
      $('#pc-table').hidden = !list.length;
      $('#pc-empty').innerHTML = list.length ? '' : GO.empty('search', 'Aucune DTS ne correspond', 'Modifiez la recherche ou l’état sélectionné.');
    };
    $('#pc-q', main).addEventListener('input', GO.debounce(e => { PF.q = e.target.value; draw(); }, 150));
    $('#pc-state', main).addEventListener('change', e => { PF.state = e.target.value; draw(); });
    $('#pc-dossier', main).addEventListener('change', e => { PF.dossier = e.target.value; draw(); });
    main.addEventListener('click', e => {
      const v = e.target.closest('[data-verify]');
      if (v) {
        const t = GO.S.dts.find(x => x.id === v.dataset.verify), d = GO.getDossier(t.dossier);
        GO.formModal({
          title: 'Vérification de la DTS', icon: 'shield', tone: 'blue',
          intro: `<p>Déclaration <strong>${esc(t.reference || t.id)}</strong> — ${esc(t.employer)}, ${esc(t.position)}, entrée le ${fmtDate(t.start)}.</p>`,
          fields: [
            { id: 'state', label: 'Conclusion du contrôle', type: 'select', options: [{ value: 'verifie', label: 'DTS vérifiée — ancienneté confirmée' }, { value: 'anomalie', label: 'Anomalie — correction demandée' }, { value: 'attendu', label: 'Pièce attendue du demandeur' }] },
            { id: 'note', label: 'Observation', type: 'textarea', rows: 2, required: true, validate: val => val.length >= 5 ? '' : 'Consignez le résultat du contrôle.' }
          ],
          submit: 'Enregistrer', iconSubmit: 'check',
          run: val => {
            t.state = val.state; t.note = val.note;
            if (val.state === 'verifie') { t.verifiedBy = GO.user().name; t.verifiedOn = GO.REF_ISO; }
            GO.addHistory(d, 'instruction', `DTS ${t.id} — ${D.dtsStates[val.state].label}`, GO.actorName(), { detail: val.note });
            GO.notify({ type: 'transmission', aud: 'org:' + d.org, ref: d.ref, title: `DTS ${D.dtsStates[val.state].label.toLowerCase()}`, msg: val.note });
            GO.commit(); GO.refreshDossier(d, false); renderPieces($('#view'), GO.current());
            GO.toast('success', 'DTS mise à jour', D.dtsStates[val.state].label);
          }
        });
        return;
      }
      const c = e.target.closest('[data-complete]');
      if (c) {
        const t = GO.S.dts.find(x => x.id === c.dataset.complete), d = GO.getDossier(t.dossier);
        GO.formModal({
          title: 'Compléter la déclaration de travail et de salaire', icon: 'edit', tone: 'blue',
          intro: `<p>Déclaration de <strong>${esc(t.employer)}</strong> pour ${esc(t.dossier)}.</p>`,
          fields: [
            { id: 'ref', label: 'Référence de la DTS', type: 'text', required: true, value: t.reference === '—' ? '' : t.reference, placeholder: 'Exemple : OE/DRH/DTS/2026-011' },
            { id: 'file', label: 'DTS numérisée', type: 'text', placeholder: 'dts-2026-011.pdf', hint: 'Fichier simulé dans le prototype.' }
          ],
          submit: 'Transmettre au service', iconSubmit: 'send',
          run: val => {
            t.reference = val.ref; t.state = 'saisi'; t.filed = GO.REF_ISO;
            GO.newDoc({ dossier: t.dossier, kind: 'attestations', type: 'piece', title: 'DTS — ' + val.ref, date: GO.REF_ISO, from: GO.org(d.org).name, state: 'depose', file: val.file ? { name: val.file, size: 210000, type: 'application/pdf' } : null });
            GO.addHistory(d, 'depot', 'DTS complétée par le demandeur', undefined, { detail: val.ref });
            GO.notify({ type: 'depot', aud: 'service', ref: d.ref, title: 'DTS complétée', msg: `${GO.org(d.org).short} — ${val.ref}.` });
            GO.commit(); GO.refreshDossier(d, false); renderPieces($('#view'), GO.current());
            GO.toast('success', 'DTS transmise', val.ref);
          }
        });
        return;
      }
      const rn = e.target.closest('[data-renum]');
      if (rn) {
        const doc = GO.getDoc(rn.dataset.renum), d = GO.getDossier(doc.dossier);
        GO.confirmDialog({ title: 'Demander une nouvelle numérisation ?', tone: 'yellow', icon: 'refresh', confirm: 'Envoyer la demande',
          message: `<p>${esc(GO.org(d.org).name)} sera invité à transmettre de nouveau « ${esc(doc.title)} » dans un format lisible.</p>` }).then(ok => {
          if (!ok) return;
          doc.state = 'renum';
          GO.addHistory(d, 'courrier', 'Nouvelle numérisation demandée : ' + doc.title);
          GO.notify({ type: 'complement', aud: 'org:' + d.org, ref: d.ref, title: 'Document à renvoyer', msg: `Le fichier « ${doc.title} » est illisible. Merci de le transmettre de nouveau.` });
          GO.commit(); renderPieces($('#view'), GO.current());
          GO.toast('success', 'Demande envoyée', esc(GO.org(d.org).name));
        });
      }
    });
    const add = $('#pc-add', main);
    if (add) add.addEventListener('click', () => {
      const first = GO.myDossiers()[0];
      GO.formModal({
        title: 'Déposer une pièce justificative', icon: 'upload', tone: 'blue',
        fields: [
          { id: 'dossier', label: 'Dossier', type: 'select', options: GO.myDossiers().map(d => ({ value: d.ref, label: `${d.ref} — ${GO.org(d.org).short}` })) },
          { id: 'title', label: 'Intitulé de la pièce', type: 'text', required: true, placeholder: 'Exemple : Attestation d’ancienneté — R2', validate: v => v.length >= 4 ? '' : 'Indiquez un intitulé.' },
          { id: 'file', label: 'Fichier', type: 'text', required: true, placeholder: 'attestation-anciennete.pdf', hint: `${D.config.upload.acceptLabel} · ${D.config.upload.maxMb} Mo maximum (fichier simulé).` }
        ],
        submit: 'Déposer', iconSubmit: 'upload',
        run: v => {
          const d = GO.getDossier(v.dossier);
          GO.newDoc({ dossier: d.ref, kind: 'upload', type: 'piece', title: v.title, date: GO.REF_ISO, from: GO.org(d.org).name, state: 'depose', file: { name: v.file, size: 248000, type: 'application/pdf' } });
          GO.addHistory(d, 'depot', 'Pièce déposée : ' + v.title);
          GO.notify({ type: 'depot', aud: 'service', ref: d.ref, title: 'Pièce reçue', msg: v.title });
          GO.commit(); GO.refreshDossier(d, false); renderPieces($('#view'), GO.current());
          GO.toast('success', 'Pièce déposée', v.title);
        }
      });
      void first;
    });
    draw();
  }
  GO.views.pieces = { render: renderPieces };

  /* ======================= MES DISTINCTIONS (RÉCIPIENDAIRE) ======================= */
  function renderDistinctions(main) {
    const p = GO.S.person;
    const ids = p ? p.ids : [];
    const list = GO.S.distinctions.filter(x => ids.includes(x.person));
    const nextCer = GO.myCers().filter(c => c.date >= GO.REF_ISO && c.state !== 'termine');
    main.innerHTML = `
      ${ui.head({ eyebrow: 'Bénéficiaire', title: 'Mes distinctions',
        sub: p ? `Relevé des distinctions attribuées à ${esc(p.prenom)} ${esc(p.nom)} — ${esc(p.fonction)}.` : 'Relevé de vos distinctions.',
        actions: GO.can('retrait') ? `<button class="btn btn-secondary" type="button" id="dz-retrait">${icon('medal')}Demander un retrait sans cérémonie</button>` : '' })}
      <section class="card reveal mt" style="--i:1">${ui.kpis([
        { label: 'Distinctions attribuées', count: list.length, note: 'depuis 2015' },
        { label: 'Remises effectuées', count: list.filter(x => x.state === 'remise').length, note: 'médaille et diplôme reçus' },
        { label: 'En attente de remise', count: list.filter(x => x.state === 'attribue').length, note: 'après validation de la cérémonie' },
        { label: 'Cérémonies à venir', count: nextCer.length, note: 'vous concernant' }
      ])}</section>
      <div class="grid grid-2 mt">
        <section class="card reveal" style="--i:2" aria-labelledby="dz-t">
          <div class="card-head"><div><h2 class="card-title" id="dz-t">${icon('medal')}Relevé des distinctions</h2><p class="card-sub">Références, dossiers et modalités de remise</p></div></div>
          ${list.length ? `<div class="table-wrap"><table class="data-table responsive"><thead><tr><th scope="col">Distinction</th><th scope="col">Année</th><th scope="col">Dossier</th><th scope="col">Cérémonie</th><th scope="col">État</th></tr></thead><tbody>
            ${list.map(x => `<tr><td data-label="Distinction"><strong style="color:var(--navy-900)">${esc(GO.medal(x.medal).short)}</strong><br><span class="ref">${esc(x.id)}</span></td>
              <td data-label="Année" class="tnum">${x.year}</td>
              <td data-label="Dossier">${GO.role().views.includes('dossiers') ? GO.refChip(x.dossier) : `<span class="ref">${esc(x.dossier)}</span>`}</td>
              <td data-label="Cérémonie">${x.ceremony ? `<span class="ref">${esc(x.ceremony)}</span><br><span class="muted" style="font-size:12px">${esc(x.venue || '')}</span>` : '<span class="muted">—</span>'}</td>
              <td data-label="État">${x.state === 'remise' ? GO.badge('Remise effectuée', 'green') : GO.badge('Attribuée', 'blue')}<br><span class="muted" style="font-size:11.5px">${fmtDate(x.date, 'short')}</span></td></tr>`).join('')}
          </tbody></table></div>` : GO.empty('medal', 'Aucune distinction', 'Vos distinctions apparaîtront ici après la décision d’attribution.')}
        </section>
        <div class="stack">
          ${nextCer.length ? ui.card({ i: 3, icon: 'calendar', title: 'Cérémonies à venir', sub: 'Dates confirmées et propositions en cours', body: `<ul class="mini-agenda">${nextCer.map(c => { const dt = GO.parseISO(c.date); return `<li><span class="date-tile"><b>${dt.getDate()}</b><span>${GO.MONTHS_S[dt.getMonth()]}</span></span>
            <span><strong>${esc(c.id)} — ${esc(GO.venue(c.venue).name)}</strong><small>${esc(c.time.replace(':', ' h '))} · ${esc(GO.venue(c.venue).city)}</small></span>${GO.cerBadge(c.state)}</li>`; }).join('')}</ul>` })
          : ui.card({ i: 3, icon: 'calendar', title: 'Cérémonies à venir', body: GO.empty('calendar', 'Aucune cérémonie', 'Les cérémonies vous concernant apparaîtront ici après validation de la date.') })}
          ${ui.card({ i: 4, icon: 'bell', title: 'Notifications récentes', sub: 'Événements vous concernant',
            body: GO.myNotifs().length ? `<ul class="list-plain">${GO.myNotifs().slice(0, 4).map(n => `<li><span style="min-width:0"><strong style="display:block;font-size:13px;color:var(--navy-900)">${esc(n.title)}</strong>
              <span class="muted" style="font-size:12px">${esc(n.msg)}</span></span><span class="muted tnum" style="font-size:11.5px">${esc(relDay(n.date))}</span></li>`).join('')}</ul>`
              : GO.empty('bell', 'Aucune notification', 'Vous serez notifié à chaque étape vous concernant.') })}
          ${ui.card({ i: 5, icon: 'user', title: 'Mes affiliations', sub: 'Employeur déclaré au dossier',
            body: ui.dl([['Nom', `${esc(p.prenom)} ${esc(p.nom)}`], ['Fonction', esc(p.fonction)], ['Employeur', esc(GO.org(p.org).name)], ['Entrée dans l’organisme', fmtDate(p.entree)], ['Ancienneté', `${GO.seniority(p.entree)} ans`]]) })}
        </div>
      </div>`;
    const btn = $('#dz-retrait', main);
    if (btn) btn.addEventListener('click', () => {
      const d = GO.myDossiers().find(x => x.status === 'approuve' && !GO.withdrawalOf(x.ref) && GO.remiseOf(x.ref) === undefined);
      if (!d) { GO.toast('info', 'Aucun dossier éligible', 'Aucun dossier approuvé sans modalité de remise n’est rattaché à votre profil.'); return; }
      $('#view').dispatchEvent(new Event('noop'));
      location.hash = '#/dossiers/' + d.ref;
      setTimeout(() => { const b = $('.drawer [data-act="retrait_demande"]'); if (b) b.click(); else if (GO.dossierActions) GO.dossierActions.retrait_demande(d); }, 400);
    });
  }
  GO.views.distinctions = { render: renderDistinctions };
})(window.GO);
