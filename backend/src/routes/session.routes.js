const express = require('express');
const router = express.Router();
const { createSession, joinSession, getSession, getMySessions, generateQrToken, verifyQrToken } = require('../controllers/session.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/create', protect, createSession);   // Presenter only
router.post('/join', joinSession);                 // No auth needed
router.get('/my', protect, getMySessions);         // Presenter's sessions
router.get('/:id/qr-token', protect, generateQrToken); // Generate new dynamic QR token
router.post('/verify-qr', verifyQrToken);          // Validate scan
router.get('/:id', getSession);                    // Get session details

module.exports = router;
