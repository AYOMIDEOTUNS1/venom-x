const {
    downloadContentFromMessage,
    downloadMediaMessage
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { getSettings } = require("../lib/settingsCache");

function getContextInfo(message) {
    const m = message && message.message ? message.message : {};
    return (
        (m.extendedTextMessage && m.extendedTextMessage.contextInfo) ||
        (m.imageMessage && m.imageMessage.contextInfo) ||
        (m.videoMessage && m.videoMessage.contextInfo) ||
        (m.audioMessage && m.audioMessage.contextInfo) ||
        (m.documentMessage && m.documentMessage.contextInfo) ||
        (m.stickerMessage && m.stickerMessage.contextInfo) ||
        {}
    );
}

function getQuotedMessage(message) {
    return getContextInfo(message).quotedMessage || null;
}

function unwrapMessage(message) {
    let current = message;
    for (let i = 0; i < 8 && current; i++) {
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
        if (current.viewOnceMessageV2Extension && current.viewOnceMessageV2Extension.message) {
            current = current.viewOnceMessageV2Extension.message;
            continue;
        }
        break;
    }
    return current || null;
}

async function downloadMedia(mediaMessage, type, sock, message, contextInfo) {
    try {
        const stream = await downloadContentFromMessage(mediaMessage, type);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        if (chunks.length) return Buffer.concat(chunks);
    } catch (e) {}

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
    } catch (e) {}

    throw new Error("Could not download media (expired or already opened).");
}

async function react(sock, message, emoji) {
    try {
        await sock.sendMessage(message.key.remoteJid, {
            react: { text: emoji, key: message.key }
        });
    } catch (e) {}
}

function ownerJid(sock) {
    const settings = getSettings();
    const num = String(settings.ownerNumber || "").replace(/\D/g, "");
    if (num) return num + "@s.whatsapp.net";
    try {
        if (sock.user && sock.user.id) {
            return sock.user.id.split(":")[0] + "@s.whatsapp.net";
        }
    } catch (e) {}
    return null;
}

module.exports = {
    name: "vv2",
    aliases: ["vvpm", "viewpm"],

    run: async function ({ sock, message }) {
        try {
            const contextInfo = getContextInfo(message);
            const quoted = getQuotedMessage(message);
            if (!quoted) {
                await react(sock, message, "❓");
                return;
            }

            const content = unwrapMessage(quoted);
            if (!content) {
                await react(sock, message, "❌");
                return;
            }

            const to = ownerJid(sock);
            if (!to) {
                await react(sock, message, "❌");
                return;
            }

            if (content.imageMessage) {
                const buffer = await downloadMedia(
                    content.imageMessage, "image", sock, message, contextInfo
                );
                await sock.sendMessage(to, { image: buffer, caption: "👁️ VV2" });
                await react(sock, message, "✅");
                return;
            }

            if (content.videoMessage) {
                const buffer = await downloadMedia(
                    content.videoMessage, "video", sock, message, contextInfo
                );
                await sock.sendMessage(to, { video: buffer, caption: "👁️ VV2" });
                await react(sock, message, "✅");
                return;
            }

            if (content.audioMessage) {
                const buffer = await downloadMedia(
                    content.audioMessage, "audio", sock, message, contextInfo
                );
                await sock.sendMessage(to, {
                    audio: buffer,
                    mimetype: content.audioMessage.mimetype || "audio/ogg; codecs=opus",
                    ptt: !!content.audioMessage.ptt
                });
                await react(sock, message, "✅");
                return;
            }

            if (content.stickerMessage) {
                const buffer = await downloadMedia(
                    content.stickerMessage, "sticker", sock, message, contextInfo
                );
                await sock.sendMessage(to, { sticker: buffer });
                await react(sock, message, "✅");
                return;
            }

            await react(sock, message, "❌");
        } catch (error) {
            console.log("VV2 ERROR:", error.message);
            await react(sock, message, "❌");
        }
    }
};
