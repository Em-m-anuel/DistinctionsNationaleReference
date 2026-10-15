/* ==========================================================================
   GAB-ORIENT — Jeu de données de référence
   --------------------------------------------------------------------------
   Toutes les données affichées par le prototype proviennent de ce fichier.
   Pour brancher l'application sur une API réelle, remplacer `seed` par les
   réponses des services et conserver les mêmes formes d'objets.
   Les dictionnaires (statuts, médailles, rôles, lieux) sont des données de
   configuration à valider par le Service des Distinctions.
   ========================================================================== */
window.GO_DATA = (function () {
  'use strict';

  /* ---------- Configuration ---------- */
  const config = {
    // Date de référence utilisée comme « aujourd'hui » pour que les données
    // restent cohérentes. En production : new Date().
    referenceDate: '2026-10-15',
    dataVersion: '2026.10-r3',
    upload: { maxMb: 10, accept: ['application/pdf', 'image/jpeg', 'image/png'], acceptLabel: 'PDF, JPG ou PNG' },
    map: {
      // Fournisseur cartographique : Leaflet + tuiles OpenStreetMap.
      // En production, utiliser un fournisseur de tuiles disposant d'un contrat
      // de service (la politique d'usage des tuiles OSM publiques est limitée).
      tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; contributeurs OpenStreetMap',
      center: [-0.75, 11.5],
      zoom: 6
    }
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

  // Libellés de médailles : à aligner sur la nomenclature officielle.
  const medals = [
    { id: 'argent',   label: 'Médaille d’honneur du travail — Argent',   short: 'Argent' },
    { id: 'vermeil',  label: 'Médaille d’honneur du travail — Vermeil',  short: 'Vermeil' },
    { id: 'or',       label: 'Médaille d’honneur du travail — Or',       short: 'Or' },
    { id: 'grand-or', label: 'Médaille d’honneur du travail — Grand or', short: 'Grand or' }
  ];

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
    u1: { name: 'Joséphine Mba-Ondo', initials: 'JM', title: 'Chef du Service des Distinctions', unit: 'Service des Distinctions nationales', email: 'j.mbaondo@distinctions.gouv.ga' },
    u2: { name: 'Landry Moussavou',  initials: 'LM', title: 'Agent instructeur', unit: 'Service des Distinctions nationales', email: 'l.moussavou@distinctions.gouv.ga' },
    u3: { name: 'Hervé Nguema',      initials: 'HN', title: 'Directeur des ressources humaines', unit: 'Okoumé Énergie SA', email: 'rh@okoume-energie.ga' }
  };

  // Profils disponibles dans l'échantillon. `views` = entrées de navigation,
  // `can` = actions autorisées, `scope` = organisme dont les dossiers sont visibles.
  const roles = {
    chef: {
      label: 'Chef du Service des Distinctions', user: 'u1', scope: null,
      views: ['apercu', 'dossiers', 'courriers', 'ceremonies', 'statistiques', 'notifications'],
      can: { create: true, instruct: true, complement: true, relance: true, note: true, transmit: true, visa: true, decide: true, propose: true, coordinate: true, observe: true }
    },
    agent: {
      label: 'Agent du Service des Distinctions', user: 'u2', scope: null,
      views: ['apercu', 'dossiers', 'courriers', 'ceremonies', 'notifications'],
      can: { create: true, instruct: true, complement: true, relance: true, note: true, propose: true, observe: true }
    },
    demandeur: {
      label: 'Entreprise demandeur', user: 'u3', scope: 'o1',
      views: ['apercu', 'dossiers', 'courriers', 'ceremonies', 'notifications'],
      can: { create: true, answer: true, propose: true }
    }
  };
  const permissionLabels = {
    create: 'Créer un dossier', instruct: 'Ouvrir l’instruction', complement: 'Demander un complément',
    relance: 'Relancer un demandeur', note: 'Préparer une note de transmission', transmit: 'Transmettre à la hiérarchie',
    visa: 'Apposer un visa interne', decide: 'Enregistrer une décision', propose: 'Proposer une cérémonie',
    coordinate: 'Coordonner les cérémonies', observe: 'Ajouter des observations', answer: 'Déposer un complément'
  };

  // Lieux de cérémonie. Coordonnées indicatives, à vérifier avant mise en service.
  // Aucune photographie n'est fournie : l'interface affiche un emplacement réservé.
  const venues = [
    { id: 'v1', name: 'Cité de la Démocratie', city: 'Libreville', province: 'Estuaire', kind: 'Centre de conférences', capacity: 800, lat: 0.4515, lng: 9.4120, address: 'Quartier Cité de la Démocratie, Libreville', features: ['Sonorisation', 'Salle protocolaire', 'Parking'] },
    { id: 'v2', name: 'Hôtel de Ville de Libreville', city: 'Libreville', province: 'Estuaire', kind: 'Mairie', capacity: 300, lat: 0.3921, lng: 9.4537, address: 'Boulevard de l’Indépendance, Libreville', features: ['Salle des fêtes', 'Accès PMR'] },
    { id: 'v3', name: 'Salle polyvalente du Ministère du Travail', city: 'Libreville', province: 'Estuaire', kind: 'Administration', capacity: 150, lat: 0.4012, lng: 9.4470, address: 'Centre-ville, Libreville', features: ['Salle de réunion', 'Vidéoprojection'] },
    { id: 'v4', name: 'Hôtel de Ville de Port-Gentil', city: 'Port-Gentil', province: 'Ogooué-Maritime', kind: 'Mairie', capacity: 250, lat: -0.7193, lng: 8.7815, address: 'Centre-ville, Port-Gentil', features: ['Salle des fêtes', 'Sonorisation'] },
    { id: 'v5', name: 'Gouvernorat de la Ngounié', city: 'Mouila', province: 'Ngounié', kind: 'Gouvernorat', capacity: 200, lat: -1.8667, lng: 11.0556, address: 'Mouila', features: ['Salle protocolaire'] },
    { id: 'v6', name: 'Gouvernorat du Moyen-Ogooué', city: 'Lambaréné', province: 'Moyen-Ogooué', kind: 'Gouvernorat', capacity: 180, lat: -0.7001, lng: 10.2406, address: 'Lambaréné', features: ['Salle protocolaire', 'Parking'] },
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
      const years = 15 + ((n * 13 + i * 7) % 22);
      const month = 1 + ((n * 5 + i * 3) % 12);
      const day = 1 + ((n * 7 + i * 11) % 27);
      const medal = years < 20 ? 'argent' : years < 25 ? 'vermeil' : years < 30 ? 'or' : 'grand-or';
      out.push({
        id: ref + '-R' + (i + 1),
        nom: NOMS[(n * 7 + i * 5) % NOMS.length],
        prenom: PRENOMS[(n * 3 + i * 11) % PRENOMS.length],
        fonction: FONCTIONS[(n * 2 + i * 5) % FONCTIONS.length],
        entree: (2026 - years) + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0'),
        medal
      });
    }
    return out;
  }

  /* ---------- Dossiers ----------
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
      ['2026-10-15', '08:12', 'SEC', 'reception', 'Courrier enregistré par le secrétariat']] }
  ];

  const ACTOR = { SEC: 'Secrétariat du Service', SDN: 'Service des Distinctions', CHEF: 'Chef du Service', DG: 'Direction générale', AUT: 'Autorité compétente' };
  const orgById = id => organisations.find(o => o.id === id);

  const dossiers = D.map(x => {
    const ref = 'DNG-2026-' + String(x.n).padStart(3, '0');
    const org = orgById(x.org);
    return {
      ref, org: x.org, depot: x.depot, status: x.status, agent: x.agent,
      complementSince: x.complementSince || null,
      recipients: recipients(ref, x.n, x.count),
      history: x.history.map(h => ({ date: h[0], time: h[1], actor: h[2] === 'ORG' ? org.name : ACTOR[h[2]], kind: h[3], label: h[4] })),
      observations: (x.observations || []).map(o => ({ date: o[0], author: ACTOR[o[1]], text: o[2] }))
    };
  });

  /* ---------- Courriers et documents ---------- */
  const documents = [
    { id: 'd1',  dossier: 'DNG-2026-006', kind: 'demande',      type: 'entrant',  title: 'Courrier de transmission des propositions', date: '2026-04-02', from: 'Secrétariat général — Ministère de la Santé', state: 'enregistre', pages: 2, number: 'N° 0412/MS/SG' },
    { id: 'd2',  dossier: 'DNG-2026-006', kind: 'liste',        type: 'piece',    title: 'Liste nominative des récipiendaires', date: '2026-04-02', from: 'Ministère de la Santé', state: 'enregistre', pages: 1 },
    { id: 'd3',  dossier: 'DNG-2026-006', kind: 'transmission', type: 'note',     title: 'Note de transmission au Directeur général', date: '2026-09-15', from: 'Chef du Service des Distinctions', state: 'vise', pages: 1, internal: true, number: 'N° 118/SDN', visa: { by: 'Joséphine Mba-Ondo', role: 'Chef du Service des Distinctions', date: '2026-09-17', time: '17:40' } },
    { id: 'd4',  dossier: 'DNG-2026-005', kind: 'demande',      type: 'entrant',  title: 'Demande d’attribution de médailles', date: '2026-03-16', from: 'Compagnie Forestière de l’Ogooué', state: 'enregistre', pages: 2, number: 'Réf. CFO/RH/2026-031' },
    { id: 'd5',  dossier: 'DNG-2026-005', kind: 'transmission', type: 'note',     title: 'Note de transmission au Directeur général', date: '2026-08-28', from: 'Chef du Service des Distinctions', state: 'vise', pages: 1, internal: true, number: 'N° 104/SDN', visa: { by: 'Joséphine Mba-Ondo', role: 'Chef du Service des Distinctions', date: '2026-09-02', time: '09:20' } },
    { id: 'd6',  dossier: 'DNG-2026-008', kind: 'complement',   type: 'sortant',  title: 'Demande de complément', date: '2026-09-29', from: 'Service des Distinctions', state: 'envoye', pages: 1, number: 'N° 122/SDN', request: 'Attestations d’ancienneté lisibles pour les quatre récipiendaires proposés.' },
    { id: 'd7',  dossier: 'DNG-2026-008', kind: 'attestations', type: 'piece',    title: 'Attestations d’ancienneté', date: '2026-05-07', from: 'Ciments du Komo', state: 'illisible', pages: 4 },
    { id: 'd8',  dossier: 'DNG-2026-007', kind: 'decision',     type: 'decision', title: 'Décision d’attribution', date: '2026-08-24', from: 'Autorité compétente', state: 'enregistre', pages: 1, number: 'Décision n° 2026-077' },
    { id: 'd9',  dossier: 'DNG-2026-009', kind: 'demande',      type: 'entrant',  title: 'Demande d’attribution de médailles', date: '2026-05-26', from: 'Okoumé Énergie SA', state: 'enregistre', pages: 2, number: 'Réf. OE/DRH/2026-058' },
    { id: 'd10', dossier: 'DNG-2026-009', kind: 'transmission', type: 'note',     title: 'Note de transmission au Directeur général', date: '2026-10-13', from: 'Service des Distinctions', state: 'attente_visa', pages: 1, internal: true, number: 'N° 131/SDN' },
    { id: 'd11', dossier: 'DNG-2026-018', kind: 'demande',      type: 'entrant',  title: 'Demande d’attribution de médailles', date: '2026-10-14', from: 'Compagnie Forestière de l’Ogooué', state: 'enregistre', pages: 2, number: 'Réf. CFO/RH/2026-112' },
    { id: 'd12', dossier: 'DNG-2026-002', kind: 'convocation',  type: 'sortant',  title: 'Convocation à la cérémonie de remise', date: '2026-10-07', from: 'Service des Distinctions', state: 'envoye', pages: 1, number: 'N° 127/SDN' },
    { id: 'd13', dossier: 'DNG-2026-012', kind: 'complement',   type: 'sortant',  title: 'Demande de complément', date: '2026-09-10', from: 'Service des Distinctions', state: 'envoye', pages: 1, number: 'N° 115/SDN', request: 'Liste nominative signée par l’autorité du ministère demandeur.' },
    { id: 'd14', dossier: 'DNG-2026-016', kind: 'demande',      type: 'entrant',  title: 'Demande d’attribution de médailles', date: '2026-10-01', from: 'Banque Équatoriale de Crédit', state: 'enregistre', pages: 2, number: 'Réf. BEC/DCH/2026-204' },
    { id: 'd15', dossier: 'DNG-2026-013', kind: 'transmission', type: 'note',     title: 'Note de transmission au Directeur général', date: '2026-10-10', from: 'Service des Distinctions', state: 'attente_visa', pages: 1, internal: true, number: 'N° 129/SDN' },
    { id: 'd16', dossier: 'DNG-2026-017', kind: 'demande',      type: 'entrant',  title: 'Demande d’attribution de médailles', date: '2026-10-08', from: 'Okoumé Énergie SA', state: 'enregistre', pages: 2, number: 'Réf. OE/DRH/2026-097' },
    { id: 'd17', dossier: 'DNG-2026-014', kind: 'complement',   type: 'sortant',  title: 'Demande de complément', date: '2026-10-02', from: 'Service des Distinctions', state: 'envoye', pages: 1, number: 'N° 124/SDN', request: 'Certificats de travail des trois récipiendaires.' }
  ];

  /* ---------- Cérémonies ---------- */
  const ceremonies = [
    { id: 'CER-2026-01', dossier: 'DNG-2026-001', date: '2026-07-09', time: '10:00', venue: 'v4', state: 'termine' },
    { id: 'CER-2026-02', dossier: 'DNG-2026-002', date: '2026-10-22', time: '10:00', venue: 'v1', state: 'confirme', validation: 'Confirmation du 6 octobre 2026' },
    { id: 'CER-2026-03', dossier: 'DNG-2026-004', date: '2026-11-12', time: '15:00', venue: 'v2', state: 'negociation', note: 'Le lieu propose le 13 novembre en alternative.' },
    { id: 'CER-2026-04', dossier: 'DNG-2026-007', date: '2026-11-26', time: '10:30', venue: 'v5', state: 'propose' },
    { id: 'CER-2026-05', dossier: 'DNG-2026-010', date: '2026-10-22', time: '15:00', venue: 'v1', state: 'conflit', note: 'Le lieu est déjà réservé ce jour pour CER-2026-02.' }
  ];

  /* ---------- Notifications ----------
     aud : 'service' (Service des Distinctions) ou 'org:<id>' (demandeur)   */
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
    { id: 'n13', date: '2026-07-09', time: '12:40', type: 'ceremonie',    aud: 'org:o1',  read: true,  ref: 'DNG-2026-001', title: 'Cérémonie effectuée', msg: 'La remise des médailles a eu lieu à l’Hôtel de Ville de Port-Gentil.' }
  ];

  return {
    config, statuses, statusOrder, steps, ceremonyStates, medals, docTypes, docStates,
    organisations, users, roles, permissionLabels, venues, closures,
    seed: { dossiers, documents, ceremonies, notifications }
  };
})();
