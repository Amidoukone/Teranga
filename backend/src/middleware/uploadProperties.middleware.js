// backend/src/middleware/uploadProperties.middleware.js
'use strict';

const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const ALLOWED_EXTS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
  '.pdf',
]);

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'application/x-pdf',
]);

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const MAX_FILE_SIZE_MB = toInt(process.env.PROPERTY_MAX_FILE_MB, 15);
const MAX_FILES = toInt(process.env.PROPERTY_MAX_FILES, 10);

function fileFilter(_req, file, cb) {
  const ext = (path.extname(file.originalname) || '').toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase();

  const okExt = ALLOWED_EXTS.has(ext);
  const okMime =
    !mime ||
    ALLOWED_MIMES.has(mime) ||
    mime === 'application/octet-stream' ||
    mime === 'binary/octet-stream';

  if (!okExt || !okMime) {
    return cb(
      new Error(
        'Type de fichier non supporte (jpg, jpeg, png, webp, heic, heif, pdf uniquement)'
      ),
      false
    );
  }

  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
    files: MAX_FILES,
  },
});

module.exports = upload;
