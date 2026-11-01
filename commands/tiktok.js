"use strict";

/**
 * VENOM X - TikTok Download (tikwm)
 * #tt <link> | #ttmp3 <link> | #ttphoto <link> | #ttinfo <link>
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

function extractUrl(text) {
    const m = String(text || "").match(
        /https?:\/\/(?:www\.|m\.|vm\.|vt\.)?tiktok\.com\/[^\s<>"']+/i
    );
    return m ? m[0].replace(/[),.;!?]+$/g, "") : null;
}

function quotedText(message) {
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
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
                    Accept: "application/json"
                }
            });

            if (data && Number(data.code) === 0 && data.data) {
                return data.data;
            }
            last = new Error(
                (data && (data.msg || data.message)) || "tikwm bad response"
            );
        } catch (e) {
            last = e;
        }
    }
    throw last || new Error("tikwm failed");
}

async function downloadBuf(fileUrl) {
    const res = await axios.get(fileUrl, {
        responseType: "arraybuffer",
        timeout: 120000,
        maxContentLength: 80 * 1024 * 1024,
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            Referer: "https://www.tiktok.com/",
            Accept: "*/*"
        },
        validateStatus: function (s) {
            return s >= 200 && s < 400;
        }
    });
    const buf = Buffer.from(res.data || []);
    if (buf.length < 1500) throw new Error("empty media");
    return buf;
}

function caption(t) {
    return (
        "╭━━〔 🎵 TIKTOK 〕━━⬣\n" +
        "┃ 👤 " +
        (t.author?.nickname || "Unknown") +
        "\n" +
        "┃ ❤️ " +
        format(t.digg_count) +
        " · 💬 " +
        format(t.comment_count) +
        " · 👀 " +
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
    aliases: ["tt", "ttinfo", "ttphoto", "ttmp3", "ttmp4"],

    run: async function ({
        sock,
        from,
        args,
        reply,
        message,
        commandName,
        body
    }) {
        const prefix = px();

        let url =
            extractUrl((args || []).join(" ")) ||
            extractUrl(body || "") ||
            extractUrl(quotedText(message));

        if (!url) {
            return reply(
`╭━━〔 🎵 VENOM X TIKTOK 〕━━⬣

Download a TikTok video / audio:

${prefix}tt <link>
${prefix}ttmp3 <link>
${prefix}ttphoto <link>
${prefix}ttinfo <link>

Or reply to a TikTok link with ${prefix}tt

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        url = String(url).trim();

        try {
            await sock.sendMessage(from, {
                react: { text: "⏳", key: message.key }
            });
        } catch (e) {}

        try {
            await reply("⏳ Fetching TikTok…");
            const t = await tikwm(url);
            const cap = caption(t);

            // INFO
            if (commandName === "ttinfo") {
                return reply(cap);
            }

            // AUDIO
            if (commandName === "ttmp3") {
                if (!t.music) return reply("❌ No audio on this post.");
                const abuf = await downloadBuf(t.music);
                await sock.sendMessage(
                    from,
                    {
                        audio: abuf,
                        mimetype: "audio/mpeg",
                        ptt: false,
                        fileName: "tiktok.mp3"
                    },
                    { quoted: message }
                );
                return reply(cap);
            }

            // PHOTO SLIDESHOW
            if (
                commandName === "ttphoto" ||
                (Array.isArray(t.images) && t.images.length)
            ) {
                if (!Array.isArray(t.images) || !t.images.length) {
                    // fall through to video if not photos
                } else {
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
                    try {
                        await sock.sendMessage(from, {
                            react: { text: "✅", key: message.key }
                        });
                    } catch (e) {}
                    return;
                }
            }

            // VIDEO
            const videoUrl = t.hdplay || t.play || t.wmplay;
            if (!videoUrl) {
                return reply("❌ No video URL from TikTok API.");
            }

            const vbuf = await downloadBuf(videoUrl);
            await sock.sendMessage(
                from,
                {
                    video: vbuf,
                    caption: cap,
                    mimetype: "video/mp4"
                },
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
`╭━━〔 ❌ TIKTOK 〕━━⬣

${String(error.message || error).slice(0, 220)}

Link:
${url}

Try another link or full tiktok.com URL.

╰━━━━━━━━━━━━━━━━⬣`
            );
        }
    }
};
