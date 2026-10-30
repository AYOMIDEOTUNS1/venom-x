"use strict";

/**
 * VENOM X - #ss
 * Website screenshot
 * #ss https://example.com
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
    if (m) return m[0].replace(/[),.;]+$/, "");
    // allow domain without protocol
    const d = String(text || "").trim().split(/\s+/)[0];
    if (d && /^[\w.-]+\.[a-z]{2,}/i.test(d)) return "https://" + d;
    return null;
}

async function shot(url) {
    const apis = [
        // thum.io
        function () {
            return axios.get(
                "https://image.thum.io/get/width/1200/crop/900/" +
                    encodeURIComponent(url),
                {
                    responseType: "arraybuffer",
                    timeout: 45000,
                    headers: { "User-Agent": "VENOM-X" }
                }
            );
        },
        // microlink
        async function () {
            const meta = await axios.get("https://api.microlink.io", {
                params: {
                    url: url,
                    screenshot: true,
                    meta: false,
                    embed: "screenshot.url"
                },
                timeout: 45000
            });
            const shotUrl =
                meta.data &&
                meta.data.data &&
                meta.data.data.screenshot &&
                meta.data.data.screenshot.url;
            if (!shotUrl) throw new Error("microlink empty");
            return axios.get(shotUrl, {
                responseType: "arraybuffer",
                timeout: 45000
            });
        }
    ];

    let last = null;
    for (let i = 0; i < apis.length; i++) {
        try {
            const res = await apis[i]();
            const buf = Buffer.from(res.data || []);
            if (buf.length > 1000) return buf;
        } catch (e) {
            last = e;
        }
    }
    throw last || new Error("Screenshot failed");
}

module.exports = {
    name: "ss",
    aliases: ["screenshot", "ssweb", "webss"],

    run: async function ({ sock, from, args, reply, message }) {
        const prefix = px();
        const url = pickUrl((args || []).join(" "));

        if (!url) {
            return reply(
`╭━━〔 📸 VENOM SS 〕━━⬣

Usage:
${prefix}ss https://google.com
${prefix}screenshot example.com

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        try {
            await reply("📸 Capturing page...");
            const buf = await shot(url);
            await sock.sendMessage(
                from,
                {
                    image: buf,
                    caption:
`╭━━〔 📸 SCREENSHOT 〕━━⬣
┃
┃ 🔗 ${url}
┃
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );
        } catch (e) {
            return reply(
                "❌ Screenshot failed:\n" + String(e.message || e).slice(0, 200)
            );
        }
    }
};
