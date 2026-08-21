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
  // Les informations et justificatifs véhicule sont facultatifs dans le formulaire. Leur absence
  // ne doit donc pas bloquer une affectation après validation explicite de l'admin. En revanche,
  // une date renseignée mais expirée reste un vrai blocage de sécurité.
  if (vehicle.insuranceExpiresAt && !isCurrent(vehicle.insuranceExpiresAt)) {
    issues.push('assurance expiree');
  }
  if (vehicle.inspectionExpiresAt && !isCurrent(vehicle.inspectionExpiresAt)) {
    issues.push('controle technique expire');
  }
  if (vehicle.vehicleType === 'motorcycle' && !vehicle.hasPassengerHelmet) {
    issues.push('casque passager');
  }
  return issues;
}

function getVehicleComplianceWarnings(vehicle) {
  if (!vehicle) return [];
  const warnings = [];
  if (!vehicle.brand || !vehicle.model || !vehicle.color || !vehicle.plateNumber) {
    warnings.push('identification du vehicule incomplete');
  }
  if (!vehicle.registrationNumber) warnings.push('numero de carte grise non renseigne');
  if (!vehicle.registrationDocumentUrl) warnings.push('justificatif de carte grise non ajoute');
  if (vehicle.registrationDocumentUrl && !vehicle.registrationVerified) {
    warnings.push('carte grise non verifiee');
  }
  if (!vehicle.insurancePolicyNumber) warnings.push("numero d'assurance non renseigne");
  if (!vehicle.insuranceDocumentUrl) warnings.push("justificatif d'assurance non ajoute");
  if (vehicle.insuranceDocumentUrl && !vehicle.insuranceVerified) {
    warnings.push('assurance non verifiee');
  }
  if (!vehicle.inspectionCertificateNumber) {
    warnings.push('numero de controle technique non renseigne');
  }
  if (!vehicle.inspectionDocumentUrl) {
    warnings.push('justificatif de controle technique non ajoute');
  }
  if (vehicle.inspectionDocumentUrl && !vehicle.inspectionVerified) {
    warnings.push('controle technique non verifie');
  }
  return warnings;
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
    const activationIssues = getVehicleComplianceIssues(vehicle, {
      requestedVehicleType: vehicle.vehicleType,
      requireActive: false,
    });
    return {
      id: vehicle.id,
      vehicleType: vehicle.vehicleType,
      status: vehicle.status,
      eligible: issues.length === 0,
      issues,
      canBeActivated: ['pending', 'active'].includes(vehicle.status) && activationIssues.length === 0,
      activationIssues,
      warnings: getVehicleComplianceWarnings(vehicle),
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
  getVehicleComplianceWarnings,
  findEligibleVehicleForProvider,
  toComplianceSummary,
};
