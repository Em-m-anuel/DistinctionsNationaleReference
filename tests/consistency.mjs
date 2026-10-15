/* Phase 4 — cohérence inter-profils.
   Chaque contrôle écrit avec un profil puis vérifie l'effet avec un autre profil
   (mêmes références, mêmes statuts, même historique). Sortie : consistency.json */
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE || 'http://127.0.0.1:8123/index.html';
const OUT = process.env.OUT || path.join(new URL('.', import.meta.url).pathname, 'reports');
fs.mkdirSync(OUT, { recursive: true });
const CHROME_PATH = process.env.CHROME_PATH || '';
const CHROME_LIB = process.env.CHROME_LIB || '/tmp/al2023/lib';
const CHROME_FONTS = process.env.CHROME_FONTS || '/tmp/fonts';
process.env.LD_LIBRARY_PATH = [CHROME_LIB, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
process.env.FONTCONFIG_PATH = CHROME_FONTS;

const browser = await puppeteer.launch({ args: [...chromium.args, '--no-sandbox', '--disable-dev-shm-usage'], executablePath: CHROME_PATH || await chromium.executablePath(), headless: true, defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
const jsErrors = [];
page.on('pageerror', e => jsErrors.push(e.message + ' | ' + (e.stack || '').split('\n')[1]));
page.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load resource|ERR_/.test(m.text())) jsErrors.push('[console] ' + m.text()); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#view h1');
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#view h1');

const wait = ms => new Promise(x => setTimeout(x, ms));
const as = async r => {
  await page.evaluate(() => { document.querySelectorAll('#toasts .toast').forEach(t => t.remove()); location.hash = '#/apercu'; });
  await wait(300);
  await page.evaluate(() => document.querySelector('#account-btn').click());
  await page.waitForSelector(`#account-menu [data-role="${r}"]`, { timeout: 8000 });
  await page.evaluate(x => document.querySelector(`#account-menu [data-role="${x}"]`).click(), r);
  await wait(780);
};
const go = async h => {
  if (await page.evaluate(x => location.hash === x, h)) {
    await page.evaluate(() => { location.hash = '#/apercu'; });
    await wait(420);
  }
  await page.evaluate(x => { location.hash = x; }, h);
  await wait(950);
};
const has = sel => page.evaluate(s => !!document.querySelector(s), sel);
const click = async sel => {
  const ok = await page.evaluate(s => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
  if (!ok) throw new Error('introuvable : ' + sel);
  await wait(700);
};
const clickOk = async () => {
  await page.evaluate(() => {
    const m = document.querySelector('.modal-layer:last-child');
    if (m) m.querySelectorAll('input[type="checkbox"]').forEach(c => { if (!c.checked) c.click(); });
  });
  await wait(250);
  await click('.modal-layer:last-child .modal-foot .btn-primary');
  await wait(1100);
};
const autofill = async (overrides = {}) => {
  await page.waitForSelector('.modal-layer [id^="fm-"]', { timeout: 8000 });
  const filled = await page.evaluate(ov => {
    const out = [];
    const set = (el, v) => {
      if (el.type === 'checkbox') { if (el.checked !== !!v) el.click(); return; }
      el.focus();
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.blur();
    };
    document.querySelectorAll('.modal-layer [id^="fm-"]').forEach(el => {
      const id = el.id.replace(/^fm-/, '');
      if (ov[id] !== undefined) { set(el, ov[id]); out.push(id + '=' + ov[id]); return; }
      if (el.type === 'radio') { const grp = [...document.querySelectorAll(`.modal-layer [name="${el.name}"]`)]; if (!grp.some(x => x.checked)) { grp[0].click(); out.push(el.name + '=radio'); } return; }
      if (el.type === 'checkbox') { if (!el.checked) { el.click(); out.push(id + '=coché'); } return; }
      if (el.value) return;
      if (el.tagName === 'SELECT') { const o = [...el.options].find(x => x.value); if (o) { set(el, o.value); out.push(id + '=' + o.value); } return; }
      const v = el.type === 'date' ? '2026-10-14' : el.type === 'number' ? '1' : el.tagName === 'TEXTAREA' ? 'Observation enregistrée dans le cadre de la démonstration.' : 'Réf. démonstration 2026';
      set(el, v); out.push(id + '=' + v);
    });
    return out;
  }, overrides);
  await clickOk();
  const still = await page.evaluate(() => { const m = document.querySelector('.modal-layer'); return m ? [...m.querySelectorAll('.error-msg, .has-error, .ck-warn')].map(e => e.textContent.trim()).slice(0, 3) : null; });
  if (still) throw new Error('formulaire refusé : ' + JSON.stringify(still));
  return filled;
};
const txt = sel => page.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, sel);
const viewTxt = () => page.evaluate(() => document.querySelector('#view').textContent.replace(/\s+/g, ' ').trim());
const rows = sel => page.evaluate(s => [...document.querySelectorAll(s)].map(r => r.textContent.replace(/\s+/g, ' ').trim()), sel);
const st = () => page.evaluate(() => ({
  dossiers: Object.fromEntries(GO.S.dossiers.map(d => [d.ref, d.status])),
  stock: Object.fromEntries(GO.S.stock.map(s => [s.item, { a: s.available, r: s.reserved }])),
  cers: Object.fromEntries(GO.S.ceremonies.map(c => [c.id, { d: c.dossier, s: c.state, date: c.date }])),
  remises: Object.fromEntries(GO.S.remises.map(r => [r.id, { d: r.dossier, s: r.state, mode: r.mode }])),
  retraits: Object.fromEntries(GO.S.withdrawals.map(w => [w.id, { d: w.dossier, s: w.state, n: w.recipients.length }])),
  ors: Object.fromEntries(GO.S.receiptOrders.map(o => [o.id, { d: o.dossier, s: o.state, rec: (o.receipts || []).map(x => x.state) }])),
  docs: GO.S.documents.length, notifs: GO.S.notifications.length, audit: GO.S.audit.length, tx: GO.S.transmissions.length, mv: GO.S.stockMovements.length,
}));
const openDossier = async ref => {
  const already = await page.evaluate(r => {
    const dr = document.querySelector('.drawer');
    return !!(dr && dr.textContent.includes(r) && dr.dataset.key === 'dossier:' + r);
  }, ref);
  if (already) return page.evaluate(() => document.querySelector('.drawer').textContent.replace(/\s+/g, ' ').trim());
  await go('#/dossiers/' + ref);
  if (!(await has('.drawer'))) {
    await page.evaluate(r => { const tr = [...document.querySelectorAll('#df-table tbody tr')].find(x => x.textContent.includes(r)); if (tr) tr.click(); }, ref);
    await wait(700);
  }
  await page.waitForSelector('.drawer', { timeout: 8000 });
  return page.evaluate(() => document.querySelector('.drawer').textContent.replace(/\s+/g, ' ').trim());
};
const drawerHas = sel => page.evaluate(s => !!document.querySelector('.drawer ' + s), sel);
const openCeremony = async id => {
  await go('#/ceremonies'); await wait(900);
  const ok = await page.evaluate(x => { const b = document.querySelector(`[data-ev="${x}"]`); if (!b) return false; b.click(); return true; }, id);
  if (!ok) { await go('#/ceremonies/' + id); await wait(900); }
  await wait(900);
  return page.evaluate(() => { const d = document.querySelector('#cal-detail'); return d ? d.textContent.replace(/\s+/g, ' ').trim() : ''; });
};

const results = [];
const check = async (id, name, fn) => {
  const t0 = Date.now();
  try { const note = await fn(); results.push({ id, name, ok: true, note, ms: Date.now() - t0 }); }
  catch (e) { results.push({ id, name, ok: false, note: String(e.message || e).slice(0, 320), ms: Date.now() - t0 }); }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const before = await st();

/* 1 — cloisonnement des périmètres et identité des références */
await check('C1', 'Cloisonnement des périmètres et identité des références', async () => {
  await as('demandeur_entreprise'); await go('#/dossiers');
  const mine = await rows('#df-table tbody tr');
  const refs = mine.map(r => (r.match(/DNG-\d{4}-\d{3}/) || [''])[0]);
  const owned = await page.evaluate(() => GO.myDossiers().map(d => d.ref));
  assert(refs.length === owned.length && refs.every(r => owned.includes(r)), 'liste du demandeur ≠ périmètre de l’organisme');
  assert(!refs.includes('DNG-2026-002'), 'fuite : dossier d’un autre organisme visible');

  await as('sec_min'); await go('#/transmissions');
  const minRefs = [...new Set((await rows('#tr-table tbody tr')).map(r => (r.match(/DNG-\d{4}-\d{3}/) || [''])[0]))];
  const minOwned = await page.evaluate(() => GO.myTransmissions().map(t => t.dossier));
  assert(minRefs.length > 0 && minRefs.every(r => minOwned.includes(r)), 'registre du Ministre ≠ périmètre de l’autorité');

  const seen = {};
  for (const r of ['demandeur_ministere', 'sec_min', 'chef', 'ministre']) {
    await as(r); await go('#/dossiers');
    seen[r] = await page.evaluate(() => {
      const d = GO.getDossier('DNG-2026-012');
      const row = [...document.querySelectorAll('tbody tr')].find(tr => /DNG-2026-012/.test(tr.textContent));
      return { status: d.status, row: row ? /Complement/i.test(row.textContent) : null };
    });
  }
  assert(Object.values(seen).every(x => x.status === 'complement'), 'statut divergent entre profils : ' + JSON.stringify(seen));
  return `demandeur o1 : ${refs.length} dossiers (${refs.join(', ')}), aucune fuite · registre du Ministre : ${minRefs.length} réf. · DNG-2026-012 « complement » vu par les 4 profils`;
});

/* 2 — instruction puis complément : service → demandeur → service */
await check('C2', 'Instruction puis complément : service → demandeur → service', async () => {
  const ref = 'DNG-2026-017';
  await as('chef'); await openDossier(ref);
  await click('.drawer [data-act="instruct"]'); await wait(900);
  let s = await st();
  assert(s.dossiers[ref] === 'en_cours', `${ref} devrait être en cours (${s.dossiers[ref]})`);

  await openDossier(ref);
  assert(await drawerHas('[data-act="complement"]'), 'action « Demander un complément » absente');
  await click('.drawer [data-act="complement"]');
  await autofill({ items: 'Attestations d’ancienneté complémentaires pour deux récipiendaires.', due: '2026-11-20' });
  s = await st();
  assert(s.dossiers[ref] === 'complement', `${ref} devrait passer en complément (${s.dossiers[ref]})`);
  const cpl = await page.evaluate(r => GO.complementOf(r), ref);
  assert(cpl && cpl.dossier === ref, 'aucune demande de complément rattachée au dossier');

  await as('demandeur_entreprise'); await go('#/complements');
  const demandeurVu = await viewTxt();
  assert(demandeurVu.includes(ref) && demandeurVu.includes(cpl.id), `complément ${cpl.id} absent de la vue du demandeur`);
  await openDossier(ref);
  assert(await drawerHas('[data-act="answer"]'), 'action « Déposer le complément » absente chez le demandeur');
  await click('.drawer [data-act="answer"]');
  await autofill({ file: 'attestations-complementaires-DNG-2026-017.pdf', msg: 'Pièces transmises au service.' });
  s = await st();
  assert(s.dossiers[ref] === 'en_cours', `${ref} devrait reprendre l’instruction (${s.dossiers[ref]})`);

  await as('chef');
  const drawer = await openDossier(ref);
  assert(/complément/i.test(drawer), 'la demande de complément n’apparaît pas au service');
  const docs = await page.evaluate(r => GO.docsOf(r).map(d => d.kind), ref);
  assert(docs.includes('complement'), 'la réponse au complément n’est pas rattachée au dossier');
  const hist = await page.evaluate(r => (GO.getDossier(r).history || []).map(h => h.label).join(' · '), ref);
  assert(/complément/i.test(hist), 'historique du dossier incomplet : ' + hist);
  return `${ref} : recu → en_cours (service) → complement (${cpl.id}) → réponse du demandeur → en_cours ; ${docs.length} pièces rattachées, historique partagé par les deux profils`;
});

/* 3 — transmission, décision, ordre de recette, reçu, vérification */
await check('C3', 'Transmission → décision → ordre de recette → reçu → vérification', async () => {
  const ref = 'DNG-2026-012';
  // le dossier ministériel est seedé en complément : le demandeur y répond avant la transmission
  await as('demandeur_ministere'); await openDossier(ref);
  assert(await drawerHas('[data-act="answer"]'), 'complément non proposé au demandeur du dossier 012');
  await click('.drawer [data-act="answer"]');
  await autofill({ file: 'attestations-anciennete-DNG-2026-012.pdf', msg: 'Pièces complémentaires transmises au service.' });
  assert((await st()).dossiers[ref] === 'en_cours', '012 devrait reprendre l’instruction après le complément');
  await as('chef'); await openDossier(ref);
  await click('.drawer [data-act="note"]'); await wait(1200);
  await openDossier(ref);
  assert(await drawerHas('[data-act="visa"]'), 'note en attente de visa non proposée au Chef de service');
  await click('.drawer [data-act="visa"]'); await wait(900);
  assert(await has('[data-v="visa"]'), 'action de visa absente de l’aperçu du document');
  await click('[data-v="visa"]'); await clickOk();
  const vise = await page.evaluate(() => GO.docsOf('DNG-2026-012').filter(d => d.kind === 'transmission').map(d => d.state));
  await openDossier(ref);
  assert(await drawerHas('[data-act="transmit"]'), 'action de transmission absente après visa');
  await click('.drawer [data-act="transmit"]'); await clickOk();
  let s = await st();
  assert(s.dossiers[ref] === 'transmis', `${ref} devrait être transmis (${s.dossiers[ref]})`);
  const tx = await page.evaluate(() => GO.S.transmissions.filter(t => t.dossier === 'DNG-2026-012').map(t => t.reference || t.id));

  await as('sec_min'); await go('#/transmissions');
  assert((await viewTxt()).includes(ref), `${ref} transmis absent du registre du Ministre`);

  await as('ministre'); await go('#/decisions');
  assert((await viewTxt()).includes(ref), `${ref} absent des dossiers à décider du Ministre`);
  await click('#de-table [data-do="decide"]');
  await autofill({ ref: 'Courrier n° 2026-061 du Ministère du Travail', decDate: '2026-10-14' });
  s = await st();
  assert(s.dossiers[ref] === 'approuve', `${ref} devrait être approuvé (${s.dossiers[ref]})`);

  await as('demandeur_ministere'); await go('#/dossiers');
  const mineRow = (await rows('#df-table tbody tr')).find(r => r.includes(ref)) || '';
  assert(/Approuv/i.test(mineRow), 'le demandeur ne voit pas la décision favorable : ' + mineRow.slice(0, 140));
  await go('#/courriers');
  assert((await viewTxt()).includes(ref), 'courrier de décision absent des documents du demandeur');

  await as('chef'); await openDossier(ref);
  assert(await drawerHas('[data-act="recette"]'), 'action « Émettre l’ordre de recette » absente');
  await click('.drawer [data-act="recette"]');
  await autofill({ amount: '1 500 000 FCFA', due: '2026-11-14' });
  s = await st();
  const or = Object.entries(s.ors).find(([, o]) => o.d === ref);
  assert(or, 'aucun ordre de recette créé');
  const orId = or[0];

  await as('demandeur_ministere'); await go('#/recettes');
  assert((await viewTxt()).includes(orId), `l’ordre ${orId} n’est pas visible par l’organisme demandeur`);
  await click('#rf-table [data-do="deposer_recu"]');
  await autofill({ ref: 'Quittance n° 2026-1187', date: '2026-10-14', file: 'quittance-or.pdf', note: 'Paiement effectué au Trésor.' });
  s = await st();
  assert(s.ors[orId].s === 'recu_depose', `l’ordre ${orId} devrait porter un reçu déposé (${s.ors[orId].s})`);

  await as('regisseur'); await go('#/recettes');
  assert(await has('#rf-table [data-do="verif_recu"]'), 'le reçu déposé n’est pas proposé à la vérification');
  await click('#rf-table [data-do="verif_recu"]');
  await autofill({ montant: '1 500 000 FCFA', decision: 'verifie', note: 'Quittance conforme au registre.' });

  await as('demandeur_ministere'); await go('#/recettes');
  const finalTxt = await viewTxt();
  assert(/Vérifi/i.test(finalTxt), 'le demandeur ne voit pas la vérification du reçu');
  assert((await st()).dossiers[ref] === 'approuve', 'la vérification du reçu a modifié le statut du dossier');
  return `${ref} : note visée (${vise.join(', ')}) → transmis (${tx.join(', ')}) → décision approuvée par le Ministre → ${orId} émis par le service → reçu déposé par le demandeur → vérifié par la Régie ; statut du dossier inchangé`;
});

/* 4 — remise effective : stock, dossier, distinction, clôture de la cérémonie */
await check('C4', 'Remise effective : stock, dossier, distinction et clôture de la cérémonie', async () => {
  // Scénario de test : on ramène la date de CER-2026-02 dans le passé pour exercer la règle de clôture.
  await as('chef');
  await page.evaluate(() => { const c = GO.getCer('CER-2026-02'); c.date = '2026-10-01'; GO.commit(); });
  await openCeremony('CER-2026-02');
  const doneBefore = await has('[data-cact="done"]');
  const attente = await page.evaluate(() => /Clôture en attente de la remise/.test(document.querySelector('#view').textContent));
  assert(!doneBefore && attente, `clôture attendue en attente de la remise effective (bouton=${doneBefore}, mention=${attente})`);

  await as('regisseur'); await go('#/remises');
  const stockBefore = (await st()).stock;
  assert(await has('#rm-panel [data-do="remise_ok"][data-ref="DNG-2026-002"]'), 'remise préparée non proposée à l’enregistrement');
  await click('#rm-panel [data-do="remise_ok"][data-ref="DNG-2026-002"]');
  await autofill({ date: '2026-10-15', mode: 'cérémonie', note: 'Procès-verbal de remise du 15 octobre 2026.' });
  await wait(600);
  const s = await st();
  assert(s.remises['REM-2026-0002'].s === 'remise', `remise non enregistrée (${s.remises['REM-2026-0002'].s})`);
  assert(stockBefore.bronze.a - s.stock.bronze.a === 2 && stockBefore.argent.a - s.stock.argent.a === 2,
    `stock physique attendu −2 Bronze et −2 Argent : Bronze ${stockBefore.bronze.a}→${s.stock.bronze.a}, Argent ${stockBefore.argent.a}→${s.stock.argent.a}`);
  assert(stockBefore.bronze.r - s.stock.bronze.r === 2 && stockBefore.argent.r - s.stock.argent.r === 2, 'réservations non libérées');

  await as('chef'); const drawer = await openDossier('DNG-2026-002');
  assert(/remise/i.test(drawer), 'la remise n’apparaît pas dans le dossier du service');

  await as('recipiendaire'); await go('#/distinctions');
  const dist = await viewTxt();
  assert(/remis/i.test(dist) || /remise/i.test(dist), 'la distinction du récipiendaire ne reflète pas la remise');

  await as('chef'); const fiche = await openCeremony('CER-2026-02');
  const doneAfter = await has('[data-cact="done"]');
  assert(doneAfter, 'clôture non proposée après la remise effective');
  assert(/remise/i.test(fiche), 'la fiche de cérémonie ne reflète pas la remise : ' + fiche.slice(0, 160));
  await click('[data-cact="done"]'); await clickOk();
  assert((await st()).cers['CER-2026-02'].s === 'termine', 'la cérémonie n’a pas été clôturée');
  await page.evaluate(() => { const c = GO.getCer('CER-2026-02'); c.date = '2026-10-22'; GO.commit(); });
  return `REM-2026-0002 → remise effective par la Régie : Bronze ${stockBefore.bronze.a}→${s.stock.bronze.a}, Argent ${stockBefore.argent.a}→${s.stock.argent.a}, réservations libérées (−2/−2) · historique du dossier 002 et distinction du récipiendaire à jour · clôture impossible avant la remise (« én attente de la remise »), possible ensuite (date de cérémonie ramenée au 1er oct. pour le test) → CER-2026-02 terminée`;
});

/* 5 — une date proposée n'est jamais confirmée avant la validation */
await check('C5', 'Cérémonie : proposition, absence de confirmation prématurée, validation', async () => {
  const ref = 'DNG-2026-019';
  await as('chef'); await go('#/ceremonies/proposer?dossier=' + ref); await wait(1100);
  assert(await has('#pv-list [data-venue]'), 'liste des lieux indisponible');
  await click('#pv-list [data-venue]');
  await page.evaluate(() => { const d = document.querySelector('#pr-date'); if (d) { d.value = '2026-10-29'; d.dispatchEvent(new Event('change', { bubbles: true })); } });
  await wait(300);
  assert(await has('#pr-submit'), 'bouton de soumission absent');
  await click('#pr-submit'); await clickOk();
  let s = await st();
  const entry = Object.entries(s.cers).find(([, c]) => c.d === ref);
  assert(entry, 'aucune cérémonie créée pour ' + ref);
  const [cerId, cerState] = entry;
  assert(['propose', 'negociation'].includes(cerState.s), `état inattendu après proposition : ${cerState.s}`);
  assert(cerState.s !== 'confirme', 'date confirmée sans validation');

  await as('sec_min');
  const ficheAvant = await openCeremony(cerId);
  assert(ficheAvant.includes(cerId), `${cerId} absent du calendrier de l’autorité`);
  const libelle = await page.evaluate(() => GO.D.ceremonyStates.confirme.label);
  assert(/propos/i.test(ficheAvant) && !ficheAvant.includes(libelle), `proposition présentée comme confirmée avant validation (libellé « ${libelle} ») : ` + ficheAvant.slice(0, 200));

  await as('ministre'); await openCeremony(cerId);
  assert(await has('[data-cact="validate"]'), 'bouton de validation absent pour l’autorité');
  await click('[data-cact="validate"]');
  await autofill({ ref: 'Validation ministérielle du 15 octobre 2026' });
  s = await st();
  assert(s.cers[cerId].s === 'confirme', `validation non enregistrée (${s.cers[cerId].s})`);
  const ficheApres = await openCeremony(cerId);
  const libelle2 = await page.evaluate(() => GO.D.ceremonyStates.confirme.label);
  assert(ficheApres.includes(libelle2), `la fiche de cérémonie ne reflète pas la confirmation (« ${libelle2} ») : ` + ficheApres.slice(0, 200));
  return `${cerId} (${ref}, 29 oct. 2026) : proposée par le service → « ${cerState.s} » côté autorité sans mention de confirmation → validée par le Ministre → « confirmée » au calendrier`;
});

/* 6 — retrait sans cérémonie : récipiendaire → régie → distinction et stock */
await check('C6', 'Retrait sans cérémonie : récipiendaire → régie → distinction et stock', async () => {
  await as('recipiendaire'); await go('#/retraits');
  assert(await has('[data-do="retrait_demande"]'), 'demande de retrait indisponible pour le récipiendaire');
  const ref = await page.evaluate(() => document.querySelector('[data-do="retrait_demande"]').dataset.ref);
  await click('[data-do="retrait_demande"]');
  await autofill({ just: 'Empêchement professionnel le jour de la remise ; retrait souhaité à la régie.' });
  let s = await st();
  const wd = Object.entries(s.retraits).find(([, w]) => w.d === ref);
  assert(wd && wd[1].s === 'demande', 'demande de retrait non enregistrée');

  await as('regisseur'); await go('#/retraits');
  assert((await viewTxt()).includes(wd[0]), `la Régie ne voit pas la demande ${wd[0]}`);
  await click('[data-do="retrait_valide"]');
  await autofill({ ref: 'Autorisation n° 2026-077', rdv: '2026-11-03' });
  s = await st();
  assert(s.retraits[wd[0]].s === 'valide', `autorisation non enregistrée (${s.retraits[wd[0]].s})`);
  const stockBefore = s.stock;
  await go('#/retraits');
  assert(await has('[data-do="retrait_remis"]'), 'retrait autorisé non proposé à la remise effective');
  await click('[data-do="retrait_remis"]');
  await autofill({ date: '2026-11-03', who: 'Assoumou Ghislain', note: 'Remise à la régie sur présentation de la pièce d’identité.' });
  await wait(500);
  s = await st();
  assert(s.retraits[wd[0]].s === 'remis', `retrait effectif non enregistré (${s.retraits[wd[0]].s})`);
  const dec = ['bronze', 'argent', 'or'].reduce((n, k) => n + (stockBefore[k].a - s.stock[k].a), 0);
  assert(dec > 0, 'aucune sortie de stock enregistrée');
  const rem = await page.evaluate(r => GO.remiseOf(r), ref);
  assert(rem && rem.mode === 'retrait', 'aucune remise « retrait » rattachée au dossier');

  await as('recipiendaire'); await go('#/distinctions');
  assert(/retrait|remis/i.test(await viewTxt()), 'distinction du récipiendaire non mise à jour');
  return `${wd[0]} (${ref}) : demande du récipiendaire → autorisation de la Régie (réf. + rendez-vous) → retrait effectif : ${dec} sortie(s) de stock, remise ${rem.id} (mode ${rem.mode}), distinction mise à jour côté récipiendaire`;
});

/* 7 — contrôle de l'inspecteur visible par le service */
await check('C7', 'Contrôle documentaire : inspecteur → service', async () => {
  await as('inspecteur'); await go('#/controle');
  assert(await has('[data-ctl]'), 'aucune action de contrôle proposée à l’inspecteur');
  const ref = await page.evaluate(() => document.querySelector('[data-ctl]').dataset.ctl);
  await click('[data-ctl="' + ref + '"]');
  await page.waitForSelector('.modal-layer [id^="fm-"]', { timeout: 8000 });
  await autofill({ scope: 'Contrôle des pièces justificatives', state: 'anomalie', an1: 'Attestation d’ancienneté non signée par l’employeur.', note: 'Pièce à compléter par l’organisme demandeur.' });
  const ctl = await page.evaluate(r => GO.controlOf(r), ref);
  assert(ctl, 'aucun contrôle enregistré');

  await as('chef'); const drawer = await openDossier(ref);
  assert(/contr[oô]le/i.test(drawer), 'le contrôle n’apparaît pas au service');
  const notif = await page.evaluate(r => GO.myNotifs().filter(n => (n.ref || '') === r).length, ref);
  assert(notif > 0, 'aucune notification au service pour ce dossier');
  return `contrôle ${ctl.id} (${ref}) enregistré par l’inspecteur — conclusion « ${ctl.state} » · visible au service dans le dossier ${ref} et ${notif} notification(s) liée(s)`;
});

/* 8 — journalisation transverse */
await check('C8', 'Journalisation des écritures et traçabilité des acteurs', async () => {
  await as('admin'); await go('#/journal');
  const s = await st();
  assert(s.audit > before.audit, `journal non alimenté (${before.audit} → ${s.audit})`);
  const actors = await page.evaluate(() => [...new Set(GO.S.audit.slice(0, 60).map(a => a.actor))]);
  assert(actors.length >= 4, 'moins de 4 acteurs journalisés : ' + actors.join(', '));
  const list = await rows('#jf-list .journal-row');
  assert(list.length > 0, 'journal illisible dans l’interface');
  return `journal ${before.audit} → ${s.audit} entrées · ${list.length} lignes affichées · acteurs : ${actors.slice(0, 9).join(', ')}`;
});

await browser.close();
const ok = results.filter(r => r.ok).length;
fs.writeFileSync(OUT + '/consistency.json', JSON.stringify({ results, jsErrors, at: new Date().toISOString() }, null, 1));
console.log('\n=== Phase 4 — cohérence inter-profils ===');
results.forEach(r => console.log(`${r.ok ? 'OK   ' : 'ÉCHEC'} | ${r.id} ${r.name}\n        ${r.note}`));
console.log(`\n${ok}/${results.length} contrôles réussis · erreurs JS : ${jsErrors.length}`);
if (jsErrors.length) console.log(jsErrors.slice(0, 5).join('\n'));
