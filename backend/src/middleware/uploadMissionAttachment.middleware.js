// backend/src/middleware/uploadMissionAttachment.middleware.js
"use strict";

// Pièces jointes de la création de mission guidée (docs/DEV_SPEC_TERANGA_v3.md section 4.1,
// étape 3 : photo + note vocale optionnelles). Aucun type audio n'existait ailleurs dans le
// pipeline Multer du repo (uploadEvidence.middleware.js n'accepte que image/pdf/office) — nouveau
// pipeline minimal dédié, mêmes mécaniques mémoire+ImageKit que l'existant
// (services/mediaUpload.service.js).

const multer = require("multer");
const path = require("path");

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const MAX_FILE_SIZE_MB = toInt(process.env.MISSION_ATTACHMENT_MAX_FILE_MB, 8);

const storage = multer.memoryStorage();

const ALLOWED_PHOTO_EXTS = new Set([".jpg", ".jpeg", ".png"]);
const ALLOWED_PHOTO_MIMES = new Set(["image/jpeg", "image/jpg", "image/png"]);

const ALLOWED_VOICE_EXTS = new Set([".webm", ".ogg", ".mp3", ".mp4", ".m4a", ".wav"]);
const ALLOWED_VOICE_MIMES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-m4a",
  "audio/m4a",
]);

const fileFilter = (_req, file, cb) => {
  const ext = (path.extname(file.originalname) || "").toLowerCase();
  const mime = (file.mimetype || "").toLowerCase();

  if (file.fieldname === "photo") {
    if (!ALLOWED_PHOTO_EXTS.has(ext) || !ALLOWED_PHOTO_MIMES.has(mime)) {
      return cb(new Error("Photo non supportée. Formats autorisés : jpg, jpeg, png."), false);
    }
    return cb(null, true);
  }

  if (file.fieldname === "voiceNote") {
    if (!ALLOWED_VOICE_EXTS.has(ext) || !ALLOWED_VOICE_MIMES.has(mime)) {
      return cb(
        new Error("Note vocale non supportée. Formats autorisés : webm, ogg, mp3, mp4, m4a, wav."),
        false
      );
    }
    return cb(null, true);
  }

  return cb(new Error("Champ de fichier inattendu."), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
    files: 2,
  },
});

module.exports = upload.fields([
  { name: "photo", maxCount: 1 },
  { name: "voiceNote", maxCount: 1 },
]);
