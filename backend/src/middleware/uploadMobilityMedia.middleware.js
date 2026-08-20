"use strict";

const multer = require("multer");
const path = require("path");

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const MAX_FILE_SIZE_MB = toInt(process.env.MOBILITY_MEDIA_MAX_FILE_MB, 10);
const ALLOWED_EXTS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".pdf",
]);
const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || "").toLowerCase();
    const mime = (file.mimetype || "").toLowerCase();
    if (!ALLOWED_EXTS.has(ext) || !ALLOWED_MIMES.has(mime)) {
      return cb(
        new Error(
          "Type de fichier non supporte. Formats autorises : jpg, jpeg, png, webp, heic, heif, pdf."
        ),
        false
      );
    }
    return cb(null, true);
  },
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
    files: 1,
  },
});

module.exports = upload.single("file");
