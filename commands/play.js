const fs = require("fs");
const path = require("path");
const os = require("os");
const axios = require("axios");
const { runYtDlp } = require("../lib/ytdlp");

function isUrl(t) {
    return /^https?:\/\//i.test(String(t || "").trim());
}

async function searchYoutube(query) {
    // yt-dlp search
    const { stdout } = await runYtDlp([
        "ytsearch1:" + query,
        "--dump-json",
        "--no-warnings",
        "--no-playlist",
        "--extractor-args", "youtube:player_client=android"
    ]);

    const line = String(stdout || "").trim().split("\n").filter(Boolean)[0];
    if (!line) throw new Error("No search results.");
    const data = JSON.parse(line);
    return {
        id: data.id,
        title: data.title || "Unknown",
        url: data.webpage_url || ("https://www.youtube.com/watch?v=" + data.id),
        duration: data.duration,
        uploader: data.uploader || data.channel || "Unknown",
        thumbnail: data.thumbnail || null
    };
}

function formatDuration(sec) {
    sec = Number(sec) || 0;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ":" + String(s).padStart(2, "0");
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
        let info;

        try {
            await reply("🔍 Searching: *" + input + "*");

            if (isUrl(input)) {
                const { stdout } = await runYtDlp([
                    input,
                    "--dump-json",
                    "--no-warnings",
                    "--no-playlist",
                    "--extractor-args", "youtube:player_client=android"
                ]);
                const data = JSON.parse(String(stdout).trim().split("\n").filter(Boolean)[0]);
                info = {
                    id: data.id,
                    title: data.title || "Unknown",
                    url: data.webpage_url || input,
                    duration: data.duration,
                    uploader: data.uploader || data.channel || "Unknown",
                    thumbnail: data.thumbnail || null
                };
            } else {
                info = await searchYoutube(input);
            }

            // preview card
            const caption =
                "╭━━〔 🎵 VENOM X PLAY 〕━━⬣\n" +
                "┃\n" +
                "┃ 🎧 " + info.title + "\n" +
                "┃ 👤 " + info.uploader + "\n" +
                "┃ ⏱️ " + formatDuration(info.duration) + "\n" +
                "┃ ⬇️ Downloading...\n" +
                "┃\n" +
                "╰━━━━━━━━━━━━━━━━⬣";

            if (info.thumbnail) {
                try {
                    const img = await axios.get(info.thumbnail, {
                        responseType: "arraybuffer",
                        timeout: 20000
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

            const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "venom-play-"));
            const out = path.join(tempDir, "audio.%(ext)s");

            try {
                await runYtDlp([
                    "--no-playlist",
                    "--no-warnings",
                    "--extractor-args", "youtube:player_client=android",
                    "-f", "bestaudio[ext=m4a]/bestaudio/best",
                    "-x",
                    "--audio-format", "mp3",
                    "--audio-quality", "128K",
                    "-o", out,
                    info.url
                ]);

                const files = await fs.promises.readdir(tempDir);
                const audio = files.find(function (f) {
                    return /\.(mp3|m4a|opus|ogg|webm)$/i.test(f);
                });
                if (!audio) throw new Error("Audio file was not created.");

                const filePath = path.join(tempDir, audio);
                const buffer = await fs.promises.readFile(filePath);
                if (buffer.length < 1000) throw new Error("Audio file empty.");

                await sock.sendMessage(
                    from,
                    {
                        audio: buffer,
                        mimetype: "audio/mpeg",
                        fileName: (info.title || "song").slice(0, 60) + ".mp3",
                        ptt: false
                    },
                    { quoted: message }
                );
            } finally {
                try {
                    await fs.promises.rm(tempDir, { recursive: true, force: true });
                } catch (e) {}
            }
        } catch (err) {
            console.log("PLAY ERROR:", err.message);
            return reply(
`╭━━〔 ❌ VENOM X PLAY 〕━━⬣

Failed to play song.

${String(err.message || "").slice(0, 400)}

╰━━━━━━━━━━━━━━━━⬣`
            );
        }
    }
};
