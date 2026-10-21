"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { exec } = require("child_process");
const { promisify } = require("util");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");

const execAsync = promisify(exec);

function tmp(ext) {
    return path.join(
        os.tmpdir(),
        "venom_tovid_" + crypto.randomBytes(6).toString("hex") + "." + ext
    );
}

function getQuoted(message) {
    return (
        message?.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
        null
    );
}

function unwrap(msg) {
    let c = msg;
    for (let i = 0; i < 5 && c; i++) {
        if (c.stickerMessage || c.imageMessage || c.videoMessage) return c;
        c =
            c.ephemeralMessage?.message ||
            c.viewOnceMessage?.message ||
            c.viewOnceMessageV2?.message ||
            c;
    }
    return c;
}

module.exports = {
    name: "tovid",
    aliases: ["tovideo", "stickertovid"],

    run: async function ({ sock, from, message, reply }) {
        const quoted = getQuoted(message);
        if (!quoted) {
            return reply("❌ Reply to a *sticker* or *image* with #tovid");
        }

        const payload = unwrap(quoted);
        const isSticker = !!payload?.stickerMessage;
        const isImage = !!payload?.imageMessage;

        if (!isSticker && !isImage) {
            return reply("❌ Reply to a sticker or image.");
        }

        const inPath = tmp(isSticker ? "webp" : "jpg");
        const outPath = tmp("mp4");

        try {
            await reply("⏳ Converting → video...");

            const buf = await downloadMediaMessage(
                { message: payload },
                "buffer",
                {}
            );
            if (!buf?.length) throw new Error("Empty download");
            fs.writeFileSync(inPath, buf);

            // Force decode animated webp frames into mp4
            const cmd =
                'ffmpeg -hide_banner -loglevel error -y -i "' +
                inPath +
                '" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p" ' +
                '-c:v libx264 -pix_fmt yuv420p -movflags +faststart -an "' +
                outPath +
                '"';

            await execAsync(cmd, { timeout: 60000 });

            if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 500) {
                throw new Error(
                    "Output video empty. Animated webp may need ffmpeg with libwebp."
                );
            }

            await sock.sendMessage(
                from,
                {
                    video: fs.readFileSync(outPath),
                    caption: "✅ Converted to video\n⚡ VENOM X",
                    mimetype: "video/mp4",
                    gifPlayback: isSticker
                },
                { quoted: message }
            );
        } catch (err) {
            console.log("TOVID ERROR:", err);
            return reply(
                "❌ #tovid failed:\n" +
                    String(err.message || err).slice(0, 280) +
                    "\n\nServer needs working ffmpeg (libwebp for stickers)."
            );
        } finally {
            try {
                fs.unlinkSync(inPath);
            } catch (e) {}
            try {
                fs.unlinkSync(outPath);
            } catch (e) {}
        }
    }
};
