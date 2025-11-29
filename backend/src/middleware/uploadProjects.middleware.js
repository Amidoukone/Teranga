// backend/src/middleware/uploadProjects.middleware.js
"use strict";

const multer = require("multer");
const path = require("path");

/* ============================================================
   📂 MEMORY STORAGE — ImageKit Ready
   Les fichiers vont en mémoire → upload vers ImageKit dans le controller
   Plus d'écriture sur disque → compatible Render & Netlify
============================================================ */
const storage = multer.memoryStorage();

/* ============================================================
   🔒 Filtre des fichiers (identique à ta version)
   Formats autorisés:
   - jpg, jpeg, png, pdf
============================================================ */
const allowed = new Set([".jpg", ".jpeg", ".png", ".pdf"]);

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.has(ext)) {
    return cb(
      new Error("Type de fichier non supporté (jpg, jpeg, png, pdf uniquement)"),
      false
    );
  }
  cb(null, true);
};

/* ============================================================
   🚀 Middleware Multer (version mémoire)
============================================================ */
const uploadProjects = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 Mo max/fichier
  },
});

/* ============================================================
   👍 EXPORT IDENTIQUE À TA STRUCTURE EXISTANTE
   → uploadProjects.single("file")
   → uploadProjects.array("files", 10)
   → uploadProjects.fields([{ name: "files" }])
============================================================ */
module.exports = uploadProjects;
