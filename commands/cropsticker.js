const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const { imageToSticker } = require("../lib/sticker");

module.exports = {
    aliases: ["csticker", "scrop"],

    run: async ({ sock, from, message, reply }) => {

        const quoted =
            message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted?.imageMessage) {
            return reply(
`╭━━〔 ✂️ CROP STICKER 〕━━⬣

Reply to an image.

Example:
.cropsticker

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        try {

            await reply("✂️ Creating cropped sticker...");

            const media = await downloadMediaMessage(
                { message: quoted },
                "buffer",
                {}
            );

            const sticker = await imageToSticker(media, true);

            await sock.sendMessage(
                from,
                {
                    sticker
                },
                {
                    quoted: message
                }
            );

        } catch (err) {

            console.log("CROP STICKER ERROR:", err);

            reply("❌ Failed to create cropped sticker.");

        }

    }
};
