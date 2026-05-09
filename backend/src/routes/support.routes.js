const express = require('express');
const router = express.Router();
const { createTicket, getMyTickets } = require('../controllers/support.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);
router.post('/', createTicket);
router.get('/my', getMyTickets);

module.exports = router;
