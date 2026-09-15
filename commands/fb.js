const fs = require("fs");
const path = require("path");
const os = require("os");
const { runYtDlp } = require("../lib/ytdlp");
const { getSettings } = require("../lib/settingsCache");

function isUrl(text) {
    return /^https?:\/\//i.test(String(text || "").trim());
}

function isFbUrl(text) {
    return /facebook\.com|fb\.watch|fb\.com/i.test(String(text || ""));
}

function px() {
    try {
        return getSettings().prefix || "#";
    } catch (e) {
        return "#";
    }
}

module.exports = {
    name: "fb",
    aliases: ["facebook", "fbdl"],

    run: async function ({ sock, from, args, reply, message }) {
        const p = px();

        if (!args.length) {
            return reply(
`╭━━〔 📘 VENOM X FACEBOOK 〕━━⬣

Usage:
${p}fb <Facebook video / Reel URL>

Example:
${p}fb https://www.facebook.com/reel/...
${p}fb https://fb.watch/...

⚠️ Public videos only.

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        const url = args.join(" ").trim();
        if (!isUrl(url) || !isFbUrl(url)) {
            return reply("❌ Send a valid Facebook / fb.watch URL.");
        }

        const tempDir = await fs.promises.mkdtemp(
            path.join(os.tmpdir(), "venom-fb-")
        );
        const output = path.join(tempDir, "facebook.%(ext)s");

        try {
            await reply("📘 Facebook: downloading...\n⏳ Please wait.");

            await runYtDlp([
                "--no-playlist",
                "--no-warnings",
                "--restrict-filenames",
                "--user-agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "-f",
                "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best",
                "--merge-output-format",
                "mp4",
                "-o",
                output,
                url
            ]);

            const files = await fs.promises.readdir(tempDir);
            const videoFile = files.find(function (f) {
                return /\.(mp4|mkv|webm|mov)$/i.test(f);
            });
            if (!videoFile) throw new Error("Video file was not created.");

            const buffer = await fs.promises.readFile(
                path.join(tempDir, videoFile)
            );
            if (buffer.length < 1000) throw new Error("Downloaded file is empty.");
            if (buffer.length > 64 * 1024 * 1024) {
                throw new Error("File too large for WhatsApp (>64MB).");
            }

            await sock.sendMessage(
                from,
                {
                    video: buffer,
                    mimetype: "video/mp4",
                    caption: "✅ Facebook video\n⚡ VENOM X"
                },
                { quoted: message }
            );
        } catch (error) {
            console.log("FACEBOOK DOWNLOAD ERROR:", error.message);
            return reply(
`╭━━〔 ❌ VENOM X FACEBOOK 〕━━⬣

${String(error.message || "").slice(0, 500)}

Tips:
• Public Reel / fb.watch only
• Private videos not supported
• Facebook often blocks cloud IPs

╰━━━━━━━━━━━━━━━━⬣`
            );
        } finally {
            try {
                await fs.promises.rm(tempDir, { recursive: true, force: true });
            } catch (e) {}
        }
    }
};
