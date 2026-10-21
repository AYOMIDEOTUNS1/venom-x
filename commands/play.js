"use strict";

const axios = require("axios");
const { getSettings } = require("../lib/settingsCache");

const searchCache = new Map(); // sender -> { query, results, at }
const CACHE_MS = 5 * 60 * 1000;

function px() {
    try {
        return getSettings().prefix || "#";
    } catch (e) {
        return "#";
    }
}

function cleanCache() {
    const now = Date.now();
    for (const [k, v] of searchCache.entries()) {
        if (!v || now - v.at > CACHE_MS) searchCache.delete(k);
    }
}

async function searchApple(query) {
    const url =
        "https://api.omegatech.app/api/Search/Applemusic?action=search&query=" +
        encodeURIComponent(query);
    const { data } = await axios.get(url, { timeout: 30000 });
    if (!data || !data.success || !data.data || !data.data.results) {
        throw new Error("No results.");
    }
    return data.data.results.slice(0, 8);
}

async function downloadApple(song) {
    // Try common download endpoints
    const tries = [
        "https://api.omegatech.app/api/Search/Applemusic?action=download&url=" +
            encodeURIComponent(song.url || ""),
        "https://api.omegatech.app/api/Search/Applemusic?action=download&query=" +
            encodeURIComponent(
                (song.title || "") + " " + (song.artist || "")
            )
    ];

    let last = null;
    for (let i = 0; i < tries.length; i++) {
        try {
            const { data } = await axios.get(tries[i], { timeout: 60000 });
            const audioUrl =
                data?.data?.downloadUrl ||
                data?.downloadUrl ||
                data?.data?.url ||
                data?.url;
            if (audioUrl) {
                return {
                    url: audioUrl,
                    title: data?.data?.title || song.title,
                    artist: data?.data?.artist || song.artist
                };
            }
            last = new Error("No download URL");
        } catch (e) {
            last = e;
        }
    }
    throw last || new Error("Download failed");
}

function formatList(results, query, prefix) {
    let text =
        "🎵 *Apple Music*\n" +
        "Query: *" +
        query +
        "*\n\n" +
        "Reply with a number:\n";
    for (let i = 0; i < results.length; i++) {
        const s = results[i];
        text +=
            "*" +
            (i + 1) +
            ".* " +
            (s.title || "Unknown") +
            " — " +
            (s.artist || "?") +
            "\n";
    }
    text +=
        "\nExample:\n*" +
        prefix +
        "play " +
        query +
        " 1*\n" +
        "or just send: *1*";
    return text;
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
        const prefix = px();
        cleanCache();

        if (!args || !args.length) {
            return reply(
`╭━━〔 🎵 VENOM PLAY 〕━━⬣

Usage:
${prefix}play Alone
${prefix}play Alone 2

Search → pick a number (works on iPhone).

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        // If only a number → use last search for this user
        if (args.length === 1 && /^\d+$/.test(args[0])) {
            const cached = searchCache.get(sender);
            if (!cached || !cached.results || !cached.results.length) {
                return reply("❌ No recent search. Use: " + prefix + "play <song>");
            }
            const num = parseInt(args[0], 10);
            if (num < 1 || num > cached.results.length) {
                return reply("❌ Pick 1–" + cached.results.length);
            }
            return downloadAndSend(
                sock,
                from,
                message,
                reply,
                cached.results[num - 1]
            );
        }

        // play <query> <number>
        const last = args[args.length - 1];
        let query = args.join(" ");
        let pick = null;
        if (/^\d+$/.test(last) && args.length > 1) {
            pick = parseInt(last, 10);
            query = args.slice(0, -1).join(" ");
        }

        await reply("🔍 Searching: *" + query + "*...");

        try {
            const results = await searchApple(query);
            if (!results.length) return reply("❌ No songs found.");

            searchCache.set(sender, {
                query: query,
                results: results,
                at: Date.now()
            });

            if (pick !== null) {
                if (pick < 1 || pick > results.length) {
                    return reply("❌ Pick 1–" + results.length);
                }
                return downloadAndSend(
                    sock,
                    from,
                    message,
                    reply,
                    results[pick - 1]
                );
            }

            // iPhone-safe: numbered list (+ cover if available)
            const text = formatList(results, query, prefix);
            const cover = results[0] && results[0].cover;

            if (cover) {
                try {
                    const img = await axios.get(cover, {
                        responseType: "arraybuffer",
                        timeout: 15000
                    });
                    await sock.sendMessage(
                        from,
                        {
                            image: Buffer.from(img.data),
                            caption: text
                        },
                        { quoted: message }
                    );
                    return;
                } catch (e) {}
            }

            return reply(text);
        } catch (err) {
            console.log("PLAY ERROR:", err.message);
            return reply(
                "❌ Play failed:\n" + String(err.message || err).slice(0, 250)
            );
        }
    }
};

async function downloadAndSend(sock, from, message, reply, song) {
    try {
        await reply(
            "⏳ Downloading:\n*" +
                (song.title || "Song") +
                "* — " +
                (song.artist || "")
        );

        const dl = await downloadApple(song);
        const bin = await axios.get(dl.url, {
            responseType: "arraybuffer",
            timeout: 120000,
            maxContentLength: 30 * 1024 * 1024
        });
        const buffer = Buffer.from(bin.data);
        if (buffer.length < 1000) throw new Error("Empty audio");

        await sock.sendMessage(
            from,
            {
                audio: buffer,
                mimetype: "audio/mpeg",
                fileName: String(dl.title || "song").slice(0, 40) + ".mp3",
                ptt: false
            },
            { quoted: message }
        );

        await reply(
            "✅ *" +
                (dl.title || song.title) +
                "*\n🎤 " +
                (dl.artist || song.artist || "")
        );
    } catch (err) {
        console.log("PLAY DL:", err.message);
        return reply(
            "❌ Download failed:\n" + String(err.message || err).slice(0, 250)
        );
    }
}
