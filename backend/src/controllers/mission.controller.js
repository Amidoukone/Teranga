'use strict';

// CrÃ©ation de mission guidÃ©e, utilisateur dÃ©jÃ  authentifiÃ© (docs/DEV_SPEC_TERANGA_v3.md
// section 4.1 + 3.3). Distinct de missionRequest.controller.js (point d'entrÃ©e invitÃ© de la
// homepage, Lot 2) : ici pas de bootstrap de compte, le client a dÃ©jÃ  une session.

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

// LibellÃ©s courts pour les notifications de transition (section 4.2/2).
const MISSION_STATUS_LABELS = {
  SEARCHING_EXECUTOR: 'Recherche dâ€™un exÃ©cutant',
  ASSIGNED: 'Mission assignÃ©e',
  EN_ROUTE: 'ExÃ©cutant en route',
  ON_SITE: 'ExÃ©cutant arrivÃ© sur place',
  IN_PROGRESS: 'Mission en cours',
  COMPLETED: 'Mission terminÃ©e',
  VALIDATED: 'Mission validÃ©e',
  CLOSED: 'Mission clÃ´turÃ©e',
  CANCELLED_BY_CLIENT: 'Mission annulÃ©e par le client',
  NO_EXECUTOR_FOUND: 'Aucun exÃ©cutant trouvÃ©',
  DISPUTED: 'Litige ouvert',
  RESOLVED_REFUND: 'Litige rÃ©solu (remboursement)',
  RESOLVED_REDO: 'Litige rÃ©solu (reprise)',
  RESOLVED_CLOSED: 'Litige clÃ´turÃ©',
};

// Transitions que le client propriÃ©taire peut dÃ©clencher lui-mÃªme (section 2).
const CLIENT_TRIGGERABLE = ['CANCELLED_BY_CLIENT', 'VALIDATED'];
// Transitions que l'exÃ©cutant assignÃ© (agent ou prestataire) peut dÃ©clencher (section 2).
const EXECUTOR_TRIGGERABLE = ['EN_ROUTE', 'ON_SITE', 'IN_PROGRESS', 'COMPLETED'];
// Transitions gÃ©rÃ©es exclusivement par le parcours de litige structurÃ©
// (docs/DEV_SPEC_TERANGA_v4_PHASE0.md Â§2) â€” jamais via ce PATCH gÃ©nÃ©rique, mÃªme pour un admin,
// pour qu'une rÃ©solution ne puisse jamais se faire sans motif/preuve (ouverture) ou sans
// justification Ã©crite (rÃ©solution). Voir dispute.controller.js.
const DISPUTE_MANAGED_STATUSES = ['DISPUTED', 'RESOLVED_REFUND', 'RESOLVED_REDO', 'RESOLVED_CLOSED'];

// FiliÃ¨res nÃ©cessitant un point de dÃ©part distinct de la destination â€” colis Ã  retirer
// (livraison) ou passager Ã  prendre en charge (mobilitÃ©, Teranga Taxi, docs/DEV_SPEC_TERANGA_v7_PHASE4.md
// Â§1.1). MÃªme mÃ©canisme de capture/dispatch pour les deux, seul le libellÃ© change cÃ´tÃ© client.
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
    const err = new Error('FiliÃ¨re invalide ou inactive');
    err.status = 400;
    throw err;
  }
  return tradeCategory;
}

