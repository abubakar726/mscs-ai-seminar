import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { usePresenterWebRTC } from '../hooks/useWebRTC';
import useTranscription from '../hooks/useTranscription';
import RemoteTranscriber from '../components/RemoteTranscriber';
import { QRCodeSVG } from 'qrcode.react';

const SOCKET_URL = process.env.REACT_APP_API_URL || '/';

export default function PresenterSessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const socketRef = useRef(null);
  const { setupReceiver, closeAll, initSelfMic, toggleMute, presenterMuted, remoteStream, getMixedStream } = usePresenterWebRTC();
  const [micEnabled, setMicEnabled] = useState(false);

  const [session, setSession] = useState(null);
  const [mode, setMode] = useState('speaking'); // 'speaking' | 'qa'
  const [queue, setQueue] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [transcript, setTranscript] = useState([]);
  const [textQuestions, setTextQuestions] = useState([]);
  const [activeInterims, setActiveInterims] = useState({});
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionStatus, setSessionStatus] = useState('active');
  const [finalSummary, setFinalSummary] = useState(null);
  const [dynamicQrToken, setDynamicQrToken] = useState('');
  const transcriptEndRef = useRef(null);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // Load session
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await api.get(`/sessions/${id}`);
        const s = res.data.session;
        setSession(s);
        setMode(s.mode);
        setParticipants(s.participants || []);
        setQueue(s.queue?.filter(q => q.status === 'waiting') || []);
        setTranscript(s.transcript || []);
        if (s.textQuestions) setTextQuestions(s.textQuestions);
        if (s.status === 'active' || s.status === 'qa') setSessionStarted(true);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [id]);

  // Socket connection
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      extraHeaders: { 'bypass-tunnel-reminder': 'true' },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('joinRoom', {
        sessionId: id,
        participantId: user?._id,
        name: user?.name,
        role: 'presenter',
      });
      setupReceiver(socket, id);
    });

    socket.on('participantJoined', ({ participants }) => {
      setParticipants(participants);
    });

    socket.on('participantLeft', ({ participantId }) => {
      setParticipants(prev => prev.map(p =>
        p._id === participantId ? { ...p, isOnline: false } : p
      ));
    });

    socket.on('sessionStarted', ({ mode }) => {
      setSessionStarted(true);
      setMode(mode);
    });

    socket.on('modeChanged', ({ mode }) => setMode(mode));

    socket.on('queueUpdated', ({ queue }) => setQueue(queue));
    
    socket.on('textQuestionReceived', (q) => {
      setTextQuestions(prev => [...prev, q]);
    });

    socket.on('speakerGranted', ({ participantId, participantName, queue }) => {
      setActiveSpeaker({ participantId, participantName });
      setQueue(queue);
    });

    socket.on('queueEmpty', () => {
      setActiveSpeaker(null);
    });

    socket.on('interrupted', () => {
      setActiveSpeaker(null);
    });

    socket.on('qaClosed', () => {
      setMode('speaking');
      setQueue([]);
      setActiveSpeaker(null);
    });

    socket.on('emergencyStop', () => {
      setMode('speaking');
      setQueue([]);
      setActiveSpeaker(null);
    });

    socket.on('transcriptUpdated', ({ speakerName, speakerRole, text }) => {
      setTranscript(prev => [...prev, { speakerName, speakerRole, text, timestamp: new Date() }]);
      setActiveInterims(prev => {
        const next = { ...prev };
        delete next[speakerName];
        return next;
      });
    });

    socket.on('interimTranscriptUpdated', ({ speakerName, speakerRole, text }) => {
      setActiveInterims(prev => {
        if (text.trim() === '') {
          const next = { ...prev };
          delete next[speakerName];
          return next;
        }
        return { ...prev, [speakerName]: { speakerRole, text, timestamp: new Date() } };
      });
    });

    socket.on('studentDone', () => {
      setActiveSpeaker(null);
    });

    socket.on('studentMuteToggled', ({ participantName, isMuted }) => {
      setActiveSpeaker(prev => prev ? { ...prev, isMuted } : prev);
    });

    socket.on('sessionEnded', ({ summary }) => {
      setSessionStatus('ended');
      if (summary) setFinalSummary(summary);
      closeAll();
    });

    return () => { 
      socket.disconnect(); 
      closeAll();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user, navigate]);

  // Auto scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Handle auto-mic initialization when session starts
  useEffect(() => {
    if (sessionStarted && !micEnabled) {
      const enableAutoMic = async () => {
        const success = await initSelfMic();
        if (success) setMicEnabled(true);
      };
      // Short delay ensures DOM/socket stabilization before triggering media requests
      const timeout = setTimeout(enableAutoMic, 500); 
      return () => clearTimeout(timeout);
    }
  }, [sessionStarted, micEnabled, initSelfMic]);

  // Poll for Dynamic QR Token every 10 seconds
  useEffect(() => {
    let interval;
    if (sessionStarted && id) {
      const fetchToken = async () => {
        try {
          const res = await api.get(`/sessions/${id}/qr-token`);
          setDynamicQrToken(res.data.token);
        } catch (err) {
          console.error('Failed to fetch QR token:', err);
        }
      };
      fetchToken(); // Fetch immediately
      interval = setInterval(fetchToken, 10000); // Poll every 10s
    }
    return () => clearInterval(interval);
  }, [sessionStarted, id]);

  // Setup robust Transcription
  useTranscription({
    enabled: micEnabled && sessionStarted && !activeSpeaker,
    sessionId: id,
    speakerName: user?.name || 'Presenter',
    speakerRole: 'presenter',
    onTranscriptSegment: (data) => {
       if (socketRef.current) socketRef.current.emit('transcriptSegment', data);
    },
    onInterimTranscript: (data) => {
       if (socketRef.current) socketRef.current.emit('interimTranscript', data);
    }
  });

  // ── ACTIONS ──
  const handleStartSession = async () => {
    const success = await initSelfMic();
    if (success) setMicEnabled(true);
    socketRef.current.emit('startSession', { sessionId: id });
    setSessionStarted(true);
  };

  const handleEnableMic = async () => {
    const success = await initSelfMic();
    if (success) setMicEnabled(true);
  };

  const handleOpenQA = () => {
    socketRef.current.emit('openQA', { sessionId: id });
    setMode('qa');
  };

  const handleNextQuestion = () => {
    socketRef.current.emit('nextQuestion', { sessionId: id });
  };

  const handleInterrupt = () => {
    socketRef.current.emit('interrupt', { sessionId: id });
    setActiveSpeaker(null);
  };

  const handleCloseQA = () => {
    socketRef.current.emit('closeQA', { sessionId: id });
    setMode('speaking');
    setQueue([]);
    setActiveSpeaker(null);
  };

  const handleEmergencyStop = () => {
    if (window.confirm('Emergency Stop — mute everyone and clear queue?')) {
      socketRef.current.emit('emergencyStop', { sessionId: id });
      setMode('speaking');
      setQueue([]);
      setActiveSpeaker(null);
    }
  };

  const handleEndSession = () => {
    if (window.confirm('End this session? This cannot be undone.')) {
      if (isRecording) handleStopRecording();
      socketRef.current.emit('endSession', { sessionId: id });
    }
  };

  const handleStartRecording = () => {
    const stream = getMixedStream();
    if (!stream) {
      alert("Audio stream not ready. Please ensure your mic is enabled.");
      return;
    }
    
    try {
      // Find a supported audio mime type
      const types = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/webm;codecs=opus'];
      const mimeType = types.find(t => MediaRecorder.isTypeSupported(t)) || '';
      
      const options = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, options);
      recordedChunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        const targetMime = mimeType || 'audio/webm';
        const blob = new Blob(recordedChunksRef.current, { type: targetMime });
        recordedChunksRef.current = [];
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = targetMime.includes('ogg') ? 'ogg' : targetMime.includes('mp4') ? 'mp4' : 'webm';
        a.download = `Session-Recording-${session?.sessionCode || id}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
      };
      
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Could not start recording. Check browser console for details.');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const onlineParticipants = participants.filter(p => p.isOnline);

  if (loading) return (
    <div className="min-h-screen bg-[#07090F] flex items-center justify-center">
      <div className="text-cyan-400 text-sm font-mono animate-pulse">Loading session...</div>
    </div>
  );

  // ── WEBRTC RECEIVER ────────────────────────────────────


  if (sessionStatus === 'ended') {
    return (
      <div className="min-h-screen bg-[#07090F] flex flex-col p-6 items-center justify-center relative overflow-hidden">
        <div className="fixed inset-0 pointer-events-none opacity-30" style={{ backgroundImage:'linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)', backgroundSize:'40px 40px' }}/>
        
        <div className="rounded-3xl p-8 w-full max-w-2xl border border-white/10 shadow-2xl bg-[#0D1220] relative z-10">
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">📊</div>
            <h2 className="text-2xl font-black text-white">Session Ended</h2>
            <p className="text-slate-400 text-sm mt-2">Here are your final metrics</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
             <div className="bg-white/5 rounded-xl p-4 text-center border border-white/10">
               <div className="text-3xl font-black text-[#00D4FF] mb-1">{participants.length}</div>
               <div className="text-xs text-slate-500 font-bold uppercase tracking-widest">Total Attendees</div>
             </div>
             <div className="bg-white/5 rounded-xl p-4 text-center border border-white/10">
               <div className="text-3xl font-black text-[#00FF87] mb-1">{transcript.length}</div>
               <div className="text-xs text-slate-500 font-bold uppercase tracking-widest">Transcript Entries</div>
             </div>
          </div>

          {finalSummary && (
            <div className="mb-8 bg-black/20 p-4 rounded-xl border border-white/5">
              <div className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-3 border-b border-white/10 pb-2">AI Session Summary</div>
              <div className="prose prose-invert prose-sm text-slate-300 max-h-60 overflow-y-auto pr-2" style={{ whiteSpace: 'pre-wrap' }}>
                {finalSummary}
              </div>
            </div>
          )}

          <div className="flex justify-center mt-6">
            <button onClick={() => navigate('/dashboard')}
              className="px-8 py-4 rounded-xl font-bold text-sm text-white bg-white/10 hover:bg-white/20 transition-all border border-transparent">
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#07090F] flex flex-col overflow-hidden">

      {/* subtle grid */}
      <div className="fixed inset-0 pointer-events-none opacity-30" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)',
        backgroundSize: '40px 40px'
      }}/>

      {/* ─── NAVBAR ─── */}
      <nav className="flex-shrink-0 border-b border-white/[0.06] z-50 relative" style={{ background: 'rgba(7,9,15,0.95)', backdropFilter: 'blur(20px)' }}>
        <div className="px-6 h-14 flex items-center justify-between">
          {/* Left — Logo + Session */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                style={{background:'linear-gradient(135deg,#00D4FF,#7C3AED)'}}>🎙</div>
              <span className="text-white font-black text-base tracking-tight">
                M<span style={{color:'#00D4FF'}}>SCS</span>
              </span>
            </div>
            <div className="w-px h-5 bg-white/10"/>
            <div className="flex items-center gap-2">
              {sessionStarted && (
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>
              )}
              <span className="font-mono text-sm font-bold" style={{color:'#00D4FF'}}>
                {session?.sessionCode}
              </span>
              <span className="text-slate-600 text-xs">·</span>
              <span className="text-slate-500 text-xs font-medium">{session?.title}</span>
            </div>
          </div>

          {/* Center — Mode indicator */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
              {mode === 'qa' ? 'Q&A Mode' : 'Speaking Mode'}
            </div>
          </div>

          {/* Right — Stats + End */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>
                {onlineParticipants.length} online
              </span>
              <span>·</span>
              <span>{queue.length} in queue</span>
            </div>
            {!micEnabled && sessionStarted && (
              <button onClick={handleEnableMic}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/10 transition-all">
                Enable Audio
              </button>
            )}
            {sessionStarted && !isRecording && (
              <button onClick={handleStartRecording}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 border border-slate-500/20 hover:bg-white/10 transition-all flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500"/> Record
              </button>
            )}
            {sessionStarted && isRecording && (
              <button onClick={handleStopRecording}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-400 border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 transition-all flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm bg-red-500 animate-pulse"/> Stop
              </button>
            )}
            {micEnabled && (
              <button 
                onClick={toggleMute}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  presenterMuted 
                    ? 'bg-red-500/10 border-red-500/20 text-red-500' 
                    : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                }`}
              >
                {presenterMuted ? '🎤 Unmute' : '🔇 Mute'}
              </button>
            )}
            <button onClick={handleEndSession}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all">
              End Session
            </button>
          </div>
        </div>
      </nav>

      {/* ─── START SESSION OVERLAY ─── */}
      {!sessionStarted && (
        <div className="flex-1 flex items-center justify-center relative z-10">
          <div className="text-center">
            <div className="text-6xl mb-6">🎙</div>
            <h2 className="text-3xl font-black text-white mb-2">{session?.title}</h2>
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="text-slate-500 text-sm font-medium">Session Code:</span>
              <span className="font-mono font-black text-xl tracking-widest" style={{color:'#00D4FF'}}>
                {session?.sessionCode}
              </span>
            </div>
            <p className="text-slate-500 text-sm font-medium mb-3">
              {onlineParticipants.length} participant{onlineParticipants.length !== 1 ? 's' : ''} joined
            </p>
            {/* Waiting participants */}
            {onlineParticipants.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-sm mx-auto">
                {onlineParticipants.map(p => (
                  <span key={p._id} className="text-xs font-semibold px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300">
                    {p.name}
                  </span>
                ))}
              </div>
            )}
            <button onClick={handleStartSession}
              className="px-10 py-4 rounded-2xl font-black text-lg shadow-2xl shadow-cyan-500/20 transition-all hover:scale-105 active:scale-95 mb-6"
              style={{background:'linear-gradient(135deg,#00D4FF,#0099BB)',color:'#07090F'}}>
              Start Session →
            </button>
            <p className="text-slate-600 text-xs mt-4 font-medium">
              Participants can still join after you start
            </p>
          </div>
        </div>
      )}

      {/* ─── MAIN LAYOUT ─── */}
      {sessionStarted && (
        <div className="flex-1 flex overflow-hidden relative z-10">

          {/* ── LEFT — Controls ── */}
          <div className="w-64 flex-shrink-0 border-r border-white/[0.06] flex flex-col gap-3 p-4 overflow-y-auto"
            style={{background:'rgba(255,255,255,0.01)'}}>

            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-1 mb-1">
              Session Controls
            </div>

            {/* Open Q&A */}
            <button onClick={handleOpenQA} disabled={mode === 'qa'}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl border font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
              style={mode !== 'qa'
                ? {background:'rgba(0,212,255,0.08)',borderColor:'rgba(0,212,255,0.25)',color:'#00D4FF'}
                : {background:'rgba(255,255,255,0.03)',borderColor:'rgba(255,255,255,0.06)',color:'#4A5568'}
              }>
              <span className="text-lg">🔓</span>
              <div className="text-left">
                <div>Open Q&A</div>
                <div className="text-[10px] font-medium opacity-60">Start question session</div>
              </div>
            </button>

            {/* Next Question */}
            <button onClick={handleNextQuestion} disabled={mode !== 'qa' || queue.length === 0}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl border font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
              style={mode === 'qa' && queue.length > 0
                ? {background:'rgba(0,255,135,0.08)',borderColor:'rgba(0,255,135,0.25)',color:'#00FF87'}
                : {background:'rgba(255,255,255,0.03)',borderColor:'rgba(255,255,255,0.06)',color:'#4A5568'}
              }>
              <span className="text-lg">⏭</span>
              <div className="text-left">
                <div>Next Question</div>
                <div className="text-[10px] font-medium opacity-60">Grant next speaker</div>
              </div>
            </button>

            {/* Interrupt */}
            <button onClick={handleInterrupt} disabled={!activeSpeaker}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl border font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
              style={activeSpeaker
                ? {background:'rgba(255,140,0,0.08)',borderColor:'rgba(255,140,0,0.25)',color:'#FF8C00'}
                : {background:'rgba(255,255,255,0.03)',borderColor:'rgba(255,255,255,0.06)',color:'#4A5568'}
              }>
              <span className="text-lg">✋</span>
              <div className="text-left">
                <div>Interrupt</div>
                <div className="text-[10px] font-medium opacity-60">Mute current speaker</div>
              </div>
            </button>

            {/* Close Q&A */}
            <button onClick={handleCloseQA} disabled={mode !== 'qa'}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl border font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
              style={mode === 'qa'
                ? {background:'rgba(124,58,237,0.08)',borderColor:'rgba(124,58,237,0.25)',color:'#A78BFA'}
                : {background:'rgba(255,255,255,0.03)',borderColor:'rgba(255,255,255,0.06)',color:'#4A5568'}
              }>
              <span className="text-lg">🔒</span>
              <div className="text-left">
                <div>Close Q&A</div>
                <div className="text-[10px] font-medium opacity-60">Return to speaking</div>
              </div>
            </button>

            <div className="my-1 border-t border-white/[0.06]"/>

            {/* Emergency Stop */}
            <button onClick={handleEmergencyStop}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl border font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{background:'rgba(255,59,92,0.08)',borderColor:'rgba(255,59,92,0.25)',color:'#FF3B5C'}}>
              <span className="text-lg">🚨</span>
              <div className="text-left">
                <div>Emergency Stop</div>
                <div className="text-[10px] font-medium opacity-60">Mute everyone</div>
              </div>
            </button>

            {/* Session info */}
            <div className="mt-auto pt-4 border-t border-white/[0.06]">
              <div className="rounded-xl p-3 border border-white/[0.06]"
                style={{background:'rgba(255,255,255,0.02)'}}>
                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2 text-center">
                  Live QR Code
                </div>
                {dynamicQrToken ? (
                  <div className="flex justify-center mb-2">
                    <div className="p-2 rounded-xl border border-white/10 shadow-2xl bg-white">
                      <QRCodeSVG 
                        value={`${window.location.origin}/verify?token=${dynamicQrToken}`} 
                        size={110} 
                        level="H" 
                        fgColor="#07090F"
                        includeMargin={false}
                        imageSettings={{
                          src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='80'%3E%F0%9F%8E%99%EF%B8%8F%3C/text%3E%3C/svg%3E",
                          x: undefined,
                          y: undefined,
                          height: 24,
                          width: 24,
                          excavate: true,
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center mb-2">
                    <div className="w-24 h-24 rounded-lg bg-white/5 border border-white/10 animate-pulse flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin"/>
                    </div>
                  </div>
                )}
                <div className="font-mono font-black text-lg tracking-widest text-center mb-1"
                  style={{color:'#00D4FF'}}>
                  {session?.sessionCode}
                </div>
                <div className="text-[10px] text-slate-600 text-center">
                  Students scan QR or enter code
                </div>
              </div>
            </div>
          </div>

          {/* ── CENTER — Transcript ── */}
          <div className="flex-1 flex flex-col min-w-0">

            {/* Headless Remote Transcriber for Student audio streams */}
            {activeSpeaker && remoteStream && (
              <>
                <audio 
                  autoPlay 
                  playsInline 
                  ref={el => { if (el && el.srcObject !== remoteStream) el.srcObject = remoteStream; }} 
                  style={{ display: 'none' }}
                />
                <RemoteTranscriber
                  stream={remoteStream}
                  speakerName={activeSpeaker.participantName}
                  speakerRole="student"
                  sessionId={id}
                  onTranscript={(data) => {
                    if (socketRef.current) {
                      socketRef.current.emit('transcriptSegment', data);
                    }
                  }}
                />
              </>
            )}

            {/* Active Speaker Banner (Presenter vs Student) */}
            <div className="flex-shrink-0 border-b px-6 py-4 flex items-center justify-between shadow-sm z-10"
              style={{
                background: activeSpeaker ? 'rgba(0, 255, 135, 0.08)' : 'rgba(0, 212, 255, 0.08)',
                borderColor: activeSpeaker ? 'rgba(0, 255, 135, 0.15)' : 'rgba(0, 212, 255, 0.15)'
              }}>
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10 shadow-lg">
                  <span className="text-xl">{activeSpeaker ? '🗣️' : '🎙️'}</span>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${activeSpeaker ? 'bg-[#00FF87]' : 'bg-[#00D4FF]'}`} 
                         style={{ boxShadow: `0 0 8px ${activeSpeaker ? '#00FF87' : '#00D4FF'}` }}/>
                    <span className="text-xs font-black uppercase tracking-widest bg-clip-text text-transparent"
                          style={{ backgroundImage: activeSpeaker ? 'linear-gradient(90deg, #00FF87, #34d399)' : 'linear-gradient(90deg, #00D4FF, #3b82f6)' }}>
                      {activeSpeaker ? 'Student Speaking' : 'You Are Speaking'}
                    </span>
                  </div>
                  <div className="text-white font-bold text-lg leading-none flex items-center gap-2">
                    {activeSpeaker ? activeSpeaker.participantName : 'Presenter Mic Active'}
                    {activeSpeaker?.isMuted && <span className="text-[10px] font-black bg-red-500/20 text-red-500 px-2 py-0.5 rounded-full border border-red-500/30">MUTED</span>}
                  </div>
                </div>
              </div>

              {/* Advanced Waveform + Reset */}
              <div className="flex items-center gap-4 p-2 rounded-lg bg-black/20">
                <div className="flex items-center gap-1 opacity-90">
                  {[12, 24, 16, 32, 20, 28, 14, 22].map((height, i) => (
                    <div key={i} className="w-1 rounded-full transition-all duration-150"
                      style={{
                        height: `${height}px`,
                        background: activeSpeaker ? '#00FF87' : '#00D4FF',
                        animation: `wave 1s ease-in-out ${i * 0.1}s infinite alternate`,
                        boxShadow: `0 0 6px ${activeSpeaker ? 'rgba(0,255,135,0.4)' : 'rgba(0,212,255,0.4)'}`
                      }}/>
                  ))}
                </div>
              </div>
            </div>

            {/* Transcript */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {transcript.length === 0 && Object.keys(activeInterims).length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl mb-3">📝</div>
                    <div className="text-slate-600 text-sm font-medium">
                      Live transcript will appear here
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {transcript.map((t, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex-shrink-0 w-20 pt-0.5">
                        <span className="text-[11px] font-bold"
                          style={{color: t.speakerRole === 'presenter' ? '#00D4FF' : '#00FF87'}}>
                          {t.speakerName}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-slate-300 text-sm leading-relaxed font-medium">{t.text}</p>
                      </div>
                      <div className="flex-shrink-0 pt-0.5">
                        <span className="text-[10px] text-slate-600 font-mono">
                          {new Date(t.timestamp).toLocaleTimeString('en-US', {hour:'2-digit',minute:'2-digit'})}
                        </span>
                      </div>
                    </div>
                  ))}
                  {Object.entries(activeInterims).map(([speakerName, t]) => (
                    <div key={`interim-${speakerName}`} className="flex gap-3 opacity-70">
                      <div className="flex-shrink-0 w-20 pt-0.5">
                        <span className="text-[11px] font-bold"
                          style={{color: t.speakerRole === 'presenter' ? '#00D4FF' : '#00FF87'}}>
                          {speakerName}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-slate-300 text-sm leading-relaxed font-medium italic animate-pulse">{t.text}...</p>
                      </div>
                      <div className="flex-shrink-0 pt-0.5" />
                    </div>
                  ))}
                  <div ref={transcriptEndRef}/>
                </div>
              )}
            </div>

            {/* Mode info bar */}
            <div className="flex-shrink-0 border-t border-white/[0.06] px-6 py-2 flex items-center justify-between"
              style={{background:'rgba(255,255,255,0.01)'}}>
              <div className="text-xs text-slate-600 font-medium">
                {mode === 'qa'
                  ? '🟢 Q&A Mode active — participants can request to speak'
                  : '🔵 Speaking Mode — only you are active'}
              </div>
              <div className="text-xs text-slate-600 font-medium">
                {transcript.length} entries
              </div>
            </div>
          </div>

          {/* ── RIGHT — Queue + Participants ── */}
          <div className="w-72 flex-shrink-0 border-l border-white/[0.06] flex flex-col overflow-hidden"
            style={{background:'rgba(255,255,255,0.01)'}}>

            {/* Queue */}
            <div className="flex-shrink-0 p-4 border-b border-white/[0.06]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                  Speaker Queue
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400 font-mono">
                  {queue.length}
                </span>
              </div>

              {queue.length === 0 ? (
                <div className="text-center py-6">
                  <div className="text-2xl mb-2">📋</div>
                  <div className="text-slate-600 text-xs font-medium">
                    {mode === 'qa' ? 'No requests yet' : 'Open Q&A to receive requests'}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {queue.map((entry, index) => (
                    <div key={entry._id || index}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all"
                      style={{
                        background: index === 0 ? 'rgba(0,212,255,0.06)' : 'rgba(255,255,255,0.03)',
                        borderColor: index === 0 ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.06)',
                      }}>
                      {/* Rank */}
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
                        style={{
                          background: index === 0 ? '#00D4FF' : 'rgba(255,255,255,0.1)',
                          color: index === 0 ? '#07090F' : '#4A5568',
                        }}>
                        {index + 1}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-xs font-bold truncate">{entry.participantName}</div>
                        <div className="text-slate-600 text-[10px] font-medium">
                          {entry.speakCount === 0 ? 'First time' : `Spoke ${entry.speakCount}x`}
                        </div>
                      </div>
                      {/* Score */}
                      <div className="text-[10px] font-black px-2 py-0.5 rounded-full"
                        style={{
                          background: entry.priorityScore >= 40 ? 'rgba(0,255,135,0.1)' : 'rgba(74,85,104,0.3)',
                          color: entry.priorityScore >= 40 ? '#00FF87' : '#4A5568',
                        }}>
                        {entry.priorityScore}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Text Questions */}
            <div className="flex-shrink-0 flex max-h-64 flex-col overflow-y-auto p-4 border-b border-white/[0.06]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                  Text Q&A
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400 font-mono">
                  {textQuestions.length}
                </span>
              </div>

              {textQuestions.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-white/10 rounded-lg">
                  <div className="text-2xl mb-1">💬</div>
                  <div className="text-slate-600 text-xs font-medium">
                    No text questions
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {textQuestions.map((q, i) => (
                    <div key={i} className="p-3 rounded-lg" style={{background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)'}}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-emerald-400">{q.participantName}</span>
                        <span className="text-[9px] text-slate-600">{new Date(q.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
                      </div>
                      <p className="text-xs text-slate-300">{q.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Participants */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                  Participants
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400 font-mono">
                  {onlineParticipants.length}
                </span>
              </div>

              {participants.length === 0 ? (
                <div className="text-center py-6">
                  <div className="text-2xl mb-2">👥</div>
                  <div className="text-slate-600 text-xs font-medium">
                    Waiting for participants...
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {participants.map((p) => (
                    <div key={p._id}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all"
                      style={{background:'rgba(255,255,255,0.02)'}}>
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.isOnline ? 'bg-emerald-400' : 'bg-slate-600'}`}
                        style={p.isOnline ? {boxShadow:'0 0 6px #34d399'} : {}}/>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-xs font-semibold truncate">{p.name}</div>
                      </div>
                      <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wide flex-shrink-0">
                        {p.role}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(0.4); opacity: 0.5; }
          50% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}