const fs = require("fs");
const path = require("path");
const warningEngine = require("./warningEngine");

const dbFile = path.join(__dirname, "..", "database", "antilink.json");

function loadAntilink() {
    try {
        if (!fs.existsSync(dbFile)) return {};
        return JSON.parse(fs.readFileSync(dbFile, "utf8"));
    } catch {
        return {};
    }
}

function hasLink(text = "") {
    const linkRegex = /(https?:\/\/[^\s]+)|(?:chat\.whatsapp\.com\/[A-Za-z0-9]+)|(wa\.me\/[0-9]+)|(www\.[^\s]+)/gi;
    return linkRegex.test(text);
}

function normalize(id) {
    if (!id) return null;
    return String(id).split(":")[0];
}

/**
 * Call this function inside your main message handler
 */
async function handleAntiLink({ sock, message, from, sender, isGroup, isAdmin, isBotAdmin, reply }) {
    try {
        if (!isGroup) return false;

        const db = loadAntilink();
        const groupData = db[from];

        if (!groupData || !groupData.enabled) return false;

        // Get message text
        const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            message.message?.videoMessage?.caption ||
            "";

        if (!hasLink(text)) return false;

        // Don't punish admins
        if (isAdmin) return false;

        // Delete the message
        try {
            await sock.sendMessage(from, { delete: message.key });
        } catch (e) {
            console.log("Failed to delete link message:", e.message);
        }

        const action = groupData.action || "warn";

        // ========== INSTANT KICK ==========
        if (action === "kick") {
            if (!isBotAdmin) {
                await sock.sendMessage(from, {
                    text: `🚫 Link detected from @${normalize(sender).split("@")[0]}\n\n❌ I need admin rights to kick.`,
                    mentions: [sender]
                });
                return true;
            }

            try {
                await sock.groupParticipantsUpdate(from, [sender], "remove");
                await sock.sendMessage(from, {
                    text: `🚫 *Link Detected!*\n\n👤 @${normalize(sender).split("@")[0]}\n🚪 Removed from the group.`,
                    mentions: [sender]
                });
            } catch (e) {
                await sock.sendMessage(from, {
                    text: `🚫 Link detected but I couldn't kick the user.`
                });
            }
            return true;
        }

        // ========== WARNING SYSTEM ==========
        const result = warningEngine.addWarning(from, sender, "Sending group/invite link");

        if (result.count >= warningEngine.MAX_WARNINGS) {
            warningEngine.resetWarnings(from, sender);

            if (isBotAdmin) {
                try {
                    await sock.groupParticipantsUpdate(from, [sender], "remove");
                    await sock.sendMessage(from, {
                        text: `🚫 *Link Detected - Final Warning!*\n\n👤 @${normalize(sender).split("@")[0]}\n⚠️ Warnings: \( {result.count}/ \){warningEngine.MAX_WARNINGS}\n🚪 Removed from the group.`,
                        mentions: [sender]
                    });
                } catch {
                    await sock.sendMessage(from, {
                        text: `🚫 @${normalize(sender).split("@")[0]} reached max warnings but I couldn't kick them.`,
                        mentions: [sender]
                    });
                }
            }
        } else {
            await sock.sendMessage(from, {
                text: `⚠️ *Link Detected!*\n\n👤 @${normalize(sender).split("@")[0]}\n⚠️ Warning: \( {result.count}/ \){warningEngine.MAX_WARNINGS}\n📝 Reason: Sending link\n\n${result.count === 2 ? "🚨 Next warning = Kick" : "Please don't send links."}`,
                mentions: [sender]
            });
        }

        return true;
    } catch (err) {
        console.error("Antilink Handler Error:", err.message);
        return false;
    }
}

module.exports = { handleAntiLink, hasLink };
