const Organization = require('../models/organization.model');
const User = require('../models/user.model');
const SupportTicket = require('../models/support.model');
const crypto = require('crypto');

// GET /api/admin/organizations
const getOrganizations = async (req, res) => {
  try {
    const orgs = await Organization.find().sort({ createdAt: -1 });
    // Get presenter lists and counts for each org
    const orgsWithCounts = await Promise.all(orgs.map(async (org) => {
      const presenters = await User.find({ organizationId: org._id }, 'name email createdAt');
      return { ...org.toJSON(), presenterCount: presenters.length, presenters };
    }));
    
    // Overall stats
    const totalPresenters = await User.countDocuments({ role: 'presenter' });
    
    res.json({ 
      organizations: orgsWithCounts,
      stats: {
        totalOrganizations: orgs.length,
        totalPresenters
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/admin/organizations
const createOrganization = async (req, res) => {
  try {
    const { name, domain, maxLicenses } = req.body;
    if (!name) return res.status(400).json({ message: 'Organization name is required' });

    // Generate unique 8-character invite code
    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    const org = await Organization.create({
      name,
      domain,
      maxLicenses: maxLicenses || 10,
      inviteCode
    });

    res.status(201).json({ message: 'Organization created', organization: org });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/admin/organizations/:id/status
const toggleOrganizationStatus = async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ message: 'Organization not found' });

    org.isActive = !org.isActive;
    await org.save();

    res.json({ message: `Organization ${org.isActive ? 'activated' : 'deactivated'}`, organization: org });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/admin/support
const getTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find().populate('userId', 'name email').populate('organizationId', 'name').sort({ createdAt: -1 });
    res.json({ tickets });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getOrganizations, createOrganization, toggleOrganizationStatus, getTickets };
