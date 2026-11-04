const roleViews = {
  home: { client: 'Mon suivi', agent: 'Mon travail', provider: 'Mon activité', admin: 'Pilotage' },
  search: 'Rechercher', all: 'Tous',
  availability: { available: 'Disponible', offline: 'Indisponible', busy: 'En intervention' },
  backSupervised: 'Retour aux missions supervisées', backAssigned: 'Retour aux services confiés',
  backDossier: 'Retour au dossier',
  agentServices: 'Services confiés', supervised: 'Missions supervisées',
  supervise: 'Superviser le dossier', supervisedHint: 'Suivez les interventions des prestataires que vous supervisez.',
  availabilityHelp: 'Options de disponibilité', backHome: 'Retour à l’accueil',
  clientHint: 'Retrouvez vos demandes et les résultats à confirmer.',
  providerHint: 'Retrouvez vos offres, vos interventions et leurs justificatifs.',
  agentHint: 'Ouvrez un service confié pour intervenir et rendre compte.',
  managementHint: 'Coordonnez les demandes et retrouvez les outils de votre périmètre.',
};
export default roleViews;
