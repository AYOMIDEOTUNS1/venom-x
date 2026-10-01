/**
 * VENOM X PLAY
 * Search: OmegaTech Apple Music
 * Download: OmegaTech action=download (fallback: YT / iTunes preview)
 *
 * #play Alone
 * #play Alone 2
 */

const axios = require("axios");
const yts = require("yt-search");
const { getSettings } = require("../lib/settingsCache");

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function px() {
    try {
        return getSettings().prefix || "#";
    } catch (e) {
        return "#";
    }
}

async function appleSearch(query) {
    const { data } = await axios.get(
        "https://api.omegatech.app/api/Search/Applemusic",
        {
            params: { action: "search", query: query },
            timeout: 25000,
            headers: { "User-Agent": "VENOM-X" }
        }
    );

    if (!data || data.success === false) {
        throw new Error((data && data.error) || "Apple search failed");
    }

    const results =
        (data.data && data.data.results) ||
        data.results ||
        [];

    if (!Array.isArray(results) || !results.length) {
        throw new Error("No songs found");
    }
    return results;
}

async function appleDownload(trackUrl) {
    const { data } = await axios.get(
        "https://api.omegatech.app/api/Search/Applemusic",
        {
            params: { action: "download", url: trackUrl },
            timeout: 60000,
            headers: { "User-Agent": "VENOM-X" }
        }
    );

    if (!data || data.success === false) {
        throw new Error((data && (data.error || data.message)) || "Download failed");
    }

    const d = data.data || data.result || data;
    const audioUrl =
        d.downloadUrl ||
        d.download_url ||
        d.url ||
        d.link ||
        d.audio ||
        d.dl ||
        (d.data && (d.data.downloadUrl || d.data.url || d.data.link));

    if (!audioUrl) throw new Error("No downloadUrl in response");

    return {
        audioUrl: audioUrl,
        title: d.title || null,
        artist: d.artist || null,
        cover: d.cover || d.image || null
    };
}

async function downloadBuffer(url) {
    const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 120000,
        maxContentLength: 40 * 1024 * 1024,
        headers: { "User-Agent": UA, Accept: "*/*" }
    });
    const buf = Buffer.from(res.data);
    if (!buf || buf.length < 1000) throw new Error("Audio file too small");
    return buf;
}

async function ytFallback(query) {
    const r = await yts(query + " audio");
    const v = r.videos && r.videos[0];
    if (!v) throw new Error("No YouTube fallback");
    return {
        title: v.title,
        url: v.url,
        thumbnail: v.thumbnail
    };
}

