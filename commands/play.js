const fs = require("fs");
const path = require("path");
const os = require("os");
const axios = require("axios");
const yts = require("yt-search");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

function tmpFile(ext) {
    return path.join(
        os.tmpdir(),
        "venom_play_" + Date.now() + "_" + Math.floor(Math.random() * 99999) + "." + ext
    );
}

function formatDuration(sec) {
    sec = Number(sec || 0);
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ":" + String(s).padStart(2, "0");
}

async function downloadAudioFast(videoUrl, outPath) {
    // Faster flags:
    // - lower format hunting
    // - no playlist
    // - no warnings spam
    // - prefer m4a/webm quickly then convert
    await execFileAsync(
        "yt-dlp",
        [
            "-f", "bestaudio[ext=m4a]/bestaudio/best",
            "-x",
            "--audio-format", "mp3",
            "--audio-quality", "5",
            "--no-playlist",
            "--no-warnings",
            "--newline",
            "-o", outPath.replace(/\.mp3$/i, ".%(ext)s"),
            videoUrl
        ],
        { timeout: 90000 }
    );

    if (fs.existsSync(outPath)) return outPath;

    const dir = path.dirname(outPath);
    const base = path.basename(outPath, ".mp3");
    const found = fs.readdirSync(dir).find(function (f) {
        return f.indexOf(base) === 0 && f.slice(-4) === ".mp3";
    });

    if (!found) throw new Error("Audio download failed");
    return path.join(dir, found);
}

module.exports = {
    name: "play",
    aliases: ["song", "music"],

    run: async function ({ sock, from, args, reply, message }) {
        const query = args.join(" ").trim();

        if (!query) {
            return reply(
"╭━━〔 🎵 VENOM X PLAY 〕━━⬣\n\n" +
"Usage:\n#play <song name>\n\n" +
"Example:\n#play all girls are the same\n\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        let thumbPath = null;
        let audioPath = null;

        try {
            // 1) Fast search
            const searchPromise = yts(query);

            await reply("🔍 Searching: *" + query + "*");

            const search = await searchPromise;
            const video = search && search.videos && search.videos[0];

            if (!video) {
                return reply("❌ No results found.");
            }

            const title = video.title || "Unknown";
            const url = video.url;
            const duration = video.timestamp || formatDuration(video.seconds);
            const author = (video.author && video.author.name) || "Unknown";
            const thumb = video.thumbnail;

            // 2) Send quick status (no heavy wait)
            const caption =
"╭━━〔 🎵 VENOM X PLAY 〕━━⬣\n" +
"┃\n" +
"┃ 🎧 *" + title + "*\n" +
"┃ 👤 " + author + "\n" +
"┃ ⏱️ " + duration + "\n" +
"┃\n" +
"┃ ⬇️ Downloading...\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣";

            // thumbnail in parallel with download start
            const thumbPromise = (async function () {
                if (!thumb) return null;
                try {
                    const img = await axios.get(thumb, {
                        responseType: "arraybuffer",
                        timeout: 8000
                    });
                    const p = tmpFile("jpg");
                    fs.writeFileSync(p, Buffer.from(img.data));
                    return p;
                } catch (e) {
                    return null;
                }
            })();

            // start audio download immediately
            const out = tmpFile("mp3");
            const audioPromise = downloadAudioFast(url, out);

            thumbPath = await thumbPromise;

            if (thumbPath && fs.existsSync(thumbPath)) {
                await sock.sendMessage(
                    from,
                    {
                        image: fs.readFileSync(thumbPath),
                        caption: caption
                    },
                    { quoted: message }
                ).catch(function () {
                    return reply(caption);
                });
            } else {
                await reply(caption);
            }

            audioPath = await audioPromise;

            await sock.sendMessage(
                from,
                {
                    audio: fs.readFileSync(audioPath),
                    mimetype: "audio/mpeg",
                    fileName: title + ".mp3",
                    ptt: false
                },
                { quoted: message }
            );

            const sizeMB = (fs.statSync(audioPath).size / (1024 * 1024)).toFixed(1);

            await reply(
"╭━━〔 ✅ VENOM X PLAY 〕━━⬣\n" +
"┃\n" +
"┃ 🎧 " + title + "\n" +
"┃ ⏱️ " + duration + "\n" +
"┃ 📦 " + sizeMB + " MB\n" +
"┃\n" +
"┃ ⚡ Powered by VENOM X\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        } catch (err) {
            console.log("PLAY ERROR:", err);
            return reply(
"╭━━〔 ❌ VENOM X PLAY 〕━━⬣\n\n" +
"Failed to play song.\n\n" +
(err && err.message ? err.message : String(err)) + "\n\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        } finally {
            try { if (thumbPath && fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath); } catch (e) {}
            try { if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath); } catch (e) {}
        }
    }
};
