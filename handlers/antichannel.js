const fs = require("fs");
const path = require("path");

const dbFile = path.join(__dirname, "..", "database", "antichannel.json");
const warnFile = path.join(__dirname, "..", "database", "antichannel_warns.json");

const MAX = 3;

function loadJSON(file) {
    try {
        if (!fs.existsSync(file)) return {};
        return JSON.parse(fs.readFileSync(file, "utf8") || "{}");
    } catch {
        return {};
    }
}

function saveJSON(file, data) {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function cleanNumber(jid) {
    return String(jid || "").split("@")[0].replace(/\D/g, "") || "user";
}

function isChannelMessage(msg) {
    const m = msg.message || {};
    const content =
        m.ephemeralMessage?.message ||
        m.viewOnceMessage?.message ||
        m.viewOnceMessageV2?.message ||
        m;

    if (String(msg.key?.remoteJid || "").endsWith("@newsletter")) return true;

    const ctx =
        content.extendedTextMessage?.contextInfo ||
        content.imageMessage?.contextInfo ||
        content.videoMessage?.contextInfo ||
        content.documentMessage?.contextInfo ||
        content.audioMessage?.contextInfo ||
        content.stickerMessage?.contextInfo ||
        {};

    if (ctx.forwardedNewsletterMessageInfo) return true;
    if (ctx.newsletterId || ctx.newsletterServerMessageId) return true;

    const text = String(
        content.conversation ||
        content.extendedTextMessage?.text ||
        content.imageMessage?.caption ||
        content.videoMessage?.caption ||
        content.documentMessage?.caption ||
        ""
    );

    if (/whatsapp\.com\/channel\//i.test(text)) return true;
    if (/@newsletter/i.test(text)) return true;

    return false;
}

module.exports = async function antiChannel(sock, msg) {
    try {
        const from = msg.key?.remoteJid;
        if (!from || !from.endsWith("@g.us")) return;
        if (msg.key.fromMe) return;

        const db = loadJSON(dbFile);
        if (!db[from]) return;

        if (!isChannelMessage(msg)) return;

        const sender = msg.key.participant || msg.key.remoteJid;
        if (!sender) return;

        // Delete channel message
        await sock.sendMessage(from, { delete: msg.key }).catch(() => {});

        // Warnings
        const warns = loadJSON(warnFile);
        if (!warns[from]) warns[from] = {};

        const key = String(sender);
        const count = (warns[from][key] || 0) + 1;
        warns[from][key] = count;
        saveJSON(warnFile, warns);

        const mentionName = cleanNumber(sender);

        // Kick on 3rd warning
        if (count >= MAX) {
            try {
                await sock.groupParticipantsUpdate(from, [sender], "remove");
                warns[from][key] = 0;
                saveJSON(warnFile, warns);

                await sock.sendMessage(from, {
                    text:
`╭━━〔 🚨 VENOM ANTI CHANNEL 〕━━⬣
┃
┃ 👤 @${mentionName}
┃
┃ 📢 Channel message detected
┃ 🗑️ Message deleted
┃
┃ ⚠️ Warning: \( {MAX}/ \){MAX}
┃ 🥾 Removed from group
┃
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                });
            } catch (err) {
                await sock.sendMessage(from, {
                    text:
`╭━━〔 🚨 VENOM ANTI CHANNEL 〕━━⬣
┃
┃ 👤 @${mentionName}
┃
┃ 📢 Channel message detected
┃ 🗑️ Message deleted
┃
┃ ⚠️ Warning: \( {MAX}/ \){MAX}
┃ ❌ Removal failed
┃ Make sure VENOM X is admin
┃
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                });
            }
            return;
        }

        const remaining = MAX - count;

        await sock.sendMessage(from, {
            text:
`╭━━〔 🛡️ VENOM ANTI CHANNEL 〕━━⬣
┃
┃ 👤 @${mentionName}
┃
┃ 📢 Channel message detected
┃ 🗑️ Message deleted
┃
┃ ⚠️ Warning: \( {count}/ \){MAX}
┃ 🚨 Warnings left: ${remaining}
┃
┃ ${remaining === 1 ? "⚠️ Next violation will remove the member." : "Please stop sending channel messages."}
┃
╰━━━━━━━━━━━━━━━━⬣`,
            mentions: [sender] 
        });
    } catch (err) {
        console.log("ANTICHANNEL ERROR:", err.message);
    }
};
