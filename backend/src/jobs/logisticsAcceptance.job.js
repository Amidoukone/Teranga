'use strict';

// docs/DEV_SPEC_TERANGA_v5_PHASE2.md §5.3 — timeout de la fenêtre d'acceptation dispatch
// mobilité. Cadence dédiée plus courte (1 min) que les jobs Phase 0 (15 min) : une fenêtre de
// 90s vérifiée seulement toutes les 15 min reviendrait en pratique à un timeout de ~15 min.
// `missionStatus: 'ASSIGNED'` dans la requête est une défense en profondeur — updateStatus
// bloque déjà toute progression tant que acceptanceDeadlineAt n'est pas levé (§5.2), donc une
// mission qui a avancé ne devrait jamais avoir de deadline résiduelle, mais on ne veut jamais
// risquer de faire régresser une mission déjà en EN_ROUTE/ON_SITE/IN_PROGRESS.

const cron = require('node-cron');
const { Op } = require('sequelize');
const { Service } = require('../../models');
const { transitionMissionStatus } = require('../services/missionStatus.service');
const { getAdminRecipientIds } = require('../services/notification.service');
const { emitEvent } = require('../services/activity.service');
const logger = require('../utils/logger');

const DEFAULT_CRON_EXPRESSION = '*/1 * * * *';

async function runLogisticsAcceptanceCheck() {
  const overdue = await Service.findAll({
    where: {
      missionStatus: 'ASSIGNED',
      acceptanceDeadlineAt: { [Op.ne]: null, [Op.lt]: new Date() },
    },
  });

  let reassigned = 0;

  for (const service of overdue) {
    try {
      const updated = await transitionMissionStatus({
        service,
        toStatus: 'SEARCHING_EXECUTOR',
        actorType: 'system',
        actorId: null,
        extraFields: { providerId: null, acceptanceDeadlineAt: null },
      });

      const masters = await getAdminRecipientIds({
        countryId: updated.countryId,
        regionId: updated.regionId,
      });
      if (masters.length > 0) {
        await emitEvent({
          recipients: masters,
          entityType: 'service',
          entityId: updated.id,
          action: 'status_updated',
          title: 'Aucune réponse du chauffeur — réaffectation nécessaire',
          message: `Mission #${updated.id} : le chauffeur assigné n'a pas répondu à temps.`,
          countryId: updated.countryId,
          regionId: updated.regionId,
          notificationMode: 'create',
        });
      }
      reassigned += 1;
    } catch (err) {
      logger.error({ err, serviceId: service.id }, 'logisticsAcceptance.job.service_failed');
    }
  }

  if (reassigned > 0) {
    logger.info({ reassigned, checked: overdue.length }, 'logisticsAcceptance.job.completed');
  }

  return { checked: overdue.length, reassigned };
}

let scheduledTask = null;

function startLogisticsAcceptanceJob(cronExpression = DEFAULT_CRON_EXPRESSION) {
  if (scheduledTask) return scheduledTask;

  scheduledTask = cron.schedule(cronExpression, () => {
    runLogisticsAcceptanceCheck().catch((err) => {
      logger.error({ err }, 'logisticsAcceptance.job.run_failed');
    });
  });

  logger.info({ cronExpression }, 'logisticsAcceptance.job.started');
  return scheduledTask;
}

function stopLogisticsAcceptanceJob() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}

module.exports = {
  runLogisticsAcceptanceCheck,
  startLogisticsAcceptanceJob,
  stopLogisticsAcceptanceJob,
};
