'use strict';

// Machine à états de mission (docs/DEV_SPEC_TERANGA_v3.md section 2). Source unique de vérité
// pour les transitions valides + la synchronisation vers services.status legacy (décision 0.6.b).
// N'écrit jamais services.status en dehors de ce mapping — services.status/tasks.status ne
// doivent pas être touchés autrement (section 8).

const { sequelize, MissionStatusHistory } = require('../../models');

// Graphe de transitions valides (section 2). Les statuts absents de cet objet (CLOSED,
// CANCELLED_BY_CLIENT, NO_EXECUTOR_FOUND, RESOLVED_*) sont terminaux dans ce lot.
const TRANSITIONS = {
  CREATED: ['SEARCHING_EXECUTOR'],
  SEARCHING_EXECUTOR: ['ASSIGNED', 'NO_EXECUTOR_FOUND'],
  // 'SEARCHING_EXECUTOR' ajouté depuis ASSIGNED/EN_ROUTE (additif) : seule arête retour, pour
  // journaliser la désassignation complète d'un exécutant (admin), voir mission.controller.js
  // exports.assign.
  ASSIGNED: ['EN_ROUTE', 'CANCELLED_BY_CLIENT', 'SEARCHING_EXECUTOR'],
  EN_ROUTE: ['ON_SITE', 'CANCELLED_BY_CLIENT', 'SEARCHING_EXECUTOR'],
  ON_SITE: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: ['VALIDATED', 'DISPUTED'],
  VALIDATED: ['CLOSED'],
  DISPUTED: ['RESOLVED_REFUND', 'RESOLVED_REDO', 'RESOLVED_CLOSED'],
};

// Mapping exact décision 0.6.b — statuts absents (branches annulation/litige) : services.status
// reste figé à sa dernière valeur connue, jamais réinitialisé.
const LEGACY_STATUS_MAP = {
  CREATED: 'created',
  SEARCHING_EXECUTOR: 'created',
  ASSIGNED: 'in_progress',
  EN_ROUTE: 'in_progress',
  ON_SITE: 'in_progress',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  VALIDATED: 'validated',
  CLOSED: 'validated',
};

// Statuts pendant lesquels une mission est "active" (assignée, en cours d'exécution) — utile
// pour valider les pings de position (section 8 : jamais avant/après la fenêtre d'exécution).
const ACTIVE_STATUSES = ['ASSIGNED', 'EN_ROUTE', 'ON_SITE', 'IN_PROGRESS'];

function isValidTransition(fromStatus, toStatus) {
  return Boolean(TRANSITIONS[fromStatus]?.includes(toStatus));
}

/**
 * Transition atomique : met à jour services.missionStatus (+ services.status si mappé) et insère
 * une ligne mission_status_history, dans une seule transaction (exigence section 2).
 *
 * @param {object} params
 * @param {import('sequelize').Model} params.service - instance Service déjà chargée
 * @param {string} params.toStatus - un des MISSION_STATUS_VALUES
 * @param {string} params.actorType - 'client'|'agent'|'provider'|'admin'|'system'
 * @param {number|null} params.actorId
 * @param {object} [params.extraFields] - champs additionnels à écrire dans la même transaction
 *   (ex. { providerId } lors d'une assignation)
 */
async function transitionMissionStatus({ service, toStatus, actorType, actorId, extraFields = {} }) {
  const fromStatus = service.missionStatus;

  if (!fromStatus) {
    throw Object.assign(
      new Error("Cette mission n'utilise pas le suivi de statut (flux classique agent)"),
      { status: 400 }
    );
  }

  if (!isValidTransition(fromStatus, toStatus)) {
    throw Object.assign(
      new Error(`Transition invalide : ${fromStatus} -> ${toStatus}`),
      { status: 400 }
    );
  }

  const legacyStatus = LEGACY_STATUS_MAP[toStatus];

  return sequelize.transaction(async (t) => {
    await service.update(
      {
        missionStatus: toStatus,
        ...(legacyStatus ? { status: legacyStatus } : {}),
        ...extraFields,
      },
      { transaction: t }
    );

    await MissionStatusHistory.create(
      {
        serviceId: service.id,
        fromStatus,
        toStatus,
        actorType,
        actorId: actorId ?? null,
      },
      { transaction: t }
    );

    return service;
  });
}

module.exports = {
  TRANSITIONS,
  LEGACY_STATUS_MAP,
  ACTIVE_STATUSES,
  isValidTransition,
  transitionMissionStatus,
};
