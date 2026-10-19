"use strict";

/**
 * VENOM X — Apple Music Search & Download (Omegatech)
 * #play Alone
 * #play Alone 2
 * #apple <query>
 */

const axios = require("axios");
const { getSettings } = require("../lib/settingsCache");

const searchCache = new Map(); // sender -> { results, query, timestamp }
const activeDownloads = new Set();
const CACHE_MS = 5 * 60 * 1000;

function px() {
    try {
        return getSettings().prefix || "#";
    } catch (e) {
        return "#";
    }
}

async function searchApple(query) {
    const url =
        "https://api.omegatech.app/api/Search/Applemusic?action=search&query=" +
        encodeURIComponent(query);
    const { data } = await axios.get(url, {
        timeout: 30000,
        headers: { "User-Agent": "VENOM-X" }
    });
    if (!data || !data.success || !data.data || !data.data.results) {
        return [];
    }
    return data.data.results;
}

async function downloadApple(query, songUrl) {
    const url =
        "https://api.omegatech.app/api/Search/Applemusic?action=download&query=" +
        encodeURIComponent(query) +
        "&url=" +
        encodeURIComponent(songUrl);
    const { data } = await axios.get(url, {
        timeout: 90000,
        headers: { "User-Agent": "VENOM-X" }
    });
    if (!data || !data.success) {
        throw new Error("Download API failed");
    }
    const audioUrl =
        data.data?.downloadUrl ||
        data.downloadUrl ||
        data.data?.url ||
        data.url;
    if (!audioUrl) throw new Error("No download URL in response");
    return audioUrl;
}

module.exports = {
    name: "play",
    aliases: ["apple", "song", "music"],

    run: async function ({ sock, from, sender, args, reply, message }) {
        const prefix = px();
        const text = (args || []).join(" ").trim();

        if (!text) {
            return reply(
`╭━━〔 🎵 VENOM X PLAY 〕━━⬣
┃
┃ Apple Music search & download
┃
┃ Search:
┃ ${prefix}play Alone
┃ ${prefix}play Marshmello Alone
┃
┃ Download result #:
┃ ${prefix}play Alone 2
┃
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        const parts = text.split(/\s+/);
        const last = parts[parts.length - 1];
        const isNum = /^\d+$/.test(last);

        // ── DOWNLOAD by number ────────────────────────────
        if (isNum && parts.length >= 2) {
            const query = parts.slice(0, -1).join(" ");
            const num = parseInt(last, 10);
            return handleDownload(sock, from, sender, message, reply, query, num);
        }

        // ── SEARCH ────────────────────────────────────────
        await reply("🔍 Searching Apple Music for: *" + text + "*...");

        try {
            const results = await searchApple(text);
            if (!results.length) {
                return reply("❌ No results for *" + text + "* on Apple Music.");
            }

            searchCache.set(sender, {
                results: results,
                query: text,
                timestamp: Date.now()
            });

            const show = results.slice(0, 5);
            let body =
                "╭━━〔 🎵 APPLE MUSIC 〕━━⬣\n┃\n" +
                "┃ 🔎 *" +
                text +
                "*\n" +
                "┃ 📦 " +
                results.length +
                " result(s)\n┃\n";

            for (let i = 0; i < show.length; i++) {
                const s = show[i];
                body +=
                    "┃ *" +
                    (i + 1) +
                    ".* " +
                    (s.title || "Unknown") +
                    "\n" +
                    "┃ 🎤 " +
                    (s.artist || "Unknown") +
                    (s.explicit ? " 🔞" : "") +
                    "\n┃\n";
            }

            body +=
                "┃ Download:\n┃ " +
                prefix +
                "play " +
                text +
                " 1\n" +
                "╰━━━━━━━━━━━━━━━━⬣";

            const cover = show[0] && show[0].cover;
            if (cover) {
                try {
                    await sock.sendMessage(
                        from,
                        { image: { url: cover }, caption: body },
                        { quoted: message }
                    );
                    return;
                } catch (e) {}
            }

            return reply(body);
        } catch (err) {
            console.log("PLAY SEARCH ERROR:", err.message);
            return reply(
                "❌ Apple Music search failed:\n" +
                    String(err.message || err).slice(0, 200)
            );
        }
    }
};

async function handleDownload(sock, from, sender, message, reply, query, num) {
    const key = String(sender) + "|" + query + "|" + num;
    if (activeDownloads.has(key)) {
        return reply("⏳ Download already in progress...");
    }
    activeDownloads.add(key);

    try {
        let cache = searchCache.get(sender);
        let results = (cache && cache.results) || [];
        let searchQuery = (cache && cache.query) || query;

        if (
            !cache ||
            !results.length ||
            Date.now() - (cache.timestamp || 0) > CACHE_MS
        ) {
            results = await searchApple(query);
            if (!results.length) {
                return reply("❌ No results for *" + query + "*.");
            }
            searchQuery = query;
            searchCache.set(sender, {
                results: results,
                query: query,
                timestamp: Date.now()
            });
        }

        const song = results[num - 1];
        if (!song) {
            return reply("❌ Song #" + num + " not found. Search again.");
        }

        if (!song.url) {
            return reply("❌ Missing Apple Music URL for that track.");
        }

        await reply(
            "⬇️ Downloading:\n*" +
                (song.title || "Track") +
                "* — " +
                (song.artist || "") +
                "\n⏳ Please wait..."
        );

        const audioUrl = await downloadApple(searchQuery, song.url);

        const title = song.title || "track";
        const artist = song.artist || "";

        // Prefer buffer (more reliable than url on some hosts)
        let audioPayload = { url: audioUrl };
        try {
            const bin = await axios.get(audioUrl, {
                responseType: "arraybuffer",
                timeout: 120000,
                maxContentLength: 40 * 1024 * 1024,
                headers: { "User-Agent": "VENOM-X" }
            });
            const buf = Buffer.from(bin.data);
            if (buf.length > 1000) audioPayload = buf;
        } catch (e) {
            console.log("PLAY buffer fallback to url:", e.message);
        }

        await sock.sendMessage(
            from,
            {
                audio: audioPayload,
                mimetype: "audio/mpeg",
                ptt: false,
                fileName: String(title).slice(0, 60) + ".mp3"
            },
            { quoted: message }
        );

        await reply(
            "✅ *Download complete*\n🎵 " + title + " — " + artist
        );

        searchCache.delete(sender);
    } catch (err) {
        console.log("PLAY DOWNLOAD ERROR:", err.message);
        return reply(
            "❌ Download failed:\n" + String(err.message || err).slice(0, 250)
        );
    } finally {
        activeDownloads.delete(key);
    }
}
