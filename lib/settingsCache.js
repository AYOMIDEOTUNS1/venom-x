const fs = require("fs");
const path = require("path");

const SETTINGS_FILE = path.join(__dirname, "..", "settings.json");

let cache = null;
let mtime = 0;

function getSettings() {
    try {
        const stat = fs.statSync(SETTINGS_FILE);
        if (!cache || stat.mtimeMs !== mtime) {
            cache = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
            mtime = stat.mtimeMs;
        }
    } catch (e) {
        cache = cache || {};
    }

    const s = Object.assign({}, cache || {});

    if (!s.ownerNumber) s.ownerNumber = "2349163743900";
    if (!s.ownerLid) s.ownerLid = "2281198063748";
    if (s.allowSelf === undefined) s.allowSelf = true;
    if (!s.prefix) s.prefix = "#";

    return s;
}

function clearSettingsCache() {
    cache = null;
    mtime = 0;
}

module.exports = { getSettings, clearSettingsCache };
