const duel = require("./duel");
const economy = require("../lib/economy");

module.exports = {
    name: "accept",

    run: async ({ sock, from, message, sender }) => {
        let challenge = null;
        let challengeKey = null;

        for (const [key, data] of duel.pendingDuels.entries()) {
            if (
                data.chat === from &&
                data.opponent === sender
            ) {
                challenge = data;
                challengeKey = key;
                break;
            }
        }

        if (!challenge) {
            return sock.sendMessage(
                from,
                {
                    text: "❌ You don't have a pending duel challenge."
                },
                { quoted: message }
            );
        }

        const challenger = economy.get(challenge.challenger);
        const opponent = economy.get(challenge.opponent);

        if (challenger.balance < challenge.amount) {
            duel.pendingDuels.delete(challengeKey);

            return sock.sendMessage(
                from,
                {
                    text: "❌ The challenger no longer has enough VENOM."
                },
                { quoted: message }
            );
        }

        if (opponent.balance < challenge.amount) {
            duel.pendingDuels.delete(challengeKey);

            return sock.sendMessage(
                from,
                {
                    text: "❌ You no longer have enough VENOM."
                },
                { quoted: message }
            );
        }

        // Remove challenge.
        duel.pendingDuels.delete(challengeKey);

        // Lock both stakes.
        economy.add(
            challenge.challenger,
            -challenge.amount
        );

        economy.add(
            challenge.opponent,
            -challenge.amount
        );

	// ===================== CREATE ACTIVE DUEL =====================
const duelGame = require("./duelgame");

const gameKey =
    `${from}:${challenge.challenger}:${challenge.opponent}`;

duelGame.games.set(gameKey, {
    player1: challenge.challenger,
    player2: challenge.opponent,
    amount: challenge.amount,
    chat: from,
    createdAt: Date.now()
});


        const pot = challenge.amount * 2;

        await sock.sendMessage(
            from,
            {
                text:
`╭━━〔 ⚔️ DUEL ACCEPTED 〕━━⬣
┃
┃ 🥊 @${challenge.challenger.split("@")[0]}
┃ VS
┃ 🥊 @${challenge.opponent.split("@")[0]}
┃
┃ 💰 Stake : ${challenge.amount.toLocaleString()} VENOM each
┃ 💎 Prize Pool : ${pot.toLocaleString()} VENOM
┃
┃ 🎮 Choose your game:
┃
┃ 🎲 1. Dice
┃ ✊ 2. Rock Paper Scissors
┃ 🪙 3. Coinflip
┃ ⚔️ 4. Battle
┃
┃ Type:
┃ .duelgame 1
┃
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [
                    challenge.challenger,
                    challenge.opponent
                ]
            },
            { quoted: message }
        );
    }
};
