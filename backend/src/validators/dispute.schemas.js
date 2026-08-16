'use strict';

const Joi = require('joi');

// docs/DEV_SPEC_TERANGA_v4_PHASE0.md §2.2 — resolution_notes obligatoire à la résolution, pas de
// clôture de litige sans justification écrite (contrainte applicative, pas juste documentée).
const createDisputeSchema = Joi.object({
  reason: Joi.string().valid('non_conforme', 'retard', 'comportement', 'autre').required(),
  description: Joi.string().min(10).max(2000).required(),
  clientEvidence: Joi.array().items(Joi.string()).max(10).optional(),
});

// Deux sous-actions sur le même PATCH (docs/DEV_SPEC_TERANGA_v4_PHASE0.md §2.2) : soit le
// master marque le premier contact (passe en investigation), soit il résout — jamais les deux à
// la fois, resolutionNotes toujours obligatoire avec resolution.
const updateDisputeSchema = Joi.object({
  status: Joi.string().valid('investigating'),
  resolution: Joi.string().valid('refund', 'redo', 'closed'),
  resolutionNotes: Joi.string().min(10).max(2000),
})
  .xor('status', 'resolution')
  .with('resolution', 'resolutionNotes');

module.exports = {
  createDisputeSchema,
  updateDisputeSchema,
};
