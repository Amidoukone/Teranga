'use strict';

// Création de mission guidée, utilisateur déjà authentifié (docs/DEV_SPEC_TERANGA_v3.md
// section 4.1 + 3.3). Distinct de missionRequest.controller.js (point d'entrée invité de la
// homepage, Lot 2) : ici pas de bootstrap de compte, le client a déjà une session.

const { Op } = require('sequelize');
const {
  Service,
  User,
  TradeCategory,
  SavedLocation,
  Evidence,
  Provider,
  MissionRating,
  Vehicle,
  ExecutorLocation,
} = require('../../models');
const { geocodeAddress, reverseGeocode } = require('../services/geocoding.service');
const { getDistanceMatrix } = require('../services/distanceMatrix.service');
const { estimateMission } = require('../services/priceEstimate.service');
const { findEligibleVehicleForProvider } = require('../services/mobilityCompliance.service');
const { upsertProviderLiveLocation } = require('../services/providerPresence.service');
const {
  getMissionStartCode,
  resolveAssistancePhone,
  serializeOptionalPosition,
} = require('../services/missionSafety.service');
const {
  transitionMissionStatus,
  ACTIVE_STATUSES,
} = require('../services/missionStatus.service');
const { notifyServiceCreated, notifyServiceStatusUpdate } = require('../services/serviceNotification.service');
const { recalcProviderBadge } = require('../services/providerBadge.service');
const { getAdminRecipientIds } = require('../services/notification.service');
const { emitEvent } = require('../services/activity.service');
const mediaUpload = require('../services/mediaUpload.service');
const { canAccessGeoResource } = require('../utils/geoScope');
const { isProviderCountryMatchesMission } = require('../utils/providerScope');
const { resolveMissionGeoScope } = require('../utils/resolveMissionGeoScope');
const { resolveDeliveryDetails } = require('../utils/deliveryDetails');
const { getPagination } = require('../utils/pagination');
const logger = require('../utils/logger');

const MISSION_ATTACHMENT_LOCAL_FALLBACK_ENV_VAR = 'MISSION_ATTACHMENT_ALLOW_LOCAL_FALLBACK';
const MISSION_ATTACHMENT_STORAGE_ERROR_CODE = 'MISSION_ATTACHMENT_STORAGE_UNAVAILABLE';
const DEFAULT_ACCEPTANCE_WINDOW_SECONDS = 5 * 60;
const MIN_ACCEPTANCE_WINDOW_SECONDS = 2 * 60;
const MAX_ACCEPTANCE_WINDOW_SECONDS = 15 * 60;

function getAcceptanceWindowSeconds() {
  const configured = Number(process.env.MISSION_ACCEPTANCE_WINDOW_SECONDS);
  if (
    !Number.isFinite(configured) ||
    configured < MIN_ACCEPTANCE_WINDOW_SECONDS ||
    configured > MAX_ACCEPTANCE_WINDOW_SECONDS
  ) {
    return DEFAULT_ACCEPTANCE_WINDOW_SECONDS;
  }
  return Math.round(configured);
}

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
// Transitions gérées exclusivement par le parcours de litige structuré
// (docs/DEV_SPEC_TERANGA_v4_PHASE0.md §2) — jamais via ce PATCH générique, même pour un admin,
// pour qu'une résolution ne puisse jamais se faire sans motif/preuve (ouverture) ou sans
// justification écrite (résolution). Voir dispute.controller.js.
const DISPUTE_MANAGED_STATUSES = ['DISPUTED', 'RESOLVED_REFUND', 'RESOLVED_REDO', 'RESOLVED_CLOSED'];

// Filières nécessitant un point de départ distinct de la destination — colis à retirer
// (livraison) ou passager à prendre en charge (mobilité, Teranga Taxi, docs/DEV_SPEC_TERANGA_v7_PHASE4.md
// §1.1). Même mécanisme de capture/dispatch pour les deux, seul le libellé change côté client.
const PICKUP_REQUIRED_SLUGS = ['livraison', 'mobilite'];
exports.PICKUP_REQUIRED_SLUGS = PICKUP_REQUIRED_SLUGS;

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
   GET /api/v1/missions/reverse-geocode — coordonnées -> adresse lisible, utilisé par l'étape
   Lieu du wizard (bouton "Utiliser ma position actuelle") : la clé navigateur est restreinte à
   Maps JavaScript/Places (jamais Geocoding), ce géocodage doit donc passer par le backend
   (clé serveur). Best-effort : ne bloque jamais la capture des coordonnées côté client.
============================================================ */
exports.reverseGeocodeLocation = async (req, res) => {
  try {
    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ error: 'latitude/longitude invalides' });
    }

    const address = await reverseGeocode(latitude, longitude);
    return res.json({ address });
  } catch (e) {
    logger.error({ err: e }, 'mission.reverseGeocodeLocation.failed');
    return res.status(500).json({ error: 'Erreur lors du géocodage inverse' });
  }
};

