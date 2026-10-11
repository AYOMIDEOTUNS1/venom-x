"use strict";

const crypto = require("crypto");
const { PACK_NAME, AUTHOR_NAME } = require("./stickerExif");

const PACK_HARD_LIMIT = 60;

/**
 * Send a native WhatsApp sticker pack (Baileys 6/7).
 * stickers: Array<Buffer> webp buffers (already with EXIF if possible)
 */
async function sendNativeStickerPack(sock, jid, stickers, options) {
    options = options || {};
    const packName = options.packName || PACK_NAME;
    const publisher = options.publisher || AUTHOR_NAME;
    const quoted = options.quoted || null;

    if (!stickers || !stickers.length) {
        throw new Error("No stickers to pack");
    }

    const list = stickers.slice(0, PACK_HARD_LIMIT);

    // Baileys native pack message (when supported)
    if (typeof sock.sendMessage === "function") {
        try {
            await sock.sendMessage(
                jid,
                {
                    stickerPack: {
                        name: packName,
                        publisher: publisher,
                        stickers: list.map(function (buf, i) {
                            return {
                                sticker: buf,
                                emojis: ["🔥"],
                                isAnimated: false
                            };
                        })
                    }
                },
                quoted ? { quoted: quoted } : undefined
            );
            return { mode: "native", count: list.length };
        } catch (e1) {
            console.log("[STICKERPACK] native failed:", e1.message);
        }
    }

    // Fallback: send stickers one by one with pack EXIF already applied
    for (let i = 0; i < list.length; i++) {
        await sock.sendMessage(
            jid,
            { sticker: list[i] },
            quoted ? { quoted: quoted } : undefined
        );
        if (i < list.length - 1) {
            await new Promise(function (r) {
                setTimeout(r, 400);
            });
        }
    }
    return { mode: "single", count: list.length };
}

module.exports = {
    PACK_HARD_LIMIT,
    sendNativeStickerPack
};
