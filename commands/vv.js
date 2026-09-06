const {
    downloadContentFromMessage,
    downloadMediaMessage
} = require("@whiskeysockets/baileys");
const pino = require("pino");

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
    } catch (e) {
        console.log("VV stream fail:", e.message);
    }

    // fallback — helps avoid "Waiting for this message"
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
        console.log("VV fallback fail:", e.message);
    }

    throw new Error("Could not download media (expired or already opened).");
}

module.exports = {
    name: "vv",
    aliases: ["viewonce", "view"],

    run: async function ({ sock, from, message, reply }) {
        try {
            const contextInfo = getContextInfo(message);
            const quoted = getQuotedMessage(message);

            if (!quoted) {
                return reply(
"╭━━〔 👁️ VENOM X VIEW ONCE 〕━━⬣\n\n" +
"Reply to a View Once message:\n#vv\n\n" +
"╰━━━━━━━━━━━━━━━━⬣"
                );
            }

            const content = unwrapMessage(quoted);
            if (!content) {
                return reply("❌ Could not read that View Once message.");
            }

            if (content.imageMessage) {
                const buffer = await downloadMedia(
                    content.imageMessage, "image", sock, message, contextInfo
                );
                return sock.sendMessage(
                    from,
                    { image: buffer, caption: "👁️ View Once unlocked" },
                    { quoted: message }
                );
            }

            if (content.videoMessage) {
                const buffer = await downloadMedia(
                    content.videoMessage, "video", sock, message, contextInfo
                );
                return sock.sendMessage(
                    from,
                    { video: buffer, caption: "👁️ View Once unlocked" },
                    { quoted: message }
                );
            }

            if (content.audioMessage) {
                const buffer = await downloadMedia(
                    content.audioMessage, "audio", sock, message, contextInfo
                );
                return sock.sendMessage(
                    from,
                    {
                        audio: buffer,
                        mimetype: content.audioMessage.mimetype || "audio/ogg; codecs=opus",
                        ptt: !!content.audioMessage.ptt
                    },
                    { quoted: message }
                );
            }

            if (content.stickerMessage) {
                const buffer = await downloadMedia(
                    content.stickerMessage, "sticker", sock, message, contextInfo
                );
                return sock.sendMessage(from, { sticker: buffer }, { quoted: message });
            }

            return reply("❌ Unsupported View Once type.");
        } catch (error) {
            console.log("VV ERROR:", error.message);
            return reply("❌ Failed:\n" + error.message);
        }
    }
};
