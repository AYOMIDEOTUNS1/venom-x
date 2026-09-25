/**
 * VENOM X PLAY - Render-friendly
 * Search: iTunes + yt-search
 * Audio: multi Piped instances + Cobalt fallback
 */

const axios = require("axios");
const yts = require("yt-search");
const { getSettings } = require("../lib/settingsCache");

const PIPED = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.adminforge.de",
    "https://pipedapi.nosea.serve.pieter.com",
    "https://api.piped.private.coffee",
    "https://pipedapi.leptons.xyz",
    "https://piped-api.garudalinux.org",
    "https://pipedapi.reallyaweso.me"
];

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

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
                timeout: 20000,
                headers: {
                    "User-Agent": UA,
                    Accept: "application/json"
                }
            });
            if (res.data) return res.data;
        } catch (e) {
            last = e;
        }
    }
    throw last || new Error("All Piped instances failed");
}

async function itunesSearch(query) {
    const res = await axios.get("https://itunes.apple.com/search", {
        params: {
            term: query,
            media: "music",
            entity: "song",
            limit: 5
        },
        timeout: 12000,
        headers: { "User-Agent": UA }
    });
    const results = (res.data && res.data.results) || [];
    return results.map(function (t) {
        return {
            title: t.trackName || "Unknown",
            artist: t.artistName || "Unknown",
            cover: String(t.artworkUrl100 || "").replace("100x100bb", "600x600bb"),
            duration: Math.floor((t.trackTimeMillis || 0) / 1000),
            query: (t.trackName || "") + " " + (t.artistName || "")
        };
    });
}

async function ytFindId(query) {
    // 1) yt-search package (usually works on Render)
    try {
        const r = await yts(query + " audio");
        const v =
            (r.videos && r.videos[0]) ||
            (r.all && r.all.find(function (x) { return x.type === "video"; }));
        if (v && v.videoId) {
            return {
                id: v.videoId,
                title: v.title,
                url: v.url,
                seconds: v.seconds || 0,
                thumbnail: v.thumbnail
            };
        }
    } catch (e) {}

    // 2) Piped search fallback
    const data = await pipedGet(
        "/search?q=" + encodeURIComponent(query) + "&filter=videos"
    );
    const items = data.items || data || [];
    const list = Array.isArray(items) ? items : [];
    const v = list.find(function (x) {
        return x && (x.url || x.id);
    });
    if (!v) throw new Error("No YouTube result found");

    let id = v.id;
    if (!id && v.url) {
        const m = String(v.url).match(/([a-zA-Z0-9_-]{11})/);
        id = m ? m[1] : null;
    }
    if (!id) throw new Error("No video id");

    return {
        id: id,
        title: v.title || query,
        url: "https://youtu.be/" + id,
        seconds: v.duration || 0,
        thumbnail: v.thumbnail || null
    };
}

async function getAudioFromPiped(videoId) {
    const data = await pipedGet("/streams/" + encodeURIComponent(videoId));
    const streams = data.audioStreams || [];
    if (!streams.length) throw new Error("No audio streams");

    streams.sort(function (a, b) {
        return (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0);
    });

    const best =
        streams.find(function (s) {
            return /m4a|mp4|audio\/mp4/i.test(String(s.mimeType || s.format || ""));
        }) || streams[0];

    if (!best || !best.url) throw new Error("No audio URL from Piped");

    return {
        url: best.url,
        mime: best.mimeType || "audio/mp4",
        title: data.title || "audio"
    };
}

async function getAudioFromCobalt(youtubeUrl) {
    // Public Cobalt-style fallback (may change; best-effort)
    const endpoints = [
        "https://api.cobalt.tools/api/json",
        "https://cobalt-api.kwiatekmiki.com"
    ];

    let last = null;
    for (let i = 0; i < endpoints.length; i++) {
        try {
            const res = await axios.post(
                endpoints[i],
                {
                    url: youtubeUrl,
                    isAudioOnly: true,
                    aFormat: "mp3",
                    filenamePattern: "basic"
                },
                {
                    timeout: 30000,
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                        "User-Agent": UA
                    }
                }
            );

            const d = res.data || {};
            const url = d.url || d.link || (d.tunnel && d.tunnel) || null;
            if (url) {
                return {
                    url: url,
                    mime: "audio/mpeg",
                    title: d.filename || "audio"
                };
            }
            last = new Error(d.text || d.error || "Cobalt empty");
        } catch (e) {
            last = e;
        }
    }
    throw last || new Error("Cobalt failed");
}

