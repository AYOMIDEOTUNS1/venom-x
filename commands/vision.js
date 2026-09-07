const { downloadMediaMessage, downloadContentFromMessage } = require("@whiskeysockets/baileys");
const pino = require("pino");
const axios = require("axios");
const { getSettings } = require("../lib/settingsCache");

function getQuotedImage(message) {
    const ctx =
        message.message &&
        message.message.extendedTextMessage &&
        message.message.extendedTextMessage.contextInfo;

    if (!ctx || !ctx.quotedMessage) return null;

    let q = ctx.quotedMessage;
    if (q.ephemeralMessage && q.ephemeralMessage.message) q = q.ephemeralMessage.message;
    if (q.viewOnceMessage && q.viewOnceMessage.message) q = q.viewOnceMessage.message;
    if (q.viewOnceMessageV2 && q.viewOnceMessageV2.message) q = q.viewOnceMessageV2.message;

    if (!q.imageMessage) return null;
    return { imageMessage: q.imageMessage, contextInfo: ctx };
}

async function downloadImage(sock, from, quoted) {
    const { imageMessage, contextInfo } = quoted;

    try {
        const stream = await downloadContentFromMessage(imageMessage, "image");
        const chunks = [];
        for await (const c of stream) chunks.push(c);
        if (chunks.length) return Buffer.concat(chunks);
    } catch (e) {
        console.log("VISION stream:", e.message);
    }

    try {
        const buf = await downloadMediaMessage(
            {
                key: {
                    remoteJid: from,
                    id: contextInfo.stanzaId,
                    participant: contextInfo.participant
                },
                message: { imageMessage: imageMessage }
            },
            "buffer",
            {},
            {
                logger: pino({ level: "silent" }),
                reuploadRequest: sock.updateMediaMessage
            }
        );
        if (buf && buf.length) return Buffer.from(buf);
    } catch (e) {
        console.log("VISION mediaMessage:", e.message);
    }

    throw new Error("Could not download image");
}

async function geminiVision(apiKey, base64, mime, prompt) {
    const models = [
        "gemini-2.0-flash",
        "gemini-2.0-flash-001",
        "gemini-2.5-flash",
        "gemini-flash-latest"
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
                if (text) return { text: text, model: model };
            }
            lastErr = new Error("Empty response from " + model);
        } catch (err) {
            const data = err.response && err.response.data;
            const msg =
                (data && data.error && data.error.message) ||
                err.message ||
                String(err);
            console.log("VISION fail:", model, err.response && err.response.status, msg);
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
            const quoted = getQuotedImage(message);
            if (!quoted) {
                return reply(
`╭━━〔 👁️ VENOM AI VISION 〕━━⬣

Reply to an image:
#vision
#vision what is this?

╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            const settings = getSettings();
            let apiKey = String(
                process.env.GEMINI_API_KEY || settings.geminiApiKey || ""
            ).trim();

            // if someone pasted "#AIza..." by mistake
            if (apiKey.charAt(0) === "#") apiKey = apiKey.slice(1).trim();

            if (!apiKey) {
                return reply(
                    "❌ No Gemini key.\nSet GEMINI_API_KEY on Render Environment."
                );
            }

            const mime = quoted.imageMessage.mimetype || "image/jpeg";
            const userPrompt =
                (args && args.length ? args.join(" ").trim() : "") ||
                "Describe this image in detail: scene, objects, people, text, colors, summary.";

            await reply("📥 Reading image...");
            const media = await downloadImage(sock, from, quoted);

            await reply("🧠 Analyzing...");
            const result = await geminiVision(
                apiKey,
                media.toString("base64"),
                mime,
                "You are VENOM X Vision AI.\n" + userPrompt
            );

            return reply(
`╭━━〔 👁️ VENOM AI VISION 〕━━⬣

${result.text}

⚡ ${result.model}
╰━━━━━━━━━━━━━━━━⬣`
            );
        } catch (err) {
            console.log("VISION ERROR:", err.message);
            const msg = String(err.message || err);
            if (/429|quota|RESOURCE_EXHAUSTED/i.test(msg)) {
                return reply("⚠️ Gemini quota exhausted. Try later.");
            }
            if (/API_KEY|invalid|403|400/i.test(msg)) {
                return reply("❌ Gemini key invalid or blocked.\nCheck GEMINI_API_KEY on Render.");
            }
            return reply("❌ Vision error:\n" + msg.slice(0, 400));
        }
    }
};
