'use strict';

const { Vehicle } = require('../../models');

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isCurrent(dateValue) {
  if (!dateValue) return false;
  return String(dateValue).slice(0, 10) >= todayIso();
}

function getDriverComplianceIssues(provider) {
  const issues = [];
  if (!provider?.profilePhotoUrl) issues.push('photo de profil chauffeur');
  if (!provider?.driverLicenseNumber) issues.push('numero de permis');
  if (!provider?.driverLicenseDocumentUrl) issues.push('justificatif du permis');
  if (!provider?.driverLicenseVerified) issues.push('permis verifie');
  if (!isCurrent(provider?.driverLicenseExpiresAt)) issues.push('permis valide');
  if (!provider?.identityDocumentUrl) issues.push("piece d'identite");
  if (!provider?.identityDocumentVerified) issues.push("piece d'identite verifiee");
  return issues;
}

function getVehicleComplianceIssues(
  vehicle,
  { requestedVehicleType = null, requireActive = true } = {}
) {
  const issues = [];
  if (!vehicle) return ['vehicule introuvable'];
  if (requireActive && vehicle.status !== 'active') issues.push('vehicule non actif');
  if (requestedVehicleType && vehicle.vehicleType !== requestedVehicleType) {
    issues.push('type de vehicule incompatible');
  }
  if (!vehicle.brand || !vehicle.model || !vehicle.color || !vehicle.plateNumber) {
    issues.push('identification du vehicule incomplete');
  }
  if (!vehicle.registrationNumber) issues.push('numero de carte grise');
  if (!vehicle.registrationDocumentUrl) issues.push('justificatif de carte grise');
  if (!vehicle.registrationVerified) issues.push('carte grise verifiee');
  if (!vehicle.insurancePolicyNumber) issues.push("numero d'assurance");
  if (!vehicle.insuranceDocumentUrl) issues.push("justificatif d'assurance");
  if (!vehicle.insuranceVerified) issues.push('assurance verifiee');
  if (!isCurrent(vehicle.insuranceExpiresAt)) issues.push('assurance valide');
  if (!vehicle.inspectionCertificateNumber) issues.push('numero de controle technique');
  if (!vehicle.inspectionDocumentUrl) issues.push('justificatif de controle technique');
  if (!vehicle.inspectionVerified) issues.push('controle technique verifie');
  if (!isCurrent(vehicle.inspectionExpiresAt)) issues.push('controle technique valide');
  if (vehicle.vehicleType === 'motorcycle' && !vehicle.hasPassengerHelmet) {
    issues.push('casque passager');
  }
  return issues;
}

async function findEligibleVehicleForProvider({
  provider,
  requestedVehicleType = 'motorcycle',
  vehicleId = null,
  transaction = null,
}) {
  const driverIssues = getDriverComplianceIssues(provider);
  if (driverIssues.length) return { vehicle: null, driverIssues, vehicleIssues: [] };

  const where = {
    providerId: provider.id,
    status: 'active',
  };
  if (requestedVehicleType) where.vehicleType = requestedVehicleType;
  if (vehicleId) where.id = vehicleId;

  const vehicles = await Vehicle.findAll({
    where,
    order: [['updatedAt', 'DESC'], ['id', 'ASC']],
    transaction,
  });
  for (const vehicle of vehicles) {
    const vehicleIssues = getVehicleComplianceIssues(vehicle, { requestedVehicleType });
    if (!vehicleIssues.length) return { vehicle, driverIssues: [], vehicleIssues: [] };
  }

  const selected = vehicleId
    ? await Vehicle.findOne({ where: { id: vehicleId, providerId: provider.id }, transaction })
    : vehicles[0] || null;
  return {
    vehicle: null,
    driverIssues: [],
    vehicleIssues: selected
      ? getVehicleComplianceIssues(selected, { requestedVehicleType })
      : [
          requestedVehicleType
            ? `aucun vehicule ${requestedVehicleType === 'car' ? 'voiture' : 'moto'} actif`
            : 'aucun vehicule actif conforme',
        ],
  };
}

function toComplianceSummary(provider) {
  const driverIssues = getDriverComplianceIssues(provider);
  const vehicles = (provider?.vehicles || []).map((vehicle) => {
    const issues = getVehicleComplianceIssues(vehicle, {
      requestedVehicleType: vehicle.vehicleType,
    });
    return {
      id: vehicle.id,
      vehicleType: vehicle.vehicleType,
      status: vehicle.status,
      eligible: issues.length === 0,
      issues,
    };
  });
  return {
    driverEligible: driverIssues.length === 0,
    driverIssues,
    vehicles,
    hasEligibleVehicle: vehicles.some((vehicle) => vehicle.eligible),
  };
}

module.exports = {
  getDriverComplianceIssues,
  getVehicleComplianceIssues,
  findEligibleVehicleForProvider,
  toComplianceSummary,
};
