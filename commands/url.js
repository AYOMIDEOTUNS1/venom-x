const axios = require("axios");
const FormData = require("form-data");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");

// ================================================
// UPLOAD HELPERS (with fallbacks)
// ================================================
async function uploadToUguu(buffer, filename, mime) {
    const form = new FormData();
    form.append("files[]", buffer, { filename, contentType: mime });
    const res = await axios.post("https://uguu.se/upload.php", form, {
        headers: { ...form.getHeaders() },
        maxBodyLength: Infinity,
        timeout: 90000
    });
    const url = res.data?.files?.[0]?.url;
    if (!url?.startsWith("http")) throw new Error("uguu.se failed");
    return url;
}

async function uploadTo0x0(buffer, filename, mime) {
    const form = new FormData();
    form.append("file", buffer, { filename, contentType: mime });
    const res = await axios.post("https://0x0.st", form, {
        headers: { ...form.getHeaders() },
        maxBodyLength: Infinity,
        timeout: 90000
    });
    const url = (res.data || "").trim();
    if (!url.startsWith("http")) throw new Error("0x0.st failed");
    return url;
}

async function uploadToCatbox(buffer, filename, mime) {
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("fileToUpload", buffer, { filename, contentType: mime });
    const res = await axios.post("https://catbox.moe/user/api.php", form, {
        headers: { ...form.getHeaders() },
        maxBodyLength: Infinity,
        timeout: 90000
    });
    const url = (res.data || "").trim();
    if (!url.startsWith("http")) throw new Error("catbox failed");
    return url;
}

// Try hosts in order until one works
async function uploadAnywhere(buffer, filename, mime) {
    const hosts = [
        { name: "uguu.se", fn: uploadToUguu },
        { name: "0x0.st", fn: uploadTo0x0 },
        { name: "catbox", fn: uploadToCatbox }
    ];

    let lastErr;
    for (const host of hosts) {
        try {
            const url = await host.fn(buffer, filename, mime);
            console.log(`UPLOAD OK via ${host.name}: ${url}`);
            return { url, host: host.name };
        } catch (e) {
            console.log(`UPLOAD FAILED via ${host.name}: ${e.message}`);
            lastErr = e;
        }
    }
    throw lastErr || new Error("All upload hosts failed");
}

module.exports = {
    name: "url",
    aliases: ["upload", "tourl"],

    run: async ({ sock, from, args, reply, message }) => {

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
            if (quoted.imageMessage) { mediaMessage = { message: { imageMessage: quoted.imageMessage } }; mediaType = "image"; }
            else if (quoted.videoMessage) { mediaMessage = { message: { videoMessage: quoted.videoMessage } }; mediaType = "video"; }
            else if (quoted.audioMessage) { mediaMessage = { message: { audioMessage: quoted.audioMessage } }; mediaType = "audio"; }
            else if (quoted.documentMessage) { mediaMessage = { message: { documentMessage: quoted.documentMessage } }; mediaType = "document"; }
        }

        if (!mediaMessage && message?.message) {
            const m = message.message;
            if (m.imageMessage) { mediaMessage = { message: { imageMessage: m.imageMessage } }; mediaType = "image"; }
            else if (m.videoMessage) { mediaMessage = { message: { videoMessage: m.videoMessage } }; mediaType = "video"; }
            else if (m.audioMessage) { mediaMessage = { message: { audioMessage: m.audioMessage } }; mediaType = "audio"; }
            else if (m.documentMessage) { mediaMessage = { message: { documentMessage: m.documentMessage } }; mediaType = "document"; }
        }

        if (!mediaMessage) {
            return reply(
`╭━━〔 🔗 VENOM X URL UPLOADER 〕━━⬣
┃
┃ Reply to an image / video / audio
┃ / document with #url
┃
┃ Returns a public link.
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        try {
            await sock.sendMessage(from, { react: { text: "⏳", key: message.key } });
        } catch {}

        try {
            const buffer = await downloadMediaMessage(mediaMessage, "buffer", {}, {
                logger: console,
                reuploadRequest: sock.updateMediaMessage
            });

            if (!buffer?.length) throw new Error("Failed to download media.");

            const extMap = { image: "jpg", video: "mp4", audio: "mp3", document: "bin", file: "bin" };
            const mimeMap = { image: "image/jpeg", video: "video/mp4", audio: "audio/mpeg", document: "application/octet-stream", file: "application/octet-stream" };

            const { url, host } = await uploadAnywhere(
                buffer,
                `venom_${Date.now()}.${extMap[mediaType] || "bin"}`,
                mimeMap[mediaType] || "application/octet-stream"
            );

            await sock.sendMessage(from, {
                text:
`╭━━〔 ✅ VENOM X URL UPLOADER 〕━━⬣
┃
┃ 🔗 Link:
┃ ${url}
┃
┃ 🖥 Host : ${host}
┃ 📦 Type : ${mediaType}
┃ ⚡ Powered by : VENOM X
╰━━━━━━━━━━━━━━━━⬣`
            }, { quoted: message });

            try {
                await sock.sendMessage(from, { react: { text: "✅", key: message.key } });
            } catch {}

        } catch (error) {
            console.error("URL UPLOAD ERROR:", error.message);
            try {
                await sock.sendMessage(from, { react: { text: "❌", key: message.key } });
            } catch {}
            return reply(`❌ Upload failed:\n${error.message}`);
        }
    }
};