/* ============================================================
   POST /api/v1/missions/estimate — aucune écriture DB
============================================================ */
exports.estimate = async (req, res) => {
  try {
    const {
      executionType,
      tradeCategoryId,
      serviceType,
      address: rawAddress,
      latitude: rawLatitude,
      longitude: rawLongitude,
      pickupLatitude: rawPickupLatitude,
      pickupLongitude: rawPickupLongitude,
      requestedVehicleType: rawRequestedVehicleType,
      packageType: rawPackageType,
    } = req.body;

    const tradeCategory = await resolveTradeCategory(executionType, tradeCategoryId);
    const requestedVehicleType =
      tradeCategory?.slug === 'mobilite' ? rawRequestedVehicleType || 'motorcycle' : null;
    const packageType = tradeCategory?.slug === 'livraison' ? rawPackageType || 'small' : null;

    // Estimation basée sur la destination réelle (adresse déjà saisie à l'étape Location du
    // wizard) quand elle est disponible — jamais bloquant : un aperçu de prix qui échoue à se
    // géolocaliser retombe simplement sur le scope du compte (voir mission.controller.js create
    // pour la version stricte utilisée à la création effective).
    const trimmedAddress = rawAddress ? String(rawAddress).trim() : null;
    let latitude = rawLatitude != null ? Number(rawLatitude) : null;
    let longitude = rawLongitude != null ? Number(rawLongitude) : null;
    const pickupLatitude = rawPickupLatitude != null ? Number(rawPickupLatitude) : null;
    const pickupLongitude = rawPickupLongitude != null ? Number(rawPickupLongitude) : null;
    let geocodedCountryIso = null;
    let geocodedAdminAreaName = null;

    if (trimmedAddress) {
      const geocoded = await geocodeAddress(trimmedAddress);
      if (geocoded) {
        geocodedCountryIso = geocoded.countryIso;
        geocodedAdminAreaName = geocoded.adminAreaName;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          latitude = geocoded.latitude;
          longitude = geocoded.longitude;
        }
      }
    }

    const missionGeoScope = await resolveMissionGeoScope({
      countryIso: geocodedCountryIso,
      adminAreaName: geocodedAdminAreaName,
      fallbackCountryId: req.user.countryId ?? null,
      fallbackRegionId: req.user.regionId ?? null,
      tradeCategoryScope: tradeCategory
        ? { countryId: tradeCategory.countryId, regionId: tradeCategory.regionId }
        : null,
    });

    const estimate = await estimateMission({
      user: req.user,
      executionType,
      tradeCategoryId: tradeCategoryId || null,
      serviceType: serviceType || null,
      countryId: missionGeoScope.error ? null : missionGeoScope.countryId,
      regionId: missionGeoScope.error ? null : missionGeoScope.regionId,
      destinationLatitude: latitude,
      destinationLongitude: longitude,
      pickupLatitude,
      pickupLongitude,
      requestedVehicleType,
      packageType,
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
      pickupAddress: rawPickupAddress,
      pickupLatitude: rawPickupLatitude,
      pickupLongitude: rawPickupLongitude,
      requestedVehicleType: rawRequestedVehicleType,
      packageType: rawPackageType,
      recipientName: rawRecipientName,
      recipientPhone: rawRecipientPhone,
      packageHandling: rawPackageHandling,
    } = req.body;

    const tradeCategory = await resolveTradeCategory(executionType, tradeCategoryId);
    const requestedVehicleType =
      tradeCategory?.slug === 'mobilite' ? rawRequestedVehicleType || 'motorcycle' : null;
    const packageType = tradeCategory?.slug === 'livraison' ? rawPackageType || 'small' : null;
    const deliveryDetails = resolveDeliveryDetails(tradeCategory, {
      recipientName: rawRecipientName,
      recipientPhone: rawRecipientPhone,
      packageHandling: rawPackageHandling,
    });

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
    }

    // Pays/région de destination (géocodés, best-effort) : la mission est routée/tarifée selon
    // où elle a réellement lieu, pas selon le compte du client (correction transfrontalière —
    // un client à Bamako doit pouvoir demander une mission à Abidjan). Sans biais vers le pays
    // du compte, contrairement à l'ancien comportement.
    let geocodedCountryIso = null;
    let geocodedAdminAreaName = null;
    const hadCoordinatesAlready = Number.isFinite(latitude) && Number.isFinite(longitude);

    if (trimmedAddress && !hadCoordinatesAlready) {
      // Coordonnées dérivées quand un lieu est fourni sans être déjà résolues côté client
      // (dette 0.5, même règle que missionRequest.controller.js) : géocodage serveur, 400 si
      // l'adresse ne résout à rien — jamais de mission avec une adresse saisie mais des
      // coordonnées nulles.
      const geocoded = await geocodeAddress(trimmedAddress);
      if (!geocoded) {
        return res.status(400).json({
          error: 'Adresse introuvable. Veuillez préciser un lieu plus précis.',
        });
      }
      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
      geocodedCountryIso = geocoded.countryIso;
      geocodedAdminAreaName = geocoded.adminAreaName;
    } else if (trimmedAddress) {
      // Coordonnées déjà résolues (lieu enregistré ou fournies par le client) : géocodage
      // uniquement pour en déduire le pays/région, jamais bloquant ici puisqu'on a déjà des
      // coordonnées valides.
      const geocoded = await geocodeAddress(trimmedAddress);
      if (geocoded) {
        geocodedCountryIso = geocoded.countryIso;
        geocodedAdminAreaName = geocoded.adminAreaName;
      }
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      latitude = null;
      longitude = null;
    }

    // Retrait — obligatoire pour livraison et mobilité (docs/DEV_SPEC_TERANGA_v7_PHASE4.md §1.1,
    // qui étend la règle posée en Phase 3 Lot 1). Ne pilote jamais le pays/région de la mission
    // (la dépose le fait déjà ci-dessus) : c'est uniquement une seconde position, jamais
    // géocodée pour en dériver un scope.
    let pickupAddress = rawPickupAddress ? String(rawPickupAddress).trim() : null;
    let pickupLatitude = rawPickupLatitude != null ? Number(rawPickupLatitude) : null;
    let pickupLongitude = rawPickupLongitude != null ? Number(rawPickupLongitude) : null;

    if (pickupAddress && (!Number.isFinite(pickupLatitude) || !Number.isFinite(pickupLongitude))) {
      const geocodedPickup = await geocodeAddress(pickupAddress);
      if (!geocodedPickup) {
        return res.status(400).json({
          error: 'Adresse de retrait introuvable. Veuillez préciser un lieu plus précis.',
        });
      }
      pickupLatitude = geocodedPickup.latitude;
      pickupLongitude = geocodedPickup.longitude;
    }

    if (!Number.isFinite(pickupLatitude) || !Number.isFinite(pickupLongitude)) {
      pickupLatitude = null;
      pickupLongitude = null;
      pickupAddress = pickupAddress || null;
    }

    if (PICKUP_REQUIRED_SLUGS.includes(tradeCategory?.slug) &&
      !pickupAddress && (pickupLatitude === null || pickupLongitude === null)) {
      return res.status(400).json({
        error: 'Le point de départ est obligatoire pour cette filière',
      });
    }

    const missionGeoScope = await resolveMissionGeoScope({
      countryIso: geocodedCountryIso,
      adminAreaName: geocodedAdminAreaName,
      fallbackCountryId: req.user.countryId ?? null,
      fallbackRegionId: req.user.regionId ?? null,
      tradeCategoryScope: tradeCategory
        ? { countryId: tradeCategory.countryId, regionId: tradeCategory.regionId }
        : null,
    });
    if (missionGeoScope.error) {
      return res.status(400).json({ error: missionGeoScope.error });
    }

    const estimate = await estimateMission({
      user: req.user,
      executionType,
      tradeCategoryId: tradeCategory ? tradeCategory.id : null,
      serviceType: tradeCategory ? null : serviceType,
      countryId: missionGeoScope.countryId,
      regionId: missionGeoScope.regionId,
      destinationLatitude: latitude,
      destinationLongitude: longitude,
      pickupLatitude,
      pickupLongitude,
      requestedVehicleType,
      packageType,
    });

    const service = await Service.create({
      clientId: req.user.id,
      agentId: null,
      createdById: req.user.id,
      propertyId: null,
      pickupAddress,
      pickupLatitude,
      pickupLongitude,
      requestedVehicleType,
      packageType,
      ...deliveryDetails,
      type: tradeCategory ? 'other' : serviceType,
      title: String(title).trim(),
      description: description ? String(description).trim() : null,
      address: trimmedAddress,
      latitude,
      longitude,
      budget: estimate.basePrice ?? estimate.minPrice ?? null,
      currency: estimate.currency,
      status: 'created',
      countryId: missionGeoScope.countryId,
      regionId: missionGeoScope.regionId,
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
      countryId: missionGeoScope.countryId,
      regionId: missionGeoScope.regionId,
    });

    return res.status(201).json({
      message: 'Mission créée',
      mission: fullService,
      estimate,
      startCode:
        tradeCategory?.slug === 'mobilite' ? getMissionStartCode(fullService) : null,
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

async function findActiveProviderForTradeCategory(providerId, tradeCategoryId) {
  return Provider.findOne({
    where: { id: providerId, status: 'active' },
    include: [
      {
        model: TradeCategory,
        as: 'tradeCategories',
        where: { id: tradeCategoryId },
        required: true,
        attributes: [],
      },
    ],
  });
}

async function releaseMobilityProviderIfEligible(providerId) {
  if (!providerId) return false;
  const provider = await Provider.findByPk(providerId);
  if (!provider) return false;
  const eligibility =
    provider.status === 'active'
      ? await findEligibleVehicleForProvider({
          provider,
          requestedVehicleType: null,
        })
      : { vehicle: null };
  const availabilityStatus = eligibility.vehicle ? 'available' : 'offline';
  const [released] = await Provider.update(
    { availabilityStatus },
    { where: { id: provider.id, availabilityStatus: 'busy' } }
  );
  return released === 1;
}

/* ============================================================
   POST /api/v1/missions/:id/assign — assignation/réassignation/désassignation (admin), section
   4.2/3.3 + extension "superviseur agent" pour les filières hors transport. Taxi et Livraison
   sont exécutés exclusivement par un prestataire chauffeur/livreur : aucun agent superviseur.
   Pour les autres filières, un agent peut être posé en plus d'un prestataire sans piloter la machine à états :
   voir exports.updateStatus). Body : { providerId?, agentId? }, chaque clé indépendante — absente
   = inchangé, null = désassigner, nombre = assigner/réassigner. Pas de short-list ni de calcul
   Distance Matrix ici : le moteur de matching automatique reste le Lot 4 (section 3.4/section 6).
============================================================ */
exports.assign = async (req, res) => {
  let reservedMobilityProviderId = null;
  try {
    const { providerId, agentId, vehicleId } = req.body;

    let service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ error: 'Mission introuvable' });

    if (!canAccessGeoResource(service, req.user)) {
      return res.status(403).json({ error: 'Mission hors scope géographique' });
    }

    if (!service.missionStatus) {
      return res.status(400).json({
        error: 'Cette mission utilise le flux classique agent (voir /services/assign)',
      });
    }

    const tradeCategory = service.tradeCategoryId
      ? await TradeCategory.findByPk(service.tradeCategoryId, { attributes: ['slug'] })
      : null;
    const isMobility = tradeCategory?.slug === 'mobilite';
    const isDriverOnlyMission = ['mobilite', 'livraison'].includes(tradeCategory?.slug);
    if (vehicleId !== undefined && !isMobility) {
      return res.status(400).json({ error: 'vehicleId est reserve aux courses Mobilite' });
    }

    if (isDriverOnlyMission && agentId !== undefined && agentId !== null) {
      return res.status(400).json({
        error: 'Les courses taxi et les livraisons doivent être affectées uniquement à un chauffeur ou livreur',
      });
    }

    let directUpdates = isDriverOnlyMission && service.agentId ? { agentId: null } : {};
    let shouldNotify = false;
    let mobilityProviderToRelease = null;
    let mobilityAssignmentGuard = null;

    // --- Agent superviseur : réservé aux filières hors Taxi/Livraison. ---
    if (agentId !== undefined) {
      if (agentId === null) {
        directUpdates.agentId = null;
      } else {
        const agent = await User.findByPk(agentId);
        if (!agent || agent.role !== 'agent') {
          return res.status(400).json({ error: "agentId invalide : ce n'est pas un agent" });
        }
        if (!canAccessGeoResource(service, agent)) {
          return res.status(403).json({ error: 'Agent hors scope géographique' });
        }
        directUpdates.agentId = agent.id;
      }
      shouldNotify = true;
    }

    // --- Prestataire : exécutant, pilote la machine à états. ---
    if (providerId !== undefined) {
      if (providerId === null) {
        mobilityProviderToRelease = isMobility ? service.providerId : null;
        if (['CREATED', 'SEARCHING_EXECUTOR'].includes(service.missionStatus)) {
          // Deja sans prestataire : supprimer aussi un eventuel vehicule devenu orphelin.
          if (service.vehicleId) {
            directUpdates.vehicleId = null;
            shouldNotify = true;
          }
        } else if (['ASSIGNED', 'EN_ROUTE'].includes(service.missionStatus)) {
          service = await transitionMissionStatus({
            service,
            toStatus: 'SEARCHING_EXECUTOR',
            actorType: 'admin',
            actorId: req.user.id,
            extraFields: { providerId: null, vehicleId: null, ...directUpdates },
          });
          directUpdates = {};
          shouldNotify = true;
        } else {
          return res.status(400).json({
            error:
              'Impossible de désassigner à ce stade, réassignez directement un autre prestataire',
          });
        }
      } else {
        const provider = await findActiveProviderForTradeCategory(providerId, service.tradeCategoryId);
        if (!provider) {
          return res.status(400).json({
            error: 'Prestataire invalide, inactif, ou ne couvrant pas cette filière',
          });
        }

        // Couverture géographique : indépendant du scope de l'admin qui assigne (un admin
        // global n'a pas de restriction de scope, cf. isGlobalAdmin) — c'est le prestataire qui
        // doit couvrir le PAYS de destination réel de la mission, jamais l'inverse.
        if (!(await isProviderCountryMatchesMission(service, provider))) {
          return res.status(400).json({
            error: 'Ce prestataire ne couvre pas le pays de destination de cette mission',
          });
        }
        if (tradeCategory?.slug === 'livraison' && service.packageType === 'bulky') {
          const hasCar = await Vehicle.count({
            where: { providerId: provider.id, status: 'active', vehicleType: 'car' },
          });
          if (!hasCar) {
            return res.status(400).json({
              error: 'Un véhicule adapté est requis pour un colis volumineux',
            });
          }
        }
        if (
          isMobility &&
          service.providerId &&
          String(service.providerId) !== String(provider.id)
        ) {
          mobilityProviderToRelease = service.providerId;
        }

        let assignedVehicle = null;
        if (isMobility) {
          const canAssignFromCurrentState = [
            'CREATED',
            'SEARCHING_EXECUTOR',
            'ASSIGNED',
            'EN_ROUTE',
            'ON_SITE',
            'IN_PROGRESS',
          ].includes(service.missionStatus);
          if (!canAssignFromCurrentState) {
            return res.status(400).json({
              error: 'Cette mission ne peut pas etre (re)assignee dans son etat actuel',
            });
          }
          if (provider.availabilityStatus !== 'available') {
            return res.status(400).json({ error: "Ce chauffeur n'est plus disponible" });
          }
          const eligibility = await findEligibleVehicleForProvider({
            provider,
            requestedVehicleType: service.requestedVehicleType || 'motorcycle',
            vehicleId: vehicleId || null,
          });
          if (!eligibility.vehicle) {
            const issues = [...eligibility.driverIssues, ...eligibility.vehicleIssues];
            return res.status(400).json({
              error: `Chauffeur ou vehicule non conforme : ${issues.join(', ')}`,
              complianceIssues: issues,
            });
          }
          assignedVehicle = eligibility.vehicle;

          const activeMissionCount = await Service.count({
            where: {
              id: { [Op.ne]: service.id },
              providerId: provider.id,
              missionStatus: { [Op.in]: ACTIVE_STATUSES },
            },
          });
          if (activeMissionCount > 0) {
            return res.status(409).json({ error: 'Ce chauffeur a deja une course en cours' });
          }
          const [reserved] = await Provider.update(
            { availabilityStatus: 'busy' },
            {
              where: {
                id: provider.id,
                status: 'active',
                availabilityStatus: 'available',
              },
            }
          );
          if (reserved !== 1) {
            return res.status(409).json({ error: "Ce chauffeur vient d'etre reserve" });
          }
          reservedMobilityProviderId = provider.id;
        }

        // Fenêtre d'acceptation (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §5.2) — uniquement filière
        // Mobilité, NULL partout ailleurs (comportement inchangé pour les autres filières).
        let acceptanceDeadlineAt = null;
        if (service.tradeCategoryId) {
          // Dispatch partagé (docs/DEV_SPEC_TERANGA_v6_PHASE3.md §3) : la fenêtre d'acceptation
          // n'est pas spécifique à Mobilité, seule cette condition la limitait artificiellement.
          if (PICKUP_REQUIRED_SLUGS.includes(tradeCategory?.slug)) {
            acceptanceDeadlineAt = new Date(Date.now() + getAcceptanceWindowSeconds() * 1000);
          }
        }

        if (['CREATED', 'SEARCHING_EXECUTOR'].includes(service.missionStatus)) {
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
            extraFields: {
              providerId: provider.id,
              vehicleId: assignedVehicle?.id || null,
              acceptanceDeadlineAt,
              ...directUpdates,
            },
          });
          directUpdates = {};
        } else if (['ASSIGNED', 'EN_ROUTE', 'ON_SITE', 'IN_PROGRESS'].includes(service.missionStatus)) {
          // Réassignation vers un autre exécutant : pas de transition d'état, un nouvel exécutant
          // prend la suite immédiatement.
          directUpdates.providerId = provider.id;
          directUpdates.vehicleId = assignedVehicle?.id || null;
          directUpdates.acceptanceDeadlineAt = acceptanceDeadlineAt;
          if (isMobility) {
            mobilityAssignmentGuard = {
              providerId: service.providerId,
              missionStatus: service.missionStatus,
            };
          }
        } else {
          return res.status(400).json({
            error: 'Cette mission ne peut pas être (ré)assignée dans son état actuel',
          });
        }
        shouldNotify = true;
      }
    }

    if (Object.keys(directUpdates).length > 0) {
      if (mobilityAssignmentGuard) {
        const [updatedRows] = await Service.update(directUpdates, {
          where: {
            id: service.id,
            providerId: mobilityAssignmentGuard.providerId,
            missionStatus: mobilityAssignmentGuard.missionStatus,
          },
        });
        if (updatedRows !== 1) {
          throw Object.assign(
            new Error('Cette course vient deja d etre affectee par un autre operateur'),
            { status: 409 }
          );
        }
        await service.reload();
      } else {
        await service.update(directUpdates);
      }
    }
    if (mobilityProviderToRelease) {
      await releaseMobilityProviderIfEligible(mobilityProviderToRelease);
    }

    if (shouldNotify) {
      await notifyServiceStatusUpdate({
        actorId: req.user.id,
        service,
        title: MISSION_STATUS_LABELS[service.missionStatus] || 'Mission mise à jour',
        status: service.status,
      });
    }

    return res.status(200).json({ message: 'Assignation mise à jour', mission: service });
  } catch (e) {
    if (reservedMobilityProviderId) {
      try {
        const activeMissionCount = await Service.count({
          where: {
            providerId: reservedMobilityProviderId,
            missionStatus: { [Op.in]: ACTIVE_STATUSES },
          },
        });
        if (activeMissionCount === 0) {
          await releaseMobilityProviderIfEligible(reservedMobilityProviderId);
        }
      } catch (releaseError) {
        logger.error(
          { err: releaseError, providerId: reservedMobilityProviderId },
          'mission.assign.release_reservation.failed'
        );
      }
    }
    if (e.status) return res.status(e.status).json({ error: e.message });
    logger.error({ err: e }, 'mission.assign.failed');
    return res.status(500).json({ error: "Erreur lors de l'assignation" });
  }
};

