const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Organization = require('../models/organization.model');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, email, password, inviteCode } = req.body;

    if (!name || !email || !password || !inviteCode) {
      return res.status(400).json({ message: 'Please fill all fields and provide an invite code' });
    }

    // Verify Invite Code
    const organization = await Organization.findOne({ inviteCode, isActive: true });
    if (!organization) {
      return res.status(400).json({ message: 'Invalid or inactive invite code' });
    }

    // Enforce Domain matching if organization has a domain configured
    if (organization.domain) {
      const emailDomain = email.split('@')[1];
      if (emailDomain !== organization.domain) {
        return res.status(400).json({ message: `Email must belong to the university domain (@${organization.domain})` });
      }
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const user = await User.create({ 
      name, 
      email, 
      password, 
      role: 'presenter',
      organizationId: organization._id 
    });

    res.status(201).json({
      message: 'Registered successfully',
      user: user.toJSON(),
      token: generateToken(user._id),
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/auth/setup-admin
// One-time endpoint to create the initial Super Admin account
const setupAdmin = async (req, res) => {
  try {
    // Check if any admin already exists
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      return res.status(403).json({ message: 'Admin already exists. Setup endpoint locked.' });
    }

    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please fill all fields' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const admin = await User.create({ 
      name, 
      email, 
      password, 
      role: 'admin' 
    });

    res.status(201).json({
      message: 'Super Admin created successfully',
      user: admin.toJSON(),
      token: generateToken(admin._id),
    });
  } catch (err) {
    console.error('Setup admin error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please fill all fields' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.json({
      message: 'Login successful',
      user: user.toJSON(),
      token: generateToken(user._id),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  res.json({ user: req.user.toJSON() });
};

module.exports = { register, login, getMe, setupAdmin };
