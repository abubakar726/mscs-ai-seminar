const SupportTicket = require('../models/support.model');

// POST /api/support
const createTicket = async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ message: 'Subject and message required' });
    }

    const ticket = await SupportTicket.create({
      userId: req.user._id,
      organizationId: req.user.organizationId,
      subject,
      message
    });

    res.status(201).json({ message: 'Support ticket submitted successfully', ticket });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/support/my
const getMyTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ tickets });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createTicket, getMyTickets };
