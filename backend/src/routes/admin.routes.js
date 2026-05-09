const express = require('express');
const router = express.Router();
const { getOrganizations, createOrganization, toggleOrganizationStatus, getTickets } = require('../controllers/admin.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

// Protect all admin routes
router.use(protect, adminOnly);

router.get('/organizations', getOrganizations);
router.post('/organizations', createOrganization);
router.put('/organizations/:id/status', toggleOrganizationStatus);
router.get('/support', getTickets);

module.exports = router;
