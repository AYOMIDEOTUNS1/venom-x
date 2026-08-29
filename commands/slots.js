const economy = require("../lib/economy");
const gameEngine = require("../lib/gameEngine");

const MIN_BET = 100;
const MAX_BET = 100000;

const symbols = [
    "🍒",
    "🍋",
    "🍊",
    "🍇",
    "💎",
    "7️⃣"
];

// ============================================================
// VENOM X SLOTS
// Shared gameEngine + market attributes
// ============================================================

function getLuck(id) {
    try {
        if (typeof gameEngine.getLuck === "function") {
            const luck = Number(
                gameEngine.getLuck(id)
            );

            if (
                Number.isFinite(luck) &&
                luck > 0
            ) {
                return luck;
            }
        }
    } catch (error) {
        console.error(
            "SLOTS LUCK ERROR:",
            error
        );
    }

    return 1;
}

function getSymbol(id) {
    const luck = getLuck(id);

    /*
     * Normal random roll.
     *
     * Higher luck gives a small chance
     * of receiving a better symbol.
     * It does NOT guarantee a jackpot.
     */

    const normal =
        symbols[
            Math.floor(
                Math.random() *
                symbols.length
            )
        ];

    if (luck <= 1) {
        return normal;
    }

    const boostChance =
        Math.min(
            0.20,
            (luck - 1) * 0.05
        );

    if (
        Math.random() >
        boostChance
    ) {
        return normal;
    }

    // Lucky symbols are weighted slightly higher
    const luckySymbols = [
        "🍇",
        "💎",
        "7️⃣"
    ];

    return luckySymbols[
        Math.floor(
            Math.random() *
            luckySymbols.length
        )
    ];
}

function rewardXP(id, amount) {
    let xp = Number(amount) || 0;

    try {
        if (
            typeof gameEngine.calculateGameXP ===
            "function"
        ) {
            const calculated =
                gameEngine.calculateGameXP(
                    id,
                    xp
                );

            if (
                Number.isFinite(
                    Number(calculated)
                )
            ) {
                xp = Number(calculated);
            }
        }
    } catch (error) {
        console.error(
            "SLOTS XP ERROR:",
            error
        );
    }

    return gameEngine.rewardXP(
        id,
        xp
    );
}

module.exports = {
    name: "slots",

    run: async ({
        sock,
        from,
        message,
        sender,
        args
    }) => {

        const bet =
            Number(args?.[0]);

        // ====================================================
        // BET VALIDATION
        // ====================================================

        if (
            !Number.isInteger(bet) ||
            bet < MIN_BET ||
            bet > MAX_BET
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🎰 VENOM SLOTS 〕━━⬣
┃
┃ Usage:
┃ .slots <amount>
┃
┃ 💰 Minimum :
┃    ${MIN_BET.toLocaleString()} VENOM
┃
┃ 💰 Maximum :
┃    ${MAX_BET.toLocaleString()} VENOM
┃
┃ Example:
┃ .slots 1000
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );
        }

        // ====================================================
        // BALANCE
        // ====================================================

        const user =
            economy.get(sender);

        const balance =
            Number(user.balance) || 0;

        if (balance < bet) {
            return sock.sendMessage(
                from,
                {
                    text:
`❌ Insufficient balance.

💰 Your Wallet :
${balance.toLocaleString()} VENOM

🎰 Required :
${bet.toLocaleString()} VENOM`
                },
                { quoted: message }
            );
        }

        // ====================================================
        // TAKE BET
        // ====================================================

        economy.add(
            sender,
            -bet
        );

        // ====================================================
        // ROLL
        // ====================================================

        const result = [
            getSymbol(sender),
            getSymbol(sender),
            getSymbol(sender)
        ];

        let multiplier = 0;

        // ====================================================
        // THREE MATCHING
        // ====================================================

        if (
            result[0] === result[1] &&
            result[1] === result[2]
        ) {
            multiplier =
                result[0] === "7️⃣"
                    ? 10
                    : 5;
        }

        // ====================================================
        // TWO MATCHING
        // ====================================================

        else if (
            result[0] === result[1] ||
            result[1] === result[2] ||
            result[0] === result[2]
        ) {
            multiplier = 2;
        }

        const prize =
            bet * multiplier;

        // ====================================================
        // WIN
        // ====================================================

        if (prize > 0) {

            economy.add(
                sender,
                prize
            );

            gameEngine.recordGame(
                sender,
                "slots",
                true
            );

            const xpResult =
                rewardXP(
                    sender,
                    multiplier >= 10
                        ? 400
                        : multiplier >= 5
                            ? 300
                            : 250
                );

            gameEngine.trackMoneyEarned(
                sender,
                prize
            );

            const updated =
                economy.get(sender);

            const xpAmount =
                xpResult?.amount ||
                xpResult?.xpGained ||
                xpResult?.xp ||
                0;

            let resultText;

            if (multiplier >= 10) {
                resultText =
                    "🔥 JACKPOT!";
            } else if (multiplier === 5) {
                resultText =
                    "🎉 BIG WIN!";
            } else {
                resultText =
                    "✨ DOUBLE!";
            }

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🎰 VENOM SLOTS 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ 🎰 ${result.join(" │ ")}
┃
┃ ${resultText}
┃
┃ 💰 Bet :
┃    ${bet.toLocaleString()} VENOM
┃
┃ 🏆 Prize :
┃    ${prize.toLocaleString()} VENOM
┃
┃ ✨ XP Earned :
┃    +${Number(xpAmount).toLocaleString()}
┃
┃ 🍀 Luck :
┃    ${getLuck(sender).toFixed(2)}x
┃
┃ 💎 Wallet :
┃    ${Number(
    updated.balance
).toLocaleString()} VENOM
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                },
                { quoted: message }
            );
        }

        // ====================================================
        // LOSS
        // ====================================================

        gameEngine.recordGame(
            sender,
            "slots",
            false
        );

        const xpResult =
            rewardXP(
                sender,
                100
            );

        gameEngine.trackMoneyLost(
            sender,
            bet
        );

        const updated =
            economy.get(sender);

        const xpAmount =
            xpResult?.amount ||
            xpResult?.xpGained ||
            xpResult?.xp ||
            0;

        return sock.sendMessage(
            from,
            {
                text:
`╭━━〔 🎰 VENOM SLOTS 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ 🎰 ${result.join(" │ ")}
┃
┃ 💀 YOU LOST!
┃
┃ 💰 Bet :
┃    ${bet.toLocaleString()} VENOM
┃
┃ 🏆 Prize :
┃    0 VENOM
┃
┃ ✨ XP Earned :
┃    +${Number(xpAmount).toLocaleString()}
┃
┃ 🍀 Luck :
┃    ${getLuck(sender).toFixed(2)}x
┃
┃ 💎 Wallet :
┃    ${Number(
    updated.balance
).toLocaleString()} VENOM
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [sender]
            },
            { quoted: message }
        );
    }
};
