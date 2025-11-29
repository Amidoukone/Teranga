// backend/src/middleware/uploadProduct.middleware.js
"use strict";

const multer = require("multer");
const path = require("path");

/* ============================================================
   📌 MEMORY STORAGE (ImageKit)
   → Les fichiers seront envoyés vers ImageKit depuis les controllers
   → Pas d’écriture sur le disque
============================================================ */
const storage = multer.memoryStorage();

/* ============================================================
   🔒 Filtre des types de fichiers (identique à ta version)
============================================================ */
const allowedExts = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExts.has(ext)) {
    return cb(
      new Error("Type de fichier non supporté (jpg, jpeg, png, webp uniquement)"),
      false
    );
  }
  cb(null, true);
};

/* ============================================================
   🚀 Middleware multer — version mémoire ready for ImageKit
============================================================ */
const uploadProduct = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo
});

/* ============================================================
   🔄 Export identique à ta version d'origine
   → tes routes continuent à utiliser :
      - uploadProduct.single("image")
      - uploadProduct.array("images", 3)
      - uploadProduct.fields([{ name: "images" }])
============================================================ */
module.exports = uploadProduct;
