/* ==========================================================================
   GAB-ORIENT — Vues « Dossiers transmis et décisions » et « Recours »
   Interfaces des autorités destinataires (DGT, Ministre, DR) et du suivi des
   recours : les décisions sont enregistrées au nom de l'autorité compétente.
   ========================================================================== */
(function (GO) {
  'use strict';
  const { $, $$, esc, icon, D, fmtDate, relDay, plural, ageDays, norm, parseISO } = GO;
  const ui = GO.ui;

  const DF = { q: '', tab: 'attente', medal: 'all' };
  const RT = { q: '', state: 'all' };

  const decidedOn = d => (d.history.find(h => h.kind === 'decision') || {}).date;
  const decisionDoc = d => GO.docsOf(d.ref).find(x => x.kind === 'decision');
  const transmittedOn = d => (d.history.find(h => h.kind === 'transmission') || {}).date || d.depot;
  const medsOf = d => D.medals.map(m => ({ m, n: d.recipients.filter(r => r.medal === m.id).length })).filter(x => x.n);
  const medalLine = d => medsOf(d).map(x => `${x.n} ${x.m.short.toLowerCase()}`).join(', ');

  function scopeLabel() {
    const a = GO.scopeAuthority();
    return a ? a.label : 'Autorité destinataire';
  }

  /* ======================= DOSSIERS TRANSMIS ET DÉCISIONS ======================= */
  function renderDecisions(main) {
    const list = GO.myDossiers();
    const attente = list.filter(d => d.status === 'transmis');
    const rendues = list.filter(d => d.status === 'approuve' || d.status === 'refuse').sort((a, b) => (decidedOn(b) || '').localeCompare(decidedOn(a) || ''));
    const recours = GO.myRecours();
    const toValidate = GO.can('valider_ceremonie') ? GO.myCers().filter(c => c.state === 'propose' || c.state === 'negociation') : [];
    const delais = rendues.map(d => GO.daysBetween(d.depot, decidedOn(d))).filter(n => n >= 0);
    const avg = delais.length ? Math.round(delais.reduce((a, b) => a + b, 0) / delais.length) : null;
    const appr = rendues.filter(d => d.status === 'approuve').length;
    const isMin = GO.role().family === 'autorite' && GO.role().id === 'ministre';

    main.innerHTML = `
      ${ui.head({ eyebrow: 'Décision', title: 'Dossiers transmis et décisions',
        sub: `${isMin ? 'Dossiers relevant du Ministre du Travail' : 'Dossiers relevant de ' + esc(scopeLabel())} : examen des dossiers transmis par le Service des Distinctions, avis, décisions et suites données.`,
        actions: `${GO.can('avis') ? `<a class="btn btn-secondary" href="#/courriers">${icon('file')}Courriers reçus</a>` : ''}<a class="btn btn-secondary" href="#/recours">${icon('scale')}Recours${recours.filter(r => r.state === 'depose' || r.state === 'en_examen').length ? ` (${recours.filter(r => r.state === 'depose' || r.state === 'en_examen').length})` : ''}</a>` })}
      <section class="card reveal" style="--i:1">${ui.kpis([
        { label: 'Dossiers en attente de décision', count: attente.length, note: 'transmis par le service' },
        { label: 'Décisions rendues', count: rendues.length, note: `${appr} favorable${appr > 1 ? 's' : ''}, ${rendues.length - appr} refus` },
        { label: 'Délai moyen dépôt → décision', value: avg === null ? '—' : `${avg}<small>jours</small>`, note: delais.length ? `sur ${plural(delais.length, 'dossier décidé', 'dossiers décidés')}` : 'aucune décision' },
        { label: 'Recours à examiner', count: recours.filter(r => r.state === 'depose' || r.state === 'en_examen').length, note: toValidate.length ? `dont ${plural(toValidate.length, 'date de cérémonie à valider', 'dates de cérémonie à valider')}` : 'recours gracieux' }
      ])}</section>
      <section class="card reveal mt" style="--i:2">
        ${ui.toolbar({ search: { id: 'de-q', label: 'Rechercher', placeholder: 'Référence, organisme…', value: DF.q },
          selects: [{ id: 'de-medal', label: 'Échelon', value: DF.medal, options: [{ value: 'all', label: 'Tous les échelons' }, ...D.medals.map(m => ({ value: m.id, label: m.label }))] }] })}
        ${ui.filterBar(`<div class="chip-row" id="de-chips" role="group" aria-label="Filtrer les dossiers"></div>`, '<span id="de-count" aria-live="polite"></span>')}
        <div id="de-table"></div>
      </section>
      ${toValidate.length ? ui.card({ i: 3, cls: 'mt', icon: 'shield', title: 'Dates de cérémonie soumises à votre validation', sub: 'Une date proposée n’est jamais affichée comme confirmée avant validation',
        body: `<ul class="list-plain">${toValidate.map(c => { const d = GO.getDossier(c.dossier), v = GO.venue(c.venue), o = GO.org(d.org); return `<li>
          <span style="min-width:0"><span class="ref">${esc(c.id)}</span>
            <strong style="display:block;font-size:13.5px;color:var(--navy-900)">${esc(o.name)} — ${fmtDate(c.date, 'full')} à ${esc(c.time.replace(':', ' h '))}</strong>
            <span class="muted" style="font-size:12px">${esc(v.name)}, ${esc(v.city)} · ${plural(d.recipients.length, 'récipiendaire', 'récipiendaires')} · ${esc(D.ceremonyStates[c.state].label)}</span></span>
          <span style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-secondary btn-xs" type="button" data-cer-open="${c.id}">Ouvrir la fiche</button>
          <button class="btn btn-primary btn-xs" type="button" data-cer-val="${c.id}">Valider la date</button></span></li>`; }).join('')}</ul>` }) : ''}
      ${ui.card({ i: 4, cls: 'mt', icon: 'clock', title: 'Suivi des décisions', sub: 'Ce que devient chaque dossier décidé : ordre de recette, cérémonie, remise et recours',
        body: rendues.length ? `<div class="table-wrap"><table class="data-table responsive"><caption class="sr-only">Suivi des décisions</caption><thead><tr>
            <th scope="col">Dossier</th><th scope="col">Décision</th><th scope="col">Suites financières</th><th scope="col">Cérémonie / remise</th><th scope="col">Recours</th></tr></thead><tbody>
          ${rendues.slice(0, 8).map(d => { const or = GO.receiptOrder(d.ref), c = GO.activeCer(d.ref) || GO.cersOf(d.ref)[0], rem = GO.remiseOf(d.ref), wd = GO.withdrawalOf(d.ref), rcs = GO.recoursOf(d.ref), a = GO.authority(d.authority); return `<tr>
            <td data-label="Dossier"><span class="ref">${esc(d.ref)}</span><br><span class="muted" style="font-size:12px">${esc(GO.org(d.org).short)}</span></td>
            <td data-label="Décision">${GO.statusBadge(d.status)}<br><span class="muted" style="font-size:12px">${esc(decisionDoc(d) ? decisionDoc(d).number : '—')}<br>${esc(a.short)} · ${esc(decidedOn(d) ? fmtDate(decidedOn(d), 'short') : '—')}</span></td>
            <td data-label="Suites financières">${or ? `${GO.dictBadge(D.recetteStates, or.state)}<br><span class="muted" style="font-size:12px">${esc(or.id)} — ${esc(or.amount)}</span>` : '<span class="muted">—</span>'}</td>
            <td data-label="Cérémonie / remise">${wd ? GO.dictBadge(D.withdrawalStates, wd.state) : c ? `${GO.cerBadge(c.state)}<br><span class="muted" style="font-size:12px">${esc(c.id)} · ${fmtDate(c.date, 'short')}</span>` : '<span class="muted">à programmer</span>'}
              ${rem && rem.state !== 'retrait' ? `<br><span class="muted" style="font-size:12px">${esc(D.remiseStates[rem.state].label)}</span>` : ''}</td>
            <td data-label="Recours">${rcs ? `${esc(rcs.id)}<br>${GO.dictBadge(D.recoursStates, rcs.state)}` : '<span class="muted">—</span>'}</td></tr>`; }).join('')}
        </tbody></table></div>` : GO.empty('stamp', 'Aucune décision rendue', 'Les dossiers transmis pour décision apparaîtront ici.') })}
    `;

    const tabs = () => [{ key: 'attente', label: 'À décider', n: attente.length }, { key: 'rendues', label: 'Décisions rendues', n: rendues.length }]
      .concat([{ key: 'instruction', label: 'Dossiers en cours d’instruction', n: list.filter(d => ['recu', 'en_cours', 'complement'].includes(d.status)).length }]);
    const draw = () => {
      const q = norm(DF.q.trim());
      const keep = d => (!q || norm(`${d.ref} ${GO.org(d.org).name} ${GO.org(d.org).city}`).includes(q)) && (DF.medal === 'all' || d.recipients.some(r => r.medal === DF.medal));
      $('#de-chips').innerHTML = ui.chips(tabs(), DF.tab, { attr: 'data-t' }).replace(/^<div class="chip-row"[^>]*>|<\/div>$/g, '');
      let rows = [], cols = [], cap = '';
      if (DF.tab === 'attente') {
        rows = attente.filter(keep).sort((a, b) => transmittedOn(a).localeCompare(transmittedOn(b)));
        cap = 'Dossiers en attente de décision';
        cols = [
          { label: 'Dossier', cls: 'td-head', cell: d => `<span class="ref">${esc(d.ref)}</span><br>${GO.stepMini(d)}` },
          { label: 'Organisme demandeur', cls: 'td-wide', cell: d => `<div class="cell-org"><strong>${esc(GO.org(d.org).name)}</strong><span>${esc(GO.org(d.org).city)} · ${plural(d.recipients.length, 'récipiendaire', 'récipiendaires')}</span></div>` },
          { label: 'Échelons proposés', cell: d => medalLine(d) },
          { label: 'Transmis depuis', cls: 'tnum nowrap', cell: d => `${plural(ageDays(transmittedOn(d)), 'jour', 'jours')}<br><span class="muted" style="font-size:11.5px">le ${esc(fmtDate(transmittedOn(d), 'short'))}</span>` },
          { label: 'Pièces', cell: d => { const note = GO.docsOf(d.ref).find(x => x.kind === 'transmission'); return note ? `${GO.docBadge(note.state)}<br><span class="muted" style="font-size:11.5px">${esc(note.number || '')}</span>` : '<span class="muted">—</span>'; } },
          { head: '', cls: 'cell-actions', cell: d => `<button class="btn btn-primary btn-sm" type="button" data-do="decide" data-ref="${d.ref}">Décider</button>
              <button class="btn btn-secondary btn-sm" type="button" data-do="avis" data-ref="${d.ref}">Avis</button>
              <a class="btn btn-ghost btn-sm" href="#/dossiers/${d.ref}">Consulter</a>` }
        ];
      } else if (DF.tab === 'rendues') {
        rows = rendues.filter(keep);
        cap = 'Décisions rendues';
        cols = [
          { label: 'Dossier', cls: 'td-head', cell: d => `<span class="ref">${esc(d.ref)}</span><br>${GO.statusBadge(d.status)}` },
          { label: 'Organisme demandeur', cell: d => esc(GO.org(d.org).name) },
          { label: 'Décision', cell: d => `${esc(decisionDoc(d) ? decisionDoc(d).number : '—')}<br><span class="muted" style="font-size:11.5px">${esc(decidedOn(d) ? fmtDate(decidedOn(d), 'short') : '—')} · ${plural(d.recipients.length, 'récipiendaire', 'récipiendaires')}</span>` },
          { label: 'Suites', cell: d => { const or = GO.receiptOrder(d.ref), c = GO.activeCer(d.ref), rem = GO.remiseOf(d.ref), wd = GO.withdrawalOf(d.ref); const parts = []; if (or) parts.push(`<span class="pill">${esc(or.amount)}</span>`); if (wd) parts.push(GO.dictBadge(D.withdrawalStates, wd.state)); else if (c) parts.push(GO.cerBadge(c.state)); if (rem) parts.push(GO.dictBadge(D.remiseStates, rem.state)); return parts.join(' ') || '<span class="muted">—</span>'; } },
          { head: '', cls: 'cell-actions', cell: d => `<a class="btn btn-secondary btn-sm" href="#/dossiers/${d.ref}">Consulter le dossier</a>${GO.can('relance') ? `<button class="btn btn-ghost btn-sm" type="button" data-do="relance" data-ref="${d.ref}">Relancer le service</button>` : ''}` }
        ];
      } else {
        rows = list.filter(d => ['recu', 'en_cours', 'complement'].includes(d.status)).filter(keep);
        cap = 'Dossiers en cours d’instruction';
        cols = [
          { label: 'Dossier', cls: 'td-head', cell: d => `<span class="ref">${esc(d.ref)}</span><br>${GO.statusBadge(d.status)}` },
          { label: 'Organisme demandeur', cell: d => `${esc(GO.org(d.org).short)}<br><span class="muted" style="font-size:11.5px">déposé le ${esc(fmtDate(d.depot, 'short'))}</span>` },
          { label: 'Étape', cell: d => GO.stepMini(d) },
          { label: 'Complément', cell: d => { const c = GO.complementOf(d.ref); return c && c.state !== 'satisfait' ? `${GO.badge('en attente', 'yellow')}<br><span class="muted" style="font-size:11.5px">${plural(ageDays(c.requested), 'jour', 'jours')}</span>` : '<span class="muted">—</span>'; } },
          { label: 'Suivi', cell: d => (() => { const ctl = GO.controlOf(d.ref); return ctl ? GO.dictBadge(D.controlStates, ctl.state) : '<span class="muted">aucun contrôle</span>'; })() },
          { head: '', cls: 'cell-actions', cell: d => `<a class="btn btn-secondary btn-sm" href="#/dossiers/${d.ref}">Consulter</a>` }
        ];
      }
      const html = rows.length ? ui.table(cols, rows, { clickable: true, caption: cap, rowAttrs: d => `data-ref="${esc(d.ref)}"` }) : GO.empty('folder', 'Aucun dossier dans cette vue', 'Aucun dossier ne correspond aux filtres sélectionnés.');
      $('#de-table').innerHTML = `<h3 class="sr-only">${esc(cap)}</h3>` + html;
      $('#de-count').innerHTML = `<strong>${rows.length}</strong> ${rows.length > 1 ? 'dossiers affichés' : 'dossier affiché'}`;
      $$('#de-table tr[data-ref]').forEach(tr => tr.addEventListener('click', e => { if (!e.target.closest('a,button')) location.hash = '#/dossiers/' + tr.dataset.ref; }));
      $$('#de-table [data-do]').forEach(b => b.addEventListener('click', () => {
        const d = GO.getDossier(b.dataset.ref), a = GO.dossierActions[b.dataset.do];
        if (a) a(d, b);
      }));
    };
    $('#de-q', main).addEventListener('input', GO.debounce(e => { DF.q = e.target.value; draw(); }, 150));
    $('#de-medal', main).addEventListener('change', e => { DF.medal = e.target.value; draw(); });
    $('#de-chips', main).addEventListener('click', e => { const c = e.target.closest('[data-t]'); if (!c) return; DF.tab = c.dataset.t; draw(); });
    draw();
    $$('[data-cer-open]', main).forEach(b => b.addEventListener('click', () => { location.hash = '#/ceremonies/' + b.dataset.cerOpen; }));
    $$('[data-cer-val]', main).forEach(b => b.addEventListener('click', () => { location.hash = '#/ceremonies/' + b.dataset.cerVal; setTimeout(() => GO.toast('info', 'Validation de la date', 'Utilisez « Valider la date de cérémonie » sur la fiche de la cérémonie.'), 400); }));
    requestAnimationFrame(() => $$('[data-c]', main).forEach(n => GO.countUp(n, +n.dataset.c)));
  }
  GO.views.decisions = { render: renderDecisions };

  /* ======================= RECOURS ======================= */
  function renderRecours(main) {
    const list = GO.myRecours().slice().sort((a, b) => b.date.localeCompare(a.date));
    const open = list.filter(r => r.state === 'depose' || r.state === 'en_examen');
    const filing = GO.external() ? GO.myDossiers().find(d => d.status === 'refuse' && !GO.recoursOf(d.ref)) : null;
    const counts = Object.fromEntries(['all', ...Object.keys(D.recoursStates)].map(k => [k, k === 'all' ? list.length : list.filter(r => r.state === k).length]));
    main.innerHTML = `
      ${ui.head({ eyebrow: 'Voies de recours', title: 'Recours',
        sub: GO.external() ? 'Recours gracieux formés contre une décision, suivi de leur instruction et de la réponse notifiée.' : 'Recours reçus, instruction par l’autorité compétente et suites données au dossier.',
        actions: filing ? `<button class="btn btn-primary" type="button" id="rc-new">${icon('scale')}Déposer un recours</button>` : '' })}
      <section class="card reveal" style="--i:1">${ui.kpis([
        { label: 'Recours enregistrés', count: list.length, note: 'toutes périodes' },
        { label: 'En cours d’examen', count: open.length, note: open.length ? `dont ${list.filter(r => r.state === 'depose').length} à ouvrir` : 'aucun recours en attente' },
        { label: 'Recours acceptés', count: list.filter(r => r.state === 'accepte').length, note: 'réexamen du dossier' },
        { label: 'Recours rejetés', count: list.filter(r => r.state === 'rejete').length, note: 'décision maintenue' }
      ])}</section>
      ${filing ? `<div class="alert alert-warn reveal mt" style="--i:2">${icon('scale')}<div><strong>Recours possible sur ${esc(filing.ref)}</strong><p style="margin-top:4px">La décision de refus du ${esc(fmtDate(decidedOn(filing) || filing.depot, 'full'))} peut être contestée. Le recours est adressé à ${esc(GO.authority(filing.authority).label)} par la voie hiérarchique ou directement au service.</p>
        <button class="btn btn-secondary btn-sm mt" type="button" id="rc-new2">${icon('send')}Former le recours</button></div></div>` : ''}
      <section class="card reveal mt" style="--i:3">
        ${ui.toolbar({ search: { id: 'rc-q', label: 'Rechercher', placeholder: 'Référence, dossier, motif…', value: RT.q } })}
        ${ui.filterBar(`<div class="chip-row" id="rc-chips" role="group" aria-label="Filtrer par état">${ui.chips([{ key: 'all', label: 'Tous les recours', n: counts.all }, ...Object.entries(D.recoursStates).map(([k, v]) => ({ key: k, label: v.label, n: counts[k], tone: v.tone }))], RT.state, { attr: 'data-t' }).replace(/^<div class="chip-row"[^>]*>|<\/div>$/g, '')}</div>`, '<span id="rc-count" aria-live="polite"></span>')}
        <div id="rc-list"></div>
      </section>`;
    const draw = () => {
      const q = norm(RT.q.trim());
      const rows = list.filter(r => (RT.state === 'all' || r.state === RT.state) && (!q || norm(`${r.id} ${r.dossier} ${r.author} ${r.motif}`).includes(q)));
      $('#rc-list').innerHTML = rows.length ? `<div class="accordion" id="rc-acc">` + rows.map(r => {
        const d = GO.getDossier(r.dossier), o = d && GO.org(d.org), dec = d && decisionDoc(d);
        const canDecide = GO.can('recours') && !GO.external();
        const doc = r.doc && GO.getDoc(r.doc);
        return `<article class="acc" data-rc="${esc(r.id)}">
          <div class="acc-head">
            <button class="acc-btn" type="button" aria-expanded="false" aria-controls="rc-b-${esc(r.id)}">
              <span class="ref">${esc(r.id)}</span>
              <span style="min-width:0"><strong style="display:block;color:var(--navy-900)">${esc(o ? o.name : r.dossier)}</strong>
                <span class="muted" style="font-size:12px">Déposé le ${esc(fmtDate(r.date, 'full'))} · ${esc(r.dossier)} · ${esc(GO.authority(r.authority).short)}</span></span>
              ${GO.dictBadge(D.recoursStates, r.state)}
              ${icon('chevron-down', 'ic-sm acc-caret')}
            </button>
          </div>
          <div class="acc-body" id="rc-b-${esc(r.id)}" hidden>
            <div class="d-section"><h4>Motif du recours</h4><p class="obs" style="margin:0">${esc(r.motif)}</p></div>
            <div class="d-section"><h4>Décision contestée</h4>
              ${ui.dl([['Décision', dec ? `${esc(dec.title)} — ${esc(dec.number)}` : '—'], ['Date', decidedOn(d) ? fmtDate(decidedOn(d), 'full') : '—'], ['Autorité compétente', esc(GO.authority(r.authority).label)]])}</div>
            ${ui.dl([['Pièce jointe', doc ? `<a class="link-btn" href="#/courriers/${esc(doc.id)}">${esc(doc.title)}</a>` : '—'], ['Autorisation', r.reference || '—'], ['Suite donnée le', r.decidedOn ? fmtDate(r.decidedOn, 'full') : '—']], 'mt')}
            ${r.note ? `<div class="d-section mt"><h4>Motivation de la suite donnée</h4><p style="margin:0">${esc(r.note)}</p></div>` : ''}
            ${(r.history || []).length ? `<div class="d-section"><h4>Chronologie du recours</h4>${ui.timeline(r.history.map(h => ({ label: h.label, actor: h.actor, date: h.date, time: h.time, kind: 'note', icon: 'scale' })))}</div>` : ''}
            <div class="d-actions">
              ${canDecide && (r.state === 'depose' || r.state === 'en_examen') ? `<button class="btn btn-primary btn-sm" type="button" data-rd="${r.dossier}">${icon('check', 'ic-sm')}${r.state === 'depose' ? 'Ouvrir l’examen du recours' : 'Enregistrer la suite donnée'}</button>` : ''}
              ${canDecide && r.state === 'depose' ? `<button class="btn btn-secondary btn-sm" type="button" data-rc-open="${r.id}">${icon('clock', 'ic-sm')}Mettre le recours en examen</button>` : ''}
              <a class="btn btn-secondary btn-sm" href="#/dossiers/${esc(r.dossier)}">Ouvrir le dossier</a>
            </div></div></article>`;
      }).join('') + `</div>` : GO.empty('scale', 'Aucun recours', RT.state === 'all' ? 'Aucun recours n’est enregistré pour les dossiers accessibles avec ce profil.' : 'Aucun recours dans cet état.');
      $('#rc-count').innerHTML = `<strong>${rows.length}</strong> ${rows.length > 1 ? 'recours affichés' : 'recours affiché'}`;
      $$('#rc-list .acc-btn').forEach(b => b.addEventListener('click', () => {
        const art = b.closest('.acc'), body = $('.acc-body', art), openNow = !body.hidden;
        $$('#rc-list .acc').forEach(a => { const bd = $('.acc-body', a); bd.hidden = true; $('.acc-btn', a).setAttribute('aria-expanded', 'false'); a.classList.remove('is-open'); });
        if (!openNow) { body.hidden = false; b.setAttribute('aria-expanded', 'true'); art.classList.add('is-open'); }
      }));
      $$('#rc-list [data-rd]').forEach(b => b.addEventListener('click', () => { const d = GO.getDossier(b.dataset.rd); GO.dossierActions.recours_decide(d); }));
      $$('#rc-list [data-rc-open]').forEach(b => b.addEventListener('click', () => {
        const r = GO.S.recours.find(x => x.id === b.dataset.rcOpen); if (!r) return;
        r.state = 'en_examen';
        r.history = r.history || []; r.history.push({ date: GO.REF_ISO, time: GO.stamp().time, actor: GO.actorName(), label: 'Recours mis en examen' });
        GO.audit(GO.actorName(), 'Recours mis en examen', `${r.id} — ${r.dossier}`);
        goNotify(r, 'Recours en examen', 'L’instruction du recours a été ouverte.');
        GO.commit();
        GO.toast('success', 'Recours en examen', esc(r.id));
        draw();
      }));
    };
    const goNotify = (r, title, msg) => {
      GO.notify({ type: 'recours', aud: 'org:' + GO.getDossier(r.dossier).org, ref: r.dossier, title, msg });
      GO.notify({ type: 'recours', aud: 'service', ref: r.dossier, title, msg: `${r.id} — ${msg}` });
    };
    const file = () => { const d = filing || GO.myDossiers().find(x => x.status === 'refuse' && !GO.recoursOf(x.ref)); if (d) GO.dossierActions.recours(d); };
    $('#rc-q', main).addEventListener('input', GO.debounce(e => { RT.q = e.target.value; draw(); }, 150));
    $('#rc-chips', main).addEventListener('click', e => { const c = e.target.closest('[data-t]'); if (!c) return; RT.state = c.dataset.t; draw(); });
    const b1 = $('#rc-new', main), b2 = $('#rc-new2', main);
    if (b1) b1.addEventListener('click', file);
    if (b2) b2.addEventListener('click', file);
    draw();
    requestAnimationFrame(() => $$('[data-c]', main).forEach(n => GO.countUp(n, +n.dataset.c)));
    void relDay; void parseISO;
  }
  GO.views.recours = { render: renderRecours };
})(window.GO);
