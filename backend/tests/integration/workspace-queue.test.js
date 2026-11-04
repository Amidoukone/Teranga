'use strict';
const crypto = require('crypto');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const request = require('supertest');
const db = require('../../models');
const app = require('../../src/app');
let country, foreign, region, otherRegion, client, agent, delegate, admin, outsider, providerUser, provider, property;
const users = [], serviceIds = [], projectIds = [], orderIds = [], taskIds = [];
const auth = (user) => ({ Authorization: `Bearer ${jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' })}` });
async function makeCountry() {
  for (let i = 0; i < 80; i += 1) {
    try { return await db.Country.create({ name: `Queue-${crypto.randomUUID()}`, isoCode: String.fromCharCode(65 + Math.floor(Math.random() * 26),65 + Math.floor(Math.random() * 26)), currency: 'XOF', isActive: true }); }
    catch (error) { if (error.name !== 'SequelizeUniqueConstraintError') throw error; }
  }
  throw new Error('No country for queue fixture');
}
async function user(role, countryId, regionId = null) {
  const row = await db.User.create({ role, countryId, regionId, firstName: role, email: `queue-${crypto.randomUUID()}@example.com`, passwordHash: await bcrypt.hash(crypto.randomUUID(),4) }); users.push(row.id); return row;
}
async function service(extra = {}) {
  const row = await db.Service.create({ title: 'Visite de la maison', type: 'other', status: 'in_progress', executionType: 'agent', clientId: client.id, agentId: agent.id, countryId: country.id, regionId: region.id, ...extra }); serviceIds.push(row.id); return row;
}
async function task(extra = {}) {
  const row = await db.Task.create({ title: 'Étape à réaliser', type: 'visit', creatorId: client.id, assignedTo: agent.id, countryId: country.id, regionId: region.id, ...extra }); taskIds.push(row.id); return row;
}
async function project(extra = {}) {
  const row = await db.Project.create({ title: 'Projet familial', type: 'administratif', clientId: client.id, agentId: agent.id, countryId: country.id, regionId: region.id, ...extra }); projectIds.push(row.id); return row;
}
async function order(extra = {}) {
  const row = await db.Order.create({ code: `QUEUE-${crypto.randomUUID().slice(0,24)}`, userId: client.id, countryId: country.id, regionId: region.id, ...extra }); orderIds.push(row.id); return row;
}
async function queue(actor, query = '') { return request(app).get(`/api/v1/operations/workspace${query ? `?${query}` : ''}`).set(auth(actor)); }
async function clearResources() {
  if (taskIds.length) await db.Task.destroy({ where: { id: taskIds.splice(0) } });
  if (serviceIds.length) { await db.MissionDispute.destroy({ where: { serviceId: serviceIds } }); await db.MissionCoordination.destroy({ where: { serviceId: serviceIds } }); await db.Service.destroy({ where: { id: serviceIds.splice(0) } }); }
  for (const [type, ids, Model] of [['project',projectIds,db.Project],['order',orderIds,db.Order]]) {
    if (ids.length) { await db.WorkCoordination.destroy({ where: { entityType: type, entityId: ids } }); await Model.destroy({ where: { id: ids.splice(0) } }); }
  }
  if (users.length) { await db.Notification.destroy({ where: { userId: users } }); await db.Activity.destroy({ where: { userId: users } }); }
}
beforeAll(async () => {
  await db.sequelize.authenticate(); country = await makeCountry(); foreign = await makeCountry();
  region = await db.Region.create({ name: 'Centre', countryId: country.id }); otherRegion = await db.Region.create({ name: 'Autre zone', countryId: country.id });
  client = await user('client',foreign.id); agent = await user('agent',country.id,region.id); delegate = await user('agent',country.id,region.id);
  admin = await user('admin',country.id); outsider = await user('admin',foreign.id); providerUser = await user('provider',country.id,region.id);
  provider = await db.Provider.create({ userId: providerUser.id, type: 'independent', displayFirstName: 'Idrissa', phoneNumber: '+22370000000', countryCode: country.isoCode, status: 'active' });
  property = await db.Property.create({ title: 'Maison', type: 'house', address: 'Adresse de recette', city: 'Bamako', ownerId: client.id, countryId: country.id, regionId: region.id });
});
beforeEach(clearResources);
afterAll(async () => {
  await clearResources(); if (property) await property.destroy(); if (provider) await provider.destroy();
  if (users.length) await db.User.destroy({ where: { id: users } });
  if (region) await region.destroy(); if (otherRegion) await otherRegion.destroy(); if (country) await country.destroy(); if (foreign) await foreign.destroy(); await db.sequelize.close();
});

