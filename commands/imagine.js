const { generateImage } = require("../lib/imagineEngine");

const STYLES = ["hd", "anime", "realistic", "cinematic", "3d", "cyberpunk"];

module.exports = {
    name: "imagine",
    aliases: ["img", "genimage", "draw"],

    run: async function ({ sock, from, args, reply, message }) {
        if (!args.length) {
            return reply(
`╭━━〔 🎨 VENOM AI IMAGINE 〕━━⬣

Usage:
#imagine <prompt>

Modes:
#imagine hd <prompt>
#imagine anime <prompt>
#imagine realistic <prompt>
#imagine cinematic <prompt>
#imagine 3d <prompt>
#imagine cyberpunk <prompt>

Example:
#imagine hd red Lamborghini in neon city

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        let style = "";
        let promptParts = args.slice();
        const first = String(args[0] || "").toLowerCase();
        if (STYLES.indexOf(first) !== -1) {
            style = first;
            promptParts = args.slice(1);
        }

        const prompt = promptParts.join(" ").trim();
        if (!prompt) {
            return reply("❌ Add a prompt after the mode.\nExample: #imagine hd a cat");
        }

        try {
            await reply(
                "🎨 VENOM AI IMAGE\n\n📝 Prompt:\n" +
                    prompt +
                    (style ? "\n🎭 Style: " + style : "") +
                    "\n\n⏳ Generating..."
            );

            const buffer = await generateImage(prompt, { style: style });

            await sock.sendMessage(
                from,
                {
                    image: buffer,
                    caption:
                        "╭━━〔 🎨 VENOM AI 〕━━⬣\n\n" +
                        "📝 " +
                        prompt +
                        "\n\n✨ Generated\n⚡ Powered by VENOM X\n\n" +
                        "╰━━━━━━━━━━━━━━━━⬣"
                },
                { quoted: message }
            );
        } catch (err) {
            console.log("IMAGINE ERROR:", err.message);
            return reply("❌ Imagine failed:\n" + err.message);
        }
    }
};
