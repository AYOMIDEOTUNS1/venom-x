const fs = require("fs");
const path = require("path");
const SETTINGS = path.join(__dirname, "..", "settings.json");

function load() {
    try { return JSON.parse(fs.readFileSync(SETTINGS, "utf8")); }
    catch (e) { return {}; }
}
function save(data) {
    fs.writeFileSync(SETTINGS, JSON.stringify(data, null, 2));
}

module.exports = {
    name: "private",
    aliases: ["self"],
    run: async function ({ reply, isOwner }) {
        if (!isOwner) return reply("❌ Owner only.");
        const settings = load();
        settings.mode = "private";
        save(settings);
        return reply("🔒 Mode: PRIVATE\nOnly owner can use commands.");
    }
};
