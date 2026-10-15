/* ==========================================================================
   GAB-ORIENT — Courriers, registre des transmissions et notifications
   Vues : « Courriers et documents » (aperçu du document), « Registre des
   courriers » (tenue du registre par les secrétariats), « Notifications ».
   ========================================================================== */
(function (GO) {
  'use strict';
  const { $, $$, esc, icon, D, fmtDate, relDay, plural, norm } = GO;
  const ui = GO.ui;

  /* ======================= COURRIERS ======================= */
  const CF = { q: '', type: 'all', dossier: 'all', state: 'all', zoom: 1, sel: null };
  const small = () => window.matchMedia('(max-width: 860px)').matches;

  function docList() {
    const q = norm(CF.q.trim());
    return GO.myDocs()
      .filter(x => (CF.type === 'all' || x.type === CF.type) && (CF.dossier === 'all' || x.dossier === CF.dossier) && (CF.state === 'all' || x.state === CF.state))
      .filter(x => !q || norm(`${x.title} ${x.dossier} ${x.from} ${x.number || ''}`).includes(q))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }

  function renderCourriers(main, r) {
    if (r.params.get('dossier')) CF.dossier = r.params.get('dossier');
    const dossiers = [...new Set(GO.myDocs().map(x => x.dossier))].sort();
    if (CF.dossier !== 'all' && !dossiers.includes(CF.dossier)) CF.dossier = 'all';
    main.innerHTML = `
      ${ui.head({ eyebrow: 'Consultation', title: GO.role().scope && GO.role().scope.kind === 'authority' ? 'Courriers de l’autorité' : 'Courriers et documents',
        sub: 'Courriers numérisés, notes internes, pièces justificatives, décisions et quittances rattachés aux dossiers.' })}
      <div class="doc-layout">
        <section class="card doc-list-card reveal" style="--i:1" aria-labelledby="dl-t">
          <div class="card-head" style="min-height:48px;padding:12px 14px"><h2 class="card-title" id="dl-t" style="font-size:15px">${icon('inbox')}Documents</h2><span class="result-count" id="dl-count" aria-live="polite"></span></div>
          <div class="doc-filters">
            <div class="search-field"><label class="sr-only" for="dl-q">Rechercher un document</label>${icon('search')}<input class="input" id="dl-q" type="search" placeholder="Titre, expéditeur, référence…" value="${esc(CF.q)}" style="height:36px"></div>
            <div class="doc-filters-row">
              <div><label class="sr-only" for="dl-type">Type</label><select class="select" id="dl-type"><option value="all">Tous les types</option>${Object.entries(D.docTypes).map(([k, v]) => `<option value="${k}" ${k === CF.type ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
              <div><label class="sr-only" for="dl-state">État</label><select class="select" id="dl-state"><option value="all">Tous les états</option>${Object.entries(D.docStates).map(([k, v]) => `<option value="${k}" ${k === CF.state ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
              <div><label class="sr-only" for="dl-dossier">Dossier</label><select class="select" id="dl-dossier"><option value="all">Tous les dossiers</option>${dossiers.map(d => `<option value="${d}" ${d === CF.dossier ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
            </div>
          </div>
          <div class="doc-list" id="dl-list" role="list"></div>
        </section>
        <section class="card viewer reveal" style="--i:2" id="viewer" aria-label="Aperçu du document"></section>
      </div>`;
    const redraw = () => drawDocList(main);
    $('#dl-q', main).addEventListener('input', GO.debounce(e => { CF.q = e.target.value; redraw(); }, 150));
    $('#dl-type', main).addEventListener('change', e => { CF.type = e.target.value; redraw(); });
    $('#dl-state', main).addEventListener('change', e => { CF.state = e.target.value; redraw(); });
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
      <button type="button" class="doc-item row-in" role="listitem" style="--i:${Math.min(i, 12)}" data-doc="${x.id}" aria-current="${x.id === CF.sel}">
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
    const d = GO.getDossier(doc.dossier);
    const list = docList(); const idx = list.findIndex(x => x.id === id);
    const canVisa = GO.can('visa') && doc.state === 'attente_visa';
    const canRenum = (GO.can('verify') || GO.can('instruct') || GO.isFamily('inspection')) && (doc.state === 'illisible' || doc.state === 'depose');
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
          ${canRenum ? `<button class="btn btn-secondary btn-sm" type="button" data-v="renum">${icon('refresh', 'ic-sm')}Demander une renumérisation</button>` : ''}
          ${d && GO.role().views.includes('dossiers') ? `<a class="btn btn-ghost btn-sm" href="#/dossiers/${doc.dossier}">Dossier</a>` : ''}
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
      if (!stage || !stage.isConnected) return; // la vue a pu être quittée entre-temps
      stage.innerHTML = paperFor(doc);
      applyZoom(true);
    }, GO.reduced() ? 20 : 260);
  }

  function applyZoom(fit) {
    const p = $('.paper'), wrap = $('.paper-wrap'), stage = $('#v-stage');
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
  function lhAuthority(doc, a) {
    return `<div class="lh"><div class="lh-left"><b>République gabonaise</b><br><em>Union – Travail – Justice</em><span class="lh-sep"></span>${esc(a.unit)}</div>
      <div class="lh-right">${esc(a.office)}, le ${fmtDate(doc.date)}<br>${esc(doc.number || '')}</div></div>`;
  }
  function lhOrg(doc, o) {
    return `<div class="lh"><div class="lh-left" style="text-transform:none;letter-spacing:0"><span class="lh-org-mark">${esc(initials(o.name))}</span><div class="lh-org">${esc(o.name)}</div>${esc(o.city)} · ${esc(o.phone)}<br>${esc(o.email)}</div>
      <div class="lh-right">${esc(o.city)}, le ${fmtDate(doc.date)}<br>${esc(doc.number || '')}</div></div>`;
  }
  function lhRegie(doc, place = 'Libreville') {
    return `<div class="lh"><div class="lh-left"><b>République gabonaise</b><br><em>Union – Travail – Justice</em><span class="lh-sep"></span>Régie des médailles et distinctions</div>
      <div class="lh-right">${place}, le ${fmtDate(doc.date)}<br>${esc(doc.number || '')}</div></div>`;
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
  const paperFor = doc => {
    const d = GO.getDossier(doc.dossier), o = GO.org(d.org), a = GO.authority(d.authority);
    return PAPER(doc, d, o, a);
  };

  function PAPER(doc, d, o, a) {
    const n = d.recipients.length;
    if (doc.state === 'illisible' || doc.state === 'renum') {
      const asked = doc.state === 'renum';
      return `<div class="viewer-state"><div class="alert ${asked ? 'alert-warn' : 'alert-error'}">${icon(asked ? 'clock' : 'alert-circle')}<div>
        <strong>${asked ? 'Nouvelle numérisation demandée' : 'Le fichier numérisé est illisible'}</strong>
        <p style="margin-top:4px">${asked ? `Une nouvelle numérisation de « ${esc(doc.title)} » a été demandée à ${esc(o.name)}. Le document sera remplacé à réception.` : `La numérisation de « ${esc(doc.title)} » (${doc.pages || 1} pages) ne permet pas la lecture. Le contenu n’est pas exploitable pour l’instruction.`}</p>
        ${!asked && (GO.can('verify') || GO.can('instruct')) ? `<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-secondary btn-sm" type="button" data-v="renum">${icon('refresh', 'ic-sm')}Demander une nouvelle numérisation</button></div>` : ''}
      </div></div></div>`;
    }
    if (doc.kind === 'upload' || doc.kind === 'liste' || doc.kind === 'attestations') {
      const f = doc.file || {};
      const isList = doc.kind === 'liste';
      const isAtt = doc.kind === 'attestations';
      if (isList) return paperFrame(doc, `${lhOrg(doc, o)}
        <div class="p-title">LISTE NOMINATIVE DES RÉCIPIENDAIRES PROPOSÉS</div>
        <table><thead><tr><th>N°</th><th>Nom et prénom</th><th>Fonction</th><th>Entrée</th><th>Ancienneté</th><th>Échelon proposé</th></tr></thead><tbody>
          ${d.recipients.map((r, i) => `<tr><td>${i + 1}</td><td><b>${esc(r.nom.toUpperCase())}</b> ${esc(r.prenom)}</td><td>${esc(r.fonction)}</td><td>${fmtDate(r.entree, 'num')}</td><td>${GO.seniority(r.entree)} ans</td><td>${esc(GO.medal(r.medal).short)}</td></tr>`).join('')}
        </tbody></table>
        <p>Arrêtée à ${n} personne${n > 1 ? 's' : ''}.</p>
        <div class="p-sign"><div></div><div class="p-sign-block"><div class="role">${esc(o.contactRole)}</div>${scanSign('Signature manuscrite · copie numérisée')}<div>${esc(o.contact)}</div></div></div>`, true);
      if (isAtt) {
        const t = GO.S.dts.find(x => x.dossier === d.ref) || {};
        return paperFrame(doc, `${lhOrg(doc, o)}
          <div class="p-title">ATTESTATION D’ANCIENNETÉ ET DÉCLARATION DE TRAVAIL ET DE SALAIRE</div>
          <p>Nous attestons que les personnes désignées ci-dessous sont employées de ${esc(o.name)} et exercent sans interruption depuis la date indiquée.</p>
          <table><thead><tr><th>Nom et prénom</th><th>Fonction</th><th>Date d’entrée</th><th>Réf. DTS</th></tr></thead><tbody>
            ${d.recipients.map(r => { const dt = GO.S.dts.find(x => x.recipient === r.id) || {}; return `<tr><td><b>${esc(r.nom.toUpperCase())}</b> ${esc(r.prenom)}</td><td>${esc(r.fonction)}</td><td>${fmtDate(r.entree, 'num')}</td><td>${esc(dt.reference || '—')}</td></tr>`; }).join('')}</tbody></table>
          ${t.state === 'anomalie' ? `<p style="color:var(--red-700)"><b>Anomalie relevée :</b> ${esc(t.note || 'pièce illisible.')}</p>` : ''}
          <div class="p-sign"><div></div><div class="p-sign-block"><div class="role">${esc(o.contactRole)}</div>${scanSign('Signature et cachet · copie numérisée')}<div>${esc(o.contact)}</div></div></div>`, true);
      }
      return `<div class="viewer-state"><div class="file-card"><span class="dz-ico" style="background:var(--blue-50);color:var(--blue-700)">${icon('file', 'ic-lg')}</span>
        <div><strong style="color:var(--navy-900)">${esc(f.name || doc.title)}</strong><p class="muted" style="font-size:13px">${f.size ? (f.size / 1024).toFixed(0) + ' Ko · ' : ''}déposé le ${fmtDate(doc.date)} par ${esc(doc.from)}</p>
        <p class="muted" style="font-size:12px;margin-top:6px">Aperçu simulé : le prototype n’ouvre pas le fichier lui-même.</p></div></div></div>`;
    }
    const sum = (() => { const c = {}; d.recipients.forEach(r => { c[r.medal] = (c[r.medal] || 0) + 1; }); return D.medals.filter(m => c[m.id]).map(m => `${m.short.toLowerCase()} : ${c[m.id]}`).join(', '); })();
    switch (doc.kind) {
      case 'demande': return paperFrame(doc, `${lhOrg(doc, o)}
        <div class="p-dest">À l’attention du<br><strong>${esc(a.label)}</strong><br>${esc(a.office)}</div>
        <div class="p-obj"><b>Objet</b>Demande d’attribution de la médaille d’honneur du travail</div>
        <p>Madame, Monsieur,</p>
        <p>Nous avons l’honneur de solliciter l’attribution de la médaille d’honneur du travail au profit de ${n} membres de notre personnel, en reconnaissance de la qualité et de la durée de leurs services au sein de ${esc(o.name)}.</p>
        <p>Vous trouverez ci-joint la liste nominative des récipiendaires proposés (échelons ${esc(sum)}), accompagnée des déclarations de travail et de salaire et des pièces justificatives d’ancienneté pour chacun d’entre eux.</p>
        <p>Voie de dépôt : ${esc(d.channel)}.</p>
        <p>Nous restons à votre disposition pour tout complément d’information et vous prions d’agréer, Madame, Monsieur, l’expression de notre haute considération.</p>
        <div class="p-sign"><div></div><div class="p-sign-block"><div class="role">${esc(o.contactRole)}</div>${scanSign('Signature manuscrite · copie numérisée')}<div>${esc(o.contact)}</div></div></div>`, true);
      case 'transmission': return paperFrame(doc, `${lhState(doc)}
        <div class="p-title">NOTE DE TRANSMISSION</div>
        <div class="p-obj"><b>À</b>${esc(a.label)}</div>
        <div class="p-obj"><b>De</b>Chef du Service des Distinctions nationales</div>
        <div class="p-obj"><b>Objet</b>Transmission pour décision du dossier ${esc(d.ref)} — ${esc(o.name)}</div>
        <p>J’ai l’honneur de vous transmettre, pour décision, le dossier ${esc(d.ref)} déposé le ${fmtDate(d.depot)} par ${esc(o.name)} (${esc(o.sector.toLowerCase())}, ${esc(o.city)}), enregistré au registre sous la voie « ${esc(d.channel)} ».</p>
        <p>La demande porte sur ${n} récipiendaire${n > 1 ? 's' : ''} (échelons ${esc(sum)}). L’instruction a porté sur la recevabilité de la demande, la cohérence de la liste nominative, la vérification des déclarations de travail et de salaire et la présence des pièces justificatives d’ancienneté.</p>
        <p>Le dossier complet est joint à la présente note.</p>
        <div class="p-sign">${visaZone(doc)}<div class="p-sign-block"><div class="role">Le Chef du Service des Distinctions</div>${scanSign('Signature : original papier')}<div>Joséphine Mba-Ondo</div></div></div>`);
      case 'complement': return paperFrame(doc, `${lhState(doc)}
        <div class="p-dest"><strong>${esc(o.name)}</strong><br>À l’attention de ${esc(o.contact)}<br>${esc(o.contactRole)}<br>${esc(o.city)}</div>
        <div class="p-obj"><b>Objet</b>Demande de pièces complémentaires — dossier ${esc(d.ref)}</div>
        <p>Madame, Monsieur,</p>
        <p>L’instruction de votre demande d’attribution de distinctions, enregistrée sous la référence ${esc(d.ref)}, nécessite les éléments complémentaires suivants :</p>
        <p style="padding:10px 14px;background:#f6f7f9;border-left:3px solid var(--yellow-500);font-style:italic">${esc(doc.request || (GO.complementOf(d.ref) || {}).items || '')}</p>
        <p>L’instruction reprendra à réception de ces éléments. Je vous prie d’agréer, Madame, Monsieur, l’expression de ma considération distinguée.</p>
        <div class="p-sign"><div></div><div class="p-sign-block"><div class="role">Le Chef du Service des Distinctions</div>${scanSign('Signature : original papier')}<div>Joséphine Mba-Ondo</div></div></div>`);
      case 'relance': return paperFrame(doc, `${lhState(doc)}
        <div class="p-dest"><strong>${esc(o.name)}</strong><br>${esc(o.city)}</div>
        <div class="p-obj"><b>Objet</b>Relance — pièces complémentaires du dossier ${esc(d.ref)}</div>
        <p>Madame, Monsieur,</p>
        <p>Sauf erreur de notre part, les éléments complémentaires demandés pour l’instruction du dossier ${esc(d.ref)} ne nous sont pas encore parvenus${GO.complementOf(d.ref) ? ` (demande du ${fmtDate(GO.complementOf(d.ref).requested)}, échéance du ${fmtDate(GO.complementOf(d.ref).due)})` : ''}.</p>
        <p>Nous vous remercions de bien vouloir nous les transmettre dans les meilleurs délais, faute de quoi l’instruction demeurera suspendue.</p>
        <div class="p-sign"><div></div><div class="p-sign-block"><div class="role">Le Chef du Service des Distinctions</div>${scanSign('Signature : original papier')}<div>Joséphine Mba-Ondo</div></div></div>`);
      case 'decision': return paperFrame(doc, `${lhAuthority(doc, a)}
        <div class="p-title">${doc.decision === 'refuse' ? 'DÉCISION DE REFUS' : 'DÉCISION D’ATTRIBUTION'}</div>
        <div class="p-obj"><b>Référence</b>${esc(doc.number)}</div>
        <div class="p-obj"><b>Dossier</b>${esc(d.ref)} — ${esc(o.name)}</div>
        <p>Vu la demande déposée le ${fmtDate(d.depot)} par ${esc(o.name)} ;</p>
        <p>Vu la note de transmission du Service des Distinctions nationales ;</p>
        <p>${doc.decision === 'refuse' ? 'L’attribution des distinctions proposées n’est pas accordée.' : `Les distinctions proposées sont attribuées aux ${n} récipiendaires figurant sur la liste nominative annexée au dossier ${esc(d.ref)}.`}</p>
        <p>La présente décision est notifiée au demandeur et au Service des Distinctions nationales.</p>
        <div class="p-sign"><div></div><div class="p-sign-block"><div class="role">${esc(a.label)}</div>${scanSign('Copie numérisée versée au dossier')}</div></div>`, true);
      case 'recours': {
        const rcs = GO.recoursOf(d.ref) || {};
        const entrant = /recours gracieux/i.test(doc.title);
        if (entrant) return paperFrame(doc, `${lhOrg(doc, o)}
          <div class="p-dest">À l’attention de<br><strong>${esc(a.label)}</strong><br>${esc(a.office)}</div>
          <div class="p-obj"><b>Objet</b>Recours gracieux — dossier ${esc(d.ref)}</div>
          <p>Madame, Monsieur,</p>
          <p>Nous avons l’honneur de former un recours à l’encontre de la décision notifiée au titre du dossier ${esc(d.ref)}.</p>
          <p style="padding:10px 14px;background:#f6f7f9;border-left:3px solid var(--blue-500)">${esc(rcs.motif || '')}</p>
          <p>Les pièces jointes viennent au soutien de cette demande. Nous vous prions d’agréer, Madame, Monsieur, l’expression de notre haute considération.</p>
          <div class="p-sign"><div></div><div class="p-sign-block"><div class="role">${esc(o.contactRole)}</div>${scanSign('Signature manuscrite · copie numérisée')}<div>${esc(o.contact)}</div></div></div>`, true);
        return paperFrame(doc, `${lhAuthority(doc, a)}
          <div class="p-dest"><strong>${esc(o.name)}</strong><br>${esc(o.city)}</div>
          <div class="p-obj"><b>Objet</b>Suite donnée au recours — dossier ${esc(d.ref)}</div>
          <p>Madame, Monsieur,</p>
          <p>Après examen du recours enregistré sous la référence ${esc(rcs.id || '')} au titre du dossier ${esc(d.ref)}, la suite suivante y est donnée : <strong>${esc(rcs.state ? D.recoursStates[rcs.state].label : '')}</strong>.</p>
          <p>${esc(rcs.note || '')}</p>
          <div class="p-sign"><div></div><div class="p-sign-block"><div class="role">${esc(a.label)}</div>${scanSign('Copie numérisée versée au dossier')}</div></div>`, true);
      }
      case 'recette': {
        const or = GO.receiptOrder(d.ref) || {};
        return paperFrame(doc, `${lhState(doc)}
          <div class="p-dest"><strong>${esc(o.name)}</strong><br>À l’attention de ${esc(o.contact)}<br>${esc(o.city)}</div>
          <div class="p-obj"><b>Objet</b>Ordre de recette ${esc(or.id || '')} — dossier ${esc(d.ref)}</div>
          <p>Madame, Monsieur,</p>
          <p>Les distinctions proposées dans votre dossier ${esc(d.ref)} ont été attribuées. En conséquence, l’ordre de recette ${esc(or.id || '')} d’un montant de <strong>${esc(or.amount || '')}</strong> est émis à votre attention, à régler avant le <strong>${or.due ? fmtDate(or.due) : '—'}</strong>.</p>
          <p>Le paiement est effectué hors application, auprès du service compétent. Après paiement, le reçu (quittance) est déposé dans GAB-ORIENT puis vérifié par la Régie des médailles ; la préparation des médailles en découle.</p>
          <p style="font-size:12.5px;color:var(--muted)">Document de démonstration : aucun montant réglementaire n’est calculé par le prototype.</p>
          <div class="p-sign"><div></div><div class="p-sign-block"><div class="role">Le Chef du Service des Distinctions</div>${scanSign('Signature : original papier')}<div>Joséphine Mba-Ondo</div></div></div>`);
      }
      case 'recu': {
        const or = GO.receiptOrder(d.ref) || {}, rec = GO.receiptOf(d.ref) || {};
        return paperFrame(doc, `${lhRegie(doc, o.city)}
          <div class="p-title">REÇU DE PAIEMENT — COPIE NUMÉRISÉE</div>
          <div class="p-obj"><b>Ordre de recette</b>${esc(or.id || '')} — ${esc(or.amount || '')}</div>
          <div class="p-obj"><b>Référence du reçu</b>${esc(doc.number || rec.reference || '')}</div>
          <div class="p-obj"><b>Versant</b>${esc(doc.from)}</div>
          <p>Reçu déposé le ${fmtDate(doc.date)} au titre du règlement de l’ordre de recette ${esc(or.id || '')}.</p>
          ${rec.verifiedBy ? `<p><b>Vérification :</b> reçu contrôlé par ${esc(rec.verifiedBy)} le ${fmtDate(rec.verifiedOn)} — ${esc(rec.note || '')}.</p>` : `<p class="muted">Vérification en attente à la régie.</p>`}
          <div class="p-sign"><div></div><div class="p-sign-block"><div class="role">Régie des médailles et distinctions</div>${scanSign('Copie transmise avec le dépôt')}</div></div>`, true);
      }
      case 'demande_retrait': {
        const wd = GO.withdrawalOf(d.ref) || {};
        return paperFrame(doc, `${lhOrg(doc, o)}
          <div class="p-dest">À l’attention de<br><strong>Régie des médailles et distinctions</strong><br>Libreville</div>
          <div class="p-obj"><b>Objet</b>Demande de retrait sans cérémonie — dossier ${esc(d.ref)}</div>
          <p>Madame, Monsieur,</p>
          <p>Les récipiendaires désignés au dossier ${esc(d.ref)} ne peuvent participer à une cérémonie de remise. Nous sollicitons l’autorisation de retirer leurs distinctions à la régie.</p>
          <p style="padding:10px 14px;background:#f6f7f9;border-left:3px solid var(--yellow-500)">${esc(wd.justification || '')}</p>
          <p>Bénéficiaires concernés : ${d.recipients.map(r => `${esc(r.prenom)} ${esc(r.nom)}`).join(', ')}.</p>
          <div class="p-sign"><div></div><div class="p-sign-block"><div class="role">${esc(o.contactRole)}</div>${scanSign('Signature manuscrite · copie numérisée')}<div>${esc(o.contact)}</div></div></div>`, true);
      }
      case 'note_controle': {
        const ctl = GO.controlOf(d.ref) || {};
        return paperFrame(doc, `${lhState(doc)}
          <div class="p-title">NOTE DE CONTRÔLE DOCUMENTAIRE</div>
          <div class="p-obj"><b>Dossier</b>${esc(d.ref)} — ${esc(o.name)}</div>
          <div class="p-obj"><b>Contrôle</b>${esc(ctl.id || '')} · ${esc(ctl.scope || '')}</div>
          <p>Objet : ${esc(ctl.scope || 'contrôle documentaire')} portant sur les pièces du dossier.</p>
          ${(ctl.findings || []).length ? `<p><b>Anomalies relevées :</b></p><ul>${ctl.findings.map(f => `<li>${esc(f.code)} — ${esc(f.label)} (${esc(f.severity)})</li>`).join('')}</ul>` : '<p>Aucune anomalie relevée.</p>'}
          <p>${esc(ctl.note || '')}</p>
          <p style="font-size:12.5px;color:var(--muted)">L’inspection du travail ne prend aucune décision sur l’attribution des distinctions.</p>
          <div class="p-sign"><div></div><div class="p-sign-block"><div class="role">Inspection du travail</div>${scanSign('Note au dossier')}<div>${esc(ctl.inspector || '')}</div></div></div>`);
      }
      case 'convocation': {
        const c = GO.cersOf(d.ref)[0]; const v = c ? GO.venue(c.venue) : null;
        return paperFrame(doc, `${lhState(doc)}
        <div class="p-dest"><strong>${esc(o.name)}</strong><br>À l’attention de ${esc(o.contact)}<br>${esc(o.city)}</div>
        <div class="p-obj"><b>Objet</b>Convocation à la cérémonie de remise des distinctions — ${esc(d.ref)}</div>
        <p>Madame, Monsieur,</p>
        <p>J’ai l’honneur de vous informer que la cérémonie de remise des distinctions attribuées aux ${n} récipiendaires de votre organisme se tiendra le <strong>${c ? fmtDate(c.date, 'full') : '—'}</strong> à <strong>${c ? esc(c.time.replace(':', ' h ')) : '—'}</strong>${v ? `, ${esc(v.name)}, ${esc(v.city)}` : ''}.</p>
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
        <p style="margin-top:12px">Le visa interne atteste votre prise de connaissance dans le circuit GAB-ORIENT et autorise la transmission à ${esc(GO.authority(d.authority).label)}. <strong>Il ne constitue pas une signature électronique.</strong></p>`,
      check: 'J’ai pris connaissance de la note et des pièces du dossier.'
    });
    if (!ok) return;
    const s = GO.stamp();
    doc.state = 'vise';
    doc.visa = { by: GO.user().name, role: GO.role().label, date: s.date, time: s.time };
    GO.addHistory(d, 'visa', 'Visa interne apposé sur la note de transmission', `${GO.user().name} — ${GO.role().label}`);
    GO.S.notifications.filter(n => n.doc === doc.id).forEach(n => { n.read = true; });
    GO.commit();
    const zone = $('#visa-zone');
    if (zone) zone.outerHTML = visaZone(doc);
    $('#v-state').innerHTML = GO.docBadge('vise');
    const vb = $('[data-v="visa"]'); if (vb) vb.remove();
    drawDocList($('#view'));
    GO.refreshDossier(d, false);
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
    GO.commit(); GO.refreshDossier(d, false);
    drawDocList($('#view'));
    selectDoc(doc.id);
    GO.toast('success', 'Demande envoyée', esc(o.name));
  }

  GO.views.courriers = {
    render: renderCourriers,
    update(r) {
      if (r.params.get('dossier') && r.params.get('dossier') !== CF.dossier) { CF.dossier = r.params.get('dossier'); const el = $('#dl-dossier'); if (el) el.value = CF.dossier; drawDocList($('#view')); }
      selectDoc(r.id || null, true);
    }
  };

  /* ======================= REGISTRE DES COURRIERS ======================= */
  // Tenue du registre par les secrétariats : réception, enregistrement,
  // classement et transmission au service compétent. Aucune de ces actions ne
  // porte de décision sur le fond du dossier.
  const RF = { q: '', direction: 'all', state: 'all', dossier: 'all', sort: 'recent' };
  const TR_ACTIONS = {
    receive: { label: 'Accuser réception', icon: 'inbox', kind: 'secondary', to: ['recu'], tip: 'Confirme la date de réception au registre' },
    register: { label: 'Enregistrer au registre', icon: 'check', kind: 'primary', to: ['recu'], tip: 'Attribue la référence du registre et classe le courrier au dossier' },
    route: { label: 'Transmettre au service', icon: 'send', kind: 'primary', to: ['enregistre', 'classe'], tip: 'Transmet le dossier au Service des Distinctions nationales pour instruction' },
    classify: { label: 'Classer sans suite', icon: 'folder', kind: 'secondary', to: ['enregistre'], tip: 'Classe le courrier (sans objet, doublon, pièce déjà détenue)' }
  };

  function renderTransmissions(main, r) {
    const authority = GO.role().scope && GO.role().scope.kind === 'authority' ? GO.authority(GO.role().scope.value) : null;
    if (r.params.get('q')) RF.q = r.params.get('q');
    if (r.params.get('dossier')) RF.dossier = r.params.get('dossier');
    main.innerHTML = `
      ${ui.head({ eyebrow: 'Registre', title: authority ? `Registre — ${esc(authority.short)}` : 'Registre des courriers',
        sub: authority ? `Courriers reçus pour ${esc(authority.label)} et transmissions vers le Service des Distinctions.` : 'Registre des courriers entrants et sortants rattachés aux dossiers.',
        actions: GO.can('receive') ? `<button class="btn btn-secondary" type="button" id="tr-new">${icon('plus')}Enregistrer un courrier reçu</button>` : '' })}
      <section class="card reveal" style="--i:1">${ui.kpis(kpiTrans())}</section>
      <section class="card reveal mt" style="--i:2">
        ${ui.toolbar({ search: { id: 'tr-q', label: 'Rechercher', placeholder: 'Référence, objet, expéditeur, dossier…', value: RF.q },
          selects: [
            { id: 'tr-direction', label: 'Sens', value: RF.direction, options: [{ value: 'all', label: 'Tous les sens' }, { value: 'entrant', label: 'Entrant' }, { value: 'sortant', label: 'Sortant' }] },
            { id: 'tr-state', label: 'État', value: RF.state, options: [{ value: 'all', label: 'Tous les états' }, ...Object.entries(D.transmissionStates).map(([k, v]) => ({ value: k, label: v.label }))] },
            { id: 'tr-sort', label: 'Trier par', value: RF.sort, options: [{ value: 'recent', label: 'Le plus récent' }, { value: 'ancien', label: 'Le plus ancien' }, { value: 'ref', label: 'Référence' }] }
          ] })}
        ${ui.filterBar(`<div class="chip-row" id="tr-chips" role="group" aria-label="Filtrer par état">${ui.chips(['all', ...Object.keys(D.transmissionStates)].map(k => ({ key: k, label: k === 'all' ? 'Tous' : D.transmissionStates[k].label, n: counts(k), tone: k === 'all' ? null : D.transmissionStates[k].tone })), RF.state, { attr: 'data-s' }).replace(/^<div class="chip-row"[^>]*>|<\/div>$/g, '')}</div>`, '<span id="tr-count" aria-live="polite"></span>')}
        <div class="table-wrap" id="tr-wrap"><table class="data-table responsive" id="tr-table">
          <caption class="sr-only">Registre des courriers</caption>
          <thead><tr><th scope="col">Référence</th><th scope="col">Reçu le</th><th scope="col">Sens</th><th scope="col">Expéditeur → destinataire</th><th scope="col">Objet</th><th scope="col">Dossier</th><th scope="col">Voie</th><th scope="col">État</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
          <tbody></tbody></table><div id="tr-empty"></div></div>
      </section>`;
    const redraw = () => drawRegistry();
    $('#tr-q', main).addEventListener('input', GO.debounce(e => { RF.q = e.target.value; redraw(); }, 150));
    ['direction', 'state', 'sort'].forEach(k => { const el = $('#tr-' + k, main); if (el) el.addEventListener('change', e => { RF[k] = e.target.value; if (k === 'state') drawRegistry(); else redraw(); }); });
    $('#tr-chips', main).addEventListener('click', e => { const c = e.target.closest('[data-s]'); if (!c) return; RF.state = c.dataset.s; drawRegistry(); });
    $('#tr-table', main).addEventListener('click', e => {
      const tr = e.target.closest('tr[data-tr]'); if (!tr) return;
      openRegistryRow(tr.dataset.tr, redraw);
    });
    const nb = $('#tr-new', main);
    if (nb) nb.addEventListener('click', newCourrier);
    drawRegistry();
  }
  function counts(state) { const l = GO.myTransmissions(); return state === 'all' ? l.length : l.filter(t => t.state === state).length; }
  function kpiTrans() {
    const l = GO.myTransmissions();
    const today = l.filter(t => t.date === GO.REF_ISO).length;
    const toReg = l.filter(t => t.state === 'recu').length;
    const toRoute = l.filter(t => t.state === 'enregistre').length;
    const routed = l.filter(t => t.state === 'transmis').length;
    return [
      { label: 'Courriers au registre', count: l.length, note: `${today} enregistré(s) aujourd’hui` },
      { label: 'À accuser réception', count: toReg, note: 'arrivés le jour même' },
      { label: 'À traiter', count: toRoute, note: 'enregistrés, non transmis' },
      { label: 'Transmis au service', count: routed, note: 'pour instruction' }
    ];
  }
  function drawRegistry() {
    const q = norm(RF.q.trim());
    let list = GO.myTransmissions().filter(t => {
      const okQ = !q || norm(`${t.id} ${t.subject} ${t.from} ${t.to} ${t.dossier || ''} ${t.channel}`).includes(q);
      return okQ && (RF.direction === 'all' || t.direction === RF.direction) && (RF.state === 'all' || t.state === RF.state)
        && (RF.dossier === 'all' || t.dossier === RF.dossier);
    });
    const sorters = { recent: (a, b) => (b.date + b.time).localeCompare(a.date + a.time), ancien: (a, b) => (a.date + a.time).localeCompare(b.date + b.time), ref: (a, b) => a.id.localeCompare(b.id) };
    list = list.sort(sorters[RF.sort]);
    const cnt = $('#tr-count');
    if (cnt) cnt.innerHTML = `<strong>${list.length}</strong> ${list.length > 1 ? 'courriers affichés' : 'courrier affiché'}`;
    const chips = $('#tr-chips');
    if (chips) chips.innerHTML = ui.chips(['all', ...Object.keys(D.transmissionStates)].map(k => ({ key: k, label: k === 'all' ? 'Tous' : D.transmissionStates[k].label, n: counts(k), tone: k === 'all' ? null : D.transmissionStates[k].tone })), RF.state, { attr: 'data-s' }).replace(/^<div class="chip-row"[^>]*>|<\/div>$/g, '');
    $('#tr-table tbody').innerHTML = list.map((t, i) => `<tr class="is-clickable row-in" style="--i:${Math.min(i, 12)}" data-tr="${t.id}">
      <td class="td-head" data-label="Référence"><span class="ref">${esc(t.id)}</span>${t.file ? `<br><span class="muted" style="font-size:11.5px">courrier versé</span>` : ''}</td>
      <td data-label="Reçu le" class="tnum nowrap">${fmtDate(t.received || t.date, 'short')}<br><span class="muted" style="font-size:11.5px">${esc(t.time || '')}</span></td>
      <td data-label="Sens">${GO.badge(t.direction === 'entrant' ? 'Entrant' : 'Sortant', t.direction === 'entrant' ? 'blue' : 'green')}</td>
      <td class="td-wide" data-label="Expéditeur → destinataire"><div class="cell-org"><strong>${esc(t.from)}</strong><span>→ ${esc(t.to)}</span></div></td>
      <td class="td-wide" data-label="Objet">${esc(t.subject)}</td>
      <td data-label="Dossier">${t.dossier ? `<span class="ref">${esc(t.dossier)}</span>` : '<span class="muted">hors dossier</span>'}</td>
      <td data-label="Voie"><span class="pill">${esc(t.channel)}</span></td>
      <td data-label="État">${GO.dictBadge(D.transmissionStates, t.state)}</td>
      <td class="cell-actions"><button class="btn btn-secondary btn-sm" type="button" data-tr-open="${t.id}">Ouvrir</button></td>
    </tr>`).join('');
    $('#tr-table').hidden = !list.length;
    $('#tr-empty').innerHTML = list.length ? '' : GO.empty('inbox', 'Aucun courrier', 'Aucun courrier du registre ne correspond à ces critères.');
    $$('[data-tr-open]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openRegistryRow(b.dataset.trOpen, drawRegistry); }));
  }

  function openRegistryRow(id, redraw) {
    const t = GO.myTransmissions().find(x => x.id === id);
    if (!t) return;
    const d = t.dossier ? GO.getDossier(t.dossier) : null;
    const doc = t.file ? GO.getDoc(t.file) : null;
    const canAct = GO.can('receive') || GO.can('register') || GO.can('route') || GO.can('classify');
    const acts = canAct ? Object.entries(TR_ACTIONS).filter(([k, a]) => a.to.includes(t.state)
      && ((k === 'receive' && GO.can('receive')) || (k === 'register' && GO.can('register')) || (k === 'route' && GO.can('route')) || (k === 'classify' && GO.can('classify')))) : [];
    GO.openDrawer({
      key: 'tr:' + t.id,
      html: `<header class="drawer-head">
          <div class="drawer-head-top"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="ref-chip ref">${esc(t.id)}</span>${GO.dictBadge(D.transmissionStates, t.state)}${GO.badge(t.direction === 'entrant' ? 'Entrant' : 'Sortant', t.direction === 'entrant' ? 'blue' : 'green')}</div>
            <button class="icon-btn" type="button" data-dclose aria-label="Fermer le courrier">${icon('x')}</button></div>
          <h2 class="drawer-title" id="drawer-title">${esc(t.subject)}</h2>
          <p class="drawer-sub">${esc(t.from)} → ${esc(t.to)} · ${fmtDate(t.received || t.date)}</p>
        </header>
        <div class="drawer-body">
          <section class="d-section" style="--i:0"><div class="d-section-head"><h3>${icon('inbox')}Fiche du courrier</h3></div>
            ${ui.dl([
              ['Référence du registre', `<span class="ref">${esc(t.id)}</span>`],
              ['Date d’arrivée', `${fmtDate(t.received || t.date)} ${t.time ? '· ' + esc(t.time) : ''}`],
              ['Expéditeur', esc(t.from)],
              ['Destinataire', esc(t.to)],
              ['Autorité de rattachement', t.authority ? esc(GO.authority(t.authority).label) : '—'],
              ['Voie de transmission', esc(t.channel)],
              ['Dossier rattaché', d ? GO.refChip(t.dossier) : '<span class="muted">aucun dossier rattaché</span>'],
              ['Affecté à', t.assigned ? esc(t.assigned) : '<span class="muted">non affecté</span>'],
              ['Reçu par', esc(t.receivedOf || '—')]
            ])}
          </section>
          ${d ? `<section class="d-section" style="--i:1"><div class="d-section-head"><h3>${icon('folder')}Dossier</h3></div>
            <div class="cell-org"><strong>${esc(GO.org(d.org).name)}</strong><span>${GO.statusBadge(d.status)} · ${plural(d.recipients.length, 'récipiendaire', 'récipiendaires')}</span></div>
            <p class="hint mt">${GO.external() ? 'La transmission de ce courrier est enregistrée dans l’historique de votre dossier.' : 'Le dossier est suivi par le Service des Distinctions après transmission.'}</p></section>` : ''}
          <section class="d-section" style="--i:2"><div class="d-section-head"><h3>${icon('clock')}Suivi au registre</h3></div>
            <ol class="timeline">
              <li class="tl-item"><span class="tl-dot k-reception">${icon('inbox')}</span><div class="tl-body"><strong>Courrier reçu</strong><div class="tl-meta"><span>${esc(t.receivedOf || 'Secrétariat')}</span><span class="tnum">${fmtDate(t.received || t.date, 'short')}${t.time ? ' · ' + esc(t.time) : ''}</span></div></div></li>
              ${t.state !== 'recu' ? `<li class="tl-item"><span class="tl-dot k-courrier">${icon('check')}</span><div class="tl-body"><strong>Enregistré au registre</strong><div class="tl-meta"><span class="ref">${esc(t.id)}</span><span>${esc(t.channel)}</span></div></div></li>` : ''}
              ${t.state === 'transmis' ? `<li class="tl-item"><span class="tl-dot k-transmission">${icon('send')}</span><div class="tl-body"><strong>Transmis au Service des Distinctions nationales</strong><div class="tl-meta"><span>${esc(t.to)}</span></div></div></li>` : ''}
              ${t.state === 'classe' ? `<li class="tl-item"><span class="tl-dot k-note">${icon('folder')}</span><div class="tl-body"><strong>Classé sans suite au registre</strong></div></li>` : ''}
              ${t.state === 'traite' ? `<li class="tl-item"><span class="tl-dot k-decision">${icon('check')}</span><div class="tl-body"><strong>Traité — instruction en cours</strong></div></li>` : ''}
            </ol>
          </section>
          ${doc ? `<section class="d-section" style="--i:3"><div class="d-section-head"><h3>${icon('file')}Pièce versée</h3>${GO.role().views.includes('courriers') ? `<a class="btn btn-ghost btn-xs" href="#/courriers/${doc.id}">Ouvrir le document</a>` : ''}</div>
            <div class="doc-mini"><span class="doc-ico t-${doc.type}">${icon('file')}</span><div><strong>${esc(doc.title)}</strong><span>${esc(D.docTypes[doc.type])} · ${fmtDate(doc.date, 'short')}</span><div style="margin-top:4px">${GO.docBadge(doc.state)}</div></div>
            ${GO.role().views.includes('courriers') ? `<a class="btn btn-secondary btn-xs" href="#/courriers/${doc.id}">${icon('eye', 'ic-sm')}Consulter</a>` : ''}</div></section>` : ''}
        </div>
        <footer class="drawer-foot">
          ${acts.length ? '' : `<span class="muted" style="font-size:13px">${GO.external() ? 'Aucune action attendue de votre part : le registre est tenu par le secrétariat.' : 'Aucune action de registre disponible pour ce profil.'}</span>`}
          <span class="spacer"></span>
          ${acts.map(([k, a]) => `<span ${a.tip ? `data-tip="${esc(a.tip)}"` : ''} tabindex="0"><button class="btn btn-${a.kind}" type="button" data-tr-act="${k}">${icon(a.icon)}${esc(a.label)}</button></span>`).join('')}
        </footer>`
    });
    const root = document.querySelector('.drawer');
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-tr-act]'); if (!b) return;
      registryAction(t, b.dataset.trAct, b, redraw, () => openRegistryRow(t.id, redraw));
    });
  }

  function registryAction(t, act, btn, redraw, refresh) {
    const d = t.dossier ? GO.getDossier(t.dossier) : null;
    const run = async (extra) => {
      await GO.withLoading(btn, 420);
      if (act === 'receive') {
        t.state = 'enregistre'; t.received = GO.REF_ISO; t.receivedOf = GO.actorName();
        GO.audit(GO.actorName(), 'Réception accusée', `${t.id} — ${t.subject}`);
      } else if (act === 'register') {
        t.state = 'enregistre'; t.received = t.received || GO.REF_ISO; t.receivedOf = t.receivedOf || GO.actorName(); t.assigned = t.dossier || null;
        if (extra && extra.note) t.note = extra.note;
        GO.audit(GO.actorName(), 'Courrier enregistré', `${t.id} — ${t.dossier || 'hors dossier'}`);
      } else if (act === 'route') {
        t.state = 'transmis'; t.assigned = t.dossier || null;
        GO.audit(GO.actorName(), 'Courrier transmis au service', `${t.id} — ${t.dossier || ''}`);
        GO.notify({ type: 'transmission', aud: 'service', ref: t.dossier || '', doc: t.file || null, title: 'Courrier transmis par le secrétariat', msg: `${t.id} — ${t.subject} (${t.channel}).` });
        if (d) {
          GO.addHistory(d, 'reception', `Courrier ${t.id} transmis au Service des Distinctions`, GO.actorName());
          if (d.status === 'recu') { /* le service ouvre l'instruction depuis le dossier */ }
        }
      } else if (act === 'classify') {
        t.state = 'classe'; t.note = (extra && extra.note) || t.note;
        GO.audit(GO.actorName(), 'Courrier classé', `${t.id} — ${t.subject}`);
        if (d) GO.addHistory(d, 'note', `Courrier ${t.id} classé au registre${t.note ? ' : ' + t.note : ''}`, GO.actorName());
      }
      GO.commit();
      if (d) GO.refreshDossier(d, false);
      if (redraw) { redraw(); GO.renderCounts(); }
      GO.toast('success', TR_ACTIONS[act].label, `${t.id} — ${D.transmissionStates[t.state].label}`);
      if (refresh) { GO.closeDrawer(true); openRegistryRow(t.id, redraw); }
    };
    if (act === 'classify' || act === 'register') {
      GO.formModal({
        title: TR_ACTIONS[act].label, icon: TR_ACTIONS[act].icon, tone: act === 'classify' ? 'yellow' : 'blue',
        intro: act === 'classify'
          ? `<p>Le classement sans suite retire le courrier du circuit sans instruction. Il doit être motivé (courrier sans objet, doublon, pièce déjà au dossier).</p>`
          : `<p>L’enregistrement attribue la référence du registre et rattache le courrier au dossier. Aucune décision n’est prise à ce stade.</p>`,
        fields: act === 'classify'
          ? [{ id: 'note', label: 'Motif du classement', type: 'select', options: [{ value: 'Courrier sans objet pour l’instruction.', label: 'Courrier sans objet' }, { value: 'Doublon d’un courrier déjà enregistré.', label: 'Doublon' }, { value: 'Pièce déjà détenue par le service.', label: 'Pièce déjà au dossier' }, { value: 'Courrier adressé à une autre autorité.', label: 'Adressé à une autre autorité' }], required: true }]
          : [{ id: 'note', label: 'Observation au registre (facultatif)', type: 'textarea', rows: 2, placeholder: 'Précision pour le service instructeur…' }],
        submit: TR_ACTIONS[act].label, iconSubmit: TR_ACTIONS[act].icon,
        run: v => run(v)
      });
      return;
    }
    run(null);
  }

  function newCourrier() {
    const authority = GO.role().scope && GO.role().scope.kind === 'authority' ? GO.role().scope.value : 'dgt';
    GO.formModal({
      title: 'Enregistrer un courrier reçu', icon: 'inbox', tone: 'blue',
      intro: `<p>Enregistrement d’un courrier reçu hors dépôt en ligne : il est versé au registre de l’autorité et rattaché à un dossier lorsque c’est possible.</p>`,
      fields: [
        { id: 'dossier', label: 'Dossier rattaché', type: 'select', options: [{ value: '', label: 'Aucun dossier (courrier général)' }, ...GO.S.dossiers.filter(x => x.authority === authority).map(x => ({ value: x.ref, label: `${x.ref} — ${GO.org(x.org).short}` }))] },
        { id: 'subject', label: 'Objet du courrier', type: 'text', required: true, placeholder: 'Exemple : demande de complément adressée par le demandeur', validate: v => v.length >= 5 ? '' : 'Indiquez l’objet du courrier.' },
        { id: 'from', label: 'Expéditeur', type: 'text', required: true, placeholder: 'Organisme, autorité ou personne', validate: v => v.length >= 2 ? '' : 'Indiquez l’expéditeur.' },
        { id: 'channel', label: 'Voie de transmission', type: 'select', options: ['Courrier postal', 'Dépôt du demandeur', 'Voie électronique', 'Remise en main propre', 'Navette interne'].map(v => ({ value: v, label: v })) },
        { id: 'time', label: 'Heure de réception', type: 'text', value: GO.stamp().time, required: true, validate: v => /^\d{2}:\d{2}$/.test(v) ? '' : 'Format attendu : HH:MM.' }
      ],
      submit: 'Enregistrer au registre', iconSubmit: 'check',
      run: v => {
        const n = Math.max(149, ...GO.S.transmissions.map(x => +String(x.id).slice(-4))) + 1;
        const row = { id: 'TR-2026-' + String(n).padStart(4, '0'), date: GO.REF_ISO, time: v.time, direction: 'entrant', dossier: v.dossier || null, subject: v.subject, from: v.from, to: GO.authority(authority).label, authority, channel: v.channel, file: null, state: 'enregistre', assigned: v.dossier || null, received: GO.REF_ISO, receivedOf: GO.actorName() };
        GO.S.transmissions.unshift(row);
        const d = v.dossier ? GO.getDossier(v.dossier) : null;
        if (d) GO.addHistory(d, 'reception', `Courrier reçu et enregistré au registre (${row.id})`, GO.actorName());
        GO.audit(GO.actorName(), 'Courrier enregistré au registre', `${row.id} — ${v.subject}`);
        GO.notify({ type: 'transmission', aud: 'service', ref: v.dossier || '', title: 'Courrier enregistré au registre', msg: `${row.id} — ${v.subject}.` });
        GO.commit();
        if (GO.current().view === 'transmissions') renderTransmissions($('#view'), GO.current()); else GO.renderCounts();
        GO.toast('success', 'Courrier enregistré', `${row.id} — ${D.transmissionStates[row.state].label}`);
        void d;
      }
    });
  }
  GO.views.transmissions = { render: renderTransmissions };

  /* ======================= NOTIFICATIONS ======================= */
  const NF = { filter: 'all', type: 'all' };
  const NTYPES = { all: 'Toutes les catégories', depot: 'Dépôts et compléments reçus', visa: 'Visas', complement: 'Compléments et relances', transmission: 'Transmissions', decision: 'Décisions', ceremonie: 'Cérémonies', conflit: 'Conflits', recours: 'Recours', stock: 'Stock', controle: 'Contrôles', remise: 'Remises', paiement: 'Paiements' };
  const groupLabel = date => { const n = GO.ageDays(date); return n <= 0 ? 'Aujourd’hui' : n === 1 ? 'Hier' : n < 7 ? 'Cette semaine' : 'Plus anciennes'; };

  function renderNotifs(main) {
    main.innerHTML = `
      ${ui.head({ eyebrow: 'Suivi', title: 'Notifications',
        sub: 'Événements des dossiers qui concernent votre profil : dépôts, transmissions, visas, compléments, décisions, paiements et cérémonies.',
        actions: `<button class="btn btn-secondary" type="button" id="nt-all">${icon('check')}Tout marquer comme lu</button>` })}
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
      const doc = n.doc && GO.getDoc(n.doc);
      const hasDoc = doc && GO.myDocs().includes(doc) && GO.role().views.includes('courriers');
      return `${head}<article class="notif row-in ${n.read ? '' : 'is-unread'}" style="--i:${Math.min(i, 10)}" aria-label="${n.read ? '' : 'Non lue : '}${esc(n.title)}">
        <span class="notif-ico ni-${n.type}" aria-hidden="true">${icon(GO.NOTIF_ICON[n.type] || 'bell')}</span>
        <div class="notif-main">
          <div class="notif-top"><h2 class="notif-title" style="font-size:14px">${esc(n.title)}</h2>${n.ref ? `<span class="ref-chip ref">${esc(n.ref)}</span>` : ''}</div>
          <p class="notif-msg">${esc(n.msg)}</p>
          <div class="notif-actions">
            ${n.ref && GO.role().views.includes('dossiers') ? `<a class="btn btn-secondary btn-xs" href="#/dossiers/${esc(n.ref)}" data-open-n="${n.id}">${icon('folder', 'ic-sm')}Ouvrir le dossier</a>` : ''}
            ${hasDoc ? `<a class="btn btn-secondary btn-xs" href="#/courriers/${n.doc}" data-open-n="${n.id}">${icon('file', 'ic-sm')}Consulter le courrier</a>` : ''}
            ${(n.type === 'conflit' || n.type === 'ceremonie') && GO.role().views.includes('ceremonies') ? `<a class="btn btn-ghost btn-xs" href="#/ceremonies" data-open-n="${n.id}">${icon('calendar', 'ic-sm')}Calendrier</a>` : ''}
            ${(n.type === 'paiement' || n.type === 'remise') && GO.role().views.includes('recettes') ? `<a class="btn btn-ghost btn-xs" href="#/recettes" data-open-n="${n.id}">${icon('cash', 'ic-sm')}Finances</a>` : ''}
            ${n.type === 'stock' && GO.role().views.includes('stock') ? `<a class="btn btn-ghost btn-xs" href="#/stock" data-open-n="${n.id}">${icon('box', 'ic-sm')}Stock</a>` : ''}
          </div>
        </div>
        <div class="notif-time"><time datetime="${n.date}T${n.time}">${esc(GO.ageDays(n.date) <= 1 ? n.time : fmtDate(n.date, 'dm') + ' · ' + n.time)}</time>
          <button class="btn btn-ghost btn-xs" type="button" data-toggle="${n.id}">${n.read ? 'Marquer non lue' : 'Marquer comme lue'}</button></div>
      </article>`;
    }).join('');
    if (focusId) { const b = $(`[data-toggle="${focusId}"]`, main); if (b) b.focus(); }
  }

  GO.views.notifications = { render: renderNotifs };
  void relDay;
})(window.GO);
