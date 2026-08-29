const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { exec } = require("child_process");
const { promisify } = require("util");
const webp = require("node-webpmux");

const execAsync = promisify(exec);

const PACK_NAME = "VENOM X";
const AUTHOR_NAME = "⸸𝕍ΞȠØ𝕄⸸";

function tmp(ext) {
    return path.join(
        os.tmpdir(),
        `venom_${crypto.randomBytes(6).toString("hex")}.${ext}`
    );
}

async function run(command) {
    await execAsync(command);
}

async function addExif(webpBuffer) {
    const img = new webp.Image();

    const json = {
        "sticker-pack-id": crypto.randomBytes(16).toString("hex"),
        "sticker-pack-name": PACK_NAME,
        "sticker-pack-publisher": AUTHOR_NAME,
        "emojis": ["🔥"]
    };

    const exifAttr = Buffer.from([
        0x49, 0x49, 0x2A, 0x00,
        0x08, 0x00, 0x00, 0x00,
        0x01, 0x00,
        0x41, 0x57,
        0x07, 0x00,
        0x00, 0x00,
        0x00, 0x00,
        0x16, 0x00,
        0x00, 0x00
    ]);

    const jsonBuffer = Buffer.from(
        JSON.stringify(json),
        "utf8"
    );

    const exif = Buffer.concat([
        exifAttr,
        jsonBuffer
    ]);

    // IMPORTANT:
    // WhatsApp expects the JSON length at byte 14.
    exif.writeUIntLE(
        jsonBuffer.length,
        14,
        4
    );

    await img.load(webpBuffer);

    img.exif = exif;

    return await img.save(null);
}

async function imageToSticker(buffer) {
    const input = tmp("jpg");
    const output = tmp("webp");

    try {
        fs.writeFileSync(input, buffer);

        await run(
`ffmpeg -y -i "${input}" \
-vf "scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0.0,format=rgba" \
-c:v libwebp \
-lossless 0 \
-q:v 80 \
-preset picture \
-an \
-vsync 0 \
"${output}"`
        );

        const webpBuffer = fs.readFileSync(output);

        return await addExif(webpBuffer);

    } finally {
        try {
            fs.unlinkSync(input);
        } catch {}

        try {
            fs.unlinkSync(output);
        } catch {}
    }
}

async function videoToSticker(buffer) {
    const input = tmp("mp4");
    const output = tmp("webp");

    try {
        fs.writeFileSync(input, buffer);

        await run(
`ffmpeg -y -i "${input}" \
-t 10 \
-vf "fps=15,scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0.0,format=rgba" \
-loop 0 \
-an \
-vsync 0 \
-c:v libwebp \
-lossless 0 \
-q:v 70 \
-preset picture \
"${output}"`
        );

        const webpBuffer = fs.readFileSync(output);

        return await addExif(webpBuffer);

    } finally {
        try {
            fs.unlinkSync(input);
        } catch {}

        try {
            fs.unlinkSync(output);
        } catch {}
    }
}

module.exports = {
    imageToSticker,
    videoToSticker
};
