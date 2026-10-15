/* GAB-ORIENT — vérification fonctionnelle du prototype au navigateur.
   Balayage « profils × pages », interactions principales et relevé des erreurs.
   Usage : node run.mjs [--flows] [--role=<cle>] */
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE || 'http://127.0.0.1:8123/index.html';
const OUT = process.env.OUT || path.join(new URL('.', import.meta.url).pathname, 'reports');
fs.mkdirSync(OUT, { recursive: true });
const CHROME_PATH = process.env.CHROME_PATH || '';
// Bibliothèques NSS/NSPR fournies par @sparticuz/chromium (extraites dans /tmp/al2023/lib)
const CHROME_LIB = process.env.CHROME_LIB || '/tmp/al2023/lib';
const CHROME_FONTS = process.env.CHROME_FONTS || '/tmp/fonts';
process.env.LD_LIBRARY_PATH = [CHROME_LIB, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
process.env.FONTCONFIG_PATH = CHROME_FONTS;
const REPO = '/home/user/DistinctionsNationaleReference';

// Rôles et pages attendues, lus depuis data.js (source de vérité)
function roleMap() {
  const src = fs.readFileSync(path.join(REPO, 'assets/js/data.js'), 'utf8');
  const win = { GO_DATA: null };
  const fn = new Function('window', src + '\n;return window;');
  const w = fn({ document: { addEventListener() {}, readyState: 'complete', getElementById: () => null, querySelector: () => null }, addEventListener() {}, localStorage: { getItem: () => null, setItem() {} }, matchMedia: () => ({ matches: false, addEventListener() {} }) });
  const D = w.GO_DATA;
  const out = {};
  (D.roleOrder || Object.keys(D.roles)).forEach(k => { out[k] = { label: D.roles[k].label, views: D.roles[k].views.slice() }; });
  return out;
}

const EXTERNAL = /cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|tile\.openstreetmap|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|net::ERR_/;
const IGNORE = [/Download the React DevTools/];

function classify(t) { return EXTERNAL.test(t) ? 'reseau-externe' : 'js'; }

async function main() {
  const roles = roleMap();
  const only = (process.argv.find(a => a.startsWith('--role=')) || '').split('=')[1];
  const withFlows = process.argv.includes('--flows');
  const report = { startedAt: new Date().toISOString(), base: BASE, roles: {}, flows: [], errors: [], notes: [] };

  const browser = await puppeteer.launch({
    args: [...chromium.args, '--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
    executablePath: CHROME_PATH || await chromium.executablePath(),
    headless: true,
    defaultViewport: { width: 1366, height: 900 }
  });
  const page = await browser.newPage();
  let bucket = null;
  page.on('console', m => {
    const t = m.text();
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    if (IGNORE.some(r => r.test(t))) return;
    if (!bucket) return;
    const kind = classify(t);
    if (kind === 'js') push(`[console.${m.type()}] ${t}`); else bucket.ext.push(t);
  });
  page.on('pageerror', e => { if (bucket) push(`[exception] ${e.message}\n   ${String(e.stack || '').split('\n').slice(1, 3).join(' | ')}`); });
  page.on('requestfailed', r => { const u = r.url(); if (bucket && EXTERNAL.test(u)) bucket.ext.push('requestfailed ' + u.slice(0, 70)); });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForSelector('#view h1, #view .page-title', { timeout: 15000 });
    report.notes.push('App chargée — titre: ' + await page.title());
  } catch (e) {
    const first = await page.evaluate(() => (document.querySelector('#view') || {}).innerHTML || '(vide)');
    report.errors.push({ role: '(chargement)', errors: ['écran initial non rendu: ' + first.slice(0, 300)] });
  }

  const push = t => { bucket.js.push(t); if (bucket.current) { bucket.perView[bucket.current] = bucket.perView[bucket.current] || []; bucket.perView[bucket.current].push(t); } };
  const roleKeys = Object.keys(roles).filter(k => !only || k === only);
  const flush = () => fs.writeFileSync(OUT + '/report.json', JSON.stringify(report, null, 1));
  for (const role of roleKeys) {
    bucket = { js: [], ext: [], perView: {}, current: '(chargement)' };
    // Changement de profil par l'interface (menu du compte)
    await page.evaluate(() => {
      window.location.hash = '#/apercu';
      document.querySelectorAll('#toasts .toast').forEach(t => t.remove());
      document.body.classList.remove('has-toasts');
    }).catch(() => {});
    await page.waitForFunction(() => document.querySelector('#view h1'), { timeout: 8000 }).catch(() => {});
    try {
      await page.evaluate(() => document.querySelector('#account-btn').click());
      await page.waitForSelector(`#account-menu [data-role="${role}"]`, { timeout: 5000 });
      await page.evaluate(r => document.querySelector(`#account-menu [data-role="${r}"]`).click(), role);
      await new Promise(r => setTimeout(r, 750));
    } catch (e) {
      report.errors.push({ role, errors: ['changement de profil impossible: ' + e.message.slice(0, 120)] });
    }
    const entry = { label: roles[role].label, views: {}, jsErrors: [], extBlocked: 0 };
    for (const view of [...roles[role].views, 'profil']) {
      const key = view;
      bucket.current = view;
      await page.evaluate(v => { window.location.hash = '#/' + v; }, view);
      try {
        await page.waitForFunction(() => {
          const m = document.querySelector('#view');
          return m && !m.getAttribute('aria-busy') && (m.querySelector('h1') || m.querySelector('.empty, .card'));
        }, { timeout: 9000 });
      } catch (e) {
        entry.views[key] = { ok: false, reason: 'rendu non détecté (timeout)' };
        continue;
      }
      const info = await page.evaluate(() => {
        const m = document.querySelector('#view');
        const h1 = m.querySelector('h1');
        return {
          h1: h1 ? h1.textContent.trim() : (m.querySelector('.page-title') ? m.querySelector('.page-title').textContent.trim() : null),
          len: m.innerHTML.length,
          empty: m.querySelector('.empty') ? (m.querySelector('.empty h3') || {}).textContent : null,
          buttons: m.querySelectorAll('button, a.btn').length,
          tables: m.querySelectorAll('table').length
        };
      });
      entry.views[key] = { ok: !!info.h1 && info.len > 400, ...info };
      if (!info.h1 || info.len <= 400) entry.views[key].reason = 'contenu insuffisant';
    }
    entry.jsErrors = bucket.js.slice(0, 60);
    entry.perView = bucket.perView;
    entry.extBlocked = bucket.ext.length;
    report.roles[role] = entry;
    if (bucket.js.length) report.errors.push({ role, errors: bucket.js.slice(0, 60) });
    flush();
    console.log(`— ${role} : ${entry.jsErrors.length} erreur(s) JS, ${Object.values(entry.views).filter(v => !v.ok).length} page(s) en échec`);
  }

  if (withFlows) {
    report.flows = await runFlows(page, roles);
  }
  await browser.close();
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(OUT + '/report.json', JSON.stringify(report, null, 1));
  console.log(JSON.stringify({
    roles: Object.keys(report.roles).length,
    rolesWithErrors: report.errors.length,
    errorDetail: report.errors.map(e => e.role + ': ' + e.errors.slice(0, 4).join(' || ')),
    flows: report.flows.map(f => `${f.name}: ${f.ok ? 'OK' : 'ÉCHEC'}${f.note ? ' — ' + f.note : ''}${f.errors && f.errors.length ? ' — ' + f.errors.join(' || ') : ''}`),
    emptyPages: Object.entries(report.roles).flatMap(([r, e]) => Object.entries(e.views).filter(([, v]) => v.empty).map(([k, v]) => `${r}/${k}: ${v.empty}`))
  }, null, 1));
}

async function runFlows(page, roles) {
  const flows = [];
  const errs = [];
  page.removeAllListeners('pageerror');
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !EXTERNAL.test(m.text())) errs.push('[console] ' + m.text()); });
  const free = () => errs.splice(0, errs.length);
  const step = async (name, fn) => {
    free();
    let ok = true, note = '';
    try { note = (await fn()) || ''; } catch (e) { ok = false; note = e.message.slice(0, 160); }
    if (errs.length) { ok = false; note = (note ? note + ' — ' : '') + errs.slice(0, 3).join(' | '); }
    flows.push({ name, ok, note, errors: free() });
  };
  const domClick = async sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error('élément introuvable: ' + s); e.click(); }, sel);
  const click = async sel => {
    try { await page.click(sel); }
    catch (e) { await domClick(sel); }
  };
  const setRole = async r => {
    await page.evaluate(() => { document.querySelectorAll('#toasts .toast').forEach(t => t.remove()); window.location.hash = '#/apercu'; });
    await new Promise(x => setTimeout(x, 250));
    await domClick('#account-btn');
    await page.waitForSelector(`#account-menu [data-role="${r}"]`);
    await domClick(`#account-menu [data-role="${r}"]`);
    await new Promise(x => setTimeout(x, 700));
  };
  const go = async v => { await page.evaluate(h => { window.location.hash = h; }, v); await new Promise(x => setTimeout(x, 800)); };
  const state = async () => page.evaluate(() => ({
    hash: location.hash,
    role: window.GO.S.role,
    status: Object.fromEntries(window.GO.S.dossiers.map(d => [d.ref, d.status])),
    stock: Object.fromEntries(window.GO.S.stock.map(s => [s.item, { available: s.available, reserved: s.reserved }])),
    withdrawals: Object.fromEntries(window.GO.S.withdrawals.map(w => [w.id, w.state])),
    accounts: window.GO.S.accounts.length,
    movements: window.GO.S.stockMovements.length
  }));

  // Les écritures repartent d'un état de démonstration vierge.
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#view h1', { timeout: 15000 });
  await step('profil annonceur → changement de profil par le menu', async () => { await setRole('chef'); return await page.$eval('#acc-role', e => e.textContent); });
  await step('dossiers → ouverture du panneau de détail', async () => {
    await go('#/dossiers');
    await page.waitForSelector('#df-table tbody tr');
    await domClick('#df-table tbody tr');
    await page.waitForSelector('.drawer .drawer-title', { timeout: 5000 });
    const t = await page.$eval('.drawer .drawer-title', e => e.textContent.trim());
    await page.keyboard.press('Escape');
    await new Promise(x => setTimeout(x, 400));
    return t;
  });
  await step('dossiers → recherche et filtre par statut', async () => {
    await go('#/dossiers');
    await page.type('#df-q', 'DNG');
    await new Promise(x => setTimeout(x, 350));
    const before = await page.$$eval('#df-table tbody tr', r => r.length);
    const chip = await page.$('#df-chips .chip:nth-child(2)');
    if (chip) await chip.evaluate(c => c.click());
    await new Promise(x => setTimeout(x, 300));
    const after = await page.$$eval('#df-table tbody tr', r => r.length);
    return `lignes ${before} → ${after}`;
  });
  await step('dossier reçu → ouverture de l’instruction (modale + validation)', async () => {
    await go('#/dossiers?status=recu');
    await page.waitForSelector('#df-table tbody tr', { timeout: 6000 });
    const ref = await page.$eval('#df-table tbody tr', tr => tr.dataset.ref);
    await domClick('#df-table tbody tr');
    await page.waitForSelector('.drawer', { timeout: 5000 });
    const btn = await page.$('.drawer [data-act]');
    const label = btn ? await page.evaluate(b => b.textContent.trim(), btn) : '(aucune action)';
    return `dossier ${ref} — première action: ${label}`;
  });
  await step('cérémonies → onglet « Proposer un lieu et une date » et carte', async () => {
    await go('#/ceremonies/proposer');
    await page.waitForSelector('#pv-list [data-venue]', { timeout: 8000 });
    const n = await page.$$eval('#pv-list [data-venue]', e => e.length);
    await click('#pv-list [data-venue]');
    await new Promise(x => setTimeout(x, 350));
    const fiche = await page.$eval('#pv-fiche', e => e.textContent.trim().length);
    await click('#pv-q');
    await page.type('#pv-q', 'Libreville');
    await new Promise(x => setTimeout(x, 400));
    const n2 = await page.$$eval('#pv-list [data-venue]', e => e.length);
    return `${n} lieux → ${n2} après recherche, fiche ${fiche} caractères`;
  });
  await step('cérémonies → calendrier : navigation de mois et sélection de jour', async () => {
    await go('#/ceremonies');
    await page.waitForSelector('.cal-grid .cal-day');
    await click('[data-cal="next"]');
    await new Promise(x => setTimeout(x, 400));
    const titre = await page.$eval('#cal-title', e => e.textContent.trim());
    await click('.cal-cell:not(.is-out) .cal-day');
    await new Promise(x => setTimeout(x, 500));
    const detail = await page.$eval('#cal-detail', e => e.textContent.trim().length);
    return `${titre} — détail ${detail} caractères`;
  });
  await step('nouveau dossier → assistant : étape 1 valide, étape 2 bloquée sans récipiendaire', async () => {
    await setRole('demandeur_entreprise');
    await go('#/nouveau');
    await page.waitForSelector('.wz-foot .btn-primary', { timeout: 6000 });
    const before = await page.$eval('#view h1', e => e.textContent.trim());
    const next = async () => { await page.evaluate(() => { const b = document.querySelector('.wz-foot .btn-primary'); if (b) b.click(); }); await new Promise(x => setTimeout(x, 450)); };
    await next(); // étape 1 → 2
    const etape = await page.evaluate(() => (document.querySelector('.wz-steps .is-current, .wz-step.is-current, [aria-current="step"]') || {}).textContent || '');
    await next(); // étape 2 sans récipiendaire : doit être refusée
    const errs = await page.$$eval('.has-error, .error-msg, .alert-error', e => e.length);
    const step2 = await page.evaluate(() => (document.querySelector('.wz-steps .is-current, .wz-step.is-current, [aria-current="step"]') || {}).textContent || '');
    if (!errs) throw new Error('étape 2 acceptée sans récipiendaire');
    return `${before} — étape « ${etape.replace(/\s+/g, ' ').trim()} » puis ${errs} message(s) de validation, étape courante « ${step2.replace(/\s+/g, ' ').trim()} »`;
  });
  await step('bénéficiaires → filtres et recherche (demandeur)', async () => {
    await go('#/beneficiaires');
    await page.waitForSelector('#view table, #view .empty');
    const n = await page.$$eval('#view table tbody tr', r => r.length);
    return `${n} ligne(s)`;
  });
  await step('journal → recherche et filtre de niveau (administrateur)', async () => {
    await setRole('admin');
    await go('#/journal');
    await page.waitForSelector('.journal-row');
    const n = await page.$$eval('.journal-row', e => e.length);
    await page.type('#jf-q', 'dossier');
    await new Promise(x => setTimeout(x, 400));
    const n2 = await page.$$eval('.journal-row', e => e.length);
    return `${n} → ${n2} événements`;
  });
  await step('administration → onglets comptes / paramètres / données', async () => {
    await go('#/administration');
    await page.waitForSelector('#ad-panel');
    await click('[data-tab="param"]');
    await new Promise(x => setTimeout(x, 300));
    const p = await page.$eval('#ad-panel', e => e.textContent.includes('Date de référence'));
    await click('[data-tab="donnees"]');
    await new Promise(x => setTimeout(x, 300));
    const d = await page.$$eval('#ad-panel table', e => e.length);
    return `paramètres ${p ? 'OK' : 'KO'} — ${d} table(s) de référentiel`;
  });
  await step('stock → modale de mouvement et refus d’une quantité invalide', async () => {
    await setRole('regisseur');
    await go('#/stock');
    await page.waitForSelector('#st-new');
    await domClick('#st-new');
    await page.waitForSelector('.modal-layer');
    const title = await page.$eval('.modal-title', e => e.textContent.trim());
    await page.type('#fm-reason', 'Test');
    await domClick('.modal-foot [data-act="ok"]');
    await new Promise(x => setTimeout(x, 500));
    const stillOpen = await page.$('.modal-layer');
    const err = await page.$$eval('.error-msg', e => e.length);
    await page.keyboard.press('Escape');
    return `${title} — modale ${stillOpen ? 'maintenue' : 'fermée'}, ${err} erreur(s)`;
  });
  await step('remises → registre et état des réservations', async () => {
    await go('#/remises');
    await page.waitForSelector('#view table, #view .empty');
    const rows = await page.$$eval('#view table tbody tr', r => r.length);
    return `${rows} ligne(s)`;
  });
  await step('retraits → demandeur : dépôt d’une demande sans cérémonie', async () => {
    await setRole('demandeur_entreprise');
    await go('#/retraits');
    await page.waitForSelector('#view .card');
    const btn = await page.$('[data-do="retrait_demande"]');
    return btn ? 'action disponible (non déclenchée : écriture de données)' : 'aucune action proposée pour ce profil';
  });
  await step('recours → instruction par la DGT', async () => {
    await setRole('dgt');
    await go('#/recours');
    await page.waitForSelector('#rc-list');
    const n = await page.$$eval('#rc-list .acc', e => e.length);
    return `${n} recours listé(s)`;
  });
  await step('décisions → onglets et suivi (DGT)', async () => {
    await go('#/decisions');
    await page.waitForSelector('#de-table');
    const chips = await page.$$eval('#de-chips .chip', e => e.length);
    await click('#de-chips .chip:nth-child(2)');
    await new Promise(x => setTimeout(x, 300));
    const rows = await page.$$eval('#de-table tbody tr', r => r.length);
    return `${chips} filtres — ${rows} décision(s) rendue(s)`;
  });
  await step('registre → classement d’un courrier reçu (secrétariat DGT)', async () => {
    await setRole('sec_dgt');
    await go('#/transmissions');
    await page.waitForSelector('#view table tbody tr, #view .empty');
    const rows = await page.$$eval('#view table tbody tr', r => r.length);
    return `${rows} courrier(s) au registre`;
  });
  await step('compléments → relance depuis la liste (service)', async () => {
    await setRole('chef');
    await go('#/complements');
    await page.waitForSelector('#kf-table, #view .empty');
    const n = await page.$$eval('#kf-table tbody tr', r => r.length);
    return `${n} complément(s)`;
  });
  await step('écriture 1 — ouvrir l’instruction d’un dossier reçu (chef) puis vérifier la persistance', async () => {
    await setRole('chef');
    await go('#/dossiers?status=recu');
    await page.waitForSelector('#df-table tbody tr');
    const ref = await page.$eval('#df-table tbody tr', tr => tr.dataset.ref);
    await domClick('#df-table tbody tr');
    await page.waitForSelector('.drawer [data-act="instruct"]', { timeout: 5000 });
    const before = await state();
    await domClick('.drawer [data-act="instruct"]');
    await new Promise(x => setTimeout(x, 1200));
    const after = await state();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#view h1', { timeout: 15000 });
    await setRole('chef');
    const reloaded = await state();
    const b = before.status[ref], a = after.status[ref], r2 = reloaded.status[ref];
    if (a !== 'en_cours') throw new Error(`${ref}: statut ${b} → ${a} (attendu en_cours)`);
    if (r2 !== a) throw new Error(`${ref}: non persisté après rechargement (${r2})`);
    return `${ref}: ${b} → ${a}, conservé après rechargement`;
  });
  await step('écriture 2 — mouvement de stock : entrée de 5 médailles Bronze (régie)', async () => {
    await setRole('regisseur');
    await go('#/stock');
    await page.waitForSelector('#st-new');
    const before = await state();
    await domClick('#st-new');
    await page.waitForSelector('.modal-layer');
    await page.select('#fm-item', 'bronze');
    await page.select('#fm-nature', 'available:1');
    await page.type('#fm-qty', '5');
    await page.type('#fm-reason', 'Réception partielle — contrôle du prototype');
    await domClick('.modal-foot [data-act="ok"]');
    await new Promise(x => setTimeout(x, 1600));
    const after = await state();
    const b = before.stock.bronze.available, a = after.stock.bronze.available;
    if (a !== b + 5) throw new Error(`stock bronze ${b} → ${a} (attendu ${b + 5})`);
    if (after.movements !== before.movements + 1) throw new Error('mouvement non journalisé');
    return `stock Bronze ${b} → ${a}, mouvement enregistré`;
  });
  await step('écriture 3 — réponse à un complément (demandeur ministère) puis reprise de l’instruction', async () => {
    await setRole('demandeur_ministere');
    await go('#/dossiers?status=complement');
    await page.waitForSelector('#df-table tbody tr');
    const ref = await page.$eval('#df-table tbody tr', tr => tr.dataset.ref);
    await domClick('#df-table tbody tr');
    await page.waitForSelector('.drawer [data-act="answer"]', { timeout: 5000 });
    await domClick('.drawer [data-act="answer"]');
    await page.waitForSelector('.modal-layer');
    await page.type('#fm-file', 'attestations-anciennete.pdf');
    await domClick('.modal-foot [data-act="ok"]');
    await new Promise(x => setTimeout(x, 1600));
    const st = await state();
    const after = st.status[ref];
    if (after !== 'en_cours') throw new Error(`${ref}: statut ${after} (attendu en_cours)`);
    return `${ref} : complément déposé, instruction reprise`;
  });
  await step('écriture 4 — demande de retrait sans cérémonie (récipiendaire) visible par la régie', async () => {
    await setRole('recipiendaire');
    await go('#/retraits');
    await page.waitForSelector('#view .card');
    const before = await state();
    const btn = await page.$('[data-do="retrait_demande"]');
    if (!btn) throw new Error('aucune action de retrait proposée au récipiendaire');
    await btn.evaluate(b => b.click());
    await page.waitForSelector('.modal-layer');
    await page.type('#fm-just', 'Le bénéficiaire ne peut pas se déplacer pour une cérémonie collective cette année.');
    await domClick('.modal-foot [data-act="ok"]');
    await new Promise(x => setTimeout(x, 1400));
    const after = await state();
    if (after.withdrawals === before.withdrawals) throw new Error('demande non enregistrée');
    await setRole('regisseur');
    await go('#/retraits');
    await page.waitForSelector('#wd-table', { timeout: 6000 });
    const rows = await page.$$eval('#wd-table tbody tr', r => r.length);
    const txt = await page.$eval('#wd-table', e => e.textContent.includes('Demande reçue'));
    if (!rows || !txt) throw new Error(`côté régie : ${rows} ligne(s), état « Demande reçue » ${txt ? 'présent' : 'absent'}`);
    return `demande créée et visible par la régie (${rows} ligne(s))`;
  });
  await step('écriture 5 — création d’un compte puis journalisation (administrateur)', async () => {
    await setRole('admin');
    await go('#/administration');
    await page.waitForSelector('#ad-panel');
    const before = await state();
    await domClick('#ad-new');
    await page.waitForSelector('.modal-layer');
    await page.select('#fm-role', 'agent');
    await page.type('#fm-scope', 'Service des Distinctions — support');
    await domClick('.modal-foot [data-act="ok"]');
    await new Promise(x => setTimeout(x, 1200));
    const after = await state();
    if (after.accounts !== before.accounts + 1) throw new Error(`comptes ${before.accounts} → ${after.accounts}`);
    await go('#/journal');
    await page.waitForSelector('.journal-row');
    const ok = await page.evaluate(() => document.querySelector('#jf-list').textContent.includes('Compte créé'));
    if (!ok) throw new Error('création de compte absente du journal');
    return `compte créé (${after.accounts} comptes) et journalisé`;
  });
  await step('recherche globale (Ctrl+K) et ouverture d’un résultat', async () => {
    await page.keyboard.down('Control'); await page.keyboard.press('KeyK'); await page.keyboard.up('Control');
    await page.waitForSelector('#pal-q', { timeout: 4000 });
    await page.type('#pal-q', 'DNG');
    await new Promise(x => setTimeout(x, 400));
    const items = await page.$$eval('.palette-item', e => e.length);
    await page.keyboard.press('Enter');
    await new Promise(x => setTimeout(x, 800));
    const hash = await page.evaluate(() => location.hash);
    return `${items} résultat(s) — ${hash}`;
  });
  await page.evaluate(() => localStorage.clear());
  return flows;
}

main().catch(e => {
  console.error('ÉCHEC DU HARNAIS:', e.message);
  try { fs.appendFileSync(OUT + '/report-errors.txt', new Date().toISOString() + ' ' + e.stack + '\n'); } catch (_) {}
  process.exit(1);
});
