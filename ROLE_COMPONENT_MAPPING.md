# GAB-ORIENT — Correspondance acteurs / composants

> Référence frontend `DistinctionsNationaleReference` · 15 octobre 2026
> 14 profils, 8 familles, 24 vues, 26 actions de dossier, 24 permissions. Aucune direction artistique nouvelle : chaque écran est composé des composants existants (`DESIGN_REFERENCE.md`).

## 1. Acteurs et périmètres

| Acteur | Clé | Famille | Compte de démonstration | Périmètre de données (`scope`) | Vues |
|---|---|---|---|---|---|
| Demandeur — Entreprise | `demandeur_entreprise` | Demandeurs | Hervé Nguema — Directeur des ressources humaines | organisme `o1` | 12 |
| Demandeur — Ministère | `demandeur_ministere` | Demandeurs | Olga Mintsa — Secrétaire générale adjointe | organisme `o6` | 12 |
| Employé / Récipiendaire | `recipiendaire` | Bénéficiaires | Récipiendaire — Agent | personne `DNG-2026-002-R3`, `DNG-2026-021-R1` | 8 |
| Secrétaire du Ministre | `sec_min` | Secrétariats | Sylvie Nzamba — Secrétaire du Ministre | autorité `min` | 7 |
| Secrétaire de la DGT | `sec_dgt` | Secrétariats | Brice Oyane — Secrétaire de la Direction générale du Travail | autorité `dgt` | 7 |
| Secrétaire de la DR | `sec_dr` | Secrétariats | Ghislain Makaya — Secrétaire de la Direction régionale du Travail | autorité `dr` | 7 |
| Chef de service | `chef` | Service des Distinctions | Joséphine Mba-Ondo — Chef du Service des Distinctions | service : tous les dossiers du circuit | 15 |
| Agent du Service des Distinctions | `agent` | Service des Distinctions | Landry Moussavou — Agent instructeur | service : tous les dossiers du circuit | 12 |
| Inspecteur | `inspecteur` | Contrôle | Rosine Lekogo — Inspectrice du travail | service : tous les dossiers du circuit | 8 |
| DGT — Directeur général du Travail | `dgt` | Autorités destinataires | Aline Mintsa — Directeur général du Travail | autorité `dgt` | 9 |
| Ministre du Travail | `ministre` | Autorités destinataires | Patrick Obame — Ministre du Travail | autorité `min` | 9 |
| DR — Directeur régional du Travail | `dr` | Autorités destinataires | Serge Bivigou — Directeur régional du Travail — Estuaire | autorité `dr` | 9 |
| Régisseur des médailles | `regisseur` | Régie | Nadège Koumba — Régisseur des médailles | régie : dossiers approuvés, stock, paiements | 10 |
| Administrateur | `admin` | Administration | Wilfried Ekomi — Administrateur GAB-ORIENT | transverse : comptes, paramètres, journaux | 4 |

## 2. Permissions (`role().can`)

