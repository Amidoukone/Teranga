'use strict';

const Joi = require('joi');

// Les medias envoyes depuis la galerie sont stockes soit sur ImageKit (URL https), soit dans le
// stockage local/persistant expose sous /uploads en developpement. L'ancien validateur `.uri()`
// refusait cette seconde forme : l'upload reussissait, puis l'enregistrement du chauffeur ou du
// vehicule echouait en demandant indirectement une URL externe.
const nullableMediaReference = Joi.string()
  .trim()
  .max(500)
  .custom((value, helpers) => {
    if (value.startsWith('/uploads/')) {
      const segments = value.slice('/uploads/'.length).split('/');
      const safeLocalPath =
        segments.length > 1 &&
        segments.every(
          (segment) =>
            segment &&
            segment !== '.' &&
            segment !== '..' &&
            /^[A-Za-z0-9._-]+$/.test(segment)
        );
      if (safeLocalPath) return value;
    }
    try {
      const parsed = new URL(value);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return value;
    } catch (_error) {
      // Le message Joi standard est volontairement conserve ci-dessous.
    }
    return helpers.error('string.uri');
  }, 'media URL validation')
  .allow('', null);
const nullableText = (max) => Joi.string().trim().max(max).allow('', null);
const optionalIsoDate = Joi.date().iso().allow('', null);

const vehicleFields = {
  vehicleType: Joi.string().valid('motorcycle', 'car'),
  brand: nullableText(80),
  model: nullableText(80),
  color: nullableText(50),
  plateNumber: nullableText(30),
  capacity: Joi.number().integer().min(1).max(12).empty(''),
  hasPassengerHelmet: Joi.boolean(),
  hasAirConditioning: Joi.boolean(),
  photoUrl: nullableMediaReference,
  registrationNumber: nullableText(80),
  registrationDocumentUrl: nullableMediaReference,
  registrationVerified: Joi.boolean(),
  insurancePolicyNumber: nullableText(100),
  insuranceDocumentUrl: nullableMediaReference,
  insuranceExpiresAt: optionalIsoDate,
  insuranceVerified: Joi.boolean(),
  inspectionCertificateNumber: nullableText(100),
  inspectionDocumentUrl: nullableMediaReference,
  inspectionExpiresAt: optionalIsoDate,
  inspectionVerified: Joi.boolean(),
  status: Joi.string().valid('pending', 'active', 'suspended', 'retired'),
};

const createVehicleSchema = Joi.object({
  ...vehicleFields,
  vehicleType: vehicleFields.vehicleType.required(),
  capacity: vehicleFields.capacity.default(1),
  status: vehicleFields.status.default('pending'),
});

const updateVehicleSchema = Joi.object(vehicleFields).min(1);

const updateDriverComplianceSchema = Joi.object({
  profilePhotoUrl: nullableMediaReference,
  driverLicenseNumber: nullableText(80),
  driverLicenseDocumentUrl: nullableMediaReference,
  driverLicenseExpiresAt: optionalIsoDate,
  driverLicenseVerified: Joi.boolean(),
  identityDocumentUrl: nullableMediaReference,
  identityDocumentVerified: Joi.boolean(),
}).min(1);

module.exports = {
  createVehicleSchema,
  updateVehicleSchema,
  updateDriverComplianceSchema,
};
