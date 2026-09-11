const fs = require("fs");
const path = require("path");
const warningEngine = require("../lib/warningEngine");

const dbFile = path.join(__dirname, "..", "database", "antilink.json");

function load() {
    try {
        if (!fs.existsSync(dbFile)) return {};
        const raw = fs.readFileSync(dbFile, "utf8");
        return raw.trim() ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function hasLink(text) {
    if (!text) return false;
    return /(https?:\/\/[^\s]+)|(chat\.whatsapp\.com\/[A-Za-z0-9]+)|(wa\.me\/[0-9]+)|(www\.[^\s]+)/gi.test(text);
}

function normalize(id) {
    return String(id || "").split(":")[0].split("@")[0];
}

function extractText(msg) {
    let content = msg.message || {};
    if (content.ephemeralMessage) content = content.ephemeralMessage.message || {};
    if (content.viewOnceMessage) content = content.viewOnceMessage.message || {};
    if (content.viewOnceMessageV2) content = content.viewOnceMessageV2.message || {};

    return (
        content.conversation ||
        (content.extendedTextMessage && content.extendedTextMessage.text) ||
        (content.imageMessage && content.imageMessage.caption) ||
        (content.videoMessage && content.videoMessage.caption) ||
        (content.documentMessage && content.documentMessage.caption) ||
        ""
    );
}

module.exports = async function antiLinkHandler(sock, msg) {
    try {
        if (!msg || !msg.key || !msg.message) return;
        if (msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        if (!from || from.indexOf("@g.us") === -1) return;

        const db = load();
        const groupData = db[from];
        const isEnabled = groupData === true || (groupData && groupData.enabled === true);
        if (!isEnabled) return;

        const text = extractText(msg);
        if (!hasLink(text)) return;

        const sender = msg.key.participant || msg.key.remoteJid;

        let metadata;
        try {
            metadata = await sock.groupMetadata(from);
        } catch {
            return;
        }

        const participants = metadata.participants || [];
        const senderData = participants.find(function (p) {
            return p.id === sender || (p.id && sender && p.id.split(":")[0] === sender.split(":")[0]);
        });

        if (senderData && (senderData.admin === "admin" || senderData.admin === "superadmin")) return;

        const botId = sock.user && sock.user.id;
        const botData = participants.find(function (p) {
            return p.id === botId || (p.id && botId && p.id.split(":")[0] === botId.split(":")[0]);
        });
        const isBotAdmin = botData && (botData.admin === "admin" || botData.admin === "superadmin");

        try {
            await sock.sendMessage(from, { delete: msg.key });
        } catch (e) {}

        const action = (groupData && typeof groupData === "object" && groupData.action) ? groupData.action : "warn";
        const name = normalize(sender);

        if (action === "kick") {
            if (!isBotAdmin) {
                await sock.sendMessage(from, {
                    text: "🚫 Link detected from @" + name + "\n\n❌ I need to be admin to kick.",
                    mentions: [sender]
                });
                return;
            }
            try {
                await sock.groupParticipantsUpdate(from, [sender], "remove");
                await sock.sendMessage(from, {
                    text: "🚫 *Link Detected!*\n\n👤 @" + name + "\n🚪 Removed from the group.",
                    mentions: [sender]
                });
            } catch (e) {
                await sock.sendMessage(from, {
                    text: "🚫 Link detected but failed to kick @" + name + ".",
                    mentions: [sender]
                });
            }
            return;
        }

        const result = warningEngine.addWarning(from, sender, "Sending link / invite");
        const max = warningEngine.MAX_WARNINGS;

        if (result.count >= max) {
            warningEngine.resetWarnings(from, sender);

            if (isBotAdmin) {
                try {
                    await sock.groupParticipantsUpdate(from, [sender], "remove");
                    await sock.sendMessage(from, {
                        text: "🚫 *Final Warning - Link Detected!*\n\n👤 @" + name + "\n⚠️ Warnings: " + result.count + "/" + max + "\n🚪 Removed from the group.",
                        mentions: [sender]
                    });
                } catch {
                    await sock.sendMessage(from, {
                        text: "🚫 @" + name + " reached max warnings but I couldn't kick them.",
                        mentions: [sender]
                    });
                }
            } else {
                await sock.sendMessage(from, {
                    text: "🚫 @" + name + " reached " + result.count + " warnings (max).\n❌ I need admin rights to kick.",
                    mentions: [sender]
                });
            }
        } else {
            const left = max - result.count;
            const extra = left === 1 ? "🚨 Next warning = Kick" : "You have " + left + " warning(s) left.";
            await sock.sendMessage(from, {
                text: "⚠️ *Link Detected!*\n\n👤 @" + name + "\n⚠️ Warning: *" + result.count + "/" + max + "*\n📝 Reason: Sending link\n\n" + extra,
                mentions: [sender]
            });
        }
    } catch (err) {
        console.error("[Antilink Handler Error]", err.message);
    }
};