/* ============================================================
   POST /api/v1/missions/:id/accept — le prestataire assigné confirme la course dans la fenêtre
   d'acceptation (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §5.2). Aucun changement de statut, juste la
   levée de la fenêtre — la mission continue normalement ensuite via updateStatus.
============================================================ */
exports.accept = async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ error: 'Mission introuvable' });

    const provider = await findProviderForUser(req.user.id);
    if (!provider || String(service.providerId) !== String(provider.id)) {
      return res.status(403).json({ error: 'Accès interdit' });
    }
    if (provider.status !== 'active') {
      return res.status(400).json({ error: "Le chauffeur n'est plus actif" });
    }
    if (!service.acceptanceDeadlineAt) {
      return res.status(400).json({ error: 'Aucune acceptation en attente pour cette mission' });
    }

    const tradeCategory = service.tradeCategoryId
      ? await TradeCategory.findByPk(service.tradeCategoryId, { attributes: ['slug'] })
      : null;
    if (tradeCategory?.slug === 'mobilite') {
      if (!service.vehicleId) {
        return res.status(400).json({ error: 'Aucun vehicule conforme attache a cette course' });
      }
      const eligibility = await findEligibleVehicleForProvider({
        provider,
        requestedVehicleType: service.requestedVehicleType || 'motorcycle',
        vehicleId: service.vehicleId,
      });
      if (!eligibility.vehicle) {
        const issues = [...eligibility.driverIssues, ...eligibility.vehicleIssues];
        return res.status(400).json({
          error: `La conformite doit etre retablie avant d'accepter : ${issues.join(', ')}`,
          complianceIssues: issues,
        });
      }
    }

    const [accepted] = await Service.update(
      { acceptanceDeadlineAt: null },
      {
        where: {
          id: service.id,
          providerId: provider.id,
          missionStatus: 'ASSIGNED',
          acceptanceDeadlineAt: { [Op.gte]: new Date() },
        },
      }
    );
    if (accepted !== 1) {
      return res.status(409).json({
        error: "L'offre a expire ou la course a deja change d'affectation",
      });
    }
    await service.reload();
    return res.status(200).json({ mission: service });
  } catch (e) {
    logger.error({ err: e }, 'mission.accept.failed');
    return res.status(500).json({ error: "Erreur lors de l'acceptation" });
  }
};

