const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function listModels() {
    try {
        // Force the API version to v1 (Stable)
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // In the Node.js SDK, you can't easily force v1 in the constructor without a specific version of the lib,
        // but let's try 'gemini-1.5-flash' again.
        
        console.log("Testing gemini-1.5-flash...");
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent("hello");
        console.log("SUCCESS: gemini-1.5-flash worked!");
    } catch (e) {
        console.log("FAILED: gemini-1.5-flash failed. Msg:", e.message);
        
        try {
            console.log("Testing gemini-pro...");
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
            const result = await model.generateContent("hello");
            console.log("SUCCESS: gemini-pro worked!");
        } catch (e2) {
             console.log("FAILED: gemini-pro failed. Msg:", e2.message);
        }
    }
}

listModels();
