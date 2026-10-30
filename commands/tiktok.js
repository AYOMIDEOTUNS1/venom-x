"use strict";

const axios = require("axios");

let runYtDlp = null;
try {
    runYtDlp = require("../lib/ytdlp").runYtDlp;
} catch (e) {}

function extractTikTokUrl(text) {
    text = String(text || "");
    // full + short links
    const patterns = [
        /https?:\/\/(?:www\.|m\.|vm\.|vt\.)?tiktok\.com\/[^\s<>"'）】\]]+/i,
        /https?:\/\/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/i,
        /https?:\/\/vm\.tiktok\.com\/[\w]+\/?/i,
        /https?:\/\/vt\.tiktok\.com\/[\w]+\/?/i
    ];
    for (let i = 0; i < patterns.length; i++) {
        const m = text.match(patterns[i]);
        if (m) return m[0].replace(/[),.;!?]+$/g, "");
    }
    return null;
}

function deepText(message) {
    if (!message) return "";
    const chunks = [];

    function walk(obj, depth) {
        if (!obj || depth > 8) return;
        if (typeof obj === "string") {
            chunks.push(obj);
            return;
        }
        if (typeof obj !== "object") return;
        const keys = [
            "conversation",
            "text",
            "caption",
            "selectedDisplayText",
            "selectedButtonId",
            "description",
            "title",
            "matchedText",
            "canonicalUrl",
            "matchedText"
        ];
        for (let k = 0; k < keys.length; k++) {
            if (typeof obj[keys[k]] === "string") chunks.push(obj[keys[k]]);
        }
        // contextInfo.quotedMessage
        if (obj.contextInfo && obj.contextInfo.quotedMessage) {
            walk(obj.contextInfo.quotedMessage, depth + 1);
        }
        if (obj.quotedMessage) walk(obj.quotedMessage, depth + 1);
        if (obj.message) walk(obj.message, depth + 1);
        // common wrappers
        const wraps = [
            "extendedTextMessage",
            "imageMessage",
            "videoMessage",
            "documentMessage",
            "ephemeralMessage",
            "viewOnceMessage",
            "viewOnceMessageV2"
        ];
        for (let i = 0; i < wraps.length; i++) {
            if (obj[wraps[i]]) walk(obj[wraps[i]], depth + 1);
        }
    }

    walk(message.message || message, 0);
    return chunks.join("\n");
}

function cleanUrl(url) {
    url = String(url || "").trim();
    try {
        const u = new URL(url);
        // keep path; drop tracking query except rare cases
        return u.origin + u.pathname.replace(/\/$/, "") + "/";
    } catch (e) {
        return url.split("?")[0].split("#")[0];
    }
}

function isTikTok(url) {
    return /tiktok\.com/i.test(url || "");
}

function format(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
}

async function downloadBuf(url) {
    const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 120000,
        maxContentLength: 80 * 1024 * 1024,
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            Referer: "https://www.tiktok.com/"
        }
    });
    const buf = Buffer.from(res.data || []);
    if (buf.length < 1000) throw new Error("empty media");
    return buf;
}

async function fromTikwm(url) {
    const hosts = ["https://www.tikwm.com/api/", "https://tikwm.com/api/"];
    let last = null;
    for (let i = 0; i < hosts.length; i++) {
        try {
            const { data } = await axios.get(hosts[i], {
                params: { url: url, hd: 1 },
                timeout: 35000,
                headers: { "User-Agent": "VENOM-X" }
            });
            const t = data && (data.data || data);
            if (t && (t.play || t.hdplay || (t.images && t.images.length))) {
                return t;
            }
            last = new Error("tikwm empty payload");
        } catch (e) {
            last = e;
        }
    }
    throw last || new Error("tikwm failed");
}

async function fetchTikTok(url) {
    const errors = [];
    try {
        return await fromTikwm(url);
    } catch (e) {
        errors.push("tikwm: " + e.message);
    }

    // secondary simple APIs
    const alts = [
        "https://api.agungbot.my.id/tiktok?url=" + encodeURIComponent(url)
    ];
    for (let i = 0; i < alts.length; i++) {
        try {
            const { data } = await axios.get(alts[i], {
                timeout: 25000,
                validateStatus: function () {
                    return true;
                }
            });
            const t = data?.data || data?.result || data;
            const video =
                t?.hdplay || t?.play || t?.video || t?.url || t?.nowm;
            if (video || (t && t.images)) {
                return {
                    title: t.title || t.desc || "",
                    author: {
                        nickname: t.author?.nickname || t.author || "Unknown"
                    },
                    play: video,
                    hdplay: t.hdplay || video,
                    music: t.music || t.audio,
                    images: t.images || null,
                    digg_count: t.digg_count || t.likes,
                    comment_count: t.comment_count || t.comments,
                    play_count: t.play_count || t.views,
                    share_count: t.share_count,
                    duration: t.duration
                };
            }
        } catch (e) {
            errors.push("alt: " + e.message);
        }
    }

    throw new Error(errors.join(" | "));
}

