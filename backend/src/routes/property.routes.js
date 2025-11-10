'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/property.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');
const upload = require('../middleware/upload'); // ✅ Multer (photos)

// -----------------------------------------------------------------------------
// ROUTES PROPERTIES
// =================
// - Client : gérer ses biens
// - Admin  : peut créer un bien pour un client, voir les biens d’un client, etc.
// -----------------------------------------------------------------------------
//
// Rappel important : le contrôleur supporte déjà pour l’admin :
//   - body.ownerId | body.clientId | body.ownerEmail
//   - (fallbacks possibles via req.query.ownerId|clientId)
// afin d’attribuer le bien à un client cible.
// Ici, on ajoute aussi des alias/shortcuts côté routes pour plus de confort.
// -----------------------------------------------------------------------------

/**
 * ➕ Créer un bien (client connecté OU admin pour soi-même)
 * - Upload : champ "files" (max 5)
 * - Admin : peut aussi passer ownerId|clientId|ownerEmail dans le body (géré côté ctrl)
 */
router.post('/', auth, upload.array('files', 5), ctrl.create);

/**
 * 📜 Lister les biens (client: les siens / admin: tous par défaut, ou ?clientId=)
 */
router.get('/', auth, ctrl.list);

/**
 * 🔹 Admin : lister les biens d’un client spécifique
 */
router.get('/client/:id', auth, requireRoles('admin'), ctrl.listByClient);

/**
 * ✏️ Mettre à jour un bien existant (merge/remplacement des photos possible)
 * - Upload : champ "files" (max 5)
 */
router.put('/:id', auth, upload.array('files', 5), ctrl.update);

/**
 * 🗑 Supprimer un bien
 */
router.delete('/:id', auth, ctrl.remove);

// ============================================================================
// 🆕 Alias/shortcuts Admin POUR CRÉER un bien au nom d’un client
// ============================================================================

/**
 * Middleware utilitaire : injecte ownerId depuis :id dans le body
 * pour simplifier l’appel POST /api/properties/client/:id (admin).
 */
function attachOwnerIdFromParam(req, _res, next) {
  req.body = req.body || {};
  req.body.ownerId = req.params.id; // le contrôleur validera que c’est un client
  next();
}

/**
 * 🆕 (ADMIN) Créer un bien pour un client précis via paramètre de route
 * POST /api/properties/client/:id
 * - :id = id du client cible (devient req.body.ownerId)
 * - Upload fichiers via "files" (max 5)
 */
router.post(
  '/client/:id',
  auth,
  requireRoles('admin'),
  upload.array('files', 5),
  attachOwnerIdFromParam,
  (req, res, next) => {
    console.log(
      `🛠️ [ROUTE] Admin crée un bien pour clientId=${req.params.id} | files=${(req.files || []).length}`
    );
    return ctrl.create(req, res, next);
  }
);

/**
 * 🆕 (ADMIN) Alias générique
 * POST /api/properties/admin
 * - Permet d’envoyer ownerId | clientId | ownerEmail dans le body (géré par ctrl)
 * - Upload via "files" (max 5)
 */
router.post(
  '/admin',
  auth,
  requireRoles('admin'),
  upload.array('files', 5),
  (req, res, next) => {
    const { ownerId, clientId, ownerEmail } = req.body || {};
    console.log(
      `🛠️ [ROUTE] Admin crée un bien (ownerId=${ownerId || '-'} | clientId=${
        clientId || '-'
      } | ownerEmail=${ownerEmail || '-'}) | files=${(req.files || []).length}`
    );
    return ctrl.create(req, res, next);
  }
);

// ============================================================================
// 🆕 Aliases de compatibilité (lecture) utiles pour certains frontends
// ============================================================================

/**
 * 🆕 (ADMIN) Alias de listByClient : /by-owner/:id
 * - Évite de casser certains clients qui appellent /properties/by-owner/:id
 */
router.get('/by-owner/:id', auth, requireRoles('admin'), ctrl.listByClient);

module.exports = router;
