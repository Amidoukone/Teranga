'use strict';

const { Op } = require('sequelize');
const { Provider, Service, Vehicle } = require('../../models');
const { canManageProvider } = require('../utils/providerScope');
const { getVehicleComplianceIssues } = require('../services/mobilityCompliance.service');
const logger = require('../utils/logger');

async function findManagedProvider(req, res) {
  const provider = await Provider.findByPk(req.params.id);
  if (!provider) {
    res.status(404).json({ error: 'Prestataire introuvable' });
    return null;
  }
  if (!(await canManageProvider(req.user, provider))) {
    res.status(403).json({ error: 'Acces interdit' });
    return null;
  }
  return provider;
}

function normalizePayload(payload) {
  const normalized = { ...payload };
  for (const key of [
    'brand',
    'model',
    'color',
    'plateNumber',
    'photoUrl',
    'registrationNumber',
    'registrationDocumentUrl',
    'insurancePolicyNumber',
    'insuranceDocumentUrl',
    'insuranceExpiresAt',
    'inspectionCertificateNumber',
    'inspectionDocumentUrl',
    'inspectionExpiresAt',
  ]) {
    if (normalized[key] === undefined) continue;
    if (normalized[key] === null || String(normalized[key]).trim() === '') {
      normalized[key] = null;
      continue;
    }
    if (key === 'plateNumber') {
      normalized[key] = String(normalized[key]).trim().toUpperCase();
    }
  }
  return normalized;
}

exports.list = async (req, res) => {
  try {
    const provider = await findManagedProvider(req, res);
    if (!provider) return;
    const vehicles = await Vehicle.findAll({
      where: { providerId: provider.id },
      order: [['status', 'ASC'], ['updatedAt', 'DESC']],
    });
    return res.json({ vehicles });
  } catch (error) {
    logger.error({ err: error }, 'vehicle.list.failed');
    return res.status(500).json({ error: 'Erreur lors de la recuperation des vehicules' });
  }
};

exports.create = async (req, res) => {
  try {
    const provider = await findManagedProvider(req, res);
    if (!provider) return;
    const payload = normalizePayload(req.body);
    const candidate = Vehicle.build({ ...payload, providerId: provider.id });
    if (candidate.status === 'active') {
      const issues = getVehicleComplianceIssues(candidate, {
        requestedVehicleType: candidate.vehicleType,
        requireActive: false,
      });
      if (issues.length) {
        return res.status(400).json({
          error: `Vehicule non conforme : ${issues.join(', ')}`,
          complianceIssues: issues,
        });
      }
    }
    await candidate.save();
    return res.status(201).json({ vehicle: candidate });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Cette plaque existe deja pour ce prestataire' });
    }
    logger.error({ err: error }, 'vehicle.create.failed');
    return res.status(500).json({ error: 'Erreur lors de la creation du vehicule' });
  }
};

exports.update = async (req, res) => {
  try {
    const provider = await findManagedProvider(req, res);
    if (!provider) return;
    const vehicle = await Vehicle.findOne({
      where: { id: req.params.vehicleId, providerId: provider.id },
    });
    if (!vehicle) return res.status(404).json({ error: 'Vehicule introuvable' });

    const payload = normalizePayload(req.body);
    const previousStatus = vehicle.status;
    const nextStatus = payload.status || vehicle.status;
    vehicle.set(payload);
    if (nextStatus === 'active') {
      const issues = getVehicleComplianceIssues(vehicle, {
        requestedVehicleType: vehicle.vehicleType,
        requireActive: false,
      });
      if (issues.length) {
        return res.status(400).json({
          error: `Vehicule non conforme : ${issues.join(', ')}`,
          complianceIssues: issues,
        });
      }
    }

    if (['suspended', 'retired'].includes(nextStatus) && previousStatus !== nextStatus) {
      const assignedCount = await Service.count({
        where: {
          vehicleId: vehicle.id,
          missionStatus: {
            [Op.notIn]: ['COMPLETED', 'VALIDATED', 'CLOSED', 'CANCELLED_BY_CLIENT'],
          },
        },
      });
      if (assignedCount > 0) {
        return res.status(409).json({
          error: 'Ce vehicule est attache a une course en cours',
        });
      }
    }

    await vehicle.save();
    return res.json({ vehicle });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Cette plaque existe deja pour ce prestataire' });
    }
    logger.error({ err: error }, 'vehicle.update.failed');
    return res.status(500).json({ error: 'Erreur lors de la mise a jour du vehicule' });
  }
};
