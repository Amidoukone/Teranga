'use strict';

const ImageKit = require('imagekit');

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
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT.trim(),
    })
  : {
      upload: async () => {
        throw new Error('ImageKit non configuré');
      },
      deleteFile: async () => {
        throw new Error('ImageKit non configuré');
      },
    };

module.exports = imagekit;
