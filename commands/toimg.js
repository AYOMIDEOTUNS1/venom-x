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
        "venom_toimg_" + crypto.randomBytes(6).toString("hex") + "." + ext
    );
}

function getQuoted(message) {
    return (
        message?.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
        message?.message?.imageMessage?.contextInfo?.quotedMessage ||
        null
    );
}

function unwrap(msg) {
    let c = msg;
    for (let i = 0; i < 5 && c; i++) {
        if (c.stickerMessage || c.imageMessage) return c;
        c =
            c.ephemeralMessage?.message ||
            c.viewOnceMessage?.message ||
            c.viewOnceMessageV2?.message ||
            c.documentWithCaptionMessage?.message ||
            c;
    }
    return c;
}

module.exports = {
    name: "toimg",
    aliases: ["toimage", "stickertoimg"],

    run: async function ({ sock, from, message, reply }) {
        const quoted = getQuoted(message);
        if (!quoted) {
            return reply("❌ Reply to a *sticker* with #toimg");
        }

        const payload = unwrap(quoted);
        if (!payload?.stickerMessage) {
            return reply("❌ Reply to a *sticker* (not an image).");
        }

        const inPath = tmp("webp");
        const outPath = tmp("png");

        try {
            await reply("⏳ Converting sticker → image...");

            const buf = await downloadMediaMessage(
                { message: payload },
                "buffer",
                {}
            );
            if (!buf?.length) throw new Error("Empty sticker download");

            fs.writeFileSync(inPath, buf);

            // sharp first
            try {
                const sharp = require("sharp");
                await sharp(buf).png().toFile(outPath);
            } catch (e) {
                // ffmpeg fallback
                await execAsync(
                    'ffmpeg -hide_banner -loglevel error -y -i "' +
                        inPath +
                        '" "' +
                        outPath +
                        '"',
                    { timeout: 30000 }
                );
            }

            if (!fs.existsSync(outPath)) {
                throw new Error("Conversion produced no file");
            }

            await sock.sendMessage(
                from,
                {
                    image: fs.readFileSync(outPath),
                    caption: "✅ Sticker → image\n⚡ VENOM X"
                },
                { quoted: message }
            );
        } catch (err) {
            console.log("TOIMG ERROR:", err);
            return reply(
                "❌ #toimg failed:\n" +
                    String(err.message || err).slice(0, 250) +
                    "\n\nNeed: sharp or ffmpeg on the server."
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
