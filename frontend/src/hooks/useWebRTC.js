import { useRef, useState } from 'react';

const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// ─── STUDENT ──────────────────────────────────────────────
export function useStudentWebRTC() {
  const pcRef = useRef(null);

  const startStreaming = async (socket, sessionId, participantId, stream) => {
    if (!socket || !stream) return;
    console.log('startStreaming called!');

    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }

    const pc = new RTCPeerConnection(ICE);
    pcRef.current = pc;

    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        socket.emit('signal', {
          sessionId,
          to: 'presenter',
          data: { type: 'ice-candidate', candidate: ev.candidate }
        });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit('signal', {
      sessionId,
      to: 'presenter',
      data: { type: 'offer', sdp: pc.localDescription, targetId: socket.id }
    });

    console.log('Offer sent to presenter!');

    socket.off('signal');
    socket.on('signal', async ({ data }) => {
      if (data.type === 'answer') {
        console.log('Answer received!');
        try { await pc.setRemoteDescription(new RTCSessionDescription(data.sdp)); }
        catch(e) { console.error('Answer error:', e); }
      } else if (data.type === 'ice-candidate') {
        try { await pc.addIceCandidate(data.candidate); } catch(e) {}
      }
    });

    console.log('Student: streaming started!');
  };

  const stopStreaming = () => {
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
  };

  return { startStreaming, stopStreaming };
}

// ─── PRESENTER ────────────────────────────────────────────
export function usePresenterWebRTC() {
  const peersRef = useRef({});
  const selfStreamRef = useRef(null);
  const wasAutoMutedRef = useRef(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const [presenterMuted, setPresenterMuted] = useState(false);

  // Audio Mixing for Recording
  const audioContextRef = useRef(null);
  const mixedDestRef = useRef(null);
  const selfSourceRef = useRef(null);
  const peerSourcesRef = useRef({});

  const initSelfMic = async () => {
    try {
      if (selfStreamRef.current) return true; // Already initialized
      
      if (!audioContextRef.current) {
        // Use 'interactive' for lowest latency routing to speakers
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
        mixedDestRef.current = audioContextRef.current.createMediaStreamDestination();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      selfStreamRef.current = stream;
      
      selfSourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      
      // 1. Route local mic to the mixed stream (for recording)
      selfSourceRef.current.connect(mixedDestRef.current);

      // 2. Route local mic directly to the laptop speakers (PA system mode)
      // This uses Web Audio API for much lower latency than an <audio> tag
      selfSourceRef.current.connect(audioContextRef.current.destination);

      console.log('Presenter Self Mic ON (Routed to speakers for PA system)');
      return true;
    } catch (e) {
      console.error('Self mic error', e);
      return false;
    }
  };

  const toggleMute = () => {
    if (selfStreamRef.current) {
      const enabled = selfStreamRef.current.getAudioTracks()[0].enabled;
      selfStreamRef.current.getAudioTracks()[0].enabled = !enabled;
      setPresenterMuted(!enabled);
      return !enabled;
    }
    return false;
  };

  const setupReceiver = (socket, sessionId) => {
    if (!socket) return;
    console.log('Presenter: receiver setup');

    const clearRemoteStreamAndRestoreMic = () => {
      setRemoteStream(null);
      if (wasAutoMutedRef.current && selfStreamRef.current) {
        const track = selfStreamRef.current.getAudioTracks()[0];
        if (track && !track.enabled) {
          track.enabled = true;
          setPresenterMuted(false);
        }
        wasAutoMutedRef.current = false;
      }
    };

    socket.on('studentDone', () => {
      clearRemoteStreamAndRestoreMic();
      console.log('Remote stream cleared');
    });
    socket.on('interrupted', () => {
      clearRemoteStreamAndRestoreMic();
    });
    socket.on('qaClosed', () => {
      clearRemoteStreamAndRestoreMic();
    });
    socket.on('emergencyStop', () => {
      clearRemoteStreamAndRestoreMic();
    });

    socket.off('signal');
    socket.on('signal', async ({ from, fromName, data }) => {
      console.log('Signal from student:', fromName, '|', data?.type);

      if (data.type === 'offer') {
        if (peersRef.current[from]) { peersRef.current[from].close(); }

        const pc = new RTCPeerConnection(ICE);
        peersRef.current[from] = pc;

        pc.ontrack = (e) => {
          console.log('AUDIO RECEIVED from', fromName);

          const stream = e.streams[0];
          setRemoteStream(stream);

          // Auto-mute presenter mic
          if (selfStreamRef.current) {
            const track = selfStreamRef.current.getAudioTracks()[0];
            if (track && track.enabled) {
              track.enabled = false;
              setPresenterMuted(true);
              wasAutoMutedRef.current = true;
            }
          }

              // Route peer audio to the mixed stream (for recording only)
              if (audioContextRef.current && mixedDestRef.current) {
                try {
                  if (audioContextRef.current.state === 'suspended') {
                    audioContextRef.current.resume();
                  }
                  const peerSource = audioContextRef.current.createMediaStreamSource(stream);
                  
                  // 1. Route to mixed stream for recording
                  peerSource.connect(mixedDestRef.current);
                  
                  // 2. Route directly to laptop speakers for ultra-low latency PA output
                  // This is the key fix for the delay!
                  peerSource.connect(audioContextRef.current.destination);
                  
                  peerSourcesRef.current[from] = peerSource;
                } catch(err) {
                  console.error('Audio mix error:', err);
                }
              }
        };

        pc.onicecandidate = (ev) => {
          if (ev.candidate) {
            socket.emit('signal', {
              sessionId,
              to: 'student',
              data: { type: 'ice-candidate', candidate: ev.candidate, targetId: from }
            });
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('signal', {
          sessionId,
          to: 'student',
          data: { type: 'answer', sdp: pc.localDescription, targetId: from }
        });

        console.log('Answer sent to:', fromName);

      } else if (data.type === 'ice-candidate' && peersRef.current[from]) {
        try { await peersRef.current[from].addIceCandidate(data.candidate); } catch(e) {}
      }
    });
  };

  const closeAll = () => {
    Object.values(peersRef.current).forEach(pc => { try { pc.close(); } catch(e) {} });
    peersRef.current = {};
    if (selfStreamRef.current) {
      selfStreamRef.current.getTracks().forEach(t => t.stop());
      selfStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(e => console.error(e));
      audioContextRef.current = null;
    }
    peerSourcesRef.current = {};
  };

  return { setupReceiver, closeAll, initSelfMic, toggleMute, presenterMuted, remoteStream, getMixedStream: () => mixedDestRef.current?.stream };
}
