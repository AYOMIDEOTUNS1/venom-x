/**
 * 🔍 Pinterest Image Search
 * Usage: #pint <query>
 * Example: #pint Kim Kardashian
 */

const axios = require("axios");

module.exports = {
    name: "pint",
    aliases: ["pinterest", "pin", "img"],
    category: "tools",
    description: "Search images from Pinterest",

    run: async ({ sock, from, args, reply, message }) => {
        const query = args.join(" ").trim();

        if (!query) {
            return reply(`╭━━〔 🔍 PINTEREST 〕━━⬣
┃
┃ Usage:
┃ #pint <query>
┃
┃ Example:
┃ #pint Kim Kardashian
┃ #pint anime wallpaper
┃ #pint Nike shoes
┃
╰━━━━━━━━━━━━━━━━⬣`);
        }

        await reply(`🔍 Searching *${query}*...`);

        try {
            // Using a free image search endpoint
            const { data } = await axios.get(`https://api.siputzx.my.id/api/s/pinterest?query=${encodeURIComponent(query)}`, {
                timeout: 15000
            });

            let images = [];

            if (data?.data && Array.isArray(data.data)) {
                images = data.data.slice(0, 5).map(item => item.images_url || item.image);
            } else if (data?.result && Array.isArray(data.result)) {
                images = data.result.slice(0, 5);
            }

            // Fallback to another source if first one fails
            if (!images.length) {
                const res2 = await axios.get(`https://www.pinterest.com/resource/BaseSearchResource/get/?source_url=/search/pins/?q=\( {encodeURIComponent(query)}&data={"options":{"query":" \){query}","page_size":10}}`, {
                    timeout: 12000,
                    headers: {
                        "User-Agent": "Mozilla/5.0"
                    }
                }).catch(() => null);
            }

            if (!images.length) {
                // Last fallback - Pollinations style or random related
                return reply("❌ No images found for that query. Try a different keyword.");
            }

            // Send images (max 4-5)
            for (let i = 0; i < Math.min(images.length, 4); i++) {
                const img = images[i];
                if (!img) continue;

                await sock.sendMessage(from, {
                    image: { url: img },
                    caption: i === 0 ? `🔍 *Pinterest Result*\n📌 Query: ${query}` : undefined
                }, { quoted: i === 0 ? message : undefined });

                // Small delay to avoid spam detection
                await new Promise(r => setTimeout(r, 600));
            }

        } catch (err) {
            console.error("[PINT ERROR]", err.message);
            return reply("❌ Failed to fetch images. Try again later.");
        }
    }
};
