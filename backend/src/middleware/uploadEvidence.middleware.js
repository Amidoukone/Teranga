// backend/src/middleware/uploadEvidence.middleware.js
'use strict';

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 📂 Dossier d’upload pour les preuves
// (servi publiquement via app.use('/uploads', express.static(...)))
const uploadDir = path.join(__dirname, '../../uploads/evidences');

/* ============================================================
   🗂️ Préparation du dossier (idempotent)
============================================================ */
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    // eslint-disable-next-line no-console
    console.log('📂 Dossier créé automatiquement :', uploadDir);
  }
} catch (e) {
  // eslint-disable-next-line no-console
  console.error('⚠️ Impossible de préparer le dossier evidences:', e?.message || e);
}

/* ============================================================
   🧼 Hygiénisation du nom de fichier
   - supprime les accents
   - remplace les espaces par _
   - garde uniquement [a-z0-9._-]
   - limite la longueur du basename
============================================================ */
function sanitizeBaseName(name, max = 80) {
  const plain = (name || '')
    .normalize('NFD') // décompose accents
    .replace(/[\u0300-\u036f]/g, '') // retire diacritiques
    .replace(/\s+/g, '_') // espaces -> _
    .replace(/[^a-zA-Z0-9._-]/g, ''); // whitelist

  const ext = path.extname(plain);
  const base = path.basename(plain, ext).slice(0, Math.max(1, max - ext.length));
  return `${base}${ext}` || `file${Date.now()}`;
}

/* ============================================================
   ✅ Extensions & mimetypes autorisés (alignés avec le front)
   - images: jpg, jpeg, png
   - docs: pdf, doc, docx, xls, xlsx
============================================================ */
const ALLOWED_EXTS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
]);

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

/* ============================================================
   🔒 Filtre de fichier
   - Vérifie extension ET mimetype (si fourni)
   - Message d’erreur clair si rejet
============================================================ */
const fileFilter = (_req, file, cb) => {
  const ext = (path.extname(file.originalname) || '').toLowerCase();

  const okExt = ALLOWED_EXTS.has(ext);
  const okMime = file.mimetype ? ALLOWED_MIMES.has(file.mimetype) : true; // certains clients n’envoient pas le mimetype

  if (!okExt || !okMime) {
    return cb(
      new Error(
        'Type de fichier non supporté. Autorisés: jpg, jpeg, png, pdf, doc, docx, xls, xlsx.'
      ),
      false
    );
  }
  cb(null, true);
};

/* ============================================================
   💾 Stratégie de stockage
   - destination: uploads/evidences
   - filename: <timestamp>-<basename_hygienise><ext>
============================================================ */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase();
    const base = sanitizeBaseName(path.basename(file.originalname, ext));
    const ts = Date.now();
    cb(null, `${ts}-${base}${ext}`);
  },
});

/* ============================================================
   🧰 Base Multer
   - limits: 10 Mo / fichier
============================================================ */
const baseMulter = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 Mo max par fichier
  },
});

/* ============================================================
   🤝 Compat multi-champs (front & legacy)
   - Nouveau front : "files" (array)
   - Legacy       : "proofFile", "proof" (single/array)
   👉 Pour éviter "Unexpected field", on prépare un middleware
      qui accepte TOUTES ces variantes.
============================================================ */
const MULTI_FIELDS = [
  { name: 'files', maxCount: 10 },      // nouveau front (recommandé)
  { name: 'proofFile', maxCount: 10 },  // compat legacy
  { name: 'proof', maxCount: 10 },      // compat legacy
];

/**
 * Middleware "intelligent" qui accepte indifféremment
 * files / proofFile / proof, en single ou multiple.
 */
function smartFieldsMiddleware() {
  return baseMulter.fields(MULTI_FIELDS);
}

/* ============================================================
   🧩 Export API compatible avec tes routes actuelles
   - upload.single('proofFile') -> renvoie en réalité le smartFieldsMiddleware
   - upload.array('files', n)   -> array natif sur "files"
   - upload.fields([...])       -> fields natif si tu veux custom
   - upload.any()               -> Multer any() natif (corrige l’erreur des routes)
   - upload.anyCompat()         -> alias du smart multi-champs si tu veux "contrôlé"
============================================================ */

/**
 * Simule "single" mais renvoie un middleware multi-champs.
 * ⚠️ On ignore le nom passé (ex: 'proofFile') pour garantir la compat.
 * Cela permet de garder tes routes EXISTANTES telles quelles :
 *   upload.single('proofFile')
 * … tout en acceptant "files" envoyé par le front.
 */
function singleCompat(/* fieldNameIgnored */) {
  return smartFieldsMiddleware();
}

/** Array natif sur le champ recommandé "files" */
function arrayFiles(max = 10) {
  return baseMulter.array('files', max);
}

/** Fields natif si besoin de contrôle fin */
function fieldsNative(fields) {
  return baseMulter.fields(fields);
}

/** Multer natif any() — accepte n’importe quel nom de champ fichier */
function anyNative() {
  return baseMulter.any();
}

/** Alias "contrôlé" du smart multi-champs (nommage explicite) */
function anyCompat() {
  return smartFieldsMiddleware();
}

/* ============================================================
   ✅ Export par défaut : objet avec API "multer-like" + compat
   (tes routes peuvent continuer à faire: upload.any(), upload.single('proofFile'), etc.)
============================================================ */
const upload = Object.assign(function defaultMiddleware(req, res, next) {
  // S’il est monté directement comme middleware, on passe en "smart"
  return smartFieldsMiddleware()(req, res, next);
}, {
  // Compat signature Multer
  single: singleCompat,
  array: arrayFiles,
  fields: fieldsNative,
  any: anyNative,          // ✅ corrige l’erreur "upload.any is not a function"
  anyCompat,               // option si tu préfères contrôler les champs acceptés
  // On expose aussi l’instance brute si jamais tu en as besoin
  _multer: baseMulter,
  _fields: MULTI_FIELDS,
  _uploadDir: uploadDir,
});

module.exports = upload;
