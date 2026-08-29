const duel = require("./duelgame");
const economy = require("../lib/economy");
const gameEngine = require("../lib/gameEngine");

// ============================================================
// VENOM X DICE
// Shared Game Engine + Market Attributes
// ============================================================

const DRAW_XP = 50;
const WIN_XP = 250;
const LOSS_XP = 100;

// ============================================================
// HELPERS
// ============================================================

function cleanId(id) {
    return String(id)
        .split("@")[0]
        .split(":")[0];
}

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
            "DICE LUCK ERROR:",
            error
        );
    }

    return 1;
}

function calculateXP(id, baseXP) {
    let xp = Number(baseXP) || 0;

    try {
        if (
            typeof gameEngine.calculateGameXP ===
            "function"
        ) {
            const result =
                gameEngine.calculateGameXP(
                    id,
                    xp
                );

            if (
                Number.isFinite(Number(result))
            ) {
                xp = Number(result);
            }
        }
    } catch (error) {
        console.error(
            "DICE XP CALC ERROR:",
            error
        );
    }

    return Math.max(
        0,
        Math.floor(xp)
    );
}

function rewardXP(id, baseXP) {
    const xp =
        calculateXP(
            id,
            baseXP
        );

    return {
        amount: xp,
        result: gameEngine.rewardXP(
            id,
            xp
        )
    };
}

// ============================================================
// LUCKY DICE ROLL
// ============================================================

function rollDice(id) {
    const luck = getLuck(id);

    let roll =
        Math.floor(
            Math.random() * 6
        ) + 1;

    /*
     * Lucky Charm gives a small chance
     * of improving a low roll.
     *
     * It does NOT guarantee a 6.
     */

    if (luck > 1 && roll <= 3) {
        const boostChance =
            Math.min(
                0.25,
                (luck - 1) * 0.05
            );

        if (
            Math.random() <
            boostChance
        ) {
            roll =
                Math.min(
                    6,
                    roll + 1
                );
        }
    }

    return roll;
}

// ============================================================
// COMMAND
// ============================================================

