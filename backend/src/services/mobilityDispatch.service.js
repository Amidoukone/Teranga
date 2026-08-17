'use strict';

const { Op } = require('sequelize');
const {
  Provider,
  ProviderLiveLocation,
  TradeCategory,
  Vehicle,
} = require('../../models');
const { getDistanceMatrix } = require('./distanceMatrix.service');
const {
  getDriverComplianceIssues,
  getVehicleComplianceIssues,
} = require('./mobilityCompliance.service');
const {
  getLocationAgeSeconds,
  getLocationMaxAgeSeconds,
} = require('./providerPresence.service');

const DEFAULT_RADIUS_KM = 8;
const MAX_RADIUS_KM = 50;
const DEFAULT_CANDIDATE_LIMIT = 10;
const MAX_CANDIDATE_LIMIT = 20;
const FALLBACK_SPEED_KPH = 25;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function haversineMeters(origin, destination) {
  const earthRadiusMeters = 6371000;
  const toRadians = (value) => (Number(value) * Math.PI) / 180;
  const lat1 = toRadians(origin.latitude);
  const lat2 = toRadians(destination.latitude);
  const deltaLat = lat2 - lat1;
  const deltaLng = toRadians(destination.longitude) - toRadians(origin.longitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return Math.round(2 * earthRadiusMeters * Math.asin(Math.sqrt(a)));
}

function parseRadiusKm(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, 1, MAX_RADIUS_KM) : DEFAULT_RADIUS_KM;
}

function parseCandidateLimit(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.round(clamp(parsed, 1, MAX_CANDIDATE_LIMIT))
    : DEFAULT_CANDIDATE_LIMIT;
}

function calculateScores(provider, durationSeconds) {
  const etaMinutes = durationSeconds / 60;
  const proximityScore = clamp(100 - etaMinutes * 4, 0, 100);
  const reliabilityScore = clamp(
    100 - Number(provider.disputesAgainstCount || 0) * 15 +
      Math.min(10, Number(provider.completedMissionsCount || 0) / 10),
    0,
    100
  );
  const rating = provider.averageRating == null ? 2.5 : Number(provider.averageRating);
  const reputationScore = clamp((rating / 5) * 100, 0, 100);
  const rankingScore = clamp(
    proximityScore * 0.55 +
      reliabilityScore * 0.25 +
      reputationScore * 0.2 +
      (provider.badgeCertified ? 3 : 0),
    0,
    100
  );
  return {
    proximityScore: Math.round(proximityScore),
    reliabilityScore: Math.round(reliabilityScore),
    reputationScore: Math.round(reputationScore),
    rankingScore: Math.round(rankingScore),
  };
}

async function getMobilityDispatchCandidates({
  service,
  countryCode = null,
  radiusKm: rawRadiusKm,
  limit: rawLimit,
}) {
  const radiusKm = parseRadiusKm(rawRadiusKm);
  const limit = parseCandidateLimit(rawLimit);
  const requestedVehicleType = service.requestedVehicleType || 'motorcycle';
  const cutoff = new Date(Date.now() - getLocationMaxAgeSeconds() * 1000);
  const where = {
    status: 'active',
    availabilityStatus: 'available',
    ...(countryCode ? { countryCode } : {}),
  };

  const providers = await Provider.findAll({
    where,
    include: [
      {
        model: TradeCategory,
        as: 'tradeCategories',
        through: { attributes: [] },
        where: { slug: 'mobilite', isActive: true },
        required: true,
        attributes: ['id', 'slug'],
      },
      {
        model: ProviderLiveLocation,
        as: 'liveLocation',
        where: { recordedAt: { [Op.gte]: cutoff } },
        required: true,
        include: [
          {
            model: Vehicle,
            as: 'vehicle',
            where: { status: 'active', vehicleType: requestedVehicleType },
            required: true,
          },
        ],
      },
    ],
  });

  const pickup = {
    latitude: Number(service.pickupLatitude),
    longitude: Number(service.pickupLongitude),
  };
  const radiusMeters = radiusKm * 1000;
  const preselected = providers
    .filter((provider) => getDriverComplianceIssues(provider).length === 0)
    .map((provider) => {
      const location = provider.liveLocation;
      const vehicle = location?.vehicle;
      if (
        !vehicle ||
        getVehicleComplianceIssues(vehicle, { requestedVehicleType }).length > 0
      ) {
        return null;
      }
      const straightLineDistanceMeters = haversineMeters(
        { latitude: Number(location.latitude), longitude: Number(location.longitude) },
        pickup
      );
      if (straightLineDistanceMeters > radiusMeters) return null;
      return { provider, location, vehicle, straightLineDistanceMeters };
    })
    .filter(Boolean)
    .sort((a, b) => a.straightLineDistanceMeters - b.straightLineDistanceMeters)
    .slice(0, limit);

  const matrix = preselected.length
    ? await getDistanceMatrix(
        preselected.map(({ location }) => ({
          lat: Number(location.latitude),
          lng: Number(location.longitude),
        })),
        [{ lat: pickup.latitude, lng: pickup.longitude }]
      )
    : null;

  const candidates = preselected.map((entry, index) => {
    const matrixElement = matrix?.rows?.[index]?.[0];
    const hasRoadEstimate =
      matrixElement?.status === 'OK' &&
      Number.isFinite(Number(matrixElement.durationSeconds));
    const approachDistanceMeters = hasRoadEstimate
      ? Number(matrixElement.distanceMeters)
      : entry.straightLineDistanceMeters;
    const approachDurationSeconds = hasRoadEstimate
      ? Number(matrixElement.durationSeconds)
      : Math.round((entry.straightLineDistanceMeters / 1000 / FALLBACK_SPEED_KPH) * 3600);
    const scores = calculateScores(entry.provider, approachDurationSeconds);

    return {
      provider: entry.provider.toPublicDTO(),
      vehicle: entry.vehicle.toPublicDTO(),
      location: {
        latitude: Number(entry.location.latitude),
        longitude: Number(entry.location.longitude),
        accuracyMeters:
          entry.location.accuracyMeters == null ? null : Number(entry.location.accuracyMeters),
        recordedAt: entry.location.recordedAt,
        ageSeconds: getLocationAgeSeconds(entry.location),
      },
      approachDistanceMeters,
      approachDurationSeconds,
      straightLineDistanceMeters: entry.straightLineDistanceMeters,
      distanceSource: hasRoadEstimate ? 'google' : 'straight_line_fallback',
      ...scores,
    };
  });

  candidates.sort(
    (a, b) =>
      b.rankingScore - a.rankingScore ||
      a.approachDurationSeconds - b.approachDurationSeconds ||
      a.provider.id - b.provider.id
  );

  return {
    candidates,
    meta: {
      radiusKm,
      candidateLimit: limit,
      locationMaxAgeSeconds: getLocationMaxAgeSeconds(),
      requestedVehicleType,
    },
  };
}

module.exports = {
  DEFAULT_RADIUS_KM,
  MAX_RADIUS_KM,
  haversineMeters,
  getMobilityDispatchCandidates,
};
