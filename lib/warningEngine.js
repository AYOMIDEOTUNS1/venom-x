const fs = require("fs");
const path = require("path");

const FILE = path.join(
    __dirname,
    "..",
    "database",
    "warnings.json"
);

const MAX_WARNINGS = 3;

function ensureFile() {
    const dir = path.dirname(FILE);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(FILE)) {
        fs.writeFileSync(FILE, "{}");
    }
}

function load() {
    ensureFile();

    try {
        const raw = fs.readFileSync(FILE, "utf8");

        if (!raw.trim()) {
            return {};
        }

        const data = JSON.parse(raw);

        return data && typeof data === "object"
            ? data
            : {};
    } catch (error) {
        console.error(
            "WARNING DATABASE LOAD ERROR:",
            error.message
        );

        return {};
    }
}

function save(data) {
    ensureFile();

    fs.writeFileSync(
        FILE,
        JSON.stringify(data, null, 2)
    );
}

function normalize(id) {
    if (!id) return null;

    let value = String(id);

    if (value.includes(":")) {
        value = value.split(":")[0];
    }

    return value;
}

// =====================================================
// GET USER WARNINGS
// =====================================================

function getWarnings(groupId, userId) {
    const db = load();

    groupId = normalize(groupId);
    userId = normalize(userId);

    if (!groupId || !userId) {
        return [];
    }

    if (!db[groupId]) {
        return [];
    }

    const entry = db[groupId][userId];

    if (!entry) {
        return [];
    }

    // Migration support for old numeric format
    if (typeof entry === "number") {
        return Array.from(
            { length: entry },
            () => ({
                reason: "Warning",
                timestamp: Date.now()
            })
        );
    }

    if (Array.isArray(entry)) {
        return entry;
    }

    return [];
}

// =====================================================
// ADD WARNING
// =====================================================

function addWarning(groupId, userId, reason = "No reason provided") {
    const db = load();

    groupId = normalize(groupId);
    userId = normalize(userId);

    if (!groupId || !userId) {
        throw new Error("Invalid warning IDs");
    }

    if (!db[groupId]) {
        db[groupId] = {};
    }

    if (!Array.isArray(db[groupId][userId])) {
        db[groupId][userId] = [];
    }

    const warnings = db[groupId][userId];

    warnings.push({
        reason: String(reason).trim() || "No reason provided",
        timestamp: Date.now()
    });

    save(db);

    return {
        count: warnings.length,
        max: MAX_WARNINGS,
        warnings
    };
}

// =====================================================
// REMOVE ONE WARNING
// =====================================================

function removeWarning(groupId, userId) {
    const db = load();

    groupId = normalize(groupId);
    userId = normalize(userId);

    if (
        !groupId ||
        !userId ||
        !db[groupId] ||
        !db[groupId][userId]
    ) {
        return 0;
    }

    if (Array.isArray(db[groupId][userId])) {
        db[groupId][userId].pop();

        if (db[groupId][userId].length === 0) {
            delete db[groupId][userId];
        }
    } else {
        delete db[groupId][userId];
    }

    if (
        db[groupId] &&
        Object.keys(db[groupId]).length === 0
    ) {
        delete db[groupId];
    }

    save(db);

    return getWarnings(groupId, userId).length;
}

// =====================================================
// RESET WARNINGS
// =====================================================

function resetWarnings(groupId, userId) {
    const db = load();

    groupId = normalize(groupId);
    userId = normalize(userId);

    if (
        groupId &&
        userId &&
        db[groupId]
    ) {
        delete db[groupId][userId];

        if (
            Object.keys(db[groupId]).length === 0
        ) {
            delete db[groupId];
        }
    }

    save(db);

    return 0;
}

// =====================================================
// ALL WARNINGS IN GROUP
// =====================================================

function getGroupWarnings(groupId) {
    const db = load();

    groupId = normalize(groupId);

    if (!groupId || !db[groupId]) {
        return {};
    }

    return db[groupId];
}

module.exports = {
    MAX_WARNINGS,
    getWarnings,
    addWarning,
    removeWarning,
    resetWarnings,
    getGroupWarnings
};
