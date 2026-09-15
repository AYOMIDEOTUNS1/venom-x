const fs = require("fs");
const path = require("path");
const { getSettings } = require("../lib/settingsCache");

const DB = path.join(__dirname, "..", "database", "autoreact.json");

const DEFAULT_EMOJIS = [
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💕", "💞", "💓", "💗", "💖",
    "🔥", "✨", "⚡", "💥", "🌟", "⭐", "💫",
    "😂", "🤣", "😊", "😍", "😘", "😎", "🤩", "🥳", "😏",
    "👍", "👏", "🙌", "🤝", "✌️", "🤞", "🤟", "🤘", "👌", "🤙", "👋", "🫡", "💪", "🙏", "👊",
    "🌸", "💮", "🌹", "🥀", "🌺", "🌻", "🌼", "🌷", "💐", "🍀",
    "💎", "💰", "👑", "💍", "🏆",
    "💀", "☠️", "👻",
    "💯", "✅", "🎯", "🚀"
];

function load() {
    try {
        if (!fs.existsSync(DB)) return {};
        return JSON.parse(fs.readFileSync(DB, "utf8") || "{}");
    } catch (e) {
        return {};
    }
}

function save(data) {
    try {
        const dir = path.dirname(DB);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(DB, JSON.stringify(data, null, 2));
    } catch (e) {}
}

function chatKey(from) {
    return String(from || "");
}

function getConfig(from) {
    const db = load();
    return db[chatKey(from)] || null;
}

function setConfig(from, patch) {
    const db = load();
    const key = chatKey(from);
    db[key] = Object.assign({}, db[key] || {}, patch, { updatedAt: Date.now() });
    save(db);
    return db[key];
}

function digits(v) {
    return String(v || "").replace(/\D/g, "");
}

function isOwnerMessage(msg) {
    if (!msg || !msg.key) return false;
    if (msg.key.fromMe) return true;

    const settings = getSettings();
    const ownerNumber = digits(settings.ownerNumber);
    const ownerLid = digits(settings.ownerLid);

    const candidates = [
        digits(msg.key.participant),
        digits(msg.key.participantPn),
        digits(msg.key.senderPn),
        digits(msg.key.remoteJid)
    ];

    for (let i = 0; i < candidates.length; i++) {
        const id = candidates[i];
        if (!id) continue;
        if (ownerNumber && id === ownerNumber) return true;
        if (ownerLid && id === ownerLid) return true;
    }
    return false;
}

function px() {
    const s = getSettings();
    return s.prefix || "#";
}

module.exports = {
    name: "autoreact",
    aliases: ["areact", "reactauto", "autoreaction"],

    run: async function ({ from, args, reply, isGroup }) {
        const p = px();
        const mode = String(args[0] || "").toLowerCase();
        const cfg = getConfig(from) || { on: false, emojis: DEFAULT_EMOJIS.slice() };

        if (!mode || mode === "status") {
            const list = cfg.emojis || DEFAULT_EMOJIS;
            return reply(
`╭━━〔 ✨ VENOM X AUTOREACT 〕━━⬣

Status: ${cfg.on ? "ON ✅" : "OFF ❌"}
Mode: Owner messages only
Chat: ${isGroup ? "group" : "private"}
Emojis: ${list.length}

${p}autoreact on
${p}autoreact off
${p}autoreact default
${p}autoreact emoji 🌹💎💀🙌
${p}autoreact status

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        if (mode === "on") {
            setConfig(from, {
                on: true,
                emojis: cfg.emojis && cfg.emojis.length ? cfg.emojis : DEFAULT_EMOJIS.slice()
            });
            return reply("✅ Autoreact ON\nOnly *your* (owner) messages get reactions.");
        }

        if (mode === "off") {
            setConfig(from, { on: false });
            return reply("✅ Autoreact OFF");
        }

        if (mode === "default" || mode === "reset") {
            setConfig(from, { on: true, emojis: DEFAULT_EMOJIS.slice() });
            return reply("✅ Full emoji pack · Autoreact ON · Owner only");
        }

        if (mode === "emoji" || mode === "emojis" || mode === "set") {
            const emojis = args.slice(1).join(" ").split(/\s+/).filter(Boolean).slice(0, 40);
            if (!emojis.length) {
                return reply("Usage:\n" + p + "autoreact emoji 🌹 💎 💀 🙌 🔥");
            }
            setConfig(from, { on: true, emojis: emojis });
            return reply("✅ Emojis set:\n" + emojis.join(" ") + "\nOwner only · ON");
        }

        return reply("Use: " + p + "autoreact on | off | default | emoji | status");
    }
};

module.exports.handleAutoReact = async function (sock, msg) {
    try {
        if (!msg || !msg.key) return;
        const from = msg.key.remoteJid;
        if (!from || from === "status@broadcast") return;
        if (String(from).indexOf("@newsletter") !== -1) return;

        const cfg = getConfig(from);
        if (!cfg || !cfg.on) return;

        // ONLY owner (or fromMe)
        if (!isOwnerMessage(msg)) return;

        const emojis = cfg.emojis && cfg.emojis.length ? cfg.emojis : DEFAULT_EMOJIS;
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];

        await sock.sendMessage(from, {
            react: { text: emoji, key: msg.key }
        });
    } catch (e) {}
};