/* ============================================================
   POST /api/v1/missions/:id/decline — le prestataire assigné refuse (docs/DEV_SPEC_TERANGA_v5_PHASE2.md
   §5.2). Retour à SEARCHING_EXECUTOR, notifie le master (réaffectation nécessaire).
============================================================ */
exports.decline = async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ error: 'Mission introuvable' });

    const provider = await findProviderForUser(req.user.id);
    if (!provider || String(service.providerId) !== String(provider.id)) {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const updated = await transitionMissionStatus({
      service,
      toStatus: 'SEARCHING_EXECUTOR',
      actorType: 'provider',
      actorId: req.user.id,
      extraFields: { providerId: null, vehicleId: null, acceptanceDeadlineAt: null },
    });

    await releaseMobilityProviderIfEligible(provider.id);

    try {
      const masters = await getAdminRecipientIds({
        countryId: updated.countryId,
        regionId: updated.regionId,
      });
      if (masters.length > 0) {
        await emitEvent({
          recipients: masters,
          actorId: req.user.id,
          entityType: 'service',
          entityId: updated.id,
          action: 'status_updated',
          title: 'Course refusée — réaffectation nécessaire',
          message: `Mission #${updated.id} refusée par le chauffeur assigné.`,
          countryId: updated.countryId,
          regionId: updated.regionId,
          notificationMode: 'create',
        });
      }
    } catch (err) {
      logger.warn('Notification refus course échouée:', err?.message || err);
    }

    return res.status(200).json({ mission: updated });
  } catch (e) {
    logger.error({ err: e }, 'mission.decline.failed');
    return res.status(500).json({ error: 'Erreur lors du refus' });
  }
};

