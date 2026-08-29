const duel = require("./duelgame");
const economy = require("../lib/economy");

module.exports = {
    name: "coinchoice",

    run: async ({ sock, from, message, sender, args }) => {
        const choice = args[0]?.toLowerCase();

        if (!["heads", "tails"].includes(choice)) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🪙 COINFLIP DUEL 〕━━⬣
┃
┃ Choose:
┃
┃ .coinchoice heads
┃ .coinchoice tails
┃
┃ 🎯 First choose your side.
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );
        }

        let activeGame = null;
        let gameKey = null;

        for (const [key, game] of duel.games.entries()) {
            if (
                game.chat === from &&
                game.player1 &&
                game.player2 &&
                (game.player1 === sender ||
                 game.player2 === sender)
            ) {
                activeGame = game;
                gameKey = key;
                break;
            }
        }

        if (!activeGame) {
            return sock.sendMessage(
                from,
                {
                    text: "❌ You don't have an active duel."
                },
                { quoted: message }
            );
        }

        if (activeGame.game !== "coinflip") {
            return sock.sendMessage(
                from,
                {
                    text: "❌ This duel isn't a coinflip game."
                },
                { quoted: message }
            );
        }

        if (activeGame.choices?.[sender]) {
            return sock.sendMessage(
                from,
                {
                    text: "❌ You already made your choice."
                },
                { quoted: message }
            );
        }

        if (!activeGame.choices) {
            activeGame.choices = {};
        }

        activeGame.choices[sender] = choice;

        const opponent =
            sender === activeGame.player1
                ? activeGame.player2
                : activeGame.player1;

        // Wait for the other player.
        if (!activeGame.choices[opponent]) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🪙 CHOICE LOCKED 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃ ✅ Your choice has been locked.
┃
┃ ⏳ Waiting for @${opponent.split("@")[0]}
┃ to choose...
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender, opponent]
                },
                { quoted: message }
            );
        }

        const result =
            Math.random() < 0.5
                ? "heads"
                : "tails";

        const player1Choice =
            activeGame.choices[activeGame.player1];

        const player2Choice =
            activeGame.choices[activeGame.player2];

        let winner = null;

        if (player1Choice === result) {
            winner = activeGame.player1;
        } else if (player2Choice === result) {
            winner = activeGame.player2;
        }

        // Both chose the same side.
        // If the result matches their shared choice, choose one randomly.
        if (
            player1Choice === player2Choice &&
            player1Choice === result
        ) {
            winner =
                Math.random() < 0.5
                    ? activeGame.player1
                    : activeGame.player2;
        }

        const pot = activeGame.amount * 2;

        if (winner) {
            economy.add(winner, pot);
        }

        duel.games.delete(gameKey);

        const loser =
            winner === activeGame.player1
                ? activeGame.player2
                : activeGame.player1;

        const winnerBalance = winner
            ? economy.get(winner).balance
            : 0;

        await sock.sendMessage(
            from,
            {
                text:
`╭━━〔 🪙 COINFLIP DUEL 〕━━⬣
┃
┃ 🥊 @${activeGame.player1.split("@")[0]}
┃ Choice : ${player1Choice}
┃
┃ 🥊 @${activeGame.player2.split("@")[0]}
┃ Choice : ${player2Choice}
┃
┃ 🪙 Result : ${result.toUpperCase()}
┃
┃ 🏆 WINNER
┃ 👑 @${winner.split("@")[0]}
┃
┃ 💎 Prize : ${pot.toLocaleString()} VENOM
┃ 💰 Balance : ${winnerBalance.toLocaleString()} VENOM
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [
                    activeGame.player1,
                    activeGame.player2,
                    winner,
                    loser
                ]
            },
            { quoted: message }
        );
    }
};