| Permission | Libellé | Profils |
|---|---|---|
| `create` | Créer un dossier | Entreprise demandeur · Ministère demandeur · Chef de service · Agent instructeur |
| `instruct` | Ouvrir l’instruction | Chef de service · Agent instructeur |
| `verify` | Vérifier les bénéficiaires et les pièces | Chef de service · Agent instructeur |
| `complement` | Demander un complément | Chef de service · Agent instructeur |
| `relance` | Relancer un demandeur | Chef de service · Agent instructeur · DGT · Ministre · DR |
| `note` | Préparer une note de transmission | Chef de service · Agent instructeur |
| `transmit` | Transmettre à la hiérarchie | Chef de service |
| `visa` | Apposer un visa interne | Chef de service |
| `decide` | Enregistrer une décision | DGT · Ministre · DR |
| `avis` | Émettre un avis hiérarchique | DGT · Ministre · DR |
| `recours` | Examiner un recours | Entreprise demandeur · Ministère demandeur · DGT · Ministre · DR |
| `propose` | Proposer une cérémonie | Entreprise demandeur · Ministère demandeur · Chef de service · Agent instructeur |
| `coordinate` | Coordonner les cérémonies | Chef de service |
| `valider_ceremonie` | Valider une date de cérémonie | DGT · Ministre |
| `observe` | Ajouter des observations | Entreprise demandeur · Ministère demandeur · Récipiendaire · Chef de service · Agent instructeur · Inspecteur · DGT · Ministre · DR · Régisseur |
| `answer` | Déposer un complément | Entreprise demandeur · Ministère demandeur |
| `receive` | Accuser réception d’un courrier | Secrétariat Ministre · Secrétariat DGT · Secrétariat DR · DGT · Ministre · DR |
| `register` | Enregistrer un courrier au registre | Secrétariat Ministre · Secrétariat DGT · Secrétariat DR |
| `route` | Transmettre à un service ou à une autorité | Secrétariat Ministre · Secrétariat DGT · Secrétariat DR |
| `classify` | Classer un courrier | Secrétariat Ministre · Secrétariat DGT · Secrétariat DR |
| `control` | Effectuer un contrôle | Inspecteur |
| `flag` | Signaler une anomalie | Inspecteur |
| `verifier_pieces` | Vérifier les pièces justificatives | Inspecteur |
| `recette` | Émettre un ordre de recette | Chef de service · Agent instructeur |
| `deposer_recu` | Déposer un reçu de paiement | Entreprise demandeur · Ministère demandeur |
| `paiement_verif` | Vérifier un reçu de paiement | Régisseur |
| `stock` | Gérer le stock et les mouvements | Régisseur |
| `remise` | Enregistrer une remise effective | Chef de service · Régisseur |
| `retrait` | Demander un retrait sans cérémonie | Récipiendaire |
| `retrait_traitement` | Traiter les retraits sans cérémonie | Régisseur |
| `admin` | Administrer les comptes et les journaux | Administrateur |

## 3. Œuvres attendues par acteur et composants réutilisés

### Demandeur — Entreprise (`demandeur_entreprise`)

*Œuvres* — Créer et suivre les dossiers de l’organisme, répondre aux compléments et aux relances, déposer les reçus de paiement, suivre la cérémonie.

*Composants et mécanismes réutilisés* : `ui.head` · `ui.kpis` · `ui.toolbar` · `pipelineCard` · `ui.table` · `GO.openDrawer (tiroir de dossier)` · `assistant `#/nouveau` en 4 étapes` · `dropzone de dépôt de pièces` · `GO.formModal (complément, recette, recours)` · `timeline d’historique` · `GO.empty`

*Vues* : `apercu` · `dossiers` · `nouveau` · `beneficiaires` · `pieces` · `complements` · `recours` · `recettes` · `courriers` · `ceremonies` · `journal` · `notifications`

*Permissions* : `create` · `answer` · `propose` · `recours` · `observe` · `deposer_recu`

### Demandeur — Ministère (`demandeur_ministere`)

*Œuvres* — Mêmes œuvres que la variante Entreprise, avec un circuit ministériel (autorité Ministre, secrétariat du Ministre) et un organisme de type Ministère.

*Composants et mécanismes réutilisés* : `idem Demandeur` · `org de type Ministère (secteur, tutelle)` · `autorité destinataire Ministre`

*Vues* : `apercu` · `dossiers` · `nouveau` · `beneficiaires` · `pieces` · `complements` · `recours` · `recettes` · `courriers` · `ceremonies` · `journal` · `notifications`

*Permissions* : `create` · `answer` · `propose` · `recours` · `observe` · `deposer_recu`

### Employé / Récipiendaire (`recipiendaire`)

*Œuvres* — Consulter ses distinctions, ses documents accessibles, sa cérémonie et demander un retrait sans cérémonie.

*Composants et mécanismes réutilisés* : `ui.head` · `ui.kpis` · `recip-card` · `ui.table` · `mini-agenda (prochaines cérémonies)` · `GO.formModal (retrait)` · `doc-list / aperçu de document`

*Vues* : `apercu` · `distinctions` · `pieces` · `ceremonies` · `retraits` · `dossiers` · `courriers` · `notifications`

*Permissions* : `retrait` · `observe`

### Secrétaire du Ministre (`sec_min`)

*Œuvres* — Réception, classement et transmission des courriers du Ministre, registre et suivi des dossiers de l’autorité.

