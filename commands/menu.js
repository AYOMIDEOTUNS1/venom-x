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
        console.log("🖼️ Loaded " + menuImages.length + " menu images");
    } catch (error) {
        console.log("MENU IMAGE ERROR:", error.message);
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
    return { time: time, day: day, date: date, greeting: greeting };
}

async function getWeather() {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(function () { controller.abort(); }, 5000);
        const response = await fetch("https://wttr.in/Osun?format=j1", {
            signal: controller.signal,
            headers: { "User-Agent": "VENOM-X" }
        });
        clearTimeout(timeout);
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = await response.json();
        const current = data && data.current_condition && data.current_condition[0];
        if (!current) throw new Error("no data");
        const description = (current.weatherDesc && current.weatherDesc[0] && current.weatherDesc[0].value) || "Unknown";
        return description + " +" + (current.temp_C || "?") + "°C";
    } catch (e) {
        return "Weather unavailable";
    }
}

function cleanName(name) {
    return String(name || "").replace(/\.js$/i, "").trim().toLowerCase();
}

function getAliases(command) {
    if (!command || !Array.isArray(command.aliases)) return [];
    return command.aliases
        .filter(function (a) { return typeof a === "string"; })
        .map(function (a) { return cleanName(a); })
        .filter(Boolean);
}

function getCommandRegistry(sock) {
    const registry = typeof sock.getCommands === "function" ? sock.getCommands() : null;
    if (registry instanceof Map && registry.size) return registry;
    const fallback = new Map();
    try {
        const folder = path.join(__dirname);
        const files = fs.readdirSync(folder).filter(function (f) {
            return f.slice(-3) === ".js" && f !== "menu.js";
        });
        for (let i = 0; i < files.length; i++) {
            try {
                const fullPath = path.join(folder, files[i]);
                delete require.cache[require.resolve(fullPath)];
                const command = require(fullPath);
                if (!command) continue;
                fallback.set(cleanName(files[i]), command);
            } catch (e) {}
        }
    } catch (e) {}
    return fallback;
}

function buildCommands(registry) {
    const commands = new Map();
    const seen = new Set();
    registry.forEach(function (command, key) {
        if (!command || typeof command !== "object") return;
        if (seen.has(command)) return;
        seen.add(command);
        const name = cleanName(command.name || key);
        if (!name) return;
        if (!commands.has(name)) commands.set(name, { name: name, command: command });
    });
    return commands;
}

