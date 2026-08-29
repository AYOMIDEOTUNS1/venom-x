const {
    downloadContentFromMessage
} = require("@whiskeysockets/baileys");

const settings = require("../settings.json");

function getContextInfo(message) {
    return (
        message?.message?.extendedTextMessage?.contextInfo ||
        message?.message?.imageMessage?.contextInfo ||
        message?.message?.videoMessage?.contextInfo ||
        message?.message?.audioMessage?.contextInfo ||
        message?.message?.documentMessage?.contextInfo ||
        message?.message?.stickerMessage?.contextInfo ||
        {}
    );
}

function getQuotedMessage(message) {
    return getContextInfo(message)?.quotedMessage || null;
}

function unwrapMessage(message) {
    let current = message;

    for (let i = 0; i < 6 && current; i++) {
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
        break;
    }

    return current || null;
}

async function downloadMedia(mediaMessage, type) {
    if (!mediaMessage) throw new Error("Media message is missing.");

    const stream = await downloadContentFromMessage(mediaMessage, type);
    const chunks = [];

    for await (const chunk of stream) {
        chunks.push(chunk);
    }

    if (!chunks.length) throw new Error("No media data received.");
    return Buffer.concat(chunks);
}

async function react(sock, message, emoji) {
    try {
        await sock.sendMessage(message.key.remoteJid, {
            react: {
                text: emoji,
                key: message.key
            }
        });
    } catch (e) {}
}

module.exports = {
    name: "vv2",
    aliases: ["vvpm", "viewpm"],

    run: async function ({ sock, message, reply }) {
        try {
            const quoted = getQuotedMessage(message);

            if (!quoted) {
                return reply(
"╭━━〔 👁️ VENOM X VIEW ONCE PM 〕━━⬣\n" +
"┃\n" +
"┃ Reply to a View Once message\n" +
"┃ and type:\n" +
"┃\n" +
"┃ #vv2\n" +
"┃\n" +
"┃ Media goes to your private chat.\n" +
"┃ Success = react only (no text).\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
                );
            }

            const content = unwrapMessage(quoted);

            if (!content) {
                await react(sock, message, "❌");
                return;
            }

            const ownerJid = String(settings.ownerNumber || "").includes("@")
                ? settings.ownerNumber
                : String(settings.ownerNumber) + "@s.whatsapp.net";

            // IMAGE
            if (content.imageMessage) {
                const buffer = await downloadMedia(content.imageMessage, "image");
                await sock.sendMessage(ownerJid, {
                    image: buffer,
                    caption: "👁️ View Once unlocked"
                });
                await react(sock, message, "✅");
                return;
            }

            // VIDEO
            if (content.videoMessage) {
                const buffer = await downloadMedia(content.videoMessage, "video");
                await sock.sendMessage(ownerJid, {
                    video: buffer,
                    caption: "👁️ View Once unlocked"
                });
                await react(sock, message, "✅");
                return;
            }

            // AUDIO
            if (content.audioMessage) {
                const buffer = await downloadMedia(content.audioMessage, "audio");
                await sock.sendMessage(ownerJid, {
                    audio: buffer,
                    mimetype: content.audioMessage.mimetype || "audio/mpeg",
                    ptt: content.audioMessage.ptt || false
                });
                await react(sock, message, "✅");
                return;
            }

            // STICKER
            if (content.stickerMessage) {
                const buffer = await downloadMedia(content.stickerMessage, "sticker");
                await sock.sendMessage(ownerJid, {
                    sticker: buffer
                });
                await react(sock, message, "✅");
                return;
            }

            await react(sock, message, "❌");
        } catch (error) {
            console.error("VV2 ERROR:", error);
            await react(sock, message, "❌");
        }
    }
};
