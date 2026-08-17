'use strict';

const { ProviderLiveLocation } = require('../../models');

const DEFAULT_LOCATION_MAX_AGE_SECONDS = 120;

function getLocationMaxAgeSeconds() {
  const configured = Number(process.env.PROVIDER_LOCATION_MAX_AGE_SECONDS);
  if (!Number.isFinite(configured) || configured < 30 || configured > 900) {
    return DEFAULT_LOCATION_MAX_AGE_SECONDS;
  }
  return Math.round(configured);
}

function getLocationAgeSeconds(location, now = new Date()) {
  if (!location?.recordedAt) return null;
  const ageMs = now.getTime() - new Date(location.recordedAt).getTime();
  if (!Number.isFinite(ageMs)) return null;
  return Math.max(0, Math.floor(ageMs / 1000));
}

function isLocationFresh(location, now = new Date()) {
  const ageSeconds = getLocationAgeSeconds(location, now);
  return ageSeconds != null && ageSeconds <= getLocationMaxAgeSeconds();
}

function serializeLiveLocation(location, now = new Date()) {
  if (!location) return null;
  const ageSeconds = getLocationAgeSeconds(location, now);
  return {
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    accuracyMeters:
      location.accuracyMeters == null ? null : Number(location.accuracyMeters),
    headingDegrees:
      location.headingDegrees == null ? null : Number(location.headingDegrees),
    recordedAt: location.recordedAt,
    ageSeconds,
    isFresh: ageSeconds != null && ageSeconds <= getLocationMaxAgeSeconds(),
    vehicleId: location.vehicleId,
  };
}

async function upsertProviderLiveLocation({
  providerId,
  vehicleId,
  latitude,
  longitude,
  accuracyMeters = null,
  headingDegrees = null,
  transaction = null,
}) {
  const values = {
    providerId,
    vehicleId,
    latitude,
    longitude,
    accuracyMeters: accuracyMeters ?? null,
    headingDegrees: headingDegrees ?? null,
    recordedAt: new Date(),
  };
  const existing = await ProviderLiveLocation.findOne({ where: { providerId }, transaction });
  if (existing) {
    await existing.update(values, { transaction });
    return existing;
  }
  return ProviderLiveLocation.create(values, { transaction });
}

module.exports = {
  DEFAULT_LOCATION_MAX_AGE_SECONDS,
  getLocationMaxAgeSeconds,
  getLocationAgeSeconds,
  isLocationFresh,
  serializeLiveLocation,
  upsertProviderLiveLocation,
};
