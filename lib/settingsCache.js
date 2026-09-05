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

    // Owner fallbacks
    if (!s.ownerNumber) s.ownerNumber = "2349163743900";
    if (!s.ownerLid) s.ownerLid = "2281198063748";
    if (s.allowSelf === undefined) s.allowSelf = true;
    if (!s.prefix) s.prefix = "#";

    // Render / env overrides (never commit real keys)
    if (process.env.OWNER_NUMBER) s.ownerNumber = process.env.OWNER_NUMBER;
    if (process.env.OWNER_LID) s.ownerLid = process.env.OWNER_LID;
    if (process.env.BOT_PREFIX) s.prefix = process.env.BOT_PREFIX;
    if (process.env.BOT_MODE) s.mode = process.env.BOT_MODE;

    if (process.env.GROQ_API_KEY) s.groqApiKey = process.env.GROQ_API_KEY;
    if (process.env.GEMINI_API_KEY) s.geminiApiKey = process.env.GEMINI_API_KEY;
    if (process.env.REPLICATE_API_TOKEN) s.replicateApiToken = process.env.REPLICATE_API_TOKEN;

    // keep empty string if missing so callers can check safely
    if (s.groqApiKey == null) s.groqApiKey = "";
    if (s.geminiApiKey == null) s.geminiApiKey = "";
    if (s.replicateApiToken == null) s.replicateApiToken = "";

    return s;
}

function clearSettingsCache() {
    cache = null;
    mtime = 0;
}

module.exports = { getSettings, clearSettingsCache };
