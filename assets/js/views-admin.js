/* ==========================================================================
   GAB-ORIENT — Journal d'activité, administration et profil
   Vues : « Journal d'activité », « Comptes, paramètres et journaux »,
   « Mon profil ». L'administration ne porte aucune décision métier.
   ========================================================================== */
(function (GO) {
  'use strict';
  const { $, $$, esc, icon, D, fmtDate, relDay, plural, norm } = GO;
  const ui = GO.ui;

  /* ======================= JOURNAL D'ACTIVITÉ ======================= */
  const JF = { q: '', level: 'all', period: 'all', actor: 'all', sort: 'recent' };
  const LEVELS = { info: 'Information', action: 'Action', alerte: 'Alerte' };
  const PERIODS = { all: 'Toutes les périodes', today: 'Aujourd’hui', d7: '7 derniers jours', d30: '30 derniers jours', m: 'Mois en cours' };
  const LEVEL_TONE = { info: 'slate', action: 'blue', alerte: 'red' };
  const ACTOR_FAMILY = a => {
    const s = norm(a);
    if (s.includes('système') || s.includes('gab-orient')) return 'Système';
    if (s.includes('distinction')) return 'Service des Distinctions';
    if (s.includes('secrétariat') || s.includes('secretariat')) return 'Secrétariats';
    if (s.includes('inspection')) return 'Inspection du travail';
    if (s.includes('régie') || s.includes('regie')) return 'Régie des médailles';
    if (s.includes('ministre') || s.includes('travail') || s.includes('dgt') || s.includes('directeur')) return 'Autorités';
    if (s.includes('administration')) return 'Administration';
    return 'Demandeurs';
  };

  function renderJournal(main) {
    const all = GO.myAudit().slice().sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    const actors = [...new Set(all.map(a => ACTOR_FAMILY(a.actor)))].sort();
    const isAdmin = GO.can('admin');
    main.innerHTML = `
      ${ui.head({ eyebrow: 'Traçabilité', title: 'Journal d’activité',
        sub: isAdmin ? 'Journal technique complet : connexions, changements de profil, enregistrements, courriers et mouvements de stock.' : 'Événements enregistrés pour les dossiers accessibles avec ce profil, du dépôt à la remise.',
        actions: `<button class="btn btn-secondary" type="button" id="jf-print">${icon('file')}Préparer un extrait</button>` })}
      <section class="card reveal" style="--i:1">${ui.kpis([
        { label: 'Événements enregistrés', count: all.length, note: isAdmin ? 'journal complet' : 'périmètre du profil' },
        { label: 'Aujourd’hui', count: all.filter(a => a.date === GO.REF_ISO).length, note: esc(fmtDate(GO.REF_ISO, 'full')) },
        { label: 'Actions', count: all.filter(a => a.level === 'action').length, note: 'enregistrements et transmissions' },
        { label: 'Alertes', count: all.filter(a => a.level === 'alerte').length, note: 'écarts et anomalies' }
      ])}</section>
      <section class="card reveal mt" style="--i:2">
        ${ui.toolbar({ search: { id: 'jf-q', label: 'Rechercher', placeholder: 'Acteur, action, référence…', value: JF.q },
          selects: [
            { id: 'jf-level', label: 'Niveau', value: JF.level, options: [{ value: 'all', label: 'Tous les niveaux' }, ...Object.entries(LEVELS).map(([k, v]) => ({ value: k, label: v }))] },
            { id: 'jf-actor', label: 'Acteur', value: JF.actor, options: [{ value: 'all', label: 'Tous les acteurs' }, ...actors.map(a => ({ value: a, label: a }))] },
            { id: 'jf-period', label: 'Période', value: JF.period, options: Object.entries(PERIODS).map(([k, v]) => ({ value: k, label: v })) }
          ] })}
        ${ui.filterBar('', '<span id="jf-count" aria-live="polite"></span>')}
        <div id="jf-list"></div>
      </section>
      <p class="hint reveal mt" style="--i:3">${icon('info', 'ic-sm')} Le journal est en lecture seule. Il est alimenté automatiquement à chaque action : réception et enregistrement d’un courrier, instruction, complément, visa, transmission, décision, recours, ordre de recette, vérification d’un reçu, cérémonie, mouvement de stock et remise effective.</p>`;
    const inPeriod = a => {
      if (JF.period === 'all') return true;
      if (JF.period === 'today') return a.date === GO.REF_ISO;
      if (JF.period === 'm') return a.date.slice(0, 7) === GO.REF_ISO.slice(0, 7);
      return GO.daysBetween(a.date, GO.REF_ISO) <= (JF.period === 'd7' ? 7 : 30);
    };
    const draw = () => {
      const q = norm(JF.q.trim());
      const rows = all.filter(a => (JF.level === 'all' || a.level === JF.level) && (JF.actor === 'all' || ACTOR_FAMILY(a.actor) === JF.actor) && inPeriod(a)
        && (!q || norm(`${a.actor} ${a.role} ${a.action} ${a.detail} ${a.id}`).includes(q)));
      $('#jf-count').innerHTML = `<strong>${rows.length}</strong> ${rows.length > 1 ? 'événements affichés' : 'événement affiché'}`;
      if (!rows.length) { $('#jf-list').innerHTML = GO.empty('clock', 'Aucun événement', 'Aucun événement ne correspond à ces critères.'); return; }
      let day = '';
      $('#jf-list').innerHTML = `<ol class="journal">${rows.slice(0, 120).map((a, i) => {
        const head = a.date !== day ? (day = a.date, `<li class="journal-day">${esc(GO.fmtDate(a.date, 'full').replace(/^\w/, c => c.toUpperCase()))}${a.date === GO.REF_ISO ? ' — aujourd’hui' : ''}</li>`) : '';
        return `${head}<li class="journal-row row-in" style="--i:${Math.min(i, 14)}">
          <span class="journal-time tnum">${esc(a.time)}</span>
          <span class="journal-dot lv-${esc(a.level || 'info')}" aria-hidden="true"></span>
          <span class="journal-body"><strong>${esc(a.action)}</strong>${a.detail ? `<span class="journal-detail">${esc(a.detail)}</span>` : ''}</span>
          <span class="journal-actor">${esc(a.actor)}<span>${esc(a.role || '')}</span></span>
          ${GO.badge(LEVELS[a.level] || 'Information', LEVEL_TONE[a.level] || 'slate')}
        </li>`;
      }).join('')}</ol>${rows.length > 120 ? `<p class="hint" style="padding:0 18px 14px">${icon('info', 'ic-sm')} Seuls les 120 événements les plus récents sont affichés. Affinez la recherche ou la période pour consulter les plus anciens.</p>` : ''}`;
    };
    $('#jf-q', main).addEventListener('input', GO.debounce(e => { JF.q = e.target.value; draw(); }, 150));
    $('#jf-level', main).addEventListener('change', e => { JF.level = e.target.value; draw(); });
    $('#jf-actor', main).addEventListener('change', e => { JF.actor = e.target.value; draw(); });
    $('#jf-period', main).addEventListener('change', e => { JF.period = e.target.value; draw(); });
    $('#jf-print', main).addEventListener('click', async e => {
      await GO.withLoading(e.currentTarget, 420);
      const n = $('.journal') ? $$('.journal-row').length : 0;
      GO.toast('info', 'Extrait préparé', `${plural(n, 'événement', 'événements')} — l’édition et la signature relèvent de la procédure interne.`);
    });
    draw();
    requestAnimationFrame(() => $$('[data-c]', main).forEach(n => GO.countUp(n, +n.dataset.c)));
    void relDay;
  }
  GO.views.journal = { render: renderJournal };

  /* ======================= ADMINISTRATION ======================= */
  const AF = { tab: 'comptes', q: '' };
  function renderAdministration(main) {
    const db = GO.S;
    const counts = [
      ['Dossiers', db.dossiers.length], ['Courriers et documents', db.documents.length], ['Déclarations de travail et de salaire', db.dts.length],
      ['Cérémonies', db.ceremonies.length], ['Ordres de recette', db.receiptOrders.length], ['Remises', db.remises.length],
      ['Retraits sans cérémonie', db.withdrawals.length], ['Contrôles', db.controls.length], ['Recours', db.recours.length],
      ['Lignes de registre', db.transmissions.length], ['Mouvements de stock', db.stockMovements.length], ['Événements du journal', db.audit.length]
    ];
    main.innerHTML = `
      ${ui.head({ eyebrow: 'Administration', title: 'Comptes, paramètres et journaux',
        sub: 'Gestion des comptes de démonstration, paramètres de la maquette et vérification des journaux. L’administrateur ne prend aucune décision sur les dossiers de distinctions.',
        actions: `<a class="btn btn-secondary" href="#/journal">${icon('clock')}Journal d’activité</a>` })}
      <section class="card reveal" style="--i:1">${ui.kpis([
        { label: 'Comptes enregistrés', count: db.accounts.length, note: `${db.accounts.filter(a => a.state === 'actif').length} actifs` },
        { label: 'Profils de travail', count: D.roleOrder.length, note: `${D.roleFamilies.length} familles d’acteurs` },
        { label: 'Événements du journal', count: db.audit.length, note: 'lecture seule' },
        { label: 'Référentiels', value: `${D.organisations.length}<small>organismes</small>`, note: `${D.venues.length} lieux · ${D.medals.length} échelons` }
      ])}</section>
      <section class="card reveal mt" style="--i:2">
        <div class="card-head"><div><h2 class="card-title">${icon('database')}Base de démonstration</h2><p class="card-sub">Paramètres techniques de la maquette</p></div>
          <div class="tabs" role="tablist" aria-label="Sections d’administration"><span class="tab-ink" aria-hidden="true"></span>
            <button class="tab" role="tab" type="button" data-tab="comptes" aria-selected="${AF.tab === 'comptes'}">${icon('users', 'ic-sm')}Comptes</button>
            <button class="tab" role="tab" type="button" data-tab="param" aria-selected="${AF.tab === 'param'}">${icon('settings', 'ic-sm')}Paramètres</button>
            <button class="tab" role="tab" type="button" data-tab="donnees" aria-selected="${AF.tab === 'donnees'}">${icon('grid', 'ic-sm')}Données de référence</button>
          </div></div>
        <div id="ad-panel"></div>
      </section>`;
    GO.tabs(main, t => { AF.tab = t; drawAdmin(); });
    drawAdmin();
    requestAnimationFrame(() => $$('[data-c]', main).forEach(n => GO.countUp(n, +n.dataset.c)));
    void counts;
  }
  function drawAdmin() {
    const host = $('#ad-panel'); if (!host) return;
    if (AF.tab === 'comptes') {
      const rows = GO.S.accounts.slice().sort((a, b) => a.id.localeCompare(b.id));
      host.innerHTML = `<div class="card-body" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;justify-content:space-between">
          <div class="field grow" style="max-width:340px"><label class="mini-label" for="ad-q">Rechercher un compte</label><div class="search-field">${icon('search')}<input class="input" id="ad-q" type="search" placeholder="Nom, profil, périmètre…" value="${esc(AF.q)}" autocomplete="off"></div></div>
          <button class="btn btn-primary" type="button" id="ad-new">${icon('plus')}Créer un compte</button>
        </div>
        <div id="ad-list">${adminAccounts(rows)}</div>
        <p class="hint" style="padding:0 18px 16px">${icon('info', 'ic-sm')} Les comptes de démonstration simulent l’ouverture et la suspension d’accès. Aucun mot de passe n’est géré : le changement de profil de travail s’effectue depuis le menu du compte.</p>`;
      $('#ad-q').addEventListener('input', GO.debounce(e => { AF.q = e.target.value; $('#ad-list').innerHTML = adminAccounts(rows); }, 150));
      $('#ad-new').addEventListener('click', createAccount);
      bindAccountActions();
    } else if (AF.tab === 'param') {
      const c = D.config;
      host.innerHTML = `<div class="card-body">
          ${ui.dl([
            ['Date de référence de la maquette', `<strong>${esc(fmtDate(c.referenceDate, 'full'))}</strong><br><span class="muted" style="font-size:12px">Toutes les échéances, alertes et anciennetés sont calculées à partir de cette date.</span>`],
            ['Version des données', `<span class="ref">${esc(c.dataVersion)}</span><br><span class="muted" style="font-size:12px">Une nouvelle version restaure les données de référence sur le poste.</span>`]
          ])}
          <h3 style="font-size:13px;margin-top:14px">Pièces jointes</h3>
          ${ui.dl([
            ['Formats acceptés', esc(c.upload.acceptLabel)],
            ['Taille maximale', `${c.upload.maxMb} Mo par pièce`]
          ])}
          <h3 style="font-size:13px;margin-top:14px">Paiement</h3>
          <div class="alert alert-info">${icon('cash')}<div>${esc(c.payment.note)}<br><span class="muted" style="font-size:12px">Devise de référence : ${esc(c.payment.currency)}.</span></div></div>
          <h3 style="font-size:13px;margin-top:14px">Fond de carte</h3>
          ${ui.dl([['Fournisseur de tuiles', esc(c.map.tileUrl)], ['Centre et zoom initiaux', `${c.map.center.join(', ')} · zoom ${c.map.zoom}`]])}
          <h3 style="font-size:13px;margin-top:14px">Jours indisponibles pour les cérémonies</h3>
          ${ui.table([
            { label: 'Date', cls: 'tnum nowrap', cell: x => esc(fmtDate(x.date, 'full')) },
            { label: 'Motif', cell: x => esc(x.reason) }
          ], D.closures, { caption: 'Jours de fermeture' })}
          <h3 style="font-size:13px;margin-top:14px">Circuit des dossiers</h3>
          ${ui.dl([['Étapes publiées', D.steps.map((s, i) => `<span class="pill">${i + 1}. ${esc(s)}</span>`).join(' ')], ['Statuts', D.statusOrder.map(s => `<span class="pill">${esc(D.statuses[s].label)}</span>`).join(' ')]])}
        </div>`;
    } else {
      const rel = [
        ['Organismes demandeurs', D.organisations], ['Utilisateurs de démonstration', D.users], ['Autorités destinataires', D.authorities],
        ['Lieux de cérémonie', D.venues], ['Échelons et anciennetés indicatives', D.medals], ['Fournisseurs', GO.S.suppliers]
      ];
      host.innerHTML = `<div class="card-body">
        ${ui.table([
          { label: 'Référentiel', cls: 'td-head', cell: x => esc(x[0]) },
          { label: 'Entrées', cls: 'tnum nowrap', cell: x => Object.keys(x[1]).length },
          { label: 'Détail', cls: 'td-wide', cell: x => {
            const v = x[1];
            if (Array.isArray(v)) return v.map(e => esc(e.label || e.name || e.short || e.id)).slice(0, 8).join(' · ') + (v.length > 8 ? ` … (+${v.length - 8})` : '');
            return Object.entries(v).slice(0, 6).map(([k, e]) => esc(e.label || e.name || e.short || k)).join(' · ') + (Object.keys(v).length > 6 ? ' …' : '');
          } }
        ], rel, { caption: 'Référentiels' })}
        <div class="grid grid-2 mt">
          ${ui.card({ i: 1, icon: 'users', title: 'Profils et périmètres', body: ui.table([
            { label: 'Profil', cls: 'td-head', cell: r => esc(r.label) },
            { label: 'Périmètre', cell: r => scopeText(r) },
            { label: 'Pages', cls: 'tnum', cell: r => r.views.length },
            { label: 'Capacités', cls: 'td-wide', cell: r => Object.keys(r.can).filter(k => r.can[k]).map(k => esc(D.permissionLabels[k] || k)).join(' · ') }
          ], D.roleOrder.map(k => D.roles[k]), { caption: 'Profils et périmètres' }) })}
          <div class="stack">
            ${ui.card({ i: 2, icon: 'grid', title: 'Volume des données de travail',
              body: `<div class="mini-table"><table><thead><tr><th scope="col">Objet</th><th scope="col">Nombre</th></tr></thead><tbody>
                ${[['Dossiers', GO.S.dossiers.length], ['Courriers et documents', GO.S.documents.length], ['Déclarations de travail', GO.S.dts.length], ['Cérémonies', GO.S.ceremonies.length], ['Ordres de recette', GO.S.receiptOrders.length], ['Remises', GO.S.remises.length], ['Contrôles', GO.S.controls.length], ['Recours', GO.S.recours.length], ['Lignes de registre', GO.S.transmissions.length], ['Mouvements de stock', GO.S.stockMovements.length], ['Notifications', GO.S.notifications.length], ['Journal', GO.S.audit.length]].map(([k, v]) => `<tr><td>${esc(k)}</td><td class="tnum">${v}</td></tr>`).join('')}
              </tbody></table></div>` })}
            ${ui.card({ i: 3, icon: 'refresh', title: 'Réinitialisation',
              body: `<p style="font-size:13px">La réinitialisation restaure les données de référence et efface les dossiers, visas, décisions et lectures créés sur ce poste.</p>
                <button class="btn btn-danger" type="button" id="ad-reset">${icon('refresh')}Réinitialiser les données du poste</button>` })}
          </div>
        </div>
      </div>`;
      const r = $('#ad-reset');
      if (r) r.addEventListener('click', async () => {
        const ok = await GO.confirmDialog({ title: 'Réinitialiser les données du poste ?', tone: 'red', icon: 'refresh', confirm: 'Réinitialiser', danger: true,
          message: '<p>Toutes les modifications enregistrées sur ce poste seront effacées et les données de référence restaurées. Le profil de travail courant est conservé.</p>' });
        if (!ok) return;
        const role = GO.S.role;
        GO.resetState();
        GO.S.role = role;
        GO.commit();
        GO.renderShell();
        GO.forceRoute('#/administration');
        GO.toast('success', 'Données restaurées', 'Le poste utilise de nouveau les données de référence.');
      });
    }
  }
  function scopeText(r) {
    if (!r.scope) return 'Ensemble des dossiers';
    if (r.scope.kind === 'org') return 'Organisme demandeur : ' + esc(GO.org(r.scope.value).name);
    if (r.scope.kind === 'authority') return 'Autorité destinataire : ' + esc(GO.authority(r.scope.value).label);
    if (r.scope.kind === 'person') { const ids = Array.isArray(r.scope.value) ? r.scope.value : [r.scope.value]; return 'Personne bénéficiaire : ' + esc(GO.S.person.nom + ' ' + GO.S.person.prenom) + `<br><span class="muted" style="font-size:12px">${ids.length} distinction(s) suivie(s)</span>`; }
    return '—';
  }
  function adminAccounts(rows) {
    const q = norm(AF.q.trim());
    const list = rows.filter(a => !q || norm(`${a.id} ${a.user} ${D.users[a.user] ? D.users[a.user].name : ''} ${D.roles[a.role] ? D.roles[a.role].label : ''} ${a.scope} ${a.state}`).includes(q));
    const cols = [
      { label: 'Compte', cls: 'td-head', cell: a => `<span class="ref">${esc(a.id)}</span><br><span class="muted" style="font-size:11.5px">créé le ${esc(fmtDate(a.created, 'short'))}</span>` },
      { label: 'Utilisateur', cls: 'td-wide', cell: a => `<div class="cell-org"><strong>${esc(D.users[a.user] ? D.users[a.user].name : a.user)}</strong><span>${esc(D.users[a.user] ? D.users[a.user].unit : '')}</span></div>` },
      { label: 'Profil de travail', cell: a => `${esc(D.roles[a.role] ? D.roles[a.role].label : a.role)}<br><span class="muted" style="font-size:11.5px">${esc(a.scope)}</span>` },
      { label: 'Dernière connexion', cls: 'tnum nowrap', cell: a => esc(a.last) },
      { label: 'État', cell: a => GO.dictBadge(D.accountStates, a.state) },
      { head: '', cls: 'cell-actions', cell: a => {
        const admin = GO.role().user === a.user;
        const b = [];
        b.push(`<button class="btn btn-secondary btn-xs" type="button" data-acc="${esc(a.id)}" data-act="${a.state === 'actif' ? 'suspendu' : 'actif'}">${a.state === 'actif' ? 'Suspendre' : 'Réactiver'}</button>`);
        if (a.state !== 'desactive') b.push(`<button class="btn btn-ghost btn-xs" type="button" data-acc="${esc(a.id)}" data-act="desactive">Désactiver</button>`);
        if (admin) b.push(GO.badge('compte courant', 'blue'));
        return b.join(' ');
      } }
    ];
    return list.length ? ui.table(cols, list, { caption: 'Comptes de démonstration' }) : GO.empty('users', 'Aucun compte', 'Aucun compte ne correspond à cette recherche.');
  }
  function bindAccountActions() {
    $$('#ad-list [data-acc]').forEach(b => b.addEventListener('click', async () => {
      const acc = GO.S.accounts.find(a => a.id === b.dataset.acc);
      if (!acc) return;
      const target = b.dataset.act;
      const ok = await GO.confirmDialog({
        title: target === 'desactive' ? 'Désactiver ce compte ?' : target === 'suspendu' ? 'Suspendre ce compte ?' : 'Réactiver ce compte ?',
        tone: target === 'actif' ? 'green' : 'yellow', icon: 'user',
        confirm: target === 'desactive' ? 'Désactiver' : target === 'suspendu' ? 'Suspendre' : 'Réactiver',
        message: `<p>${esc(D.users[acc.user] ? D.users[acc.user].name : acc.user)} — ${esc(D.roles[acc.role] ? D.roles[acc.role].label : acc.role)} (${esc(acc.id)}).</p>
          <div class="alert alert-info" style="margin-top:10px">${icon('info')}<div>La démonstration ne gère pas d’authentification : la modification de l’état d’un compte est journalisée et visible dans l’administration.</div></div>`
      });
      if (!ok) return;
      acc.state = target;
      GO.audit(GO.actorName(), target === 'desactive' ? 'Compte désactivé' : target === 'suspendu' ? 'Compte suspendu' : 'Compte réactivé', `${acc.id} — ${D.users[acc.user] ? D.users[acc.user].name : acc.user} (${D.roles[acc.role] ? D.roles[acc.role].label : acc.role})`, 'action');
      GO.commit();
      drawAdmin();
      GO.toast('success', 'Compte mis à jour', `${esc(acc.id)} — ${esc(D.accountStates[acc.state].label)}.`);
    }));
  }
  function createAccount() {
    const users = Object.entries(D.users);
    GO.formModal({
      title: 'Créer un compte de démonstration', icon: 'user', tone: 'blue',
      intro: `<p>Le compte associe un utilisateur à un profil de travail et à son périmètre d’accès. Aucun mot de passe n’est géré dans la maquette.</p>`,
      fields: [
        { id: 'user', label: 'Utilisateur', type: 'select', options: users.map(([k, u]) => ({ value: k, label: `${u.name} — ${u.unit}` })) },
        { id: 'role', label: 'Profil de travail', type: 'select', options: D.roleOrder.map(k => ({ value: k, label: `${D.roles[k].label} — ${D.roles[k].short}` })) },
        { id: 'state', label: 'État du compte', type: 'select', options: Object.entries(D.accountStates).map(([k, v]) => ({ value: k, label: v.label })), value: 'actif' },
        { id: 'scope', label: 'Périmètre', type: 'text', required: true, value: 'Service des Distinctions nationales', validate: v => v.length >= 4 ? '' : 'Précisez le périmètre du compte.' }
      ],
      submit: 'Créer le compte', iconSubmit: 'plus',
      run: v => {
        const id = 'AC-' + String(Math.max(0, ...GO.S.accounts.map(a => +String(a.id).replace(/\D/g, ''))) + 1).padStart(2, '0');
        GO.S.accounts.push({ id, user: v.user, role: v.role, state: v.state, created: GO.REF_ISO, last: '—', scope: v.scope });
        GO.audit(GO.actorName(), 'Compte créé', `${id} — ${D.users[v.user].name} (${D.roles[v.role].label})`, 'action');
        GO.commit();
        drawAdmin();
        GO.toast('success', 'Compte créé', `${esc(id)} — ${esc(D.users[v.user].name)}.`);
      }
    });
  }
  GO.views.administration = { render: renderAdministration };

  /* ======================= MON PROFIL ======================= */
  function renderProfil(main) {
    const u = GO.user(), r = GO.role(), s = r.scope;
    const org = GO.scopeOrg();
    const person = s && s.kind === 'person' ? GO.S.person : null;
    const caps = Object.keys(r.can).filter(k => r.can[k]);
    const prefs = GO.S.prefs || {};
    const myD = GO.myDossiers();
    main.innerHTML = `
      ${ui.head({ eyebrow: 'Compte', title: 'Mon profil',
        sub: 'Identité utilisée dans la démonstration, périmètre d’accès, capacités du profil et préférences d’affichage.' })}
      <div class="grid grid-main">
        ${ui.card({ i: 1, icon: 'user', title: 'Identité', body: `
          <div class="profile-hero">
            <span class="avatar lg" aria-hidden="true">${esc(u.initials)}</span>
            <div><h3>${esc(u.name)}</h3><p class="muted">${esc(u.title)}</p><span class="pill">${esc(r.label)}</span> <span class="pill">${esc(r.short)}</span></div>
          </div>
          <dl class="dl-grid mt">
            <div><dt>Unité / employeur</dt><dd>${esc(u.unit)}</dd></div>
            <div><dt>Courriel de démonstration</dt><dd>${esc(u.email)}</dd></div>
            <div><dt>Périmètre d’accès</dt><dd>${s ? (s.kind === 'org' ? 'Organisme demandeur — ' + esc(org.name) : s.kind === 'authority' ? 'Autorité destinataire — ' + esc(GO.authority(s.value).label) : 'Personne bénéficiaire — ' + esc(person ? person.nom + ' ' + person.prenom : '')) : 'Ensemble des dossiers'}</dd></div>
            ${person ? `<div><dt>Fonction déclarée</dt><dd>${esc(person.fonction)}</dd></div><div><dt>Entrée dans l’organisme</dt><dd>${esc(fmtDate(person.entree, 'full'))} — ${plural(GO.seniority(person.entree), 'an', 'ans')} d’ancienneté</dd></div>` : ''}
            <div><dt>Dossiers accessibles</dt><dd>${myD.length} ${myD.length > 1 ? 'dossiers' : 'dossier'} · ${plural(myD.reduce((a, d) => a + d.recipients.length, 0), 'récipiendaire suivi', 'récipiendaires suivis')}</dd></div>
          </dl>` })}
        <div class="stack">
          ${ui.card({ i: 2, icon: 'shield', title: 'Capacités du profil', sub: 'Ce que ce profil peut faire dans le circuit',
            body: caps.length ? `<ul class="perm-list">${caps.map(c => `<li>${icon('check')}<span>${esc(D.permissionLabels[c] || c)}</span></li>`).join('')}</ul>`
              : GO.empty('shield', 'Aucune capacité métier', 'Ce profil consulte les dossiers et les documents sans action métier.') })}
          ${ui.card({ i: 3, icon: 'settings', title: 'Préférences d’affichage',
            body: `<div class="switch-row"><div><strong id="sw1-l">Réduire les animations</strong><span>Supprime les transitions et apparitions animées.</span></div><span class="switch"><input type="checkbox" id="pf-motion" aria-labelledby="sw1-l" ${prefs.reduceMotion ? 'checked' : ''}><i></i></span></div>
              <div class="switch-row"><div><strong id="sw2-l">Tableaux compacts</strong><span>Réduit la hauteur des lignes des listes.</span></div><span class="switch"><input type="checkbox" id="pf-compact" aria-labelledby="sw2-l" ${prefs.compact ? 'checked' : ''}><i></i></span></div>` })}
        </div>
      </div>
      ${ui.card({ i: 4, cls: 'mt', icon: 'swap', title: 'Changer de profil de travail', sub: 'La maquette permet d’ouvrir l’interface de chaque acteur sans authentification',
        body: `<div class="role-grid">${D.roleFamilies.map(f => `<div class="role-family">
            <h4>${esc(f.label)}</h4>
            ${f.roles.map(k => { const rr = D.roles[k]; return `<button class="role-card ${k === r.id ? 'is-current' : ''}" type="button" data-role="${k}" ${k === r.id ? 'aria-current="true"' : ''}>
              <span class="role-ico">${icon(k === r.id ? 'check' : 'swap')}</span>
              <span><strong>${esc(rr.label)}</strong><span class="muted">${esc(rr.short)} · ${rr.views.length} pages</span></span></button>`; }).join('')}
          </div>`).join('')}</div>
          <p class="hint" style="padding:0 18px 16px">${icon('info', 'ic-sm')} Le changement de profil conserve les données du poste : un dossier déposé reste visible par le secrétariat destinataire, l’instruction et les décisions sont tracées dans son historique.</p>` })}
      <p class="hint mt">${icon('info', 'ic-sm')} Dernière activité enregistrée pour ce profil : ${esc(GO.myAudit().length ? `${GO.myAudit()[0].action} — ${fmtDate(GO.myAudit()[0].date, 'short')} à ${GO.myAudit()[0].time}` : 'aucune')}.</p>`;
    const m = $('#pf-motion', main), c = $('#pf-compact', main);
    if (m) m.addEventListener('change', () => { GO.S.prefs.reduceMotion = m.checked; GO.commit(); GO.renderShell(); GO.toast('info', 'Préférence enregistrée', m.checked ? 'Animations réduites.' : 'Animations complètes.'); });
    if (c) c.addEventListener('change', () => { GO.S.prefs.compact = c.checked; GO.commit(); GO.renderShell(); GO.toast('info', 'Préférence enregistrée', c.checked ? 'Affichage compact.' : 'Affichage aéré.'); });
  }
  GO.views.profil = { render: renderProfil };
})(window.GO);
