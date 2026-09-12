const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const Jimp = require("jimp");

module.exports = {
    name: "hd",
    aliases: ["tohd", "hdify"],

    run: async function ({ sock, from, message, reply, args }) {
        try {
            const quoted =
                message.message &&
                message.message.extendedTextMessage &&
                message.message.extendedTextMessage.contextInfo &&
                message.message.extendedTextMessage.contextInfo.quotedMessage
                    ? message.message.extendedTextMessage.contextInfo.quotedMessage
                    : null;

            const target = quoted || message.message || null;

            const imageMsg =
                (target && target.imageMessage) ||
                (target && target.viewOnceMessage && target.viewOnceMessage.message && target.viewOnceMessage.message.imageMessage) ||
                (target && target.viewOnceMessageV2 && target.viewOnceMessageV2.message && target.viewOnceMessageV2.message.imageMessage) ||
                null;

            if (!imageMsg) {
                return reply(
"╭━━〔 📺 VENOM X HD 〕━━⬣\n\n" +
"Reply to an image:\n\n" +
"#hd\n\n" +
"Options:\n" +
"#hd doc   (send as HD file, no WA compression)\n\n" +
"╰━━━━━━━━━━━━━━━━⬣"
                );
            }

            const asDoc = String((args && args[0]) || "").toLowerCase() === "doc";
            await reply(asDoc ? "📺 Enhancing HD file..." : "📺 Enhancing image to HD...");

            const media = await downloadMediaMessage(
                {
                    message: target.imageMessage ? target : { imageMessage: imageMsg }
                },
                "buffer",
                {}
            );

            const image = await Jimp.read(media);
            const w = image.bitmap.width;
            const h = image.bitmap.height;

            // Scale up to at least Full HD on longest side
            const longest = Math.max(w, h);
            const targetLong = longest < 1280 ? 1920 : Math.min(2560, Math.round(longest * 1.5));
            const scale = targetLong / longest;

            const newW = Math.max(1, Math.round(w * scale));
            const newH = Math.max(1, Math.round(h * scale));

            // Resize
            if (Jimp.RESIZE_BICUBIC) {
                image.resize(newW, newH, Jimp.RESIZE_BICUBIC);
            } else {
                image.resize(newW, newH);
            }

            // Enhance quality
            image
                .contrast(0.15)
                .normalize()
                .sharpen(0.4);

            // Slight extra clarity pass
            if (typeof image.convolute === "function") {
                try {
                    image.convolute([
                        [0, -0.15, 0],
                        [-0.15, 1.6, -0.15],
                        [0, -0.15, 0]
                    ]);
                } catch (e) {}
            }

            const out = await image.quality(100).getBufferAsync(Jimp.MIME_JPEG);

            const caption =
"╭━━〔 📺 VENOM X HD 〕━━⬣\n\n" +
"✅ HD Enhanced\n" +
"📥 Original: " + w + "x" + h + "\n" +
"📐 Output: " + newW + "x" + newH + "\n\n" +
"⚡ Powered by VENOM X\n\n" +
"╰━━━━━━━━━━━━━━━━⬣";

            if (asDoc) {
                await sock.sendMessage(
                    from,
                    {
                        document: out,
                        mimetype: "image/jpeg",
                        fileName: "VENOM-X-HD-" + newW + "x" + newH + ".jpg",
                        caption: caption
                    },
                    { quoted: message }
                );
            } else {
                await sock.sendMessage(
                    from,
                    {
                        image: out,
                        caption: caption
                    },
                    { quoted: message }
                );

                // Also send as document so quality is preserved
                await sock.sendMessage(
                    from,
                    {
                        document: out,
                        mimetype: "image/jpeg",
                        fileName: "VENOM-X-HD-" + newW + "x" + newH + ".jpg"
                    },
                    { quoted: message }
                );
            }
        } catch (err) {
            console.log("HD ERROR:", err);
            return reply("❌ HD failed:\n" + (err && err.message ? err.message : String(err)));
        }
    }
};