module.exports = {
    name: "play",
    aliases: ["song", "music", "apple", "applemusic"],

    run: async function ({ sock, from, args, reply, message }) {
        const p = px();
        const text = (args || []).join(" ").trim();

        if (!text) {
            return reply(
"╭━━〔 🎵 VENOM X PLAY 〕━━⬣\n" +
"┃\n" +
"┃ Usage:\n" +
"┃ " + p + "play <song name>\n" +
"┃ " + p + "play Alone\n" +
"┃ " + p + "play Alone 2\n" +
"┃\n" +
"┃ Source: Apple Music search\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        const parts = text.split(/\s+/);
        const last = parts[parts.length - 1];
        const pick = /^\d+$/.test(last) ? parseInt(last, 10) : 1;
        const query = /^\d+$/.test(last) ? parts.slice(0, -1).join(" ") : text;

        if (!query) return reply("❌ Song name required.");

        try {
            await reply("🔍 Searching Apple Music: *" + query + "*");

            const results = await appleSearch(query);
            const index = Math.min(Math.max(pick, 1), results.length) - 1;
            const track = results[index];

            const title = track.title || query;
            const artist = track.artist || "Unknown";
            const cover = track.cover || null;
            const trackUrl = track.url;

            // show choices if user didn't pick a number and many results
            if (!/^\d+$/.test(last) && results.length > 1) {
                let list =
"╭━━〔 🎵 RESULTS 〕━━⬣\n" +
"┃ Query: " + query + "\n" +
"┃\n";
                for (let i = 0; i < Math.min(results.length, 5); i++) {
                    const r = results[i];
                    list +=
                        "┃ " +
                        (i + 1) +
                        ". " +
                        (r.title || "?") +
                        " — " +
                        (r.artist || "?") +
                        "\n";
                }
                list +=
"┃\n" +
"┃ Pick:\n" +
"┃ " + p + "play " + query + " 2\n" +
"┃\n" +
"┃ Downloading #1...\n" +
"╰━━━━━━━━━━━━━━━━⬣";
                await reply(list);
            }

            await reply("⬇️ Downloading: *" + title + "* — *" + artist + "*");

            let audioBuf = null;
            let source = "apple";
            let finalTitle = title;
            let finalArtist = artist;
            let finalCover = cover;

            // 1) OmegaTech Apple download
            try {
                if (!trackUrl) throw new Error("No Apple track url");
                const dl = await appleDownload(trackUrl);
                audioBuf = await downloadBuffer(dl.audioUrl);
                if (dl.title) finalTitle = dl.title;
                if (dl.artist) finalArtist = dl.artist;
                if (dl.cover) finalCover = dl.cover;
            } catch (e1) {
                console.log("APPLE DL FAIL:", e1.message);

                // 2) iTunes preview fallback (30s) — reliable on Render
                try {
                    const it = await axios.get("https://itunes.apple.com/search", {
                        params: {
                            term: title + " " + artist,
                            media: "music",
                            entity: "song",
                            limit: 1
                        },
                        timeout: 12000,
                        headers: { "User-Agent": UA }
                    });
                    const t = it.data && it.data.results && it.data.results[0];
                    if (t && t.previewUrl) {
                        audioBuf = await downloadBuffer(t.previewUrl);
                        source = "itunes-preview";
                        if (t.artworkUrl100) {
                            finalCover = String(t.artworkUrl100).replace(
                                "100x100bb",
                                "600x600bb"
                            );
                        }
                    } else {
                        throw new Error("No iTunes preview");
                    }
                } catch (e2) {
                    throw new Error(
                        "Apple download failed (" +
                            e1.message +
                            "). Preview also failed (" +
                            e2.message +
                            ")."
                    );
                }
            }

            const caption =
"╭━━〔 🎵 VENOM X PLAY 〕━━⬣\n" +
"┃ 🎧 " + finalTitle + "\n" +
"┃ 👤 " + finalArtist + "\n" +
"┃ 📡 " + source + "\n" +
(source === "itunes-preview"
    ? "┃ ⚠️ 30s preview (full dl blocked)\n"
    : "") +
(trackUrl ? "┃ 🔗 Apple Music track\n" : "") +
"╰━━━━━━━━━━━━━━━━⬣";

            if (finalCover) {
                try {
                    const img = await axios.get(finalCover, {
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

            try {
                await sock.sendMessage(
                    from,
                    {
                        audio: audioBuf,
                        mimetype: "audio/mpeg",
                        fileName: String(finalTitle).slice(0, 40) + ".mp3",
                        ptt: false
                    },
                    { quoted: message }
                );
            } catch (e) {
                await sock.sendMessage(
                    from,
                    {
                        document: audioBuf,
                        mimetype: "audio/mpeg",
                        fileName: String(finalTitle).slice(0, 40) + ".mp3",
                        caption: "🎵 " + finalTitle
                    },
                    { quoted: message }
                );
            }
        } catch (err) {
            console.log("PLAY ERROR:", err.message || err);
            return reply(
"╭━━〔 ❌ PLAY FAILED 〕━━⬣\n" +
"┃\n" +
"┃ " + String(err.message || err).slice(0, 280) + "\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }
    }
};
