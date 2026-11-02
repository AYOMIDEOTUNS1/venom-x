"use strict";

const axios = require("axios");
const { getSettings } = require("../lib/settingsCache");

const API = ["https://www.tikwm.com/api/", "https://tikwm.com/api/"];

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

function fmt(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
}

async function tikwm(url) {
    const body = new URLSearchParams();
    body.set("url", url);
    body.set("hd", "1");

    let last = null;
    for (let i = 0; i < API.length; i++) {
        try {
            const res = await axios.post(API[i], body.toString(), {
                timeout: 45000,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "Mozilla/5.0",
                    Accept: "application/json"
                }
            });
            const data = res.data;
            if (data && Number(data.code) === 0 && data.data) return data.data;
            last = new Error((data && (data.msg || data.message)) || "API error");
        } catch (e) {
            last = e;
        }
    }
    throw last || new Error("TikWM failed");
}

async function dl(fileUrl) {
    if (!fileUrl || typeof fileUrl !== "string") throw new Error("No media URL");
    const res = await axios.get(fileUrl, {
        responseType: "arraybuffer",
        timeout: 120000,
        maxContentLength: 80 * 1024 * 1024,
        headers: {
            "User-Agent": "Mozilla/5.0",
            Referer: "https://www.tiktok.com/"
        },
        validateStatus: function (s) {
            return s >= 200 && s < 400;
        }
    });
    const buf = Buffer.from(res.data || []);
    if (buf.length < 2000) throw new Error("Empty media");
    return buf;
}

function buildCaption(t) {
    const a = t.author || {};
    const music = t.music_info || {};

    const nickname = a.nickname || "Unknown";
    const uniqueId = a.unique_id || a.uniqueId || a.id || "unknown";
    const region = t.region || "Unknown";
    const musicName = music.title || music.author || "Original sound";
    const videoCaption = String(t.title || "No caption")
        .replace(/\r/g, "")
        .trim()
        .slice(0, 500);

    return (
`╭━━〔 🎵 VENOM X TIKTOK 〕━━⬣
┃
┃ 👤 Author : ${nickname}
┃ 🆔 ID : @${uniqueId}
┃ 🌍 Region : ${region}
┃
┃ ❤️ Likes : ${fmt(t.digg_count)}
┃ 💬 Comments : ${fmt(t.comment_count)}
┃ 🔁 Shares : ${fmt(t.share_count)}
┃ 👀 Views : ${fmt(t.play_count)}
┃ ⏱ Duration : ${Number(t.duration) || 0}s
┃ 🎵 Music : ${musicName}
┃
┃ 📝 Caption
┃ ${videoCaption}
┃
┃ 🔗 https://www.tiktok.com/@${uniqueId}
╰━━━━━━━━━━━━━━━━⬣`
    );
}

module.exports = {
    name: "tiktok",
    aliases: ["tt", "ttmp3", "ttmp4", "ttphoto", "ttinfo"],

    run: async function ({
        sock,
        from,
        args,
        reply,
        message,
        commandName,
        body
    }) {
        const cmd = String(commandName || "tt").toLowerCase();
        const url =
            extractUrl((args || []).join(" ")) ||
            extractUrl(body) ||
            extractUrl(quotedText(message));

        if (!url) {
            return reply(
`╭━━〔 🎵 VENOM X TIKTOK 〕━━⬣

${px()}tt <link>       Video
${px()}ttmp4 <link>    HD video
${px()}ttmp3 <link>    Audio
${px()}ttphoto <link>  Photos
${px()}ttinfo <link>   Info only

Reply to a link + ${px()}tt

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        try {
            await sock.sendMessage(from, {
                react: { text: "⏳", key: message.key }
            });
        } catch (e) {}

        try {
            await reply("⏳ Fetching TikTok…");
            const t = await tikwm(url);
            const text = buildCaption(t);

            if (cmd === "ttinfo") {
                return reply(text);
            }

            if (cmd === "ttmp3") {
                const music = (t.music_info && t.music_info.play) || t.music;
                if (!music) throw new Error("No audio on this post");
                const audio = await dl(music);
                await sock.sendMessage(
                    from,
                    {
                        audio: audio,
                        mimetype: "audio/mpeg",
                        fileName: "VENOM-TIKTOK.mp3",
                        ptt: false
                    },
                    { quoted: message }
                );
                return reply(text);
            }

            if (
                cmd === "ttphoto" ||
                (Array.isArray(t.images) &&
                    t.images.length &&
                    cmd !== "ttmp4" &&
                    cmd !== "tt")
            ) {
                // explicit ttphoto only here; #tt prefers video below
            }

            if (cmd === "ttphoto") {
                if (!Array.isArray(t.images) || !t.images.length) {
                    throw new Error("No photo slideshow on this post");
                }
                await reply(text);
                for (let i = 0; i < Math.min(t.images.length, 30); i++) {
                    const u =
                        typeof t.images[i] === "string"
                            ? t.images[i]
                            : t.images[i] &&
                              (t.images[i].url ||
                                  (t.images[i].url_list &&
                                      t.images[i].url_list[0]));
                    if (!u) continue;
                    const img = await dl(u);
                    await sock.sendMessage(
                        from,
                        {
                            image: img,
                            caption: "📸 " + (i + 1) + "/" + t.images.length
                        },
                        { quoted: message }
                    );
                }
                return;
            }

            // slideshow-only posts (no video)
            if (
                (!t.hdplay && !t.play && !t.wmplay) &&
                Array.isArray(t.images) &&
                t.images.length
            ) {
                await reply(text);
                for (let i = 0; i < Math.min(t.images.length, 30); i++) {
                    const u =
                        typeof t.images[i] === "string"
                            ? t.images[i]
                            : t.images[i] && t.images[i].url;
                    if (!u) continue;
                    const img = await dl(u);
                    await sock.sendMessage(
                        from,
                        { image: img },
                        { quoted: message }
                    );
                }
                return;
            }

            const vurl = t.hdplay || t.play || t.wmplay;
            if (!vurl) throw new Error("No video URL");

            const video = await dl(vurl);
            await sock.sendMessage(
                from,
                {
                    video: video,
                    caption: text,
                    mimetype: "video/mp4",
                    fileName: "VENOM-TIKTOK.mp4"
                },
                { quoted: message }
            );

            try {
                await sock.sendMessage(from, {
                    react: { text: "✅", key: message.key }
                });
            } catch (e) {}
        } catch (err) {
            console.error("TIKTOK ERROR:", err.message);
            try {
                await sock.sendMessage(from, {
                    react: { text: "❌", key: message.key }
                });
            } catch (e) {}
            return reply(
                "❌ TikTok failed:\n" +
                    String(err.message || err).slice(0, 240) +
                    "\n\n" +
                    url
            );
        }
    }
};
