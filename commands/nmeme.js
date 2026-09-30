/**
 * VENOM X - #nmeme
 * Random Nigerian / Naija meme
 */

const axios = require("axios");

const SUBS = [
    "Nigeria",
    "NigerianFootball",
    "AfricaReddit",
    "dankmemes",
    "memes"
];

const UA = "VENOM-X/1.0";

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

async function fromReddit() {
    // bias first subs toward Nigeria-related, still allow general meme fallback
    const order = SUBS.slice().sort(function () {
        return Math.random() - 0.5;
    });

    for (let i = 0; i < order.length; i++) {
        const sub = order[i];
        try {
            const { data } = await axios.get(
                "https://www.reddit.com/r/" + sub + "/hot.json",
                {
                    params: { limit: 40 },
                    timeout: 15000,
                    headers: { "User-Agent": UA }
                }
            );

            const children =
                data && data.data && Array.isArray(data.data.children)
                    ? data.data.children
                    : [];

            const images = children
                .map(function (c) {
                    return c && c.data ? c.data : null;
                })
                .filter(function (p) {
                    if (!p || p.over_18) return false;
                    const url = p.url || "";
                    return (
                        /\.(jpg|jpeg|png|webp)$/i.test(url) ||
                        (p.post_hint === "image" && url.indexOf("i.redd.it") !== -1)
                    );
                });

            if (!images.length) continue;

            // prefer Nigeria sub when available
            const post = pick(images);
            return {
                title: post.title || "Naija Meme",
                url: post.url,
                sub: post.subreddit || sub,
                source: "reddit"
            };
        } catch (e) {
            // try next sub
        }
    }

    throw new Error("Reddit sources failed");
}

async function fromMemeApi() {
    const { data } = await axios.get("https://meme-api.com/gimme", {
        timeout: 12000,
        headers: { "User-Agent": UA }
    });

    if (!data || !data.url) throw new Error("meme-api empty");

    return {
        title: data.title || "Meme",
        url: data.url,
        sub: data.subreddit || "memes",
        source: "meme-api"
    };
}

module.exports = {
    name: "nmeme",
    aliases: ["naijameme", "nigerianmeme", "memenaija"],

    run: async function ({ sock, from, reply, message }) {
        try {
            await reply("😂 Fetching Naija meme...");

            let meme = null;
            try {
                meme = await fromReddit();
            } catch (e1) {
                meme = await fromMemeApi();
            }

            await sock.sendMessage(
                from,
                {
                    image: { url: meme.url },
                    caption:
"╭━━〔 😂 NAIJA MEME 〕━━⬣\n" +
"┃ " + String(meme.title).slice(0, 120) + "\n" +
"┃ 📌 r/" + meme.sub + "\n" +
"┃ 📡 " + meme.source + "\n" +
"╰━━━━━━━━━━━━━━━━⬣\n" +
"⚡ VENOM X"
                },
                { quoted: message }
            );
        } catch (e) {
            return reply("❌ #nmeme failed:\n" + e.message);
        }
    }
};
