import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };
 
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080C14] flex items-center justify-center px-4 relative overflow-hidden">

      {/* Background grid */}
      <div className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'linear-gradient(#1E2D45 1px, transparent 1px), linear-gradient(90deg, #1E2D45 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      {/* Glow orbs */}
      <div className="absolute top-0 left-0 w-96 h-96 rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, #00D4FF, transparent)' }} />
      <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, #7C3AED, transparent)' }} />

      <div className="relative z-10 w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #00D4FF, #7C3AED)' }}>
            <span className="text-2xl">🎙</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-wide">
            M<span className="text-[#00D4FF]">SCS</span>
          </h1>
          <p className="text-[#4A5568] text-sm mt-1">Modern Seminar Communication System</p>
        </div>

        {/* Card */}
        <div className="bg-[#0D1220] border border-[#1E2D45] rounded-2xl p-8">
          <h2 className="text-xl font-bold text-white mb-1">Welcome back</h2>
          <p className="text-[#4A5568] text-sm mb-6">Sign in to your presenter account</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[#4A5568] uppercase tracking-widest block mb-2">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
                className="w-full bg-[#111827] border border-[#1E2D45] text-white placeholder-[#4A5568] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF] transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#4A5568] uppercase tracking-widest block mb-2">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
                className="w-full bg-[#111827] border border-[#1E2D45] text-white placeholder-[#4A5568] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF] transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm tracking-wide transition-all duration-200 disabled:opacity-50"
              style={{
                background: loading ? '#1E2D45' : 'linear-gradient(135deg, #00D4FF, #0099BB)',
                color: loading ? '#4A5568' : '#080C14',
              }}
            >
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>

          <p className="text-center text-[#4A5568] text-sm mt-6">
            No account?{' '}
            <Link to="/register" className="text-[#00D4FF] font-bold hover:underline">
              Register here
            </Link>
          </p>
        </div>

        {/* Join session link */}
        <p className="text-center text-[#4A5568] text-sm mt-4">
          Student?{' '}
          <Link to="/join" className="text-[#7C3AED] font-bold hover:underline">
            Join a session →
          </Link>
        </p>

      </div>
    </div>
  );
}
