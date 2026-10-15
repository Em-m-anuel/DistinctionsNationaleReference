# GAB-ORIENT — Référence de conception

Ce prototype est la page de référence visuelle et fonctionnelle de GAB-ORIENT. Il montre, sur des données cohérentes, l'ensemble des composants communs que les interfaces de chaque profil doivent réutiliser.

## 1. Lancer le prototype

```bash
cd gab-orient
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

Tout autre serveur statique convient (`npx serve`, extension « Live Server »…). Aucune compilation n'est nécessaire. L'ouverture directe du fichier (`file://`) fonctionne également, mais un serveur local est recommandé.

Ressources distantes, toutes **facultatives** :

| Ressource | Rôle | Sans réseau |
|---|---|---|
| Google Fonts (Public Sans, Source Serif 4) | Typographie | Polices système de repli |
| Leaflet 1.9.4 (cdnjs) + tuiles OpenStreetMap | Carte interactive des lieux | Plan schématique explicitement signalé comme tel |

## 2. Organisation des fichiers

```
index.html                     Structure de la page, sprite d'icônes, conteneurs globaux
assets/css/gab-orient.css      Système visuel complet (tokens → composants → vues → responsive)
assets/js/data.js              Données de référence et dictionnaires (seul fichier à remplacer par l'API)
assets/js/charts.js            Graphiques SVG/HTML sans dépendance (barres, courbe, anneau, barres horizontales)
assets/js/map.js               Adaptateur cartographique (Leaflet ou plan schématique)
assets/js/core.js              Utilitaires, état, composants partagés, en-tête, recherche, routeur
assets/js/views-dossiers.js    Vue d'ensemble, liste des dossiers, panneau de détail, actions métier
assets/js/views-courriers.js   Courriers et documents (visionneuse, visa), notifications
assets/js/views-ceremonies.js  Calendrier, détail des cérémonies, sélection du lieu et de la date
assets/js/views-stats-form.js  Statistiques, formulaire en 4 étapes, profil
```

Les données sont séparées de la présentation : `GO_DATA.seed` contient dossiers, documents, cérémonies et notifications ; le reste du fichier contient les dictionnaires (statuts, médailles, rôles, lieux, jours indisponibles). Les modifications faites dans l'interface sont enregistrées dans le `localStorage` du poste (clé `gab-orient.prototype.state`) et peuvent être effacées par « Réinitialiser les données du poste ». Aucun secret n'y est stocké.

`config.referenceDate` (15 octobre 2026) sert de date du jour pour garder les données cohérentes. En production, utiliser `new Date()`.

## 3. Direction artistique

**Principe :** un portail administratif officiel, lumineux et dense en information, où l'identité nationale apparaît par touches précises plutôt que par aplats.

- **Surfaces** : fond gris bleuté très clair (`--bg #f3f5f9`) avec deux halos discrets (bleu et vert) en haut de page ; cartes blanches à bordure fine et ombre courte. Aucun fond beige ou crème.
- **Encre** : bleu nuit (`--navy-900 #0c1f3a`) pour les titres, les chiffres et les éléments d'autorité (bouton « Viser », en-tête de la cérémonie à venir, avatar).
- **Couleurs nationales, avec parcimonie** :
  - vert `#009e60` : actions principales, progression, page active, validation ;
  - jaune `#fcd116` : distinctions (rosette, médaille), attente, avertissements ;
  - bleu `#3a75c4` : liens, étape en cours, informations, éléments secondaires.
  Les trois couleurs ne sont réunies que dans l'emblème, la barre de défilement, le liseré des en-têtes de courrier et les trois points du pied de page.
- **Rouge brique** `#b4442f` : réservé aux refus, conflits et erreurs.
- **Graphisme institutionnel** : emblème étoilé en anneau tricolore, rosette dorée en CSS pour la cérémonie à venir, papier à en-tête crédible pour les courriers. Pas d'illustration décorative.

### Typographie

| Usage | Style |
|---|---|
| Titre de page | Source Serif 4, 28 px, 600 |
| Titre de section / carte | Public Sans, 17 px, 600 |
| Corps d'interface | Public Sans, 14–15 px |
| Métadonnées, aides | 12–13 px, gris `--muted` |
| Références dossier | Monospace 12,5 px, 600 (`.ref`) |
| Surtitre de page | 12 px, capitales espacées, vert, précédé d'un trait — seul usage de capitales |

