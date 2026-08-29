const axios = require("axios");

// nekos.life reaction endpoints
const NEKOS_LIFE = {
    slap: "slap",
    hug: "hug",
    kiss: "kiss",
    pat: "pat",
    cuddle: "cuddle",
    cry: "cry",
    dance: "dance",
    wink: "wink",
    blush: "blush",
    bite: "bite",
    bonk: "bonk",
    happy: "happy",
    highfive: "highfive",
    handhold: "handhold",
    kill: "kill",
    nom: "nom",
    poke: "poke",
    animepoke: "poke",
    animekill: "kill",
    animedance: "dance",
    animewink: "wink",
    animesmile: "smile",
    animebite: "bite",
    animehappy: "happy",
    animelick: "lick",
    animeglomp: "glomp",
    animecringe: "cringe",
    animehighfive: "highfive",
    animesmug: "smug",
    lick: "lick",
    smug: "smug",
    smile: "smile",
    glomp: "glomp",
    cringe: "cringe"
};

const PROMPT = {
    waifu: "beautiful anime waifu girl",
    rwaifu: "beautiful anime waifu girl",
    neko: "anime neko girl cat ears",
    shinobu: "shinobu kocho anime",
    megumin: "megumin konosuba",
    animewlp: "anime wallpaper girl",
    animeavatar: "anime avatar girl"
};

function pollinations(prompt) {
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

async function fromNekosLife(type) {
    const res = await axios.get("https://nekos.life/api/v2/img/" + type, {
        timeout: 15000,
        headers: { "User-Agent": "VENOM-X" }
    });
    if (!res.data || !res.data.url) throw new Error("nekos.life empty");
    return res.data.url;
}

async function fromNekobot(type) {
    const res = await axios.get(
        "https://nekobot.xyz/api/image?type=" + encodeURIComponent(type),
        { timeout: 20000, headers: { "User-Agent": "VENOM-X" } }
    );
    if (!res.data || !res.data.message) throw new Error("nekobot empty");
    return res.data.message;
}

async function resolveUrl(cmd) {
    // 1) reaction gif/image
    if (NEKOS_LIFE[cmd]) {
        try {
            return await fromNekosLife(NEKOS_LIFE[cmd]);
        } catch (e) {
            console.log("nekos.life fail:", cmd, e.message);
        }
    }

    // 2) nekobot for waifu/neko style
    if (cmd === "waifu" || cmd === "rwaifu" || cmd === "neko") {
        try {
            return await fromNekobot(cmd === "neko" ? "neko" : "neko");
        } catch (e) {
            console.log("nekobot fail:", e.message);
        }
    }

    // 3) pollinations URL (WhatsApp fetches it)
    const prompt = PROMPT[cmd] || (NEKOS_LIFE[cmd] ? "anime " + NEKOS_LIFE[cmd] : cmd + " anime");
    return pollinations(prompt);
}

module.exports = {
    name: "anime",
    aliases: Object.keys(NEKOS_LIFE).concat(Object.keys(PROMPT)),

    run: async function ({ sock, from, commandName, reply, message }) {
        const cmd = String(commandName || "waifu").toLowerCase();

        await reply("✨ Fetching anime...");

        try {
            const url = await resolveUrl(cmd);

            await sock.sendMessage(
                from,
                {
                    image: { url: url },
                    caption: "✨ " + cmd + "\n⚡ VENOM X"
                },
                { quoted: message }
            );
        } catch (err) {
            return reply("❌ Anime failed:\n" + err.message);
        }
    }
};