/* ============================================================
   GET /api/v1/missions/reverse-geocode â€” coordonnÃ©es -> adresse lisible, utilisÃ© par l'Ã©tape
   Lieu du wizard (bouton "Utiliser ma position actuelle") : la clÃ© navigateur est restreinte Ã 
   Maps JavaScript/Places (jamais Geocoding), ce gÃ©ocodage doit donc passer par le backend
   (clÃ© serveur). Best-effort : ne bloque jamais la capture des coordonnÃ©es cÃ´tÃ© client.
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
    return res.status(500).json({ error: 'Erreur lors du gÃ©ocodage inverse' });
  }
};

/* ============================================================
   POST /api/v1/missions/estimate â€” aucune Ã©criture DB
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

    // Estimation basÃ©e sur la destination rÃ©elle (adresse dÃ©jÃ  saisie Ã  l'Ã©tape Location du
    // wizard) quand elle est disponible â€” jamais bloquant : un aperÃ§u de prix qui Ã©choue Ã  se
    // gÃ©olocaliser retombe simplement sur le scope du compte (voir mission.controller.js create
    // pour la version stricte utilisÃ©e Ã  la crÃ©ation effective).
    const trimmedAddress = rawAddress ? String(rawAddress).trim() : null;
    let latitude = rawLatitude != null ? Number(rawLatitude) : null;
    let longitude = rawLongitude != null ? Number(rawLongitude) : null;
    const pickupLatitude = rawPickupLatitude != null ? Number(rawPickupLatitude) : null;
    const pickupLongitude = rawPickupLongitude != null ? Number(rawPickupLongitude) : null;
    let geocodedCountryIso = null;
    let geocodedAdminAreaName = null;

    if (trimmedAddress) {
      const geocoded = (await geocodeAddress(trimmedAddress)) || {
        latitude: null,
        longitude: null,
        countryIso: null,
        adminAreaName: null,
      };
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
        return res.status(404).json({ error: 'Lieu enregistrÃ© introuvable' });
      }
      trimmedAddress = savedLocation.address;
      latitude = Number(savedLocation.latitude);
      longitude = Number(savedLocation.longitude);
    }

    // Pays/rÃ©gion de destination (gÃ©ocodÃ©s, best-effort) : la mission est routÃ©e/tarifÃ©e selon
    // oÃ¹ elle a rÃ©ellement lieu, pas selon le compte du client (correction transfrontaliÃ¨re â€”
    // un client Ã  Bamako doit pouvoir demander une mission Ã  Abidjan). Sans biais vers le pays
    // du compte, contrairement Ã  l'ancien comportement.
    let geocodedCountryIso = null;
    let geocodedAdminAreaName = null;
    const hadCoordinatesAlready = Number.isFinite(latitude) && Number.isFinite(longitude);

    if (trimmedAddress && !hadCoordinatesAlready) {
      // CoordonnÃ©es dÃ©rivÃ©es quand un lieu est fourni sans Ãªtre dÃ©jÃ  rÃ©solues cÃ´tÃ© client
      // (dette 0.5, mÃªme rÃ¨gle que missionRequest.controller.js) : gÃ©ocodage serveur, 400 si
      // l'adresse ne rÃ©sout Ã  rien â€” jamais de mission avec une adresse saisie mais des
      // coordonnÃ©es nulles.
      const geocoded = (await geocodeAddress(trimmedAddress)) || {
        latitude: null,
        longitude: null,
        countryIso: null,
        adminAreaName: null,
      };
      if (!geocoded) {
        return res.status(400).json({
          error: 'Adresse introuvable. Veuillez prÃ©ciser un lieu plus prÃ©cis.',
        });
      }
      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
      geocodedCountryIso = geocoded.countryIso;
      geocodedAdminAreaName = geocoded.adminAreaName;
    } else if (trimmedAddress) {
      // CoordonnÃ©es dÃ©jÃ  rÃ©solues (lieu enregistrÃ© ou fournies par le client) : gÃ©ocodage
      // uniquement pour en dÃ©duire le pays/rÃ©gion, jamais bloquant ici puisqu'on a dÃ©jÃ  des
      // coordonnÃ©es valides.
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

    // Retrait â€” obligatoire pour livraison et mobilitÃ© (docs/DEV_SPEC_TERANGA_v7_PHASE4.md Â§1.1,
    // qui Ã©tend la rÃ¨gle posÃ©e en Phase 3 Lot 1). Ne pilote jamais le pays/rÃ©gion de la mission
    // (la dÃ©pose le fait dÃ©jÃ  ci-dessus) : c'est uniquement une seconde position, jamais
    // gÃ©ocodÃ©e pour en dÃ©river un scope.
    let pickupAddress = rawPickupAddress ? String(rawPickupAddress).trim() : null;
    let pickupLatitude = rawPickupLatitude != null ? Number(rawPickupLatitude) : null;
    let pickupLongitude = rawPickupLongitude != null ? Number(rawPickupLongitude) : null;

    if (pickupAddress && (!Number.isFinite(pickupLatitude) || !Number.isFinite(pickupLongitude))) {
      const geocodedPickup = (await geocodeAddress(pickupAddress)) || {
        latitude: null,
        longitude: null,
      };
      if (!geocodedPickup) {
        return res.status(400).json({
          error: 'Adresse de retrait introuvable. Veuillez prÃ©ciser un lieu plus prÃ©cis.',
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
        error: 'Le point de dÃ©part est obligatoire pour cette filiÃ¨re',
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
      // Additive uniquement pour le nouveau flux (0.6.b) â€” mÃªme rÃ¨gle que
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
      message: 'Mission crÃ©Ã©e',
      mission: fullService,
      estimate,
      startCode:
        tradeCategory?.slug === 'mobilite' ? getMissionStartCode(fullService) : null,
    });
  } catch (e) {
    if (e.status === 400) return res.status(400).json({ error: e.message });
    logger.error({ err: e }, 'mission.create.failed');
    return res.status(500).json({ error: 'Erreur lors de la crÃ©ation de la mission' });
  }
};

/* ============================================================
   POST /api/v1/missions/:id/attachments â€” photo + note vocale optionnelles
   (endpoint sÃ©parÃ© de la crÃ©ation, cf. plan section 3 : la mission ne doit
   jamais Ãªtre bloquÃ©e par un Ã©chec d'upload mÃ©dia)
============================================================ */
exports.addAttachments = async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ error: 'Mission introuvable' });
    if (String(service.clientId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'AccÃ¨s interdit pour cette mission' });
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
        'Stockage des piÃ¨ces jointes indisponible. Configurez IMAGEKIT_* ou UPLOADS_ROOT persistant.',
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
        ? 'PiÃ¨ce(s) jointe(s) ajoutÃ©e(s)'
        : "Aucune piÃ¨ce jointe n'a pu Ãªtre ajoutÃ©e",
      attachments: evidences,
    };
    if (failed.length) response.warnings = { failedFiles: failed };

    return res.status(createdIds.length ? 201 : 500).json(response);
  } catch (e) {
    if (e?.code === MISSION_ATTACHMENT_STORAGE_ERROR_CODE) {
      return res.status(503).json({
        error: 'Stockage des piÃ¨ces jointes indisponible. Configurez IMAGEKIT_* ou UPLOADS_ROOT persistant.',
      });
    }
    logger.error({ err: e }, 'mission.addAttachments.failed');
    return res.status(500).json({ error: "Erreur lors de l'ajout des piÃ¨ces jointes" });
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
   POST /api/v1/missions/:id/assign â€” assignation/rÃ©assignation/dÃ©sassignation (admin), section
   4.2/3.3 + extension "superviseur agent" (voir docs internes de ce chantier â€” un agent peut Ãªtre
   posÃ© en plus d'un prestataire sur une mission filiÃ¨re, sans jamais piloter la machine Ã  Ã©tats :
   voir exports.updateStatus). Body : { providerId?, agentId? }, chaque clÃ© indÃ©pendante â€” absente
   = inchangÃ©, null = dÃ©sassigner, nombre = assigner/rÃ©assigner. Pas de short-list ni de calcul
   Distance Matrix ici : le moteur de matching automatique reste le Lot 4 (section 3.4/section 6).
============================================================ */
exports.assign = async (req, res) => {
  let reservedMobilityProviderId = null;
  try {
    const { providerId, agentId, vehicleId } = req.body;

    let service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ error: 'Mission introuvable' });

    if (!canAccessGeoResource(service, req.user)) {
      return res.status(403).json({ error: 'Mission hors scope gÃ©ographique' });
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
    if (vehicleId !== undefined && !isMobility) {
      return res.status(400).json({ error: 'vehicleId est reserve aux courses Mobilite' });
    }

    let directUpdates = {};
    let shouldNotify = false;
    let mobilityProviderToRelease = null;
    let mobilityAssignmentGuard = null;

    // --- Agent superviseur : jamais un moteur de statut, modifiable Ã  tout stade. ---
    if (agentId !== undefined) {
      if (agentId === null) {
        directUpdates.agentId = null;
      } else {
        const agent = await User.findByPk(agentId);
        if (!agent || agent.role !== 'agent') {
          return res.status(400).json({ error: "agentId invalide : ce n'est pas un agent" });
        }
        if (!canAccessGeoResource(service, agent)) {
          return res.status(403).json({ error: 'Agent hors scope gÃ©ographique' });
        }
        directUpdates.agentId = agent.id;
      }
      shouldNotify = true;
    }

    // --- Prestataire : exÃ©cutant, pilote la machine Ã  Ã©tats. ---
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
              'Impossible de dÃ©sassigner Ã  ce stade, rÃ©assignez directement un autre prestataire',
          });
        }
      } else {
        const provider = await findActiveProviderForTradeCategory(providerId, service.tradeCategoryId);
        if (!provider) {
          return res.status(400).json({
            error: 'Prestataire invalide, inactif, ou ne couvrant pas cette filiÃ¨re',
          });
        }

        // Couverture gÃ©ographique : indÃ©pendant du scope de l'admin qui assigne (un admin
        // global n'a pas de restriction de scope, cf. isGlobalAdmin) â€” c'est le prestataire qui
        // doit couvrir le PAYS de destination rÃ©el de la mission, jamais l'inverse.
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
              error: 'Un vÃ©hicule adaptÃ© est requis pour un colis volumineux',
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

        // FenÃªtre d'acceptation (docs/DEV_SPEC_TERANGA_v5_PHASE2.md Â§5.2) â€” uniquement filiÃ¨re
        // MobilitÃ©, NULL partout ailleurs (comportement inchangÃ© pour les autres filiÃ¨res).
        let acceptanceDeadlineAt = null;
        if (service.tradeCategoryId) {
          // Dispatch partagÃ© (docs/DEV_SPEC_TERANGA_v6_PHASE3.md Â§3) : la fenÃªtre d'acceptation
          // n'est pas spÃ©cifique Ã  MobilitÃ©, seule cette condition la limitait artificiellement.
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
          // RÃ©assignation vers un autre exÃ©cutant : pas de transition d'Ã©tat, un nouvel exÃ©cutant
          // prend la suite immÃ©diatement.
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
            error: 'Cette mission ne peut pas Ãªtre (rÃ©)assignÃ©e dans son Ã©tat actuel',
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
        title: MISSION_STATUS_LABELS[service.missionStatus] || 'Mission mise Ã  jour',
        status: service.status,
      });
    }

    return res.status(200).json({ message: 'Assignation mise Ã  jour', mission: service });
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
   POST /api/v1/missions/:id/accept â€” le prestataire assignÃ© confirme la course dans la fenÃªtre
   d'acceptation (docs/DEV_SPEC_TERANGA_v5_PHASE2.md Â§5.2). Aucun changement de statut, juste la
   levÃ©e de la fenÃªtre â€” la mission continue normalement ensuite via updateStatus.
