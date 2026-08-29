const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

function safeFileName(name) {
    return String(name || "VENOM-X-FB")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80) || "VENOM-X-FB";
}

function isUrl(text) {
    return /^https?:\/\//i.test(text);
}

module.exports = {
    name: "fb",

    aliases: [
        "facebook",
        "fbdl"
    ],

    run: async ({
        sock,
        from,
        args,
        reply,
        message
    }) => {

        if (!args.length) {
            return reply(
`╭━━〔 📘 VENOM X FACEBOOK 〕━━⬣
┃
┃ Usage:
┃ #fb <Facebook video URL>
┃
┃ Example:
┃ #fb https://www.facebook.com/...
┃
┃ ⚠️ Public videos only.
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        const url = args.join(" ").trim();

        if (!isUrl(url)) {
            return reply(
`❌ Please send a valid Facebook video URL.

Example:
#fb https://www.facebook.com/...`
            );
        }

        const tempDir = await fs.promises.mkdtemp(
            path.join(os.tmpdir(), "venom-fb-")
        );

        const output = path.join(
            tempDir,
            "facebook.%(ext)s"
        );

        try {

            await sock.sendMessage(from, {
                react: {
                    text: "🔎",
                    key: message.key
                }
            });

            await reply(
`╭━━〔 📘 VENOM X FACEBOOK 〕━━⬣
┃
┃ 🔎 Processing Facebook video...
┃ ⏳ Downloading...
╰━━━━━━━━━━━━━━━━⬣`
            );

            const result = await execFileAsync(
                "yt-dlp",
                [
                    "--no-playlist",
                    "--no-warnings",
                    "--restrict-filenames",
                    "-f",
                    "best[ext=mp4]/best",
                    "-o",
                    output,
                    url
                ],
                {
                    timeout: 180000,
                    maxBuffer: 10 * 1024 * 1024
                }
            );

            const files = await fs.promises.readdir(tempDir);

            const videoFile = files.find(
                file =>
                    file !== "." &&
                    file !== ".." &&
                    /\.(mp4|mkv|webm|mov)$/i.test(file)
            );

            if (!videoFile) {
                throw new Error(
                    "Facebook video file was not created."
                );
            }

            const filePath = path.join(
                tempDir,
                videoFile
            );

            await sock.sendMessage(
                from,
                {
                    video: {
                        url: filePath
                    },
                    caption:
`╭━━〔 📘 VENOM X FACEBOOK 〕━━⬣
┃
┃ ✅ Download complete.
┃
┃ 📘 Facebook Video
╰━━━━━━━━━━━━━━━━⬣`
                },
                {
                    quoted: message
                }
            );

            await sock.sendMessage(from, {
                react: {
                    text: "✅",
                    key: message.key
                }
            });

        } catch (error) {

            console.error(
                "FACEBOOK DOWNLOAD ERROR:",
                error.message
            );

            await sock.sendMessage(from, {
                react: {
                    text: "❌",
                    key: message.key
                }
            }).catch(() => {});

            await reply(
`╭━━〔 ❌ VENOM X FACEBOOK 〕━━⬣
┃
┃ Download failed.
┃
┃ Possible reasons:
┃ • Invalid Facebook URL
┃ • Video is private
┃ • Login is required
┃ • Facebook blocked the request
┃
┃ Try a public video/Reel URL.
╰━━━━━━━━━━━━━━━━⬣`
            );

        } finally {

            try {
                await fs.promises.rm(
                    tempDir,
                    {
                        recursive: true,
                        force: true
                    }
                );
            } catch {}
        }
    }
};
