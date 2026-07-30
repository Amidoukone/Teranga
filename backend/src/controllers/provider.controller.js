'use strict';

const { Provider, ProviderContract, TradeCategory, User } = require('../../models');
const { getPagination } = require('../utils/pagination');
const {
  canManageProvider,
  getManageableProviderFilter,
  isProviderInGeoScope,
} = require('../utils/providerScope');
const { isGlobalAdmin } = require('../utils/geoScope');
const {
  PROVIDER_STATUS_VALUES,
  isValidProviderStatusTransition,
} = require('../constants/providerStatus');
const logger = require('../utils/logger');

/**
 * Endpoints Teranga Pro (docs/DEV_SPEC_TERANGA_v3.md section 3.3).
 * Rappel anti-fuite (section 3.6) : ces endpoints sont réservés à
 * admin/category_manager (jamais 'client'), donc renvoient le prestataire au
 * complet — c'est le DTO public (Provider.toPublicDTO) qui protège les
 * données sensibles, à utiliser dans un futur endpoint côté client (Lot 4,
 * matching).
 */

function findProviderById(id) {
  return Provider.findByPk(id, {
    include: [
      { model: User, as: 'user', attributes: ['id', 'email', 'phone', 'role'] },
      { model: TradeCategory, as: 'tradeCategories' },
      { model: ProviderContract, as: 'contracts' },
    ],
  });
}

/* ============================================================
   1️⃣ CREATE — candidature prestataire (étape 1 onboarding, 13.5)
============================================================ */
exports.create = async (req, res) => {
  try {
    let targetUserId;

    if (req.user?.role === 'provider') {
      // Auto-candidature (13.5) : le compte crée sa propre fiche.
      targetUserId = req.user.id;
    } else if (req.user?.role === 'admin') {
      // Onboarding par un admin/master au nom d'un compte déjà créé avec le
      // rôle 'provider' (entreprise ou ouvrier indépendant recruté directement
      // par Teranga plutôt qu'auto-candidat).
      targetUserId = Number(req.body.userId);
      if (!targetUserId) {
        return res.status(400).json({
          error: "userId requis : créer d'abord le compte avec le rôle 'provider'",
        });
      }

      const targetUser = await User.findByPk(targetUserId);
      if (!targetUser || targetUser.role !== 'provider') {
        return res.status(400).json({
          error: "Le compte cible doit exister avec le rôle 'provider'",
        });
      }

      if (!isGlobalAdmin(req.user)) {
        const inScope = await isProviderInGeoScope(req.user, {
          countryCode: req.body.countryCode,
        });
        if (!inScope) {
          return res.status(403).json({
            error: 'Pays hors du périmètre géographique de cet administrateur',
          });
        }
      }
    } else {
      return res.status(403).json({
        error:
          "Seul un compte avec le rôle 'provider', ou un admin au nom d'un tel compte, peut créer un profil prestataire",
      });
    }

    const existing = await Provider.findOne({ where: { userId: targetUserId } });
    if (existing) {
      return res.status(409).json({ error: 'Un profil prestataire existe déjà pour ce compte' });
    }

    const {
      type,
      legalName,
      displayFirstName,
      rccmNumber,
      phoneNumber,
      email,
      countryCode,
      hasLiabilityInsurance,
      insuranceExpiresAt,
      tradeCategoryIds,
    } = req.body;

    const tradeCategories = await TradeCategory.findAll({
      where: { id: tradeCategoryIds, isActive: true },
    });
    if (tradeCategories.length !== new Set(tradeCategoryIds).size) {
      return res.status(400).json({ error: 'Une ou plusieurs filières sont invalides ou inactives' });
    }

    const requiresCompany = tradeCategories.some((tc) => tc.requiresCompany);
    if (requiresCompany && type !== 'company') {
      return res.status(400).json({
        error: 'Au moins une filière sélectionnée exige un prestataire de type "company"',
      });
    }
    if (type === 'company' && !rccmNumber) {
      return res.status(400).json({ error: 'Le numéro RCCM est requis pour un prestataire entreprise' });
    }

    const provider = await Provider.create({
      userId: targetUserId,
      type,
      legalName: legalName || null,
      displayFirstName,
      rccmNumber: rccmNumber || null,
      phoneNumber,
      email: email || null,
      countryCode,
      hasLiabilityInsurance: Boolean(hasLiabilityInsurance),
      insuranceExpiresAt: insuranceExpiresAt || null,
    });

    await provider.addTradeCategories(tradeCategories);

    const created = await findProviderById(provider.id);
    return res.status(201).json({ provider: created });
  } catch (e) {
    logger.error({ err: e }, 'provider.create.failed');
    return res.status(500).json({ error: 'Erreur lors de la création du profil prestataire' });
  }
};

