'use strict';

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 📂 Dossier d’upload pour les documents de projets
const uploadDir = path.join(__dirname, '../../uploads/projects');

// ✅ Création récursive si le dossier n’existe pas
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('📂 Dossier créé automatiquement :', uploadDir);
}

// ⚙️ Configuration du stockage : nom de fichier unique + extension d’origine
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${unique}${ext}`);
  },
});

// 🔒 Filtre des fichiers (formats autorisés)
const fileFilter = (_req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (!allowed.includes(ext)) {
    return cb(
      new Error('Type de fichier non supporté (jpg, jpeg, png, pdf uniquement)'),
      false
    );
  }

  cb(null, true);
};

// 🚀 Middleware Multer prêt à l’emploi
const uploadProjects = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo max
});

// ✅ Export du middleware
module.exports = uploadProjects;
