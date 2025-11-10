'use strict';
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 📂 Dossier d’upload spécifique pour les images produits
const uploadDir = path.join(__dirname, '../../uploads/products');

// ✅ Crée le dossier s’il n’existe pas
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('📂 Dossier créé automatiquement :', uploadDir);
}

// ⚙️ Configuration de stockage (nom unique)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${unique}${ext}`);
  },
});

// 🔒 Filtre des types de fichiers
const fileFilter = (_req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.includes(ext)) {
    return cb(new Error('Type de fichier non supporté (jpg, jpeg, png, webp uniquement)'), false);
  }
  cb(null, true);
};

// 🚀 Middleware multer prêt à l’emploi
const uploadProduct = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo max
});

module.exports = uploadProduct;
