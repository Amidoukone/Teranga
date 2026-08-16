'use strict';

// Marketplace immobilière (docs/BRAINSTORM_ECOSYSTEME_TERANGA.md §7) — annonces publiques
// gérées uniquement par l'admin/category manager, aucun compte agence/propriétaire. Volontairement
// simple : pas de réservation, pas de calendrier, contact = numéro Teranga de la région (ou du
// pays à défaut), pas le contact d'origine du bien.

const { PropertyListing, Country, Region, User } = require('../../models');
const {
  isGlobalAdmin,
  getUserGeoScope,
  applyGeoScopeForModel,
  canAccessGeoResource,
} = require('../utils/geoScope');
const mediaUpload = require('../services/mediaUpload.service');
const logger = require('../utils/logger');

const PROPERTY_LISTING_LOCAL_FALLBACK_ENV_VAR = 'PROPERTY_LISTING_ALLOW_LOCAL_FALLBACK';
const PROPERTY_LISTING_MEDIA_STORAGE_ERROR_CODE = 'PROPERTY_LISTING_MEDIA_STORAGE_UNAVAILABLE';

function mediaStorageError() {
  return mediaUpload.mediaStorageError(
    'Stockage des photos indisponible en production. Configurez ImageKit ou un UPLOADS_ROOT persistant.',
    PROPERTY_LISTING_MEDIA_STORAGE_ERROR_CODE
  );
}

const GEO_INCLUDE = [
  { model: Country, as: 'country', attributes: ['id', 'name', 'isoCode', 'contactPhone'] },
  { model: Region, as: 'region', attributes: ['id', 'name', 'contactPhone'] },
];

function resolveWriteScope(user, payload) {
  if (isGlobalAdmin(user)) {
    return { countryId: payload.countryId, regionId: payload.regionId || null };
  }

  const { countryId, regionId } = getUserGeoScope(user);
  if (!countryId) {
    const err = new Error('Aucun scope pays défini pour cet administrateur');
    err.status = 403;
    throw err;
  }

  // Master régional : verrouillé à sa région exacte (cohérent avec canAccessGeoResource en
  // lecture/écriture). Master pays : peut choisir n'importe quelle région de son pays.
  if (regionId) return { countryId, regionId };
  return { countryId, regionId: payload.regionId || null };
}

// Numéro affiché au public — région d'abord, pays en repli (docs/BRAINSTORM_ECOSYSTEME_TERANGA.md
// §7 : "un numéro par région/master local"). Jamais le contact d'origine du bien.
function resolveContactPhone(listing) {
  return listing.region?.contactPhone || listing.country?.contactPhone || null;
}

function toPublicDTO(listing) {
  const l = listing.toJSON ? listing.toJSON() : listing;
  return {
    id: l.id,
    title: l.title,
    type: l.type,
    transactionType: l.transactionType,
    neighborhood: l.neighborhood,
    city: l.city,
    // Le pays est affiché sur chaque annonce (pas de filtre par pays sur la vitrine, décision
    // utilisateur) — sans ça, une annonce du Ghana et une du Mali sont indiscernables.
    country: l.country?.name || null,
    price: l.price,
    currency: l.currency,
    description: l.description,
    photos: l.photos || [],
    contactPhone: resolveContactPhone(l),
    createdAt: l.createdAt,
  };
}

async function uploadListingPhotos(files) {
  if (!files?.length) return [];

  const imageKitEnabled = mediaUpload.isImageKitEnabled();
  const fallbackPolicy = mediaUpload.resolveLocalFallbackPolicy({
    moduleFallbackEnvVar: PROPERTY_LISTING_LOCAL_FALLBACK_ENV_VAR,
  });
  const allowLocalFallback = fallbackPolicy.allowLocalFallback;

  const results = [];
  for (const [idx, file] of files.entries()) {
    const fileName = mediaUpload.buildFileName('listing', file.originalname, idx);
    let uploaded = null;

    if (imageKitEnabled) {
      try {
        uploaded = await mediaUpload.uploadToImageKitWithRetry({
          file: file.buffer,
          fileName,
          folder: '/teranga/property-listings/',
        });
      } catch (err) {
        logger.warn(
          { err: err?.message, fileName },
          'propertyListing.imagekit.upload.failed.fallback_local'
        );
        if (!allowLocalFallback) throw mediaStorageError();
      }
    }

    if (!uploaded || !uploaded.url) {
      if (!allowLocalFallback) throw mediaStorageError();
      uploaded = await mediaUpload.saveFileLocally(file, fileName, {
        subfolder: 'property-listings',
      });
    }

    results.push({ url: uploaded.url, fileId: uploaded.fileId || null });
  }

  return results;
}

/* ============================================================
   GET /api/v1/property-listings — public, sans auth. Filtres optionnels countryId/regionId/city.
   Seules les annonces 'available' sont exposées.
============================================================ */
exports.list = async (req, res) => {
  try {
    const where = { status: 'available' };
    const countryId = Number.parseInt(req.query?.countryId, 10);
    const regionId = Number.parseInt(req.query?.regionId, 10);
    if (Number.isFinite(countryId)) where.countryId = countryId;
    if (Number.isFinite(regionId)) where.regionId = regionId;
    if (req.query?.city) where.city = req.query.city;

    const listings = await PropertyListing.findAll({
      where,
      include: GEO_INCLUDE,
      order: [['createdAt', 'DESC']],
      limit: 100,
    });

    return res.json({ listings: listings.map(toPublicDTO) });
  } catch (e) {
    logger.error({ err: e }, 'propertyListing.list.failed');
    return res.status(500).json({ error: 'Erreur lors de la récupération des annonces' });
  }
};

