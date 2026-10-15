/* ==========================================================================
   GAB-ORIENT — Jeu de données de référence
   --------------------------------------------------------------------------
   Toutes les données affichées par le prototype proviennent de ce fichier.
   Pour brancher l'application sur une API réelle, remplacer `seed` par les
   réponses des services et conserver les mêmes formes d'objets.
   Les dictionnaires (statuts, médailles, autorités, rôles, lieux) sont des
   données de configuration à valider par le Service des Distinctions.
   ========================================================================== */
window.GO_DATA = (function () {
  'use strict';

  /* ---------- Configuration ---------- */
  const config = {
    // Date de référence utilisée comme « aujourd'hui » pour que les données
    // restent cohérentes. En production : new Date().
    referenceDate: '2026-10-15',
    dataVersion: '2026.10-r5',
    upload: { maxMb: 10, accept: ['application/pdf', 'image/jpeg', 'image/png'], acceptLabel: 'PDF, JPG ou PNG' },
    map: {
      // Fournisseur cartographique : Leaflet + tuiles OpenStreetMap.
      // En production, utiliser un fournisseur de tuiles disposant d'un contrat
      // de service (la politique d'usage des tuiles OSM publiques est limitée).
      tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; contributeurs OpenStreetMap',
      center: [-0.75, 11.5],
      zoom: 6
    },
    // Montants de démonstration : aucune valeur comptable, aucun paiement réel.
    payment: { currency: 'FCFA', note: 'Le paiement est effectué hors application ; l’application enregistre l’ordre de recette, le reçu déposé et sa vérification. Aucune transaction financière n’est effectuée par le prototype.' }
  };

  /* ---------- Dictionnaires ---------- */
  const statuses = {
    recu:       { label: 'Reçu — à traiter',        short: 'À traiter',    tone: 'slate'  },
    en_cours:   { label: 'En instruction',          short: 'En instruction', tone: 'blue' },
    complement: { label: 'Complément demandé',      short: 'Complément',   tone: 'yellow' },
    transmis:   { label: 'Transmis à la hiérarchie', short: 'Transmis',    tone: 'navy'   },
    approuve:   { label: 'Approuvé',                short: 'Approuvé',     tone: 'green'  },
    refuse:     { label: 'Refusé',                  short: 'Refusé',       tone: 'red'    }
  };
  const statusOrder = ['recu', 'en_cours', 'complement', 'transmis', 'approuve', 'refuse'];

  const steps = ['Dépôt', 'Recevabilité', 'Instruction', 'Transmission', 'Décision', 'Remise'];

  const ceremonyStates = {
    propose:     { label: 'Date proposée',      tone: 'blue',   desc: 'Proposition en attente d’examen. La date n’est pas confirmée.' },
    negociation: { label: 'En négociation',     tone: 'yellow', desc: 'Échanges en cours avec le lieu ou le demandeur sur la date.' },
    confirme:    { label: 'Confirmée',          tone: 'green',  desc: 'Date validée par l’autorité compétente.' },
    termine:     { label: 'Terminée',           tone: 'slate',  desc: 'La cérémonie a eu lieu.' },
    conflit:     { label: 'Conflit identifié',  tone: 'red',    desc: 'La date proposée entre en conflit avec une réservation existante.' }
  };

  // Échelons : critères d'ancienneté de la maquette fonctionnelle
  // (Bronze 10 à 19 ans, Argent 20 à 29 ans, Or 30 ans et plus).
  const medals = [
    { id: 'bronze', label: 'Médaille d’honneur du travail — Bronze', short: 'Bronze', minYears: 10, maxYears: 19 },
    { id: 'argent', label: 'Médaille d’honneur du travail — Argent', short: 'Argent', minYears: 20, maxYears: 29 },
    { id: 'or',     label: 'Médaille d’honneur du travail — Or',     short: 'Or',     minYears: 30, maxYears: null }
  ];
  const medalForYears = y => (y >= 30 ? 'or' : y >= 20 ? 'argent' : 'bronze');

  const docTypes = {
    entrant:  'Courrier entrant',
    sortant:  'Courrier sortant',
    note:     'Note interne',
    piece:    'Pièce justificative',
    decision: 'Décision'
  };
  const docStates = {
    enregistre:   { label: 'Enregistré',            tone: 'slate'  },
    attente_visa: { label: 'En attente de visa',    tone: 'yellow' },
    vise:         { label: 'Visa apposé',           tone: 'green'  },
    envoye:       { label: 'Envoyé',                tone: 'blue'   },
    depose:       { label: 'Déposé',                tone: 'blue'   },
    illisible:    { label: 'Numérisation illisible', tone: 'red'   },
    renum:        { label: 'Nouvelle numérisation demandée', tone: 'yellow' }
  };

  /* ---------- Autorités destinataires ---------- */
  // L'autorité destinataire choisie au dépôt reçoit le dossier, le fait
  // enregistrer par son secrétariat, rend une décision initiale motivée,
  // puis le dossier entre dans l'instruction du Service des Distinctions.
  const authorities = [
    { id: 'min', label: 'Cabinet du Ministre du Travail', short: 'Ministre', kind: 'Ministre',
      unit: 'Cabinet du Ministre du Travail', secretariat: 'sec_min', role: 'ministre',
      office: 'Libreville', scope: 'national', competence: 'Décision ministérielle et validation des dates de cérémonie' },
    { id: 'dgt', label: 'Direction générale du Travail', short: 'DGT', kind: 'Direction générale',
      unit: 'Direction générale du Travail', secretariat: 'sec_dgt', role: 'dgt',
      office: 'Libreville', scope: 'national', competence: 'Avis hiérarchique, transmission au cabinet, contrôle des actes préparatoires' },
    { id: 'dr', label: 'Direction régionale du Travail — Estuaire', short: 'DR Estuaire', kind: 'Direction régionale',
      unit: 'Direction régionale du Travail — Estuaire', secretariat: 'sec_dr', role: 'dr',
      office: 'Libreville', scope: 'régional', region: 'Estuaire', competence: 'Décision finale sur le dossier initial déposé dans son ressort' }
  ];
  const regions = ['Estuaire', 'Haut-Ogooué', 'Moyen-Ogooué', 'Ngounié', 'Nyanga', 'Ogooué-Ivindo', 'Ogooué-Lolo', 'Ogooué-Maritime', 'Woleu-Ntem'];

  /* ---------- États des objets métier ---------- */
  const transmissionStates = {
    recu:      { label: 'Reçu — à enregistrer', tone: 'yellow' },
    enregistre:{ label: 'Enregistré',           tone: 'blue'   },
    classe:    { label: 'Classé',               tone: 'slate'  },
    transmis:  { label: 'Transmis',             tone: 'navy'   },
    traite:    { label: 'Traité',               tone: 'green'  }
  };
  const recetteStates = {
    a_emettre:  { label: 'Ordre à émettre',            tone: 'slate'  },
    emis:       { label: 'Émis — paiement attendu',    tone: 'blue'   },
    recu_depose:{ label: 'Reçu déposé — à vérifier',   tone: 'yellow' },
    verifie:    { label: 'Paiement vérifié',           tone: 'green'  },
    rejete:     { label: 'Reçu rejeté',                tone: 'red'    }
  };
  const remiseStates = {
    a_preparer: { label: 'Remise à préparer',            tone: 'slate'  },
    preparee:   { label: 'Médailles préparées et réservées', tone: 'blue'   },
    remise:     { label: 'Remise effective enregistrée',  tone: 'green'  },
    retrait:    { label: 'Retrait sans cérémonie enregistré', tone: 'green' }
  };
  const controlStates = {
    a_controler: { label: 'À contrôler',             tone: 'slate'  },
    conforme:    { label: 'Contrôle conforme',       tone: 'green'  },
    anomalie:    { label: 'Anomalie signalée',       tone: 'red'    },
    correction:  { label: 'Correction demandée',     tone: 'yellow' }
  };
  const recoursStates = {
    depose:    { label: 'Recours déposé',       tone: 'blue'   },
    en_examen: { label: 'Recours en examen',    tone: 'yellow' },
    accepte:   { label: 'Recours accepté',      tone: 'green'  },
    rejete:    { label: 'Recours rejeté',       tone: 'red'    }
  };
  const dtsStates = {
    attendu:  { label: 'DTS attendue',     tone: 'yellow' },
    saisi:    { label: 'DTS saisie',       tone: 'blue'   },
    verifie:  { label: 'DTS vérifiée',     tone: 'green'  },
    anomalie: { label: 'DTS à corriger',   tone: 'red'    }
  };
  const withdrawalStates = {
    demande:  { label: 'Demande reçue',              tone: 'yellow' },
    valide:   { label: 'Autorisation enregistrée',   tone: 'blue'   },
    remis:    { label: 'Retrait enregistré',         tone: 'green'  },
    refuse:   { label: 'Demande refusée',            tone: 'red'    }
  };
  const accountStates = {
    actif:    { label: 'Actif',     tone: 'green'  },
    suspendu: { label: 'Suspendu',  tone: 'yellow' },
    desactive:{ label: 'Désactivé', tone: 'red'    }
  };

  const organisations = [
    { id: 'o1', name: 'Okoumé Énergie SA', short: 'Okoumé Énergie', type: 'Entreprise', sector: 'Énergie', city: 'Port-Gentil', contact: 'Hervé Nguema', contactRole: 'Directeur des ressources humaines', email: 'rh@okoume-energie.ga', phone: '+241 01 55 20 14' },
    { id: 'o2', name: 'Compagnie Forestière de l’Ogooué', short: 'CFO', type: 'Entreprise', sector: 'Forêt et bois', city: 'Lambaréné', contact: 'Prisca Mabika', contactRole: 'Responsable administrative', email: 'administration@cfo.ga', phone: '+241 01 58 33 07' },
    { id: 'o3', name: 'Société Gabonaise de Logistique Portuaire', short: 'SGLP', type: 'Entreprise', sector: 'Transport et logistique', city: 'Owendo', contact: 'Serge Ondo', contactRole: 'Chef du personnel', email: 'personnel@sglp.ga', phone: '+241 01 70 41 92' },
    { id: 'o4', name: 'Banque Équatoriale de Crédit', short: 'BEC', type: 'Entreprise', sector: 'Banque et assurance', city: 'Libreville', contact: 'Carine Essono', contactRole: 'Directrice du capital humain', email: 'capital.humain@bec.ga', phone: '+241 01 44 18 60' },
    { id: 'o5', name: 'Mines de la Ngounié SA', short: 'Mines de la Ngounié', type: 'Entreprise', sector: 'Mines', city: 'Mouila', contact: 'Arsène Boussougou', contactRole: 'Directeur administratif', email: 'da@mines-ngounie.ga', phone: '+241 01 86 02 31' },
    { id: 'o6', name: 'Ministère de la Santé', short: 'Min. de la Santé', type: 'Ministère', sector: 'Administration publique', city: 'Libreville', contact: 'Olga Mintsa', contactRole: 'Secrétaire générale adjointe', email: 'sg@sante.gouv.ga', phone: '+241 01 76 50 05' },
    { id: 'o7', name: 'Télécom Estuaire', short: 'Télécom Estuaire', type: 'Entreprise', sector: 'Télécommunications', city: 'Libreville', contact: 'Fabrice Koumba', contactRole: 'Responsable RH', email: 'rh@telecom-estuaire.ga', phone: '+241 01 79 66 12' },
    { id: 'o8', name: 'Ciments du Komo', short: 'Ciments du Komo', type: 'Entreprise', sector: 'Industrie', city: 'Ntoum', contact: 'Nadège Ella', contactRole: 'Gestionnaire du personnel', email: 'personnel@ciments-komo.ga', phone: '+241 01 23 90 48' }
  ];

  const users = {
    u1:      { name: 'Joséphine Mba-Ondo', initials: 'JM', title: 'Chef du Service des Distinctions', unit: 'Service des Distinctions nationales', email: 'j.mbaondo@distinctions.gouv.ga' },
    u2:      { name: 'Landry Moussavou',   initials: 'LM', title: 'Agent instructeur', unit: 'Service des Distinctions nationales', email: 'l.moussavou@distinctions.gouv.ga' },
    u3:      { name: 'Hervé Nguema',       initials: 'HN', title: 'Directeur des ressources humaines', unit: 'Okoumé Énergie SA', email: 'rh@okoume-energie.ga' },
    u_min:   { name: 'Sylvie Nzamba',      initials: 'SN', title: 'Secrétaire du Ministre', unit: 'Cabinet du Ministre du Travail', email: 's.nzamba@travail.gouv.ga' },
    u_dgt:   { name: 'Brice Oyane',        initials: 'BO', title: 'Secrétaire de la Direction générale du Travail', unit: 'Direction générale du Travail', email: 'b.oyane@travail.gouv.ga' },
    u_dr:    { name: 'Ghislain Makaya',    initials: 'GM', title: 'Secrétaire de la Direction régionale du Travail', unit: 'Direction régionale du Travail — Estuaire', email: 'g.makaya@travail.gouv.ga' },
    u_ins:   { name: 'Rosine Lekogo',      initials: 'RL', title: 'Inspectrice du travail', unit: 'Inspection du travail — Estuaire', email: 'r.lekogo@inspection.travail.ga' },
    u_aut:   { name: 'Aline Mintsa',       initials: 'AM', title: 'Directeur général du Travail', unit: 'Direction générale du Travail', email: 'dg@travail.gouv.ga' },
    u_min2:  { name: 'Patrick Obame',      initials: 'PO', title: 'Ministre du Travail', unit: 'Cabinet du Ministre du Travail', email: 'cabinet@travail.gouv.ga' },
    u_dr2:   { name: 'Serge Bivigou',      initials: 'SB', title: 'Directeur régional du Travail — Estuaire', unit: 'Direction régionale du Travail — Estuaire', email: 'dr.estuaire@travail.gouv.ga' },
    u_reg:   { name: 'Nadège Koumba',      initials: 'NK', title: 'Régisseur des médailles', unit: 'Régie des médailles et distinctions', email: 'regie@distinctions.gouv.ga' },
    u_adm:   { name: 'Wilfried Ekomi',     initials: 'WE', title: 'Administrateur GAB-ORIENT', unit: 'Direction des systèmes d’information', email: 'admin@distinctions.gouv.ga' },
    u_ms:    { name: 'Olga Mintsa',        initials: 'OM', title: 'Secrétaire générale adjointe', unit: 'Ministère de la Santé', email: 'sg@sante.gouv.ga' },
    u_rec:   { name: 'Récipiendaire',      initials: 'RP', title: 'Agent', unit: '', email: 'r.recipiendaire@example.ga' }
  };

  /* ---------- Profils de travail ----------
     family : 'demandeur' | 'recipiendaire' | 'secretariat' | 'service' |
              'inspection' | 'autorite' | 'regie' | 'administration'
     scope  : null (tout), {kind:'org', value}, {kind:'person', value},
              {kind:'authority', value}
     can    : actions autorisées (voir permissionLabels)                      */
  const roles = {
    demandeur_entreprise: {
      label: 'Demandeur — Entreprise', short: 'Entreprise demandeur', family: 'demandeur', user: 'u3',
      scope: { kind: 'org', value: 'o1' },
      views: ['apercu', 'dossiers', 'nouveau', 'beneficiaires', 'pieces', 'complements', 'recours', 'recettes', 'courriers', 'ceremonies', 'journal', 'notifications'],
      can: { create: true, answer: true, propose: true, recours: true, observe: true, deposer_recu: true }
    },
    demandeur_ministere: {
      label: 'Demandeur — Ministère', short: 'Ministère demandeur', family: 'demandeur', user: 'u_ms',
      scope: { kind: 'org', value: 'o6' },
      views: ['apercu', 'dossiers', 'nouveau', 'beneficiaires', 'pieces', 'complements', 'recours', 'recettes', 'courriers', 'ceremonies', 'journal', 'notifications'],
      can: { create: true, answer: true, propose: true, recours: true, observe: true, deposer_recu: true }
    },
    recipiendaire: {
      label: 'Employé / Récipiendaire', short: 'Récipiendaire', family: 'recipiendaire', user: 'u_rec',
      scope: { kind: 'person', value: ['DNG-2026-002-R3', 'DNG-2026-021-R1'] },
      views: ['apercu', 'distinctions', 'pieces', 'ceremonies', 'retraits', 'dossiers', 'courriers', 'notifications'],
      can: { retrait: true, observe: false }
    },
    sec_min: {
      label: 'Secrétaire du Ministre', short: 'Secrétariat Ministre', family: 'secretariat', user: 'u_min',
      scope: { kind: 'authority', value: 'min' },
      views: ['apercu', 'transmissions', 'courriers', 'dossiers', 'ceremonies', 'journal', 'notifications'],
      can: { receive: true, register: true, route: true, classify: true }
    },
    sec_dgt: {
      label: 'Secrétaire de la DGT', short: 'Secrétariat DGT', family: 'secretariat', user: 'u_dgt',
      scope: { kind: 'authority', value: 'dgt' },
      views: ['apercu', 'transmissions', 'courriers', 'dossiers', 'ceremonies', 'journal', 'notifications'],
      can: { receive: true, register: true, route: true, classify: true }
    },
    sec_dr: {
      label: 'Secrétaire de la DR', short: 'Secrétariat DR', family: 'secretariat', user: 'u_dr',
      scope: { kind: 'authority', value: 'dr' },
      views: ['apercu', 'transmissions', 'courriers', 'dossiers', 'ceremonies', 'journal', 'notifications'],
      can: { receive: true, register: true, route: true, classify: true }
    },
    chef: {
      label: 'Chef de service', short: 'Chef de service', family: 'service', user: 'u1',
      scope: null,
      views: ['apercu', 'dossiers', 'nouveau', 'instruction', 'supervision', 'beneficiaires', 'complements', 'recours', 'recettes', 'remises', 'courriers', 'ceremonies', 'statistiques', 'journal', 'notifications'],
      can: { create: true, instruct: true, verify: true, complement: true, relance: true, note: true, transmit: true, visa: true, recette: true, propose: true, coordinate: true, observe: true, remise: true }
    },
    agent: {
      label: 'Agent du Service des Distinctions', short: 'Agent instructeur', family: 'service', user: 'u2',
      scope: null,
      views: ['apercu', 'dossiers', 'nouveau', 'instruction', 'beneficiaires', 'complements', 'recours', 'recettes', 'courriers', 'ceremonies', 'journal', 'notifications'],
      can: { create: true, instruct: true, verify: true, complement: true, relance: true, note: true, propose: true, observe: true, recette: true }
    },
    inspecteur: {
      label: 'Inspecteur', short: 'Inspecteur', family: 'inspection', user: 'u_ins',
      scope: null,
      views: ['apercu', 'dossiers', 'controle', 'beneficiaires', 'courriers', 'ceremonies', 'journal', 'notifications'],
      can: { control: true, flag: true, observe: true, verifier_pieces: true }
    },
    dgt: {
      label: 'DGT — Directeur général du Travail', short: 'DGT', family: 'autorite', user: 'u_aut',
      scope: { kind: 'authority', value: 'dgt' },
      views: ['apercu', 'dossiers', 'decisions', 'recours', 'courriers', 'ceremonies', 'statistiques', 'journal', 'notifications'],
      can: { decide: true, avis: true, recours: true, relance: true, valider_ceremonie: true, observe: true, receive: true }
    },
    ministre: {
      label: 'Ministre du Travail', short: 'Ministre', family: 'autorite', user: 'u_min2',
      scope: { kind: 'authority', value: 'min' },
      views: ['apercu', 'dossiers', 'decisions', 'recours', 'courriers', 'ceremonies', 'statistiques', 'journal', 'notifications'],
      can: { decide: true, avis: true, recours: true, relance: true, valider_ceremonie: true, observe: true, receive: true }
    },
    dr: {
      label: 'DR — Directeur régional du Travail', short: 'DR', family: 'autorite', user: 'u_dr2',
      scope: { kind: 'authority', value: 'dr' },
      views: ['apercu', 'dossiers', 'decisions', 'recours', 'courriers', 'ceremonies', 'statistiques', 'journal', 'notifications'],
      can: { decide: true, recours: true, relance: true, avis: true, observe: true, receive: true }
    },
    regisseur: {
      label: 'Régisseur des médailles', short: 'Régisseur', family: 'regie', user: 'u_reg',
      scope: null,
      views: ['apercu', 'recettes', 'stock', 'remises', 'retraits', 'dossiers', 'ceremonies', 'courriers', 'journal', 'notifications'],
      can: { paiement_verif: true, stock: true, remise: true, retrait_traitement: true, observe: true }
    },
    admin: {
      label: 'Administrateur', short: 'Administrateur', family: 'administration', user: 'u_adm',
      scope: null,
      views: ['apercu', 'administration', 'journal', 'notifications'],
      can: { admin: true }
    }
  };
  const roleOrder = ['demandeur_entreprise', 'demandeur_ministere', 'recipiendaire', 'sec_min', 'sec_dgt', 'sec_dr', 'chef', 'agent', 'inspecteur', 'dgt', 'ministre', 'dr', 'regisseur', 'admin'];
  const roleFamilies = [
    { id: 'demandeur', label: 'Demandeurs', roles: ['demandeur_entreprise', 'demandeur_ministere'] },
    { id: 'recipiendaire', label: 'Bénéficiaires', roles: ['recipiendaire'] },
    { id: 'secretariat', label: 'Secrétariats', roles: ['sec_min', 'sec_dgt', 'sec_dr'] },
    { id: 'service', label: 'Service des Distinctions', roles: ['chef', 'agent'] },
    { id: 'inspection', label: 'Contrôle', roles: ['inspecteur'] },
    { id: 'autorite', label: 'Autorités destinataires', roles: ['dgt', 'ministre', 'dr'] },
    { id: 'regie', label: 'Régie', roles: ['regisseur'] },
    { id: 'administration', label: 'Administration', roles: ['admin'] }
  ];
  const permissionLabels = {
    create: 'Créer un dossier', instruct: 'Ouvrir l’instruction', verify: 'Vérifier les bénéficiaires et les pièces',
    complement: 'Demander un complément', relance: 'Relancer un demandeur', note: 'Préparer une note de transmission',
    transmit: 'Transmettre à la hiérarchie', visa: 'Apposer un visa interne', decide: 'Enregistrer une décision',
    avis: 'Émettre un avis hiérarchique', recours: 'Examiner un recours', propose: 'Proposer une cérémonie',
    coordinate: 'Coordonner les cérémonies', valider_ceremonie: 'Valider une date de cérémonie',
    observe: 'Ajouter des observations', answer: 'Déposer un complément', receive: 'Accuser réception d’un courrier',
    register: 'Enregistrer un courrier au registre', route: 'Transmettre à un service ou à une autorité',
    classify: 'Classer un courrier', control: 'Effectuer un contrôle', flag: 'Signaler une anomalie',
    verifier_pieces: 'Vérifier les pièces justificatives', recette: 'Émettre un ordre de recette',
    deposer_recu: 'Déposer un reçu de paiement', paiement_verif: 'Vérifier un reçu de paiement',
    stock: 'Gérer le stock et les mouvements', remise: 'Enregistrer une remise effective',
    retrait: 'Demander un retrait sans cérémonie', retrait_traitement: 'Traiter les retraits sans cérémonie',
    admin: 'Administrer les comptes et les journaux'
  };

  // Lieux de cérémonie. Coordonnées indicatives, à vérifier avant mise en service.
  // Aucune photographie n'est fournie : l'interface affiche un emplacement réservé.
  const venues = [
    { id: 'v1', name: 'Cité de la Démocratie', city: 'Libreville', province: 'Estuaire', kind: 'Centre de conférences', capacity: 800, lat: 0.4515, lng: 9.4120, address: 'Quartier Cité de la Démocratie, Libreville', features: ['Sonorisation', 'Salle protocolaire', 'Parking'] },
    { id: 'v2', name: 'Hôtel de Ville de Libreville', city: 'Libreville', province: 'Estuaire', kind: 'Mairie', capacity: 300, lat: 0.3921, lng: 9.4537, address: 'Boulevard de l’Indépendance, Libreville', features: ['Salle des fêtes', 'Accès PMR'] },
    { id: 'v3', name: 'Salle polyvalente du Ministère du Travail', city: 'Libreville', province: 'Estuaire', kind: 'Administration', capacity: 150, lat: 0.4012, lng: 9.4470, address: 'Centre-ville, Libreville', features: ['Salle de réunion', 'Vidéo­projection'] },
    { id: 'v4', name: 'Hôtel de Ville de Port-Gentil', city: 'Port-Gentil', province: 'Ogooué-Maritime', kind: 'Mairie', capacity: 250, lat: -0.7193, lng: 8.7815, address: 'Centre-ville, Port-Gentil', features: ['Salle des fêtes', 'Sonorisation'] },
    { id: 'v5', name: 'Gouvernorat de la Ngounié', city: 'Mouila', province: 'Ngounié', kind: 'Gouvernorat', capacity: 200, lat: -1.8667, lng: 11.0556, address: 'Mouila', features: ['Salle protocolaire'] },
    { id: 'v6', name: 'Gouvernorat du Moyen-Ogooué', city: 'Lamborghiné', province: 'Moyen-Ogooué', kind: 'Gouvernorat', capacity: 180, lat: -0.7001, lng: 10.2406, address: 'Lambaréné', features: ['Salle protocolaire', 'Parking'] },
    { id: 'v7', name: 'Gouvernorat du Haut-Ogooué', city: 'Franceville', province: 'Haut-Ogooué', kind: 'Gouvernorat', capacity: 220, lat: -1.6333, lng: 13.5833, address: 'Franceville', features: ['Salle protocolaire', 'Sonorisation'] }
  ];

  // Dates indisponibles pour toute cérémonie (jours fériés).
  const closures = [
    { date: '2026-08-17', reason: 'Fête de l’Indépendance' },
    { date: '2026-11-01', reason: 'Toussaint' },
    { date: '2026-12-25', reason: 'Noël' },
    { date: '2027-01-01', reason: 'Jour de l’An' }
  ];

  /* ---------- Récipiendaires (générés de manière déterministe) ---------- */
  const NOMS = ['Mba', 'Nzé', 'Ondo', 'Obame', 'Moussavou', 'Mouketou', 'Nguema', 'Ella', 'Boussougou', 'Mabika', 'Oyane', 'Ndong', 'Koumba', 'Mouélé', 'Bivigou', 'Ngoua', 'Essono', 'Mintsa', 'Mbina', 'Lekogo', 'Nziengui', 'Mihindou', 'Makaya', 'Ekomi', 'Assoumou', 'Engone'];
  const PRENOMS = ['Jean-Pierre', 'Marie-Claire', 'Patrick', 'Sylvie', 'Rodrigue', 'Aline', 'Ghislain', 'Judith', 'Serge', 'Rosine', 'Landry', 'Nadège', 'Fabrice', 'Carine', 'Arsène', 'Olga', 'Brice', 'Annick', 'Thierry', 'Gisèle', 'Wilfried', 'Laetitia'];
  const FONCTIONS = ['Chef d’équipe', 'Technicienne de maintenance', 'Comptable principal', 'Conducteur d’engins', 'Responsable logistique', 'Agent administratif', 'Ingénieure process', 'Chef de quart', 'Assistante de direction', 'Magasinier principal', 'Superviseur sécurité', 'Chargé de clientèle', 'Contrôleur qualité', 'Infirmière principale'];

  function recipients(ref, n, count) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const years = 8 + ((n * 13 + i * 7) % 26);
      const month = 1 + ((n * 5 + i * 3) % 12);
      const day = 1 + ((n * 7 + i * 11) % 27);
      out.push({
        id: ref + '-R' + (i + 1),
        nom: NOMS[(n * 7 + i * 5) % NOMS.length],
        prenom: PRENOMS[(n * 3 + i * 11) % PRENOMS.length],
        fonction: FONCTIONS[(n * 2 + i * 5) % FONCTIONS.length],
        entree: (2026 - years) + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0'),
        // Échelon calculé sur l'ancienneté ; en dessous du seuil Bronze, la
        // proposition est traitée comme un cas particulier (§ assouplissement).
        medal: medalForYears(years)
      });
    }
    return out;
  }

  /* ---------- Dossiers ----------
     auth   : autorité destinataire choisie au dépôt (min | dgt | dr)
     channel: voie de dépôt
     history : [date, heure, acteur, type, libellé]
     acteurs : ORG = organisme demandeur, SEC = Secrétariat, SDN = Service des
     Distinctions, CHEF = Chef du Service, DG = Direction générale,
     AUT = autorité compétente                                                */
  const D = [
    { n: 1, org: 'o1', depot: '2026-01-12', status: 'approuve', count: 6, agent: 'L. Moussavou', history: [
      ['2026-01-12', '09:40', 'ORG', 'depot', 'Demande déposée'],
      ['2026-01-13', '10:05', 'SEC', 'reception', 'Courrier enregistré par le secrétariat'],
      ['2026-01-19', '14:20', 'SDN', 'instruction', 'Recevabilité confirmée — instruction ouverte'],
      ['2026-02-16', '11:00', 'CHEF', 'transmission', 'Transmis au Directeur général'],
      ['2026-03-20', '16:30', 'AUT', 'decision', 'Décision d’attribution enregistrée'],
      ['2026-06-02', '09:15', 'SDN', 'ceremonie', 'Cérémonie confirmée à Port-Gentil'],
      ['2026-07-09', '12:30', 'SDN', 'ceremonie', 'Cérémonie de remise effectuée']] },
    { n: 2, org: 'o4', depot: '2026-01-28', status: 'approuve', count: 4, agent: 'P. Ekomi', history: [
      ['2026-01-28', '10:12', 'ORG', 'depot', 'Demande déposée'],
      ['2026-01-29', '08:50', 'SEC', 'reception', 'Courrier enregistré par le secrétariat'],
      ['2026-02-04', '15:00', 'SDN', 'instruction', 'Recevabilité confirmée — instruction ouverte'],
      ['2026-03-11', '10:30', 'CHEF', 'transmission', 'Transmis au Directeur général'],
      ['2026-04-22', '17:05', 'AUT', 'decision', 'Décision d’attribution enregistrée'],
      ['2026-09-21', '11:20', 'SDN', 'ceremonie', 'Date proposée pour la cérémonie'],
      ['2026-10-06', '09:45', 'AUT', 'ceremonie', 'Date de cérémonie confirmée'],
      ['2026-10-07', '10:10', 'SDN', 'courrier', 'Convocation adressée au demandeur']] },
    { n: 3, org: 'o7', depot: '2026-02-10', status: 'refuse', count: 2, agent: 'L. Moussavou', history: [
      ['2026-02-10', '11:31', 'ORG', 'depot', 'Demande déposée'],
      ['2026-02-11', '09:02', 'SEC', 'reception', 'Courrier enregistré par le secrétariat'],
      ['2026-02-18', '10:40', 'SDN', 'instruction', 'Recevabilité confirmée — instruction ouverte'],
      ['2026-03-30', '14:00', 'CHEF', 'transmission', 'Transmis au Directeur général'],
      ['2026-05-14', '16:10', 'AUT', 'decision', 'Décision de refus enregistrée']],
      observations: [['2026-05-14', 'AUT', 'Pièces d’ancienneté insuffisantes pour les deux récipiendaires proposés.']] },
    { n: 4, org: 'o3', depot: '2026-02-24', status: 'approuve', count: 5, agent: 'P. Ekomi', history: [
      ['2026-02-24', '09:05', 'ORG', 'depot', 'Demande déposée'],
      ['2026-02-25', '10:22', 'SEC', 'reception', 'Courrier enregistré par le secrétariat'],
      ['2026-03-03', '11:15', 'SDN', 'instruction', 'Recevabilité confirmée — instruction ouverte'],
      ['2026-04-08', '15:40', 'CHEF', 'transmission', 'Transmis au Directeur général'],
      ['2026-05-27', '10:00', 'AUT', 'decision', 'Décision d’attribution enregistrée'],
      ['2026-09-30', '14:25', 'SDN', 'ceremonie', 'Date proposée pour la cérémonie'],
      ['2026-10-11', '10:20', 'SDN', 'ceremonie', 'Négociation ouverte : le lieu propose le 13 novembre']] },
    { n: 5, org: 'o2', depot: '2026-03-16', status: 'transmis', count: 4, agent: 'L. Moussavou', history: [
      ['2026-03-16', '08:55', 'ORG', 'depot', 'Demande déposée'],
      ['2026-03-17', '09:30', 'SEC', 'reception', 'Courrier enregistré par le secrétariat'],
      ['2026-03-24', '13:10', 'SDN', 'instruction', 'Recevabilité confirmée — instruction ouverte'],
      ['2026-08-28', '16:00', 'SDN', 'courrier', 'Note de transmission préparée'],
      ['2026-09-02', '09:20', 'CHEF', 'visa', 'Visa interne apposé sur la note de transmission'],
      ['2026-09-03', '10:00', 'CHEF', 'transmission', 'Transmis au Directeur général']] },
    { n: 6, org: 'o6', depot: '2026-04-02', status: 'transmis', count: 6, agent: 'P. Ekomi', history: [
      ['2026-04-02', '10:45', 'ORG', 'depot', 'Demande transmise par le ministère'],
      ['2026-04-03', '08:40', 'SEC', 'reception', 'Courrier enregistré par le secrétariat'],
      ['2026-04-10', '11:30', 'SDN', 'instruction', 'Recevabilité confirmée — instruction ouverte'],
      ['2026-09-15', '15:15', 'SDN', 'courrier', 'Note de transmission préparée'],
      ['2026-09-17', '17:40', 'CHEF', 'visa', 'Visa interne apposé sur la note de transmission'],
      ['2026-09-18', '09:10', 'CHEF', 'transmission', 'Transmis au Directeur général']] },
    { n: 7, org: 'o5', depot: '2026-04-21', status: 'approuve', count: 3, agent: 'L. Moussavou', history: [
      ['2026-04-21', '14:05', 'ORG', 'depot', 'Demande déposée'],
      ['2026-04-22', '09:12', 'SEC', 'reception', 'Courrier enregistré par le secrétariat'],
      ['2026-04-29', '10:50', 'SDN', 'instruction', 'Recevabilité confirmée — instruction ouverte'],
      ['2026-06-10', '11:25', 'CHEF', 'transmission', 'Transmis au Directeur général'],
      ['2026-08-24', '15:30', 'AUT', 'decision', 'Décision d’attribution enregistrée'],
      ['2026-10-09', '12:00', 'ORG', 'ceremonie', 'Date proposée pour la cérémonie à Mouila']] },
    { n: 8, org: 'o8', depot: '2026-05-07', status: 'complement', count: 4, agent: 'P. Ekomi', complementSince: '2026-09-29', history: [
      ['2026-05-07', '09:25', 'ORG', 'depot', 'Demande déposée'],
      ['2026-05-08', '10:40', 'SEC', 'reception', 'Courrier enregistré par le secrétariat'],
      ['2026-05-15', '14:45', 'SDN', 'instruction', 'Recevabilité confirmée — instruction ouverte'],
      ['2026-09-29', '11:10', 'SDN', 'complement', 'Complément demandé : attestations d’ancienneté lisibles']],
      observations: [['2026-09-29', 'SDN', 'Le fichier des attestations d’ancienneté est illisible (numérisation floue).']] },
    { n: 9, org: 'o1', depot: '2026-05-26', status: 'en_cours', count: 3, agent: 'L. Moussavou', history: [
      ['2026-05-26', '15:20', 'ORG', 'depot', 'Demande déposée'],
      ['2026-05-27', '09:05', 'SEC', 'reception', 'Courrier enregistré par le secrétariat'],
      ['2026-09-24', '10:35', 'SDN', 'instruction', 'Recevabilité confirmée — instruction ouverte'],
      ['2026-10-13', '16:50', 'SDN', 'courrier', 'Note de transmission préparée — en attente de visa']] },
    { n: 10, org: 'o2', depot: '2026-06-09', status: 'approuve', count: 5, agent: 'P. Ekomi', history: [
      ['2026-06-09', '10:00', 'ORG', 'depot', 'Demande déposée'],
      ['2026-06-10', '08:35', 'SEC', 'reception', 'Courrier enregistré par le secrétariat'],
      ['2026-06-16', '13:30', 'SDN', 'instruction', 'Recevabilité confirmée — instruction ouverte'],
      ['2026-07-21', '09:50', 'CHEF', 'transmission', 'Transmis au Directeur général'],
      ['2026-09-08', '16:15', 'AUT', 'decision', 'Décision d’attribution enregistrée'],
      ['2026-10-14', '11:05', 'SDN', 'ceremonie', 'Conflit identifié sur la date proposée']] },
    { n: 11, org: 'o3', depot: '2026-07-01', status: 'transmis', count: 2, agent: 'L. Moussavou', history: [
      ['2026-07-01', '11:40', 'ORG', 'depot', 'Demande déposée'],
      ['2026-07-02', '09:15', 'SEC', 'reception', 'Courrier enregistré par le secrétariat'],
      ['2026-07-09', '14:00', 'SDN', 'instruction', 'Recevabilité confirmée — instruction ouverte'],
      ['2026-10-01', '15:30', 'SDN', 'courrier', 'Note de transmission préparée'],
      ['2026-10-05', '10:15', 'CHEF', 'visa', 'Visa interne apposé sur la note de transmission'],
      ['2026-10-06', '09:00', 'CHEF', 'transmission', 'Transmis au Directeur général']] },
    { n: 12, org: 'o6', depot: '2026-07-20', status: 'complement', count: 5, agent: 'P. Ekomi', complementSince: '2026-09-10', history: [
      ['2026-07-20', '10:30', 'ORG', 'depot', 'Demande transmise par le ministère'],
      ['2026-07-21', '08:50', 'SEC', 'reception', 'Courrier enregistré par le secrétariat'],
      ['2026-07-28', '11:45', 'SDN', 'instruction', 'Recevabilité confirmée — instruction ouverte'],
      ['2026-09-10', '15:20', 'SDN', 'complement', 'Complément demandé : liste nominative signée'],
      ['2026-10-01', '10:00', 'SDN', 'relance', 'Relance adressée au demandeur']] },
    { n: 13, org: 'o5', depot: '2026-08-11', status: 'en_cours', count: 4, agent: 'L. Moussavou', history: [
      ['2026-08-11', '09:10', 'ORG', 'depot', 'Demande déposée'],
      ['2026-08-12', '10:25', 'SEC', 'reception', 'Courrier enregistré par le secrétariat'],
      ['2026-08-20', '14:35', 'SDN', 'instruction', 'Recevabilité confirmée — instruction ouverte'],
      ['2026-10-10', '11:00', 'SDN', 'courrier', 'Note de transmission préparée — en attente de visa']] },
    { n: 14, org: 'o7', depot: '2026-08-27', status: 'complement', count: 3, agent: 'P. Ekomi', complementSince: '2026-10-02', history: [
      ['2026-08-27', '16:05', 'ORG', 'depot', 'Demande déposée'],
      ['2026-08-28', '09:40', 'SEC', 'reception', 'Courrier enregistré par le secrétariat'],
      ['2026-09-07', '10:10', 'SDN', 'instruction', 'Recevabilité confirmée — instruction ouverte'],
      ['2026-10-02', '14:50', 'SDN', 'complement', 'Complément demandé : certificats de travail']] },
    { n: 15, org: 'o8', depot: '2026-09-14', status: 'en_cours', count: 2, agent: 'P. Ekomi', history: [
      ['2026-09-14', '13:15', 'ORG', 'depot', 'Demande déposée'],
      ['2026-09-15', '09:00', 'SEC', 'reception', 'Courrier enregistré par le secrétariat'],
      ['2026-09-22', '15:40', 'SDN', 'instruction', 'Recevabilité confirmée — instruction ouverte']] },
    { n: 16, org: 'o4', depot: '2026-10-01', status: 'recu', count: 4, agent: null, history: [
      ['2026-10-01', '10:20', 'ORG', 'depot', 'Demande déposée'],
      ['2026-10-02', '08:45', 'SEC', 'reception', 'Courrier enregistré par le secrétariat']] },
    { n: 17, org: 'o1', depot: '2026-10-08', status: 'recu', count: 3, agent: null, history: [
      ['2026-10-08', '09:50', 'ORG', 'depot', 'Demande déposée'],
      ['2026-10-08', '10:05', 'SEC', 'reception', 'Courrier enregistré par le secrétariat']] },
    { n: 18, org: 'o2', depot: '2026-10-14', status: 'recu', count: 5, agent: null, history: [
      ['2026-10-14', '15:35', 'ORG', 'depot', 'Demande déposée'],
      ['2026-10-15', '08:12', 'SEC', 'reception', 'Courrier enregistré par le secrétariat']] },
    { n: 19, org: 'o2', depot: '2026-09-30', status: 'approuve', count: 2, agent: 'L. Moussavou', history: [
      ['2026-09-30', '09:20', 'ORG', 'depot', 'Demande déposée'],
      ['2026-10-01', '08:30', 'SEC', 'reception', 'Courrier enregistré par le secrétariat'],
      ['2026-10-02', '11:10', 'SDN', 'instruction', 'Recevabilité confirmée — instruction ouverte'],
      ['2026-10-06', '15:00', 'CHEF', 'transmission', 'Transmis à la hiérarchie'],
      ['2026-10-09', '14:30', 'AUT', 'decision', 'Décision d’attribution enregistrée'],
      ['2026-10-12', '09:40', 'ORG', 'ceremonie', 'Retrait sans cérémonie demandé']] },
    { n: 20, org: 'o3', depot: '2026-10-12', status: 'recu', count: 3, agent: null, history: [
      ['2026-10-12', '14:05', 'ORG', 'depot', 'Demande déposée'],
      ['2026-10-13', '08:55', 'SEC', 'reception', 'Courrier enregistré par le secrétariat']] },
    { n: 21, org: 'o4', depot: '2026-09-08', status: 'approuve', count: 3, agent: 'L. Moussavou', history: [
      ['2026-09-08', '10:15', 'ORG', 'depot', 'Demande déposée'],
      ['2026-09-09', '08:40', 'SEC', 'reception', 'Courrier enregistré par le secrétariat'],
      ['2026-09-14', '11:20', 'SDN', 'instruction', 'Recevabilité confirmée — instruction ouverte'],
      ['2026-09-28', '15:10', 'CHEF', 'transmission', 'Transmis à la hiérarchie'],
      ['2026-10-02', '14:00', 'AUT', 'decision', 'Décision d’attribution enregistrée']] }
  ];

  const ACTOR = {
    ORG: 'Organisme demandeur', SEC: 'Secrétariat', SEC_MIN: 'Secrétariat du Ministre', SEC_DGT: 'Secrétariat de la DGT', SEC_DR: 'Secrétariat de la DR',
    SDN: 'Service des Distinctions', CHEF: 'Chef du Service', DG: 'Direction générale', MIN: 'Ministre du Travail', DR: 'Direction régionale du Travail',
    INSP: 'Inspection du travail', REG: 'Régie des médailles', AUT: 'Autorité compétente'
  };
  const orgById = id => organisations.find(o => o.id === id);
  const authorityById = id => authorities.find(a => a.id === id);
  // Autorité destinataire de chaque dossier : elle reçoit le dépôt, le fait
  // enregistrer par son secrétariat et rend la décision initiale.
  const AUTHORITY = { 1: 'dgt', 2: 'dgt', 3: 'dgt', 4: 'dgt', 5: 'dgt', 6: 'dgt', 7: 'dgt', 8: 'dr', 9: 'min', 10: 'dgt',
    11: 'dgt', 12: 'min', 13: 'dr', 14: 'dr', 15: 'dr', 16: 'min', 17: 'dr', 18: 'min', 19: 'min', 20: 'dr', 21: 'dr' };
  const channelFor = org => (org && org.type === 'Ministère' ? 'Transmission ministérielle' : 'Dépôt du demandeur');

  const dossiers = D.map(x => {
    const ref = 'DNG-2026-' + String(x.n).padStart(3, '0');
    const org = orgById(x.org);
    return {
    registryDossier, registryDoc,
      ref, org: x.org, depot: x.depot, status: x.status, agent: x.agent,
      authority: AUTHORITY[x.n] || 'dgt', channel: channelFor(org),
      complementSince: x.complementSince || null,
      recipients: recipients(ref, x.n, x.count),
      history: x.history.map(h => ({ date: h[0], time: h[1], actor: h[2] === 'ORG' ? org.name : ACTOR[h[2]], kind: h[3], label: h[4] })),
      observations: (x.observations || []).map(o => ({ date: o[0], author: ACTOR[o[1]], text: o[2] }))
    };
  });

  // Le profil « Employé / Récipiendaire » suit une même personne dans deux
  // dossiers : une distinction attribuée en attente de cérémonie (BEC) et une
  // distinction attribuée sans cérémonie (retrait à la régie).
  const PERSON = (() => {
    const d2 = dossiers.find(d => d.ref === 'DNG-2026-002').recipients[2];
    return { ids: [d2.id, 'DNG-2026-021-R1'], nom: d2.nom, prenom: d2.prenom, fonction: d2.fonction, entree: d2.entree, org: 'o4' };
  })();
  (() => {
    const d21 = dossiers.find(d => d.ref === 'DNG-2026-021');
    const r1 = d21.recipients[0];
    r1.id = 'DNG-2026-021-R1'; r1.nom = PERSON.nom; r1.prenom = PERSON.prenom;
    r1.fonction = PERSON.fonction; r1.entree = PERSON.entree;
    r1.medal = medalForYears(config.referenceDate.slice(0, 4) - +PERSON.entree.slice(0, 4));
  })();

  // Distinctions personnelles (relevé du bénéficiaire, calculé sur le dossier).
  const distinctions = (() => {
    const d2 = dossiers.find(d => d.ref === 'DNG-2026-002'), d21 = dossiers.find(d => d.ref === 'DNG-2026-021');
    const m2 = d2.recipients.find(r => r.id === PERSON.ids[0]).medal;
    const m21 = d21.recipients.find(r => r.id === PERSON.ids[1]).medal;
    return [
      { id: 'DIS-2015-014', person: PERSON.ids[0], medal: 'bronze', year: 2015, dossier: 'DNG-2015-0064', ceremony: 'CER-2015-07',
        venue: 'Hôtel de Ville de Libreville', date: '2015-11-18', state: 'remise', source: 'Campagne 2015 — reconnaissance de l’ancienneté' },
      { id: 'DIS-2026-121', person: PERSON.ids[0], medal: m2, year: 2026, dossier: 'DNG-2026-002', ceremony: 'CER-2026-02',
        venue: 'Cité de la Démocratie', date: '2026-10-22', state: 'attribue', source: 'Campagne 2026 — distinctions professionnelles' },
      { id: 'DIS-2026-303', person: PERSON.ids[1], medal: m21, year: 2026, dossier: 'DNG-2026-021', ceremony: null,
        venue: null, date: '2026-10-02', state: 'attribue', source: 'Campagne 2026 — distinctions professionnelles' }
    ];
  })();

  /* ---------- Courriers et documents ---------- */
  const documents = [
    { id: 'd1',  dossier: 'DNG-2026-006', kind: 'demande',      type: 'entrant',  title: 'Courrier de transmission des propositions', date: '2026-04-02', from: 'Secrétariat général — Ministère de la Santé', state: 'enregistre', pages: 2, number: 'N° 0412/MS/SG' },
    { id: 'd2',  dossier: 'DNG-2026-006', kind: 'liste',        type: 'piece',    title: 'Liste nominative des récipiendaires', date: '2026-04-02', from: 'Ministère de la Santé', state: 'enregistre', pages: 1 },
    { id: 'd3',  dossier: 'DNG-2026-006', kind: 'transmission', type: 'note',     title: 'Note de transmission au Directeur général', date: '2026-09-15', from: 'Chef du Service des Distinctions', state: 'vise', pages: 1, internal: true, number: 'N° 118/SDN', visa: { by: 'Joséphine Mba-Ondo', role: 'Chef du Service des Distinctions', date: '2026-09-17', time: '17:40' } },
    { id: 'd4',  dossier: 'DNG-2026-005', kind: 'demande',      type: 'entrant',  title: 'Demande d’attribution de médailles', date: '2026-03-16', from: 'Compagnie Forestière de l’Ogooué', state: 'enregistre', pages: 2, number: 'Réf. CFO/RH/2026-031' },
    { id: 'd5',  dossier: 'DNG-2026-005', kind: 'transmission', type: 'note',     title: 'Note de transmission au Directeur général', date: '2026-08-28', from: 'Chef du Service des Distinctions', state: 'vise', pages: 1, internal: true, number: 'N° 104/SDN', visa: { by: 'Joséphine Mba-Ondo', role: 'Chef du Service des Distinctions', date: '2026-09-02', time: '09:20' } },
    { id: 'd6',  dossier: 'DNG-2026-008', kind: 'complement',   type: 'sortant',  title: 'Demande de complément', date: '2026-09-29', from: 'Service des Distinctions', state: 'envoye', pages: 1, number: 'N° 122/SDN', request: 'Attestations d’ancienneté lisibles pour les quatre récipiendaires proposés.' },
    { id: 'd7',  dossier: 'DNG-2026-008', kind: 'attestations', type: 'piece',    title: 'Attestations d’ancienneté', date: '2026-05-07', from: 'Ciments du Komo', state: 'illisible', pages: 4 },
    { id: 'd8',  dossier: 'DNG-2026-007', kind: 'decision',     type: 'decision', title: 'Décision d’attribution', date: '2026-08-24', from: 'Autorité compétente', state: 'enregistre', pages: 1, number: 'Décision n° 2026-077', decision: 'approuve' },
    { id: 'd9',  dossier: 'DNG-2026-009', kind: 'demande',      type: 'entrant',  title: 'Demande d’attribution de médailles', date: '2026-05-26', from: 'Okoumé Énergie SA', state: 'enregistre', pages: 2, number: 'Réf. OE/DRH/2026-058' },
    { id: 'd10', dossier: 'DNG-2026-009', kind: 'transmission', type: 'note',     title: 'Note de transmission au Directeur général', date: '2026-10-13', from: 'Service des Distinctions', state: 'attente_visa', pages: 1, internal: true, number: 'N° 131/SDN' },
    { id: 'd11', dossier: 'DNG-2026-018', kind: 'demande',      type: 'entrant',  title: 'Demande d’attribution de médailles', date: '2026-10-14', from: 'Compagnie Forestière de l’Ogooué', state: 'enregistre', pages: 2, number: 'Réf. CFO/RH/2026-112' },
    { id: 'd12', dossier: 'DNG-2026-002', kind: 'convocation',  type: 'sortant',  title: 'Convocation à la cérémonie de remise', date: '2026-10-07', from: 'Service des Distinctions', state: 'envoye', pages: 1, number: 'N° 127/SDN' },
    { id: 'd13', dossier: 'DNG-2026-012', kind: 'complement',   type: 'sortant',  title: 'Demande de complément', date: '2026-09-10', from: 'Service des Distinctions', state: 'envoye', pages: 1, number: 'N° 115/SDN', request: 'Liste nominative signée par l’autorité du ministère demandeur.' },
    { id: 'd14', dossier: 'DNG-2026-016', kind: 'demande',      type: 'entrant',  title: 'Demande d’attribution de médailles', date: '2026-10-01', from: 'Banque Équatoriale de Crédit', state: 'enregistre', pages: 2, number: 'Réf. BEC/DCH/2026-204' },
    { id: 'd15', dossier: 'DNG-2026-013', kind: 'transmission', type: 'note',     title: 'Note de transmission au Directeur général', date: '2026-10-10', from: 'Service des Distinctions', state: 'attente_visa', pages: 1, internal: true, number: 'N° 129/SDN' },
    { id: 'd16', dossier: 'DNG-2026-017', kind: 'demande',      type: 'entrant',  title: 'Demande d’attribution de médailles', date: '2026-10-08', from: 'Okoumé Énergie SA', state: 'enregistre', pages: 2, number: 'Réf. OE/DRH/2026-097' },
    { id: 'd17', dossier: 'DNG-2026-014', kind: 'complement',   type: 'sortant',  title: 'Demande de complément', date: '2026-10-02', from: 'Service des Distinctions', state: 'envoye', pages: 1, number: 'N° 124/SDN', request: 'Certificats de travail des trois récipiendaires.' },
    { id: 'd18', dossier: 'DNG-2026-004', kind: 'demande',      type: 'entrant',  title: 'Demande d’attribution de médailles', date: '2026-02-24', from: 'Société Gabonaise de Logistique Portuaire', state: 'enregistre', pages: 3, number: 'Réf. SGLP/CP/2026-018' },
    { id: 'd19', dossier: 'DNG-2026-004', kind: 'decision',     type: 'decision', title: 'Décision d’attribution', date: '2026-05-27', from: 'Autorité compétente', state: 'enregistre', pages: 1, number: 'Décision n° 2026-041', decision: 'approuve' },
    { id: 'd20', dossier: 'DNG-2026-019', kind: 'decision',     type: 'decision', title: 'Décision d’attribution', date: '2026-10-09', from: 'Autorité compétente', state: 'enregistre', pages: 1, number: 'Décision n° 2026-091', decision: 'approuve' },
    { id: 'd21', dossier: 'DNG-2026-019', kind: 'demande_retrait', type: 'entrant', title: 'Demande de retrait sans cérémonie', date: '2026-10-12', from: 'Compagnie Forestière de l’Ogooué', state: 'enregistre', pages: 1, number: 'Réf. CFO/RH/2026-105' },
    { id: 'd22', dossier: 'DNG-2026-002', kind: 'recette',      type: 'sortant',  title: 'Ordre de recette', date: '2026-09-25', from: 'Service des Distinctions', state: 'envoye', pages: 1, number: 'N° 125/SDN', order: 'OR-2026-0112' },
    { id: 'd23', dossier: 'DNG-2026-002', kind: 'recu',         type: 'piece',    title: 'Reçu de paiement', date: '2026-10-12', from: 'Banque Équatoriale de Crédit', state: 'depose', pages: 1, order: 'OR-2026-0112', file: { name: 'recu-paiement-OR-2026-0112.pdf', size: 418300, type: 'application/pdf' } },
    { id: 'd24', dossier: 'DNG-2026-003', kind: 'recours',      type: 'entrant',  title: 'Recours gracieux', date: '2026-06-02', from: 'Télécom Estuaire', state: 'enregistre', pages: 3, number: 'Réf. TE/RH/2026-044' },
    { id: 'd25', dossier: 'DNG-2026-012', kind: 'note_controle', type: 'note',    title: 'Rapport de contrôle documentaire', date: '2026-10-06', from: 'Inspection du travail', state: 'enregistre', pages: 2, internal: true, number: 'N° INSP/2026-021' }
  ];

  // DTS : déclaration de travail et de salaire produite pour chaque bénéficiaire.
  const dts = [
    { id: 'DTS-2026-0001', dossier: 'DNG-2026-001', recipient: 'DNG-2026-001-R1', employer: 'Okoumé Énergie SA', position: 'Chef d’équipe', start: '2003-04-12', reference: 'OE/DRH/DTS/2026-011', state: 'verifie', filed: '2026-01-12', verifiedBy: 'L. Moussavou', verifiedOn: '2026-01-19' },
    { id: 'DTS-2026-0002', dossier: 'DNG-2026-001', recipient: 'DNG-2026-001-R2', employer: 'Okoumé Énergie SA', position: 'Technicienne de maintenance', start: '2011-07-04', reference: 'OE/DRH/DTS/2026-012', state: 'verifie', filed: '2026-01-12', verifiedBy: 'L. Moussavou', verifiedOn: '2026-01-19' },
    { id: 'DTS-2026-0003', dossier: 'DNG-2026-008', recipient: 'DNG-2026-008-R1', employer: 'Ciments du Komo', position: 'Contrôleur qualité', start: '2015-02-18', reference: 'CK/PERS/DTS/2026-004', state: 'anomalie', filed: '2026-05-07', note: 'Attestation d’ancienneté illisible : nouvelle numérisation demandée.' },
    { id: 'DTS-2026-0004', dossier: 'DNG-2026-009', recipient: 'DNG-2026-009-R1', employer: 'Okoumé Énergie SA', position: 'Ingénieure process', start: '2004-09-01', reference: 'OE/DRH/DTS/2026-058', state: 'saisi', filed: '2026-05-26' },
    { id: 'DTS-2026-0005', dossier: 'DNG-2026-012', recipient: 'DNG-2026-012-R1', employer: 'Ministère de la Santé', position: 'Infirmière principale', start: '1999-11-15', reference: 'MS/SG/DTS/2026-031', state: 'saisi', filed: '2026-07-20' },
    { id: 'DTS-2026-0006', dossier: 'DNG-2026-017', recipient: 'DNG-2026-017-R1', employer: 'Okoumé Énergie SA', position: 'Chef de quart', start: '2016-03-22', reference: 'OE/DRH/DTS/2026-097', state: 'attendu' },
    { id: 'DTS-2026-0007', dossier: 'DNG-2026-006', recipient: 'DNG-2026-006-R1', employer: 'Ministère de la Santé', position: 'Agent administratif', start: '2010-06-30', reference: 'MS/SG/DTS/2026-018', state: 'saisi', filed: '2026-04-02' },
    { id: 'DTS-2026-0008', dossier: 'DNG-2026-019', recipient: 'DNG-2026-019-R1', employer: 'Compagnie Forestière de l’Ogooué', position: 'Magasinier principal', start: '2001-01-09', reference: 'CFO/ADM/DTS/2026-105', state: 'verifie', filed: '2026-09-30', verifiedBy: 'L. Moussavou', verifiedOn: '2026-10-02' }
  ];

  /* ---------- Cérémonies ---------- */
  const ceremonies = [
    { id: 'CER-2026-01', dossier: 'DNG-2026-001', date: '2026-07-09', time: '10:00', venue: 'v4', state: 'termine' },
    { id: 'CER-2026-02', dossier: 'DNG-2026-002', date: '2026-10-22', time: '10:00', venue: 'v1', state: 'confirme', validation: 'Confirmation du 6 octobre 2026' },
    { id: 'CER-2026-03', dossier: 'DNG-2026-004', date: '2026-11-12', time: '15:00', venue: 'v2', state: 'negociation', note: 'Le lieu propose le 13 novembre en alternative.' },
    { id: 'CER-2026-04', dossier: 'DNG-2026-007', date: '2026-11-26', time: '10:30', venue: 'v5', state: 'propose' },
    { id: 'CER-2026-05', dossier: 'DNG-2026-010', date: '2026-10-22', time: '15:00', venue: 'v1', state: 'conflit', note: 'Le lieu est déjà réservé ce jour pour CER-2026-02.' }
  ];

  /* ---------- Registre des courriers et transmissions ----------
     Tenue par le secrétariat de chaque autorité destinataire. Le registre est
     construit à partir des dossiers et des courriers versés au dossier : un
     même courrier garde donc la même référence dans tous les profils.
     direction : entrant | sortant | interne                                */
  const DAY = 86400000;
  const daysFromRef = d => Math.round((new Date(config.referenceDate) - new Date(d)) / DAY);
  const timeOf = (d, doc) => {
    const h = d.history.find(x => x.date === doc.date && x.time);
    return h ? h.time : '10:00';
  };
  /* Lignes du registre : une même règle pour les données de référence et pour
     les dossiers créés depuis l'interface (registryDossier / registryDoc). */
  function registryDossier(d) {
    if (!d) return null;
    const a = authorityById(d.authority), o = orgById(d.org);
    if (!a || !o) return null;
    const reception = d.history.find(h => h.kind === 'reception');
    const doc = documents.find(x => x.dossier === d.ref && x.kind === 'demande') ||
      (d.ref && null);
    return {
      date: reception ? reception.date : d.depot, time: reception ? reception.time : '09:00',
      direction: 'entrant', dossier: d.ref,
      subject: `Demande d’attribution de médailles — ${d.recipients.length} récipiendaire${d.recipients.length > 1 ? 's' : ''}`,
      from: o.name, to: a.label, authority: d.authority, channel: d.channel, file: doc ? doc.id : null,
      state: d.status === 'recu' ? (reception && daysFromRef(reception.date) <= 1 ? 'recu' : 'enregistre') : 'traite',
      assigned: d.status === 'recu' && !(reception && daysFromRef(reception.date) <= 1) ? d.ref : null,
      received: reception ? reception.date : d.depot,
      receivedOf: 'Secrétariat — ' + a.short
    };
  }
  function registryDoc(doc) {
    const d = dossiers.find(x => x.ref === doc.dossier);
    if (!d) return null;
    const a = authorityById(d.authority), o = orgById(d.org);
    if (!a || !o) return null;
    let direction = null, from = '', to = '', state = 'traite', channel = 'Navette interne';
    if (doc.kind === 'demande') return null;
    if (doc.kind === 'transmission') { direction = 'sortant'; from = 'Service des Distinctions nationales'; to = a.label; state = doc.state === 'attente_visa' ? 'enregistre' : 'transmis'; }
    else if (doc.kind === 'decision') { direction = 'entrant'; from = a.label; to = 'Service des Distinctions nationales'; }
    else if (doc.kind === 'complement' || doc.kind === 'relance') { direction = 'sortant'; from = 'Service des Distinctions nationales'; to = o.name; state = 'transmis'; channel = 'Courrier postal'; }
    else if (doc.kind === 'recette') { direction = 'sortant'; from = 'Service des Distinctions nationales'; to = o.name; channel = 'Courrier postal'; }
    else if (doc.kind === 'recours') { direction = 'entrant'; from = doc.from; to = a.label; state = 'transmis'; channel = 'Courrier postal'; }
    else if (doc.kind === 'recu') { direction = 'entrant'; from = doc.from; to = 'Régie des médailles'; channel = 'Dépôt du demandeur'; }
    else if (doc.kind === 'demande_retrait') { direction = 'entrant'; from = doc.from; to = 'Régie des médailles'; state = 'enregistre'; channel = 'Dépôt du demandeur'; }
    else return null;
    return {
      date: doc.date, time: timeOf(d, doc), direction, dossier: d.ref, subject: doc.title,
      from, to, authority: d.authority, channel, file: doc.id, state, received: null, receivedOf: null, assigned: d.ref
    };
  }

  const registry = [];
  dossiers.forEach(d => { const row = registryDossier(d); if (row) registry.push(row); });
  documents.forEach(doc => { const row = registryDoc(doc); if (row) registry.push(row); });
  registry.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const transmissions = registry.map((t, i) => Object.assign({ id: 'TR-2026-' + String(149 - i).padStart(4, '0') }, t));


  /* ---------- Ordres de recette, reçus et vérifications ---------- */
  const receiptOrders = [
    { id: 'OR-2026-0110', dossier: 'DNG-2026-001', amount: '1 260 000 FCFA', issued: '2026-05-20', due: '2026-06-20', state: 'verifie', reference: 'Décision n° 2026-038',
      receipts: [{ id: 'REC-2026-0048', date: '2026-06-05', from: 'Okoumé Énergie SA', file: { name: 'recu-OR-2026-0110.pdf', size: 302100, type: 'application/pdf' }, verifiedBy: 'Nadège Koumba', verifiedOn: '2026-06-08', note: 'Quittance du Trésor conforme.' }] },
    { id: 'OR-2026-0112', dossier: 'DNG-2026-002', amount: '2 840 000 FCFA', issued: '2026-09-25', due: '2026-10-25', state: 'verifie', reference: 'Décision n° 2026-052',
      receipts: [{ id: 'REC-2026-0051', date: '2026-10-12', from: 'Banque Équatoriale de Crédit', file: { name: 'recu-paiement-OR-2026-0112.pdf', size: 418300, type: 'application/pdf' }, verifiedBy: 'Nadège Koumba', verifiedOn: '2026-10-13', note: 'Montant et référence conformes au registre.' }] },
    { id: 'OR-2026-0113', dossier: 'DNG-2026-004', amount: '1 750 000 FCFA', issued: '2026-10-09', due: '2026-11-09', state: 'emis', reference: 'Décision n° 2026-041', receipts: [] },
    { id: 'OR-2026-0114', dossier: 'DNG-2026-010', amount: '1 480 000 FCFA', issued: '2026-10-10', due: '2026-11-10', state: 'emis', reference: 'Décision n° 2026-063', receipts: [] },
    { id: 'OR-2026-0115', dossier: 'DNG-2026-019', amount: '690 000 FCFA', issued: '2026-10-12', due: '2026-11-12', state: 'verifie', reference: 'Décision n° 2026-091',
      receipts: [{ id: 'REC-2026-0052', date: '2026-10-14', from: 'Compagnie Forestière de l’Ogooué', file: { name: 'quittance-CFO-2026.pdf', size: 256700, type: 'application/pdf' }, verifiedBy: 'Nadège Koumba', verifiedOn: '2026-10-15', note: 'Quittance transmise avec la demande de retrait.' }] }
  ];

  /* ---------- Régie des médailles ---------- */
  const stock = [
    { id: 'st-bronze',  item: 'bronze',  label: 'Médaille Bronze',  available: 148, reserved: 32, threshold: 60 },
    { id: 'st-argent',  item: 'argent',  label: 'Médaille Argent',  available: 96,  reserved: 24, threshold: 40 },
    { id: 'st-or',      item: 'or',      label: 'Médaille Or',      available: 43,  reserved: 18, threshold: 30 },
    { id: 'st-diplome', item: 'diplome', label: 'Diplôme de distinction', available: 360, reserved: 86, threshold: 100 }
  ];

  const suppliers = [
    { id: 'f1', name: 'Manufacture nationale des médailles', city: 'Libreville', contact: 'Cabinet Delmas', lead: '6 semaines', items: ['bronze', 'argent', 'or'] },
    { id: 'f2', name: 'Atelier de gravure de l’Estuaire', city: 'Owendo', contact: 'Atelier Ondo & fils', lead: '4 semaines', items: ['bronze', 'argent'] },
    { id: 'f3', name: 'Imprimerie officielle', city: 'Libreville', contact: 'Service des commandes', lead: '3 semaines', items: ['diplome'] }
  ];

  const purchaseOrders = [
    { id: 'BC-2026-0012', supplier: 'f1', date: '2026-09-12', expected: '2026-11-05', state: 'livre_partiel', note: 'Commande destinée aux cérémonies du 4ᵉ trimestre.',
      lines: [{ item: 'bronze', qty: 80, unit: '18 000 FCFA' }, { item: 'argent', qty: 40, unit: '28 000 FCFA' }] },
    { id: 'BC-2026-0008', supplier: 'f2', date: '2026-06-18', expected: '2026-07-28', state: 'livre', note: 'Réapprovisionnement de printemps.',
      lines: [{ item: 'bronze', qty: 60, unit: '17 500 FCFA' }, { item: 'argent', qty: 25, unit: '27 000 FCFA' }, { item: 'or', qty: 15, unit: '41 000 FCFA' }] },
    { id: 'BC-2026-0014', supplier: 'f3', date: '2026-10-05', expected: '2026-10-30', state: 'envoye', note: 'Diplômes de la campagne 2026.',
      lines: [{ item: 'diplome', qty: 150, unit: '4 500 FCFA' }] }
  ];

  const deliveries = [
    { id: 'LIV-2026-003', order: 'BC-2026-0012', supplier: 'f1', date: '2026-10-02', state: 'partielle', receiver: 'Nadège Koumba', note: 'Reliquat attendu au 5 novembre.',
      lines: [{ item: 'bronze', qty: 80, received: 52 }, { item: 'argent', qty: 40, received: 20 }] },
    { id: 'LIV-2026-002', order: 'BC-2026-0008', supplier: 'f2', date: '2026-07-28', state: 'conforme', receiver: 'Nadège Koumba',
      lines: [{ item: 'bronze', qty: 60, received: 60 }, { item: 'argent', qty: 25, received: 25 }, { item: 'or', qty: 15, received: 15 }] }
  ];

  const stockMovements = [
    { id: 'MV-2026-0023', date: '2026-10-06', item: 'bronze', field: 'reserved', qty: 2, reason: 'Réservation — cérémonie CER-2026-02', dossier: 'DNG-2026-002', author: 'Régie des médailles' },
    { id: 'MV-2026-0022', date: '2026-10-06', item: 'argent', field: 'reserved', qty: 2, reason: 'Réservation — cérémonie CER-2026-02', dossier: 'DNG-2026-002', author: 'Régie des médailles' },
    { id: 'MV-2026-0021', date: '2026-10-02', item: 'argent', field: 'available', qty: 20, reason: 'Réception fournisseur LIV-2026-003', author: 'Régie des médailles' },
    { id: 'MV-2026-0020', date: '2026-10-02', item: 'bronze', field: 'available', qty: 52, reason: 'Réception fournisseur LIV-2026-003', author: 'Régie des médailles' },
    { id: 'MV-2026-0019', date: '2026-09-12', item: 'diplome', field: 'reserved', qty: 6, reason: 'Réservation — campagne 2026', author: 'Régie des médailles' },
    { id: 'MV-2026-0004', date: '2026-07-28', item: 'or', field: 'available', qty: 15, reason: 'Réception fournisseur LIV-2026-002', author: 'Régie des médailles' },
    { id: 'MV-2026-0003', date: '2026-07-28', item: 'argent', field: 'available', qty: 25, reason: 'Réception fournisseur LIV-2026-002', author: 'Régie des médailles' },
    { id: 'MV-2026-0002', date: '2026-07-28', item: 'bronze', field: 'available', qty: 60, reason: 'Réception fournisseur LIV-2026-002', author: 'Régie des médailles' },
    { id: 'MV-2026-0001a', date: '2026-07-09', item: 'argent', field: 'available', qty: -3, reason: 'Remise effective — CER-2026-01', dossier: 'DNG-2026-001', remise: 'REM-2026-0001', author: 'Régie des médailles' },
    { id: 'MV-2026-0001b', date: '2026-07-09', item: 'bronze', field: 'available', qty: -2, reason: 'Remise effective — CER-2026-01', dossier: 'DNG-2026-001', remise: 'REM-2026-0001', author: 'Régie des médailles' },
    { id: 'MV-2026-0001c', date: '2026-07-09', item: 'or', field: 'available', qty: -1, reason: 'Remise effective — CER-2026-01', dossier: 'DNG-2026-001', remise: 'REM-2026-0001', author: 'Régie des médailles' },
    { id: 'MV-2026-0000', date: '2026-06-30', item: 'bronze', field: 'reserved', qty: 30, reason: 'Solde d’ouverture — réservations en cours (campagnes 2025-2026)', author: 'Régie des médailles' },
    { id: 'MV-2026-0000b', date: '2026-06-30', item: 'argent', field: 'reserved', qty: 22, reason: 'Solde d’ouverture — réservations en cours (campagnes 2025-2026)', author: 'Régie des médailles' },
    { id: 'MV-2026-0000c', date: '2026-06-30', item: 'or', field: 'reserved', qty: 18, reason: 'Solde d’ouverture — réservations en cours (campagnes 2025-2026)', author: 'Régie des médailles' },
    { id: 'MV-2026-0000d', date: '2026-06-30', item: 'diplome', field: 'reserved', qty: 80, reason: 'Solde d’ouverture — réservations en cours (campagnes 2025-2026)', author: 'Régie des médailles' },
    { id: 'MV-2026-0000e', date: '2026-06-30', item: 'bronze', field: 'available', qty: 38, reason: 'Solde d’ouverture — stock physique au 30 juin 2026', author: 'Régie des médailles' },
    { id: 'MV-2026-0000f', date: '2026-06-30', item: 'argent', field: 'available', qty: 54, reason: 'Solde d’ouverture — stock physique au 30 juin 2026', author: 'Régie des médailles' },
    { id: 'MV-2026-0000g', date: '2026-06-30', item: 'or', field: 'available', qty: 29, reason: 'Solde d’ouverture — stock physique au 30 juin 2026', author: 'Régie des médailles' },
    { id: 'MV-2026-0000h', date: '2026-06-30', item: 'diplome', field: 'available', qty: 360, reason: 'Solde d’ouverture — stock physique au 30 juin 2026', author: 'Régie des médailles' }
  ];

  const remises = [
    {
      id: 'REM-2026-0002', dossier: 'DNG-2026-002', ceremony: 'CER-2026-02', date: '2026-10-06',
      state: 'preparee', mode: 'cérémonie',
      recipients: ['DNG-2026-002-R1', 'DNG-2026-002-R2', 'DNG-2026-002-R3', 'DNG-2026-002-R4'],
      recordedBy: 'Nadège Koumba',
      note: 'Médailles préparées et réservées (2 Bronze, 2 Argent, 4 diplômes) pour la cérémonie du 22 octobre. La remise effective sera enregistrée après la cérémonie.'
    },
    { id: 'REM-2026-0001', dossier: 'DNG-2026-001', ceremony: 'CER-2026-01', date: '2026-07-09', state: 'remise', mode: 'cérémonie',
      recipients: ['DNG-2026-001-R1', 'DNG-2026-001-R2', 'DNG-2026-001-R3', 'DNG-2026-001-R4', 'DNG-2026-001-R5', 'DNG-2026-001-R6'],
      recordedBy: 'Nadège Koumba', note: 'Remise effectuée lors de la cérémonie de Port-Gentil.' }
  ];

  const withdrawals = [
    { id: 'RET-2026-0001', dossier: 'DNG-2026-019', recipients: ['DNG-2026-019-R1', 'DNG-2026-019-R2'], date: '2026-10-12', state: 'demande',
      requester: 'Prisca Mabika (Compagnie Forestière de l’Ogooué)', justification: 'Les récipiendaires ne peuvent pas se déplacer à la cérémonie ; ils se présenteront à la régie sur convocation.',
      history: [{ date: '2026-10-12', time: '09:40', actor: 'Compagnie Forestière de l’Ogooué', label: 'Demande de retrait sans cérémonie enregistrée' }] }
  ];

  /* ---------- Compléments, relances, contrôles, recours ---------- */
  const complements = [
    { id: 'CPL-2026-0008', dossier: 'DNG-2026-008', requested: '2026-09-29', due: '2026-10-29', doc: 'd6', items: 'Attestations d’ancienneté lisibles pour les quatre récipiendaires proposés.', state: 'attendu', relances: 0 },
    { id: 'CPL-2026-0009', dossier: 'DNG-2026-012', requested: '2026-09-10', due: '2026-10-10', doc: 'd13', items: 'Liste nominative signée par l’autorité du ministère demandeur.', state: 'relance', relances: 1 },
    { id: 'CPL-2026-0010', dossier: 'DNG-2026-014', requested: '2026-10-02', due: '2026-11-02', doc: 'd17', items: 'Certificats de travail des trois récipiendaires.', state: 'attendu', relances: 0 }
  ];

  const relances = [
    { id: 'REL-2026-0021', dossier: 'DNG-2026-012', date: '2026-10-01', time: '10:00', from: 'Service des Distinctions nationales', to: 'Ministère de la Santé', state: 'envoyee', note: 'Relance à 21 jours de la demande de complément.', doc: 'd13' }
  ];

  const controls = [
    { id: 'CTL-2026-0007', dossier: 'DNG-2026-012', date: '2026-10-06', inspector: 'Rosine Lekogo', state: 'anomalie', scope: 'Contrôle documentaire',
      findings: [
        { code: 'AN-01', label: 'Liste nominative non signée par l’autorité du ministère demandeur', severity: 'majeure' },
        { code: 'AN-02', label: 'Une date d’entrée ne correspond pas à l’attestation d’ancienneté', severity: 'mineure' }
      ],
      note: 'Correction demandée au demandeur par courrier N° 115/SDN.' },
    { id: 'CTL-2026-0006', dossier: 'DNG-2026-013', date: '2026-10-08', inspector: 'Rosine Lekogo', state: 'conforme', scope: 'Contrôle documentaire', findings: [], note: 'Pièces et DTS conformes au dossier.' },
    { id: 'CTL-2026-0005', dossier: 'DNG-2026-009', date: '2026-10-09', inspector: 'Rosine Lekogo', state: 'correction', scope: 'Vérification des bénéficiaires',
      findings: [{ code: 'AN-03', label: 'DTS saisie mais non vérifiée pour le récipiendaire R1', severity: 'mineure' }],
      note: 'Vérification demandée au service instructeur.' }
  ];

  const recours = [
    { id: 'RCS-2026-0001', dossier: 'DNG-2026-003', date: '2026-06-02', author: 'Télécom Estuaire', motif: 'Les attestations d’ancienneté complémentaires, produites après la décision, justifient l’examen de la demande.', state: 'en_examen', authority: 'dgt', doc: 'd24',
      history: [
        { date: '2026-06-02', time: '09:30', actor: 'Télécom Estuaire', label: 'Recours déposé et enregistré au registre' },
        { date: '2026-06-05', time: '11:15', actor: 'Secrétariat de la DGT', label: 'Recours transmis au Service des Distinctions' }
      ] }
  ];

  /* ---------- Journal technique (administrateur) ---------- */
  const audit = [
    { id: 'LOG-2026-0912', date: '2026-10-15', time: '08:12', actor: 'Secrétariat de la DGT', role: 'Secrétaire de la DGT', action: 'Courrier enregistré', detail: 'Registre TR-2026-0142 — DNG-2026-017', level: 'info' },
    { id: 'LOG-2026-0911', date: '2026-10-14', time: '11:05', actor: 'Landry Moussavou', role: 'Agent du Service des Distinctions', action: 'Anomalie de cérémonie signalée', detail: 'Conflit de réservation — DNG-2026-010', level: 'warning' },
    { id: 'LOG-2026-0910', date: '2026-10-13', time: '16:50', actor: 'Landry Moussavou', role: 'Agent du Service des Distinctions', action: 'Note de transmission préparée', detail: 'N° 131/SDN — DNG-2026-009', level: 'info' },
    { id: 'LOG-2026-0909', date: '2026-10-13', time: '08:55', actor: 'Ghislain Makaya', role: 'Secrétaire de la DR', action: 'Courrier enregistré', detail: 'Registre TR-2026-0143 — DNG-2026-020', level: 'info' },
    { id: 'LOG-2026-0908', date: '2026-10-12', time: '09:40', actor: 'Compagnie Forestière de l’Ogooué', role: 'Demandeur — Entreprise', action: 'Retrait sans cérémonie demandé', detail: 'RET-2026-0001 — DNG-2026-019', level: 'info' }
  ];

  const accounts = [
    { id: 'AC-01', user: 'u1', role: 'chef', state: 'actif', created: '2024-03-04', last: '2026-10-15 07:58', scope: 'Service des Distinctions nationales' },
    { id: 'AC-02', user: 'u2', role: 'agent', state: 'actif', created: '2024-05-20', last: '2026-10-15 08:02', scope: 'Service des Distinctions nationales' },
    { id: 'AC-03', user: 'u_ins', role: 'inspecteur', state: 'actif', created: '2025-02-11', last: '2026-10-14 16:20', scope: 'Inspection du travail — Estuaire' },
    { id: 'AC-04', user: 'u_min', role: 'sec_min', state: 'actif', created: '2024-01-15', last: '2026-10-15 07:41', scope: 'Cabinet du Ministre du Travail' },
    { id: 'AC-05', user: 'u_dgt', role: 'sec_dgt', state: 'actif', created: '2024-01-15', last: '2026-10-15 08:11', scope: 'Direction générale du Travail' },
    { id: 'AC-06', user: 'u_dr', role: 'sec_dr', state: 'actif', created: '2024-01-15', last: '2026-10-13 08:50', scope: 'Direction régionale du Travail — Estuaire' },
    { id: 'AC-07', user: 'u_aut', role: 'dgt', state: 'actif', created: '2023-11-02', last: '2026-10-14 09:30', scope: 'Direction générale du Travail' },
    { id: 'AC-08', user: 'u_min2', role: 'ministre', state: 'actif', created: '2023-09-01', last: '2026-10-13 17:45', scope: 'Cabinet du Ministre du Travail' },
    { id: 'AC-09', user: 'u_dr2', role: 'dr', state: 'actif', created: '2024-02-06', last: '2026-10-15 07:20', scope: 'Direction régionale du Travail — Estuaire' },
    { id: 'AC-10', user: 'u_reg', role: 'regisseur', state: 'actif', created: '2024-04-18', last: '2026-10-15 08:05', scope: 'Régie des médailles et distinctions' },
    { id: 'AC-11', user: 'u_adm', role: 'admin', state: 'actif', created: '2023-12-01', last: '2026-10-15 08:00', scope: 'Direction des systèmes d’information' },
    { id: 'AC-12', user: 'u3', role: 'demandeur_entreprise', state: 'actif', created: '2025-06-10', last: '2026-10-14 15:12', scope: 'Okoumé Énergie SA' },
    { id: 'AC-13', user: 'u_ms', role: 'demandeur_ministere', state: 'actif', created: '2025-06-10', last: '2026-10-14 11:30', scope: 'Ministère de la Santé' },
    { id: 'AC-14', user: 'u_rec', role: 'recipiendaire', state: 'actif', created: '2026-03-02', last: '2026-10-12 18:05', scope: 'Bénéficiaire — distinctions remises' },
    { id: 'AC-15', user: 'u_adm', role: 'admin', state: 'suspendu', created: '2025-01-09', last: '2026-06-30 10:00', scope: 'Compte technique de secours' }
  ];

  /* ---------- Notifications ----------
     aud : 'service' | 'authority:<min|dgt|dr>' | 'org:<id>' | 'person:<ref>'
           | 'regie' | 'inspecteur' | 'admin'                                  */
  const notifications = [
    { id: 'n1',  date: '2026-10-15', time: '08:12', type: 'depot',        aud: 'service', read: false, ref: 'DNG-2026-018', title: 'Nouveau dossier reçu', msg: 'La Compagnie Forestière de l’Ogooué propose 5 récipiendaires.' },
    { id: 'n2',  date: '2026-10-14', time: '16:40', type: 'visa',         aud: 'service', read: false, ref: 'DNG-2026-009', doc: 'd10', title: 'Note en attente de visa', msg: 'La note de transmission attend votre visa avant envoi au Directeur général.' },
    { id: 'n3',  date: '2026-10-14', time: '11:05', type: 'conflit',      aud: 'service', read: false, ref: 'DNG-2026-010', title: 'Conflit de réservation', msg: 'La date proposée coïncide avec CER-2026-02 à la Cité de la Démocratie.' },
    { id: 'n4',  date: '2026-10-13', time: '09:30', type: 'complement',   aud: 'service', read: false, ref: 'DNG-2026-008', title: 'Complément toujours attendu', msg: 'Ciments du Komo n’a pas encore transmis les attestations demandées le 29 septembre.' },
    { id: 'n5',  date: '2026-10-11', time: '10:20', type: 'ceremonie',    aud: 'service', read: false, ref: 'DNG-2026-004', title: 'Négociation de date ouverte', msg: 'L’Hôtel de Ville de Libreville propose le 13 novembre en alternative.' },
    { id: 'n6',  date: '2026-10-10', time: '11:02', type: 'visa',         aud: 'service', read: true,  ref: 'DNG-2026-013', doc: 'd15', title: 'Note en attente de visa', msg: 'La note de transmission du dossier est prête pour visa.' },
    { id: 'n7',  date: '2026-10-08', time: '10:05', type: 'depot',        aud: 'service', read: true,  ref: 'DNG-2026-017', title: 'Nouveau dossier reçu', msg: 'Okoumé Énergie SA propose 3 récipiendaires.' },
    { id: 'n8',  date: '2026-10-06', time: '09:45', type: 'ceremonie',    aud: 'service', read: true,  ref: 'DNG-2026-002', title: 'Cérémonie confirmée', msg: 'CER-2026-02 est confirmée le 22 octobre à la Cité de la Démocratie.' },
    { id: 'n9',  date: '2026-10-06', time: '09:00', type: 'transmission', aud: 'service', read: true,  ref: 'DNG-2026-011', title: 'Dossier transmis', msg: 'Le dossier de la SGLP a été transmis au Directeur général.' },
    { id: 'n10', date: '2026-10-01', time: '10:21', type: 'depot',        aud: 'service', read: true,  ref: 'DNG-2026-016', title: 'Nouveau dossier reçu', msg: 'La Banque Équatoriale de Crédit propose 4 récipiendaires.' },
    { id: 'n11', date: '2026-10-08', time: '10:06', type: 'depot',        aud: 'org:o1',  read: false, ref: 'DNG-2026-017', title: 'Votre dossier a été enregistré', msg: 'Le secrétariat a enregistré votre demande pour 3 récipiendaires.' },
    { id: 'n12', date: '2026-09-24', time: '10:36', type: 'transmission', aud: 'org:o1',  read: true,  ref: 'DNG-2026-009', title: 'Instruction ouverte', msg: 'Votre dossier est recevable. L’instruction est en cours.' },
    { id: 'n13', date: '2026-07-09', time: '12:40', type: 'ceremonie',    aud: 'org:o1',  read: true,  ref: 'DNG-2026-001', title: 'Cérémonie effectuée', msg: 'La remise des médailles a eu lieu à l’Hôtel de Ville de Port-Gentil.' },
    { id: 'n14', date: '2026-10-15', time: '08:55', type: 'transmission', aud: 'authority:dr', read: false, ref: 'DNG-2026-020', title: 'Courrier à enregistrer', msg: 'La SGLP a déposé une demande le 12 octobre — réponse à la demande de pièces attendue.', doc: 'd20' },
    { id: 'n15', date: '2026-10-14', time: '15:40', type: 'depot',        aud: 'authority:min', read: false, ref: 'DNG-2026-018', title: 'Dossier reçu au cabinet', msg: 'La Compagnie Forestière de l’Ogooué a déposé une demande de 5 distinctions.' },
    { id: 'n16', date: '2026-10-13', time: '09:10', type: 'transmission', aud: 'authority:dgt', read: false, ref: 'DNG-2026-005', title: 'Dossier transmis pour décision', msg: 'La note de transmission N° 104/SDN du dossier CFO est visée.' },
    { id: 'n17', date: '2026-10-13', time: '16:45', type: 'transmission', aud: 'authority:dgt', read: false, ref: 'DNG-2026-011', title: 'Dossier transmis pour décision', msg: 'La SGLP attend une décision sur 2 récipiendaires.' },
    { id: 'n18', date: '2026-10-12', time: '10:05', type: 'depot',        aud: 'authority:dr', read: true,  ref: 'DNG-2026-020', title: 'Nouveau dossier régional', msg: 'Demande déposée par la SGLP (Owendo).' },
    { id: 'n19', date: '2026-10-13', time: '16:55', type: 'recours',      aud: 'authority:dgt', read: false, ref: 'DNG-2026-003', title: 'Recours en examen', msg: 'Le recours gracieux de Télécom Estuaire attend un avis.' },
    { id: 'n20', date: '2026-10-12', time: '09:45', type: 'complement',   aud: 'org:o1',  read: false, ref: 'DNG-2026-009', title: 'Instruction en cours', msg: 'Aucun complément n’est attendu de votre part pour ce dossier.' },
    { id: 'n21', date: '2026-10-13', time: '10:15', type: 'depot',        aud: 'org:o1',  read: false, ref: 'DNG-2026-017', title: 'Dossier enregistré au secrétariat', msg: 'La DGT a enregistré votre demande du 8 octobre.' },
    { id: 'n22', date: '2026-10-14', time: '11:30', type: 'ceremonie',    aud: 'person:DNG-2026-001-R2', read: false, ref: 'DNG-2026-002', title: 'Cérémonie à venir', msg: 'La cérémonie de remise est confirmée le 22 octobre à la Cité de la Démocratie.', doc: 'd12' },
    { id: 'n23', date: '2026-07-09', time: '12:35', type: 'ceremonie',    aud: 'person:DNG-2026-001-R2', read: true,  ref: 'DNG-2026-001', title: 'Distinction remise', msg: 'Votre médaille a été remise lors de la cérémonie de Port-Gentil.' },
    { id: 'n24', date: '2026-10-12', time: '09:40', type: 'ceremonie',    aud: 'regie', read: false, ref: 'DNG-2026-019', title: 'Retrait sans cérémonie demandé', msg: 'La Compagnie Forestière de l’Ogooué demande le retrait de 2 médailles.' },
    { id: 'n25', date: '2026-10-15', time: '07:50', type: 'complement',   aud: 'regie', read: false, ref: 'DNG-2026-002', title: 'Paiement à vérifier', msg: 'Le reçu REC-2026-0051 est enregistré ; contrôle du montant avant remise.' },
    { id: 'n26', date: '2026-10-06', time: '14:20', type: 'complement',   aud: 'inspecteur', read: false, ref: 'DNG-2026-012', title: 'Anomalies à suivre', msg: 'Deux anomalies documentaires ont été signalées sur le dossier du ministère de la Santé.' },
    { id: 'n27', date: '2026-10-14', time: '11:05', type: 'conflit',      aud: 'org:o2',  read: false, ref: 'DNG-2026-010', title: 'Conflit de date à arbitrer', msg: 'La date proposée pour votre cérémonie entre en conflit : une nouvelle date est nécessaire.' },
    { id: 'n28', date: '2026-10-09', time: '14:35', type: 'decision',     aud: 'org:o2',  read: true,  ref: 'DNG-2026-019', title: 'Distinctions attribuées', msg: 'Une décision favorable a été enregistrée ; le retrait sans cérémonie est en cours de traitement.' },
    { id: 'n29', date: '2026-10-15', time: '08:00', type: 'transmission', aud: 'admin',   read: false, ref: '', title: 'Compte suspendu détecté', msg: 'Un compte technique est suspendu depuis plus de 90 jours.' }
  ];

  return {
    registryDossier, registryDoc,
    config, statuses, statusOrder, steps, ceremonyStates, medals, medalForYears, docTypes, docStates,
    authorities, regions, transmissionStates, recetteStates, remiseStates, controlStates, recoursStates,
    dtsStates, withdrawalStates, accountStates,
    organisations, users, roles, roleOrder, roleFamilies, permissionLabels, venues, closures,
    seed: { dossiers, documents, dts, distinctions, person: PERSON, ceremonies, notifications, transmissions, receiptOrders, stock, suppliers, purchaseOrders, deliveries, stockMovements, remises, withdrawals, complements, relances, controls, recours, audit, accounts }
  };
})();
