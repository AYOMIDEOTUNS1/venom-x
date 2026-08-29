const fs = require("fs");
const path = require("path");
const axios = require("axios");

const MEMORY_FILE = path.join(__dirname, "..", "database", "ai_memory.json");
const MAX_TURNS = 12;

function loadMemory() {
    try {
        if (!fs.existsSync(MEMORY_FILE)) return {};
        return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8") || "{}");
    } catch (e) {
        return {};
    }
}

function saveMemory(data) {
    try {
        const dir = path.dirname(MEMORY_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
    } catch (e) {}
}

function getSettings() {
    try {
        return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "settings.json"), "utf8"));
    } catch (e) {
        console.log("SETTINGS JSON ERROR:", e.message);
        return {};
    }
}

function systemPrompt(settings) {
    return (
        "You are " + (settings.botName || "VENOM X") +
        ", a smart WhatsApp AI. Owner: " + (settings.ownerName || "Owner") +
        ". Be clear, accurate, useful. Match user language."
    );
}

async function listGroqModels(apiKey) {
    const res = await axios.get("https://api.groq.com/openai/v1/models", {
        timeout: 20000,
        headers: { Authorization: "Bearer " + apiKey }
    });
    const data = (res.data && res.data.data) || [];
    return data.map(function (m) { return m.id; }).filter(Boolean);
}

async function askGroq(apiKey, messages) {
    let models = [];
    try {
        models = await listGroqModels(apiKey);
        console.log("GROQ models available:", models.slice(0, 8).join(", "));
    } catch (e) {
        console.log("GROQ list models failed:", (e.response && e.response.status) || e.message);
        models = [
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "gemma2-9b-it",
            "mixtral-8x7b-32768"
        ];
    }

    // prefer useful chat models first
    const preferred = models.filter(function (id) {
        return /llama|gemma|mixtral|qwen|gpt/i.test(id);
    });
    const tryList = preferred.length ? preferred : models;

    let lastErr = null;
    for (let i = 0; i < tryList.length && i < 8; i++) {
        const model = tryList[i];
        try {
            const res = await axios.post(
                "https://api.groq.com/openai/v1/chat/completions",
                {
                    model: model,
                    messages: messages,
                    temperature: 0.6,
                    max_tokens: 1024
                },
                {
                    timeout: 45000,
                    headers: {
                        Authorization: "Bearer " + apiKey,
                        "Content-Type": "application/json"
                    }
                }
            );
            const text = res.data && res.data.choices && res.data.choices[0] && res.data.choices[0].message && res.data.choices[0].message.content;
            if (text) return { text: String(text).trim(), model: model };
        } catch (err) {
            lastErr = err;
            console.log("GROQ fail:", model, (err.response && err.response.status) || err.message);
        }
    }
    throw lastErr || new Error("All Groq models failed");
}

async function askGemini(apiKey, prompt) {
    const models = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-pro",
        "gemini-pro"
    ];

    let lastErr = null;
    for (let i = 0; i < models.length; i++) {
        const model = models[i];
        try {
            const url =
                "https://generativelanguage.googleapis.com/v1beta/models/" +
                model +
                ":generateContent?key=" +
                apiKey;

            const res = await axios.post(
                url,
                { contents: [{ parts: [{ text: prompt }] }] },
                { timeout: 45000 }
            );

            const text =
                res.data &&
                res.data.candidates &&
                res.data.candidates[0] &&
                res.data.candidates[0].content &&
                res.data.candidates[0].content.parts &&
                res.data.candidates[0].content.parts[0] &&
                res.data.candidates[0].content.parts[0].text;

            if (text) return { text: String(text).trim(), model: model };
        } catch (err) {
            lastErr = err;
            console.log("GEMINI fail:", model, (err.response && err.response.status) || err.message);
        }
    }
    throw lastErr || new Error("All Gemini models failed");
}

module.exports = {
    name: "ai",
    aliases: ["ask", "venomai", "gpt"],

    run: async function (ctx) {
        const reply = ctx.reply;
        const args = ctx.args || [];
        const sender = ctx.sender;
        const message = ctx.message;

        const question = args.join(" ").trim();
        if (!question) return reply("Usage: #ai <question>");

        const settings = getSettings();
        if (!settings.groqApiKey && !settings.geminiApiKey) {
            return reply("❌ No AI keys in settings.json\nAdd groqApiKey or geminiApiKey");
        }

        const memory = loadMemory();
        const uid = String((message && message.key && (message.key.participant || message.key.remoteJid)) || sender || "user");

        if (question.toLowerCase() === "clear memory" || question.toLowerCase() === "reset") {
            delete memory[uid];
            saveMemory(memory);
            return reply("✅ AI memory cleared.");
        }

        if (!memory[uid]) memory[uid] = [];
        const history = memory[uid].slice(-MAX_TURNS);
        const messages = [{ role: "system", content: systemPrompt(settings) }]
            .concat(history)
            .concat([{ role: "user", content: question }]);

        await reply("🧠 Thinking...");

        try {
            let answer = null;
            let engine = "";

            if (settings.groqApiKey) {
                try {
                    const r = await askGroq(String(settings.groqApiKey).trim(), messages);
                    answer = r.text;
                    engine = "Groq (" + r.model + ")";
                } catch (e) {
                    console.log("GROQ AI ERROR:", e.message);
                }
            }

            if (!answer && settings.geminiApiKey) {
                try {
                    const r = await askGemini(String(settings.geminiApiKey).trim(), systemPrompt(settings) + "\n\nUSER: " + question);
                    answer = r.text;
                    engine = "Gemini (" + r.model + ")";
                } catch (e) {
                    console.log("GEMINI AI ERROR:", e.message);
                }
            }

            if (!answer) {
                return reply("❌ AI failed.\nCheck API keys and model access.");
            }

            memory[uid].push({ role: "user", content: question });
            memory[uid].push({ role: "assistant", content: answer });
            memory[uid] = memory[uid].slice(-(MAX_TURNS * 2));
            saveMemory(memory);

            return reply("╭━━〔 🧠 VENOM AI 〕━━⬣\n\n" + answer + "\n\n⚡ " + engine + "\n╰━━━━━━━━━━━━━━━━⬣");
        } catch (err) {
            return reply("❌ AI failed:\n" + err.message);
        }
    }
};
