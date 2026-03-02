const path = require('path');

function resolveUploadsRoot() {
  const configured = String(
    process.env.UPLOADS_ROOT || process.env.UPLOADS_DIR || ''
  ).trim();

  if (configured) {
    if (path.isAbsolute(configured)) return configured;
    return path.resolve(path.join(__dirname, '..', '..', configured));
  }

  return path.resolve(path.join(__dirname, '..', '..', 'uploads'));
}

module.exports = {
  resolveUploadsRoot,
};
