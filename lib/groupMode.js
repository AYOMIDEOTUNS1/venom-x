const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "database", "group_mode.json");

function ensure() {
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, "{}");
}

function load() {
    ensure();
    try {
        const raw = fs.readFileSync(FILE, "utf8");
        return raw.trim() ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

function save(data) {
    ensure();
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function isAdminOnly(groupId) {
    const db = load();
    return !!(db[String(groupId)] && db[String(groupId)].adminOnly);
}

function setAdminOnly(groupId, value) {
    const db = load();
    const id = String(groupId);
    if (!db[id]) db[id] = {};
    db[id].adminOnly = !!value;
    if (!db[id].adminOnly) delete db[id].adminOnly;
    if (db[id] && Object.keys(db[id]).length === 0) delete db[id];
    save(db);
    return !!value;
}

module.exports = { isAdminOnly, setAdminOnly, load };
