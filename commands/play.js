"use strict";

const axios = require("axios");
const { getSettings } = require("../lib/settingsCache");

const searchCache = new Map();
const CACHE_MS = 5 * 60 * 1000;
const MAX_RESULTS = 8;

function px() {
    try {
        return getSettings().prefix || "#";
    } catch {
        return "#";
    }
}

function cleanCache() {
    const now = Date.now();

    for (const [key, value] of searchCache.entries()) {
        if (!value || now - value.at > CACHE_MS) {
            searchCache.delete(key);
        }
    }
}

function formatDuration(ms) {
    const seconds = Math.floor((Number(ms) || 0) / 1000);
    if (!seconds) return "Unknown";

    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

async function searchSongs(query) {
    const response = await axios.get(
        "https://itunes.apple.com/search",
        {
            params: {
                term: query,
                entity: "song",
                media: "music",
                country: "ng",
                limit: MAX_RESULTS
            },
            timeout: 20000,
            headers: {
                "User-Agent": "VENOM-X/1.0",
                Accept: "application/json"
            }
        }
    );

    const results = response.data?.results;

    if (!Array.isArray(results)) {
        throw new Error("Apple search returned an invalid response.");
    }

    return results.filter(song =>
        song.trackName &&
        song.artistName &&
        song.trackViewUrl
    );
}

function formatResults(results, query, prefix) {
    let text =
        `╭━━〔 🎵 VENOM X MUSIC 〕━━⬣\n` +
        `┃ 🔎 Search: ${query}\n` +
        `┃ 🎧 Results: ${results.length}\n` +
        `╰━━━━━━━━━━━━━━━━⬣\n\n`;

    results.forEach((song, index) => {
        text +=
            `*${index + 1}.* ${song.trackName}\n` +
            `   🎤 ${song.artistName}\n` +
            `   💿 ${song.collectionName || "Unknown album"}\n` +
            `   ⏱️ ${formatDuration(song.trackTimeMillis)}\n\n`;
    });

    text +=
        `Reply using:\n` +
        `*${prefix}play 1*\n\n` +
        `The selected result will include its official listening link.`;

    return text;
}

function formatSong(song) {
    return (
        `╭━━〔 🎵 VENOM X MUSIC 〕━━⬣\n` +
        `┃ 🎶 *${song.trackName}*\n` +
        `┃ 🎤 ${song.artistName}\n` +
        `┃ 💿 ${song.collectionName || "Unknown album"}\n` +
        `┃ ⏱️ ${formatDuration(song.trackTimeMillis)}\n` +
        `╰━━━━━━━━━━━━━━━━⬣\n\n` +
        `🔗 Listen officially:\n${song.trackViewUrl}\n\n` +
        `⚡ VENOM X`
    );
}

module.exports = {
    name: "play",
    aliases: ["song", "music", "apple"],

    run: async function ({
        sock,
        from,
        sender,
        args,
        message,
        reply
    }) {
        cleanCache();

        const prefix = px();
        const user = sender || from;

        if (!args || !args.length) {
            return reply(
`╭━━〔 🎵 VENOM X PLAY 〕━━⬣

Usage:
${prefix}play song name
${prefix}play song name 2
${prefix}play 1

Searches songs and returns official listening links.

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        // Select a previous search result.
        if (args.length === 1 && /^\d+$/.test(args[0])) {
            const cached = searchCache.get(user);
            const number = Number(args[0]);

            if (!cached || !cached.results.length) {
                return reply(
                    `❌ No recent search.\nUse ${prefix}play <song name>.`
                );
            }

            if (number < 1 || number > cached.results.length) {
                return reply(
                    `❌ Choose a number from 1 to ${cached.results.length}.`
                );
            }

            return reply(formatSong(cached.results[number - 1]));
        }

        // Support: #play song name 2
        let query = args.join(" ");
        let selected = null;

        const last = args[args.length - 1];

        if (/^\d+$/.test(last) && args.length > 1) {
            selected = Number(last);
            query = args.slice(0, -1).join(" ");
        }

        if (!query.trim()) {
            return reply("❌ Enter a song name.");
        }

        if (query.length > 150) {
            return reply("❌ Search query is too long.");
        }

        await reply(`🔎 Searching Apple Music for *${query}*...`);

        try {
            const results = await searchSongs(query);

            if (!results.length) {
                return reply("❌ No songs found. Try another search.");
            }

            searchCache.set(user, {
                query,
                results,
                at: Date.now()
            });

            if (selected !== null) {
                if (selected < 1 || selected > results.length) {
                    return reply(
                        `❌ Choose a number from 1 to ${results.length}.`
                    );
                }

                return reply(formatSong(results[selected - 1]));
            }

            return reply(formatResults(results, query, prefix));

        } catch (error) {
            console.error("[VENOM PLAY SEARCH]", error.message);

            return reply(
                "❌ Music search failed.\n" +
                String(error.message || error).slice(0, 200)
            );
        }
    }
};
