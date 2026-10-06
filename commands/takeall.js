/**
 * Pack stickers collected in this group (no wa-sticker-formatter)
 */
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
"┃ No stickers collected yet.\n" +
"┃ Send stickers in this group, then:\n" +
"┃ #takeall\n" +
"┃ (max 30 after bot start)\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        const pack = (args && args.join(" ").trim()) || "VENOM X";
        await reply("📦 Sending " + stickers.length + " sticker(s)...");

        let sent = 0;
        for (let i = 0; i < stickers.length; i++) {
            try {
                await sock.sendMessage(
                    from,
                    { sticker: stickers[i] },
                    { quoted: message }
                );
                sent++;
                await new Promise(function (r) {
                    setTimeout(r, 450);
                });
            } catch (e) {}
        }

        return reply(
"╭━━〔 📦 TAKEALL 〕━━⬣\n" +
"┃ Pack tag: " + pack + "\n" +
"┃ Sent: " + sent + "/" + stickers.length + "\n" +
"╰━━━━━━━━━━━━━━━━⬣"
        );
    }
};
