'use strict';

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Service, User, Property, TradeCategory } = require('../../models');
const { normalizePhone, isValidPhone } = require('../utils/contactIdentity');
const { notifyServiceCreated } = require('../services/serviceNotification.service');
const { geocodeAddress, reverseGeocode } = require('../services/geocoding.service');
const { estimateMission } = require('../services/priceEstimate.service');
const { getMissionStartCode } = require('../services/missionSafety.service');
const { resolveMissionGeoScope } = require('../utils/resolveMissionGeoScope');
const logger = require('../utils/logger');
const {
  signAccess,
  issueRefreshToken,
  issueCsrfToken,
  setAuthCookies,
  toAuthUser,
  countryHasActiveMaster,
  resolveGeoScope,
  rotateRecoveryCodes,
  parseDurationToMs,
  ACCESS_EXPIRES,
} = require('./auth.controller');

const PICKUP_REQUIRED_SLUGS = ['livraison', 'mobilite'];

function resolveRequestedVehicleType(tradeCategory, requestedVehicleType) {
  if (tradeCategory?.slug !== 'mobilite') return null;
  return requestedVehicleType || 'motorcycle';
}

/**
 * Aperçu public du trajet — aucune identité et aucune écriture. Le pays est fourni par le
 * catalogue public (champ masqué quand un seul pays est disponible), puis la destination réelle
 * peut affiner le scope si Google renvoie son pays/région.
 */
exports.estimate = async (req, res) => {
  try {
    const {
      countryId,
      tradeCategoryId,
      requestedVehicleType: rawRequestedVehicleType,
      address: rawAddress,
      latitude: rawLatitude,
      longitude: rawLongitude,
      pickupAddress: rawPickupAddress,
      pickupLatitude: rawPickupLatitude,
      pickupLongitude: rawPickupLongitude,
    } = req.body;

    const tradeCategory = await TradeCategory.findOne({
      where: { id: tradeCategoryId, isActive: true },
    });
    if (!tradeCategory) return res.status(400).json({ error: 'Filière invalide ou inactive' });

    let address = rawAddress ? String(rawAddress).trim() : null;
    let latitude = rawLatitude != null ? Number(rawLatitude) : null;
    let longitude = rawLongitude != null ? Number(rawLongitude) : null;
    let pickupAddress = rawPickupAddress ? String(rawPickupAddress).trim() : null;
    let pickupLatitude = rawPickupLatitude != null ? Number(rawPickupLatitude) : null;
    let pickupLongitude = rawPickupLongitude != null ? Number(rawPickupLongitude) : null;
    let geocodedCountryIso = null;
    let geocodedAdminAreaName = null;

    if ((!Number.isFinite(latitude) || !Number.isFinite(longitude)) && address) {
      const geocoded = await geocodeAddress(address);
      if (!geocoded) return res.status(400).json({ error: 'Destination introuvable' });
      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
      address = geocoded.formattedAddress || address;
      geocodedCountryIso = geocoded.countryIso;
      geocodedAdminAreaName = geocoded.adminAreaName;
    }

    if (
      (!Number.isFinite(pickupLatitude) || !Number.isFinite(pickupLongitude)) &&
      pickupAddress
    ) {
      const geocodedPickup = await geocodeAddress(pickupAddress);
      if (!geocodedPickup) return res.status(400).json({ error: 'Point de départ introuvable' });
      pickupLatitude = geocodedPickup.latitude;
      pickupLongitude = geocodedPickup.longitude;
      pickupAddress = geocodedPickup.formattedAddress || pickupAddress;
    }

    if (
      PICKUP_REQUIRED_SLUGS.includes(tradeCategory.slug) &&
      (!Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        !Number.isFinite(pickupLatitude) ||
        !Number.isFinite(pickupLongitude))
    ) {
      return res.status(400).json({
        error: 'Le point de départ et la destination doivent être placés sur la carte',
      });
    }

    const missionGeoScope = await resolveMissionGeoScope({
      countryIso: geocodedCountryIso,
      adminAreaName: geocodedAdminAreaName,
      fallbackCountryId: countryId,
      fallbackRegionId: null,
      tradeCategoryScope: {
        countryId: tradeCategory.countryId,
        regionId: tradeCategory.regionId,
      },
    });
    if (missionGeoScope.error) return res.status(400).json({ error: missionGeoScope.error });

    const requestedVehicleType = resolveRequestedVehicleType(
      tradeCategory,
      rawRequestedVehicleType
    );
    const estimate = await estimateMission({
      user: null,
      executionType: 'provider',
      tradeCategoryId: tradeCategory.id,
      serviceType: null,
      countryId: missionGeoScope.countryId,
      regionId: missionGeoScope.regionId,
      destinationLatitude: latitude,
      destinationLongitude: longitude,
      pickupLatitude,
      pickupLongitude,
      requestedVehicleType,
    });

    return res.status(200).json({
      estimate: { ...estimate, requestedVehicleType },
      pickup: { address: pickupAddress, latitude: pickupLatitude, longitude: pickupLongitude },
      destination: { address, latitude, longitude },
    });
  } catch (e) {
    logger.error({ err: e }, 'missionRequest.estimate.failed');
    return res.status(500).json({ error: "Erreur lors du calcul de l'estimation" });
  }
};