/* ============================================================
   PATCH /api/v1/missions/:id/status — transition de statut (section 2).
============================================================ */
exports.updateStatus = async (req, res) => {
  try {
    const { toStatus, collectedAmount: rawCollectedAmount } = req.body;
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ error: 'Mission introuvable' });

    // Sous-mission mobilité interne (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §4) : clientId n'est
    // qu'une association technique héritée de la mission mère, jamais un vrai droit d'accès —
    // un client ne doit jamais pouvoir agir sur une sous-mission qui lui est invisible.
    if (service.parentServiceId && req.user.role === 'client') {
      return res.status(403).json({ error: 'Accès interdit pour cette transition' });
    }

    let allowed = false;
    let actorType = req.user.role;

    if (req.user.role === 'admin') {
      allowed =
        !DISPUTE_MANAGED_STATUSES.includes(toStatus) && canAccessGeoResource(service, req.user);
    } else if (req.user.role === 'client') {
      allowed =
        String(service.clientId) === String(req.user.id) && CLIENT_TRIGGERABLE.includes(toStatus);
    } else if (req.user.role === 'agent') {
      // Supervision passive (voir exports.assign) : un agent posé comme superviseur sur une
      // mission filière (executionType='provider') ne pilote jamais la machine à états — seul
      // le prestataire assigné le peut. Un agent ne déclenche des transitions que sur les
      // missions dont il est réellement l'exécutant (executionType='agent').
      allowed =
        service.executionType === 'agent' &&
        String(service.agentId) === String(req.user.id) &&
        EXECUTOR_TRIGGERABLE.includes(toStatus);
    } else if (req.user.role === 'provider') {
      const provider = await findProviderForUser(req.user.id);
      allowed =
        Boolean(provider) &&
        String(service.providerId) === String(provider.id) &&
        EXECUTOR_TRIGGERABLE.includes(toStatus);
      // Fenêtre d'acceptation en attente (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §5.2) : le
      // prestataire doit confirmer via /accept avant de pouvoir faire progresser la mission.
      if (allowed && service.acceptanceDeadlineAt) {
        return res.status(400).json({
          error: "Confirmez d'abord la course (voir POST .../accept) avant de la faire progresser",
        });
      }
    }

    if (!allowed) {
      return res.status(403).json({ error: 'Accès interdit pour cette transition' });
    }

    if (toStatus === 'IN_PROGRESS') {
      const tradeCategory = service.tradeCategoryId
        ? await TradeCategory.findByPk(service.tradeCategoryId, { attributes: ['slug'] })
        : null;
      if (tradeCategory?.slug === 'mobilite' && !service.startAuthorizedAt) {
        return res.status(400).json({
          error:
            "Le code client doit etre verifie, ou Teranga doit autoriser le depart par telephone",
        });
      }
    }

    let updated = await transitionMissionStatus({
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

    // Clôture automatique des sous-missions mobilité interne à la confirmation de dépose
    // (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §4.3) — pas de client à faire valider. La réputation du
    // chauffeur (bloc ci-dessous) ne s'applique volontairement pas ici : `toStatus` reste
    // 'COMPLETED', pas 'VALIDATED' — un déplacement interne n'est pas une mission client à
    // valoriser dans le compteur public.
    if (toStatus === 'COMPLETED' && updated.parentServiceId) {
      updated = await transitionMissionStatus({
        service: updated,
        toStatus: 'VALIDATED',
        actorType: 'system',
        actorId: null,
      });
    }

    // Réconciliation cash à la remise, filière livraison uniquement (docs/DEV_SPEC_TERANGA_v6_PHASE3.md
    // §5) — `toStatus` (pas `updated.missionStatus`, qui peut avoir été recascadé ci-dessus) est la
    // transition réellement demandée par l'exécutant. Jamais bloquant : un écart notifie le master,
    // rien de plus.
    if (toStatus === 'COMPLETED' && rawCollectedAmount != null && !updated.parentServiceId) {
      const collectedAmount = Number(rawCollectedAmount);
      if (Number.isFinite(collectedAmount)) {
        try {
          const tradeCategory = updated.tradeCategoryId
            ? await TradeCategory.findByPk(updated.tradeCategoryId, { attributes: ['slug'] })
            : null;
          if (tradeCategory?.slug === 'livraison') {
            await updated.update({ collectedAmount });
            const budget = updated.budget != null ? Number(updated.budget) : null;
            if (budget != null && Math.abs(collectedAmount - budget) > 1) {
              const masters = await getAdminRecipientIds({
                countryId: updated.countryId,
                regionId: updated.regionId,
              });
              if (masters.length > 0) {
                await emitEvent({
                  recipients: masters,
                  actorId: req.user.id,
                  entityType: 'service',
                  entityId: updated.id,
                  action: 'status_updated',
                  title: 'Écart de montant collecté',
                  message: `Mission #${updated.id} : montant collecté (${collectedAmount}) différent du montant attendu (${budget}).`,
                  countryId: updated.countryId,
                  regionId: updated.regionId,
                  notificationMode: 'create',
                });
              }
            }
          }
        } catch (err) {
          logger.warn('Réconciliation cash échouée:', err?.message || err);
        }
      }
    }

    // Réputation (docs/DEV_SPEC_TERANGA_v4_PHASE0.md §3.2) — VALIDATED est le signal de succès
    // fiable (le client confirme), contrairement à CLOSED qui n'est pas systématiquement atteint
    // dans ce système ; completedMissionsCount n'était incrémenté nulle part avant ce lot.
    if (updated.providerId && ['VALIDATED', 'CLOSED'].includes(toStatus)) {
      try {
        if (toStatus === 'VALIDATED') {
          await Provider.increment('completedMissionsCount', {
            by: 1,
            where: { id: updated.providerId },
          });
        }
        await recalcProviderBadge(updated.providerId);
      } catch (err) {
        logger.warn('Mise à jour réputation prestataire échouée:', err?.message || err);
      }
    }

    if (updated.providerId && ['COMPLETED', 'CANCELLED_BY_CLIENT'].includes(toStatus)) {
      await releaseMobilityProviderIfEligible(updated.providerId);
    }

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
    const { latitude, longitude, accuracyMeters, headingDegrees } = req.body;
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

    if (executorType === 'provider' && service.vehicleId) {
      await upsertProviderLiveLocation({
        providerId: executorId,
        vehicleId: service.vehicleId,
        latitude,
        longitude,
        accuracyMeters,
        headingDegrees,
      });
    }

    return res.status(201).json({ message: 'Position enregistrée', location });
  } catch (e) {
    logger.error({ err: e }, 'mission.pingLocation.failed');
    return res.status(500).json({ error: "Erreur lors de l'enregistrement de la position" });
  }
};