test('clients see the result to confirm separately from following, irrespective of their country of residence', async () => {
  const review = await service({ status: 'completed' }); await service(); await service({ status: 'validated' });
  const result = await queue(client); expect(result.status).toBe(200); expect(result.body.summary).toEqual({ action: 1, following: 1, unread: 0 });
  expect(result.body.items.map((item) => item.id)).toEqual([review.id]); expect(result.body.items[0].action.code).toBe('result_review');
  expect((await queue(client,'view=following')).body.items).toHaveLength(1);
});

test('authorized steps are grouped before pagination, including pending work in a completed parent', async () => {
  const parent = await service({ status: 'validated' });
  for (let i = 0; i < 25; i += 1) await task({ serviceId: parent.id });
  const result = await queue(agent,'limit=1'); expect(result.status).toBe(200); expect(result.body.pagination.total).toBe(1);
  expect(result.body.items[0]).toMatchObject({ kind:'service', id:parent.id, openStepCount:25, actionStepCount:25 });
  expect(result.body.items[0].action.kind).toBe('task');
});

test('one global page reaches old requests across service, project and order families with exact totals', async () => {
  const old = await service({ status:'completed', title:'Ancien résultat', createdAt:new Date('2020-01-01') });
  for (let i = 0; i < 24; i += 1) await service({ status:'completed' });
  await project({ status:'completed' }); await order();
  const first = await queue(client,'limit=20'); const second = await queue(client,'limit=20&page=2');
  expect(first.status).toBe(200); expect(first.body.items[0].id).toBe(old.id); expect(first.body.pagination.total).toBe(26); expect(second.body.items).toHaveLength(6);
  expect(new Set([...first.body.items,...second.body.items].map((item)=>item.key)).size).toBe(26);
  expect(first.body.summary.following).toBe(1);
});

test('task-only access never reveals a forbidden service title or its executor; property and orphan tasks remain visible', async () => {
  const parent = await service({ title:'Dossier confidentiel du superviseur' }); const own = await task({ serviceId:parent.id, assignedTo:delegate.id });
  await task({ serviceId:parent.id }); await task({ propertyId:property.id, assignedTo:delegate.id }); await task({ assignedTo:delegate.id });
  const result = await queue(delegate); expect(result.status).toBe(200); expect(result.body.pagination.total).toBe(3);
  expect(result.body.items.find((item)=>item.id===own.id)).toMatchObject({ kind:'task', title:own.title });
  expect(JSON.stringify(result.body)).not.toContain(parent.title);
  const detail = await request(app).get(`/api/tasks/${own.id}/workspace`).set(auth(delegate));
  expect(detail.status).toBe(200); expect(detail.body.parentServiceId).toBeNull(); expect(detail.body.task.service).toBeUndefined();
  expect(JSON.stringify(detail.body)).not.toContain(parent.title); expect(detail.body.task.capabilities.canStart).toBe(true);
  expect((await request(app).get(`/api/tasks/${own.id}/workspace`).set(auth(outsider))).status).toBe(404);
});

test('a supervisor follows another agent’s step without receiving an execution action', async () => {
  const parent = await service({ status:'completed' }); await task({ serviceId:parent.id, assignedTo:delegate.id });
  const result = await queue(agent,'view=following'); expect(result.status).toBe(200); expect(result.body.summary.action).toBe(0);
  expect(result.body.items).toHaveLength(1); expect(result.body.items[0].action).toBeNull();
});

