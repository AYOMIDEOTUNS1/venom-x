"use strict";

const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const {
    getStickerHistory,
    removeStickerHistory
} = require("../lib/stickerHistory");
const { addExif, PACK_NAME, AUTHOR_NAME } = require("../lib/stickerExif");

const MAX = 30;

function pickStickerMsg(stored) {
    let current = stored && stored.message;
    for (let i = 0; i < 5 && current; i++) {
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
            const p = raw.split("|");
            pack = (p[0] || "").trim() || PACK_NAME;
            author = (p[1] || "").trim() || AUTHOR_NAME;
        } else if (raw) {
            pack = raw;
        }

        let history = [];
        try {
            history = getStickerHistory(from) || [];
        } catch (e) {
            console.log("[TAKEALL] history:", e.message);
        }

        if (!history.length) {
            return reply(
`╭━━〔 📦 TAKEALL 〕━━⬣

No stickers saved in this chat yet.

Send some stickers here first, then:
#takeall
#takeall ${PACK_NAME} | ${AUTHOR_NAME}

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        const slice = history.slice(-MAX);
        await reply("⏳ Packing *" + slice.length + "* sticker(s) as *" + pack + "*…");

        const out = [];
        const usedKeys = [];
        const seen = new Set();

        for (let i = 0; i < slice.length; i++) {
            const item = slice[i];
            try {
                const sm = pickStickerMsg(item);
                if (!sm) continue;

                const sha = sm.fileSha256
                    ? Buffer.from(sm.fileSha256).toString("hex")
                    : null;
                if (sha) {
                    if (seen.has(sha)) continue;
                    seen.add(sha);
                }

                const buf = await downloadMediaMessage(
                    { key: item.key, message: item.message },
                    "buffer",
                    {}
                );
                if (!buf || buf.length < 50) continue;

                out.push(await addExif(buf, pack, author));
                if (item.key) usedKeys.push(item.key);
            } catch (e) {
                console.log("[TAKEALL] skip:", e.message);
            }
        }

        if (!out.length) {
            return reply("❌ Could not download stickers. Send fresh stickers and try again.");
        }

        let sent = 0;
        for (let i = 0; i < out.length; i++) {
            try {
                await sock.sendMessage(
                    from,
                    { sticker: out[i] },
                    { quoted: i === 0 ? message : undefined }
                );
                sent++;
                if (i < out.length - 1) {
                    await new Promise(function (r) { setTimeout(r, 450); });
                }
            } catch (e) {
                console.log("[TAKEALL] send fail:", e.message);
            }
        }

        try {
            if (usedKeys.length) removeStickerHistory(from, usedKeys);
        } catch (e) {}

        return reply(
`╭━━〔 ✅ TAKEALL 〕━━⬣

Pack : *${pack}*
Author : *${author}*
Sent : *${sent}* / ${out.length}

╰━━━━━━━━━━━━━━━━⬣`
        );
    }
};
