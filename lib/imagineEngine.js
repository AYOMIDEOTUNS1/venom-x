const axios = require("axios");
const { getSettings } = require("./settingsCache");

function stylePrefix(style) {
    const s = String(style || "").toLowerCase();
    const map = {
        hd: "ultra detailed, sharp focus, high resolution, 8k",
        realistic: "photorealistic, natural lighting, detailed skin, DSLR photo",
        anime: "anime style, vibrant colors, clean line art",
        cinematic: "cinematic lighting, dramatic atmosphere, movie still",
        "3d": "3d render, octane render, blender, highly detailed",
        cyberpunk: "cyberpunk, neon lights, futuristic city, night"
    };
    return map[s] || "";
}

function buildPrompt(prompt, options) {
    const style = stylePrefix(options && options.style);
    let final = String(prompt || "").trim();
    if (style) final = style + ", " + final;
    final += ", high quality, detailed";
    return final;
}

async function fromPollinations(prompt) {
    const seed = Date.now() % 1000000;
    const url =
        "https://image.pollinations.ai/prompt/" +
        encodeURIComponent(prompt) +
        "?width=1024&height=1024&nologo=true&seed=" +
        seed;

    const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 90000,
        headers: { "User-Agent": "VENOM-X" }
    });

    const buf = Buffer.from(res.data);
    if (!buf.length || buf.length < 2000) {
        throw new Error("Pollinations returned empty image");
    }
    return buf;
}

async function fromReplicate(prompt, token) {
    const create = await axios.post(
        "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions",
        {
            input: {
                prompt: prompt,
                num_outputs: 1,
                output_format: "jpg"
            }
        },
        {
            timeout: 30000,
            headers: {
                Authorization: "Bearer " + token,
                "Content-Type": "application/json",
                Prefer: "wait"
            }
        }
    );

    let data = create.data;
    const getUrl = data && data.urls && data.urls.get;

    // poll if not finished
    for (let i = 0; i < 30 && data && data.status !== "succeeded"; i++) {
        if (data.status === "failed" || data.status === "canceled") {
            throw new Error((data.error && String(data.error)) || "Replicate failed");
        }
        await new Promise(function (r) {
            setTimeout(r, 2000);
        });
        if (!getUrl) break;
        const poll = await axios.get(getUrl, {
            timeout: 20000,
            headers: { Authorization: "Bearer " + token }
        });
        data = poll.data;
    }

    let out = data && data.output;
    if (Array.isArray(out)) out = out[0];
    if (!out || typeof out !== "string") {
        throw new Error("Replicate returned no image URL");
    }

    const img = await axios.get(out, {
        responseType: "arraybuffer",
        timeout: 60000
    });
    const buf = Buffer.from(img.data);
    if (buf.length < 2000) throw new Error("Replicate image empty");
    return buf;
}

async function generateImage(prompt, options) {
    options = options || {};
    const settings = getSettings();
    const finalPrompt = buildPrompt(prompt, options);

    const replicateToken = String(
        process.env.REPLICATE_API_TOKEN || settings.replicateApiToken || ""
    ).trim();

    // Prefer Replicate if token exists
    if (replicateToken) {
        try {
            console.log("🎨 Trying Replicate...");
            return await fromReplicate(finalPrompt, replicateToken);
        } catch (e) {
            console.log("⚠️ Replicate failed:", e.message);
            console.log("🔄 Falling back to Pollinations...");
        }
    }

    console.log("🎨 Using Pollinations...");
    return await fromPollinations(finalPrompt);
}

module.exports = { generateImage };
