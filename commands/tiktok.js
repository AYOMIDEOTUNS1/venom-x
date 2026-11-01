"use strict";

/**
 * VENOM X - TikTok Downloader (TikWM)
 * #tt | #ttmp4 | #ttmp3 | #ttphoto | #ttinfo
 * API: unchanged (POST tikwm.com)
 */

const axios = require("axios");
const { getSettings } = require("../lib/settingsCache");

const API_ENDPOINTS = [
    "https://www.tikwm.com/api/",
    "https://tikwm.com/api/"
];

const MAX_MEDIA_SIZE = 80 * 1024 * 1024;
const MAX_PHOTOS = 50;

const sleep = function (ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
};

function px() {
    try {
        return getSettings().prefix || "#";
    } catch (e) {
        return "#";
    }
}

function extractUrl(text) {
    const match = String(text || "").match(
        /https?:\/\/(?:www\.|m\.|vm\.|vt\.)?tiktok\.com\/[^\s<>"']+/i
    );
    return match ? match[0].replace(/[),.;!?]+$/g, "") : null;
}

function quotedText(message) {
    try {
        const context =
            message?.message?.extendedTextMessage?.contextInfo ||
            message?.message?.imageMessage?.contextInfo ||
            message?.message?.videoMessage?.contextInfo ||
            message?.message?.documentMessage?.contextInfo ||
            {};

        const quoted = context.quotedMessage;
        if (!quoted) return "";

        return (
            quoted.conversation ||
            quoted.extendedTextMessage?.text ||
            quoted.imageMessage?.caption ||
            quoted.videoMessage?.caption ||
            quoted.documentMessage?.caption ||
            ""
        );
    } catch (e) {
        return "";
    }
}

function format(number) {
    const n = Number(number) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
}

function mediaUrl(value) {
    if (!value || typeof value !== "string") return null;
    try {
        const url = new URL(value, "https://www.tikwm.com/");
        if (url.protocol !== "http:" && url.protocol !== "https:") return null;
        return url.toString();
    } catch (e) {
        return null;
    }
}

function getApiError(data) {
    return (
        data?.msg ||
        data?.message ||
        data?.data?.msg ||
        "TikTok API returned an invalid response."
    );
}

async function tikwm(url) {
    const form = new URLSearchParams();
    form.append("url", url);
    form.append("hd", "1");

    let lastError;

    for (let e = 0; e < API_ENDPOINTS.length; e++) {
        const endpoint = API_ENDPOINTS[e];
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const response = await axios.post(endpoint, form.toString(), {
                    timeout: 45000,
                    maxRedirects: 5,
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
                        "Content-Type":
                            "application/x-www-form-urlencoded",
                        Accept: "application/json"
                    }
                });

                const result = response.data;
                if (result && Number(result.code) === 0 && result.data) {
                    return result.data;
                }
                lastError = new Error(getApiError(result));
                break;
            } catch (error) {
                lastError = error;
                if (attempt < 2) await sleep(1200);
            }
        }
    }

    throw new Error(
        lastError?.response?.status
            ? "TikWM HTTP " + lastError.response.status
            : lastError?.message || "TikWM service unavailable."
    );
}

async function downloadBuf(fileUrl) {
    const url = mediaUrl(fileUrl);
    if (!url) throw new Error("Invalid media URL returned by API.");

    const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 120000,
        maxContentLength: MAX_MEDIA_SIZE,
        maxBodyLength: MAX_MEDIA_SIZE,
        maxRedirects: 5,
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

    const buffer = Buffer.from(response.data || []);
    const contentType = String(
        response.headers["content-type"] || ""
    ).toLowerCase();

    if (!buffer.length) {
        throw new Error("TikTok returned an empty media file.");
    }
    if (buffer.length > MAX_MEDIA_SIZE) {
        throw new Error("Media exceeds the 80MB limit.");
    }
    // reject obvious HTML/JSON error pages only
    if (
        contentType.indexOf("text/html") !== -1 ||
        contentType.indexOf("application/json") !== -1
    ) {
        throw new Error("TikTok returned an error page instead of media.");
    }
    // tiny payloads are almost never valid video/audio
    if (buffer.length < 2000) {
        throw new Error("Media file too small / blocked.");
    }

    return buffer;
}

function caption(t) {
    const author = t.author || {};
    const music = t.music_info || {};

    const authorName = author.nickname || author.unique_id || "Unknown";
    const region = t.region || "Unknown";
    const musicName = music.title || music.author || "Original sound";
    const videoCaption = String(t.title || "No caption")
        .replace(/\r/g, "")
        .slice(0, 500);

    return (
`╭━━〔 🎵 VENOM X TIKTOK 〕━━⬣
┃
┃ 👤 Author : ${authorName}
┃ 🌍 Region : ${region}
┃ ❤️ Likes : ${format(t.digg_count)}
┃ 💬 Comments : ${format(t.comment_count)}
┃ 🔁 Shares : ${format(t.share_count)}
┃ 👀 Views : ${format(t.play_count)}
┃ ⏱ Duration : ${Number(t.duration) || 0}s
┃ 🎵 Music : ${musicName}
┃
┃ 📝 Caption
┃ ${videoCaption}
╰━━━━━━━━━━━━━━━━⬣`
    );
}

function getImageUrl(image) {
    if (typeof image === "string") return mediaUrl(image);
    if (image && typeof image === "object") {
        return mediaUrl(image.url || (image.url_list && image.url_list[0]));
    }
    return null;
}

