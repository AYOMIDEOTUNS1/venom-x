const sharp = require("sharp");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

function unwrap(msg) {
    let cur = msg;
    for (let i = 0; i < 5; i++) {
        const w =
            (cur && cur.ephemeralMessage && cur.ephemeralMessage.message) ||
            (cur && cur.viewOnceMessage && cur.viewOnceMessage.message) ||
            (cur && cur.viewOnceMessageV2 && cur.viewOnceMessageV2.message) ||
            null;
        if (!w) break;
        cur = w;
    }
    return cur;
}

module.exports = {
    name: "blur",
    aliases: ["gaussian", "imgblur"],

    run: async function ({ sock, from, message, args, reply }) {
        const ctx =
            message.message &&
            message.message.extendedTextMessage &&
            message.message.extendedTextMessage.contextInfo;

        const quoted = ctx && ctx.quotedMessage ? unwrap(ctx.quotedMessage) : null;
        if (!quoted || !quoted.imageMessage) {
            return reply("🖼️ Reply to an image with *#blur*\nOptional: *#blur 8*");
        }

        const sigma = Math.min(30, Math.max(1, parseInt(args[0], 10) || 6));

        try {
            await reply("⏳ Blurring...");
            const stream = await downloadContentFromMessage(quoted.imageMessage, "image");
            const chunks = [];
            for await (const c of stream) chunks.push(c);

            const out = await sharp(Buffer.concat(chunks))
                .blur(sigma)
                .jpeg({ quality: 90 })
                .toBuffer();

            await sock.sendMessage(
                from,
                { image: out, caption: "🌫️ Blur *" + sigma + "*\n⚡ VENOM X" },
                { quoted: message }
            );
        } catch (e) {
            return reply("❌ Blur failed:\n" + e.message);
        }
    }
};
