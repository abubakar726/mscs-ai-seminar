# 🎙 MSCS — AI-Powered Seminar Platform (SaaS)

A real-time, multi-tenant SaaS platform for university seminars — featuring **AI transcription**, **dynamic anti-cheat QR attendance**, **WebRTC audio streaming**, and a **Super Admin panel** to manage university clients and subscriptions.

---

## ✨ Features

### For Universities (Clients)
- 🔐 **Invite-Only Registration** — Presenters can only sign up with a unique invite code + official university email domain.
- 🎙 **Live Transcription** — Real-time speech-to-text powered by local Whisper AI model.
- 📡 **WebRTC Audio Streaming** — Presenter hears all student audio relayed in real-time.
- 📋 **Q&A Queue Management** — Students raise hands; presenter manages the queue live.
- 💾 **AI Session Insights** — Auto-generated session summaries and downloadable transcripts.

### Anti-Cheat Attendance
- 📱 **Dynamic Rotating QR Codes** — QR tokens rotate every 15 seconds. Students must be physically present to scan and join.
- 🚫 **No Remote Join** — Manual session code entry is disabled for students.

### For Super Admin (You — The Platform Owner)
- 👑 **Super Admin Dashboard** — Manage all university clients from one panel.
- 🏫 **Client Onboarding** — Create a university, set license limits, auto-generate invite codes.
- ✅ / 🔴 **Subscription Control** — Instantly activate or suspend any university's access.
- 🎫 **Support Tickets** — View all support requests from presenters.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js |
| Backend | Node.js + Express.js |
| Real-time | Socket.IO |
| Database | MongoDB + Mongoose |
| AI Transcription | Python (Whisper `base.en`) |
| Audio Streaming | WebRTC |

---

## 🚀 Local Setup

### Prerequisites
- Node.js v18+
- Python 3.8+ with `whisper` installed (`pip install openai-whisper`)
- MongoDB (local or Atlas)

### Backend
```bash
cd mscs/backend
cp .env.example .env
# Fill in MONGO_URI and JWT_SECRET in .env
npm install
npm run dev
```

### Frontend
```bash
cd mscs/frontend
npm install
npm start
```

### Create Your Super Admin Account
```bash
curl -X POST http://localhost:5000/api/auth/setup-admin \
  -H "Content-Type: application/json" \
  -d '{"name": "Your Name", "email": "admin@example.com", "password": "securepassword"}'
```
> ⚠️ This endpoint locks itself after the first successful call.

---

## 🌐 Deployment

### Frontend (Vercel — Free)
1. Set `REACT_APP_API_URL` environment variable to your backend tunnel URL.
2. Deploy the `mscs/frontend` folder to [vercel.com](https://vercel.com).

### Backend (Local + Cloudflare/LocalTunnel — Free)
```bash
npx localtunnel --port 5000
```
Use the generated URL as your `REACT_APP_API_URL` in Vercel.

---

## 📋 Subscription Plans (For Universities)

| Plan | Price | Presenters | Features |
|------|-------|-----------|---------|
| Department Pilot | $199/month | Up to 10 | Core features |
| Campus Plus | $499/month | Up to 50 | + AI Insights, Priority Support |
| Enterprise | Custom | Unlimited | + SLA, Dedicated Support |

---

## 📁 Project Structure

```
mscs/
├── backend/
│   ├── src/
│   │   ├── controllers/   # Auth, Sessions, Admin, Support
│   │   ├── models/        # User, Session, Organization, SupportTicket
│   │   ├── routes/        # API route definitions
│   │   ├── middleware/     # Auth, Admin-only guards
│   │   └── server.js
│   └── whisper_server.py  # Python AI transcription daemon
└── frontend/
    └── src/
        ├── pages/         # All page components
        ├── hooks/         # WebRTC, Transcription hooks
        ├── context/       # Auth context
        └── utils/         # API client
```
