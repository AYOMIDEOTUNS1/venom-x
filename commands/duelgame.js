const duel = require("./duel");
const economy = require("../lib/economy");

const games = new Map();

module.exports = {
    name: "duelgame",

    run: async ({ sock, from, message, sender, args }) => {
        const gameNumber = Number(args[0]);

        if (![1, 2, 3, 4].includes(gameNumber)) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🎮 DUEL GAMES 〕━━⬣
┃
┃ Choose a game:
┃
┃ 🎲 1. Dice
┃ ✊ 2. Rock Paper Scissors
┃ 🪙 3. Coinflip
┃ ⚔️ 4. Battle
┃
┃ Usage:
┃ .duelgame <number>
┃
┃ Example:
┃ .duelgame 1
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );
        }

        // Find the accepted duel involving this player.
        let activeDuel = null;

        for (const game of games.values()) {
            if (
                game.chat === from &&
                (game.player1 === sender ||
                 game.player2 === sender)
            ) {
                activeDuel = game;
                break;
            }
        }

        // Create a game from an accepted duel if one doesn't exist.
        if (!activeDuel) {
            for (const [key, data] of duel.pendingDuels.entries()) {
                if (
                    data.chat === from &&
                    (data.challenger === sender ||
                     data.opponent === sender)
                ) {
                    return sock.sendMessage(
                        from,
                        {
                            text:
`❌ The duel has not been accepted yet.

Wait for the opponent to use:
.accept`
                        },
                        { quoted: message }
                    );
                }
            }

            return sock.sendMessage(
                from,
                {
                    text:
`❌ You don't have an active duel.

Start one with:
.duel @user <amount>`
                },
                { quoted: message }
            );
        }

        // Only Dice is implemented in this step.
        if (gameNumber !== 1) {
            return sock.sendMessage(
                from,
                {
                    text:
`🚧 This game isn't ready yet.

Currently available:
🎲 1. Dice

Coming next:
✊ 2. Rock Paper Scissors
🪙 3. Coinflip
⚔️ 4. Battle`
                },
                { quoted: message }
            );
        }

        if (gameNumber === 1) {
        activeDuel.game = "dice";
} else if (gameNumber === 2) {
    activeDuel.game = "rps";
} else if (gameNumber === 3) {
    activeDuel.game = "coinflip";
} else if (gameNumber === 4) {
    activeDuel.game = "battle";
}

        const roll1 = Math.floor(Math.random() * 6) + 1;
        const roll2 = Math.floor(Math.random() * 6) + 1;

        const player1 = activeDuel.player1;
        const player2 = activeDuel.player2;

        let winner = null;

        if (roll1 > roll2) {
            winner = player1;
        } else if (roll2 > roll1) {
            winner = player2;
        }

        if (!winner) {
            // Tie: refund both players.
            economy.add(player1, activeDuel.amount);
            economy.add(player2, activeDuel.amount);

            games.delete(
                [...games.entries()]
                    .find(([, value]) => value === activeDuel)?.[0]
            );

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🎲 DICE DRAW 〕━━⬣
┃
┃ 🎲 @${player1.split("@")[0]} : ${roll1}
┃ 🎲 @${player2.split("@")[0]} : ${roll2}
┃
┃ 🤝 It's a draw!
┃
┃ 💰 Both stakes have been refunded.
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [player1, player2]
                },
                { quoted: message }
            );
        }

        const loser =
            winner === player1 ? player2 : player1;

        const pot = activeDuel.amount * 2;

        economy.add(winner, pot);

        const updatedWinner = economy.get(winner);

        games.delete(
            [...games.entries()]
                .find(([, value]) => value === activeDuel)?.[0]
        );

        await sock.sendMessage(
            from,
            {
                text:
`╭━━〔 🎲 DICE DUEL 〕━━⬣
┃
┃ 🥊 @${player1.split("@")[0]}
┃ 🎲 Roll : ${roll1}
┃
┃ 🥊 @${player2.split("@")[0]}
┃ 🎲 Roll : ${roll2}
┃
┃ 🏆 WINNER
┃ 👑 @${winner.split("@")[0]}
┃
┃ 💎 Prize : ${pot.toLocaleString()} VENOM
┃ 💰 Balance : ${updatedWinner.balance.toLocaleString()} VENOM
┃
┃ 💀 @${loser.split("@")[0]} lost the duel.
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [player1, player2, winner, loser]
            },
            { quoted: message }
        );
    },

    games
};
