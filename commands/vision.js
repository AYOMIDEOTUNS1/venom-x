const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const ai = require("../lib/gemini");
const pino = require("pino");

module.exports = {
    run: async ({ sock, from, message, reply }) => {

        try {

            const context =
                message.message?.extendedTextMessage?.contextInfo;

            if (!context || !context.quotedMessage) {
                return reply(
`╭━━〔 👁️ VENOM AI VISION 〕━━⬣

❌ Reply to an image.

Example:

.vision

╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            const quoted = context.quotedMessage;

            if (!quoted.imageMessage) {
                return reply(
`╭━━〔 👁️ VENOM AI VISION 〕━━⬣

❌ Reply to an image only.

╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            const mime =
                quoted.imageMessage.mimetype || "image/jpeg";

            await reply(
`╭━━〔 👁️ VENOM AI 〕━━⬣

📥 Downloading image...

╰━━━━━━━━━━━━━━━━⬣`
            );

            const media = await downloadMediaMessage(
                {
                    key: {
                        remoteJid: from,
                        id: context.stanzaId,
                        participant: context.participant
                    },
                    message: quoted
                },
                "buffer",
                {},
                {
                    logger: pino({ level: "silent" }),
                    reuploadRequest: sock.updateMediaMessage
                }
            );

            if (!media) {
                return reply(
`╭━━〔 ❌ VENOM AI 〕━━⬣

Unable to download image.

╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            await reply(
`╭━━〔 👁️ VENOM AI 〕━━⬣

🧠 Analyzing image...

╰━━━━━━━━━━━━━━━━⬣`
            );

            const result = await ai.generateVision(
                Buffer.from(media).toString("base64"),
                `You are VENOM X Vision AI.

Analyze this image thoroughly.

Include:
1. Description
2. Objects
3. People
4. Clothing
5. Facial expressions
6. Colors
7. Environment
8. OCR text
9. Interesting observations
10. Summary

Respond neatly.`,
                mime
            );

            if (!result) {
                return reply(
`╭━━〔 ❌ VENOM AI 〕━━⬣

Gemini returned no response.

╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            await sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 👁️ VENOM AI VISION 〕━━⬣

${result}

╰━━━━━━━━━━━━━━━━⬣

🤖 Powered by VENOM X`
                },
                {
                    quoted: message
                }
            );

        } catch (err) {

            console.log("VISION ERROR:", err);

            const msg =
                err?.message || String(err);

            if (
                msg.includes("429") ||
                msg.includes("RESOURCE_EXHAUSTED") ||
                msg.toLowerCase().includes("quota")
            ) {

                return reply(
`╭━━〔 ⚠️ VENOM AI 〕━━⬣

Gemini Vision quota has been exhausted.

Please try again later.

╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            if (
                msg.includes("404") ||
                msg.includes("NOT_FOUND")
            ) {

                return reply(
`╭━━〔 ❌ VENOM AI 〕━━⬣

The selected Gemini Vision model is unavailable.

╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            return reply(
`╭━━〔 ❌ VENOM AI ERROR 〕━━⬣

${msg}

╰━━━━━━━━━━━━━━━━⬣`
            );

        }

    }
};
