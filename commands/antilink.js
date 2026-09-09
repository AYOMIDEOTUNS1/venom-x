const fs = require("fs");
const path = require("path");

const dbFile = path.join(__dirname, "..", "database", "antilink.json");

function load() {
    const dir = path.dirname(dbFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, "{}");
    try {
        const raw = fs.readFileSync(dbFile, "utf8");
        return raw.trim() ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function save(db) {
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

module.exports = {
    name: "antilink",
    aliases: ["antilink"],

    run: async ({ from, reply, args }) => {
        if (!from.endsWith("@g.us")) {
            return reply("❌ This command can only be used in groups.");
        }

        const db = load();
        const mode = String(args?.[0] || "").toLowerCase();

        if (mode === "on") {
            db[from] = { enabled: true, action: "warn" }; // warn by default
            save(db);
            return reply(`╭━━〔 🛡️ ANTILINK 〕━━⬣
┃
┃ ✅ Antilink *enabled*
┃
┃ 🔗 Links will be deleted
┃ ⚠️ Action: Warning system
┃
┃ 1st link → Warning
┃ 2nd link → Warning
┃ 3rd link → Kick
┃
╰━━━━━━━━━━━━━━━━⬣`);
        }

        if (mode === "off") {
            db[from] = { enabled: false };
            save(db);
            return reply(`╭━━〔 🛡️ ANTILINK 〕━━⬣
┃
┃ ❌ Antilink *disabled*
┃
┃ Links are now allowed.
╰━━━━━━━━━━━━━━━━⬣`);
        }

        if (mode === "kick") {
            db[from] = { enabled: true, action: "kick" };
            save(db);
            return reply(`╭━━〔 🛡️ ANTILINK 〕━━⬣
┃
┃ ✅ Antilink enabled
┃ 🚪 Action set to: *Instant Kick*
╰━━━━━━━━━━━━━━━━⬣`);
        }

        if (mode === "warn") {
            db[from] = { enabled: true, action: "warn" };
            save(db);
            return reply(`╭━━〔 🛡️ ANTILINK 〕━━⬣
┃
┃ ✅ Antilink enabled
┃ ⚠️ Action set to: *Warning System*
╰━━━━━━━━━━━━━━━━⬣`);
        }

        const status = db[from]?.enabled ? "ON" : "OFF";
        const action = db[from]?.action || "warn";

        return reply(`╭━━〔 🛡️ ANTILINK 〕━━⬣
┃
┃ Status : *${status}*
┃ Action : *${action}*
┃
┃ Usage:
┃ #antilink on
┃ #antilink off
┃ #antilink warn
┃ #antilink kick
┃
╰━━━━━━━━━━━━━━━━⬣`);
    }
};
