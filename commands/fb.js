"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { runYtDlp } = require("../lib/ytdlp");
const { getSettings } = require("../lib/settingsCache");

const MAX_SIZE = 64 * 1024 * 1024;

function px() {
    try {
        return getSettings().prefix || "#";
    } catch {
        return "#";
    }
}

function extractUrl(text) {
    const match = String(text || "").match(/https?:\/\/[^\s<>"']+/i);

    return match
        ? match[0].replace(/[),.;!?]+$/g, "")
        : "";
}

function isFacebookUrl(value) {
    try {
        const hostname = new URL(value).hostname.toLowerCase();

        return (
            hostname === "facebook.com" ||
            hostname.endsWith(".facebook.com") ||
            hostname === "fb.watch" ||
            hostname === "fb.com" ||
            hostname.endsWith(".fb.com")
        );
    } catch {
        return false;
    }
}

function getQuotedText(message) {
    try {
        const context =
            message?.message?.extendedTextMessage?.contextInfo ||
            message?.message?.imageMessage?.contextInfo ||
            message?.message?.videoMessage?.contextInfo;

        const quoted = context?.quotedMessage;
        if (!quoted) return "";

        return (
            quoted.conversation ||
            quoted.extendedTextMessage?.text ||
            quoted.imageMessage?.caption ||
            quoted.videoMessage?.caption ||
            ""
        );
    } catch {
        return "";
    }
}

module.exports = {
    name: "fb",
    aliases: ["facebook", "fbdl"],

    run: async function ({ sock, from, args, reply, message }) {
        let tempDir;

        try {
            const prefix = px();

            const url =
                extractUrl((args || []).join(" ")) ||
                extractUrl(getQuotedText(message));

            if (!url || !isFacebookUrl(url)) {
                return reply(
`╭━━〔 📘 VENOM X FACEBOOK 〕━━⬣

Usage:
${prefix}fb <Facebook video URL>

Aliases:
${prefix}facebook
${prefix}fbdl

Supports public videos and Reels.

╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            tempDir = await fs.promises.mkdtemp(
                path.join(os.tmpdir(), "venom-fb-")
            );

            const output = path.join(tempDir, "facebook.%(ext)s");

            try {
                await sock.sendMessage(from, {
                    react: { text: "⏳", key: message.key }
                });
            } catch {}

            await reply("📘 Facebook downloader started.\n⏳ Please wait...");

            await runYtDlp([
                "--no-playlist",
                "--no-warnings",
                "--no-part",
                "--force-ipv4",
                "--retries", "3",
                "--fragment-retries", "3",
                "--extractor-retries", "2",
                "--socket-timeout", "30",
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

            const videos = [];

            for (const file of files) {
                if (!/\.(mp4|mkv|webm|mov)$/i.test(file)) continue;

                const fullPath = path.join(tempDir, file);
                const stat = await fs.promises.stat(fullPath);

                if (stat.isFile()) {
                    videos.push({
                        path: fullPath,
                        size: stat.size
                    });
                }
            }

            videos.sort((a, b) => b.size - a.size);

            const videoFile = videos[0];

            if (!videoFile || videoFile.size < 1000) {
                throw new Error("No valid video file was downloaded.");
            }

            if (videoFile.size > MAX_SIZE) {
                throw new Error(
                    "Video exceeds WhatsApp's 64MB limit. Try a shorter video."
                );
            }

            const buffer = await fs.promises.readFile(videoFile.path);

            await sock.sendMessage(
                from,
                {
                    video: buffer,
                    mimetype: "video/mp4",
                    fileName: "VENOM-FACEBOOK.mp4",
                    caption:
                        "╭━━〔 📘 VENOM X FACEBOOK 〕━━⬣\n" +
                        "┃ ✅ Download completed\n" +
                        "┃ ⚡ VENOM X\n" +
                        "╰━━━━━━━━━━━━━━━━⬣"
                },
                { quoted: message }
            );

            try {
                await sock.sendMessage(from, {
                    react: { text: "✅", key: message.key }
                });
            } catch {}

        } catch (error) {
            console.error(
                "[VENOM FACEBOOK ERROR]",
                error.stderr || error.message || error
            );

            try {
                await sock.sendMessage(from, {
                    react: { text: "❌", key: message.key }
                });
            } catch {}

            return reply(
`╭━━〔 ❌ FACEBOOK DOWNLOAD FAILED 〕━━⬣

${String(error.message || error).slice(0, 350)}

Possible causes:
• Facebook blocked the request.
• The video is private or unavailable.
• yt-dlp needs updating.
• The video exceeds the WhatsApp size limit.

╰━━━━━━━━━━━━━━━━⬣`
            );

        } finally {
            if (tempDir) {
                try {
                    await fs.promises.rm(tempDir, {
                        recursive: true,
                        force: true
                    });
                } catch (cleanupError) {
                    console.error(
                        "[VENOM FB CLEANUP]",
                        cleanupError.message
                    );
                }
            }
        }
    }
};
