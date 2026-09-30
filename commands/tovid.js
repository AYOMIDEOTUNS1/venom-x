/**
 * VENOM X - #tovid (fixed sticker support)
 * Reply sticker / image / gif → mp4
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { exec } = require("child_process");
const { promisify } = require("util");
const sharp = require("sharp");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

const execAsync = promisify(exec);

function tmp(ext) {
    return path.join(
        os.tmpdir(),
        "venom_tovid_" + crypto.randomBytes(6).toString("hex") + "." + ext
    );
}

function unwrap(msg) {
    let cur = msg;
    for (let i = 0; i < 6; i++) {
        const wrap =
            (cur && cur.viewOnceMessageV2 && cur.viewOnceMessageV2.message) ||
            (cur && cur.viewOnceMessage && cur.viewOnceMessage.message) ||
            (cur && cur.viewOnceMessageV2Extension && cur.viewOnceMessageV2Extension.message) ||
            (cur && cur.ephemeralMessage && cur.ephemeralMessage.message) ||
            (cur && cur.documentWithCaptionMessage && cur.documentWithCaptionMessage.message) ||
            null;
        if (!wrap) break;
        cur = wrap;
    }
    return cur;
}

function getQuoted(message) {
    const ctx =
        message.message &&
        message.message.extendedTextMessage &&
        message.message.extendedTextMessage.contextInfo
            ? message.message.extendedTextMessage.contextInfo
            : null;
    return ctx && ctx.quotedMessage ? unwrap(ctx.quotedMessage) : null;
}

async function download(msg, type) {
    const node = msg[type + "Message"];
    if (!node) throw new Error("Missing " + type);
    const stream = await downloadContentFromMessage(
        node,
        type === "sticker" ? "sticker" : type
    );
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buf = Buffer.concat(chunks);
    if (!buf.length) throw new Error("Empty download");
    return buf;
}

async function imageToVideo(inputPath, outputPath) {
    await execAsync(
        'ffmpeg -hide_banner -loglevel error -y -loop 1 -i "' +
            inputPath +
            '" -t 3 -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p" -c:v libx264 -pix_fmt yuv420p -movflags +faststart "' +
            outputPath +
            '"'
    );
}

async function mediaToVideo(inputPath, outputPath) {
    // try normal decode
    try {
        await execAsync(
            'ffmpeg -hide_banner -loglevel error -y -i "' +
                inputPath +
                '" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p" -c:v libx264 -pix_fmt yuv420p -movflags +faststart -an "' +
                outputPath +
                '"'
        );
        return;
    } catch (e1) {
        // animated webp sometimes needs this
        await execAsync(
            'ffmpeg -hide_banner -loglevel error -y -c:v libwebp -i "' +
                inputPath +
                '" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p" -c:v libx264 -pix_fmt yuv420p -movflags +faststart -an "' +
                outputPath +
                '"'
        );
    }
}

module.exports = {
    name: "tovid",
    aliases: ["tovideo", "sticker2video", "togifvideo"],

    run: async function ({ sock, from, message, reply }) {
        const quoted = getQuoted(message);

        if (!quoted) {
            return reply(
"╭━━〔 🎬 VENOM TOVID 〕━━⬣\n" +
"┃ Reply to:\n" +
"┃ • sticker (static/animated)\n" +
"┃ • image\n" +
"┃ • gif / short video\n" +
"┃\n" +
"┃ Then: #tovid\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        // Lottie stickers can't be converted easily
        if (
            quoted.stickerMessage &&
            (quoted.stickerMessage.isLottie || quoted.stickerMessage.lottie)
        ) {
            return reply("❌ Lottie stickers can't be converted to video.");
        }

        let type = null;
        let mode = "media"; // media | image

        if (quoted.stickerMessage) {
            type = "sticker";
            // static sticker → treat as image via sharp (most reliable)
            if (!quoted.stickerMessage.isAnimated) {
                mode = "image";
            }
        } else if (quoted.imageMessage) {
            type = "image";
            mode = "image";
        } else if (quoted.videoMessage) {
            type = "video";
            mode = "media";
        } else {
            return reply("❌ Reply to a sticker, image, or gif/video.");
        }

        const input = tmp(type === "sticker" ? "webp" : type === "image" ? "jpg" : "mp4");
        const mid = tmp("png");
        const output = tmp("mp4");

        try {
            await reply("🎬 Converting to video...");

            const buffer = await download(quoted, type);
            fs.writeFileSync(input, buffer);

            if (mode === "image") {
                // webp/jpg → png with sharp, then 3s video
                await sharp(buffer)
                    .rotate()
                    .png()
                    .toFile(mid);

                await imageToVideo(mid, output);
            } else {
                // animated sticker / video
                try {
                    await mediaToVideo(input, output);
                } catch (e) {
                    // last fallback: first frame via sharp → short video
                    await sharp(buffer, { animated: false, pages: 1 })
                        .png()
                        .toFile(mid);
                    await imageToVideo(mid, output);
                }
            }

            const outBuf = fs.readFileSync(output);
            if (!outBuf.length) throw new Error("Empty output video");

            await sock.sendMessage(
                from,
                {
                    video: outBuf,
                    mimetype: "video/mp4",
                    caption: "🎬 *Converted by VENOM X*"
                },
                { quoted: message }
            );
        } catch (err) {
            console.log("TOVID ERROR:", err.message || err);
            return reply(
                "❌ #tovid failed:\n" +
                    String(err.message || err).slice(0, 300) +
                    "\n\nTip: try a static sticker/image, or non-Lottie sticker."
            );
        } finally {
            try { fs.unlinkSync(input); } catch (e) {}
            try { fs.unlinkSync(mid); } catch (e) {}
            try { fs.unlinkSync(output); } catch (e) {}
        }
    }
};
