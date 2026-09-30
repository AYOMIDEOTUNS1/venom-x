const axios = require("axios");

function cleanUser(input) {
    let u = String(input || "").trim();
    u = u.replace(/^@/, "");
    u = u.replace(/https?:\/\/(www\.)?tiktok\.com\/@/i, "");
    u = u.split(/[/?\s]/)[0];
    return u;
}

module.exports = {
    name: "ttstalk",
    aliases: ["ttstalker", "tiktokstalk", "ttuser"],

    run: async function ({ sock, from, args, reply, message }) {
        const user = cleanUser(args.join(" "));
        if (!user) {
            return reply(
"╭━━〔 🎵 TT STALK 〕━━⬣\n" +
"┃\n" +
"┃ Usage:\n" +
"┃ #ttstalk username\n" +
"┃ #ttstalker @username\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        await reply("🔍 Stalking TikTok: *" + user + "*");

        try {
            let data = null;

            // primary
            try {
                const res = await axios.get(
                    "https://www.tikwm.com/api/user/info",
                    {
                        params: { unique_id: user },
                        timeout: 25000,
                        headers: { "User-Agent": "VENOM-X" }
                    }
                );
                data = res.data && (res.data.data || res.data);
            } catch (e) {}

            // fallback
            if (!data || !(data.user || data.stats || data.userInfo)) {
                const res = await axios.get(
                    "https://tikwm.com/api/user/info",
                    {
                        params: { unique_id: user },
                        timeout: 25000,
                        headers: { "User-Agent": "VENOM-X" }
                    }
                );
                data = res.data && (res.data.data || res.data);
            }

            const u = (data && (data.user || data.userInfo || data)) || {};
            const s = (data && (data.stats || data.statsV2 || u.stats)) || {};

            const nick = u.nickname || u.nickName || u.nickname || user;
            const id = u.uniqueId || u.unique_id || user;
            const sig = u.signature || u.bio || u.signature || "No bio";
            const av =
                u.avatarLarger ||
                u.avatarMedium ||
                u.avatarThumb ||
                u.avatar ||
                null;

            const followers = s.followerCount || s.followers || s.follower_count || 0;
            const following = s.followingCount || s.following || s.following_count || 0;
            const hearts = s.heartCount || s.heart || s.heart_count || s.total_favorited || 0;
            const videos = s.videoCount || s.videos || s.video_count || 0;
            const verified = u.verified ? "Yes" : "No";

            const caption =
"╭━━〔 🎵 TIKTOK STALK 〕━━⬣\n" +
"┃ 👤 " + nick + "\n" +
"┃ 🔗 @" + id + "\n" +
"┃ ✅ Verified: " + verified + "\n" +
"┃ 👥 Followers: " + followers + "\n" +
"┃ 👤 Following: " + following + "\n" +
"┃ ❤️ Likes: " + hearts + "\n" +
"┃ 🎬 Videos: " + videos + "\n" +
"┃ 📝 " + String(sig).slice(0, 120) + "\n" +
"┃\n" +
"┃ 🌐 https://tiktok.com/@" + id + "\n" +
"╰━━━━━━━━━━━━━━━━⬣";

            if (av) {
                await sock.sendMessage(
                    from,
                    { image: { url: av }, caption: caption },
                    { quoted: message }
                );
            } else {
                await reply(caption);
            }
        } catch (e) {
            return reply("❌ TT stalk failed:\n" + e.message + "\n\nUser may be private/invalid.");
        }
    }
};
