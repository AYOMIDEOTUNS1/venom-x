"use strict";
const fs = require("fs");
const path = require("path");
const DB = path.join(__dirname, "..", "database", "antilink.json");

function load() {
    try {
        if (!fs.existsSync(DB)) return {};
        return JSON.parse(fs.readFileSync(DB, "utf8") || "{}");
    } catch { return {}; }
}
function save(db) {
    const dir = path.dirname(DB);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB, JSON.stringify(db, null, 2));
}

module.exports = {
    name: "antilink",
    aliases: ["anti-link"],
    run: async function ({ from, args, reply }) {
        if (!from.endsWith("@g.us")) return reply("❌ Groups only.");
        const mode = String(args[0] || "").toLowerCase();
        const db = load();
        if (mode === "on") {
            db[from] = true;
            save(db);
            return reply("✅ Antilink *ON* for this group.");
        }
        if (mode === "off") {
            db[from] = false;
            save(db);
            return reply("✅ Antilink *OFF* for this group.");
        }
        return reply(
            "Antilink: *" + (db[from] ? "ON" : "OFF") + "*\nUse: #antilink on | off"
        );
    }
};
