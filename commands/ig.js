const fs = require("fs");
const path = require("path");
const os = require("os");
const { runYtDlp } = require("../lib/ytdlp");
const { getSettings } = require("../lib/settingsCache");

function isUrl(text) {
    return /^https?:\/\//i.test(String(text || "").trim());
}

function px() {
    try {
        return getSettings().prefix || "#";
    } catch (e) {
        return "#";
    }
}

module.exports = {
    name: "ig",
    aliases: ["instagram", "igdl", "reel", "reels"],

    run: async function ({ sock, from, args, reply, message }) {
        const p = px();

        if (!args.length) {
            return reply(
`╭━━〔 📸 VENOM X INSTAGRAM 〕━━⬣

Usage:
${p}ig <Instagram video/Reel URL>

Example:
${p}ig https://www.instagram.com/reel/...

⚠️ Public posts/Reels only.

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        const url = args.join(" ").trim();
        if (!isUrl(url) || !/instagram\.com|instagr\.am/i.test(url)) {
            return reply(
                "❌ Send a valid Instagram URL.\n\nExample:\n" +
                    p +
                    "ig https://www.instagram.com/reel/..."
            );
        }

        const tempDir = await fs.promises.mkdtemp(
            path.join(os.tmpdir(), "venom-ig-")
        );
        const output = path.join(tempDir, "instagram.%(ext)s");

        try {
            await sock
                .sendMessage(from, {
                    react: { text: "🔎", key: message.key }
                })
                .catch(function () {});

            await reply(
`╭━━〔 📸 VENOM X INSTAGRAM 〕━━⬣
┃ 🔎 Processing...
┃ ⏳ Downloading...
╰━━━━━━━━━━━━━━━━⬣`
            );

            await runYtDlp([
                "--no-playlist",
                "--no-warnings",
                "--restrict-filenames",
                "-f",
                "best[ext=mp4]/best",
                "-o",
                output,
                url
            ]);

            const files = await fs.promises.readdir(tempDir);
            const videoFile = files.find(function (file) {
                return /\.(mp4|mkv|webm|mov)$/i.test(file);
            });

            if (!videoFile) {
                throw new Error("Instagram video file was not created.");
            }

            const filePath = path.join(tempDir, videoFile);
            const buffer = await fs.promises.readFile(filePath);

            if (buffer.length < 1000) {
                throw new Error("Downloaded file is empty.");
            }

            if (buffer.length > 64 * 1024 * 1024) {
                throw new Error("File too large for WhatsApp (>64MB).");
            }

            await sock.sendMessage(
                from,
                {
                    video: buffer,
                    mimetype: "video/mp4",
                    caption:
`╭━━〔 📸 VENOM X INSTAGRAM 〕━━⬣
┃ ✅ Download complete
┃ 📸 Instagram Video
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );

            await sock
                .sendMessage(from, {
                    react: { text: "✅", key: message.key }
                })
                .catch(function () {});
        } catch (error) {
            console.log("INSTAGRAM DOWNLOAD ERROR:", error.message);

            await sock
                .sendMessage(from, {
                    react: { text: "❌", key: message.key }
                })
                .catch(function () {});

            await reply(
`╭━━〔 ❌ VENOM X INSTAGRAM 〕━━⬣

Download failed.

${String(error.message || "").slice(0, 300)}

Possible reasons:
• Private post/account
• Instagram blocked the server
• Invalid URL

Try a public Reel/video.

╰━━━━━━━━━━━━━━━━⬣`
            );
        } finally {
            try {
                await fs.promises.rm(tempDir, { recursive: true, force: true });
            } catch (e) {}
        }
    }
};