function pickVideoUrl(t, preferHd) {
    if (preferHd) {
        return t.hdplay || t.play || t.wmplay || null;
    }
    return t.play || t.hdplay || t.wmplay || null;
}

function pickAudioUrl(t) {
    return (t.music_info && t.music_info.play) || t.music || null;
}

function isPhotoPost(t) {
    return Array.isArray(t.images) && t.images.length > 0;
}

async function setReact(sock, message, emoji) {
    try {
        await sock.sendMessage(message.key.remoteJid || message.key.remoteJid, {
            react: { text: emoji, key: message.key }
        });
    } catch (e) {
        try {
            await sock.sendMessage(message.key.remoteJid, {
                react: { text: emoji, key: message.key }
            });
        } catch (err) {}
    }
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
        const cmd = String(commandName || "tiktok").toLowerCase();

        const url =
            extractUrl((args || []).join(" ")) ||
            extractUrl(body || "") ||
            extractUrl(quotedText(message));

        if (!url) {
            return reply(
`╭━━〔 🎵 VENOM X TIKTOK 〕━━⬣

${prefix}tt <link>       Video
${prefix}ttmp4 <link>    HD MP4
${prefix}ttmp3 <link>    Audio
${prefix}ttphoto <link>  Photos
${prefix}ttinfo <link>   Info

Reply to a TikTok link + ${prefix}tt

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        try {
            await sock.sendMessage(from, {
                react: { text: "⏳", key: message.key }
            });
        } catch (e) {}

        try {
            await reply("⏳ Fetching TikTok media…");

            const t = await tikwm(url);
            const cap = caption(t);

            // ── INFO
            if (cmd === "ttinfo") {
                return reply(cap);
            }

            // ── AUDIO
            if (cmd === "ttmp3") {
                const audioUrl = pickAudioUrl(t);
                if (!audioUrl) {
                    throw new Error("No audio is available for this post.");
                }
                const audio = await downloadBuf(audioUrl);
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
                await reply(cap);
                try {
                    await sock.sendMessage(from, {
                        react: { text: "🎵", key: message.key }
                    });
                } catch (e) {}
                return;
            }

            // ── PHOTOS (explicit or slideshow post)
            const wantPhoto = cmd === "ttphoto";
            const photoPost = isPhotoPost(t);

            if (wantPhoto && !photoPost) {
                throw new Error("This TikTok post has no photo slideshow.");
            }

            if (wantPhoto || (photoPost && cmd !== "ttmp4" && cmd !== "tt")) {
                // ttphoto always photos; pure photo posts also go here for #tt
            }

            if (wantPhoto || (photoPost && (cmd === "ttphoto" || cmd === "tt" || cmd === "tiktok"))) {
                if (photoPost) {
                    const images = t.images
                        .map(getImageUrl)
                        .filter(Boolean)
                        .slice(0, MAX_PHOTOS);

                    if (!images.length) {
                        throw new Error("No valid photo URLs were returned.");
                    }

                    await reply(
                        cap + "\n\n📸 Photos : " + images.length + "/" + MAX_PHOTOS
                    );

                    for (let i = 0; i < images.length; i++) {
                        const image = await downloadBuf(images[i]);
                        await sock.sendMessage(
                            from,
                            {
                                image: image,
                                caption:
                                    "╭━━〔 📸 VENOM X PHOTO 〕━━⬣\n" +
                                    "┃ Photo : " +
                                    (i + 1) +
                                    "/" +
                                    images.length +
                                    "\n" +
                                    "╰━━━━━━━━━━━━━━━━⬣"
                            },
                            { quoted: message }
                        );
                        if (i < images.length - 1) await sleep(350);
                    }

                    try {
                        await sock.sendMessage(from, {
                            react: { text: "✅", key: message.key }
                        });
                    } catch (e) {}
                    return;
                }
            }

            // ── VIDEO (#tt / #ttmp4)
            const preferHd = cmd === "ttmp4" || cmd === "tt" || cmd === "tiktok";
            const videoUrl = pickVideoUrl(t, preferHd);
            if (!videoUrl) {
                throw new Error("No downloadable video was returned.");
            }

            const video = await downloadBuf(videoUrl);
            await sock.sendMessage(
                from,
                {
                    video: video,
                    caption: cap,
                    mimetype: "video/mp4",
                    fileName: "VENOM-TIKTOK.mp4"
                },
                { quoted: message }
            );

            // optional music attach for normal #tt (not forced)
            if (cmd === "tt" || cmd === "tiktok") {
                const audioUrl = pickAudioUrl(t);
                if (audioUrl) {
                    try {
                        const audio = await downloadBuf(audioUrl);
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
                    } catch (e) {
                        // ignore audio attach failures
                    }
                }
            }

            try {
                await sock.sendMessage(from, {
                    react: { text: "✅", key: message.key }
                });
            } catch (e) {}
        } catch (error) {
            console.error(
                "[VENOM TIKTOK ERROR]",
                error.response?.status || "",
                error.message
            );

            try {
                await sock.sendMessage(from, {
                    react: { text: "❌", key: message.key }
                });
            } catch (e) {}

            return reply(
`╭━━〔 ❌ TIKTOK ERROR 〕━━⬣

${String(error.message || error).slice(0, 250)}

Link:
${url}

Try another link or wait a bit.

╰━━━━━━━━━━━━━━━━⬣`
            );
        }
    }
};
