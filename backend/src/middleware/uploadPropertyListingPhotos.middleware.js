// backend/src/middleware/uploadPropertyListingPhotos.middleware.js
"use strict";

// Photos d'annonces immobilières (docs/BRAINSTORM_ECOSYSTEME_TERANGA.md §7) — admin/category
// manager uniquement, mémoire + upload via mediaUpload.service.js (voir
// propertyListing.controller.js), même mécanique que evidence.controller.js.

const multer = require("multer");
const path = require("path");

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const MAX_FILE_SIZE_MB = toInt(process.env.PROPERTY_LISTING_MAX_FILE_MB, 10);
const MAX_FILES = toInt(process.env.PROPERTY_LISTING_MAX_FILES, 8);

const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const ALLOWED_MIMES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

const fileFilter = (_req, file, cb) => {
  const ext = (path.extname(file.originalname) || "").toLowerCase();
  const mime = (file.mimetype || "").toLowerCase();

  if (!ALLOWED_EXTS.has(ext) || !ALLOWED_MIMES.has(mime)) {
    return cb(new Error("Photo non supportée. Formats autorisés : jpg, jpeg, png, webp."), false);
  }
  return cb(null, true);
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
    files: MAX_FILES,
  },
});

module.exports = upload.array("photos", MAX_FILES);