function buildInfo(t) {
    return (
`╭━━〔 🎵 VENOM X TIKTOK 〕━━⬣
┃
┃ 👤 Author : ${t.author?.nickname || t.author || "Unknown"}
┃ ❤️ Likes : ${format(t.digg_count)}
┃ 💬 Comments : ${format(t.comment_count)}
┃ 👀 Views : ${format(t.play_count)}
┃ ⏱ Duration : ${t.duration || 0}s
┃
┃ 📝 ${String(t.title || t.desc || "No caption").slice(0, 180)}
╰━━━━━━━━━━━━━━━━⬣`
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
        // 1) args
        let url = extractTikTokUrl((args || []).join(" "));

        // 2) full command body (prefix + tt + link)
        if (!url) url = extractTikTokUrl(body || "");

        // 3) deep scan message + quoted
        if (!url) url = extractTikTokUrl(deepText(message));

        if (!url) {
            return reply(
`╭━━〔 🎵 VENOM X TIKTOK 〕━━⬣
┃
┃ No TikTok URL found.
┃
┃ Send:
┃ #tt https://vm.tiktok.com/xxxxx
┃ #tt https://www.tiktok.com/@user/video/123
┃
┃ Or *reply* to a TikTok link with #tt
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        url = cleanUrl(url);
        if (!isTikTok(url)) {
            return reply("❌ Invalid TikTok link.\nGot: " + url);
        }

        try {
            await sock.sendMessage(from, {
                react: { text: "⏳", key: message.key }
            });
        } catch (e) {}

        try {
            let t = null;
            let apiErr = null;
            try {
                t = await fetchTikTok(url);
            } catch (e) {
                apiErr = e;
            }

            if (!t && runYtDlp) {
                try {
                    await reply("⏳ APIs failed — yt-dlp…");
                    const out = await runYtDlp(url);
                    if (out && out.buffer) {
                        await sock.sendMessage(
                            from,
                            {
                                video: out.buffer,
                                caption: "🎵 TikTok\n" + url
                            },
                            { quoted: message }
                        );
                        return;
                    }
                } catch (e) {
                    apiErr = new Error(
                        (apiErr ? apiErr.message + " | " : "") +
                            "ytdlp: " +
                            e.message
                    );
                }
            }

            if (!t) throw apiErr || new Error("All sources failed");

            const info = buildInfo(t);

            if (commandName === "ttinfo") {
                return reply(info);
            }

            if (commandName === "ttmp3") {
                if (!t.music) return reply("❌ No audio.");
                await reply(info);
                try {
                    const abuf = await downloadBuf(t.music);
                    await sock.sendMessage(
                        from,
                        { audio: abuf, mimetype: "audio/mpeg", ptt: false },
                        { quoted: message }
                    );
                } catch (e) {
                    await sock.sendMessage(
                        from,
                        {
                            audio: { url: t.music },
                            mimetype: "audio/mpeg",
                            ptt: false
                        },
                        { quoted: message }
                    );
                }
                return;
            }

            const images = Array.isArray(t.images) ? t.images : null;
            if (commandName === "ttphoto" || (images && images.length)) {
                if (!images || !images.length) {
                    return reply("❌ Not a photo slideshow.");
                }
                await reply(info);
                for (let i = 0; i < images.length; i++) {
                    try {
                        const ibuf = await downloadBuf(images[i]);
                        await sock.sendMessage(
                            from,
                            { image: ibuf },
                            { quoted: message }
                        );
                    } catch (e) {
                        await sock.sendMessage(
                            from,
                            { image: { url: images[i] } },
                            { quoted: message }
                        );
                    }
                }
                return;
            }

            const videoUrl = t.hdplay || t.play || t.video || t.nowm;
            if (!videoUrl) return reply("❌ No video URL.");

            try {
                const vbuf = await downloadBuf(videoUrl);
                await sock.sendMessage(
                    from,
                    { video: vbuf, caption: info },
                    { quoted: message }
                );
            } catch (e) {
                await sock.sendMessage(
                    from,
                    { video: { url: videoUrl }, caption: info },
                    { quoted: message }
                );
            }

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
┃
┃ ${String(error.message || error).slice(0, 220)}
┃
┃ Link used:
┃ ${url}
╰━━━━━━━━━━━━━━━━⬣`
            );
        }
    }
};
