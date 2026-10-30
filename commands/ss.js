"use strict";

/**
 * VENOM X - #ss
 * Screenshot almost any public URL
 *
 * #ss https://google.com
 * #ss full https://example.com
 * #ss mobile https://example.com
 * Reply to a message with a link + #ss
 */

const axios = require("axios");
const { getSettings } = require("../lib/settingsCache");

function px() {
    try {
        return getSettings().prefix || "#";
    } catch (e) {
        return "#";
    }
}

function pickUrl(text) {
    const m = String(text || "").match(/(https?:\/\/[^\s<>"']+)/i);
    if (m) return m[0].replace(/[),.;]+$/g, "");
    const d = String(text || "").trim().split(/\s+/).find(function (x) {
        return /^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(x);
    });
    if (d) return "https://" + d.replace(/[),.;]+$/g, "");
    return null;
}

function getQuotedText(message) {
    try {
        const ctx =
            message?.message?.extendedTextMessage?.contextInfo ||
            message?.message?.imageMessage?.contextInfo ||
            {};
        const q = ctx.quotedMessage;
        if (!q) return "";
        return (
            q.conversation ||
            q.extendedTextMessage?.text ||
            q.imageMessage?.caption ||
            q.videoMessage?.caption ||
            q.documentMessage?.caption ||
            ""
        );
    } catch (e) {
        return "";
    }
}

function isDirectImage(url) {
    return /\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i.test(url || "");
}

function isDirectPdf(url) {
    return /\.pdf(\?|$)/i.test(url || "");
}

async function fetchBuffer(url, timeout) {
    const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: timeout || 45000,
        maxRedirects: 5,
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            Accept: "image/*,*/*;q=0.8"
        },
        validateStatus: function (s) {
            return s >= 200 && s < 400;
        }
    });
    const buf = Buffer.from(res.data || []);
    if (buf.length < 500) throw new Error("empty image");
    return buf;
}

/**
 * mode: "desktop" | "mobile" | "full"
 */
async function screenshotUrl(url, mode) {
    mode = mode || "desktop";
    const errors = [];

    // 1) Direct image URL — just download
    if (isDirectImage(url)) {
        return fetchBuffer(url);
    }

    // 2) thum.io (reliable, supports full page)
    try {
        let thum = "https://image.thum.io/get/";
        if (mode === "full") thum += "fullpage/";
        if (mode === "mobile") thum += "width/480/";
        else thum += "width/1280/";
        thum += "crop/0/noanimate/";
        thum += encodeURIComponent(url);
        const buf = await fetchBuffer(thum, 60000);
        return buf;
    } catch (e) {
        errors.push("thum: " + e.message);
    }

    // 3) microlink.io
    try {
        const meta = await axios.get("https://api.microlink.io", {
            params: {
                url: url,
                screenshot: true,
                meta: false,
                waitUntil: "networkidle2"
            },
            timeout: 60000
        });
        const shotUrl =
            meta.data?.data?.screenshot?.url ||
            meta.data?.data?.image?.url;
        if (!shotUrl) throw new Error("no screenshot url");
        return await fetchBuffer(shotUrl, 45000);
    } catch (e) {
        errors.push("microlink: " + e.message);
    }

    // 4) wordpegg / screenshot machine style free endpoint
    try {
        const api =
            "https://api.apiflash.com/v1/urltoimage?access_key=demo&url=" +
            encodeURIComponent(url) +
            "&format=png&width=1280&response_type=image";
        // demo key may fail — skip soft
        const buf = await fetchBuffer(
            "https://mini.s-shot.ru/1280x800/PNG/1280/Z100/?" +
                encodeURIComponent(url),
            60000
        );
        return buf;
    } catch (e) {
        errors.push("s-shot: " + e.message);
    }

    // 5) Last resort: google web cache style via image proxy
    try {
        const buf = await fetchBuffer(
            "https://image.thum.io/get/width/1280/" + encodeURIComponent(url),
            60000
        );
        return buf;
    } catch (e) {
        errors.push("thum2: " + e.message);
    }

    throw new Error(errors.join(" | ") || "all screenshot APIs failed");
}

module.exports = {
    name: "ss",
    aliases: ["screenshot", "ssweb", "webss", "capture"],

    run: async function ({ sock, from, args, reply, message }) {
        const prefix = px();
        let raw = (args || []).join(" ").trim();
        let mode = "desktop";

        // flags: full | mobile | phone
        const low = raw.toLowerCase();
        if (/^(full|fp)\s+/i.test(raw)) {
            mode = "full";
            raw = raw.replace(/^(full|fp)\s+/i, "").trim();
        } else if (/^(mobile|phone|m)\s+/i.test(raw)) {
            mode = "mobile";
            raw = raw.replace(/^(mobile|phone|m)\s+/i, "").trim();
        }

        let url = pickUrl(raw);

        // reply to a message that contains a link
        if (!url) {
            url = pickUrl(getQuotedText(message));
        }

        if (!url) {
            return reply(
`╭━━〔 📸 VENOM SS 〕━━⬣

Screenshot any public page / image link.

Usage:
${prefix}ss https://google.com
${prefix}ss full https://example.com
${prefix}ss mobile https://example.com
${prefix}ss example.com

Or reply to a link with ${prefix}ss

• full   = long full-page shot
• mobile = phone width

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        // PDF — can't really "screenshot" as image easily; tip user
        if (isDirectPdf(url)) {
            return reply(
                "📄 That is a PDF link.\nUse `#get " +
                    url +
                    "` to download the file."
            );
        }

        try {
            await reply(
                "📸 Capturing" +
                    (mode === "full" ? " (full page)" : mode === "mobile" ? " (mobile)" : "") +
                    "…\n🔗 " +
                    url
            );

            const buf = await screenshotUrl(url, mode);

            await sock.sendMessage(
                from,
                {
                    image: buf,
                    caption:
`╭━━〔 📸 SCREENSHOT 〕━━⬣
┃
┃ 🔗 ${url}
┃ 📐 Mode: *${mode}*
┃
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );
        } catch (e) {
            return reply(
`╭━━〔 ❌ SS FAILED 〕━━⬣

🔗 ${url}

${String(e.message || e).slice(0, 300)}

• Page may block bots
• Try again or use #get for direct files

╰━━━━━━━━━━━━━━━━⬣`
            );
        }
    }
};
