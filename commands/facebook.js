const axios = require("axios");
const { runYtDlp } = require("../lib/ytdlp");

function pickUrl(text) {
    const m = String(text || "").match(/(https?:\/\/[^\s]+)/i);
    return m ? m[0] : "";
}

function cleanUrl(url) {
    url = String(url || "").trim();
    if (url.includes(" ")) url = url.split(/\s+/)[0];
    return url;
}

function isFacebook(url) {
    url = String(url || "").toLowerCase();
    return (
        url.includes("facebook.com") ||
        url.includes("fb.watch") ||
        url.includes("fb.com") ||
        url.includes("m.facebook.com")
    );
}

async function getFromYtDlp(url) {
    // returns best effort video url / file path depending on your lib
    const out = await runYtDlp(url, ["-f", "bv*+ba/b", "--no-playlist"]);
    return out;
}

module.exports = {
    name: "facebook",
    aliases: ["fb", "fbdl", "fbvideo"],

    run: async function ({ sock, from, args, reply, message }) {
        let url = args.join(" ").trim();

        if (!url) {
            const ctx =
                (message.message &&
                    message.message.extendedTextMessage &&
                    message.message.extendedTextMessage.contextInfo) ||
                {};
            const quoted = ctx.quotedMessage;
            if (quoted) {
                url =
                    quoted.conversation ||
                    (quoted.extendedTextMessage && quoted.extendedTextMessage.text) ||
                    (quoted.imageMessage && quoted.imageMessage.caption) ||
                    (quoted.videoMessage && quoted.videoMessage.caption) ||
                    "";
            }
        }

        url = cleanUrl(pickUrl(url) || url);

        if (!url) {
            return reply(
`╭━━〔 📘 VENOM X FACEBOOK 〕━━⬣
┃
┃ Usage:
┃ #fb <Facebook video link>
┃
┃ Or reply to a Facebook link:
┃ #fb
┃
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        if (!isFacebook(url)) {
            return reply("❌ Invalid Facebook link.");
        }

        try {
            await sock.sendMessage(from, {
                react: { text: "⏳", key: message.key }
            }).catch(function () {});
        } catch (e) {}

        try {
            await reply("📥 Downloading Facebook video...");

            // --- API attempt (simple public style) ---
            let videoUrl = null;
            let title = "Facebook Video";

            try {
                const { data } = await axios.get(
                    "https://api.siputzx.my.id/api/d/fb",
                    {
                        params: { url: url },
                        timeout: 45000,
                        headers: { "User-Agent": "VENOM-X" }
                    }
                );

                const d = data && (data.data || data.result || data);
                if (Array.isArray(d)) {
                    videoUrl = d[0] && (d[0].url || d[0].link);
                } else if (d) {
                    videoUrl =
                        d.url ||
                        d.video ||
                        d.hd ||
                        d.sd ||
                        (d.urls && d.urls[0] && (d.urls[0].url || d.urls[0]));
                    title = d.title || title;
                }
            } catch (e) {
                console.log("FB API fail:", e.message);
            }

            // --- yt-dlp fallback ---
            if (!videoUrl && typeof runYtDlp === "function") {
                try {
                    const filePath = await runYtDlp(url);
                    if (filePath) {
                        const fs = require("fs");
                        const buf = fs.readFileSync(filePath);
                        await sock.sendMessage(
                            from,
                            {
                                video: buf,
                                caption:
"╭━━〔 📘 VENOM X FACEBOOK 〕━━⬣\n" +
"┃ ✅ Downloaded\n" +
"┃ 📡 yt-dlp\n" +
"╰━━━━━━━━━━━━━━━━⬣"
                            },
                            { quoted: message }
                        );
                        try { fs.unlinkSync(filePath); } catch (e) {}

                        await sock.sendMessage(from, {
                            react: { text: "✅", key: message.key }
                        }).catch(function () {});
                        return;
                    }
                } catch (e) {
                    console.log("FB ytdlp fail:", e.message);
                }
            }

            if (!videoUrl) {
                return reply("❌ Could not fetch this Facebook video. Try another link.");
            }

            await sock.sendMessage(
                from,
                {
                    video: { url: videoUrl },
                    caption:
"╭━━〔 📘 VENOM X FACEBOOK 〕━━⬣\n" +
"┃ 🎬 " + title + "\n" +
"┃ ✅ Downloaded\n" +
"╰━━━━━━━━━━━━━━━━⬣"
                },
                { quoted: message }
            );

            await sock.sendMessage(from, {
                react: { text: "✅", key: message.key }
            }).catch(function () {});
        } catch (err) {
            console.log("FACEBOOK ERROR:", err.message);
            await sock.sendMessage(from, {
                react: { text: "❌", key: message.key }
            }).catch(function () {});
            return reply("❌ Facebook download failed.\nTry another link.");
        }
    }
};
