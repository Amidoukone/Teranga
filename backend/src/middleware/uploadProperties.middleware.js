// backend/src/middleware/uploadProperties.middleware.js
'use strict';

const multer = require('multer');
const path = require('path');

/* ============================================================
   📌 Nouveau système basé sur MEMORY STORAGE (ImageKit-ready)
   → On ne sauvegarde plus rien sur disque local
   → Les fichiers sont envoyés en RAM : file.buffer
============================================================ */
const storage = multer.memoryStorage();

/* ============================================================
   🔒 Filtre des extensions autorisées (identique à ta version)
============================================================ */
const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.pdf']);

function fileFilter(req, file, cb) {
  const ext = (path.extname(file.originalname) || '').toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) {
    return cb(
      new Error('Type de fichier non supporté (jpg, jpeg, png, pdf uniquement)'),
      false
    );
  }
  cb(null, true);
}

/* ============================================================
   🚀 Configuration Multer
============================================================ */
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

/* ============================================================
   🟢 EXPORT
   → Les controllers continuent d’utiliser req.files normalement
============================================================ */
module.exports = upload;
