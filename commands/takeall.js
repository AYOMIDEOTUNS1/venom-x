/**
 * Pack every sticker sent in this group into one sticker pack.
 * Stickers must be sent AFTER the bot restarted (collector is in memory).
 * #takeall
 * #takeall My Pack
 */

const { Sticker } = require("wa-sticker-formatter");
const collector = require("../lib/stickerCollector");

module.exports = {
    name: "takeall",
    aliases: ["stealall", "packall", "stickerdump"],

    run: async function ({ sock, from, args, reply, message, isGroup }) {
        if (!isGroup) return reply("❌ Group only.");

        const stickers = collector.getStickers(from);
        if (!stickers.length) {
            return reply(
"╭━━〔 📦 TAKEALL 〕━━⬣\n" +
"┃\n" +
"┃ No stickers collected in this group yet.\n" +
"┃\n" +
"┃ Send stickers in the group, then:\n" +
"┃ #takeall\n" +
"┃ #takeall Pack Name\n" +
"┃\n" +
"┃ Only stickers sent after the bot\n" +
"┃ started are saved (max 30).\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        const pack = (args && args.join(" ").trim()) || "VENOM X";
        const author = "VENOM X";

        await reply("📦 Packing " + stickers.length + " sticker(s) as *" + pack + "*...");

        let sent = 0;
        for (let i = 0; i < stickers.length; i++) {
            try {
                const sticker = new Sticker(stickers[i], {
                    pack: pack,
                    author: author,
                    type: "full",
                    quality: 70
                });
                const buffer = await sticker.toBuffer();
                await sock.sendMessage(from, { sticker: buffer }, { quoted: message });
                sent++;
                await new Promise(function (r) { setTimeout(r, 500); });
            } catch (e) {
                // fallback: send raw webp
                try {
                    await sock.sendMessage(from, { sticker: stickers[i] }, { quoted: message });
                    sent++;
                } catch (e2) {}
            }
        }

        return reply(
"╭━━〔 📦 TAKEALL 〕━━⬣\n" +
"┃ Pack: " + pack + "\n" +
"┃ Author: " + author + "\n" +
"┃ Sent: " + sent + "/" + stickers.length + "\n" +
"┃\n" +
"┃ Save them in WhatsApp to keep\n" +
"┃ them as one pack.\n" +
"╰━━━━━━━━━━━━━━━━⬣"
        );
    }
};
