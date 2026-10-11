const webp = require("node-webpmux");
const crypto = require("crypto");

const PACK_NAME = "VENOM X";
const AUTHOR_NAME = "⸸𝕍ΞȠØ𝕄⸸";

async function addExif(webpBuffer, pack, author) {
    const img = new webp.Image();
    const json = {
        "sticker-pack-id": crypto.randomBytes(16).toString("hex"),
        "sticker-pack-name": pack || PACK_NAME,
        "sticker-pack-publisher": author || AUTHOR_NAME,
        emojis: ["🔥"]
    };

    const exifAttr = Buffer.from([
        0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
        0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00
    ]);
    const jsonBuffer = Buffer.from(JSON.stringify(json), "utf8");
    const exif = Buffer.concat([exifAttr, jsonBuffer]);
    exif.writeUIntLE(jsonBuffer.length, 14, 4);

    await img.load(webpBuffer);
    img.exif = exif;
    return await img.save(null);
}

module.exports = {
    PACK_NAME,
    AUTHOR_NAME,
    addExif
};
