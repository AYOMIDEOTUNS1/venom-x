"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

const execFileAsync = promisify(execFile);

function tmp(ext) {
    return path.join(
        os.tmpdir(),
        "venom_tovid_" + crypto.randomBytes(6).toString("hex") + "." + ext
    );
}

function resolveFfmpeg() {
    // 1) system
    try {
        const which = require("child_process").execSync("which ffmpeg", {
            encoding: "utf8"
        }).trim();
        if (which) return which;
    } catch (e) {}

    // 2) bundled
    try {
        const ffmpegStatic = require("ffmpeg-static");
        if (ffmpegStatic && fs.existsSync(ffmpegStatic)) return ffmpegStatic;
    } catch (e) {}

    return null;
}

function unwrap(message) {
    let current = message;
    for (let i = 0; i < 6; i++) {
        if (!current) break;
        if (current.stickerMessage || current.imageMessage || current.videoMessage) {
            return current;
        }
        const next =
            current.ephemeralMessage?.message ||
            current.viewOnceMessage?.message ||
            current.viewOnceMessageV2?.message ||
            current.viewOnceMessageV2Extension?.message ||
            current.documentWithCaptionMessage?.message;
        if (!next) break;
        current = next;
    }
    return current;
}

function getQuoted(message) {
    const m = message?.message || {};
    return (
        m.extendedTextMessage?.contextInfo?.quotedMessage ||
        m.imageMessage?.contextInfo?.quotedMessage ||
        m.videoMessage?.contextInfo?.quotedMessage ||
        m.stickerMessage?.contextInfo?.quotedMessage ||
        null
    );
}

async function downloadQuoted(quoted) {
    const cur = unwrap(quoted);
    if (!cur) throw new Error("Reply to a sticker or image.");

    let type = null;
    let media = null;
    if (cur.stickerMessage) {
        type = "sticker";
        media = cur.stickerMessage;
    } else if (cur.imageMessage) {
        type = "image";
        media = cur.imageMessage;
    } else if (cur.videoMessage) {
        type = "video";
        media = cur.videoMessage;
    }
    if (!media) throw new Error("Reply to a sticker or image.");

    const stream = await downloadContentFromMessage(
        media,
        type === "sticker" ? "image" : type
    );
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    const buf = Buffer.concat(chunks);
    if (!buf.length) throw new Error("Empty media.");
    return { buf: buf, type: type, isAnimated: !!(media.isAnimated || media.seconds) };
}

async function webpOrImageToMp4(inputPath, outputPath, ffmpegBin) {
    // Try animated webp → mp4
    try {
        await execFileAsync(
            ffmpegBin,
            [
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                inputPath,
                "-vf",
                "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
                "-an",
                outputPath
            ],
            { timeout: 60000 }
        );
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 500) {
            return;
        }
    } catch (e) {
        // fall through — static image loop
    }

    // Static image / failed webp → 3s still video
    await execFileAsync(
        ffmpegBin,
        [
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-loop",
            "1",
            "-t",
            "3",
            "-i",
            inputPath,
            "-vf",
            "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            "-an",
            outputPath
        ],
        { timeout: 60000 }
    );
}

module.exports = {
    name: "tovid",
    aliases: ["tovideo", "stickertovid"],

    run: async function ({ sock, from, message, reply }) {
        const quoted = getQuoted(message);
        if (!quoted) {
            return reply(
`╭━━〔 🎥 TOVID 〕━━⬣

Reply to a *sticker* or *image*:
#tovid

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        const ffmpegBin = resolveFfmpeg();
        if (!ffmpegBin) {
            return reply(
`❌ ffmpeg not found on this server.

Install one of:
• npm install ffmpeg-static
• system package: ffmpeg

Then restart the bot.`
            );
        }

        let inPath = null;
        let outPath = null;

        try {
            await reply("⏳ Converting to video...");

            const dl = await downloadQuoted(quoted);
            const ext =
                dl.type === "sticker"
                    ? "webp"
                    : dl.type === "video"
                      ? "mp4"
                      : "jpg";

            inPath = tmp(ext);
            outPath = tmp("mp4");
            fs.writeFileSync(inPath, dl.buf);

            if (dl.type === "video") {
                // already video — just send
                await sock.sendMessage(
                    from,
                    {
                        video: dl.buf,
                        mimetype: "video/mp4",
                        caption: "🎥 VENOM X"
                    },
                    { quoted: message }
                );
                return;
            }

            await webpOrImageToMp4(inPath, outPath, ffmpegBin);

            if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 500) {
                throw new Error("Conversion produced empty file.");
            }

            const video = fs.readFileSync(outPath);
            await sock.sendMessage(
                from,
                {
                    video: video,
                    mimetype: "video/mp4",
                    caption: "🎥 Converted · VENOM X"
                },
                { quoted: message }
            );
        } catch (err) {
            console.log("TOVID ERROR:", err);
            return reply(
                "❌ #tovid failed:\n" +
                    String(err.message || err).slice(0, 400) +
                    "\n\nffmpeg: " +
                    (resolveFfmpeg() || "missing")
            );
        } finally {
            try {
                if (inPath && fs.existsSync(inPath)) fs.unlinkSync(inPath);
            } catch (e) {}
            try {
                if (outPath && fs.existsSync(outPath)) fs.unlinkSync(outPath);
            } catch (e) {}
        }
    }
};
