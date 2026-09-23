/**
 * VENOM X - URL tools
 * #url <link>              → shorten
 * #url (reply image)       → upload image → get link
 * #url expand <link>       → expand short link
 * #url check <link>        → check link
 */

const axios = require("axios");
const FormData = require("form-data");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

function extractUrl(text) {
    const m = String(text || "").match(/(https?:\/\/[^\s]+)/i);
    return m ? m[0] : null;
}

function getQuotedImage(message) {
    const ctx =
        message.message &&
        message.message.extendedTextMessage &&
        message.message.extendedTextMessage.contextInfo
            ? message.message.extendedTextMessage.contextInfo
            : null;

    if (!ctx || !ctx.quotedMessage) return null;

    let q = ctx.quotedMessage;

    // unwrap common wrappers
    for (let i = 0; i < 5; i++) {
        const wrap =
            (q && q.viewOnceMessageV2 && q.viewOnceMessageV2.message) ||
            (q && q.viewOnceMessage && q.viewOnceMessage.message) ||
            (q && q.ephemeralMessage && q.ephemeralMessage.message) ||
            (q && q.documentWithCaptionMessage && q.documentWithCaptionMessage.message) ||
            null;
        if (!wrap) break;
        q = wrap;
    }

    if (q.imageMessage) return q.imageMessage;
    if (q.stickerMessage) return null; // stickers optional later
    return null;
}

async function downloadImage(imageMessage) {
    const stream = await downloadContentFromMessage(imageMessage, "image");
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

async function uploadImage(buffer) {
    // 1) try litterbox (simple, no key)
    try {
        const form = new FormData();
        form.append("reqtype", "fileupload");
        form.append("time", "24h");
        form.append("fileToUpload", buffer, {
            filename: "venom.jpg",
            contentType: "image/jpeg"
        });

        const { data } = await axios.post(
            "https://litterbox.catbox.moe/resources/internals/api.php",
            form,
            {
                headers: form.getHeaders(),
                timeout: 60000
            }
        );

        if (typeof data === "string" && data.indexOf("https://") === 0) {
            return data.trim();
        }
    } catch (e) {}

    // 2) fallback: catbox
    try {
        const form = new FormData();
        form.append("reqtype", "fileupload");
        form.append("fileToUpload", buffer, {
            filename: "venom.jpg",
            contentType: "image/jpeg"
        });

        const { data } = await axios.post(
            "https://catbox.moe/user/api.php",
            form,
            {
                headers: form.getHeaders(),
                timeout: 60000
            }
        );

        if (typeof data === "string" && data.indexOf("https://") === 0) {
            return data.trim();
        }
    } catch (e) {}

    throw new Error("Image upload failed");
}

async function shorten(url) {
    const api =
        "https://is.gd/create.php?format=json&url=" +
        encodeURIComponent(url);

    const { data } = await axios.get(api, {
        timeout: 20000,
        headers: { "User-Agent": "VENOM-X" }
    });

    if (data && data.shorturl) return data.shorturl;
    if (data && data.errormessage) throw new Error(data.errormessage);
    throw new Error("Shorten failed");
}

async function expand(url) {
    const res = await axios.get(url, {
        timeout: 20000,
        maxRedirects: 10,
        validateStatus: function () { return true; },
        headers: { "User-Agent": "VENOM-X" }
    });

    const finalUrl =
        (res.request &&
            res.request.res &&
            res.request.res.responseUrl) ||
        url;

    return {
        finalUrl: finalUrl,
        status: res.status
    };
}

module.exports = {
    name: "url",
    aliases: ["shorturl", "shortlink", "tinyurl", "tour"],

    run: async function ({ reply, args, message }) {
        const sub = String((args && args[0]) || "").toLowerCase();

        // =========================
        // REPLY TO IMAGE → upload
        // =========================
        const imageMsg = getQuotedImage(message);
        if (imageMsg) {
            try {
                await reply("📤 Uploading image...");
                const buffer = await downloadImage(imageMsg);
                if (!buffer || !buffer.length) throw new Error("Empty image");

                const link = await uploadImage(buffer);
                let short = link;
                try {
                    short = await shorten(link);
                } catch (e) {}

                return reply(
"╭━━〔 🖼️ IMAGE URL 〕━━⬣\n" +
"┃\n" +
"┃ ✅ Uploaded\n" +
"┃\n" +
"┃ 🔗 Direct:\n" +
"┃ " + link + "\n" +
"┃\n" +
"┃ ✨ Short:\n" +
"┃ " + short + "\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
                );
            } catch (e) {
                return reply("❌ Image URL failed:\n" + e.message);
            }
        }

        // HELP
        if (!args || !args.length) {
            return reply(
"╭━━〔 🔗 VENOM URL 〕━━⬣\n" +
"┃\n" +
"┃ Reply to image:\n" +
"┃ #url\n" +
"┃\n" +
"┃ Shorten link:\n" +
"┃ #url https://example.com\n" +
"┃\n" +
"┃ Expand:\n" +
"┃ #url expand <link>\n" +
"┃\n" +
"┃ Check:\n" +
"┃ #url check <link>\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        // EXPAND
        if (sub === "expand" || sub === "unshort" || sub === "long") {
            const link = extractUrl(args.slice(1).join(" "));
            if (!link) return reply("❌ Provide a short URL.");

            try {
                await reply("🔍 Expanding...");
                const result = await expand(link);
                return reply(
"╭━━〔 🔗 URL EXPAND 〕━━⬣\n" +
"┃\n" +
"┃ 📎 " + link + "\n" +
"┃ 🌐 " + result.finalUrl + "\n" +
"┃ 📡 " + result.status + "\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
                );
            } catch (e) {
                return reply("❌ Expand failed:\n" + e.message);
            }
        }

        // CHECK
        if (sub === "check" || sub === "info" || sub === "status") {
            const link = extractUrl(args.slice(1).join(" "));
            if (!link) return reply("❌ Provide a URL.");

            try {
                await reply("🔍 Checking...");
                const res = await axios.get(link, {
                    timeout: 15000,
                    maxRedirects: 5,
                    validateStatus: function () { return true; },
                    headers: { "User-Agent": "VENOM-X" }
                });

                return reply(
"╭━━〔 🔗 URL CHECK 〕━━⬣\n" +
"┃\n" +
"┃ 🌐 " + link + "\n" +
"┃ 📡 Status: " + res.status + "\n" +
"┃ 📦 Type: " + (res.headers["content-type"] || "unknown") + "\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
                );
            } catch (e) {
                return reply("❌ Check failed:\n" + e.message);
            }
        }

        // SHORTEN text URL
        const link = extractUrl(args.join(" "));
        if (!link) {
            return reply("❌ Provide a valid URL, or reply to an image with #url");
        }

        try {
            await reply("⏳ Shortening...");
            const short = await shorten(link);
            return reply(
"╭━━〔 🔗 URL SHORT 〕━━⬣\n" +
"┃\n" +
"┃ 🌐 " + link + "\n" +
"┃ ✨ " + short + "\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        } catch (e) {
            return reply("❌ Shorten failed:\n" + e.message);
        }
    }
};