============================================================ */
exports.accept = async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ error: 'Mission introuvable' });

    const provider = await findProviderForUser(req.user.id);
    if (!provider || String(service.providerId) !== String(provider.id)) {
      return res.status(403).json({ error: 'AccÃ¨s interdit' });
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
   POST /api/v1/missions/:id/decline â€” le prestataire assignÃ© refuse (docs/DEV_SPEC_TERANGA_v5_PHASE2.md
   Â§5.2). Retour Ã  SEARCHING_EXECUTOR, notifie le master (rÃ©affectation nÃ©cessaire).
============================================================ */
exports.decline = async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ error: 'Mission introuvable' });

    const provider = await findProviderForUser(req.user.id);
    if (!provider || String(service.providerId) !== String(provider.id)) {
      return res.status(403).json({ error: 'AccÃ¨s interdit' });
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
          title: 'Course refusÃ©e â€” rÃ©affectation nÃ©cessaire',
          message: `Mission #${updated.id} refusÃ©e par le chauffeur assignÃ©.`,
          countryId: updated.countryId,
          regionId: updated.regionId,
          notificationMode: 'create',
        });
      }
    } catch (err) {
      logger.warn('Notification refus course Ã©chouÃ©e:', err?.message || err);
    }

    return res.status(200).json({ mission: updated });
  } catch (e) {
    logger.error({ err: e }, 'mission.decline.failed');
    return res.status(500).json({ error: 'Erreur lors du refus' });
  }
};

