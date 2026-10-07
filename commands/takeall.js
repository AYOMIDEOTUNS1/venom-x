/**
 * #takeall [optional pack name]
 * Same EXIF as #take — VENOM X / ⸸𝕍ΞȠØ𝕄⸸
 */

const crypto = require("crypto");
const webp = require("node-webpmux");
const collector = require("../lib/stickerCollector");

const PACK_NAME = "VENOM X";
const AUTHOR_NAME = "⸸𝕍ΞȠØ𝕄⸸";

async function addExifToExistingSticker(webpBuffer, packName) {
    const img = new webp.Image();

    const json = {
        "sticker-pack-id": crypto.randomBytes(16).toString("hex"),
        "sticker-pack-name": packName || PACK_NAME,
        "sticker-pack-publisher": AUTHOR_NAME,
        emojis: ["🔥"]
    };

    const exifAttr = Buffer.from([
        0x49, 0x49, 0x2a, 0x00,
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
    name: "takeall",
    aliases: ["stealall", "packall", "stickerdump"],

    run: async function ({ sock, from, args, reply, message, isGroup }) {
        if (!isGroup) return reply("❌ Group only.");

        const stickers = collector.getStickers(from);
        if (!stickers || !stickers.length) {
            return reply(
"╭━━〔 📦 VENOM X TAKEALL 〕━━⬣\n" +
"┃ No stickers collected yet.\n" +
"┃ Send stickers in this group, then:\n" +
"┃ #takeall\n" +
"┃ #takeall My Pack Name\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        const packName =
            (args && args.length ? args.join(" ").trim() : "") || PACK_NAME;

        await reply(
            "📦 Building pack *" + packName + "* by " + AUTHOR_NAME +
            " (" + stickers.length + ")..."
        );

        let sent = 0;
        for (let i = 0; i < stickers.length; i++) {
            try {
                const sticker = await addExifToExistingSticker(
                    stickers[i],
                    packName
                );
                await sock.sendMessage(
                    from,
                    { sticker: sticker },
                    { quoted: message }
                );
                sent++;
                await new Promise(function (r) {
                    setTimeout(r, 400);
                });
            } catch (e) {
                console.log("TAKEALL item error:", e.message);
            }
        }

        return reply(
"╭━━〔 📦 VENOM X TAKEALL 〕━━⬣\n" +
"┃ Pack: *" + packName + "*\n" +
"┃ Author: " + AUTHOR_NAME + "\n" +
"┃ Sent: " + sent + "/" + stickers.length + "\n" +
"╰━━━━━━━━━━━━━━━━⬣"
        );
    }
};
