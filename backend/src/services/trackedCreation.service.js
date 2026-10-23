'use strict';
const db = require('../../models');

// The resource and its retry receipt commit together. Hydration, session setup or
// notification failures after this point cannot turn a retry into a second request.
async function createTrackedResource(req, Model, values, options = {}) {
  if (!req.creationReceipt) return Object.keys(options).length ? Model.create(values, options) : Model.create(values);
  const persist = async (transaction) => {
    const resource = await Model.create(values, { ...options, transaction });
    const resourceType = Model === db.Order ? 'order' : Model === db.Project ? 'project' : 'service';
    await req.creationReceipt.update({ state: 'completed', resourceType, resourceId: resource.id }, { transaction });
    return resource;
  };
  return options.transaction ? persist(options.transaction) : db.sequelize.transaction(persist);
}
module.exports = { createTrackedResource };
