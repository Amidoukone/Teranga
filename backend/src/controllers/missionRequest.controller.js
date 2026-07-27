'use strict';

const bcrypt = require('bcrypt');
const { Service, User, Property, TradeCategory } = require('../../models');
const { normalizePhone, isValidPhone } = require('../utils/contactIdentity');
const { notifyServiceCreated } = require('../services/serviceNotification.service');
const { geocodeAddress } = require('../services/geocoding.service');
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

/**
 * Demande de mission/service invitée depuis la homepage (docs/DEV_SPEC_TERANGA_v3.md,
 * Lot 2 — "la homepage comme base d'interactions"). Pas de nouveau système
 * d'auth : le téléphone+PIN passe par les mêmes primitives que
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

    let user = await User.findOne({ where: { phone } });
    let isNewAccount = false;
    let recoveryCodes = [];

    if (user) {
      if (user.role !== 'client') {
        return res.status(409).json({
          error:
            'Ce numéro est associé à un compte existant non-client. Connectez-vous depuis votre espace habituel.',
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

      const passwordHash = await bcrypt.hash(pin, 10);
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

    // La mission est routée/tarifée selon le pays/région où elle a réellement
    // lieu (adresse géocodée), pas selon le pays du compte du demandeur — sauf
    // absence de lieu (fallback sur le compte, cf. commentaire ci-dessus).
    const missionGeoScope = await resolveMissionGeoScope({
      countryIso: geocodedCountryIso,
      adminAreaName: geocodedAdminAreaName,
      fallbackCountryId: user.countryId,
      fallbackRegionId: user.regionId,
    });
    if (missionGeoScope.error) {
      return res.status(400).json({ error: missionGeoScope.error });
    }

    const executionType = tradeCategory ? 'provider' : 'agent';
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
      address: trimmedAddress,
      latitude,
      longitude,
      budget: null,
      currency: 'XOF',
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
      recoveryCodes,
      service: fullService,
    });
  } catch (e) {
    logger.error({ err: e }, 'missionRequest.create.failed');
    return res.status(500).json({ error: 'Erreur lors de la création de la demande' });
  }
};
