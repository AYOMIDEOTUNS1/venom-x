const fs = require("fs");
const path = require("path");

const dbFile = path.join(__dirname, "..", "database", "antistatustag.json");

function load() {
    try {
        if (!fs.existsSync(dbFile)) return {};
        const raw = fs.readFileSync(dbFile, "utf8");
        return raw.trim() ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

function save(db) {
    const dir = path.dirname(dbFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

async function isAdmin(sock, groupJid, userJid) {
    try {
        const meta = await sock.groupMetadata(groupJid);
        const hit = (meta.participants || []).find(function (x) {
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

module.exports = {
    name: "antigroupstatus",
    aliases: [
        "antigroupstatuses",
        "antigstatus",
        "groupstatusguard",
        "antistatustag"
    ],

    run: async function ({ sock, from, sender, args, reply, isGroup, isOwner, isPrivileged }) {
        if (!isGroup) return reply("❌ Group only.");

        const admin = await isAdmin(sock, from, sender);
        if (!admin && !isOwner && !isPrivileged) {
            return reply("❌ Admins only.");
        }

        const arg = String((args && args[0]) || "status").toLowerCase();
        const db = load();
        const current = !!db[from];

        if (arg === "status") {
            return reply(
"╭━━〔 🛡️ ANTI GROUP STATUS 〕━━⬣\n" +
"┃ Status: *" + (current ? "ON" : "OFF") + "*\n" +
"┃\n" +
"┃ Deletes group status / status-mention\n" +
"┃ messages. Admins exempt.\n" +
"┃\n" +
"┃ #antigroupstatus on\n" +
"┃ #antigroupstatus off\n" +
"┃ #antigroupstatus status\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        if (arg !== "on" && arg !== "off") {
            return reply("Use: #antigroupstatus on | off | status");
        }

        if (arg === "on") {
            db[from] = true;
            save(db);
            return reply(
"╭━━〔 🛡️ ANTI GROUP STATUS 〕━━⬣\n" +
"┃ Turned *ON*\n" +
"┃ 🚫 Status shares will be deleted.\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        delete db[from];
        save(db);
        return reply(
"╭━━〔 🛡️ ANTI GROUP STATUS 〕━━⬣\n" +
"┃ Turned *OFF*\n" +
"┃ ✅ Status shares allowed.\n" +
"╰━━━━━━━━━━━━━━━━⬣"
        );
    }
};
