'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'teranga_mobility_compliance_test_secret';

const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../../src/app');
const db = require('../../models');
const {
  runLogisticsAcceptanceCheck,
} = require('../../src/jobs/logisticsAcceptance.job');
const { resolveUploadsRoot } = require('../../src/utils/uploadsRoot');

let dbReady = false;
const created = {
  userIds: [],
  countryIds: [],
  serviceIds: [],
  providerIds: [],
  vehicleIds: [],
  tradeCategoryIds: [],
  mediaUrls: [],
};

async function checkDatabase() {
  try {
    await db.sequelize.authenticate();
    const tables = await db.sequelize.getQueryInterface().showAllTables();
    return tables.some(
      (table) =>
        String(typeof table === 'object' ? table.tableName || table.name : table).toLowerCase() ===
        'vehicles'
    );
  } catch (_error) {
    return false;
  }
}

async function makeCountry() {
  for (let index = 0; index < 30; index += 1) {
    const isoCode = `V${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
    try {
      const country = await db.Country.create({
        name: `Mobility-${Date.now()}-${isoCode}-${index}`,
        isoCode,
        currency: 'XOF',
        isActive: true,
        contactPhone: '+22370000000',
      });
      created.countryIds.push(country.id);
      return country;
    } catch (error) {
      if (error?.name !== 'SequelizeUniqueConstraintError') throw error;
    }
  }
  throw new Error('Impossible de creer un pays de test unique');
}

async function makeUser({ role, countryId = null }) {
  const password = 'Password123!';
  const email = `mobility_${role}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
  const user = await db.User.create({
    email,
    passwordHash: await bcrypt.hash(password, 10),
    firstName: 'Mobility',
    lastName: role,
    role,
    countryId,
  });
  created.userIds.push(user.id);
  return { user, password };
}

async function login(email, password) {
  const response = await request(app).post('/api/v1/auth/login').send({ email, password });
  expect(response.status).toBe(200);
  return response.body.token;
}

function vehiclePayload(vehicleType, plateNumber, overrides = {}) {
  return {
    vehicleType,
    brand: vehicleType === 'car' ? 'Toyota' : 'TVS',
    model: vehicleType === 'car' ? 'Corolla' : 'Neo',
    color: 'Blanc',
    plateNumber,
    capacity: vehicleType === 'car' ? 4 : 1,
    hasPassengerHelmet: vehicleType === 'motorcycle',
    hasAirConditioning: vehicleType === 'car',
    photoUrl: `https://private.example.test/${plateNumber}/photo.jpg`,
    registrationNumber: `REG-${plateNumber}`,
    registrationDocumentUrl: `https://private.example.test/${plateNumber}/registration.pdf`,
    registrationVerified: true,
    insurancePolicyNumber: `INS-${plateNumber}`,
    insuranceDocumentUrl: `https://private.example.test/${plateNumber}/insurance.pdf`,
    insuranceExpiresAt: '2030-12-31',
    insuranceVerified: true,
    inspectionCertificateNumber: `CTL-${plateNumber}`,
    inspectionDocumentUrl: `https://private.example.test/${plateNumber}/inspection.pdf`,
    inspectionExpiresAt: '2030-12-31',
    inspectionVerified: true,
    status: 'active',
    ...overrides,
  };
}

describe('Phase 5 Mobilite - vehicules, dispatch et securite reseau faible', () => {
  let country;
  let mobilityCategory;
  let adminToken;
  let clientToken;
  let providerToken;
  let provider;

  beforeAll(async () => {
    dbReady = await checkDatabase();
    if (!dbReady) return;

    country = await makeCountry();
    mobilityCategory = await db.TradeCategory.findOne({ where: { slug: 'mobilite' } });
    if (!mobilityCategory) {
      mobilityCategory = await db.TradeCategory.create({
        name: 'Mobilite',
        slug: 'mobilite',
        isActive: true,
      });
      created.tradeCategoryIds.push(mobilityCategory.id);
    }

    const { user: admin, password: adminPassword } = await makeUser({ role: 'admin' });
    const { user: client, password: clientPassword } = await makeUser({
      role: 'client',
      countryId: country.id,
    });
    const { user: providerUser, password: providerPassword } = await makeUser({
      role: 'provider',
      countryId: country.id,
    });
    adminToken = await login(admin.email, adminPassword);
    clientToken = await login(client.email, clientPassword);
    providerToken = await login(providerUser.email, providerPassword);

    provider = await db.Provider.create({
      userId: providerUser.id,
      type: 'independent',
      displayFirstName: 'Awa',
      phoneNumber: '+22370000000',
      countryCode: country.isoCode,
      status: 'probation',
      availabilityStatus: 'available',
    });
    created.providerIds.push(provider.id);
    await db.ProviderTradeCategory.create({
      providerId: provider.id,
      tradeCategoryId: mobilityCategory.id,
    });
  });

  afterAll(async () => {
    if (!dbReady) return;
    for (const mediaUrl of created.mediaUrls) {
      const relativePath = String(mediaUrl).replace(/^\/uploads\//, '');
      const absolutePath = path.resolve(resolveUploadsRoot(), relativePath);
      const uploadsRoot = path.resolve(resolveUploadsRoot());
      if (absolutePath.startsWith(`${uploadsRoot}${path.sep}`) && fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    }
    if (created.serviceIds.length) {
      await db.Notification.destroy({ where: { entityType: 'service', entityId: created.serviceIds } });
      await db.Activity.destroy({ where: { entityType: 'service', entityId: created.serviceIds } });
      await db.ExecutorLocation.destroy({ where: { serviceId: created.serviceIds } });
      await db.MissionStatusHistory.destroy({ where: { serviceId: created.serviceIds } });
      await db.Service.destroy({ where: { id: created.serviceIds } });
    }
    if (created.vehicleIds.length) {
      await db.ProviderLiveLocation.destroy({ where: { vehicleId: created.vehicleIds } });
      await db.Vehicle.destroy({ where: { id: created.vehicleIds } });
    }
    if (created.providerIds.length) {
      await db.ProviderTradeCategory.destroy({ where: { providerId: created.providerIds } });
      await db.Provider.destroy({ where: { id: created.providerIds } });
    }
    if (created.userIds.length) {
      await db.Notification.destroy({ where: { userId: created.userIds } });
      await db.Activity.destroy({ where: { userId: created.userIds } });
      await db.RefreshToken.destroy({ where: { userId: created.userIds } });
      await db.RecoveryCode.destroy({ where: { userId: created.userIds } });
      await db.PasswordResetToken.destroy({ where: { userId: created.userIds } });
      await db.User.destroy({ where: { id: created.userIds } });
    }
    if (created.tradeCategoryIds.length) {
      await db.TradeCategory.destroy({ where: { id: created.tradeCategoryIds } });
    }
    if (created.countryIds.length) await db.Country.destroy({ where: { id: created.countryIds } });
    await db.sequelize.close();
  });

  test('active le compte sans confondre activation et aptitude a recevoir une course', async () => {
    if (!dbReady) return;

    const accountActivation = await request(app)
      .patch(`/api/v1/providers/${provider.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' });
    expect(accountActivation.status).toBe(200);
    expect(accountActivation.body.provider).toMatchObject({
      status: 'active',
      availabilityStatus: 'offline',
    });
    expect(accountActivation.body.mobilityActivation).toMatchObject({
      accountActive: true,
      dispatchReady: false,
      compliance: {
        driverEligible: false,
        hasEligibleVehicle: false,
      },
    });

    const unavailableBeforeCompliance = await request(app)
      .patch('/api/v1/providers/me/availability')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ availabilityStatus: 'available' });
    expect(unavailableBeforeCompliance.status).toBe(400);
    expect(unavailableBeforeCompliance.body.error).toBeTruthy();

    const galleryUpload = await request(app)
      .post(`/api/v1/providers/${provider.id}/mobility-media`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('kind', 'profilePhoto')
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: 'chauffeur-awa.png',
        contentType: 'image/png',
      });
    expect(galleryUpload.status).toBe(201);
    expect(galleryUpload.body.media.url).toMatch(/^\/uploads\/mobility\//);
    created.mediaUrls.push(galleryUpload.body.media.url);

    const driverUpdate = await request(app)
      .patch(`/api/v1/providers/${provider.id}/driver-compliance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        profilePhotoUrl: galleryUpload.body.media.url,
        driverLicenseNumber: 'PERMIS-001',
        driverLicenseDocumentUrl: 'https://private.example.test/driver/license.pdf',
        driverLicenseExpiresAt: '2030-12-31',
        driverLicenseVerified: true,
        identityDocumentUrl: 'https://private.example.test/driver/identity.pdf',
        identityDocumentVerified: true,
      });
    expect(driverUpdate.status).toBe(200);
    expect(driverUpdate.body.compliance.driverEligible).toBe(true);

    const invalidVehicle = await request(app)
      .post(`/api/v1/providers/${provider.id}/vehicles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vehicleType: 'motorcycle',
        brand: 'TVS',
        model: 'Neo',
        color: 'Noir',
        plateNumber: 'MOTO-INCOMPLETE',
        status: 'active',
      });
    expect(invalidVehicle.status).toBe(400);
    expect(invalidVehicle.body.complianceIssues).toContain('casque passager');

    const motorcycleResponse = await request(app)
      .post(`/api/v1/providers/${provider.id}/vehicles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(vehiclePayload('motorcycle', 'MOTO-001'));
    expect(motorcycleResponse.status).toBe(201);
    created.vehicleIds.push(motorcycleResponse.body.vehicle.id);

    const suspension = await request(app)
      .patch(`/api/v1/providers/${provider.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'suspended' });
    expect(suspension.status).toBe(200);
    expect(suspension.body.provider).toMatchObject({
      status: 'suspended',
      availabilityStatus: 'offline',
    });

    const activation = await request(app)
      .patch(`/api/v1/providers/${provider.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' });
    expect(activation.status).toBe(200);
    expect(activation.body.provider.status).toBe('active');
    expect(activation.body.mobilityActivation).toMatchObject({
      accountActive: true,
      dispatchReady: true,
    });
  });

  test.each(['motorcycle', 'car'])(
    'enregistre un brouillon %s sans imposer les informations de conformite',
    async (vehicleType) => {
      if (!dbReady) return;

      const response = await request(app)
        .post(`/api/v1/providers/${provider.id}/vehicles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          vehicleType,
          brand: '',
          model: '',
          color: '',
          plateNumber: '',
          capacity: '',
          insuranceExpiresAt: '',
          inspectionExpiresAt: '',
        });

      expect(response.status).toBe(201);
      expect(response.body.vehicle).toMatchObject({
        vehicleType,
        brand: null,
        model: null,
        color: null,
        plateNumber: null,
        capacity: 1,
        status: 'pending',
      });
      created.vehicleIds.push(response.body.vehicle.id);
    }
  );

  test('permet a l admin d autoriser une moto minimale sans GPS', async () => {
    if (!dbReady) return;

    const minimalMotorcycle = await request(app)
      .post(`/api/v1/providers/${provider.id}/vehicles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vehicleType: 'motorcycle',
        hasPassengerHelmet: true,
      });
    expect(minimalMotorcycle.status).toBe(201);
    expect(minimalMotorcycle.body.vehicle.status).toBe('pending');
    const vehicleId = minimalMotorcycle.body.vehicle.id;
    created.vehicleIds.push(vehicleId);

    const detail = await request(app)
      .get(`/api/v1/providers/${provider.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.compliance.vehicles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: vehicleId,
          eligible: false,
          canBeActivated: true,
          activationIssues: [],
        }),
      ])
    );

    const authorization = await request(app)
      .patch(`/api/v1/providers/${provider.id}/mobility-availability`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ availabilityStatus: 'available', vehicleId });
    expect(authorization.status).toBe(200);
    expect(authorization.body.provider.availabilityStatus).toBe('available');
    expect(authorization.body.selectedVehicle).toMatchObject({
      id: vehicleId,
      vehicleType: 'motorcycle',
      status: 'active',
    });

    const offline = await request(app)
      .patch(`/api/v1/providers/${provider.id}/mobility-availability`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ availabilityStatus: 'offline' });
    expect(offline.status).toBe(200);
    expect(offline.body.provider.availabilityStatus).toBe('offline');
  });

  test('affecte uniquement le bon type et ne divulgue aucun document au client', async () => {
    if (!dbReady) return;

    const client = await db.User.findOne({ where: { role: 'client', id: created.userIds } });
    const mission = await db.Service.create({
      clientId: client.id,
      type: 'other',
      title: 'Course voiture test',
      status: 'created',
      currency: 'XOF',
      countryId: country.id,
      executionType: 'provider',
      tradeCategoryId: mobilityCategory.id,
      missionStatus: 'CREATED',
      pickupAddress: 'Point de depart',
      pickupLatitude: 12.64,
      pickupLongitude: -8.0,
      address: 'Point arrivee',
      latitude: 12.66,
      longitude: -7.98,
      requestedVehicleType: 'car',
    });
    created.serviceIds.push(mission.id);

    const initialTracking = await request(app)
      .get(`/api/v1/missions/${mission.id}/track`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(initialTracking.status).toBe(200);
    expect(initialTracking.body.missionStatus).toBe('CREATED');
    expect(initialTracking.body.startCode).toMatch(/^\d{4}$/);
    const initialStartCode = initialTracking.body.startCode;

    const availableWithCompliantMotorcycle = await request(app)
      .patch('/api/v1/providers/me/availability')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ availabilityStatus: 'available' });
    expect(availableWithCompliantMotorcycle.status).toBe(200);

    const wrongType = await request(app)
      .post(`/api/v1/missions/${mission.id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ providerId: provider.id });
    expect(wrongType.status).toBe(400);
    expect(wrongType.body.complianceIssues).toContain('aucun vehicule voiture actif');

    const carResponse = await request(app)
      .post(`/api/v1/providers/${provider.id}/vehicles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(vehiclePayload('car', 'CAR-001'));
    expect(carResponse.status).toBe(201);
    const carId = carResponse.body.vehicle.id;
    created.vehicleIds.push(carId);

    const offline = await request(app)
      .patch('/api/v1/providers/me/availability')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ availabilityStatus: 'offline' });
    expect(offline.status).toBe(200);
    const availableWithoutGps = await request(app)
      .patch('/api/v1/providers/me/availability')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ availabilityStatus: 'available', vehicleId: carId });
    expect(availableWithoutGps.status).toBe(200);

    const liveLocation = await request(app)
      .post('/api/v1/providers/me/live-location')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({
        vehicleId: carId,
        latitude: 12.641,
        longitude: -8.001,
        accuracyMeters: 8,
        headingDegrees: 90,
      });
    expect(liveLocation.status).toBe(200);
    expect(liveLocation.body.location.isFresh).toBe(true);
    const goAvailable = await request(app)
      .patch('/api/v1/providers/me/availability')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ availabilityStatus: 'available' });
    expect(goAvailable.status).toBe(200);

    const dispatch = await request(app)
      .get(`/api/v1/missions/${mission.id}/dispatch-candidates?radiusKm=8`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dispatch.status).toBe(200);
    expect(dispatch.body.candidates).toHaveLength(1);
    expect(dispatch.body.candidates[0]).toMatchObject({
      provider: { id: provider.id },
      vehicle: { id: carId },
    });
    expect(dispatch.body.candidates[0].rankingScore).toBeGreaterThan(0);

    await db.ProviderLiveLocation.update(
      { recordedAt: new Date(Date.now() - 5 * 60 * 1000) },
      { where: { providerId: provider.id } }
    );
    const staleDispatch = await request(app)
      .get(`/api/v1/missions/${mission.id}/dispatch-candidates?radiusKm=8`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(staleDispatch.status).toBe(200);
    expect(staleDispatch.body.candidates).toHaveLength(1);
    expect(staleDispatch.body.candidates[0]).toMatchObject({
      provider: { id: provider.id },
      vehicle: { id: carId },
      location: null,
      approachDistanceMeters: null,
      approachDurationSeconds: null,
      distanceSource: 'unavailable',
    });

    const available = await request(app)
      .get('/api/v1/providers/available?vehicleType=car')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(available.status).toBe(200);
    expect(available.body.providers.some((item) => item.id === provider.id)).toBe(true);

    const assignment = await request(app)
      .post(`/api/v1/missions/${mission.id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ providerId: provider.id, vehicleId: carId });
    expect(assignment.status).toBe(200);
    expect(assignment.body.mission.vehicleId).toBe(carId);
    expect(
      new Date(assignment.body.mission.acceptanceDeadlineAt).getTime() - Date.now()
    ).toBeGreaterThan(2 * 60 * 1000);
    await provider.reload();
    expect(provider.availabilityStatus).toBe('busy');

    const tracking = await request(app)
      .get(`/api/v1/missions/${mission.id}/track`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(tracking.status).toBe(200);
    expect(tracking.body.provider).toMatchObject({ displayFirstName: 'Awa' });
    expect(tracking.body.vehicle).toMatchObject({
      id: carId,
      vehicleType: 'car',
      plateNumber: 'CAR-001',
      color: 'Blanc',
    });
    expect(tracking.body.realtimeTrackingRequired).toBe(false);
    expect(tracking.body.assistancePhone).toBe('+22370000000');
    expect(tracking.body.startCode).toMatch(/^\d{4}$/);
    expect(tracking.body.startCode).toBe(initialStartCode);
    const startCode = tracking.body.startCode;

    const share = await request(app)
      .post(`/api/v1/missions/${mission.id}/share`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ ttlHours: 6 });
    expect(share.status).toBe(201);
    expect(share.body.token.length).toBeGreaterThan(32);
    const sharedRide = await request(app).get(
      `/api/v1/missions/shared/${share.body.token}`
    );
    expect(sharedRide.status).toBe(200);
    expect(sharedRide.body.mission).toMatchObject({
      id: mission.id,
      realtimeTrackingRequired: false,
      assistancePhone: '+22370000000',
      provider: { displayFirstName: 'Awa' },
      vehicle: { plateNumber: 'CAR-001' },
    });
    expect(JSON.stringify(sharedRide.body)).not.toContain(startCode);
    const publicPayload = JSON.stringify(tracking.body);
    expect(publicPayload).not.toContain('insuranceDocumentUrl');
    expect(publicPayload).not.toContain('registrationDocumentUrl');
    expect(publicPayload).not.toContain('driverLicenseDocumentUrl');

    await db.Vehicle.update({ insuranceExpiresAt: '2020-01-01' }, { where: { id: carId } });
    const unsafeAcceptance = await request(app)
      .post(`/api/v1/missions/${mission.id}/accept`)
      .set('Authorization', `Bearer ${providerToken}`);
    expect(unsafeAcceptance.status).toBe(400);
    expect(unsafeAcceptance.body.complianceIssues).toContain('assurance expiree');

    await db.Vehicle.update({ insuranceExpiresAt: '2030-12-31' }, { where: { id: carId } });
    await mission.update({ acceptanceDeadlineAt: new Date(Date.now() - 1000) });
    const expiredAcceptance = await request(app)
      .post(`/api/v1/missions/${mission.id}/accept`)
      .set('Authorization', `Bearer ${providerToken}`);
    expect(expiredAcceptance.status).toBe(409);

    const timeoutResult = await runLogisticsAcceptanceCheck();
    expect(timeoutResult.reassigned).toBeGreaterThanOrEqual(1);
    await mission.reload();
    await provider.reload();
    expect(mission).toMatchObject({
      missionStatus: 'SEARCHING_EXECUTOR',
      providerId: null,
      vehicleId: null,
    });
    expect(provider.availabilityStatus).toBe('offline');

    const availableAgain = await request(app)
      .patch('/api/v1/providers/me/availability')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ availabilityStatus: 'available', vehicleId: carId });
    expect(availableAgain.status).toBe(200);

    const reassignment = await request(app)
      .post(`/api/v1/missions/${mission.id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ providerId: provider.id, vehicleId: carId });
    expect(reassignment.status).toBe(200);
    const acceptance = await request(app)
      .post(`/api/v1/missions/${mission.id}/accept`)
      .set('Authorization', `Bearer ${providerToken}`);
    expect(acceptance.status).toBe(200);
    expect(acceptance.body.mission.acceptanceDeadlineAt).toBeNull();

    const enRoute = await request(app)
      .patch(`/api/v1/missions/${mission.id}/status`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ toStatus: 'EN_ROUTE' });
    expect(enRoute.status).toBe(200);
    const onSite = await request(app)
      .patch(`/api/v1/missions/${mission.id}/status`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ toStatus: 'ON_SITE' });
    expect(onSite.status).toBe(200);

    const bypassStartCode = await request(app)
      .patch(`/api/v1/missions/${mission.id}/status`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ toStatus: 'IN_PROGRESS' });
    expect(bypassStartCode.status).toBe(400);
    const wrongStartCode = await request(app)
      .post(`/api/v1/missions/${mission.id}/verify-start-code`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ code: startCode === '9999' ? '0000' : '9999' });
    expect(wrongStartCode.status).toBe(400);
    const verifiedStart = await request(app)
      .post(`/api/v1/missions/${mission.id}/verify-start-code`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ code: startCode });
    expect(verifiedStart.status).toBe(200);
    expect(verifiedStart.body.mission).toMatchObject({
      missionStatus: 'IN_PROGRESS',
      startAuthorizationMethod: 'code',
    });

    const completed = await request(app)
      .patch(`/api/v1/missions/${mission.id}/status`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ toStatus: 'COMPLETED' });
    expect(completed.status).toBe(200);
    const rating = await request(app)
      .post(`/api/v1/missions/${mission.id}/rating`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ score: 5, comment: 'Chauffeur prudent et ponctuel' });
    expect(rating.status).toBe(201);
    const duplicateRating = await request(app)
      .post(`/api/v1/missions/${mission.id}/rating`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ score: 4 });
    expect(duplicateRating.status).toBe(409);
    await provider.reload();
    expect(Number(provider.averageRating)).toBe(5);

    const overrideMission = await db.Service.create({
      clientId: client.id,
      type: 'other',
      title: 'Course demarrage assiste',
      status: 'created',
      currency: 'XOF',
      countryId: country.id,
      executionType: 'provider',
      tradeCategoryId: mobilityCategory.id,
      missionStatus: 'CREATED',
      pickupAddress: 'Depart assistance',
      pickupLatitude: 12.64,
      pickupLongitude: -8.0,
      address: 'Arrivee assistance',
      latitude: 12.65,
      longitude: -7.99,
      requestedVehicleType: 'car',
    });
    created.serviceIds.push(overrideMission.id);
    await request(app)
      .post('/api/v1/providers/me/live-location')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ vehicleId: carId, latitude: 12.641, longitude: -8.001 });
    const overrideAssignment = await request(app)
      .post(`/api/v1/missions/${overrideMission.id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ providerId: provider.id, vehicleId: carId });
    expect(overrideAssignment.status).toBe(200);
    await request(app)
      .post(`/api/v1/missions/${overrideMission.id}/accept`)
      .set('Authorization', `Bearer ${providerToken}`);
    await request(app)
      .patch(`/api/v1/missions/${overrideMission.id}/status`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ toStatus: 'EN_ROUTE' });
    await request(app)
      .patch(`/api/v1/missions/${overrideMission.id}/status`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ toStatus: 'ON_SITE' });
    const overrideStart = await request(app)
      .post(`/api/v1/missions/${overrideMission.id}/start-override`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Client sans connexion, confirmation recue par telephone' });
    expect(overrideStart.status).toBe(200);
    expect(overrideStart.body.mission).toMatchObject({
      missionStatus: 'IN_PROGRESS',
      startAuthorizationMethod: 'admin_override',
    });
  });

  test('refuse les documents et vehicules aux clients', async () => {
    if (!dbReady) return;
    const detail = await request(app)
      .get(`/api/v1/providers/${provider.id}`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(detail.status).toBe(403);

    const vehicles = await request(app)
      .get(`/api/v1/providers/${provider.id}/vehicles`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(vehicles.status).toBe(403);

    const availability = await request(app)
      .patch(`/api/v1/providers/${provider.id}/mobility-availability`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ availabilityStatus: 'offline' });
    expect(availability.status).toBe(403);
  });
});