/* ============================================================
   POST /api/v1/missions/:id/logistics-request — un exécutant (agent ou prestataire) en mission
   active demande un déplacement interne (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §4.2). Crée une
   sous-mission filière Mobilité, invisible du client (clientId hérité = association technique
   uniquement, jamais notifié). Ne bloque jamais la mission mère si aucun chauffeur n'est trouvé
   ensuite (§4.4) — c'est le job de la Phase 0/mission mère qui continue son cours normalement.
============================================================ */
exports.requestLogistics = async (req, res) => {
  try {
    const parentService = await Service.findByPk(req.params.id);
    if (!parentService) return res.status(404).json({ error: 'Mission introuvable' });

    let isExecutor = false;
    if (req.user.role === 'agent') {
      isExecutor =
        parentService.executionType === 'agent' &&
        String(parentService.agentId) === String(req.user.id);
    } else if (req.user.role === 'provider') {
      const provider = await findProviderForUser(req.user.id);
      isExecutor = Boolean(provider) && String(parentService.providerId) === String(provider.id);
    }
    if (!isExecutor) return res.status(403).json({ error: 'Accès interdit' });

    if (!ACTIVE_STATUSES.includes(parentService.missionStatus)) {
      return res.status(400).json({
        error: "Cette mission n'est pas dans une fenêtre d'exécution active",
      });
    }

    // Une seule sous-mission logistique active à la fois par mission mère — évite les doublons
    // en cas de double-clic, pas une vraie règle métier au-delà de ça.
    const existingActive = await Service.findOne({
      where: {
        parentServiceId: parentService.id,
        missionStatus: { [Op.notIn]: ['VALIDATED', 'CLOSED', 'CANCELLED_BY_CLIENT', 'NO_EXECUTOR_FOUND'] },
      },
    });
    if (existingActive) {
      return res.status(200).json({ mission: existingActive });
    }

    const mobiliteCategory = await TradeCategory.findOne({
      where: { slug: 'mobilite', isActive: true },
    });
    if (!mobiliteCategory) {
      return res.status(503).json({ error: 'Filière Mobilité indisponible pour le moment' });
    }

    const { latitude, longitude, address } = req.body;

    const childService = await Service.create({
      clientId: parentService.clientId,
      agentId: null,
      createdById: req.user.id,
      propertyId: null,
      parentServiceId: parentService.id,
      type: 'other',
      title: `Déplacement — mission #${parentService.id}`,
      address: parentService.address,
      latitude: parentService.latitude,
      longitude: parentService.longitude,
      pickupAddress: address || null,
      pickupLatitude: latitude,
      pickupLongitude: longitude,
      status: 'created',
      countryId: parentService.countryId,
      regionId: parentService.regionId,
      executionType: 'provider',
      tradeCategoryId: mobiliteCategory.id,
      missionStatus: 'CREATED',
    });

    const activated = await transitionMissionStatus({
      service: childService,
      toStatus: 'SEARCHING_EXECUTOR',
      actorType: 'system',
      actorId: null,
    });

    try {
      const masters = await getAdminRecipientIds({
        countryId: parentService.countryId,
        regionId: parentService.regionId,
      });
      if (masters.length > 0) {
        await emitEvent({
          recipients: masters,
          actorId: req.user.id,
          entityType: 'service',
          entityId: activated.id,
          action: 'created',
          title: 'Déplacement interne demandé',
          message: `Un exécutant demande un transport pour la mission #${parentService.id}.`,
          metadata: { parentServiceId: parentService.id },
          countryId: parentService.countryId,
          regionId: parentService.regionId,
          notificationMode: 'create',
        });
      }
    } catch (err) {
      logger.warn('Notification demande logistique échouée:', err?.message || err);
    }

    return res.status(201).json({ mission: activated });
  } catch (e) {
    logger.error({ err: e }, 'mission.requestLogistics.failed');
    return res.status(500).json({ error: 'Erreur lors de la demande de transport' });
  }
};

