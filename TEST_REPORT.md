# GAB-ORIENT — Compte rendu des tests

> Référence frontend `DistinctionsNationaleReference` · campagne du 15 octobre 2026
> Aucune interface n’est déclarée fonctionnelle au seul motif qu’elle s’affiche : chaque écran est chargé,
> ses identifiants contrôlés, ses filtres, onglets et actions exercés, et les écritures sont vérifiées après
> rechargement de la page.

## 1. Environnement et méthode

| Élément | Détail |
|---|---|
| Application | fichiers statiques servis par `python3 -m http.server 8123` depuis la racine du dépôt |
| Navigateur | Chromium 131 (binaire local) piloté par `puppeteer-core`, sans interface graphique |
| Harnais | `tests/` (versionné) : `run.mjs` (parcours), `consistency.mjs` (cohérence inter-profils), `responsive.mjs` (mise en page), `pagemeta.mjs` (inventaire des pages), `inventory.mjs` (inventaire statique), `gen_docs.py` (documents de suivi) — voir `tests/README.md` |
| Fonctions sensibles simulées | Leaflet et tuiles OpenStreetMap non joignables depuis l’environnement : la carte bascule sur le plan schématique prévu par `map.js` (`#pm-sub` l’indique) ; aucun autre appel réseau n’est requis |
| Reproductibilité | `cd tests && npm install` puis `node run.mjs --flows`, `node consistency.mjs`, `node responsive.mjs` |

Les résultats bruts sont conservés en JSON dans `tests/reports/` : `report.json`, `consistency.json`,
`responsive.json`, `pagemeta.json`, `inventory.json`, `viewmeta.json`.

## 2. Couverture

| Périmètre | Volume |
|---|---|
| Profils | 14 (8 familles) |
| Vues | 24 (`GO.views`), 23 pages de navigation + `profil` |
| Pages parcourues | 143 couples profil × page (14 profils, `profil` inclus) |
| Actions de dossier | 26 (`GO.dossierActions`) |
| Formulaires / modales | 30 surfaces de saisie (actions, cérémonies, administration) |

## 3. Parcours automatisé (14 profils, 129 pages + `profil`)

- **0 erreur JavaScript** sur l’ensemble de la campagne (`errors: []`, `perView: {}`) ;
- **0 page en échec** : chaque page rend un `h1`, plus de 400 caractères utiles, ses tableaux et ses boutons ;
- **23 parcours d’interaction** réussis, dont 4 écritures avec contrôle de persistance après rechargement :

| # | Parcours | Résultat observé |
|---|---|---|
| 1 | Changement de profil par le menu (`#account-menu`) | « Chef du Service des Distinctions » |
| 2 | Dossier → ouverture du tiroir de détail | Banque Équatoriale de Crédit |
| 3 | Liste → recherche + filtre par statut | 21 lignes → 4 |
| 4 | Dossier reçu → instruction (modale + validations) | DNG-2026-018, première action proposée selon le statut |
| 5 | Cérémonies → onglet « Proposer un lieu et une date » + carte | 7 lieux → 3 après recherche, fiche de lieu rendue |
| 6 | Cérémonies → calendrier (mois précédent/suivant, sélection de jour) | novembre 2026, détail du jour affiché |
| 7 | Assistant `#/nouveau` → étape 1 valide puis étape 2 refusée sans récipiendaire | 11 messages de validation, l’étape reste bloquée |
| 8 | Bénéficiaires → filtres et recherche (demandeur) | 12 lignes |
| 9 | Journal → recherche et filtre de niveau (administrateur) | 8 → 0 événements (filtre restrictif) |
| 10 | Administration → onglets comptes / paramètres / données | 3 tables de référentiel |
| 11 | Stock → modale de mouvement, quantité invalide refusée | modale maintenue, 1 message d’erreur |
| 12 | Remises → registre et état des réservations | 1 ligne (remise préparée) |
| 13 | Retraits → profil demandeur | vue conforme : aucune demande proposée tant qu’une cérémonie ou un dossier non approuvé l’exclut |
| 14 | Recours → instruction par la DGT | 1 recours listé |
| 15 | Décisions → onglets et suivi (DGT) | 3 filtres, 6 décisions rendues |
| 16 | Registre → classement d’un courrier reçu (secrétariat DGT) | 16 courriers au registre |
| 17 | Compléments → relance depuis la liste (service) | 3 compléments |
| 18 | **Écriture** — instruction d’un dossier reçu | DNG-2026-018 : `recu` → `en_cours`, statut conservé après rechargement |
| 19 | **Écriture** — entrée de 5 médailles Bronze | stock Bronze 148 → 153, mouvement journalisé |
| 20 | **Écriture** — réponse à un complément (demandeur Ministère) | DNG-2026-012 : complément déposé, instruction reprise |
| 21 | **Écriture** — demande de retrait sans cérémonie (récipiendaire) | demande créée et visible par la régie |
| 22 | **Écriture** — création d’un compte puis journalisation | 16 comptes, entrée de journal |
| 23 | Recherche globale (`Ctrl+K`) et ouverture d’un résultat | 12 résultats, navigation vers `#/dossiers/DNG-2026-001` |