Le serif est réservé aux titres de page, aux dates mises en avant et aux courriers : il apporte la dimension officielle sans alourdir l'outil.

### Espacements et proportions

Grille de 4 px ; gouttières de 20 px entre cartes ; 18 px de marge interne ; conteneur de 1320 px. Les compositions alternent des proportions variées (pleine largeur, 1,75/1, trois colonnes) au lieu de cartes identiques. Chaque carte contient un en-tête (titre + sous-titre expliquant ce que l'on lit) et un contenu dense.

## 4. Composants disponibles

| Composant | Classes / API | Où le voir |
|---|---|---|
| Barre de défilement tricolore | `.progress-rail > .progress-fill` | Haut de chaque page |
| En-tête deux lignes, menus | `.site-header`, `.nav-link[aria-current]`, `[data-dd]` + `.dd-menu` | Partout |
| Recherche globale | `GO.openSearch()`, Ctrl K ou `/` | Bouton de recherche |
| Boutons | `.btn` + `-primary`, `-secondary`, `-navy`, `-ghost`, `-danger`, `-sm`, `-xs` | Partout |
| Champs | `.field > .label + .input/.select/.textarea + .hint`, `GO.fieldError(field, msg)` | Formulaire |
| Badges de statut | `GO.statusBadge(s)`, `GO.cerBadge(s)`, `GO.docBadge(s)` ; tons `.tone-*` | Listes, panneaux |
| Puces de filtre | `.chip[aria-pressed]` avec compteur `.chip-n` | Dossiers |
| Onglets à indicateur glissant | `.tabs[role=tablist] .tab-ink`, `GO.tabs(root, onChange)` | Cérémonies, notifications |
| Tableau → cartes sur mobile | `table.data-table.responsive` + `data-label` sur chaque `td` | Dossiers, priorités |
| Indicateur d'étapes | `GO.stepper(d)` (détaillé), `GO.stepMini(d)` (compact) | Panneau, liste |
| Chronologie | `ol.timeline > .tl-item > .tl-dot.k-{type}` | Activité, historique |
| Panneau latéral | `GO.openDrawer({key, html, onClose})`, `GO.closeDrawer()` | Détail d'un dossier |
| Modale / confirmation | `GO.modal({...})`, `await GO.confirmDialog({title, message, check})` | Toutes les actions |
| Notification éphémère | `GO.toast(type, titre, message)` | Après chaque action |
| Infobulle | attribut `data-tip="<strong>…</strong>…"` | Graphiques, boutons désactivés |
| États | `GO.empty(icône, titre, texte, action)`, `.skeleton`, `.spinner`, `.alert-{info,warn,error,success}` | Partout |
| Graphiques | `GOCharts.mount(el, 'bar'|'line'|'donut'|'hbar', opts)` | Statistiques, aperçu |
| Carte | `GOMap.create(el, venues, {onSelect})` → `{select, filter, destroy}` | Proposer un lieu |
| Visionneuse de courrier | `.viewer`, `.paper`, `.visa-zone` | Courriers |
| Calendrier mensuel | `.cal-grid`, `.cal-ev.st-{état}` | Cérémonies |
| Assistant multi-étapes | `.wizard-steps`, `.wz-panel`, `.dropzone` | Nouveau dossier |

## 5. Règles de statut (à respecter dans toutes les vues)

- **Dossiers** : `recu` (gris), `en_cours` (bleu), `complement` (jaune), `transmis` (bleu nuit), `approuve` (vert), `refuse` (rouge). Le libellé complet apparaît dans les badges, le libellé court dans les filtres.
- **Cérémonies** : `propose` (contour bleu en pointillés), `negociation` (jaune), `confirme` (vert plein), `termine` (gris), `conflit` (rayures rouges + pictogramme). **Une date proposée n'est jamais affichée en vert.** Seule l'action « Enregistrer la validation », qui exige une référence et une case d'attestation, fait passer une cérémonie à « Confirmée ».
- **Visa** : le visa interne est une mention de circuit horodatée. L'interface indique explicitement qu'il ne constitue pas une signature électronique ; les signatures des courriers sont représentées par des emplacements « copie numérisée » ou « original papier ».
- **Décisions** : l'application enregistre une décision reçue de l'autorité compétente (avec la référence du courrier) ; elle ne la prend pas.
- **Indicateurs** : aucun pourcentage d'évolution inventé. Chaque valeur est calculée à partir des données et sa base est indiquée (« sur 6 décisions », « depuis 7 jours »).

## 6. Comportements interactifs

- Tous les menus se ferment au clic extérieur et avec Échap, et se parcourent avec les flèches.
- Les modales et panneaux bloquent l'arrière-plan (`inert`), piègent le focus, se ferment avec Échap (la couche du dessus d'abord) et rendent le focus à l'élément d'origine.
- Chaque action métier produit un effet visible : changement de statut (badge animé), ligne d'historique surlignée, notification au destinataire, compteur mis à jour, toast de confirmation.
- Les dossiers, courriers, cérémonies et notifications sont liés : une notification ouvre le dossier ou le courrier correspondant ; un dossier approuvé mène à la proposition de cérémonie ; une proposition apparaît au calendrier.
- Le panneau d'un dossier et la sélection d'un événement sont reflétés dans l'URL (`#/dossiers/DNG-2026-009`, `#/ceremonies/CER-2026-02`) sans recharger la vue.
- Calendrier : flèches pour les jours, Page ↑/↓ pour les mois, Début/Fin pour la semaine.

