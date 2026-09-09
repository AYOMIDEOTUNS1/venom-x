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

function hasLink(text = "") {
    if (!text) return false;
    const regex = /(https?:\/\/[^\s]+)|(chat\.whatsapp\.com\/[A-Za-z0-9]+)|(wa\.me\/[0-9]+)|(www\.[^\s]+)/gi;
    return regex.test(text);
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
        content.extendedTextMessage?.text ||
        content.imageMessage?.caption ||
        content.videoMessage?.caption ||
        content.documentMessage?.caption ||
        ""
    );
}

module.exports = async function antiLinkHandler(sock, msg) {
    try {
        if (!msg?.key || !msg.message) return;
        if (msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        if (!from?.endsWith("@g.us")) return;

        const db = load();
        const groupData = db[from];

        // Support both old format (true/false) and new format ({enabled, action})
        const isEnabled = groupData === true || groupData?.enabled === true;
        if (!isEnabled) return;

        const text = extractText(msg);
        if (!hasLink(text)) return;

        const sender = msg.key.participant || msg.key.remoteJid;

        // Get group metadata to check admins
        let metadata;
        try {
            metadata = await sock.groupMetadata(from);
        } catch {
            return;
        }

        const participants = metadata.participants || [];
        const senderData = participants.find(p => 
            p.id === sender || 
            p.id?.split(":")[0] === sender?.split(":")[0]
        );

        // Don't punish admins
        if (senderData?.admin === "admin" || senderData?.admin === "superadmin") {
            return;
        }

        // Check if bot is admin
        const botId = sock.user?.id;
        const botData = participants.find(p => 
            p.id === botId || 
            p.id?.split(":")[0] === botId?.split(":")[0]
        );
        const isBotAdmin = botData?.admin === "admin" || botData?.admin === "superadmin";

        // Delete the message
        try {
            await sock.sendMessage(from, { delete: msg.key });
        } catch (e) {
            console.log("[Antilink] Failed to delete message:", e.message);
        }

        const action = (typeof groupData === "object" && groupData.action) ? groupData.action : "warn";

        // ========== INSTANT KICK MODE ==========
        if (action === "kick") {
            if (!isBotAdmin) {
                await sock.sendMessage(from, {
                    text: `🚫 Link detected from @${normalize(sender)}\n\n❌ I need to be admin to kick.`,
                    mentions: [sender]
                });
                return;
            }

            try {
                await sock.groupParticipantsUpdate(from, [sender], "remove");
                await sock.sendMessage(from, {
                    text: `🚫 *Link Detected!*\n\n👤 @${normalize(sender)}\n🚪 Removed from the group.`,
                    mentions: [sender]
                });
            } catch (e) {
                await sock.sendMessage(from, {
                    text: `🚫 Link detected but failed to kick @${normalize(sender)}.`,
                    mentions: [sender]
                });
            }
            return;
        }

        // ========== WARNING SYSTEM ==========
        const result = warningEngine.addWarning(from, sender, "Sending link / invite");

        if (result.count >= warningEngine.MAX_WARNINGS) {
            // Reset warnings and kick
            warningEngine.resetWarnings(from, sender);

            if (isBotAdmin) {
                try {
                    await sock.groupParticipantsUpdate(from, [sender], "remove");
                    await sock.sendMessage(from, {
                        text: `🚫 *Final Warning - Link Detected!*\n\n👤 @${normalize(sender)}\n⚠️ Warnings: \( {result.count}/ \){warningEngine.MAX_WARNINGS}\n🚪 Removed from the group.`,
                        mentions: [sender]
                    });
                } catch {
                    await sock.sendMessage(from, {
                        text: `🚫 @${normalize(sender)} reached max warnings but I couldn't kick them.`,
                        mentions: [sender]
                    });
                }
            } else {
                await sock.sendMessage(from, {
                    text: `🚫 @${normalize(sender)} reached ${result.count} warnings (max).\n❌ I need admin rights to kick.`,
                    mentions: [sender]
                });
            }
        } else {
            const left = warningEngine.MAX_WARNINGS - result.count;
            await sock.sendMessage(from, {
                text: `⚠️ *Link Detected!*\n\n👤 @\( {normalize(sender)}\n⚠️ Warning: * \){result.count}/\( {warningEngine.MAX_WARNINGS}*\n📝 Reason: Sending link\n\n \){left === 1 ? "🚨 Next warning = Kick" : `You have ${left} warning(s) left.`}`,
                mentions: [sender]
            });
        }

    } catch (err) {
        console.error("[Antilink Handler Error]", err.message);
    }
};
