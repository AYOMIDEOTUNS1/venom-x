const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const {
    imageToSticker,
    videoToSticker
} = require("../lib/sticker");
const webp = require("node-webpmux");
const crypto = require("crypto");

const PACK_NAME = "VENOM X";
const AUTHOR_NAME = "⸸𝕍ΞȠØ𝕄⸸";

async function addExifToExistingSticker(webpBuffer) {
    const img = new webp.Image();

    const json = {
        "sticker-pack-id": crypto.randomBytes(16).toString("hex"),
        "sticker-pack-name": PACK_NAME,
        "sticker-pack-publisher": AUTHOR_NAME,
        "emojis": ["🔥"]
    };

    const exifAttr = Buffer.from([
        0x49, 0x49, 0x2A, 0x00,
        0x08, 0x00, 0x00, 0x00,
        0x01, 0x00,
        0x41, 0x57,
        0x07, 0x00,
        0x00, 0x00,
        0x00, 0x00,
        0x16, 0x00,
        0x00, 0x00
    ]);

    const jsonBuffer = Buffer.from(JSON.stringify(json), "utf8");
    const exif = Buffer.concat([exifAttr, jsonBuffer]);
    exif.writeUIntLE(jsonBuffer.length, 14, 4);

    await img.load(webpBuffer);
    img.exif = exif;
    return await img.save(null);
}

module.exports = {
    name: "take",
    aliases: ["steal", "s2"],

    run: async ({ sock, from, message, reply }) => {

        const quoted =
            message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted) {
            return reply(
`╭━━〔 🖼️ VENOM X TAKE 〕━━⬣

Reply to an image, video or sticker
and type:

#take
#steal
#s2

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        const isImage = !!quoted.imageMessage;
        const isVideo = !!quoted.videoMessage;
        const isSticker = !!quoted.stickerMessage;

        if (!isImage && !isVideo && !isSticker) {
            return reply("❌ Reply to an image, video or sticker.");
        }

        if (isVideo) {
            const seconds = quoted.videoMessage.seconds || 0;
            if (seconds > 10) {
                return reply("❌ Video must be 10 seconds or less.");
            }
        }

        try {
            await reply("🎨 Creating VENOM sticker...");

            const media = await downloadMediaMessage(
                { message: quoted },
                "buffer",
                {}
            );

            let sticker;

            if (isSticker) {
                // Handles both static and animated (video) stickers
                sticker = await addExifToExistingSticker(media);
            } else if (isImage) {
                sticker = await imageToSticker(media);
            } else {
                // Normal video → convert to animated sticker
                sticker = await videoToSticker(media);
            }

            await sock.sendMessage(
                from,
                { sticker },
                { quoted: message }
            );

        } catch (err) {
            console.log("TAKE ERROR:", err);
            return reply(
`╭━━〔 ❌ TAKE ERROR 〕━━⬣

${err.message}

╰━━━━━━━━━━━━━━━━⬣`
            );
        }
    }
};
