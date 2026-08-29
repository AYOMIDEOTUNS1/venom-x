const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { exec } = require("child_process");
const { promisify } = require("util");
const webp = require("node-webpmux");
const stickerCollector = require("../lib/stickerCollector");

const execAsync = promisify(exec);

const PACK_NAME = "VENOM X";
const AUTHOR_NAME = "⸸𝕍ΞȠØ𝕄⸸";

function tmpDir() {
    return path.join(os.tmpdir(), `venom_pack_${crypto.randomBytes(6).toString("hex")}`);
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

    const jsonBuffer = Buffer.from(JSON.stringify(json), "utf8");
    const exif = Buffer.concat([exifAttr, jsonBuffer]);
    exif.writeUIntLE(jsonBuffer.length, 14, 4);

    await img.load(webpBuffer);
    img.exif = exif;
    return await img.save(null);
}

function cleanup(dir) {
    try {
        if (fs.existsSync(dir)) {
            for (const file of fs.readdirSync(dir)) {
                fs.unlinkSync(path.join(dir, file));
            }
            fs.rmdirSync(dir);
        }
    } catch {}
}

module.exports = {
    name: "takeall",
    aliases: ["stealall", "packall"],

    run: async ({ sock, from, reply }) => {
        const stickers = stickerCollector.getStickers(from);

        if (!stickers.length) {
            return reply(
`╭━━〔 🖼️ VENOM X TAKEALL 〕━━⬣

No stickers collected yet in this chat.

Send stickers first, then use:
#takeall

Max: 30 stickers

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        if (stickers.length < 3) {
            return reply(
`╭━━〔 🖼️ VENOM X TAKEALL 〕━━⬣

Need at least 3 stickers to make a pack.

Collected now: ${stickers.length}/30

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        await reply(`📦 Creating VENOM sticker pack (${stickers.length} stickers)...`);

        const dir = tmpDir();
        const zipPath = path.join(os.tmpdir(), `VENOM_X_Pack_${Date.now()}.zip`);

        try {
            fs.mkdirSync(dir, { recursive: true });

            // Brand each sticker and save
            let index = 1;
            for (const buffer of stickers) {
                try {
                    const branded = await addExif(buffer);
                    const fileName = `sticker_${String(index).padStart(2, "0")}.webp`;
                    fs.writeFileSync(path.join(dir, fileName), branded);
                    index++;
                } catch (err) {
                    console.log("TAKEALL brand error:", err.message);
                }
            }

            const packed = index - 1;
            if (packed < 3) {
                cleanup(dir);
                return reply("❌ Not enough valid stickers to create a pack.");
            }

            // Pack metadata
            fs.writeFileSync(path.join(dir, "title.txt"), PACK_NAME);
            fs.writeFileSync(path.join(dir, "author.txt"), AUTHOR_NAME);

            // Create ZIP (FIXED)
            await execAsync(`cd "\( {dir}" && zip -r " \){zipPath}" .`);

            if (!fs.existsSync(zipPath)) {
                throw new Error("Failed to create ZIP file");
            }

            const zipBuffer = fs.readFileSync(zipPath);

            await sock.sendMessage(from, {
                document: zipBuffer,
                mimetype: "application/zip",
                fileName: `VENOM_X_StickerPack_${packed}.zip`,
                caption:
`╭━━〔 📦 VENOM X STICKER PACK 〕━━⬣

✅ Pack created successfully
📊 Stickers: ${packed}
🏷️ Name: ${PACK_NAME}
✍️ Author: ${AUTHOR_NAME}

📥 How to use:
1. Download this ZIP
2. Open with Sticker Maker / WAStickerApps
3. Add to WhatsApp

╰━━━━━━━━━━━━━━━━⬣`
            });

            // Clear collection so it won't repeat the same stickers
            stickerCollector.clearStickers(from);

            return reply(`✅ Pack sent (${packed} stickers).`);

        } catch (err) {
            console.log("TAKEALL PACK ERROR:", err);
            return reply(`❌ Failed to create pack:\n${err.message}`);
        } finally {
            cleanup(dir);
            try { fs.unlinkSync(zipPath); } catch {}
        }
    }
};
