const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 📂 Dossier d’upload (relatif à la racine du projet backend)
const uploadDir = path.join(__dirname, '../../uploads/properties');

// Vérifie que le dossier existe, sinon le crée récursivement
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('📂 Dossier créé automatiquement :', uploadDir);
}

// ⚙️ Configuration de stockage
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// 🔒 Filtrer les types de fichiers (images et pdf uniquement)
const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (!allowed.includes(ext)) {
    return cb(new Error('Type de fichier non supporté (jpg, jpeg, png, pdf uniquement)'), false);
  }
  cb(null, true);
};

// 🚀 Middleware upload
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB max
});

module.exports = upload;
