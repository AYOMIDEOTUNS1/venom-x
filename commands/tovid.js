/**
 * VENOM X - #tovid
 * Reply to sticker / image / gif → video (mp4)
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { exec } = require("child_process");
const { promisify } = require("util");
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
    const stream = await downloadContentFromMessage(node, type === "sticker" ? "sticker" : type);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

async function toVideo(inputPath, outputPath, isImage) {
    // image → 3s video; animated sticker/gif → normal video
    if (isImage) {
        await execAsync(
            'ffmpeg -hide_banner -loglevel error -y -loop 1 -i "' +
                inputPath +
                '" -t 3 -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -pix_fmt yuv420p -movflags +faststart "' +
                outputPath +
                '"'
        );
    } else {
        await execAsync(
            'ffmpeg -hide_banner -loglevel error -y -i "' +
                inputPath +
                '" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -pix_fmt yuv420p -movflags +faststart -an "' +
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
"┃\n" +
"┃ Reply to:\n" +
"┃ • animated sticker\n" +
"┃ • image\n" +
"┃ • gif / short video\n" +
"┃\n" +
"┃ Then type:\n" +
"┃ #tovid\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        let type = null;
        let isImage = false;

        if (quoted.stickerMessage) {
            type = "sticker";
            isImage = !(quoted.stickerMessage.isAnimated || quoted.stickerMessage.isLottie);
        } else if (quoted.imageMessage) {
            type = "image";
            isImage = true;
        } else if (quoted.videoMessage) {
            type = "video";
            isImage = false;
        } else {
            return reply("❌ Reply to a sticker, image, or gif/video.");
        }

        const input = tmp(type === "sticker" ? "webp" : type === "image" ? "jpg" : "mp4");
        const output = tmp("mp4");

        try {
            await reply("🎬 Converting to video...");

            const buffer = await download(quoted, type);
            if (!buffer || !buffer.length) throw new Error("Download failed");

            fs.writeFileSync(input, buffer);
            await toVideo(input, output, isImage);

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
                    (err.message || String(err)) +
                    "\n\nMake sure ffmpeg is installed on the server."
            );
        } finally {
            try { fs.unlinkSync(input); } catch (e) {}
            try { fs.unlinkSync(output); } catch (e) {}
        }
    }
};