module.exports = {
    name: "dice",

    run: async ({
        sock,
        from,
        message,
        sender
    }) => {

        let game = null;
        let gameKey = null;

        // ====================================================
        // FIND ACTIVE DICE DUEL
        // ====================================================

        for (
            const [key, value]
            of duel.games.entries()
        ) {

            if (
                value.chat === from &&
                value.game === "dice" &&
                (
                    value.player1 === sender ||
                    value.player2 === sender
                )
            ) {
                game = value;
                gameKey = key;
                break;
            }
        }

        // ====================================================
        // NO GAME
        // ====================================================

        if (!game) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🎲 VENOM DICE 〕━━⬣
┃
┃ ❌ No active Dice Duel.
┃
┃ Start:
┃ .duel @user <amount>
┃
┃ Then:
┃ .accept
┃ .duelgame 1
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );
        }

        // ====================================================
        // INITIALIZE ROLLS
        // ====================================================

        if (!game.rolls) {
            game.rolls = {};
        }

        // ====================================================
        // PREVENT DOUBLE ROLL
        // ====================================================

        if (
            game.rolls[sender]
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
`❌ You already rolled!

🔒 Your roll is hidden.
⏳ Waiting for your opponent...`
                },
                { quoted: message }
            );
        }

        // ====================================================
        // ROLL
        // ====================================================

        const roll =
            rollDice(sender);

        game.rolls[sender] =
            roll;

        const opponent =
            sender === game.player1
                ? game.player2
                : game.player1;

        // ====================================================
        // WAIT FOR OPPONENT
        // ====================================================

        if (
            !game.rolls[opponent]
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🎲 DICE ROLL LOCKED 〕━━⬣
┃
┃ 👤 @${cleanId(sender)}
┃
┃ 🎲 Your roll has been locked.
┃
┃ 🔒 Roll : HIDDEN
┃
┃ 🍀 Luck :
┃    ${getLuck(sender).toFixed(2)}x
┃
┃ ⏳ Waiting for
┃    @${cleanId(opponent)}...
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [
                        sender,
                        opponent
                    ]
                },
                { quoted: message }
            );
        }

        // ====================================================
        // BOTH PLAYERS ROLLED
        // ====================================================

        const p1Roll =
            game.rolls[
                game.player1
            ];

        const p2Roll =
            game.rolls[
                game.player2
            ];

        const wager =
            Number(game.amount) || 0;

        const pot =
            wager * 2;

        // ====================================================
        // DRAW
        // ====================================================

        if (
            p1Roll === p2Roll
        ) {

            economy.add(
                game.player1,
                wager
            );

            economy.add(
                game.player2,
                wager
            );

            gameEngine.recordGame(
                game.player1,
                "dice",
                false
            );

            gameEngine.recordGame(
                game.player2,
                "dice",
                false
            );

            const xp1 =
                rewardXP(
                    game.player1,
                    DRAW_XP
                );

            const xp2 =
                rewardXP(
                    game.player2,
                    DRAW_XP
                );

            duel.games.delete(
                gameKey
            );

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🤝 DICE DRAW 〕━━⬣
┃
┃ 👤 @${cleanId(game.player1)}
┃ 🎲 Roll : ${p1Roll}
┃
┃ 👤 @${cleanId(game.player2)}
┃ 🎲 Roll : ${p2Roll}
┃
┃ 🤝 IT'S A DRAW!
┃
┃ 💰 Both stakes refunded.
┃
┃ ✨ XP : +${xp1.amount} each
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [
                        game.player1,
                        game.player2
                    ]
                },
                { quoted: message }
            );
        }

        // ====================================================
        // DETERMINE WINNER
        // ====================================================

        const winner =
            p1Roll > p2Roll
                ? game.player1
                : game.player2;

        const loser =
            winner === game.player1
                ? game.player2
                : game.player1;

        const winnerRoll =
            winner === game.player1
                ? p1Roll
                : p2Roll;

        // ====================================================
        // PAY WINNER
        // ====================================================

        economy.add(
            winner,
            pot
        );

        // ====================================================
        // GAME STATS
        // ====================================================

        const winnerGame =
            gameEngine.recordGame(
                winner,
                "dice",
                true
            );

        const loserGame =
            gameEngine.recordGame(
                loser,
                "dice",
                false
            );

        // ====================================================
        // XP
        // ====================================================

        const winnerXP =
            rewardXP(
                winner,
                WIN_XP
            );

        const loserXP =
            rewardXP(
                loser,
                LOSS_XP
            );

        // ====================================================
        // MONEY TRACKING
        // ====================================================

        gameEngine.trackMoneyEarned(
            winner,
            pot
        );

        gameEngine.trackMoneyLost(
            loser,
            wager
        );

        // ====================================================
        // UPDATED WALLET
        // ====================================================

        const updated =
            economy.get(winner);

        // ====================================================
        // LEVEL-UP TEXT
        // ====================================================

        let levelText = "";

        if (
            winnerXP.result &&
            winnerXP.result.leveledUp
        ) {
            levelText +=
`\n┃ 🎉 @${cleanId(winner)}
┃    LEVEL UP → ${winnerXP.result.level}`;
        }

        if (
            loserXP.result &&
            loserXP.result.leveledUp
        ) {
            levelText +=
`\n┃ 🎉 @${cleanId(loser)}
┃    LEVEL UP → ${loserXP.result.level}`;
        }

        // ====================================================
        // DELETE GAME
        // ====================================================

        duel.games.delete(
            gameKey
        );

        // ====================================================
        // RESULT
        // ====================================================

        await sock.sendMessage(
            from,
            {
                text:
`╭━━〔 🎲 VENOM DICE DUEL 〕━━⬣
┃
┃ 🥊 DICE DUEL COMPLETE!
┃
┃ 👤 @${cleanId(game.player1)}
┃    🎲 Roll : ${p1Roll}
┃
┃ 👤 @${cleanId(game.player2)}
┃    🎲 Roll : ${p2Roll}
┃
┃ ━━━━━━━━━━━━━━━
┃
┃ 🏆 WINNER
┃ 👑 @${cleanId(winner)}
┃
┃ 🎲 Winning Roll :
┃    ${winnerRoll}
┃
┃ 💰 Wager :
┃    ${wager.toLocaleString()} VENOM
┃
┃ 🏆 Prize :
┃    ${pot.toLocaleString()} VENOM
┃
┃ ✨ Winner XP :
┃    +${winnerXP.amount}
┃
┃ ✨ Loser XP :
┃    +${loserXP.amount}
┃
┃ 🍀 Winner Luck :
┃    ${getLuck(winner).toFixed(2)}x
┃
┃ 💎 Winner Wallet :
┃    ${Number(
    updated.balance
).toLocaleString()} VENOM
${levelText}
┃
┃ 💀 @${cleanId(loser)} lost.
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [
                    game.player1,
                    game.player2,
                    winner,
                    loser
                ]
            },
            { quoted: message }
        );
    }
};
