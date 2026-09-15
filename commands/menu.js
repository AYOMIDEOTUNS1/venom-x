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
            .filter(function (f) {
                return /\.(jpg|jpeg|png|webp)$/i.test(f);
            })
            .map(function (f) {
                return path.join(menuImageDir, f);
            });
    } catch (e) {
        menuImages = [];
    }
}
loadMenuImages();

function pickRandomImage() {
    if (!menuImages.length) loadMenuImages();
    return menuImages.length
        ? menuImages[Math.floor(Math.random() * menuImages.length)]
        : null;
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

function cleanName(name) {
    return String(name || "")
        .replace(/\.js$/i, "")
        .trim()
        .toLowerCase();
}

function getCommandRegistry(sock) {
    const registry =
        typeof sock.getCommands === "function" ? sock.getCommands() : null;
    if (registry instanceof Map && registry.size) return registry;
    const fallback = new Map();
    try {
        const files = fs.readdirSync(__dirname).filter(function (f) {
            return f.slice(-3) === ".js" && f !== "menu.js";
        });
        for (let i = 0; i < files.length; i++) {
            try {
                const full = path.join(__dirname, files[i]);
                delete require.cache[require.resolve(full)];
                const cmd = require(full);
                if (cmd) fallback.set(cleanName(files[i]), cmd);
            } catch (e) {}
        }
    } catch (e) {}
    return fallback;
}

function buildCommands(registry) {
    const commands = new Map();
    const seen = new Set();
    registry.forEach(function (command, key) {
        if (!command || seen.has(command)) return;
        seen.add(command);
        const name = cleanName(command.name || key);
        if (name) commands.set(name, command);
    });
    return commands;
}

const categories = {
    "🧠 AI": [
        "ai", "ask", "venomai", "gpt", "vision", "imagine", "nano",
        "translate", "rewrite", "summarize", "code", "imaginehistory",
        "define", "wiki", "summary"
    ],
    "🎨 IMAGE": [
        "hd", "tohd", "sticker", "s", "toimg", "cropsticker", "getpp",
        "stickerpack", "take", "steal", "takeall", "animepic", "pint",
        "pinterest", "pin", "img", "wallpaper", "character", "meme",
        "ronaldo", "elonmusk", "therock", "zuck", "waifu", "neko",
        "tiktok-girl", "korean-girl", "japan-girl", "hijab-girl", "random-girl",
        "itadori", "rihanna", "tomcruise"
    ],
    "🔞 NSFW": [
        "xv", "xvphoto", "ass", "boobs", "hentai", "waifu", "neko",
        "pussy", "mature", "miakhalifa"
    ],
    "📥 DOWNLOADS": [
        "tiktok", "tt", "ytmp3", "ytmp4", "ig", "instagram", "fb",
        "facebook", "play", "mediafire", "vv", "vv2", "tiktokboost"
    ],
    "🎵 MUSIC": [
        "play", "song", "music", "ytmp3", "apple", "applemusic"
    ],
    "👥 GROUP": [
        "tagall", "hidetag", "kick", "add", "promote", "demote",
        "warn", "warnings", "delwarn", "resetwarn",
        "antilink", "antichannelmessage", "antistatustag",
        "welcome", "goodbye", "open", "close", "groupinfo",
        "status2", "gcstatus", "gstatus", "leave", "addmeta",
        "pick", "couple"
    ],
    "💰 ECONOMY": [
        "bal", "daily", "weekly", "monthly", "work", "deposit",
        "withdraw", "pay", "rob", "jail", "bail", "escape",
        "economy", "bank", "bankupgrade", "market", "aza"
    ],
    "🎮 GAMES": [
        "coinflip", "cf", "slots", "guess", "blackjack", "bj",
        "dice", "rps", "battle", "duel", "accept", "duelgame",
        "games", "stats", "lb", "glb", "wordchain", "wcg", "wc",
        "ship", "rate"
    ],
    "✨ ANIME MENU": [
        "anime", "animelovers", "animepic", "waifu", "neko",
        "itadori", "hug", "kiss", "pat", "slap", "quoteanime"
    ],
    "😝 FUN MENU": [
        "fun", "funextra", "truth", "dare", "truthdare", "roast",
        "compliment", "flirt", "joke", "quote", "insult", "riddle",
        "ship", "pick", "couple", "meme", "hack", "wouldyou",
        "dadjoke", "funfact", "advice"
    ],
    "📚 MATURE / INFO": [
        "mature", "define", "wiki", "crypto", "currency",
        "remind", "summary", "rewrite", "bio"
    ],
    "🛠️ TOOLS": [
        "web2apk", "ss", "reactch", "getjid", "whoami",
        "vcf", "save", "pair", "pint", "hd", "toimg"
    ],
    "⚙️ UTILITY": [
        "ping", "p", "alive", "uptime", "up", "menu", "m", "help",
        "owner", "profile", "info", "delete", "del",
        "autoreact", "areact", "refresh", "sleep"
    ],
    "👑 OWNER": [
        "public", "private", "shutdown", "update", "block",
        "unblock", "sudo", "leave", "reset"
    ]
};

function buildCategory(title, names, prefix) {
    const rows = names.map(function (name) {
        return "┃ " + prefix + name;
    });
    return (
        "╭━━〔 " +
        title +
        " 〕━━⬣\n" +
        rows.join("\n") +
        "\n╰━━━━━━━━━━━━━━━━⬣"
    );
}

module.exports = {
    name: "menu",
    aliases: ["m", "help", "list"],

    run: async function ({ sock, from, message }) {
        const settings = getSettings();
        const prefix = settings.prefix || "#";
        const ownerName = settings.ownerName || "AYOMIDE";
        const botName = settings.botName || "VENOM X";
        const mode = String(settings.mode || "public").toUpperCase();
        const timeInfo = getTimeInfo();
        const registry = getCommandRegistry(sock);
        const commands = buildCommands(registry);
        const totalCommands = commands.size;

        const sections = Object.keys(categories).map(function (title) {
            return buildCategory(title, categories[title], prefix);
        });

        const menuText =
            "╭━━〔 🤖 " +
            botName +
            " MENU 〕━━⬣\n" +
            "┃ 👋 " +
            timeInfo.greeting +
            ", " +
            ownerName +
            "!\n" +
            "┃\n" +
            "┃ 👑 Owner : " +
            ownerName +
            "\n" +
            "┃ 🌍 Mode : " +
            mode +
            "\n" +
            "┃ ⚡ Prefix : " +
            prefix +
            "\n" +
            "┃ 🤖 Version : " +
            (settings.version || "3.0.0") +
            "\n" +
            "┃ 🚀 Status : ONLINE\n" +
            "┃ 📦 Commands : " +
            totalCommands +
            "\n" +
            "┃\n" +
            "┃ 🕐 Time : " +
            timeInfo.time +
            "\n" +
            "┃ 📅 Day : " +
            timeInfo.day +
            "\n" +
            "┃ 📆 Date : " +
            timeInfo.date +
            "\n" +
            "╰━━━━━━━━━━━━━━━━⬣\n\n" +
            sections.join("\n\n") +
            "\n\n" +
            "╭━━〔 📖 HELP 〕━━⬣\n" +
            "┃ 💡 " +
            prefix +
            "info <command>\n" +
            "┃ 💡 " +
            prefix +
            "menu\n" +
            "┃ 💡 " +
            prefix +
            "m\n" +
            "╰━━━━━━━━━━━━━━━━⬣\n\n" +
            "╭━━〔 💀 " +
            botName +
            " 〕━━⬣\n" +
            "┃ 📦 Total Commands : " +
            totalCommands +
            "\n" +
            "┃ 🎮 Economy · Games · Fun · Tools\n" +
            "┃ Powered By VENOM X\n" +
            "╰━━━━━━━━━━━━━━━━⬣";

        const selectedImage = pickRandomImage();
        try {
            if (selectedImage && fs.existsSync(selectedImage)) {
                await sock.sendMessage(
                    from,
                    {
                        image: fs.readFileSync(selectedImage),
                        caption: menuText
                    },
                    { quoted: message }
                );
            } else {
                await sock.sendMessage(
                    from,
                    { text: menuText },
                    { quoted: message }
                );
            }
        } catch (e) {
            await sock
                .sendMessage(from, { text: menuText }, { quoted: message })
                .catch(function () {});
        }
    }
};
