#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Génère ROLE_COMPONENT_MAPPING.md et PAGES_MAP.md à partir des sources réelles
(data.js pour les profils/droits/vues, viewmeta.json pour les composants et identifiants)."""
import io, json, os, re

REPO = os.environ.get('REPO', os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.environ.get('OUT', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'reports'))
dump = json.load(open(os.path.join(OUT, 'inventory.json'), encoding='utf-8'))
vmeta = json.load(open(os.path.join(OUT, 'viewmeta.json'), encoding='utf-8'))
pagemeta = json.load(open(os.path.join(OUT, 'pagemeta.json'), encoding='utf-8'))
report = json.load(open(os.path.join(OUT, 'report.json'), encoding='utf-8'))

roles = {r['id']: r for r in dump['roles']}
families = dump['families']
perms = dump['permissions']
steps = dump['steps']

core = io.open(REPO + '/assets/js/core.js', encoding='utf-8').read()
nav_block = re.search(r'const NAV = \[(.*?)\n  \];', core, re.S).group(1)
NAV = []
for sec in re.finditer(r"\{ key: '([a-z]+)', label: '([^']+)', icon: '([a-z-]+)', pages: \[(.*?)\](?:, count: true)? \}", nav_block, re.S):
    pages = re.findall(r"\{ view: '([a-z]+)', label: '([^']+)'(?:, can: '([a-z]+)')? \}", sec.group(4))
    NAV.append({'key': sec.group(1), 'label': sec.group(2), 'icon': sec.group(3),
                'pages': [{'view': p[0], 'label': p[1], 'can': p[2] or None} for p in pages]})
nav_pages = [p['view'] for s in NAV for p in s['pages']]
SUBTITLE = {
    'apercu': 'Vue d’ensemble', 'dossiers': 'Dossiers', 'nouveau': 'Nouveau dossier de distinction',
    'instruction': 'File d’instruction', 'supervision': 'Supervision du service', 'beneficiaires': 'Bénéficiaires et récipiendaires',
    'complements': 'Compléments et relances', 'decisions': 'Dossiers transmis et décisions', 'recours': 'Recours',
    'courriers': 'Courriers et documents', 'transmissions': 'Registre des courriers', 'ceremonies': 'Cérémonies',
    'remises': 'Remises des médailles', 'recettes': 'Ordres de recette et reçus', 'stock': 'Stock des médailles',
    'distinctions': 'Mes distinctions', 'pieces': 'DTS et pièces justificatives', 'retraits': 'Retraits sans cérémonie',
    'controle': 'Contrôles et anomalies', 'statistiques': 'Statistiques', 'journal': 'Journal d’activité',
    'administration': 'Comptes, paramètres et journaux', 'notifications': 'Notifications', 'profil': 'Mon profil',
}
ROUTES = {
    'dossiers': '`#/dossiers` · `#/dossiers/<réf.>` (paramètres `?status=` `?q=`)',
    'nouveau': '`#/nouveau`',
    'ceremonies': '`#/ceremonies` · `#/ceremonies/<CER-…>` · `#/ceremonies/proposer?dossier=<réf.>` `&date=`',
    'courriers': '`#/courriers` · `#/courriers/<doc>` (paramètres `?dossier=` `?q=`)',
    'transmissions': '`#/transmissions`',
    'complements': '`#/complements` (paramètre `?dossier=<réf.>`)',
    'controle': '`#/controle` (paramètre `?dossier=<réf.>`)',
    'decisions': '`#/decisions`',
    'recours': '`#/recours`',
    'pieces': '`#/pieces`',
    'distinctions': '`#/distinctions`',
    'retraits': '`#/retraits`',
    'remises': '`#/remises`',
    'recettes': '`#/recettes`',
    'stock': '`#/stock`',
    'beneficiaires': '`#/beneficiaires` (paramètre `?q=`)',
    'instruction': '`#/instruction`',
    'supervision': '`#/supervision`',
    'statistiques': '`#/statistiques`',
    'journal': '`#/journal`',
    'administration': '`#/administration`',
    'notifications': '`#/notifications`',
    'profil': '`#/profil`',
    'apercu': '`#/apercu` (vue d’entrée)',
}

def roles_for(view):
    """Profils dont la liste de vues contient la page (profil toujours accessible)."""
    out = [rid for rid, r in roles.items() if view in r['views']]
    if view == 'profil':
        out = list(roles.keys())
    return out

def role_cells(view):
    rs = roles_for(view)
    return ' · '.join(roles[r]['short'] for r in rs) if rs else '—'

def file_of(view):
    m = vmeta.get(view)
    return m['file'].replace('views-', '').replace('.js', '') if m else '—'

SHELL_IDS = {'view', 'drawer', 'toasts', 'modal-layer', 'app', 'site-header'}

def ids_of(view):
    found = []
    for role, data in pagemeta.items():
        info = data['views'].get(view)
        if not info:
            continue
        for i in info.get('ids', []):
            if i not in SHELL_IDS and i not in found:
                found.append(i)
    return found

# ---------------------------------------------------------------- PAGES_MAP.md
L = []
L.append('# GAB-ORIENT — Cartographie des pages\n')
L.append('> Référence frontend `DistinctionsNationaleReference` · 15 octobre 2026\n'
         '> 24 vues (`GO.views`), 23 pages de navigation, 14 profils. Une page n’est affichée que si '
         '`allowed(vue)` est vrai : la vue figure dans `role().views`, ou il s’agit de `nouveau` avec '
         'le droit `create`, ou de `profil` (toujours accessible).\n')
L.append('## 1. Pages\n')
L.append('| Page (`GO.views`) | Titre affiché | Fichier source | Route | Profils | Identifiants DOM observés (union des profils) |')
L.append('|---|---|---|---|---|---|')
for view in nav_pages + ['profil']:
    ids = ' '.join('`' + i + '`' for i in ids_of(view)[:8]) or '—'
    L.append(f"| `{view}` | {SUBTITLE.get(view, '')} | `{file_of(view)}` | {ROUTES.get(view, '—')} | "
             f"{len(roles_for(view))} | {ids} |")
L.append('')
L.append('## 2. Sections de navigation (13) et pages rattachées\n')
L.append('| Section | Clé | Pages (condition) |')
L.append('|---|---|---|')
for s in NAV:
    pages = ' · '.join(f"{p['label']}" + (f" (si droit `{p['can']}`)" if p['can'] else '') for p in s['pages'])
    L.append(f"| {s['label']} | `{s['key']}` | {pages} |")
L.append('')
L.append('Les identifiants listés sont ceux réellement présents dans `#view` lors du rendu '
         '(passage automatisé sur les 14 profils et leurs 129 pages) : ils sont donnés à titre de repère pour '
         'les tests. Les pages de synthèse (`apercu`) et les fiches composées s’appuient surtout sur des classes '
         '(`.card`, `.kpi`, `.pipe-cell`, `.tl-item`) et des attributs `data-*` (`data-act`, `data-do`, '
         '`data-cact`, `data-ev`, `data-open`, `data-ctl`, `data-v`).\\n')
L.append('\nLa navigation n’affiche que les sections dont au moins une page est autorisée pour le profil ; '
         'une section réduite à une page prend le libellé court de cette page (`SHORT_NAV`). `profil` n’est pas '
         'dans la barre : il est atteint par le menu du compte (`#account-menu`).\n')
L.append('## 3. Pages par profil\n')
L.append('| Profil | Pages | Sections visibles |')
L.append('|---|---|---|')
for rid, r in roles.items():
    secs = [s['label'] for s in NAV if any(p['view'] in r['views'] and (not p['can'] or p['can'] in r['can']) for p in s['pages'])]
    L.append(f"| {r['label']} (`{rid}`) | {len(r['views'])} | {' · '.join(secs)} |")
L.append('')
L.append('## 4. Paramètres d’URL\n')
L.append('| Paramètre | Page | Effet |')
L.append('|---|---|---|')
for row in [
    ('`#/dossiers/<réf.>`', 'dossiers', 'ouvre le tiroir de suivi du dossier (circuit, pièces, historique, actions du profil)'),
    ('`?status=<statut>`', 'dossiers', 'pré-filtre la liste sur un statut (`recu`, `en_cours`, `complement`, `transmis`, `approuve`, `refuse`)'),
    ('`?q=<texte>`', 'dossiers, beneficiaires, courriers', 'recherche initiale (référence, organisme, bénéficiaire, document)'),
    ('`#/ceremonies/<CER-…>`', 'ceremonies', 'sélectionne la cérémonie dans le calendrier et affiche sa fiche'),
    ('`#/ceremonies/proposer?dossier=<réf.>`', 'ceremonies', 'ouvre l’onglet « Proposer un lieu et une date » sur ce dossier'),
    ('`&date=<AAAA-MM-JJ>`', 'ceremonies', 'pré-remplit la date proposée'),
    ('`#/courriers/<doc>`', 'courriers', 'ouvre l’aperçu du document (visa interne inclus si le droit `visa` est présent)'),
    ('`?dossier=<réf.>`', 'courriers, complements, controle', 'restreint la liste au dossier'),
]:
    L.append(f"| {row[0]} | {row[1]} | {row[2]} |")
L.append('')
L.append('## 5. Rendu et chargement\n')
L.append('Chaque vue expose `GO.views.<nom> = { render(main, route), update?(route) }`. Le routeur (`core.js#route`) '
         'vide `#view`, affiche un squelette, attend 240 ms (30 ms en `prefers-reduced-motion`), puis appelle `render`. '
         '`update` est utilisé pour les changements de route internes (sélection de dossier, de document, de onglet) '
         'sans reconstruire la page. Les vues non autorisées affichent une carte « Accès non autorisé ».')
io.open(REPO + '/PAGES_MAP.md', 'w', encoding='utf-8').write('\n'.join(L) + '\n')
print('PAGES_MAP.md :', len(L), 'lignes')

# ------------------------------------------------- ROLE_COMPONENT_MAPPING.md
view_list = sorted(vmeta.keys())
L = []
L.append('# GAB-ORIENT — Correspondance acteurs / composants\n')
L.append('> Référence frontend `DistinctionsNationaleReference` · 15 octobre 2026\n'
         '> 14 profils, 8 familles, 24 vues, 26 actions de dossier, 24 permissions. '
         'Aucune direction artistique nouvelle : chaque écran est composé des composants existants '
         '(`DESIGN_REFERENCE.md`).\n')
L.append('## 1. Acteurs et périmètres\n')
L.append('| Acteur | Clé | Famille | Compte de démonstration | Périmètre de données (`scope`) | Vues |')
L.append('|---|---|---|---|---|---|')
for rid, r in roles.items():
    scope = r['scope']
    scope_txt = '—'
    if scope and scope['kind'] == 'org':
        scope_txt = f"organisme `{scope['value']}`"
    elif scope and scope['kind'] == 'authority':
        scope_txt = f"autorité `{scope['value']}`"
    elif scope and scope['kind'] == 'person':
        v = scope['value']
        scope_txt = 'personne ' + (', '.join(f"`{x}`" for x in v) if isinstance(v, list) else f"`{v}`")
    elif r['family'] in ('service', 'inspection'):
        scope_txt = 'service : tous les dossiers du circuit'
    elif r['family'] == 'regie':
        scope_txt = 'régie : dossiers approuvés, stock, paiements'
    elif r['family'] == 'administration':
        scope_txt = 'transverse : comptes, paramètres, journaux'
    u = r['user'] or {}
    L.append(f"| {r['label']} | `{rid}` | {next((f['label'] for f in families if f['id'] == r['family']), r['family'])} | "
             f"{u.get('name', '—')}{' — ' + u['title'] if u.get('title') else ''} | {scope_txt} | {len(r['views'])} |")
L.append('')
L.append('## 2. Permissions (`role().can`)\n')
L.append('| Permission | Libellé | Profils |')
L.append('|---|---|---|')
for pid, label in perms.items():
    holders = ' · '.join(roles[r]['short'] for r in roles if pid in roles[r]['can'])
    L.append(f"| `{pid}` | {label} | {holders or '—'} |")
L.append('')
L.append('## 3. Œuvres attendues par acteur et composants réutilisés\n')
DETAIL = {
 'demandeur_entreprise': ("Créer et suivre les dossiers de l’organisme, répondre aux compléments et aux relances, déposer les reçus de paiement, suivre la cérémonie.",
   ['ui.head', 'ui.kpis', 'ui.toolbar', 'pipelineCard', 'ui.table', 'GO.openDrawer (tiroir de dossier)', 'assistant `#/nouveau` en 4 étapes', 'dropzone de dépôt de pièces', 'GO.formModal (complément, recette, recours)', 'timeline d’historique', 'GO.empty']),
 'demandeur_ministere': ("Mêmes œuvres que la variante Entreprise, avec un circuit ministériel (autorité Ministre, secrétariat du Ministre) et un organisme de type Ministère.",
   ['idem Demandeur', 'org de type Ministère (secteur, tutelle)', 'autorité destinataire Ministre']),
 'recipiendaire': ("Consulter ses distinctions, ses documents accessibles, sa cérémonie et demander un retrait sans cérémonie.",
   ['ui.head', 'ui.kpis', 'recip-card', 'ui.table', 'mini-agenda (prochaines cérémonies)', 'GO.formModal (retrait)', 'doc-list / aperçu de document']),
 'sec_min': ("Réception, classement et transmission des courriers du Ministre, registre et suivi des dossiers de l’autorité.",
   ['ui.head', 'ui.kpis', 'ui.toolbar', 'ui.filterBar + chips', 'ui.table (registre)', 'GO.openDrawer (fiche courrier)', 'mentions de transmission']),
 'sec_dgt': ("Idem pour la DGT, sur le circuit DGT (autorité destinataire) et son registre propre.", ['idem Secrétariat']),
 'sec_dr': ("Idem pour la DR, sur le circuit DR.", ['idem Secrétariat']),
 'chef': ("Superviser le service : file d’instruction, validations internes (visa), transmissions, ordres de recette, préparation des remises et propositions de cérémonie, statistiques du service.",
   ['ui.head', 'ui.kpis', 'pipelineCard', 'ui.table', 'drawer de dossier', 'visa (`#/courriers/<doc>`)', 'GO.formModal (note, transmission, recette, remise)', 'graphiques (`charts.js`)', 'calendrier (`views-ceremonies.js`)']),
 'agent': ("Instruire les dossiers : recevabilité, vérification des bénéficiaires et des pièces, compléments, relances, propositions de cérémonie.",
   ['file d’instruction `#/instruction`', 'vérification bénéficiaires/pièces', 'ui.formGrid (formulaires)', 'timeline', 'toasts et états de chargement `withLoading`']),
 'inspecteur': ("Contrôler de façon documentaire et signaler les anomalies, sans décision d’attribution.",
   ['vue `#/controle`', 'observations (`obs`)', 'findings (`code`, `libellé`, `sévérité`)', 'ui.badge / dictBadge', 'ui.kpis']),
 'dgt': ("Décider des dossiers transmis, examiner les recours, suivre les statistiques et les cérémonies au nom de la DGT.",
   ['vue `#/decisions`', 'GO.formModal (décision, avis, recours)', 'ui.tabs', 'statistiques', 'fiche de cérémonie']),
 'ministre': ("Décider et viser au nom du Ministre, suivre les recours et les statistiques ministérielles.", ['idem Autorité']),
 'dr': ("Décider et viser au nom de la DR, sur les dossiers de son ressort.", ['idem Autorité']),
 'regisseur': ("Tenir le stock des médailles (entrées, réservations, seuils, commandes, livraisons, fournisseurs), émettre les ordres de recette, vérifier les reçus et enregistrer les remises effectives et les retraits.",
   ['vue `#/stock` (4 onglets)', 'vue `#/recettes`', 'vue `#/remises`', 'mouvements (`#st-mv`)', 'GO.formModal (mouvement, remise, retrait)', 'ui.table', 'KPI de stock']),
 'admin': ("Administrer les comptes, les paramètres d’affichage et consulter les journaux, sans décision métier.",
   ['vue `#/administration` (onglets comptes / paramètres / données)', 'vue `#/journal`', 'ui.toolbar (recherche, filtres)', 'switch (préférences locales)']),
}
for rid, (mission, comps) in DETAIL.items():
    r = roles[rid]
    L.append(f"### {r['label']} (`{rid}`)\n")
    L.append(f"*Œuvres* — {mission}\n")
    L.append('*Composants et mécanismes réutilisés* : ' + ' · '.join('`' + c + '`' for c in comps) + '\n')
    L.append('*Vues* : ' + ' · '.join(f"`{v}`" for v in r['views']) + '\n')
    L.append('*Permissions* : ' + (' · '.join(f"`{c}`" for c in r['can']) or '—') + '\n')
L.append('## 4. Bibliothèque de composants (existante, réutilisée)\n')
L.append('| Composant | Rôle | Utilisé par |')
L.append('|---|---|---|')
COMP = [
 ('`ui.head({eyebrow,title,sub,actions})`', 'en-tête de page (fil d’ariane, titre, sous-titre, actions)', 'toutes les vues'),
 ('`ui.kpis([{label,count,note}])`', 'bandeau d’indicateurs avec compteurs animés (`data-c`)', '24 vues'),
 ('`ui.card({i,icon,title,sub,body})` + `reveal`', 'carte de contenu avec apparition séquencée', 'toutes les vues'),
 ('`ui.toolbar({search,selects,actions})`', 'recherche, filtres, actions de liste', 'dossiers, courriers, registres, journal, administration'),
 ('`ui.filterBar` + `ui.chips`', 'filtres à puces avec compteurs', 'dossiers, compléments, recours, décisions, retraits, transmissions'),
 ('`ui.table(cols,rows,{caption})`', 'tableau de données responsive (libellés `data-label`)', '22 vues'),
 ('`GO.openDrawer/setDrawer/closeDrawer`', 'panneau latéral de détail (dossier, courrier, mouvements)', 'dossiers, courriers, régie, compléments'),
 ('`GO.modal` / `GO.formModal`', 'modales de saisie avec validation, `validate`, `checks`, `run`', '26 actions'),
 ('`GO.confirmDialog`', 'confirmation avec case d’attestation facultative', 'visa, transmission, clôture, annulation'),
 ('`GO.toast` / `GO.withLoading`', 'retour d’action et état de chargement des boutons', 'toutes les actions'),
 ('`GO.empty(icon,title,text,action)`', 'état vide explicite', 'toutes les vues'),
 ('`GO.badge/statusBadge/cerBadge/docBadge/dictBadge`', 'pastilles d’état à partir des dictionnaires', 'toutes les vues'),
 ('`GO.stepMini` / `GO.stepper` / `pipelineCard`', 'étapes du circuit et répartition par étape', 'dossiers, vue d’ensemble, instruction, supervision'),
 ('`timeline` (`tl-item`)', 'historique horodaté des dossiers et documents', 'dossiers, cérémonies, journal'),
 ('`tabs` / `tab-ink`', 'onglets internes à une page', 'stock, administration, cérémonies, décisions, courriers, remises'),
 ('`cal-grid`/`cal-detail`/`month-list`', 'calendrier mensuel + fiche de cérémonie', 'cérémonies'),
 ('`charts.js`, `map.js`', 'graphiques SVG/Canvas et carte des lieux (Leaflet ou plan schématique)', 'statistiques, cérémonies'),
 ('`dropzone`', 'dépôt de pièces justificatives (10 Mo, pdf/jpeg/png)', 'assistant, compléments, recettes'),
]
for c, r2, u in COMP:
    L.append(f"| {c} | {r2} | {u} |")
L.append('')
L.append('## 5. Actions de dossier (`GO.dossierActions`, 26)\n')
actions = sorted(set(re.findall(r'\n    (?:async )?([a-z_0-9]+)\(d', io.open(REPO + '/assets/js/views-dossiers.js', encoding='utf-8').read()[io.open(REPO + '/assets/js/views-dossiers.js', encoding='utf-8').read().find('const ACTIONS = {'):io.open(REPO + '/assets/js/views-dossiers.js', encoding='utf-8').read().find('GO.dossierActions = ACTIONS')])))
ACT_LABEL = {
 'instruct': 'Ouvrir l’instruction', 'verify': 'Vérifier bénéficiaires et pièces', 'complement': 'Demander un complément',
 'relance': 'Relancer le demandeur', 'note': 'Préparer la note de transmission', 'visa': 'Apposer le visa interne',
 'transmit': 'Transmettre à l’autorité', 'avis': 'Consigner un avis hiérarchique', 'decide': 'Enregistrer la décision',
 'recette': 'Émettre l’ordre de recette', 'deposer_recu': 'Déposer le reçu de paiement', 'verif_recu': 'Vérifier le reçu',
 'propose': 'Proposer une date et un lieu', 'cer': 'Ouvrir la fiche de cérémonie', 'valider_cer': 'Valider la date de cérémonie',
 'negocier': 'Négocier la date', 'cer_done': 'Clôturer la cérémonie', 'answer': 'Déposer le complément demandé',
 'recours': 'Instruire un recours', 'recours_decide': 'Enregistrer la suite du recours', 'control': 'Effectuer un contrôle documentaire',
 'remise_prep': 'Préparer et réserver les médailles', 'remise_ok': 'Enregistrer la remise effective',
 'retrait_demande': 'Demander un retrait sans cérémonie', 'retrait_valide': 'Autoriser le retrait', 'retrait_remis': 'Enregistrer le retrait effectif',
}
L.append('| Action | Effet | Droit requis |')
L.append('|---|---|---|')
for a in actions:
    src = io.open(REPO + '/assets/js/views-dossiers.js', encoding='utf-8').read()
    i = src.find('\n    ' + a + '(')
    j = src.find('\n    }', i)
    seg = src[i:j]
    effect = 'saisie de démonstration ; état, historique et notifications mis à jour'
    if 'moveStock' in seg: effect = 'diminue ou augmente le stock physique ; réservations libérées ; remise enregistrée'
    elif 'd.status =' in seg: effect = 'change le statut du dossier et journalise l’étape'
    elif 'withdrawals' in seg or 'wd.' in seg: effect = 'fait évoluer la demande de retrait sans cérémonie'
    elif 'receiptOrders' in seg or 'or.state' in seg: effect = 'fait évoluer l’ordre de recette ou son reçu (aucun encaissement)'
    elif 'ceremonies' in seg or 'c.state' in seg: effect = 'fait évoluer la proposition de cérémonie (jamais confirmée sans validation)'
    elif 'controls' in seg or 'ctl.' in seg: effect = 'enregistre un contrôle documentaire et ses anomalies'
    elif 'recours' in seg or 'rcs.' in seg: effect = 'fait évoluer le recours'
    right = {'instruct': 'instruct', 'verify': 'verify', 'complement': 'complement', 'relance': 'relance', 'note': 'note', 'visa': 'visa', 'transmit': 'transmit', 'avis': 'avis', 'decide': 'decide', 'recours': 'recours', 'control': 'control', 'flag': 'flag', 'recette': 'recette', 'deposer_recu': 'deposer_recu', 'verif_recu': 'paiement_verif', 'propose': 'propose', 'cer': 'propose', 'valider_cer': 'valider_ceremonie', 'negocier': 'coordinate', 'cer_done': 'coordinate', 'answer': 'answer', 'remise_prep': 'remise', 'remise_ok': 'remise', 'retrait_demande': 'retrait', 'retrait_valide': 'retrait_traitement', 'retrait_remis': 'retrait_traitement', 'recours_decide': 'recours'}.get(a, '')
    holder = ' · '.join(roles[r]['short'] for r in roles if right and right in roles[r]['can']) or '—'
    L.append(f"| `{a}` — {ACT_LABEL.get(a, a)} | {effect} | {holder} |")
L.append('')
L.append('## 6. Règles de gestion appliquées (et ce qui reste hors application)\n')
L.append('| Règle | Mise en œuvre | Vérifiée par |')
L.append('|---|---|---|')
for row in [
 ('Le stock physique ne diminue qu’à l’enregistrement d’une remise effective', '`remise_ok` / `retrait_remis` : deux mouvements (`available`, `reserved`) par médaille', 'C4, C6 · écriture 2'),
 ('Une proposition de cérémonie n’est jamais confirmée sans validation', '`propose` → `propose`/`negociation` → `valider_cer` (autorité) → `confirme`', 'C5'),
 ('La clôture d’une cérémonie exige une remise effective et est un acte du service', '`drawDetail` et `actionsFor` : bouton « Marquer comme terminée » seulement si remise `remise`/`retrait`', 'C4'),
 ('Un dossier déjà remis n’ouvre plus de demande de retrait', '`APPLI_REASON` (régie) et `actionsFor` (tiroir)', 'C6'),
 ('Le paiement est effectué hors application ; le reçu est déposé puis vérifié', '`recette` → `deposer_recu` → `verif_recu` ; aucun montant calculé', 'C3 · écriture 5'),
 ('L’ancienneté conditionne l’échelon', '`GO.eligibility` / `GO.seniority` : Bronze 10-19 ans, Argent 20-29 ans, Or 30 ans et plus (valeurs illustratives)', 'vue `#/beneficiaires`, vérification'),
 ('Aucune suppression de dossier, aucune attribution automatique d’échelon', 'les actions n’effacent jamais un dossier ; l’échelon proposé est saisi par le demandeur', 'C1, C2'),
 ('Les décisions de l’autorité ne sont pas prises par le service', '`decide`/`avis`/`recours` réservés aux profils d’autorité ; le service prépare et transmet', 'C3'),
 ('Aucun encaissement, aucune signature électronique', 'bandeaux explicites dans les modales ; mention « ne constitue pas une signature »', 'C3, C4'),
]:
    L.append(f"| {row[0]} | {row[1]} | {row[2]} |")
L.append('')
L.append('## 7. Notifications et audiences\n')
L.append('`GO.notify({type,aud,ref,title,msg})` alimente `#/notifications`, filtré par `GO.audiences()` : '
         '`authority:<id>` (autorité destinataire), `org:<id>` (organisme demandeur), `person:<id>` (récipiendaire), '
         '`service`, `inspecteur`. Types : `depot`, `reception`, `transmission`, `instruction`, `complement`, `relance`, '
         '`visa`, `decision`, `refus`, `ceremonie`, `remise`, `paiement`, `note`, `courrier`.\n')
L.append('## 8. Données de démonstration\n')
c = dump['counts']
L.append('| Table | Lignes |\n|---|---|')
for k, v in c.items():
    L.append(f"| `{k}` | {v} |")
L.append('')
L.append('Stock initial (disponible / réservé / seuil) : Bronze 148/32/60 · Argent 96/24/40 · Or 43/18/30 · '
         'Diplômes 360/86/100 — chaque valeur est la somme des 19 `stockMovements`.\n')
L.append('## 9. Écarts connus\n')
L.append('- Les barèmes d’ancienneté par échelon sont **illustratifs** : aucun document de règles métier n’est '
         'présent dans le dépôt, donc aucune règle n’a été inventée au-delà de ces bornes affichées.\n'
         '- Les montants des ordres de recette sont des **montants de démonstration** saisis à la main ; '
         '`#/nouveau` propose un nombre de distinctions par échelon (Or 3, Argent 2, Bronze 1) à titre indicatif '
         'pour l’ordre de recette.\n'
         '- Les préférences d’affichage (mode compact, animations réduites) sont locales au poste ; les compte et '
         'paramètres sont des données de démonstration persistées dans `localStorage`.\n')
io.open(REPO + '/ROLE_COMPONENT_MAPPING.md', 'w', encoding='utf-8').write('\n'.join(L) + '\n')
print('ROLE_COMPONENT_MAPPING.md :', len(L), 'lignes ·', len(actions), 'actions')
