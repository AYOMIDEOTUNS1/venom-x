/**
 * VENOM X PLAY
 * Primary: @distube/ytdl-core (works better on servers)
 * Fallback: a few public APIs
 */

const axios = require("axios");
const yts = require("yt-search");
const ytdl = require("@distube/ytdl-core");
const { getSettings } = require("../lib/settingsCache");

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function px() {
    try {
        return getSettings().prefix || "#";
    } catch (e) {
        return "#";
    }
}

function formatDur(sec) {
    sec = Math.floor(Number(sec) || 0);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ":" + String(s).padStart(2, "0");
}

function streamToBuffer(stream) {
    return new Promise(function (resolve, reject) {
        const chunks = [];
        stream.on("data", function (c) { chunks.push(c); });
        stream.on("end", function () {
            const buf = Buffer.concat(chunks);
            if (!buf.length) return reject(new Error("Empty ytdl stream"));
            resolve(buf);
        });
        stream.on("error", reject);
    });
}

async function itunesMeta(query) {
    try {
        const res = await axios.get("https://itunes.apple.com/search", {
            params: { term: query, media: "music", entity: "song", limit: 1 },
            timeout: 10000,
            headers: { "User-Agent": UA }
        });
        const t = res.data && res.data.results && res.data.results[0];
        if (!t) return null;
        return {
            title: t.trackName || null,
            artist: t.artistName || null,
            cover: String(t.artworkUrl100 || "").replace("100x100bb", "600x600bb"),
            duration: Math.floor((t.trackTimeMillis || 0) / 1000),
            query: (t.trackName || "") + " " + (t.artistName || "")
        };
    } catch (e) {
        return null;
    }
}

async function findYoutube(query) {
    const r = await yts(query);
    const v = r.videos && r.videos[0];
    if (!v || !v.videoId) throw new Error("No YouTube result");
    return {
        id: v.videoId,
        title: v.title,
        url: "https://www.youtube.com/watch?v=" + v.videoId,
        seconds: v.seconds || 0,
        thumbnail: v.thumbnail
    };
}

async function downloadWithYtdl(url) {
    if (!ytdl.validateURL(url)) throw new Error("Invalid YouTube URL");

    const info = await ytdl.getInfo(url, {
        requestOptions: {
            headers: {
                "User-Agent": UA,
                "Accept-Language": "en-US,en;q=0.9"
            }
        }
    });

    const format = ytdl.chooseFormat(info.formats, {
        quality: "highestaudio",
        filter: "audioonly"
    });

    if (!format) throw new Error("No audio format from ytdl");

    const stream = ytdl.downloadFromInfo(info, {
        format: format,
        highWaterMark: 1 << 25
    });

    const buffer = await streamToBuffer(stream);
    if (buffer.length < 2000) throw new Error("ytdl audio too small");

    return {
        buffer: buffer,
        mime: format.mimeType || "audio/webm",
        title: info.videoDetails && info.videoDetails.title,
        source: "ytdl"
    };
}

function pickUrl(data) {
    if (!data) return null;
    if (typeof data === "string" && data.indexOf("http") === 0) return data;
    return (
        data.url ||
        data.link ||
        data.dl ||
        data.download_url ||
        (data.data && (data.data.url || data.data.link || data.data.dl)) ||
        (data.result && (data.result.url || data.result.link || data.result.dl)) ||
        null
    );
}

async function downloadWithApis(youtubeUrl) {
    const list = [
        "https://api.agatz.xyz/api/ytmp3?url=" + encodeURIComponent(youtubeUrl),
        "https://api.nyxs.pw/dl/yt?url=" + encodeURIComponent(youtubeUrl),
        "https://nayan-video-downloader.vercel.app/ytmp3?url=" + encodeURIComponent(youtubeUrl)
    ];

    let last = null;
    for (let i = 0; i < list.length; i++) {
        try {
            const { data } = await axios.get(list[i], {
                timeout: 40000,
                headers: { "User-Agent": UA }
            });
            const fileUrl = pickUrl(data);
            if (!fileUrl) {
                last = new Error("empty api result");
                continue;
            }

            const bin = await axios.get(fileUrl, {
                responseType: "arraybuffer",
                timeout: 120000,
                maxContentLength: 40 * 1024 * 1024,
                headers: { "User-Agent": UA, Referer: "https://www.youtube.com/" }
            });
            const buffer = Buffer.from(bin.data);
            if (buffer.length < 2000) throw new Error("small file");
            return { buffer: buffer, mime: "audio/mpeg", source: "api" };
        } catch (e) {
            last = e;
        }
    }
    throw last || new Error("API fallbacks failed");
}

module.exports = {
    name: "play",
    aliases: ["song", "music", "ytplay"],

    run: async function ({ sock, from, args, reply, message }) {
        const p = px();
        const text = args.join(" ").trim();

        if (!text) {
            return reply(
"╭━━〔 🎵 VENOM X PLAY 〕━━⬣\n\n" +
"Usage:\n" +
p + "play <song name>\n\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        try {
            await reply("🔍 Searching: *" + text + "*");

            const meta = await itunesMeta(text);
            const yt = await findYoutube(meta ? meta.query : text);

            let audio;
            try {
                audio = await downloadWithYtdl(yt.url);
            } catch (e1) {
                console.log("YTDL failed:", e1.message);
                try {
                    audio = await downloadWithApis(yt.url);
                } catch (e2) {
                    throw new Error(
                        "ytdl: " + (e1.message || e1) + " | apis: " + (e2.message || e2)
                    );
                }
            }

            const title = (meta && meta.title) || audio.title || yt.title || text;
            const artist = (meta && meta.artist) || "Unknown";
            const cover = (meta && meta.cover) || yt.thumbnail;
            const dur =
                meta && meta.duration
                    ? formatDur(meta.duration)
                    : yt.seconds
                      ? formatDur(yt.seconds)
                      : "";

            const caption =
                "╭━━〔 🎵 VENOM X PLAY 〕━━⬣\n" +
                "┃ 🎧 " + title + "\n" +
                "┃ 👤 " + artist + "\n" +
                (dur ? "┃ ⏱️ " + dur + "\n" : "") +
                "┃ 📡 " + (audio.source || "server") + "\n" +
                "╰━━━━━━━━━━━━━━━━⬣";

            if (cover) {
                try {
                    const img = await axios.get(cover, {
                        responseType: "arraybuffer",
                        timeout: 12000,
                        headers: { "User-Agent": UA }
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

            // normalize mime for WhatsApp
            let mime = "audio/mpeg";
            if (/mp4|m4a/i.test(String(audio.mime || ""))) mime = "audio/mp4";
            else if (/webm/i.test(String(audio.mime || ""))) mime = "audio/webm";

            try {
                await sock.sendMessage(
                    from,
                    {
                        audio: audio.buffer,
                        mimetype: mime,
                        fileName: String(title).slice(0, 40) + ".mp3",
                        ptt: false
                    },
                    { quoted: message }
                );
            } catch (e) {
                await sock.sendMessage(
                    from,
                    {
                        document: audio.buffer,
                        mimetype: "audio/mpeg",
                        fileName: String(title).slice(0, 40) + ".mp3",
                        caption: "🎵 " + title
                    },
                    { quoted: message }
                );
            }
        } catch (err) {
            console.log("PLAY ERROR:", err.message || err);
            return reply(
"╭━━〔 ❌ PLAY FAILED 〕━━⬣\n\n" +
String(err.message || err).slice(0, 400) +
"\n\n╰━━━━━━━━━━━━━━━━⬣"
            );
        }
    }
};
