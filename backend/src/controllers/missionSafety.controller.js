'use strict';

const { fn, col } = require('sequelize');
const {
  ExecutorLocation,
  MissionRating,
  MissionShareToken,
  Provider,
  Service,
  TradeCategory,
  Vehicle,
  sequelize,
} = require('../../models');
const { transitionMissionStatus } = require('../services/missionStatus.service');
const { notifyServiceStatusUpdate } = require('../services/serviceNotification.service');
const { recalcProviderBadge } = require('../services/providerBadge.service');
const {
  createMissionShareToken,
  findValidMissionShareToken,
  getMissionStartCode,
  isStartCodeValid,
  resolveAssistancePhone,
  serializeOptionalPosition,
} = require('../services/missionSafety.service');
const { canAccessGeoResource } = require('../utils/geoScope');
const logger = require('../utils/logger');

const RATEABLE_STATUSES = [
  'COMPLETED',
  'VALIDATED',
  'CLOSED',
  'DISPUTED',
  'RESOLVED_REFUND',
  'RESOLVED_REDO',
  'RESOLVED_CLOSED',
];

async function getMobilityService(id) {
  const service = await Service.findByPk(id);
  if (!service) return { service: null, error: 'Mission introuvable', status: 404 };
  const tradeCategory = service.tradeCategoryId
    ? await TradeCategory.findByPk(service.tradeCategoryId, { attributes: ['slug'] })
    : null;
  if (tradeCategory?.slug !== 'mobilite') {
    return { service, error: "Cette mission n'est pas une course Mobilite", status: 400 };
  }
  return { service, tradeCategory };
}

async function findProviderForUser(userId) {
  return Provider.findOne({ where: { userId } });
}

exports.verifyStartCode = async (req, res) => {
  try {
    const result = await getMobilityService(req.params.id);
    if (result.error) return res.status(result.status).json({ error: result.error });
    const { service } = result;
    const provider = await findProviderForUser(req.user.id);
    if (!provider || String(service.providerId) !== String(provider.id)) {
      return res.status(403).json({ error: 'Acces interdit pour cette course' });
    }
    if (service.missionStatus !== 'ON_SITE') {
      return res.status(400).json({ error: "Le code se verifie a l'arrivee du chauffeur" });
    }
    if (service.startAuthorizedAt) {
      return res.status(409).json({ error: 'Le demarrage est deja autorise' });
    }
    if (!isStartCodeValid(service, req.body.code)) {
      logger.warn(
        { serviceId: service.id, providerId: provider.id },
        'mission_safety.start_code.invalid'
      );
      return res.status(400).json({ error: 'Code de demarrage incorrect' });
    }

    const updated = await transitionMissionStatus({
      service,
      toStatus: 'IN_PROGRESS',
      actorType: 'provider',
      actorId: req.user.id,
      extraFields: {
        startAuthorizedAt: new Date(),
        startAuthorizationMethod: 'code',
        startAuthorizedByUserId: req.user.id,
        startOverrideReason: null,
      },
      expectedFields: { providerId: provider.id, startAuthorizedAt: null },
    });
    await notifyServiceStatusUpdate({
      actorId: req.user.id,
      service: updated,
      title: 'Course demarree avec le code client',
      status: updated.status,
    });
    return res.status(200).json({ mission: updated });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    logger.error({ err: error }, 'mission_safety.verify_start_code.failed');
    return res.status(500).json({ error: 'Erreur lors de la verification du code' });
  }
};

exports.overrideStart = async (req, res) => {
  try {
    const result = await getMobilityService(req.params.id);
    if (result.error) return res.status(result.status).json({ error: result.error });
    const { service } = result;
    if (!canAccessGeoResource(service, req.user)) {
      return res.status(403).json({ error: 'Mission hors scope geographique' });
    }
    if (service.missionStatus !== 'ON_SITE') {
      return res.status(400).json({ error: "Le chauffeur doit d'abord etre arrive" });
    }
    if (!service.providerId) {
      return res.status(400).json({ error: 'Aucun chauffeur affecte' });
    }

    const updated = await transitionMissionStatus({
      service,
      toStatus: 'IN_PROGRESS',
      actorType: 'admin',
      actorId: req.user.id,
      extraFields: {
        startAuthorizedAt: new Date(),
        startAuthorizationMethod: 'admin_override',
        startAuthorizedByUserId: req.user.id,
        startOverrideReason: req.body.reason,
      },
      expectedFields: { providerId: service.providerId, startAuthorizedAt: null },
    });
    await notifyServiceStatusUpdate({
      actorId: req.user.id,
      service: updated,
      title: 'Demarrage autorise par Teranga',
      status: updated.status,
    });
    return res.status(200).json({ mission: updated });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    logger.error({ err: error }, 'mission_safety.override_start.failed');
    return res.status(500).json({ error: "Erreur lors de l'autorisation du demarrage" });
  }
};

