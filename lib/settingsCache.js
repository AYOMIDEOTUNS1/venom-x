const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../settings.json");
let cache = null;
let mtime = 0;

function getSettings() {
    try {
        const stat = fs.statSync(FILE);
        if (!cache || stat.mtimeMs !== mtime) {
            cache = JSON.parse(fs.readFileSync(FILE, "utf8"));
            mtime = stat.mtimeMs;
        }
        return cache;
    } catch {
        return cache || {};
    }
}

module.exports = { getSettings };
