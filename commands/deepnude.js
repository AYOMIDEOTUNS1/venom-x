const axios = require("axios");
const FormData = require("form-data");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");

// ================================================
// UPLOAD BUFFER TO CATBOX → RETURN PUBLIC URL
// ================================================
async function uploadToCatbox(buffer, filename = "image.jpg", mime = "image/jpeg") {
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("fileToUpload", buffer, { filename, contentType: mime });

    const res = await axios.post(
        "https://catbox.moe/user/api.php",
        form,
        {
            headers: { ...form.getHeaders() },
            maxBodyLength: Infinity,
            timeout: 90000
        }
    );

    const url = (res.data || "").trim();
    if (!url.startsWith("http")) throw new Error("Catbox upload failed.");
    return url;
}

module.exports = {
    name: "deepnude",

    aliases: ["dn", "nude", "undress", "removecloth", "rc"],

    run: async ({
        sock,
        from,
        args,
        reply,
        message,
        commandName
    }) => {

        // ================================================
        // GET IMAGE SOURCE
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

                if (/^https?:\/\//i.test(quotedText.trim())) {
                    imageUrl = quotedText.trim();
                }
            }
        }

        if (!imageUrl && !quotedImage && message?.message?.imageMessage) {
            quotedImage = {
                message: { imageMessage: message.message.imageMessage }
            };
        }

        // ================================================
        // NO SOURCE
        // ================================================

        if (!imageUrl && !quotedImage) {
            return reply(
`╭━━〔 👕 VENOM X DEEP NUDE 〕━━⬣
┃
┃ Usage:
┃ #deepnude <image url>
┃
┃ Or:
┃ Reply to an image with #deepnude
┃ (auto-uploads via Catbox)
┃
┃ Aliases:
┃ #dn | #nude | #undress | #rc
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        // ================================================
        // REACTION
        // ================================================

        try {
            await sock.sendMessage(from, {
                react: { text: "⏳", key: message.key }
            });
        } catch {}

        try {

            // ============================================
            // AUTO-UPLOAD IF REPLIED TO IMAGE
            // ============================================

            if (!imageUrl && quotedImage) {

                const buffer = await downloadMediaMessage(
                    quotedImage,
                    "buffer",
                    {},
                    {
                        logger: console,
                        reuploadRequest: sock.updateMediaMessage
                    }
                );

                imageUrl = await uploadToCatbox(
                    buffer,
                    `venom_${Date.now()}.jpg`,
                    "image/jpeg"
                );
            }

            // ============================================
            // CALL API
            // ============================================

            const response = await axios.get(
                "https://api.omegatech.app/api/tools/remove-cloth",
                {
                    params: { imageUrl },
                    timeout: 90000
                }
            );

            const data = response?.data;

            if (!data || data.success === false) {
                console.log("DEEPNUDE API:", JSON.stringify(data));
                return reply(
`╭━━〔 ❌ VENOM X DEEP NUDE 〕━━⬣
┃
┃ ❌ API rejected request.
┃
┃ Reason:
┃ ${data?.error || "Unknown error"}
╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            const resultUrl =
                data?.result ||
                data?.image ||
                data?.url ||
                data?.imageUrl ||
                data?.data?.url ||
                data?.data?.image ||
                data?.data;

            if (!resultUrl || typeof resultUrl !== "string") {
                console.log("DEEPNUDE UNKNOWN:", JSON.stringify(data));
                return reply("❌ API returned an unknown format.");
            }

            await sock.sendMessage(
                from,
                {
                    image: { url: resultUrl },
                    caption:
`╭━━〔 ✅ VENOM X DEEP NUDE 〕━━⬣
┃
┃ 👕 Status : Success
┃ ⚡ Powered by : VENOM X
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );

            try {
                await sock.sendMessage(from, {
                    react: { text: "✅", key: message.key }
                });
            } catch {}

        } catch (error) {

            console.error("DEEPNUDE ERROR:", error.message);

            try {
                await sock.sendMessage(from, {
                    react: { text: "❌", key: message.key }
                });
            } catch {}

            return reply(
`╭━━〔 ❌ VENOM X DEEP NUDE 〕━━⬣
┃
┃ ❌ Failed to process image.
┃
┃ Reason:
┃ ${error.message || "Unknown error"}
╰━━━━━━━━━━━━━━━━⬣`
            );
        }
    }
};
