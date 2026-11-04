'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

// Optional single-origin deployment. API and upload routes keep their own headers.
function mountFrontend(app, { env = process.env } = {}) {
  if (String(env.SERVE_FRONTEND || '').toLowerCase() !== 'true') return false;
  const directory = path.resolve(__dirname, '../../..', env.FRONTEND_BUILD_DIR || 'frontend/build');
  const index = path.join(directory, 'index.html');
  if (!fs.existsSync(index)) throw new Error('SERVE_FRONTEND requires a compiled frontend/index.html in FRONTEND_BUILD_DIR');
  const html = fs.readFileSync(index, 'utf8');
  const hashes = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attributes, body]) => !/\bsrc\s*=/i.test(attributes) && body.trim())
    .map(([, , body]) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`);
  const policy = [
    "default-src 'self'",
    `script-src 'self' https://maps.googleapis.com https://maps.gstatic.com https://www.googletagmanager.com ${hashes.join(' ')}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "connect-src 'self' https:",
    'frame-src https://www.google.com https://maps.google.com',
    "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'",
  ].join('; ');

  function pageHeaders(res) {
    res.setHeader('Content-Security-Policy', policy);
    res.setHeader('Permissions-Policy', 'geolocation=(self), microphone=(self), camera=(self)');
    res.setHeader('Cache-Control', 'no-store');
    if (env.APP_ENVIRONMENT === 'recette') res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }
  const files = express.static(directory, { index: false, dotfiles: 'ignore', setHeaders: (res, filename) => {
    if (filename === index) pageHeaders(res);
    else if (/\.[a-f0-9]{8,}\./i.test(path.basename(filename))) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    else res.setHeader('Cache-Control', 'no-cache');
  } });

  app.use((req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method)) return next();
    let pathname;
    try { pathname = decodeURIComponent(req.path); } catch { return next(); }
    if (/^\/(?:api|uploads)(?:\/|$)/i.test(pathname) || pathname.endsWith('.map') || pathname.split('/').some(part => part.startsWith('.'))) return next();
    return files(req, res, error => {
      if (error) return next(error);
      // A missing script or image must remain a 404, never a successful HTML page.
      if (path.posix.extname(pathname) || !req.accepts('html')) return next();
      pageHeaders(res);
      return res.sendFile(index);
    });
  });
  return true;
}

module.exports = { mountFrontend };
