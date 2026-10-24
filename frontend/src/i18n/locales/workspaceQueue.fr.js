const workspaceQueue = {
  action: 'À faire', following: 'À suivre', information: 'Informations',
  hint: 'Vos dossiers, la prochaine action et les informations utiles, au même endroit.',
  search: 'Rechercher un dossier, une étape ou une référence', find: 'Rechercher', kind: 'Type de dossier', all: 'Tous les types',
  kinds: { service: 'Services', project: 'Projets', order: 'Commandes', task: 'Interventions' },
  loading: 'Chargement de votre travail…', failed: 'La file de travail est indisponible. Vos informations restent accessibles.',
  emptyAction: 'Aucune action pour le moment', emptyFollowing: 'Aucun dossier à suivre pour le moment', emptyFiltered: 'Aucun dossier ne correspond à cette recherche.',
  emptyHint: 'Consultez les autres vues pour retrouver le travail en cours et les informations reçues.',
  steps: '{{count}} étape(s) à suivre', actionSteps: '{{count}} étape(s) vous attendent', deadline: 'Prochaine échéance', open: 'Ouvrir le dossier',
  actions: { result_review: 'Vérifier le résultat', coordinate: 'Organiser la prise en charge', resolve: 'Examiner le problème', service_execute: 'Continuer la réalisation', project_execute: 'Continuer le projet', order_execute: 'Continuer la commande', step_start: 'Commencer une étape', step_complete: 'Continuer une étape', step_review: 'Contrôler une étape', step_assign: 'Affecter une étape' },
  reasons: { result_review: 'Le résultat vous a été remis. Consultez les justificatifs avant de confirmer.', coordinate: 'Ce dossier nécessite votre prise en charge ou un ajustement de coordination.', resolve: 'Un problème attend une décision du responsable.', service_execute: 'Le travail vous est confié. Ouvrez le dossier pour réaliser la prochaine étape.', project_execute: 'Retrouvez les phases, documents et actions de ce projet.', order_execute: 'Retrouvez les actions de préparation, d’expédition ou de remise.', step_start: 'Une étape vous est affectée et peut être commencée.', step_complete: 'Une étape de ce dossier est en cours de réalisation.', step_review: 'Une étape terminée attend votre contrôle administratif.', step_assign: 'Une étape attend le choix de son intervenant.' },
  waitingClient: 'En attente de la confirmation du client.', waitingReview: 'La réalisation attend le contrôle du responsable.', waitingTeam: 'Le dossier avance avec les autres intervenants. Aucune action ne vous est demandée pour le moment.', waitingSteps: 'Des étapes de ce dossier restent à suivre.',
  coordinationTools: 'Outils de coordination', back: 'Retour à la file', reading: 'Afficher les informations', unreadOnly: 'À lire', allInformation: 'Tout le suivi',
  taskTitle: 'Intervention #{{id}}', taskHint: 'Réalisez et documentez cette intervention dans cet espace.', taskFailed: 'Cette intervention est indisponible dans vos accès.', taskSaved: 'Intervention enregistrée.',
  focusedCase: 'Dossier #{{id}}', allProblems: 'Tous les problèmes',
};
export default workspaceQueue;
