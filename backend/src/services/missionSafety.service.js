'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  Country,
  MissionShareToken,
  Region,
} = require('../../models');

const DEFAULT_SHARE_TTL_HOURS = 6;
const DEFAULT_POSITION_STALE_SECONDS = 10 * 60;

function getSafetySecret() {
  const secret = process.env.MISSION_START_CODE_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('MISSION_START_CODE_SECRET ou JWT_SECRET requis');
  return secret;
}

function getMissionStartCode(service) {
  const createdAt = new Date(service.createdAt).toISOString();
  const digest = crypto
    .createHmac('sha256', getSafetySecret())
    .update(`${service.id}:${service.clientId}:${createdAt}`)
    .digest();
  return String(digest.readUInt32BE(0) % 10000).padStart(4, '0');
}

function isStartCodeValid(service, submittedCode) {
  const expected = Buffer.from(getMissionStartCode(service));
  const submitted = Buffer.from(String(submittedCode || ''));
  return expected.length === submitted.length && crypto.timingSafeEqual(expected, submitted);
}

function hashShareToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function getPositionStaleSeconds() {
  const configured = Number(process.env.MISSION_LAST_LOCATION_STALE_SECONDS);
  if (!Number.isFinite(configured) || configured < 60 || configured > 86400) {
    return DEFAULT_POSITION_STALE_SECONDS;
  }
  return Math.round(configured);
}

function serializeOptionalPosition(location, now = new Date()) {
  if (!location?.recordedAt) return null;
  const ageSeconds = Math.max(
    0,
    Math.floor((now.getTime() - new Date(location.recordedAt).getTime()) / 1000)
  );
  return {
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    recordedAt: location.recordedAt,
    ageSeconds,
    isStale: ageSeconds > getPositionStaleSeconds(),
  };
}

async function resolveAssistancePhone(service) {
  if (service.regionId) {
    const region = await Region.findByPk(service.regionId, { attributes: ['contactPhone'] });
    if (region?.contactPhone) return region.contactPhone;
  }
  if (service.countryId) {
    const country = await Country.findByPk(service.countryId, { attributes: ['contactPhone'] });
    if (country?.contactPhone) return country.contactPhone;
  }
  return process.env.TERANGA_ASSISTANCE_PHONE || null;
}

async function createMissionShareToken({ serviceId, createdByUserId, ttlHours }) {
  const parsedTtl = Number(ttlHours);
  const safeTtl = Number.isFinite(parsedTtl)
    ? Math.min(24, Math.max(1, Math.round(parsedTtl)))
    : DEFAULT_SHARE_TTL_HOURS;
  const now = new Date();
  await MissionShareToken.update(
    { revokedAt: now },
    { where: { serviceId, revokedAt: null } }
  );
  const token = crypto.randomBytes(32).toString('base64url');
  const record = await MissionShareToken.create({
    serviceId,
    createdByUserId,
    tokenHash: hashShareToken(token),
    expiresAt: new Date(now.getTime() + safeTtl * 60 * 60 * 1000),
  });
  return { token, record };
}

async function findValidMissionShareToken(token) {
  if (!token || String(token).length < 32 || String(token).length > 128) return null;
  return MissionShareToken.findOne({
    where: {
      tokenHash: hashShareToken(token),
      revokedAt: null,
      expiresAt: { [Op.gt]: new Date() },
    },
  });
}

module.exports = {
  DEFAULT_SHARE_TTL_HOURS,
  getMissionStartCode,
  isStartCodeValid,
  serializeOptionalPosition,
  resolveAssistancePhone,
  createMissionShareToken,
  findValidMissionShareToken,
};
