import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [newSession, setNewSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewQR, setViewQR] = useState(null);
  const [viewSummary, setViewSummary] = useState(null);

  const downloadTranscript = (session) => {
    if (!session || !session.transcript) return;
    const text = session.transcript.map(t => `[${new Date(t.timestamp).toLocaleTimeString()}] ${t.speakerName} (${t.speakerRole}): ${t.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Session-Notes-${session.sessionCode}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => { fetchSessions(); }, []);

  const fetchSessions = async () => {
    try {
      const res = await api.get('/sessions/my');
      setSessions(res.data.sessions);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleCreateSession = async () => {
    setCreating(true);
    try {
      const res = await api.post('/sessions/create', { 
        title: sessionTitle || 'Seminar Session',
        baseUrl: window.location.origin
      });
      setNewSession(res.data.session);
      setShowCreateModal(false);
      setSessionTitle('');
      fetchSessions();
    } catch (err) { console.error(err); }
    finally { setCreating(false); }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const getGreeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  };

  const statusBadge = (status) => {
    const map = {
      active: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
      qa:     'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
      ended:  'bg-slate-400/10  text-slate-400  border-slate-400/20',
      waiting:'bg-cyan-400/10   text-cyan-400   border-cyan-400/20',
    };
    return map[status] || map.waiting;
  };

  const fmt = (d) => new Date(d).toLocaleDateString('en-US', {
    month:'short', day:'numeric', year:'numeric'
  });

  return (
    <div className="min-h-screen bg-[#07090F]">

      {/* subtle grid */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage:'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)',
        backgroundSize:'48px 48px'
      }}/>
      {/* glow */}
      <div className="fixed top-0 left-0 w-[600px] h-[600px] pointer-events-none"
        style={{background:'radial-gradient(ellipse at top left,rgba(0,212,255,0.06),transparent 65%)'}}/>
      <div className="fixed bottom-0 right-0 w-[600px] h-[600px] pointer-events-none"
        style={{background:'radial-gradient(ellipse at bottom right,rgba(124,58,237,0.06),transparent 65%)'}}/>

      {/* ─── NAVBAR ─── */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06]"
        style={{background:'rgba(7,9,15,0.85)',backdropFilter:'blur(20px)'}}>
        <div className="max-w-6xl mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-lg shadow-cyan-500/20"
              style={{background:'linear-gradient(135deg,#00D4FF,#7C3AED)'}}>🎙</div>
            <span className="text-white font-black text-xl tracking-tight">
              M<span style={{color:'#00D4FF'}}>SCS</span>
            </span>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-right hidden sm:block">
              <div className="text-white text-sm font-semibold">{user?.name}</div>
              <div className="text-slate-500 text-xs mt-0.5">{user?.email}</div>
            </div>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white shadow-lg shadow-purple-500/20"
              style={{background:'linear-gradient(135deg,#00D4FF,#7C3AED)'}}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            {user?.role === 'admin' && (
              <button onClick={() => navigate('/admin')}
                className="text-orange-400 hover:text-orange-300 text-sm font-bold transition-all px-3 py-1.5 rounded-lg hover:bg-orange-500/10 border border-orange-500/20 hover:border-orange-500/30">
                Admin Panel 👑
              </button>
            )}
            <button onClick={handleLogout}
              className="text-slate-500 hover:text-red-400 text-sm font-semibold transition-all px-3 py-1.5 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/20">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-8 py-10 relative z-10">

        {/* ─── HEADER ─── */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="text-[28px] font-black text-white leading-tight tracking-tight">
              {getGreeting()}, <span style={{color:'#00D4FF'}}>{user?.name?.split(' ')[0]}</span> 👋
            </h1>
            <p className="text-slate-500 text-sm mt-2 font-medium">Manage and monitor your seminar sessions</p>
          </div>
          <button onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm shadow-lg shadow-cyan-500/20 transition-all hover:scale-105 active:scale-95"
            style={{background:'linear-gradient(135deg,#00D4FF,#0099BB)',color:'#07090F'}}>
            <span className="text-base font-black">+</span> New Session
          </button>
        </div>

        {/* ─── STAT CARDS ─── */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label:'Total Sessions', value:sessions.length, color:'#00D4FF', icon:'📋' },
            { label:'Active Now', value:sessions.filter(s=>s.status==='active'||s.status==='qa').length, color:'#00FF87', icon:'🟢' },
            { label:'Completed', value:sessions.filter(s=>s.status==='ended').length, color:'#A78BFA', icon:'✅' },
          ].map(s=>(
            <div key={s.label} className="rounded-2xl p-6 border transition-all hover:border-white/10"
              style={{background:'rgba(255,255,255,0.03)',borderColor:'rgba(255,255,255,0.06)'}}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xl">{s.icon}</span>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{s.label}</span>
              </div>
              <div className="text-5xl font-black leading-none" style={{color:s.color}}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ─── NEW SESSION CARD ─── */}
        {newSession && (
          <div className="relative rounded-2xl p-6 mb-8 overflow-hidden border border-cyan-500/15"
            style={{background:'rgba(0,212,255,0.04)'}}>
            <div className="absolute top-0 left-0 right-0 h-px"
              style={{background:'linear-gradient(90deg,transparent,#00D4FF,transparent)'}}/>
            <div className="flex flex-col md:flex-row items-center gap-8">
              {newSession.qrCode && (
                <div className="flex-shrink-0 p-3 rounded-2xl border border-white/10 shadow-2xl"
                  style={{background:'#07090F'}}>
                  <img src={newSession.qrCode} alt="QR" className="w-36 h-36 rounded-xl"/>
                </div>
              )}
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center gap-2 mb-3 justify-center md:justify-start">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Session Ready</span>
                </div>
                <h3 className="text-2xl font-black text-white mb-3">{newSession.title}</h3>
                <div className="inline-flex items-center gap-3 rounded-xl px-4 py-2.5 mb-4 border border-white/10"
                  style={{background:'rgba(0,0,0,0.4)'}}>
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Code</span>
                  <span className="font-mono font-black text-2xl tracking-[0.25em]" style={{color:'#00D4FF'}}>
                    {newSession.sessionCode}
                  </span>
                </div>
                <p className="text-slate-500 text-sm font-medium mb-5">
                  Share this code or let students scan the QR to join instantly
                </p>
                <div className="flex gap-3 justify-center md:justify-start flex-wrap">
                  <button onClick={() => navigate(`/session/${newSession._id}/presenter`)}
                    className="px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
                    style={{background:'linear-gradient(135deg,#00FF87,#00CC6A)',color:'#07090F'}}>
                    Start Session →
                  </button>
                  <button onClick={() => setNewSession(null)}
                    className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-400 border border-white/10 hover:border-white/20 hover:text-white transition-all">
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── SESSIONS LIST ─── */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Your Sessions</h2>
            <span className="text-xs text-slate-600 font-medium">{sessions.length} total</span>
          </div>

          {loading ? (
            <div className="text-center py-16 text-slate-600 text-sm font-medium animate-pulse">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="rounded-2xl p-16 text-center border border-dashed border-white/10"
              style={{background:'rgba(255,255,255,0.02)'}}>
              <div className="text-5xl mb-4">🎙</div>
              <div className="text-white font-bold text-lg mb-2">No sessions yet</div>
              <div className="text-slate-500 text-sm mb-6 font-medium">Create your first session to get started</div>
              <button onClick={() => setShowCreateModal(true)}
                className="px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all hover:scale-105"
                style={{background:'linear-gradient(135deg,#00D4FF,#0099BB)',color:'#07090F'}}>
                + Create Session
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sessions.map(session => (
                <div key={session._id}
                  onClick={() => session.status !== 'ended' && navigate(`/session/${session._id}/presenter`)}
                  className={`group rounded-2xl px-6 py-4 flex items-center justify-between border transition-all ${session.status !== 'ended' ? 'cursor-pointer hover:border-white/10' : ''}`}
                  style={{background:'rgba(255,255,255,0.03)',borderColor:'rgba(255,255,255,0.06)'}}>

                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl border border-white/10 flex items-center justify-center text-xl flex-shrink-0"
                      style={{background:'rgba(255,255,255,0.05)'}}>🎙</div>
                    <div>
                      <div className="text-white font-bold text-base leading-tight">{session.title}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="font-mono text-xs font-bold tracking-wider" style={{color:'#00D4FF'}}>
                          {session.sessionCode}
                        </span>
                        <span className="text-white/10">·</span>
                        <span className="text-xs text-slate-500 font-medium">{fmt(session.createdAt)}</span>
                        <span className="text-white/10">·</span>
                        <span className="text-xs text-slate-500 font-medium">
                          {session.participants?.length || 0} participants
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full border capitalize ${statusBadge(session.status)}`}>
                      {session.status}
                    </span>
                    {/* QR Button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setViewQR(session); }}
                      className="text-xs font-bold text-slate-500 hover:text-cyan-400 transition-all opacity-0 group-hover:opacity-100 px-2 py-1.5 rounded-lg hover:bg-cyan-400/10 border border-transparent hover:border-cyan-400/20">
                      QR
                    </button>
                    {session.status !== 'ended' ? (
                      <span className="text-xs font-bold text-cyan-400 opacity-0 group-hover:opacity-100 transition-all">
                        Open →
                      </span>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); setViewSummary(session); }}
                          className="text-xs font-bold text-purple-400 opacity-0 group-hover:opacity-100 transition-all px-2 py-1.5 rounded-lg hover:bg-purple-400/10 border border-transparent hover:border-purple-400/20">
                          ✨ Session Insights
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); downloadTranscript(session); }}
                          className="text-xs font-bold text-blue-400 opacity-0 group-hover:opacity-100 transition-all px-2 py-1.5 rounded-lg hover:bg-blue-400/10 border border-transparent hover:border-blue-400/20">
                          📥 Download Notes
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── QR MODAL ─── */}
      {viewQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{background:'rgba(0,0,0,0.85)',backdropFilter:'blur(20px)'}}
          onClick={() => setViewQR(null)}>
          <div className="rounded-2xl p-8 w-full max-w-sm border border-white/10 text-center shadow-2xl"
            style={{background:'#0D1220'}}
            onClick={e => e.stopPropagation()}>

            {/* Top glow line */}
            <div className="h-px w-full mb-6 rounded"
              style={{background:'linear-gradient(90deg,transparent,#00D4FF,transparent)'}}/>

            <h3 className="text-xl font-black text-white mb-1">{viewQR.title}</h3>
            <p className="text-slate-500 text-sm font-medium mb-6">Scan to join session</p>

            {viewQR.qrCode ? (
              <div className="inline-block p-4 rounded-2xl border border-white/10 mb-6"
                style={{background:'#07090F'}}>
                <img src={viewQR.qrCode} alt="QR" className="w-48 h-48 rounded-xl"/>
              </div>
            ) : (
              <div className="w-48 h-48 rounded-2xl border border-white/10 flex items-center justify-center mx-auto mb-6 text-slate-600 text-sm"
                style={{background:'#07090F'}}>
                No QR available
              </div>
            )}

            <div className="inline-flex items-center gap-3 rounded-xl px-5 py-3 mb-6 border border-white/10"
              style={{background:'rgba(0,0,0,0.5)'}}>
              <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Code</span>
              <span className="font-mono font-black text-2xl tracking-[0.25em]" style={{color:'#00D4FF'}}>
                {viewQR.sessionCode}
              </span>
            </div>

            <div className="flex gap-3 justify-center">
              {viewQR.status !== 'ended' && (
                <button
                  onClick={() => { setViewQR(null); navigate(`/session/${viewQR._id}/presenter`); }}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all hover:scale-105"
                  style={{background:'linear-gradient(135deg,#00D4FF,#0099BB)',color:'#07090F'}}>
                  Open Session →
                </button>
              )}
              <button onClick={() => setViewQR(null)}
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-400 border border-white/10 hover:border-white/20 hover:text-white transition-all">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── AI SUMMARY MODAL ─── */}
      {viewSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{background:'rgba(0,0,0,0.85)',backdropFilter:'blur(20px)'}}
          onClick={() => setViewSummary(null)}>
          <div className="rounded-2xl p-8 w-full max-w-2xl border border-white/10 shadow-2xl overflow-y-auto max-h-[85vh]"
            style={{background:'#0D1220'}}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
               <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-purple-500/20"
                 style={{background:'linear-gradient(135deg,#7C3AED,#C084FC)'}}>✨</div>
               <div>
                  <h3 className="text-xl font-black text-white">{viewSummary.title} — Session Insights</h3>
                  <div className="text-sm font-medium text-purple-400">Comprehensive overview and summary</div>
               </div>
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Attendees ({viewSummary.participants?.length || 0})</h4>
              {viewSummary.participants?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {viewSummary.participants.map(p => (
                    <span key={p._id} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300">
                      {p.name} <span className="text-slate-500 ml-1">({p.role})</span>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500 italic">No attendees recorded.</div>
              )}
            </div>
            
            <div>
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 border-t border-white/10 pt-4">AI Summary</h4>
              {viewSummary.summary ? (
                <div className="prose prose-invert max-w-none text-sm text-slate-300 bg-black/20 p-4 rounded-xl border border-white/5">
                   <div className="whitespace-pre-wrap">{viewSummary.summary}</div>
                </div>
              ) : (
                <div className="text-center py-6 bg-black/20 rounded-xl border border-white/5">
                   <div className="text-slate-500 font-medium">No AI summary is available for this session yet.</div>
                   <div className="text-xs text-slate-600 mt-2">Only sessions ended after this feature was introduced are summarized.</div>
                </div>
              )}
            </div>
            
            <div className="mt-8 flex justify-end">
              <button onClick={() => setViewSummary(null)}
                className="px-6 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg transition-all hover:scale-105"
                style={{background:'linear-gradient(135deg,#7C3AED,#C084FC)'}}>
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CREATE MODAL ─── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{background:'rgba(0,0,0,0.75)',backdropFilter:'blur(16px)'}}>
          <div className="rounded-2xl p-8 w-full max-w-md border border-white/10 shadow-2xl"
            style={{background:'#0D1220'}}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                style={{background:'linear-gradient(135deg,#00D4FF,#7C3AED)'}}>🎙</div>
              <h3 className="text-xl font-black text-white">New Session</h3>
            </div>
            <p className="text-slate-500 text-sm font-medium mb-6">
              A unique session code and QR will be auto-generated
            </p>
            <div className="mb-6">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">
                Session Title (Optional)
              </label>
              <input type="text" value={sessionTitle}
                onChange={e => setSessionTitle(e.target.value)}
                placeholder="e.g. Machine Learning — Week 5"
                onKeyDown={e => e.key === 'Enter' && handleCreateSession()}
                autoFocus
                className="w-full rounded-xl px-4 py-3 text-sm font-medium text-white placeholder-slate-600 border border-white/10 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                style={{background:'rgba(0,0,0,0.4)'}}/>
            </div>
            <div className="flex gap-3">
              <button onClick={handleCreateSession} disabled={creating}
                className="flex-1 py-3 rounded-xl font-bold text-sm disabled:opacity-50 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-cyan-500/20"
                style={{background:'linear-gradient(135deg,#00D4FF,#0099BB)',color:'#07090F'}}>
                {creating ? 'Creating...' : 'Create Session →'}
              </button>
              <button onClick={() => { setShowCreateModal(false); setSessionTitle(''); }}
                className="px-5 py-3 rounded-xl font-bold text-sm text-slate-400 border border-white/10 hover:border-white/20 hover:text-white transition-all">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}