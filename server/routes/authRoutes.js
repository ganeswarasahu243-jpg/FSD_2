const express = require('express');
const router = express.Router();
const { register, login, getMe, updateProfile } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/register/', register);

router.post('/login', login);
router.post('/login/', login);

router.get('/me', requireAuth, getMe);
router.get('/me/', requireAuth, getMe);

router.put('/profile', requireAuth, updateProfile);
router.put('/profile/', requireAuth, updateProfile);

module.exports = router;
