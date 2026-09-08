const fs = require("fs");
const path = require("path");

const SETTINGS_FILE = path.join(__dirname, "..", "settings.json");
const menuImageDir = path.join(__dirname, "../media/menu");

let menuImages = [];

function getSettings() {
    try {
        return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
    } catch (e) {
        return {};
    }
}

function loadMenuImages() {
    try {
        if (!fs.existsSync(menuImageDir)) {
            menuImages = [];
            return;
        }
        menuImages = fs
            .readdirSync(menuImageDir)
            .filter(function (file) {
                return /\.(jpg|jpeg|png|webp)$/i.test(file);
            })
            .map(function (file) {
                return path.join(menuImageDir, file);
            });
    } catch (error) {
        menuImages = [];
    }
}

loadMenuImages();

function pickRandomImage() {
    if (!menuImages.length) loadMenuImages();
    if (!menuImages.length) return null;
    return menuImages[Math.floor(Math.random() * menuImages.length)];
}

function getTimeInfo() {
    const now = new Date();
    const time = new Intl.DateTimeFormat("en-NG", {
        timeZone: "Africa/Lagos",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
    }).format(now);
    const day = new Intl.DateTimeFormat("en-NG", {
        timeZone: "Africa/Lagos",
        weekday: "long"
    }).format(now);
    const date = new Intl.DateTimeFormat("en-NG", {
        timeZone: "Africa/Lagos",
        day: "2-digit",
        month: "long",
        year: "numeric"
    }).format(now);
    const hour = Number(
        new Intl.DateTimeFormat("en-NG", {
            timeZone: "Africa/Lagos",
            hour: "numeric",
            hour12: false
        }).format(now)
    );
    let greeting = "Good night";
    if (hour >= 5 && hour < 12) greeting = "Good morning";
    else if (hour >= 12 && hour < 17) greeting = "Good afternoon";
    else if (hour >= 17 && hour < 22) greeting = "Good evening";
    return { time, day, date, greeting };
}

function cleanName(name) {
    return String(name || "").replace(/\.js$/i, "").trim().toLowerCase();
}

function getCommandRegistry(sock) {
    const registry = typeof sock.getCommands === "function" ? sock.getCommands() : null;
    if (registry instanceof Map && registry.size) return registry;
    const fallback = new Map();
    try {
        const folder = path.join(__dirname);
        const files = fs.readdirSync(folder).filter(f => f.endsWith(".js") && f !== "menu.js");
        for (const file of files) {
            try {
                const fullPath = path.join(folder, file);
                delete require.cache[require.resolve(fullPath)];
                const command = require(fullPath);
                if (command) fallback.set(cleanName(file), command);
            } catch (e) {}
        }
    } catch (e) {}
    return fallback;
}

function buildCommands(registry) {
    const commands = new Map();
    const seen = new Set();
    registry.forEach((command, key) => {
        if (!command || typeof command !== "object") return;
        if (seen.has(command)) return;
        seen.add(command);
        const name = cleanName(command.name || key);
        if (!name) return;
        if (!commands.has(name)) commands.set(name, { name, command });
    });
    return commands;
}

