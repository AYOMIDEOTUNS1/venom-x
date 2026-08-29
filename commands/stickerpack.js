const axios = require("axios");
const { imageToSticker } = require("../lib/sticker");

module.exports = {
    name: "stickerpack",
    aliases: ["spack", "makepack"],

    run: async ({ sock, from, args, reply }) => {
        let source = "auto";
        let queryParts = [...args];

        if (queryParts[0]) {
            const first = queryParts[0].toLowerCase();
            if (first === "pinterest" || first === "pin") {
                source = "pinterest";
                queryParts.shift();
            } else if (first === "tiktok" || first === "tt") {
                source = "tiktok";
                queryParts.shift();
            }
        }

        const query = queryParts.join(" ").trim();

        if (!query) {
            return reply(
`╭━━〔 🖼️ VENOM X STICKER PACK 〕━━⬣

Usage:
#stickerpack <name>
#stickerpack pinterest <name>
#stickerpack tiktok <name>

Examples:
#stickerpack sukuna
#stickerpack pinterest pepe
#stickerpack tiktok anime

Max: 6 stickers
Branded with VENOM X

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        await reply(`🔍 Searching (\( {source}) for: * \){query}*\n⏳ Please wait...`);

        try {
            let images = [];

            if (source === "pinterest" || source === "auto") {
                images = await searchPinterest(query, 6);
            }

            if ((!images.length && source === "auto") || source === "tiktok") {
                const tt = await searchTikTokStyle(query, 6);
                images = images.concat(tt);
            }

            // unique, max 6
            images = [...new Set(images)].slice(0, 6);

            if (!images.length) {
                return reply("❌ No images found. Try another name/source.");
            }

            await reply(`✅ Found ${images.length} images. Creating stickers...`);

            let success = 0;

            for (const url of images) {
                try {
                    const res = await axios.get(url, {
                        responseType: "arraybuffer",
                        timeout: 25000,
                        headers: {
                            "User-Agent":
                                "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
                            Referer: "https://www.pinterest.com/"
                        }
                    });

                    const buffer = Buffer.from(res.data);
                    if (buffer.length < 1500) continue;

                    const sticker = await imageToSticker(buffer);
                    await sock.sendMessage(from, { sticker });
                    success++;
                    await new Promise((r) => setTimeout(r, 1500));
                } catch (err) {
                    console.log("STICKERPACK item error:", err.message);
                }
            }

            return reply(
`╭━━〔 🖼️ VENOM X STICKER PACK 〕━━⬣

✅ Created: ${success} stickers
🏷️ Pack: VENOM X
🔎 Query: ${query}
🌐 Source: ${source}

Long-press sticker → Add to sticker pack

╰━━━━━━━━━━━━━━━━⬣`
            );
        } catch (err) {
            console.log("STICKERPACK ERROR:", err);
            return reply(`❌ Failed: ${err.message}`);
        }
    }
};

async function searchPinterest(query, limit = 6) {
    const results = [];
    const q = encodeURIComponent(`${query} sticker`);

    try {
        const url = `https://www.pinterest.com/resource/BaseSearchResource/get/?source_url=%2Fsearch%2Fpins%2F%3Fq%3D\( {q}%26rs%3Dtyped&data=%7B%22options%22%3A%7B%22query%22%3A%22 \){q}%22%2C%22scope%22%3A%22pins%22%7D%2C%22context%22%3A%7B%7D%7D`;

        const res = await axios.get(url, {
            timeout: 20000,
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
                "X-Requested-With": "XMLHttpRequest",
                Accept: "application/json, text/javascript, */*, q=0.01",
                Referer: `https://www.pinterest.com/search/pins/?q=${q}`
            }
        });

        const pins =
            res.data?.resource_response?.data?.results ||
            res.data?.resource_response?.data?.pins ||
            [];

        for (const pin of pins) {
            const img =
                pin?.images?.orig?.url ||
                pin?.images?.["736x"]?.url ||
                pin?.images?.["474x"]?.url ||
                pin?.image_large_url ||
                null;

            if (img && /pinimg\.com|pinterest/i.test(img)) {
                results.push(img);
            }
            if (results.length >= limit) break;
        }
    } catch (err) {
        console.log("Pinterest search error:", err.message);
    }

    // HTML fallback
    if (!results.length) {
        try {
            const page = await axios.get(
                `https://www.pinterest.com/search/pins/?q=${q}`,
                {
                    timeout: 20000,
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
                    }
                }
            );

            const html = String(page.data || "");
            const matches = html.match(/https:\/\/i\.pinimg\.com\/[^"'\s]+/g) || [];
            for (const m of matches) {
                const clean = m.replace(/\\u002F/g, "/").replace(/\\/g, "");
                if (!results.includes(clean)) results.push(clean);
                if (results.length >= limit) break;
            }
        } catch (err) {
            console.log("Pinterest HTML fallback error:", err.message);
        }
    }

    return results.slice(0, limit);
}

// Best-effort "TikTok style" image source (public search style)
async function searchTikTokStyle(query, limit = 6) {
    const results = [];
    try {
        // Use DuckDuckGo image-like endpoint style search as practical fallback
        // (TikTok does not provide a free public sticker image API)
        const q = encodeURIComponent(`${query} tiktok sticker png`);
        const res = await axios.get(
            `https://duckduckgo.com/?q=${q}&iax=images&ia=images`,
            {
                timeout: 20000,
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36"
                }
            }
        );

        const html = String(res.data || "");
        const matches = html.match(/https?:\/\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi) || [];
        for (const m of matches) {
            if (/facebook|sprite|logo|icon/i.test(m)) continue;
            if (!results.includes(m)) results.push(m);
            if (results.length >= limit) break;
        }
    } catch (err) {
        console.log("TikTok-style search error:", err.message);
    }
    return results.slice(0, limit);
}
