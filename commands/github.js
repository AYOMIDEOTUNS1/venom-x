const axios = require("axios");

module.exports = {
    name: "github",
    aliases: ["gh", "gituser"],

    run: async function ({ sock, from, args, reply, message }) {
        const user = (args[0] || "").replace(/^@/, "").trim();
        if (!user) return reply("Usage: *#github username*\nExample: #github torvalds");

        try {
            await reply("🔍 Fetching GitHub...");
            const { data } = await axios.get("https://api.github.com/users/" + encodeURIComponent(user), {
                timeout: 15000,
                headers: { "User-Agent": "VENOM-X", Accept: "application/vnd.github+json" }
            });

            const caption =
"╭━━〔 🐙 GITHUB 〕━━⬣\n" +
"┃ 👤 " + (data.name || data.login) + "\n" +
"┃ 🔗 @" + data.login + "\n" +
"┃ 📝 " + (data.bio || "No bio") + "\n" +
"┃ 📍 " + (data.location || "N/A") + "\n" +
"┃ 📦 Repos: " + data.public_repos + "\n" +
"┃ 👥 Followers: " + data.followers + "\n" +
"┃ 👤 Following: " + data.following + "\n" +
"┃ 🌐 " + (data.html_url || "") + "\n" +
"╰━━━━━━━━━━━━━━━━⬣";

            if (data.avatar_url) {
                await sock.sendMessage(
                    from,
                    { image: { url: data.avatar_url }, caption: caption },
                    { quoted: message }
                );
            } else {
                await reply(caption);
            }
        } catch (e) {
            if (e.response && e.response.status === 404) return reply("❌ GitHub user not found.");
            return reply("❌ GitHub failed:\n" + e.message);
        }
    }
};
