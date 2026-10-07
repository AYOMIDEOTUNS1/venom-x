const fs = require("fs");
const path = require("path");

const dbFile = path.join(__dirname, "..", "database", "antistatustag.json");
const warnFile = path.join(__dirname, "..", "database", "antistatustag_warns.json");
const MAX = 3;

function loadJSON(file) {
    try {
        if (!fs.existsSync(file)) return {};
        const raw = fs.readFileSync(file, "utf8");
        return raw.trim() ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

function saveJSON(file, data) {
    try {
        const dir = path.dirname(file);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch (e) {}
}

function isStatusMention(msg) {
    try {
        if (!msg || !msg.message) return false;
        const m = msg.message;

        if (m.groupStatusMentionMessage) return true;
        if (m.statusMentionMessage) return true;

        const ctx =
            (m.extendedTextMessage && m.extendedTextMessage.contextInfo) ||
            (m.imageMessage && m.imageMessage.contextInfo) ||
            (m.videoMessage && m.videoMessage.contextInfo) ||
            (m.documentMessage && m.documentMessage.contextInfo) ||
            (m.audioMessage && m.audioMessage.contextInfo) ||
            (m.stickerMessage && m.stickerMessage.contextInfo) ||
            {};

        if (ctx.remoteJid === "status@broadcast") return true;
        if (ctx.entryPointConversionSource === "status_reply") return true;

        return false;
    } catch (e) {
        return false;
    }
}

async function isAdmin(sock, groupJid, userJid) {
    try {
        const meta = await sock.groupMetadata(groupJid);
        const parts = meta.participants || [];
        const hit = parts.find(function (x) {
            const id = x.id || x.jid;
            if (!id || !userJid) return false;
            if (id === userJid) return true;
            return String(id).split("@")[0] === String(userJid).split("@")[0];
        });
        return !!(hit && (hit.admin === "admin" || hit.admin === "superadmin"));
    } catch (e) {
        return false;
    }
}

module.exports = function (sock) {
    if (!sock || !sock.ev) {
        console.log("⚠️ antistatustag: invalid sock");
        return;
    }

    console.log("✅ Anti Status Tag handler loaded");

    sock.ev.on("messages.upsert", async function (chatUpdate) {
        try {
            const messages = chatUpdate && chatUpdate.messages;
            if (!messages || !messages.length) return;

            const msg = messages[0];
            if (!msg || !msg.key || !msg.message) return;
            if (msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            if (!from || !String(from).endsWith("@g.us")) return;

            const db = loadJSON(dbFile);
            if (!db[from]) return;

            if (!isStatusMention(msg)) return;

            const sender = msg.key.participant || msg.participant;
            if (!sender) return;

            // admins exempt
            if (await isAdmin(sock, from, sender)) return;

            try {
                await sock.sendMessage(from, { delete: msg.key });
            } catch (e) {}

            const warns = loadJSON(warnFile);
            if (!warns[from]) warns[from] = {};
            const key = String(sender);
            warns[from][key] = (Number(warns[from][key]) || 0) + 1;
            const count = warns[from][key];
            saveJSON(warnFile, warns);

            const mentionName = String(sender).split("@")[0];

            if (count >= MAX) {
                try {
                    await sock.groupParticipantsUpdate(from, [sender], "remove");
                    warns[from][key] = 0;
                    saveJSON(warnFile, warns);
                    await sock.sendMessage(from, {
                        text:
"╭━━〔 🚨 ANTI STATUS TAG 〕━━⬣\n" +
"┃ @" + mentionName + "\n" +
"┃ Status tag ×" + MAX + "\n" +
"┃ 🥾 Removed\n" +
"╰━━━━━━━━━━━━━━━━⬣",
                        mentions: [sender]
                    });
                } catch (e) {
                    await sock.sendMessage(from, {
                        text:
"╭━━〔 🚨 ANTI STATUS TAG 〕━━⬣\n" +
"┃ @" + mentionName + "\n" +
"┃ Max warns — kick failed (bot needs admin)\n" +
"╰━━━━━━━━━━━━━━━━⬣",
                        mentions: [sender]
                    });
                }
                return;
            }

            await sock.sendMessage(from, {
                text:
"╭━━〔 🛡️ ANTI STATUS TAG 〕━━⬣\n" +
"┃ @" + mentionName + "\n" +
"┃ Status share deleted\n" +
"┃ Warn: " + count + "/" + MAX + "\n" +
"╰━━━━━━━━━━━━━━━━⬣",
                mentions: [sender]
            });
        } catch (err) {
            console.log("ANTISTATUSTAG ERROR:", err && err.message ? err.message : err);
        }
    });
};
