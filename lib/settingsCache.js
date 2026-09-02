const fs = require("fs");
const path = require("path");

const SETTINGS_FILE = path.join(__dirname, "..", "settings.json");

let cache = null;
let mtime = 0;

function getSettings() {
    try {
        const stat = fs.statSync(SETTINGS_FILE);
        if (!cache || stat.mtimeMs !== mtime) {
            const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
            cache = JSON.parse(raw);
            mtime = stat.mtimeMs;
        }
    } catch (e) {
        cache = cache || {};
    }

    const s = Object.assign({}, cache || {});

    if (!s.ownerNumber && process.env.OWNER_NUMBER) {
        s.ownerNumber = process.env.OWNER_NUMBER;
    }
    if (!s.ownerLid && process.env.OWNER_LID) {
        s.ownerLid = process.env.OWNER_LID;
    }
    if (process.env.BOT_PREFIX) s.prefix = process.env.BOT_PREFIX;
    if (process.env.BOT_MODE) s.mode = process.env.BOT_MODE;

    return s;
}

function clearSettingsCache() {
    cache = null;
    mtime = 0;
}

module.exports = {
    getSettings,
    clearSettingsCache
};
