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
    name: "telesticker",
    aliases: ["tsticker", "tgsticker", "sticksearch"],

    run: async function ({ sock, from, args, reply, message }) {
        const keyword = (args || []).join(" ").trim();
        const p = px();

        if (!keyword) {
            return reply(
                "╭━━〔 🎭 TELE STICKER 〕━━⬣\n" +
                    "┃\n" +
                    "┃ Search Telegram sticker packs\n" +
                    "┃\n" +
                    "┃ Usage:\n" +
                    "┃ " +
                    p +
                    "telesticker <keyword>\n" +
                    "┃ " +
                    p +
                    "tsticker Omega\n" +
                    "┃\n" +
                    "╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        await reply("🔍 Searching stickers for *" + keyword + "*...");

        try {
            const url =
                "https://api.omegatech.app/api/Search/Tele-sticker?action=search&keyword=" +
                encodeURIComponent(keyword);

            const { data } = await axios.get(url, {
                timeout: 30000,
                headers: { "User-Agent": "VENOM-X" }
            });

            const packs = data?.data?.packs || data?.packs || [];
            if (!packs.length) {
                return reply("❌ No sticker packs found for *" + keyword + "*.");
            }

            const total = data?.data?.total || packs.length;
            const show = packs.slice(0, 8);

            let text =
                "╭━━〔 🎭 TELE STICKER 〕━━⬣\n" +
                "┃\n" +
                "┃ 🔎 *" +
                keyword +
                "*\n" +
                "┃ 📦 Found: *" +
                total +
                "*\n" +
                "┃\n";

            for (let i = 0; i < show.length; i++) {
                const pack = show[i];
                text +=
                    "┃ *" +
                    (i + 1) +
                    ".* " +
                    (pack.title || "Untitled") +
                    "\n" +
                    "┃ 👤 " +
                    (pack.author || "Unknown") +
                    "\n" +
                    "┃ 🔗 " +
                    (pack.telegramUrl || "-") +
                    "\n" +
                    "┃\n";
            }

            text += "╰━━━━━━━━━━━━━━━━⬣";

            // send cover of first pack if available
            const cover = show[0]?.cover?.url;
            if (cover) {
                try {
                    await sock.sendMessage(
                        from,
                        {
                            image: { url: cover },
                            caption: text
                        },
                        { quoted: message }
                    );
                    return;
                } catch (e) {}
            }

            await sock.sendMessage(from, { text: text }, { quoted: message });
        } catch (err) {
            console.log("TELESTICKER ERROR:", err.message);
            return reply(
                "❌ Sticker search failed:\n" +
                    String(err.response?.data?.message || err.message).slice(0, 200)
            );
        }
    }
};
