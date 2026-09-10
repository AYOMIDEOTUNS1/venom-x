const fs = require("fs");
const path = require("path");
const os = require("os");

const SETTINGS_FILE = path.join(__dirname, "..", "settings.json");
const menuImageDir = path.join(__dirname, "../media/menu");

let menuImages = [];
const startTime = Date.now();

function getSettings() {
    try {
        return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
    } catch {
        return {};
    }
}

function loadMenuImages() {
    try {
        if (!fs.existsSync(menuImageDir)) return (menuImages = []);
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

function formatUptime(ms) {
    const sec = Math.floor(ms / 1000);
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return `${hours} hours, ${mins} minutes, ${secs} seconds`;
}

function getTimeInfo() {
    const now = new Date();
    const time = new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit", hour12: true }).format(now);
    const hour = Number(new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", hour: "numeric", hour12: false }).format(now));
    let greeting = "Good Night";
    if (hour >= 5 && hour < 12) greeting = "Good Morning";
    else if (hour >= 12 && hour < 17) greeting = "Good Afternoon";
    else if (hour >= 17 && hour < 22) greeting = "Good Evening";
    return { time, greeting };
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

module.exports = {
    name: "menu",
    aliases: ["m", "allmenu"],

    run: async function ({ sock, from, message, args, sender }) {
        const settings = getSettings();
        const prefix = settings.prefix || "#";
        const botName = settings.botName || "VENOM X";
        const ownerName = settings.ownerName || "AYOMIDE";
        const ownerNumber = settings.ownerNumber || "";
        const timeInfo = getTimeInfo();
        const registry = getCommandRegistry(sock);
        const total = registry.size || 100;
        const pushName = message.pushName || "User";
        const uptime = formatUptime(Date.now() - startTime);
        const arg = (args[0] || "").toLowerCase();

        // ==================== MAIN MENU (Premium Style) ====================
        if (arg !== "all" && arg !== "full") {
            const caption = 
`╭─────────────────────────────
│  🌀 *${botName.toUpperCase()}*
╰─────────────────────────────
\( {timeInfo.greeting} @ \){sender.split("@")[0]}

┏━━━『 👤 USER INFO 』━━━
┃  NAME   : ${pushName}
┃  TAG    : @${sender.split("@")[0]}
┗━━━━━━━━━━━━━━━━━━━━

┏━━━『 ⚙️ SYSTEM INFO 』━━━
┃  BOT NAME  : ${botName}
┃  UPTIME    : ${uptime}
┃  PREFIX    : ${prefix}
┃  COMMANDS  : ${total}+
┃  PLATFORM  : Baileys
┗━━━━━━━━━━━━━━━━━━━━

> 「 CLICK FOR INSTANT ACCESS 」

⚡ *\( {botName}* by * \){ownerName}*`;

            const img = pickRandomImage();

            try {
                if (img && fs.existsSync(img)) {
                    await sock.sendMessage(from, {
                        image: fs.readFileSync(img),
                        caption: caption,
                        mentions: [sender],
                        contextInfo: {
                            externalAdReply: {
                                title: `${botName} | Menu`,
                                body: `Uptime: ${uptime}`,
                                mediaType: 1,
                                renderLargerThumbnail: true,
                                sourceUrl: "https://whatsapp.com/channel/0029VbBy7DlGZNCnNNoB0Q12"
                            }
                        }
                    }, { quoted: message });
                } else {
                    await sock.sendMessage(from, {
                        text: caption,
                        mentions: [sender]
                    }, { quoted: message });
                }
            } catch {
                await sock.sendMessage(from, { text: caption, mentions: [sender] }, { quoted: message });
            }
            return;
        }

        // ==================== FULL MENU ====================
        const fullMenu = 
`╭─────────────────────────────
│  🌀 *${botName.toUpperCase()} FULL MENU*
╰─────────────────────────────

┏━━━『 🧠 AI 』
┃ ${prefix}ai  ${prefix}ask  ${prefix}gpt
┃ ${prefix}nano  ${prefix}translate
┗━━━━━━━━━━━━

┏━━━『 📥 DOWNLOADS 』
┃ ${prefix}play  ${prefix}ytmp3  ${prefix}ytmp4
┃ ${prefix}tiktok  ${prefix}ig  ${prefix}fb
┗━━━━━━━━━━━━

┏━━━『 👥 GROUP 』
┃ ${prefix}tagall  ${prefix}hidetag  ${prefix}kick
┃ ${prefix}promote  ${prefix}demote  ${prefix}antilink
┃ ${prefix}warn  ${prefix}welcome  ${prefix}status2
┗━━━━━━━━━━━━

┏━━━『 🎮 FUN 』
┃ ${prefix}ship  ${prefix}pick  ${prefix}couple
┃ ${prefix}quote  ${prefix}insult  ${prefix}hack
┃ ${prefix}meme  ${prefix}truth  ${prefix}dare
┗━━━━━━━━━━━━

┏━━━『 🛠️ TOOLS 』
┃ ${prefix}weather  ${prefix}calc  ${prefix}qr
┃ ${prefix}define  ${prefix}wiki  ${prefix}crypto
┃ ${prefix}pint  ${prefix}ss  ${prefix}tts
┗━━━━━━━━━━━━

┏━━━『 👑 OWNER 』
┃ ${prefix}public  ${prefix}private  ${prefix}sudo
┃ ${prefix}broadcast  ${prefix}restart
┗━━━━━━━━━━━━

> Type *${prefix}menu* for the main menu
⚡ Powered by *${botName}*`;

        await sock.sendMessage(from, { text: fullMenu }, { quoted: message });
    }
};
