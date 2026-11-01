"use strict";

/**
 * VENOM X - TikTok Downloader
 * #tt <link>
 * #ttmp4 <link>
 * #ttmp3 <link>
 * #ttphoto <link>
 * #ttinfo <link>
 */

const axios = require("axios");
const { getSettings } = require("../lib/settingsCache");

const API_ENDPOINTS = [
    "https://www.tikwm.com/api/",
    "https://tikwm.com/api/"
];

const MAX_MEDIA_SIZE = 80 * 1024 * 1024;
const MAX_PHOTOS = 10;

function px() {
    try {
        return getSettings().prefix || "#";
    } catch {
        return "#";
    }
}

function extractUrl(text) {
    const match = String(text || "").match(
        /https?:\/\/(?:www\.|m\.|vm\.|vt\.)?tiktok\.com\/[^\s<>"']+/i
    );

    return match
        ? match[0].replace(/[),.;!?]+$/g, "")
        : null;
}

function quotedText(message) {
    try {
        const context =
            message?.message?.extendedTextMessage?.contextInfo ||
            message?.message?.imageMessage?.contextInfo ||
            message?.message?.videoMessage?.contextInfo ||
            {};

        const quoted = context.quotedMessage;
        if (!quoted) return "";

        return (
            quoted.conversation ||
            quoted.extendedTextMessage?.text ||
            quoted.imageMessage?.caption ||
            quoted.videoMessage?.caption ||
            ""
        );
    } catch {
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

        if (url.protocol !== "https:") {
            throw new Error("Invalid media URL protocol");
        }

        return url.toString();
    } catch {
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

    for (const endpoint of API_ENDPOINTS) {
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const response = await axios.post(
                    endpoint,
                    form.toString(),
                    {
                        timeout: 45000,
                        maxRedirects: 5,
                        headers: {
                            "User-Agent":
                                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
                            "Content-Type":
                                "application/x-www-form-urlencoded",
                            Accept: "application/json"
                        }
                    }
                );

                const result = response.data;

                if (
                    result &&
                    Number(result.code) === 0 &&
                    result.data
                ) {
                    return result.data;
                }

                lastError = new Error(getApiError(result));

                // Do not retry invalid or unavailable TikTok links.
                break;
            } catch (error) {
                lastError = error;

                if (attempt < 2) {
                    await new Promise(resolve =>
                        setTimeout(resolve, 1200)
                    );
                }
            }
        }
    }

    throw new Error(
        lastError?.response?.status
            ? `TikWM HTTP ${lastError.response.status}`
            : lastError?.message || "TikWM service unavailable."
    );
}

async function downloadBuf(fileUrl, expectedType) {
    const url = mediaUrl(fileUrl);

    if (!url) {
        throw new Error("Invalid media URL returned by API.");
    }

    const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 120000,
        maxContentLength: MAX_MEDIA_SIZE,
        maxBodyLength: MAX_MEDIA_SIZE,
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            Referer: "https://www.tiktok.com/",
            Accept: "*/*"
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

    if (
        contentType.includes("text/html") ||
        contentType.includes("application/json")
    ) {
        throw new Error("TikTok returned an error instead of media.");
    }

    if (
        expectedType &&
        contentType &&
        !contentType.includes(expectedType) &&
        !contentType.includes("octet-stream")
    ) {
        throw new Error("Unexpected media format: " + contentType);
    }

    return buffer;
}

function caption(t) {
    const author = t.author || {};

    return (
        "╭━━〔 🎵 VENOM X TIKTOK 〕━━⬣\n" +
        "┃ 👤 " + (author.nickname || author.unique_id || "Unknown") + "\n" +
        "┃ ❤️ " + format(t.digg_count) +
        " · 💬 " + format(t.comment_count) +
        " · 👀 " + format(t.play_count) + "\n" +
        "┃ 🔁 " + format(t.share_count) + "\n" +
        "┃ ⏱️ " + (t.duration || 0) + " seconds\n" +
        "┃ 📝 " + String(t.title || "TikTok video").slice(0, 160) + "\n" +
        "╰━━━━━━━━━━━━━━━━⬣"
    );
}

function getImageUrl(image) {
    if (typeof image === "string") return mediaUrl(image);

    if (image && typeof image === "object") {
        return mediaUrl(image.url || image.url_list?.[0]);
    }

    return null;
}

module.exports = {
    name: "tiktok",

    aliases: [
        "tt",
        "ttinfo",
        "ttphoto",
        "ttmp3",
        "ttmp4"
    ],

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

        let url =
            extractUrl((args || []).join(" ")) ||
            extractUrl(body || "") ||
            extractUrl(quotedText(message));

        if (!url) {
            return reply(
`╭━━〔 🎵 VENOM X TIKTOK 〕━━⬣

${prefix}tt <link>       Video
${prefix}ttmp4 <link>    MP4
${prefix}ttmp3 <link>    Audio
${prefix}ttphoto <link>  Photos
${prefix}ttinfo <link>   Information

You can also reply to a TikTok link.

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        try {
            await sock.sendMessage(from, {
                react: { text: "⏳", key: message.key }
            });
        } catch {}

        try {
            await reply("⏳ Fetching TikTok media...");

            const t = await tikwm(url);
            const cap = caption(t);

            // VIDEO INFORMATION
            if (cmd === "ttinfo") {
                return reply(cap);
            }

            // AUDIO
            if (cmd === "ttmp3") {
                const audioUrl =
                    t.music_info?.play ||
                    t.music;

                if (!audioUrl) {
                    throw new Error("No audio is available for this post.");
                }

                const audio = await downloadBuf(audioUrl, "audio");

                await sock.sendMessage(
                    from,
                    {
                        audio,
                        mimetype: "audio/mpeg",
                        fileName: "VENOM-TIKTOK.mp3",
                        ptt: false
                    },
                    { quoted: message }
                );

                await reply(cap);
                return;
            }

            // PHOTO SLIDESHOW
            if (cmd === "ttphoto") {
                if (!Array.isArray(t.images) || !t.images.length) {
                    throw new Error("This TikTok post has no photo slideshow.");
                }
            }

            if (
                cmd === "ttphoto" ||
                (Array.isArray(t.images) && t.images.length)
            ) {
                const images = t.images
                    .map(getImageUrl)
                    .filter(Boolean)
                    .slice(0, MAX_PHOTOS);

                if (!images.length) {
                    throw new Error("No valid photo URLs were returned.");
                }

                await reply(cap);

                for (let i = 0; i < images.length; i++) {
                    const image = await downloadBuf(images[i], "image");

                    await sock.sendMessage(
                        from,
                        {
                            image,
                            caption: `VENOM X TIKTOK PHOTO ${i + 1}/${images.length}`
                        },
                        { quoted: message }
                    );
                }

                await sock.sendMessage(from, {
                    react: { text: "✅", key: message.key }
                });

                return;
            }

            // VIDEO
            const videoUrl =
                t.hdplay ||
                t.play ||
                t.wmplay;

            if (!videoUrl) {
                throw new Error("No downloadable video was returned.");
            }

            const video = await downloadBuf(videoUrl, "video");

            await sock.sendMessage(
                from,
                {
                    video,
                    caption: cap,
                    mimetype: "video/mp4"
                },
                { quoted: message }
            );

            await sock.sendMessage(from, {
                react: { text: "✅", key: message.key }
            });

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
            } catch {}

            return reply(
`╭━━〔 ❌ TIKTOK ERROR 〕━━⬣

${String(error.message || error).slice(0, 250)}

Try another link later.

╰━━━━━━━━━━━━━━━━⬣`
            );
        }
    }
};
