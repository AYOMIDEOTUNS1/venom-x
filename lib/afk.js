"use strict";

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../database/afk.json");
const AUTO_MS = 20 * 60 * 1000; // 20 minutes
const REPLY_COOLDOWN_MS = 45 * 1000; // don't spam AFK reply

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

function norm(id) {
    return String(id || "").split(":")[0];
}

function onlyDigits(s) {
    return String(s || "").replace(/\D/g, "");
}

/** last activity (any message they sent) */
function touch(userId) {
    const db = load();
    const id = norm(userId);
    if (!id) return;
    if (!db[id]) db[id] = {};
    db[id].lastSeen = Date.now();
    // clear manual AFK when they talk again
    if (db[id].manual) {
        delete db[id].manual;
        delete db[id].reason;
        delete db[id].since;
    }
    save(db);
}

function setManual(userId, reason) {
    const db = load();
    const id = norm(userId);
    if (!id) return;
    if (!db[id]) db[id] = {};
    db[id].manual = true;
    db[id].reason = reason || "AFK";
    db[id].since = Date.now();
    db[id].lastSeen = db[id].lastSeen || Date.now();
    save(db);
}

function clear(userId) {
    const db = load();
    const id = norm(userId);
    if (db[id]) {
        delete db[id].manual;
        delete db[id].reason;
        delete db[id].since;
        db[id].lastSeen = Date.now();
        save(db);
    }
}

function formatDuration(ms) {
    ms = Math.max(0, Number(ms) || 0);
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (d > 0) return d + "d " + h + "h " + m + "m";
    if (h > 0) return h + "h " + m + "m";
    if (m > 0) return m + "m " + sec + "s";
    return sec + "s";
}

/**
 * Returns AFK info if user should be treated as AFK, else null
 */
function getAfkState(userId) {
    const db = load();
    const id = norm(userId);
    const row = db[id];
    if (!row) return null;

    const now = Date.now();

    if (row.manual) {
        return {
            type: "manual",
            reason: row.reason || "AFK",
            since: row.since || row.lastSeen || now,
            offlineFor: formatDuration(now - (row.since || row.lastSeen || now))
        };
    }

    const last = Number(row.lastSeen) || 0;
    if (last && now - last >= AUTO_MS) {
        return {
            type: "auto",
            reason: "Away",
            since: last,
            offlineFor: formatDuration(now - last)
        };
    }
    return null;
}

function canNotify(userId) {
    const db = load();
    const id = norm(userId);
    if (!db[id]) return true;
    const last = Number(db[id].lastNotify) || 0;
    if (Date.now() - last < REPLY_COOLDOWN_MS) return false;
    db[id].lastNotify = Date.now();
    save(db);
    return true;
}

function sameUser(a, b) {
    if (!a || !b) return false;
    if (norm(a) === norm(b)) return true;
    const da = onlyDigits(a);
    const db = onlyDigits(b);
    if (da && db && (da === db || da.endsWith(db) || db.endsWith(da))) {
        return Math.min(da.length, db.length) >= 10;
    }
    return false;
}

module.exports = {
    touch,
    setManual,
    clear,
    getAfkState,
    canNotify,
    sameUser,
    formatDuration,
    AUTO_MS
};