const categories = {
    "🧠 AI": [
        "ai", "ask", "venomai", "gpt", "vision", "imagine", "reimagine",
        "translate", "rewrite", "summarize", "code", "fixcode", "explain"
    ],
    "🎨 IMAGE": [
        "hd", "tohd", "hdify", "sticker", "s", "toimg", "toimage", "cropsticker",
        "getpp", "stickerpack", "take", "steal", "takeall", "animepic",
        "meme", "wallpaper", "blur", "wanted", "emojimix", "removebg"
    ],
    "🔞 NSFW": [
        "xv", "xvphoto", "xvpics", "animepic", "ass", "boobs", "hentai", "waifu", "neko", "pussy"
    ],
    "📥 DOWNLOADS": [
        "tiktok", "tt", "ytmp3", "ytmp4", "ig", "fb", "play", "spotify", "mediafire", "gitclone", "xv", "vv", "vv2"
    ],
    "🎵 MUSIC": [
        "play", "song", "lyrics", "shazam", "bass", "ytmp3"
    ],
    "👥 GROUP": [
        "tagall", "hidetag", "kick", "add", "promote", "demote",
        "warn", "warnings", "delwarn", "resetwarn",
        "antilink", "antichannelmessage", "antistatustag",
        "welcome", "goodbye", "open", "close", "groupinfo", "status2",
        "setname", "setdesc", "linkgroup", "revoke"
    ],
    "💰 ECONOMY": [
        "bal", "daily", "weekly", "monthly", "work", "deposit", "withdraw", "pay", "rob",
        "jail", "bail", "escape", "economy", "bank", "bankupgrade", "market", "aza"
    ],
    "🎮 GAMES": [
        "coinflip", "slots", "guess", "blackjack", "dice", "rps",
        "battle", "duel", "accept", "games", "stats", "lb", "glb"
    ],
    "✨ ANIME MENU": [
        "anime", "manga", "rwaifu", "waifu", "neko", "shinobu", "megumin",
        "animekill", "animelick", "animebite", "animeglomp", "animehappy",
        "animedance", "animecringe", "animehighfive", "animepoke", "animewink",
        "animesmile", "animesmug", "animewlp", "animesearch", "animeavatar",
        "cry", "kill", "hug", "happy", "dance", "handhold", "highfive",
        "slap", "kiss", "blush", "bite", "cuddle", "bonk", "pat", "nom", "furbrat"
    ],
    "🔥 ANIME LOVERS": [
        "animelovers", "animecharacters", "animesearch",
        "chiho", "doraemon", "elaina", "emilia", "erza", "exo", "femdom",
        "freefire", "gamewallpaper", "glasses", "gremory", "hacker", "cosplay", "cyber",
        "akiyama", "ana", "art", "asuna", "ayuzawa", "boruto", "bts", "cecan", "deidara",
        "hestia", "husbu", "inori", "islamic", "isuzu", "itachi", "itori",
        "jennie", "jiso", "justina", "kaga", "kagura", "kakashi", "kaori", "keneki",
        "kotori", "kurumi", "loli", "madara", "megumin", "mikasa", "miku", "minato",
        "mountain", "naruto", "nekonime", "nezuko", "onepiece", "programming",
        "randblackpink", "rize", "rose", "ryujin", "sakura", "sasuke", "sagiri",
        "satanic", "space", "technology", "tsunade", "waifu", "wallhp", "wallml",
        "wallmlnime", "yotsuba", "yuki", "yulibocil", "yumeko"
    ],
    "😝 FUN MENU": [
        "fun", "ronaldo", "zuck", "billgates", "elonmusk", "justinbieber",
        "donaldtrump", "joebiden", "johnnysins", "miakhalifa", "therock",
        "rihanna", "taylorswift", "tomcruise", "tomholland",
        "wouldyou", "flirt", "moe", "sfw", "cartoonify", "story", "rate", "ship",
        "truthdare", "compliment", "roast", "trivia", "joke", "truth", "dare",
        "meme", "advice", "urban", "moviequote", "triviafact", "inspire", "ascii",
        "progquote", "dadjoke", "prog", "quotememe", "funfact",
        "panda", "bird", "koala", "fox", "dog", "fact", "paptt",
        "chinagirl", "bluearchive", "boypic", "carimage", "random-girl", "hijab-girl",
        "indonesia-girl", "japan-girl", "korean-girl", "malaysia-girl", "profile-pictures",
        "thailand-girl", "tiktok-girl", "vietnam-girl", "aipic", "hentai"
    ],
    "⚙️ UTILITY": [
        "ping", "alive", "menu", "owner", "profile", "vcf",
        "delete", "info", "save", "vv", "vv2",
        "sleep", "up", "refresh", "pair",
        "weather", "calc", "qr", "tts", "short", "poll"
    ],
    "👑 OWNER": [
        "public", "private", "shutdown", "restart", "backup",
        "broadcast", "reset", "update", "block", "unblock",
        "sleep", "up", "refresh", "pair"
    ]
};

function formatCommand(prefix, name, command) {
    const aliases = getAliases(command).filter(function (a) { return a !== name; });
    if (!aliases.length) return "┃ " + prefix + name;
    return "┃ " + prefix + name + " • " + aliases.slice(0, 4).map(function (a) { return prefix + a; }).join(" / ");
}

