const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "database");
const DATA_FILE = path.join(DATA_DIR, "economy.json");

const DEFAULT_BALANCE = 1000;
const DEFAULT_BANK_CAPACITY = 1000000;
const BANK_UPGRADE_AMOUNT = 200000;

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return {};
        }

        const raw = fs.readFileSync(DATA_FILE, "utf8");

        if (!raw.trim()) {
            return {};
        }

        return JSON.parse(raw);
    } catch (error) {
        console.error("❌ ECONOMY LOAD ERROR:", error);
        return {};
    }
}

let data = loadData();

function saveData() {
    try {
        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify(data, null, 2)
        );
    } catch (error) {
        console.error("❌ ECONOMY SAVE ERROR:", error);
    }
}

function normalizeId(id) {
    if (!id) return null;

    let value = String(id);

    if (value.includes(":")) {
        value = value.split(":")[0];
    }

    return value;
}

// ============================================================
// STATS
// ============================================================

function createStats() {
    return {
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,

        duels: 0,
        duelWins: 0,
        duelLosses: 0,

        robAttempts: 0,
        robSuccess: 0,
        robFailed: 0,

        jailed: 0,
        bailed: 0,

        moneyEarned: 0,
        moneyLost: 0
    };
}

// ============================================================
// USER
// ============================================================

function createUser() {
    return {
        balance: DEFAULT_BALANCE,
        bank: 0,

        bankCapacity: DEFAULT_BANK_CAPACITY,
        bankUpgraded: false,

        daily: 0,
        weekly: 0,
        monthly: 0,
        work: 0,

        rob: 0,
        robStars: 0,

        jailedUntil: 0,
        wantedUntil: 0,

        level: 1,
        xp: 0,

        inventory: {},

        // Persistent market item timers
        items: {
            luckyUntil: 0,
            shieldUntil: 0,
            vaultUntil: 0
        },

        stats: createStats()
    };
}

// ============================================================
// ENSURE USER
// ============================================================

function ensure(userData, id) {
    const key = normalizeId(id);

    if (!key) {
        throw new Error(
            "Invalid economy user ID"
        );
    }

    if (!userData[key]) {
        userData[key] = createUser();
    }

    const user = userData[key];

    // Money
    if (typeof user.balance !== "number") {
        user.balance = DEFAULT_BALANCE;
    }

    if (typeof user.bank !== "number") {
        user.bank = 0;
    }

    // Bank
    if (typeof user.bankCapacity !== "number") {
        user.bankCapacity = DEFAULT_BANK_CAPACITY;
    }

    if (typeof user.bankUpgraded !== "boolean") {
        user.bankUpgraded =
            user.bankCapacity > DEFAULT_BANK_CAPACITY;
    }

    // Cooldowns
    if (typeof user.daily !== "number") {
        user.daily = 0;
    }

    if (typeof user.weekly !== "number") {
        user.weekly = 0;
    }

    if (typeof user.monthly !== "number") {
        user.monthly = 0;
    }

    if (typeof user.work !== "number") {
        user.work = 0;
    }

    if (typeof user.rob !== "number") {
        user.rob = 0;
    }

    // Robbery
    if (typeof user.robStars !== "number") {
        user.robStars = 0;
    }

    // Jail
    if (typeof user.jailedUntil !== "number") {
        user.jailedUntil = 0;
    }

    if (typeof user.wantedUntil !== "number") {
        user.wantedUntil = 0;
    }

    // XP
    if (typeof user.level !== "number") {
        user.level = 1;
    }

    if (typeof user.xp !== "number") {
        user.xp = 0;
    }

    // Inventory
    if (
        !user.inventory ||
        typeof user.inventory !== "object"
    ) {
        user.inventory = {};
    }

    // Market timers
    if (
        !user.items ||
        typeof user.items !== "object"
    ) {
        user.items = {};
    }

    if (typeof user.items.luckyUntil !== "number") {
        user.items.luckyUntil = 0;
    }

    if (typeof user.items.shieldUntil !== "number") {
        user.items.shieldUntil = 0;
    }

    if (typeof user.items.vaultUntil !== "number") {
        user.items.vaultUntil = 0;
    }

    // Stats migration
    if (
        !user.stats ||
        typeof user.stats !== "object"
    ) {
        user.stats = createStats();
    }

    const defaultStats = createStats();

    for (const keyName of Object.keys(defaultStats)) {
        if (typeof user.stats[keyName] !== "number") {
            user.stats[keyName] =
                defaultStats[keyName];
        }
    }

    return user;
}

