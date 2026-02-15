// backend/src/middleware/uploadEvidence.middleware.js
"use strict";

const multer = require("multer");
const path = require("path");

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const MAX_FILES = toInt(process.env.EVIDENCE_MAX_FILES, 20);
const MAX_FILE_SIZE_MB = toInt(process.env.EVIDENCE_MAX_FILE_MB, 10);

/* ============================================================
   📌 NOUVEAU — MEMORY STORAGE (ImageKit Ready)
   → Les fichiers arrivent dans file.buffer au lieu du disque
============================================================ */
const storage = multer.memoryStorage();

/* ============================================================
   🔒 Extensions & mimetypes autorisés (identique à ta version)
============================================================ */
const ALLOWED_EXTS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
]);

const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
  "application/x-pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const fileFilter = (_req, file, cb) => {
  const ext = (path.extname(file.originalname) || "").toLowerCase();
  const okExt = ALLOWED_EXTS.has(ext);
  const mime = (file.mimetype || "").toLowerCase();
  const okMime =
    !mime ||
    ALLOWED_MIMES.has(mime) ||
    mime === "application/octet-stream" ||
    mime === "binary/octet-stream";

  if (!okExt || !okMime) {
    return cb(
      new Error(
        "Type de fichier non supporté. Autorisés: jpg, jpeg, png, pdf, doc, docx, xls, xlsx."
      ),
      false
    );
  }
  cb(null, true);
};

/* ============================================================
   🔧 Base multer version mémoire
============================================================ */
const baseMulter = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024, // Mo -> bytes
    files: MAX_FILES,
  },
});

/* ============================================================
   🤝 Compat multi-champs (front & legacy)
   → On garde EXACTEMENT la même logique que ton fichier original
============================================================ */
const MULTI_FIELDS = [
  { name: "files", maxCount: MAX_FILES }, // nouveau front
  { name: "proofFile", maxCount: MAX_FILES }, // legacy
  { name: "proof", maxCount: MAX_FILES }, // legacy
];

/* Middleware smart : accepte n’importe laquelle des variantes */
function smartFieldsMiddleware() {
  return baseMulter.fields(MULTI_FIELDS);
}

/* ============================================================
   🔁 API compatible Multer : single / array / fields / any
============================================================ */
function singleCompat() {
  return smartFieldsMiddleware();
}

function arrayFiles(max = MAX_FILES) {
  return baseMulter.array("files", max);
}

function fieldsNative(fields) {
  return baseMulter.fields(fields);
}

function anyNative() {
  return baseMulter.any();
}

function anyCompat() {
  return smartFieldsMiddleware();
}

/* ============================================================
   🧩 EXPORT
   → FULL backward compatibility
   → Tout fonctionne comme avant
============================================================ */
const upload = Object.assign(
  function defaultMiddleware(req, res, next) {
    return smartFieldsMiddleware()(req, res, next);
  },
  {
    single: singleCompat,
    array: arrayFiles,
    fields: fieldsNative,
    any: anyNative,
    anyCompat,
    _multer: baseMulter,
    _fields: MULTI_FIELDS,
  }
);

module.exports = upload;
