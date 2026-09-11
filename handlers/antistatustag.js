const fs = require("fs");
const path = require("path");

const dbFile = path.join(__dirname, "..", "database", "antistatustag.json");
const warnFile = path.join(__dirname, "..", "database", "antistatustag_warns.json");

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

function unwrap(message) {
    let current = message || {};
    for (var i = 0; i < 6; i++) {
        var wrapper =
            current.ephemeralMessage ||
            current.viewOnceMessage ||
            current.viewOnceMessageV2 ||
            current.viewOnceMessageV2Extension;
        if (!wrapper || !wrapper.message) break;
        current = wrapper.message;
    }
    return current;
}

function isStatusTagMessage(msg) {
    var raw = msg.message || {};
    var content = unwrap(raw);

    // Real WhatsApp group status tag
    if (raw.groupStatusMentionMessage) return true;
    if (content.groupStatusMentionMessage) return true;
    if (raw.protocolMessage && raw.protocolMessage.type === 25) return true;

    var ctx =
        (content.extendedTextMessage && content.extendedTextMessage.contextInfo) ||
        (content.imageMessage && content.imageMessage.contextInfo) ||
        (content.videoMessage && content.videoMessage.contextInfo) ||
        (content.audioMessage && content.audioMessage.contextInfo) ||
        (content.documentMessage && content.documentMessage.contextInfo) ||
        (content.stickerMessage && content.stickerMessage.contextInfo) ||
        {};

    // Only count it if they actually tagged / forwarded a STATUS
    if (ctx.remoteJid === "status@broadcast" && ctx.quotedMessage) return true;

    if (Array.isArray(ctx.statusAttributions) && ctx.statusAttributions.length) {
        for (var i = 0; i < ctx.statusAttributions.length; i++) {
            var attr = ctx.statusAttributions[i] || {};
            if (attr.type === "RESHARE" || attr.type === 2 || attr.statusReshare) return true;
        }
    }

    // Do NOT treat normal videos/images as status tags
    return false;
}

module.exports = async function antiStatusTag(sock, msg) {
    try {
        var from = msg.key && msg.key.remoteJid;
        if (!from || from.indexOf("@g.us") === -1) return;
        if (msg.key.fromMe) return;

        var db = loadJSON(dbFile);
        if (!db[from]) return;

        if (!isStatusTagMessage(msg)) return;

        var sender = msg.key.participant || msg.key.remoteJid;
        if (!sender) return;

        await sock.sendMessage(from, { delete: msg.key }).catch(function () {});

        var warns = loadJSON(warnFile);
        if (!warns[from]) warns[from] = {};

        var key = String(sender);
        var count = (warns[from][key] || 0) + 1;
        warns[from][key] = count;
        saveJSON(warnFile, warns);

        var mentionName = cleanNumber(sender);

        if (count >= MAX) {
            try {
                await sock.groupParticipantsUpdate(from, [sender], "remove");
                warns[from][key] = 0;
                saveJSON(warnFile, warns);

                await sock.sendMessage(from, {
                    text:
"╭━━〔 🚨 VENOM ANTI STATUS TAG 〕━━⬣\n" +
"┃\n" +
"┃ 👤 @" + mentionName + "\n" +
"┃\n" +
"┃ 🏷️ Status tag detected\n" +
"┃ 🗑️ Message deleted\n" +
"┃\n" +
"┃ ⚠️ Warning: " + MAX + "/" + MAX + "\n" +
"┃ 🥾 Removed from group\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣",
                    mentions: [sender]
                });
            } catch (err) {
                await sock.sendMessage(from, {
                    text:
"╭━━〔 🚨 VENOM ANTI STATUS TAG 〕━━⬣\n" +
"┃\n" +
"┃ 👤 @" + mentionName + "\n" +
"┃\n" +
"┃ 🏷️ Status tag detected\n" +
"┃ 🗑️ Message deleted\n" +
"┃\n" +
"┃ ⚠️ Warning: " + MAX + "/" + MAX + "\n" +
"┃ ❌ Removal failed\n" +
"┃ Make sure VENOM X is admin\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣",
                    mentions: [sender]
                });
            }
            return;
        }

        var remaining = MAX - count;
        var extra = remaining === 1
            ? "⚠️ Next violation will remove the member."
            : "Please stop tagging status in this group.";

        await sock.sendMessage(from, {
            text:
"╭━━〔 🛡️ VENOM ANTI STATUS TAG 〕━━⬣\n" +
"┃\n" +
"┃ 👤 @" + mentionName + "\n" +
"┃\n" +
"┃ 🏷️ Status tag detected\n" +
"┃ 🗑️ Message deleted\n" +
"┃\n" +
"┃ ⚠️ Warning: " + count + "/" + MAX + "\n" +
"┃ 🚨 Warnings left: " + remaining + "\n" +
"┃\n" +
"┃ " + extra + "\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣",
            mentions: [sender]
        });
    } catch (err) {
        console.log("ANTISTATUSTAG ERROR:", err.message);
    }
};
