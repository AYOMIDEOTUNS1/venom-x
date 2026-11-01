"use strict";

/**
 * VENOM X - TikTok Stalk (tikwm)
 * #ttstalk <username>
 * #stalk <username>
 */

const axios = require("axios");
const { getSettings } = require("../lib/settingsCache");

function px() {
    try {
        return getSettings().prefix || "#";
    } catch (e) {
        return "#";
    }
}

function cleanUser(input) {
    let s = String(input || "").trim();
    if (!s) return "";
    // full profile url
    const m = s.match(/tiktok\.com\/@([\w._-]+)/i);
    if (m) return m[1];
    s = s.replace(/^@/, "").replace(/\s+/g, "");
    return s;
}

function format(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
}

async function fetchUser(uniqueId) {
    const endpoints = [
        "https://www.tikwm.com/api/user/info",
        "https://tikwm.com/api/user/info"
    ];
    let last = null;

    for (let i = 0; i < endpoints.length; i++) {
        try {
            const { data } = await axios.get(endpoints[i], {
                params: { unique_id: uniqueId },
                timeout: 30000,
                headers: {
                    "User-Agent": "Mozilla/5.0",
                    Accept: "application/json"
                }
            });

            if (data && Number(data.code) === 0 && data.data) {
                // sometimes nested user
                return data.data.user || data.data;
            }
            last = new Error((data && data.msg) || "user not found");
        } catch (e) {
            last = e;
        }
    }
    throw last || new Error("stalk failed");
}

module.exports = {
    name: "ttstalk",
    aliases: ["stalk", "tiktokstalk", "ttuser"],

    run: async function ({ sock, from, args, reply, message }) {
        const prefix = px();
        const username = cleanUser((args || []).join(" "));

        if (!username) {
            return reply(
`╭━━〔 👤 TIKTOK STALK 〕━━⬣

Usage:
${prefix}ttstalk <username>
${prefix}stalk @charlidamelio
${prefix}ttstalk https://www.tiktok.com/@user

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        try {
            await sock.sendMessage(from, {
                react: { text: "🔎", key: message.key }
            });
        } catch (e) {}

        try {
            await reply("🔎 Stalking @" + username + "…");
            const u = await fetchUser(username);

            const nick = u.nickname || u.nickName || username;
            const id = u.unique_id || u.uniqueId || username;
            const bio = u.signature || u.bio || "—";
            const region = u.region || "—";
            const verified = u.verified ? "Yes" : "No";

            const stats = u.stats || u;
            const followers =
                stats.followerCount ||
                stats.follower_count ||
                u.follower_count ||
                0;
            const following =
                stats.followingCount ||
                stats.following_count ||
                u.following_count ||
                0;
            const likes =
                stats.heartCount ||
                stats.heart ||
                stats.total_favorited ||
                u.heart_count ||
                0;
            const videos =
                stats.videoCount ||
                stats.video_count ||
                u.video_count ||
                0;

            const avatar =
                u.avatarLarger ||
                u.avatarMedium ||
                u.avatarThumb ||
                u.avatar ||
                null;

            const text =
`╭━━〔 👤 TIKTOK STALK 〕━━⬣
┃
┃ 🪪 Username : @${id}
┃ 📛 Name : ${nick}
┃ ✅ Verified : ${verified}
┃ 🌍 Region : ${region}
┃
┃ 👥 Followers : ${format(followers)}
┃ 👤 Following : ${format(following)}
┃ ❤️ Likes : ${format(likes)}
┃ 🎬 Videos : ${format(videos)}
┃
┃ 📝 Bio
┃ ${String(bio).slice(0, 200)}
┃
┃ 🔗 https://www.tiktok.com/@${id}
┃
╰━━━━━━━━━━━━━━━━⬣`;

            if (avatar) {
                try {
                    const res = await axios.get(avatar, {
                        responseType: "arraybuffer",
                        timeout: 20000,
                        headers: { "User-Agent": "Mozilla/5.0" }
                    });
                    const buf = Buffer.from(res.data || []);
                    if (buf.length > 500) {
                        await sock.sendMessage(
                            from,
                            { image: buf, caption: text },
                            { quoted: message }
                        );
                        try {
                            await sock.sendMessage(from, {
                                react: { text: "✅", key: message.key }
                            });
                        } catch (e) {}
                        return;
                    }
                } catch (e) {}
            }

            await reply(text);
            try {
                await sock.sendMessage(from, {
                    react: { text: "✅", key: message.key }
                });
            } catch (e) {}
        } catch (e) {
            console.error("TTSTALK:", e.message);
            try {
                await sock.sendMessage(from, {
                    react: { text: "❌", key: message.key }
                });
            } catch (err) {}
            return reply(
                "❌ Stalk failed:\n" +
                    String(e.message || e).slice(0, 200) +
                    "\n\nTry: " +
                    px() +
                    "ttstalk username"
            );
        }
    }
};