/* ============================================================
   2️⃣ LIST — admin/category_manager, scope filière + géo
============================================================ */
exports.list = async (req, res) => {
  try {
    const filter = await getManageableProviderFilter(req.user);
    if (filter.deny) {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const { limit, offset, page } = getPagination(req);
    const where = {};

    const status = String(req.query?.status || '').trim();
    if (status) {
      if (!PROVIDER_STATUS_VALUES.includes(status)) {
        return res.status(400).json({ error: 'Statut invalide' });
      }
      where.status = status;
    }

    if (filter.countryCodes) where.countryCode = filter.countryCodes;

    const include = [
      { model: TradeCategory, as: 'tradeCategories', through: { attributes: [] } },
      { model: User, as: 'user', attributes: ['id', 'email', 'phone', 'role'] },
    ];
    if (filter.tradeCategoryIds) {
      include[0].where = { id: filter.tradeCategoryIds };
      include[0].required = true;
    }

    const { rows, count } = await Provider.findAndCountAll({
      where,
      include,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return res.json({ providers: rows, pagination: { page, limit, offset, total: count } });
  } catch (e) {
    logger.error({ err: e }, 'provider.list.failed');
    return res.status(500).json({ error: 'Erreur lors de la récupération des prestataires' });
  }
};

/* ============================================================
   3️⃣ DETAIL — usage interne admin/category_manager uniquement
============================================================ */
exports.detail = async (req, res) => {
  try {
    const provider = await findProviderById(req.params.id);
    if (!provider) return res.status(404).json({ error: 'Prestataire introuvable' });

    if (!(await canManageProvider(req.user, provider))) {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    return res.json({ provider });
  } catch (e) {
    logger.error({ err: e }, 'provider.detail.failed');
    return res.status(500).json({ error: 'Erreur lors de la récupération du prestataire' });
  }
};

/* ============================================================
   4️⃣ UPDATE STATUS — onboarding pending -> probation -> active
============================================================ */
exports.updateStatus = async (req, res) => {
  try {
    const provider = await Provider.findByPk(req.params.id);
    if (!provider) return res.status(404).json({ error: 'Prestataire introuvable' });

    if (!(await canManageProvider(req.user, provider))) {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const { status: nextStatus } = req.body;
    if (!isValidProviderStatusTransition(provider.status, nextStatus)) {
      return res.status(400).json({
        error: `Transition invalide : ${provider.status} -> ${nextStatus}`,
      });
    }

    provider.status = nextStatus;
    await provider.save();

    return res.json({ provider });
  } catch (e) {
    logger.error({ err: e }, 'provider.updateStatus.failed');
    return res.status(500).json({ error: 'Erreur lors du changement de statut' });
  }
};

/* ============================================================
   5️⃣ CONTRACTS — enregistrer le contrat signé (13.6)
============================================================ */
exports.addContract = async (req, res) => {
  try {
    const provider = await Provider.findByPk(req.params.id);
    if (!provider) return res.status(404).json({ error: 'Prestataire introuvable' });

    if (!(await canManageProvider(req.user, provider))) {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const { commissionRate, nonCircumventionMonths, signedAt, documentUrl } = req.body;

    const contract = await ProviderContract.create({
      providerId: provider.id,
      commissionRate,
      nonCircumventionMonths: nonCircumventionMonths ?? 12,
      signedAt,
      documentUrl: documentUrl || null,
      status: 'active',
    });

    return res.status(201).json({ contract });
  } catch (e) {
    logger.error({ err: e }, 'provider.addContract.failed');
    return res.status(500).json({ error: 'Erreur lors de la création du contrat' });
  }
};
