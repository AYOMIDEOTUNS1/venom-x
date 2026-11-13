"use strict";

/**
 * VENOM X — Unlimited AI (Omegatech)
 * #uai <text>
 */

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
    name: "uai",
    aliases: ["unlimited", "freeai", "unlimitedai"],

    run: async function ({ args, reply }) {
        const text = (args || []).join(" ").trim();
        if (!text) {
            return reply(
`╭━━〔 🤖 VENOM UNLIMITED AI 〕━━⬣

Usage:
${px()}uai <message>

Example:
${px()}uai Write a short poem about rain

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        try {
            await reply("⏳ Thinking…");

            const { data } = await axios.get(
                "https://api.omegatech.app/api/ai/Unlimitedai",
                {
                    params: { action: "chat", message: text },
                    timeout: 60000,
                    headers: { "User-Agent": "VENOM-X" }
                }
            );

            const answer =
                (data && data.reply) ||
                (data && data.data && data.data.reply) ||
                (data && data.message) ||
                null;

            if (!answer) {
                throw new Error(
                    (data && data.error) || "Empty reply from API"
                );
            }

            return reply(
`╭━━〔 🤖 UNLIMITED AI 〕━━⬣

${String(answer).slice(0, 3500)}

╰━━━━━━━━━━━━━━━━⬣`
            );
        } catch (err) {
            console.log("UAI ERROR:", err.message);
            return reply(
                "❌ Unlimited AI failed:\n" +
                    String(err.message || err).slice(0, 250)
            );
        }
    }
};
