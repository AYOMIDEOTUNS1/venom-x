const axios = require("axios");
const { getSettings } = require("../lib/settingsCache");

const PIPED = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.in.projectsegfau.lt",
    "https://api.piped.private.coffee",
    "https://pipedapi.adminforge.de"
];

function px() {
    try {
        return getSettings().prefix || "#";
    } catch (e) {
        return "#";
    }
}

function formatDur(sec) {
    sec = Math.floor(Number(sec) || 0);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ":" + String(s).padStart(2, "0");
}

async function pipedGet(pathname) {
    let last = null;
    for (let i = 0; i < PIPED.length; i++) {
        try {
            const res = await axios.get(PIPED[i] + pathname, {
                timeout: 25000,
                headers: { "User-Agent": "VENOM-X" }
            });
            if (res.data) return res.data;
        } catch (e) {
            last = e;
        }
    }
    throw last || new Error("Piped APIs failed");
}

async function itunesSearch(query) {
    const res = await axios.get("https://itunes.apple.com/search", {
        params: { term: query, media: "music", entity: "song", limit: 5 },
        timeout: 15000
    });
    const results = (res.data && res.data.results) || [];
    return results.map(function (t) {
        return {
            title: t.trackName || "Unknown",
            artist: t.artistName || "Unknown",
            album: t.collectionName || "",
            cover: (t.artworkUrl100 || "").replace("100x100", "600x600"),
            duration: Math.floor((t.trackTimeMillis || 0) / 1000),
            query: (t.trackName || "") + " " + (t.artistName || "")
        };
    });
}

async function pipedSearch(query) {
    const data = await pipedGet(
        "/search?q=" + encodeURIComponent(query) + "&filter=videos"
    );
    const items = data.items || data || [];
    const list = Array.isArray(items) ? items : [];
    const v = list.find(function (x) {
        return x && (x.url || x.id);
    });
    if (!v) throw new Error("No playable result found.");
    let id = v.id;
    if (!id && v.url) {
        const m = String(v.url).match(/([a-zA-Z0-9_-]{11})/);
        id = m ? m[1] : String(v.url).replace("/watch?v=", "");
    }
    return id;
}

async function getAudio(videoId) {
    const data = await pipedGet("/streams/" + encodeURIComponent(videoId));
    const streams = data.audioStreams || [];
    if (!streams.length) throw new Error("No audio stream.");
    streams.sort(function (a, b) {
        return (b.bitrate || 0) - (a.bitrate || 0);
    });
    const best =
        streams.find(function (s) {
            return /m4a|mp4/i.test(String(s.mimeType || ""));
        }) || streams[0];
    if (!best || !best.url) throw new Error("No audio URL.");
    return {
        url: best.url,
        mime: best.mimeType || "audio/mp4",
        title: data.title || "audio"
    };
}

module.exports = {
    name: "play",
    aliases: ["song", "music", "apple", "applemusic"],

    run: async function ({ sock, from, args, reply, message }) {
        const p = px();
        const text = args.join(" ").trim();

        if (!text) {
            return reply(
`╭━━〔 🎵 VENOM X PLAY 〕━━⬣

Usage:
${p}play <song name>
${p}play Alone 2

Uses music search + high-quality audio.

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        const parts = text.split(/\s+/);
        const last = parts[parts.length - 1];
        const pick = /^\d+$/.test(last) ? parseInt(last, 10) : 1;
        const query = /^\d+$/.test(last) ? parts.slice(0, -1).join(" ") : text;

        if (!query) {
            return reply("❌ Song name required.");
        }

        try {
            await reply("🔍 Searching: *" + query + "*");

            let meta = null;
            try {
                const tracks = await itunesSearch(query);
                if (tracks.length) {
                    meta = tracks[Math.min(Math.max(pick, 1), tracks.length) - 1];
                }
            } catch (e) {}

            const searchQ = meta ? meta.query : query;
            const videoId = await pipedSearch(searchQ);
            const audio = await getAudio(videoId);

            const title = (meta && meta.title) || audio.title || query;
            const artist = (meta && meta.artist) || "Unknown";
            const cover = meta && meta.cover;
            const dur = meta ? formatDur(meta.duration) : "";

            const caption =
                "╭━━〔 🎵 VENOM X PLAY 〕━━⬣\n" +
                "┃ 🎧 " + title + "\n" +
                "┃ 👤 " + artist + "\n" +
                (dur ? "┃ ⏱️ " + dur + "\n" : "") +
                "┃ ⬇️ Sending audio...\n" +
                "╰━━━━━━━━━━━━━━━━⬣";

            if (cover) {
                try {
                    const img = await axios.get(cover, {
                        responseType: "arraybuffer",
                        timeout: 15000
                    });
                    await sock.sendMessage(
                        from,
                        { image: Buffer.from(img.data), caption: caption },
                        { quoted: message }
                    );
                } catch (e) {
                    await reply(caption);
                }
            } else {
                await reply(caption);
            }

            const bin = await axios.get(audio.url, {
                responseType: "arraybuffer",
                timeout: 120000,
                maxContentLength: 50 * 1024 * 1024,
                headers: { "User-Agent": "VENOM-X" }
            });
            const buffer = Buffer.from(bin.data);
            if (buffer.length < 1000) throw new Error("Empty audio.");

            await sock.sendMessage(
                from,
                {
                    audio: buffer,
                    mimetype: /mp4|m4a/i.test(audio.mime)
                        ? "audio/mp4"
                        : "audio/mpeg",
                    fileName: String(title).slice(0, 50) + ".m4a",
                    ptt: false
                },
                { quoted: message }
            );
        } catch (err) {
            console.log("PLAY ERROR:", err.message);
            return reply(
`╭━━〔 ❌ VENOM X PLAY 〕━━⬣

Failed: ${String(err.message || "").slice(0, 300)}

Try another song name.

╰━━━━━━━━━━━━━━━━⬣`
            );
        }
    }
};
