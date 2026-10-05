/**
 * VENOM X - Spotify Play
 * #spotify <song>
 * #sfplay <song>
 * #spotifyplay <song>
 */

const axios = require("axios");

module.exports = {
    name: "spotify",
    aliases: ["spotifyplay", "sfplay", "splay"],

    run: async function ({ sock, from, args, reply, message }) {
        const text = (args || []).join(" ").trim();

        if (!text) {
            return reply(
"╭━━〔 🎵 VENOM SPOTIFY 〕━━⬣\n" +
"┃\n" +
"┃ Usage:\n" +
"┃ #spotify <song name>\n" +
"┃ #sfplay Alone\n" +
"┃ #spotifyplay Burna Boy\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        try {
            await reply("⏳ Searching Spotify: *" + text + "*");

            const api =
                "https://api.nexadev.my.id/api/spotifyplay?q=" +
                encodeURIComponent(text);

            const { data } = await axios.get(api, {
                timeout: 45000,
                headers: { "User-Agent": "VENOM-X" }
            });

            if (!data || !data.status || !data.result) {
                return reply("❌ Song not found on Spotify.");
            }

            const res = data.result;
            const title = res.title || text;
            const artist = res.artist || "Unknown";
            const album = res.album || "Unknown";
            const duration = res.duration || "N/A";
            const popularity = res.popularity || "N/A";
            const release = res.release_at || res.release || "N/A";
            const url = res.url || "";
            const thumb = res.thumbnail || res.cover || null;
            const download = res.download_url || res.dl || res.audio || null;

            if (!download) {
                return reply("❌ No download link returned for this track.");
            }

            const caption =
"╭━━〔 🎵 VENOM SPOTIFY 〕━━⬣\n" +
"┃\n" +
"┃ 📀 Title  : " + title + "\n" +
"┃ 🎤 Artist : " + artist + "\n" +
"┃ 💽 Album  : " + album + "\n" +
"┃ ⏱ Duration: " + duration + "\n" +
"┃ ⭐ Popular: " + popularity + "\n" +
"┃ 📅 Release: " + release + "\n" +
(url ? "┃ 🔗 " + url + "\n" : "") +
"┃\n" +
"┃ ⏳ Sending audio...\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣";

            if (thumb) {
                try {
                    await sock.sendMessage(
                        from,
                        { image: { url: thumb }, caption: caption },
                        { quoted: message }
                    );
                } catch (e) {
                    await reply(caption);
                }
            } else {
                await reply(caption);
            }

            // download buffer first (more stable on WA than raw url sometimes)
            try {
                const bin = await axios.get(download, {
                    responseType: "arraybuffer",
                    timeout: 120000,
                    maxContentLength: 40 * 1024 * 1024,
                    headers: { "User-Agent": "VENOM-X" }
                });
                const buffer = Buffer.from(bin.data);
                if (!buffer.length) throw new Error("Empty audio");

                await sock.sendMessage(
                    from,
                    {
                        audio: buffer,
                        mimetype: "audio/mpeg",
                        fileName: String(title).slice(0, 40) + ".mp3",
                        ptt: false
                    },
                    { quoted: message }
                );
            } catch (e) {
                // fallback: send by url
                await sock.sendMessage(
                    from,
                    {
                        audio: { url: download },
                        mimetype: "audio/mpeg",
                        fileName: String(title).slice(0, 40) + ".mp3",
                        ptt: false
                    },
                    { quoted: message }
                );
            }
        } catch (e) {
            console.log("SPOTIFY ERROR:", e.message || e);
            return reply(
"╭━━〔 ❌ SPOTIFY FAILED 〕━━⬣\n" +
"┃\n" +
"┃ " + String(e.message || e).slice(0, 200) + "\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }
    }
};
