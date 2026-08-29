const {
    downloadContentFromMessage
} = require("@whiskeysockets/baileys");

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

module.exports = {
    name: "vv",
    aliases: ["viewonce", "view"],

    run: async ({ sock, from, message, reply }) => {
        try {
            const quoted = getQuotedMessage(message);

            if (!quoted) {
                return reply(
`╭━━〔 👁️ VENOM X VIEW ONCE 〕━━⬣
┃
┃ Reply to a View Once message
┃ and type:
┃
┃ #vv
┃
╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            const content = unwrapMessage(quoted);

            if (!content) {
                return reply("❌ Could not read the View Once message.");
            }

            // IMAGE
            if (content.imageMessage) {
                const buffer = await downloadMedia(content.imageMessage, "image");
                return await sock.sendMessage(from, {
                    image: buffer,
                    caption: "👁️ View Once unlocked by VENOM X"
                }, { quoted: message });
            }

            // VIDEO
            if (content.videoMessage) {
                const buffer = await downloadMedia(content.videoMessage, "video");
                return await sock.sendMessage(from, {
                    video: buffer,
                    caption: "👁️ View Once unlocked by VENOM X"
                }, { quoted: message });
            }

            // AUDIO
            if (content.audioMessage) {
                const buffer = await downloadMedia(content.audioMessage, "audio");
                return await sock.sendMessage(from, {
                    audio: buffer,
                    mimetype: content.audioMessage.mimetype || "audio/mpeg",
                    ptt: content.audioMessage.ptt || false
                }, { quoted: message });
            }

            // STICKER
            if (content.stickerMessage) {
                const buffer = await downloadMedia(content.stickerMessage, "sticker");
                return await sock.sendMessage(from, {
                    sticker: buffer
                }, { quoted: message });
            }

            return reply("❌ Unsupported View Once type.");

        } catch (error) {
            console.error("VV ERROR:", error);
            return reply(`❌ Failed to unlock View Once:\n${error.message}`);
        }
    }
};
