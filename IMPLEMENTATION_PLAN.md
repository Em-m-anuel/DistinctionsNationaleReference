# GAB-ORIENT — Plan de mise en œuvre (couverture fonctionnelle des acteurs)

> Mise à jour : 15 octobre 2026 · Référence frontend `DistinctionsNationaleReference`
> Objectif de la phase : **couverture fonctionnelle** de tous les acteurs du parcours, en conservant strictement la direction artistique existante (voir `DESIGN_REFERENCE.md`).

## 0. Documents de suivi

| Document | Contenu |
|---|---|
| `ROLE_COMPONENT_MAPPING.md` | Acteurs, responsabilités, composants réutilisés, permissions |
| `PAGES_MAP.md` | Pages, navigation par profil, paramètres d'URL |
| `IMPLEMENTATION_PLAN.md` | Ce document : périmètre, avancement, points ouverts |
| `TEST_REPORT.md` | Compte rendu des vérifications automatisées et manuelles |
| `DESIGN_REFERENCE.md` | Référence visuelle (inchangée, complétée §9) |

## 1. Audit initial (phase 1)

La référence ne comptait que **3 profils** (`chef`, `agent`, `demandeur`) et 6 vues
(`apercu`, `dossiers`, `courriers`, `ceremonies`, `statistiques`, `notifications`, `profil`).
Les lacunes identifiées :

- 11 acteurs du parcours absents : Récipiendaire, les trois secrétariats (Ministre, DGT, DR),
  Chef de service distinct de l'agent, Inspecteur, DGT, Ministre, DR, Régisseur, Administrateur ;
- variante **Demandeur — Ministère** non représentée (une seule entreprise) ;
- aucune interface de **réception / classement / transmission** des courriers ;
- pas de **décision par l'autorité destinataire** (le service enregistrait la décision reçue, sans circuit amont) ;
- pas de **contrôle / inspection** ni de signalement d'anomalies ;
- pas d'**ordre de recette**, de **dépôt de reçu**, ni de **vérification du paiement** ;
- pas de **stock de médailles**, de mouvements, de commandes, de livraisons, de fournisseurs ;
- pas d'**enregistrement de remise effective** (le stock n'existait pas) ni de **retrait sans cérémonie** ;
- **recours**, **relances**, **DTS** et **pièces justificatives** sans interface dédiée ;
- pas d'**administration** (comptes, paramètres, journaux) ;
- notifications limitées à deux audiences (`service` et `org:<id>`).

## 2. Avancement (phases 2 à 6)

| # | Élément | État |
|---|---|---|
| 2.1 | Modèle de données : 3 autorités destinataires, 14 profils, dictionnaires (paiement, remise, contrôle, recours, transmission, stock, comptes) | fait |
| 2.2 | Registre des transmissions, ordres de recette, reçus, stock, mouvements, commandes, livraisons, fournisseurs, remises, retraits, contrôles, recours, relances, DTS | fait |
| 3.1 | Noyau : portées de visibilité (`org`, `person`, `authority`, `service`), permissions par acteur, navigation par sections, audiences de notification | fait |
| 3.2 | Panneau de dossier : sections Autorité destinataire, Paiement, Contrôle, Recours, Remise, DTS | fait |
| 3.3 | Demandeur : bénéficiaires, DTS et pièces, compléments, recours et relances, ordres de recette et reçus, suivi des cérémonies | fait |
| 3.4 | Récipiendaire : profil et affiliations, mes distinctions, documents, cérémonies, retrait sans cérémonie | fait |
| 3.5 | Secrétariats Ministre / DGT / DR : réception, enregistrement, classement, transmission, historique | fait |
| 3.6 | Chef de service : supervision, files de travail, validations, ordres de recette, cérémonies, statistiques | fait |
| 3.7 | Agent du Service des Distinctions : instruction, vérification, compléments, recours, relances | fait |
| 3.8 | Inspecteur : contrôle, vérification documentaire, signalement d'anomalies | fait |
| 3.9 | DGT, Ministre, DR : dossiers transmis, décision/avis, recours, validation de cérémonie, journal | fait |
| 3.10 | Régisseur : recettes, reçus, stock, mouvements, commandes, livraisons, remises effectives, retraits | fait |
| 3.11 | Administrateur : comptes, paramètres, journaux techniques | fait |
| 4 | Cohérence des données de démonstration entre profils | fait |
| 5 | Tests (analyse statique, DOM simulé, parcours par profil) | fait — voir `TEST_REPORT.md` |
| 6 | Bilan, ambiguïtés métier | fait — § 5 ci-dessous |