const categories = {
    "🧠 AI": ["ai", "ask", "venomai", "gpt", "vision", "imagine", "reimagine", "translate", "rewrite", "summarize", "code", "fixcode", "explain"],
    "🎨 IMAGE": ["hd", "tohd", "hdify", "sticker", "s", "toimg", "toimage", "cropsticker", "getpp", "stickerpack", "take", "steal", "takeall", "animepic", "meme", "wallpaper", "blur", "wanted", "emojimix", "removebg"],
    "🔞 NSFW": ["xv", "xvphoto", "xvpics", "animepic", "ass", "boobs", "hentai", "waifu", "neko", "pussy"],
    "📥 DOWNLOADS": ["tiktok", "tt", "ytmp3", "ytmp4", "ig", "fb", "play", "spotify", "mediafire", "gitclone", "xv", "vv", "vv2"],
    "🎵 MUSIC": ["play", "song", "lyrics", "shazam", "bass", "ytmp3"],
    "👥 GROUP": ["tagall", "hidetag", "kick", "add", "promote", "demote", "warn", "warnings", "delwarn", "resetwarn", "antilink", "antichannelmessage", "antistatustag", "welcome", "goodbye", "open", "close", "groupinfo", "status2", "setname", "setdesc", "linkgroup", "revoke"],
    "💰 ECONOMY": ["bal", "daily", "weekly", "monthly", "work", "deposit", "withdraw", "pay", "rob", "jail", "bail", "escape", "economy", "bank", "bankupgrade", "market", "aza"],
    "🎮 GAMES": ["coinflip", "slots", "guess", "blackjack", "dice", "rps", "battle", "duel", "accept", "games", "stats", "lb", "glb"],
    "✨ ANIME MENU": ["anime", "manga", "rwaifu", "waifu", "neko", "shinobu", "megumin", "animekill", "animelick", "animebite", "animeglomp", "animehappy", "animedance", "animecringe", "animehighfive", "animepoke", "animewink", "animesmile", "animesmug", "animewlp", "animesearch", "animeavatar", "cry", "kill", "hug", "happy", "dance", "handhold", "highfive", "slap", "kiss", "blush", "bite", "cuddle", "bonk", "pat", "nom", "furbrat"],
    "🔥 ANIME LOVERS": ["animelovers", "animecharacters", "animesearch", "chiho", "doraemon", "elaina", "emilia", "erza", "exo", "femdom", "freefire", "gamewallpaper", "glasses", "gremory", "hacker", "cosplay", "cyber", "akiyama", "ana", "art", "asuna", "ayuzawa", "boruto", "bts", "cecan", "deidara", "hestia", "husbu", "inori", "islamic", "isuzu", "itachi", "itori", "jennie", "jiso", "justina", "kaga", "kagura", "kakashi", "kaori", "keneki", "kotori", "kurumi", "loli", "madara", "megumin", "mikasa", "miku", "minato", "mountain", "naruto", "nekonime", "nezuko", "onepiece", "programming", "randblackpink", "rize", "rose", "ryujin", "sakura", "sasuke", "sagiri", "satanic", "space", "technology", "tsunade", "waifu", "wallhp", "wallml", "wallmlnime", "yotsuba", "yuki", "yulibocil", "yumeko"],
    "😝 FUN MENU": ["fun", "ronaldo", "zuck", "billgates", "elonmusk", "justinbieber", "donaldtrump", "joebiden", "johnnysins", "miakhalifa", "therock", "rihanna", "taylorswift", "tomcruise", "tomholland", "wouldyou", "flirt", "moe", "sfw", "cartoonify", "story", "rate", "ship", "truthdare", "compliment", "roast", "trivia", "joke", "truth", "dare", "meme", "advice", "urban", "moviequote", "triviafact", "inspire", "ascii", "progquote", "dadjoke", "prog", "quotememe", "funfact", "panda", "bird", "koala", "fox", "dog", "fact", "paptt", "chinagirl", "bluearchive", "boypic", "carimage", "random-girl", "hijab-girl", "indonesia-girl", "japan-girl", "korean-girl", "malaysia-girl", "profile-pictures", "thailand-girl", "tiktok-girl", "vietnam-girl", "aipic", "hentai"],
    "⚙️ UTILITY": ["ping", "alive", "menu", "owner", "profile", "vcf", "delete", "info", "save", "vv", "vv2", "sleep", "up", "refresh", "pair", "weather", "calc", "qr", "tts", "short", "poll"],
    "👑 OWNER": ["public", "private", "shutdown", "restart", "backup", "broadcast", "reset", "update", "block", "unblock", "sleep", "up", "refresh", "pair"]
};

function formatCommand(prefix, name) {
    return "┃ " + prefix + name;
}

function buildCategory(title, names, prefix, used) {
    const rows = [];
    for (const n of names) {
        const key = cleanName(n);
        if (used.has(title + ":" + key)) continue;
        used.add(title + ":" + key);
        rows.push(formatCommand(prefix, key));
    }
    if (!rows.length) return "";
    return "╭━━〔 " + title + " 〕━━⬣\n" + rows.join("\n") + "\n╰━━━━━━━━━━━━━━━━⬣";
}

