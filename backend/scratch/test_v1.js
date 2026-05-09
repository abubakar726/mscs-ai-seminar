const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function testV1() {
    try {
        console.log("Testing with apiVersion: 'v1'...");
        // This is a common way to solve the 404 on newer keys
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }, { apiVersion: 'v1' });
        
        const result = await model.generateContent("hello");
        console.log("SUCCESS: gemini-1.5-flash worked with v1!");
        console.log(result.response.text());
    } catch (e) {
        console.log("FAILED with v1. Msg:", e.message);
    }
}

testV1();
