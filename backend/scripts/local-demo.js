'use strict';

// Local preview only. Never use the integration server bootstrap (which resets its DB)
// to offer a persistent, interactive demo.
const path = require('path');
process.env.NODE_ENV = 'test';
process.env.MISSION_COORDINATION_ENABLED = 'true';
process.env.CORS_ORIGINS = 'http://127.0.0.1:3001,http://localhost:3001';
process.env.UPLOADS_ROOT = path.resolve(__dirname, '../uploads');
process.env.EVIDENCE_ALLOW_LOCAL_FALLBACK = 'true';
const bcrypt = require('bcrypt');
const db = require('../models');
db.sequelize.options.logging = false;
const { coordinateMission } = require('../src/services/missionCoordination.service');
const { coordinateWork } = require('../src/services/workCoordination.service');

const PASSWORD = 'TerangaDemo2026!';
const prefix = '[Démo] ';
async function ensure(Model, where, defaults) {
  return (await Model.findOrCreate({ where, defaults: { ...where, ...defaults } }))[0];
}
async function main() {
  const config = db.sequelize.config;
  if (config.database !== (process.env.DB_NAME_TEST || 'teranga_test') || !['localhost', '127.0.0.1', '::1'].includes(config.host)) throw new Error('A local test database is required for these demo accounts.');
  await db.sequelize.authenticate();
  for (const name of ['20261023090000-create-mission-coordination', '20261023100000-add-service-request-keys', '20261023110000-extend-operational-coordination']) {
    await require(`../migrations/${name}`).up(db.sequelize.getQueryInterface(), require('sequelize'));
  }
  const country = await ensure(db.Country, { isoCode: 'ML' }, { name: 'Mali', currency: 'XOF', defaultLanguage: 'fr', timezone: 'Africa/Bamako', isActive: true });
  const region = await ensure(db.Region, { countryId: country.id, code: 'BKO-DEMO-COORD' }, { name: 'Bamako — démonstration', timezone: 'Africa/Bamako', isActive: true });
  const accounts = {};
  for (const [role, firstName] of [['admin', 'Coordination Démo'], ['agent', 'Awa Démo'], ['client', 'Mariam Démo']]) {
    const email = `${role}.demo@teranga.test`;
    const account = await ensure(db.User, { email }, { role, firstName, passwordHash: await bcrypt.hash(PASSWORD, 10),
      country: 'ML', countryId: country.id, regionId: role === 'admin' ? null : region.id, language: 'fr', emailVerified: true });
    if (!(await bcrypt.compare(PASSWORD, account.passwordHash))) await account.update({ passwordHash: await bcrypt.hash(PASSWORD, 10) });
    accounts[role] = account;
  }
  const { admin, agent, client } = accounts;
  await ensure(db.AgentCapacity, { userId: agent.id }, { available: true, maxConcurrent: 3 });
  const territory = await ensure(db.Territory, { code: 'DEMO-COORD-BKO' }, { name: region.name, type: 'REGION', countryId: country.id, regionId: region.id, isActive: true });
  const organization = await ensure(db.Organization, { code: 'DEMO-COORD-ML' }, { type: 'MASTER', legalName: 'Teranga — démonstration locale', countryId: country.id, status: 'active' });
  const definition = await ensure(db.ServiceDefinition, { code: 'DEMO-COORD-ERRAND' }, { name: 'Démarches et assistance de proximité', description: 'Démarche réalisée et compte rendu remis au client.', executionProfile: 'agent', legacyServiceType: 'errand' });
  await ensure(db.ServiceAvailability, { serviceDefinitionId: definition.id, territoryId: territory.id, organizationId: organization.id }, {
    isActive: true, currency: 'XOF', slaMinutes: 60, providerRules: { serviceOutcome: 'Démarche réalisée et compte rendu remis au client.', requiredEvidenceTypes: [], coordination: { enabled: true } },
  });
  const geo = { countryId: country.id, regionId: region.id, currency: 'XOF' };
  for (const [title, status, assigned, budget] of [
    ['Retrait d’un dossier administratif', 'created', false, 15000],
    ['Vérification d’une réparation à domicile', 'in_progress', true, 35000],
    ['Dépôt d’un dossier à valider par le client', 'completed', true, 20000],
  ]) {
    const service = await ensure(db.Service, { clientId: client.id, title: prefix + title }, { ...geo, type: 'errand', executionType: 'agent', status,
      agentId: assigned ? agent.id : null, createdById: client.id, budget, address: 'Bamako — données fictives de démonstration',
      description: 'Demande fictive pour découvrir la coordination, les échéances et le compte rendu.' });
    const operation = await coordinateMission(service.id);
    if (status === 'completed' && !operation.completionReport) await operation.update({ completionReport: { reporterId: agent.id,
      summary: 'Le dossier a été déposé au guichet concerné. Le client peut vérifier la réalisation et confirmer la clôture.', evidenceIds: [], submittedAt: new Date().toISOString() } });
  }
  for (const title of ['Visite de contrôle d’un chantier', 'Dossier en attente d’un justificatif']) {
    const project = await ensure(db.Project, { clientId: client.id, title: prefix + title }, { ...geo, type: 'administratif', status: 'created', budget: 120000,
      description: 'Projet fictif : organiser la visite, recueillir les justificatifs et obtenir la validation du client.' });
    const operation = await coordinateWork('project', project.id);
    if (title.startsWith('Dossier') && operation.state !== 'escalated') {
      await coordinateWork('project', project.id, { actor: admin, configure: { policy: { stageMinutes: 1 } } });
      await coordinateWork('project', project.id, { now: new Date(Date.now() + 61000) });
    }
  }
  const order = await ensure(db.Order, { code: 'CMD-DEMO-COORD-001' }, { ...geo, userId: client.id, status: 'created', paymentStatus: 'unpaid', notes: 'Commande fictive de fournitures à remettre au destinataire.' });
  await ensure(db.OrderItem, { orderId: order.id, name: 'Kit de fournitures — démonstration' }, { quantity: 2, price: 5000, total: 10000 });
  if (Number(order.subtotal) === 0) await order.update({ subtotal: 10000 });
  await coordinateWork('order', order.id);
  console.log(JSON.stringify({ localDemo: true, accounts: Object.fromEntries(Object.entries(accounts).map(([role, user]) => [role, user.email])), password: PASSWORD,
    interface: 'http://127.0.0.1:3001/login', operations: 'http://127.0.0.1:3001/admin/operations' }, null, 2));
  if (!process.argv.includes('--serve')) { await db.sequelize.close(); return; }
  const app = require('../src/app');
  app.locals.runtimeStatus = { db: { ready: true, checkedAt: Date.now() } };
  const server = app.listen(5001, '127.0.0.1', () => console.log('Local demo API ready at http://127.0.0.1:5001'));
  require('../src/jobs/missionCoordination.job').startMissionCoordinationJob();
  const shutdown = () => server.close(() => db.sequelize.close().finally(() => process.exit(0)));
  process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
}
main().catch(async (error) => { console.error(error.original?.message || error.message); await db.sequelize.close(); process.exitCode = 1; });
