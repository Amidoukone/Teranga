'use strict';

// Parcours de litige enrichi (docs/DEV_SPEC_TERANGA_v4_PHASE0.md §2). Deux endpoints :
// ouverture (client) et mise à jour (admin/master) — la mise à jour couvre à la fois le
// marquage "premier contact" (investigation) et la résolution finale, jamais les deux ensemble
// (voir dispute.schemas.js updateDisputeSchema).

const { Op } = require('sequelize');
const { Service, MissionDispute, Provider } = require('../../models');
const { transitionMissionStatus } = require('../services/missionStatus.service');
const { canAccessGeoResource } = require('../utils/geoScope');
const { getAdminRecipientIds } = require('../services/notification.service');
const { emitEvent } = require('../services/activity.service');
const { recalcProviderBadge } = require('../services/providerBadge.service');
const logger = require('../utils/logger');

const RESOLUTION_TO_STATUS = {
  refund: 'RESOLVED_REFUND',
  redo: 'RESOLVED_REDO',
  closed: 'RESOLVED_CLOSED',
};

/* ============================================================
   GET /api/v1/missions/disputes — admin/master, scope géographique. Par défaut : litiges actifs
   (open/investigating) seulement, pour une file de traitement — ?status=resolved pour l'historique.
   Filtrage en JS via canAccessGeoResource (même pattern que exports.update) plutôt qu'une clause
   SQL sur une table jointe : volume de litiges attendu faible à ce stade, pas besoin d'optimiser.
============================================================ */
exports.list = async (req, res) => {
  try {
    const statusFilter = req.query?.status;
    const where = statusFilter
      ? { status: statusFilter }
      : { status: { [Op.in]: ['open', 'investigating'] } };

    const disputes = await MissionDispute.findAll({
      where,
      include: [
        {
          model: Service,
          as: 'service',
          attributes: ['id', 'title', 'countryId', 'regionId', 'providerId', 'clientId'],
        },
      ],
      order: [['createdAt', 'ASC']],
    });

    const scoped = disputes.filter((d) => d.service && canAccessGeoResource(d.service, req.user));

    return res.status(200).json({ disputes: scoped });
  } catch (e) {
    logger.error({ err: e }, 'dispute.list.failed');
    return res.status(500).json({ error: 'Erreur lors de la récupération des litiges' });
  }
};

/* ============================================================
   POST /api/v1/missions/:id/disputes — ouverture par le client propriétaire, uniquement depuis
   COMPLETED (section 2). Seul point d'entrée vers DISPUTED : la transition générique
   PATCH /:id/status l'exclut désormais (voir mission.controller.js updateStatus).
============================================================ */
exports.create = async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ error: 'Mission introuvable' });

    if (String(service.clientId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Accès interdit pour cette mission' });
    }

    if (service.missionStatus !== 'COMPLETED') {
      return res.status(400).json({
        error: "Un litige ne peut être ouvert que sur une mission au statut 'terminée'",
      });
    }

    const { reason, description, clientEvidence } = req.body;

    const updatedMission = await transitionMissionStatus({
      service,
      toStatus: 'DISPUTED',
      actorType: 'client',
      actorId: req.user.id,
    });

    const dispute = await MissionDispute.create({
      serviceId: service.id,
      openedBy: req.user.id,
      reason,
      description,
      clientEvidence: clientEvidence || null,
    });

    // Accusé de réception + alerte master, synchrones — jamais dépendants du job périodique
    // (docs/DEV_SPEC_TERANGA_v4_PHASE0.md §2.2). Le silence après une réclamation est ce qui
    // détruit la confiance le plus vite (docs/BRAINSTORM_ECOSYSTEME_TERANGA.md §8.2).
    try {
      await emitEvent({
        recipients: [req.user.id],
        actorId: req.user.id,
        entityType: 'service',
        entityId: service.id,
        action: 'dispute_opened',
        title: 'Réclamation bien reçue',
        message: 'Votre réclamation a été enregistrée. Un responsable vous contacte sous 4h.',
        metadata: { disputeId: dispute.id },
        countryId: service.countryId,
        regionId: service.regionId,
        notificationMode: 'create',
      });

      const masters = await getAdminRecipientIds({
        countryId: service.countryId,
        regionId: service.regionId,
      });
      if (masters.length > 0) {
        await emitEvent({
          recipients: masters,
          actorId: req.user.id,
          entityType: 'service',
          entityId: service.id,
          action: 'dispute_opened',
          title: 'Nouveau litige à traiter',
          message: `Litige ouvert sur la mission #${service.id} — premier contact attendu sous 4h.`,
          metadata: { disputeId: dispute.id, reason },
          countryId: service.countryId,
          regionId: service.regionId,
          excludeRecipientId: req.user.id,
          notificationMode: 'create',
        });
      }
    } catch (err) {
      logger.warn('Notification ouverture litige échouée:', err?.message || err);
    }

    return res.status(201).json({ dispute, mission: updatedMission });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    logger.error({ err: e }, 'dispute.create.failed');
    return res.status(500).json({ error: "Erreur lors de l'ouverture du litige" });
  }
};