/* ============================================================
   PATCH /api/v1/missions/:id/status â€” transition de statut (section 2).
============================================================ */
exports.updateStatus = async (req, res) => {
  try {
    const { toStatus, collectedAmount: rawCollectedAmount } = req.body;
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ error: 'Mission introuvable' });

    // Sous-mission mobilitÃ© interne (docs/DEV_SPEC_TERANGA_v5_PHASE2.md Â§4) : clientId n'est
    // qu'une association technique hÃ©ritÃ©e de la mission mÃ¨re, jamais un vrai droit d'accÃ¨s â€”
    // un client ne doit jamais pouvoir agir sur une sous-mission qui lui est invisible.
    if (service.parentServiceId && req.user.role === 'client') {
      return res.status(403).json({ error: 'AccÃ¨s interdit pour cette transition' });
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
      // Supervision passive (voir exports.assign) : un agent posÃ© comme superviseur sur une
      // mission filiÃ¨re (executionType='provider') ne pilote jamais la machine Ã  Ã©tats â€” seul
      // le prestataire assignÃ© le peut. Un agent ne dÃ©clenche des transitions que sur les
      // missions dont il est rÃ©ellement l'exÃ©cutant (executionType='agent').
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
      // FenÃªtre d'acceptation en attente (docs/DEV_SPEC_TERANGA_v5_PHASE2.md Â§5.2) : le
      // prestataire doit confirmer via /accept avant de pouvoir faire progresser la mission.
      if (allowed && service.acceptanceDeadlineAt) {
        return res.status(400).json({
          error: "Confirmez d'abord la course (voir POST .../accept) avant de la faire progresser",
        });
      }
    }

    if (!allowed) {
      return res.status(403).json({ error: 'AccÃ¨s interdit pour cette transition' });
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
      title: MISSION_STATUS_LABELS[toStatus] || 'Statut de mission mis Ã  jour',
      status: updated.status,
    });

    // ClÃ´ture automatique des sous-missions mobilitÃ© interne Ã  la confirmation de dÃ©pose
    // (docs/DEV_SPEC_TERANGA_v5_PHASE2.md Â§4.3) â€” pas de client Ã  faire valider. La rÃ©putation du
    // chauffeur (bloc ci-dessous) ne s'applique volontairement pas ici : `toStatus` reste
    // 'COMPLETED', pas 'VALIDATED' â€” un dÃ©placement interne n'est pas une mission client Ã 
    // valoriser dans le compteur public.
    if (toStatus === 'COMPLETED' && updated.parentServiceId) {
      updated = await transitionMissionStatus({
        service: updated,
        toStatus: 'VALIDATED',
        actorType: 'system',
        actorId: null,
      });
    }

    // RÃ©conciliation cash Ã  la remise, filiÃ¨re livraison uniquement (docs/DEV_SPEC_TERANGA_v6_PHASE3.md
    // Â§5) â€” `toStatus` (pas `updated.missionStatus`, qui peut avoir Ã©tÃ© recascadÃ© ci-dessus) est la
    // transition rÃ©ellement demandÃ©e par l'exÃ©cutant. Jamais bloquant : un Ã©cart notifie le master,
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
                  title: 'Ã‰cart de montant collectÃ©',
                  message: `Mission #${updated.id} : montant collectÃ© (${collectedAmount}) diffÃ©rent du montant attendu (${budget}).`,
                  countryId: updated.countryId,
                  regionId: updated.regionId,
                  notificationMode: 'create',
                });
              }
            }
          }
        } catch (err) {
          logger.warn('RÃ©conciliation cash Ã©chouÃ©e:', err?.message || err);
        }
      }
    }

    // RÃ©putation (docs/DEV_SPEC_TERANGA_v4_PHASE0.md Â§3.2) â€” VALIDATED est le signal de succÃ¨s
    // fiable (le client confirme), contrairement Ã  CLOSED qui n'est pas systÃ©matiquement atteint
    // dans ce systÃ¨me ; completedMissionsCount n'Ã©tait incrÃ©mentÃ© nulle part avant ce lot.
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
        logger.warn('Mise Ã  jour rÃ©putation prestataire Ã©chouÃ©e:', err?.message || err);
      }
    }

    if (updated.providerId && ['COMPLETED', 'CANCELLED_BY_CLIENT'].includes(toStatus)) {
      await releaseMobilityProviderIfEligible(updated.providerId);
    }

    return res.status(200).json({ mission: updated });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    logger.error({ err: e }, 'mission.updateStatus.failed');
    return res.status(500).json({ error: 'Erreur lors de la mise Ã  jour du statut' });
  }
};

