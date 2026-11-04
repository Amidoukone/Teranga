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

// Une seule requête pour la dernière transition de chaque mission candidate, au lieu d'une
// requête par mission : ce job tourne toutes les 15 minutes, le nombre de missions actives
// surveillées ne doit pas se traduire par un nombre de requêtes équivalent.
async function loadLastTransitionAtByServiceId(serviceIds) {
  const result = new Map();
  if (!serviceIds.length) return result;
  const rows = await MissionStatusHistory.findAll({
    where: { serviceId: { [Op.in]: serviceIds } },
    attributes: ['serviceId', 'createdAt'],
    order: [['serviceId', 'ASC'], ['createdAt', 'DESC']],
  });
  for (const row of rows) {
    const key = String(row.serviceId);
    if (!result.has(key)) result.set(key, row.createdAt);
  }
  return result;
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
  let skippedNoThreshold = 0;
  const tradeCategoryIdsWithoutThreshold = new Set();

  const tradeCategoryIds = [...new Set(candidates.map((service) => service.tradeCategoryId))];
  const tradeCategories = tradeCategoryIds.length
    ? await TradeCategory.findAll({
        where: { id: { [Op.in]: tradeCategoryIds } },
        attributes: ['id', 'name', 'alertThresholdMinutes'],
      })
    : [];
  const tradeCategoryById = new Map(tradeCategories.map((category) => [String(category.id), category]));
  const lastTransitionAtByServiceId = await loadLastTransitionAtByServiceId(candidates.map((service) => service.id));

  for (const service of candidates) {
    try {
      const tradeCategory = tradeCategoryById.get(String(service.tradeCategoryId));
      if (!tradeCategory?.alertThresholdMinutes) {
        // Filière sans seuil défini : jamais vérifiée. Visible dans le rapport/les logs plutôt
        // que de disparaître silencieusement — une filière mal configurée ne doit pas passer
        // inaperçue indéfiniment.
        skippedNoThreshold += 1;
        tradeCategoryIdsWithoutThreshold.add(String(service.tradeCategoryId));
        continue;
      }

      const lastTransitionAt = lastTransitionAtByServiceId.get(String(service.id));
      const elapsedMinutes = lastTransitionAt === undefined ? null : (Date.now() - new Date(lastTransitionAt).getTime()) / 60000;
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
  if (skippedNoThreshold > 0) {
    logger.warn(
      { skippedNoThreshold, tradeCategoryIds: [...tradeCategoryIdsWithoutThreshold] },
      'missionThresholdCheck.job.trade_category_missing_threshold'
    );
  }

  return {
    checked: candidates.length,
    alertsSent,
    skippedNoThreshold,
    tradeCategoryIdsWithoutThreshold: [...tradeCategoryIdsWithoutThreshold],
  };
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