## 7. Animations

| Durée | Usage | Courbe |
|---|---|---|
| 140 ms | survols, couleurs | `--ease` |
| 240 ms | menus, onglets, compteurs, changement de vue | `--ease` / `--ease-out` |
| 360–420 ms | panneaux, modales, calendrier, étapes du formulaire, apparition des sections | `--ease-out` |
| 600–1000 ms | tracé des graphiques, compteurs chiffrés | `--ease-out` |

Règles : une seule direction de mouvement par interaction (glissement de 6 à 18 px maximum), pas de rebond, apparitions décalées de 30 à 60 ms entre éléments d'une même liste. `prefers-reduced-motion` et la préférence « Réduire les animations » du profil ramènent toutes les durées à 1 ms. La barre tricolore est vide en haut de page et se remplit avec le défilement ; le bouton de retour en haut n'apparaît qu'après un écran de défilement.

## 8. Responsive

| Largeur | Comportement |
|---|---|
| > 1280 px | Compositions complètes, sélection de lieu en trois colonnes |
| ≤ 1200 px | Indicateurs sur deux rangées, recherche réduite |
| ≤ 1060 px | Navigation dans un tiroir (menu ☰), colonnes empilées, panneaux non collants |
| ≤ 860 px | Visionneuse de courrier en plein écran avec page ajustée à la largeur |
| ≤ 760 px | Tableaux transformés en cartes, panneau latéral et modales en plein écran (feuille basse), calendrier compact avec pastilles de couleur et liste du mois |

Aucune vue ne produit de défilement horizontal à 390 px (vérifié).

## 9. Reproduire le design sur les autres profils

