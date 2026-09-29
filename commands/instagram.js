const axios = require("axios");
const { runYtDlp } = require("../lib/ytdlp");

function pickUrl(text) {
    const m = String(text || "").match(/(https?:\/\/[^\s]+)/i);
    return m ? m[0] : "";
}

function cleanUrl(url) {
    url = String(url || "").trim();
    if (url.includes(" ")) url = url.split(/\s+/)[0];
    if (url.includes("?")) {
        // keep shortcode path; ig sometimes needs query, but usually fine stripped
        // only strip tracking junk if clearly present
    }
    return url;
}

function isInstagram(url) {
    url = String(url || "").toLowerCase();
    return (
        url.includes("instagram.com") ||
        url.includes("instagr.am")
    );
}

module.exports = {
    name: "instagram",
    aliases: ["ig", "igdl", "igreels", "igvideo"],

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
`╭━━〔 📸 VENOM X INSTAGRAM 〕━━⬣
┃
┃ Usage:
┃ #ig <Instagram link>
┃
┃ Supports:
┃ • Reels
┃ • Posts
┃ • Videos
┃
┃ Or reply to an IG link:
┃ #ig
┃
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        if (!isInstagram(url)) {
            return reply("❌ Invalid Instagram link.");
        }

        try {
            await sock.sendMessage(from, {
                react: { text: "⏳", key: message.key }
            }).catch(function () {});
        } catch (e) {}

        try {
            await reply("📥 Downloading Instagram media...");

            let mediaList = [];

            // API attempt
            try {
                const { data } = await axios.get(
                    "https://api.siputzx.my.id/api/d/ig",
                    {
                        params: { url: url },
                        timeout: 45000,
                        headers: { "User-Agent": "VENOM-X" }
                    }
                );

                const d = data && (data.data || data.result || data);
                if (Array.isArray(d)) {
                    mediaList = d
                        .map(function (x) {
                            return {
                                url: x.url || x.link || x,
                                type: (x.type || "").toLowerCase()
                            };
                        })
                        .filter(function (x) {
                            return x.url && String(x.url).indexOf("http") === 0;
                        });
                } else if (d && (d.url || d.video || d.image)) {
                    mediaList = [
                        {
                            url: d.url || d.video || d.image,
                            type: d.video ? "video" : "image"
                        }
                    ];
                }
            } catch (e) {
                console.log("IG API fail:", e.message);
            }

            // yt-dlp fallback
            if (!mediaList.length && typeof runYtDlp === "function") {
                try {
                    const filePath = await runYtDlp(url);
                    if (filePath) {
                        const fs = require("fs");
                        const buf = fs.readFileSync(filePath);
                        const isImg = /\.(jpg|jpeg|png|webp)$/i.test(filePath);

                        if (isImg) {
                            await sock.sendMessage(
                                from,
                                {
                                    image: buf,
                                    caption: "📸 Instagram\n⚡ VENOM X"
                                },
                                { quoted: message }
                            );
                        } else {
                            await sock.sendMessage(
                                from,
                                {
                                    video: buf,
                                    caption: "📸 Instagram\n⚡ VENOM X"
                                },
                                { quoted: message }
                            );
                        }

                        try { fs.unlinkSync(filePath); } catch (e) {}
                        await sock.sendMessage(from, {
                            react: { text: "✅", key: message.key }
                        }).catch(function () {});
                        return;
                    }
                } catch (e) {
                    console.log("IG ytdlp fail:", e.message);
                }
            }

            if (!mediaList.length) {
                return reply("❌ Could not fetch this Instagram post. Private/restricted posts often fail.");
            }

            for (let i = 0; i < mediaList.length; i++) {
                const item = mediaList[i];
                const u = item.url;
                const type = item.type || "";

                if (type.indexOf("video") !== -1 || /\.mp4(\?|$)/i.test(u)) {
                    await sock.sendMessage(
                        from,
                        {
                            video: { url: u },
                            caption: i === 0 ? "📸 Instagram\n⚡ VENOM X" : undefined
                        },
                        { quoted: message }
                    );
                } else {
                    await sock.sendMessage(
                        from,
                        {
                            image: { url: u },
                            caption: i === 0 ? "📸 Instagram\n⚡ VENOM X" : undefined
                        },
                        { quoted: message }
                    );
                }
            }

            await sock.sendMessage(from, {
                react: { text: "✅", key: message.key }
            }).catch(function () {});
        } catch (err) {
            console.log("INSTAGRAM ERROR:", err.message);
            await sock.sendMessage(from, {
                react: { text: "❌", key: message.key }
            }).catch(function () {});
            return reply("❌ Instagram download failed.\nPrivate posts or expired links often break.");
        }
    }
};
