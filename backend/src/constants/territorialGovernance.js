'use strict';

const ORGANIZATION_TYPES = Object.freeze([
  'HEADQUARTERS',
  'MASTER',
  'REGIONAL',
  'PARTNER',
]);

const ORGANIZATION_STATUSES = Object.freeze([
  'pending',
  'active',
  'suspended',
  'inactive',
]);

const TERRITORY_TYPES = Object.freeze([
  'COUNTRY',
  'REGION',
  'CITY',
  'DISTRICT',
  'ZONE',
]);

const ASSIGNMENT_STATUSES = Object.freeze([
  'active',
  'inactive',
  'suspended',
]);

module.exports = {
  ORGANIZATION_TYPES,
  ORGANIZATION_STATUSES,
  TERRITORY_TYPES,
  ASSIGNMENT_STATUSES,
};
