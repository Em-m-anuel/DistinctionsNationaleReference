# Tests — GAB-ORIENT (référence `DistinctionsNationaleReference`)

Ces scripts pilotent un Chromium sans interface graphique contre l’application servie en statique.
Ils vérifient le rendu **et** les interactions : aucune interface n’est déclarée fonctionnelle au seul motif
qu’elle s’affiche. Les résultats de la campagne du 15 octobre 2026 sont dans `reports/` et commentés dans
`../TEST_REPORT.md`.

## 1. Prérequis

```bash
cd tests
npm install                 # puppeteer-core + @sparticuz/chromium (Chromium fourni par le paquet)
```

`@sparticuz/chromium` extrait un Chromium et ses bibliothèques dans un dossier temporaire. Si vous utilisez
un Chromium déjà installé, renseignez `CHROME_PATH` (binaire) et, au besoin, `CHROME_LIB` / `CHROME_FONTS`.

## 2. Lancer l’application

```bash
# depuis la racine du dépôt
python3 -m http.server 8123
```

L’URL est paramétrable : `BASE=http://127.0.0.1:8123/index.html`.

## 3. Campagne complète

```bash
node run.mjs --flows        # 14 profils × pages + 23 parcours, dont 4 écritures contrôlées après rechargement
node pagemeta.mjs           # inventaire des pages : titres, KPI, cartes, identifiants DOM réellement rendus
node inventory.mjs          # inventaire statique des profils, droits, dictionnaires et vues
node consistency.mjs        # 8 contrôles de cohérence inter-profils
node responsive.mjs         # 7 formats d’écran (1440 → 390 px), navigation mobile, tiroir de dossier
python3 gen_docs.py         # régénère ../ROLE_COMPONENT_MAPPING.md et ../PAGES_MAP.md depuis reports/
```

Options utiles :

| Variable | Effet |
|---|---|
| `BASE` | URL de l’application (défaut `http://127.0.0.1:8123/index.html`) |
| `OUT` | dossier des relevés JSON (défaut `tests/reports`) |
| `CHROME_PATH` | binaire Chromium à utiliser |
| `CHROME_LIB`, `CHROME_FONTS` | bibliothèques et polices du Chromium |
| `REPO` | racine du dépôt analysée par `inventory.mjs` |
| `node run.mjs --role=<clé>` | balayage limité à un profil |

## 4. Fichiers

| Fichier | Rôle |
|---|---|
| `run.mjs` | balayage « profils × pages », 23 parcours d’interaction, relevé des erreurs JS attribuées à la vue qui les produit ; `--flows` ajoute les écritures et contrôle leur persistance après rechargement |
| `consistency.mjs` | 8 contrôles inter-profils : cloisonnement des périmètres, complément, note/visa/transmission/décision, ordre de recette et reçu, remise effective et clôture, proposition de cérémonie, contrôle de l’inspecteur, journal |
| `responsive.mjs` | débordement horizontal, navigation mobile et tiroir de dossier sur 7 formats |
| `pagemeta.mjs` | inventaire des pages rendues (titres, indicateurs, cartes, identifiants DOM) utilisé par les documents de suivi |
| `inventory.mjs` | inventaire statique : profils, familles, permissions, dictionnaires, sections de navigation, volumes de démonstration, découpage des vues |
| `gen_docs.py` | génère `ROLE_COMPONENT_MAPPING.md` et `PAGES_MAP.md` à partir de `reports/` |
| `reports/*.json` | relevés de la dernière campagne (`report.json`, `consistency.json`, `responsive.json`, `pagemeta.json`, `inventory.json`, `viewmeta.json`) |

## 5. Points d’attention

- Les scripts **réinitialisent `localStorage`** avant de jouer les écritures : chaque campagne part du jeu de démonstration.
- Les appels sortants (Leaflet, tuiles OpenStreetMap, CDN de polices) sont ignorés par le relevé d’erreurs ;
  l’application bascule alors sur son plan schématique.
- `run.mjs --flows` dure environ 2 min 30 ; `responsive.mjs` environ 3 min (175 chargements de page mesurés).
- Les scripts ne modifient jamais le dépôt : la seule écriture se fait dans `OUT`.
