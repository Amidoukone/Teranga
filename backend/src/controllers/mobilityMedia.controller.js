"use strict";

const { Provider } = require("../../models");
const mediaUpload = require("../services/mediaUpload.service");
const { canManageProvider } = require("../utils/providerScope");
const logger = require("../utils/logger");

const MOBILITY_MEDIA_LOCAL_FALLBACK_ENV_VAR = "MOBILITY_MEDIA_ALLOW_LOCAL_FALLBACK";
const MOBILITY_MEDIA_STORAGE_ERROR_CODE = "MOBILITY_MEDIA_STORAGE_UNAVAILABLE";

const MEDIA_KINDS = Object.freeze({
  profilePhoto: { prefix: "driver_profile", photosOnly: true },
  driverLicense: { prefix: "driver_license", photosOnly: false },
  identityDocument: { prefix: "driver_identity", photosOnly: false },
  vehiclePhoto: { prefix: "vehicle_photo", photosOnly: true },
  vehicleRegistration: { prefix: "vehicle_registration", photosOnly: false },
  vehicleInsurance: { prefix: "vehicle_insurance", photosOnly: false },
  vehicleInspection: { prefix: "vehicle_inspection", photosOnly: false },
});

function storageUnavailableError() {
  return mediaUpload.mediaStorageError(
    "Stockage des documents Mobilite indisponible. Configurez ImageKit ou un UPLOADS_ROOT persistant.",
    MOBILITY_MEDIA_STORAGE_ERROR_CODE
  );
}

async function storeMobilityMedia(file, kindConfig) {
  const fileName = mediaUpload.buildFileName(kindConfig.prefix, file.originalname, 0);
  const imageKitEnabled = mediaUpload.isImageKitEnabled();
  const fallbackPolicy = mediaUpload.resolveLocalFallbackPolicy({
    moduleFallbackEnvVar: MOBILITY_MEDIA_LOCAL_FALLBACK_ENV_VAR,
  });
  let uploaded = null;

  if (imageKitEnabled) {
    try {
      uploaded = await mediaUpload.uploadToImageKitWithRetry({
        file: file.buffer,
        fileName,
        folder: "/teranga/mobility/",
        useUniqueFileName: true,
        isPrivateFile: false,
      });
    } catch (error) {
      logger.warn(
        { err: error?.message, fileName },
        "mobility_media.imagekit.upload.failed.fallback_local"
      );
      if (!fallbackPolicy.allowLocalFallback) throw storageUnavailableError();
    }
  }

  if (!uploaded?.url) {
    if (!fallbackPolicy.allowLocalFallback) throw storageUnavailableError();
    uploaded = await mediaUpload.saveFileLocally(file, fileName, {
      subfolder: "mobility",
    });
  }

  return uploaded;
}

exports.upload = async (req, res) => {
  try {
    const provider = await Provider.findByPk(req.params.id);
    if (!provider) return res.status(404).json({ error: "Prestataire introuvable" });
    if (!(await canManageProvider(req.user, provider))) {
      return res.status(403).json({ error: "Acces interdit" });
    }

    const kind = String(req.body?.kind || "").trim();
    const kindConfig = MEDIA_KINDS[kind];
    if (!kindConfig) {
      return res.status(400).json({ error: "Type de document Mobilite invalide" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Selectionnez une photo ou un document" });
    }
    if (kindConfig.photosOnly && !String(req.file.mimetype || "").startsWith("image/")) {
      return res.status(400).json({ error: "Une photo est requise pour ce champ" });
    }

    const uploaded = await storeMobilityMedia(req.file, kindConfig);
    return res.status(201).json({
      media: {
        kind,
        url: uploaded.url,
        fileId: uploaded.fileId || null,
        mimeType: req.file.mimetype || null,
        originalName: req.file.originalname || null,
      },
    });
  } catch (error) {
    if (error?.code === MOBILITY_MEDIA_STORAGE_ERROR_CODE) {
      return res.status(503).json({ error: error.message });
    }
    logger.error({ err: error }, "mobility_media.upload.failed");
    return res.status(500).json({ error: "Erreur lors de l'envoi du document Mobilite" });
  }
};

exports.MEDIA_KINDS = MEDIA_KINDS;