async function downloadBuffer(url) {
    const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 120000,
        maxContentLength: 40 * 1024 * 1024,
        maxBodyLength: 40 * 1024 * 1024,
        headers: {
            "User-Agent": UA,
            Accept: "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            Referer: "https://www.youtube.com/"
        },
        validateStatus: function (s) {
            return s >= 200 && s < 400;
        }
    });
    const buf = Buffer.from(res.data);
    if (!buf || buf.length < 2000) throw new Error("Downloaded audio too small");
    return buf;
}

module.exports = {
    name: "play",
    aliases: ["song", "music", "ytplay"],

    run: async function ({ sock, from, args, reply, message }) {
        const p = px();
        const text = args.join(" ").trim();

        if (!text) {
            return reply(
"╭━━〔 🎵 VENOM X PLAY 〕━━⬣\n\n" +
"Usage:\n" +
p + "play <song name>\n" +
p + "play Alone\n\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        try {
            await reply("🔍 Searching: *" + text + "*");

            let meta = null;
            try {
                const tracks = await itunesSearch(text);
                if (tracks.length) meta = tracks[0];
            } catch (e) {}

            const searchQ = meta ? meta.query : text;
            const yt = await ytFindId(searchQ);

            let audio = null;
            let source = "";

            // 1) Piped
            try {
                audio = await getAudioFromPiped(yt.id);
                source = "piped";
            } catch (e1) {
                // 2) Cobalt fallback
                try {
                    audio = await getAudioFromCobalt(yt.url || ("https://youtu.be/" + yt.id));
                    source = "cobalt";
                } catch (e2) {
                    throw new Error(
                        "Audio extract failed on server. Piped: " +
                            (e1.message || e1) +
                            " | Cobalt: " +
                            (e2.message || e2)
                    );
                }
            }

            const title = (meta && meta.title) || yt.title || audio.title || text;
            const artist = (meta && meta.artist) || "Unknown";
            const cover = (meta && meta.cover) || yt.thumbnail || null;
            const dur =
                meta && meta.duration
                    ? formatDur(meta.duration)
                    : yt.seconds
                      ? formatDur(yt.seconds)
                      : "";

            const caption =
                "╭━━〔 🎵 VENOM X PLAY 〕━━⬣\n" +
                "┃ 🎧 " + title + "\n" +
                "┃ 👤 " + artist + "\n" +
                (dur ? "┃ ⏱️ " + dur + "\n" : "") +
                "┃ 📡 " + source + "\n" +
                "┃ ⬇️ Sending audio...\n" +
                "╰━━━━━━━━━━━━━━━━⬣";

            if (cover) {
                try {
                    const img = await axios.get(cover, {
                        responseType: "arraybuffer",
                        timeout: 15000,
                        headers: { "User-Agent": UA }
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

            const buffer = await downloadBuffer(audio.url);

            // Prefer audio message; if WA rejects, send as document
            try {
                await sock.sendMessage(
                    from,
                    {
                        audio: buffer,
                        mimetype: /mp4|m4a/i.test(String(audio.mime || ""))
                            ? "audio/mp4"
                            : "audio/mpeg",
                        fileName: String(title).slice(0, 40) + ".mp3",
                        ptt: false
                    },
                    { quoted: message }
                );
            } catch (e) {
                await sock.sendMessage(
                    from,
                    {
                        document: buffer,
                        mimetype: "audio/mpeg",
                        fileName: String(title).slice(0, 40) + ".mp3",
                        caption: "🎵 " + title
                    },
                    { quoted: message }
                );
            }
        } catch (err) {
            console.log("PLAY ERROR:", err.message || err);
            return reply(
"╭━━〔 ❌ VENOM X PLAY 〕━━⬣\n\n" +
"Failed: " +
String(err.message || err).slice(0, 280) +
"\n\nTip: try a clearer song name.\n\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }
    }
};
