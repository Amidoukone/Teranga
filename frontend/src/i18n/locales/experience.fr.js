const experience = {
  clientHome: {
    greeting: 'Bonjour {{name}}', hint: 'Confiez-nous votre besoin et retrouvez ici sa prise en charge.',
    attention: 'Une réponse est attendue de votre part', active: 'Vos demandes en cours', review: 'Vérifier le résultat',
    empty: 'Vous n’avez aucune autre demande en cours.', all: 'Voir toutes mes demandes', more: 'Vos autres espaces', payments: 'Mes paiements',
    partial: 'Cet aperçu porte sur vos 100 dernières demandes. Ouvrez toutes vos demandes pour consulter la suite.',
  },
  workspace: {
    loadError: 'Impossible de charger votre espace. Réessayez lorsque la connexion revient.',
    management: 'Vos opérations', managementHint: 'Suivez les prises en charge et intervenez sur les demandes bloquées.',
    openOperations: 'Ouvrir la file des opérations', overview: 'Activité du territoire', openOrders: 'Commandes ouvertes', activeTasks: 'Tâches en cours', managementLinks: 'Gestion du territoire',
    overviewError: 'L’aperçu des opérations est incomplet.', financeError: 'Le résumé financier est indisponible.',
    finance: 'Consulter les montants par devise', currencyHint: 'Chaque devise est présentée séparément. Aucun total ne mélange les devises.', noTransactions: 'Aucune transaction enregistrée dans ce périmètre.',
    financeFields: { revenues: 'Recettes', expenses: 'Dépenses', commissions: 'Commissions', adjustments: 'Ajustements', balance: 'Solde' },
  },
  requestProgress: { label: 'Avancement de votre demande', received: 'Reçue', assigned: 'Prise en charge', execution: 'Réalisation', review: 'À vérifier', finished: 'Terminée' },
  fieldWorkspace: {
    title: 'Mon travail', hint: 'Les propositions à accepter et les interventions à poursuivre sont affichées en premier.',
    available: 'Disponible pour de nouvelles demandes', offline: 'Indisponible pour de nouvelles demandes', busy: 'Intervention en cours',
    goAvailable: 'Me rendre disponible', goOffline: 'Me rendre indisponible', duration: 'Pour une durée de', minutes: '{{count}} minutes',
    settings: 'Régler ma capacité de travail', showHistory: 'Voir les demandes terminées', showActive: 'Revenir au travail en cours', supervised: 'Ouvrir mes missions suivies',
    providerHint: 'Votre disponibilité autorise de nouvelles propositions dans votre périmètre.',
  },
  requestDraft: {
    clear: 'Effacer cette saisie et recommencer',
    restored: 'Votre saisie précédente a été retrouvée dans cet onglet. Choisissez le service puis vérifiez les informations avant l’envoi.',
    retryAttachments: 'Renvoyer les pièces jointes uniquement',
    createdSessionFailed: 'Votre demande est bien créée. Notez sa référence ; reconnectez-vous pour retrouver son suivi.',
  },
  requestHelp: {
    email: 'Écrire au support Teranga',
    title: 'Besoin d’aide ?', hint: 'Retrouvez une demande ou contactez l’équipe qui peut vous accompagner.',
    reference: 'Demande #{{id}} — indiquez cette référence à l’équipe.', message: 'Bonjour Teranga, j’ai besoin d’aide pour la demande #{{id}} : {{title}}.',
    call: 'Appeler l’équipe locale', whatsapp: 'Écrire avec la référence', options: 'Aide pour cette demande',
    missing: 'Le contact local n’est pas renseigné. Consultez votre demande ou votre espace pour retrouver votre interlocuteur.',
    loadError: 'Cette demande est indisponible ou n’est pas accessible avec votre compte.', contact: 'Joindre votre équipe', findRequest: 'Retrouver mes demandes', resources: 'Informations utiles',
  },
  operationsOverview: {
    all: 'Tous les dossiers', limit: 'Aperçu des 25 premiers dossiers de chaque type. Sélectionnez un type pour consulter toutes ses pages.',
    partial: 'Chargement incomplet : {{types}}. Les autres dossiers restent consultables ; actualisez pour réessayer.',
  },
  requestAmounts: {
    title: 'Prix et règlement', estimate: 'Montant de référence', agreed: 'Prix convenu', paid: 'Règlements justifiés enregistrés', remaining: 'Reste à payer',
    toConfirm: 'À confirmer avec Teranga', unknown: 'Non calculé sans prix convenu confirmé', unavailable: 'Règlements indisponibles pour le moment',
    note: 'Un montant de référence ne vaut pas confirmation du prix ni du paiement.',
  },
};
export default experience;
