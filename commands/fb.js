const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

function isUrl(text) {
    return /^https?:\/\//i.test(String(text || "").trim());
}

async function hasYtDlp() {
    try {
        await execFileAsync("yt-dlp", ["--version"], { timeout: 10000 });
        return true;
    } catch (e) {
        return false;
    }
}

module.exports = {
    name: "fb",
    aliases: ["facebook", "fbdl"],

    run: async function ({ sock, from, args, reply, message }) {
        if (!args.length) {
            return reply(
`╭━━〔 📘 VENOM X FACEBOOK 〕━━⬣

Usage:
#fb <Facebook video / Reel URL>

Example:
#fb https://www.facebook.com/reel/...
#fb https://fb.watch/...

⚠️ Public videos only.

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        const url = args.join(" ").trim();
        if (!isUrl(url)) {
            return reply("❌ Send a valid Facebook URL.");
        }

        if (!(await hasYtDlp())) {
            return reply(
`❌ yt-dlp is not installed on this server.

Render build must install yt-dlp.
Termux: pkg install yt-dlp`
            );
        }

        const tempDir = await fs.promises.mkdtemp(
            path.join(os.tmpdir(), "venom-fb-")
        );
        const output = path.join(tempDir, "facebook.%(ext)s");

        try {
            await sock.sendMessage(from, {
                react: { text: "🔎", key: message.key }
            }).catch(function () {});

            await reply("📘 Facebook: downloading...\n⏳ Please wait.");

            try {
                await execFileAsync(
                    "yt-dlp",
                    [
                        "--no-playlist",
                        "--no-warnings",
                        "--restrict-filenames",
                        "--user-agent",
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
                        "-f",
                        "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best",
                        "--merge-output-format",
                        "mp4",
                        "-o",
                        output,
                        url
                    ],
                    {
                        timeout: 180000,
                        maxBuffer: 20 * 1024 * 1024
                    }
                );
            } catch (err) {
                const detail =
                    (err && err.stderr && String(err.stderr).slice(0, 300)) ||
                    (err && err.message) ||
                    "yt-dlp failed";
                throw new Error(detail);
            }

            const files = await fs.promises.readdir(tempDir);
            const videoFile = files.find(function (file) {
                return /\.(mp4|mkv|webm|mov)$/i.test(file);
            });

            if (!videoFile) {
                throw new Error("Video file was not created.");
            }

            const filePath = path.join(tempDir, videoFile);
            const buffer = await fs.promises.readFile(filePath);

            if (buffer.length < 1000) {
                throw new Error("Downloaded file is empty.");
            }

            // WhatsApp prefers buffer on some hosts
            await sock.sendMessage(
                from,
                {
                    video: buffer,
                    mimetype: "video/mp4",
                    caption:
                        "╭━━〔 📘 VENOM X FACEBOOK 〕━━⬣\n" +
                        "┃\n" +
                        "┃ ✅ Download complete\n" +
                        "┃\n" +
                        "╰━━━━━━━━━━━━━━━━⬣"
                },
                { quoted: message }
            );

            await sock.sendMessage(from, {
                react: { text: "✅", key: message.key }
            }).catch(function () {});
        } catch (error) {
            console.log("FACEBOOK DOWNLOAD ERROR:", error.message);

            await sock.sendMessage(from, {
                react: { text: "❌", key: message.key }
            }).catch(function () {});

            return reply(
`╭━━〔 ❌ VENOM X FACEBOOK 〕━━⬣

Download failed.

${String(error.message || "").slice(0, 400)}

Tips:
• Use public Reel / video link
• fb.watch or facebook.com/reel/...
• Private videos need login (not supported)
• Server must have yt-dlp

╰━━━━━━━━━━━━━━━━⬣`
            );
        } finally {
            try {
                await fs.promises.rm(tempDir, { recursive: true, force: true });
            } catch (e) {}
        }
    }
};
