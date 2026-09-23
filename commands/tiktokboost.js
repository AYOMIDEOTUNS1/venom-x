/**
 * TikTok Views Booster - OmegaTech API
 * #tiktokboost <url>
 */

const axios = require("axios");

module.exports = {
    name: "tiktokboost",
    aliases: ["ttboost", "boosttiktok", "ttviews"],

    run: async function ({ reply, args, message, sock, from }) {
        const text = (args || []).join(" ").trim();

        if (!text) {
            return reply(
"╭━━〔 📈 TIKTOK BOOST 〕━━⬣\n" +
"┃\n" +
"┃ Usage:\n" +
"┃ #tiktokboost <tiktok url>\n" +
"┃\n" +
"┃ Example:\n" +
"┃ #tiktokboost https://www.tiktok.com/@user/video/123\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        const urlMatch = text.match(/(https?:\/\/[^\s]+)/i);
        if (!urlMatch) {
            return reply("❌ Invalid URL. Send a full TikTok link.");
        }

        const tiktokUrl = urlMatch[0];

        if (
            tiktokUrl.indexOf("tiktok.com") === -1 &&
            tiktokUrl.indexOf("vm.tiktok.com") === -1 &&
            tiktokUrl.indexOf("vt.tiktok.com") === -1
        ) {
            return reply("❌ Please provide a valid TikTok URL.");
        }

        await reply("🔄 Sending boost request...\n" + tiktokUrl);

        try {
            const apiUrl =
                "https://api.omegatech.app/api/tools/tiktok-views?action=send&url=" +
                encodeURIComponent(tiktokUrl);

            const { data } = await axios.get(apiUrl, {
                timeout: 60000,
                headers: {
                    "User-Agent": "VENOM-X"
                }
            });

            if (!data) {
                return reply("❌ Empty response from API.");
            }

            // Failed response
            if (data.success === false) {
                return reply(
"╭━━〔 ❌ BOOST FAILED 〕━━⬣\n" +
"┃\n" +
"┃ " + (data.error || data.message || "Unknown error") + "\n" +
"┃\n" +
"┃ " + (data.note || "Try again later.") + "\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
                );
            }

            // Success / processing
            const title = data.title || data.data?.title || "TikTok Video";
            const author = data.author || data.data?.author || "Unknown";
            const status = data.status || data.data?.status || "Processing";
            const source = data.source || "Omegatech";

            return reply(
"╭━━〔 📈 TIKTOK BOOST 〕━━⬣\n" +
"┃\n" +
"┃ ✅ Request sent\n" +
"┃\n" +
"┃ 📹 " + title + "\n" +
"┃ 👤 " + author + "\n" +
"┃ 📊 Status: " + status + "\n" +
"┃\n" +
"┃ 🔗 " + tiktokUrl + "\n" +
"┃\n" +
"┃ 📝 Views can take time to show.\n" +
"┃ 🔹 Source: " + source + "\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        } catch (err) {
            console.log("TIKTOK BOOST ERROR:", err.message);
            const msg =
                (err.response && err.response.data && (err.response.data.error || err.response.data.message)) ||
                err.message ||
                "Request failed";
            return reply("❌ Boost failed:\n" + msg);
        }
    }
};
