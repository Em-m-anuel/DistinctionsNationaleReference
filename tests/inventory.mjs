/* Inventaire statique de la référence, utilisé par `gen_docs.py` pour produire
   `ROLE_COMPONENT_MAPPING.md` et `PAGES_MAP.md`.
   - `inventory.json` : profils, familles, permissions, dictionnaires, routes de navigation, volumes de démonstration
     (chargé depuis `assets/js/data.js` et `assets/js/core.js` lus comme sources, sans navigateur)
   - `viewmeta.json`  : découpage statique des vues (`GO.views.<nom> = { … }`) : fichier, ligne, identifiants,
     classes, helpers `GO.*`, actions et dictionnaires cités
   Usage : node tests/inventory.mjs [chemin-du-dépôt] */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const REPO = process.argv[2] || process.env.REPO || path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT = process.env.OUT || path.join(new URL('.', import.meta.url).pathname, 'reports');
fs.mkdirSync(OUT, { recursive: true });
const JS = path.join(REPO, 'assets/js');

/* ---------- 1. Données : on exécute data.js dans un contexte isolé ---------- */
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(JS, 'data.js'), 'utf8'), sandbox, { filename: 'data.js' });
const D = sandbox.window.GO_DATA;

const core = fs.readFileSync(path.join(JS, 'core.js'), 'utf8');
const nav = [...core.matchAll(/\{ key: '([a-z]+)', label: '([^']+)', icon: '([a-z-]+)', pages: \[(.*?)\](?:, count: true)? \}/gs)]
  .map(m => ({
    key: m[1], label: m[2], icon: m[3],
    pages: [...m[4].matchAll(/\{ view: '([a-z]+)', label: '([^']+)'(?:, can: '([a-z]+)')? \}/g)]
      .map(p => ({ view: p[1], label: p[2], can: p[3] || null })),
  }));

const inventory = {
  generatedAt: new Date().toISOString(),
  roles: Object.entries(D.roles).map(([id, r]) => ({
    id, label: r.label, short: r.short, family: r.family, views: r.views, can: Object.keys(r.can || {}),
    scope: r.scope || null,
    user: D.users[r.user] ? { name: D.users[r.user].name, title: D.users[r.user].title } : null,
  })),
  families: D.roleFamilies,
  permissions: D.permissionLabels,
  authorities: D.authorities,
  users: Object.entries(D.users).map(([id, u]) => ({ id, name: u.name, role: u.role, title: u.title })),
  dictionaries: {
    statuses: D.statuses, ceremonyStates: D.ceremonyStates, remiseStates: D.remiseStates,
    withdrawalStates: D.withdrawalStates, recetteStates: D.recetteStates, controlStates: D.controlStates,
    recoursStates: D.recoursStates, transmissionStates: D.transmissionStates, docStates: D.docStates,
    dtsStates: D.dtsStates, accountStates: D.accountStates,
  },
  steps: D.steps,
  medals: D.medals,
  config: D.config,
  nav,
  routes: Object.keys(D.registryDossier ? {} : {}),
  counts: Object.fromEntries(Object.entries(D.seed)
    .map(([k, v]) => [k, Array.isArray(v) ? v.length : (v && typeof v === 'object' ? Object.keys(v).length : null)])
    .filter(([, v]) => v !== null)),
};
inventory.counts.organisations = D.organisations.length;
inventory.counts.venues = D.venues.length;
fs.writeFileSync(path.join(OUT, 'inventory.json'), JSON.stringify(inventory, null, 1));

/* ---------- 2. Vues : découpage statique ---------- */
const files = fs.readdirSync(JS).filter(f => f.startsWith('views-')).sort();
const viewmeta = {};
for (const file of files) {
  const src = fs.readFileSync(path.join(JS, file), 'utf8');
  const marks = [...src.matchAll(/GO\.views\.([a-z_]+) = \{/g)];
  marks.forEach((m, i) => {
    const start = m.index;
    const end = i + 1 < marks.length ? marks[i + 1].index : src.length;
    const body = src.slice(start, end);
    const uniq = a => [...new Set(a)];
    const classes = uniq([...body.matchAll(/class="([^"]{0,140})"/g)]
      .flatMap(m => m[1].split(/\s+/))
      .filter(c => /^[a-z][a-z0-9-]*$/.test(c)));
    viewmeta[m[1]] = {
      file, line: src.slice(0, start).split('\n').length, loc: body.split('\n').length - 1,
      ids: uniq([...body.matchAll(/id="([a-z0-9-]+)"/g)].map(x => x[1])).sort(),
      classes: classes.filter(c => !c.startsWith('is-') && !['tab', 'reveal'].includes(c)).slice(0, 26),
      go: uniq([...body.matchAll(/\bGO\.([a-zA-Z_0-9]+)/g)].map(x => x[1])).filter(x => x !== 'views').sort(),
      actions: uniq([...body.matchAll(/GO\.dossierActions\.([a-z_]+)/g)].map(x => x[1])
        .concat([...body.matchAll(/data-do=\\?"([a-z_]+)/g)].map(x => x[1]))).sort(),
      attrs: uniq([...body.matchAll(/data-(?:do|act|cact|rk|ri|tr-act|rec|ctl|verify|open|day|cal|tab|venue|doc|dest)=/g)].map(x => x[0])).sort(),
      dicts: uniq([...body.matchAll(/\bD\.([a-zA-Z]+)/g)].map(x => x[1])).sort(),
    };
  });
}
fs.writeFileSync(path.join(OUT, 'viewmeta.json'), JSON.stringify(viewmeta, null, 1));
console.log(`inventory.json : ${inventory.roles.length} profils, ${nav.length} sections · viewmeta.json : ${Object.keys(viewmeta).length} vues`);
