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
            .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
            .map(f => path.join(menuImageDir, f));
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
    const now = new Date();
    const time = new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).format(now);
    const day = new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", weekday: "long" }).format(now);
    const date = new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", day: "2-digit", month: "long", year: "numeric" }).format(now);
    const hour = Number(new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", hour: "numeric", hour12: false }).format(now));
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
        const files = fs.readdirSync(__dirname).filter(f => f.endsWith(".js") && f !== "menu.js");
        for (const file of files) {
            try {
                const full = path.join(__dirname, file);
                delete require.cache[require.resolve(full)];
                const cmd = require(full);
                if (cmd) fallback.set(cleanName(file), cmd);
            } catch {}
        }
    } catch {}
    return fallback;
}

function buildCommands(registry) {
    const commands = new Map();
    const seen = new Set();
    registry.forEach((command, key) => {
        if (!command || seen.has(command)) return;
        seen.add(command);
        const name = cleanName(command.name || key);
        if (name) commands.set(name, command);
    });
    return commands;
}

const categories = {
    "🧠 AI": ["ai", "ask", "venomai", "gpt", "translate", "rewrite", "summarize", "code", "fixcode", "explain", "nano", "nanopro"],
    "🎨 IMAGE": ["hd", "tohd", "hdify", "sticker", "s", "toimg", "toimage", "cropsticker", "getpp", "stickerpack", "take", "steal", "takeall", "animepic", "meme", "wallpaper", "blur", "wanted", "emojimix", "removebg", "pint"],
    "🔞 NSFW": ["xv", "xvphoto", "xvpics", "ass", "boobs", "hentai", "waifu", "neko", "pussy"],
    "📥 DOWNLOADS": ["tiktok", "tt", "ytmp3", "ytmp4", "ig", "fb", "play", "spotify", "mediafire", "gitclone", "vv", "vv2", "tiktokboost", "ttboost"],
    "🎵 MUSIC": ["play", "song", "lyrics", "shazam", "bass"],
    "👥 GROUP": ["tagall", "hidetag", "kick", "add", "promote", "demote", "warn", "warnings", "delwarn", "resetwarn", "antilink", "welcome", "goodbye", "open", "close", "groupinfo", "status2", "gcstatus", "setname", "setdesc", "linkgroup", "revoke"],
    "💰 ECONOMY": ["bal", "daily", "weekly", "monthly", "work", "deposit", "withdraw", "pay", "rob", "jail", "bail", "escape", "economy", "bank", "bankupgrade", "market", "aza"],
    "🎮 GAMES": ["coinflip", "slots", "guess", "blackjack", "dice", "rps", "battle", "duel", "accept", "games", "stats", "lb", "glb", "wordchain"],
    "✨ ANIME": ["anime", "manga", "rwaifu", "waifu", "neko", "itadori", "shinobu", "megumin", "hug", "kiss", "pat", "slap", "cry", "dance", "kill", "cuddle", "bonk", "blush", "bite"],
    "😝 FUN": ["fun", "truth", "dare", "truthdare", "roast", "compliment", "flirt", "joke", "rate", "ship", "wouldyou", "ronaldo", "elonmusk", "therock", "korean-girl", "japan-girl", "tiktok-girl", "random-girl", "hijab-girl", "hack", "quote", "insult", "pick", "couple", "riddle", "meme"],
    "⚙️ UTILITY": ["ping", "alive", "menu", "owner", "profile", "weather", "calc", "qr", "tts", "short", "poll", "getjid", "reactch", "info", "define", "wiki", "crypto", "currency", "remind", "bio"],
    "👑 OWNER": ["public", "private", "shutdown", "restart", "backup", "broadcast", "update", "block", "unblock", "sudo"]
};

function buildCategory(title, names, prefix) {
    const rows = names.map(name => `┃ \( {prefix} \){name}`);
    return `╭━━〔 \( {title} 〕━━⬣\n \){rows.join("\n")}\n╰━━━━━━━━━━━━━━━━⬣`;
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
        const pushName = message.pushName || "User";
        const arg = (args[0] || "").toLowerCase();

        // ==================== SMALL MENU ====================
        if (arg !== "all" && arg !== "full") {
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
            } catch {
                await sock.sendMessage(from, { text: smallMenu }, { quoted: message }).catch(() => {});
            }
            return;
        }

        // ==================== FULL MENU ====================
        const sections = Object.entries(categories).map(([title, names]) =>
            buildCategory(title, names, prefix)
        );

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
        } catch {
            await sock.sendMessage(from, { text: menuText }, { quoted: message }).catch(() => {});
        }
    }
};
