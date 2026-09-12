const fs = require("fs");
const path = require("path");

const SETTINGS_FILE = path.join(__dirname, "..", "settings.json");
const menuImageDir = path.join(__dirname, "../media/menu");

let menuImages = [];

function getSettings() {
    try {
        return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
    } catch {
        return {};
    }
}

function loadMenuImages() {
    try {
        if (!fs.existsSync(menuImageDir)) {
            menuImages = [];
            return;
        }
        menuImages = fs.readdirSync(menuImageDir)
            .filter(function (f) { return /\.(jpg|jpeg|png|webp)$/i.test(f); })
            .map(function (f) { return path.join(menuImageDir, f); });
    } catch {
        menuImages = [];
    }
}
loadMenuImages();

function pickRandomImage() {
    if (!menuImages.length) loadMenuImages();
    return menuImages.length ? menuImages[Math.floor(Math.random() * menuImages.length)] : null;
}

function getTimeInfo() {
    var now = new Date();
    var time = new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).format(now);
    var day = new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", weekday: "long" }).format(now);
    var date = new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", day: "2-digit", month: "long", year: "numeric" }).format(now);
    var hour = Number(new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", hour: "numeric", hour12: false }).format(now));
    var greeting = "Good night";
    if (hour >= 5 && hour < 12) greeting = "Good morning";
    else if (hour >= 12 && hour < 17) greeting = "Good afternoon";
    else if (hour >= 17 && hour < 22) greeting = "Good evening";
    return { time: time, day: day, date: date, greeting: greeting };
}

function cleanName(name) {
    return String(name || "").replace(/\.js$/i, "").trim().toLowerCase();
}

function getCommandRegistry(sock) {
    var registry = typeof sock.getCommands === "function" ? sock.getCommands() : null;
    if (registry instanceof Map && registry.size) return registry;
    var fallback = new Map();
    try {
        var files = fs.readdirSync(__dirname).filter(function (f) { return f.slice(-3) === ".js" && f !== "menu.js"; });
        for (var i = 0; i < files.length; i++) {
            try {
                var full = path.join(__dirname, files[i]);
                delete require.cache[require.resolve(full)];
                var cmd = require(full);
                if (cmd) fallback.set(cleanName(files[i]), cmd);
            } catch (e) {}
        }
    } catch (e) {}
    return fallback;
}

function buildCommands(registry) {
    var commands = new Map();
    var seen = new Set();
    registry.forEach(function (command, key) {
        if (!command || seen.has(command)) return;
        seen.add(command);
        var name = cleanName(command.name || key);
        if (name) commands.set(name, command);
    });
    return commands;
}

