'use strict';

/**
 * Machine à états de mission (Teranga v3, DEV_SPEC_TERANGA_v3.md section 2).
 * Source unique de vérité : réutilisée par les migrations (services.missionStatus,
 * mission_status_history.from_status/to_status) et par les modèles Sequelize
 * correspondants, pour éviter que ces ENUM dérivent séparément comme
 * services.status/tasks.status l'ont fait historiquement.
 */
const MISSION_STATUS_VALUES = [
  'CREATED',
  'SEARCHING_EXECUTOR',
  'ASSIGNED',
  'EN_ROUTE',
  'ON_SITE',
  'IN_PROGRESS',
  'COMPLETED',
  'VALIDATED',
  'CLOSED',
  'CANCELLED_BY_CLIENT',
  'NO_EXECUTOR_FOUND',
  'DISPUTED',
  'RESOLVED_REFUND',
  'RESOLVED_REDO',
  'RESOLVED_CLOSED',
];

const MISSION_ACTOR_TYPE_VALUES = ['client', 'agent', 'provider', 'admin', 'system'];

module.exports = {
  // RESOLVED_REDO est volontairement absent : un litige résolu "à refaire" exige encore du
  // travail (ré-exécution), ce n'est pas un dossier clos. Le classer en historique le ferait
  // disparaître des vues actives du client et de l'exécutant comme si le travail était terminé.
  MISSION_HISTORY_STATUSES: ['VALIDATED', 'CLOSED', 'CANCELLED_BY_CLIENT', 'NO_EXECUTOR_FOUND', 'RESOLVED_REFUND', 'RESOLVED_CLOSED'],
  MISSION_STATUS_VALUES,
  MISSION_ACTOR_TYPE_VALUES,
};
