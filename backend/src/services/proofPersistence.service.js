'use strict';
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { resolveUploadsRoot } = require('../utils/uploadsRoot');

const MAX_BYTES = 25 * 1024 * 1024;
function digest(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

async function readProof(location, { uploadsRoot = resolveUploadsRoot(), env = process.env, fetchImpl = fetch } = {}) {
  if (typeof location !== 'string' || !location) throw new Error('Référence de justificatif invalide');
  let content;
  if (location.startsWith('/uploads/')) {
    if (/[?#\\]/.test(location)) throw new Error('Chemin local invalide');
    const relative = decodeURIComponent(location.slice('/uploads/'.length));
    if (relative.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error('Chemin local invalide');
    const root = await fs.realpath(uploadsRoot);
    const target = await fs.realpath(path.resolve(root, relative));
    if (!isWithin(root, target)) throw new Error('Le justificatif doit rester dans le stockage configuré');
    const stat = await fs.stat(target);
    if (!stat.isFile() || stat.size > MAX_BYTES) throw new Error('Justificatif invalide ou trop volumineux');
    content = await fs.readFile(target);
  } else {
    const url = new URL(location);
    const endpoint = new URL(env.IMAGEKIT_URL_ENDPOINT || 'https://invalid.invalid');
    if (url.protocol !== 'https:' || url.origin !== endpoint.origin || url.hostname === 'invalid.invalid' || url.username || url.password) throw new Error('Utiliser une URL HTTPS du stockage ImageKit configuré');
    const response = await fetchImpl(url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(30000), headers: { 'Cache-Control': 'no-cache' } });
    if (!response.ok) throw new Error('Justificatif distant inaccessible');
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > MAX_BYTES) throw new Error('Justificatif trop volumineux');
      chunks.push(Buffer.from(chunk));
    }
    content = Buffer.concat(chunks);
  }
  if (!content.length || content.length > MAX_BYTES) throw new Error('Justificatif vide ou trop volumineux');
  return { bytes: content.length, sha256: digest(content) };
}

async function recordProof(location, referenceFile, options = {}) {
  const fingerprint = await readProof(location, options);
  const reference = { version: 1, location, ...fingerprint, recordedAt: new Date().toISOString() };
  await fs.writeFile(referenceFile, `${JSON.stringify(reference, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return reference;
}

async function verifyProof(referenceFile, options = {}) {
  const reference = JSON.parse(await fs.readFile(referenceFile, 'utf8'));
  if (reference.version !== 1 || !/^[a-f0-9]{64}$/.test(reference.sha256 || '') || !Number.isSafeInteger(reference.bytes) || reference.bytes <= 0 || !Number.isFinite(Date.parse(reference.recordedAt))) throw new Error('Fichier de référence invalide');
  const actual = await readProof(reference.location, options);
  if (actual.sha256 !== reference.sha256 || actual.bytes !== reference.bytes) throw new Error('Le justificatif a changé depuis la prise de référence');
  return { matches: true, ...actual, recordedAt: reference.recordedAt, checkedAt: new Date().toISOString(), requiresRestartConfirmation: true };
}

module.exports = { readProof, recordProof, verifyProof };
