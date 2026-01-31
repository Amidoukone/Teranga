'use strict';

const ImageKit = require("imagekit");

// --------------------------------------------------
// 🌍 Initialisation ImageKit avec les variables .env
// --------------------------------------------------
const isConfigured = Boolean(
  process.env.IMAGEKIT_PUBLIC_KEY &&
    process.env.IMAGEKIT_PRIVATE_KEY &&
    process.env.IMAGEKIT_URL_ENDPOINT
);

if (!isConfigured) {
  console.warn(
    '⚠️ ImageKit: variables manquantes. ' +
      'Assurez-vous que IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY et IMAGEKIT_URL_ENDPOINT sont définies.'
  );
}

const imagekit = isConfigured
  ? new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
    })
  : null;

// --------------------------------------------------
// 📤 1. UPLOAD IMAGE/FILE → ImageKit
// --------------------------------------------------
// fileBuffer : Buffer (contenu du fichier fourni par multer)
// fileName   : string  (nom du fichier original ou normalisé)
// folder     : string  (ex: "/properties", "/projects"...)
async function uploadToImageKit(folder, fileBuffer, fileName) {
  if (!fileBuffer) return null;
  if (!imagekit) return null;

  try {
    const response = await imagekit.upload({
      file: fileBuffer,
      fileName: fileName,
      folder: folder || "/teranga",
      useUniqueFileName: true
    });

    return {
      url: response.url,          // URL publique finale (https://ik.imagekit.io/... )
      fileId: response.fileId,    // utile pour suppression
      name: response.name,
      filePath: response.filePath // chemin interne chez ImageKit
    };
  } catch (err) {
    console.error("❌ ImageKit upload error:", err);
    return null;
  }
}

// --------------------------------------------------
// 🗑️ 2. SUPPRESSION fichier sur ImageKit
// --------------------------------------------------
async function deleteFromImageKit(fileId) {
  if (!fileId) return;
  if (!imagekit) return false;

  try {
    await imagekit.deleteFile(fileId);
    return true;
  } catch (err) {
    console.error("❌ ImageKit delete error:", err);
    return false;
  }
}

module.exports = {
  imagekit,
  uploadToImageKit,
  deleteFromImageKit
};