/* ============================================================
   GET /api/v1/missions/:id/track — suivi en direct (client propriétaire), section 4.2.
============================================================ */
exports.track = async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ error: 'Mission introuvable' });

    // Sous-mission mobilité interne, jamais accessible à un client même via clientId hérité
    // (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §4) — même garde que updateStatus.
    if (service.parentServiceId && req.user.role === 'client') {
      return res.status(403).json({ error: 'Accès interdit pour cette mission' });
    }

    let isExecutor = false;

    if (req.user.role === 'client') {
      if (String(service.clientId) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Accès interdit pour cette mission' });
      }
    } else if (req.user.role === 'agent') {
      if (String(service.agentId) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Accès interdit pour cette mission' });
      }
      // Supervision passive (voir exports.updateStatus) : un agent ne pilote la mission que s'il
      // en est réellement l'exécutant (executionType='agent'), sinon simple lecture superviseur.
      isExecutor = service.executionType === 'agent';
    } else if (req.user.role === 'provider') {
      const provider = await findProviderForUser(req.user.id);
      if (!provider || String(service.providerId) !== String(provider.id)) {
        return res.status(403).json({ error: 'Accès interdit pour cette mission' });
      }
      isExecutor = true;
    } else {
      return res.status(403).json({ error: 'Accès interdit pour cette mission' });
    }

    const location = await ExecutorLocation.findOne({
      where: { serviceId: service.id },
      order: [['recordedAt', 'DESC']],
    });

    const position = serializeOptionalPosition(location);
    let etaMinutes = null;
    const destLat = Number(service.latitude);
    const destLng = Number(service.longitude);
    const pickupLat = Number(service.pickupLatitude);
    const pickupLng = Number(service.pickupLongitude);
    const headingToPickup = ['ASSIGNED', 'EN_ROUTE'].includes(service.missionStatus);
    const etaTarget =
      headingToPickup && Number.isFinite(pickupLat) && Number.isFinite(pickupLng)
        ? { lat: pickupLat, lng: pickupLng }
        : Number.isFinite(destLat) && Number.isFinite(destLng)
        ? { lat: destLat, lng: destLng }
        : null;

    const shouldCalculateEta = String(req.query.skipEta || '') !== '1';
    if (shouldCalculateEta && position && !position.isStale && etaTarget) {
      const result = await getDistanceMatrix(
        [{ lat: position.latitude, lng: position.longitude }],
        [etaTarget]
      );
      const element = result?.rows?.[0]?.[0];
      if (element?.status === 'OK' && element.durationSeconds != null) {
        etaMinutes = Math.round(element.durationSeconds / 60);
      }
    }

    // Slug filière — sert uniquement à l'affichage conditionnel côté client (ex. réconciliation
    // cash livraison §5, plaque visible Mobilité §2 — docs/DEV_SPEC_TERANGA_v7_PHASE4.md), jamais
    // à une règle de permission.
    let tradeCategorySlug = null;
    if (service.tradeCategoryId) {
      const tradeCategoryRecord = await TradeCategory.findByPk(service.tradeCategoryId, {
        attributes: ['slug'],
      });
      tradeCategorySlug = tradeCategoryRecord?.slug || null;
    }

    // Réputation visible (docs/DEV_SPEC_TERANGA_v4_PHASE0.md §3.1) — signal de réassurance montré
    // au moment où le client sait qui est affecté, pas un outil de sélection (l'affectation reste
    // manuelle, admin/master). toPublicDTO() garantit l'anonymisation (jamais phone/email/legal_name).
    // Plaque visible uniquement pour Teranga Taxi (docs/DEV_SPEC_TERANGA_v7_PHASE4.md §2) — le
    // client attend physiquement un véhicule identifiable, contrairement aux autres filières.
    let provider = null;
    let vehicle = null;
    if (service.providerId) {
      const providerRecord = await Provider.findByPk(service.providerId);
      provider = providerRecord
        ? providerRecord.toPublicDTO({
            includePlate: tradeCategorySlug === 'mobilite' && !service.vehicleId,
          })
        : null;
    }
    if (tradeCategorySlug === 'mobilite' && service.vehicleId) {
      const vehicleRecord = await Vehicle.findByPk(service.vehicleId);
      vehicle = vehicleRecord ? vehicleRecord.toPublicDTO() : null;
    }

    const [assistancePhone, rating] = await Promise.all([
      resolveAssistancePhone(service),
      MissionRating.findOne({
        where: { serviceId: service.id },
        attributes: ['id', 'score', 'comment', 'createdAt'],
      }),
    ]);
    const canSeeStartCode =
      req.user.role === 'client' &&
      tradeCategorySlug === 'mobilite' &&
      !service.startAuthorizedAt &&
      ['CREATED', 'SEARCHING_EXECUTOR', 'ASSIGNED', 'EN_ROUTE', 'ON_SITE'].includes(
        service.missionStatus
      );

    return res.status(200).json({
      tradeCategorySlug,
      missionStatus: service.missionStatus,
      status: service.status,
      title: service.title,
      budget: service.budget,
      currency: service.currency,
      executionType: service.executionType,
      viewerRole: req.user.role,
      isExecutor,
      parentServiceId: service.parentServiceId || null,
      acceptanceDeadlineAt: service.acceptanceDeadlineAt || null,
      realtimeTrackingRequired: false,
      assistancePhone,
      startCode: canSeeStartCode ? getMissionStartCode(service) : null,
      startAuthorizedAt: service.startAuthorizedAt || null,
      startAuthorizationMethod: service.startAuthorizationMethod || null,
      rating: rating || null,
      provider,
      vehicle,
      pickupAddress: service.pickupAddress || null,
      requestedVehicleType: service.requestedVehicleType || null,
      packageType: service.packageType || null,
      recipientName: service.recipientName || null,
      recipientPhone: service.recipientPhone || null,
      packageHandling: Array.isArray(service.packageHandling) ? service.packageHandling : [],
      pickupLatitude: service.pickupLatitude != null ? Number(service.pickupLatitude) : null,
      pickupLongitude: service.pickupLongitude != null ? Number(service.pickupLongitude) : null,
      destination:
        Number.isFinite(destLat) && Number.isFinite(destLng)
          ? { latitude: destLat, longitude: destLng, address: service.address }
          : null,
      position,
      etaMinutes,
    });
  } catch (e) {
    logger.error({ err: e }, 'mission.track.failed');
    return res.status(500).json({ error: 'Erreur lors de la récupération du suivi' });
  }
};