test('administrative review takes priority over ordinary coordination and remains a task action', async () => {
  const parent = await service(); const entry = await task({ serviceId:parent.id, status:'completed' });
  const result = await queue(admin); expect(result.status).toBe(200); expect(result.body.items).toHaveLength(1);
  expect(result.body.items[0].action).toEqual({ code:'step_review',kind:'task',id:entry.id });
  expect((await parent.reload()).status).toBe('in_progress');
});

test('escalations and deadlines are sorted before page limits, not within separate family pages', async () => {
  await service(); const urgent = await order();
  await db.WorkCoordination.create({ entityType:'order', entityId:urgent.id, ownerUserId:admin.id, state:'escalated', nextActionAt:new Date('2026-01-01') });
  const result = await queue(admin,'limit=1'); expect(result.status).toBe(200); expect(result.body.items[0]).toMatchObject({ kind:'order',id:urgent.id });
  expect(result.body.pagination.total).toBe(2);
});

test('provider work is restricted to their own profile and never grants access to tasks or other families', async () => {
  const ride = await service({ executionType:'provider', providerId:provider.id, missionStatus:'ASSIGNED' }); await service(); await project(); await order(); await task();
  const result = await queue(providerUser); expect(result.status).toBe(200); expect(result.body.items).toHaveLength(1); expect(result.body.items[0].id).toBe(ride.id);
  expect(result.body.items[0].executor).toBe('Idrissa');
  await provider.update({status:'suspended'});
  expect((await queue(providerUser)).body.items.map((item)=>item.id)).toEqual([ride.id]);
  await provider.update({status:'active'});
});

test('geographic restrictions and selected territory apply before aggregation, with regional NULL fallback preserved', async () => {
  await service(); await service({ regionId:otherRegion.id }); await service({ regionId:null });
  expect((await queue(outsider)).body.pagination.total).toBe(0);
  const regional = await queue(agent); expect(regional.status).toBe(200); expect(regional.body.pagination.total).toBe(2);
  expect((await queue(admin,`regionId=${otherRegion.id}`)).body.pagination.total).toBe(1);
});

test('assigned missions retain their tracking access even when the executor is outside a legacy geographic scope',async()=>{
  const mission=await service({missionStatus:'ASSIGNED',countryId:foreign.id,regionId:null});
  const result=await queue(agent);expect(result.status).toBe(200);expect(result.body.items.map((item)=>item.id)).toEqual([mission.id]);
});

test('family and reference search filter before counts and a read does not change notification or work states', async () => {
  const parent = await service(); await project();
  await db.Notification.create({ userId:agent.id, entityType:'service',entityId:parent.id,action:'created',title:'Information de suivi',message:'Nouveau dossier',status:'unread',progress:'new' });
  const result = await queue(agent,`kind=service&q=%23${parent.id}`); expect(result.status).toBe(200); expect(result.body.items).toHaveLength(1);
  expect(result.body.summary).toEqual({ action:1,following:0,unread:1 }); expect((await parent.reload()).status).toBe('in_progress');
  expect(await db.Notification.count({ where:{ userId:agent.id,status:'unread' } })).toBe(1);
  expect((await queue(agent,'view=invalid')).status).toBe(400); expect((await queue(agent,'limit=999')).status).toBe(400);
});

test('searching an authorized step title finds its dossier without truncating the other pending steps', async () => {
  const parent = await service(); await task({serviceId:parent.id,title:'Contrôler le compteur'}); await task({serviceId:parent.id,title:'Vérifier la porte'});
  const result = await queue(agent,'q=compteur'); expect(result.status).toBe(200); expect(result.body.items).toHaveLength(1);
  expect(result.body.items[0]).toMatchObject({kind:'service',id:parent.id,openStepCount:2});
});

