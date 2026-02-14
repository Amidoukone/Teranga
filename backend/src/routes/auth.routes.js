const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const auth = require('../middleware/auth.middleware');
const { validateBody } = require('../middleware/validate.middleware');
const {
  authLimiter,
  refreshLimiter,
} = require('../middleware/rateLimit.middleware');
const {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateMeSchema,
} = require('../validators/auth.schemas');

router.post('/register', authLimiter, validateBody(registerSchema), ctrl.register);
router.post('/login', authLimiter, validateBody(loginSchema), ctrl.login);
router.post('/refresh', refreshLimiter, ctrl.refresh);
router.post('/logout', auth, ctrl.logout);
router.get('/me', auth, ctrl.me);
router.patch('/me', auth, validateBody(updateMeSchema), ctrl.updateMe);

router.post(
  '/change-password',
  auth,
  validateBody(changePasswordSchema),
  ctrl.changePassword
);

module.exports = router;
