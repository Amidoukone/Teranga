'use strict';

const { Country, Service, TradeCategory } = require('../../models');
const { canAccessGeoResource } = require('../utils/geoScope');
const { getMobilityDispatchCandidates } = require('../services/mobilityDispatch.service');
const logger = require('../utils/logger');

exports.listCandidates = async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id, {
      include: [
        { model: TradeCategory, as: 'tradeCategory', attributes: ['id', 'name', 'slug'] },
        { model: Country, as: 'country', attributes: ['id', 'name', 'isoCode'] },
      ],
    });
    if (!service) return res.status(404).json({ error: 'Mission introuvable' });
    if (!canAccessGeoResource(service, req.user)) {
      return res.status(403).json({ error: 'Mission hors scope geographique' });
    }
    if (service.tradeCategory?.slug !== 'mobilite') {
      return res.status(400).json({ error: "Cette mission n'est pas une course Mobilite" });
    }
    const pickupLatitude = Number(service.pickupLatitude);
    const pickupLongitude = Number(service.pickupLongitude);
    if (!Number.isFinite(pickupLatitude) || !Number.isFinite(pickupLongitude)) {
      return res.status(400).json({ error: 'Point de depart GPS manquant' });
    }

    const result = await getMobilityDispatchCandidates({
      service,
      countryCode: service.country?.isoCode || null,
      radiusKm: req.query.radiusKm,
      limit: req.query.limit,
    });

    return res.json({
      mission: {
        id: service.id,
        title: service.title,
        missionStatus: service.missionStatus,
        providerId: service.providerId,
        vehicleId: service.vehicleId,
        requestedVehicleType: service.requestedVehicleType || 'motorcycle',
        pickupAddress: service.pickupAddress,
        pickupLatitude,
        pickupLongitude,
        destinationAddress: service.address,
        destinationLatitude:
          service.latitude == null ? null : Number(service.latitude),
        destinationLongitude:
          service.longitude == null ? null : Number(service.longitude),
      },
      ...result,
    });
  } catch (error) {
    logger.error({ err: error }, 'mobility_dispatch.list_candidates.failed');
    return res.status(500).json({ error: 'Erreur lors de la recherche des chauffeurs' });
  }
};
