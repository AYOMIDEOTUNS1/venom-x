"use strict";

/**
 * VENOM X Menu
 * 1) Interactive LIST (Android / clients that support it)
 * 2) Always image + caption (iPhone + everyone)
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const {
    generateWAMessageFromContent,
    prepareWAMessageMedia
} = require("@whiskeysockets/baileys");
const { getSettings } = require("../lib/settingsCache");

const menuImageDir = path.join(__dirname, "../media/menu");

function px(s) {
    return (s && s.prefix) || "#";
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
        desc: "Chat, nano, deepseek",
        cmds: ["ai", "deepseek", "nano", "secret", "tools"]
    },
    image: {
        title: "🎨 Image",
        desc: "HD, sticker, convert",
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
        desc: "Adult",
        cmds: ["xv", "xvphoto", "xnxx", "deepnude", "mature"]
    },
    download: {
        title: "📥 Downloads",
        desc: "Play, TikTok, YT, IG",
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
        desc: "Bass, TTS, convert",
        cmds: ["play", "tomp3", "bass", "reverse", "tts"]
    },
    group: {
        title: "👥 Group",
        desc: "Admin & anti",
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
        desc: "Bal, work, market",
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
        desc: "Slots, duel, bird",
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
        desc: "Truth, meme, roast",
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
        desc: "Anime & stickers",
        cmds: ["anime", "animelovers", "animepic", "telesticker"]
    },
    tools: {
        title: "🛠️ Tools",
        desc: "PDF, plugin, getcode",
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
        desc: "Ping, alive, pair",
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
        desc: "Sudo, ban, update",
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
    let out = "*" + botName + " — ALL COMMANDS*\nTotal: " + total + "\n\n";
    const keys = Object.keys(CATEGORIES);
    for (let i = 0; i < keys.length; i++) {
        out += catText(prefix, keys[i]) + "\n\n";
    }
    return out.trim() + "\n\n_Powered by " + botName + "_";
}

function shortCaption(opts) {
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
        "┃ ✅ Online\n" +
        "┃ ⚡ Commands: *" +
        totalCommands +
        "*+\n" +
        "┃ 🔧 Prefix: *" +
        prefix +
        "*\n" +
        "┃ 🕐 " +
        timeInfo.time +
        " · " +
        timeInfo.day +
        "\n" +
        "┃ 📆 " +
        timeInfo.date +
        "\n" +
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
        "┃ ◈ " +
        prefix +
        "menu all\n" +
        "┃ ◈ " +
        prefix +
        "menu ai · download · group\n" +
        "┃ ◈ " +
        prefix +
        "menu games · fun · tools\n" +
        "┃ ◈ " +
        prefix +
        "menu economy · owner\n" +
        "┃ ◈ " +
        prefix +
        "ping\n" +
        "┃\n" +
        "┃ _If you see a list button below, open it_\n" +
        "┃ _If not (iPhone), use the commands above_\n" +
        "╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
        "> _Powered by " +
        botName +
        "_ ⚡"
    );
}

async function sendImageCaption(sock, from, message, sender, caption) {
    const img = pickImage();
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

async function sendListMenu(sock, from, message, opts) {
    const {
        prefix,
        botName,
        pushName,
        totalCommands,
        sender,
        stats,
        timeInfo
    } = opts;

    const bodyText =
        timeInfo.greet +
        ", " +
        mentionTag(sender) +
        " (*" +
        pushName +
        "*)\n\n" +
        "*" +
        botName +
        "* online · *" +
        totalCommands +
        "*+ cmds\n" +
        "Prefix *" +
        prefix +
        "*\n" +
        timeInfo.time +
        " · " +
        timeInfo.day +
        "\n" +
        "RAM " +
        stats.ram +
        " · Up " +
        stats.uptime +
        "\n\n" +
        "Open the *list* and pick a category 👇";

    const rows = [
        {
            header: "All",
            title: "📋 All commands",
            description: "Full list",
            id: prefix + "menu all"
        }
    ];
    const keys = Object.keys(CATEGORIES);
    for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const c = CATEGORIES[k];
        rows.push({
            header: k.toUpperCase(),
            title: c.title,
            description: c.desc,
            id: prefix + "menu " + k
        });
    }
    rows.push({
        header: "Ping",
        title: "🏓 Ping",
        description: "Speed check",
        id: prefix + "ping"
    });

    let header = {
        title: botName,
        subtitle: "Select from the list",
        hasMediaAttachment: false
    };

    try {
        const imgPath = pickImage();
        if (imgPath && fs.existsSync(imgPath)) {
            const media = await prepareWAMessageMedia(
                { image: fs.readFileSync(imgPath) },
                { upload: sock.waUploadToServer }
            );
            if (media.imageMessage) {
                header = {
                    title: botName,
                    subtitle: "Select from the list",
                    hasMediaAttachment: true,
                    imageMessage: media.imageMessage
                };
            }
        }
    } catch (e) {
        console.log("MENU LIST IMG:", e.message);
    }

    const interactiveMessage = {
        header: header,
        body: { text: bodyText },
        footer: { text: "Powered by " + botName },
        contextInfo: { mentionedJid: sender ? [sender] : [] },
        nativeFlowMessage: {
            buttons: [
                {
                    name: "single_select",
                    buttonParamsJson: JSON.stringify({
                        title: "📂 Open menu list",
                        sections: [
                            {
                                title: botName + " categories",
                                highlight_label: "VENOM",
                                rows: rows
                            }
                        ]
                    })
                }
            ],
            messageParamsJson: ""
        }
    };

    const msg = generateWAMessageFromContent(
        from,
        {
            viewOnceMessage: {
                message: {
                    messageContextInfo: {
                        deviceListMetadata: {},
                        deviceListMetadataVersion: 2
                    },
                    interactiveMessage: interactiveMessage
                }
            }
        },
        { userJid: sock.user.id, quoted: message }
    );

    try {
        if (
            sender &&
            msg.message?.viewOnceMessage?.message?.interactiveMessage
        ) {
            msg.message.viewOnceMessage.message.interactiveMessage.contextInfo =
                { mentionedJid: [sender] };
        }
    } catch (e) {}

    const additionalNodes = [
        {
            tag: "biz",
            attrs: {},
            content: [
                {
                    tag: "interactive",
                    attrs: { type: "native_flow", v: "1" },
                    content: [
                        {
                            tag: "native_flow",
                            attrs: { v: "9", name: "mixed" },
                            content: undefined
                        }
                    ]
                }
            ]
        }
    ];
    if (!String(from).endsWith("@g.us")) {
        additionalNodes.push({
            tag: "bot",
            attrs: { biz_bot: "1" },
            content: undefined
        });
    }

    await sock.relayMessage(from, msg.message, {
        messageId: msg.key.id,
        additionalNodes: additionalNodes
    });
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
            return sendImageCaption(
                sock,
                from,
                message,
                sender,
                fullText(prefix, botName, totalCommands)
            );
        }
        if (CATEGORIES[sub]) {
            return sendImageCaption(
                sock,
                from,
                message,
                sender,
                catText(prefix, sub)
            );
        }

        const caption = shortCaption({
            prefix: prefix,
            botName: botName,
            pushName: pushName,
            sender: sender,
            totalCommands: totalCommands,
            timeInfo: timeInfo,
            stats: stats
        });

        // 1) Always visible on iPhone
        await sendImageCaption(sock, from, message, sender, caption);

        // 2) List for clients that support native_flow (Android etc.)
        try {
            await sendListMenu(sock, from, message, {
                prefix: prefix,
                botName: botName,
                pushName: pushName,
                totalCommands: totalCommands,
                sender: sender,
                stats: stats,
                timeInfo: timeInfo
            });
        } catch (err) {
            console.log("MENU LIST:", err.message);
        }
    }
};
