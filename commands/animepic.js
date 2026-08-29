const axios = require("axios");

const NSFW_MAP = {
    ass: ["hass", "ass"],
    boobs: ["boobs", "hboobs"],
    boob: ["boobs", "hboobs"],
    hentai: ["hentai"],
    pussy: ["pussy"],
    thigh: ["thigh"],
    thighs: ["thigh"],
    anal: ["anal", "hanal"],
    blowjob: ["blowjob"],
    waifu: ["waifu", "neko"],
    neko: ["neko", "hneko"],
    ahegao: ["ahegao"],
    tentacle: ["tentacle"],
    paizuri: ["paizuri"]
};

async function fromNekobot(type) {
    const res = await axios.get(
        "https://nekobot.xyz/api/image?type=" + encodeURIComponent(type),
        {
            timeout: 20000,
            headers: { "User-Agent": "VENOM-X" }
        }
    );
    if (!res.data || res.data.success === false || !res.data.message) {
        throw new Error("nekobot failed for " + type);
    }
    return res.data.message;
}

function fromPollinations(prompt) {
    const seed = Date.now() + Math.floor(Math.random() * 99999);
    const p = encodeURIComponent(prompt + ", anime style, high quality, detailed");
    return (
        "https://image.pollinations.ai/prompt/" +
        p +
        "?width=768&height=1024&nologo=true&seed=" +
        seed +
        "&model=flux"
    );
}

async function resolveImage(cmd) {
    const tags = NSFW_MAP[cmd];

    if (tags) {
        for (let i = 0; i < tags.length; i++) {
            try {
                return await fromNekobot(tags[i]);
            } catch (e) {
                console.log("nekobot fail:", tags[i], e.message);
            }
        }
        return fromPollinations("nsfw anime " + cmd + " girl, detailed");
    }

    // default
    try {
        return await fromNekobot("neko");
    } catch (e) {
        return fromPollinations("beautiful anime waifu girl");
    }
}

module.exports = {
    name: "animepic",
    aliases: Object.keys(NSFW_MAP),

    run: async function ({ sock, from, commandName, args, reply, message }) {
        let cmd = String(commandName || "").toLowerCase();

        if (cmd === "animepic") {
            cmd = String(args[0] || "waifu").toLowerCase();
        }

        await reply("🎨 Generating...");

        try {
            const url = await resolveImage(cmd);

            await sock.sendMessage(
                from,
                {
                    image: { url: url },
                    caption:
                        "╭━━〔 ✨ VENOM X 〕━━⬣\n\n" +
                        "🎭 " + cmd.toUpperCase() + "\n" +
                        "⚡ Powered by VENOM X\n\n" +
                        "╰━━━━━━━━━━━━━━━━⬣"
                },
                { quoted: message }
            );
        } catch (err) {
            console.log("ANIMEPIC ERROR:", err.message);
            return reply("❌ Failed to generate image.\n" + err.message);
        }
    }
};
