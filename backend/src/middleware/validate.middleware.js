'use strict';

const Joi = require('joi');

function formatJoiErrors(error) {
  if (!error || !error.details) return [];
  return error.details.map((detail) => ({
    message: detail.message,
    path: detail.path.join('.'),
    type: detail.type,
  }));
}

function validateBody(schema, options = {}) {
  if (!Joi.isSchema(schema)) {
    throw new Error('Schema Joi invalide pour validateBody().');
  }

  const baseOptions = {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: true,
  };

  return (req, res, next) => {
    const { error, value } = schema.validate(req.body || {}, {
      ...baseOptions,
      ...options,
    });

    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: formatJoiErrors(error),
      });
    }

    req.body = value;
    next();
  };
}

module.exports = {
  validateBody,
};
