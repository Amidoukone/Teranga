// backend/src/routes/orderItem.routes.js
'use strict';

const express = require('express');
const flatRouter = express.Router();                     // Routes "plates": /api/order-items
const nestedRouter = express.Router({ mergeParams: true }); // Routes "imbriquées": /api/orders/:orderId/items

const ctrl = require('../controllers/orderItem.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');

/* =====================================================================
   ROUTES PLATES (compat actuelle)
   Montées par server.js sur:  /api/order-items
   - POST   /            -> créer un item (orderId dans body ou query)
   - GET    /            -> lister items (?orderId=...)
   - PUT    /:id         -> maj item
   - DELETE /:id         -> supprimer item
===================================================================== */
flatRouter.post('/',  auth, requireRoles('admin', 'client'),              ctrl.create);
flatRouter.get('/',   auth, requireRoles('admin', 'agent', 'client'),     ctrl.list);   // ?orderId=...
flatRouter.put('/:id',auth, requireRoles('admin', 'client'),              ctrl.update);
flatRouter.delete('/:id', auth, requireRoles('admin', 'client'),          ctrl.remove);

/* =====================================================================
   ROUTES IMBRIQUÉES (NOUVEAU)
   A monter dans order.routes.js sur:  /api/orders/:orderId/items
   - POST   /            -> créer un item pour la commande :orderId
   - GET    /            -> lister items de :orderId
   - PUT    /:id         -> maj item (id) appartenant à :orderId
   - DELETE /:id         -> supprimer item (id) appartenant à :orderId

   ⚠️ mergeParams:true permet à ctrl.* d'accéder à req.params.orderId,
   ce que ton contrôleur sait déjà gérer via getOrderId(req).
===================================================================== */
nestedRouter.post('/',   auth, requireRoles('admin', 'client'),           ctrl.create);
nestedRouter.get('/',    auth, requireRoles('admin', 'agent', 'client'),  ctrl.list);
nestedRouter.put('/:id', auth, requireRoles('admin', 'client'),           ctrl.update);
nestedRouter.delete('/:id', auth, requireRoles('admin', 'client'),        ctrl.remove);

/* =====================================================================
   EXPORTS
   - export par défaut: routes plates (compat immédiate)
   - export .nested:    sous-routeur prêt à être monté sous /orders/:orderId
===================================================================== */
module.exports = flatRouter;
module.exports.nested = nestedRouter;
