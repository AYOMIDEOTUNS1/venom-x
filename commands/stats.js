const economy = require("../lib/economy");

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

module.exports = {
    name: "stats",
    aliases: ["stat", "statistics"],

    run: async ({
        sock,
        from,
        message,
        sender
    }) => {

        const user = economy.get(sender);
        const stats = ensureStats(user);

        const wallet =
            Number(user.balance) || 0;

        const bank =
            Number(user.bank) || 0;

        const capacity =
            Number(user.bankCapacity) || 1000000;

        const wealth =
            wallet + bank;

        const level =
            Number(user.level) || 1;

        const xp =
            Number(user.xp) || 0;

        const xpNext =
            typeof economy.xpToNextLevel === "function"
                ? economy.xpToNextLevel(level)
                : 0;

        const jailed =
            Number(user.jailedUntil) > Date.now();

        const wanted =
            Number(user.wantedUntil) > Date.now();

        const stars =
            Number(user.robStars) || 0;

        await sock.sendMessage(
            from,
            {
                text:
`╭━━〔 📊 VENOM X STATS 〕━━⬣
┃
┃ 👤 Player
┃    @${sender.split("@")[0]}
┃
┃ ⭐ Level : ${level}
┃ ✨ XP : ${xp.toLocaleString()}
┃ 📈 Next Level : ${xpNext.toLocaleString()} XP
┃
┃ 💰 ECONOMY
┃
┃ 💵 Wallet
┃    ${wallet.toLocaleString()} VENOM
┃
┃ 🏦 Bank
┃    ${bank.toLocaleString()} VENOM
┃
┃ 🏦 Capacity
┃    ${capacity.toLocaleString()} VENOM
┃
┃ 💎 Total Wealth
┃    ${wealth.toLocaleString()} VENOM
┃
┃ 🎮 GAMES
┃
┃ 🎯 Games Played : ${stats.gamesPlayed}
┃ 🏆 Games Won : ${stats.gamesWon}
┃ 💀 Games Lost : ${stats.gamesLost}
┃
┃ ⚔️ DUELS
┃
┃ ⚔️ Duels : ${stats.duels}
┃ 👑 Duel Wins : ${stats.duelWins}
┃ 💀 Duel Losses : ${stats.duelLosses}
┃
┃ 🦹 ROBBERY
┃
┃ 🚨 Attempts : ${stats.robAttempts}
┃ 💰 Success : ${stats.robSuccess}
┃ 🚔 Failed : ${stats.robFailed}
┃ ⭐ Wanted : ${stars}/3
┃
┃ 🚔 JAIL
┃
┃ 🔒 Status :
┃    ${jailed ? "JAILED 🚨" : "FREE ✅"}
┃
┃ ⭐ Wanted Status :
┃    ${wanted ? "WANTED 🚨" : "CLEAN ✅"}
┃
┃ 🚨 Jail Count : ${stats.jailed}
┃ 🔓 Bail Count : ${stats.bailed}
┃
┃ 💹 MONEY HISTORY
┃
┃ 📈 Earned :
┃    ${stats.moneyEarned.toLocaleString()} VENOM
┃
┃ 📉 Lost :
┃    ${stats.moneyLost.toLocaleString()} VENOM
┃
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [sender]
            },
            { quoted: message }
        );
    }
};
