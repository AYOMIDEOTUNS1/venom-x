const axios = require("axios");
const FormData = require("form-data");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");

module.exports = {
    name: "url",

    aliases: [
        "upload",
        "tourl",
        "catbox"
    ],

    run: async ({
        sock,
        from,
        args,
        reply,
        message,
        commandName
    }) => {

        // ================================================
        // FIND MEDIA (quoted or direct)
        // ================================================

        const context =
            message?.message?.extendedTextMessage?.contextInfo ||
            message?.message?.imageMessage?.contextInfo ||
            message?.message?.videoMessage?.contextInfo ||
            message?.message?.audioMessage?.contextInfo ||
            message?.message?.documentMessage?.contextInfo ||
            {};

        const quoted = context.quotedMessage;

        let mediaMessage = null;
        let mediaType = "file";

        if (quoted) {

            if (quoted.imageMessage) {
                mediaMessage = { message: { imageMessage: quoted.imageMessage } };
                mediaType = "image";
            } else if (quoted.videoMessage) {
                mediaMessage = { message: { videoMessage: quoted.videoMessage } };
                mediaType = "video";
            } else if (quoted.audioMessage) {
                mediaMessage = { message: { audioMessage: quoted.audioMessage } };
                mediaType = "audio";
            } else if (quoted.documentMessage) {
                mediaMessage = { message: { documentMessage: quoted.documentMessage } };
                mediaType = "document";
            }
        }

        // Also accept media sent directly with the command
        if (!mediaMessage && message?.message) {
            const m = message.message;
            if (m.imageMessage) {
                mediaMessage = { message: { imageMessage: m.imageMessage } };
                mediaType = "image";
            } else if (m.videoMessage) {
                mediaMessage = { message: { videoMessage: m.videoMessage } };
                mediaType = "video";
            } else if (m.audioMessage) {
                mediaMessage = { message: { audioMessage: m.audioMessage } };
                mediaType = "audio";
            } else if (m.documentMessage) {
                mediaMessage = { message: { documentMessage: m.documentMessage } };
                mediaType = "document";
            }
        }

        // ================================================
        // NO MEDIA
        // ================================================

        if (!mediaMessage) {
            return reply(
`╭━━〔 🔗 VENOM X URL UPLOADER 〕━━⬣
┃
┃ Usage:
┃ Reply to an image / video / audio
┃ / document with #url
┃
┃ Aliases:
┃ #upload | #tourl | #catbox
┃
┃ Returns a public link.
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        // ================================================
        // REACTION: PROCESSING
        // ================================================

        try {
            await sock.sendMessage(from, {
                react: {
                    text: "⏳",
                    key: message.key
                }
            });
        } catch {}

        try {

            // ============================================
            // DOWNLOAD MEDIA BUFFER
            // ============================================

            const buffer = await downloadMediaMessage(
                mediaMessage,
                "buffer",
                {},
                {
                    logger: console,
                    reuploadRequest: sock.updateMediaMessage
                }
            );

            if (!buffer || !buffer.length) {
                throw new Error("Failed to download media.");
            }

            // ============================================
            // PICK FILENAME + MIME
            // ============================================

            const extMap = {
                image: "jpg",
                video: "mp4",
                audio: "mp3",
                document: "bin",
                file: "bin"
            };

            const mimeMap = {
                image: "image/jpeg",
                video: "video/mp4",
                audio: "audio/mpeg",
                document: "application/octet-stream",
                file: "application/octet-stream"
            };

            const ext = extMap[mediaType] || "bin";
            const mime = mimeMap[mediaType] || "application/octet-stream";
            const filename = `venom_${Date.now()}.${ext}`;

            // ============================================
            // UPLOAD TO CATBOX
            // ============================================

            const form = new FormData();
            form.append("reqtype", "fileupload");
            form.append("fileToUpload", buffer, {
                filename,
                contentType: mime
            });

            const response = await axios.post(
                "https://catbox.moe/user/api.php",
                form,
                {
                    headers: {
                        ...form.getHeaders()
                    },
                    maxBodyLength: Infinity,
                    timeout: 90000
                }
            );

            const url = (response.data || "").trim();

            if (!url || !url.startsWith("http")) {
                console.log("URL UPLOAD RESPONSE:", response.data);
                throw new Error("Upload failed — no URL returned.");
            }

            // ============================================
            // SEND RESULT
            // ============================================

            await sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 ✅ VENOM X URL UPLOADER 〕━━⬣
┃
┃ 🔗 Link:
┃ ${url}
┃
┃ 📦 Type: ${mediaType}
┃ ⚡ Powered by : VENOM X
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );

            try {
                await sock.sendMessage(from, {
                    react: {
                        text: "✅",
                        key: message.key
                    }
                });
            } catch {}

        } catch (error) {

            console.error(
                "URL UPLOAD ERROR:",
                error.message
            );

            try {
                await sock.sendMessage(from, {
                    react: {
                        text: "❌",
                        key: message.key
                    }
                });
            } catch {}

            return reply(
`╭━━〔 ❌ VENOM X URL UPLOADER 〕━━⬣
┃
┃ ❌ Upload failed.
┃
┃ Reason:
┃ ${error.message || "Unknown error"}
╰━━━━━━━━━━━━━━━━⬣`
            );
        }
    }
};
