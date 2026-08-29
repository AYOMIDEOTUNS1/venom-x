const crypto = require("crypto");
const {
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    proto
} = require("@whiskeysockets/baileys");

/**
 * Experimental native sticker pack sender for Baileys 6.7.22
 * May work on some WhatsApp versions and fail on others.
 */
async function sendStickerPack(sock, jid, {
    name = "VENOM X",
    publisher = "⸸𝕍ΞȠØ𝕄⸸",
    description = "VENOM X Sticker Pack",
    stickers = [], // array of webp buffers
    cover = null   // optional webp/png buffer
} = {}) {
    if (!sock?.relayMessage) {
        throw new Error("Invalid socket");
    }

    if (!Array.isArray(stickers) || stickers.length < 3) {
        throw new Error("Need at least 3 stickers");
    }
    if (stickers.length > 30) {
        stickers = stickers.slice(0, 30);
    }

    const packId = "com.venomx.sticker." + crypto.randomBytes(8).toString("hex");

    // Upload each sticker as sticker media
    const uploadedStickers = [];
    for (let i = 0; i < stickers.length; i++) {
        const buf = stickers[i];
        if (!Buffer.isBuffer(buf) || buf.length < 100) continue;

        const prepared = await prepareWAMessageMedia(
            { sticker: buf },
            { upload: sock.waUploadToServer }
        );

        const s = prepared?.stickerMessage;
        if (!s) continue;

        const fileSha256 = s.fileSha256
            ? Buffer.from(s.fileSha256).toString("base64")
            : crypto.createHash("sha256").update(buf).digest("base64");

        uploadedStickers.push({
            fileName: `\( {String(i).padStart(2, "0")}_ \){fileSha256}.webp`,
            isAnimated: Boolean(s.isAnimated),
            isLottie: false,
            mimetype: s.mimetype || "image/webp",
            accessibilityLabel: "",
            emojis: ["🔥"]
        });
    }

    if (uploadedStickers.length < 3) {
        throw new Error("Failed to upload enough stickers");
    }

    // Cover / tray
    let tray = cover || stickers[0];
    let coverPrepared = null;
    try {
        coverPrepared = await prepareWAMessageMedia(
            { image: tray },
            { upload: sock.waUploadToServer }
        );
    } catch {
        try {
            coverPrepared = await prepareWAMessageMedia(
                { sticker: tray },
                { upload: sock.waUploadToServer }
            );
        } catch {}
    }

    const stickerPackMessage = {
        stickerPackId: packId,
        name,
        publisher,
        stickers: uploadedStickers,
        packDescription: description,
        stickerPackOrigin: 1
    };

    // Attach tray info if available
    if (coverPrepared?.imageMessage) {
        const img = coverPrepared.imageMessage;
        stickerPackMessage.trayIconFileName = `${packId}.png`;
        if (img.directPath) stickerPackMessage.thumbnailDirectPath = img.directPath;
        if (img.mediaKey) stickerPackMessage.mediaKey = img.mediaKey;
        if (img.fileSha256) stickerPackMessage.fileSha256 = img.fileSha256;
        if (img.fileEncSha256) stickerPackMessage.fileEncSha256 = img.fileEncSha256;
        if (img.fileLength) stickerPackMessage.fileLength = img.fileLength;
        if (img.jpegThumbnail) stickerPackMessage.jpegThumbnail = img.jpegThumbnail;
    }

    // Also keep raw uploaded sticker media on first sticker message if needed by client
    // Relay pack message
    const msg = generateWAMessageFromContent(
        jid,
        { stickerPackMessage },
        { userJid: sock.user?.id }
    );

    await sock.relayMessage(jid, msg.message, {
        messageId: msg.key.id
    });

    return {
        packId,
        count: uploadedStickers.length,
        messageId: msg.key.id
    };
}

module.exports = {
    sendStickerPack
};
