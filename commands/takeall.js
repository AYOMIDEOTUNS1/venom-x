"use strict";

const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const { getStickerHistory, removeStickerHistory } = require("../lib/stickerHistory");
const { addExif, PACK_NAME, AUTHOR_NAME } = require("../lib/stickerExif");
const { PACK_HARD_LIMIT, sendNativeStickerPack } = require("../lib/nativeStickerPack");

function getStickerMessage(message) {
    let current = message && message.message;
    for (let i = 0; i < 4 && current; i++) {
        if (current.stickerMessage) return current.stickerMessage;
        if (current.ephemeralMessage && current.ephemeralMessage.message) {
            current = current.ephemeralMessage.message;
            continue;
        }
        if (current.viewOnceMessage && current.viewOnceMessage.message) {
            current = current.viewOnceMessage.message;
            continue;
        }
        if (current.viewOnceMessageV2 && current.viewOnceMessageV2.message) {
            current = current.viewOnceMessageV2.message;
            continue;
        }
        break;
    }
    return null;
}

module.exports = {
    name: "takeall",
    aliases: ["stickerpack", "packall", "stealall"],

    run: async function ({ sock, from, message, reply, args }) {
        let pack = PACK_NAME;
        let author = AUTHOR_NAME;
        const raw = (args || []).join(" ").trim();
        if (raw.includes("|")) {
            const parts = raw.split("|");
            pack = (parts[0] || "").trim() || PACK_NAME;
            author = (parts[1] || "").trim() || AUTHOR_NAME;
        } else if (raw) {
            pack = raw;
        }

        const history = getStickerHistory(from) || [];
        if (!history.length) {
            return reply(
`╭━━〔 📦 TAKEALL 〕━━⬣

No saved stickers in this chat yet.

Send stickers here first, then:
#takeall
#takeall MyPack | MyName

Default: *\( {PACK_NAME}* · * \){AUTHOR_NAME}*
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        const limit = Math.min(history.length, PACK_HARD_LIMIT);
        await reply(
            "⏳ Building pack *" + pack + "* from " + limit + " sticker(s)…"
        );

        const buffers = [];
        const usedKeys = [];
        const seen = new Set();

        for (let i = 0; i < history.length && buffers.length < limit; i++) {
            const item = history[i];
            try {
                const stickerMsg = getStickerMessage(item);
                if (!stickerMsg) continue;

                // dedupe by file sha if present
                const sha = stickerMsg.fileSha256
                    ? Buffer.from(stickerMsg.fileSha256).toString("hex")
                    : null;
                if (sha && seen.has(sha)) continue;
                if (sha) seen.add(sha);

                const media = await downloadMediaMessage(
                    {
                        key: item.key,
                        message: item.message
                    },
                    "buffer",
                    {}
                );

                if (!media || media.length < 100) continue;

                // FORCE your pack name on every sticker
                const branded = await addExif(media, pack, author);
                buffers.push(branded);
                if (item.key) usedKeys.push(item.key);
            } catch (e) {
                console.log("[TAKEALL] skip:", e.message);
            }
        }

        if (!buffers.length) {
            return reply("❌ Could not download any stickers from history.");
        }

        try {
            const result = await sendNativeStickerPack(sock, from, buffers, {
                packName: pack,
                publisher: author,
                quoted: message
            });

            // clear used from history so next takeall is fresh (optional)
            try {
                if (usedKeys.length) removeStickerHistory(from, usedKeys);
            } catch (e) {}

            return reply(
`╭━━〔 ✅ STICKER PACK 〕━━⬣

Pack : *${pack}*
Author : *${author}*
Stickers : *${result.count}*
Mode : *${result.mode}*

╰━━━━━━━━━━━━━━━━⬣`
            );
        } catch (err) {
            console.error("[TAKEALL]", err);
            return reply("❌ Pack failed: " + (err.message || err));
        }
    }
};
