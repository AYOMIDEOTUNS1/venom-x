const { GoogleGenAI } = require("@google/genai");
const settings = require("./settings.json");

const ai = new GoogleGenAI({
  apiKey: settings.geminiApiKey
});

(async () => {
  try {
    const models = await ai.models.list();

    for await (const model of models) {
      console.log(model.name);
    }

  } catch (e) {
    console.log(e);
  }
})();
