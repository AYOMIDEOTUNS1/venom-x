/**
 * VENOM X - #tovid (animated sticker fix)
 * Static sticker/image → short video
 * Animated sticker → real moving video
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
            (cur && cur.viewOnceMessageV2Extension &&
                cur.viewOnceMessageV2Extension.message) ||
            (cur && cur.ephemeralMessage && cur.ephemeralMessage.message) ||
            (cur && cur.documentWithCaptionMessage &&
                cur.documentWithCaptionMessage.message) ||
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

async function staticToVideo(pngPath, outputPath) {
    await execAsync(
        'ffmpeg -hide_banner -loglevel error -y -loop 1 -i "' +
            pngPath +
            '" -t 3 -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p" ' +
            '-c:v libx264 -pix_fmt yuv420p -movflags +faststart "' +
            outputPath +
            '"'
    );
}

async function animatedWebpToVideo(webpPath, outputPath) {
    const gifPath = tmp("gif");

    // 1) best: ffmpeg reads animated webp directly
    try {
        await execAsync(
            'ffmpeg -hide_banner -loglevel error -y -i "' +
                webpPath +
                '" -vf "fps=20,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p" ' +
                '-c:v libx264 -pix_fmt yuv420p -movflags +faststart -an "' +
                outputPath +
                '"'
        );
        // if file is tiny, treat as fail
        const st = fs.statSync(outputPath);
        if (st.size > 5000) return;
        throw new Error("output too small");
    } catch (e1) {
        // 2) sharp animated → gif → mp4
        try {
            await sharp(webpPath, { animated: true })
                .gif()
                .toFile(gifPath);

            await execAsync(
                'ffmpeg -hide_banner -loglevel error -y -i "' +
                    gifPath +
                    '" -vf "fps=20,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p" ' +
                    '-c:v libx264 -pix_fmt yuv420p -movflags +faststart -an "' +
                    outputPath +
                    '"'
            );
        } finally {
            try { fs.unlinkSync(gifPath); } catch (e) {}
        }
    }
}

async function videoPassthrough(inputPath, outputPath) {
    await execAsync(
        'ffmpeg -hide_banner -loglevel error -y -i "' +
            inputPath +
            '" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p" ' +
            '-c:v libx264 -pix_fmt yuv420p -movflags +faststart -an "' +
            outputPath +
            '"'
    );
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
"┃ • animated sticker\n" +
"┃ • static sticker / image\n" +
"┃ • gif / video\n" +
"┃\n" +
"┃ Then: #tovid\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        if (
            quoted.stickerMessage &&
            (quoted.stickerMessage.isLottie || quoted.stickerMessage.lottie)
        ) {
            return reply("❌ Lottie stickers can't be converted.");
        }

        let type = null;
        let animated = false;

        if (quoted.stickerMessage) {
            type = "sticker";
            animated = !!(
                quoted.stickerMessage.isAnimated ||
                quoted.stickerMessage.isAvatar
            );
        } else if (quoted.imageMessage) {
            type = "image";
        } else if (quoted.videoMessage) {
            type = "video";
            animated = true;
        } else {
            return reply("❌ Reply to a sticker, image, or video.");
        }

        const input = tmp(
            type === "sticker" ? "webp" : type === "image" ? "jpg" : "mp4"
        );
        const mid = tmp("png");
        const output = tmp("mp4");

        try {
            await reply(
                animated
                    ? "🎬 Converting animated sticker/video..."
                    : "🎬 Converting to video..."
            );

            const buffer = await download(quoted, type);
            fs.writeFileSync(input, buffer);

            if (type === "video") {
                await videoPassthrough(input, output);
            } else if (type === "sticker" && animated) {
                await animatedWebpToVideo(input, output);
            } else {
                // static sticker / image
                await sharp(buffer).rotate().png().toFile(mid);
                await staticToVideo(mid, output);
            }

            const outBuf = fs.readFileSync(output);
            if (!outBuf.length) throw new Error("Empty output video");

            await sock.sendMessage(
                from,
                {
                    video: outBuf,
                    mimetype: "video/mp4",
                    gifPlayback: animated, // plays more like sticker in chat
                    caption: "🎬 *Converted by VENOM X*"
                },
                { quoted: message }
            );
        } catch (err) {
            console.log("TOVID ERROR:", err.message || err);
            return reply(
                "❌ #tovid failed:\n" +
                    String(err.message || err).slice(0, 280) +
                    "\n\nNeed ffmpeg + sharp. Animated webp support depends on server ffmpeg build."
            );
        } finally {
            try { fs.unlinkSync(input); } catch (e) {}
            try { fs.unlinkSync(mid); } catch (e) {}
            try { fs.unlinkSync(output); } catch (e) {}
        }
    }
};
