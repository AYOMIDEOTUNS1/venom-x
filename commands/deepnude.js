const axios = require("axios");

module.exports = {
    name: "deepnude",

    aliases: [
        "dn",
        "nude",
        "undress",
        "removecloth",
        "rc"
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
        // GET IMAGE URL
        // ================================================

        let imageUrl = "";

        if (args.length) {
            const maybeUrl = args.join(" ").trim();
            if (/^https?:\/\//i.test(maybeUrl)) {
                imageUrl = maybeUrl;
            }
        }

        if (!imageUrl) {

            const context =
                message?.message?.extendedTextMessage?.contextInfo ||
                message?.message?.imageMessage?.contextInfo ||
                message?.message?.videoMessage?.contextInfo ||
                {};

            const quoted = context.quotedMessage;

            if (quoted) {
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

        // ================================================
        // NO URL
        // ================================================

        if (!imageUrl) {
            return reply(
`╭━━〔 👕 VENOM X DEEP NUDE 〕━━⬣
┃
┃ Usage:
┃ #deepnude <image url>
┃
┃ Or:
┃ Reply to a message containing
┃ an image URL with #deepnude
┃
┃ Aliases:
┃ #dn | #nude | #undress | #rc
┃
┃ ⚠️ Only public image URLs work.
┃ Use #url to upload first.
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
            // CALL API
            // ============================================

            const apiUrl =
                "https://api.omegatech.app/api/tools/remove-cloth";

            const response = await axios.get(apiUrl, {
                params: { imageUrl },
                timeout: 90000
            });

            const data = response?.data;

            if (!data || data.success === false) {
                console.log(
                    "DEEPNUDE API RESPONSE:",
                    JSON.stringify(data)
                );

                return reply(
`╭━━〔 ❌ VENOM X DEEP NUDE 〕━━⬣
┃
┃ ❌ API rejected the request.
┃
┃ Reason:
┃ ${data?.error || "Unknown error"}
╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            // ============================================
            // EXTRACT RESULT
            // ============================================

            const resultUrl =
                data?.result ||
                data?.image ||
                data?.url ||
                data?.imageUrl ||
                data?.data?.url ||
                data?.data?.image ||
                data?.data;

            if (!resultUrl || typeof resultUrl !== "string") {

                console.log(
                    "DEEPNUDE UNKNOWN FORMAT:",
                    JSON.stringify(data)
                );

                return reply(
                    "❌ API returned an unknown response format."
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
                "DEEPNUDE ERROR:",
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
