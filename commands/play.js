"use strict";

/**
 * VENOM X — #play / #song / #music
 * Search YouTube → download MP3 (multi-fallback)
 */

const axios = require("axios");
const { getSettings } = require("../lib/settingsCache");

let yts = null;
try {
    yts = require("yt-search");
} catch (e) {}

function px() {
    try {
        return getSettings().prefix || "#";
    } catch (e) {
        return "#";
    }
}

function fmtDur(sec) {
    sec = Math.floor(Number(sec) || 0);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ":" + String(s).padStart(2, "0");
}

async function searchYoutube(query) {
    // 1) yt-search package
    if (typeof yts === "function") {
        try {
            const r = await yts(query);
            const v = (r.videos || []).filter(function (x) {
                return x && x.videoId && (x.seconds || 0) < 900;
            });
            if (v.length) {
                return v.slice(0, 6).map(function (x) {
                    return {
                        title: x.title,
                        url: x.url,
                        videoId: x.videoId,
                        thumbnail: x.thumbnail,
                        timestamp: x.timestamp || fmtDur(x.seconds),
                        author: (x.author && x.author.name) || "Unknown"
                    };
                });
            }
        } catch (e) {
            console.log("yts err:", e.message);
        }
    }

    // 2) public search API
    try {
        const { data } = await axios.get(
            "https://api.siputzx.my.id/api/s/youtube",
            {
                params: { query: query },
                timeout: 25000,
                headers: { "User-Agent": "VENOM-X" }
            }
        );
        const list = (data && data.data) || [];
        const out = [];
        for (let i = 0; i < list.length && out.length < 6; i++) {
            const x = list[i];
            if (!x || x.type && x.type !== "video") continue;
            out.push({
                title: x.title,
                url: x.url || ("https://youtube.com/watch?v=" + x.videoId),
                videoId: x.videoId,
                thumbnail: x.thumbnail || x.image,
                timestamp: (x.duration && x.duration.timestamp) || x.timestamp || "",
                author: (x.author && x.author.name) || x.author || "Unknown"
            });
        }
        if (out.length) return out;
    } catch (e) {
        console.log("siputzx search:", e.message);
    }

    throw new Error("Search failed — try another song name");
}

async function downloadMp3(videoUrl) {
    const endpoints = [
        function () {
            return axios.get(
                "https://apis.davidcyriltech.my.id/download/ytmp3",
                {
                    params: { url: videoUrl },
                    timeout: 60000,
                    headers: { "User-Agent": "VENOM-X" }
                }
            );
        },
        function () {
            return axios.get(
                "https://apis.davidcyriltech.my.id/youtube/mp3",
                {
                    params: { url: videoUrl },
                    timeout: 60000,
                    headers: { "User-Agent": "VENOM-X" }
                }
            );
        }
    ];

    let last = null;
    for (let i = 0; i < endpoints.length; i++) {
        try {
            const { data } = await endpoints[i]();
            const r = (data && data.result) || data || {};
            const link =
                r.download_url ||
                r.downloadUrl ||
                r.url ||
                r.audio ||
                r.dlink ||
                (r.result && (r.result.download_url || r.result.url));
            if (link) {
                return {
                    url: link,
                    title: r.title || "",
                    thumb: r.thumbnail || r.thumb || ""
                };
            }
            last = new Error("No download link in response");
        } catch (e) {
            last = e;
        }
    }
    throw last || new Error("All MP3 extractors failed");
}

async function bufferFromUrl(url) {
    const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 120000,
        maxContentLength: 25 * 1024 * 1024,
        headers: { "User-Agent": "VENOM-X" },
        validateStatus: function (s) {
            return s >= 200 && s < 400;
        }
    });
    const buf = Buffer.from(res.data || []);
    if (buf.length < 5000) throw new Error("Audio file too small / empty");
    return buf;
}

module.exports = {
    name: "play",
    aliases: ["song", "music", "p"],

    run: async function ({ sock, from, args, reply, message }) {
        const q = (args || []).join(" ").trim();
        if (!q) {
            return reply(
`╭━━〔 🎵 VENOM X PLAY 〕━━⬣

Usage:
${px()}play <song name>

Example:
${px()}play Alone Marshmello
${px()}play Burna Boy Last Last

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        try {
            await reply("🔍 Searching: *" + q + "* …");

            const results = await searchYoutube(q);
            const pick = results[0];
            if (!pick) throw new Error("No results");

            await reply(
                "⏬ Downloading…\n🎵 *" +
                    pick.title +
                    "*\n👤 " +
                    pick.author +
                    (pick.timestamp ? "\n⏱ " + pick.timestamp : "")
            );

            const dl = await downloadMp3(pick.url);
            const audio = await bufferFromUrl(dl.url);

            const caption =
`╭━━〔 🎵 VENOM X PLAY 〕━━⬣
┃ 🎶 ${pick.title}
┃ 👤 ${pick.author}
┃ ⏱ ${pick.timestamp || "—"}
╰━━━━━━━━━━━━━━━━⬣`;

            if (pick.thumbnail || dl.thumb) {
                try {
                    const img = await axios.get(pick.thumbnail || dl.thumb, {
                        responseType: "arraybuffer",
                        timeout: 15000
                    });
                    await sock.sendMessage(
                        from,
                        {
                            image: Buffer.from(img.data),
                            caption: caption
                        },
                        { quoted: message }
                    );
                } catch (e) {
                    await reply(caption);
                }
            } else {
                await reply(caption);
            }

            await sock.sendMessage(
                from,
                {
                    audio: audio,
                    mimetype: "audio/mpeg",
                    fileName: String(pick.title).slice(0, 40) + ".mp3",
                    ptt: false
                },
                { quoted: message }
            );
        } catch (err) {
            console.log("PLAY ERROR:", err.message);
            return reply(
`╭━━〔 ❌ PLAY FAILED 〕━━⬣

${String(err.message || err).slice(0, 280)}

Try another song name.
If this keeps happening on Botkeep, host may be blocking music APIs (same as TikTok 403).

╰━━━━━━━━━━━━━━━━⬣`
            );
        }
    }
};
