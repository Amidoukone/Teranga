"use strict";

const { Activity, User } = require("../../models");
const { Op } = require("sequelize");
const { getPagination } = require("../utils/pagination");
const logger = require("../utils/logger");

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

exports.list = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Non authentifie" });
    }

    const { limit, offset, page } = getPagination(req, 20, 100);

    const entityType = toTrimOrNull(req.query?.entityType);
    const action = toTrimOrNull(req.query?.action);
    const progress = toTrimOrNull(req.query?.progress);
    const entityId = toSafeInt(req.query?.entityId);
    const from = toDateOrNull(req.query?.from);
    const to = toDateOrNull(req.query?.to);

    const where = { userId: req.user.id };

    if (entityType) where.entityType = entityType;
    if (action) where.action = action;
    if (progress) where.progress = progress;
    if (entityId) where.entityId = entityId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt[Op.gte] = from;
      if (to) where.createdAt[Op.lte] = to;
    }

    const { rows, count } = await Activity.findAndCountAll({
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
      activities: rows.map((a) => (a.toJSON ? a.toJSON() : a)),
      pagination: { page, limit, offset, total: count, count },
    });
  } catch (e) {
    logger.error({ err: e, userId: req.user?.id || null }, "list activities failed");
    return res.status(500).json({
      error: "Erreur lors de la recuperation des activites",
    });
  }
};

