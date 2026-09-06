const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "database", "user_profiles.json");

function load() {
    try {
        if (!fs.existsSync(FILE)) return {};
        return JSON.parse(fs.readFileSync(FILE, "utf8") || "{}");
    } catch (e) {
        return {};
    }
}

function save(data) {
    try {
        const dir = path.dirname(FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
    } catch (e) {}
}

function getProfile(telegramId) {
    const all = load();
    return all[String(telegramId)] || null;
}

function setProfile(telegramId, patch) {
    const all = load();
    const id = String(telegramId);
    all[id] = Object.assign({}, all[id] || {}, patch, { updatedAt: Date.now() });
    save(all);
    return all[id];
}

module.exports = { getProfile, setProfile, load };
