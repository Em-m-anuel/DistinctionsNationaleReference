/* ==========================================================================
   GAB-ORIENT — Service des Distinctions et Inspection du travail
   Vues : « File d'instruction », « Supervision du service », « Compléments et
   relances », « Contrôles et anomalies », « Statistiques ».
   ========================================================================== */
(function (GO) {
  'use strict';
  const { $, $$, esc, icon, D, fmtDate, relDay, plural, ageDays, norm } = GO;
  const ui = GO.ui;

  /* ======================= FILE D'INSTRUCTION ======================= */
  // Étapes attendues de chaque dossier, calculées depuis son historique et
  // ses courriers : la file ne montre que ce qui reste à faire.
  function queueItem(d) {
    const note = GO.docsOf(d.ref).find(x => x.kind === 'transmission');
    const cpl = GO.complementOf(d.ref), or = GO.receiptOrder(d.ref), c = GO.cersOf(d.ref)[0];
    let key = null, label = '', tone = 'blue', urgent = 0;
    if (d.status === 'recu') { key = 'ouvrir'; label = 'Recevabilité et ouverture de l’instruction'; urgent = ageDays(d.depot); }
    else if (d.status === 'en_cours') {
      const toVerify = d.recipients.some(r => { const t = GO.S.dts.find(x => x.recipient === r.id); return !t || t.state === 'saisi' || t.state === 'attendu'; });
      if (toVerify && !note) { key = 'verifier'; label = 'Vérification des bénéficiaires, des DTS et des pièces'; urgent = ageDays(d.depot); }
      else if (!note) { key = 'note'; label = 'Note de transmission à préparer'; urgent = ageDays(d.depot); }
      else if (note.state === 'attente_visa') { key = 'visa'; label = 'Visa interne du Chef du Service'; urgent = ageDays(note.date); }
      else if (note.state === 'vise') { key = 'transmettre'; label = `Transmission à ${GO.authority(d.authority).short}`; urgent = ageDays(note.date); }
      void toVerify;
    } else if (d.status === 'complement') { key = 'relancer'; label = `Complément sans réponse depuis ${ageDays(cpl ? cpl.requested : d.depot)} jours`; tone = 'yellow'; urgent = ageDays(cpl ? cpl.requested : d.depot); }
    else if (d.status === 'transmis') { key = 'decider'; label = `Décision attendue de ${GO.authority(d.authority).short}`; urgent = ageDays((d.history.find(h => h.kind === 'transmission') || {}).date || d.depot); }
    else if (d.status === 'approuve') {
      if (!or) { key = 'recette'; label = 'Ordre de recette à émettre'; }
      else if (or.state === 'recu_depose') { key = 'verif_recu'; label = 'Reçu de paiement à vérifier'; tone = 'yellow'; }
      else if (!c && !GO.remiseOf(d.ref)) { key = 'programmer'; label = 'Cérémonie à programmer'; tone = 'green'; }
      else if (c && c.state === 'propose') { key = 'valider'; label = 'Date de cérémonie à valider'; tone = 'green'; }
      else if (c && c.state === 'confirme' && !GO.remiseOf(d.ref)) { key = 'remise'; label = 'Médailles à préparer et remise à enregistrer'; tone = 'green'; }
    }
    else if (d.status === 'refuse' && GO.recoursOf(d.ref)) { const r = GO.recoursOf(d.ref); if (r.state === 'depose' || r.state === 'en_examen') { key = 'recours'; label = 'Recours à instruire'; tone = 'red'; urgent = ageDays(r.date); } }
    const ctl = GO.controlOf(d.ref);
    if (ctl && (ctl.state === 'anomalie' || ctl.state === 'correction')) { key = key || 'anomalie'; label = label || 'Anomalies de contrôle à traiter'; tone = ctl.state === 'anomalie' ? 'red' : 'yellow'; }
    return key ? { d, key, label, tone, urgent } : null;
  }

  const IF = { step: 'all', q: '', sort: 'urgence' };
  const STEP_LABEL = { ouvrir: 'À ouvrir', verifier: 'À vérifier', note: 'Note à préparer', visa: 'À viser', transmettre: 'À transmettre', decider: 'Décision attendue', relancer: 'Complément en retard', recette: 'Ordre de recette', verif_recu: 'Reçu à vérifier', programmer: 'Cérémonie à programmer', valider: 'Date à valider', remise: 'Remise à enregistrer', recours: 'Recours', anomalie: 'Anomalies' };

  function renderInstruction(main) {
    const items = GO.myDossiers().map(queueItem).filter(Boolean);
    const allowed = items.filter(i => relevant(i.key));
    const counts = Object.fromEntries(['all', ...Object.keys(STEP_LABEL)].map(k => [k, k === 'all' ? allowed.length : allowed.filter(i => i.key === k).length]));
    main.innerHTML = `
      ${ui.head({ eyebrow: 'Instruction', title: 'File d’instruction',
        sub: 'Dossiers qui attendent une action de votre part, classés par urgence. Chaque action s’effectue depuis le dossier.',
        actions: GO.can('create') ? `<a class="btn btn-secondary" href="#/nouveau">${icon('plus')}Nouveau dossier</a>` : '' })}
      <section class="card reveal" style="--i:1">${ui.kpis([
        { label: 'Actions de mon ressort', count: allowed.length, note: 'dossiers visibles avec ce profil' },
        { label: 'Urgentes (plus de 15 jours)', count: allowed.filter(i => i.urgent >= 15).length, note: 'délais à surveiller' },
        { label: 'Compléments en attente', count: allowed.filter(i => i.key === 'relancer').length, note: 'réponses du demandeur attendues' },
        { label: 'Décisions attendues', count: allowed.filter(i => i.key === 'decider').length, note: 'autorités destinataires' }
      ])}</section>
      <section class="card reveal mt" style="--i:2">
        ${ui.toolbar({ search: { id: 'if-q', label: 'Rechercher', placeholder: 'Référence, organisme…', value: IF.q },
          selects: [{ id: 'if-sort', label: 'Trier par', value: IF.sort, options: [{ value: 'urgence', label: 'Urgence (ancienneté de l’action)' }, { value: 'depot', label: 'Date de dépôt' }, { value: 'ref', label: 'Référence' }] }] })}
        ${ui.filterBar(`<div class="chip-row" id="if-chips" role="group" aria-label="Filtrer par action">${ui.chips([{ key: 'all', label: 'Toutes les actions', n: counts.all }, ...Object.entries(STEP_LABEL).filter(([k]) => counts[k]).map(([k, label]) => ({ key: k, label, n: counts[k], tone: stepTone(k) }))], IF.step, { attr: 'data-s' }).replace(/^<div class="chip-row"[^>]*>|<\/div>$/g, '')}</div>`, '<span id="if-count" aria-live="polite"></span>')}
        <div class="table-wrap"><table class="data-table responsive" id="if-table">
          <caption class="sr-only">File d’instruction</caption>
          <thead><tr><th scope="col">Dossier</th><th scope="col">Demandeur</th><th scope="col">Action attendue</th><th scope="col">Depuis</th><th scope="col">Étape</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
          <tbody></tbody></table><div id="if-empty"></div></div>
      </section>`;
    const draw = () => {
      const q = norm(IF.q.trim());
      let list = allowed.filter(i => !q || norm(`${i.d.ref} ${GO.org(i.d.org).name} ${i.label}`).includes(q));
      if (IF.step !== 'all') list = list.filter(i => i.key === IF.step);
      const sorters = { urgence: (a, b) => b.urgent - a.urgent || a.d.ref.localeCompare(b.d.ref), depot: (a, b) => a.d.depot.localeCompare(b.d.depot), ref: (a, b) => a.d.ref.localeCompare(b.d.ref) };
      list = list.sort(sorters[IF.sort]);
      $('#if-count').innerHTML = `<strong>${list.length}</strong> ${list.length > 1 ? 'dossiers affichés' : 'dossier affiché'}`;
      $('#if-chips').innerHTML = ui.chips([{ key: 'all', label: 'Toutes les actions', n: counts.all }, ...Object.entries(STEP_LABEL).filter(([k]) => counts[k]).map(([k, label]) => ({ key: k, label, n: counts[k], tone: stepTone(k) }))], IF.step, { attr: 'data-s' }).replace(/^<div class="chip-row"[^>]*>|<\/div>$/g, '');
      $('#if-table tbody').innerHTML = list.map((i, n) => {
        const o = GO.org(i.d.org), la = GO.lastActivity(i.d);
        return `<tr class="is-clickable row-in" style="--i:${Math.min(n, 12)}" data-ref="${i.d.ref}">
          <td class="td-head" data-label="Dossier"><span class="ref">${esc(i.d.ref)}</span><br>${GO.statusBadge(i.d.status)}</td>
          <td class="td-wide" data-label="Demandeur"><div class="cell-org"><strong>${esc(o.name)}</strong><span>${esc(o.city)} · ${plural(i.d.recipients.length, 'récipiendaire', 'récipiendaires')}</span></div></td>
          <td class="td-wide" data-label="Action attendue">${GO.badge(STEP_LABEL[i.key], i.tone)}<br><span style="font-size:13px">${esc(i.label)}</span></td>
          <td data-label="Depuis" class="tnum nowrap">${i.urgent ? plural(i.urgent, 'jour', 'jours') : 'aujourd’hui'}<br><span class="muted" style="font-size:11.5px">${esc(relDay(la.date))}</span></td>
          <td data-label="Étape">${GO.stepMini(i.d)}</td>
          <td class="cell-actions"><button class="btn btn-secondary btn-sm" type="button" data-open="${i.d.ref}">Traiter</button></td>
        </tr>`;
      }).join('');
      $('#if-table').hidden = !list.length;
      $('#if-empty').innerHTML = list.length ? '' : GO.empty('check-circle', 'Aucune action en attente', 'Tous les dossiers visibles sont à jour pour votre profil.');
      $$('#if-table [data-open]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); location.hash = '#/dossiers/' + b.dataset.open; }));
      $$('#if-table tr[data-ref]').forEach(tr => tr.addEventListener('click', e => { if (!e.target.closest('a,button')) location.hash = '#/dossiers/' + tr.dataset.ref; }));
    };
    $('#if-q', main).addEventListener('input', GO.debounce(e => { IF.q = e.target.value; draw(); }, 150));
    $('#if-sort', main).addEventListener('change', e => { IF.sort = e.target.value; draw(); });
    $('#if-chips', main).addEventListener('click', e => { const c = e.target.closest('[data-s]'); if (!c) return; IF.step = c.dataset.s; draw(); });
    draw();
  }
  const stepTone = k => ({ relancer: 'yellow', verif_recu: 'yellow', anomalie: 'red', recours: 'red', programmer: 'green', valider: 'green', remise: 'green' }[k] || 'blue');
  // Actions réellement du ressort du profil connecté
  function relevant(key) {
    const map = {
      ouvrir: 'instruct', verifier: 'verify', note: 'note', visa: 'visa', transmettre: 'transmit', decider: 'decide',
      relancer: ['relance', 'answer'], recette: 'recette', verif_recu: ['paiement_verif', 'deposer_recu'], programmer: 'propose',
      valider: ['valider_ceremonie', 'coordinate'], remise: 'remise', recours: ['recours', 'answer'], anomalie: ['instruct', 'control']
    }[key];
    if (!map) return true;
    return Array.isArray(map) ? map.some(k => GO.can(k)) : GO.can(map);
  }
  GO.views.instruction = { render: renderInstruction };

  /* ======================= SUPERVISION DU SERVICE ======================= */
  function renderSupervision(main) {
    const list = GO.myDossiers();
    const agents = [...new Set(list.map(d => d.agent).filter(Boolean))];
    const pendingVisa = list.filter(d => GO.docsOf(d.ref).some(x => x.state === 'attente_visa'));
    const toTransmit = list.filter(d => GO.docsOf(d.ref).some(x => x.kind === 'transmission' && x.state === 'vise'));
    const lateComplements = GO.myComplements().filter(c => c.state !== 'satisfait' && ageDays(c.requested) >= 15);
    const orders = GO.myReceiptOrders().filter(o => o.state === 'emis' || o.state === 'recu_depose');
    const ceremonies = GO.myCers().filter(c => c.state !== 'termine');
    const anomalies = GO.myControls().filter(c => c.state === 'anomalie' || c.state === 'correction');
    const workload = agents.map(a => {
      const mine = list.filter(d => d.agent === a);
      return { agent: a, total: mine.length, en_cours: mine.filter(d => d.status === 'en_cours').length, complement: mine.filter(d => d.status === 'complement').length, transmis: mine.filter(d => d.status === 'transmis').length, approuve: mine.filter(d => d.status === 'approuve').length };
    }).sort((a, b) => b.total - a.total);
    main.innerHTML = `
      ${ui.head({ eyebrow: 'Pilotage', title: 'Supervision du service',
        sub: 'Charge du service, validations en attente, circuits à risque et suites financières et matérielles des dossiers.',
        actions: `<a class="btn btn-secondary" href="#/statistiques">${icon('chart')}Statistiques</a><a class="btn btn-primary" href="#/instruction">${icon('list')}File d’instruction</a>` })}
      <section class="card reveal" style="--i:1">${ui.kpis([
        { label: 'Dossiers suivis', count: list.length, note: `${plural(agents.length, 'agent instructeur', 'agents instructeurs')}` },
        { label: 'Notes à viser', count: pendingVisa.length, note: 'visa interne du chef de service' },
        { label: 'À transmettre aux autorités', count: toTransmit.length, note: 'notes visées' },
        { label: 'Compléments en retard', count: lateComplements.length, note: 'plus de 15 jours' },
        { label: 'Suites financières', count: orders.length, note: 'ordres de recette en cours' },
        { label: 'Cérémonies à suivre', count: ceremonies.length, note: 'propositions et confirmations' }
      ])}</section>
      <div class="grid grid-main mt">
        ${ui.card({ i: 2, icon: 'stamp', title: 'Validations et transmissions en attente', sub: 'Ce qui bloque le circuit aujourd’hui',
          body: (pendingVisa.length || toTransmit.length || anomalies.length) ? `<ul class="list-plain">
            ${pendingVisa.map(d => `<li><span style="min-width:0"><span class="ref">${esc(d.ref)}</span>
              <strong style="display:block;font-size:13.5px;color:var(--navy-900)">Note de transmission à viser</strong>
              <span class="muted" style="font-size:12px">${esc(GO.org(d.org).short)} · ${esc(GO.docsOf(d.ref).find(x => x.state === 'attente_visa').title)}</span></span>
              <a class="btn btn-secondary btn-xs" href="#/courriers/${GO.docsOf(d.ref).find(x => x.state === 'attente_visa').id}">Viser</a></li>`).join('')}
            ${toTransmit.map(d => `<li><span style="min-width:0"><span class="ref">${esc(d.ref)}</span>
              <strong style="display:block;font-size:13.5px;color:var(--navy-900)">Transmettre à ${esc(GO.authority(d.authority).short)}</strong>
              <span class="muted" style="font-size:12px">${esc(GO.org(d.org).short)} — note visée</span></span>
              <a class="btn btn-secondary btn-xs" href="#/dossiers/${d.ref}">Transmettre</a></li>`).join('')}
            ${anomalies.map(c => `<li><span style="min-width:0"><span class="ref">${esc(c.id)}</span>
              <strong style="display:block;font-size:13.5px;color:var(--navy-900)">Anomalies de contrôle à traiter</strong>
              <span class="muted" style="font-size:12px">${esc(c.dossier)} · ${plural(c.findings.length, 'observation', 'observations')}</span></span>
              <a class="btn btn-secondary btn-xs" href="#/controle?dossier=${c.dossier}">Traiter</a></li>`).join('')}
          </ul>` : GO.empty('check-circle', 'Aucun blocage', 'Aucune validation ni transmission n’est en attente.') })}
        ${ui.card({ i: 3, icon: 'cash', title: 'Suites financières et matérielles', sub: 'Ordres de recette et remises',
          body: orders.length || GO.myRemises().length ? `<ul class="list-plain">
            ${orders.slice(0, 4).map(o => `<li><span style="min-width:0"><span class="ref">${esc(o.id)}</span>
              <strong style="display:block;font-size:13.5px;color:var(--navy-900)">${esc(o.dossier)} — ${esc(o.amount)}</strong>
              <span class="muted" style="font-size:12px">échéance ${fmtDate(o.due, 'short')}</span></span>${GO.dictBadge(D.recetteStates, o.state)}</li>`).join('')}
            ${GO.myRemises().slice(0, 3).map(r => `<li><span style="min-width:0"><span class="ref">${esc(r.id)}</span>
              <strong style="display:block;font-size:13.5px;color:var(--navy-900)">Remise — ${esc(r.dossier)}</strong>
              <span class="muted" style="font-size:12px">${esc(r.mode)} · ${fmtDate(r.date, 'short')}</span></span>${GO.dictBadge(D.remiseStates, r.state)}</li>`).join('')}
          </ul>` : GO.empty('cash', 'Aucune suite financière', 'Les ordres de recette et les remises apparaîtront ici.') })}
      </div>
      ${ui.card({ i: 4, cls: 'mt', icon: 'users', title: 'Charge par agent instructeur', sub: 'Dossiers visibles avec le profil de supervision',
        body: workload.length ? `<div class="table-wrap"><table class="data-table responsive"><thead><tr><th scope="col">Agent</th><th scope="col" class="num">Dossiers</th><th scope="col" class="num">En instruction</th><th scope="col" class="num">Complément</th><th scope="col" class="num">Transmis</th><th scope="col" class="num">Approuvés</th></tr></thead><tbody>
          ${workload.map(w => `<tr><td data-label="Agent">${esc(w.agent)}</td><td data-label="Dossiers" class="num">${w.total}</td><td data-label="En instruction" class="num">${w.en_cours}</td><td data-label="Complément" class="num">${w.complement}</td><td data-label="Transmis" class="num">${w.transmis}</td><td data-label="Approuvés" class="num">${w.approuve}</td></tr>`).join('')}
        </tbody></table></div>` : GO.empty('users', 'Aucun agent désigné', 'Les dossiers prennent un agent instructeur lors de l’ouverture de l’instruction.') })}
      ${ui.card({ i: 5, cls: 'mt', icon: 'calendar', title: 'Cérémonies du service', sub: 'Propositions, négociations et confirmations en cours',
        body: ceremonies.length ? `<div class="table-wrap"><table class="data-table responsive"><thead><tr><th scope="col">Cérémonie</th><th scope="col">Dossier</th><th scope="col">Date</th><th scope="col">Lieu</th><th scope="col">État</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>
          ${ceremonies.sort((a, b) => a.date.localeCompare(b.date)).map(c => { const d = GO.getDossier(c.dossier); return `<tr>
            <td data-label="Cérémonie"><span class="ref">${esc(c.id)}</span></td>
            <td data-label="Dossier"><span class="ref">${esc(c.dossier)}</span><br><span class="muted" style="font-size:12px">${esc(GO.org(d.org).short)}</span></td>
            <td data-label="Date" class="tnum nowrap">${fmtDate(c.date)}<br><span class="muted" style="font-size:11.5px">${esc(c.time.replace(':', ' h '))}</span></td>
            <td data-label="Lieu">${esc(GO.venue(c.venue).name)}</td>
            <td data-label="État">${GO.cerBadge(c.state)}</td>
            <td class="cell-actions"><a class="btn btn-secondary btn-sm" href="#/ceremonies/${c.id}">Ouvrir</a></td></tr>`; }).join('')}
        </tbody></table></div>` : GO.empty('calendar', 'Aucune cérémonie en cours', 'Les propositions de cérémonie apparaîtront ici.') })}
      <section class="card reveal mt" style="--i:6" aria-labelledby="sv-t">
        <div class="card-head"><div><h2 class="card-title" id="sv-t">${icon('flag')}Dossiers les plus anciens sans décision</h2><p class="card-sub">Ancienneté du dépôt pour les dossiers non décidés</p></div></div>
        ${(() => {
          const open = list.filter(d => ['recu', 'en_cours', 'complement', 'transmis'].includes(d.status)).sort((a, b) => a.depot.localeCompare(b.depot)).slice(0, 6);
          return open.length ? `<div class="table-wrap"><table class="data-table responsive"><thead><tr><th scope="col">Dossier</th><th scope="col">Demandeur</th><th scope="col">Dépôt</th><th scope="col">Ancienneté</th><th scope="col">Statut</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>
            ${open.map(d => `<tr><td data-label="Dossier"><span class="ref">${esc(d.ref)}</span></td>
              <td data-label="Demandeur">${esc(GO.org(d.org).short)}</td>
              <td data-label="Dépôt" class="tnum nowrap">${fmtDate(d.depot, 'short')}</td>
              <td data-label="Ancienneté" class="tnum nowrap">${plural(ageDays(d.depot), 'jour', 'jours')}</td>
              <td data-label="Statut">${GO.statusBadge(d.status)}</td>
              <td class="cell-actions"><a class="btn btn-secondary btn-sm" href="#/dossiers/${d.ref}">Ouvrir</a></td></tr>`).join('')}
          </tbody></table></div>` : GO.empty('check-circle', 'Aucun dossier en attente', 'Tous les dossiers ont fait l’objet d’une décision.');
        })()}
      </section>`;
  }
  GO.views.supervision = { render: renderSupervision };

  /* ======================= COMPLÉMENTS ET RELANCES ======================= */
  const KF = { state: 'all', q: '' };
  function renderComplements(main) {
    const service = GO.isFamily('service');
    const list = GO.myComplements();
    const relances = GO.myRelances();
    main.innerHTML = `
      ${ui.head({ eyebrow: 'Instruction', title: 'Compléments et relances',
        sub: GO.external() ? 'Éléments demandés par le Service des Distinctions et réponses à transmettre.' : 'Demandes de complément en cours, échéances et relances adressées aux demandeurs.',
        actions: GO.can('note') ? `<a class="btn btn-secondary" href="#/pieces">${icon('paperclip')}DTS et pièces</a>` : '' })}
      <section class="card reveal" style="--i:1">${ui.kpis([
        { label: 'Compléments en cours', count: list.filter(c => c.state !== 'satisfait').length, note: 'toutes périodes' },
        { label: 'En retard', count: list.filter(c => c.state !== 'satisfait' && ageDays(c.requested) >= 15).length, note: 'plus de 15 jours sans réponse' },
        { label: 'Relancés', count: list.filter(c => c.relances).length, note: plural(relances.length, 'relance envoyée', 'relances envoyées') },
        { label: 'Satisfaits', count: list.filter(c => c.state === 'satisfait').length, note: 'pièces reçues' }
      ])}</section>
      <section class="card reveal mt" style="--i:2">
        ${ui.toolbar({ search: { id: 'kf-q', label: 'Rechercher', placeholder: 'Dossier, élément demandé…', value: KF.q },
          selects: [{ id: 'kf-state', label: 'État', value: KF.state, options: [{ value: 'all', label: 'Tous les états' }, { value: 'attendu', label: 'En attente de réponse' }, { value: 'relance', label: 'Relancé' }, { value: 'satisfait', label: 'Satisfait' }] }] })}
        <div class="table-wrap"><table class="data-table responsive" id="kf-table">
          <caption class="sr-only">Demandes de complément</caption>
          <thead><tr><th scope="col">Référence</th><th scope="col">Dossier</th><th scope="col">Demandé le</th><th scope="col">Échéance</th><th scope="col">Éléments attendus</th><th scope="col">Relances</th><th scope="col">État</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
          <tbody></tbody></table><div id="kf-empty"></div></div>
      </section>
      ${relances.length ? ui.card({ i: 3, cls: 'mt', icon: 'refresh', title: 'Relances adressées', sub: 'Historique des relances de complément',
        body: `<div class="table-wrap"><table class="data-table responsive"><thead><tr><th scope="col">Référence</th><th scope="col">Dossier</th><th scope="col">Date</th><th scope="col">De → À</th><th scope="col">Motif</th></tr></thead><tbody>
          ${relances.map(r => `<tr><td data-label="Référence"><span class="ref">${esc(r.id)}</span></td><td data-label="Dossier"><span class="ref">${esc(r.dossier)}</span></td>
            <td data-label="Date" class="tnum nowrap">${fmtDate(r.date, 'short')} ${esc(r.time || '')}</td>
            <td data-label="De → À">${esc(r.from)}<br><span class="muted">→ ${esc(r.to)}</span></td>
            <td data-label="Motif">${esc(r.note)}</td></tr>`).join('')}</tbody></table></div>` }) : ''}`;
    const draw = () => {
      const q = norm(KF.q.trim());
      const rows = list.filter(c => (!q || norm(`${c.dossier} ${c.items}`).includes(q)) && (KF.state === 'all' || c.state === KF.state))
        .sort((a, b) => b.requested.localeCompare(a.requested));
      $('#kf-table tbody').innerHTML = rows.map((c, i) => {
        const d = GO.getDossier(c.dossier), late = c.state !== 'satisfait' && ageDays(c.requested) >= 15;
        return `<tr class="row-in" style="--i:${i}" data-ref="${c.dossier}">
          <td class="td-head" data-label="Référence"><span class="ref">${esc(c.id)}</span>${late ? ' ' + GO.badge('en retard', 'red') : ''}</td>
          <td data-label="Dossier"><span class="ref">${esc(c.dossier)}</span><br><span class="muted" style="font-size:12px">${esc(GO.org(d.org).short)}</span></td>
          <td data-label="Demandé le" class="tnum nowrap">${fmtDate(c.requested, 'short')}<br><span class="muted" style="font-size:11.5px">${plural(ageDays(c.requested), 'jour', 'jours')}</span></td>
          <td data-label="Échéance" class="tnum nowrap">${fmtDate(c.due, 'short')}</td>
          <td class="td-wide" data-label="Éléments attendus">${esc(c.items)}</td>
          <td data-label="Relances" class="tnum">${c.relances || 0}</td>
          <td data-label="État">${GO.badge(c.state === 'satisfait' ? 'Satisfait' : c.state === 'relance' ? 'Relancé' : 'En attente', c.state === 'satisfait' ? 'green' : c.state === 'relance' ? 'yellow' : 'blue')}</td>
          <td class="cell-actions">${GO.can('relance') && c.state !== 'satisfait' ? `<button class="btn btn-secondary btn-sm" type="button" data-rel="${c.dossier}">Relancer</button>` : ''}
            <a class="btn btn-secondary btn-sm" href="#/dossiers/${c.dossier}">Dossier</a></td>
        </tr>`;
      }).join('');
      $('#kf-table').hidden = !rows.length;
      $('#kf-empty').innerHTML = rows.length ? '' : GO.empty('paperclip', 'Aucun complément', 'Aucune demande de complément ne correspond à ces critères.');
      $$('#kf-table [data-rel]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const d = GO.getDossier(b.dataset.rel); GO.dossierActions.complement && null; location.hash = '#/dossiers/' + b.dataset.rel; setTimeout(() => { const btn = $('.drawer [data-act="relance"]'); if (btn) btn.click(); else GO.dossierActions.relance(d); }, 380); }));
      $$('#kf-table tr[data-ref]').forEach(tr => tr.addEventListener('click', e => { if (!e.target.closest('a,button')) location.hash = '#/dossiers/' + tr.dataset.ref; }));
    };
    $('#kf-q', main).addEventListener('input', GO.debounce(e => { KF.q = e.target.value; draw(); }, 150));
    $('#kf-state', main).addEventListener('change', e => { KF.state = e.target.value; draw(); });
    draw();
    void service;
  }
  GO.views.complements = { render: renderComplements };

  /* ======================= CONTRÔLES ET ANOMALIES ======================= */
  const TF = { state: 'all', q: '' };
  function renderControle(main, r) {
    const list = GO.myControls().slice().sort((a, b) => b.date.localeCompare(a.date));
    const scope = r.params.get('dossier');
    main.innerHTML = `
      ${ui.head({ eyebrow: 'Contrôle', title: 'Contrôles et anomalies',
        sub: 'Vérification documentaire des dossiers : pièces, cohérence des dates d’entrée et des déclarations de travail et de salaire. Aucune décision d’attribution n’est prise ici.',
        actions: `<button class="btn btn-secondary" type="button" id="tf-new">${icon('plus')}Nouveau contrôle</button>` })}
      <section class="card reveal" style="--i:1">${ui.kpis([
        { label: 'Contrôles menés', count: list.length, note: 'depuis l’ouverture du registre' },
        { label: 'Conformes', count: list.filter(c => c.state === 'conforme').length, note: 'sans observation' },
        { label: 'Anomalies ouvertes', count: list.filter(c => c.state === 'anomalie' || c.state === 'correction').length, note: 'suites à donner' },
        { label: 'Dossiers contrôlés', count: [...new Set(list.map(c => c.dossier))].length, note: 'sur les dossiers visibles' }
      ])}</section>
      <section class="card reveal mt" style="--i:2">
        ${ui.toolbar({ search: { id: 'tf-q', label: 'Rechercher', placeholder: 'Dossier, observation…', value: TF.q },
          selects: [{ id: 'tf-state', label: 'Conclusion', value: TF.state, options: [{ value: 'all', label: 'Toutes les conclusions' }, ...Object.entries(D.controlStates).map(([k, v]) => ({ value: k, label: v.label }))] }] })}
        <div id="tf-list"></div>
      </section>
      ${ui.card({ i: 3, cls: 'mt', icon: 'folder', title: 'Dossiers à contrôler', sub: 'Dossiers en instruction ou en attente de décision, sans contrôle récent',
        body: (() => {
          const todo = GO.myDossiers().filter(d => ['en_cours', 'transmis', 'complement'].includes(d.status)).filter(d => {
            const c = GO.controlOf(d.ref);
            return !c || ageDays(c.date) > 30;
          }).slice(0, 6);
          return todo.length ? `<div class="table-wrap"><table class="data-table responsive"><thead><tr><th scope="col">Dossier</th><th scope="col">Demandeur</th><th scope="col">Statut</th><th scope="col">Dernier contrôle</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>
            ${todo.map(d => { const c = GO.controlOf(d.ref); return `<tr><td data-label="Dossier"><span class="ref">${esc(d.ref)}</span></td>
              <td data-label="Demandeur">${esc(GO.org(d.org).short)}</td><td data-label="Statut">${GO.statusBadge(d.status)}</td>
              <td data-label="Dernier contrôle">${c ? `${fmtDate(c.date, 'short')} — ${esc(D.controlStates[c.state].label)}` : '<span class="muted">aucun</span>'}</td>
              <td class="cell-actions"><button class="btn btn-secondary btn-sm" type="button" data-ctl="${d.ref}">Contrôler</button></td></tr>`; }).join('')}
          </tbody></table></div>` : GO.empty('check-circle', 'Aucun dossier à contrôler', 'Tous les dossiers en cours ont fait l’objet d’un contrôle récent.');
        })() })}
    `;
    const draw = () => {
      const q = norm(TF.q.trim());
      const rows = list.filter(c => (!q || norm(`${c.dossier} ${c.scope} ${c.note} ${(c.findings || []).map(f => f.label).join(' ')}`).includes(q)) && (TF.state === 'all' || c.state === TF.state) && (!scope || c.dossier === scope));
      $('#tf-list').innerHTML = rows.length ? rows.map(c => {
        const d = GO.getDossier(c.dossier);
        return `<article class="obs" style="margin:0 18px 12px">
          <div class="obs-meta"><span class="ref">${esc(c.id)}</span> · ${esc(c.dossier)} · ${esc(GO.org(d.org).short)} · ${fmtDate(c.date)} · ${esc(c.inspector)}</div>
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
            <strong style="color:var(--navy-900)">${esc(c.scope)}</strong>${GO.dictBadge(D.controlStates, c.state)}</div>
          ${(c.findings || []).length ? `<ul class="list-plain mt" style="border:1px solid var(--line);border-radius:8px">${c.findings.map(f => `<li style="padding:8px 12px"><span>${esc(f.code)} — ${esc(f.label)}</span>${GO.badge(f.severity, f.severity === 'majeure' ? 'red' : 'yellow')}</li>`).join('')}</ul>` : ''}
          <p class="muted mt" style="font-size:12.5px">${esc(c.note || '')}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
            <a class="btn btn-secondary btn-xs" href="#/dossiers/${c.dossier}">${icon('folder', 'ic-sm')}Ouvrir le dossier</a>
            ${GO.can('control') ? `<button class="btn btn-secondary btn-xs" type="button" data-ctl="${c.dossier}">${icon('shield', 'ic-sm')}Compléter le contrôle</button>` : ''}
            ${GO.can('flag') && c.state !== 'anomalie' ? `<button class="btn btn-danger btn-xs" type="button" data-flag="${c.id}">${icon('alert-triangle', 'ic-sm')}Signaler une anomalie</button>` : ''}
          </div></article>`;
      }).join('') : `<div style="padding:8px 18px 18px">${GO.empty('shield', 'Aucun contrôle', 'Aucun contrôle ne correspond à ces critères.')}</div>`;
      $$('#tf-list [data-ctl]').forEach(b => b.addEventListener('click', () => { const d = GO.getDossier(b.dataset.ctl); location.hash = '#/dossiers/' + d.ref; setTimeout(() => GO.dossierActions.control(d), 380); }));
      $$('#tf-list [data-flag]').forEach(b => b.addEventListener('click', () => flagAnomaly(GO.S.controls.find(c => c.id === b.dataset.flag), draw)));
    };
    $('#tf-q', main).addEventListener('input', GO.debounce(e => { TF.q = e.target.value; draw(); }, 150));
    $('#tf-state', main).addEventListener('change', e => { TF.state = e.target.value; draw(); });
    $('#tf-new').addEventListener('click', () => {
      const d = GO.myDossiers().find(x => ['en_cours', 'transmis', 'complement'].includes(x.status));
      if (!d) { GO.toast('info', 'Aucun dossier disponible', 'Aucun dossier en cours ne peut faire l’objet d’un contrôle.'); return; }
      location.hash = '#/dossiers/' + d.ref;
      setTimeout(() => GO.dossierActions.control(d), 380);
    });
    $$('[data-ctl]', main).forEach(b => b.addEventListener('click', () => { const d = GO.getDossier(b.dataset.ctl); location.hash = '#/dossiers/' + d.ref; setTimeout(() => GO.dossierActions.control(d), 380); }));
    draw();
  }
  function flagAnomaly(ctl, redraw) {
    if (!ctl) return;
    GO.formModal({
      title: 'Signaler une anomalie', icon: 'alert-triangle', tone: 'red',
      intro: `<p>Dossier <strong>${esc(ctl.dossier)}</strong> — contrôle ${esc(ctl.id)}. L’anomalie est versée au dossier et portée à la connaissance du service instructeur.</p>`,
      fields: [
        { id: 'label', label: 'Anomalie constatée', type: 'text', required: true, placeholder: 'Exemple : date d’entrée différente de l’attestation produite', validate: v => v.length >= 10 ? '' : 'Décrivez l’anomalie (10 caractères minimum).' },
        { id: 'severity', label: 'Gravité', type: 'select', options: [{ value: 'majeure', label: 'Majeure — instruction suspendue' }, { value: 'mineure', label: 'Mineure — correction demandée' }] },
        { id: 'note', label: 'Observation', type: 'textarea', rows: 2, required: true, validate: v => v.length >= 5 ? '' : 'Consignez votre observation.' }
      ],
      submit: 'Signaler l’anomalie', iconSubmit: 'alert-triangle',
      run: v => {
        const d = GO.getDossier(ctl.dossier);
        ctl.state = 'anomalie';
        ctl.findings.push({ code: 'AN-' + String(ctl.findings.length + 1).padStart(2, '0'), label: v.label, severity: v.severity });
        ctl.note = v.note;
        ctl.findings.push = ctl.findings.push.bind(ctl.findings);
        GO.addHistory(d, 'instruction', 'Anomalie signalée par l’inspection du travail', GO.actorName(), { detail: v.label });
        GO.notify({ type: 'controle', aud: 'service', ref: d.ref, ref2: ctl.id, title: 'Anomalie signalée', msg: `${ctl.dossier} — ${v.label}` });
        GO.commit(); GO.refreshDossier(d, false);
        if (redraw) redraw();
        GO.toast('success', 'Anomalie signalée', esc(ctl.dossier));
      }
    });
  }
  GO.views.controle = { render: renderControle };

  /* ======================= STATISTIQUES ======================= */
  const SF = { period: 'year', sector: 'all' };
  const SPERIODS = { year: 'Année 2026 (à date)', T1: '1ᵉʳ trimestre 2026', T2: '2ᵉ trimestre 2026', T3: '3ᵉ trimestre 2026', T4: '4ᵉ trimestre 2026 (à date)' };
  const STATUS_COLORS = { recu: '#8a97a8', en_cours: '#3a75c4', complement: '#e9bf10', transmis: '#16305a', approuve: '#009e60', refuse: '#b4442f' };
  const MEDAL_COLORS = { bronze: '#b07a3f', argent: '#9aa5b4', or: '#e7b416' };

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
  const decisionDate = d => { const h = d.history.find(x => x.kind === 'decision'); return h && h.date; };

  function renderStats(main) {
    const sectors = [...new Set(GO.myDossiers().map(d => GO.org(d.org).sector))].sort();
    main.innerHTML = `
      ${ui.head({ eyebrow: 'Pilotage', title: 'Statistiques',
        sub: 'Indicateurs calculés à partir des dossiers enregistrés dans GAB-ORIENT. Les filtres s’appliquent à la date de dépôt.',
        actions: `<div class="field" style="min-width:200px"><label class="mini-label" for="st-period">Période</label><select class="select" id="st-period">${Object.entries(SPERIODS).map(([k, v]) => `<option value="${k}" ${k === SF.period ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <div class="field" style="min-width:200px"><label class="mini-label" for="st-sector">Secteur</label><select class="select" id="st-sector"><option value="all">Tous les secteurs</option>${sectors.map(s => `<option ${s === SF.sector ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>` })}
      <section class="card reveal" style="--i:1"><div class="kpi-strip" id="st-kpis"></div></section>
      ${ui.card({ i: 2, cls: 'mt', icon: 'chart', title: 'Déclarations de travail et de salaire', sub: 'Avancement de la vérification des DTS',
        body: (() => {
          const dts = GO.myDts();
          const counts = Object.entries(D.dtsStates).map(([k, v]) => ({ label: v.label, value: dts.filter(t => t.state === k).length, color: k === 'verifie' ? '#009e60' : k === 'anomalie' ? '#b4442f' : k === 'saisi' ? '#3a75c4' : '#e9bf10' }));
          return `<div class="grid grid-2" style="align-items:center">
            <div class="chart" id="ch-dts"></div>
            <div class="mini-table">${tbl(['État de la DTS', 'Nombre'], counts.map(x => [x.label, x.value]))}</div></div>`;
        })() })}
      <div class="grid grid-2 mt">
        ${chartCard('dep', 'Dossiers déposés par mois', 'Volume mensuel des dépôts', 3)}
        ${chartCard('cum', 'Récipiendaires proposés — cumul', 'Évolution cumulée sur la période', 4)}
        ${chartCard('sta', 'Répartition des statuts', 'Situation actuelle des dossiers déposés sur la période', 5)}
        ${chartCard('med', 'Échelons proposés', 'Nombre de récipiendaires par échelon de médaille', 6)}
        ${chartCard('sec', 'Dossiers par secteur', 'Comparaison des secteurs demandeurs', 7)}
        ${chartCard('fun', 'Avancement dans le circuit', 'Part des dossiers ayant atteint chaque étape', 8)}
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

    const reached = D.steps.map((s, i) => ({ s, n: list.filter(d => { const stt = GO.stepInfo(d); return stt.cur > i || (stt.cur === i && stt.stop); }).length }));
    $('#ch-fun', main).innerHTML = list.length ? `<ul class="funnel">${reached.map((x, i) => { const p = Math.round(x.n / list.length * 100); return `<li><span>${esc(x.s)}</span><span class="bar-track" data-tip="<strong>${esc(x.s)}</strong>${x.n} dossier(s) ont franchi cette étape"><span class="bar-fill" style="--i:${i};background:${i === 5 ? 'var(--gold-1)' : 'var(--green-600)'}" data-w="${p}"></span></span><span>${x.n} · ${p} %</span></li>`; }).join('')}</ul>`
      : GO.empty('chart', 'Aucune donnée', 'Aucun dossier déposé sur cette période.');
    requestAnimationFrame(() => requestAnimationFrame(() => $$('#ch-fun .bar-fill', main).forEach(b => { b.style.width = b.dataset.w + '%'; })));
    $('#tbl-fun', main).innerHTML = tbl(['Étape franchie', 'Dossiers', 'Part'], reached.map(x => [x.s, x.n, list.length ? Math.round(x.n / list.length * 100) + ' %' : '—']));
    const dtsHost = $('#ch-dts', main);
    if (dtsHost) {
      const dts = GO.myDts();
      const items = Object.entries(D.dtsStates).map(([k, v]) => ({ label: v.label, value: dts.filter(t => t.state === k).length, color: k === 'verifie' ? '#009e60' : k === 'anomalie' ? '#b4442f' : k === 'saisi' ? '#3a75c4' : '#e9bf10' }));
      if (dts.length) GOCharts.mount(dtsHost, 'donut', { items, centerLabel: 'DTS', aria: 'Répartition des DTS par état' });
      else dtsHost.innerHTML = GO.empty('paperclip', 'Aucune DTS', 'Aucune déclaration de travail et de salaire n’est enregistrée pour ces dossiers.');
    }
  }
  GO.views.statistiques = { render: renderStats };
})(window.GO);
