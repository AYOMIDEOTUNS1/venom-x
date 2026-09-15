/**
 * Pinterest / image search
 * Usage: #pint <query>
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

function collectUrls(data) {
    const out = [];
    if (!data) return out;

    if (Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            if (typeof item === "string" && /^https?:\/\//i.test(item)) {
                out.push(item);
            } else if (item && typeof item === "object") {
                const u =
                    item.images_url ||
                    item.image ||
                    item.url ||
                    item.img ||
                    item.thumbnail ||
                    item.images;
                if (typeof u === "string" && /^https?:\/\//i.test(u)) out.push(u);
            }
        }
        return out;
    }

    if (Array.isArray(data.data)) return collectUrls(data.data);
    if (Array.isArray(data.result)) return collectUrls(data.result);
    if (Array.isArray(data.images)) return collectUrls(data.images);
    return out;
}

async function searchImages(query) {
    const endpoints = [
        "https://api.siputzx.my.id/api/s/pinterest?query=" + encodeURIComponent(query),
        "https://api.siputzx.my.id/api/s/pinterest?q=" + encodeURIComponent(query)
    ];

    for (let i = 0; i < endpoints.length; i++) {
        try {
            const res = await axios.get(endpoints[i], {
                timeout: 20000,
                headers: { "User-Agent": "VENOM-X" }
            });
            const urls = collectUrls(res.data).filter(Boolean);
            if (urls.length) return urls.slice(0, 5);
        } catch (e) {
            console.log("PINT endpoint fail:", e.message);
        }
    }

    // Pollinations fallback (always returns something)
    const seed = Date.now();
    return [
        "https://image.pollinations.ai/prompt/" +
            encodeURIComponent(query + ", high quality photo") +
            "?width=768&height=1024&nologo=true&seed=" +
            seed
    ];
}

module.exports = {
    name: "pint",
    aliases: ["pinterest", "pin", "img"],
    category: "tools",
    description: "Search images (Pinterest-style)",

    run: async function ({ sock, from, args, reply, message }) {
        const p = px();
        const query = args.join(" ").trim();

        if (!query) {
            return reply(
`╭━━〔 🔍 PINTEREST 〕━━⬣

Usage:
${p}pint <query>

Example:
${p}pint Kim Kardashian
${p}pint anime wallpaper
${p}pint Nike shoes

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        await reply("🔍 Searching *" + query + "*...");

        try {
            const images = await searchImages(query);
            if (!images.length) {
                return reply("❌ No images found. Try another keyword.");
            }

            const max = Math.min(images.length, 4);
            for (let i = 0; i < max; i++) {
                const img = images[i];
                if (!img) continue;

                try {
                    await sock.sendMessage(
                        from,
                        {
                            image: { url: img },
                            caption:
                                i === 0
                                    ? "🔍 *Pinterest Result*\n📌 Query: " + query + "\n⚡ VENOM X"
                                    : undefined
                        },
                        { quoted: i === 0 ? message : undefined }
                    );
                } catch (e) {
                    console.log("PINT send fail:", e.message);
                }

                await new Promise(function (r) {
                    setTimeout(r, 700);
                });
            }
        } catch (err) {
            console.log("[PINT ERROR]", err.message);
            return reply("❌ Failed to fetch images. Try again later.");
        }
    }
};
