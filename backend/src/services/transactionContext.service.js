'use strict';

const { Service, Task, Order, Project, Country, Region, User } = require('../../models');
const { canAccessGeoResource, getUserGeoScope, getCountryIdByIso } = require('../utils/geoScope');

const LINK_MODELS = { serviceId: Service, taskId: Task, orderId: Order, projectId: Project };
const id = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const same = (a, b) => String(a ?? '') === String(b ?? '');

async function resolveTransactionContext(req, { previous = null } = {}) {
  const body = req.body || {};
  const linksChanged = Object.keys(LINK_MODELS).some((field) => body[field] !== undefined);
  const entries = await Promise.all(Object.entries(LINK_MODELS).map(async ([field, model]) => {
    const targetId = id(body[field] !== undefined ? body[field] : previous?.[field]);
    const include = field === 'orderId' ? [{ model: User, as: 'user', attributes: ['id', 'countryId', 'regionId', 'country'] }]
      : field === 'projectId' ? [{ model: User, as: 'client', attributes: ['id', 'country'] }] : [];
    const record = targetId ? await model.findByPk(targetId, { include }) : null;
    if (targetId && !record) fail('Une opération liée est introuvable');
    return [field.replace(/Id$/, ''), record];
  }));
  const links = Object.fromEntries(entries);
  const records = entries.map(([, record]) => record).filter(Boolean);
  if (links.service && links.task?.serviceId && !same(links.task.serviceId, links.service.id)) fail('La tâche ne dépend pas du service sélectionné');

  const countries = new Set(records.map((record) => record.countryId ?? record.country_id).filter((value) => value != null).map(String));
  const regions = new Set(records.map((record) => record.regionId ?? record.region_id).filter((value) => value != null).map(String));
  if (countries.size > 1 || regions.size > 1) fail('Les opérations liées doivent appartenir au même périmètre géographique');
  let linkedCountryId = id([...countries][0]);
  let linkedRegionId = id([...regions][0]);
  if (!linkedCountryId) {
    const legacyProjectCountry = links.project?.client?.country ? await getCountryIdByIso(links.project.client.country) : null;
    const legacyOrderCountry = links.order?.user?.countryId ?? (links.order?.user?.country ? await getCountryIdByIso(links.order.user.country) : null);
    if (legacyProjectCountry && legacyOrderCountry && !same(legacyProjectCountry, legacyOrderCountry)) fail('Les opérations historiques liées appartiennent à des pays différents');
    linkedCountryId = legacyProjectCountry ?? legacyOrderCountry ?? null;
    if (!linkedRegionId && legacyOrderCountry && same(linkedCountryId, legacyOrderCountry)) linkedRegionId = id(links.order?.user?.regionId);
  }
  const userScope = getUserGeoScope(req.user);
  const isAdmin = req.user?.role === 'admin';
  const countrySent = isAdmin && (body.countryId !== undefined || body.country_id !== undefined);
  const regionSent = isAdmin && (body.regionId !== undefined || body.region_id !== undefined);
  const requestedCountry = countrySent ? id(body.countryId ?? body.country_id) : null;
  const requestedRegion = regionSent ? id(body.regionId ?? body.region_id) : null;
  const candidateCountry = countrySent ? requestedCountry : linkedCountryId ?? previous?.countryId ?? userScope.countryId ?? null;
  const countryChanged = previous && !same(candidateCountry, previous.countryId);
  const inheritedRegion = previous ? (countryChanged || (linksChanged && records.length) ? null : previous.regionId)
    : same(candidateCountry, userScope.countryId) ? userScope.regionId : null;
  const candidateRegion = regionSent ? requestedRegion : linkedRegionId ?? inheritedRegion ?? null;

  if (isAdmin && !canAccessGeoResource({ countryId: candidateCountry, regionId: candidateRegion }, req.user)) fail('Transaction hors du périmètre géographique autorisé', 403);
  if (countrySent && requestedCountry && linkedCountryId && !same(requestedCountry, linkedCountryId)) fail('Le pays de la transaction doit correspondre à ses opérations liées');
  if (regionSent && requestedRegion && linkedRegionId && !same(requestedRegion, linkedRegionId)) fail('La région de la transaction doit correspondre à ses opérations liées');
  let countryId = linkedCountryId ?? candidateCountry;
  const regionId = linkedRegionId ?? candidateRegion;
  if (regionId) {
    const region = await Region.findByPk(regionId, { attributes: ['id', 'countryId'] });
    if (!region || (countryId && !same(region.countryId, countryId))) fail('Région incompatible avec le pays de la transaction');
    countryId = region.countryId;
  }
  if (['admin', 'agent'].includes(req.user?.role) && !canAccessGeoResource({ countryId, regionId }, req.user)) fail('Transaction hors du périmètre géographique autorisé', 403);
  if (req.user?.role === 'client') {
    const owned = (record, ownerField) => !record || same(record[ownerField], req.user.id);
    const taskService = links.task?.serviceId ? (same(links.service?.id, links.task.serviceId) ? links.service : await Service.findByPk(links.task.serviceId)) : null;
    if (!owned(links.service, 'clientId') || !owned(links.order, 'userId') || !owned(links.project, 'clientId') ||
        (links.task && !owned(links.task, 'creatorId') && (!taskService || !owned(taskService, 'clientId')))) fail('Opération liée non autorisée pour ce client', 403);
  }
  const linkedCurrency = links.service?.currency || links.task?.currency || links.order?.currency || links.project?.currency;
  const country = !linkedCurrency && countryId ? await Country.findByPk(countryId, { attributes: ['currency'] }) : null;
  if (!linkedCurrency && countryId && !country) fail('Pays de la transaction introuvable');
  return { ...links, countryId, regionId, currency: linkedCurrency || country?.currency || previous?.currency || 'XOF' };
}

module.exports = { resolveTransactionContext };
