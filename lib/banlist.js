const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "database", "banlist.json");

function load() {
    try {
        if (!fs.existsSync(FILE)) return {};
        return JSON.parse(fs.readFileSync(FILE, "utf8") || "{}");
    } catch (e) {
        return {};
    }
}

function save(data) {
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function norm(id) {
    return String(id || "").replace(/[^0-9]/g, "");
}

function isBanned(id) {
    const db = load();
    return !!db[norm(id)];
}

function ban(id, reason, by) {
    const db = load();
    const key = norm(id);
    if (!key) return false;
    db[key] = {
        reason: reason || "No reason",
        by: by || "owner",
        at: Date.now()
    };
    save(db);
    return true;
}

function unban(id) {
    const db = load();
    const key = norm(id);
    if (!db[key]) return false;
    delete db[key];
    save(db);
    return true;
}

function list() {
    return load();
}

module.exports = { isBanned, ban, unban, list, norm };
