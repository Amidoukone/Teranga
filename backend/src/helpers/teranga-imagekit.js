'use strict';

const ImageKit = require('imagekit');
const logger = require('../utils/logger');
const {
  buildMediaStorageDiagnostics,
  isImageKitConfigured,
} = require('../utils/mediaStorageDiagnostics');

const isConfigured = isImageKitConfigured(process.env);

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
      publicKey: String(process.env.IMAGEKIT_PUBLIC_KEY || '').trim(),
      privateKey: String(process.env.IMAGEKIT_PRIVATE_KEY || '').trim(),
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
