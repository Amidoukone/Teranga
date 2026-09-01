'use strict';

const SERVICE_FAMILIES = Object.freeze(['core', 'frequency', 'showcase']);
const EXECUTION_PROFILES = Object.freeze(['agent', 'provider', 'mobility', 'delivery']);

const CLASSIC_CATALOG_DEFINITIONS = Object.freeze([
  { key: 'errand', name: 'Course / Commission' },
  { key: 'administrative', name: 'Demarche administrative' },
  { key: 'payment', name: 'Paiement' },
  { key: 'money_transfer', name: "Transfert d'argent" },
  { key: 'other', name: 'Autre service' },
]);

module.exports = {
  SERVICE_FAMILIES,
  EXECUTION_PROFILES,
  CLASSIC_CATALOG_DEFINITIONS,
};
