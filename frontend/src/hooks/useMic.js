import { useState, useRef, useCallback } from 'react';

const SILENCE_THRESHOLD = 0.01;
const SILENCE_DURATION = 3000;

export default function useMic({ onSilence, onAudioLevel } = {}) {
  const [micActive, setMicActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState(null);
  const [isMuted, setIsMuted] = useState(false);

  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const silenceStartRef = useRef(null);
  const isMutedRef = useRef(false);

  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(t => {
        t.enabled = !t.enabled;
      });
      isMutedRef.current = !streamRef.current.getAudioTracks()[0]?.enabled;
      setIsMuted(isMutedRef.current);
    }
  }, []);

  const startMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      setIsMuted(false);
      isMutedRef.current = false;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
        setAudioLevel(avg);
        if (onAudioLevel) onAudioLevel(avg);

        if (!isMutedRef.current && avg < SILENCE_THRESHOLD) {
          if (!silenceStartRef.current) {
            silenceStartRef.current = Date.now();
          } else if (Date.now() - silenceStartRef.current > SILENCE_DURATION) {
            silenceStartRef.current = null;
            if (onSilence) onSilence();
          }
        } else {
          silenceStartRef.current = null;
        }

        animFrameRef.current = requestAnimationFrame(checkLevel);
      };

      checkLevel();
      setMicActive(true);
      setError(null);

      return stream; // ← stream return karo WebRTC ke liye
    } catch (err) {
      console.error('Mic error:', err);
      setError(err.message);
      return null;
    }
  }, [onSilence, onAudioLevel]);

  const stopMic = useCallback(() => {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    silenceStartRef.current = null;
    setMicActive(false);
    setIsMuted(false);
    isMutedRef.current = false;
    setAudioLevel(0);
  }, []);

  return { micActive, isMuted, audioLevel, error, startMic, stopMic, toggleMute, streamRef };
}