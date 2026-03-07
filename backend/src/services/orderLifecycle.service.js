"use strict";

const { Transaction } = require("../../models");
const { getAdminRecipientIds, computeProgress } = require("./notification.service");
const { emitEvent } = require("./activity.service");
const { filterGeoAssignmentsForModel } = require("../utils/geoScope");
const logger = require("../utils/logger");

function uniqRecipients(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

async function notifyOrderCreated({ actorId, order }) {
  try {
    const adminIds = await getAdminRecipientIds({
      countryId: order.countryId,
      regionId: order.regionId,
    });
    const recipients = uniqRecipients([...adminIds, order.userId]);

    await emitEvent({
      recipients,
      actorId,
      entityType: "order",
      entityId: order.id,
      action: "created",
      title: "Nouvelle commande",
      message: order.code ? `Commande ${order.code}` : `Commande #${order.id}`,
      progress: computeProgress("order", order.status),
      entityStatus: order.status,
      metadata: {
        orderId: order.id,
        code: order.code || null,
        total: order.total || null,
        currency: order.currency || null,
      },
      countryId: order.countryId,
      regionId: order.regionId,
      notificationMode: "create",
    });
  } catch (err) {
    logger.warn({ err, orderId: order?.id }, "order.notification.create.failed");
  }
}

async function notifyOrderStatusUpdated({ actorId, order }) {
  try {
    const adminIds = await getAdminRecipientIds({
      countryId: order.countryId,
      regionId: order.regionId,
    });
    const recipients = uniqRecipients([...adminIds, order.userId]);

    await emitEvent({
      recipients,
      actorId,
      entityType: "order",
      entityId: order.id,
      action: "status_updated",
      title: "Statut commande mis à jour",
      message: order.code ? `Commande ${order.code}` : `Commande #${order.id}`,
      progress: computeProgress("order", order.status),
      entityStatus: order.status,
      metadata: {
        orderId: order.id,
        code: order.code || null,
        total: order.total || null,
        currency: order.currency || null,
      },
      countryId: order.countryId,
      regionId: order.regionId,
      notificationMode: "update",
    });
  } catch (err) {
    logger.warn({ err, orderId: order?.id }, "order.notification.status_update.failed");
  }
}

async function syncOrderPaymentTransaction({ order }) {
  if (!["paid", "delivered"].includes(order.status)) return;

  try {
    const existingTx = await Transaction.findOne({
      where: {
        orderId: order.id,
        userId: order.userId,
        type: "expense",
      },
    });

    if (!existingTx) {
      await Transaction.create(
        filterGeoAssignmentsForModel(Transaction, {
          userId: order.userId,
          orderId: order.id,
          type: "expense",
          amount: order.total || 0,
          currency: order.currency || "XOF",
          paymentMethod: order.paymentMethod || "inconnu",
          description: `Paiement de la commande ${order.code || `#${order.id}`}`,
          status: "completed",
          countryId: order.countryId ?? null,
          regionId: order.regionId ?? null,
        })
      );
      return;
    }

    if (existingTx.status !== "completed") {
      existingTx.status = "completed";

      if (existingTx.countryId == null && order.countryId != null) {
        existingTx.countryId = order.countryId;
      }
      if (existingTx.regionId == null && order.regionId != null) {
        existingTx.regionId = order.regionId;
      }

      await existingTx.save();
    }
  } catch (err) {
    logger.error({ err, orderId: order?.id }, "order.transaction.sync.failed");
  }
}

module.exports = {
  notifyOrderCreated,
  notifyOrderStatusUpdated,
  syncOrderPaymentTransaction,
};
