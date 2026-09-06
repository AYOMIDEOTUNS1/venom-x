const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const pino = require("pino");
const axios = require("axios");
const { getSettings } = require("../lib/settingsCache");

async function geminiVision(apiKey, base64, mime, prompt) {
    const models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
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
                {
                    contents: [
                        {
                            parts: [
                                { text: prompt },
                                {
                                    inline_data: {
                                        mime_type: mime || "image/jpeg",
                                        data: base64
                                    }
                                }
                            ]
                        }
                    ]
                },
                { timeout: 60000 }
            );

            const text =
                res.data &&
                res.data.candidates &&
                res.data.candidates[0] &&
                res.data.candidates[0].content &&
                res.data.candidates[0].content.parts &&
                res.data.candidates[0].content.parts[0] &&
                res.data.candidates[0].content.parts[0].text;

            if (text) return String(text).trim();
        } catch (err) {
            lastErr = err;
            console.log("VISION model fail:", model, (err.response && err.response.status) || err.message);
        }
    }
    throw lastErr || new Error("Vision failed");
}

module.exports = {
    name: "vision",
    aliases: ["vison", "see", "describe"],

    run: async function ({ sock, from, message, reply, args }) {
        try {
            const context =
                message.message &&
                message.message.extendedTextMessage &&
                message.message.extendedTextMessage.contextInfo;

            if (!context || !context.quotedMessage) {
                return reply(
"╭━━〔 👁️ VENOM AI VISION 〕━━⬣\n\nReply to an image:\n#vision\n#vision what is this?\n\n╰━━━━━━━━━━━━━━━━⬣"
                );
            }

            const quoted = context.quotedMessage;
            if (!quoted.imageMessage) {
                return reply("❌ Reply to an **image** only.");
            }

            const settings = getSettings();
            const apiKey = String(
                process.env.GEMINI_API_KEY || settings.geminiApiKey || ""
            ).trim();

            if (!apiKey) {
                return reply("❌ No GEMINI_API_KEY on Render Environment.");
            }

            const mime = quoted.imageMessage.mimetype || "image/jpeg";
            const userPrompt =
                (args && args.length ? args.join(" ") : "") ||
                "Describe this image clearly: objects, people, text, colors, scene, summary.";

            await reply("📥 Reading image...");

            const media = await downloadMediaMessage(
                {
                    key: {
                        remoteJid: from,
                        id: context.stanzaId,
                        participant: context.participant
                    },
                    message: quoted
                },
                "buffer",
                {},
                {
                    logger: pino({ level: "silent" }),
                    reuploadRequest: sock.updateMediaMessage
                }
            );

            if (!media || !media.length) {
                return reply("❌ Could not download image.");
            }

            await reply("🧠 Analyzing...");

            const result = await geminiVision(
                apiKey,
                Buffer.from(media).toString("base64"),
                mime,
                "You are VENOM X Vision AI.\n" + userPrompt
            );

            return reply(
                "╭━━〔 👁️ VENOM AI VISION 〕━━⬣\n\n" +
                    result +
                    "\n\n╰━━━━━━━━━━━━━━━━⬣"
            );
        } catch (err) {
            console.log("VISION ERROR:", err.message);
            const msg = err.message || String(err);
            if (/429|quota|RESOURCE_EXHAUSTED/i.test(msg)) {
                return reply("⚠️ Gemini quota exhausted. Try later.");
            }
            return reply("❌ Vision error:\n" + msg);
        }
    }
};
