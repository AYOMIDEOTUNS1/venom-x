const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const pino = require("pino");
const axios = require("axios");
const { getSettings } = require("../lib/settingsCache");

async function geminiVision(apiKey, base64, mime, prompt) {
    const models = [
        "gemini-2.0-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash",
        "gemini-1.5-pro"
    ];
    let lastErr = null;

    for (let i = 0; i < models.length; i++) {
        const model = models[i];
        try {
            const url =
                "https://generativelanguage.googleapis.com/v1beta/models/" +
                model +
                ":generateContent?key=" +
                encodeURIComponent(apiKey);

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
                { timeout: 90000 }
            );

            const parts =
                res.data &&
                res.data.candidates &&
                res.data.candidates[0] &&
                res.data.candidates[0].content &&
                res.data.candidates[0].content.parts;

            if (parts && parts.length) {
                const text = parts
                    .map(function (p) {
                        return p.text || "";
                    })
                    .join("\n")
                    .trim();
                if (text) return text;
            }
            lastErr = new Error("Empty vision response from " + model);
        } catch (err) {
            const status = err.response && err.response.status;
            const data = err.response && err.response.data;
            const msg =
                (data && data.error && data.error.message) ||
                err.message ||
                String(err);
            console.log("VISION fail:", model, status, msg);
            lastErr = new Error(msg);
        }
    }
    throw lastErr || new Error("All vision models failed");
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
"╭━━〔 👁️ VENOM AI VISION 〕━━⬣\n\n" +
"Reply to an image:\n#vision\n#vision what is in this photo?\n\n" +
"╰━━━━━━━━━━━━━━━━⬣"
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
                return reply(
                    "❌ No Gemini key.\nAdd GEMINI_API_KEY in Render Environment."
                );
            }

            const mime = quoted.imageMessage.mimetype || "image/jpeg";
            const userPrompt =
                (args && args.length ? args.join(" ").trim() : "") ||
                "Describe this image in detail: scene, objects, people, text, colors, summary.";

            await reply("📥 Downloading image...");

            let media;
            try {
                media = await downloadMediaMessage(
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
            } catch (e) {
                return reply("❌ Image download failed:\n" + e.message);
            }

            if (!media || !media.length) {
                return reply("❌ Empty image data.");
            }

            await reply("🧠 Analyzing with Gemini...");

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
            const msg = String(err.message || err);
            if (/429|quota|RESOURCE_EXHAUSTED/i.test(msg)) {
                return reply("⚠️ Gemini quota exhausted. Try later.");
            }
            if (/API_KEY|invalid|403/i.test(msg)) {
                return reply("❌ Invalid GEMINI_API_KEY on Render.");
            }
            return reply("❌ Vision error:\n" + msg.slice(0, 400));
        }
    }
};
