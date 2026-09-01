'use strict';

const DELIVERY_PACKAGE_TYPES = Object.freeze({
  DOCUMENT: 'document',
  SMALL: 'small',
  STANDARD: 'standard',
  BULKY: 'bulky',
});

const DELIVERY_PACKAGE_TYPE_VALUES = Object.freeze(Object.values(DELIVERY_PACKAGE_TYPES));

module.exports = {
  DELIVERY_PACKAGE_TYPES,
  DELIVERY_PACKAGE_TYPE_VALUES,
};
