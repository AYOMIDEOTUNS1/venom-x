/**
 * VENOM X - #xnxx (18+)
 * #xnxx <search>
 * #xnxx <xnxx url>
 */

const axios = require("axios");

function isXnxxUrl(text) {
    const u = String(text || "").toLowerCase();
    return u.includes("xnxx.com") || u.includes("www.xnxx.com");
}

function pickUrl(text) {
    const m = String(text || "").match(/(https?:\/\/[^\s]+)/i);
    return m ? m[0] : null;
}

async function searchXnxx(query) {
    // public bot-style endpoint (may change / rate-limit)
    const { data } = await axios.get(
        "https://api.siputzx.my.id/api/s/xnxx",
        {
            params: { query: query },
            timeout: 30000,
            headers: { "User-Agent": "VENOM-X" }
        }
    );

    const list =
        (data && data.data) ||
        (data && data.result) ||
        (Array.isArray(data) ? data : []);

    if (!Array.isArray(list) || !list.length) {
        throw new Error("No results found");
    }
    return list.slice(0, 8);
}

async function detailXnxx(url) {
    const { data } = await axios.get(
        "https://api.siputzx.my.id/api/d/xnxx",
        {
            params: { url: url },
            timeout: 45000,
            headers: { "User-Agent": "VENOM-X" }
        }
    );

    const d = (data && data.data) || (data && data.result) || data;
    if (!d) throw new Error("Empty detail response");
    return d;
}

module.exports = {
    name: "xnxx",
    aliases: ["xnxxdl", "xnxxsearch"],

    run: async function ({ sock, from, args, reply, message }) {
        const text = (args || []).join(" ").trim();

        if (!text) {
            return reply(
"╭━━〔 🔞 VENOM XNXX 〕━━⬣\n" +
"┃\n" +
"┃ 18+ only\n" +
"┃\n" +
"┃ Search:\n" +
"┃ #xnxx <query>\n" +
"┃\n" +
"┃ Download:\n" +
"┃ #xnxx <xnxx link>\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        try {
            await reply("⏳ Processing (18+)...");

            // DOWNLOAD MODE
            if (isXnxxUrl(text) || isXnxxUrl(pickUrl(text) || "")) {
                const url = pickUrl(text) || text;
                const d = await detailXnxx(url);

                const title = d.title || d.name || "XNXX Video";
                const video =
                    d.url ||
                    d.dl ||
                    d.download ||
                    d.files ||
                    (d.media && (d.media.url || d.media)) ||
                    null;

                // some APIs return quality list
                let link = null;
                if (typeof video === "string") link = video;
                else if (Array.isArray(video) && video[0]) {
                    link = video[0].url || video[0].link || video[0];
                } else if (video && typeof video === "object") {
                    link = video.high || video.low || video.url || video.link;
                }

                if (!link) {
                    return reply("❌ No downloadable link returned for this video.");
                }

                const caption =
"╭━━〔 🔞 XNXX 〕━━⬣\n" +
"┃ 🎬 " + String(title).slice(0, 80) + "\n" +
"┃ ✅ Ready\n" +
"╰━━━━━━━━━━━━━━━━⬣";

                // try send as video url; if too heavy WA may fail
                try {
                    await sock.sendMessage(
                        from,
                        { video: { url: link }, caption: caption },
                        { quoted: message }
                    );
                } catch (e) {
                    await reply(caption + "\n\n🔗 " + link);
                }
                return;
            }

            // SEARCH MODE
            const results = await searchXnxx(text);
            let out =
"╭━━〔 🔞 XNXX SEARCH 〕━━⬣\n" +
"┃ Query: " + text + "\n" +
"┃\n";

            for (let i = 0; i < results.length; i++) {
                const r = results[i] || {};
                const title = r.title || r.name || "Result " + (i + 1);
                const link = r.link || r.url || r.href || "";
                out +=
                    "┃ " +
                    (i + 1) +
                    ". " +
                    String(title).slice(0, 60) +
                    "\n";
                if (link) out += "┃ " + link + "\n";
                out += "┃\n";
            }

            out +=
"┃ Download:\n" +
"┃ #xnxx <link>\n" +
"╰━━━━━━━━━━━━━━━━⬣";

            return reply(out);
        } catch (e) {
            console.log("XNXX ERROR:", e.message);
            return reply(
"╭━━〔 ❌ XNXX 〕━━⬣\n" +
"┃ Failed: " + String(e.message || e).slice(0, 180) + "\n" +
"┃\n" +
"┃ API may be down. Try again later.\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }
    }
};
