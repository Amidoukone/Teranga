'use strict';

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
  const hasEta = durationSeconds != null && Number.isFinite(Number(durationSeconds));
  const etaMinutes = hasEta ? Number(durationSeconds) / 60 : null;
  const proximityScore = hasEta ? clamp(100 - etaMinutes * 4, 0, 100) : 0;
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
  const locationMaxAgeSeconds = getLocationMaxAgeSeconds();
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
        required: false,
      },
      {
        model: Vehicle,
        as: 'vehicles',
        where: { status: 'active', vehicleType: requestedVehicleType },
        required: true,
      },
    ],
  });

  const pickup = {
    latitude: Number(service.pickupLatitude),
    longitude: Number(service.pickupLongitude),
  };
  const hasPickup = Number.isFinite(pickup.latitude) && Number.isFinite(pickup.longitude);
  const radiusMeters = radiusKm * 1000;
  const preselected = providers
    .filter((provider) => getDriverComplianceIssues(provider).length === 0)
    .map((provider) => {
      const location = provider.liveLocation;
      const eligibleVehicles = (provider.vehicles || []).filter(
        (vehicle) =>
          getVehicleComplianceIssues(vehicle, { requestedVehicleType }).length === 0
      );
      const vehicle =
        eligibleVehicles.find(
          (candidate) => String(candidate.id) === String(location?.vehicleId)
        ) || eligibleVehicles[0];
      if (!vehicle) return null;

      const locationAgeSeconds = getLocationAgeSeconds(location);
      const hasFreshLocation = Boolean(
        location &&
          locationAgeSeconds != null &&
          locationAgeSeconds <= locationMaxAgeSeconds &&
          Number.isFinite(Number(location.latitude)) &&
          Number.isFinite(Number(location.longitude))
      );
      if (!hasFreshLocation) {
        return {
          provider,
          location: null,
          vehicle,
          straightLineDistanceMeters: null,
        };
      }
      if (!hasPickup) {
        return {
          provider,
          location,
          vehicle,
          straightLineDistanceMeters: null,
        };
      }
      const straightLineDistanceMeters = haversineMeters(
        { latitude: Number(location.latitude), longitude: Number(location.longitude) },
        pickup
      );
      if (hasPickup && straightLineDistanceMeters > radiusMeters) return null;
      return { provider, location, vehicle, straightLineDistanceMeters };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.location && !b.location) return -1;
      if (!a.location && b.location) return 1;
      return (
        (a.straightLineDistanceMeters ?? Number.POSITIVE_INFINITY) -
        (b.straightLineDistanceMeters ?? Number.POSITIVE_INFINITY)
      );
    })
    .slice(0, limit);

  const locatedCandidates = preselected.filter((entry) => entry.location);
  const matrix = hasPickup && locatedCandidates.length
    ? await getDistanceMatrix(
        locatedCandidates.map(({ location }) => ({
          lat: Number(location.latitude),
          lng: Number(location.longitude),
        })),
        [{ lat: pickup.latitude, lng: pickup.longitude }]
      )
    : null;

  const matrixRowByProviderId = new Map(
    locatedCandidates.map((entry, index) => [String(entry.provider.id), matrix?.rows?.[index]?.[0]])
  );
  const candidates = preselected.map((entry) => {
    const matrixElement = matrixRowByProviderId.get(String(entry.provider.id));
    const hasRoadEstimate =
      matrixElement?.status === 'OK' &&
      Number.isFinite(Number(matrixElement.durationSeconds));
    const approachDistanceMeters = entry.location && hasPickup
      ? hasRoadEstimate
        ? Number(matrixElement.distanceMeters)
        : entry.straightLineDistanceMeters
      : null;
    const approachDurationSeconds = entry.location && hasPickup
      ? hasRoadEstimate
        ? Number(matrixElement.durationSeconds)
        : Math.round((entry.straightLineDistanceMeters / 1000 / FALLBACK_SPEED_KPH) * 3600)
      : null;
    const scores = calculateScores(entry.provider, approachDurationSeconds);

    return {
      provider: entry.provider.toPublicDTO(),
      vehicle: entry.vehicle.toPublicDTO(),
      location: entry.location
        ? {
            latitude: Number(entry.location.latitude),
            longitude: Number(entry.location.longitude),
            accuracyMeters:
              entry.location.accuracyMeters == null
                ? null
                : Number(entry.location.accuracyMeters),
            recordedAt: entry.location.recordedAt,
            ageSeconds: getLocationAgeSeconds(entry.location),
          }
        : null,
      approachDistanceMeters,
      approachDurationSeconds,
      straightLineDistanceMeters: entry.straightLineDistanceMeters,
      distanceSource: entry.location
        ? hasRoadEstimate
          ? 'google'
          : 'straight_line_fallback'
        : 'unavailable',
      ...scores,
    };
  });

  candidates.sort(
    (a, b) =>
      b.rankingScore - a.rankingScore ||
      (a.approachDurationSeconds ?? Number.POSITIVE_INFINITY) -
        (b.approachDurationSeconds ?? Number.POSITIVE_INFINITY) ||
      a.provider.id - b.provider.id
  );

  return {
    candidates,
    meta: {
      radiusKm,
      candidateLimit: limit,
      locationMaxAgeSeconds,
      pickupPositionAvailable: hasPickup,
      candidatesWithoutPosition: candidates.filter((candidate) => !candidate.location).length,
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

