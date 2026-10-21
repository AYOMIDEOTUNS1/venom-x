"use strict";

/**
 * VENOM X Menu — full command list from project
 * #menu / #m  → image + stats + LIST
 * #menu all   → everything
 * #menu ai    → one category
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

// ── Categories from your commands/ folder ─────────────────
const CATEGORIES = {
    ai: {
        title: "🧠 AI",
        desc: "Chat, nano, deepseek",
        cmds: [
            "ai",
            "deepseek",
            "nano",
            "secret",
            "translate",
            "tools"
        ]
    },
    image: {
        title: "🎨 Image / Sticker",
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
        desc: "Adult content",
        cmds: [
            "xv",
            "xvphoto",
            "xnxx",
            "deepnude",
            "mature"
        ]
    },
    download: {
        title: "📥 Downloads",
        desc: "Music & social media",
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
        desc: "Effects & voice",
        cmds: ["play", "tomp3", "bass", "reverse", "tts"]
    },
    group: {
        title: "👥 Group",
        desc: "Admin & protection",
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
        desc: "Money & market",
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
        desc: "Casino & mini games",
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
        desc: "Truth, memes, jokes",
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
            "style",
            "hack"
        ]
    },
    anime: {
        title: "✨ Anime",
        desc: "Anime pics & packs",
        cmds: [
            "anime",
            "animelovers",
            "animepic",
            "telesticker"
        ]
    },
    tools: {
        title: "🛠️ Tools",
        desc: "Utils & exports",
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
            "profile",
            "calc"
        ]
    },
    utility: {
        title: "⚙️ Utility",
        desc: "Bot status & helpers",
        cmds: [
            "ping",
            "alive",
            "up",
            "menu",
            "m",
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
        desc: "Privileged only",
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
            "pair",
            "plugin",
            "getcode",
            "try"
        ]
    }
};

function catText(prefix, key) {
    const c = CATEGORIES[key];
    if (!c) return "Unknown category. Try: " + prefix + "menu all";
    return (
        "*" +
        c.title +
        "*\n_" +
        c.desc +
        "_\n\n" +
        c.cmds
            .map(function (x) {
                return "• " + prefix + x;
            })
            .join("\n")
    );
}

function fullText(prefix, botName, total) {
    let out =
        "*" +
        botName +
        " — ALL COMMANDS*\n" +
        "Total keys: " +
        total +
        "\n\n";
    const keys = Object.keys(CATEGORIES);
    for (let i = 0; i < keys.length; i++) {
        out += catText(prefix, keys[i]) + "\n\n";
    }
    out += "_Powered by " + botName + "_";
    return out.trim();
}

function mentionTag(sender) {
    if (!sender) return "@user";
    return "@" + String(sender).split("@")[0];
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

    const tag = mentionTag(sender);

    const bodyText =
        timeInfo.greet +
        ", " +
        tag +
        " (*" +
        pushName +
        "*)\n\n" +
        "*" +
        botName +
        "* is online\n" +
        "📦 Commands: *" +
        totalCommands +
        "*+\n" +
        "⚡ Prefix: *" +
        prefix +
        "*\n\n" +
        "🕐 " +
        timeInfo.time +
        " · " +
        timeInfo.day +
        "\n" +
        "📆 " +
        timeInfo.date +
        "\n\n" +
        "*System*\n" +
        "🖥️ " +
        stats.platform +
        "\n" +
        "🧠 CPU: " +
        stats.cpus +
        " cores · load " +
        stats.load +
        "\n" +
        "💾 RAM: " +
        stats.ram +
        "\n" +
        "📂 Bot: " +
        stats.botMem +
        "\n" +
        "⏱️ Uptime: " +
        stats.uptime +
        "\n" +
        "🟢 Node: " +
        stats.node +
        "\n\n" +
        "Open the *list* and pick a category 👇";

    const rows = [
        {
            header: "All",
            title: "📋 All commands",
            description: "Full command list",
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
        description: "Response time",
        id: prefix + "ping"
    });
    rows.push({
        header: "Owner",
        title: "👤 Owner",
        description: "Bot owner info",
        id: prefix + "owner"
    });

    const listButton = {
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
    };

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
        console.log("MENU IMAGE:", e.message);
    }

    const interactiveMessage = {
        header: header,
        body: { text: bodyText },
        footer: { text: "Powered by " + botName + " ⚡" },
        contextInfo: {
            mentionedJid: sender ? [sender] : []
        },
        nativeFlowMessage: {
            buttons: [listButton],
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
        reply,
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

        const sub = String(args[0] || "").toLowerCase();

        if (sub === "all" || sub === "full") {
            return sock.sendMessage(
                from,
                {
                    text: fullText(prefix, botName, totalCommands || "150"),
                    mentions: sender ? [sender] : []
                },
                { quoted: message }
            );
        }

        if (CATEGORIES[sub]) {
            return sock.sendMessage(
                from,
                {
                    text: catText(prefix, sub),
                    mentions: sender ? [sender] : []
                },
                { quoted: message }
            );
        }

        try {
            await sendListMenu(sock, from, message, {
                prefix: prefix,
                botName: botName,
                pushName: pushName,
                totalCommands: totalCommands || "150",
                sender: sender,
                stats: stats,
                timeInfo: timeInfo
            });
        } catch (err) {
            console.log("MENU LIST ERROR:", err.message);
            const body =
                timeInfo.greet +
                ", " +
                mentionTag(sender) +
                "\n\n*" +
                botName +
                "* online\n" +
                "📦 " +
                (totalCommands || "150") +
                "+ · " +
                prefix +
                "\n" +
                "💾 " +
                stats.ram +
                "\n" +
                "⏱️ " +
                stats.uptime +
                "\n\n" +
                prefix +
                "menu all\n" +
                prefix +
                "menu ai · download · group · games · fun · tools · owner";

            const img = pickImage();
            try {
                if (img && fs.existsSync(img)) {
                    await sock.sendMessage(
                        from,
                        {
                            image: fs.readFileSync(img),
                            caption: body,
                            mentions: sender ? [sender] : []
                        },
                        { quoted: message }
                    );
                    return;
                }
            } catch (e) {}

            await sock.sendMessage(
                from,
                { text: body, mentions: sender ? [sender] : [] },
                { quoted: message }
            );
        }
    }
};
