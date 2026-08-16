'use strict';

// docs/DEV_SPEC_TERANGA_v4_PHASE0.md §1.2 — premier scheduler du projet. Tourne dans le process
// backend existant (node-cron, pas de nouveau service Redis/worker à opérer). Alerte le(s)
// master(s) du scope géographique d'une mission dès qu'elle dépasse le seuil d'alerte de sa
// filière, sans notification dupliquée tant que le statut n'a pas changé (thresholdAlertSentAt).

const cron = require('node-cron');
const { Op } = require('sequelize');
const { Service, TradeCategory, MissionStatusHistory } = require('../../models');
const { getAdminRecipientIds } = require('../services/notification.service');
const { emitEvent } = require('../services/activity.service');
const logger = require('../utils/logger');

// Statuts actifs et non terminaux (docs/DEV_SPEC_TERANGA_v4_PHASE0.md §1.2, point 1). Inclut
// volontairement SEARCHING_EXECUTOR (délai de prise en charge), contrairement à ACTIVE_STATUSES
// de missionStatus.service.js qui l'exclut pour une raison différente (validation des pings de
// position).
const MONITORED_STATUSES = [
  'SEARCHING_EXECUTOR',
  'ASSIGNED',
  'EN_ROUTE',
  'ON_SITE',
  'IN_PROGRESS',
];

const DEFAULT_CRON_EXPRESSION = '*/15 * * * *';

async function getElapsedMinutesSinceLastTransition(serviceId) {
  const last = await MissionStatusHistory.findOne({
    where: { serviceId },
    order: [['createdAt', 'DESC']],
  });
  if (!last) return null;
  return (Date.now() - new Date(last.createdAt).getTime()) / 60000;
}

/**
 * Cœur du job — exporté séparément du scheduler pour être testable/exécutable à la demande,
 * sans dépendre de node-cron.
 */
async function runMissionThresholdCheck() {
  const candidates = await Service.findAll({
    where: {
      missionStatus: { [Op.in]: MONITORED_STATUSES },
      tradeCategoryId: { [Op.not]: null },
      thresholdAlertSentAt: null,
    },
    attributes: ['id', 'missionStatus', 'tradeCategoryId', 'countryId', 'regionId'],
  });

  let alertsSent = 0;

  for (const service of candidates) {
    try {
      const tradeCategory = await TradeCategory.findByPk(service.tradeCategoryId, {
        attributes: ['id', 'name', 'alertThresholdMinutes'],
      });
      if (!tradeCategory?.alertThresholdMinutes) continue; // filière sans seuil défini : jamais vérifiée

      const elapsedMinutes = await getElapsedMinutesSinceLastTransition(service.id);
      if (elapsedMinutes === null || elapsedMinutes < tradeCategory.alertThresholdMinutes) continue;

      const recipients = await getAdminRecipientIds({
        countryId: service.countryId,
        regionId: service.regionId,
      });

      if (recipients.length > 0) {
        await emitEvent({
          recipients,
          entityType: 'service',
          entityId: service.id,
          action: 'threshold_alert',
          title: 'Seuil de professionnalisme dépassé',
          message: `Mission #${service.id} (${tradeCategory.name}) bloquée à l'étape ${service.missionStatus} depuis plus de ${tradeCategory.alertThresholdMinutes} min.`,
          metadata: {
            serviceId: service.id,
            missionStatus: service.missionStatus,
            tradeCategoryId: tradeCategory.id,
            alertThresholdMinutes: tradeCategory.alertThresholdMinutes,
          },
          countryId: service.countryId,
          regionId: service.regionId,
          notificationMode: 'create',
        });
      }

      await service.update({ thresholdAlertSentAt: new Date() });
      alertsSent += 1;
    } catch (err) {
      // Une mission en échec ne doit jamais interrompre le traitement des autres.
      logger.error(
        { err, serviceId: service.id },
        'missionThresholdCheck.job.service_failed'
      );
    }
  }

  if (alertsSent > 0) {
    logger.info({ alertsSent, checked: candidates.length }, 'missionThresholdCheck.job.completed');
  }

  return { checked: candidates.length, alertsSent };
}

let scheduledTask = null;

function startMissionThresholdJob(cronExpression = DEFAULT_CRON_EXPRESSION) {
  if (scheduledTask) return scheduledTask;

  scheduledTask = cron.schedule(cronExpression, () => {
    runMissionThresholdCheck().catch((err) => {
      logger.error({ err }, 'missionThresholdCheck.job.run_failed');
    });
  });

  logger.info({ cronExpression }, 'missionThresholdCheck.job.started');
  return scheduledTask;
}

function stopMissionThresholdJob() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}

module.exports = {
  MONITORED_STATUSES,
  runMissionThresholdCheck,
  startMissionThresholdJob,
  stopMissionThresholdJob,
};
