const { GoogleGenAI } = require("@google/genai");
const settings = require("./settings.json");

const ai = new GoogleGenAI({
  apiKey: settings.geminiApiKey
});

(async () => {
  try {
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Say hello."
    });

    console.log(res.text);
  } catch (e) {
    console.log(e.message);
  }
})();
