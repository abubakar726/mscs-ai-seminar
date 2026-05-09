const Session = require('../models/session.model');
const { calculateScore, getNextSpeaker } = require('../utils/score.util');
const { generateSummary } = require('../utils/ai.util');

const initSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('joinRoom', async ({ sessionId, participantId, name, role }) => {
      socket.join(sessionId);
      socket.data.sessionId = sessionId;
      socket.data.participantId = String(participantId);
      socket.data.name = name;
      socket.data.role = role;
      console.log(`${name} joined room ${sessionId} as ${role} | socketId: ${socket.id}`);
      try {
        await Session.findOneAndUpdate(
          { _id: sessionId, 'participants._id': participantId },
          { $set: { 'participants.$.socketId': socket.id, 'participants.$.isOnline': true } }
        );
      } catch (e) {}
      const session = await Session.findById(sessionId);
      if (!session) return;
      socket.emit('sessionState', { status: session.status, mode: session.mode, queue: session.queue, participants: session.participants, textQuestions: session.textQuestions || [] });
      io.to(sessionId).emit('participantJoined', { participantId, name, role, participants: session.participants });
    });

    socket.on('startSession', async ({ sessionId }) => {
      await Session.findByIdAndUpdate(sessionId, { status: 'active', mode: 'speaking', startedAt: new Date() });
      io.to(sessionId).emit('sessionStarted', { status: 'active', mode: 'speaking' });
      io.to(sessionId).emit('presenterMicOn', { message: 'Presenter is speaking' });
    });

    socket.on('openQA', async ({ sessionId }) => {
      await Session.findByIdAndUpdate(sessionId, { mode: 'qa', status: 'qa' });
      io.to(sessionId).emit('modeChanged', { mode: 'qa' });
      io.to(sessionId).emit('qaOpened', { message: 'Q&A is now open — tap to request!' });
    });

    socket.on('requestToSpeak', async ({ sessionId, participantId, participantName, role, speakCount }) => {
      const session = await Session.findById(sessionId);
      if (!session || session.mode !== 'qa') return;
      const alreadyInQueue = session.queue.find(
        (e) => String(e.participantId) === String(participantId) && (e.status === 'waiting' || e.status === 'active')
      );
      if (alreadyInQueue) { socket.emit('requestError', { message: 'You are already in the queue' }); return; }
      const score = calculateScore({ speakCount: speakCount || 0, role: role || 'student' });
      session.queue.push({ participantId: String(participantId), participantName, role: role || 'student', speakCount: speakCount || 0, priorityScore: score, status: 'waiting', requestedAt: new Date() });
      await session.save();
      const waitingQueue = session.queue.filter((e) => e.status === 'waiting').sort((a, b) => b.priorityScore - a.priorityScore || new Date(a.requestedAt) - new Date(b.requestedAt));
      const position = waitingQueue.findIndex((e) => String(e.participantId) === String(participantId)) + 1;
      socket.emit('queuePosition', { position, score, message: `You are #${position} in queue` });
      io.to(sessionId).emit('queueUpdated', { queue: waitingQueue });
      const activeSpeaker = session.queue.find(e => e.status === 'active');
      
      if (!activeSpeaker && waitingQueue.length > 0 && String(waitingQueue[0].participantId) === String(participantId)) { 
        await grantSpeaker(io, sessionId, String(participantId)); 
      }
    });

    socket.on('speakingDone', async ({ sessionId, participantId }) => {
      const session = await Session.findById(sessionId);
      if (!session) return;
      session.queue.forEach((e) => { if (String(e.participantId) === String(participantId) && e.status === 'active') e.status = 'done'; });
      await session.save();
      console.log(`${participantId} done speaking`);
      const waitingCount = session.queue.filter(e => e.status === 'waiting').length;
      io.to(sessionId).emit('presenterMicOn', { message: 'Student done — presenter can respond', waitingCount });
      io.to(sessionId).emit('studentDone', { participantId: String(participantId), waitingCount });
    });

    socket.on('nextQuestion', async ({ sessionId }) => {
      const session = await Session.findById(sessionId);
      if (!session) return;
      session.queue.forEach((e) => { if (e.status === 'active') e.status = 'done'; });
      await session.save();
      const next = getNextSpeaker(session.queue);
      if (next) {
        await grantSpeaker(io, sessionId, String(next.participantId));
      } else {
        io.to(sessionId).emit('queueEmpty', { message: 'No more questions in queue' });
        io.to(sessionId).emit('presenterMicOn', { message: 'Queue empty — presenter speaking' });
      }
    });

    socket.on('interrupt', async ({ sessionId }) => {
      const session = await Session.findById(sessionId);
      if (!session) return;
      session.queue.forEach((e) => { if (e.status === 'active') e.status = 'done'; });
      await session.save();
      io.to(sessionId).emit('interrupted', { message: 'Presenter interrupted' });
      io.to(sessionId).emit('presenterMicOn', { message: 'Presenter took over' });
    });

    socket.on('closeQA', async ({ sessionId }) => {
      await Session.findByIdAndUpdate(sessionId, { mode: 'speaking', status: 'active', queue: [] });
      io.to(sessionId).emit('modeChanged', { mode: 'speaking' });
      io.to(sessionId).emit('qaClosed', { message: 'Q&A closed' });
      io.to(sessionId).emit('presenterMicOn', { message: 'Back to presentation' });
    });

    socket.on('emergencyStop', async ({ sessionId }) => {
      await Session.findByIdAndUpdate(sessionId, { mode: 'speaking', status: 'active', queue: [] });
      io.to(sessionId).emit('emergencyStop', { message: 'Emergency stop — all muted' });
      io.to(sessionId).emit('presenterMicOn', { message: 'Emergency stop' });
    });

    socket.on('transcriptSegment', async ({ sessionId, speakerName, speakerRole, text }) => {
      await Session.findByIdAndUpdate(sessionId, { $push: { transcript: { speakerName, speakerRole, text, timestamp: new Date() } } });
      io.to(sessionId).emit('transcriptUpdated', { speakerName, speakerRole, text });
    });

    socket.on('interimTranscript', ({ sessionId, speakerName, speakerRole, text }) => {
      io.to(sessionId).emit('interimTranscriptUpdated', { speakerName, speakerRole, text });
    });

    socket.on('studentMuteToggle', ({ sessionId, participantName, isMuted }) => {
      io.to(sessionId).emit('studentMuteToggled', { participantName, isMuted });
    });

    socket.on('submitTextQuestion', async ({ sessionId, participantName, text }) => {
      const q = { participantName, text, timestamp: new Date() };
      await Session.findByIdAndUpdate(sessionId, { $push: { textQuestions: q } });
      io.to(sessionId).emit('textQuestionReceived', q);
    });

    socket.on('endSession', async ({ sessionId }) => {
      const session = await Session.findByIdAndUpdate(sessionId, { status: 'ended', endedAt: new Date() }, { new: true });
      
      if (session) {
        const summary = await generateSummary(session.transcript || []);
        session.summary = summary;
        await session.save();
      }
      
      io.to(sessionId).emit('sessionEnded', { message: 'Session ended', transcript: session?.transcript, summary: session?.summary });
    });

    // ─── WebRTC SIGNALING ────────────────────────────────
    socket.on('signal', ({ sessionId, to, data }) => {
      console.log('SIGNAL:', socket.data.role, '->', to, '|', data?.type, '| from:', socket.data.name);
      if (to === 'presenter') {
        const presenterSocket = findPresenterSocket(io, sessionId);
        if (presenterSocket) {
          console.log('Forwarding to presenter:', presenterSocket.id);
          presenterSocket.emit('signal', { from: socket.id, fromName: socket.data.name, data });
        } else {
          console.log('NO PRESENTER FOUND!');
        }
      } else if (to === 'student') {
        const targetSocket = data?.targetId ? io.sockets.sockets.get(data.targetId) : null;
        if (targetSocket) {
          targetSocket.emit('signal', { from: socket.id, data });
        } else {
          console.log('Student socket NOT FOUND:', data?.targetId);
        }
      }
    });

    // ─── DISCONNECT ──────────────────────────────────────
    socket.on('disconnect', async () => {
      const { sessionId, participantId } = socket.data || {};
      if (!sessionId || !participantId) return;
      try {
        await Session.findOneAndUpdate(
          { _id: sessionId, 'participants._id': participantId },
          { $set: { 'participants.$.isOnline': false } }
        );
        io.to(sessionId).emit('participantLeft', { participantId });
      } catch (e) {}
    });
  });
};

