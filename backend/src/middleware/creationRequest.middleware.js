'use strict';
const crypto = require('crypto');
const db = require('../../models');
const { canAccessGeoResource } = require('../utils/geoScope');
const logger = require('../utils/logger');

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
const digest = (value) => crypto.createHmac('sha256', process.env.JWT_SECRET).update(value).digest('hex');

// A durable reservation is taken BEFORE any account, stock or request side effect.
// Ambiguous failures remain pending: a timeout must never authorize a second creation.
function guardCreation(channel, { publicRequest = false } = {}) {
  return async (req, res, next) => {
    const key = req.get('Idempotency-Key');
    if (!key) return next(); // Legacy clients remain compatible; all current forms send a key.
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(key)) return res.status(400).json({ error: 'Clé de demande invalide' });
    const actor = publicRequest ? String(req.body.phone || '').replace(/[^+\d]/g, '') : req.user.id;
    const id = digest(`${channel}:${actor}:${key}`);
    const payloadHash = digest(JSON.stringify(canonical(req.body)));
    let receipt;
    try {
      try { receipt = await db.CreationRequest.create({ id, payloadHash }); }
      catch (error) {
        if (error.name !== 'SequelizeUniqueConstraintError') throw error;
        receipt = await db.CreationRequest.findByPk(id);
        if (!receipt || receipt.payloadHash !== payloadHash) return res.status(409).json({ code: 'REQUEST_KEY_REUSED', error: 'Cette clé a déjà été utilisée pour une autre demande.' });
        if (receipt.state !== 'completed') return res.status(409).json({ code: 'REQUEST_PENDING', error: 'Cette demande est en cours de vérification. Actualisez votre liste avant de réessayer.' });
        if (publicRequest) return res.status(409).json({ code: 'REQUEST_ALREADY_CREATED', error: 'Cette demande a déjà été enregistrée. Connectez-vous à votre espace pour la retrouver.' });
        const Model = { service: db.Service, project: db.Project, order: db.Order }[receipt.resourceType];
        const resource = Model ? await Model.findByPk(receipt.resourceId) : null;
        if (!resource) return res.status(410).json({ error: 'La demande initiale n’est plus disponible.' });
        const authorized = req.user.role === 'admin' ? canAccessGeoResource(resource, req.user)
          : String(resource.clientId || resource.userId) === String(req.user.id);
        if (!authorized) return res.status(403).json({ error: 'Demande hors de votre périmètre' });
        const responseField = ['phone-order', 'mission'].includes(channel) ? 'mission' : receipt.resourceType;
        return res.status(200).json({ [responseField]: resource, replayed: true });
      }
    } catch (error) {
      logger.error({ err: error, channel }, 'creation.reservation.failed');
      return res.status(503).json({ error: 'La protection de votre demande est indisponible. Réessayez plus tard.' });
    }
    req.creationReceipt = receipt;
    const send = res.json.bind(res);
    res.json = async (body) => {
      try {
        await receipt.reload();
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const type = body.order ? 'order' : body.project ? 'project' : (body.service || body.mission) ? 'service' : null;
          const resource = body.order || body.project || body.service || body.mission;
          if (!type || !resource?.id) throw new Error('Creation response must identify its resource');
          // No PIN, session token, recovery code or response payload is retained here.
          await receipt.update({ state: 'completed', resourceType: type, resourceId: resource.id });
        } else if (res.statusCode < 500 && receipt.state !== 'completed') await receipt.destroy();
        return send(body);
      } catch (error) {
        logger.error({ err: error, channel, requestId: id }, 'creation.receipt.failed');
        res.status(503);
        return send({ code: 'REQUEST_PENDING', error: 'La demande nécessite une vérification. Consultez votre liste avant toute nouvelle saisie.' });
      }
    };
    next();
  };
}
module.exports = { guardCreation, canonical };
