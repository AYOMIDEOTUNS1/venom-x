"use strict";

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../database/afk.json");
const AUTO_MS = 20 * 60 * 1000;
const REPLY_COOLDOWN_MS = 45 * 1000;

/** ONLY these numbers get AFK / welcome back / tag replies */
const AFK_OWNERS = [
    "2349163743900",
    "2347077417996",
    "2347071970034"
];

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

function phoneMatch(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.endsWith(b) || b.endsWith(a)) {
        return Math.min(a.length, b.length) >= 10;
    }
    return false;
}

function isAfkOwner(userId) {
    const dig = onlyDigits(userId);
    if (!dig) return false;
    for (let i = 0; i < AFK_OWNERS.length; i++) {
        if (phoneMatch(dig, AFK_OWNERS[i])) return true;
    }
    return false;
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

/** Only tracks owners. Others ignored. */
function touch(userId) {
    if (!isAfkOwner(userId)) return null;

    const db = load();
    const id = norm(userId);
    if (!id) return null;
    if (!db[id]) db[id] = {};

    const now = Date.now();
    const row = db[id];
    let cameBack = null;

    if (row.manual) {
        cameBack = {
            wasAfk: true,
            reason: row.reason || "AFK",
            offlineFor: formatDuration(now - (row.since || row.lastSeen || now))
        };
        delete row.manual;
        delete row.reason;
        delete row.since;
    } else {
        const last = Number(row.lastSeen) || 0;
        if (last && now - last >= AUTO_MS) {
            cameBack = {
                wasAfk: true,
                reason: "Away",
                offlineFor: formatDuration(now - last)
            };
        }
    }

    row.lastSeen = now;
    save(db);
    return cameBack;
}

function setManual(userId, reason) {
    if (!isAfkOwner(userId)) return false;
    const db = load();
    const id = norm(userId);
    if (!id) return false;
    if (!db[id]) db[id] = {};
    db[id].manual = true;
    db[id].reason = reason || "AFK";
    db[id].since = Date.now();
    db[id].lastSeen = db[id].lastSeen || Date.now();
    save(db);
    return true;
}

function clear(userId) {
    if (!isAfkOwner(userId)) return;
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

function getAfkState(userId) {
    if (!isAfkOwner(userId)) return null;
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
    if (!isAfkOwner(userId)) return false;
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
    const db_ = onlyDigits(b);
    if (da && db_ && (da === db_ || da.endsWith(db_) || db_.endsWith(da))) {
        return Math.min(da.length, db_.length) >= 10;
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
    isAfkOwner,
    formatDuration,
    AUTO_MS,
    AFK_OWNERS
};
