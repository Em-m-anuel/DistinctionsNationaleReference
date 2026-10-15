/* ==========================================================================
   GAB-ORIENT — Vues « Courriers et documents » et « Notifications »
   ========================================================================== */
(function (GO) {
  'use strict';
  const { $, $$, esc, icon, D, fmtDate, relDay, plural, norm } = GO;

  /* ======================= COURRIERS ======================= */
  const CF = { q: '', type: 'all', dossier: 'all', zoom: 1, sel: null };
  const small = () => window.matchMedia('(max-width: 860px)').matches;

  function docList() {
    const q = norm(CF.q.trim());
    return GO.myDocs()
      .filter(x => (CF.type === 'all' || x.type === CF.type) && (CF.dossier === 'all' || x.dossier === CF.dossier))
      .filter(x => !q || norm(`${x.title} ${x.dossier} ${x.from} ${x.number || ''}`).includes(q))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }

  function renderCourriers(main, r) {
    if (r.params.get('dossier')) CF.dossier = r.params.get('dossier');
    const dossiers = [...new Set(GO.myDocs().map(x => x.dossier))].sort();
    if (CF.dossier !== 'all' && !dossiers.includes(CF.dossier)) CF.dossier = 'all';
    main.innerHTML = `
      <section class="page-head reveal">
        <div><div class="page-eyebrow">Consultation</div><h1 class="page-title">Courriers et documents</h1>
          <p class="page-sub">Courriers numérisés, notes internes, pièces justificatives et décisions rattachés aux dossiers.</p></div>
      </section>
      <div class="doc-layout">
        <section class="card doc-list-card reveal" style="--i:1" aria-labelledby="dl-t">
          <div class="card-head" style="min-height:48px;padding:12px 14px"><h2 class="card-title" id="dl-t" style="font-size:15px">${icon('inbox')}Documents</h2><span class="result-count" id="dl-count" aria-live="polite"></span></div>
          <div class="doc-filters">
            <div class="search-field"><label class="sr-only" for="dl-q">Rechercher un document</label>${icon('search')}<input class="input" id="dl-q" type="search" placeholder="Titre, expéditeur, référence…" value="${esc(CF.q)}" style="height:36px"></div>
            <div class="doc-filters-row">
              <div><label class="sr-only" for="dl-type">Type</label><select class="select" id="dl-type"><option value="all">Tous les types</option>${Object.entries(D.docTypes).map(([k, v]) => `<option value="${k}" ${k === CF.type ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
              <div><label class="sr-only" for="dl-dossier">Dossier</label><select class="select" id="dl-dossier"><option value="all">Tous les dossiers</option>${dossiers.map(d => `<option value="${d}" ${d === CF.dossier ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
            </div>
          </div>
          <div class="doc-list" id="dl-list" role="list"></div>
        </section>
        <section class="card viewer reveal" style="--i:2" id="viewer" aria-label="Aperçu du document"></section>
      </div>`;
    const redraw = () => { drawDocList(main); };
    $('#dl-q', main).addEventListener('input', GO.debounce(e => { CF.q = e.target.value; redraw(); }, 150));
    $('#dl-type', main).addEventListener('change', e => { CF.type = e.target.value; redraw(); });
    $('#dl-dossier', main).addEventListener('change', e => { CF.dossier = e.target.value; GO.setHash('#/courriers' + (CF.dossier !== 'all' ? '?dossier=' + CF.dossier : '')); redraw(); });
    $('#dl-list', main).addEventListener('click', e => { const b = e.target.closest('[data-doc]'); if (b) location.hash = '#/courriers/' + b.dataset.doc; });
    drawDocList(main);
    const list = docList();
    const target = r.id && GO.getDoc(r.id) ? r.id : (!small() && list[0] ? list[0].id : null);
    selectDoc(target, !!r.id);
  }

  function drawDocList(main) {
    const list = docList();
    $('#dl-count', main).innerHTML = `<strong>${list.length}</strong> document${list.length > 1 ? 's' : ''}`;
    $('#dl-list', main).innerHTML = list.length ? list.map((x, i) => `
      <button type="button" class="doc-item row-in" role="listitem" style="--i:${i}" data-doc="${x.id}" aria-current="${x.id === CF.sel}">
        <span class="doc-ico t-${x.type}">${icon(x.type === 'note' ? 'stamp' : x.type === 'decision' ? 'medal' : x.type === 'piece' ? 'paperclip' : 'mail')}</span>
        <span><strong>${esc(x.title)}</strong>
          <span class="doc-item-meta"><span class="ref">${x.dossier}</span><span>${esc(D.docTypes[x.type])}</span><span>${fmtDate(x.date, 'short')}</span></span>
          ${GO.docBadge(x.state)}</span>
      </button>`).join('') : GO.empty('search', 'Aucun document', 'Aucun document ne correspond à ces critères.');
  }

  function selectDoc(id, userAction) {
    CF.sel = id;
    const v = $('#viewer');
    if (!v) return;
    $$('#dl-list [data-doc]').forEach(b => b.setAttribute('aria-current', b.dataset.doc === id));
    if (!id) {
      v.classList.remove('is-open');
      v.innerHTML = `<div class="viewer-stage" style="place-items:center;display:grid">${GO.empty('file', 'Aucun document sélectionné', 'Choisissez un courrier ou une pièce dans la liste pour l’afficher ici.')}</div>`;
      return;
    }
    const doc = GO.getDoc(id);
    if (!doc || !GO.myDocs().includes(doc)) { GO.toast('error', 'Document indisponible', 'Ce document n’existe pas ou n’est pas accessible avec ce profil.'); return selectDoc(null); }
    const list = docList(); const idx = list.findIndex(x => x.id === id);
    const canVisa = GO.can('visa') && doc.state === 'attente_visa';
    v.classList.add('is-open');
    v.innerHTML = `
      <div class="viewer-bar">
        <div class="viewer-title"><strong>${esc(doc.title)}</strong><span><span class="ref">${doc.dossier}</span> · ${esc(D.docTypes[doc.type])}${doc.number ? ' · ' + esc(doc.number) : ''}</span></div>
        <div class="viewer-tools">
          <button class="icon-btn" type="button" data-v="prev" aria-label="Document précédent" ${idx <= 0 ? 'disabled' : ''}>${icon('chevron-left')}</button>
          <span class="zoom-val" aria-live="polite">${idx >= 0 ? `${idx + 1} / ${list.length}` : '—'}</span>
          <button class="icon-btn" type="button" data-v="next" aria-label="Document suivant" ${idx < 0 || idx >= list.length - 1 ? 'disabled' : ''}>${icon('chevron-right')}</button>
          <span class="sep" aria-hidden="true"></span>
          <button class="icon-btn" type="button" data-v="zout" aria-label="Réduire le zoom">${icon('zoom-out')}</button>
          <span class="zoom-val" id="zoom-val">${Math.round(CF.zoom * 100)} %</span>
          <button class="icon-btn" type="button" data-v="zin" aria-label="Agrandir le zoom">${icon('zoom-in')}</button>
          <span class="sep" aria-hidden="true"></span>
          ${canVisa ? `<button class="btn btn-navy btn-sm" type="button" data-v="visa">${icon('stamp', 'ic-sm')}Apposer le visa</button>` : ''}
          <a class="btn btn-ghost btn-sm" href="#/dossiers/${doc.dossier}">Dossier</a>
          <button class="icon-btn" type="button" data-v="close" aria-label="Fermer l’aperçu">${icon('x')}</button>
        </div>
      </div>
      <div class="viewer-stage" id="v-stage" tabindex="0" aria-label="Zone de lecture du document"><div class="skeleton" style="width:min(640px,100%);height:520px;border-radius:2px"></div></div>
      <dl class="viewer-meta">
        <div><dt>Type</dt><dd>${esc(D.docTypes[doc.type])}</dd></div>
        <div><dt>Date</dt><dd>${fmtDate(doc.date)}</dd></div>
        <div><dt>${doc.type === 'entrant' || doc.type === 'piece' ? 'Expéditeur' : 'Auteur'}</dt><dd>${esc(doc.from)}</dd></div>
        <div><dt>État</dt><dd id="v-state">${GO.docBadge(doc.state)}</dd></div>
      </dl>`;
    v.onclick = e => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      const a = b.dataset.v;
      if (a === 'prev' && idx > 0) location.hash = '#/courriers/' + list[idx - 1].id;
      if (a === 'next' && idx < list.length - 1) location.hash = '#/courriers/' + list[idx + 1].id;
      if (a === 'zin' || a === 'zout') { CF.userZoom = true; CF.zoom = Math.min(1.5, Math.max(0.6, +(CF.zoom + (a === 'zin' ? 0.1 : -0.1)).toFixed(2))); applyZoom(); }
      if (a === 'close') { GO.setHash('#/courriers'); const btn = $(`#dl-list [data-doc="${id}"]`); selectDoc(null); if (btn) btn.focus(); }
      if (a === 'visa') visa(doc);
      if (a === 'renum') renum(doc);
    };
    if (small() && userAction) { v.scrollTop = 0; requestAnimationFrame(() => $('[data-v="close"]', v).focus()); }
    setTimeout(() => {
      if (CF.sel !== id) return;
      const stage = $('#v-stage');
      stage.innerHTML = paperFor(doc);
      applyZoom(true);
    }, GO.reduced() ? 20 : 260);
  }

  function applyZoom(fit) {
    const p = $('.paper'), wrap = $('.paper-wrap'), stage = $('#v-stage');
    // Sur petit écran, la page est d'abord ajustée à la largeur disponible
    if (fit && p && stage && !CF.userZoom) CF.zoom = Math.min(1, Math.max(0.5, +((stage.clientWidth - 32) / p.offsetWidth).toFixed(2)));
    if (p && wrap) {
      p.style.transformOrigin = 'top left';
      p.style.transform = `scale(${CF.zoom})`;
      wrap.style.width = (p.offsetWidth * CF.zoom) + 'px';
      wrap.style.height = (p.offsetHeight * CF.zoom) + 'px';
    }
    const z = $('#zoom-val'); if (z) z.textContent = Math.round(CF.zoom * 100) + ' %';
  }

  /* ---------- Rendu des documents ---------- */
  const initials = name => name.split(/\s+/).filter(w => /^[A-ZÉ]/.test(w)).map(w => w[0]).join('').slice(0, 3);
  function lhState(doc, place = 'Libreville') {
    return `<div class="lh"><div class="lh-left"><b>République gabonaise</b><br><em>Union – Travail – Justice</em><span class="lh-sep"></span>Service des Distinctions nationales</div>
      <div class="lh-right">${place}, le ${fmtDate(doc.date)}<br>${esc(doc.number || '')}</div></div>`;
  }
  function lhOrg(doc, o) {
    return `<div class="lh"><div class="lh-left" style="text-transform:none;letter-spacing:0"><span class="lh-org-mark">${esc(initials(o.name))}</span><div class="lh-org">${esc(o.name)}</div>${esc(o.city)} · ${esc(o.phone)}<br>${esc(o.email)}</div>
      <div class="lh-right">${esc(o.city)}, le ${fmtDate(doc.date)}<br>${esc(doc.number || '')}</div></div>`;
  }
  const scanSign = label => `<div class="scan-sign">${esc(label)}</div>`;
  function visaZone(doc) {
    if (doc.visa) return `<div class="visa-zone is-set" id="visa-zone"><div class="vz-label">Visa interne</div>
      <div class="vz-set"><b>${esc(doc.visa.by)}</b><span>${esc(doc.visa.role)}</span><span class="tnum">Le ${fmtDate(doc.visa.date)} à ${esc(doc.visa.time)}</span>
      <span class="vz-legal">Mention de circuit enregistrée dans GAB-ORIENT. Ne constitue pas une signature électronique.</span></div></div>`;
    return `<div class="visa-zone" id="visa-zone"><div class="vz-label">Emplacement réservé au visa</div><p class="vz-empty">Aucun visa apposé. Le visa interne du Chef du Service s’affichera ici, sans valeur de signature.</p></div>`;
  }
  function paperFrame(doc, inner, scan) {
    return `<div class="paper-wrap"><article class="paper ${scan ? 'is-scan' : ''}" aria-label="${esc(doc.title)}">${inner}
      <div class="paper-foot"><span>${scan ? 'Copie numérisée' : 'Document GAB-ORIENT'} · ${esc(doc.dossier)}</span><span>Page 1 / ${doc.pages || 1}</span></div></article></div>`;
  }

  function paperFor(doc) {
    const d = GO.getDossier(doc.dossier), o = GO.org(d.org), n = d.recipients.length;
    if (doc.state === 'illisible' || doc.state === 'renum') {
      const renumAsked = doc.state === 'renum';
      return `<div class="viewer-state"><div class="alert ${renumAsked ? 'alert-warn' : 'alert-error'}">${icon(renumAsked ? 'clock' : 'alert-circle')}<div>
        <strong>${renumAsked ? 'Nouvelle numérisation demandée' : 'Le fichier numérisé est illisible'}</strong>
        <p style="margin-top:4px">${renumAsked ? `Une nouvelle numérisation de « ${esc(doc.title)} » a été demandée à ${esc(o.name)}. Le document sera remplacé à réception.` : `La numérisation de « ${esc(doc.title)} » (${doc.pages} pages) ne permet pas la lecture. Le contenu n’est pas exploitable pour l’instruction.`}</p>
        ${!renumAsked && !GO.role().scope ? `<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-secondary btn-sm" type="button" data-v="renum">${icon('refresh', 'ic-sm')}Demander une nouvelle numérisation</button></div>` : ''}
      </div></div></div>`;
    }
    if (doc.kind === 'upload') {
      const f = doc.file || {};
      return `<div class="viewer-state"><div class="file-card"><span class="dz-ico" style="background:var(--blue-50);color:var(--blue-700)">${icon('file', 'ic-lg')}</span>
        <div><strong style="color:var(--navy-900)">${esc(f.name || doc.title)}</strong><p class="muted" style="font-size:13px">${f.size ? (f.size / 1024).toFixed(0) + ' Ko · ' : ''}déposé le ${fmtDate(doc.date)} par ${esc(doc.from)}</p>
        <p class="muted" style="font-size:12px;margin-top:6px">L’aperçu sera disponible après traitement du fichier par le service de stockage documentaire.</p></div></div></div>`;
    }
    const sum = (() => { const c = {}; d.recipients.forEach(r => { c[r.medal] = (c[r.medal] || 0) + 1; }); return D.medals.filter(m => c[m.id]).map(m => `${m.short.toLowerCase()} : ${c[m.id]}`).join(', '); })();
    switch (doc.kind) {
      case 'demande': return paperFrame(doc, `${lhOrg(doc, o)}
        <div class="p-dest">À l’attention du<br><strong>Chef du Service des Distinctions nationales</strong><br>Libreville</div>
        <div class="p-obj"><b>Objet</b>Demande d’attribution de la médaille d’honneur du travail</div>
        <p>Madame, Monsieur,</p>
        <p>Nous avons l’honneur de solliciter l’attribution de la médaille d’honneur du travail au profit de ${n} membres de notre personnel, en reconnaissance de la qualité et de la durée de leurs services au sein de ${esc(o.name)}.</p>
        <p>Vous trouverez ci-joint la liste nominative des récipiendaires proposés (échelons ${esc(sum)}), accompagnée des pièces justificatives d’ancienneté pour chacun d’entre eux.</p>
        <p>Nous restons à votre disposition pour tout complément d’information et vous prions d’agréer, Madame, Monsieur, l’expression de notre haute considération.</p>
        <div class="p-sign"><div></div><div class="p-sign-block"><div class="role">${esc(o.contactRole)}</div>${scanSign('Signature manuscrite · copie numérisée')}<div>${esc(o.contact)}</div></div></div>`, true);
      case 'liste': return paperFrame(doc, `${lhOrg(doc, o)}
        <div class="p-title">LISTE NOMINATIVE DES RÉCIPIENDAIRES PROPOSÉS</div>
        <table><thead><tr><th>N°</th><th>Nom et prénom</th><th>Fonction</th><th>Entrée</th><th>Ancienneté</th><th>Échelon proposé</th></tr></thead><tbody>
          ${d.recipients.map((r, i) => `<tr><td>${i + 1}</td><td><b>${esc(r.nom.toUpperCase())}</b> ${esc(r.prenom)}</td><td>${esc(r.fonction)}</td><td>${fmtDate(r.entree, 'num')}</td><td>${GO.seniority(r.entree)} ans</td><td>${esc(GO.medal(r.medal).short)}</td></tr>`).join('')}
        </tbody></table>
        <p>Arrêtée à ${n} personne${n > 1 ? 's' : ''}.</p>
        <div class="p-sign"><div></div><div class="p-sign-block"><div class="role">${esc(o.contactRole)}</div>${scanSign('Signature manuscrite · copie numérisée')}<div>${esc(o.contact)}</div></div></div>`, true);
      case 'transmission': return paperFrame(doc, `${lhState(doc)}
        <div class="p-title">NOTE DE TRANSMISSION</div>
        <div class="p-obj"><b>À</b>Monsieur le Directeur général</div>
        <div class="p-obj"><b>De</b>Chef du Service des Distinctions nationales</div>
        <div class="p-obj"><b>Objet</b>Transmission pour décision du dossier ${esc(d.ref)} — ${esc(o.name)}</div>
        <p>J’ai l’honneur de vous transmettre, pour décision, le dossier ${esc(d.ref)} déposé le ${fmtDate(d.depot)} par ${esc(o.name)} (${esc(o.sector.toLowerCase())}, ${esc(o.city)}).</p>
        <p>La demande porte sur ${n} récipiendaire${n > 1 ? 's' : ''} (échelons ${esc(sum)}). L’instruction a porté sur la recevabilité de la demande, la cohérence de la liste nominative et la présence des pièces justificatives d’ancienneté.</p>
        <p>Le dossier complet est joint à la présente note.</p>
        <div class="p-sign">${visaZone(doc)}<div class="p-sign-block"><div class="role">Le Chef du Service des Distinctions</div>${scanSign('Signature : original papier')}<div>Joséphine Mba-Ondo</div></div></div>`);
      case 'complement': return paperFrame(doc, `${lhState(doc)}
        <div class="p-dest"><strong>${esc(o.name)}</strong><br>À l’attention de ${esc(o.contact)}<br>${esc(o.contactRole)}<br>${esc(o.city)}</div>
        <div class="p-obj"><b>Objet</b>Demande de pièces complémentaires — dossier ${esc(d.ref)}</div>
        <p>Madame, Monsieur,</p>
        <p>L’instruction de votre demande d’attribution de distinctions, enregistrée sous la référence ${esc(d.ref)}, nécessite les éléments complémentaires suivants :</p>
        <p style="padding:10px 14px;background:#f6f7f9;border-left:3px solid var(--yellow-500);font-style:italic">${esc(doc.request || '')}</p>
        <p>L’instruction reprendra à réception de ces éléments. Je vous prie d’agréer, Madame, Monsieur, l’expression de ma considération distinguée.</p>
        <div class="p-sign"><div></div><div class="p-sign-block"><div class="role">Le Chef du Service des Distinctions</div>${scanSign('Signature : original papier')}<div>Joséphine Mba-Ondo</div></div></div>`);
      case 'decision': return paperFrame(doc, `${lhState(doc)}
        <div class="p-title">${doc.decision === 'refuse' ? 'DÉCISION DE REFUS' : 'DÉCISION D’ATTRIBUTION'}</div>
        <div class="p-obj"><b>Référence</b>${esc(doc.number)}</div>
        <div class="p-obj"><b>Dossier</b>${esc(d.ref)} — ${esc(o.name)}</div>
        <p>Vu la demande déposée le ${fmtDate(d.depot)} par ${esc(o.name)} ;</p>
        <p>Vu la note de transmission du Service des Distinctions nationales ;</p>
        <p>${doc.decision === 'refuse' ? 'L’attribution des distinctions proposées n’est pas accordée.' : `Les distinctions proposées sont attribuées aux ${n} récipiendaires figurant sur la liste nominative annexée au dossier ${esc(d.ref)}.`}</p>
        <div class="p-sign"><div></div><div class="p-sign-block"><div class="role">L’autorité compétente</div>${scanSign('Copie numérisée versée au dossier')}</div></div>`, true);
      case 'convocation': {
        const c = GO.cersOf(d.ref)[0]; const v = c ? GO.venue(c.venue) : null;
        return paperFrame(doc, `${lhState(doc)}
        <div class="p-dest"><strong>${esc(o.name)}</strong><br>À l’attention de ${esc(o.contact)}<br>${esc(o.city)}</div>
        <div class="p-obj"><b>Objet</b>Convocation à la cérémonie de remise des distinctions — ${esc(d.ref)}</div>
        <p>Madame, Monsieur,</p>
        <p>J’ai l’honneur de vous informer que la cérémonie de remise des distinctions attribuées aux ${n} récipiendaires de votre organisme se tiendra le <strong>${c ? fmtDate(c.date, 'full') : '—'}</strong> à <strong>${c ? esc(c.time.replace(':', ' h ')) : '—'}</strong>, ${v ? esc(v.name) + ', ' + esc(v.city) : ''}.</p>
        <p>Je vous remercie de bien vouloir informer les récipiendaires et confirmer leur présence auprès du Service des Distinctions.</p>
        <div class="p-sign"><div></div><div class="p-sign-block"><div class="role">Le Chef du Service des Distinctions</div>${scanSign('Signature : original papier')}<div>Joséphine Mba-Ondo</div></div></div>`);
      }
    }
    return paperFrame(doc, `${lhState(doc)}<p>${esc(doc.title)}</p>`);
  }

  async function visa(doc) {
    const d = GO.getDossier(doc.dossier);
    const ok = await GO.confirmDialog({
      title: 'Apposer le visa interne', tone: 'blue', icon: 'stamp', confirm: 'Apposer le visa',
      message: `<div class="modal-summary"><div><dt>Document</dt><dd>${esc(doc.title)}</dd></div><div><dt>Dossier</dt><dd class="ref">${esc(doc.dossier)}</dd></div><div><dt>Visa de</dt><dd>${esc(GO.user().name)}</dd></div></div>
        <p style="margin-top:12px">Le visa interne atteste votre prise de connaissance dans le circuit GAB-ORIENT et autorise la transmission. <strong>Il ne constitue pas une signature électronique.</strong></p>`,
      check: 'J’ai pris connaissance de la note et des pièces du dossier.'
    });
    if (!ok) return;
    const s = GO.stamp();
    doc.state = 'vise';
    doc.visa = { by: GO.user().name, role: GO.user().title, date: s.date, time: s.time };
    GO.addHistory(d, 'visa', 'Visa interne apposé sur la note de transmission');
    GO.S.notifications.filter(n => n.doc === doc.id).forEach(n => { n.read = true; });
    GO.commit();
    const zone = $('#visa-zone');
    if (zone) zone.outerHTML = visaZone(doc);
    $('#v-state').innerHTML = GO.docBadge('vise');
    const vb = $('[data-v="visa"]'); if (vb) vb.remove();
    drawDocList($('#view'));
    GO.toast('success', 'Visa interne enregistré', `${esc(doc.dossier)} peut désormais être transmis.`);
  }

  async function renum(doc) {
    const d = GO.getDossier(doc.dossier), o = GO.org(d.org);
    const ok = await GO.confirmDialog({ title: 'Demander une nouvelle numérisation ?', tone: 'yellow', icon: 'refresh', confirm: 'Envoyer la demande',
      message: `<p>${esc(o.name)} sera invité à transmettre de nouveau « ${esc(doc.title)} » dans un format lisible.</p>` });
    if (!ok) return;
    doc.state = 'renum';
    GO.addHistory(d, 'courrier', 'Nouvelle numérisation demandée : ' + doc.title);
    GO.notify({ type: 'complement', aud: 'org:' + d.org, ref: d.ref, title: 'Document à renvoyer', msg: `Le fichier « ${doc.title} » est illisible. Merci de le transmettre de nouveau.` });
    GO.commit();
    drawDocList($('#view'));
    selectDoc(doc.id);
    GO.toast('success', 'Demande envoyée', `${esc(o.name)} a été informé.`);
  }

  GO.views.courriers = {
    render: renderCourriers,
    update(r) {
      if (r.params.get('dossier') && r.params.get('dossier') !== CF.dossier) { CF.dossier = r.params.get('dossier'); $('#dl-dossier').value = CF.dossier; drawDocList($('#view')); }
      selectDoc(r.id || null, true);
    }
  };

  /* ======================= NOTIFICATIONS ======================= */
  const NF = { filter: 'all', type: 'all' };
  const NTYPES = { all: 'Toutes les catégories', depot: 'Dépôts et compléments reçus', visa: 'Visas', complement: 'Compléments et relances', transmission: 'Transmissions', decision: 'Décisions', ceremonie: 'Cérémonies', conflit: 'Conflits' };

  function groupLabel(date) {
    const n = GO.ageDays(date);
    if (n <= 0) return 'Aujourd’hui';
    if (n === 1) return 'Hier';
    if (n < 7) return 'Cette semaine';
    return 'Plus anciennes';
  }

  function renderNotifs(main) {
    main.innerHTML = `
      <section class="page-head reveal">
        <div><div class="page-eyebrow">Suivi</div><h1 class="page-title">Notifications</h1><p class="page-sub">Événements des dossiers qui vous concernent : dépôts, visas, compléments, décisions et cérémonies.</p></div>
        <div class="page-actions"><button class="btn btn-secondary" type="button" id="nt-all">${icon('check')}Tout marquer comme lu</button></div>
      </section>
      <section class="card reveal" style="--i:1">
        <div class="notif-toolbar">
          <div class="tabs" role="tablist" aria-label="Filtrer les notifications"><span class="tab-ink" aria-hidden="true"></span>
            <button class="tab" role="tab" type="button" data-tab="all" aria-selected="${NF.filter === 'all'}" aria-controls="nt-list">Toutes <span class="chip-n" id="nt-n-all"></span></button>
            <button class="tab" role="tab" type="button" data-tab="unread" aria-selected="${NF.filter === 'unread'}" aria-controls="nt-list">Non lues <span class="chip-n" id="nt-n-unread"></span></button>
          </div>
          <div style="width:min(260px,100%)"><label class="sr-only" for="nt-type">Catégorie</label><select class="select" id="nt-type">${Object.entries(NTYPES).map(([k, v]) => `<option value="${k}" ${k === NF.type ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        </div>
        <div id="nt-list" role="tabpanel" aria-live="polite"></div>
      </section>`;
    GO.tabs(main, t => { NF.filter = t; drawNotifs(main); });
    $('#nt-type', main).addEventListener('change', e => { NF.type = e.target.value; drawNotifs(main); });
    $('#nt-all', main).addEventListener('click', () => {
      const list = GO.myNotifs().filter(n => !n.read);
      if (!list.length) return;
      list.forEach(n => { n.read = true; });
      GO.commit(); drawNotifs(main);
      GO.toast('success', 'Notifications lues', `${plural(list.length, 'notification marquée', 'notifications marquées')} comme lue${list.length > 1 ? 's' : ''}.`);
    });
    $('#nt-list', main).addEventListener('click', e => {
      const t = e.target.closest('[data-toggle]');
      if (t) {
        const n = GO.S.notifications.find(x => x.id === t.dataset.toggle);
        n.read = !n.read; GO.commit();
        const row = t.closest('.notif');
        if (NF.filter === 'unread' && n.read) { row.classList.add('is-leaving'); setTimeout(() => drawNotifs(main, true), GO.reduced() ? 0 : 240); }
        else drawNotifs(main, true);
        return;
      }
      const o = e.target.closest('[data-open-n]');
      if (o) { const n = GO.S.notifications.find(x => x.id === o.dataset.openN); if (n && !n.read) { n.read = true; GO.commit(); } }
    });
    drawNotifs(main);
  }

  function drawNotifs(main, keepFocus) {
    const all = GO.myNotifs().slice().sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    const unread = all.filter(n => !n.read).length;
    $('#nt-n-all', main).textContent = all.length;
    $('#nt-n-unread', main).textContent = unread;
    $('#nt-all', main).disabled = !unread;
    let list = NF.filter === 'unread' ? all.filter(n => !n.read) : all;
    if (NF.type !== 'all') list = list.filter(n => n.type === NF.type);
    const focusId = keepFocus && document.activeElement && document.activeElement.dataset.toggle;
    if (!list.length) {
      $('#nt-list', main).innerHTML = NF.filter === 'unread' && NF.type === 'all'
        ? GO.empty('check-circle', 'Vous êtes à jour', 'Toutes les notifications ont été lues. Les nouveaux événements apparaîtront ici.', '<button class="btn btn-secondary btn-sm" type="button" data-show-all>Afficher toutes les notifications</button>')
        : GO.empty('bell', 'Aucune notification', 'Aucune notification ne correspond à ce filtre.');
      const b = $('[data-show-all]', main); if (b) b.addEventListener('click', () => { $('[data-tab="all"]', main).click(); });
      return;
    }
    let g = '';
    $('#nt-list', main).innerHTML = list.map((n, i) => {
      const lab = groupLabel(n.date); const head = lab !== g ? `<div class="notif-group">${lab}</div>` : ''; g = lab;
      const hasDoc = n.doc && GO.getDoc(n.doc) && GO.myDocs().includes(GO.getDoc(n.doc));
      return `${head}<article class="notif row-in ${n.read ? '' : 'is-unread'}" style="--i:${Math.min(i, 10)}" aria-label="${n.read ? '' : 'Non lue : '}${esc(n.title)}">
        <span class="notif-ico ni-${n.type}" aria-hidden="true">${icon(GO.NOTIF_ICON[n.type] || 'bell')}</span>
        <div class="notif-main">
          <div class="notif-top"><h2 class="notif-title" style="font-size:14px">${esc(n.title)}</h2>${n.ref ? `<span class="ref-chip ref">${esc(n.ref)}</span>` : ''}</div>
          <p class="notif-msg">${esc(n.msg)}</p>
          <div class="notif-actions">
            ${n.ref ? `<a class="btn btn-secondary btn-xs" href="#/dossiers/${esc(n.ref)}" data-open-n="${n.id}">${icon('folder', 'ic-sm')}Ouvrir le dossier</a>` : ''}
            ${hasDoc ? `<a class="btn btn-secondary btn-xs" href="#/courriers/${n.doc}" data-open-n="${n.id}">${icon('file', 'ic-sm')}Consulter le courrier</a>` : ''}
            ${n.type === 'conflit' || n.type === 'ceremonie' ? `<a class="btn btn-ghost btn-xs" href="#/ceremonies" data-open-n="${n.id}">${icon('calendar', 'ic-sm')}Calendrier</a>` : ''}
          </div>
        </div>
        <div class="notif-time"><time datetime="${n.date}T${n.time}">${esc(GO.ageDays(n.date) <= 1 ? n.time : fmtDate(n.date, 'dm') + ' · ' + n.time)}</time>
          <button class="btn btn-ghost btn-xs" type="button" data-toggle="${n.id}">${n.read ? 'Marquer non lue' : 'Marquer comme lue'}</button></div>
      </article>`;
    }).join('');
    if (focusId) { const b = $(`[data-toggle="${focusId}"]`, main); if (b) b.focus(); }
  }

  GO.views.notifications = { render: renderNotifs };
})(window.GO);
