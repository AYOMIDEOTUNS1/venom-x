"use strict";

const axios = require("axios");

function extractTikTokUrl(text) {
    text = String(text || "");
    const m = text.match(
        /https?:\/\/(?:www\.|m\.|vm\.|vt\.)?tiktok\.com\/[^\s<>"']+/i
    );
    if (!m) return null;
    return m[0].replace(/[),.;!?]+$/g, "");
}

function getQuotedText(message) {
    try {
        const ctx =
            message?.message?.extendedTextMessage?.contextInfo ||
            message?.message?.imageMessage?.contextInfo ||
            message?.message?.videoMessage?.contextInfo ||
            {};
        const q = ctx.quotedMessage;
        if (!q) return "";
        return (
            q.conversation ||
            q.extendedTextMessage?.text ||
            q.imageMessage?.caption ||
            q.videoMessage?.caption ||
            q.externalAdReply?.sourceUrl ||
            ""
        );
    } catch (e) {
        return "";
    }
}

function format(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
}

async function downloadBuf(fileUrl) {
    const res = await axios.get(fileUrl, {
        responseType: "arraybuffer",
        timeout: 120000,
        maxContentLength: 80 * 1024 * 1024,
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Referer: "https://www.tiktok.com/",
            Accept: "*/*"
        },
        validateStatus: function (s) {
            return s >= 200 && s < 400;
        }
    });
    const buf = Buffer.from(res.data || []);
    if (buf.length < 2000) throw new Error("media too small");
    return buf;
}

async function tikwm(url) {
    const endpoints = [
        "https://www.tikwm.com/api/",
        "https://tikwm.com/api/"
    ];
    let last = null;
    for (let i = 0; i < endpoints.length; i++) {
        try {
            const { data } = await axios.get(endpoints[i], {
                params: { url: url, hd: 1 },
                timeout: 40000,
                headers: {
                    "User-Agent": "Mozilla/5.0",
                    Accept: "application/json"
                }
            });
            // tikwm: { code: 0, data: { play, hdplay, ... } }
            if (data && Number(data.code) === 0 && data.data) {
                return data.data;
            }
            if (data && data.data && (data.data.play || data.data.hdplay)) {
                return data.data;
            }
            last = new Error(
                "tikwm: " + (data && data.msg ? data.msg : "bad response")
            );
        } catch (e) {
            last = e;
        }
    }
    throw last || new Error("tikwm failed");
}

async function dlpearl(url) {
    const { data } = await axios.get(
        "https://dl.kuku.lu/api/tiktok?url=" + encodeURIComponent(url),
        {
            timeout: 30000,
            validateStatus: function () {
                return true;
            }
        }
    );
    const d = data?.data || data?.result || data;
    if (!d) throw new Error("empty");
    const play = d.play || d.video || d.nwm || d.url;
    if (!play && !(d.images && d.images.length)) throw new Error("no media");
    return {
        title: d.title || d.desc || "",
        author: { nickname: d.author?.nickname || d.author || "Unknown" },
        play: play,
        hdplay: d.hdplay || play,
        music: d.music || d.audio,
        images: d.images || null,
        digg_count: d.digg_count || d.likes,
        comment_count: d.comment_count,
        play_count: d.play_count || d.views,
        duration: d.duration
    };
}

async function fetchMeta(url) {
    const errors = [];
    try {
        return await tikwm(url);
    } catch (e) {
        errors.push("tikwm: " + (e.message || e));
    }
    try {
        return await dlpearl(url);
    } catch (e) {
        errors.push("alt: " + (e.message || e));
    }
    throw new Error(errors.join(" | "));
}

function infoCap(t) {
    return (
        "╭━━〔 🎵 TIKTOK 〕━━⬣\n" +
        "┃ 👤 " +
        (t.author?.nickname || t.author || "Unknown") +
        "\n" +
        "┃ ❤️ " +
        format(t.digg_count) +
        "  💬 " +
        format(t.comment_count) +
        "  👀 " +
        format(t.play_count) +
        "\n" +
        "┃ 📝 " +
        String(t.title || "").slice(0, 160) +
        "\n" +
        "╰━━━━━━━━━━━━━━━━⬣"
    );
}

module.exports = {
    name: "tiktok",
    aliases: ["tt", "ttinfo", "ttphoto", "ttmp3"],

    run: async function ({
        sock,
        from,
        args,
        reply,
        message,
        commandName,
        body
    }) {
        let url =
            extractTikTokUrl((args || []).join(" ")) ||
            extractTikTokUrl(body || "") ||
            extractTikTokUrl(getQuotedText(message));

        if (!url) {
            return reply(
                "╭━━〔 🎵 TIKTOK 〕━━⬣\n┃\n┃ Usage:\n┃ #tt <tiktok link>\n┃ Reply to a link + #tt\n┃\n╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        // IMPORTANT: do NOT force trailing slash / strip short-link path badly
        url = url.trim();

        try {
            await sock.sendMessage(from, {
                react: { text: "⏳", key: message.key }
            });
        } catch (e) {}

        try {
            await reply("⏳ Fetching TikTok…");
            const t = await fetchMeta(url);
            const cap = infoCap(t);

            if (commandName === "ttinfo") {
                return reply(cap);
            }

            if (commandName === "ttmp3") {
                if (!t.music) return reply("❌ No audio.");
                const abuf = await downloadBuf(t.music);
                await sock.sendMessage(
                    from,
                    { audio: abuf, mimetype: "audio/mpeg", ptt: false },
                    { quoted: message }
                );
                return reply(cap);
            }

            if (
                commandName === "ttphoto" ||
                (Array.isArray(t.images) && t.images.length)
            ) {
                if (!t.images || !t.images.length) {
                    return reply("❌ Not a photo post.");
                }
                await reply(cap);
                for (let i = 0; i < t.images.length; i++) {
                    try {
                        const ib = await downloadBuf(t.images[i]);
                        await sock.sendMessage(
                            from,
                            { image: ib },
                            { quoted: message }
                        );
                    } catch (e) {}
                }
                return;
            }

            const videoUrl = t.hdplay || t.play || t.wmplay;
            if (!videoUrl) return reply("❌ No video in API response.");

            const vbuf = await downloadBuf(videoUrl);
            await sock.sendMessage(
                from,
                { video: vbuf, caption: cap },
                { quoted: message }
            );

            try {
                await sock.sendMessage(from, {
                    react: { text: "✅", key: message.key }
                });
            } catch (e) {}
        } catch (error) {
            console.error("TIKTOK ERROR:", error.message);
            try {
                await sock.sendMessage(from, {
                    react: { text: "❌", key: message.key }
                });
            } catch (e) {}
            return reply(
                "╭━━〔 ❌ TIKTOK 〕━━⬣\n┃\n┃ " +
                    String(error.message || error).slice(0, 240) +
                    "\n┃\n┃ Link:\n┃ " +
                    url +
                    "\n╰━━━━━━━━━━━━━━━━⬣"
            );
        }
    }
};