module.exports = {
    name: "menu",
    aliases: ["m", "allmenu"],

    run: async function ({ sock, from, message, args, sender }) {
        const settings = getSettings();
        const prefix = settings.prefix || "#";
        const ownerName = settings.ownerName || "AYOMIDE";
        const botName = settings.botName || "VENOM X";
        const mode = String(settings.mode || "public").toUpperCase();
        const timeInfo = getTimeInfo();
        const registry = getCommandRegistry(sock);
        const commands = buildCommands(registry);
        const totalCommands = commands.size;

        const arg = (args[0] || "").toLowerCase();

        // ==================== SMALL MENU (DEFAULT) ====================
        if (arg !== "all" && arg !== "full") {
            const pushName = message.pushName || "User";

            const smallMenu = 
`╭━━━「 🌀 *${botName}* 🌀 」━━━
┃
┃  👋 Hello, *${pushName}*
┃  ✅ *${botName}* is active & ready.
┃  ⚡ *Commands:* ${totalCommands}+
┃
┃  ◈ *${prefix}menu all*  → All commands
┃  ◈ *${prefix}help*     → Command guide
┃  ◈ *${prefix}ping*     → Response time
┃  ◈ *${prefix}play*     → Music player
┃  ◈ *${prefix}ai*       → AI assistant
┃  ◈ *${prefix}nano*     → AI Image Gen
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━

> _Powered by VENOM X_ ⚡`;

            const selectedImage = pickRandomImage();

            try {
                if (selectedImage && fs.existsSync(selectedImage)) {
                    await sock.sendMessage(from, {
                        image: fs.readFileSync(selectedImage),
                        caption: smallMenu
                    }, { quoted: message });
                } else {
                    await sock.sendMessage(from, { text: smallMenu }, { quoted: message });
                }
            } catch (e) {
                await sock.sendMessage(from, { text: smallMenu }, { quoted: message }).catch(() => {});
            }
            return;
        }

        // ==================== FULL MENU ====================
        const used = new Set();
        const sections = [];

        for (const title of Object.keys(categories)) {
            const section = buildCategory(title, categories[title], prefix, used);
            if (section) sections.push(section);
        }

        const menuText =
`╭━━〔 🤖 ${botName} MENU 〕━━⬣
┃ 👋 ${timeInfo.greeting}, ${ownerName}!
┃
┃ 👑 Owner : ${ownerName}
┃ 🌍 Mode : ${mode}
┃ ⚡ Prefix : ${prefix}
┃ 🤖 Version : ${settings.version || "3.0.0"}
┃ 🚀 Status : ONLINE
┃ 📦 Commands : ${totalCommands}
┃
┃ 🕐 Time : ${timeInfo.time}
┃ 📅 Day : ${timeInfo.day}
┃ 📆 Date : ${timeInfo.date}
╰━━━━━━━━━━━━━━━━⬣

${sections.join("\n\n")}

╭━━〔 📖 HELP 〕━━⬣
┃ 💡 ${prefix}info <command>
┃ 💡 ${prefix}menu
┃ 💡 ${prefix}menu all
╰━━━━━━━━━━━━━━━━⬣

╭━━〔 💀 ${botName} 〕━━⬣
┃ 📦 Total Commands : ${totalCommands}
┃ Powered By VENOM X
╰━━━━━━━━━━━━━━━━⬣`;

        const selectedImage = pickRandomImage();

        try {
            if (selectedImage && fs.existsSync(selectedImage)) {
                await sock.sendMessage(from, {
                    image: fs.readFileSync(selectedImage),
                    caption: menuText
                }, { quoted: message });
            } else {
                await sock.sendMessage(from, { text: menuText }, { quoted: message });
            }
        } catch (error) {
            await sock.sendMessage(from, { text: menuText }, { quoted: message }).catch(() => {});
        }
    }
};