/* ============================================================
   POST /api/v1/missions/:id/location â€” ping de position (agent, provider), section 3.3/4.2.
   Ne jamais appeler Distance Matrix ici (section 8) â€” coÃ»t facturÃ© Ã  l'appel, rÃ©servÃ© au
   recalcul explicite (GET .../track).
============================================================ */
exports.pingLocation = async (req, res) => {
  try {
    const { latitude, longitude, accuracyMeters, headingDegrees } = req.body;
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ error: 'Mission introuvable' });

    if (!ACTIVE_STATUSES.includes(service.missionStatus)) {
      return res.status(400).json({
        error: "Cette mission n'est pas dans une fenÃªtre d'exÃ©cution active",
      });
    }

    let executorType = null;
    let executorId = null;

    if (req.user.role === 'agent') {
      if (String(service.agentId) !== String(req.user.id)) {
        return res.status(403).json({ error: 'AccÃ¨s interdit' });
      }
      executorType = 'agent';
      executorId = req.user.id;
    } else if (req.user.role === 'provider') {
      const provider = await findProviderForUser(req.user.id);
      if (!provider || String(service.providerId) !== String(provider.id)) {
        return res.status(403).json({ error: 'AccÃ¨s interdit' });
      }
      executorType = 'provider';
      executorId = provider.id;
    } else {
      return res.status(403).json({ error: 'AccÃ¨s interdit' });
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

    return res.status(201).json({ message: 'Position enregistrÃ©e', location });
  } catch (e) {
    logger.error({ err: e }, 'mission.pingLocation.failed');
    return res.status(500).json({ error: "Erreur lors de l'enregistrement de la position" });
  }
};

