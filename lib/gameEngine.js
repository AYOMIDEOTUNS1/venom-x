const economy = require("./economy");

// =====================================================
// VENOM X — SHARED GAME ENGINE
// Handles:
// • Game stats
// • XP
// • Money tracking
// • Market attributes
// • Lucky Charm
// • XP Boost
// =====================================================

const DEFAULT_XP_WIN = 250;
const DEFAULT_XP_LOSS = 100;
const DEFAULT_XP_DRAW = 50;

// =====================================================
// STATS
// =====================================================

function ensureStats(user) {
    if (!user.stats || typeof user.stats !== "object") {
        user.stats = {};
    }

    const defaults = {
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

    for (const [key, value] of Object.entries(defaults)) {
        if (typeof user.stats[key] !== "number") {
            user.stats[key] = value;
        }
    }

    return user.stats;
}

// =====================================================
// MARKET INVENTORY
// =====================================================

function ensureInventory(user) {
    if (!user.inventory || typeof user.inventory !== "object") {
        user.inventory = {};
    }

    return user.inventory;
}

function getItem(user, item) {
    const inventory = ensureInventory(user);

    const value = inventory[item];

    if (!value) {
        return null;
    }

    if (typeof value === "number") {
        return {
            quantity: value,
            expiresAt: 0
        };
    }

    return {
        quantity: Number(value.quantity) || 0,
        expiresAt: Number(value.expiresAt) || 0
    };
}

// =====================================================
// ACTIVE ITEM
// =====================================================

function hasItem(id, item) {
    const user = economy.get(id);
    const inventory = ensureInventory(user);

    const value = inventory[item];

    if (!value) {
        return false;
    }

    // Old-style quantity
    if (typeof value === "number") {
        return value > 0;
    }

    const quantity = Number(value.quantity) || 0;
    const expiresAt = Number(value.expiresAt) || 0;

    if (quantity <= 0) {
        return false;
    }

    // Permanent item
    if (!expiresAt) {
        return true;
    }

    return expiresAt > Date.now();
}

// =====================================================
// CLEAN EXPIRED ITEMS
// =====================================================

function cleanInventory(id) {
    const user = economy.get(id);
    const inventory = ensureInventory(user);

    let changed = false;
    const now = Date.now();

    for (const [item, value] of Object.entries(inventory)) {
        if (!value || typeof value !== "object") {
            continue;
        }

        const quantity = Number(value.quantity) || 0;
        const expiresAt = Number(value.expiresAt) || 0;

        if (
            quantity <= 0 ||
            (expiresAt > 0 && expiresAt <= now)
        ) {
            delete inventory[item];
            changed = true;
        }
    }

    if (changed) {
        economy.set(id, {
            inventory
        });
    }

    return inventory;
}

// =====================================================
// CONSUME ITEM
// =====================================================

function consumeItem(id, item, amount = 1) {
    amount = Math.max(1, Number(amount) || 1);

    const user = economy.get(id);
    const inventory = ensureInventory(user);

    const current = inventory[item];

    if (!current) {
        return false;
    }

    if (typeof current === "number") {
        if (current < amount) {
            return false;
        }

        const remaining = current - amount;

        if (remaining <= 0) {
            delete inventory[item];
        } else {
            inventory[item] = remaining;
        }

        economy.set(id, {
            inventory
        });

        return true;
    }

    const quantity = Number(current.quantity) || 0;

    if (quantity < amount) {
        return false;
    }

    current.quantity = quantity - amount;

    if (current.quantity <= 0) {
        delete inventory[item];
    }

    economy.set(id, {
        inventory
    });

    return true;
}

// =====================================================
// GAME LUCK
// =====================================================

function getLuck(id) {
    cleanInventory(id);

    return hasItem(id, "lucky")
        ? 0.10
        : 0;
}

// Returns true when a bonus/luck effect activates.
function luckyRoll(id, chance = 0.10) {
    const bonus = getLuck(id);

    if (!bonus) {
        return false;
    }

    return Math.random() < Math.min(1, chance + bonus);
}

// =====================================================
// XP MULTIPLIER
// =====================================================

function getXPMultiplier(id) {
    cleanInventory(id);

    return hasItem(id, "xpboost")
        ? 2
        : 1;
}

function calculateGameXP(id, baseXP) {
    baseXP = Math.max(
        0,
        Number(baseXP) || 0
    );

    const multiplier = getXPMultiplier(id);

    return Math.floor(
        baseXP * multiplier
    );
}

// =====================================================
// REWARD XP
// =====================================================

function rewardXP(id, amount) {
    const finalXP = calculateGameXP(
        id,
        amount
    );

    return economy.addXP(
        id,
        finalXP
    );
}

// =====================================================
// GAME STATS
// =====================================================

function recordGame(id, game, won) {
    const user = economy.get(id);
    const stats = ensureStats(user);

    stats.gamesPlayed += 1;

    if (won) {
        stats.gamesWon += 1;
    } else {
        stats.gamesLost += 1;
    }

    if (game === "duel") {
        stats.duels += 1;

        if (won) {
            stats.duelWins += 1;
        } else {
            stats.duelLosses += 1;
        }
    }

    economy.set(id, {
        stats
    });

    return stats;
}

// =====================================================
// COMPLETE GAME
// =====================================================

function finishGame({
    game,
    winner,
    loser,
    winnerXP = DEFAULT_XP_WIN,
    loserXP = DEFAULT_XP_LOSS
}) {
    if (!winner || !loser) {
        throw new Error(
            "Game requires winner and loser"
        );
    }

    const winnerStats =
        recordGame(
            winner,
            game,
            true
        );

    const loserStats =
        recordGame(
            loser,
            game,
            false
        );

    const winnerResult =
        rewardXP(
            winner,
            winnerXP
        );

    const loserResult =
        rewardXP(
            loser,
            loserXP
        );

    return {
        winner,
        loser,

        winnerStats,
        loserStats,

        winnerXP: winnerResult,
        loserXP: loserResult
    };
}

// =====================================================
// DRAW
// =====================================================

function finishDraw({
    game,
    players,
    xp = DEFAULT_XP_DRAW
}) {
    if (!Array.isArray(players)) {
        throw new Error(
            "Draw requires players array"
        );
    }

    const results = [];

    for (const id of players) {
        const stats =
            recordGame(
                id,
                game,
                false
            );

        const xpResult =
            rewardXP(
                id,
                xp
            );

        results.push({
            id,
            stats,
            xp: xpResult
        });
    }

    return results;
}

// =====================================================
// MONEY TRACKING
// =====================================================

function trackMoneyEarned(id, amount) {
    const user = economy.get(id);
    const stats = ensureStats(user);

    amount = Math.max(
        0,
        Number(amount) || 0
    );

    stats.moneyEarned += amount;

    economy.set(id, {
        stats
    });

    return stats.moneyEarned;
}

function trackMoneyLost(id, amount) {
    const user = economy.get(id);
    const stats = ensureStats(user);

    amount = Math.max(
        0,
        Number(amount) || 0
    );

    stats.moneyLost += amount;

    economy.set(id, {
        stats
    });

    return stats.moneyLost;
}

// =====================================================
// GAME WIN CHANCE
// =====================================================

function getWinChance(id, baseChance = 0.5) {
    const luck = getLuck(id);

    return Math.min(
        0.95,
        Math.max(
            0.05,
            Number(baseChance) + luck
        )
    );
}

// =====================================================
// EXPORT
// =====================================================

module.exports = {
    ensureStats,
    ensureInventory,
    cleanInventory,

    getItem,
    hasItem,
    consumeItem,

    getLuck,
    luckyRoll,

    getXPMultiplier,
    calculateGameXP,
    rewardXP,

    recordGame,
    finishGame,
    finishDraw,

    trackMoneyEarned,
    trackMoneyLost,

    getWinChance,

    DEFAULT_XP_WIN,
    DEFAULT_XP_LOSS,
    DEFAULT_XP_DRAW
};
