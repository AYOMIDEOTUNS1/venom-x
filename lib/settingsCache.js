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
        return cache || {};
    } catch (e) {
        console.log("SETTINGS ERROR:", e.message);
        return cache || {};
    }
}

function clearSettingsCache() {
    cache = null;
    mtime = 0;
}

module.exports = {
    getSettings,
    clearSettingsCache
};