*Composants et mécanismes réutilisés* : `ui.head` · `ui.kpis` · `ui.toolbar` · `ui.filterBar + chips` · `ui.table (registre)` · `GO.openDrawer (fiche courrier)` · `mentions de transmission`

*Vues* : `apercu` · `transmissions` · `courriers` · `dossiers` · `ceremonies` · `journal` · `notifications`

*Permissions* : `receive` · `register` · `route` · `classify`

### Secrétaire de la DGT (`sec_dgt`)

*Œuvres* — Idem pour la DGT, sur le circuit DGT (autorité destinataire) et son registre propre.

*Composants et mécanismes réutilisés* : `idem Secrétariat`

*Vues* : `apercu` · `transmissions` · `courriers` · `dossiers` · `ceremonies` · `journal` · `notifications`

*Permissions* : `receive` · `register` · `route` · `classify`

### Secrétaire de la DR (`sec_dr`)

*Œuvres* — Idem pour la DR, sur le circuit DR.

*Composants et mécanismes réutilisés* : `idem Secrétariat`

*Vues* : `apercu` · `transmissions` · `courriers` · `dossiers` · `ceremonies` · `journal` · `notifications`

*Permissions* : `receive` · `register` · `route` · `classify`

### Chef de service (`chef`)

*Œuvres* — Superviser le service : file d’instruction, validations internes (visa), transmissions, ordres de recette, préparation des remises et propositions de cérémonie, statistiques du service.

*Composants et mécanismes réutilisés* : `ui.head` · `ui.kpis` · `pipelineCard` · `ui.table` · `drawer de dossier` · `visa (`#/courriers/<doc>`)` · `GO.formModal (note, transmission, recette, remise)` · `graphiques (`charts.js`)` · `calendrier (`views-ceremonies.js`)`

*Vues* : `apercu` · `dossiers` · `nouveau` · `instruction` · `supervision` · `beneficiaires` · `complements` · `recours` · `recettes` · `remises` · `courriers` · `ceremonies` · `statistiques` · `journal` · `notifications`

*Permissions* : `create` · `instruct` · `verify` · `complement` · `relance` · `note` · `transmit` · `visa` · `recette` · `propose` · `coordinate` · `observe` · `remise`

### Agent du Service des Distinctions (`agent`)

*Œuvres* — Instruire les dossiers : recevabilité, vérification des bénéficiaires et des pièces, compléments, relances, propositions de cérémonie.

*Composants et mécanismes réutilisés* : `file d’instruction `#/instruction`` · `vérification bénéficiaires/pièces` · `ui.formGrid (formulaires)` · `timeline` · `toasts et états de chargement `withLoading``

*Vues* : `apercu` · `dossiers` · `nouveau` · `instruction` · `beneficiaires` · `complements` · `recours` · `recettes` · `courriers` · `ceremonies` · `journal` · `notifications`

*Permissions* : `create` · `instruct` · `verify` · `complement` · `relance` · `note` · `propose` · `observe` · `recette`

### Inspecteur (`inspecteur`)

*Œuvres* — Contrôler de façon documentaire et signaler les anomalies, sans décision d’attribution.

*Composants et mécanismes réutilisés* : `vue `#/controle`` · `observations (`obs`)` · `findings (`code`, `libellé`, `sévérité`)` · `ui.badge / dictBadge` · `ui.kpis`

*Vues* : `apercu` · `dossiers` · `controle` · `beneficiaires` · `courriers` · `ceremonies` · `journal` · `notifications`

*Permissions* : `control` · `flag` · `observe` · `verifier_pieces`

### DGT — Directeur général du Travail (`dgt`)

*Œuvres* — Décider des dossiers transmis, examiner les recours, suivre les statistiques et les cérémonies au nom de la DGT.

*Composants et mécanismes réutilisés* : `vue `#/decisions`` · `GO.formModal (décision, avis, recours)` · `ui.tabs` · `statistiques` · `fiche de cérémonie`

*Vues* : `apercu` · `dossiers` · `decisions` · `recours` · `courriers` · `ceremonies` · `statistiques` · `journal` · `notifications`

*Permissions* : `decide` · `avis` · `recours` · `relance` · `valider_ceremonie` · `observe` · `receive`

### Ministre du Travail (`ministre`)

