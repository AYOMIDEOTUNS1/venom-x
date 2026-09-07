const fs = require("fs");
const path = require("path");
const os = require("os");
const axios = require("axios");
const { runYtDlp } = require("../lib/ytdlp");

function isUrl(t) {
    return /^https?:\/\//i.test(String(t || "").trim());
}

function formatDuration(sec) {
    sec = Math.floor(Number(sec) || 0);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ":" + String(s).padStart(2, "0");
}

async function searchYoutube(query) {
    const clients = ["android", "ios", "mweb"];
    let lastErr = null;
    for (let i = 0; i < clients.length; i++) {
        try {
            const { stdout } = await runYtDlp([
                "ytsearch1:" + query,
                "--dump-json",
                "--no-warnings",
                "--no-playlist",
                "--extractor-args",
                "youtube:player_client=" + clients[i]
            ]);
            const line = String(stdout || "").trim().split("\n").filter(Boolean)[0];
            if (!line) throw new Error("No search results");
            const data = JSON.parse(line);
            return {
                title: data.title || "Unknown",
                url: data.webpage_url || ("https://www.youtube.com/watch?v=" + data.id),
                duration: data.duration,
                uploader: data.uploader || data.channel || "Unknown",
                thumbnail: data.thumbnail || null
            };
        } catch (e) {
            lastErr = e;
        }
    }
    throw lastErr || new Error("Search failed");
}

async function downloadWithYtDlp(url, outTemplate) {
    const clients = ["android", "ios", "mweb", "tv_embedded"];
    let lastErr = null;
    for (let i = 0; i < clients.length; i++) {
        try {
            await runYtDlp([
                "--no-playlist",
                "--no-warnings",
                "--extractor-args",
                "youtube:player_client=" + clients[i],
                "-f",
                "bestaudio[ext=m4a]/bestaudio/best",
                "-x",
                "--audio-format",
                "mp3",
                "--audio-quality",
                "128K",
                "-o",
                outTemplate,
                url
            ]);
            return;
        } catch (e) {
            lastErr = e;
            console.log("play client fail:", clients[i], e.message);
        }
    }
    throw lastErr || new Error("All yt-dlp clients failed");
}

async function downloadWithCobalt(url, destFile) {
    // Public Cobalt-style fallback (may change / rate-limit)
    const endpoints = [
        "https://api.cobalt.tools/api/json",
        "https://cobalt-backend.vercel.app/api/json"
    ];
    let lastErr = null;
    for (let i = 0; i < endpoints.length; i++) {
        try {
            const res = await axios.post(
                endpoints[i],
                {
                    url: url,
                    isAudioOnly: true,
                    aFormat: "mp3",
                    filenamePattern: "basic"
                },
                {
                    timeout: 60000,
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json"
                    }
                }
            );
            const data = res.data || {};
            const audioUrl = data.url || data.audio || (data.data && data.data.url);
            if (!audioUrl) throw new Error("Cobalt returned no url");
            const audio = await axios.get(audioUrl, {
                responseType: "arraybuffer",
                timeout: 120000
            });
            fs.writeFileSync(destFile, Buffer.from(audio.data));
            return;
        } catch (e) {
            lastErr = e;
            console.log("cobalt fail:", e.message);
        }
    }
    throw lastErr || new Error("Cobalt failed");
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

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        const input = args.join(" ").trim();
        const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "venom-play-"));

        try {
            await reply("🔍 Searching: *" + input + "*");

            let info;
            if (isUrl(input)) {
                info = {
                    title: "YouTube Audio",
                    url: input,
                    duration: 0,
                    uploader: "YouTube",
                    thumbnail: null
                };
            } else {
                info = await searchYoutube(input);
            }

            const caption =
                "╭━━〔 🎵 VENOM X PLAY 〕━━⬣\n" +
                "┃ 🎧 " + info.title + "\n" +
                "┃ 👤 " + info.uploader + "\n" +
                "┃ ⏱️ " + formatDuration(info.duration) + "\n" +
                "┃ ⬇️ Downloading...\n" +
                "╰━━━━━━━━━━━━━━━━⬣";

            if (info.thumbnail) {
                try {
                    const img = await axios.get(info.thumbnail, {
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

            const out = path.join(tempDir, "audio.%(ext)s");
            const cobaltFile = path.join(tempDir, "audio.mp3");
            let filePath = null;

            try {
                await downloadWithYtDlp(info.url, out);
                const files = await fs.promises.readdir(tempDir);
                const audio = files.find(function (f) {
                    return /\.(mp3|m4a|opus|ogg|webm)$/i.test(f);
                });
                if (!audio) throw new Error("No audio file");
                filePath = path.join(tempDir, audio);
            } catch (e1) {
                console.log("yt-dlp blocked, trying cobalt:", e1.message);
                await reply("⚠️ YouTube blocked server IP. Trying alternate...");
                await downloadWithCobalt(info.url, cobaltFile);
                filePath = cobaltFile;
            }

            const buffer = await fs.promises.readFile(filePath);
            if (buffer.length < 1000) throw new Error("Audio empty");

            await sock.sendMessage(
                from,
                {
                    audio: buffer,
                    mimetype: "audio/mpeg",
                    fileName: String(info.title || "song").slice(0, 50) + ".mp3",
                    ptt: false
                },
                { quoted: message }
            );
        } catch (err) {
            console.log("PLAY ERROR:", err.message);
            return reply(
`╭━━〔 ❌ VENOM X PLAY 〕━━⬣

Failed to play song.

${String(err.message || "").slice(0, 400)}

YouTube often blocks cloud servers.
Try again later or use a direct link.

╰━━━━━━━━━━━━━━━━⬣`
            );
        } finally {
            try {
                await fs.promises.rm(tempDir, { recursive: true, force: true });
            } catch (e) {}
        }
    }
};
