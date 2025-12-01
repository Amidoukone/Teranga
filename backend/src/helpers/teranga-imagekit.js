'use strict';

const ImageKit = require('imagekit');

if (
  !process.env.IMAGEKIT_PUBLIC_KEY ||
  !process.env.IMAGEKIT_PRIVATE_KEY ||
  !process.env.IMAGEKIT_URL_ENDPOINT
) {
  console.warn(
    '⚠️ ImageKit: variables manquantes. ' +
      'Assurez-vous que IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY et IMAGEKIT_URL_ENDPOINT sont définies.'
  );
}

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || '',
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
  urlEndpoint: (process.env.IMAGEKIT_URL_ENDPOINT || '').trim(),
});

module.exports = imagekit;
