const fs = require("fs");
const path = require("path");

const dbFile = path.join(__dirname, "..", "database", "antichannel.json");

function load() {
    const dir = path.dirname(dbFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, "{}");
    try {
        return JSON.parse(fs.readFileSync(dbFile, "utf8") || "{}");
    } catch {
        return {};
    }
}

function save(db) {
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

module.exports = {
    name: "antichannelmessage",
    aliases: ["antichannel", "antich", "blockchannel"],

    run: async ({ from, args, reply, isGroup }) => {
        if (!isGroup) return reply("❌ Group only.");

        const db = load();
        const mode = String(args[0] || "").toLowerCase();

        if (mode === "on") {
            db[from] = true;
            save(db);
            return reply(
`╭━━〔 🛡️ ANTI CHANNEL 〕━━⬣

✅ Anti-channel message enabled

Channel / newsletter messages will be deleted.

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        if (mode === "off") {
            db[from] = false;
            save(db);
            return reply(
`╭━━〔 🛡️ ANTI CHANNEL 〕━━⬣

❌ Anti-channel message disabled

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        const status = db[from] ? "ON" : "OFF";
        return reply(
`╭━━〔 🛡️ ANTI CHANNEL 〕━━⬣

Status: ${status}

Usage:
#antichannelmessage on
#antichannelmessage off

╰━━━━━━━━━━━━━━━━⬣`
        );
    }
};