var categories = {
    "🧠 AI": [
        "ai", "ask", "venomai", "gpt", "translate", "rewrite", "summarize",
        "code", "fixcode", "explain", "nano", "nanopro", "summary"
    ],
    "🎨 IMAGE": [
        "hd", "tohd", "hdify", "sticker", "s", "toimg", "toimage", "cropsticker",
        "getpp", "stickerpack", "take", "steal", "takeall", "animepic", "meme",
        "wallpaper", "blur", "wanted", "emojimix", "removebg", "pint", "character"
    ],
    "🔞 NSFW": [
        "xv", "xvphoto", "xvpics", "ass", "boobs", "hentai", "waifu", "neko", "pussy"
    ],
    "📥 DOWNLOADS": [
        "tiktok", "tt", "ytmp3", "ytmp4", "ig", "fb", "play", "spotify",
        "mediafire", "gitclone", "vv", "vv2", "tiktokboost", "ttboost"
    ],
    "🎵 MUSIC": [
        "play", "song", "lyrics", "shazam", "bass", "toaudio", "tts", "smooth"
    ],
    "👥 GROUP": [
        "tagall", "hidetag", "kick", "add", "promote", "demote",
        "warn", "warnings", "delwarn", "resetwarn",
        "antilink", "welcome", "goodbye", "open", "close",
        "groupinfo", "status2", "gcstatus", "setname", "setdesc",
        "linkgroup", "revoke", "pick", "couple"
    ],
    "💰 ECONOMY": [
        "bal", "daily", "weekly", "monthly", "work", "deposit", "withdraw",
        "pay", "rob", "jail", "bail", "escape", "economy", "bank",
        "bankupgrade", "market", "aza"
    ],
    "🎮 GAMES": [
        "coinflip", "slots", "guess", "blackjack", "dice", "rps",
        "battle", "duel", "accept", "games", "stats", "lb", "glb", "wordchain"
    ],
    "✨ ANIME MENU": [
        "anime", "manga", "rwaifu", "waifu", "neko", "itadori",
        "shinobu", "megumin", "hug", "kiss", "pat", "slap",
        "cry", "dance", "kill", "cuddle", "bonk", "blush", "bite", "quoteanime"
    ],
    "😝 FUN MENU": [
        "fun", "truth", "dare", "truthdare", "roast", "compliment", "flirt",
        "joke", "rate", "ship", "wouldyou", "ronaldo", "elonmusk", "therock",
        "korean-girl", "japan-girl", "tiktok-girl", "random-girl", "hijab-girl",
        "hack", "quote", "insult", "riddle", "meme"
    ],
    "⚙️ UTILITY": [
        "ping", "alive", "menu", "owner", "profile", "weather", "calc", "qr",
        "tts", "short", "poll", "getjid", "reactch", "info", "define", "wiki",
        "crypto", "currency", "remind", "bio", "ss", "font"
    ],
    "👑 OWNER": [
        "public", "private", "shutdown", "restart", "backup",
        "broadcast", "update", "block", "unblock", "sudo"
    ]
};

function buildCategory(title, names, prefix) {
    var rows = names.map(function (name) { return "┃ " + prefix + name; });
    return "╭━━〔 " + title + " 〕━━⬣\n" + rows.join("\n") + "\n╰━━━━━━━━━━━━━━━━⬣";
}

module.exports = {
    name: "menu",
    aliases: ["m"],

    run: async function ({ sock, from, message, sender }) {
        var settings = getSettings();
        var prefix = settings.prefix || "#";
        var ownerName = settings.ownerName || "AYOMIDE";
        var botName = settings.botName || "VENOM X";
        var mode = String(settings.mode || "public").toUpperCase();
        var timeInfo = getTimeInfo();
        var registry = getCommandRegistry(sock);
        var commands = buildCommands(registry);
        var totalCommands = commands.size;

        var sections = Object.keys(categories).map(function (title) {
            return buildCategory(title, categories[title], prefix);
        });

        var menuText =
"╭━━〔 🤖 " + botName + " MENU 〕━━⬣\n" +
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
"╰━━━━━━━━━━━━━━━━⬣\n\n" +
sections.join("\n\n") + "\n\n" +
"╭━━〔 📖 HELP 〕━━⬣\n" +
"┃ 💡 " + prefix + "info <command>\n" +
"┃ 💡 " + prefix + "menu\n" +
"╰━━━━━━━━━━━━━━━━⬣\n\n" +
"╭━━〔 💀 " + botName + " 〕━━⬣\n" +
"┃ 📦 Total Commands : " + totalCommands + "\n" +
"┃ Powered By VENOM X\n" +
"╰━━━━━━━━━━━━━━━━⬣";

        var selectedImage = pickRandomImage();
        try {
            if (selectedImage && fs.existsSync(selectedImage)) {
                await sock.sendMessage(from, {
                    image: fs.readFileSync(selectedImage),
                    caption: menuText
                }, { quoted: message });
            } else {
                await sock.sendMessage(from, { text: menuText }, { quoted: message });
            }
        } catch (e) {
            await sock.sendMessage(from, { text: menuText }, { quoted: message }).catch(function () {});
        }
    }
};