// ============================================================
// GET
// ============================================================

function get(id) {
    const user = ensure(data, id);

    saveData();

    return user;
}

// ============================================================
// SET
// ============================================================

function set(id, updates = {}) {
    const user = ensure(data, id);

    Object.assign(user, updates);

    saveData();

    return user;
}

// ============================================================
// ADD MONEY
// ============================================================

function add(id, amount) {
    const user = ensure(data, id);

    amount = Number(amount) || 0;

    user.balance += amount;

    saveData();

    return user;
}

// ============================================================
// REMOVE MONEY
// ============================================================

function remove(id, amount) {
    const user = ensure(data, id);

    amount = Number(amount) || 0;

    user.balance -= amount;

    saveData();

    return user;
}

// ============================================================
// LEVEL SYSTEM
// ============================================================

function xpForLevel(level) {
    level = Math.max(1, Number(level) || 1);

    /*
     * Increasing XP requirement.
     *
     * Level 1 -> 2 = 4000 XP
     * Level 2 -> 3 = 8000 XP
     * Level 3 -> 4 = 12000 XP
     * etc.
     */
    return level * 4000;
}

function calculateLevel(xp) {
    xp = Math.max(0, Number(xp) || 0);

    let level = 1;
    let remaining = xp;

    while (
        remaining >= xpForLevel(level)
    ) {
        remaining -= xpForLevel(level);
        level++;

        if (level >= 100) {
            return 100;
        }
    }

    return level;
}

function xpToNextLevel(id) {
    const user = ensure(data, id);

    const required =
        xpForLevel(user.level);

    return Math.max(
        0,
        required - user.xp
    );
}

// ============================================================
// ADD XP
// ============================================================

function addXP(id, amount) {
    const user = ensure(data, id);

    amount = Math.max(
        0,
        Number(amount) || 0
    );

    const oldLevel =
        Number(user.level) || 1;

    user.xp += amount;

    user.level =
        calculateLevel(user.xp);

    saveData();

    return {
        xp: user.xp,
        level: user.level,
        oldLevel,
        leveledUp:
            user.level > oldLevel,
        xpToNext:
            xpToNextLevel(id)
    };
}

// ============================================================
// BANK UPGRADE
// ============================================================

function upgradeBank(id) {
    const user = ensure(data, id);

    if (user.bankUpgraded) {
        return {
            oldCapacity: user.bankCapacity,
            newCapacity: user.bankCapacity,
            increase: 0,
            alreadyUpgraded: true
        };
    }

    const oldCapacity =
        user.bankCapacity;

    user.bankCapacity =
        oldCapacity +
        BANK_UPGRADE_AMOUNT;

    user.bankUpgraded = true;

    saveData();

    return {
        oldCapacity,
        newCapacity: user.bankCapacity,
        increase: BANK_UPGRADE_AMOUNT
    };
}

// ============================================================
// MARKET ITEM HELPERS
// ============================================================

function isItemActive(id, item) {
    const user = ensure(data, id);

    const now = Date.now();

    const key =
        `${item}Until`;

    return (
        Number(user.items[key] || 0) > now
    );
}

function itemRemaining(id, item) {
    const user = ensure(data, id);

    const key =
        `${item}Until`;

    return Math.max(
        0,
        Number(user.items[key] || 0) -
        Date.now()
    );
}

function activateItem(
    id,
    item,
    duration
) {
    const user = ensure(data, id);

    const key =
        `${item}Until`;

    const now = Date.now();

    const current =
        Number(user.items[key] || 0);

    const base =
        current > now
            ? current
            : now;

    user.items[key] =
        base + duration;

    saveData();

    return user.items[key];
}

function consumeItem(id, item) {
    const user = ensure(data, id);

    const inventory =
        user.inventory || {};

    const owned =
        Number(inventory[item] || 0);

    if (owned <= 0) {
        return false;
    }

    inventory[item] =
        owned - 1;

    if (inventory[item] <= 0) {
        delete inventory[item];
    }

    user.inventory = inventory;

    saveData();

    return true;
}

// ============================================================
// ALL USERS
// ============================================================

function all() {
    return data;
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    get,
    add,
    remove,
    set,
    all,

    addXP,
    calculateLevel,
    xpForLevel,
    xpToNextLevel,

    upgradeBank,

    normalizeId,

    // Bank constants
    DEFAULT_BALANCE,
    DEFAULT_BANK_CAPACITY,
    BANK_UPGRADE_AMOUNT,

    // Market item helpers
    isItemActive,
    itemRemaining,
    activateItem,
    consumeItem
};
