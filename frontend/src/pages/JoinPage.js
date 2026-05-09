import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../utils/api';

export default function JoinPage() {
  const { code } = useParams(); // if coming from QR code
  const entryToken = sessionStorage.getItem('sessionEntryToken');
  const scannedCode = sessionStorage.getItem('scannedSessionCode');

  const [form, setForm] = useState({
    name: '',
    sessionCode: scannedCode || code || '',
    role: 'student',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name: form.name,
        role: form.role,
      };

      if (entryToken) {
        payload.sessionEntryToken = entryToken;
      } else {
        payload.sessionCode = form.sessionCode.toUpperCase();
      }

      const res = await api.post('/sessions/join', payload);

      // Save participant info in localStorage
      localStorage.setItem('participant', JSON.stringify({
        participantId: res.data.participantId,
        participantName: res.data.participantName,
        sessionId: res.data.sessionId,
        sessionCode: res.data.sessionCode,
        role: form.role,
      }));

      navigate(`/session/${res.data.sessionId}/participant`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not join session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080C14] flex items-center justify-center px-4 relative overflow-hidden">

      <div className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'linear-gradient(#1E2D45 1px, transparent 1px), linear-gradient(90deg, #1E2D45 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />
      <div className="absolute top-0 left-0 w-96 h-96 rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, #7C3AED, transparent)' }} />

      <div className="relative z-10 w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #00D4FF)' }}>
            <span className="text-2xl">🎙</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-wide">
            M<span className="text-[#00D4FF]">SCS</span>
          </h1>
          <p className="text-[#4A5568] text-sm mt-1">Join a seminar session</p>
        </div>

        {/* Card */}
        <div className="bg-[#0D1220] border border-[#1E2D45] rounded-2xl p-8">
          <h2 className="text-xl font-bold text-white mb-1">
            {entryToken ? 'You are almost in!' : 'Join Session'}
          </h2>
          <p className="text-[#4A5568] text-sm mb-6">
            {entryToken 
              ? `You scanned the QR Code for ${scannedCode}. Enter your name to join.` 
              : 'Enter the session code shared by your presenter'
            }
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label className="text-xs font-bold text-[#4A5568] uppercase tracking-widest block mb-2">
                Your Name
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Ali Hassan"
                required
                className="w-full bg-[#111827] border border-[#1E2D45] text-white placeholder-[#4A5568] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED] transition-all"
              />
            </div>

            {!entryToken && (
              <div>
                <label className="text-xs font-bold text-[#4A5568] uppercase tracking-widest block mb-2">
                  Session Code
                </label>
                <input
                  type="text"
                  name="sessionCode"
                  value={form.sessionCode}
                  onChange={handleChange}
                  placeholder="SEM-4829"
                  required={!entryToken}
                  className="w-full bg-[#111827] border border-[#1E2D45] text-white placeholder-[#4A5568] rounded-xl px-4 py-3 text-sm font-mono tracking-widest uppercase focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED] transition-all"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-[#4A5568] uppercase tracking-widest block mb-2">
                I am a
              </label>
              <div className="grid grid-cols-2 gap-3">
                {['student', 'teacher'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm({ ...form, role: r })}
                    className={`py-2.5 rounded-xl text-sm font-bold transition-all border ${
                      form.role === r
                        ? 'bg-[#7C3AED]/20 border-[#7C3AED] text-[#A78BFA]'
                        : 'bg-[#111827] border-[#1E2D45] text-[#4A5568] hover:border-[#4A5568]'
                    }`}
                  >
                    {r === 'student' ? '🎓 Student' : '👨‍🏫 Teacher'}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm tracking-wide transition-all duration-200 mt-2"
              style={{
                background: loading ? '#1E2D45' : 'linear-gradient(135deg, #7C3AED, #5B21B6)',
                color: loading ? '#4A5568' : '#ffffff',
              }}
            >
              {loading ? 'Joining...' : 'Join Session →'}
            </button>
          </form>

        </div>

        <p className="text-center text-[#4A5568] text-sm mt-4">
          Presenter?{' '}
          <a href="/login" className="text-[#00D4FF] font-bold hover:underline">
            Sign in here
          </a>
        </p>

      </div>
    </div>
  );
}
