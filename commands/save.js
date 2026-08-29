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

    if (!mediaMessage) {
        throw new Error("Media message is missing.");
    }

    const stream =
        await downloadContentFromMessage(
            mediaMessage,
            type
        );

    const chunks = [];

    for await (const chunk of stream) {
        chunks.push(chunk);
    }

    if (!chunks.length) {
        throw new Error("No media data received.");
    }

    return Buffer.concat(chunks);
}

module.exports = {

    name: "save",

    aliases: [
        "savestatus",
        "statussave"
    ],

    run: async ({
        sock,
        from,
        message,
        reply
    }) => {

        try {

            const quoted =
                getQuotedMessage(message);

            if (!quoted) {
                return reply(
`╭━━〔 💾 VENOM X SAVE 〕━━⬣
┃
┃ ❌ No quoted status detected.
┃
┃ Reply directly to a WhatsApp
┃ status photo/video and send:
┃
┃ #save
┃
╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            const content =
                unwrapMessage(quoted);

            if (!content) {
                return reply(
                    "❌ I couldn't read the quoted status."
                );
            }

            // =================================================
            // IMAGE
            // =================================================

            if (content.imageMessage) {

                const buffer =
                    await downloadMedia(
                        content.imageMessage,
                        "image"
                    );

                return await sock.sendMessage(
                    from,
                    {
                        image: buffer,

                        caption:
`╭━━〔 💾 VENOM X SAVE 〕━━⬣
┃
┃ ✅ Status saved successfully.
┃ 📸 Type : Photo
┃
╰━━━━━━━━━━━━━━━━⬣`
                    },
                    {
                        quoted: message
                    }
                );
            }

            // =================================================
            // VIDEO
            // =================================================

            if (content.videoMessage) {

                const buffer =
                    await downloadMedia(
                        content.videoMessage,
                        "video"
                    );

                return await sock.sendMessage(
                    from,
                    {
                        video: buffer,

                        caption:
`╭━━〔 💾 VENOM X SAVE 〕━━⬣
┃
┃ ✅ Status saved successfully.
┃ 🎥 Type : Video
┃
╰━━━━━━━━━━━━━━━━⬣`
                    },
                    {
                        quoted: message
                    }
                );
            }

            // =================================================
            // AUDIO
            // =================================================

            if (content.audioMessage) {

                const buffer =
                    await downloadMedia(
                        content.audioMessage,
                        "audio"
                    );

                return await sock.sendMessage(
                    from,
                    {
                        audio: buffer,

                        mimetype:
                            content.audioMessage.mimetype ||
                            "audio/mpeg",

                        fileName:
                            "VENOM-X-Status.mp3",

                        ptt: false
                    },
                    {
                        quoted: message
                    }
                );
            }

            // =================================================
            // DOCUMENT
            // =================================================

            if (content.documentMessage) {

                const buffer =
                    await downloadMedia(
                        content.documentMessage,
                        "document"
                    );

                return await sock.sendMessage(
                    from,
                    {
                        document: buffer,

                        mimetype:
                            content.documentMessage.mimetype ||
                            "application/octet-stream",

                        fileName:
                            content.documentMessage.fileName ||
                            "VENOM-X-Status"
                    },
                    {
                        quoted: message
                    }
                );
            }

            // =================================================
            // STICKER
            // =================================================

            if (content.stickerMessage) {

                const buffer =
                    await downloadMedia(
                        content.stickerMessage,
                        "sticker"
                    );

                return await sock.sendMessage(
                    from,
                    {
                        sticker: buffer
                    },
                    {
                        quoted: message
                    }
                );
            }

            return reply(
`╭━━〔 💾 VENOM X SAVE 〕━━⬣
┃
┃ ❌ Unsupported status type.
┃
┃ Supported:
┃ 📸 Photo
┃ 🎥 Video
┃ 🎵 Audio
┃ 📄 Document
┃ 🔖 Sticker
╰━━━━━━━━━━━━━━━━⬣`
            );

        } catch (error) {

            console.error(
                "SAVE ERROR:",
                error
            );

            return reply(
`╭━━〔 ❌ VENOM X SAVE ERROR 〕━━⬣
┃
┃ Failed to save the status.
┃
┃ Reason:
┃ ${error.message}
┃
╰━━━━━━━━━━━━━━━━⬣`
            );
        }
    }
};
