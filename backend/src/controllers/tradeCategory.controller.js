'use strict';

const { TradeCategory } = require('../../models');
const logger = require('../utils/logger');

/* ============================================================
   LIST — filières actives (docs/DEV_SPEC_TERANGA_v3.md section 3.3, public)
============================================================ */
exports.list = async (_req, res) => {
  try {
    const tradeCategories = await TradeCategory.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']],
    });

    return res.json({ tradeCategories });
  } catch (e) {
    logger.error({ err: e }, 'tradeCategory.list.failed');
    return res.status(500).json({ error: 'Erreur lors de la récupération des filières' });
  }
};
