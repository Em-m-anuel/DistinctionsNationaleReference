/* Phase 5 — vérification responsive : débordement horizontal, navigation mobile, adaptabilité des cartes. */
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

const VIEWPORTS = [
  { name: 'bureau 1440×900', width: 1440, height: 900 },
  { name: 'portable 1280×800', width: 1280, height: 800 },
  { name: 'portable 1180×800', width: 1180, height: 800 },
  { name: 'intermédiaire 1100×800', width: 1100, height: 800 },
  { name: 'limite navigation 1061×800', width: 1061, height: 800 },
  { name: 'tablette 820×1024', width: 820, height: 1024 },
  { name: 'mobile 390×844', width: 390, height: 844 },
];
const CASES = [
  ['demandeur_entreprise', ['apercu', 'dossiers', 'nouveau', 'pieces', 'recettes', 'courriers']],
  ['chef', ['apercu', 'instruction', 'dossiers', 'statistiques', 'ceremonies', 'remises']],
  ['regisseur', ['apercu', 'stock', 'recettes', 'remises', 'retraits', 'journal']],
  ['ministre', ['apercu', 'decisions', 'recours', 'statistiques', 'notifications', 'profil']],
];

const browser = await puppeteer.launch({ args: [...chromium.args, '--no-sandbox', '--disable-dev-shm-usage'], executablePath: CHROME_PATH || await chromium.executablePath(), headless: true });
const page = await browser.newPage();
const jsErrors = [];
page.on('pageerror', e => jsErrors.push(e.message));
const wait = ms => new Promise(x => setTimeout(x, ms));
await page.setViewport({ width: 1440, height: 900 });
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#view h1');
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#view h1');

const setRole = async r => {
  await page.evaluate(() => { document.querySelectorAll('#toasts .toast').forEach(t => t.remove()); location.hash = '#/apercu'; });
  await wait(280);
  await page.evaluate(() => document.querySelector('#account-btn').click());
  await page.waitForSelector(`#account-menu [data-role="${r}"]`, { timeout: 8000 });
  await page.evaluate(x => document.querySelector(`#account-menu [data-role="${x}"]`).click(), r);
  await wait(760);
};

const out = [];
for (const vp of VIEWPORTS) {
  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
  await wait(400);
  for (const [role, views] of CASES) {
    await setRole(role);
    for (const view of views) {
      await page.evaluate(x => { location.hash = '#/' + x; }, view);
      await wait(950);
      const r = await page.evaluate(() => {
        const de = document.documentElement;
        const scrolled = el => {
          let p = el.parentElement;
          while (p && p !== document.body) { if (/auto|scroll|hidden/.test(getComputedStyle(p).overflowX)) return true; p = p.parentElement; }
          return false;
        };
        const over = [...document.querySelectorAll('#view *')].filter(el => {
          const b = el.getBoundingClientRect();
          return b.width > 0 && b.right > window.innerWidth + 2 && getComputedStyle(el).position !== 'fixed' && !scrolled(el);
        }).slice(0, 3).map(el => (el.className || el.tagName).toString().slice(0, 40));
        const toggle = document.querySelector('#nav-toggle');
        return {
          scroll: de.scrollWidth,
          inner: window.innerWidth,
          h1: (document.querySelector('#view h1') || {}).textContent || '',
          toggleVisible: !!(toggle && toggle.offsetParent !== null),
          overflow: over,
          cards: document.querySelectorAll('#view .card').length,
          tables: document.querySelectorAll('#view .table-wrap').length,
        };
      });
      out.push({ vp: vp.name, role, view, ...r, ok: r.scroll <= r.inner + 1 && r.overflow.length === 0 });
    }
  }
  // navigation mobile : ouverture / fermeture du panneau
  const mobileNav = await page.evaluate(async () => {
    const toggle = document.querySelector('#nav-toggle');
    if (!toggle || toggle.offsetParent === null) return { applicable: false };
    toggle.click();
    await new Promise(x => setTimeout(x, 350));
    const open = document.querySelector('#mobile-nav').classList.contains('is-open');
    const links = document.querySelectorAll('#mobile-nav .mobile-nav-list a').length;
    document.querySelector('#mobile-nav [data-close-nav]').click();
    await new Promise(x => setTimeout(x, 350));
    const closed = !document.querySelector('#mobile-nav').classList.contains('is-open');
    return { applicable: true, open, closed, links };
  });
  // tiroir de dossier : doit tenir dans la largeur
  await page.evaluate(() => { location.hash = '#/dossiers'; });
  await wait(1000);
  await page.evaluate(() => { const tr = document.querySelector('#df-table tbody tr'); if (tr) tr.click(); });
  await wait(1000);
  const drawer = await page.evaluate(() => {
    const d = document.querySelector('.drawer');
    if (!d) return { open: false };
    const b = d.getBoundingClientRect();
    return { open: true, width: Math.round(b.width), fits: b.right <= window.innerWidth + 1 && b.left >= -1, title: (document.querySelector('#drawer-title') || {}).textContent || '' };
  });
  out.push({ vp: vp.name, role: 'chef', view: 'tiroir dossier', ok: !drawer.open || drawer.fits, note: JSON.stringify({ mobileNav, drawer }) });
}

const summary = {};
for (const vp of VIEWPORTS) {
  const rows = out.filter(r => r.vp === vp.name);
  summary[vp.name] = { pages: rows.length, ok: rows.filter(r => r.ok).length, ko: rows.filter(r => !r.ok).map(r => `${r.role}/${r.view} (${r.scroll} ≤ ${r.inner}${r.overflow.length ? ' — ' + r.overflow.join(', ') : ''})`) };
}
fs.writeFileSync(OUT + '/responsive.json', JSON.stringify({ summary, detail: out, jsErrors, at: new Date().toISOString() }, null, 1));
for (const [vp, s] of Object.entries(summary)) console.log(`${vp} : ${s.ok}/${s.pages} pages sans débordement${s.ko.length ? ' — KO : ' + s.ko.join(' | ') : ''}`);
console.log('\nnavigation mobile :', JSON.stringify(out.filter(r => r.view === 'tiroir dossier').map(r => r.note)));
console.log('erreurs JS :', jsErrors.length, jsErrors.slice(0, 3).join(' | '));
await browser.close();
