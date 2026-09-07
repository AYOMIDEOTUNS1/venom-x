const fs = require("fs");
const path = require("path");
const os = require("os");
const axios = require("axios");

const PIPED_APIS = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.in.projectsegfau.lt",
    "https://api.piped.private.coffee",
    "https://pipedapi.adminforge.de"
];

function isUrl(t) {
    return /^https?:\/\//i.test(String(t || "").trim());
}

function formatDuration(sec) {
    sec = Math.floor(Number(sec) || 0);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ":" + String(s).padStart(2, "0");
}

function extractVideoId(input) {
    const s = String(input || "");
    let m = s.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
    if (m) return m[1];
    m = s.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
    if (m) return m[1];
    m = s.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/);
    if (m) return m[1];
    if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
    return null;
}

async function pipedGet(pathname) {
    let lastErr = null;
    for (let i = 0; i < PIPED_APIS.length; i++) {
        const base = PIPED_APIS[i];
        try {
            const res = await axios.get(base + pathname, {
                timeout: 25000,
                headers: { "User-Agent": "VENOM-X" }
            });
            if (res.data) return res.data;
        } catch (e) {
            lastErr = e;
        }
    }
    throw lastErr || new Error("All Piped APIs failed");
}

async function searchPiped(query) {
    const data = await pipedGet(
        "/search?q=" + encodeURIComponent(query) + "&filter=videos"
    );
    const items = data.items || data || [];
    const list = Array.isArray(items) ? items : [];
    const video = list.find(function (x) {
        return x && (x.url || x.id) && (x.title || x.name);
    });
    if (!video) throw new Error("No results found.");

    let id = video.id;
    if (!id && video.url) {
        id = extractVideoId(video.url) || String(video.url).replace("/watch?v=", "");
    }
    if (!id) throw new Error("No video id in search result.");

    return {
        id: id,
        title: video.title || video.name || "Unknown",
        uploader: (video.uploader && video.uploader.name) || video.uploaderName || "Unknown",
        duration: video.duration || 0,
        thumbnail:
            video.thumbnail ||
            (video.thumbnails && video.thumbnails[0] && video.thumbnails[0].url) ||
            null,
        url: "https://www.youtube.com/watch?v=" + id
    };
}

async function getAudioFromPiped(videoId) {
    const data = await pipedGet("/streams/" + encodeURIComponent(videoId));
    const audioStreams = data.audioStreams || data.audio || [];
    if (!audioStreams.length) {
        throw new Error("No audio streams from Piped.");
    }

    // prefer m4a / mp4 audio, highest bitrate
    const sorted = audioStreams.slice().sort(function (a, b) {
        return (b.bitrate || 0) - (a.bitrate || 0);
    });

    const preferred =
        sorted.find(function (s) {
            return /m4a|mp4|audio\/mp4/i.test(String(s.mimeType || s.format || ""));
        }) || sorted[0];

    if (!preferred || !preferred.url) {
        throw new Error("No usable audio URL.");
    }

    return {
        url: preferred.url,
        mime: preferred.mimeType || "audio/mp4",
        title: data.title || "audio",
        uploader: (data.uploader && data.uploader) || data.uploaderName || "Unknown",
        duration: data.duration || 0,
        thumbnail: data.thumbnailUrl || null
    };
}

async function downloadBuffer(url) {
    const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 120000,
        maxContentLength: 50 * 1024 * 1024,
        headers: { "User-Agent": "VENOM-X" }
    });
    const buf = Buffer.from(res.data);
    if (buf.length < 1000) throw new Error("Downloaded audio is empty.");
    return buf;
}

module.exports = {
    name: "play",
    aliases: ["song", "music"],

    run: async function ({ sock, from, args, reply, message }) {
        if (!args.length) {
            return reply(
`╭━━〔 🎵 VENOM X PLAY 〕━━⬣

Usage:
#play <song name>
#play <youtube url>

Example:
#play joy is coming by fido

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        const input = args.join(" ").trim();

        try {
            await reply("🔍 Searching: *" + input + "*");

            let videoId = extractVideoId(input);
            let meta = null;

            if (!videoId) {
                meta = await searchPiped(input);
                videoId = meta.id;
            }

            const audioMeta = await getAudioFromPiped(videoId);
            const title = (meta && meta.title) || audioMeta.title || "Unknown";
            const uploader = (meta && meta.uploader) || audioMeta.uploader || "Unknown";
            const duration = (meta && meta.duration) || audioMeta.duration || 0;
            const thumb =
                (meta && meta.thumbnail) || audioMeta.thumbnail || null;

            const caption =
                "╭━━〔 🎵 VENOM X PLAY 〕━━⬣\n" +
                "┃ 🎧 " + title + "\n" +
                "┃ 👤 " + uploader + "\n" +
                "┃ ⏱️ " + formatDuration(duration) + "\n" +
                "┃ ⬇️ Downloading...\n" +
                "╰━━━━━━━━━━━━━━━━⬣";

            if (thumb) {
                try {
                    const img = await axios.get(thumb, {
                        responseType: "arraybuffer",
                        timeout: 15000
                    });
                    await sock.sendMessage(
                        from,
                        { image: Buffer.from(img.data), caption: caption },
                        { quoted: message }
                    );
                } catch (e) {
                    await reply(caption);
                }
            } else {
                await reply(caption);
            }

            const buffer = await downloadBuffer(audioMeta.url);

            const mime = /mp4|m4a/i.test(audioMeta.mime)
                ? "audio/mp4"
                : "audio/mpeg";

            await sock.sendMessage(
                from,
                {
                    audio: buffer,
                    mimetype: mime,
                    fileName: String(title).slice(0, 50) + ".mp3",
                    ptt: false
                },
                { quoted: message }
            );
        } catch (err) {
            console.log("PLAY ERROR:", err.message);
            return reply(
`╭━━〔 ❌ VENOM X PLAY 〕━━⬣

Failed to play song.

${String(err.message || "").slice(0, 350)}

Try another song name or a direct YouTube link.

╰━━━━━━━━━━━━━━━━⬣`
            );
        }
    }
};
