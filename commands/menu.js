"use strict";

/**
 * VENOM X Menu — works on iPhone + Android
 * Always sends image + caption (no interactive-only UI)
 * #menu / #m
 * #menu all
 * #menu ai | image | download | group | ...
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { getSettings } = require("../lib/settingsCache");

const menuImageDir = path.join(__dirname, "../media/menu");

function px(settings) {
    return (settings && settings.prefix) || "#";
}

function loadImages() {
    try {
        if (!fs.existsSync(menuImageDir)) return [];
        return fs
            .readdirSync(menuImageDir)
            .filter(function (f) {
                return /\.(jpg|jpeg|png|webp)$/i.test(f);
            })
            .map(function (f) {
                return path.join(menuImageDir, f);
            });
    } catch (e) {
        return [];
    }
}

function pickImage() {
    const imgs = loadImages();
    if (!imgs.length) return null;
    return imgs[Math.floor(Math.random() * imgs.length)];
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
    let greet = "Hello";
    if (hour >= 5 && hour < 12) greet = "Good morning";
    else if (hour >= 12 && hour < 17) greet = "Good afternoon";
    else if (hour >= 17 && hour < 22) greet = "Good evening";
    else greet = "Good night";
    return { time: time, day: day, date: date, greet: greet };
}

function formatBytes(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + " MB";
    return (n / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

function formatUptime(sec) {
    sec = Math.floor(Number(sec) || 0);
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (d > 0) return d + "d " + h + "h " + m + "m";
    if (h > 0) return h + "h " + m + "m " + s + "s";
    if (m > 0) return m + "m " + s + "s";
    return s + "s";
}

function getSystemStats() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPct = totalMem ? Math.round((usedMem / totalMem) * 100) : 0;
    let load = "n/a";
    try {
        const la = os.loadavg();
        if (la && la.length) {
            load =
                la[0].toFixed(2) +
                " / " +
                la[1].toFixed(2) +
                " / " +
                la[2].toFixed(2);
        }
    } catch (e) {}
    let botMem = "n/a";
    try {
        const mu = process.memoryUsage();
        botMem =
            "Heap " +
            formatBytes(mu.heapUsed) +
            " / RSS " +
            formatBytes(mu.rss);
    } catch (e) {}
    return {
        platform: os.platform() + " · " + os.arch(),
        cpus: (os.cpus() || []).length || 1,
        load: load,
        ram:
            formatBytes(usedMem) +
            " / " +
            formatBytes(totalMem) +
            " (" +
            memPct +
            "%)",
        botMem: botMem,
        uptime: formatUptime(process.uptime()),
        node: process.version
    };
}

function mentionTag(sender) {
    if (!sender) return "@user";
    return "@" + String(sender).split("@")[0];
}

const CATEGORIES = {
    ai: {
        title: "🧠 AI",
        cmds: ["ai", "deepseek", "nano", "secret", "tools"]
    },
    image: {
        title: "🎨 Image",
        cmds: [
            "hd",
            "sticker",
            "stickerpack",
            "toimg",
            "tovid",
            "take",
            "takeall",
            "cropsticker",
            "blur",
            "pint",
            "getpp",
            "animepic",
            "url"
        ]
    },
    nsfw: {
        title: "🔞 NSFW",
        cmds: ["xv", "xvphoto", "xnxx", "deepnude", "mature"]
    },
    download: {
        title: "📥 Downloads",
        cmds: [
            "play",
            "spotify",
            "tiktok",
            "ttstalk",
            "tiktokboost",
            "ytmp3",
            "ytmp4",
            "ig",
            "instagram",
            "fb",
            "facebook",
            "mediafire",
            "vv",
            "vv2"
        ]
    },
    audio: {
        title: "🎵 Audio",
        cmds: ["play", "tomp3", "bass", "reverse", "tts"]
    },
    group: {
        title: "👥 Group",
        cmds: [
            "tagall",
            "hidetag",
            "kick",
            "add",
            "promote",
            "demote",
            "warn",
            "warnings",
            "delwarn",
            "resetwarn",
            "antilink",
            "antichannelmessage",
            "antistatustag",
            "antigroupstatus",
            "welcome",
            "goodbye",
            "open",
            "close",
            "groupinfo",
            "invite",
            "revoke",
            "grouppfp",
            "status2",
            "gcstatus",
            "adminonly",
            "approveall",
            "leave"
        ]
    },
    economy: {
        title: "💰 Economy",
        cmds: [
            "bal",
            "bank",
            "bankupgrade",
            "daily",
            "weekly",
            "monthly",
            "work",
            "deposit",
            "withdraw",
            "pay",
            "rob",
            "jail",
            "bail",
            "escape",
            "economy",
            "market",
            "aza",
            "lb",
            "glb",
            "stats",
            "resetgame"
        ]
    },
    games: {
        title: "🎮 Games",
        cmds: [
            "slots",
            "dice",
            "coinflip",
            "coinchoice",
            "rps",
            "blackjack",
            "battle",
            "duel",
            "duelgame",
            "accept",
            "guess",
            "guessgame",
            "wordchain",
            "bird",
            "snake",
            "ttt",
            "hangman",
            "hack",
            "game",
            "games"
        ]
    },
    fun: {
        title: "😝 Fun",
        cmds: [
            "fun",
            "funextra",
            "truth",
            "dare",
            "roast",
            "flirt",
            "joke",
            "ship",
            "couple",
            "meme",
            "nmeme",
            "style"
        ]
    },
    anime: {
        title: "✨ Anime",
        cmds: ["anime", "animelovers", "animepic", "telesticker"]
    },
    tools: {
        title: "🛠️ Tools",
        cmds: [
            "get",
            "url",
            "github",
            "pdf",
            "extract",
            "plugin",
            "getcode",
            "try",
            "reactch",
            "getjid",
            "web2apk",
            "addmeta",
            "whoami",
            "vcf",
            "save",
            "info",
            "profile"
        ]
    },
    utility: {
        title: "⚙️ Utility",
        cmds: [
            "ping",
            "alive",
            "up",
            "menu",
            "owner",
            "delete",
            "autoreact",
            "refresh",
            "sleep",
            "pair"
        ]
    },
    owner: {
        title: "👑 Owner",
        cmds: [
            "public",
            "private",
            "sudo",
            "ban",
            "unban",
            "block",
            "unblock",
            "shutdown",
            "update",
            "reset",
            "setfullpfp",
            "pair"
        ]
    }
};

function catText(prefix, key) {
    const c = CATEGORIES[key];
    if (!c) return "Unknown. Try " + prefix + "menu all";
    return (
        "*" +
        c.title +
        "*\n\n" +
        c.cmds
            .map(function (x) {
                return "• " + prefix + x;
            })
            .join("\n")
    );
}

function fullText(prefix, botName, total) {
    let out =
        "*" + botName + " — ALL COMMANDS*\nTotal: " + total + "\n\n";
    const keys = Object.keys(CATEGORIES);
    for (let i = 0; i < keys.length; i++) {
        out += catText(prefix, keys[i]) + "\n\n";
    }
    out += "_Powered by " + botName + "_";
    return out.trim();
}

function shortMenu(opts) {
    const {
        prefix,
        botName,
        pushName,
        sender,
        totalCommands,
        timeInfo,
        stats
    } = opts;

    return (
        timeInfo.greet +
        ", " +
        mentionTag(sender) +
        " (*" +
        pushName +
        "*)\n\n" +
        "╭━━━「 🌀 *" +
        botName +
        "* 🌀 」━━━\n" +
        "┃\n" +
        "┃ ✅ Online & ready\n" +
        "┃ ⚡ Commands: *" +
        totalCommands +
        "*+\n" +
        "┃ 🔧 Prefix: *" +
        prefix +
        "*\n" +
        "┃\n" +
        "┃ 🕐 " +
        timeInfo.time +
        "\n" +
        "┃ 📅 " +
        timeInfo.day +
        " · " +
        timeInfo.date +
        "\n" +
        "┃\n" +
        "┃ 🖥️ " +
        stats.platform +
        "\n" +
        "┃ 🧠 CPU " +
        stats.cpus +
        " · load " +
        stats.load +
        "\n" +
        "┃ 💾 RAM " +
        stats.ram +
        "\n" +
        "┃ 📂 " +
        stats.botMem +
        "\n" +
        "┃ ⏱️ " +
        stats.uptime +
        " · " +
        stats.node +
        "\n" +
        "┃\n" +
        "┃ ◈ *" +
        prefix +
        "menu all* → full list\n" +
        "┃ ◈ *" +
        prefix +
        "menu ai*\n" +
        "┃ ◈ *" +
        prefix +
        "menu download*\n" +
        "┃ ◈ *" +
        prefix +
        "menu group*\n" +
        "┃ ◈ *" +
        prefix +
        "menu games*\n" +
        "┃ ◈ *" +
        prefix +
        "menu fun*\n" +
        "┃ ◈ *" +
        prefix +
        "menu tools*\n" +
        "┃ ◈ *" +
        prefix +
        "menu economy*\n" +
        "┃ ◈ *" +
        prefix +
        "ping*\n" +
        "┃\n" +
        "╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
        "> _Powered by " +
        botName +
        "_ ⚡"
    );
}

async function sendCaption(sock, from, message, sender, caption) {
    const img = pickImage();
    const payload = {
        caption: caption,
        mentions: sender ? [sender] : []
    };
    try {
        if (img && fs.existsSync(img)) {
            await sock.sendMessage(
                from,
                {
                    image: fs.readFileSync(img),
                    caption: caption,
                    mentions: sender ? [sender] : []
                },
                { quoted: message }
            );
            return;
        }
    } catch (e) {
        console.log("MENU IMG:", e.message);
    }
    await sock.sendMessage(
        from,
        { text: caption, mentions: sender ? [sender] : [] },
        { quoted: message }
    );
}

module.exports = {
    name: "menu",
    aliases: ["m", "help", "list", "commands"],

    run: async function ({
        sock,
        from,
        sender,
        args,
        message,
        settings
    }) {
        const conf = settings || getSettings();
        const prefix = px(conf);
        const botName = conf.botName || "VENOM X";
        const timeInfo = getTimeInfo();
        const stats = getSystemStats();

        let pushName = "User";
        try {
            pushName =
                message.pushName ||
                String(sender || "").split("@")[0] ||
                "User";
        } catch (e) {}

        let totalCommands = 0;
        try {
            if (sock.getCommands) totalCommands = sock.getCommands().size;
        } catch (e) {}
        if (!totalCommands) totalCommands = "150";

        const sub = String(args[0] || "").toLowerCase();

        if (sub === "all" || sub === "full") {
            return sendCaption(
                sock,
                from,
                message,
                sender,
                fullText(prefix, botName, totalCommands)
            );
        }

        if (CATEGORIES[sub]) {
            return sendCaption(
                sock,
                from,
                message,
                sender,
                catText(prefix, sub)
            );
        }

        // Default short menu — always visible on iPhone
        const caption = shortMenu({
            prefix: prefix,
            botName: botName,
            pushName: pushName,
            sender: sender,
            totalCommands: totalCommands,
            timeInfo: timeInfo,
            stats: stats
        });

        return sendCaption(sock, from, message, sender, caption);
    }
};
