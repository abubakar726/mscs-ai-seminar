import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import useMic from '../hooks/useMic';
import { useStudentWebRTC } from '../hooks/useWebRTC';
import api from '../utils/api';

const SOCKET_URL = process.env.REACT_APP_API_URL || '/';

export default function ParticipantSessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const participantRef = useRef(null);
  const timerRef = useRef(null);

  const [participant, setParticipant] = useState(null);
  const [mode, setMode] = useState('speaking');
  const [queue, setQueue] = useState([]);
  const [textQuestion, setTextQuestion] = useState('');
  const [myPosition, setMyPosition] = useState(null);
  const [myScore, setMyScore] = useState(null);
  const [isGranted, setIsGranted] = useState(false);
  const [inQueue, setInQueue] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [activeInterims, setActiveInterims] = useState({});
  const [sessionStatus, setSessionStatus] = useState('active');
  const [finalSummary, setFinalSummary] = useState(null);
  const [finalTranscript, setFinalTranscript] = useState(null);
  const [notification, setNotification] = useState(null);
  const transcriptEndRef = useRef(null);

  const [targetLang, setTargetLang] = useState('en');
  const targetLangRef = useRef('en');
  const handleLangChange = (e) => {
    setTargetLang(e.target.value);
    targetLangRef.current = e.target.value;
  };

  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setTimeLeft(null);
  }, []);

  const isGrantedRef = useRef(false);
  useEffect(() => {
    isGrantedRef.current = isGranted;
  }, [isGranted]);

  const { micActive, isMuted, audioLevel, startMic, stopMic, toggleMute, streamRef } = useMic({
    onSilence: useCallback(() => {
      const p = participantRef.current;
      if (p && socketRef.current) {
        socketRef.current.emit('speakingDone', { sessionId: p.sessionId, participantId: p.participantId });
        stopMic();
        setIsGranted(false);
        showNotification('Mic off — silence detected', 'info');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  });

  const { startStreaming, stopStreaming } = useStudentWebRTC();

  const startTimer = useCallback((seconds) => {
    clearTimer();
    setTimeLeft(seconds);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          setIsGranted(false);
          stopMic();
          stopStreaming();
          showNotification('Time is up!', 'warning');
          const p = participantRef.current;
          if (p && socketRef.current) {
            socketRef.current.emit('speakingDone', { sessionId: p.sessionId, participantId: p.participantId });
          }
          return 0;
        }
        if (prev === 11) showNotification('⚠️ 10 seconds remaining!', 'warning');
        return prev - 1;
      });
    }, 1000);
  }, [clearTimer, stopMic, stopStreaming, showNotification]);

  useEffect(() => {
    const stored = localStorage.getItem('participant');
    if (!stored) { navigate('/join'); return; }
    const p = JSON.parse(stored);
    if (p.sessionId !== id) { navigate('/join'); return; }
    participantRef.current = p;
    setParticipant(p);
  }, [id, navigate]);

  useEffect(() => {
    if (!participant) return;
    const p = participant;

    const socket = io(SOCKET_URL, { transports: ['polling', 'websocket'], upgrade: true, extraHeaders: { 'bypass-tunnel-reminder': 'true' } });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('joinRoom', { sessionId: id, participantId: p.participantId, name: p.participantName, role: p.role });
    });

    socket.on('sessionState', ({ mode, queue }) => {
      setMode(mode);
      setQueue(queue?.filter(q => q.status === 'waiting') || []);
    });

    socket.on('sessionStarted', () => { setMode('speaking'); showNotification('Session started!', 'info'); });
    socket.on('qaOpened', () => { setMode('qa'); showNotification('🎙 Q&A open — tap to request!', 'success'); });

    socket.on('modeChanged', ({ mode }) => {
      setMode(mode);
      if (mode === 'speaking') { setInQueue(false); setMyPosition(null); setIsGranted(false); clearTimer(); stopMic(); stopStreaming(); }
    });

    socket.on('queueUpdated', ({ queue }) => {
      setQueue(queue);
      const myEntry = queue.find(e => String(e.participantId) === String(p.participantId));
      if (myEntry) setMyPosition(queue.indexOf(myEntry) + 1);
    });

    socket.on('queuePosition', ({ position, score }) => { setMyPosition(position); setMyScore(score); setInQueue(true); });

    // Chime removed to prevent beeping
    const playChime = () => {};

    socket.on('youAreGranted', async ({ timeLimit }) => {
      console.log('youAreGranted!');
      playChime();
      setIsGranted(true);
      setInQueue(false);
      setMyPosition(null);
      showNotification('🎙 You may speak now!', 'granted');
      startTimer(timeLimit || 60);
      let stream = streamRef.current;
      if (!stream) stream = await startMic();
      if (stream) startStreaming(socket, id, p.participantId, stream);
    });

    socket.on('grantedTo', async ({ participantId: grantedId, timeLimit }) => {
      // If WE are the ones being granted, only process if not already granted to avoid double-triggers
      if (String(grantedId) === String(p.participantId)) {
        if (isGrantedRef.current) return;
        
        playChime();
        setIsGranted(true);
        setInQueue(false);
        setMyPosition(null);
        showNotification('🎙 You may speak now!', 'granted');
        startTimer(timeLimit || 60);
        let stream = streamRef.current;
        if (!stream) stream = await startMic();
        if (stream) startStreaming(socket, id, p.participantId, stream);
      }
    });

    socket.on('speakerGranted', ({ participantId: grantedId }) => {
      if (String(grantedId) !== String(p.participantId)) { 
        setIsGranted(false); 
        clearTimer(); 
        stopMic(); 
        stopStreaming(); 
      }
    });

    socket.on('interrupted', () => { setIsGranted(false); clearTimer(); stopMic(); stopStreaming(); showNotification('Interrupted', 'warning'); });
    socket.on('qaClosed', () => { setMode('speaking'); setInQueue(false); setMyPosition(null); setIsGranted(false); clearTimer(); stopMic(); stopStreaming(); showNotification('Q&A closed', 'info'); });
    socket.on('emergencyStop', ({ message }) => { setMode('speaking'); setInQueue(false); setIsGranted(false); clearTimer(); stopMic(); stopStreaming(); showNotification('⚠️ ' + message, 'warning'); });
    socket.on('transcriptUpdated', async ({ speakerName, speakerRole, text }) => {
      const lang = targetLangRef.current;
      let displayTxt = text;
      if (lang !== 'en') {
        try { const res = await api.post('/ai/translate', { text, targetLang: lang }); displayTxt = res.data.translatedText; } catch (e) { }
      }
      setTranscript(prev => [...prev, { speakerName, speakerRole, text: displayTxt, timestamp: new Date() }]);
      setActiveInterims(prev => { const next = { ...prev }; delete next[speakerName]; return next; });
    });

    socket.on('interimTranscriptUpdated', async ({ speakerName, speakerRole, text }) => {
      const lang = targetLangRef.current;
      if (text.trim() === '') {
        setActiveInterims(prev => { const next = { ...prev }; delete next[speakerName]; return next; });
        return;
      }
      let displayTxt = text;
      if (lang !== 'en') {
        try { const res = await api.post('/ai/translate', { text, targetLang: lang }); displayTxt = res.data.translatedText; } catch (e) { }
      }
      setActiveInterims(prev => ({ ...prev, [speakerName]: { speakerRole, text: displayTxt, timestamp: new Date() } }));
    });
    socket.on('sessionEnded', ({ summary, transcript }) => {
      stopMic(); stopStreaming();
      showNotification('Session ended', 'info');
      setSessionStatus('ended');
      if (summary) setFinalSummary(summary);
      if (transcript) setFinalTranscript(transcript);
    });
    socket.on('requestError', ({ message }) => { showNotification(message, 'error'); setInQueue(false); });

    return () => { socket.disconnect(); clearTimer(); stopMic(); stopStreaming(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, participant?.participantId]);

  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [transcript]);
 
  // Student-side native transcription disabled to prevent beeping loops on mobile.
  // Use Presenter-side Relay (Silent for students).
  // (useTranscription hook removed)

  const handleToggleMute = () => {
    toggleMute();
    if (socketRef.current && participant) {
      socketRef.current.emit('studentMuteToggle', {
        sessionId: id,
        participantName: participant.participantName || participant.name || 'Student',
        isMuted: !isMuted
      });
    }
  };

  const handleStopSpeaking = () => {
    const p = participantRef.current;
    if (p && socketRef.current) {
      socketRef.current.emit('speakingDone', { sessionId: id, participantId: p.participantId });
      stopMic();
      stopStreaming();
      setIsGranted(false);
      clearTimer();
      showNotification('You finished speaking', 'info');
    }
  };

  const handleRequestToSpeak = async () => {
    const p = participantRef.current;
    if (!p || inQueue || isGranted || mode !== 'qa') return;

    // Start mic immediately on gesture so Chrome doesn't block SpeechRecognition
    const stream = await startMic();
    if (!stream) {
      showNotification('Microphone access is required to join the queue.', 'error');
      return;
    }

    socketRef.current.emit('requestToSpeak', { sessionId: id, participantId: p.participantId, participantName: p.participantName, role: p.role, speakCount: 0 });
  };

  const handleSubmitTextQuestion = (e) => {
    e.preventDefault();
    if (!textQuestion.trim() || mode !== 'qa') return;
    socketRef.current.emit('submitTextQuestion', {
      sessionId: id,
      participantName: participantRef.current?.participantName || participantRef.current?.name || 'Student',
      text: textQuestion.trim()
    });
    setTextQuestion('');
    showNotification('Question submitted!', 'success');
  };

  const notifStyle = {
    info: { bg: 'rgba(0,212,255,0.1)', border: 'rgba(0,212,255,0.3)', text: '#00D4FF' },
    success: { bg: 'rgba(0,255,135,0.1)', border: 'rgba(0,255,135,0.3)', text: '#00FF87' },
    granted: { bg: 'rgba(0,255,135,0.15)', border: 'rgba(0,255,135,0.5)', text: '#00FF87' },
    warning: { bg: 'rgba(255,140,0,0.1)', border: 'rgba(255,140,0,0.3)', text: '#FF8C00' },
    error: { bg: 'rgba(255,59,92,0.1)', border: 'rgba(255,59,92,0.3)', text: '#FF3B5C' },
  };

  const timerPercent = timeLeft ? (timeLeft / 60) * 100 : 0;
  const timerColor = !timeLeft ? '#00D4FF' : timeLeft > 20 ? '#00D4FF' : timeLeft > 10 ? '#FF8C00' : '#FF3B5C';
  const bars = [0.4, 0.7, 1.0, 0.7, 0.4];

  const handleDownloadNotes = () => {
    const list = finalTranscript || transcript;
    if (!list || list.length === 0) return;
    const text = list.map(t => `[${new Date(t.timestamp).toLocaleTimeString()}] ${t.speakerName} (${t.speakerRole}): ${t.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Session-Notes-${participant?.sessionCode}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (sessionStatus === 'ended') {
    return (
      <div className="min-h-screen bg-[#07090F] flex flex-col p-6 items-center justify-center relative overflow-hidden">
        <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="rounded-3xl p-8 w-full max-w-lg border border-white/10 shadow-2xl bg-[#0D1220] relative z-10">
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">✨</div>
            <h2 className="text-2xl font-black text-white">Session Ended</h2>
            <p className="text-slate-400 text-sm mt-2">Thank you for participating!</p>
          </div>

          {finalSummary ? (
            <div className="mb-8">
              <div className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-3 border-b border-white/10 pb-2">AI Session Summary</div>
              <div className="prose prose-invert prose-sm text-slate-300 max-h-60 overflow-y-auto pr-2" style={{ whiteSpace: 'pre-wrap' }}>
                {finalSummary}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 mt-6">
            <button onClick={handleDownloadNotes}
              className="w-full py-4 rounded-xl font-bold text-sm text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 hover:bg-cyan-400/20 transition-all">
              📥 Download Session Notes
            </button>
            <button onClick={() => navigate('/join')}
              className="w-full py-4 rounded-xl font-bold text-sm text-white bg-white/10 hover:bg-white/20 transition-all border border-transparent">
              Return to Join Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07090F] flex flex-col max-w-md mx-auto relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="fixed top-0 left-0 w-full h-64 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top,rgba(124,58,237,0.08),transparent 70%)' }} />

      <nav className="flex-shrink-0 border-b border-white/[0.06] z-50 relative" style={{ background: 'rgba(7,9,15,0.95)', backdropFilter: 'blur(20px)' }}>
        <div className="px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ background: 'linear-gradient(135deg,#00D4FF,#7C3AED)' }}>🎙</div>
            <span className="text-white font-black text-base">M<span style={{ color: '#00D4FF' }}>SCS</span></span>
          </div>
          <div className="flex items-center gap-3">
            {micActive && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-400">MIC ON</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${mode === 'qa' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-xs font-bold" style={{ color: mode === 'qa' ? '#00FF87' : '#4A5568' }}>
                {mode === 'qa' ? 'Q&A OPEN' : 'SPEAKING MODE'}
              </span>
            </div>
          </div>
        </div>
      </nav>

      {notification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm">
          <div className="px-4 py-3 rounded-xl border text-sm font-bold text-center shadow-2xl"
            style={{ background: notifStyle[notification.type]?.bg, borderColor: notifStyle[notification.type]?.border, color: notifStyle[notification.type]?.text, backdropFilter: 'blur(20px)' }}>
            {notification.message}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto relative z-10">
        <div className="px-5 py-6 flex flex-col gap-5">

          <div className="rounded-2xl p-4 border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black text-white" style={{ background: 'linear-gradient(135deg,#7C3AED,#00D4FF)' }}>
                {participant?.participantName?.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-white font-bold text-sm">{participant?.participantName}</div>
                <div className="text-slate-500 text-xs capitalize">{participant?.role}</div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Session</div>
                <div className="font-mono font-black text-sm" style={{ color: '#00D4FF' }}>{participant?.sessionCode}</div>
              </div>
            </div>
          </div>

          {isGranted && (
            <div className="rounded-2xl p-5 border relative overflow-hidden" style={{ background: 'rgba(0,255,135,0.05)', borderColor: 'rgba(0,255,135,0.3)' }}>
              <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,#00FF87,transparent)' }} />
              <div className="text-center mb-4">
                <div className="text-3xl mb-2">🎙</div>
                <div className="text-emerald-400 font-black text-lg">You're Speaking!</div>
                <div className="text-slate-400 text-xs mt-1">Ask your question now</div>
              </div>
              {micActive && (
                <div className="flex items-center justify-center gap-1 mb-4">
                  {bars.map((b, i) => (
                    <div key={i} className="w-1.5 rounded-full transition-all duration-75"
                      style={{ height: `${Math.max(4, audioLevel * 60 * b)}px`, background: audioLevel > 0.05 ? '#00FF87' : 'rgba(0,255,135,0.3)', minHeight: '4px', maxHeight: '40px' }} />
                  ))}
                </div>
              )}
              {timeLeft !== null && (
                <div className="flex flex-col items-center gap-2">
                  <div className="relative w-20 h-20">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                      <circle cx="40" cy="40" r="34" fill="none" stroke={timerColor} strokeWidth="4" strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 34}`}
                        strokeDashoffset={`${2 * Math.PI * 34 * (1 - timerPercent / 100)}`}
                        style={{ transition: 'stroke-dashoffset 1s linear,stroke 0.5s' }} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-mono font-black text-xl" style={{ color: timerColor }}>{timeLeft}s</span>
                    </div>
                  </div>
                  <div className="text-slate-600 text-xs">{timeLeft <= 10 ? '⚠️ Almost done!' : `${timeLeft} seconds remaining`}</div>
                </div>
              )}
              <div className="flex justify-center gap-4 mt-6">
                <button onClick={handleToggleMute} className={`px-6 py-3 rounded-xl font-bold text-sm transition-all focus:outline-none ${isMuted ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'}`}>
                  {isMuted ? '🎤 Unmute' : '🔇 Mute'}
                </button>
                <button onClick={handleStopSpeaking} className="px-6 py-3 rounded-xl font-bold text-sm bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all focus:outline-none">
                  🛑 Stop Speaking
                </button>
              </div>
            </div>
          )}

          {inQueue && !isGranted && (
            <div className="rounded-2xl p-5 border" style={{ background: 'rgba(0,212,255,0.05)', borderColor: 'rgba(0,212,255,0.2)' }}>
              <div className="text-center">
                <div className="text-3xl mb-2">⏳</div>
                <div className="text-white font-black text-lg">In Queue</div>
                {myPosition && <div className="mt-3"><div className="text-slate-500 text-xs mb-1">Your position</div><div className="text-5xl font-black" style={{ color: '#00D4FF' }}>#{myPosition}</div></div>}
                {myScore !== null && <div className="mt-2 text-xs text-slate-500">Score: <span style={{ color: '#00FF87' }} className="font-bold">{myScore}</span></div>}
                <div className="text-slate-600 text-xs mt-3">You will be granted automatically</div>
              </div>
            </div>
          )}

          {!isGranted && (
            <div className="flex flex-col items-center gap-3">
              <button onClick={handleRequestToSpeak} disabled={mode !== 'qa' || inQueue}
                className="w-full py-5 rounded-2xl font-black text-base transition-all disabled:cursor-not-allowed"
                style={mode === 'qa' && !inQueue
                  ? { background: 'linear-gradient(135deg,#7C3AED,#00D4FF)', color: '#fff', boxShadow: '0 0 40px rgba(124,58,237,0.3)' }
                  : { background: 'rgba(255,255,255,0.05)', color: '#4A5568', border: '1px solid rgba(255,255,255,0.06)' }}>
                {inQueue ? `⏳ In Queue — #${myPosition}` : mode !== 'qa' ? '🔒 Waiting for Q&A' : '🙋 Request to Speak'}
              </button>
              {mode === 'qa' && !inQueue && <p className="text-slate-600 text-xs text-center">Tap to raise your hand in Voice, or ask a Text question below.</p>}
              {mode !== 'qa' && <p className="text-slate-600 text-xs text-center">Presenter will open Q&A when ready</p>}

              {mode === 'qa' && (
                <form onSubmit={handleSubmitTextQuestion} className="w-full mt-2 flex gap-2">
                  <input type="text" value={textQuestion} onChange={e => setTextQuestion(e.target.value)}
                    placeholder="Type a question..."
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500/40 transition-colors" />
                  <button type="submit" disabled={!textQuestion.trim()}
                    className="px-4 py-3 bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/20 rounded-xl font-bold text-sm disabled:opacity-40 transition-all hover:bg-[#00D4FF]/20">
                    Send
                  </button>
                </form>
              )}
            </div>
          )}

          {queue.length > 0 && (
            <div className="rounded-2xl p-4 border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Queue ({queue.length})</div>
              <div className="space-y-2">
                {queue.slice(0, 5).map((entry, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black" style={{ background: i === 0 ? '#00D4FF' : 'rgba(255,255,255,0.08)', color: i === 0 ? '#07090F' : '#4A5568' }}>{i + 1}</div>
                    <div className="text-xs font-semibold flex-1 truncate" style={{ color: String(entry.participantId) === String(participant?.participantId) ? '#00D4FF' : '#94A3B8' }}>
                      {String(entry.participantId) === String(participant?.participantId) ? 'You' : entry.participantName}
                    </div>
                    <div className="text-[10px] font-bold" style={{ color: entry.priorityScore >= 40 ? '#00FF87' : '#4A5568' }}>{entry.priorityScore}pts</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Live Transcript</span>
              <div className="flex items-center gap-2">
                <select value={targetLang} onChange={handleLangChange} className="text-[10px] bg-black/50 border border-white/10 rounded px-1 py-0.5 text-slate-300 outline-none">
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="ur">Urdu</option>
                  <option value="ar">Arabic</option>
                  <option value="zh-cn">Chinese</option>
                  <option value="hi">Hindi</option>
                </select>
                {(transcript.length > 0 || Object.keys(activeInterims).length > 0) && <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><span className="text-[10px] font-bold text-emerald-400">LIVE</span></div>}
              </div>
            </div>
            <div className="p-4 max-h-52 overflow-y-auto">
              {transcript.length === 0 && Object.keys(activeInterims).length === 0
                ? <div className="text-center py-4"><div className="text-slate-600 text-xs">Transcript will appear here...</div></div>
                : <div className="space-y-3">
                  {transcript.slice(-10).map((t, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-[11px] font-bold flex-shrink-0 pt-0.5" style={{ color: t.speakerRole === 'presenter' ? '#00D4FF' : '#00FF87' }}>{t.speakerName}</span>
                      <p className="text-slate-400 text-xs leading-relaxed">{t.text}</p>
                    </div>
                  ))}
                  {Object.entries(activeInterims).map(([speakerName, t]) => (
                    <div key={`interim-${speakerName}`} className="flex gap-2 opacity-70">
                      <span className="text-[11px] font-bold flex-shrink-0 pt-0.5" style={{ color: t.speakerRole === 'presenter' ? '#00D4FF' : '#00FF87' }}>{speakerName}</span>
                      <p className="text-slate-400 text-xs leading-relaxed italic animate-pulse">{t.text}...</p>
                    </div>
                  ))}
                  <div ref={transcriptEndRef} />
                </div>
              }
            </div>
          </div>
          <div className="h-4" />
        </div>
      </div>
    </div>
  );
}