*Œuvres* — Décider et viser au nom du Ministre, suivre les recours et les statistiques ministérielles.

*Composants et mécanismes réutilisés* : `idem Autorité`

*Vues* : `apercu` · `dossiers` · `decisions` · `recours` · `courriers` · `ceremonies` · `statistiques` · `journal` · `notifications`

*Permissions* : `decide` · `avis` · `recours` · `relance` · `valider_ceremonie` · `observe` · `receive`

### DR — Directeur régional du Travail (`dr`)

*Œuvres* — Décider et viser au nom de la DR, sur les dossiers de son ressort.

*Composants et mécanismes réutilisés* : `idem Autorité`

*Vues* : `apercu` · `dossiers` · `decisions` · `recours` · `courriers` · `ceremonies` · `statistiques` · `journal` · `notifications`

*Permissions* : `decide` · `recours` · `relance` · `avis` · `observe` · `receive`

### Régisseur des médailles (`regisseur`)

*Œuvres* — Tenir le stock des médailles (entrées, réservations, seuils, commandes, livraisons, fournisseurs), émettre les ordres de recette, vérifier les reçus et enregistrer les remises effectives et les retraits.

*Composants et mécanismes réutilisés* : `vue `#/stock` (4 onglets)` · `vue `#/recettes`` · `vue `#/remises`` · `mouvements (`#st-mv`)` · `GO.formModal (mouvement, remise, retrait)` · `ui.table` · `KPI de stock`

*Vues* : `apercu` · `recettes` · `stock` · `remises` · `retraits` · `dossiers` · `ceremonies` · `courriers` · `journal` · `notifications`

*Permissions* : `paiement_verif` · `stock` · `remise` · `retrait_traitement` · `observe`

### Administrateur (`admin`)

*Œuvres* — Administrer les comptes, les paramètres d’affichage et consulter les journaux, sans décision métier.

*Composants et mécanismes réutilisés* : `vue `#/administration` (onglets comptes / paramètres / données)` · `vue `#/journal`` · `ui.toolbar (recherche, filtres)` · `switch (préférences locales)`

*Vues* : `apercu` · `administration` · `journal` · `notifications`

*Permissions* : `admin`

## 4. Bibliothèque de composants (existante, réutilisée)

| Composant | Rôle | Utilisé par |
|---|---|---|
| `ui.head({eyebrow,title,sub,actions})` | en-tête de page (fil d’ariane, titre, sous-titre, actions) | toutes les vues |
| `ui.kpis([{label,count,note}])` | bandeau d’indicateurs avec compteurs animés (`data-c`) | 24 vues |
| `ui.card({i,icon,title,sub,body})` + `reveal` | carte de contenu avec apparition séquencée | toutes les vues |
| `ui.toolbar({search,selects,actions})` | recherche, filtres, actions de liste | dossiers, courriers, registres, journal, administration |
| `ui.filterBar` + `ui.chips` | filtres à puces avec compteurs | dossiers, compléments, recours, décisions, retraits, transmissions |
| `ui.table(cols,rows,{caption})` | tableau de données responsive (libellés `data-label`) | 22 vues |
| `GO.openDrawer/setDrawer/closeDrawer` | panneau latéral de détail (dossier, courrier, mouvements) | dossiers, courriers, régie, compléments |
| `GO.modal` / `GO.formModal` | modales de saisie avec validation, `validate`, `checks`, `run` | 26 actions |
| `GO.confirmDialog` | confirmation avec case d’attestation facultative | visa, transmission, clôture, annulation |
| `GO.toast` / `GO.withLoading` | retour d’action et état de chargement des boutons | toutes les actions |
| `GO.empty(icon,title,text,action)` | état vide explicite | toutes les vues |
| `GO.badge/statusBadge/cerBadge/docBadge/dictBadge` | pastilles d’état à partir des dictionnaires | toutes les vues |
| `GO.stepMini` / `GO.stepper` / `pipelineCard` | étapes du circuit et répartition par étape | dossiers, vue d’ensemble, instruction, supervision |
| `timeline` (`tl-item`) | historique horodaté des dossiers et documents | dossiers, cérémonies, journal |
| `tabs` / `tab-ink` | onglets internes à une page | stock, administration, cérémonies, décisions, courriers, remises |
| `cal-grid`/`cal-detail`/`month-list` | calendrier mensuel + fiche de cérémonie | cérémonies |
| `charts.js`, `map.js` | graphiques SVG/Canvas et carte des lieux (Leaflet ou plan schématique) | statistiques, cérémonies |
| `dropzone` | dépôt de pièces justificatives (10 Mo, pdf/jpeg/png) | assistant, compléments, recettes |

