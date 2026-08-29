const economy = require("./economy");

// XP required to reach the next level.
// Level 1 → 2 = 100 XP
// Level 2 → 3 = 400 XP
// Level 3 → 4 = 900 XP
// Level 4 → 5 = 1600 XP
// Formula: level² × 100

function xpForLevel(level) {
    level = Math.max(1, Number(level) || 1);
    return level * level * 100;
}

function getLevel(xp) {
    xp = Math.max(0, Number(xp) || 0);

    let level = 1;

    while (xp >= xpForLevel(level + 1)) {
        level++;
    }

    return level;
}

function getRank(level) {
    if (level >= 50) return "👑 LEGEND";
    if (level >= 40) return "💎 MASTER";
    if (level >= 30) return "🔥 ELITE";
    if (level >= 20) return "⚔️ VETERAN";
    if (level >= 10) return "💰 TYCOON";
    if (level >= 5) return "😈 HUSTLER";

    return "🌱 ROOKIE";
}

function addXP(id, amount) {
    amount = Math.max(
        0,
        Number(amount) || 0
    );

    if (!amount) {
        return {
            added: 0,
            level: 1,
            xp: 0,
            leveledUp: false
        };
    }

    const user = economy.get(id);

    const oldLevel =
        Number(user.level) || 1;

    const oldXP =
        Number(user.xp) || 0;

    const newXP =
        oldXP + amount;

    const newLevel =
        getLevel(newXP);

    economy.set(id, {
        xp: newXP,
        level: newLevel
    });

    return {
        added: amount,
        xp: newXP,
        level: newLevel,
        oldLevel,
        leveledUp: newLevel > oldLevel,
        rank: getRank(newLevel),
        nextXP: xpForLevel(newLevel + 1)
    };
}

function getProgress(id) {
    const user = economy.get(id);

    const xp =
        Number(user.xp) || 0;

    const level =
        getLevel(xp);

    const currentLevelXP =
        xpForLevel(level);

    const nextLevelXP =
        xpForLevel(level + 1);

    return {
        xp,
        level,
        rank: getRank(level),
        currentLevelXP,
        nextLevelXP,
        remaining:
            Math.max(
                0,
                nextLevelXP - xp
            )
    };
}

module.exports = {
    xpForLevel,
    getLevel,
    getRank,
    addXP,
    getProgress
};
