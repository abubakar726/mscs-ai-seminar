const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const sessionRoutes = require('./routes/session.routes');
const aiRoutes = require('./routes/ai.routes');
const adminRoutes = require('./routes/admin.routes');
const supportRoutes = require('./routes/support.routes');
const initSocket = require('./socket/socket.handler');

const app = express();
const server = http.createServer(app);

// Socket.io — sab origins allow
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  allowEIO3: true,
  transports: ['polling', 'websocket'],
});

// 1. CORS FIRST — allow everything to fix preflight issues
app.use(cors({ 
  origin: true, // reflect origin
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'bypass-tunnel-reminder', 'ngrok-skip-browser-warning']
}));

// 2. Bypass localtunnel & ngrok browser warning pages
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  res.setHeader('bypass-tunnel-reminder', 'true');
  
  // Handle preflight specifically just in case
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/support', supportRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'MSCS Backend Running' });
});

// Serve WebRTC helper
app.get('/webrtc.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'webrtc.js'));
});

// Static frontend
app.use(express.static(path.join(__dirname, '../public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Socket.io
initSocket(io);

const { spawn } = require('child_process');

let whisperProcess = null;

// Start persistent Python Whisper server (Only if enabled)
function startWhisperDaemon() {
  if (process.env.ENABLE_WHISPER !== 'true') {
    console.log('Whisper AI Daemon is disabled (ENABLE_WHISPER is not true). Skipping...');
    return;
  }

  const pythonPath = 'python';
  const scriptPath = path.join(__dirname, 'utils/whisper_server.py');
  
  whisperProcess = spawn(pythonPath, [scriptPath]);
  
  whisperProcess.stdout.on('data', (data) => console.log(`[Whisper Daemon]: ${data.toString().trim()}`));
  whisperProcess.stderr.on('data', (data) => console.error(`[Whisper Error]: ${data.toString().trim()}`));
  
  // Keep it alive if it crashes suddenly 
  whisperProcess.on('close', (code) => {
    console.log(`Whisper daemon exited with code ${code}. Restarting in 2 seconds...`);
    setTimeout(startWhisperDaemon, 2000);
  });
}

// Start it now
startWhisperDaemon();

// MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    server.listen(process.env.PORT || 5000, '0.0.0.0', () => {
      console.log(`Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });