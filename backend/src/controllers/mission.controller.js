'use strict';

// Création de mission guidée, utilisateur déjà authentifié (docs/DEV_SPEC_TERANGA_v3.md
// section 4.1 + 3.3). Distinct de missionRequest.controller.js (point d'entrée invité de la
// homepage, Lot 2) : ici pas de bootstrap de compte, le client a déjà une session.

const { Service, User, TradeCategory, SavedLocation, Evidence, Provider, ExecutorLocation } = require('../../models');
const { geocodeAddress } = require('../services/geocoding.service');
const { getDistanceMatrix } = require('../services/distanceMatrix.service');
const { estimateMission } = require('../services/priceEstimate.service');
const {
  transitionMissionStatus,
  ACTIVE_STATUSES,
} = require('../services/missionStatus.service');
const { notifyServiceCreated, notifyServiceStatusUpdate } = require('../services/serviceNotification.service');
const mediaUpload = require('../services/mediaUpload.service');
const { canAccessGeoResource } = require('../utils/geoScope');
const logger = require('../utils/logger');

const MISSION_ATTACHMENT_LOCAL_FALLBACK_ENV_VAR = 'MISSION_ATTACHMENT_ALLOW_LOCAL_FALLBACK';
const MISSION_ATTACHMENT_STORAGE_ERROR_CODE = 'MISSION_ATTACHMENT_STORAGE_UNAVAILABLE';

// Libellés courts pour les notifications de transition (section 4.2/2).
const MISSION_STATUS_LABELS = {
  SEARCHING_EXECUTOR: 'Recherche d’un exécutant',
  ASSIGNED: 'Mission assignée',
  EN_ROUTE: 'Exécutant en route',
  ON_SITE: 'Exécutant arrivé sur place',
  IN_PROGRESS: 'Mission en cours',
  COMPLETED: 'Mission terminée',
  VALIDATED: 'Mission validée',
  CLOSED: 'Mission clôturée',
  CANCELLED_BY_CLIENT: 'Mission annulée par le client',
  NO_EXECUTOR_FOUND: 'Aucun exécutant trouvé',
  DISPUTED: 'Litige ouvert',
  RESOLVED_REFUND: 'Litige résolu (remboursement)',
  RESOLVED_REDO: 'Litige résolu (reprise)',
  RESOLVED_CLOSED: 'Litige clôturé',
};

// Transitions que le client propriétaire peut déclencher lui-même (section 2).
const CLIENT_TRIGGERABLE = ['CANCELLED_BY_CLIENT', 'VALIDATED'];
// Transitions que l'exécutant assigné (agent ou prestataire) peut déclencher (section 2).
const EXECUTOR_TRIGGERABLE = ['EN_ROUTE', 'ON_SITE', 'IN_PROGRESS', 'COMPLETED'];

async function findProviderForUser(userId) {
  return Provider.findOne({ where: { userId } });
}

async function resolveTradeCategory(executionType, tradeCategoryId) {
  if (executionType !== 'provider') return null;

  const tradeCategory = await TradeCategory.findOne({
    where: { id: tradeCategoryId, isActive: true },
  });
  if (!tradeCategory) {
    const err = new Error('Filière invalide ou inactive');
    err.status = 400;
    throw err;
  }
  return tradeCategory;
}

/* ============================================================
   POST /api/v1/missions/estimate — aucune écriture DB
============================================================ */
exports.estimate = async (req, res) => {
  try {
    const { executionType, tradeCategoryId, serviceType } = req.body;

    await resolveTradeCategory(executionType, tradeCategoryId);

    const estimate = await estimateMission({
      user: req.user,
      executionType,
      tradeCategoryId: tradeCategoryId || null,
      serviceType: serviceType || null,
    });

    return res.status(200).json({ estimate });
  } catch (e) {
    if (e.status === 400) return res.status(400).json({ error: e.message });
    logger.error({ err: e }, 'mission.estimate.failed');
    return res.status(500).json({ error: "Erreur lors du calcul de l'estimation" });
  }
};

