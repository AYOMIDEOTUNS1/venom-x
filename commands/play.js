/**
 * VENOM X PLAY - Render stable sources
 */

const axios = require("axios");
const yts = require("yt-search");
const { getSettings } = require("../lib/settingsCache");

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

async function itunesSearch(query) {
    try {
        const res = await axios.get("https://itunes.apple.com/search", {
            params: { term: query, media: "music", entity: "song", limit: 3 },
            timeout: 12000,
            headers: { "User-Agent": UA }
        });
        const results = (res.data && res.data.results) || [];
        if (!results.length) return null;
        const t = results[0];
        return {
            title: t.trackName || "Unknown",
            artist: t.artistName || "Unknown",
            cover: String(t.artworkUrl100 || "").replace("100x100bb", "600x600bb"),
            duration: Math.floor((t.trackTimeMillis || 0) / 1000),
            query: (t.trackName || "") + " " + (t.artistName || "")
        };
    } catch (e) {
        return null;
    }
}

async function ytFind(query) {
    const r = await yts(query);
    const v =
        (r.videos && r.videos[0]) ||
        (r.all && r.all.find(function (x) { return x && x.type === "video"; }));
    if (!v || !v.videoId) throw new Error("No YouTube result found");
    return {
        id: v.videoId,
        title: v.title,
        url: "https://youtu.be/" + v.videoId,
        seconds: v.seconds || 0,
        thumbnail: v.thumbnail
    };
}

function pickUrl(obj) {
    if (!obj) return null;
    if (typeof obj === "string" && obj.indexOf("http") === 0) return obj;

    return (
        obj.url ||
        obj.link ||
        obj.download_url ||
        obj.dl_url ||
        obj.audio ||
        obj.result ||
        (obj.data && (obj.data.url || obj.data.link || obj.data.dl || obj.data.download_url)) ||
        (obj.result && (obj.result.url || obj.result.link || obj.result.dl)) ||
        null
    );
}

async function extractAudio(youtubeUrl, videoId) {
    const errors = [];

    // --- Source pack (public APIs used by many WA bots) ---
    const tries = [
        // 1
        async function () {
            const { data } = await axios.get(
                "https://apis.davidcyriltech.my.id/download/ytmp3?url=" +
                    encodeURIComponent(youtubeUrl),
                { timeout: 45000, headers: { "User-Agent": UA } }
            );
            const url = pickUrl(data);
            if (!url) throw new Error("davidcyril empty");
            return { url: url, mime: "audio/mpeg", name: "davidcyril" };
        },
        // 2
        async function () {
            const { data } = await axios.get(
                "https://api.siputzx.my.id/api/d/ytmp3?url=" +
                    encodeURIComponent(youtubeUrl),
                { timeout: 45000, headers: { "User-Agent": UA } }
            );
            const url = pickUrl(data);
            if (!url) throw new Error("siputzx empty");
            return { url: url, mime: "audio/mpeg", name: "siputzx" };
        },
        // 3
        async function () {
            const { data } = await axios.get(
                "https://v2.api-m.com/api/ytmp3?url=" +
                    encodeURIComponent(youtubeUrl),
                { timeout: 45000, headers: { "User-Agent": UA } }
            );
            const url = pickUrl(data);
            if (!url) throw new Error("api-m empty");
            return { url: url, mime: "audio/mpeg", name: "api-m" };
        },
        // 4 Invidious-like / latest_version style mirrors
        async function () {
            const hosts = [
                "https://invidious.nerdvpn.de",
                "https://yewtu.be",
                "https://inv.nadeko.net"
            ];
            let last = null;
            for (let i = 0; i < hosts.length; i++) {
                try {
                    const { data } = await axios.get(
                        hosts[i] +
                            "/latest_version?id=" +
                            encodeURIComponent(videoId) +
                            "&itag=140",
                        {
                            timeout: 20000,
                            maxRedirects: 0,
                            validateStatus: function (s) {
                                return s >= 200 && s < 400 || s === 302 || s === 303;
                            },
                            headers: { "User-Agent": UA }
                        }
                    );
                    // some return redirect
                } catch (e) {
                    const loc =
                        e.response &&
                        e.response.headers &&
                        e.response.headers.location;
                    if (loc && String(loc).indexOf("http") === 0) {
                        return { url: loc, mime: "audio/mp4", name: "invidious" };
                    }
                    last = e;
                }
            }
            throw last || new Error("invidious failed");
        },
        // 5 Piped last resort
        async function () {
            const bases = [
                "https://pipedapi.adminforge.de",
                "https://pipedapi.reallyaweso.me",
                "https://pipedapi.leptons.xyz"
            ];
            let last = null;
            for (let i = 0; i < bases.length; i++) {
                try {
                    const { data } = await axios.get(
                        bases[i] + "/streams/" + encodeURIComponent(videoId),
                        { timeout: 20000, headers: { "User-Agent": UA } }
                    );
                    const streams = data.audioStreams || [];
                    if (!streams.length) throw new Error("no streams");
                    streams.sort(function (a, b) {
                        return (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0);
                    });
                    const best = streams[0];
                    if (!best || !best.url) throw new Error("no url");
                    return {
                        url: best.url,
                        mime: best.mimeType || "audio/mp4",
                        name: "piped"
                    };
                } catch (e) {
                    last = e;
                }
            }
            throw last || new Error("piped failed");
        }
    ];

    for (let i = 0; i < tries.length; i++) {
        try {
            const out = await tries[i]();
            if (out && out.url) return out;
        } catch (e) {
            errors.push(String(e.message || e));
        }
    }

    throw new Error("All extractors failed: " + errors.slice(0, 4).join(" | "));
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
            Referer: "https://www.youtube.com/"
        },
        validateStatus: function (s) {
            return s >= 200 && s < 400;
        }
    });
    const buf = Buffer.from(res.data);
    if (!buf || buf.length < 2000) throw new Error("Audio file too small");
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
p + "play <song name>\n\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        try {
            await reply("🔍 Searching: *" + text + "*");

            const meta = await itunesSearch(text);
            const yt = await ytFind(meta ? meta.query : text);
            const audio = await extractAudio(yt.url, yt.id);

            const title = (meta && meta.title) || yt.title || text;
            const artist = (meta && meta.artist) || "Unknown";
            const cover = (meta && meta.cover) || yt.thumbnail;
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
                "┃ 📡 " + audio.name + "\n" +
                "┃ ⬇️ Sending...\n" +
                "╰━━━━━━━━━━━━━━━━⬣";

            if (cover) {
                try {
                    const img = await axios.get(cover, {
                        responseType: "arraybuffer",
                        timeout: 12000,
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
"╭━━〔 ❌ PLAY FAILED 〕━━⬣\n\n" +
String(err.message || err).slice(0, 350) +
"\n\nTry another song name.\n\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }
    }
};
