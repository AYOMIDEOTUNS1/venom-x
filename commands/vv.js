"use strict";

/**
 * VENOM X — #vv
 * Unlock view-once media in the same chat
 */

const {
    downloadContentFromMessage,
    downloadMediaMessage
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { getSettings } = require("../lib/settingsCache");

function px() {
    try {
        return getSettings().prefix || "#";
    } catch (e) {
        return "#";
    }
}

function getContextInfo(message) {
    const m = (message && message.message) || {};
    return (
        m.extendedTextMessage?.contextInfo ||
        m.imageMessage?.contextInfo ||
        m.videoMessage?.contextInfo ||
        m.audioMessage?.contextInfo ||
        m.documentMessage?.contextInfo ||
        m.stickerMessage?.contextInfo ||
        {}
    );
}

function getQuotedMessage(message) {
    return getContextInfo(message).quotedMessage || null;
}

function unwrapMessage(message) {
    let current = message;
    for (let i = 0; i < 10 && current; i++) {
        if (current.ephemeralMessage?.message) {
            current = current.ephemeralMessage.message;
            continue;
        }
        if (current.viewOnceMessage?.message) {
            current = current.viewOnceMessage.message;
            continue;
        }
        if (current.viewOnceMessageV2?.message) {
            current = current.viewOnceMessageV2.message;
            continue;
        }
        if (current.viewOnceMessageV2Extension?.message) {
            current = current.viewOnceMessageV2Extension.message;
            continue;
        }
        if (current.documentWithCaptionMessage?.message) {
            current = current.documentWithCaptionMessage.message;
            continue;
        }
        break;
    }
    return current || null;
}

function detectType(content) {
    if (!content) return null;
    if (content.imageMessage) return "image";
    if (content.videoMessage) return "video";
    if (content.audioMessage) return "audio";
    if (content.stickerMessage) return "sticker";
    if (content.documentMessage) return "document";
    return null;
}

async function downloadMedia(mediaMessage, type, sock, message, contextInfo) {
    try {
        const stream = await downloadContentFromMessage(mediaMessage, type);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        if (chunks.length) return Buffer.concat(chunks);
    } catch (e) {
        console.log("[VV] stream fail:", e.message);
    }

    try {
        const buf = await downloadMediaMessage(
            {
                key: {
                    remoteJid: message.key.remoteJid,
                    id: contextInfo.stanzaId,
                    participant: contextInfo.participant
                },
                message: { [type + "Message"]: mediaMessage }
            },
            "buffer",
            {},
            {
                logger: pino({ level: "silent" }),
                reuploadRequest: sock.updateMediaMessage
            }
        );
        if (buf && buf.length) return Buffer.from(buf);
    } catch (e) {
        console.log("[VV] fallback fail:", e.message);
    }

    throw new Error("Could not download media (expired or already opened).");
}

module.exports = {
    name: "vv",
    aliases: ["viewonce", "view", "readvo"],

    run: async function ({ sock, from, message, reply }) {
        try {
            const contextInfo = getContextInfo(message);
            const quoted = getQuotedMessage(message);

            if (!quoted) {
                return reply(
`╭━━〔 👁️ VENOM X VIEW ONCE 〕━━⬣

Reply to a *View Once* message:
${px()}vv

Supports: image · video · audio · sticker

╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            const content = unwrapMessage(quoted);
            const type = detectType(content);

            if (!type) {
                return reply("❌ Could not read that View Once message.");
            }

            const mediaMessage = content[type + "Message"];
            const buffer = await downloadMedia(
                mediaMessage,
                type,
                sock,
                message,
                contextInfo
            );

            if (type === "image") {
                return sock.sendMessage(
                    from,
                    { image: buffer, caption: "👁️ View Once unlocked · VENOM X" },
                    { quoted: message }
                );
            }

            if (type === "video") {
                return sock.sendMessage(
                    from,
                    { video: buffer, caption: "👁️ View Once unlocked · VENOM X" },
                    { quoted: message }
                );
            }

            if (type === "audio") {
                return sock.sendMessage(
                    from,
                    {
                        audio: buffer,
                        mimetype:
                            mediaMessage.mimetype || "audio/ogg; codecs=opus",
                        ptt: !!mediaMessage.ptt
                    },
                    { quoted: message }
                );
            }

            if (type === "sticker") {
                return sock.sendMessage(
                    from,
                    { sticker: buffer },
                    { quoted: message }
                );
            }

            if (type === "document") {
                return sock.sendMessage(
                    from,
                    {
                        document: buffer,
                        mimetype: mediaMessage.mimetype || "application/octet-stream",
                        fileName: mediaMessage.fileName || "venom-vv.bin",
                        caption: "👁️ View Once document unlocked"
                    },
                    { quoted: message }
                );
            }

            return reply("❌ Unsupported View Once type.");
        } catch (error) {
            console.log("[VV ERROR]", error.message);
            return reply("❌ Failed:\n" + error.message);
        }
    }
};
