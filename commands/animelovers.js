const path = require("path");
delete require.cache[require.resolve("../lib/imageFetch")];
const { getImageBuffer } = require("../lib/imageFetch");

const TAGS = [
    "chiho","doraemon","elaina","emilia","erza","exo","femdom","freefire","gamewallpaper",
    "glasses","gremory","hacker","cosplay","cyber","akiyama","ana","art","asuna","ayuzawa",
    "boruto","bts","cecan","deidara","hestia","husbu","inori","islamic","isuzu","itachi",
    "itori","jennie","jiso","justina","kaga","kagura","kakashi","kaori","keneki","kotori",
    "kurumi","loli","madara","megumin","mikasa","miku","minato","mountain","naruto",
    "nekonime","nezuko","onepiece","programming","randblackpink","rize","rose","ryujin",
    "sakura","sasuke","sagiri","satanic","space","technology","tsunade","wallhp",
    "wallml","wallmlnime","yotsuba","yuki","yulibocil","yumeko","animecharacters","animesearch"
];

module.exports = {
    name: "animelovers",
    aliases: TAGS,

    run: async function ({ sock, from, commandName, args, reply, message }) {
        const cmd = String(commandName || "animelovers").toLowerCase();
        let tag = cmd;
        if (cmd === "animelovers" || cmd === "animecharacters" || cmd === "animesearch") {
            tag = args.join(" ").trim() || "anime waifu";
        }

        await reply("🖼️ Loading " + tag + "...");

        try {
            const buf = await getImageBuffer({
                prompt: tag + " anime character",
                nekoType: "neko"
            });

            await sock.sendMessage(from, {
                image: buf,
                caption: "🔥 " + tag + "\n⚡ VENOM X"
            }, { quoted: message });
        } catch (err) {
            return reply("❌ Failed:\n" + err.message);
        }
    }
};