### États vides

30 pages présentent un état vide **explicite et légitime** (aucune donnée pour ce profil à cette date),
par exemple `demandeur_entreprise/pieces` — « Aucune pièce », `recipiendaire/retraits` — « Aucun retrait sans
cérémonie », `ministre/decisions` — « Aucun dossier dans cette vue », `sec_*/apercu` — « Aucune action en
attente ». Aucune page ne reste blanche ni ne signale une erreur : la liste complète figure dans
`tests/reports/report.json` (`roles.<profil>.views.<page>.empty`).

## 4. Cohérence inter-profils (8 contrôles)

Chaque contrôle écrit avec un profil et vérifie l’effet avec un autre ; **8/8 réussis**, 0 erreur JS.

| # | Contrôle | Preuve observée |
|---|---|---|
| C1 | Cloisonnement des périmètres et identité des références | demandeur `o1` : 3 dossiers (`DNG-2026-001/009/017`), aucun dossier d’un autre organisme ; registre du Ministre limité à ses 5 transmissions ; `DNG-2026-012` vu « complement » par les 4 profils concernés |
| C2 | Instruction → complément → réponse du demandeur → reprise | `DNG-2026-017` : `recu` → `en_cours` (service) → `complement` (`CPL-2026-0011`) → réponse (`answer`) → `en_cours` ; 3 pièces rattachées ; historique partagé |
| C3 | Transmission → décision → ordre de recette → reçu → vérification | `DNG-2026-012` : note visée puis transmise (`TR-2026-0151`, `TR-2026-0134`, `TR-2026-0128` au registre du Ministre), décision approuvée par le Ministre, `OR-2026-0116` émis par le service, reçu déposé par le demandeur, vérifié par la Régie ; le statut du dossier reste `approuve` (aucun encaissement) |
| C4 | Remise effective : stock, dossier, distinction, clôture | `REM-2026-0002` : Bronze 148 → 146, Argent 96 → 94, réservations libérées (−2 / −2) ; historique du dossier et distinction du récipiendaire à jour ; clôture de la cérémonie **impossible avant** la remise (« Clôture en attente de la remise ») et possible après |
| C5 | Proposition de cérémonie sans confirmation prématurée | `CER-2026-06` (DNG-2026-019, 29 oct. 2026) : proposée par le service → état « Date proposée » chez le secrétariat du Ministre, sans mention « Confirmée » → validée par le Ministre (`valider_cer`) → « Confirmée » |
| C6 | Retrait sans cérémonie | `RET-2026-0002` (DNG-2026-021) : demande du récipiendaire → autorisation de la Régie (référence + rendez-vous) → retrait effectif : 3 sorties de stock, remise `REM-2026-0003` (mode `retrait`), distinction mise à jour côté récipiendaire |
| C7 | Contrôle documentaire inspecteur → service | `CTL-2026-0005` (DNG-2026-009), conclusion « anomalie », visible dans le dossier côté service, 2 notifications liées |
| C8 | Journalisation et traçabilité | journal 5 → 65 entrées, 65 lignes affichées, 9 acteurs distincts journalisés (agent, chef de service, inspecteur, régisseur, récipiendaire, secrétariat, autorité, demandeur, administrateur) |

Détail complet : `tests/reports/consistency.json`.

## 5. Mise en page et adaptation (7 formats)

| Format | Pages sans débordement horizontal |
|---|---|
| 1440 × 900 | 25 / 25 |
| 1280 × 800 | 25 / 25 |
| 1180 × 800 | 25 / 25 |
| 1100 × 800 | 25 / 25 |
| 1061 × 800 (limite de la navigation) | 25 / 25 |
| 820 × 1024 (tablette) | 25 / 25 |
| 390 × 844 (mobile) | 25 / 25 |

- **Navigation** : barre de sections resserrée entre 1061 px et 1280 px (interlettrage, police 13 px,
  compteurs masqués sous 1130 px) pour tenir sur une ligne sans créer de défilement horizontal ;
  sous 1060 px, bascule sur le panneau mobile (`#nav-toggle` → panneau de 320 px, 10 à 16 liens selon le profil).
