const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  userId: { type: String },              // optional - if logged in
  name: { type: String, required: true },
  role: {
    type: String,
    enum: ['student', 'teacher', 'presenter'],
    default: 'student',
  },
  socketId: { type: String },
  speakCount: { type: Number, default: 0 },  // how many times spoken — for score
  joinedAt: { type: Date, default: Date.now },
  isOnline: { type: Boolean, default: true },
});

const queueEntrySchema = new mongoose.Schema({
  participantId: { type: String, required: true },
  participantName: { type: String, required: true },
  role: { type: String, default: 'student' },
  speakCount: { type: Number, default: 0 },
  priorityScore: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['waiting', 'active', 'done', 'skipped'],
    default: 'waiting',
  },
  requestedAt: { type: Date, default: Date.now },
});

const sessionSchema = new mongoose.Schema(
  {
    title: { type: String, default: 'Seminar Session' },
    presenterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    presenterName: { type: String, required: true },
    sessionCode: { type: String, required: true, unique: true },
    qrCode: { type: String },           // base64 QR image
    status: {
      type: String,
      enum: ['waiting', 'active', 'qa', 'ended'],
      default: 'waiting',
    },
    mode: {
      type: String,
      enum: ['speaking', 'qa'],
      default: 'speaking',
    },
    participants: [participantSchema],
    queue: [queueEntrySchema],
    transcript: [
      {
        speakerName: String,
        speakerRole: String,
        text: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
    startedAt: { type: Date },
    endedAt: { type: Date },
    summary: { type: String },
    textQuestions: [
      {
        participantName: String,
        text: String,
        timestamp: { type: Date, default: Date.now }
      }
    ],
    currentQrToken: { type: String },
    qrTokenExpiresAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Session', sessionSchema);
