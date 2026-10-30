"use strict";

const axios = require("axios");

let runYtDlp = null;
try {
    runYtDlp = require("../lib/ytdlp").runYtDlp;
} catch (e) {}

function pickUrl(text) {
    const m = String(text || "").match(
        /(https?:\/\/(?:www\.|vm\.|vt\.|m\.)?tiktok\.com\/[^\s<>"']+)/i
    );
    return m ? m[1].replace(/[),.;]+$/g, "") : null;
}

function cleanUrl(url) {
    url = String(url || "").trim();
    try {
        const u = new URL(url);
        return u.origin + u.pathname;
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
    const hosts = [
        "https://www.tikwm.com/api/",
        "https://tikwm.com/api/"
    ];
    let last = null;
    for (let i = 0; i < hosts.length; i++) {
        try {
            const { data } = await axios.get(hosts[i], {
                params: { url: url, hd: 1 },
                timeout: 30000,
                headers: { "User-Agent": "VENOM-X" }
            });
            if (data && (data.data || data.code === 0)) {
                const t = data.data || data;
                if (t && (t.play || t.hdplay || t.images)) return t;
            }
            last = new Error("tikwm empty");
        } catch (e) {
            last = e;
        }
    }
    throw last || new Error("tikwm failed");
}

async function fromTikmate(url) {
    // public-ish fallback
    const { data } = await axios.get(
        "https://api.tikmate.app/api/lookup?url=" + encodeURIComponent(url),
        {
            timeout: 30000,
            headers: { "User-Agent": "VENOM-X" },
            validateStatus: function () {
                return true;
            }
        }
    );
    if (!data) throw new Error("tikmate empty");
    return {
        title: data.desc || data.title || "",
        author: { nickname: data.author_name || data.author || "Unknown" },
        play: data.video_url || data.video || data.download_url,
        hdplay: data.video_url_nwm || data.video_url,
        music: data.music_url || data.music,
        digg_count: data.likes,
        comment_count: data.comments,
        play_count: data.plays,
        share_count: data.shares,
        duration: data.duration
    };
}

async function fromSnaptikLike(url) {
    // generic third party
    const apis = [
        "https://tikdownloader.io/api/get?url=" + encodeURIComponent(url),
        "https://api.agungbot.my.id/tiktok?url=" + encodeURIComponent(url)
    ];
    let last = null;
    for (let i = 0; i < apis.length; i++) {
        try {
            const { data } = await axios.get(apis[i], {
                timeout: 25000,
                validateStatus: function () {
                    return true;
                },
                headers: { "User-Agent": "VENOM-X" }
            });
            const t = data?.data || data?.result || data;
            if (!t) throw new Error("empty");
            const video =
                t.hdplay ||
                t.play ||
                t.video ||
                t.videoUrl ||
                t.url ||
                t.nowm ||
                t.no_watermark;
            const images = t.images || t.image || null;
            if (video || (Array.isArray(images) && images.length)) {
                return {
                    title: t.title || t.desc || "",
                    author: {
                        nickname:
                            t.author?.nickname ||
                            t.author ||
                            t.nickname ||
                            "Unknown"
                    },
                    play: video,
                    hdplay: t.hdplay || video,
                    music: t.music || t.audio || t.music_url,
                    images: Array.isArray(images) ? images : null,
                    digg_count: t.digg_count || t.likes,
                    comment_count: t.comment_count || t.comments,
                    play_count: t.play_count || t.views,
                    share_count: t.share_count || t.shares,
                    duration: t.duration
                };
            }
        } catch (e) {
            last = e;
        }
    }
    throw last || new Error("fallback apis failed");
}

async function fetchTikTok(url) {
    const errors = [];
    try {
        return await fromTikwm(url);
    } catch (e) {
        errors.push("tikwm: " + e.message);
    }
    try {
        return await fromTikmate(url);
    } catch (e) {
        errors.push("tikmate: " + e.message);
    }
    try {
        return await fromSnaptikLike(url);
    } catch (e) {
        errors.push("alt: " + e.message);
    }
    throw new Error(errors.join(" | "));
}

function buildInfo(t) {
    return (
`╭━━〔 🎵 VENOM X TIKTOK 〕━━⬣
┃
┃ 👤 Author : ${t.author?.nickname || t.author || "Unknown"}
┃ 🌍 Region : ${t.region || "—"}
┃ ❤️ Likes : ${format(t.digg_count)}
┃ 💬 Comments : ${format(t.comment_count)}
┃ 🔁 Shares : ${format(t.share_count)}
┃ 👀 Views : ${format(t.play_count)}
┃ ⏱ Duration : ${t.duration || 0}s
┃ 🎵 Music : ${t.music_info?.title || "Original"}
┃
┃ 📝 Caption
┃ ${String(t.title || t.desc || "No caption").slice(0, 180)}
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
        commandName
    }) {
        let url = pickUrl((args || []).join(" "));

        if (!url) {
            const ctx =
                message?.message?.extendedTextMessage?.contextInfo ||
                message?.message?.imageMessage?.contextInfo ||
                {};
            const q = ctx.quotedMessage;
            if (q) {
                const qt =
                    q.conversation ||
                    q.extendedTextMessage?.text ||
                    q.imageMessage?.caption ||
                    q.videoMessage?.caption ||
                    "";
                url = pickUrl(qt);
            }
        }

        if (!url) {
            return reply(
`╭━━〔 🎵 VENOM X TIKTOK 〕━━⬣
┃
┃ #tt <link>
┃ #ttinfo <link>
┃ #ttmp3 <link>
┃ #ttphoto <link>
┃
┃ Or reply to a TikTok link.
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        url = cleanUrl(url);
        if (!isTikTok(url)) {
            return reply("❌ Invalid TikTok link.");
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

            // last resort: yt-dlp if available
            if (!t && runYtDlp) {
                try {
                    await reply("⏳ APIs failed — trying yt-dlp…");
                    const out = await runYtDlp(url);
                    if (out && out.buffer) {
                        await sock.sendMessage(
                            from,
                            {
                                video: out.buffer,
                                caption: "🎵 TikTok (yt-dlp)\n🔗 " + url
                            },
                            { quoted: message }
                        );
                        try {
                            await sock.sendMessage(from, {
                                react: { text: "✅", key: message.key }
                            });
                        } catch (e) {}
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

            if (!t) {
                throw apiErr || new Error("All TikTok sources failed");
            }

            const info = buildInfo(t);

            if (commandName === "ttinfo") {
                await reply(info);
                return;
            }

            if (commandName === "ttmp3") {
                if (!t.music) return reply("❌ No audio on this TikTok.");
                await reply(info);
                try {
                    const abuf = await downloadBuf(t.music);
                    await sock.sendMessage(
                        from,
                        {
                            audio: abuf,
                            mimetype: "audio/mpeg",
                            ptt: false
                        },
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
            if (!videoUrl) {
                return reply("❌ No video URL returned.");
            }

            // Prefer buffer — WhatsApp often fails on hotlink urls
            try {
                const vbuf = await downloadBuf(videoUrl);
                await sock.sendMessage(
                    from,
                    { video: vbuf, caption: info },
                    { quoted: message }
                );
            } catch (e) {
                console.log("TT buffer fail, url send:", e.message);
                await sock.sendMessage(
                    from,
                    { video: { url: videoUrl }, caption: info },
                    { quoted: message }
                );
            }

            if (t.music) {
                try {
                    const abuf = await downloadBuf(t.music);
                    await sock.sendMessage(
                        from,
                        {
                            audio: abuf,
                            mimetype: "audio/mpeg",
                            ptt: false
                        },
                        { quoted: message }
                    );
                } catch (e) {}
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
`╭━━〔 ❌ VENOM X TIKTOK 〕━━⬣
┃
┃ Failed to process TikTok.
┃
┃ ${String(error.message || error).slice(0, 200)}
┃
┃ • Try full tiktok.com link (not only share)
┃ • Try another video
╰━━━━━━━━━━━━━━━━⬣`
            );
        }
    }
};