/* ============================================================
   GET /api/v1/property-listings/:id — public, sans auth. Page individuelle partageable.
   404 si l'annonce n'est plus disponible (louée/vendue/supprimée) plutôt que de l'exposer.
============================================================ */
exports.getOne = async (req, res) => {
  try {
    const listing = await PropertyListing.findOne({
      where: { id: req.params.id, status: 'available' },
      include: GEO_INCLUDE,
    });
    if (!listing) return res.status(404).json({ error: 'Annonce introuvable' });

    return res.json({ listing: toPublicDTO(listing) });
  } catch (e) {
    logger.error({ err: e }, 'propertyListing.getOne.failed');
    return res.status(500).json({ error: "Erreur lors de la récupération de l'annonce" });
  }
};

/* ============================================================
   GET /api/v1/property-listings/admin — admin/master, scope géographique, tous statuts.
============================================================ */
exports.listForAdmin = async (req, res) => {
  try {
    let where = applyGeoScopeForModel({}, req.user, PropertyListing);
    if (where.id === 0) return res.status(403).json({ error: 'Accès interdit' });
    if (req.query?.status) where = { ...where, status: req.query.status };

    const listings = await PropertyListing.findAll({
      where,
      include: [...GEO_INCLUDE, { model: User, as: 'creator', attributes: ['id', 'firstName', 'lastName'] }],
      order: [['createdAt', 'DESC']],
    });

    return res.json({ listings });
  } catch (e) {
    logger.error({ err: e }, 'propertyListing.list_for_admin.failed');
    return res.status(500).json({ error: 'Erreur lors de la récupération des annonces' });
  }
};

/* ============================================================
   POST /api/v1/property-listings — admin/master. multipart (champs + `photos`).
============================================================ */
exports.create = async (req, res) => {
  try {
    const scope = resolveWriteScope(req.user, req.body);
    const photos = await uploadListingPhotos(req.files);

    const listing = await PropertyListing.create({
      title: req.body.title,
      type: req.body.type,
      transactionType: req.body.transactionType,
      neighborhood: req.body.neighborhood || null,
      city: req.body.city,
      countryId: scope.countryId,
      regionId: scope.regionId,
      price: req.body.price,
      currency: req.body.currency || 'XOF',
      description: req.body.description || null,
      photos,
      createdBy: req.user.id,
    });

    return res.status(201).json({ listing });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    if (e.code === PROPERTY_LISTING_MEDIA_STORAGE_ERROR_CODE) {
      return res.status(503).json({ error: 'Stockage des photos indisponible pour le moment.' });
    }
    logger.error({ err: e }, 'propertyListing.create.failed');
    return res.status(500).json({ error: "Erreur lors de la création de l'annonce" });
  }
};

/* ============================================================
   PUT /api/v1/property-listings/:id — admin/master, scope géographique. Nouvelles photos =
   remplacement complet (pas d'ajout/retrait unitaire, cohérent avec la simplicité voulue).
============================================================ */
exports.update = async (req, res) => {
  try {
    const listing = await PropertyListing.findByPk(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Annonce introuvable' });
    if (!canAccessGeoResource(listing, req.user)) {
      return res.status(403).json({ error: 'Annonce hors scope géographique' });
    }

    const updates = {};
    const fields = [
      'title', 'type', 'transactionType', 'neighborhood', 'city',
      'price', 'currency', 'description', 'status',
    ];
    for (const field of fields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field] || null;
    }
    if (req.body.countryId !== undefined) updates.countryId = req.body.countryId;
    if (req.body.regionId !== undefined) updates.regionId = req.body.regionId || null;

    if (req.files?.length) {
      updates.photos = await uploadListingPhotos(req.files);
    }

    await listing.update(updates);
    return res.json({ listing });
  } catch (e) {
    logger.error({ err: e }, 'propertyListing.update.failed');
    return res.status(500).json({ error: "Erreur lors de la mise à jour de l'annonce" });
  }
};

/* ============================================================
   DELETE /api/v1/property-listings/:id — admin/master, scope géographique. Suppression physique
   assumée (docs/BRAINSTORM_ECOSYSTEME_TERANGA.md §7 : "on le supprime directement").
============================================================ */
exports.remove = async (req, res) => {
  try {
    const listing = await PropertyListing.findByPk(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Annonce introuvable' });
    if (!canAccessGeoResource(listing, req.user)) {
      return res.status(403).json({ error: 'Annonce hors scope géographique' });
    }

    await listing.destroy();
    return res.json({ message: 'Annonce supprimée' });
  } catch (e) {
    logger.error({ err: e }, 'propertyListing.remove.failed');
    return res.status(500).json({ error: "Erreur lors de la suppression de l'annonce" });
  }
};
