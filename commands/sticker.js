const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const {
    imageToSticker,
    videoToSticker
} = require("../lib/sticker");
const webp = require("node-webpmux");
const crypto = require("crypto");

const PACK_NAME = "VENOM X";
const AUTHOR_NAME = "⸸𝕍ΞȠØ𝕄⸸";

function getQuoted(message) {
    const ctx =
        message.message?.extendedTextMessage?.contextInfo ||
        message.message?.imageMessage?.contextInfo ||
        message.message?.videoMessage?.contextInfo ||
        message.message?.stickerMessage?.contextInfo ||
        {};
    return ctx.quotedMessage || null;
}

async function rebrandSticker(buffer) {
    const img = new webp.Image();
    const json = {
        "sticker-pack-id": crypto.randomBytes(16).toString("hex"),
        "sticker-pack-name": PACK_NAME,
        "sticker-pack-publisher": AUTHOR_NAME,
        emojis: ["🔥"]
    };

    const exifAttr = Buffer.from([
        0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00,
        0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00
    ]);
    const jsonBuffer = Buffer.from(JSON.stringify(json), "utf8");
    const exif = Buffer.concat([exifAttr, jsonBuffer]);
    exif.writeUIntLE(jsonBuffer.length, 14, 4);

    await img.load(buffer);
    img.exif = exif;
    return await img.save(null);
}

module.exports = {
    name: "sticker",
    aliases: ["s"],

    run: async ({ sock, from, message, reply }) => {
        const quoted = getQuoted(message);

        if (!quoted) {
            return reply(
`╭━━〔 🖼️ STICKER 〕━━⬣

Reply to an image, video, or sticker.

Example:
#s

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        const isImage = !!quoted.imageMessage;
        const isVideo = !!quoted.videoMessage;
        const isSticker = !!quoted.stickerMessage;

        if (!isImage && !isVideo && !isSticker) {
            return reply("❌ Reply to an image, video, or sticker.");
        }

        if (isVideo) {
            const seconds = quoted.videoMessage.seconds || 0;
            if (seconds > 10) {
                return reply("❌ Video must be 10 seconds or less.");
            }
        }

        try {
            await reply("🎨 Creating sticker...");

            const media = await downloadMediaMessage(
                { message: quoted },
                "buffer",
                {}
            );

            let sticker;

            if (isSticker) {
                sticker = await rebrandSticker(media);
            } else if (isImage) {
                sticker = await imageToSticker(media);
            } else {
                sticker = await videoToSticker(media);
            }

            await sock.sendMessage(from, { sticker }, { quoted: message });

        } catch (err) {
            console.log("STICKER ERROR:", err);
            return reply(
`╭━━〔 ❌ STICKER ERROR 〕━━⬣

${err.message}

╰━━━━━━━━━━━━━━━━⬣`
            );
        }
    }
};
