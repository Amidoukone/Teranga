'use strict';

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Service, User, Property, TradeCategory } = require('../../models');
const { normalizePhone, isValidPhone } = require('../utils/contactIdentity');
const { notifyServiceCreated } = require('../services/serviceNotification.service');
const { geocodeAddress } = require('../services/geocoding.service');
const { estimateMission } = require('../services/priceEstimate.service');
const { getMissionStartCode } = require('../services/missionSafety.service');
const { resolveMissionGeoScope } = require('../utils/resolveMissionGeoScope');
const { resolveGeoScope, countryHasActiveMaster, rotateRecoveryCodes } = require('./auth.controller');
const { PICKUP_REQUIRED_SLUGS } = require('./mission.controller');
const { isGlobalAdmin } = require('../utils/geoScope');
const { resolveDeliveryDetails } = require('../utils/deliveryDetails');
const logger = require('../utils/logger');

/**
 * Canal opérateur téléphone (docs/DEV_SPEC_TERANGA_v7_PHASE4.md §3) — un admin/master saisit
 * une mission au nom d'un appelant qui n'a pas l'app. Distinct de missionRequest.controller.js
 * (point d'entrée invité homepage) : celui-ci pose les cookies d'auth du compte trouvé/créé
 * dans la réponse, ce qui écraserait la session de l'opérateur si réutilisé tel quel depuis
 * son navigateur. Ici, aucune session n'est ouverte pour le client — l'opérateur reste
 * connecté avec son propre compte admin, et la mission créée est immédiatement exploitable
 * pour affectation (POST .../assign) depuis la même vue.
 *
 * Pas de vérification de PIN pour un compte existant : l'opérateur n'a pas le PIN de
 * l'appelant, et l'autorisation vient de son propre rôle admin, pas d'un secret client (une
 * différence assumée avec le flux invité homepage, où n'importe qui peut appeler l'endpoint).
 */
