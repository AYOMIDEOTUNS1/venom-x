const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

function isUrl(text) {
    return /^https?:\/\//i.test(text);
}

module.exports = {
    name: "ig",

    aliases: [
        "instagram",
        "igdl",
        "reel",
        "reels"
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
`╭━━〔 📸 VENOM X INSTAGRAM 〕━━⬣
┃
┃ Usage:
┃ #ig <Instagram video/Reel URL>
┃
┃ Example:
┃ #ig https://www.instagram.com/reel/...
┃
┃ ⚠️ Public posts/Reels only.
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        const url = args.join(" ").trim();

        if (!isUrl(url)) {
            return reply(
`❌ Please send a valid Instagram URL.

Example:
#ig https://www.instagram.com/reel/...`
            );
        }

        const tempDir = await fs.promises.mkdtemp(
            path.join(os.tmpdir(), "venom-ig-")
        );

        const output = path.join(
            tempDir,
            "instagram.%(ext)s"
        );

        try {

            await sock.sendMessage(from, {
                react: {
                    text: "🔎",
                    key: message.key
                }
            });

            await reply(
`╭━━〔 📸 VENOM X INSTAGRAM 〕━━⬣
┃
┃ 🔎 Processing Instagram...
┃ ⏳ Downloading...
╰━━━━━━━━━━━━━━━━⬣`
            );

            await execFileAsync(
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
                    /\.(mp4|mkv|webm|mov)$/i.test(file)
            );

            if (!videoFile) {
                throw new Error(
                    "Instagram video file was not created."
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
`╭━━〔 📸 VENOM X INSTAGRAM 〕━━⬣
┃
┃ ✅ Download complete.
┃
┃ 📸 Instagram Video
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
                "INSTAGRAM DOWNLOAD ERROR:",
                error.message
            );

            await sock.sendMessage(from, {
                react: {
                    text: "❌",
                    key: message.key
                }
            }).catch(() => {});

            await reply(
`╭━━〔 ❌ VENOM X INSTAGRAM 〕━━⬣
┃
┃ Download failed.
┃
┃ Possible reasons:
┃ • Invalid Instagram URL
┃ • Private post/account
┃ • Login is required
┃ • Instagram blocked the request
┃
┃ Try a public Reel/video URL.
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
