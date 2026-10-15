# GAB-ORIENT — Cartographie des pages

> Référence frontend `DistinctionsNationaleReference` · 15 octobre 2026
> 24 vues (`GO.views`), 23 pages de navigation, 14 profils. Une page n’est affichée que si `allowed(vue)` est vrai : la vue figure dans `role().views`, ou il s’agit de `nouveau` avec le droit `create`, ou de `profil` (toujours accessible).

## 1. Pages

| Page (`GO.views`) | Titre affiché | Fichier source | Route | Profils | Identifiants DOM observés (union des profils) |
|---|---|---|---|---|---|
| `apercu` | Vue d’ensemble | `dossiers` | `#/apercu` (vue d’entrée) | 14 | `ch-dep` |
| `dossiers` | Dossiers | `dossiers` | `#/dossiers` · `#/dossiers/<réf.>` (paramètres `?status=` `?q=`) | 13 | `df-authority` `df-chips` `df-count` `df-empty` `df-period` `df-q` `df-sort` `df-status` |
| `nouveau` | Nouveau dossier de distinction | `demande` | `#/nouveau` | 4 | `f-authority` `f-city` `f-contact` `f-contactRole` `f-email` `f-org` `f-phone` `f-sector` |
| `instruction` | File d’instruction | `service` | `#/instruction` | 2 | `if-chips` `if-count` `if-empty` `if-q` `if-sort` `if-table` |
| `supervision` | Supervision du service | `service` | `#/supervision` | 1 | `sv-t` |
| `beneficiaires` | Bénéficiaires et récipiendaires | `demande` | `#/beneficiaires` (paramètre `?q=`) | 5 | `bf-count` `bf-dts` `bf-empty` `bf-medal` `bf-q` `bf-status` `bf-table` `bf-wrap` |
| `complements` | Compléments et relances | `service` | `#/complements` (paramètre `?dossier=<réf.>`) | 4 | `kf-empty` `kf-q` `kf-state` `kf-table` |
| `decisions` | Dossiers transmis et décisions | `decisions` | `#/decisions` | 3 | `de-chips` `de-count` `de-medal` `de-q` `de-table` |
| `recours` | Recours | `decisions` | `#/recours` | 7 | `rc-chips` `rc-count` `rc-list` `rc-q` `rc-acc` `rc-b-RCS-2026-0001` |
| `courriers` | Courriers et documents | `courriers` | `#/courriers` · `#/courriers/<doc>` (paramètres `?dossier=` `?q=`) | 13 | `dl-count` `dl-dossier` `dl-list` `dl-q` `dl-state` `dl-t` `dl-type` `v-stage` |
| `transmissions` | Registre des courriers | `courriers` | `#/transmissions` | 3 | `tr-chips` `tr-count` `tr-direction` `tr-empty` `tr-new` `tr-q` `tr-sort` `tr-state` |
| `ceremonies` | Cérémonies | `ceremonies` | `#/ceremonies` · `#/ceremonies/<CER-…>` · `#/ceremonies/proposer?dossier=<réf.>` `&date=` | 13 | `cal-detail` `cal-grid` `cal-title` `ml-t` `ml-title` `month-list` `tb-cal` `tb-prop` |
| `remises` | Remises des médailles | `regie` | `#/remises` | 2 | `rm-panel` |
| `recettes` | Ordres de recette et reçus | `regie` | `#/recettes` | 5 | `rf-count` `rf-q` `rf-sort` `rf-state` `rf-table` |
| `stock` | Stock des médailles | `regie` | `#/stock` | 1 | `st-field` `st-item` `st-mv` `st-new` `st-po` `st-sup` `stb-mv` `stb-po` |
| `distinctions` | Mes distinctions | `demande` | `#/distinctions` | 1 | `dz-retrait` `dz-t` |
| `pieces` | DTS et pièces justificatives | `demande` | `#/pieces` | 3 | `pc-add` `pc-count` `pc-docs` `pc-docs-t` `pc-dossier` `pc-empty` `pc-q` `pc-state` |
| `retraits` | Retraits sans cérémonie | `regie` | `#/retraits` | 2 | `wd-chips` `wd-count` `wd-new` `wd-q` `wd-table` |
| `controle` | Contrôles et anomalies | `service` | `#/controle` (paramètre `?dossier=<réf.>`) | 1 | `tf-list` `tf-new` `tf-q` `tf-state` |
| `statistiques` | Statistiques | `service` | `#/statistiques` | 4 | `ch-cum` `ch-dep` `ch-dts` `ch-fun` `ch-med` `ch-sec` `ch-sta` `ct-cum` |
| `journal` | Journal d’activité | `admin` | `#/journal` | 13 | `jf-actor` `jf-count` `jf-level` `jf-list` `jf-period` `jf-print` `jf-q` |
| `administration` | Comptes, paramètres et journaux | `admin` | `#/administration` | 1 | `ad-list` `ad-new` `ad-panel` `ad-q` |
| `notifications` | Notifications | `courriers` | `#/notifications` | 14 | `nt-all` `nt-list` `nt-n-all` `nt-n-unread` `nt-type` |
| `profil` | Mon profil | `admin` | `#/profil` | 14 | — |

## 2. Sections de navigation (13) et pages rattachées