/* ============================================================
   POST /api/v1/missions
============================================================ */
exports.create = async (req, res) => {
  try {
    const {
      executionType,
      tradeCategoryId,
      serviceType,
      title,
      description,
      savedLocationId,
      address: rawAddress,
      latitude: rawLatitude,
      longitude: rawLongitude,
    } = req.body;

    const tradeCategory = await resolveTradeCategory(executionType, tradeCategoryId);

    let trimmedAddress = rawAddress ? String(rawAddress).trim() : null;
    let latitude = rawLatitude != null ? Number(rawLatitude) : null;
    let longitude = rawLongitude != null ? Number(rawLongitude) : null;

    if (savedLocationId) {
      const savedLocation = await SavedLocation.findOne({
        where: { id: savedLocationId, userId: req.user.id },
      });
      if (!savedLocation) {
        return res.status(404).json({ error: 'Lieu enregistré introuvable' });
      }
      trimmedAddress = savedLocation.address;
      latitude = Number(savedLocation.latitude);
      longitude = Number(savedLocation.longitude);
    } else if ((!Number.isFinite(latitude) || !Number.isFinite(longitude)) && trimmedAddress) {
      // Coordonnées dérivées quand un lieu est fourni sans être déjà résolues côté client
      // (dette 0.5, même règle que missionRequest.controller.js) : géocodage serveur, 400 si
      // l'adresse ne résout à rien — jamais de mission avec une adresse saisie mais des
      // coordonnées nulles.
      const geocoded = await geocodeAddress(trimmedAddress, { countryIso: req.user.country });
      if (!geocoded) {
        return res.status(400).json({
          error: 'Adresse introuvable. Veuillez préciser un lieu plus précis.',
        });
      }
      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      latitude = null;
      longitude = null;
    }

    const estimate = await estimateMission({
      user: req.user,
      executionType,
      tradeCategoryId: tradeCategory ? tradeCategory.id : null,
      serviceType: tradeCategory ? null : serviceType,
    });

    const service = await Service.create({
      clientId: req.user.id,
      agentId: null,
      createdById: req.user.id,
      propertyId: null,
      type: tradeCategory ? 'other' : serviceType,
      title: String(title).trim(),
      description: description ? String(description).trim() : null,
      address: trimmedAddress,
      latitude,
      longitude,
      budget: null,
      currency: estimate.currency,
      status: 'created',
      countryId: req.user.countryId ?? null,
      regionId: req.user.regionId ?? null,
      executionType,
      tradeCategoryId: tradeCategory ? tradeCategory.id : null,
      // Additive uniquement pour le nouveau flux (0.6.b) — même règle que
      // service.controller.js/missionRequest.controller.js.
      missionStatus: tradeCategory ? 'CREATED' : null,
    });

    const fullService = await Service.findByPk(service.id, {
      include: [
        { model: User, as: 'client', attributes: ['id', 'firstName', 'lastName', 'phone'] },
      ],
    });

    await notifyServiceCreated({
      actorId: req.user.id,
      service,
      fullService,
      targetClientId: req.user.id,
      countryId: req.user.countryId ?? null,
      regionId: req.user.regionId ?? null,
    });

    return res.status(201).json({
      message: 'Mission créée',
      mission: fullService,
      estimate,
    });
  } catch (e) {
    if (e.status === 400) return res.status(400).json({ error: e.message });
    logger.error({ err: e }, 'mission.create.failed');
    return res.status(500).json({ error: 'Erreur lors de la création de la mission' });
  }
};

