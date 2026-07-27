'use strict';

// Mécanique d'upload partagée (ImageKit + repli local), extraite de
// evidence.controller.js pour être réutilisée telle quelle par le nouveau flux de
// pièces jointes de mission (docs/DEV_SPEC_TERANGA_v3.md section 4.1, étape 3) —
// aucun changement de comportement pour les preuves existantes, seulement une
// paramétrisation (dossier, préfixe, env var de repli, retries) là où le module
// evidence codait ces valeurs en dur.

const path = require('path');
const fs = require('fs');
const imagekit = require('../helpers/teranga-imagekit');
const { resolveUploadsRoot } = require('../utils/uploadsRoot');
const { isImageKitConfigured } = require('../utils/mediaStorageDiagnostics');
const { evaluateLocalMediaFallback } = require('../utils/mediaStoragePolicy');

function toIntOr(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isImageKitEnabled() {
  return isImageKitConfigured(process.env);
}

function resolveLocalFallbackPolicy({ moduleFallbackEnvVar }) {
  return evaluateLocalMediaFallback({ moduleFallbackEnvVar });
}

function mediaStorageError(message, code) {
  const err = new Error(
    message || 'Stockage média indisponible. Configurez IMAGEKIT_* ou UPLOADS_ROOT persistant.'
  );
  if (code) err.code = code;
  return err;
}

function sanitizeBasename(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildFileName(prefix, originalName, idx) {
  const base = path.basename(originalName || 'file');
  const ext = path.extname(base || '').toLowerCase();
  const nameOnly = base.slice(0, base.length - ext.length);
  const safeBase = sanitizeBasename(nameOnly) || 'file';
  const safeExt = ext && ext.length <= 10 ? ext : '';
  const salt = Math.random().toString(36).slice(2, 8);
  const timestamp = Date.now();
  return `${prefix}_${timestamp}_${salt}_${idx}_${safeBase}${safeExt}`;
}

function isRetryableError(err) {
  const code = err?.code || err?.cause?.code;
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNABORTED' ||
    code === 'EAI_AGAIN' ||
    msg.includes('socket hang up') ||
    msg.includes('econnreset')
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadToImageKitWithRetry(payload, { retries = 2, retryBaseMs = 600 } = {}) {
  const attempts = Math.max(1, toIntOr(retries, 2) + 1);
  const baseMs = toIntOr(retryBaseMs, 600);
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await imagekit.upload(payload);
    } catch (err) {
      lastError = err;
      if (attempt >= attempts || !isRetryableError(err)) break;
      await sleep(baseMs * attempt);
    }
  }

  throw lastError;
}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function saveFileLocally(file, fileName, { subfolder = 'misc' } = {}) {
  const uploadsRoot = resolveUploadsRoot();
  const targetDir = path.join(uploadsRoot, subfolder);
  await ensureDir(targetDir);

  const safeName = sanitizeBasename(fileName || file?.originalname || 'file');
  const localName = safeName || buildFileName(subfolder, file?.originalname, 0);
  const absolutePath = path.join(targetDir, localName);

  await fs.promises.writeFile(absolutePath, file.buffer);

  return {
    url: `/uploads/${subfolder}/${localName}`,
    fileId: null,
  };
}

function guessKind(mime) {
  if (!mime) return 'other';
  if (mime.startsWith('image/')) return 'photo';
  if (mime === 'application/pdf') return 'document';
  return 'other';
}

module.exports = {
  isImageKitEnabled,
  resolveLocalFallbackPolicy,
  mediaStorageError,
  sanitizeBasename,
  buildFileName,
  isRetryableError,
  sleep,
  uploadToImageKitWithRetry,
  ensureDir,
  saveFileLocally,
  guessKind,
};