function buildCategory(title, names, commands, prefix, used) {
    const rows = [];
    for (let i = 0; i < names.length; i++) {
        const key = cleanName(names[i]);
        // always show listed name once per category (long menu)
        if (used.has(title + ":" + key)) continue;
        used.add(title + ":" + key);
        rows.push("┃ " + prefix + key);
    }
    if (!rows.length) return "";
    return "╭━━〔 " + title + " 〕━━⬣\n" + rows.join("\n") + "\n╰━━━━━━━━━━━━━━━━⬣";
}

function buildOtherCategory(commands, prefix, usedGlobal) {
    const rows = [];
    const used = new Set();
    commands.forEach(function (item, name) {
        if (used.has(name)) return;
        used.add(name);
        rows.push(formatCommand(prefix, name, item.command));
    });
    if (!rows.length) return "";
    return "╭━━〔 📦 OTHER / MORE 〕━━⬣\n" + rows.join("\n") + "\n╰━━━━━━━━━━━━━━━━⬣";
}

module.exports = {
    name: "menu",
    aliases: ["m"],

    run: async function ({ sock, from, message }) {
        const settings = getSettings();
        const prefix = settings.prefix || "#";
        const ownerName = settings.ownerName || "AYOMIDE";
        const mode = String(settings.mode || "public").toUpperCase();
        const timeInfo = getTimeInfo();
        const weather = await getWeather();
        const registry = getCommandRegistry(sock);
        const commands = buildCommands(registry);
        const totalCommands = commands.size;
        const used = new Set();
        const sections = [];

        const titles = Object.keys(categories);
        for (let i = 0; i < titles.length; i++) {
            const section = buildCategory(titles[i], categories[titles[i]], commands, prefix, used);
            if (section) sections.push(section);
        }

        const other = buildOtherCategory(commands, prefix, used);
        if (other) sections.push(other);

        const menuText =
"╭━━〔 🤖 VENOM X MENU 〕━━⬣\n" +
"┃ 👋 " + timeInfo.greeting + ", " + ownerName + "!\n" +
"┃\n" +
"┃ 👑 Owner : " + ownerName + "\n" +
"┃ 🌍 Mode : " + mode + "\n" +
"┃ ⚡ Prefix : " + prefix + "\n" +
"┃ 🤖 Version : " + (settings.version || "3.0.0") + "\n" +
"┃ 🚀 Status : ONLINE\n" +
"┃ 📦 Commands : " + totalCommands + "\n" +
"┃\n" +
"┃ 🕐 Time : " + timeInfo.time + "\n" +
"┃ 📅 Day : " + timeInfo.day + "\n" +
"┃ 📆 Date : " + timeInfo.date + "\n" +
"┃ 🌦️ Weather : Osun State, NG • " + weather + "\n" +
"┃ 📍 Location : Osun State, Nigeria\n" +
"╰━━━━━━━━━━━━━━━━⬣\n\n" +
sections.join("\n\n") +
"\n\n" +
"╭━━〔 📖 HELP 〕━━⬣\n" +
"┃ 💡 " + prefix + "info <command>\n" +
"┃ 💡 " + prefix + "menu\n" +
"╰━━━━━━━━━━━━━━━━⬣\n\n" +
"╭━━〔 💀 VENOM X 〕━━⬣\n" +
"┃ 📦 Total Commands : " + totalCommands + "\n" +
"┃ ✨ Anime Menu : ACTIVE\n" +
"┃ 🔥 Anime Lovers : ACTIVE\n" +
"┃ 😝 Fun Menu : ACTIVE\n" +
"┃ Powered By VENOM X\n" +
"╰━━━━━━━━━━━━━━━━⬣";

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
            await sock.sendMessage(from, { text: menuText }, { quoted: message }).catch(function () {});
        }

        const audioPath = path.join(__dirname, "../media/menu.mp3");
        if (fs.existsSync(audioPath)) {
            sock.sendMessage(from, {
                audio: fs.readFileSync(audioPath),
                mimetype: "audio/mpeg",
                ptt: false,
                fileName: "VENOM-X-MENU.mp3"
            }, { quoted: message }).catch(function () {});
        }

        console.log("📋 MENU SENT • long menu • random image");
    }
};