## 5. Actions de dossier (`GO.dossierActions`, 26)

| Action | Effet | Droit requis |
|---|---|---|
| `answer` — Déposer le complément demandé | change le statut du dossier et journalise l’étape | Entreprise demandeur · Ministère demandeur |
| `avis` — Consigner un avis hiérarchique | saisie de démonstration ; état, historique et notifications mis à jour | DGT · Ministre · DR |
| `cer` — Ouvrir la fiche de cérémonie | fait évoluer la proposition de cérémonie (jamais confirmée sans validation) | Entreprise demandeur · Ministère demandeur · Chef de service · Agent instructeur |
| `cer_done` — Clôturer la cérémonie | fait évoluer la proposition de cérémonie (jamais confirmée sans validation) | Chef de service |
| `complement` — Demander un complément | change le statut du dossier et journalise l’étape | Chef de service · Agent instructeur |
| `control` — Effectuer un contrôle documentaire | fait évoluer la proposition de cérémonie (jamais confirmée sans validation) | Inspecteur |
| `decide` — Enregistrer la décision | change le statut du dossier et journalise l’étape | DGT · Ministre · DR |
| `deposer_recu` — Déposer le reçu de paiement | fait évoluer l’ordre de recette ou son reçu (aucun encaissement) | Entreprise demandeur · Ministère demandeur |
| `instruct` — Ouvrir l’instruction | saisie de démonstration ; état, historique et notifications mis à jour | Chef de service · Agent instructeur |
| `negocier` — Négocier la date | fait évoluer la proposition de cérémonie (jamais confirmée sans validation) | Chef de service |
| `note` — Préparer la note de transmission | saisie de démonstration ; état, historique et notifications mis à jour | Chef de service · Agent instructeur |
| `propose` — Proposer une date et un lieu | fait évoluer la proposition de cérémonie (jamais confirmée sans validation) | Entreprise demandeur · Ministère demandeur · Chef de service · Agent instructeur |
| `recette` — Émettre l’ordre de recette | fait évoluer l’ordre de recette ou son reçu (aucun encaissement) | Chef de service · Agent instructeur |
| `recours` — Instruire un recours | fait évoluer le recours | Entreprise demandeur · Ministère demandeur · DGT · Ministre · DR |
| `recours_decide` — Enregistrer la suite du recours | change le statut du dossier et journalise l’étape | Entreprise demandeur · Ministère demandeur · DGT · Ministre · DR |
| `relance` — Relancer le demandeur | saisie de démonstration ; état, historique et notifications mis à jour | Chef de service · Agent instructeur · DGT · Ministre · DR |
| `remise_ok` — Enregistrer la remise effective | diminue ou augmente le stock physique ; réservations libérées ; remise enregistrée | Chef de service · Régisseur |
| `remise_prep` — Préparer et réserver les médailles | diminue ou augmente le stock physique ; réservations libérées ; remise enregistrée | Chef de service · Régisseur |
| `retrait_demande` — Demander un retrait sans cérémonie | fait évoluer la demande de retrait sans cérémonie | Récipiendaire |
| `retrait_remis` — Enregistrer le retrait effectif | diminue ou augmente le stock physique ; réservations libérées ; remise enregistrée | Régisseur |
| `retrait_valide` — Autoriser le retrait | fait évoluer la demande de retrait sans cérémonie | Régisseur |
| `transmit` — Transmettre à l’autorité | saisie de démonstration ; état, historique et notifications mis à jour | Chef de service |
| `valider_cer` — Valider la date de cérémonie | fait évoluer la proposition de cérémonie (jamais confirmée sans validation) | DGT · Ministre |
| `verif_recu` — Vérifier le reçu | fait évoluer l’ordre de recette ou son reçu (aucun encaissement) | Régisseur |
| `verify` — Vérifier bénéficiaires et pièces | saisie de démonstration ; état, historique et notifications mis à jour | Chef de service · Agent instructeur |
| `visa` — Apposer le visa interne | change le statut du dossier et journalise l’étape | Chef de service |

