'use strict';

const ImageKit = require('imagekit');
const logger = require('../utils/logger');
const { buildMediaStorageDiagnostics } = require('../utils/mediaStorageDiagnostics');

const isConfigured = Boolean(
  process.env.IMAGEKIT_PUBLIC_KEY &&
    process.env.IMAGEKIT_PRIVATE_KEY &&
    process.env.IMAGEKIT_URL_ENDPOINT
);

if (!isConfigured) {
  logger.warn(
    buildMediaStorageDiagnostics({ module: 'imagekit-helper' }),
    'imagekit.config.missing'
  );
} else {
  logger.info(
    buildMediaStorageDiagnostics({ module: 'imagekit-helper' }),
    'imagekit.config.ready'
  );
}

const imagekit = isConfigured
  ? new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT.trim(),
    })
  : {
      upload: async () => {
        throw new Error('ImageKit non configure');
      },
      deleteFile: async () => {
        throw new Error('ImageKit non configure');
      },
    };

module.exports = imagekit;

