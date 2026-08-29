const imageHistory = require("../lib/imageHistory");
const { generateImage } = require("../lib/imagineEngine");
const imageQueue = require("../lib/imageQueue");

module.exports = {
    run: async ({ sock, from, args, reply }) => {

        if (!args.length) {
            return reply(
`╭━━〔 🎨 VENOM AI IMAGINE 〕━━⬣

Usage:
.imagine <prompt>

Modes:
.imagine hd <prompt>
.imagine anime <prompt>
.imagine realistic <prompt>
.imagine cinematic <prompt>
.imagine 3d <prompt>
.imagine cyberpunk <prompt>

Example:
.imagine hd Lamborghini in a neon city

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        let hd = false;
        let style = "";

        const styles = {
            anime: "anime",
            realistic: "realistic photography",
            cinematic: "cinematic movie scene",
            "3d": "3D render",
            cyberpunk: "cyberpunk futuristic"
        };

        let promptArgs = [...args];
if (promptArgs[0]?.toLowerCase() === "history") {

    const history = imageHistory.get(from);

    if (!history.length) {
        return reply("🎨 No image history found.");
    }

    let text =
`╭━━〔 🎨 VENOM AI HISTORY 〕━━⬣

`;

    history.forEach((item, i) => {
        text += `${i + 1}. ${item.prompt}\n`;

        if (item.style) {
            text += `🎭 ${item.style}\n`;
        }

        if (item.hd) {
            text += "⚡ HD\n";
        }

        text += "\n";
    });

    text +=
`╰━━━━━━━━━━━━━━━━⬣`;

    return reply(text);
}

        if (promptArgs[0].toLowerCase() === "hd") {
            hd = true;
            promptArgs.shift();
        }

        if (styles[promptArgs[0]?.toLowerCase()]) {
            style = styles[promptArgs[0].toLowerCase()];
            promptArgs.shift();
        }

        const prompt = promptArgs.join(" ").trim();

        if (!prompt) {
            return reply("❌ Please enter an image prompt.");
        }
        const cooldown = imageQueue.isCooldown(from);

if (cooldown) {
    return reply(
`⏳ Please wait ${Math.ceil(cooldown / 1000)} seconds before creating another image.`
    );
}

        if (imageQueue.has(from)) {
            return reply(
                "⏳ You already have an image generating. Please wait."
            );
        }

        try {

            imageQueue.add(from);
	    imageQueue.setCooldown(from);

            await reply(
`🎨 VENOM AI IMAGE

📝 Prompt:
${prompt}

${style ? "🎭 Style: " + style : ""}
${hd ? "⚡ HD Mode: ON" : ""}

⏳ Generating...`
            );

            const image = await generateImage(prompt, {
                style,
                hd
            });

            await sock.sendMessage(from, {
                image,
                caption:
`╭━━〔 🎨 VENOM AI 〕━━⬣

📝 ${prompt}

${style ? "🎭 " + style : ""}
${hd ? "⚡ HD Generated" : "✨ Generated"}

⚡ Powered by VENOM X

╰━━━━━━━━━━━━━━━━⬣`
            });
imageHistory.add(from, {
    prompt,
    style,
    hd,
    time: new Date().toISOString()
});

        } catch (err) {

            console.log("IMAGINE ERROR:", err.message);

            await reply(
`❌ VENOM AI failed:

${err.message}`
            );

        } finally {

            imageQueue.remove(from);

        }

    }
};
