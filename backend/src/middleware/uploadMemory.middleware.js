'use strict';

const multer = require('multer');

/**
 * 🚀 Multer memory storage
 * - Les fichiers NE SONT PLUS ÉCRITS SUR DISQUE
 * - Ils restent en mémoire → parfait pour ImageKit
 */
const storage = multer.memoryStorage();

// Filtre optionnel pour valider les types de fichiers
function createFileFilter(allowedExts = []) {
  return (_req, file, cb) => {
    if (!allowedExts.length) return cb(null, true);

    const ext = (file.originalname || '').toLowerCase();
    const ok = allowedExts.some((a) => ext.endsWith(a));

    if (!ok) {
      return cb(
        new Error(
          `Type de fichier non supporté. Autorisés: ${allowedExts.join(', ')}`
        ),
        false
      );
    }
    cb(null, true);
  };
}

/**
 * 🎯 Factory pour créer un middleware d’upload selon les besoins.
 * @param {Array<string>} allowedExts
 * @param {number} max
 */
function createUploader(allowedExts = [], max = 10) {
  return multer({
    storage,
    fileFilter: createFileFilter(allowedExts),
    limits: { fileSize: 10 * 1024 * 1024 } // 10 Mo
  }).array('files', max); // Champ principal
}

module.exports = { createUploader };
