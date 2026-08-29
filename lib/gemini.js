const { GoogleGenAI } = require("@google/genai");
const settings = require("../settings.json");

const ai = new GoogleGenAI({
    apiKey: settings.geminiApiKey
});

const MODEL = "gemini-3.6-flash";

async function generateText(prompt) {

    const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt
    });

    return response.text;
}

async function generateVision(imageBase64, prompt, mimeType = "image/jpeg") {

    try {

        const response = await ai.models.generateContent({
            model: MODEL,
            contents: [{
                role: "user",
                parts: [
                    {
                        inlineData: {
                            mimeType,
                            data: imageBase64
                        }
                    },
                    {
                        text: prompt
                    }
                ]
            }]
        });

        return response.text;

    } catch (err) {

        if (
            err?.message?.includes("429") ||
            err?.message?.includes("RESOURCE_EXHAUSTED")
        ) {
            throw new Error(
                "Gemini Vision quota exceeded. Please try again later."
            );
        }

        throw err;
    }
}

module.exports = {
    generateText,
    generateVision
};