test('project steps group into an authorized project and retain an explicit task target', async () => {
  const parent = await project(); const entry = await task({ projectId:parent.id });
  const result = await queue(agent); expect(result.status).toBe(200); expect(result.body.items).toHaveLength(1);
  expect(result.body.items[0]).toMatchObject({ kind:'project',id:parent.id,action:{kind:'task',id:entry.id} });
});

test('internal transport child missions stay outside the client case view, including when a legacy task refers to them', async () => {
  const parent = await service({missionStatus:'IN_PROGRESS'}); const child = await service({missionStatus:'IN_PROGRESS',parentServiceId:parent.id,title:'Retrait interne confidentiel'});
  const entry = await task({serviceId:child.id,title:'Ancienne intervention'});
  const result = await queue(client,'view=following'); expect(result.status).toBe(200);
  expect(result.body.items.some((item)=>item.kind==='service' && item.id===child.id)).toBe(false);
  expect(JSON.stringify(result.body)).not.toContain(child.title);
  const limited = await request(app).get(`/api/tasks/${entry.id}/workspace`).set(auth(client)); expect(limited.status).toBe(200); expect(limited.body.parentServiceId).toBeNull();
});

test('an agent can read properties within their territory scope, read-only', async () => {
  const list = await request(app).get('/api/v1/properties').set(auth(agent));
  expect(list.status).toBe(200);
  expect(list.body.properties.map((p) => p.id)).toContain(property.id);
  const detail = await request(app).get(`/api/v1/properties/${property.id}`).set(auth(agent));
  expect(detail.status).toBe(200);
  expect(detail.body.property.id).toBe(property.id);
  // Toujours en lecture seule : aucune permission d'écriture accordée par ce correctif.
  const write = await request(app).put(`/api/v1/properties/${property.id}`).set(auth(agent)).send({ title: 'Changé' });
  expect(write.status).toBe(403);
});

test('a dispute resolved "redo" reopens the mission for reassignment instead of a dead end', async () => {
  const mission = await service({ missionStatus: 'DISPUTED', status: 'completed', acceptanceDeadlineAt: new Date() });
  const dispute = await db.MissionDispute.create({ serviceId: mission.id, openedBy: client.id, status: 'open', reason: 'non_conforme', description: 'Résultat jugé insuffisant par le client.' });

  const resolved = await request(app).patch(`/api/v1/missions/${mission.id}/disputes/${dispute.id}`).set(auth(admin))
    .send({ resolution: 'redo', resolutionNotes: 'Le travail doit être repris avec un autre exécutant.' });
  expect(resolved.status).toBe(200);
  expect((await mission.reload()).missionStatus).toBe('RESOLVED_REDO');

  // Avant le correctif, RESOLVED_REDO n'avait aucune arête sortante : cette transition
  // échouait systématiquement en 400 ("Transition invalide"), bloquant l'agent à vie.
  const reopened = await request(app).patch(`/api/v1/missions/${mission.id}/status`).set(auth(admin)).send({ toStatus: 'SEARCHING_EXECUTOR' });
  expect(reopened.status).toBe(200);

  await mission.reload();
  expect(mission.missionStatus).toBe('SEARCHING_EXECUTOR');
  expect(mission.agentId).toBeNull();
  expect(mission.acceptanceDeadlineAt).toBeNull();
});

test('an escalated dispute opens a case-specific problem list without extending geographic access', async () => {
  const first = await service({missionStatus:'DISPUTED'}), second = await service({missionStatus:'DISPUTED'});
  for(const parent of [first,second]) await db.MissionDispute.create({serviceId:parent.id,openedBy:client.id,reason:'autre',description:'Résultat à examiner'});
  const result = await queue(admin); expect(result.status).toBe(200); expect(result.body.items.every((item)=>item.action.code==='resolve')).toBe(true);
  const list = await request(app).get(`/api/v1/missions/disputes?serviceId=${first.id}`).set(auth(admin)); expect(list.status).toBe(200); expect(list.body.disputes).toHaveLength(1);
  expect((await request(app).get(`/api/v1/missions/disputes?serviceId=${first.id}`).set(auth(outsider))).body.disputes).toEqual([]);
});
