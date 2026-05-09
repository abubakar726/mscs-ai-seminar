const express = require('express');
const router = express.Router();
const { register, login, getMe, setupAdmin } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/register', register);
router.post('/login', login);
router.post('/setup-admin', setupAdmin); // One-time setup
router.get('/me', protect, getMe);

module.exports = router;
