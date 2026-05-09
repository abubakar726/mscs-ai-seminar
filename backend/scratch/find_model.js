const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function findWorkingModel() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Standard models to try
    const models = [
        'gemini-1.5-flash',
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash-001',
        'gemini-1.5-flash-002',
        'gemini-1.5-flash-8b',
        'gemini-1.5-pro',
        'gemini-pro'
    ];

    console.log("--- STARTING MODEL BRUTE-FORCE CHECK ---");
    for (const m of models) {
        try {
            console.log(`Testing model: ${m}...`);
            const model = genAI.getGenerativeModel({ model: m });
            // Simple text prompt to verify basic connectivity
            const result = await model.generateContent("hello");
            const text = result.response.text();
            if (text) {
                console.log(`✅ SUCCESS: ${m} is WORKING!`);
                return; // Stop at first working model
            }
        } catch (e) {
            console.log(`❌ FAILED: ${m} | Error: ${e.message.substring(0, 50)}...`);
        }
    }
    console.log("--- ALL MODELS FAILED ---");
}

findWorkingModel();
