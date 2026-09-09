/**
 * VENOM X - Advanced Image Fetch System
 * Better accuracy for real people + anime characters
 */

const axios = require("axios");

async function downloadBuffer(url, referer = "") {
    const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 45000,
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            "Referer": referer || "https://www.google.com/"
        },
        maxRedirects: 5,
        validateStatus: s => s >= 200 && s < 400
    });

    const buf = Buffer.from(res.data);
    if (!buf || buf.length < 1500) throw new Error("Image too small or empty");
    return buf;
}

// ========== SOURCES ==========

// 1. Pollinations (Flux model - currently best public one)
async function fromPollinations(prompt, width = 768, height = 1024) {
    const seed = Date.now() + Math.floor(Math.random() * 100000);
    const encoded = encodeURIComponent(prompt);
    const url = `https://image.pollinations.ai/prompt/\( {encoded}?width= \){width}&height=\( {height}&nologo=true&seed= \){seed}&model=flux&enhance=true`;
    return downloadBuffer(url, "https://pollinations.ai/");
}

// 2. Nekobot
async function fromNekobot(type = "neko") {
    const res = await axios.get(`https://nekobot.xyz/api/image?type=${encodeURIComponent(type)}`, {
        timeout: 20000,
        headers: { "User-Agent": "VENOM-X" }
    });
    if (!res.data?.message) throw new Error("Nekobot empty");
    return downloadBuffer(res.data.message);
}

// 3. Waifu.im (good for anime)
async function fromWaifuIm(type = "waifu") {
    const res = await axios.get(`https://api.waifu.im/search?included_tags=${type}&is_nsfw=false`, {
        timeout: 15000,
        headers: { "User-Agent": "VENOM-X" }
    });
    const url = res.data?.images?.[0]?.url;
    if (!url) throw new Error("waifu.im empty");
    return downloadBuffer(url);
}

// 4. Dog API
async function fromDog() {
    const res = await axios.get("https://dog.ceo/api/breeds/image/random", {
        timeout: 15000
    });
    if (!res.data?.message) throw new Error("Dog API empty");
    return downloadBuffer(res.data.message);
}

// ========== MAIN FUNCTION ==========

async function getImageBuffer(options = {}) {
    const errors = [];

    // Dog special case
    if (options.dog) {
        return fromDog();
    }

    const prompt = options.prompt || "anime girl";
    const isAnime = options.anime || /anime|waifu|neko|itadori|hentai|moe|shinobu|megumin/i.test(prompt);
    const isRealPerson = options.real || /ronaldo|elon|musk|trump|biden|zuck|rock|rihanna|taylor|cruise|holland|bieber|gates|khalifa|sins/i.test(prompt);

    // ===== REAL PEOPLE =====
    if (isRealPerson) {
        // Stronger prompt for real people
        const realPrompt = `${prompt}, ultra realistic photograph, detailed face, sharp focus, 8k, photorealistic, real person`;
        try {
            return await fromPollinations(realPrompt, 768, 1024);
        } catch (e) {
            errors.push("pollinations-real: " + e.message);
        }
    }

    // ===== ANIME CHARACTERS =====
    if (isAnime) {
        // Try waifu.im first for general anime
        if (!/itadori|specific/i.test(prompt)) {
            try {
                return await fromWaifuIm("waifu");
            } catch (e) {
                errors.push("waifu.im: " + e.message);
            }
        }

        // Strong anime prompt
        const animePrompt = `${prompt}, official anime art style, highly detailed, beautiful, accurate character design`;
        try {
            return await fromPollinations(animePrompt, 768, 1024);
        } catch (e) {
            errors.push("pollinations-anime: " + e.message);
        }

        // Nekobot fallback
        try {
            return await fromNekobot(options.nekoType || "neko");
        } catch (e) {
            errors.push("nekobot: " + e.message);
        }
    }

    // ===== GENERAL / FALLBACK =====
    try {
        return await fromPollinations(prompt + ", high quality, detailed", 768, 1024);
    } catch (e) {
        errors.push("pollinations-general: " + e.message);
    }

    try {
        return await fromNekobot("neko");
    } catch (e) {
        errors.push("nekobot-final: " + e.message);
    }

    throw new Error(errors.join(" | ") || "All image sources failed");
}

module.exports = {
    getImageBuffer,
    downloadBuffer
};