/* ============================================================
   POST /api/v1/missions/:id/attachments — photo + note vocale optionnelles
   (endpoint séparé de la création, cf. plan section 3 : la mission ne doit
   jamais être bloquée par un échec d'upload média)
============================================================ */
exports.addAttachments = async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ error: 'Mission introuvable' });
    if (String(service.clientId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Accès interdit pour cette mission' });
    }

    const photo = req.files?.photo?.[0] || null;
    const voiceNote = req.files?.voiceNote?.[0] || null;
    const files = [
      photo ? { file: photo, kind: 'photo' } : null,
      voiceNote ? { file: voiceNote, kind: 'other' } : null,
    ].filter(Boolean);

    if (files.length === 0) {
      return res.status(400).json({ error: 'Aucun fichier fourni (photo ou note vocale)' });
    }

    const imageKitEnabled = mediaUpload.isImageKitEnabled();
    const fallbackPolicy = mediaUpload.resolveLocalFallbackPolicy({
      moduleFallbackEnvVar: MISSION_ATTACHMENT_LOCAL_FALLBACK_ENV_VAR,
    });
    const allowLocalFallback = fallbackPolicy.allowLocalFallback;

    if (!imageKitEnabled && !allowLocalFallback) {
      throw mediaUpload.mediaStorageError(
        'Stockage des pièces jointes indisponible. Configurez IMAGEKIT_* ou UPLOADS_ROOT persistant.',
        MISSION_ATTACHMENT_STORAGE_ERROR_CODE
      );
    }

    const createdIds = [];
    const failed = [];

    for (let idx = 0; idx < files.length; idx += 1) {
      const { file, kind } = files[idx];
      try {
        const fileName = mediaUpload.buildFileName('mission_attachment', file.originalname, idx);
        let uploaded = null;

        if (imageKitEnabled) {
          try {
            uploaded = await mediaUpload.uploadToImageKitWithRetry({
              file: file.buffer,
              fileName,
              folder: '/teranga/mission-attachments/',
            });
          } catch (err) {
            logger.warn({ err }, 'mission.attachments.imagekit_upload_failed');
            if (!allowLocalFallback) throw mediaUpload.mediaStorageError(undefined, MISSION_ATTACHMENT_STORAGE_ERROR_CODE);
          }
        }

        if (!uploaded || !uploaded.url) {
          if (!allowLocalFallback) {
            throw mediaUpload.mediaStorageError(undefined, MISSION_ATTACHMENT_STORAGE_ERROR_CODE);
          }
          uploaded = await mediaUpload.saveFileLocally(file, fileName, {
            subfolder: 'mission-attachments',
          });
        }

        const created = await Evidence.create({
          serviceId: service.id,
          taskId: null,
          orderId: null,
          uploaderId: req.user.id,
          kind,
          mimeType: file.mimetype || null,
          originalName: file.originalname || null,
          filePath: uploaded.url,
          fileId: uploaded.fileId || null,
          fileSize: file.size || null,
          countryId: service.countryId ?? null,
          regionId: service.regionId ?? null,
        });

        createdIds.push(created.id);
      } catch (err) {
        if (err?.code === MISSION_ATTACHMENT_STORAGE_ERROR_CODE) throw err;
        failed.push({ name: file?.originalname || null, error: err?.message || 'Upload failed' });
      }
    }

    const evidences = createdIds.length
      ? await Evidence.findAll({ where: { id: createdIds } })
      : [];

    const response = {
      message: createdIds.length
        ? 'Pièce(s) jointe(s) ajoutée(s)'
        : "Aucune pièce jointe n'a pu être ajoutée",
      attachments: evidences,
    };
    if (failed.length) response.warnings = { failedFiles: failed };

    return res.status(createdIds.length ? 201 : 500).json(response);
  } catch (e) {
    if (e?.code === MISSION_ATTACHMENT_STORAGE_ERROR_CODE) {
      return res.status(503).json({
        error: 'Stockage des pièces jointes indisponible. Configurez IMAGEKIT_* ou UPLOADS_ROOT persistant.',
      });
    }
    logger.error({ err: e }, 'mission.addAttachments.failed');
    return res.status(500).json({ error: "Erreur lors de l'ajout des pièces jointes" });
  }
};

/* ============================================================
   POST /api/v1/missions/:id/assign — assignation manuelle (admin), section 4.2/3.3.
   Pas de short-list ni de calcul Distance Matrix ici : le moteur de matching automatique
   reste le Lot 4 (docs/DEV_SPEC_TERANGA_v3.md section 3.4/section 6).
============================================================ */
exports.assign = async (req, res) => {
  try {
    const { providerId } = req.body;

    let service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ error: 'Mission introuvable' });

    if (!canAccessGeoResource(service, req.user)) {
      return res.status(403).json({ error: 'Mission hors scope géographique' });
    }

    if (!['CREATED', 'SEARCHING_EXECUTOR'].includes(service.missionStatus)) {
      return res.status(400).json({
        error: "Cette mission ne peut pas être assignée dans son état actuel",
      });
    }

    const provider = await Provider.findOne({
      where: { id: providerId, status: 'active' },
      include: [
        {
          model: TradeCategory,
          as: 'tradeCategories',
          where: { id: service.tradeCategoryId },
          required: true,
          attributes: [],
        },
      ],
    });
    if (!provider) {
      return res.status(400).json({
        error: 'Prestataire invalide, inactif, ou ne couvrant pas cette filière',
      });
    }

    if (service.missionStatus === 'CREATED') {
      service = await transitionMissionStatus({
        service,
        toStatus: 'SEARCHING_EXECUTOR',
        actorType: 'system',
        actorId: null,
      });
    }

    service = await transitionMissionStatus({
      service,
      toStatus: 'ASSIGNED',
      actorType: 'admin',
      actorId: req.user.id,
      extraFields: { providerId: provider.id },
    });

    await notifyServiceStatusUpdate({
      actorId: req.user.id,
      service,
      title: MISSION_STATUS_LABELS.ASSIGNED,
      status: service.status,
    });

    return res.status(200).json({ message: 'Prestataire assigné', mission: service });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    logger.error({ err: e }, 'mission.assign.failed');
    return res.status(500).json({ error: "Erreur lors de l'assignation" });
  }
};

