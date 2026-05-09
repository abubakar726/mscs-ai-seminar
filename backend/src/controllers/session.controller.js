const Session = require('../models/session.model');
const { generateSessionCode, generateQRCode } = require('../utils/session.util');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// POST /api/sessions/create
const createSession = async (req, res) => {
  try {
    const { title, baseUrl } = req.body;

    let sessionCode;
    let isUnique = false;
    while (!isUnique) {
      sessionCode = generateSessionCode();
      const existing = await Session.findOne({ sessionCode });
      if (!existing) isUnique = true;
    }

    const qrCode = await generateQRCode(sessionCode, baseUrl);

    const session = await Session.create({
      title: title || 'Seminar Session',
      presenterId: req.user._id,
      presenterName: req.user.name,
      sessionCode,
      qrCode,
      status: 'waiting',
    });

    res.status(201).json({ message: 'Session created', session });
  } catch (err) {
    console.error('Create session error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/sessions/join
const joinSession = async (req, res) => {
  try {
    const { sessionCode, sessionEntryToken, name, role } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    let session;
    if (sessionEntryToken) {
      // Join via dynamic QR scan
      try {
        const decoded = jwt.verify(sessionEntryToken, process.env.JWT_SECRET);
        session = await Session.findById(decoded.sessionId);
      } catch (err) {
        return res.status(401).json({ message: 'QR code session expired. Please scan again.' });
      }
    } else if (sessionCode) {
      return res.status(403).json({ message: 'Manual session code entry is disabled. Please scan the QR code to join.' });
    } else {
      return res.status(400).json({ message: 'Valid token required to join' });
    }

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (session.status === 'ended') {
      return res.status(400).json({ message: 'This session has ended' });
    }

    const participant = {
      name,
      role: role || 'student',
      speakCount: 0,
      isOnline: true,
    };

    session.participants.push(participant);
    await session.save();

    const savedParticipant = session.participants[session.participants.length - 1];

    res.json({
      message: 'Joined successfully',
      sessionId: session._id,
      sessionCode: session.sessionCode,
      participantId: savedParticipant._id,
      participantName: name,
      presenterName: session.presenterName,
      status: session.status,
      mode: session.mode,
    });
  } catch (err) {
    console.error('Join session error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/sessions/:id
const getSession = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json({ session });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/sessions/my
const getMySessions = async (req, res) => {
  try {
    const sessions = await Session.find({ presenterId: req.user._id })
      .sort({ createdAt: -1 });
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/sessions/:id/qr-token
const generateQrToken = async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, presenterId: req.user._id });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const token = crypto.randomBytes(16).toString('hex');
    session.currentQrToken = token;
    session.qrTokenExpiresAt = new Date(Date.now() + 15000); // 15 seconds validity
    await session.save();

    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/sessions/verify-qr
const verifyQrToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Token required' });

    const session = await Session.findOne({ currentQrToken: token });
    if (!session) {
      return res.status(401).json({ message: 'Invalid QR code' });
    }

    if (new Date() > session.qrTokenExpiresAt) {
      return res.status(401).json({ message: 'QR code expired. Please scan the latest one.' });
    }

    // Generate 5-minute session entry JWT
    const sessionEntryToken = jwt.sign(
      { sessionId: session._id },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    res.json({ sessionEntryToken, sessionCode: session.sessionCode });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createSession, joinSession, getSession, getMySessions, generateQrToken, verifyQrToken };