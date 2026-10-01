/**
 * VENOM X - OmegaTech Secret AI
 * #secret <message>
 * #secret (reply to text)
 */

const axios = require("axios");

function getQuotedText(message) {
    const ctx =
        message.message &&
        message.message.extendedTextMessage &&
        message.message.extendedTextMessage.contextInfo
            ? message.message.extendedTextMessage.contextInfo
            : null;

    if (!ctx || !ctx.quotedMessage) return "";

    let q = ctx.quotedMessage;
    for (let i = 0; i < 5; i++) {
        const wrap =
            (q.ephemeralMessage && q.ephemeralMessage.message) ||
            (q.viewOnceMessage && q.viewOnceMessage.message) ||
            (q.viewOnceMessageV2 && q.viewOnceMessageV2.message) ||
            null;
        if (!wrap) break;
        q = wrap;
    }

    return (
        q.conversation ||
        (q.extendedTextMessage && q.extendedTextMessage.text) ||
        (q.imageMessage && q.imageMessage.caption) ||
        (q.videoMessage && q.videoMessage.caption) ||
        ""
    );
}

module.exports = {
    name: "secret",
    aliases: ["secretai", "omegai", "fable"],

    run: async function ({ args, reply, message }) {
        let text = (args || []).join(" ").trim();
        if (!text) text = String(getQuotedText(message) || "").trim();

        if (!text) {
            return reply(
"╭━━〔 🧠 VENOM SECRET AI 〕━━⬣\n" +
"┃\n" +
"┃ Usage:\n" +
"┃ #secret <message>\n" +
"┃\n" +
"┃ Or reply to a message:\n" +
"┃ #secret\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        try {
            await reply("🧠 Thinking...");

            const api =
                "https://api.omegatech.app/api/ai/Secret?action=chat&message=" +
                encodeURIComponent(text);

            const { data } = await axios.get(api, {
                timeout: 60000,
                headers: { "User-Agent": "VENOM-X" }
            });

            if (!data || data.success === false) {
                throw new Error(
                    (data && (data.error || data.message)) || "API failed"
                );
            }

            const replyText =
                (data.data && data.data.reply) ||
                data.reply ||
                data.message ||
                null;

            const model =
                (data.data && data.data.model) ||
                data.model ||
                "secret-ai";

            if (!replyText) throw new Error("Empty AI reply");

            return reply(
"╭━━〔 🧠 VENOM SECRET 〕━━⬣\n" +
"┃ 🤖 " + model + "\n" +
"┃\n" +
"┃ " + String(replyText).split("\n").join("\n┃ ") + "\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        } catch (e) {
            console.log("SECRET AI ERROR:", e.message || e);
            return reply(
"╭━━〔 ❌ SECRET AI 〕━━⬣\n" +
"┃\n" +
"┃ " + String(e.message || e).slice(0, 200) + "\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }
    }
};
