const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function generateSummary(transcript) {
  if (!process.env.GEMINI_API_KEY) {
    return 'Summary not available. Missing Gemini API Key.';
  }
  
  if (!transcript || transcript.length === 0) {
    return 'No conversation was recorded, unable to generate summary.';
  }

  const scriptText = transcript.map(t => `${t.speakerName} (${t.speakerRole}): ${t.text}`).join('\n');
  
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
    const prompt = `You are an AI assistant analyzing a seminar session.
Here is the transcript of the session:
${scriptText}

Please provide a well-structured summary of the session using Markdown. Include:
1. **Key Takeaways**: A bulleted list of the most important points.
2. **Detailed Summary**: A short paragraph summarizing the overall flow of the session.
3. **Action Items / Next Steps**: Any tasks or follow-ups mentioned.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating AI summary:', error);
    return 'An error occurred while generating the session summary.';
  }
}

async function transcribeWithWhisper(audioBase64) {
  if (!audioBase64) return '';

  const scratchDir = path.join(__dirname, '../../scratch');
  if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
  }

  const tempFilePath = path.join(scratchDir, `${uuidv4()}.webm`);
  
  try {
    fs.writeFileSync(tempFilePath, Buffer.from(audioBase64, 'base64'));

    return new Promise((resolve) => {
      const http = require('http');
      const data = JSON.stringify({ file_path: tempFilePath });

      const options = {
        hostname: '127.0.0.1',
        port: 5001,
        path: '/transcribe',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      };

      const req = http.request(options, (res) => {
        let resData = '';
        res.on('data', (chunk) => {
          resData += chunk;
        });
        res.on('end', () => {
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
          try {
            const parsed = JSON.parse(resData);
            resolve(parsed.text || '');
          } catch (e) {
            console.error('Failed to parse Whisper Daemon response:', e);
            resolve('');
          }
        });
      });

      req.on('error', (e) => {
        console.error('Whisper Daemon connection error (Is it running?):', e);
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        resolve('');
      });

      req.write(data);
      req.end();
    });
  } catch (error) {
    console.error("Failed to write temporary transcription file:", error);
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    return '';
  }
}

async function transcribeAudio(audioBase64, mimeType, role) {
  // Always route to Whisper if role is 'student' or if we want to default to it entirely
  // Because Presenter uses Web Speech API natively (on frontend), only Student audio hits here via RemoteTranscriber.
  if (role === 'student') {
    return await transcribeWithWhisper(audioBase64);
  }

  // Optional: Fallback to Gemini for other roles if they hit the backend (though Presenter shouldn't)
  if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY not found and not a student, defaulting to Whisper');
      return await transcribeWithWhisper(audioBase64);
  }
  
  const modelsToTry = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash-8b',
    'gemini-pro-vision' // Old fallback
  ];

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        "Transcribe the following audio precisely. Respond ONLY with the text of speech. If silent, respond empty.",
        {
          inlineData: {
            data: audioBase64,
            mimeType: mimeType || 'audio/webm'
          }
        }
      ]);
      const response = await result.response;
      const text = response.text();
      if (text !== undefined) return text.trim();
    } catch (error) {
      console.warn(`Gemini Model ${modelName} failed, trying next... Error:`, error.message.substring(0, 100));
    }
  }

  console.error('All Gemini transcription models failed. Falling back to Whisper.');
  return await transcribeWithWhisper(audioBase64);
}

module.exports = { generateSummary, transcribeAudio };
