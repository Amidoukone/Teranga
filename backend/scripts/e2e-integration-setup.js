'use strict';

const path = require('path');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

process.env.NODE_ENV = 'test';

const db = require('../models');

const {
  sequelize,
  User,
  Country,
  Region,
  Franchise,
  Service,
  Task,
  Notification,
  Order,
  TradeCategory,
  MissionPricingRule,
} = db;

const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD || 'Password123!';
const FIXTURE = {
  countryIso: 'ML',
  countryName: 'Mali',
  regionCode: 'BKO-E2E',
  regionName: 'Bamako E2E',
  masterLegalName: 'Teranga E2E MASTER Mali',
  adminEmail: 'e2e.real.admin@example.com',
  adminFirstName: 'E2E',
  adminLastName: 'Admin',
  clientEmail: 'e2e.real.client@example.com',
  clientFirstName: 'E2E',
  clientLastName: 'Client',
  phone: '+22370000000',
  serviceTitle: 'Service E2E Reelle - Entretien Villa',
  serviceDescription: 'Service cree pour la passe E2E integration reelle.',
  taskTitle: 'Tache E2E Reelle - Controle dossier',
  taskDescription: 'Tache creee pour valider le flux integration reelle.',
  orderCode: 'CMD-E2E-REAL-001',
  orderNote: 'Commande seed E2E integration reelle',
  notificationTitle: 'Notification E2E Reelle',
};

function toDate() {
  return new Date();
}

async function ensureCountry() {
  const [country] = await Country.findOrCreate({
    where: { isoCode: FIXTURE.countryIso },
    defaults: {
      name: FIXTURE.countryName,
      isoCode: FIXTURE.countryIso,
      currency: 'XOF',
      defaultLanguage: 'fr',
      isActive: true,
    },
  });

  const updates = {};
  if (!country.isActive) updates.isActive = true;
  if (!country.name) updates.name = FIXTURE.countryName;
  if (!country.currency) updates.currency = 'XOF';
  if (!country.defaultLanguage) updates.defaultLanguage = 'fr';
  if (Object.keys(updates).length > 0) {
    await country.update(updates);
  }

  return country;
}

async function ensureRegion(countryId) {
  const [region] = await Region.findOrCreate({
    where: {
      countryId,
      code: FIXTURE.regionCode,
    },
    defaults: {
      countryId,
      name: FIXTURE.regionName,
      code: FIXTURE.regionCode,
      isActive: true,
    },
  });

  const updates = {};
  if (!region.isActive) updates.isActive = true;
  if (!region.name) updates.name = FIXTURE.regionName;
  if (Object.keys(updates).length > 0) {
    await region.update(updates);
  }

  return region;
}

async function ensureMasterFranchise(countryId) {
  const [franchise] = await Franchise.findOrCreate({
    where: {
      type: 'MASTER',
      countryId,
      legalName: FIXTURE.masterLegalName,
    },
    defaults: {
      type: 'MASTER',
      countryId,
      regionId: null,
      legalName: FIXTURE.masterLegalName,
      status: 'active',
    },
  });

  if (franchise.status !== 'active') {
    await franchise.update({ status: 'active' });
  }

  return franchise;
}

async function ensureUser({
  email,
  firstName,
  lastName,
  role,
  countryId,
  regionId,
  countryIso,
}) {
  const passwordHash = await bcrypt.hash(E2E_PASSWORD, 10);
  const [user] = await User.findOrCreate({
    where: { email },
    defaults: {
      email,
      passwordHash,
      firstName,
      lastName,
      phone: FIXTURE.phone,
      language: 'fr',
      role,
      country: countryIso,
      countryId,
      regionId,
      emailVerified: true,
      phoneVerified: true,
      lastLogin: toDate(),
    },
  });

  const updates = {
    firstName,
    lastName,
    phone: FIXTURE.phone,
    language: 'fr',
    role,
    country: countryIso,
    countryId,
    regionId,
    passwordHash,
  };

  await user.update(updates);
  return user;
}

async function ensureService(client, countryId, regionId) {
  const [service] = await Service.findOrCreate({
    where: {
      clientId: client.id,
      title: FIXTURE.serviceTitle,
    },
    defaults: {
      clientId: client.id,
      createdById: client.id,
      agentId: null,
      propertyId: null,
      type: 'other',
      title: FIXTURE.serviceTitle,
      description: FIXTURE.serviceDescription,
      contactPerson: `${client.firstName || ''} ${client.lastName || ''}`.trim(),
      contactPhone: FIXTURE.phone,
      address: 'Sebenicoro - Bamako',
      budget: 25000,
      status: 'created',
      countryId,
      regionId,
    },
  });

  await service.update({
    createdById: client.id,
    type: 'other',
    description: FIXTURE.serviceDescription,
    status: 'created',
    countryId,
    regionId,
  });

  return service;
}

