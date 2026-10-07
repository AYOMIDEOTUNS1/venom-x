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
        console.log("🖼️ Menu images:", menuImages.length);
    } catch (e) {
        menuImages = [];
    }
}
loadMenuImages();

function pickRandomImage() {
    if (!menuImages.length) loadMenuImages();
    if (!menuImages.length) return null;
    // prefer sukuna if present
    const sukuna = menuImages.find(function (p) {
        return /sukuna/i.test(path.basename(p));
    });
    if (sukuna) return sukuna;
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

const categories = {
    "🧠 AI": [
        "ai", "ask", "venomai", "gpt", "nano", "secret",
        "translate", "rewrite", "summarize", "code",
        "define", "wiki", "summary"
    ],
    "🎨 IMAGE": [
        "hd", "tohd", "sticker", "s", "toimg", "tovid", "cropsticker",
        "getpp", "stickerpack", "take", "steal", "takeall",
        "animepic", "pint", "pinterest", "wallpaper", "character",
        "blur", "removebg", "wanted"
    ],
    "🔞 NSFW": [
        "xv", "xvphoto", "xnxx", "ass", "boobs", "hentai",
        "waifu", "neko", "pussy", "mature", "deepnude"
    ],
    "📥 DOWNLOADS": [
        "tiktok", "tt", "ytmp3", "ytmp4", "ig", "instagram",
        "fb", "facebook", "play", "spotify", "mediafire",
        "vv", "vv2", "tiktokboost", "ttstalk"
    ],
    "🎵 MUSIC / AUDIO": [
        "play", "song", "music", "spotify", "ytmp3", "tomp3",
        "bass", "reverse", "tts"
    ],
    "👥 GROUP": [
        "tagall", "hidetag", "kick", "add", "promote", "demote",
        "warn", "warnings", "delwarn", "resetwarn",
        "antilink", "antichannelmessage", "antistatustag",
        "welcome", "goodbye", "open", "close", "groupinfo",
        "invite", "grouplink", "revoke", "resetlink", "grouppfp",
        "status2", "gcstatus", "leave", "antigroupstatus"
    ],
    "💰 ECONOMY": [
        "bal", "daily", "weekly", "monthly", "work", "deposit",
        "withdraw", "pay", "rob", "jail", "bail", "escape",
        "economy", "bank", "bankupgrade", "market", "aza",
        "lb", "glb", "resetgame"
    ],
    "🎮 GAMES": [
        "coinflip", "cf", "slots", "guess", "blackjack", "bj",
        "dice", "rps", "battle", "duel", "accept",
        "wordchain", "wc", "bird", "flap", "snake", "ttt",
        "hangman", "hack"
    ],
    "😝 FUN MENU": [
        "fun", "funextra", "truth", "dare", "truthdare",
        "roast", "compliment", "flirt", "joke", "quote",
        "insult", "riddle", "ship", "pick", "couple",
        "meme", "nmeme", "style", "wouldyou", "dadjoke",
        "funfact", "advice", "rate",
        "ronaldo", "elonmusk", "therock", "zuck",
        "tiktok-girl", "korean-girl", "japan-girl",
        "itadori", "waifu", "neko"
    ],
    "✨ ANIME": [
        "anime", "animelovers", "animepic", "waifu", "neko",
        "itadori", "quoteanime"
    ],
    "🛠️ TOOLS": [
        "get", "url", "github", "web2apk", "reactch", "getjid",
        "whoami", "vcf", "save", "pair", "setfullpfp",
        "ban", "unban"
    ],
    "⚙️ UTILITY": [
        "ping", "p", "alive", "uptime", "up", "menu", "m", "help",
        "owner", "profile", "info", "delete", "del",
        "autoreact", "refresh", "sleep"
    ],
    "👑 OWNER": [
        "public", "private", "shutdown", "update", "block",
        "unblock", "sudo", "leave", "reset", "ban", "unban",
        "setfullpfp", "pair"
    ]
};

function buildCategory(title, names, prefix) {
    const rows = names.map(function (name) {
        return "┃ " + prefix + name;
    });
    return (
        "╭━━〔 " + title + " 〕━━⬣\n" +
        rows.join("\n") +
        "\n╰━━━━━━━━━━━━━━━━⬣"
    );
}

module.exports = {
    name: "menu",
    aliases: ["m", "help", "list"],

    run: async function ({ sock, from, sender, message, settings }) {
        const conf = settings || getSettings();
        const prefix = conf.prefix || "#";
        const ownerName = conf.ownerName || "AYOMIDE";
        const botName = conf.botName || "VENOM X";
        const mode = String(conf.mode || "public").toUpperCase();
        const timeInfo = getTimeInfo();

        let totalCommands = 0;
        try {
            if (typeof sock.getCommands === "function") {
                totalCommands = sock.getCommands().size || 0;
            }
        } catch (e) {}

        const mention = sender || from;
        const tag = "@" + String(mention).split("@")[0];

        const sections = Object.keys(categories).map(function (title) {
            return buildCategory(title, categories[title], prefix);
        });

        const menuText =
            "╭━━〔 🤖 " + botName + " MENU 〕━━⬣\n" +
            "┃ 👋 " + timeInfo.greeting + ", " + tag + "!\n" +
            "┃\n" +
            "┃ 👑 Owner : " + ownerName + "\n" +
            "┃ 🌍 Mode : " + mode + "\n" +
            "┃ ⚡ Prefix : " + prefix + "\n" +
            "┃ 🤖 Version : " + (conf.version || "3.0.0") + "\n" +
            "┃ 🚀 Status : ONLINE\n" +
            "┃ 📦 Commands : " + totalCommands + "\n" +
            "┃\n" +
            "┃ 🕐 Time : " + timeInfo.time + "\n" +
            "┃ 📅 Day : " + timeInfo.day + "\n" +
            "┃ 📆 Date : " + timeInfo.date + "\n" +
            "╰━━━━━━━━━━━━━━━━⬣\n\n" +
            sections.join("\n\n") +
            "\n\n" +
            "╭━━〔 📖 HELP 〕━━⬣\n" +
            "┃ 💡 " + prefix + "info <command>\n" +
            "┃ 💡 " + prefix + "menu\n" +
            "┃ 💡 " + prefix + "m\n" +
            "╰━━━━━━━━━━━━━━━━⬣\n\n" +
            "╭━━〔 💀 " + botName + " 〕━━⬣\n" +
            "┃ 📦 Total Commands : " + totalCommands + "\n" +
            "┃ 🎮 Economy · Games · Fun · Tools\n" +
            "┃ Powered By VENOM X\n" +
            "╰━━━━━━━━━━━━━━━━⬣";

        const selectedImage = pickRandomImage();
        const payload = {
            text: menuText,
            mentions: mention ? [mention] : []
        };

        try {
            if (selectedImage && fs.existsSync(selectedImage)) {
                await sock.sendMessage(
                    from,
                    {
                        image: fs.readFileSync(selectedImage),
                        caption: menuText,
                        mentions: mention ? [mention] : []
                    },
                    { quoted: message }
                );
            } else {
                console.log("⚠️ No menu image found in media/menu");
                await sock.sendMessage(from, payload, { quoted: message });
            }
        } catch (e) {
            console.log("MENU SEND ERROR:", e.message);
            await sock
                .sendMessage(from, payload, { quoted: message })
                .catch(function () {});
        }
    }
};
