const fs = require("fs");
const path = require("path");
const warningEngine = require("../lib/warningEngine");

const antiLinkFile = path.join(__dirname, "..", "database", "antilink.json");
const settings = require("../settings.json");

function loadAntiLink() {
    try {
        if (!fs.existsSync(antiLinkFile)) {
            fs.mkdirSync(path.dirname(antiLinkFile), { recursive: true });
            fs.writeFileSync(antiLinkFile, "{}");
            return {};
        }
        const raw = fs.readFileSync(antiLinkFile, "utf8");
        if (!raw.trim()) return {};
        const data = JSON.parse(raw);
        return data && typeof data === "object" ? data : {};
    } catch (error) {
        console.error("ANTILINK DATABASE ERROR:", error.message);
        return {};
    }
}

function normalize(id) {
    if (!id) return null;
    let value = String(id);
    if (value.includes(":")) value = value.split(":")[0];
    return value;
}

function cleanNumber(id) {
    return String(id || "").replace(/[^0-9]/g, "");
}

function getText(message) {
    const content =
        message?.message?.ephemeralMessage?.message ||
        message?.message?.viewOnceMessage?.message ||
        message?.message?.viewOnceMessageV2?.message ||
        message?.message;

    return (
        content?.conversation ||
        content?.extendedTextMessage?.text ||
        content?.imageMessage?.caption ||
        content?.videoMessage?.caption ||
        content?.documentMessage?.caption ||
        ""
    );
}

function containsLink(text) {
    if (!text) return false;
    const t = String(text).toLowerCase();
    return (
        /https?:\/\/[^\s]+/i.test(t) ||
        /www\.[^\s]+/i.test(t) ||
        /chat\.whatsapp\.com\/[A-Za-z0-9]+/i.test(t) ||
        /wa\.me\/[0-9]+/i.test(t) ||
        /t\.me\/[^\s]+/i.test(t)
    );
}

module.exports = async (sock, msg) => {
    try {
        if (!msg?.message || !msg?.key) return;

        // Ignore system / own messages
        if (msg.key.fromMe) return;
        if (
            msg.message.protocolMessage ||
            msg.message.senderKeyDistributionMessage ||
            msg.message.pollUpdateMessage
        ) return;

        const from = msg.key.remoteJid;
        if (!from?.endsWith("@g.us")) return;

        const antiLinkDB = loadAntiLink();
        if (antiLinkDB[from] !== true) return;

        const sender = normalize(msg.key.participant || msg.participant || msg.key.remoteJid);
        if (!sender) return;

        const text = getText(msg);
        if (!text || !containsLink(text)) return;

        console.log("🔗 ANTILINK DETECTED:", text.slice(0, 80));

        // Get group metadata
        let metadata;
        try {
            metadata = await sock.groupMetadata(from);
        } catch (err) {
            console.log("ANTILINK METADATA ERROR:", err.message);
            return;
        }

        const participants = metadata?.participants || [];

        // Check if bot is admin
        const botId = normalize(sock.user?.id);
        const botNumber = cleanNumber(botId);

        const botParticipant = participants.find(p => {
            const pid = normalize(p.id);
            return pid === botId || cleanNumber(pid) === botNumber;
        });

        const botIsAdmin = botParticipant?.admin === "admin" || botParticipant?.admin === "superadmin";

        if (!botIsAdmin) {
            console.log("⚠️ ANTILINK: Bot is not admin in this group");
            return;
        }

        // Check if sender is admin or owner
        const senderParticipant = participants.find(p => {
            const pid = normalize(p.id);
            return pid === sender || cleanNumber(pid) === cleanNumber(sender);
        });

        const senderIsAdmin = senderParticipant?.admin === "admin" || senderParticipant?.admin === "superadmin";
        if (senderIsAdmin) return;

        const ownerNumber = cleanNumber(settings.ownerNumber);
        const ownerLid = cleanNumber(settings.ownerLid || "");
        const senderNum = cleanNumber(sender);

        if (senderNum === ownerNumber || (ownerLid && senderNum === ownerLid)) {
            return;
        }

        // Delete the message
        try {
            await sock.sendMessage(from, { delete: msg.key });
            console.log("🗑️ ANTILINK: Message deleted");
        } catch (err) {
            console.log("⚠️ ANTILINK DELETE ERROR:", err.message);
        }

        // Warning system
        const result = warningEngine.addWarning(
            from,
            sender,
            "Sending links while antilink is enabled"
        );

        const count = Number(result.count);
        const max = warningEngine.MAX_WARNINGS;

        if (count >= max) {
            try {
                await sock.groupParticipantsUpdate(from, [sender], "remove");
                warningEngine.resetWarnings(from, sender);

                return sock.sendMessage(from, {
                    text:
`╭━━〔 🚫 VENOM ANTILINK 〕━━⬣
┃
┃ 👤 @${senderNum}
┃
┃ 🔗 Link detected.
┃ 🗑️ Message deleted.
┃
┃ ⚠️ Warning : \( {max}/ \){max}
┃
┃ 🚪 Maximum warnings reached.
┃ ❌ Member removed.
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                });
            } catch (err) {
                console.error("ANTILINK REMOVE ERROR:", err.message);
                return sock.sendMessage(from, {
                    text:
`╭━━〔 🚨 VENOM ANTILINK 〕━━⬣
┃
┃ 👤 @${senderNum}
┃
┃ 🔗 Link detected.
┃ 🗑️ Message deleted.
┃
┃ ⚠️ Warning : \( {max}/ \){max}
┃
┃ ❌ Removal failed (bot needs admin).
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                });
            }
        }

        const remaining = max - count;

        return sock.sendMessage(from, {
            text:
`╭━━〔 🛡️ VENOM ANTILINK 〕━━⬣
┃
┃ 👤 @${senderNum}
┃
┃ 🔗 Link detected!
┃ 🗑️ Message deleted.
┃
┃ ⚠️ Warning : \( {count}/ \){max}
┃
┃ 🚨 Warnings left : ${remaining}
┃
┃ ${remaining === 1 ? "⚠️ Next violation will remove the member." : "Please stop sending links."}
╰━━━━━━━━━━━━━━━━⬣`,
            mentions: [sender]
        });

    } catch (error) {
        console.error("ANTILINK ERROR:", error.message);
    }
};
