"use strict";

const axios = require("axios");
const { getSettings } = require("../lib/settingsCache");

function px() {
    try {
        return getSettings().prefix || "#";
    } catch (e) {
        return "#";
    }
}

module.exports = {
    name: "deepseek",
    aliases: ["ds", "deep", "dsai"],

    run: async function ({ sock, from, args, reply, message }) {
        const text = (args || []).join(" ").trim();
        const p = px();

        if (!text) {
            return reply(
                "╭━━〔 🧠 VENOM DEEPSEEK 〕━━⬣\n" +
                    "┃\n" +
                    "┃ Usage:\n" +
                    "┃ " +
                    p +
                    "deepseek <message>\n" +
                    "┃ " +
                    p +
                    "ds hello\n" +
                    "┃\n" +
                    "┃ Model: deepseek-v4-flash\n" +
                    "┃\n" +
                    "╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        await reply("⏳ Thinking...");

        try {
            const url =
                "https://api.omegatech.app/api/ai/Deepseek2?action=chat&model=v4&message=" +
                encodeURIComponent(text);

            const { data } = await axios.get(url, {
                timeout: 60000,
                headers: { "User-Agent": "VENOM-X" }
            });

            const replyText =
                data?.reply ||
                data?.data?.reply ||
                data?.message ||
                null;

            if (!replyText) {
                return reply("❌ No reply from DeepSeek.");
            }

            const model = data?.model || "deepseek-v4-flash";

            await sock.sendMessage(
                from,
                {
                    text:
                        "╭━━〔 🧠 DEEPSEEK 〕━━⬣\n" +
                        "┃\n" +
                        "┃ 📝 " +
                        text.slice(0, 120) +
                        (text.length > 120 ? "..." : "") +
                        "\n" +
                        "┃\n" +
                        "┃ " +
                        String(replyText).slice(0, 3500) +
                        "\n" +
                        "┃\n" +
                        "┃ 🔹 " +
                        model +
                        "\n" +
                        "╰━━━━━━━━━━━━━━━━⬣"
                },
                { quoted: message }
            );
        } catch (err) {
            console.log("DEEPSEEK ERROR:", err.message);
            return reply(
                "❌ DeepSeek failed:\n" +
                    String(err.response?.data?.message || err.message).slice(0, 200)
            );
        }
    }
};
