const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(
    process.cwd(),
    "telegram",
    "licenses.json"
);

// ============================================================
// DATABASE
// ============================================================

function ensureDatabase() {
    const dir = path.dirname(FILE);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(FILE)) {
        fs.writeFileSync(
            FILE,
            JSON.stringify({}, null, 2)
        );
    }
}

ensureDatabase();

function load() {
    ensureDatabase();

    try {
        const raw = fs.readFileSync(FILE, "utf8");

        if (!raw.trim()) {
            return {};
        }

        const data = JSON.parse(raw);

        return data &&
            typeof data === "object" &&
            !Array.isArray(data)
            ? data
            : {};
    } catch (error) {
        console.log(
            "LICENSE DATABASE LOAD ERROR:",
            error.message
        );

        return {};
    }
}

function save(data) {
    ensureDatabase();

    const tempFile = `${FILE}.tmp`;

    fs.writeFileSync(
        tempFile,
        JSON.stringify(data, null, 2)
    );

    fs.renameSync(
        tempFile,
        FILE
    );
}

// ============================================================
// CODE HELPERS
// ============================================================

function normalizeCode(code) {
    return String(code || "")
        .trim()
        .toUpperCase();
}

function generateCode() {
    const a = crypto
        .randomBytes(3)
        .toString("hex")
        .toUpperCase();

    const b = crypto
        .randomBytes(3)
        .toString("hex")
        .toUpperCase();

    return `VX-${a}-${b}`;
}

// ============================================================
// DURATIONS
// ============================================================

function durationMs(duration) {
    const map = {
        "1week":
            7 *
            24 *
            60 *
            60 *
            1000,

        "2weeks":
            14 *
            24 *
            60 *
            60 *
            1000,

        "1month":
            30 *
            24 *
            60 *
            60 *
            1000,

        "unlimited":
            null
    };

    return Object.prototype.hasOwnProperty.call(
        map,
        duration
    )
        ? map[duration]
        : undefined;
}

// ============================================================
// CREATE LICENSE
// ============================================================

function createCode(
    duration = "1week"
) {
    const ms =
        durationMs(duration);

    if (ms === undefined) {
        throw new Error(
            "Invalid duration. Use 1week, 2weeks, 1month or unlimited."
        );
    }

    const data = load();

    let code;

    do {
        code = generateCode();
    } while (data[code]);

    const now = Date.now();

    const license = {
        code,
        duration,
        createdAt: now,
        expiresAt:
            ms === null
                ? null
                : now + ms,

        usedBy: null,
        activatedAt: null,

        active: true,
        revoked: false,
        revokedAt: null
    };

    data[code] = license;

    save(data);

    return license;
}

// ============================================================
// GET LICENSE
// ============================================================

function getCode(code) {
    const data = load();

    const key =
        normalizeCode(code);

    return data[key] || null;
}

// ============================================================
// ACTIVATE LICENSE
// ============================================================

function activate(
    code,
    telegramUserId
) {
    const data = load();

    const key =
        normalizeCode(code);

    const item =
        data[key];

    if (!item) {
        return {
            ok: false,
            reason: "invalid"
        };
    }

    if (
        item.active === false ||
        item.revoked === true
    ) {
        return {
            ok: false,
            reason: "inactive"
        };
    }

    if (
        item.expiresAt &&
        Date.now() >=
            Number(item.expiresAt)
    ) {
        item.active = false;

        save(data);

        return {
            ok: false,
            reason: "expired"
        };
    }

    const uid =
        String(
            telegramUserId
        );

    if (
        item.usedBy &&
        String(item.usedBy) !== uid
    ) {
        return {
            ok: false,
            reason: "used"
        };
    }

    item.usedBy =
        uid;

    item.activatedAt =
        item.activatedAt ||
        Date.now();

    save(data);

    return {
        ok: true,
        license: item
    };
}

// ============================================================
// CHECK ACCESS
// ============================================================

function checkAccess(
    telegramUserId
) {
    const uid =
        String(
            telegramUserId
        );

    const data =
        load();

    let changed = false;

    for (
        const key of Object.keys(data)
    ) {
        const item =
            data[key];

        if (
            !item ||
            String(item.usedBy || "") !== uid
        ) {
            continue;
        }

        if (
            item.active === false ||
            item.revoked === true
        ) {
            continue;
        }

        if (
            item.expiresAt &&
            Date.now() >=
                Number(item.expiresAt)
        ) {
            item.active = false;
            changed = true;

            continue;
        }

        if (changed) {
            save(data);
        }

        return {
            active: true,
            expired: false,
            license: item
        };
    }

    if (changed) {
        save(data);
    }

    return {
        active: false,
        expired: false,
        license: null
    };
}

// ============================================================
// REVOKE LICENSE
// ============================================================
//
// IMPORTANT:
// This supports the command:
//
// /revoke VX-XXXXXX-XXXXXX
//
// It also handles old license records that only have
// { active: true } without a revoked property.
//

function revokeCode(code) {
    const data =
        load();

    const key =
        normalizeCode(code);

    if (!key) {
        return false;
    }

    const item =
        data[key];

    if (!item) {
        return false;
    }

    // Already revoked
    if (
        item.active === false &&
        item.revoked === true
    ) {
        return true;
    }

    item.active = false;
    item.revoked = true;
    item.revokedAt = Date.now();

    save(data);

    return true;
}

// ============================================================
// LIST LICENSES
// ============================================================

function listCodes() {
    return Object.values(
        load()
    );
}

// Alias for Telegram bot compatibility
function listLicenses() {
    return listCodes();
}

function getAllLicenses() {
    return listCodes();
}

// ============================================================
// REVOKE ALIASES
// ============================================================

function revokeLicense(code) {
    return revokeCode(code);
}

// ============================================================
// CLEANUP EXPIRED
// ============================================================

function cleanupExpired() {
    const data =
        load();

    let changed = false;

    for (
        const key of Object.keys(data)
    ) {
        const item =
            data[key];

        if (
            !item
        ) {
            continue;
        }

        if (
            item.active !== false &&
            item.expiresAt &&
            Date.now() >=
                Number(item.expiresAt)
        ) {
            item.active = false;

            if (
                item.revoked === undefined
            ) {
                item.revoked = false;
            }

            changed = true;
        }
    }

    if (changed) {
        save(data);
    }
}

// ============================================================
// AUTOMATIC CLEANUP
// ============================================================

setInterval(
    cleanupExpired,
    60 * 1000
).unref();

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    createCode,
    generateCode,

    activate,
    checkAccess,

    getCode,

    revokeCode,
    revokeLicense,

    listCodes,
    listLicenses,
    getAllLicenses,

    cleanupExpired
};
