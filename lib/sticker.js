"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);

let sharp = null;
try {
    sharp = require("sharp");
} catch (e) {}

function tmp(ext) {
    return path.join(
        os.tmpdir(),
        "venom_" + crypto.randomBytes(6).toString("hex") + "." + ext
    );
}

function resolveFfmpeg() {
    const candidates = [
        process.env.FFMPEG_PATH,
        "ffmpeg",
        "/usr/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        "/data/data/com.termux/files/usr/bin/ffmpeg"
    ].filter(Boolean);

    for (let i = 0; i < candidates.length; i++) {
        const p = candidates[i];
        try {
            if (p === "ffmpeg") return "ffmpeg";
            if (fs.existsSync(p)) return p;
        } catch (e) {}
    }
    return null;
}

async function imageToSticker(buffer) {
    if (!buffer || !buffer.length) throw new Error("Empty image buffer");

    // Prefer sharp (works on Botkeep without ffmpeg)
    if (sharp) {
        return sharp(buffer)
            .rotate()
            .resize(512, 512, {
                fit: "contain",
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .webp({ quality: 80 })
            .toBuffer();
    }

    // Fallback: ffmpeg
    const ffmpeg = resolveFfmpeg();
    if (!ffmpeg) {
        throw new Error(
            "No sharp and no ffmpeg. Run: npm i sharp  OR install ffmpeg"
        );
    }

    const input = tmp("jpg");
    const output = tmp("webp");
    fs.writeFileSync(input, buffer);

    try {
        await execFileAsync(
            ffmpeg,
            [
                "-y",
                "-i",
                input,
                "-vf",
                "scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0.0,format=rgba",
                "-c:v",
                "libwebp",
                "-lossless",
                "0",
                "-q:v",
                "80",
                "-preset",
                "picture",
                "-an",
                "-vsync",
                "0",
                output
            ],
            { timeout: 60000 }
        );
        return fs.readFileSync(output);
    } finally {
        try { fs.unlinkSync(input); } catch (e) {}
        try { fs.unlinkSync(output); } catch (e) {}
    }
}

async function videoToSticker(buffer) {
    if (!buffer || !buffer.length) throw new Error("Empty video buffer");

    const ffmpeg = resolveFfmpeg();
    if (!ffmpeg) {
        throw new Error(
            "ffmpeg not found — video stickers need ffmpeg on the server"
        );
    }

    const input = tmp("mp4");
    const output = tmp("webp");
    fs.writeFileSync(input, buffer);

    try {
        await execFileAsync(
            ffmpeg,
            [
                "-y",
                "-i",
                input,
                "-vf",
                "scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0.0,fps=15,format=rgba",
                "-c:v",
                "libwebp",
                "-lossless",
                "0",
                "-q:v",
                "70",
                "-loop",
                "0",
                "-an",
                "-t",
                "6",
                output
            ],
            { timeout: 120000 }
        );
        return fs.readFileSync(output);
    } finally {
        try { fs.unlinkSync(input); } catch (e) {}
        try { fs.unlinkSync(output); } catch (e) {}
    }
}

module.exports = {
    imageToSticker,
    videoToSticker,
    resolveFfmpeg
};
