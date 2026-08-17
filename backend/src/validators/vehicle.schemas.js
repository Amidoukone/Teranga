'use strict';

const Joi = require('joi');

const nullableUrl = Joi.string().trim().uri().max(500).allow('', null);
const nullableText = (max) => Joi.string().trim().max(max).allow('', null);

const vehicleFields = {
  vehicleType: Joi.string().valid('motorcycle', 'car'),
  brand: Joi.string().trim().min(1).max(80),
  model: Joi.string().trim().min(1).max(80),
  color: Joi.string().trim().min(1).max(50),
  plateNumber: Joi.string().trim().min(2).max(30),
  capacity: Joi.number().integer().min(1).max(12),
  hasPassengerHelmet: Joi.boolean(),
  hasAirConditioning: Joi.boolean(),
  photoUrl: nullableUrl,
  registrationNumber: nullableText(80),
  registrationDocumentUrl: nullableUrl,
  registrationVerified: Joi.boolean(),
  insurancePolicyNumber: nullableText(100),
  insuranceDocumentUrl: nullableUrl,
  insuranceExpiresAt: Joi.date().iso().allow(null),
  insuranceVerified: Joi.boolean(),
  inspectionCertificateNumber: nullableText(100),
  inspectionDocumentUrl: nullableUrl,
  inspectionExpiresAt: Joi.date().iso().allow(null),
  inspectionVerified: Joi.boolean(),
  status: Joi.string().valid('pending', 'active', 'suspended', 'retired'),
};

const createVehicleSchema = Joi.object({
  ...vehicleFields,
  vehicleType: vehicleFields.vehicleType.required(),
  brand: vehicleFields.brand.required(),
  model: vehicleFields.model.required(),
  color: vehicleFields.color.required(),
  plateNumber: vehicleFields.plateNumber.required(),
  capacity: vehicleFields.capacity.default(1),
  status: vehicleFields.status.default('pending'),
});

const updateVehicleSchema = Joi.object(vehicleFields).min(1);

const updateDriverComplianceSchema = Joi.object({
  profilePhotoUrl: nullableUrl,
  driverLicenseNumber: nullableText(80),
  driverLicenseDocumentUrl: nullableUrl,
  driverLicenseExpiresAt: Joi.date().iso().allow(null),
  driverLicenseVerified: Joi.boolean(),
  identityDocumentUrl: nullableUrl,
  identityDocumentVerified: Joi.boolean(),
}).min(1);

module.exports = {
  createVehicleSchema,
  updateVehicleSchema,
  updateDriverComplianceSchema,
};
