"use strict";

const { Notification, User } = require("../../models");
const { Op } = require("sequelize");
const { getPagination } = require("../utils/pagination");
const logger = require('../utils/logger');
const {
  getNotificationSummary,
  invalidateNotificationSummary,
} = require("../services/notification.service");

function toSafeInt(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

function toTrimOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function toDateOrNull(value) {
  if (!value) return null;
  const t = Date.parse(String(value));
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isTrue(x) {
  if (typeof x === "string") return x === "1" || x.toLowerCase() === "true";
  return !!x;
}

exports.list = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const { limit, offset, page } = getPagination(req, 20, 100);

    const status = toTrimOrNull(req.query?.status);
    const progress = toTrimOrNull(req.query?.progress);
    const entityType = toTrimOrNull(req.query?.entityType);

    const where = { userId: req.user.id };

    if (status && ["unread", "read"].includes(status)) where.status = status;
    if (progress && ["new", "in_progress", "done"].includes(progress))
      where.progress = progress;
    if (
      entityType &&
      ["service", "task", "order", "evidence", "project"].includes(entityType)
    )
      where.entityType = entityType;

    const { rows, count } = await Notification.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "actor",
          attributes: ["id", "firstName", "lastName", "email", "role"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      notifications: rows.map((n) => (n.toJSON ? n.toJSON() : n)),
      pagination: { page, limit, offset, total: count, count },
    });
  } catch (e) {
    logger.error("list notifications:", e);
    return res.status(500).json({
      error: "Erreur lors de la récupération des notifications",
    });
  }
};

exports.summary = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const data = await getNotificationSummary(req.user.id);
    return res.json(data);
  } catch (e) {
    logger.error("notifications summary:", e);
    return res.status(500).json({
      error: "Erreur lors du chargement des indicateurs",
    });
  }
};

exports.markRead = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const id = toSafeInt(req.params?.id);
    if (!id) return res.status(400).json({ error: "ID invalide" });

    const notif = await Notification.findOne({
      where: { id, userId: req.user.id },
    });

    if (!notif) return res.status(404).json({ error: "Notification introuvable" });

    if (notif.status !== "read") {
      await notif.update({ status: "read", readAt: new Date() });
    }

    invalidateNotificationSummary(req.user.id);

    return res.json({
      message: "Notification marquée comme lue",
      notification: notif.toJSON ? notif.toJSON() : notif,
    });
  } catch (e) {
    logger.error("markRead notification:", e);
    return res.status(500).json({
      error: "Erreur lors de la mise à jour de la notification",
    });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const [count] = await Notification.update(
      { status: "read", readAt: new Date() },
      { where: { userId: req.user.id, status: "unread" } }
    );

    invalidateNotificationSummary(req.user.id);

    return res.json({
      message: "Toutes les notifications ont été marquées comme lues",
      updated: count || 0,
    });
  } catch (e) {
    logger.error("markAllRead notification:", e);
    return res.status(500).json({
      error: "Erreur lors de la mise à jour des notifications",
    });
  }
};

exports.removeOne = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const id = toSafeInt(req.params?.id);
    if (!id) return res.status(400).json({ error: "ID invalide" });

    const count = await Notification.destroy({
      where: { id, userId: req.user.id },
    });

    if (!count) {
      return res.status(404).json({ error: "Notification introuvable" });
    }

    invalidateNotificationSummary(req.user.id);

    return res.json({
      message: "Notification supprimée du fil d'actualité",
      deleted: count,
    });
  } catch (e) {
    logger.error("removeOne notification failed:", e);
    return res.status(500).json({
      error: "Erreur lors de la suppression de la notification",
    });
  }
};

exports.cleanup = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const status = toTrimOrNull(req.query?.status);
    const progress = toTrimOrNull(req.query?.progress);
    const entityType = toTrimOrNull(req.query?.entityType);
    const before = toDateOrNull(req.query?.before);
    const all = isTrue(req.query?.all);

    const where = { userId: req.user.id };

    if (status && ["unread", "read"].includes(status)) where.status = status;
    if (progress && ["new", "in_progress", "done"].includes(progress)) {
      where.progress = progress;
    }
    if (
      entityType &&
      ["service", "task", "order", "evidence", "project"].includes(entityType)
    ) {
      where.entityType = entityType;
    }
    if (before) {
      where.createdAt = { [Op.lt]: before };
    }

    const hasAnyFilter =
      Boolean(status) || Boolean(progress) || Boolean(entityType) || Boolean(before);

    if (!all && !hasAnyFilter) {
      return res.status(400).json({
        error:
          "Aucun filtre de nettoyage fourni. Utilisez status/progress/entityType/before ou all=1.",
      });
    }

    const deleted = await Notification.destroy({ where });

    invalidateNotificationSummary(req.user.id);

    return res.json({
      message: "Nettoyage des notifications termine",
      deleted: deleted || 0,
    });
  } catch (e) {
    logger.error("cleanup notifications failed:", e);
    return res.status(500).json({
      error: "Erreur lors du nettoyage des notifications",
    });
  }
};
