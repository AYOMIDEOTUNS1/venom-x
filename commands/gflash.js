"use strict";

/**
 * VENOM X — Gemini Flash vision (Omegatech)
 * Reply to an image: #gflash what is this?
 */

const axios = require("axios");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const { getSettings } = require("../lib/settingsCache");

function px() {
    try {
        return getSettings().prefix || "#";
    } catch (e) {
        return "#";
    }
}

function getQuotedImage(message) {
    const ctx =
        message?.message?.extendedTextMessage?.contextInfo ||
        message?.message?.imageMessage?.contextInfo ||
        {};
    const q = ctx.quotedMessage;
    if (!q) return null;

    let cur = q;
    for (let i = 0; i < 4; i++) {
        if (cur.imageMessage) return cur.imageMessage;
        const wrap =
            cur.viewOnceMessageV2?.message ||
            cur.viewOnceMessage?.message ||
            cur.ephemeralMessage?.message;
        if (!wrap) break;
        cur = wrap;
    }
    return null;
}

async function uploadTemp(buffer) {
    // free temp host for a public image URL (API needs imageUrl)
    const FormData = require("form-data");
    const form = new FormData();
    form.append("file", buffer, { filename: "venom.jpg" });

    const hosts = [
        "https://tmp.malvryx.dev/upload",
        "https://0x0.st"
    ];

    // try 0x0.st simple PUT style first
    try {
        const res = await axios.post("https://0x0.st", form, {
            headers: form.getHeaders(),
            timeout: 30000,
            maxContentLength: 15 * 1024 * 1024
        });
        const url = String(res.data || "").trim();
        if (url.indexOf("http") === 0) return url;
    } catch (e) {}

    try {
        const form2 = new FormData();
        form2.append("file", buffer, { filename: "venom.jpg" });
        form2.append("type", "permanent");
        const res = await axios.post("https://tmp.malvryx.dev/upload", form2, {
            headers: form2.getHeaders(),
            timeout: 30000
        });
        const url =
            res.data?.cdnUrl ||
            res.data?.directUrl ||
            res.data?.url;
        if (url) return url;
    } catch (e) {}

    throw new Error("Could not upload image for vision API");
}

module.exports = {
    name: "gflash",
    aliases: ["geminiv", "see", "vision2"],

    run: async function ({ sock, from, args, reply, message }) {
        const prompt = (args || []).join(" ").trim() || "Describe this image";
        const imgMsg = getQuotedImage(message);

        if (!imgMsg) {
            return reply(
`╭━━〔 👁️ VENOM GFLASH 〕━━⬣

Reply to an *image* with:

${px()}gflash what is in this picture?

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        try {
            await reply("👁️ Reading image…");

            const stream = await downloadContentFromMessage(imgMsg, "image");
            const chunks = [];
            for await (const c of stream) chunks.push(c);
            const buffer = Buffer.concat(chunks);
            if (!buffer.length) throw new Error("Empty image");

            const imageUrl = await uploadTemp(buffer);

            const { data } = await axios.get(
                "https://api.omegatech.app/api/ai/Gemini-flash2",
                {
                    params: { text: prompt, imageUrl: imageUrl },
                    timeout: 90000,
                    headers: { "User-Agent": "VENOM-X" }
                }
            );

            const answer =
                (data && data.reply) ||
                (data && data.data && (data.data.reply || data.data.text)) ||
                (data && data.result) ||
                (data && data.message);

            if (!answer || data.status === false) {
                throw new Error(
                    (data && data.error) || "Vision API returned no text"
                );
            }

            return reply(
`╭━━〔 👁️ GFLASH 〕━━⬣

${String(answer).slice(0, 3500)}

╰━━━━━━━━━━━━━━━━⬣`
            );
        } catch (err) {
            console.log("GFLASH ERROR:", err.message);
            return reply(
                "❌ GFlash failed:\n" + String(err.message || err).slice(0, 250)
            );
        }
    }
};
