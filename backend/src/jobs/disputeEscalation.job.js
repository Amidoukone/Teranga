'use strict';

// docs/DEV_SPEC_TERANGA_v4_PHASE0.md §2.2 — relances et escalade temporisées d'un litige.
// Tourne dans le même process que missionThresholdCheck.job.js (node-cron), même cadence.
// Ne bloque jamais rien, se contente de notifier — chaque relance a sa propre colonne
// d'idempotence pour ne jamais renvoyer la même alerte à chaque passage du job.

const cron = require('node-cron');
const { Op } = require('sequelize');
const { MissionDispute, Service, User } = require('../../models');
const { getAdminRecipientIds } = require('../services/notification.service');
const { emitEvent } = require('../services/activity.service');
const logger = require('../utils/logger');

const FIRST_CONTACT_THRESHOLD_HOURS = 4;
const UPDATE_REMINDER_THRESHOLD_HOURS = 24;
const ESCALATION_THRESHOLD_HOURS = 48;
const DEFAULT_CRON_EXPRESSION = '*/15 * * * *';

function hoursSince(date) {
  return (Date.now() - new Date(date).getTime()) / (60 * 60 * 1000);
}

// Escalade "vers le haut" (docs/DEV_SPEC_TERANGA_v4_PHASE0.md §2.2, point escalade) — le master
// régional a déjà été alerté et n'a pas agi, l'escalade doit sauter par-dessus lui plutôt que de
// le renotifier : admins scopés pays (regionId NULL) + admin global uniquement, pas
// getAdminRecipientIds() qui inclurait de nouveau le master régional.
async function getCountryAndGlobalAdminIds({ countryId }) {
  const admins = await User.findAll({
    where: {
      role: 'admin',
      [Op.or]: [
        { countryId: null, regionId: null },
        ...(countryId ? [{ countryId, regionId: null }] : []),
      ],
    },
    attributes: ['id'],
  });
  return admins.map((u) => u.id);
}

async function runDisputeEscalationCheck() {
  const activeDisputes = await MissionDispute.findAll({
    where: { status: { [Op.in]: ['open', 'investigating'] } },
    include: [{ model: Service, as: 'service', attributes: ['id', 'countryId', 'regionId'] }],
  });

  const stats = { firstContactReminders: 0, updateReminders: 0, escalations: 0 };

  for (const dispute of activeDisputes) {
    try {
      const service = dispute.service;
      if (!service) continue; // mission supprimée entre-temps — ne jamais planter le job pour ça

      const elapsedHours = hoursSince(dispute.createdAt);

      // 1) Pas de premier contact après 4h
      if (
        dispute.status === 'open' &&
        !dispute.firstContactAt &&
        !dispute.firstContactReminderSentAt &&
        elapsedHours >= FIRST_CONTACT_THRESHOLD_HOURS
      ) {
        const masters = await getAdminRecipientIds({
          countryId: service.countryId,
          regionId: service.regionId,
        });
        if (masters.length > 0) {
          await emitEvent({
            recipients: masters,
            entityType: 'service',
            entityId: service.id,
            action: 'dispute_update',
            title: 'Litige sans premier contact',
            message: `Litige #${dispute.id} (mission #${service.id}) ouvert depuis plus de ${FIRST_CONTACT_THRESHOLD_HOURS}h sans premier contact client.`,
            metadata: { disputeId: dispute.id },
            countryId: service.countryId,
            regionId: service.regionId,
            notificationMode: 'create',
          });
        }
        await dispute.update({ firstContactReminderSentAt: new Date() });
        stats.firstContactReminders += 1;
      }

      // 2) Toujours pas décidé après 24h — le client ne doit jamais rester sans nouvelle
      if (
        !dispute.decidedAt &&
        !dispute.updateReminderSentAt &&
        elapsedHours >= UPDATE_REMINDER_THRESHOLD_HOURS
      ) {
        await emitEvent({
          recipients: [dispute.openedBy],
          entityType: 'service',
          entityId: service.id,
          action: 'dispute_update',
          title: 'Votre litige est toujours en cours de traitement',
          message: 'Nous vérifions encore votre réclamation, merci de votre patience.',
          metadata: { disputeId: dispute.id },
          countryId: service.countryId,
          regionId: service.regionId,
          notificationMode: 'create',
        });
        await dispute.update({ updateReminderSentAt: new Date() });
        stats.updateReminders += 1;
      }

      // 3) Escalade automatique après 48h — seule exception au principe d'un seul niveau
      // d'alerte (docs/BRAINSTORM_ECOSYSTEME_TERANGA.md §8.2, point 8).
      if (!dispute.escalatedAt && elapsedHours >= ESCALATION_THRESHOLD_HOURS) {
        const escalationRecipients = await getCountryAndGlobalAdminIds({
          countryId: service.countryId,
        });
        if (escalationRecipients.length > 0) {
          await emitEvent({
            recipients: escalationRecipients,
            entityType: 'service',
            entityId: service.id,
            action: 'dispute_escalated',
            title: 'Litige non traité après 48h — escalade',
            message: `Litige #${dispute.id} (mission #${service.id}) toujours non résolu après ${ESCALATION_THRESHOLD_HOURS}h.`,
            metadata: { disputeId: dispute.id },
            countryId: service.countryId,
            regionId: null,
            notificationMode: 'create',
          });
        }
        await dispute.update({ escalatedAt: new Date() });
        stats.escalations += 1;
      }
    } catch (err) {
      logger.error({ err, disputeId: dispute.id }, 'disputeEscalation.job.dispute_failed');
    }
  }

  if (stats.firstContactReminders || stats.updateReminders || stats.escalations) {
    logger.info({ ...stats, checked: activeDisputes.length }, 'disputeEscalation.job.completed');
  }

  return { checked: activeDisputes.length, ...stats };
}

let scheduledTask = null;

function startDisputeEscalationJob(cronExpression = DEFAULT_CRON_EXPRESSION) {
  if (scheduledTask) return scheduledTask;

  scheduledTask = cron.schedule(cronExpression, () => {
    runDisputeEscalationCheck().catch((err) => {
      logger.error({ err }, 'disputeEscalation.job.run_failed');
    });
  });

  logger.info({ cronExpression }, 'disputeEscalation.job.started');
  return scheduledTask;
}

function stopDisputeEscalationJob() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}

module.exports = {
  runDisputeEscalationCheck,
  startDisputeEscalationJob,
  stopDisputeEscalationJob,
};
