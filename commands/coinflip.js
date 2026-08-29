const economy = require("../lib/economy");
const gameEngine = require("../lib/gameEngine");

const MIN_BET = 100;
const MAX_BET = 50000;

const BASE_WIN_CHANCE = 0.5;

module.exports = {
    name: "coinflip",
    aliases: ["cf", "flip"],

    run: async ({
        sock,
        from,
        message,
        sender,
        args
    }) => {

        const amount = Number(args?.[0]);
        const choice =
            String(args?.[1] || "").toLowerCase();

        // ==================================================
        // USAGE
        // ==================================================

        if (
            !Number.isInteger(amount) ||
            !["heads", "tails"].includes(choice)
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🪙 VENOM COINFLIP 〕━━⬣
┃
┃ Usage:
┃ .coinflip <amount> <heads|tails>
┃
┃ Example:
┃ .coinflip 7000 heads
┃
┃ 🪙 Minimum Bet : ${MIN_BET.toLocaleString()} VENOM
┃ 💰 Maximum Bet : ${MAX_BET.toLocaleString()} VENOM
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );
        }

        // ==================================================
        // BET LIMIT
        // ==================================================

        if (amount < MIN_BET) {
            return sock.sendMessage(
                from,
                {
                    text:
`❌ Minimum bet:
🪙 ${MIN_BET.toLocaleString()} VENOM`
                },
                { quoted: message }
            );
        }

        if (amount > MAX_BET) {
            return sock.sendMessage(
                from,
                {
                    text:
`❌ Maximum bet:
🪙 ${MAX_BET.toLocaleString()} VENOM`
                },
                { quoted: message }
            );
        }

        // ==================================================
        // USER
        // ==================================================

        const user =
            economy.get(sender);

        const balance =
            Number(user.balance) || 0;

        if (balance < amount) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 💸 COINFLIP 〕━━⬣
┃
┃ 👤 @${String(sender).split("@")[0]}
┃
┃ ❌ You're too broke!
┃
┃ 💰 Wallet :
┃    ${balance.toLocaleString()} VENOM
┃
┃ 🪙 Bet :
┃    ${amount.toLocaleString()} VENOM
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                },
                { quoted: message }
            );
        }

        // ==================================================
        // MARKET — LUCKY CHARM
        // ==================================================

        let winChance =
            BASE_WIN_CHANCE;

        let luckyActive = false;

        if (
            typeof economy.isItemActive === "function" &&
            economy.isItemActive(sender, "lucky")
        ) {
            luckyActive = true;

            // Lucky Charm gives a controlled advantage.
            winChance = 0.60;
        }

        // ==================================================
        // MARKET — ENGINE WIN CHANCE
        // ==================================================

        if (
            typeof gameEngine.getWinChance === "function"
        ) {
            try {
                const engineChance =
                    Number(
                        gameEngine.getWinChance(
                            sender,
                            null,
                            "coinflip"
                        )
                    );

                if (
                    Number.isFinite(engineChance) &&
                    engineChance >= 0 &&
                    engineChance <= 1
                ) {
                    winChance =
                        Math.max(
                            winChance,
                            engineChance
                        );
                }
            } catch {}
        }

        // ==================================================
        // FLIP
        // ==================================================

        const won =
            Math.random() < winChance;

        /*
         * We still display a genuine heads/tails result.
         * The result is selected so that the player's chosen
         * side corresponds to the market-adjusted outcome.
         */

        const result =
            won
                ? choice
                : choice === "heads"
                    ? "tails"
                    : "heads";

        // ==================================================
        // APPLY MONEY
        // ==================================================

        if (won) {

            // Original stake is already in wallet.
            // Add equal profit.
            economy.add(
                sender,
                amount
            );

        } else {

            // Remove the wager.
            economy.remove(
                sender,
                amount
            );
        }

        // ==================================================
        // GAME ENGINE
        // ==================================================

        const gameResult =
            gameEngine.recordGame(
                sender,
                "coinflip",
                won
            );

        // ==================================================
        // XP
        // ==================================================

        let xpResult = null;

        if (
            typeof gameEngine.calculateGameXP === "function"
        ) {
            try {
                const xp =
                    gameEngine.calculateGameXP(
                        sender,
                        won
                            ? 250
                            : 100,
                        "coinflip"
                    );

                if (
                    Number.isFinite(Number(xp))
                ) {
                    xpResult =
                        gameEngine.rewardXP(
                            sender,
                            Number(xp)
                        );
                }
            } catch {}
        }

        if (!xpResult) {
            xpResult =
                gameEngine.rewardXP(
                    sender,
                    won ? 250 : 100
                );
        }

        // ==================================================
        // MONEY TRACKING
        // ==================================================

        if (won) {
            gameEngine.trackMoneyEarned(
                sender,
                amount
            );
        } else {
            gameEngine.trackMoneyLost(
                sender,
                amount
            );
        }

        // ==================================================
        // UPDATED WALLET
        // ==================================================

        const updated =
            economy.get(sender);

        const resultEmoji =
            result === "heads"
                ? "🪙"
                : "🔄";

        // ==================================================
        // MARKET TEXT
        // ==================================================

        let marketText = "";

        if (luckyActive) {
            marketText +=
`\n┃ 🍀 Lucky Charm : ACTIVE
┃ 🎯 Win Chance : ${(winChance * 100).toFixed(0)}%`;
        }

        if (
            xpResult &&
            xpResult.leveledUp
        ) {
            marketText +=
`\n┃ 🎉 LEVEL UP → ${xpResult.level}`;
        }

        // ==================================================
        // WIN
        // ==================================================

        if (won) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🎉 COINFLIP WIN 〕━━⬣
┃
┃ 👤 @${String(sender).split("@")[0]}
┃
┃ ${resultEmoji} Coin :
┃    ${result.toUpperCase()}
┃
┃ 🎯 Choice :
┃    ${choice.toUpperCase()}
┃
┃ 🪙 Bet :
┃    ${amount.toLocaleString()} VENOM
┃
┃ 💚 Profit :
┃    +${amount.toLocaleString()} VENOM
┃
┃ ✨ XP :
┃    +${xpResult?.amount || (luckyActive ? 250 : 250)}
┃
┃ 💰 Wallet :
┃    ${Number(updated.balance).toLocaleString()} VENOM
${marketText}
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                },
                { quoted: message }
            );
        }

        // ==================================================
        // LOSS
        // ==================================================

        return sock.sendMessage(
            from,
            {
                text:
`╭━━〔 💀 COINFLIP LOSS 〕━━⬣
┃
┃ 👤 @${String(sender).split("@")[0]}
┃
┃ ${resultEmoji} Coin :
┃    ${result.toUpperCase()}
┃
┃ 🎯 Choice :
┃    ${choice.toUpperCase()}
┃
┃ 🪙 Bet :
┃    ${amount.toLocaleString()} VENOM
┃
┃ 💸 Lost :
┃    -${amount.toLocaleString()} VENOM
┃
┃ ✨ XP :
┃    +${xpResult?.amount || 100}
┃
┃ 💰 Wallet :
┃    ${Number(updated.balance).toLocaleString()} VENOM
${marketText}
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [sender]
            },
            { quoted: message }
        );
    }
};
