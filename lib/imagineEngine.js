const Replicate = require("replicate");
const axios = require("axios");
const settings = require("../settings.json");

const replicate = new Replicate({
    auth: settings.replicateApiToken || ""
});

function buildPrompt(prompt, options = {}) {
    let finalPrompt = prompt.trim();

    // Apply style if provided
    if (options.style) {
        finalPrompt = `${options.style} style, ${finalPrompt}`;
    }

    // Strong subject lock + quality boost
    const quality = [
        "photorealistic",
        "ultra realistic",
        "highly detailed",
        "sharp focus",
        "8k resolution",
        "professional photography",
        "cinematic lighting",
        "realistic textures",
        "masterpiece"
    ];

    if (options.hd) {
        quality.push(
            "intricate details",
            "ray tracing",
            "perfect reflections",
            "studio quality"
        );
    }

    // Force the model to respect the main subject
    finalPrompt = `A highly detailed photorealistic image of ${finalPrompt}, ${quality.join(", ")}`;

    // Negative guidance (helps reduce random faces / wrong subjects)
    finalPrompt += ", no text, no watermark, no logo, no surreal elements, no abstract art";

    return finalPrompt;
}

async function generateWithReplicate(prompt, options = {}) {
    if (!settings.replicateApiToken) {
        throw new Error("No Replicate token");
    }

    const finalPrompt = buildPrompt(prompt, options);

    const output = await replicate.run(
        "black-forest-labs/flux-schnell",
        {
            input: {
                prompt: finalPrompt,
                num_outputs: 1,
                aspect_ratio: "1:1",
                output_format: "png",
                output_quality: 90
            }
        }
    );

    const imageUrl = Array.isArray(output) ? output[0] : output;

    if (!imageUrl) {
        throw new Error("No image from Replicate");
    }

    const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 60000
    });

    return Buffer.from(response.data);
}

async function generateWithPollinations(prompt, options = {}) {
    const finalPrompt = buildPrompt(prompt, options);
    const encoded = encodeURIComponent(finalPrompt);

    const url = `https://image.pollinations.ai/prompt/\( {encoded}?model=flux&width=1280&height=1280&nologo=true&enhance=true&seed= \){Date.now()}`;

    const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 90000,
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
    });

    if (!response.data || response.data.length < 3000) {
        throw new Error("Empty image from Pollinations");
    }

    return Buffer.from(response.data);
}

async function generateImage(prompt, options = {}) {
    // Try Replicate first
    try {
        console.log("🎨 Trying Replicate...");
        return await generateWithReplicate(prompt, options);
    } catch (err) {
        console.log("⚠️ Replicate failed:", err.message);
        console.log("🔄 Falling back to Pollinations...");
    }

    // Fallback to Pollinations
    try {
        return await generateWithPollinations(prompt, options);
    } catch (err) {
        console.log("IMAGE ENGINE ERROR:", err.message);
        throw new Error("Image generation failed on both engines.");
    }
}

module.exports = {
    generateImage
};