exports.reverseGeocodeLocation = async (req, res) => {
  try {
    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);
    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({ error: 'latitude/longitude invalides' });
    }
    return res.json({ address: await reverseGeocode(latitude, longitude) });
  } catch (e) {
    logger.error({ err: e }, 'missionRequest.reverse_geocode.failed');
    return res.status(500).json({ error: 'Erreur lors du géocodage inverse' });
  }
};

/**
 * Demande de mission/service invitée depuis la homepage (docs/DEV_SPEC_TERANGA_v3.md,
 * Lot 2 — "la homepage comme base d'interactions"). Pas de nouveau système
 * d'auth : le téléphone et, pour un compte existant, le PIN passent par les mêmes primitives que
 * /auth/register + /auth/login (voir exports ajoutés dans auth.controller.js),
 * pour que le visiteur reparte avec un vrai compte/session, pas une ligne
 * orpheline non trackable.
 *
 * Sécurité : un numéro déjà associé à un compte NE loggue JAMAIS
 * silencieusement — il faut le bon PIN, sinon 401. Sans ça, n'importe qui
 * pourrait usurper une session en soumettant le numéro de quelqu'un d'autre.
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
    } = req.body;

    const phone = normalizePhone(rawPhone);
    if (!isValidPhone(phone)) {
      return res.status(400).json({ error: 'Téléphone invalide' });
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

    // Rejeter les commandes Taxi/Livraison incomplètes avant toute création automatique de
    // compte. Cela évite de laisser un compte orphelin lorsqu'un visiteur oublie un des lieux.
    if (PICKUP_REQUIRED_SLUGS.includes(tradeCategory?.slug)) {
      const hasDestination =
        Boolean(String(address || '').trim()) ||
        (rawLatitude != null &&
          rawLongitude != null &&
          Number.isFinite(Number(rawLatitude)) &&
          Number.isFinite(Number(rawLongitude)));
      const hasPickup =
        Boolean(String(rawPickupAddress || '').trim()) ||
        (rawPickupLatitude != null &&
          rawPickupLongitude != null &&
          Number.isFinite(Number(rawPickupLatitude)) &&
          Number.isFinite(Number(rawPickupLongitude)));

      if (!hasPickup || !hasDestination) {
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
            'Ce numéro est associé à un compte existant non-client. Connectez-vous depuis votre espace habituel.',
        });
      }

      if (!pin || !String(pin).trim()) {
        return res.status(401).json({
          code: 'PIN_REQUIRED',
          error: 'Ce numéro possède déjà un compte. Saisissez votre code Teranga.',
        });
      }

      const pinOk = await bcrypt.compare(pin, user.passwordHash);
      if (!pinOk) {
        return res.status(401).json({
          error: 'Ce numéro est déjà associé à un compte. Code incorrect.',
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

      const effectivePin =
        pin && String(pin).trim()
          ? String(pin).trim()
          : String(crypto.randomInt(100000, 1000000));
      if (!pin || !String(pin).trim()) generatedPin = effectivePin;
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
        logger.warn(
          { err: recoveryErr },
          'missionRequest.create.recovery_codes_generation_failed'
        );
      }
    }

    const trimmedAddress = address ? String(address).trim() : null;

    // Coordonnées dérivées quand un lieu est fourni (dette 0.5) : le frontend
    // peut déjà les fournir (Places Autocomplete, dépose d'épingle), sinon on
    // géocode l'adresse côté serveur — sans biais vers le pays du compte, une
    // mission peut volontairement se situer dans un autre pays (client à
    // Bamako demandant une mission à Abidjan). Rejet 400 si l'adresse fournie
    // ne résout à aucune coordonnée valide — jamais de mission avec une
    // adresse saisie mais des coordonnées nulles. Les types de demande sans
    // lieu (paiement, transfert d'argent...) restent possibles sans adresse.
    let latitude = rawLatitude != null ? Number(rawLatitude) : null;
    let longitude = rawLongitude != null ? Number(rawLongitude) : null;
    let geocodedCountryIso = null;
    let geocodedAdminAreaName = null;

    if ((!Number.isFinite(latitude) || !Number.isFinite(longitude)) && trimmedAddress) {
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
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      latitude = null;
      longitude = null;
    }

    let pickupAddress = rawPickupAddress ? String(rawPickupAddress).trim() : null;
    let pickupLatitude = rawPickupLatitude != null ? Number(rawPickupLatitude) : null;
    let pickupLongitude = rawPickupLongitude != null ? Number(rawPickupLongitude) : null;

    if (
      pickupAddress &&
      (!Number.isFinite(pickupLatitude) || !Number.isFinite(pickupLongitude))
    ) {
      const geocodedPickup = await geocodeAddress(pickupAddress);
      if (!geocodedPickup) {
        return res.status(400).json({
          error: 'Adresse de départ introuvable. Veuillez préciser un lieu plus précis.',
        });
      }
      pickupLatitude = geocodedPickup.latitude;
      pickupLongitude = geocodedPickup.longitude;
    }

    if (!Number.isFinite(pickupLatitude) || !Number.isFinite(pickupLongitude)) {
      pickupAddress = null;
      pickupLatitude = null;
      pickupLongitude = null;
    }

    if (
      PICKUP_REQUIRED_SLUGS.includes(tradeCategory?.slug) &&
      (pickupLatitude === null || pickupLongitude === null)
    ) {
      return res.status(400).json({
        error: 'Le point de départ est obligatoire pour cette filière',
      });
    }

    // La mission est routée/tarifée selon le pays/région où elle a réellement
    // lieu (adresse géocodée), pas selon le pays du compte du demandeur — sauf
    // absence de lieu (fallback sur le compte, cf. commentaire ci-dessus).
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
    const requestedVehicleType = resolveRequestedVehicleType(
      tradeCategory,
      rawRequestedVehicleType
    );
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
    });

    const service = await Service.create({
      clientId: user.id,
      agentId: null,
      createdById: user.id,
      propertyId: null,
      type: tradeCategory ? 'other' : serviceType,
      title: String(title).trim(),
      description: description ? String(description).trim() : null,
      contactPerson: firstName || user.firstName || null,
      contactPhone: phone,
      pickupAddress,
      pickupLatitude,
      pickupLongitude,
      requestedVehicleType,
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
      missionStatus: tradeCategory ? 'CREATED' : null,
    });

    const fullService = await Service.findByPk(service.id, {
      include: [
        { model: User, as: 'client', attributes: ['id', 'firstName', 'lastName', 'phone'] },
        { model: Property, as: 'property', attributes: ['id', 'title', 'city', 'address'] },
      ],
    });

    await notifyServiceCreated({
      actorId: user.id,
      service,
      fullService,
      targetClientId: user.id,
      countryId: missionGeoScope.countryId,
      regionId: missionGeoScope.regionId,
    });

    const token = signAccess({
      id: user.id,
      role: user.role,
      countryId: user.countryId ?? null,
      regionId: user.regionId ?? null,
      language: user.language || 'fr',
    });
    const { rawToken, maxAge: refreshMaxAge } = await issueRefreshToken(user, req);
    const accessMaxAge = parseDurationToMs(ACCESS_EXPIRES) || 60 * 60 * 1000;
    const csrfToken = issueCsrfToken();

    setAuthCookies(res, {
      accessToken: token,
      accessMaxAge,
      refreshToken: rawToken,
      refreshMaxAge,
      csrfToken,
    });

    return res.status(201).json({
      message: isNewAccount ? 'Compte créé et demande envoyée' : 'Demande envoyée',
      token,
      csrfToken,
      user: toAuthUser(user),
      isNewAccount,
      generatedPin,
      recoveryCodes,
      estimate,
      startCode:
        tradeCategory?.slug === 'mobilite' ? getMissionStartCode(fullService) : null,
      service: fullService,
    });
  } catch (e) {
    logger.error({ err: e }, 'missionRequest.create.failed');
    return res.status(500).json({ error: 'Erreur lors de la création de la demande' });
  }
};
