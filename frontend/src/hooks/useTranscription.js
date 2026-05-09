import { useEffect, useRef, useCallback } from 'react';

export default function useTranscription({
  enabled,
  onTranscriptSegment,
  onInterimTranscript,
  speakerName,
  speakerRole,
  sessionId
}) {
  const recognitionRef = useRef(null);
  const shouldRecognizeRef = useRef(enabled);
  const activeInstanceRef = useRef(false);

  // Update ref when enabled changes
  useEffect(() => {
    shouldRecognizeRef.current = enabled;
  }, [enabled]);

  const startEngine = useCallback(() => {
    if (!shouldRecognizeRef.current || activeInstanceRef.current) return;
    try {
      if (recognitionRef.current) {
        recognitionRef.current.start();
        activeInstanceRef.current = true;
      }
    } catch (e) {
      console.warn("Speech engine start collision:", e);
    }
  }, []);

  const stopEngine = useCallback(() => {
    if (recognitionRef.current && activeInstanceRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      activeInstanceRef.current = false;
    }
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Speech Recognition API not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true; 
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      activeInstanceRef.current = true;
    };

    recognition.onresult = (event) => {
      let finalTxt = '';
      let interimTxt = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptChunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTxt += transcriptChunk;
        } else {
          interimTxt += transcriptChunk;
        }
      }

      if (finalTxt.trim() && onTranscriptSegment) {
        onTranscriptSegment({
          sessionId,
          speakerName,
          speakerRole,
          text: finalTxt.trim()
        });
      }

      if (interimTxt.trim() && onInterimTranscript) {
        onInterimTranscript({
          sessionId,
          speakerName,
          speakerRole,
          text: interimTxt.trim()
        });
      }
    };

    recognition.onerror = (e) => {
      console.warn('Speech recognition error:', e.error);
      if (e.error === 'not-allowed' || e.error === 'audio-capture' || e.error === 'no-speech') {
        // no-speech can happen in continuous mode if quiet for a long time
        // We let onend handle the silent restart
      }
    };

    recognition.onend = () => {
      activeInstanceRef.current = false;
      // If we still want it running and it ended (silence, timeout, etc), restart it ONCE
      if (shouldRecognizeRef.current) {
        setTimeout(() => {
          if (shouldRecognizeRef.current && !activeInstanceRef.current) {
            try { recognition.start(); } catch(err) {}
          }
        }, 1200); // 1.2s delay to ensure hardware is released and prevent beeping fits
      }
    };

    recognitionRef.current = recognition;

    if (shouldRecognizeRef.current) {
      startEngine();
    }

    return () => {
      shouldRecognizeRef.current = false;
      stopEngine();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, speakerName, speakerRole]);

  // Restart/Stop dynamically based on enabled prop
  useEffect(() => {
    if (enabled) {
      shouldRecognizeRef.current = true;
      startEngine();
    } else {
      shouldRecognizeRef.current = false;
      stopEngine();
    }
  }, [enabled, startEngine, stopEngine]);

  return { stopEngine, startEngine };
}