1. **Déclarer le profil** dans `GO_DATA.roles` : entrées de navigation (`views`), permissions (`can`) et périmètre (`scope`, par exemple l'organisme du demandeur). La navigation, les boutons d'action et les données visibles s'adaptent automatiquement — voir les profils « Agent » et « Entreprise demandeur » dans le menu du compte.
2. **Créer une vue** en enregistrant `GO.views.<nom> = { render(main, route), update?(route) }`, avec la structure : `.page-head` (surtitre, titre serif, sous-titre, actions) puis des `.card` composées.
3. **Réutiliser les composants** listés plus haut plutôt que d'en créer de nouveaux. Exemples :
   - *Secrétariat* : liste de la vue Courriers filtrée sur les courriers entrants + colonne « Date de réception ».
   - *Ministre, DG, DR* : visionneuse de courrier avec action de visa conditionnée par `can('visa')` et l'étape du dossier.
   - *Inspecteur* : liste de dossiers avec statut de contrôle, panneau latéral avec section « Anomalies » (même structure `.d-section`).
   - *Régisseur* : indicateurs de stock en `.kpi-strip`, mouvements en `.timeline`, alertes en `.alert-warn`, graphique `hbar` par échelon.
   - *Récipiendaire* : profil + distinctions dans `.dl-grid`, cérémonies dans `.mini-agenda`, demande de retrait via l'assistant `.wizard-steps`.
   - *Administrateur* : tableaux `data-table` (comptes, journaux) avec filtres `.chip-row`.
4. **Toute action** doit suivre le schéma : confirmation (modale) → état de chargement du bouton → mutation des données → `GO.addHistory` / `GO.notify` → `GO.commit()` → rafraîchissement ciblé → toast.
5. **Ne jamais** présenter une donnée calculée sans sa base, une proposition comme confirmée, ou un visa comme une signature.

## 10. Intégrations restant à brancher

| Élément | État dans le prototype | À fournir |
|---|---|---|
| Données | `GO_DATA.seed` + persistance locale | API des dossiers, documents, cérémonies, notifications |
| Fichiers déposés | Nom, taille et type conservés ; aperçu non généré | Service de stockage documentaire et génération d'aperçus |
| Courriers numérisés | Rendus HTML reproduisant un courrier | Fichiers PDF/images réels et visionneuse PDF |
| Carte | Leaflet + tuiles OSM publiques si le réseau le permet ; sinon plan schématique | Fournisseur de tuiles sous contrat (`config.map.tileUrl`) |
| Lieux | 7 lieux, coordonnées indicatives, capacités déclarées | Référentiel validé des lieux, coordonnées vérifiées |
| Photographies des lieux | Emplacement « photographie officielle à fournir » | Photographies officielles des lieux concernés |
| Libellés des médailles, jours indisponibles | Dictionnaires dans `data.js` | Nomenclature et calendrier officiels |
| Conditions d'éligibilité | Non appliquées (ancienneté seulement calculée et affichée) | Règles officielles, à vérifier côté serveur |
| Visa interne | Mention horodatée locale | Service d'horodatage / de signature si une valeur juridique est requise |
| Authentification | Changement de profil local, déconnexion simulée | Fournisseur d'identité et contrôle d'accès serveur |

## 11. Interactions testées

Testées automatiquement dans Chromium (bureau 1440 × 900 et mobile 390 × 844) : **84 vérifications réussies sur 84, aucune erreur JavaScript.**

- Barre tricolore liée au défilement ; bouton de retour en haut (apparition, retour).
- Menus compte, notifications et navigation : ouverture, fermeture au clic extérieur et par Échap.
- Dossiers : filtres par statut (y compris depuis le menu), recherche, état vide et réinitialisation, filtre de période, tri.
- Panneau de dossier : ouverture, ouverture de l'instruction, préparation de la note, validation du formulaire de complément, fermeture modale puis panneau par Échap.
- Décision : erreurs de validation, enregistrement, apparition de « Programmer la cérémonie ».
- Courriers : aperçu, emplacement de visa vide, confirmation bloquée tant que la case n'est pas cochée, visa apposé, document suivant, zoom, document illisible et demande de renumérisation ; puis transmission du dossier visé.
- Notifications : filtre « Non lues », marquage individuel avec mise à jour du compteur, « Tout marquer comme lu » et état vide.
- Recherche globale : ouverture par Ctrl K, résultats, ouverture avec Entrée.
- Calendrier : détail d'une cérémonie confirmée, mois suivant, jour férié indisponible, date proposée non confirmée, validation d'une cérémonie, navigation clavier (flèches, Page ↓), bouton « Aujourd'hui ».
- Sélection de lieu : recherche, fiche et épingle synchronisées, détection du conflit avec CER-2026-02, blocage du jour férié, proposition valide remplaçant la date en conflit, retour au calendrier sur la proposition.
- Formulaire : erreurs et résumé, pré-remplissage d'un organisme connu, téléphone invalide, ancienneté calculée, ajout d'un récipiendaire, date d'entrée future refusée, conservation des valeurs entre étapes, format de fichier refusé, pièces obligatoires, attestation requise, soumission confirmée et création de DNG-2026-019.
- Persistance après rechargement ; changement de profil (navigation et périmètre des dossiers, accès refusé aux statistiques pour le demandeur) ; filtres des statistiques et tableaux de données ; déconnexion et reconnexion.
- Mobile : six vues sans défilement horizontal, menu tiroir et fermeture par Échap, panneau de dossier et visionneuse en plein écran.
- `prefers-reduced-motion` : contenu affiché immédiatement.

Non testé dans cet environnement : l'affichage réel de la carte Leaflet et des polices Google (réseau indisponible pendant les tests ; le plan schématique de repli a été vérifié), les lecteurs d'écran, Safari et Firefox.
