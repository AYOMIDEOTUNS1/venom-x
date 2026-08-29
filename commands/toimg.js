const fs = require("fs");
const { exec } = require("child_process");
const { downloadMedia } = require("../lib/media");

module.exports = {
    aliases: ["toimage"],

    run: async ({ sock, from, message, reply }) => {

        const quoted =
            message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted?.stickerMessage) {
            return reply(
`╭━━〔 🖼️ TOIMG 〕━━⬣

Reply to a static sticker.

Example:
.toimg

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        if (quoted.stickerMessage.isAnimated) {
            return reply(
                "❌ Animated stickers can't be converted to a single image."
            );
        }

        await reply("🖼️ Converting sticker...");
        try {

            const { buffer, tmp } = await downloadMedia(quoted);

            const input = tmp("webp");
            const output = tmp("png");

            fs.writeFileSync(input, buffer);
console.log("Saved:", input);
console.log("Buffer size:", buffer.length);

const header = fs.readFileSync(input).slice(0, 16);
console.log("Header:", header.toString("hex"));

            exec(
                `ffmpeg -y -i "${input}" "${output}"`,
                async (err) => {

                    fs.unlinkSync(input);

                    if (err) {
                        console.log("TOIMG ERROR:", err);
                        return reply("❌ Failed to convert sticker.");
                    }

                    await sock.sendMessage(
                        from,
                        {
                            image: fs.readFileSync(output),
                            caption: "✅ Converted from sticker."
                        },
                        {
                            quoted: message
                        }
                    );

                    fs.unlinkSync(output);

                }
            );

        } catch (err) {

            console.log("TOIMG ERROR:", err);

            reply("❌ Failed to convert sticker.");

        }

    }
};