/* ============================================================
   PATCH /api/v1/missions/:id/status — transition de statut (section 2).
============================================================ */
exports.updateStatus = async (req, res) => {
  try {
    const { toStatus } = req.body;
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ error: 'Mission introuvable' });

    let allowed = false;
    let actorType = req.user.role;

    if (req.user.role === 'admin') {
      allowed = canAccessGeoResource(service, req.user);
    } else if (req.user.role === 'client') {
      allowed =
        String(service.clientId) === String(req.user.id) && CLIENT_TRIGGERABLE.includes(toStatus);
    } else if (req.user.role === 'agent') {
      allowed =
        String(service.agentId) === String(req.user.id) && EXECUTOR_TRIGGERABLE.includes(toStatus);
    } else if (req.user.role === 'provider') {
      const provider = await findProviderForUser(req.user.id);
      allowed =
        Boolean(provider) &&
        String(service.providerId) === String(provider.id) &&
        EXECUTOR_TRIGGERABLE.includes(toStatus);
    }

    if (!allowed) {
      return res.status(403).json({ error: 'Accès interdit pour cette transition' });
    }

    const updated = await transitionMissionStatus({
      service,
      toStatus,
      actorType,
      actorId: req.user.id,
    });

    await notifyServiceStatusUpdate({
      actorId: req.user.id,
      service: updated,
      title: MISSION_STATUS_LABELS[toStatus] || 'Statut de mission mis à jour',
      status: updated.status,
    });

    return res.status(200).json({ mission: updated });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    logger.error({ err: e }, 'mission.updateStatus.failed');
    return res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' });
  }
};

/* ============================================================
   POST /api/v1/missions/:id/location — ping de position (agent, provider), section 3.3/4.2.
   Ne jamais appeler Distance Matrix ici (section 8) — coût facturé à l'appel, réservé au
   recalcul explicite (GET .../track).
============================================================ */
exports.pingLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ error: 'Mission introuvable' });

    if (!ACTIVE_STATUSES.includes(service.missionStatus)) {
      return res.status(400).json({
        error: "Cette mission n'est pas dans une fenêtre d'exécution active",
      });
    }

    let executorType = null;
    let executorId = null;

    if (req.user.role === 'agent') {
      if (String(service.agentId) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Accès interdit' });
      }
      executorType = 'agent';
      executorId = req.user.id;
    } else if (req.user.role === 'provider') {
      const provider = await findProviderForUser(req.user.id);
      if (!provider || String(service.providerId) !== String(provider.id)) {
        return res.status(403).json({ error: 'Accès interdit' });
      }
      executorType = 'provider';
      executorId = provider.id;
    } else {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const location = await ExecutorLocation.create({
      executorType,
      executorId,
      serviceId: service.id,
      latitude,
      longitude,
      recordedAt: new Date(),
    });

    return res.status(201).json({ message: 'Position enregistrée', location });
  } catch (e) {
    logger.error({ err: e }, 'mission.pingLocation.failed');
    return res.status(500).json({ error: "Erreur lors de l'enregistrement de la position" });
  }
};

/* ============================================================
   GET /api/v1/missions/:id/track — suivi en direct (client propriétaire), section 4.2.
============================================================ */
exports.track = async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ error: 'Mission introuvable' });
    if (String(service.clientId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Accès interdit pour cette mission' });
    }

    const location = await ExecutorLocation.findOne({
      where: { serviceId: service.id },
      order: [['recordedAt', 'DESC']],
    });

    let etaMinutes = null;
    const destLat = Number(service.latitude);
    const destLng = Number(service.longitude);

    if (location && Number.isFinite(destLat) && Number.isFinite(destLng)) {
      const result = await getDistanceMatrix(
        [{ lat: Number(location.latitude), lng: Number(location.longitude) }],
        [{ lat: destLat, lng: destLng }]
      );
      const element = result?.rows?.[0]?.[0];
      if (element?.status === 'OK' && element.durationSeconds != null) {
        etaMinutes = Math.round(element.durationSeconds / 60);
      }
    }

    return res.status(200).json({
      missionStatus: service.missionStatus,
      status: service.status,
      title: service.title,
      destination:
        Number.isFinite(destLat) && Number.isFinite(destLng)
          ? { latitude: destLat, longitude: destLng, address: service.address }
          : null,
      position: location
        ? {
            latitude: Number(location.latitude),
            longitude: Number(location.longitude),
            recordedAt: location.recordedAt,
          }
        : null,
      etaMinutes,
    });
  } catch (e) {
    logger.error({ err: e }, 'mission.track.failed');
    return res.status(500).json({ error: 'Erreur lors de la récupération du suivi' });
  }
};