## 6. Règles de gestion appliquées (et ce qui reste hors application)

| Règle | Mise en œuvre | Vérifiée par |
|---|---|---|
| Le stock physique ne diminue qu’à l’enregistrement d’une remise effective | `remise_ok` / `retrait_remis` : deux mouvements (`available`, `reserved`) par médaille | C4, C6 · écriture 2 |
| Une proposition de cérémonie n’est jamais confirmée sans validation | `propose` → `propose`/`negociation` → `valider_cer` (autorité) → `confirme` | C5 |
| La clôture d’une cérémonie exige une remise effective et est un acte du service | `drawDetail` et `actionsFor` : bouton « Marquer comme terminée » seulement si remise `remise`/`retrait` | C4 |
| Un dossier déjà remis n’ouvre plus de demande de retrait | `APPLI_REASON` (régie) et `actionsFor` (tiroir) | C6 |
| Le paiement est effectué hors application ; le reçu est déposé puis vérifié | `recette` → `deposer_recu` → `verif_recu` ; aucun montant calculé | C3 · écriture 5 |
| L’ancienneté conditionne l’échelon | `GO.eligibility` / `GO.seniority` : Bronze 10-19 ans, Argent 20-29 ans, Or 30 ans et plus (valeurs illustratives) | vue `#/beneficiaires`, vérification |
| Aucune suppression de dossier, aucune attribution automatique d’échelon | les actions n’effacent jamais un dossier ; l’échelon proposé est saisi par le demandeur | C1, C2 |
| Les décisions de l’autorité ne sont pas prises par le service | `decide`/`avis`/`recours` réservés aux profils d’autorité ; le service prépare et transmet | C3 |
| Aucun encaissement, aucune signature électronique | bandeaux explicites dans les modales ; mention « ne constitue pas une signature » | C3, C4 |

## 7. Notifications et audiences

`GO.notify({type,aud,ref,title,msg})` alimente `#/notifications`, filtré par `GO.audiences()` : `authority:<id>` (autorité destinataire), `org:<id>` (organisme demandeur), `person:<id>` (récipiendaire), `service`, `inspecteur`. Types : `depot`, `reception`, `transmission`, `instruction`, `complement`, `relance`, `visa`, `decision`, `refus`, `ceremonie`, `remise`, `paiement`, `note`, `courrier`.

## 8. Données de démonstration

| Table | Lignes |
|---|---|
| `dossiers` | 21 |
| `documents` | 25 |
| `dts` | 8 |
| `distinctions` | 3 |
| `person` | 6 |
| `ceremonies` | 5 |
| `notifications` | 29 |
| `transmissions` | 35 |
| `receiptOrders` | 5 |
| `stock` | 4 |
| `suppliers` | 3 |
| `purchaseOrders` | 3 |
| `deliveries` | 2 |
| `stockMovements` | 19 |
| `remises` | 2 |
| `withdrawals` | 1 |
| `complements` | 3 |
| `relances` | 1 |
| `controls` | 3 |
| `recours` | 1 |
| `audit` | 5 |
| `accounts` | 15 |
| `organisations` | 8 |
| `venues` | 7 |

Stock initial (disponible / réservé / seuil) : Bronze 148/32/60 · Argent 96/24/40 · Or 43/18/30 · Diplômes 360/86/100 — chaque valeur est la somme des 19 `stockMovements`.

## 9. Écarts connus

- Les barèmes d’ancienneté par échelon sont **illustratifs** : aucun document de règles métier n’est présent dans le dépôt, donc aucune règle n’a été inventée au-delà de ces bornes affichées.
- Les montants des ordres de recette sont des **montants de démonstration** saisis à la main ; `#/nouveau` propose un nombre de distinctions par échelon (Or 3, Argent 2, Bronze 1) à titre indicatif pour l’ordre de recette.
- Les préférences d’affichage (mode compact, animations réduites) sont locales au poste ; les compte et paramètres sont des données de démonstration persistées dans `localStorage`.