async function grantSpeaker(io, sessionId, participantId) {
  const session = await Session.findById(sessionId);
  if (!session) return;
  const entry = session.queue.find(e => String(e.participantId) === String(participantId) && e.status === 'waiting');
  if (!entry) return;
  entry.status = 'active';
  await session.save();
  console.log(`Granting: ${entry.participantName} | participantId: ${participantId}`);
  const grantedSocket = findSocketByParticipantId(io, sessionId, participantId);
  if (grantedSocket) {
    console.log(`Found socket: ${grantedSocket.id}`);
    grantedSocket.emit('youAreGranted', { timeLimit: 60 });
  } else {
    console.log(`Socket not found — fallback broadcast`);
    io.to(sessionId).emit('grantedTo', { participantId, timeLimit: 60 });
  }
  const remaining = session.queue.filter(e => e.status === 'waiting');
  io.to(sessionId).emit('speakerGranted', { participantId, participantName: entry.participantName, queue: remaining });
}

function findSocketByParticipantId(io, sessionId, participantId) {
  const room = io.sockets.adapter.rooms.get(sessionId);
  if (!room) return null;
  for (const socketId of room) {
    const s = io.sockets.sockets.get(socketId);
    if (s && String(s.data?.participantId) === String(participantId)) return s;
  }
  return null;
}

function findPresenterSocket(io, sessionId) {
  const room = io.sockets.adapter.rooms.get(sessionId);
  if (!room) return null;
  for (const socketId of room) {
    const s = io.sockets.sockets.get(socketId);
    if (s && s.data?.role === 'presenter') return s;
  }
  return null;
}

module.exports = initSocket;