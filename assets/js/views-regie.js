/* ==========================================================================
   GAB-ORIENT — Régie des médailles
   Vues : « Ordres de recette et reçus » (finances), « Stock des médailles »,
   « Remises des médailles » et « Retraits sans cérémonie ».
   Le stock physique ne diminue qu'à l'enregistrement d'une remise effective.
   ========================================================================== */
(function (GO) {
  'use strict';
  const { $, $$, esc, icon, D, fmtDate, relDay, plural, ageDays, norm } = GO;
  const ui = GO.ui;

  const digits = s => +(String(s).replace(/[^\d]/g, '') || 0);
  const FIELD_LABEL = { available: 'Stock physique', reserved: 'Réservation' };

  /* ======================= ORDRES DE RECETTE ET REÇUS ======================= */
  const RF = { q: '', state: 'all', sort: 'due' };
  function renderRecettes(main) {
    const list = GO.myReceiptOrders();
    const recOf = o => GO.receiptOf(o.dossier);
    const lateOf = o => o.state === 'emis' && o.due < GO.REF_ISO;
    const count = s => list.filter(o => o.state === s).length;
    main.innerHTML = `
      ${ui.head({ eyebrow: 'Régie et finances', title: 'Ordres de recette et reçus',
        sub: 'Ordres de recette émis, reçus de paiement déposés par les demandeurs et vérification de leur conformité.',
        actions: GO.can('recette') ? '' : `<a class="btn btn-secondary" href="#/remises">${icon('medal')}Remises des médailles</a>` })}
      <section class="card reveal" style="--i:1">${ui.kpis([
        { label: 'Ordres de recette', count: list.length, note: 'dossiers approuvés' },
        { label: 'Paiement attendu', count: count('emis'), note: `${list.filter(lateOf).length} hors délai` },
        { label: 'Reçus à vérifier', count: count('recu_depose'), note: 'déposés par les demandeurs' },
        { label: 'Paiements vérifiés', count: count('verifie'), note: 'reçus conformes' },
        { label: 'Reçus rejetés', count: count('rejete'), note: 'à régulariser' }
      ])}</section>
      <div class="alert alert-info reveal mt" style="--i:2">${icon('info')}<div>${D.config.payment.note}</div></div>
      ${GO.can('paiement_verif') && list.some(o => o.state === 'recu_depose') ? ui.card({ i: 3, cls: 'mt', icon: 'shield', title: 'Reçus en attente de vérification', sub: 'Contrôle du montant, de la référence et de la quittance',
        body: `<ul class="list-plain">${list.filter(o => o.state === 'recu_depose').map(o => { const d = GO.getDossier(o.dossier), r = recOf(o); return `<li>
          <span style="min-width:0"><span class="ref">${esc(o.id)}</span>
            <strong style="display:block;font-size:13.5px;color:var(--navy-900)">${esc(GO.org(d.org).name)} — ${esc(o.amount)}</strong>
            <span class="muted" style="font-size:12px">Reçu ${esc(r.id)} déposé le ${esc(fmtDate(r.date, 'short'))}${r.reference ? ' · ' + esc(r.reference) : ''}</span></span>
          <span style="display:flex;gap:6px;flex-wrap:wrap">${r.file ? `<button class="btn btn-ghost btn-xs" type="button" data-rec-file="${o.dossier}">${icon('file', 'ic-sm')}Pièce</button>` : ''}
            <button class="btn btn-primary btn-xs" type="button" data-do="verif_recu" data-ref="${o.dossier}">Vérifier</button></span></li>`; }).join('')}</ul>` }) : ''}
      <section class="card reveal mt" style="--i:4">
        ${ui.toolbar({ search: { id: 'rf-q', label: 'Rechercher', placeholder: 'Référence, organisme…', value: RF.q },
          selects: [
            { id: 'rf-state', label: 'État du règlement', value: RF.state, options: [{ value: 'all', label: 'Tous les états' }, ...Object.entries(D.recetteStates).map(([k, v]) => ({ value: k, label: v.label }))] },
            { id: 'rf-sort', label: 'Trier par', value: RF.sort, options: [{ value: 'due', label: 'Échéance' }, { value: 'issued', label: 'Date d’émission' }, { value: 'dossier', label: 'Dossier' }, { value: 'state', label: 'État' }] }
          ] })}
        ${ui.filterBar('', '<span id="rf-count" aria-live="polite"></span>')}
        <div id="rf-table"></div>
      </section>`;
    const draw = () => {
      const q = norm(RF.q.trim());
      const sorters = { due: (a, b) => a.due.localeCompare(b.due), issued: (a, b) => b.issued.localeCompare(a.issued), dossier: (a, b) => a.dossier.localeCompare(b.dossier), state: (a, b) => D.statusOrder.indexOf(a.state) - D.statusOrder.indexOf(b.state) };
      const rows = list.filter(o => (RF.state === 'all' || o.state === RF.state) && (!q || norm(`${o.id} ${o.dossier} ${GO.org(GO.getDossier(o.dossier).org).name} ${o.amount}`).includes(q)))
        .sort(sorters[RF.sort] || sorters.due);
      const cols = [
        { label: 'Ordre de recette', cls: 'td-head', cell: o => `<span class="ref">${esc(o.id)}</span><br>${GO.dictBadge(D.recetteStates, o.state)}${lateOf(o) ? ' ' + GO.badge('hors délai', 'red') : ''}` },
        { label: 'Dossier', cls: 'td-wide', cell: o => { const d = GO.getDossier(o.dossier); return `<div class="cell-org"><strong>${esc(GO.org(d.org).name)}</strong><span>${esc(o.dossier)} · ${plural(d.recipients.length, 'récipiendaire', 'récipiendaires')}</span></div>`; } },
        { label: 'Montant', cls: 'nowrap', cell: o => `<strong style="color:var(--navy-900)">${esc(o.amount)}</strong>` },
        { label: 'Émis le', cls: 'tnum nowrap', cell: o => esc(fmtDate(o.issued, 'short')) },
        { label: 'Échéance', cls: 'tnum nowrap', cell: o => `${esc(fmtDate(o.due, 'short'))}${o.state === 'emis' ? `<br><span class="muted" style="font-size:11.5px">${o.due < GO.REF_ISO ? 'dépassée de ' + plural(ageDays(o.due), 'jour', 'jours') : 'dans ' + plural(GO.daysBetween(GO.REF_ISO, o.due), 'jour', 'jours')}</span>` : ''}` },
        { label: 'Reçu de paiement', cell: o => { const r = recOf(o); return r ? `${esc(r.id)}<br><span class="muted" style="font-size:11.5px">${esc(fmtDate(r.date, 'short'))}${r.reference ? ' · ' + esc(r.reference) : ''}</span>${r.verifiedBy ? `<br><span class="muted" style="font-size:11.5px">vérifié par ${esc(r.verifiedBy)}</span>` : ''}` : '<span class="muted">en attente</span>'; } },
        { head: '', cls: 'cell-actions', cell: o => {
          const d = GO.getDossier(o.dossier), r = recOf(o);
          const b = [];
          if (GO.can('deposer_recu') && (o.state === 'emis' || o.state === 'rejete')) b.push(`<button class="btn btn-primary btn-sm" type="button" data-do="deposer_recu" data-ref="${o.dossier}">Déposer le reçu</button>`);
          if (GO.can('paiement_verif') && o.state === 'recu_depose') b.push(`<button class="btn btn-primary btn-sm" type="button" data-do="verif_recu" data-ref="${o.dossier}">Vérifier le reçu</button>`);
          if (GO.can('paiement_verif') && o.state === 'verifie') b.push(`<span data-tip="Paiement vérifié : la remise peut être préparée." tabindex="0">${GO.badge('paiement vérifié', 'green')}</span>`);
          if (r && r.file) b.push(`<button class="btn btn-ghost btn-sm" type="button" data-rec-file="${o.dossier}">Pièce</button>`);
          b.push(`<a class="btn btn-secondary btn-sm" href="#/dossiers/${o.dossier}">Dossier</a>`);
          void d; return b.join(' ');
        } }
      ];
      $('#rf-table').innerHTML = rows.length ? ui.table(cols, rows, { caption: 'Ordres de recette', rowAttrs: o => `data-rec="${esc(o.id)}"` })
        : GO.empty('cash', 'Aucun ordre de recette', 'Les ordres de recette émis pour les dossiers approuvés apparaîtront ici.');
      $('#rf-count').innerHTML = `<strong>${rows.length}</strong> ${rows.length > 1 ? 'ordres affichés' : 'ordre affiché'}`;
      $$('#rf-table [data-rec]').forEach(tr => tr.addEventListener('click', e => {
        if (e.target.closest('a,button')) return;
        openOrder(GO.S.receiptOrders.find(o => o.id === tr.dataset.rec));
      }));
      $$('#rf-table [data-do]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const a = GO.dossierActions[b.dataset.do]; if (a) a(GO.getDossier(b.dataset.ref), b); }));
      $$('[data-rec-file]', main).forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openReceipt(GO.receiptOrder(b.dataset.recFile)); }));
    };
    $('#rf-q', main).addEventListener('input', GO.debounce(e => { RF.q = e.target.value; draw(); }, 150));
    $('#rf-state', main).addEventListener('change', e => { RF.state = e.target.value; draw(); });
    $('#rf-sort', main).addEventListener('change', e => { RF.sort = e.target.value; draw(); });
    draw();
    $$('[data-c]', main).forEach(n => { n.textContent = n.dataset.c; });
  }
  function openOrder(o) {
    if (!o) return;
    const d = GO.getDossier(o.dossier), rec = GO.receiptOf(o.dossier), dr = GO.docsOf(o.dossier).find(x => x.kind === 'decision');
    GO.openDrawer({
      key: 'order:' + o.id,
      html: `<div class="drawer-head"><div class="drawer-title" id="drawer-title">${icon('cash')}Ordre de recette ${esc(o.id)}</div>
          <button class="icon-btn" type="button" data-dclose aria-label="Fermer">${icon('x')}</button></div>
        <div class="drawer-body">
          <div class="stack">
            <div class="alert alert-info">${icon('info')}<div>${esc(D.config.payment.note)}</div></div>
            ${ui.dl([
              ['Dossier', GO.refChip(o.dossier)],
              ['Organisme demandeur', esc(GO.org(d.org).name) + `<br><span class="muted" style="font-size:12px">${esc(GO.org(d.org).city)}</span>`],
              ['Montant porté', `<strong>${esc(o.amount)}</strong>`],
              ['Émis le', esc(fmtDate(o.issued, 'full'))],
              ['Échéance', `${esc(fmtDate(o.due, 'full'))}${o.due < GO.REF_ISO ? ' ' + GO.badge('hors délai', 'red') : ''}`],
              ['État du règlement', GO.dictBadge(D.recetteStates, o.state)],
              ['Référence de la décision', dr ? esc(dr.number) : '—']
            ])}
            <h3 style="font-size:13px">Reçus déposés</h3>
            ${(o.receipts || []).length ? `<div class="table-wrap"><table class="data-table responsive"><thead><tr><th scope="col">Reçu</th><th scope="col">Date</th><th scope="col">Référence</th><th scope="col">Vérification</th></tr></thead><tbody>
              ${o.receipts.map(r => `<tr><td data-label="Reçu"><span class="ref">${esc(r.id)}</span>${r.file ? `<br><span class="muted" style="font-size:12px">${esc(r.file.name)}</span>` : ''}</td>
                <td data-label="Date" class="tnum nowrap">${esc(fmtDate(r.date, 'short'))}</td>
                <td data-label="Référence">${esc(r.reference || '—')}</td>
                <td data-label="Vérification">${r.verifiedBy ? `${GO.badge('vérifié', 'green')}<br><span class="muted" style="font-size:12px">${esc(r.verifiedBy)} · ${esc(fmtDate(r.verifiedOn || GO.REF_ISO, 'short'))}</span>` : GO.badge('en attente', 'yellow')}</td></tr>`).join('')}
            </tbody></table></div>` : GO.empty('upload', 'Aucun reçu déposé', 'Le reçu sera déposé par le demandeur après paiement.')}
            ${(o.receipts || []).some(r => r.note) ? `<div class="obs"><div class="obs-meta">Observation de vérification</div>${esc((o.receipts.find(r => r.note) || {}).note)}</div>` : ''}
            <h3 style="font-size:13px">Suites du dossier</h3>
            ${ui.dl([
              ['Ordre de recette / remise', o.state === 'verifie' ? GO.badge('prêt pour la remise', 'green') : '<span class="muted">en attente du paiement vérifié</span>'],
              ['Cérémonie', (() => { const c = GO.cersOf(o.dossier)[0]; return c ? `${GO.cerBadge(c.state)}<br><span class="muted" style="font-size:12px">${esc(c.id)} · ${esc(fmtDate(c.date, 'short'))} · ${esc(GO.venue(c.venue).name)}</span>` : '<span class="muted">non programmée</span>'; })()],
              ['Retrait sans cérémonie', (() => { const w = GO.withdrawalOf(o.dossier); return w ? GO.dictBadge(D.withdrawalStates, w.state) : '<span class="muted">—</span>'; })()],
              ['Remise', (() => { const rem = GO.remiseOf(o.dossier); return rem ? GO.dictBadge(D.remiseStates, rem.state) : '<span class="muted">non préparée</span>'; })()]
            ])}
          </div>
        </div>
        <div class="drawer-foot"><a class="btn btn-secondary btn-block" href="#/dossiers/${o.dossier}" data-dclose>Ouvrir le dossier ${esc(o.dossier)}</a></div>`
    });
  }
  function openReceipt(o) {
    const r = o && GO.receiptOf(o.dossier);
    if (!r || !r.file) { GO.toast('info', 'Aucune pièce', 'Aucun reçu numérisé n’est joint à cet ordre de recette.'); return; }
    GO.openDrawer({
      key: 'receipt:' + r.id,
      html: `<div class="drawer-head"><div class="drawer-title" id="drawer-title">${icon('file')}${esc(r.file.name)}</div>
          <button class="icon-btn" type="button" data-dclose aria-label="Fermer">${icon('x')}</button></div>
        <div class="drawer-body">
          <div class="viewer">
            <div class="viewer-bar"><span class="ref">${esc(r.file.name)}</span><span class="muted" style="font-size:12px">${esc(r.file.type)} · ${Math.round(r.file.size / 1024)} Ko</span></div>
            <div class="viewer-stage">
              <div class="paper-wrap">
                <article class="paper">
                  <div class="lh">
                    <div class="lh-left"><b>République Gabonaise</b><span class="lh-sep" aria-hidden="true"></span>Trésor public<br><em>Quittance de paiement</em></div>
                    <div class="lh-right"><span class="lh-org-mark" aria-hidden="true">GO</span><div class="lh-org">GAB-ORIENT</div>Pièce simulée</div>
                  </div>
                  <h3 class="p-title">QUITTANCE — ORDRE DE RECETTE ${esc(o.id)}</h3>
                  <p class="p-obj"><b>Reçu</b> ${esc(r.id)}${r.reference ? ' — ' + esc(r.reference) : ''}</p>
                  <p>Versé par : <strong>${esc(r.from)}</strong><br>
                    Au titre de : ordre de recette <strong>${esc(o.id)}</strong> — ${esc(o.amount)}<br>
                    Date du paiement : ${esc(fmtDate(r.date, 'full'))}</p>
                  <p>Le présent document atteste le versement déclaré par le demandeur. La vérification par la régie est enregistrée dans GAB-ORIENT.</p>
                  <div class="p-sign">
                    <div class="p-sign-block"><div class="role">Le comptable public</div><div class="scan-sign">Signature et cachet simulés</div></div>
                    <div class="p-sign-block"><div class="role">La régie des médailles</div><div class="scan-sign">Visa simulé</div></div>
                  </div>
                  <div class="paper-foot"><span>Document de démonstration — aucune pièce réelle n’est stockée ni transmise</span><span>${esc(r.file.name)}</span></div>
                </article>
              </div>
            </div>
          </div>
          ${r.verifiedBy ? `<div class="alert alert-success">${icon('check-circle')}<div>Vérifié par ${esc(r.verifiedBy)} le ${esc(fmtDate(r.verifiedOn || GO.REF_ISO, 'full'))}. ${esc(r.note || '')}</div></div>` : `<div class="alert alert-warn">${icon('clock')}<div>Reçu déposé, en attente de vérification par la régie.</div></div>`}
        </div>
        <div class="drawer-foot"><button class="btn btn-secondary btn-block" type="button" data-dclose>Fermer</button></div>`
    });
  }
  GO.views.recettes = { render: renderRecettes };

  /* ======================= STOCK DES MÉDAILLES ======================= */
  const ST = { tab: 'stock', item: 'all', field: 'all' };
  const poStates = { commande: 'Commandée', livre_partiel: 'Livrée partiellement', livre: 'Livrée', annule: 'Annulée' };
  const poTones = { commande: 'blue', livre_partiel: 'yellow', livre: 'green', annule: 'red' };
  function renderStock(main) {
    const items = GO.S.stock;
    const alerts = items.filter(s => s.available <= s.threshold);
    const monthMoves = GO.S.stockMovements.filter(m => m.date.slice(0, 7) === GO.REF_ISO.slice(0, 7));
    main.innerHTML = `
      ${ui.head({ eyebrow: 'Régie des médailles', title: 'Stock des médailles',
        sub: 'Stock physique, réservations par dossier ou campagne, mouvements, commandes et livraisons fournisseurs.',
        actions: GO.can('stock') ? `<button class="btn btn-primary" type="button" id="st-new">${icon('plus')}Enregistrer un mouvement</button>` : '' })}
      <section class="card reveal" style="--i:1">${ui.kpis([
        { label: 'Médailles en stock', count: GO.stockTotal(), note: 'hors diplômes' },
        { label: 'Réservées', count: items.filter(s => s.item !== 'diplome').reduce((a, s) => a + s.reserved, 0), note: 'médailles immobilisées' },
        { label: 'Diplômes disponibles', count: (items.find(s => s.item === 'diplome') || {}).available || 0, note: `${(items.find(s => s.item === 'diplome') || {}).reserved || 0} réservés` },
        { label: 'Mouvements ce mois', count: monthMoves.length, note: `depuis le ${esc(fmtDate(GO.REF_ISO.slice(0, 7) + '-01', 'short'))}` },
        { label: 'Alertes de seuil', count: alerts.length, note: 'stock au niveau du seuil' }
      ])}</section>
      ${alerts.length ? `<div class="alert alert-warn reveal mt" style="--i:2">${icon('alert-triangle')}<div><strong>${plural(alerts.length, 'article est au niveau du seuil d’alerte', 'articles sont au niveau du seuil d’alerte')}</strong><p style="margin-top:4px">${alerts.map(s => `${esc(s.label)} : ${s.available} en stock pour un seuil de ${s.threshold}`).join(' · ')}. Le seuil est un paramètre de la démonstration : il n’est pas une règle réglementaire.</p></div></div>` : ''}
      <div class="grid grid-4 reveal mt" style="--i:3">
        ${items.map(s => { const alert = s.available <= s.threshold; const total = s.available + s.reserved; const pct = Math.min(100, Math.round(s.available / Math.max(1, s.threshold * 2) * 100));
          return `<section class="card stock-card ${alert ? 'is-alert' : ''}">
            <div class="card-head"><div><h2 class="card-title">${icon('medal')}${esc(s.label)}</h2><p class="card-sub">${s.reserved} réservé${s.reserved > 1 ? 's' : ''} · seuil ${s.threshold}</p></div>${alert ? GO.badge('seuil atteint', 'yellow') : GO.badge('disponible', 'green')}</div>
            <div class="card-body">
              <div class="stock-fig"><strong class="tnum">${s.available}</strong><span class="muted">en stock physique</span></div>
              <div class="bar-track" style="margin-top:10px"><span class="bar-fill" style="width:${pct}%;background:${alert ? 'var(--yellow-600)' : 'var(--green-600)'}"></span></div>
              <p class="hint" style="margin-top:8px">${total} unités suivies par la régie · ${plural(GO.S.stockMovements.filter(m => m.item === s.item).length, 'mouvement enregistré', 'mouvements enregistrés')}</p>
            </div></section>`; }).join('')}
      </div>
      <section class="card reveal mt" style="--i:4">
        <div class="card-head"><div><h2 class="card-title">${icon('box')}Suivi de la régie</h2><p class="card-sub">Mouvements, approvisionnements et fournisseurs</p></div>
          <div class="tabs" role="tablist" aria-label="Vues du stock"><span class="tab-ink" aria-hidden="true"></span>
            <button class="tab" role="tab" type="button" id="stb-mv" data-tab="stock" aria-controls="stp-mv" aria-selected="${ST.tab === 'stock'}">${icon('refresh', 'ic-sm')}Mouvements</button>
            <button class="tab" role="tab" type="button" id="stb-po" data-tab="appro" aria-controls="stp-po" aria-selected="${ST.tab === 'appro'}">${icon('truck', 'ic-sm')}Approvisionnements</button>
            <button class="tab" role="tab" type="button" id="stb-sup" data-tab="fou" aria-controls="stp-sup" aria-selected="${ST.tab === 'fou'}">${icon('building', 'ic-sm')}Fournisseurs</button>
          </div></div>
        <div id="stp-mv" role="tabpanel" aria-labelledby="stb-mv" ${ST.tab === 'stock' ? '' : 'hidden'}>
          ${ui.toolbar({ selects: [
            { id: 'st-item', label: 'Article', value: ST.item, options: [{ value: 'all', label: 'Tous les articles' }, ...items.map(s => ({ value: s.item, label: s.label }))] },
            { id: 'st-field', label: 'Nature', value: ST.field, options: [{ value: 'all', label: 'Stock et réservations' }, { value: 'available', label: 'Stock physique' }, { value: 'reserved', label: 'Réservations' }] }
          ] })}
          <div id="st-mv"></div>
        </div>
        <div id="stp-po" role="tabpanel" aria-labelledby="stb-po" ${ST.tab === 'appro' ? '' : 'hidden'}>
          <div id="st-po"></div>
        </div>
        <div id="stp-sup" role="tabpanel" aria-labelledby="stb-sup" ${ST.tab === 'fou' ? '' : 'hidden'}>
          <div id="st-sup"></div>
        </div>
      </section>`;
    GO.tabs(main, t => { ST.tab = t; drawStockPanels(); });
    $('#st-item', main).addEventListener('change', e => { ST.item = e.target.value; drawStockPanels(); });
    $('#st-field', main).addEventListener('change', e => { ST.field = e.target.value; drawStockPanels(); });
    const nb = $('#st-new', main);
    if (nb) nb.addEventListener('click', newMovement);
    drawStockPanels();
    requestAnimationFrame(() => $$('[data-c]', main).forEach(n => GO.countUp(n, +n.dataset.c)));
  }
  function drawStockPanels() {
    $$('#stp-mv, #stp-po, #stp-sup').forEach(p => { p.hidden = p.id !== { stock: 'stp-mv', appro: 'stp-po', fou: 'stp-sup' }[ST.tab]; });
    const moves = GO.S.stockMovements.filter(m => (ST.item === 'all' || m.item === ST.item) && (ST.field === 'all' || m.field === ST.field))
      .slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    $('#st-mv').innerHTML = moves.length ? ui.table([
      { label: 'Mouvement', cls: 'td-head', cell: m => `<span class="ref">${esc(m.id)}</span><br><span class="muted" style="font-size:11.5px">${esc(fmtDate(m.date, 'short'))}</span>` },
      { label: 'Article', cell: m => `${esc(GO.medal(m.item).short)}<br><span class="muted" style="font-size:11.5px">${esc(FIELD_LABEL[m.field])}</span>` },
      { label: 'Sens', cell: m => m.qty > 0 ? GO.badge(`entrée +${m.qty}`, 'green') : GO.badge(`sortie ${m.qty}`, 'red') },
      { label: 'Motif', cls: 'td-wide', cell: m => `${esc(m.reason)}${m.dossier ? `<br><span class="ref" style="font-size:11.5px">${esc(m.dossier)}</span>` : ''}${m.note ? `<br><span class="muted" style="font-size:11.5px">${esc(m.note)}</span>` : ''}` },
      { label: 'Auteur', cell: m => esc(m.author || '—') }
    ], moves, { caption: 'Mouvements de stock' }) : GO.empty('box', 'Aucun mouvement', 'Aucun mouvement de stock ne correspond à ces filtres.');
    const pos = GO.S.purchaseOrders.slice().sort((a, b) => b.date.localeCompare(a.date));
    const livs = GO.S.deliveries.slice().sort((a, b) => b.date.localeCompare(a.date));
    $('#st-po').innerHTML = (pos.length || livs.length) ? `
      <div class="card-body"><h3 style="font-size:13px">Commandes</h3>
        ${ui.table([
          { label: 'Commande', cls: 'td-head', cell: p => `<span class="ref">${esc(p.id)}</span><br><span class="muted" style="font-size:11.5px">${esc(fmtDate(p.date, 'short'))}</span>` },
          { label: 'Fournisseur', cell: p => esc((GO.S.suppliers.find(s => s.id === p.supplier) || {}).name || '—') },
          { label: 'Lignes', cls: 'td-wide', cell: p => p.lines.map(l => `${l.qty} ${esc(GO.medal(l.item).short)} <span class="muted">(${esc(l.unit)})</span>`).join('<br>') },
          { label: 'Attendue le', cls: 'tnum nowrap', cell: p => esc(fmtDate(p.expected, 'short')) },
          { label: 'État', cell: p => GO.badge(poStates[p.state] || p.state, poTones[p.state] || 'slate') }
        ], pos, { caption: 'Commandes fournisseurs' })}
      </div>
      <div class="card-body" style="border-top:1px solid var(--line-soft)"><h3 style="font-size:13px">Livraisons réceptionnées</h3>
        ${livs.length ? ui.table([
          { label: 'Livraison', cls: 'td-head', cell: l => `<span class="ref">${esc(l.id)}</span><br><span class="muted" style="font-size:11.5px">${esc(fmtDate(l.date, 'short'))}</span>` },
          { label: 'Commande', cell: l => esc(l.order) },
          { label: 'Fournisseur', cell: l => esc((GO.S.suppliers.find(s => s.id === l.supplier) || {}).name || '—') },
          { label: 'Réception', cls: 'td-wide', cell: l => l.lines.map(x => `${x.received}/${x.qty} ${esc(GO.medal(x.item).short)}`).join('<br>') },
          { label: 'État', cell: l => GO.badge(l.state === 'conforme' ? 'Conforme' : l.state === 'partielle' ? 'Partielle' : l.state, l.state === 'conforme' ? 'green' : 'yellow') },
          { label: 'Réceptionnée par', cell: l => esc(l.receiver) }
        ], livs, { caption: 'Livraisons' }) : GO.empty('truck', 'Aucune livraison', 'Les réceptions fournisseurs apparaîtront ici.')}
        ${livs.some(l => l.note) ? `<p class="hint" style="margin-top:8px">${icon('info', 'ic-sm')} ${esc(livs.filter(l => l.note).map(l => `${l.id} : ${l.note}`).join(' '))}</p>` : ''}
      </div>` : GO.empty('truck', 'Aucun approvisionnement', 'Les commandes et livraisons apparaîtront ici.');
    $('#st-sup').innerHTML = GO.S.suppliers.length ? ui.table([
      { label: 'Fournisseur', cls: 'td-head td-wide', cell: s => `<div class="cell-org"><strong>${esc(s.name)}</strong><span>${esc(s.city)} · ${esc(s.contact)}</span></div>` },
      { label: 'Articles fournis', cell: s => s.items.map(i => esc(GO.medal(i).short)).join(', ') },
      { label: 'Délai annoncé', cell: s => esc(s.lead) },
      { label: 'Commandes en cours', cell: s => GO.S.purchaseOrders.filter(p => p.supplier === s.id && p.state !== 'livre').length }
    ], GO.S.suppliers, { caption: 'Fournisseurs' }) : GO.empty('building', 'Aucun fournisseur', 'Les fournisseurs référencés apparaîtront ici.');
  }
  function newMovement() {
    GO.formModal({
      title: 'Enregistrer un mouvement de stock', icon: 'box', tone: 'blue',
      intro: `<div class="alert alert-info">${icon('info')}<div>Les mouvements de démonstration ajustent un stock de référence : <strong>stock physique</strong> pour une entrée, une sortie ou une régularisation, <strong>réservation</strong> pour immobiliser ou libérer des médailles au nom d’un dossier. Une remise effective se déduit toujours de la réservation correspondante.</div></div>`,
      fields: [
        { id: 'item', label: 'Article', type: 'select', options: GO.S.stock.map(s => ({ value: s.item, label: `${s.label} — ${s.available} disponibles, ${s.reserved} réservés` })) },
        { id: 'nature', label: 'Nature du mouvement', type: 'select', options: [{ value: 'available:1', label: 'Entrée en stock (réception, régularisation)' }, { value: 'available:-1', label: 'Sortie de stock (remise, mise au rebut)' }, { value: 'reserved:1', label: 'Réservation pour un dossier' }, { value: 'reserved:-1', label: 'Libération de réservation' }] },
        { id: 'qty', label: 'Quantité', type: 'number', required: true, min: '1', validate: v => (+v > 0 && +v <= 500) ? '' : 'Saisissez une quantité entre 1 et 500.' },
        { id: 'reason', label: 'Motif', type: 'text', required: true, placeholder: 'Exemple : Réception fournisseur LIV-2026-004', validate: v => v.length >= 5 ? '' : 'Précisez le motif du mouvement.' },
        { id: 'dossier', label: 'Dossier concerné (facultatif)', type: 'select', options: [{ value: '', label: 'Aucun dossier' }, ...GO.myDossiers().filter(d => d.status === 'approuve').map(d => ({ value: d.ref, label: `${d.ref} — ${GO.org(d.org).short}` }))] },
        { id: 'note', label: 'Observation', type: 'textarea', rows: 2 }
      ],
      submit: 'Enregistrer le mouvement', iconSubmit: 'check', delay: 500,
      run: v => {
        const [field, sign] = v.nature.split(':');
        const item = GO.stockOf(v.item);
        const qty = +v.qty * +sign;
        if (field === 'available' && item.available + qty < 0) { GO.toast('error', 'Stock insuffisant', `Le stock physique de ${GO.medal(v.item).short} est de ${item.available}.`); return; }
        if (field === 'reserved' && item.reserved + qty < 0) { GO.toast('error', 'Réservations insuffisantes', `${item.reserved} unités sont actuellement réservées.`); return; }
        const mv = GO.moveStock({ item: v.item, field, qty, reason: v.reason, dossier: v.dossier || null, note: v.note });
        if (v.dossier) GO.addHistory(GO.getDossier(v.dossier), 'note', `Mouvement de stock ${mv.id} — ${qty > 0 ? '+' : ''}${qty} ${GO.medal(v.item).short} (${FIELD_LABEL[field]})`, GO.actorName(), { detail: v.reason });
        GO.notify({ type: 'stock', aud: 'service', ref: v.dossier || null, title: 'Mouvement de stock enregistré', msg: `${mv.id} — ${GO.medal(v.item).short} ${qty > 0 ? '+' : ''}${qty} (${FIELD_LABEL[field].toLowerCase()}).` });
        GO.commit();
        GO.toast('success', 'Mouvement enregistré', `${mv.id} — ${esc(GO.medal(v.item).short)} ${qty > 0 ? '+' : ''}${qty}.`);
        GO.forceRoute(location.hash);
      }
    });
  }
  GO.views.stock = { render: renderStock };

  /* ======================= REMISES DES MÉDAILLES ======================= */
  const RMF = { tab: 'todo' };
  function recSummary(d) {
    const c = {}; d.recipients.forEach(r => { c[r.medal] = (c[r.medal] || 0) + 1; });
    const out = D.medals.filter(m => c[m.id]).map(m => ({ item: m.id, n: c[m.id] }));
    out.push({ item: 'diplome', n: d.recipients.length });
    return out;
  }
  function renderRemises(main) {
    const remises = GO.myRemises().slice().sort((a, b) => b.date.localeCompare(a.date));
    const withdrawn = GO.myWithdrawals();
    const list = GO.myDossiers();
    const toPrepare = list.filter(d => d.status === 'approuve' && ((GO.cersOf(d.ref)[0] || {}).state === 'confirme' || (GO.cersOf(d.ref)[0] || {}).state === 'termine'))
      .filter(d => { const r = GO.remiseOf(d.ref); return !r; });
    const prepared = remises.filter(r => r.state === 'preparee');
    const done = remises.filter(r => r.state === 'remise' || r.state === 'retrait');
    const medalsOut = done.reduce((a, r) => a + r.recipients.length, 0);
    main.innerHTML = `
      ${ui.head({ eyebrow: 'Régie des médailles', title: 'Remises des médailles',
        sub: 'Préparation et réservation des médailles, puis enregistrement de la remise effective. Le stock physique ne diminue qu’à l’enregistrement d’une remise effective.',
        actions: `<a class="btn btn-secondary" href="#/stock">${icon('box')}Stock et mouvements</a><a class="btn btn-secondary" href="#/retraits">${icon('medal')}Retraits sans cérémonie</a>` })}
      <section class="card reveal" style="--i:1">${ui.kpis([
        { label: 'À préparer', count: toPrepare.length, note: 'cérémonie confirmée, médailles non réservées' },
        { label: 'Préparées et réservées', count: prepared.length, note: 'stock physique non diminué' },
        { label: 'Remises effectives', count: done.length, note: 'cérémonie ou retrait' },
        { label: 'Distinctions remises', count: medalsOut, note: 'récipiendaires servis' },
        { label: 'Retraits sans cérémonie', count: withdrawn.filter(w => w.state !== 'refuse').length, note: `${withdrawn.filter(w => w.state === 'demande' || w.state === 'valide').length} en cours` }
      ])}</section>
      <section class="card reveal mt" style="--i:2">
        <div class="card-head"><div><h2 class="card-title">${icon('medal')}Remises et réservations</h2><p class="card-sub">Chaque ligne suit un dossier, de la réservation à la remise effective</p></div>
          <div class="tabs" role="tablist" aria-label="Vues des remises"><span class="tab-ink" aria-hidden="true"></span>
            <button class="tab" role="tab" type="button" data-tab="todo" aria-selected="${RMF.tab === 'todo'}">${icon('box', 'ic-sm')}À préparer</button>
            <button class="tab" role="tab" type="button" data-tab="done" aria-selected="${RMF.tab === 'done'}">${icon('check-circle', 'ic-sm')}Registre des remises</button>
          </div></div>
        <div id="rm-panel"></div>
      </section>
      ${ui.card({ i: 3, cls: 'mt', icon: 'clock', title: 'Ce que la régie ne fait pas', sub: 'Repères d’usage de la maquette',
        body: `<ul class="list-plain">
          <li><span>La régie n’attribue pas les distinctions : elle prépare et remet les médailles sur une décision d’attribution et une cérémonie confirmée ou un retrait autorisé.</span></li>
          <li><span>La réservation est réversible et n’engage aucune sortie de stock : seule la remise effective diminue le stock physique.</span></li>
          <li><span>Le paiement est vérifié à partir du reçu déposé par le demandeur ; GAB-ORIENT n’encaisse aucun montant.</span></li>
        </ul>` })}
    `;
    GO.tabs(main, t => { RMF.tab = t; drawRemises(); });
    drawRemises();
    requestAnimationFrame(() => $$('[data-c]', main).forEach(n => GO.countUp(n, +n.dataset.c)));
  }
  function drawRemises() {
    const host = $('#rm-panel'); if (!host) return;
    const remises = GO.myRemises().slice().sort((a, b) => b.date.localeCompare(a.date));
    const list = GO.myDossiers();
    const cert = d => (GO.cersOf(d.ref)[0] || {}).state === 'confirme';
    const toPrepare = list.filter(d => d.status === 'approuve' && cert(d) && !GO.remiseOf(d.ref));
    const prepared = remises.filter(r => r.state === 'preparee');
    if (RMF.tab === 'todo') {
      const pendingRetrait = GO.myWithdrawals().filter(w => w.state === 'valide');
      host.innerHTML = (toPrepare.length || prepared.length || pendingRetrait.length) ? `
        ${toPrepare.length ? `<div class="card-body"><h3 style="font-size:13px">Cérémonies confirmées — médailles à préparer</h3>
          ${ui.table([
            { label: 'Dossier', cls: 'td-head', cell: d => `<span class="ref">${esc(d.ref)}</span><br>${GO.stepMini(d)}` },
            { label: 'Organisme', cls: 'td-wide', cell: d => esc(GO.org(d.org).name) },
            { label: 'Cérémonie', cell: d => { const c = GO.cersOf(d.ref)[0], v = GO.venue(c.venue); return `${esc(c.id)}<br><span class="muted" style="font-size:11.5px">${esc(fmtDate(c.date, 'short'))} · ${esc(v.city)}</span>`; } },
            { label: 'Distinctions à préparer', cell: d => recSummary(d).map(m => `${m.n} ${esc(GO.medal(m.item).short)}`).join(', ') },
            { label: 'Paiement', cell: d => { const o = GO.receiptOrder(d.ref); return o ? GO.dictBadge(D.recetteStates, o.state) : '<span class="muted">aucun ordre</span>'; } },
            { head: '', cls: 'cell-actions', cell: d => `<button class="btn btn-primary btn-sm" type="button" data-do="remise_prep" data-ref="${d.ref}">Préparer et réserver</button><a class="btn btn-secondary btn-sm" href="#/dossiers/${d.ref}">Dossier</a>` }
          ], toPrepare, { caption: 'Médailles à préparer' })}</div>` : ''}
        ${prepared.length ? `<div class="card-body" style="border-top:1px solid var(--line-soft)"><h3 style="font-size:13px">Médailles préparées — remise effective à enregistrer après la cérémonie</h3>
          ${ui.table([
            { label: 'Remise', cls: 'td-head', cell: r => `<span class="ref">${esc(r.id)}</span><br>${GO.dictBadge(D.remiseStates, r.state)}` },
            { label: 'Dossier', cls: 'td-wide', cell: r => { const d = GO.getDossier(r.dossier); return `${esc(GO.org(d.org).name)}<br><span class="muted" style="font-size:11.5px">${esc(r.dossier)} · ${esc(r.ceremony || 'sans cérémonie')}</span>`; } },
            { label: 'Préparée le', cls: 'tnum nowrap', cell: r => esc(fmtDate(r.date, 'short')) },
            { label: 'Récipiendaires', cell: r => r.recipients.length },
            { label: 'Enregistrée par', cell: r => esc(r.recordedBy || '—') },
            { head: '', cls: 'cell-actions', cell: r => `${GO.can('remise') ? `<button class="btn btn-primary btn-sm" type="button" data-do="remise_ok" data-ref="${r.dossier}">Enregistrer la remise effective</button>` : ''}<a class="btn btn-secondary btn-sm" href="#/dossiers/${r.dossier}">Dossier</a>` }
          ], prepared, { caption: 'Médailles préparées' })}</div>` : ''}
        ${pendingRetrait.length ? `<div class="card-body" style="border-top:1px solid var(--line-soft)"><h3 style="font-size:13px">Retraits autorisés — remise à la régie</h3>
          ${ui.table([
            { label: 'Demande', cls: 'td-head', cell: w => `<span class="ref">${esc(w.id)}</span><br>${GO.dictBadge(D.withdrawalStates, w.state)}` },
            { label: 'Dossier', cls: 'td-wide', cell: w => { const d = GO.getDossier(w.dossier); return `${esc(GO.org(d.org).name)}<br><span class="muted" style="font-size:11.5px">${esc(w.dossier)}</span>`; } },
            { label: 'Autorisation', cell: w => `${esc(w.reference || '—')}<br><span class="muted" style="font-size:11.5px">retrait prévu le ${esc(fmtDate(w.appointment || w.date, 'short'))}</span>` },
            { label: 'Récipiendaires', cell: w => w.recipients.length },
            { head: '', cls: 'cell-actions', cell: w => `<button class="btn btn-primary btn-sm" type="button" data-do="retrait_remis" data-ref="${w.dossier}">Enregistrer le retrait effectif</button><a class="btn btn-secondary btn-sm" href="#/dossiers/${w.dossier}">Dossier</a>` }
          ], pendingRetrait, { caption: 'Retraits autorisés' })}</div>` : ''}
      ` : GO.empty('check-circle', 'Rien à préparer', 'Aucune cérémonie confirmée n’attend de préparation de médailles.');
    } else {
      host.innerHTML = remises.length ? `<div class="card-body">${ui.table([
        { label: 'Remise', cls: 'td-head', cell: r => `<span class="ref">${esc(r.id)}</span><br>${GO.dictBadge(D.remiseStates, r.state)}` },
        { label: 'Dossier', cls: 'td-wide', cell: r => { const d = GO.getDossier(r.dossier); return `<div class="cell-org"><strong>${esc(GO.org(d.org).name)}</strong><span>${esc(r.dossier)} · ${plural(r.recipients.length, 'récipiendaire', 'récipiendaires')}</span></div>`; } },
        { label: 'Modalité', cell: r => `${GO.badge(r.mode === 'retrait' ? 'Retrait à la régie' : 'Cérémonie', r.mode === 'retrait' ? 'blue' : 'navy')}${r.ceremony ? `<br><span class="muted" style="font-size:11.5px">${esc(r.ceremony)}</span>` : ''}` },
        { label: 'Date', cls: 'tnum nowrap', cell: r => esc(fmtDate(r.date, 'short')) },
        { label: 'Enregistrée par', cell: r => esc(r.recordedBy || '—') },
        { label: 'Mouvements', cell: r => GO.S.stockMovements.filter(m => m.dossier === r.dossier).length },
        { head: '', cls: 'cell-actions', cell: r => `<button class="btn btn-secondary btn-sm" type="button" data-mv="${esc(r.dossier)}">Mouvements</button><a class="btn btn-secondary btn-sm" href="#/dossiers/${r.dossier}">Dossier</a>` }
      ], remises, { caption: 'Registre des remises' })}</div>` : GO.empty('medal', 'Aucune remise enregistrée', 'Les remises effectives enregistrées par la régie apparaîtront ici.');
    }
    $$('[data-do]', host).forEach(b => b.addEventListener('click', () => { const a = GO.dossierActions[b.dataset.do]; if (a) a(GO.getDossier(b.dataset.ref), b); }));
    $$('[data-mv]', host).forEach(b => b.addEventListener('click', () => openMovements(b.dataset.mv)));
  }
  function openMovements(ref) {
    const d = GO.getDossier(ref);
    const mv = GO.S.stockMovements.filter(m => m.dossier === ref).sort((a, b) => a.date.localeCompare(b.date));
    GO.openDrawer({
      key: 'mv:' + ref,
      html: `<div class="drawer-head"><div class="drawer-title" id="drawer-title">${icon('box')}Mouvements de stock — ${esc(ref)}</div>
          <button class="icon-btn" type="button" data-dclose aria-label="Fermer">${icon('x')}</button></div>
        <div class="drawer-body">
          <p class="muted" style="font-size:13px">Réservations et remises enregistrées pour ${esc(GO.org(d.org).name)}. Le stock physique diminue à chaque remise effective et la réservation correspondante est libérée.</p>
          ${mv.length ? ui.timeline(mv.map(m => ({ label: `${m.qty > 0 ? '+' : ''}${m.qty} ${GO.medal(m.item).short} — ${FIELD_LABEL[m.field]}`, actor: m.author, date: m.date, kind: m.field === 'reserved' ? 'courrier' : 'ceremonie', icon: m.qty > 0 ? 'plus' : 'minus' }))) : GO.empty('box', 'Aucun mouvement', 'Aucun mouvement de stock n’est rattaché à ce dossier.')}
          ${recapMedsLocal(d)}
        </div>
        <div class="drawer-foot"><a class="btn btn-secondary btn-block" href="#/dossiers/${ref}" data-dclose>Ouvrir le dossier</a></div>`
    });
  }
  function recapMedsLocal(d) {
    return `<div class="mini-table mt"><table><thead><tr><th scope="col">Distinction</th><th scope="col">Attendue</th><th scope="col">Stock physique</th><th scope="col">Réservé</th></tr></thead><tbody>
      ${recSummary(d).map(m => { const s = GO.stockOf(m.item) || { available: 0, reserved: 0 }; return `<tr><td>${esc(GO.medal(m.item).short)}</td><td class="tnum">${m.n}</td>
        <td class="tnum">${s.available}${s.available < m.n ? ' ' + GO.badge('insuffisant', 'red') : ''}</td><td class="tnum">${s.reserved}</td></tr>`; }).join('')}</tbody></table></div>`;
  }
  GO.views.remises = { render: renderRemises };

  /* ======================= RETRAITS SANS CÉRÉMONIE ======================= */
  const WDF = { q: '', state: 'all' };
  const APPLI_REASON = d => {
    const w = GO.withdrawalOf(d.ref), c = GO.activeCer(d.ref), r = GO.remiseOf(d.ref);
    if (w) return `une demande de retrait est déjà enregistrée (${w.id}, ${D.withdrawalStates[w.state].label.toLowerCase()})`;
    if (r && (r.state === 'remise' || r.state === 'retrait')) return `les distinctions ont déjà été remises (${r.id})`;
    if (c) return `une cérémonie est programmée (${c.id}, ${D.ceremonyStates[c.state].label.toLowerCase()})`;
    if (d.status !== 'approuve') return `le dossier n’est pas encore approuvé (${D.statuses[d.status].label.toLowerCase()})`;
    return '';
  };
  function renderRetraits(main) {
    const list = GO.myWithdrawals().slice().sort((a, b) => b.date.localeCompare(a.date));
    const count = s => list.filter(w => w.state === s).length;
    const mine = GO.external() ? GO.myDossiers().filter(d => d.status === 'approuve') : [];
    main.innerHTML = `
      ${ui.head({ eyebrow: 'Retraits', title: 'Retraits sans cérémonie',
        sub: GO.external() ? 'Procédure de retrait des distinctions à la régie lorsque aucune cérémonie n’est organisée pour votre dossier.' : 'Demandes reçues, autorisations enregistrées et retraits effectués à la régie.',
        actions: GO.external() && mine.some(d => !APPLI_REASON(d)) ? `<button class="btn btn-primary" type="button" id="wd-new">${icon('medal')}Demander un retrait</button>` : '' })}
      <section class="card reveal" style="--i:1">${ui.kpis([
        { label: 'Demandes reçues', count: count('demande'), note: 'en attente d’autorisation' },
        { label: 'Autorisations enregistrées', count: count('valide'), note: 'retrait à organiser' },
        { label: 'Retraits effectués', count: count('remis'), note: 'stock mis à jour' },
        { label: 'Demandes refusées', count: count('refuse'), note: 'motif consigné' }
      ])}</section>
      <div class="alert alert-info reveal mt" style="--i:2">${icon('info')}<div>Le retrait sans cérémonie s’applique lorsqu’aucune cérémonie n’est organisée pour un dossier approuvé. La demande est enregistrée par le demandeur — ou par le récipiendaire pour sa propre distinction — puis autorisée et remise à la régie. La remise effective est la seule opération qui diminue le stock physique.</div></div>
      ${GO.external() && mine.length ? ui.card({ i: 3, cls: 'mt', icon: 'medal', title: 'Mes distinctions et la procédure de retrait', sub: 'Applicabilité du retrait sans cérémonie, dossier par dossier',
        body: `<div class="table-wrap"><table class="data-table responsive"><caption class="sr-only">Applicabilité du retrait sans cérémonie</caption><thead><tr>
            <th scope="col">Dossier</th><th scope="col">Distinctions</th><th scope="col">Cérémonie</th><th scope="col">Retrait</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>
          ${mine.map(d => { const reason = APPLI_REASON(d), w = GO.withdrawalOf(d.ref), c = GO.activeCer(d.ref); return `<tr>
            <td data-label="Dossier"><span class="ref">${esc(d.ref)}</span></td>
            <td data-label="Distinctions">${d.recipients.map(r => `${esc(r.prenom)} ${esc(r.nom)} — ${esc(GO.medal(r.medal).short)}`).join('<br>')}</td>
            <td data-label="Cérémonie">${c ? `${GO.cerBadge(c.state)}<br><span class="muted" style="font-size:11.5px">${esc(c.id)} · ${esc(fmtDate(c.date, 'short'))}</span>` : '<span class="muted">non programmée</span>'}</td>
            <td data-label="Retrait">${w ? GO.dictBadge(D.withdrawalStates, w.state) : reason ? `<span class="muted">non applicable</span><br><span class="muted" style="font-size:11.5px">${esc(reason)}</span>` : GO.badge('procédure applicable', 'blue')}</td>
            <td class="cell-actions">${!w && !reason ? `<button class="btn btn-primary btn-sm" type="button" data-do="retrait_demande" data-ref="${d.ref}">Demander un retrait</button>` : ''}<a class="btn btn-secondary btn-sm" href="#/dossiers/${d.ref}">Dossier</a></td></tr>`; }).join('')}
        </tbody></table></div>` }) : ''}
      <section class="card reveal mt" style="--i:4">
        ${ui.toolbar({ search: { id: 'wd-q', label: 'Rechercher', placeholder: 'Référence, dossier…', value: WDF.q } })}
        ${ui.filterBar(`<div class="chip-row" id="wd-chips" role="group" aria-label="Filtrer par état">${ui.chips([{ key: 'all', label: 'Tous les états', n: list.length }, ...Object.entries(D.withdrawalStates).map(([k, v]) => ({ key: k, label: v.label, n: count(k), tone: v.tone }))], WDF.state, { attr: 'data-t' }).replace(/^<div class="chip-row"[^>]*>|<\/div>$/g, '')}</div>`, '<span id="wd-count" aria-live="polite"></span>')}
        <div id="wd-table"></div>
      </section>`;
    const draw = () => {
      const q = norm(WDF.q.trim());
      const rows = list.filter(w => (WDF.state === 'all' || w.state === WDF.state) && (!q || norm(`${w.id} ${w.dossier} ${w.requester} ${w.justification}`).includes(q)));
      const cols = [
        { label: 'Demande', cls: 'td-head', cell: w => `<span class="ref">${esc(w.id)}</span><br>${GO.dictBadge(D.withdrawalStates, w.state)}` },
        { label: 'Dossier', cls: 'td-wide', cell: w => { const d = GO.getDossier(w.dossier); return `<div class="cell-org"><strong>${esc(GO.org(d.org).name)}</strong><span>${esc(w.dossier)} · ${plural(w.recipients.length, 'récipiendaire', 'récipiendaires')}</span></div>`; } },
        { label: 'Demandeur', cell: w => esc(w.requester) },
        { label: 'Date', cls: 'tnum nowrap', cell: w => esc(fmtDate(w.date, 'short')) },
        { label: 'Justification', cls: 'td-wide', cell: w => esc(w.justification) },
        { label: 'Autorisation / rendez-vous', cell: w => w.reference ? `${esc(w.reference)}<br><span class="muted" style="font-size:11.5px">${esc(fmtDate(w.appointment || w.date, 'full'))}</span>` : '<span class="muted">—</span>' },
        { label: 'Retrait effectif', cell: w => w.remisOn ? `${esc(fmtDate(w.remisOn, 'short'))}<br><span class="muted" style="font-size:11.5px">${esc(w.recordedBy || '')}</span>` : '<span class="muted">—</span>' },
        { head: '', cls: 'cell-actions', cell: w => {
          const b = [];
          if (GO.can('retrait_traitement') && w.state === 'demande') b.push(`<button class="btn btn-primary btn-sm" type="button" data-do="retrait_valide" data-ref="${w.dossier}">Autoriser le retrait</button>`);
          if (GO.can('retrait_traitement') && w.state === 'valide') b.push(`<button class="btn btn-primary btn-sm" type="button" data-do="retrait_remis" data-ref="${w.dossier}">Retrait effectif</button>`);
          if (GO.can('retrait') && w.state === 'valide') b.push(`<span data-tip="Présentez-vous à la régie à la date indiquée : la remise sera enregistrée le jour du retrait." tabindex="0">${GO.badge('convocation régie', 'blue')}</span>`);
          b.push(`<a class="btn btn-secondary btn-sm" href="#/dossiers/${w.dossier}">Dossier</a>`);
          return b.join(' ');
        } }
      ];
      $('#wd-table').innerHTML = rows.length ? ui.table(cols, rows, { caption: 'Retraits sans cérémonie' }) : GO.empty('medal', 'Aucun retrait sans cérémonie', WDF.state === 'all' ? 'Aucune demande de retrait n’est enregistrée pour les dossiers accessibles avec ce profil.' : 'Aucune demande dans cet état.');
      $('#wd-count').innerHTML = `<strong>${rows.length}</strong> ${rows.length > 1 ? 'demandes affichées' : 'demande affichée'}`;
      $$('#wd-table [data-do]').forEach(b => b.addEventListener('click', () => { const a = GO.dossierActions[b.dataset.do]; if (a) a(GO.getDossier(b.dataset.ref), b); }));
    };
    $('#wd-q', main).addEventListener('input', GO.debounce(e => { WDF.q = e.target.value; draw(); }, 150));
    $('#wd-chips', main).addEventListener('click', e => { const c = e.target.closest('[data-t]'); if (!c) return; WDF.state = c.dataset.t; draw(); });
    const nb = $('#wd-new', main);
    if (nb) nb.addEventListener('click', () => { const d = mine.find(x => !APPLI_REASON(x)); if (d) GO.dossierActions.retrait_demande(d); });
    $$('[data-do]', main).forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const a = GO.dossierActions[b.dataset.do]; if (a) a(GO.getDossier(b.dataset.ref), b); }));
    draw();
    requestAnimationFrame(() => $$('[data-c]', main).forEach(n => GO.countUp(n, +n.dataset.c)));
    void relDay; void digits; void ageDays;
  }
  GO.views.retraits = { render: renderRetraits };
})(window.GO);