async function ensureTask(client, service, countryId, regionId) {
  const [task] = await Task.findOrCreate({
    where: {
      creatorId: client.id,
      serviceId: service.id,
      title: FIXTURE.taskTitle,
    },
    defaults: {
      serviceId: service.id,
      propertyId: null,
      creatorId: client.id,
      assignedTo: null,
      type: 'other',
      title: FIXTURE.taskTitle,
      description: FIXTURE.taskDescription,
      priority: 'normal',
      status: 'created',
      estimatedCost: 5000,
      dueDate: null,
      countryId,
      regionId,
    },
  });

  await task.update({
    type: 'other',
    description: FIXTURE.taskDescription,
    status: 'created',
    countryId,
    regionId,
  });

  return task;
}

async function ensureOrder(client, countryId, regionId) {
  const [order] = await Order.findOrCreate({
    where: { code: FIXTURE.orderCode },
    defaults: {
      userId: client.id,
      code: FIXTURE.orderCode,
      subtotal: 12000,
      shipping: 0,
      tax: 0,
      total: 12000,
      currency: 'XOF',
      status: 'created',
      paymentStatus: 'unpaid',
      paymentMethod: 'other',
      notes: FIXTURE.orderNote,
      countryId,
      regionId,
    },
  });

  await order.update({
    userId: client.id,
    subtotal: 12000,
    shipping: 0,
    tax: 0,
    total: 12000,
    currency: 'XOF',
    status: 'created',
    paymentStatus: 'unpaid',
    paymentMethod: 'other',
    notes: FIXTURE.orderNote,
    countryId,
    regionId,
  });

  return order;
}

async function ensureMobilityPricing(countryId) {
  const [tradeCategory] = await TradeCategory.findOrCreate({
    where: { slug: 'mobilite' },
    defaults: {
      name: 'Mobilite',
      slug: 'mobilite',
      countryId: null,
      regionId: null,
      isActive: true,
    },
  });

  await tradeCategory.update({
    name: 'Mobilite',
    countryId: null,
    regionId: null,
    isActive: true,
  });

  const [pricingRule] = await MissionPricingRule.findOrCreate({
    where: {
      countryId,
      tradeCategoryId: tradeCategory.id,
      vehicleType: 'car',
    },
    defaults: {
      countryId,
      tradeCategoryId: tradeCategory.id,
      vehicleType: 'car',
      pricingMode: 'fixed_estimate',
      basePrice: 2500,
      minPrice: 2500,
      pricePerKm: 250,
      estimatedDelayMinutes: 20,
      isActive: true,
    },
  });

  await pricingRule.update({
    pricingMode: 'fixed_estimate',
    basePrice: 2500,
    minPrice: 2500,
    pricePerKm: 250,
    estimatedDelayMinutes: 20,
    isActive: true,
  });

  return tradeCategory;
}

async function ensureNotification(client, service, countryId, regionId) {
  const where = {
    userId: client.id,
    entityType: 'service',
    entityId: service.id,
    action: 'created',
    title: FIXTURE.notificationTitle,
  };

  const [notification] = await Notification.findOrCreate({
    where,
    defaults: {
      ...where,
      actorId: client.id,
      message: 'Notification seed pour la passe E2E integration reelle.',
      status: 'unread',
      progress: 'new',
      entityStatus: 'created',
      metadata: {
        title: FIXTURE.notificationTitle,
      },
      countryId,
      regionId,
      readAt: null,
    },
  });

  await notification.update({
    actorId: client.id,
    message: 'Notification seed pour la passe E2E integration reelle.',
    status: 'unread',
    progress: 'new',
    entityStatus: 'created',
    metadata: {
      title: FIXTURE.notificationTitle,
    },
    countryId,
    regionId,
    readAt: null,
  });

  return notification;
}

async function main() {
  await sequelize.authenticate();

  const country = await ensureCountry();
  const region = await ensureRegion(country.id);
  await ensureMasterFranchise(country.id);
  await ensureMobilityPricing(country.id);

  await ensureUser({
    email: FIXTURE.adminEmail,
    firstName: FIXTURE.adminFirstName,
    lastName: FIXTURE.adminLastName,
    role: 'admin',
    countryId: country.id,
    regionId: region.id,
    countryIso: FIXTURE.countryIso,
  });

  const client = await ensureUser({
    email: FIXTURE.clientEmail,
    firstName: FIXTURE.clientFirstName,
    lastName: FIXTURE.clientLastName,
    role: 'client',
    countryId: country.id,
    regionId: region.id,
    countryIso: FIXTURE.countryIso,
  });

  const service = await ensureService(client, country.id, region.id);
  const task = await ensureTask(client, service, country.id, region.id);
  const order = await ensureOrder(client, country.id, region.id);
  const notification = await ensureNotification(
    client,
    service,
    country.id,
    region.id
  );

  console.log(
    `[e2e:integration:setup] ready client=${client.email} service=${service.id} task=${task.id} order=${order.code} notification=${notification.id}`
  );
}

main()
  .catch((error) => {
    console.error('[e2e:integration:setup] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await sequelize.close();
    } catch (_err) {
      // ignore close errors
    }
  });
