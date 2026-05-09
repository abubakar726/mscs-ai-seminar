import { useEffect, useRef } from 'react';
import api from '../utils/api';

/**
 * RemoteTranscriber
 * This component runs on the Presenter panel. 
 * It "listens" to a remote student stream and sends 5s chunks to Gemini for transcription.
 */
export default function RemoteTranscriber({ stream, speakerName, speakerRole, sessionId, onTranscript }) {
  const recorderRef = useRef(null);

  useEffect(() => {
    if (!stream || !sessionId) return;
    
    let interval;
    const startRecording = () => {
      try {
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
        recorderRef.current = recorder;
        let chunks = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = async () => {
          if (chunks.length === 0) return;
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = async () => {
            const base64Audio = reader.result.split(',')[1];
            try {
              const res = await api.post('/ai/transcribe', { audio: base64Audio, mimeType: 'audio/webm', role: speakerRole });
              if (res.data.text && res.data.text.trim()) {
                onTranscript({
                  sessionId,
                  speakerName,
                  speakerRole,
                  text: res.data.text.trim(),
                  timestamp: new Date()
                });
              }
            } catch (err) {
              console.error('Remote Transcription Error:', err);
            }
          };
        };

        recorder.start();
        
        // Stop recording after 3 seconds to process the chunk
        setTimeout(() => {
          if (recorder.state === 'recording') recorder.stop();
        }, 3000);

      } catch (e) {
        console.error('Remote Recorder Start Error:', e);
      }
    };

    // Run the cycle every 3.5 seconds (3s record + 0.5s buffer)
    startRecording();
    interval = setInterval(startRecording, 3500);

    return () => {
      clearInterval(interval);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    };
  }, [stream, speakerName, speakerRole, sessionId, onTranscript]);

  return null; // Headless component
}