- **Tiroir de dossier** : 620 px sur bureau, plein écran sous 760 px, sans débordement du document.
- **Tableaux** : défilement interne (`.table-wrap`, `.mini-table`) ; les cartes passent en une colonne
  (`grid-2`, `grid-3`, `grid-main`, `cal-layout`, `doc-layout`, `form-layout`) par les points de rupture existants.
- Repère métrique : plus de 175 chargements de page mesurés (`document.documentElement.scrollWidth`),
  0 dépassement.

## 6. Anomalies trouvées et corrigées pendant la campagne

| # | Symptôme | Cause | Correction |
|---|---|---|---|
| 1 | `Cannot set properties of null (setting 'innerHTML')` | aperçu de document quitté avant l’échéance du `setTimeout` de 260 ms (`views-courriers.js`) | garde `if (!stage || !stage.isConnected) return;` |
| 2 | Vue d’ensemble du récipiendaire vide | `roles.recipiendaire.scope.value` était une chaîne (`DNG-2026-001-R2`) au lieu d’une liste | périmètre `['DNG-2026-002-R3', 'DNG-2026-021-R1']` |
| 3 | Indicateurs (KPI) figés à 0 | la valeur finale était écrite avec `data-c`, que l’animation reprenait à 0 | `kpi-value` écrit le nombre réel, `countUp` part de 0 quand `data-c` est présent |
| 4 | Aucun point d’attention pour les profils externes | la liste `todos()` n’avait pas de branche externe | tâche « Suivre l’avancement — <réf.> » pour les dossiers sous l’étape 5 |
| 5 | Remise effective enregistrée avec l’état du mode (`cérémonie`) | `state: v.mode` au lieu de l’état du dictionnaire | états `remise` / `retrait` selon la modalité |
| 6 | Cérémonie clôturée par la Régie | la régie modifiait `c.state` | la clôture reste un acte du service, proposé **après** la remise ; la régie notifie le service |
| 7 | Références générées mal formées (`CPL-2026--11`, `REM-2026--3`) | `nextRef` concaténait un préfixe terminé par `-` | préfixe normalisé et numéro sur 4 chiffres (`CPL-2026-0011`) |
| 8 | Demande de retrait proposée sur un dossier déjà remis | la règle ne tenait compte que de la cérémonie | `APPLI_REASON` et le tiroir vérifient l’état de la remise |
| 9 | Défilement horizontal de 42 px entre 1061 px et 1280 px | 9 sections de navigation sur une ligne | règles `@media (max-width: 1280px)` et `(max-width: 1130px)` |
| 10 | Titre de modale absent | `formModal` ne transmettait pas `title`/`icon`/`tone` à `GO.modal` | transmission des métadonnées de la modale |

## 7. Limites connues

1. **Persistance locale** : les écritures vivent dans `localStorage` (clé GAB-ORIENT) ; vider le stockage du
   navigateur restaure le jeu de démonstration. Aucun serveur n’est interrogé.
2. **Règles métier absentes du dépôt** : les bornes d’ancienneté (Bronze 10-19 ans, Argent 20-29, Or 30+) et
   la notion de cas particuliers sont **illustratives** et signalées comme telles ; aucune règle n’a été inventée.
3. **Montants** : les ordres de recette portent des montants saisis à la main ; l’application ne calcule
   aucun montant réglementaire et n’effectue aucun encaissement.
4. **Carte** : sans accès à Leaflet/OpenStreetMap, l’application affiche le plan schématique ; les positions
   restent indicatives.
5. **Authentification** : le changement de profil est un sélecteur de démonstration, sans compte ni mot de passe.
6. **Accessibilité** : les repères structurels (`h1`, `aria-live`, `aria-selected`, `tabindex`, `sr-only`,
   `prefers-reduced-motion`) sont en place et vérifiés à la lecture du DOM ; aucun audit automatisé de
   contrastes ni parcours clavier exhaustif n’a été mené dans cette campagne.
7. **Feuille d’impression** : les styles `@media print` existent mais n’ont pas été validés par un rendu PDF.
8. **Parcours 13 et 9** : ce sont des vérifications d’ouverture et de filtrage ; les assertions métier de bout
   en bout sont portées par les contrôles C1 à C8.

## 8. Ce que la campagne ne prouve pas

- Qu’un dossier réel déposé hors application suive ce circuit (aucun back-end, aucun connecteur) ;
- que les barèmes et montants correspondent à la réglementation en vigueur ;
- qu’un navigateur autre que Chromium se comporte à l’identique (aucun test croisé Firefox/WebKit) ;
- qu’un volume de production (milliers de dossiers) tienne sans pagination — le prototype charge l’ensemble
  du jeu en mémoire (21 dossiers, 25 documents, 35 transmissions).