exports.create = async (req, res) => {
  try {
    const {
      phone: rawPhone,
      pin,
      firstName,
      countryId,
      requestKind,
      tradeCategoryId,
      serviceType,
      title,
      description,
      address,
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

    const phone = normalizePhone(rawPhone);
    if (!isValidPhone(phone)) {
      return res.status(400).json({ error: 'Téléphone invalide' });
    }

    // Un master (admin scopé pays) ne peut saisir une course que pour son propre pays — même
    // règle d'écriture que le reste de l'app (docs/DEV_SPEC_TERANGA_v7_PHASE4.md §4). Sans ce
    // garde, `requireRoles('admin')` seul laisserait un master agir hors de son scope.
    if (!isGlobalAdmin(req.user) && Number(req.user.countryId) !== Number(countryId)) {
      return res.status(403).json({ error: 'Accès interdit hors de votre pays' });
    }

    let tradeCategory = null;
    if (requestKind === 'trade_category') {
      tradeCategory = await TradeCategory.findOne({
        where: { id: tradeCategoryId, isActive: true },
      });
      if (!tradeCategory) {
        return res.status(400).json({ error: 'Filière invalide ou inactive' });
      }
    }

    if (PICKUP_REQUIRED_SLUGS.includes(tradeCategory?.slug)) {
      const hasDestination = Boolean(String(address || '').trim()) ||
        (rawLatitude != null && rawLongitude != null);
      const hasPickup = Boolean(String(rawPickupAddress || '').trim()) ||
        (rawPickupLatitude != null && rawPickupLongitude != null);
      if (!hasDestination || !hasPickup) {
        return res.status(400).json({
          error: 'Le point de départ et la destination sont obligatoires pour cette filière',
        });
      }
    }

    let user = await User.findOne({ where: { phone } });
    let isNewAccount = false;
    let recoveryCodes = [];
    let generatedPin = null;

    if (user) {
      if (user.role !== 'client') {
        return res.status(409).json({
          error:
            'Ce numéro est associé à un compte existant non-client. Utilisez son espace habituel pour cette demande.',
        });
      }
    } else {
      const geoScope = await resolveGeoScope({ countryId });
      if (geoScope?.error) {
        return res.status(400).json({ error: geoScope.error });
      }

      const hasMaster = await countryHasActiveMaster(geoScope.countryId);
      if (!hasMaster) {
        return res.status(400).json({
          error: 'Nos services ne sont pas disponibles pour le moment dans ce pays.',
        });
      }

      // Pin fourni par l'opérateur (l'appelant l'a choisi au téléphone) ou généré
      // aléatoirement — dans les deux cas transmis à l'appelant via recoveryCodes/réponse,
      // jamais silencieusement perdu (le compte doit rester accessible ensuite).
      const effectivePin = pin && String(pin).trim() ? String(pin).trim() : crypto.randomBytes(6).toString('hex');
      if (!pin) generatedPin = effectivePin;
      const passwordHash = await bcrypt.hash(effectivePin, 10);

      user = await User.create({
        phone,
        passwordHash,
        firstName: firstName || null,
        role: 'client',
        country: geoScope.countryIso || null,
        countryId: geoScope.countryId,
        regionId: null,
        language: 'fr',
      });
      isNewAccount = true;

      try {
        recoveryCodes = await rotateRecoveryCodes({ userId: user.id, req });
      } catch (recoveryErr) {
        logger.warn({ err: recoveryErr }, 'missionPhoneOrder.create.recovery_codes_generation_failed');
      }
    }

    const trimmedAddress = address ? String(address).trim() : null;

    let latitude = rawLatitude != null ? Number(rawLatitude) : null;
    let longitude = rawLongitude != null ? Number(rawLongitude) : null;
    let geocodedCountryIso = null;
    let geocodedAdminAreaName = null;

    if ((!Number.isFinite(latitude) || !Number.isFinite(longitude)) && trimmedAddress) {
      const geocoded = (await geocodeAddress(trimmedAddress)) || {
        latitude: null,
        longitude: null,
        countryIso: null,
        adminAreaName: null,
      };
      if (!geocoded) {
        return res.status(400).json({
          error: 'Adresse introuvable. Veuillez préciser un lieu plus précis.',
        });
      }
      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
      geocodedCountryIso = geocoded.countryIso;
      geocodedAdminAreaName = geocoded.adminAreaName;
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      latitude = null;
      longitude = null;
    }

    // Retrait/départ — même règle que mission.controller.js exports.create (docs/DEV_SPEC_TERANGA_v7_PHASE4.md §1.1/§3.1).
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
          error: 'Adresse de départ introuvable. Veuillez préciser un lieu plus précis.',
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
      fallbackCountryId: user.countryId,
      fallbackRegionId: user.regionId,
      tradeCategoryScope: tradeCategory
        ? { countryId: tradeCategory.countryId, regionId: tradeCategory.regionId }
        : null,
    });
    if (missionGeoScope.error) {
      return res.status(400).json({ error: missionGeoScope.error });
    }

    const executionType = tradeCategory ? 'provider' : 'agent';
    const requestedVehicleType =
      tradeCategory?.slug === 'mobilite' ? rawRequestedVehicleType || 'motorcycle' : null;
    const packageType = tradeCategory?.slug === 'livraison' ? rawPackageType || 'small' : null;
    const deliveryDetails = resolveDeliveryDetails(tradeCategory, {
      recipientName: rawRecipientName,
      recipientPhone: rawRecipientPhone,
      packageHandling: rawPackageHandling,
    });

    // Estimation pour renseigner le budget (docs/DEV_SPEC_TERANGA_v7_PHASE4.md §3.1) — même
    // appel que mission.controller.js exports.create, jamais bloquant si elle échoue.
    const estimate = await estimateMission({
      user,
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
      clientId: user.id,
      agentId: null,
      createdById: req.user.id,
      propertyId: null,
      type: tradeCategory ? 'other' : serviceType,
      title: String(title).trim(),
      description: description ? String(description).trim() : null,
      contactPerson: firstName || user.firstName || null,
      contactPhone: phone,
      address: trimmedAddress,
      latitude,
      longitude,
      pickupAddress,
      pickupLatitude,
      pickupLongitude,
      requestedVehicleType,
      packageType,
      ...deliveryDetails,
      budget: estimate.basePrice ?? estimate.minPrice ?? null,
      currency: estimate.currency,
      status: 'created',
      countryId: missionGeoScope.countryId,
      regionId: missionGeoScope.regionId,
      executionType,
      tradeCategoryId: tradeCategory ? tradeCategory.id : null,
      missionStatus: tradeCategory ? 'CREATED' : null,
    });

    const fullService = await Service.findByPk(service.id, {
      include: [
        { model: User, as: 'client', attributes: ['id', 'firstName', 'lastName', 'phone'] },
        { model: Property, as: 'property', attributes: ['id', 'title', 'city', 'address'] },
      ],
    });

    await notifyServiceCreated({
      actorId: req.user.id,
      service,
      fullService,
      targetClientId: user.id,
      countryId: missionGeoScope.countryId,
      regionId: missionGeoScope.regionId,
    });

    return res.status(201).json({
      message: isNewAccount ? 'Compte créé et course enregistrée' : 'Course enregistrée',
      isNewAccount,
      generatedPin,
      recoveryCodes,
      startCode:
        tradeCategory?.slug === 'mobilite' ? getMissionStartCode(fullService) : null,
      mission: fullService,
    });
  } catch (e) {
    if (e.status === 400) return res.status(400).json({ error: e.message });
    logger.error({ err: e }, 'missionPhoneOrder.create.failed');
    return res.status(500).json({ error: 'Erreur lors de la création de la course' });
  }
};
