// backend/src/middleware/uploadEvidence.middleware.js
"use strict";

const multer = require("multer");
const path = require("path");

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
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const fileFilter = (_req, file, cb) => {
  const ext = (path.extname(file.originalname) || "").toLowerCase();
  const okExt = ALLOWED_EXTS.has(ext);
  const okMime = file.mimetype ? ALLOWED_MIMES.has(file.mimetype) : true;

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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo
});

/* ============================================================
   🤝 Compat multi-champs (front & legacy)
   → On garde EXACTEMENT la même logique que ton fichier original
============================================================ */
const MULTI_FIELDS = [
  { name: "files", maxCount: 10 },     // nouveau front
  { name: "proofFile", maxCount: 10 }, // legacy
  { name: "proof", maxCount: 10 },     // legacy
];

/* Middleware smart : accepte n’importe laquelle des variantes */
function smartFieldsMiddleware() {
  return baseMulter.fields(MULTI_FIELDS);
}

/* ============================================================
   🔄 API compatible Multer : single / array / fields / any
============================================================ */
function singleCompat() {
  return smartFieldsMiddleware();
}

function arrayFiles(max = 10) {
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
