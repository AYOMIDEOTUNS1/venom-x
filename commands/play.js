/**
 * VENOM X PLAY (Render-safe)
 * - Try YouTube (ytdl)
 * - If 429/blocked → iTunes 30s preview (works on Render)
 * - Always show song info + YT link
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
        let total = 0;
        stream.on("data", function (c) {
            chunks.push(c);
            total += c.length;
            // safety: stop insane sizes
            if (total > 40 * 1024 * 1024) {
                stream.destroy();
                reject(new Error("Audio too large"));
            }
        });
        stream.on("end", function () {
            const buf = Buffer.concat(chunks);
            if (buf.length < 1500) return reject(new Error("Empty audio"));
            resolve(buf);
        });
        stream.on("error", reject);
    });
}

async function itunesSearch(query) {
    const res = await axios.get("https://itunes.apple.com/search", {
        params: { term: query, media: "music", entity: "song", limit: 5 },
        timeout: 12000,
        headers: { "User-Agent": UA }
    });
    const list = (res.data && res.data.results) || [];
    return list.map(function (t) {
        return {
            title: t.trackName || "Unknown",
            artist: t.artistName || "Unknown",
            album: t.collectionName || "",
            cover: String(t.artworkUrl100 || "").replace("100x100bb", "600x600bb"),
            duration: Math.floor((t.trackTimeMillis || 0) / 1000),
            preview: t.previewUrl || null,
            query: (t.trackName || "") + " " + (t.artistName || "")
        };
    });
}

async function ytFind(query) {
    const r = await yts(query);
    const v = r.videos && r.videos[0];
    if (!v || !v.videoId) return null;
    return {
        id: v.videoId,
        title: v.title,
        url: "https://www.youtube.com/watch?v=" + v.videoId,
        seconds: v.seconds || 0,
        thumbnail: v.thumbnail
    };
}

async function ytdlFull(url) {
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
    if (!format) throw new Error("No audio format");
    const stream = ytdl.downloadFromInfo(info, {
        format: format,
        highWaterMark: 1 << 25
    });
    const buffer = await streamToBuffer(stream);
    return {
        buffer: buffer,
        mime: format.mimeType || "audio/webm",
        source: "youtube"
    };
}

async function downloadUrl(url) {
    const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 30000,
        headers: { "User-Agent": UA }
    });
    const buffer = Buffer.from(res.data);
    if (buffer.length < 1000) throw new Error("Preview too small");
    return buffer;
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
"On Render: full YT may be blocked (429).\n" +
"Bot will send preview + link if needed.\n\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        try {
            await reply("🔍 Searching: *" + text + "*");

            let tracks = [];
            try {
                tracks = await itunesSearch(text);
            } catch (e) {}

            const meta = tracks[0] || null;
            const yt = await ytFind(meta ? meta.query : text);

            const title = (meta && meta.title) || (yt && yt.title) || text;
            const artist = (meta && meta.artist) || "Unknown";
            const cover = (meta && meta.cover) || (yt && yt.thumbnail) || null;
            const dur =
                meta && meta.duration
                    ? formatDur(meta.duration)
                    : yt && yt.seconds
                      ? formatDur(yt.seconds)
                      : "";

            let audioBuffer = null;
            let mime = "audio/mpeg";
            let source = "";
            let note = "";

            // 1) Try full YouTube (often 429 on Render)
            if (yt && yt.url) {
                try {
                    const full = await ytdlFull(yt.url);
                    audioBuffer = full.buffer;
                    mime = /mp4|m4a/i.test(full.mime)
                        ? "audio/mp4"
                        : /webm/i.test(full.mime)
                          ? "audio/webm"
                          : "audio/mpeg";
                    source = "youtube";
                } catch (e) {
                    console.log("YT full failed:", e.message);
                    note = "YouTube blocked on server (" + String(e.message).slice(0, 40) + ")";
                }
            }

            // 2) iTunes preview fallback (works on Render)
            if (!audioBuffer && meta && meta.preview) {
                try {
                    audioBuffer = await downloadUrl(meta.preview);
                    mime = "audio/mpeg";
                    source = "itunes-preview";
                    note = "Full track blocked on Render. Sent 30s preview.";
                } catch (e) {
                    console.log("Preview failed:", e.message);
                }
            }

            const caption =
                "╭━━〔 🎵 VENOM X PLAY 〕━━⬣\n" +
                "┃ 🎧 " + title + "\n" +
                "┃ 👤 " + artist + "\n" +
                (dur ? "┃ ⏱️ " + dur + "\n" : "") +
                (source ? "┃ 📡 " + source + "\n" : "") +
                (yt && yt.url ? "┃ 🔗 " + yt.url + "\n" : "") +
                (note ? "┃ ⚠️ " + note + "\n" : "") +
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

            if (audioBuffer) {
                try {
                    await sock.sendMessage(
                        from,
                        {
                            audio: audioBuffer,
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
                            document: audioBuffer,
                            mimetype: "audio/mpeg",
                            fileName: String(title).slice(0, 40) + ".mp3",
                            caption: "🎵 " + title
                        },
                        { quoted: message }
                    );
                }
            } else {
                await reply(
"❌ Could not fetch audio from this server.\n" +
(yt && yt.url ? "Open: " + yt.url : "Try another song.")
                );
            }
        } catch (err) {
            console.log("PLAY ERROR:", err.message || err);
            return reply("❌ Play failed:\n" + String(err.message || err).slice(0, 300));
        }
    }
};