| Section | Clé | Pages (condition) |
|---|---|---|
| Vue d’ensemble | `apercu` | Vue d’ensemble |
| Dossiers | `dossiers` | Tous les dossiers · Nouveau dossier (si droit `create`) · File d’instruction · Supervision du service · Bénéficiaires et récipiendaires · Compléments et relances |
| Décisions | `decisions` | Dossiers transmis et décisions · Recours |
| Courriers | `courriers` | Courriers et documents |
| Registre | `registre` | Registre des courriers |
| Cérémonies | `ceremonies` | Calendrier et propositions · Remises des médailles |
| Finances | `finances` | Ordres de recette et reçus · Stock des médailles |
| Suivi | `suivi` | Mes distinctions · DTS et pièces justificatives · Retraits sans cérémonie |
| Contrôle | `controle` | Contrôles et anomalies |
| Statistiques | `statistiques` | Statistiques |
| Journal | `journal` | Journal d’activité |
| Administration | `administration` | Comptes, paramètres et journaux |
| Notifications | `notifications` | Notifications |

Les identifiants listés sont ceux réellement présents dans `#view` lors du rendu (passage automatisé sur les 14 profils et leurs 129 pages) : ils sont donnés à titre de repère pour les tests. Les pages de synthèse (`apercu`) et les fiches composées s’appuient surtout sur des classes (`.card`, `.kpi`, `.pipe-cell`, `.tl-item`) et des attributs `data-*` (`data-act`, `data-do`, `data-cact`, `data-ev`, `data-open`, `data-ctl`, `data-v`).\n

La navigation n’affiche que les sections dont au moins une page est autorisée pour le profil ; une section réduite à une page prend le libellé court de cette page (`SHORT_NAV`). `profil` n’est pas dans la barre : il est atteint par le menu du compte (`#account-menu`).

## 3. Pages par profil

| Profil | Pages | Sections visibles |
|---|---|---|
| Demandeur — Entreprise (`demandeur_entreprise`) | 12 | Vue d’ensemble · Dossiers · Décisions · Courriers · Cérémonies · Finances · Suivi · Journal · Notifications |
| Demandeur — Ministère (`demandeur_ministere`) | 12 | Vue d’ensemble · Dossiers · Décisions · Courriers · Cérémonies · Finances · Suivi · Journal · Notifications |
| Employé / Récipiendaire (`recipiendaire`) | 8 | Vue d’ensemble · Dossiers · Courriers · Cérémonies · Suivi · Notifications |
| Secrétaire du Ministre (`sec_min`) | 7 | Vue d’ensemble · Dossiers · Courriers · Registre · Cérémonies · Journal · Notifications |
| Secrétaire de la DGT (`sec_dgt`) | 7 | Vue d’ensemble · Dossiers · Courriers · Registre · Cérémonies · Journal · Notifications |
| Secrétaire de la DR (`sec_dr`) | 7 | Vue d’ensemble · Dossiers · Courriers · Registre · Cérémonies · Journal · Notifications |
| Chef de service (`chef`) | 15 | Vue d’ensemble · Dossiers · Décisions · Courriers · Cérémonies · Finances · Statistiques · Journal · Notifications |
| Agent du Service des Distinctions (`agent`) | 12 | Vue d’ensemble · Dossiers · Décisions · Courriers · Cérémonies · Finances · Journal · Notifications |
| Inspecteur (`inspecteur`) | 8 | Vue d’ensemble · Dossiers · Courriers · Cérémonies · Contrôle · Journal · Notifications |
| DGT — Directeur général du Travail (`dgt`) | 9 | Vue d’ensemble · Dossiers · Décisions · Courriers · Cérémonies · Statistiques · Journal · Notifications |
| Ministre du Travail (`ministre`) | 9 | Vue d’ensemble · Dossiers · Décisions · Courriers · Cérémonies · Statistiques · Journal · Notifications |
| DR — Directeur régional du Travail (`dr`) | 9 | Vue d’ensemble · Dossiers · Décisions · Courriers · Cérémonies · Statistiques · Journal · Notifications |
| Régisseur des médailles (`regisseur`) | 10 | Vue d’ensemble · Dossiers · Courriers · Cérémonies · Finances · Suivi · Journal · Notifications |
| Administrateur (`admin`) | 4 | Vue d’ensemble · Journal · Administration · Notifications |

## 4. Paramètres d’URL

| Paramètre | Page | Effet |
|---|---|---|
| `#/dossiers/<réf.>` | dossiers | ouvre le tiroir de suivi du dossier (circuit, pièces, historique, actions du profil) |
| `?status=<statut>` | dossiers | pré-filtre la liste sur un statut (`recu`, `en_cours`, `complement`, `transmis`, `approuve`, `refuse`) |
| `?q=<texte>` | dossiers, beneficiaires, courriers | recherche initiale (référence, organisme, bénéficiaire, document) |
| `#/ceremonies/<CER-…>` | ceremonies | sélectionne la cérémonie dans le calendrier et affiche sa fiche |
| `#/ceremonies/proposer?dossier=<réf.>` | ceremonies | ouvre l’onglet « Proposer un lieu et une date » sur ce dossier |
| `&date=<AAAA-MM-JJ>` | ceremonies | pré-remplit la date proposée |
| `#/courriers/<doc>` | courriers | ouvre l’aperçu du document (visa interne inclus si le droit `visa` est présent) |
| `?dossier=<réf.>` | courriers, complements, controle | restreint la liste au dossier |

## 5. Rendu et chargement

Chaque vue expose `GO.views.<nom> = { render(main, route), update?(route) }`. Le routeur (`core.js#route`) vide `#view`, affiche un squelette, attend 240 ms (30 ms en `prefers-reduced-motion`), puis appelle `render`. `update` est utilisé pour les changements de route internes (sélection de dossier, de document, de onglet) sans reconstruire la page. Les vues non autorisées affichent une carte « Accès non autorisé ».
