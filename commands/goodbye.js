const fs = require("fs");
const path = require("path");

const dbFile = path.join(__dirname, "..", "database", "goodbye.json");

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
    name: "goodbye",
    aliases: ["setgoodbye", "bye"],

    run: async ({ from, args, reply, isGroup }) => {
        if (!isGroup) {
            return reply("❌ This command can only be used in groups.");
        }

        const db = load();
        const mode = String(args[0] || "").toLowerCase();

        if (mode === "on") {
            db[from] = true;
            save(db);
            return reply(
`╭━━〔 👋 VENOM X GOODBYE 〕━━⬣

✅ Goodbye enabled in this group

Members who leave will get a goodbye message.

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        if (mode === "off") {
            db[from] = false;
            save(db);
            return reply(
`╭━━〔 👋 VENOM X GOODBYE 〕━━⬣

❌ Goodbye disabled in this group

No goodbye messages will be sent here.

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        const status = db[from] === true ? "ON" : "OFF";
        return reply(
`╭━━〔 👋 VENOM X GOODBYE 〕━━⬣

Status: ${status}

Usage:
#goodbye on
#goodbye off

╰━━━━━━━━━━━━━━━━⬣`
        );
    }
};
