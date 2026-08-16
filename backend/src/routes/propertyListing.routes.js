'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/propertyListing.controller');
const auth = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/roles.middleware');
const { validateBody } = require('../middleware/validate.middleware');
const uploadPropertyListingPhotos = require('../middleware/uploadPropertyListingPhotos.middleware');
const {
  createPropertyListingSchema,
  updatePropertyListingSchema,
} = require('../validators/propertyListing.schemas');

const NON_REGRESSIVE_VALIDATION_OPTIONS = { allowUnknown: true, stripUnknown: false };

// Public, sans auth (docs/BRAINSTORM_ECOSYSTEME_TERANGA.md §7) — vitrine + fiche partageable.
// Chemins littéraux déclarés avant '/:id' pour ne jamais être capturés par le paramètre.
router.get('/admin', auth, requireAdmin, ctrl.listForAdmin);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);

router.post(
  '/',
  auth,
  requireAdmin,
  uploadPropertyListingPhotos,
  validateBody(createPropertyListingSchema, NON_REGRESSIVE_VALIDATION_OPTIONS),
  ctrl.create
);

router.put(
  '/:id',
  auth,
  requireAdmin,
  uploadPropertyListingPhotos,
  validateBody(updatePropertyListingSchema, NON_REGRESSIVE_VALIDATION_OPTIONS),
  ctrl.update
);

router.delete('/:id', auth, requireAdmin, ctrl.remove);

module.exports = router;