/* ============================================================
   PATCH /api/v1/missions/:id/disputes/:disputeId — admin/master, scope géographique de la
   mission. status:'investigating' = marque le premier contact ; resolution+resolutionNotes =
   clôt le litige (jamais sans justification écrite, cf. validateur).
============================================================ */
exports.update = async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ error: 'Mission introuvable' });

    if (!canAccessGeoResource(service, req.user)) {
      return res.status(403).json({ error: 'Mission hors scope géographique' });
    }

    const dispute = await MissionDispute.findOne({
      where: { id: req.params.disputeId, serviceId: service.id },
    });
    if (!dispute) return res.status(404).json({ error: 'Litige introuvable' });
    if (dispute.status === 'resolved') {
      return res.status(400).json({ error: 'Ce litige est déjà résolu' });
    }

    const { status, resolution, resolutionNotes } = req.body;

    if (status === 'investigating') {
      await dispute.update({
        status: 'investigating',
        handledBy: req.user.id,
        firstContactAt: dispute.firstContactAt || new Date(),
      });
      return res.status(200).json({ dispute });
    }

    const toStatus = RESOLUTION_TO_STATUS[resolution];
    const updatedMission = await transitionMissionStatus({
      service,
      toStatus,
      actorType: 'admin',
      actorId: req.user.id,
    });

    await dispute.update({
      status: 'resolved',
      resolution,
      resolutionNotes,
      handledBy: req.user.id,
      decidedAt: new Date(),
    });

    // Compteur interne (docs/DEV_SPEC_TERANGA_v4_PHASE0.md §2.3) — jamais pour 'closed' (litige
    // non fondé, ne doit pas pénaliser le prestataire).
    if (['refund', 'redo'].includes(resolution) && service.providerId) {
      try {
        await Provider.increment('disputesAgainstCount', {
          by: 1,
          where: { id: service.providerId },
        });
      } catch (err) {
        logger.warn('Incrément disputesAgainstCount échoué:', err?.message || err);
      }
    }

    // Recalcul du badge (§3.2) dans tous les cas, y compris 'closed' : un litige clos lève aussi
    // le blocage "litige en cours" même quand il n'y a pas de compteur incrémenté.
    if (service.providerId) {
      await recalcProviderBadge(service.providerId);
    }

    try {
      await emitEvent({
        recipients: [dispute.openedBy],
        actorId: req.user.id,
        entityType: 'service',
        entityId: service.id,
        action: 'dispute_resolved',
        title: 'Votre litige a été traité',
        message: resolutionNotes,
        metadata: { disputeId: dispute.id, resolution },
        countryId: service.countryId,
        regionId: service.regionId,
        notificationMode: 'create',
      });
    } catch (err) {
      logger.warn('Notification résolution litige échouée:', err?.message || err);
    }

    return res.status(200).json({ dispute, mission: updatedMission });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    logger.error({ err: e }, 'dispute.update.failed');
    return res.status(500).json({ error: 'Erreur lors du traitement du litige' });
  }
};
