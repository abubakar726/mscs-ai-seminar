const express = require('express');
const router = express.Router();
const translate = require('google-translate-api-x');

const { transcribeAudio } = require('../utils/ai.util');

router.post('/translate', async (req, res) => {
  try {
    const { text, targetLang } = req.body;
    if (!text) return res.status(400).json({ error: 'Text required' });
    const translatedText = await translate(text, { to: targetLang || 'en' });
    res.json({ translatedText: translatedText.text });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Translation failed' });
  }
});

router.post('/transcribe', async (req, res) => {
  try {
    const { audio, mimeType, role } = req.body;
    if (!audio) return res.status(400).json({ error: 'Audio required' });
    const text = await transcribeAudio(audio, mimeType, role);
    res.json({ text });
  } catch (error) {
    console.error('Transcription route error:', error);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

module.exports = router;
