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
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#view h1');
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#view h1');

const setRole = async r => {
  await page.evaluate(() => { document.querySelectorAll('#toasts .toast').forEach(t => t.remove()); location.hash = '#/apercu'; });
  await new Promise(x => setTimeout(x, 250));
  await page.evaluate(() => document.querySelector('#account-btn').click());
  await page.waitForSelector(`#account-menu [data-role="${r}"]`, { timeout: 8000 });
  await page.evaluate(x => document.querySelector(`#account-menu [data-role="${x}"]`).click(), r);
  await new Promise(x => setTimeout(x, 700));
};

const roles = await page.evaluate(() => Object.keys(window.GO.D.roles));
const meta = {};
for (const r of roles) {
  await setRole(r);
  const views = await page.evaluate(() => window.GO.role().views);
  meta[r] = { label: await page.$eval('#acc-role', e => e.textContent.trim()), views: {} };
  for (const v of views) {
    await page.evaluate(x => { location.hash = '#/' + x; }, v);
    await new Promise(x => setTimeout(x, 900));
    const info = await page.evaluate(() => {
      const t = s => (s || '').replace(/\s+/g, ' ').trim();
      const main = document.querySelector('#view');
      const cards = [...main.querySelectorAll('.card')].map(c => ({
        title: t((c.querySelector('.card-title') || c.querySelector('h2') || c.querySelector('h3') || {}).textContent),
        heads: [...c.querySelectorAll('thead th')].map(th => t(th.textContent)).filter(Boolean),
        rows: c.querySelectorAll('tbody tr').length,
        empty: t((c.querySelector('.empty') || {}).textContent),
      })).filter(c => c.title || c.heads.length || c.empty);
      return {
        ids: [...new Set([...main.querySelectorAll('[id]')].map(e => e.id))].sort(),
        h1: t((main.querySelector('h1') || {}).textContent),
        eyebrow: t((main.querySelector('.page-eyebrow') || {}).textContent),
        sub: t((main.querySelector('.page-sub, .page-head p') || {}).textContent).slice(0, 180),
        kpis: [...main.querySelectorAll('.kpi')].map(k => t(k.querySelector('.kpi-label').textContent) + ' = ' + t(k.querySelector('.kpi-value').textContent) + (k.querySelector('.kpi-note') ? ' (' + t(k.querySelector('.kpi-note').textContent) + ')' : '')),
        cards: cards.slice(0, 10),
        actions: [...new Set([...main.querySelectorAll('button.btn, a.btn')].map(b => t(b.textContent)).filter(Boolean))].slice(0, 26),
        panels: [...main.querySelectorAll('.tab[role="tab"], .chip')].map(b => t(b.textContent)).slice(0, 14),
        drawers: main.querySelectorAll('[data-open="drawer"], [data-open]').length,
      };
    });
    meta[r].views[v] = info;
  }
}
fs.writeFileSync(OUT + '/pagemeta.json', JSON.stringify(meta, null, 1));
console.log('roles:', roles.length, '| pages:', Object.values(meta).reduce((n, r) => n + Object.keys(r.views).length, 0), '| erreurs JS:', errs.length, errs.slice(0, 3));
await browser.close();