## 3. Parcours couvert de bout en bout

1. Création et soumission du dossier (assistant 4 étapes, courrier d'initiation, DTS, pièces)
2. Réception et transmission par le secrétariat de l'autorité destinataire (registre `TR-2026-…`)
3. Consultation et décision initiale par l'autorité destinataire (Ministre / DGT / DR selon le dossier)
4. Instruction par le Service des Distinctions (recevabilité, vérification des bénéficiaires et des pièces)
5. Vérification documentaire et contrôle par l'Inspecteur (anomalies, demandes de correction)
6. Demandes de complément et réponses du demandeur (avec relances)
7. Décision, rejet ou recours
8. Émission de l'ordre de recettes (chef / agent)
9. Paiement hors application, dépôt du reçu (demandeur) et vérification (régisseur)
10. Préparation et remise effective des médailles (régisseur — seule action qui diminue le stock)
11. Organisation des cérémonies, négociation des dates et lieux, confirmation et suivi
12. Retrait sans cérémonie lorsque la procédure s'applique
13. Notifications, relances, historique et clôture

## 4. Règles de cohérence appliquées

- Le **stock ne diminue que sur « Enregistrer la remise effective »** ; la réservation est une opération
  distincte et réversible, enregistrée comme mouvement de type `reservation`.
- Une **date proposée n'est jamais confirmée** avant l'action « Enregistrer la validation » (référence + attestation).
- Une **décision** est toujours *enregistrée* au nom de l'autorité compétente avec la référence de son courrier ;
  l'application ne décide pas.
- Le **visa interne** reste une mention de circuit horodatée, sans valeur de signature.
- Les **ordres de recette et reçus** sont des données de démonstration : aucun paiement réel n'est effectué et
  l'interface l'indique explicitement.
- Chaque action métier écrit une ligne d'historique sur le dossier, une entrée de **journal technique**
  (visible par l'administrateur) et, lorsque c'est pertinent, une **notification** à l'audience concernée.

## 5. Points ouverts et ambiguïtés métier (phase 6)

| # | Question | Traitement actuel dans le prototype |
|---|---|---|
| 1 | Intitulé exact du sigle **DTS** (la maquette principale parle de « Document de travail et de synthèse ») | Libellé neutre « DTS — déclaration de travail et de salaire », à confirmer ; le champ est isolé dans `data.js` |
| 2 | Autorité compétente pour valider une date de cérémonie | Le **Chef du Service** coordonne et propose ; la **validation** est ouverte au Chef, au Ministre et à la DGT. À trancher |
| 3 | Effet du paiement sur la remise | Le prototype exige un **reçu déposé** pour enregistrer une remise effective et signale un avertissement si le reçu n'est pas encore vérifié. Règle à confirmer |
| 4 | Décision finale : DR (dossier initial) vs Ministre | Repris de la maquette principale : la **DR rend la décision finale sur le dossier initial** dont elle est destinataire ; le Ministre et la DGT interviennent selon le routage. À valider |
| 5 | Stock initial et seuils d'alerte | Valeurs de démonstration, modifiables par le régisseur dans le prototype |
| 6 | Frais de dossier / montants des ordres de recette | Montants fictifs, signalés comme tels ; aucune valeur comptable |
| 7 | Confidentialité des courriers internes | Les notes internes restent invisibles au demandeur et au récipiendaire |
| 8 | Suppression d'un dossier | Non prévue : la procédure ne prévoit pas de suppression, seulement rejet/recours |