exports.createShare = async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ error: 'Mission introuvable' });
    if (service.parentServiceId || String(service.clientId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Acces interdit pour cette mission' });
    }
    const { token, record } = await createMissionShareToken({
      serviceId: service.id,
      createdByUserId: req.user.id,
      ttlHours: req.body.ttlHours,
    });
    return res.status(201).json({
      token,
      path: `/ride-share/${token}`,
      expiresAt: record.expiresAt,
    });
  } catch (error) {
    logger.error({ err: error }, 'mission_safety.create_share.failed');
    return res.status(500).json({ error: 'Impossible de creer le lien de partage' });
  }
};

exports.revokeShare = async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ error: 'Mission introuvable' });
    if (String(service.clientId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Acces interdit pour cette mission' });
    }
    await MissionShareToken.update(
      { revokedAt: new Date() },
      { where: { serviceId: service.id, revokedAt: null } }
    );
    return res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'mission_safety.revoke_share.failed');
    return res.status(500).json({ error: 'Impossible de desactiver le partage' });
  }
};

exports.getShared = async (req, res) => {
  try {
    const share = await findValidMissionShareToken(req.params.token);
    if (!share) return res.status(404).json({ error: 'Lien invalide ou expire' });
    const service = await Service.findByPk(share.serviceId);
    if (!service || service.parentServiceId) {
      return res.status(404).json({ error: 'Course introuvable' });
    }
    const [tradeCategory, provider, vehicle, location, assistancePhone] = await Promise.all([
      service.tradeCategoryId
        ? TradeCategory.findByPk(service.tradeCategoryId, { attributes: ['slug'] })
        : null,
      service.providerId ? Provider.findByPk(service.providerId) : null,
      service.vehicleId ? Vehicle.findByPk(service.vehicleId) : null,
      ExecutorLocation.findOne({
        where: { serviceId: service.id },
        order: [['recordedAt', 'DESC']],
      }),
      resolveAssistancePhone(service),
    ]);
    await share.update({ lastAccessedAt: new Date() });
    return res.status(200).json({
      mission: {
        id: service.id,
        title: service.title,
        missionStatus: service.missionStatus,
        tradeCategorySlug: tradeCategory?.slug || null,
        pickupAddress: service.pickupAddress || null,
        destinationAddress: service.address || null,
        provider: provider ? provider.toPublicDTO() : null,
        vehicle: vehicle ? vehicle.toPublicDTO() : null,
        position: serializeOptionalPosition(location),
        realtimeTrackingRequired: false,
        assistancePhone,
      },
      expiresAt: share.expiresAt,
    });
  } catch (error) {
    logger.error({ err: error }, 'mission_safety.get_shared.failed');
    return res.status(500).json({ error: 'Impossible de charger la course partagee' });
  }
};

exports.createRating = async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ error: 'Mission introuvable' });
    if (service.parentServiceId || String(service.clientId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Acces interdit pour cette mission' });
    }
    if (!service.providerId || !RATEABLE_STATUSES.includes(service.missionStatus)) {
      return res.status(400).json({ error: "Cette mission ne peut pas encore etre notee" });
    }

    let rating;
    await sequelize.transaction(async (transaction) => {
      rating = await MissionRating.create(
        {
          serviceId: service.id,
          clientId: req.user.id,
          providerId: service.providerId,
          score: req.body.score,
          comment: req.body.comment || null,
        },
        { transaction }
      );
      const aggregate = await MissionRating.findOne({
        attributes: [[fn('AVG', col('score')), 'average']],
        where: { providerId: service.providerId },
        raw: true,
        transaction,
      });
      await Provider.update(
        { averageRating: Number(aggregate?.average || req.body.score).toFixed(2) },
        { where: { id: service.providerId }, transaction }
      );
    });
    await recalcProviderBadge(service.providerId);
    return res.status(201).json({ rating });
  } catch (error) {
    if (error?.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Cette mission a deja ete notee' });
    }
    logger.error({ err: error }, 'mission_safety.create_rating.failed');
    return res.status(500).json({ error: "Erreur lors de l'enregistrement de la note" });
  }
};
