"use strict";
const fs = require("fs");
const path = require("path");
const DB = path.join(__dirname, "..", "database", "antistatustag.json");

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
    name: "antistatustag",
    aliases: ["ast", "antistatus"],
    run: async function ({ from, args, reply }) {
        if (!from.endsWith("@g.us")) return reply("❌ Groups only.");
        const mode = String(args[0] || "").toLowerCase();
        const db = load();
        if (mode === "on") {
            db[from] = true;
            save(db);
            return reply("✅ Anti status-tag *ON*.");
        }
        if (mode === "off") {
            db[from] = false;
            save(db);
            return reply("✅ Anti status-tag *OFF*.");
        }
        return reply(
            "Anti status-tag: *" + (db[from] ? "ON" : "OFF") + "*\nUse: #antistatustag on | off"
        );
    }
};
