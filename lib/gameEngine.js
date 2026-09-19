const economy = require("./economy");

const DEFAULT_XP_WIN = 250;
const DEFAULT_XP_LOSS = 100;
const DEFAULT_XP_DRAW = 50;
const LUCKY_BONUS_XP = 50;

function ensureStats(user) {
    if (!user.stats || typeof user.stats !== "object") user.stats = {};
    var defaults = {
        gamesPlayed: 0, gamesWon: 0, gamesLost: 0,
        duels: 0, duelWins: 0, duelLosses: 0,
        robAttempts: 0, robSuccess: 0, robFailed: 0,
        jailed: 0, bailed: 0, moneyEarned: 0, moneyLost: 0
    };
    for (var key in defaults) {
        if (typeof user.stats[key] !== "number") user.stats[key] = defaults[key];
    }
    return user.stats;
}

function ensureInventory(user) {
    if (!user.inventory || typeof user.inventory !== "object") user.inventory = {};
    return user.inventory;
}

function ensureItems(user) {
    if (!user.items || typeof user.items !== "object") user.items = {};
    return user.items;
}

// Market uses: user.items.luckyUntil / shieldUntil / vaultUntil
// Also supports inventory.lucky = number or {quantity, expiresAt}
function hasItem(id, item) {
    var user = economy.get(id);
    var items = ensureItems(user);
    var until = Number(items[item + "Until"] || 0);
    if (until > Date.now()) return true;

    var inventory = ensureInventory(user);
    var value = inventory[item];
    if (!value) return false;
    if (typeof value === "number") return value > 0;

    var quantity = Number(value.quantity) || 0;
    var expiresAt = Number(value.expiresAt) || 0;
    if (quantity <= 0) return false;
    if (!expiresAt) return true;
    return expiresAt > Date.now();
}

function cleanInventory(id) {
    var user = economy.get(id);
    var inventory = ensureInventory(user);
    var items = ensureItems(user);
    var changed = false;
    var now = Date.now();

    for (var item in inventory) {
        var value = inventory[item];
        if (!value || typeof value !== "object") continue;
        var quantity = Number(value.quantity) || 0;
        var expiresAt = Number(value.expiresAt) || 0;
        if (quantity <= 0 || (expiresAt > 0 && expiresAt <= now)) {
            delete inventory[item];
            changed = true;
        }
    }

    for (var key in items) {
        if (key.indexOf("Until") !== -1 && Number(items[key]) <= now) {
            delete items[key];
            changed = true;
        }
    }

    if (changed) economy.set(id, { inventory: inventory, items: items });
    return inventory;
}

function getLuck(id) {
    cleanInventory(id);
    return hasItem(id, "lucky") ? 0.10 : 0;
}

function getXPMultiplier(id) {
    cleanInventory(id);
    return hasItem(id, "xpboost") ? 2 : 1;
}

function calculateGameXP(id, baseXP) {
    baseXP = Math.max(0, Number(baseXP) || 0);
    var xp = Math.floor(baseXP * getXPMultiplier(id));
    if (hasItem(id, "lucky")) xp += LUCKY_BONUS_XP;
    return xp;
}

function rewardXP(id, amount) {
    var finalXP = calculateGameXP(id, amount);
    if (typeof economy.addXP === "function") return economy.addXP(id, finalXP);
    var user = economy.get(id);
    var newXP = (Number(user.xp) || 0) + finalXP;
    economy.set(id, { xp: newXP });
    return { added: finalXP, xp: newXP, leveledUp: false };
}

function recordGame(id, game, won) {
    var user = economy.get(id);
    var stats = ensureStats(user);
    stats.gamesPlayed += 1;
    if (won) stats.gamesWon += 1;
    else stats.gamesLost += 1;
    if (game === "duel") {
        stats.duels += 1;
        if (won) stats.duelWins += 1;
        else stats.duelLosses += 1;
    }
    economy.set(id, { stats: stats });
    return stats;
}

function finishGame(opts) {
    var winner = opts.winner;
    var loser = opts.loser;
    var game = opts.game;
    var winnerXP = opts.winnerXP != null ? opts.winnerXP : DEFAULT_XP_WIN;
    var loserXP = opts.loserXP != null ? opts.loserXP : DEFAULT_XP_LOSS;
    if (!winner || !loser) throw new Error("Game requires winner and loser");

    return {
        winner: winner,
        loser: loser,
        winnerStats: recordGame(winner, game, true),
        loserStats: recordGame(loser, game, false),
        winnerXP: rewardXP(winner, winnerXP),
        loserXP: rewardXP(loser, loserXP)
    };
}

function trackMoneyEarned(id, amount) {
    var user = economy.get(id);
    var stats = ensureStats(user);
    stats.moneyEarned += Math.max(0, Number(amount) || 0);
    economy.set(id, { stats: stats });
    return stats.moneyEarned;
}

function trackMoneyLost(id, amount) {
    var user = economy.get(id);
    var stats = ensureStats(user);
    stats.moneyLost += Math.max(0, Number(amount) || 0);
    economy.set(id, { stats: stats });
    return stats.moneyLost;
}

function getWinChance(id, baseChance) {
    if (baseChance == null) baseChance = 0.5;
    return Math.min(0.95, Math.max(0.05, Number(baseChance) + getLuck(id)));
}

module.exports = {
    ensureStats: ensureStats,
    ensureInventory: ensureInventory,
    cleanInventory: cleanInventory,
    hasItem: hasItem,
    getLuck: getLuck,
    getXPMultiplier: getXPMultiplier,
    calculateGameXP: calculateGameXP,
    rewardXP: rewardXP,
    recordGame: recordGame,
    finishGame: finishGame,
    trackMoneyEarned: trackMoneyEarned,
    trackMoneyLost: trackMoneyLost,
    getWinChance: getWinChance,
    DEFAULT_XP_WIN: DEFAULT_XP_WIN,
    DEFAULT_XP_LOSS: DEFAULT_XP_LOSS,
    DEFAULT_XP_DRAW: DEFAULT_XP_DRAW,
    LUCKY_BONUS_XP: LUCKY_BONUS_XP
};
