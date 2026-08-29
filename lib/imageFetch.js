const axios = require("axios");

async function downloadBuffer(url) {
    const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 60000,
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
            Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            Referer: "https://image.pollinations.ai/"
        },
        maxRedirects: 5,
        validateStatus: function (s) { return s >= 200 && s < 400; }
    });
    const buf = Buffer.from(res.data);
    if (!buf || buf.length < 1000) throw new Error("tiny/empty image");
    return buf;
}

async function fromNekobot(type) {
    const res = await axios.get(
        "https://nekobot.xyz/api/image?type=" + encodeURIComponent(type || "neko"),
        { timeout: 20000, headers: { "User-Agent": "VENOM-X" } }
    );
    if (!res.data || !res.data.message) throw new Error("nekobot empty");
    return downloadBuffer(res.data.message);
}

async function fromPollinations(prompt) {
    const seed = Date.now() + Math.floor(Math.random() * 99999);
    const p = encodeURIComponent(String(prompt || "anime") + ", anime style, high quality, detailed");
    // simpler URL often more stable
    const url =
        "https://image.pollinations.ai/prompt/" +
        p +
        "?width=512&height=768&nologo=true&seed=" +
        seed;
    return downloadBuffer(url);
}

async function fromDog() {
    const res = await axios.get("https://dog.ceo/api/breeds/image/random", {
        timeout: 15000,
        headers: { "User-Agent": "VENOM-X" }
    });
    if (!res.data || !res.data.message) throw new Error("dog empty");
    return downloadBuffer(res.data.message);
}

async function getImageBuffer(options) {
    options = options || {};
    const errors = [];

    if (options.dog === true) {
        return fromDog();
    }

    // 1) nekobot when type given
    if (options.nekoType) {
        try {
            return await fromNekobot(options.nekoType);
        } catch (e) {
            errors.push("nekobot: " + e.message);
        }
    }

    // 2) pollinations with prompt
    if (options.prompt) {
        try {
            return await fromPollinations(options.prompt);
        } catch (e) {
            errors.push("pollinations: " + e.message);
        }
    }

    // 3) last resort anime-ish from nekobot
    try {
        return await fromNekobot("neko");
    } catch (e) {
        errors.push("nekobot-neko: " + e.message);
    }

    throw new Error(errors.join(" | ") || "image failed");
}

module.exports = {
    getImageBuffer: getImageBuffer,
    downloadBuffer: downloadBuffer
};