/* ============================================================
   GET /api/v1/missions/mine — missions filière assignées au compte connecté (agent superviseur
   ou exécutant, provider exécutant). Les missions classiques (executionType='agent',
   missionStatus toujours null) restent sur /services/agent/services — non dupliquées ici.
============================================================ */
exports.mine = async (req, res) => {
  try {
    const { limit, offset, page } = getPagination(req);
    const tradeCategorySlug = String(req.query.tradeCategorySlug || '').trim();

    let where;
    if (req.user.role === 'agent') {
      where = { agentId: req.user.id, missionStatus: { [Op.ne]: null } };
    } else if (req.user.role === 'provider') {
      const provider = await findProviderForUser(req.user.id);
      if (!provider) {
        return res.json({ missions: [], pagination: { page, limit, offset, total: 0 } });
      }
      where = { providerId: provider.id };
    } else {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    if (tradeCategorySlug) {
      const categoryIds = (
        await TradeCategory.findAll({
          where: { slug: tradeCategorySlug },
          attributes: ['id'],
        })
      ).map((category) => category.id);
      where.tradeCategoryId = categoryIds.length ? { [Op.in]: categoryIds } : -1;
    }

    const { rows, count } = await Service.findAndCountAll({
      where,
      include: [
        { model: User, as: 'client', attributes: ['id', 'firstName', 'lastName', 'phone'] },
        { model: TradeCategory, as: 'tradeCategory', attributes: ['id', 'name', 'slug'] },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return res.json({ missions: rows, pagination: { page, limit, offset, total: count } });
  } catch (e) {
    logger.error({ err: e }, 'mission.mine.failed');
    return res.status(500).json({ error: 'Erreur lors de la récupération de vos missions' });
  }
};

const RIDE_TERMINAL_STATUSES = [
  'COMPLETED',
  'CLOSED',
  'CANCELLED_BY_CLIENT',
  'NO_EXECUTOR_FOUND',
  'VALIDATED',
  'RESOLVED_REFUND',
  'RESOLVED_REDO',
  'RESOLVED_CLOSED',
];

async function getTradeCategoryIdsBySlug(slug) {
  return (
    await TradeCategory.findAll({
      where: { slug },
      attributes: ['id'],
    })
  ).map((category) => category.id);
}

function rideListIncludes({ includeClient = false } = {}) {
  return [
    includeClient
      ? {
          model: User,
          as: 'client',
          attributes: ['id', 'firstName', 'lastName', 'phone'],
        }
      : null,
    { model: TradeCategory, as: 'tradeCategory', attributes: ['id', 'name', 'slug'] },
  ].filter(Boolean);
}

/* Listes Taxi dédiées. Le stockage reste partagé avec Service pour compatibilité,
   mais ces endpoints n'exposent plus ce détail historique dans l'expérience. */
exports.myRides = async (req, res) => {
  try {
    const { limit, offset, page } = getPagination(req, 25, 100);
    const categoryIds = await getTradeCategoryIdsBySlug('mobilite');
    if (!categoryIds.length) {
      return res.json({ rides: [], pagination: { page, limit, offset, total: 0 } });
    }

    const { rows, count } = await Service.findAndCountAll({
      where: {
        clientId: req.user.id,
        parentServiceId: null,
        tradeCategoryId: { [Op.in]: categoryIds },
      },
      include: rideListIncludes(),
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return res.json({ rides: rows, pagination: { page, limit, offset, total: count } });
  } catch (e) {
    logger.error({ err: e }, 'mission.my_rides.failed');
    return res.status(500).json({ error: 'Erreur lors de la récupération de vos courses' });
  }
};

exports.myDeliveries = async (req, res) => {
  try {
    const { limit, offset, page } = getPagination(req, 25, 100);
    const categoryIds = await getTradeCategoryIdsBySlug('livraison');
    if (!categoryIds.length) {
      return res.json({ deliveries: [], pagination: { page, limit, offset, total: 0 } });
    }

    const { rows, count } = await Service.findAndCountAll({
      where: {
        clientId: req.user.id,
        parentServiceId: null,
        tradeCategoryId: { [Op.in]: categoryIds },
      },
      include: rideListIncludes(),
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return res.json({ deliveries: rows, pagination: { page, limit, offset, total: count } });
  } catch (e) {
    logger.error({ err: e }, 'mission.my_deliveries.failed');
    return res.status(500).json({ error: 'Erreur lors de la récupération de vos livraisons' });
  }
};

exports.dispatchRides = async (req, res) => {
  try {
    const { limit, offset, page } = getPagination(req, 40, 100);
    const categoryIds = await getTradeCategoryIdsBySlug('mobilite');
    if (!categoryIds.length) {
      return res.json({ rides: [], pagination: { page, limit, offset, total: 0 } });
    }

    const where = {
      parentServiceId: null,
      tradeCategoryId: { [Op.in]: categoryIds },
    };
    if (String(req.query.history || '') !== '1') {
      where.missionStatus = { [Op.notIn]: RIDE_TERMINAL_STATUSES };
    }
    if (req.user.regionId) where.regionId = req.user.regionId;
    else if (req.user.countryId) where.countryId = req.user.countryId;
    else if (Number.isFinite(Number(req.query.countryId))) {
      where.countryId = Number(req.query.countryId);
    }

    const { rows, count } = await Service.findAndCountAll({
      where,
      include: rideListIncludes({ includeClient: true }),
      order: [['createdAt', 'ASC']],
      limit,
      offset,
      distinct: true,
    });

    return res.json({ rides: rows, pagination: { page, limit, offset, total: count } });
  } catch (e) {
    logger.error({ err: e }, 'mission.dispatch_rides.failed');
    return res.status(500).json({ error: 'Erreur lors du chargement des courses Taxi' });
  }
};
