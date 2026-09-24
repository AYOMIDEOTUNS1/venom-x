const axios = require("axios");
const FormData = require("form-data");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");

// ================================================
// UPLOAD HELPERS (multi-host fallback)
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
            console.log(`[DEEPNUDE] Upload OK via ${host.name}: ${url}`);
            return { url, host: host.name };
        } catch (e) {
            console.log(`[DEEPNUDE] Upload FAILED via ${host.name}: ${e.message}`);
            lastErr = e;
        }
    }
    throw lastErr || new Error("All upload hosts failed");
}

module.exports = {
    name: "deepnude",
    aliases: ["dn", "nude", "undress", "removecloth", "rc"],

    run: async ({ sock, from, args, reply, message }) => {

        // ================================================
        // GET SOURCE (URL from args/quoted, or replied image)
        // ================================================
        let imageUrl = "";
        let quotedImage = null;

        if (args.length) {
            const maybeUrl = args.join(" ").trim();
            if (/^https?:\/\//i.test(maybeUrl)) imageUrl = maybeUrl;
        }

        const context =
            message?.message?.extendedTextMessage?.contextInfo ||
            message?.message?.imageMessage?.contextInfo ||
            message?.message?.videoMessage?.contextInfo ||
            {};

        const quoted = context.quotedMessage;

        if (quoted) {
            if (quoted.imageMessage) {
                quotedImage = { message: { imageMessage: quoted.imageMessage } };
            }
            if (!imageUrl && !quotedImage) {
                const quotedText =
                    quoted.conversation ||
                    quoted.extendedTextMessage?.text ||
                    quoted.imageMessage?.caption ||
                    quoted.videoMessage?.caption ||
                    "";
                if (/^https?:\/\//i.test(quotedText.trim())) imageUrl = quotedText.trim();
            }
        }

        if (!imageUrl && !quotedImage && message?.message?.imageMessage) {
            quotedImage = { message: { imageMessage: message.message.imageMessage } };
        }

        if (!imageUrl && !quotedImage) {
            return reply(
`╭━━〔 👕 VENOM X DEEP NUDE 〕━━⬣
┃
┃ Usage:
┃ #deepnude <image url>
┃
┃ Or:
┃ Reply to an image with #deepnude
┃
┃ Aliases:
┃ #dn | #nude | #undress | #rc
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        // ================================================
        // REACTION: PROCESSING
        // ================================================
        try {
            await sock.sendMessage(from, { react: { text: "⏳", key: message.key } });
        } catch {}

        let sourceHost = "direct-url";

        try {
            // ============================================
            // AUTO-UPLOAD if replied image
            // ============================================
            if (!imageUrl && quotedImage) {
                const buffer = await downloadMediaMessage(quotedImage, "buffer", {}, {
                    logger: console,
                    reuploadRequest: sock.updateMediaMessage
                });

                if (!buffer?.length) throw new Error("Failed to download replied image.");

                const uploaded = await uploadAnywhere(
                    buffer,
                    `venom_${Date.now()}.jpg`,
                    "image/jpeg"
                );
                imageUrl = uploaded.url;
                sourceHost = uploaded.host;
            }

            console.log(`[DEEPNUDE] Source: ${imageUrl} (${sourceHost})`);

            // ============================================
            // CALL API
            // ============================================
            const apiUrl = "https://api.omegatech.app/api/tools/remove-cloth";

            let response;
            try {
                response = await axios.get(apiUrl, {
                    params: { imageUrl },
                    timeout: 120000,
                    validateStatus: () => true
                });
            } catch (netErr) {
                throw new Error(`Network error: ${netErr.message}`);
            }

            const status = response.status;
            const data = response.data;

            console.log(`[DEEPNUDE] API status: ${status}`);
            console.log(`[DEEPNUDE] API body:`, JSON.stringify(data).slice(0, 500));

            // ============================================
            // HANDLE NON-200
            // ============================================
            if (status !== 200) {
                const reason =
                    data?.error ||
                    data?.message ||
                    `HTTP ${status}`;

                return reply(
`╭━━〔 ❌ VENOM X DEEP NUDE 〕━━⬣
┃
┃ ❌ API error (HTTP ${status})
┃
┃ Reason:
┃ ${reason}
┃
┃ Source: ${sourceHost}
╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            // ============================================
            // EXTRACT RESULT URL
            // ============================================
            const resultUrl =
                data?.result ||
                data?.image ||
                data?.url ||
                data?.imageUrl ||
                data?.data?.url ||
                data?.data?.image ||
                (typeof data?.data === "string" ? data.data : null);

            if (!resultUrl || typeof resultUrl !== "string" || !resultUrl.startsWith("http")) {
                console.log("[DEEPNUDE] Unknown format:", JSON.stringify(data));
                return reply(
`╭━━〔 ❌ VENOM X DEEP NUDE 〕━━⬣
┃
┃ ❌ API returned unknown format.
┃
┃ Check the console log for details.
╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            // ============================================
            // SEND RESULT
            // ============================================
            await sock.sendMessage(
                from,
                {
                    image: { url: resultUrl },
                    caption:
`╭━━〔 ✅ VENOM X DEEP NUDE 〕━━⬣
┃
┃ 👕 Status : Success
┃ 🖥 Source : ${sourceHost}
┃ ⚡ Powered by : VENOM X
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );

            try {
                await sock.sendMessage(from, { react: { text: "✅", key: message.key } });
            } catch {}

        } catch (error) {
            console.error("[DEEPNUDE] ERROR:", error.message);
            if (error.response?.data) {
                console.error("[DEEPNUDE] Response:", JSON.stringify(error.response.data));
            }

            try {
                await sock.sendMessage(from, { react: { text: "❌", key: message.key } });
            } catch {}

            return reply(
`╭━━〔 ❌ VENOM X DEEP NUDE 〕━━⬣
┃
┃ ❌ Failed to process.
┃
┃ Reason:
┃ ${error.message || "Unknown error"}
╰━━━━━━━━━━━━━━━━⬣`
            );
        }
    }
};
