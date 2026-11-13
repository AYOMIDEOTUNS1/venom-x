"use strict";

/**
 * VENOM X — YouTube search (Omegatech yt-mp3 search)
 * Does NOT download — list only. Use #play to download.
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
    name: "ytsearch",
    aliases: ["yts", "findsong", "ytfind"],

    run: async function ({ args, reply }) {
        const q = (args || []).join(" ").trim();
        if (!q) {
            return reply(
`╭━━〔 🔎 VENOM YT SEARCH 〕━━⬣

Usage:
${px()}ytsearch <query>

Example:
${px()}ytsearch Alone Marshmello

Then use:
${px()}play <same query>

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        try {
            await reply("🔎 Searching YouTube…");

            const { data } = await axios.get(
                "https://api.omegatech.app/api/Search/yt-mp3",
                {
                    params: { query: q, limit: 8 },
                    timeout: 30000,
                    headers: { "User-Agent": "VENOM-X" }
                }
            );

            const list = (data && data.results) || [];
            if (!list.length) throw new Error("No results");

            let text =
`╭━━〔 🔎 YT SEARCH 〕━━⬣
┃ Query: *${q}*
┃
`;

            for (let i = 0; i < list.length; i++) {
                const r = list[i];
                text +=
                    "┃ *" +
                    (i + 1) +
                    ".* " +
                    (r.title || "Untitled") +
                    "\n┃ ⏱ " +
                    (r.duration || "—") +
                    "\n┃ " +
                    (r.shortUrl || r.url || "") +
                    "\n┃\n";
            }

            text +=
                "┃ Use " +
                px() +
                "play " +
                q +
                "\n╰━━━━━━━━━━━━━━━━⬣";

            return reply(text);
        } catch (err) {
            console.log("YTSEARCH ERROR:", err.message);
            return reply(
                "❌ Search failed:\n" + String(err.message || err).slice(0, 250)
            );
        }
    }
};