/* ============================================================
   POST /api/v1/missions/:id/logistics-request â€” un exÃ©cutant (agent ou prestataire) en mission
   active demande un dÃ©placement interne (docs/DEV_SPEC_TERANGA_v5_PHASE2.md Â§4.2). CrÃ©e une
   sous-mission filiÃ¨re MobilitÃ©, invisible du client (clientId hÃ©ritÃ© = association technique
   uniquement, jamais notifiÃ©). Ne bloque jamais la mission mÃ¨re si aucun chauffeur n'est trouvÃ©
   ensuite (Â§4.4) â€” c'est le job de la Phase 0/mission mÃ¨re qui continue son cours normalement.
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
    if (!isExecutor) return res.status(403).json({ error: 'AccÃ¨s interdit' });

    if (!ACTIVE_STATUSES.includes(parentService.missionStatus)) {
      return res.status(400).json({
        error: "Cette mission n'est pas dans une fenÃªtre d'exÃ©cution active",
      });
    }

    // Une seule sous-mission logistique active Ã  la fois par mission mÃ¨re â€” Ã©vite les doublons
    // en cas de double-clic, pas une vraie rÃ¨gle mÃ©tier au-delÃ  de Ã§a.
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
      return res.status(503).json({ error: 'FiliÃ¨re MobilitÃ© indisponible pour le moment' });
    }

    const { latitude, longitude, address } = req.body;

    const childService = await Service.create({
      clientId: parentService.clientId,
      agentId: null,
      createdById: req.user.id,
      propertyId: null,
      parentServiceId: parentService.id,
      type: 'other',
      title: `DÃ©placement â€” mission #${parentService.id}`,
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
          title: 'DÃ©placement interne demandÃ©',
          message: `Un exÃ©cutant demande un transport pour la mission #${parentService.id}.`,
          metadata: { parentServiceId: parentService.id },
          countryId: parentService.countryId,
          regionId: parentService.regionId,
          notificationMode: 'create',
        });
      }
    } catch (err) {
      logger.warn('Notification demande logistique Ã©chouÃ©e:', err?.message || err);
    }

    return res.status(201).json({ mission: activated });
  } catch (e) {
    logger.error({ err: e }, 'mission.requestLogistics.failed');
    return res.status(500).json({ error: 'Erreur lors de la demande de transport' });
  }
};

/* ============================================================
   GET /api/v1/missions/:id/track â€” suivi en direct (client propriÃ©taire), section 4.2.
============================================================ */
exports.track = async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ error: 'Mission introuvable' });

    // Sous-mission mobilitÃ© interne, jamais accessible Ã  un client mÃªme via clientId hÃ©ritÃ©
    // (docs/DEV_SPEC_TERANGA_v5_PHASE2.md Â§4) â€” mÃªme garde que updateStatus.
    if (service.parentServiceId && req.user.role === 'client') {
      return res.status(403).json({ error: 'AccÃ¨s interdit pour cette mission' });
    }

    let isExecutor = false;

    if (req.user.role === 'client') {
      if (String(service.clientId) !== String(req.user.id)) {
        return res.status(403).json({ error: 'AccÃ¨s interdit pour cette mission' });
      }
    } else if (req.user.role === 'agent') {
      if (String(service.agentId) !== String(req.user.id)) {
        return res.status(403).json({ error: 'AccÃ¨s interdit pour cette mission' });
      }
      // Supervision passive (voir exports.updateStatus) : un agent ne pilote la mission que s'il
      // en est rÃ©ellement l'exÃ©cutant (executionType='agent'), sinon simple lecture superviseur.
      isExecutor = service.executionType === 'agent';
    } else if (req.user.role === 'provider') {
      const provider = await findProviderForUser(req.user.id);
      if (!provider || String(service.providerId) !== String(provider.id)) {
        return res.status(403).json({ error: 'AccÃ¨s interdit pour cette mission' });
      }
      isExecutor = true;
    } else {
      return res.status(403).json({ error: 'AccÃ¨s interdit pour cette mission' });
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

    // Slug filiÃ¨re â€” sert uniquement Ã  l'affichage conditionnel cÃ´tÃ© client (ex. rÃ©conciliation
    // cash livraison Â§5, plaque visible MobilitÃ© Â§2 â€” docs/DEV_SPEC_TERANGA_v7_PHASE4.md), jamais
    // Ã  une rÃ¨gle de permission.
    let tradeCategorySlug = null;
    if (service.tradeCategoryId) {
      const tradeCategoryRecord = await TradeCategory.findByPk(service.tradeCategoryId, {
        attributes: ['slug'],
      });
      tradeCategorySlug = tradeCategoryRecord?.slug || null;
    }

    // RÃ©putation visible (docs/DEV_SPEC_TERANGA_v4_PHASE0.md Â§3.1) â€” signal de rÃ©assurance montrÃ©
    // au moment oÃ¹ le client sait qui est affectÃ©, pas un outil de sÃ©lection (l'affectation reste
    // manuelle, admin/master). toPublicDTO() garantit l'anonymisation (jamais phone/email/legal_name).
    // Plaque visible uniquement pour Teranga Taxi (docs/DEV_SPEC_TERANGA_v7_PHASE4.md Â§2) â€” le
    // client attend physiquement un vÃ©hicule identifiable, contrairement aux autres filiÃ¨res.
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
    return res.status(500).json({ error: 'Erreur lors de la rÃ©cupÃ©ration du suivi' });
  }
};

/* ============================================================
   GET /api/v1/missions/mine â€” missions filiÃ¨re assignÃ©es au compte connectÃ© (agent superviseur
   ou exÃ©cutant, provider exÃ©cutant). Les missions classiques (executionType='agent',
   missionStatus toujours null) restent sur /services/agent/services â€” non dupliquÃ©es ici.
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
      return res.status(403).json({ error: 'AccÃ¨s interdit' });
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
    return res.status(500).json({ error: 'Erreur lors de la rÃ©cupÃ©ration de vos missions' });
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

/* Listes Taxi dÃ©diÃ©es. Le stockage reste partagÃ© avec Service pour compatibilitÃ©,
   mais ces endpoints n'exposent plus ce dÃ©tail historique dans l'expÃ©rience. */
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
    return res.status(500).json({ error: 'Erreur lors de la rÃ©cupÃ©ration de vos courses' });
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
    return res.status(500).json({ error: 'Erreur lors de la rÃ©cupÃ©ration de vos livraisons' });
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

