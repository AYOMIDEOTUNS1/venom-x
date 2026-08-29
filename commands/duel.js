const economy = require("../lib/economy");
const gameEngine = require("../lib/gameEngine");

const MIN_WAGER = 1000;
const MAX_WAGER = 1000000;

const WIN_XP = 250;
const LOSS_XP = 100;

function getMentionedJid(message) {
    const context =
        message?.message?.extendedTextMessage?.contextInfo ||
        message?.message?.imageMessage?.contextInfo ||
        message?.message?.videoMessage?.contextInfo ||
        {};

    return context.mentionedJid?.[0] || null;
}

function cleanId(id) {
    return String(id || "")
        .split("@")[0]
        .split(":")[0];
}

module.exports = {
    name: "duel",

    run: async ({
        sock,
        from,
        message,
        sender,
        args
    }) => {

        // ==================================================
        // TARGET
        // ==================================================

        let targetJid =
            getMentionedJid(message);

        if (!targetJid && args?.[0]) {
            const number =
                String(args[0]).replace(/\D/g, "");

            if (number) {
                targetJid =
                    `${number}@s.whatsapp.net`;
            }
        }

        if (!targetJid) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 ⚔️ VENOM DUEL 〕━━⬣
┃
┃ Usage:
┃ .duel @user <wager>
┃
┃ Example:
┃ .duel @user 10000
┃
┃ 💰 Minimum : ${MIN_WAGER.toLocaleString()}
┃ 💰 Maximum : ${MAX_WAGER.toLocaleString()}
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );
        }

        // ==================================================
        // NORMALIZE PLAYERS
        // ==================================================

        const senderId =
            economy.normalizeId(sender);

        const targetId =
            economy.normalizeId(targetJid);

        if (!senderId || !targetId) {
            return sock.sendMessage(
                from,
                {
                    text: "❌ Invalid player."
                },
                { quoted: message }
            );
        }

        // ==================================================
        // SELF CHECK
        // ==================================================

        if (senderId === targetId) {
            return sock.sendMessage(
                from,
                {
                    text:
                        "😂 You can't duel yourself."
                },
                { quoted: message }
            );
        }

        // ==================================================
        // WAGER
        // ==================================================

        const wager =
            Number(args?.[1]);

        if (
            !Number.isInteger(wager) ||
            wager < MIN_WAGER ||
            wager > MAX_WAGER
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
`❌ Invalid wager.

💰 Minimum : ${MIN_WAGER.toLocaleString()}
💰 Maximum : ${MAX_WAGER.toLocaleString()}

Example:
.duel @user 10000`
                },
                { quoted: message }
            );
        }

        // ==================================================
        // USERS
        // ==================================================

        const player =
            economy.get(senderId);

        const opponent =
            economy.get(targetId);

        const now =
            Date.now();

        // ==================================================
        // JAIL CHECK
        // ==================================================

        if (
            Number(player.jailedUntil) > now
        ) {
            const minutes =
                Math.ceil(
                    (player.jailedUntil - now) /
                    60000
                );

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🚔 DUEL BLOCKED 〕━━⬣
┃
┃ 🔒 @${cleanId(senderId)}
┃ is currently in jail.
┃
┃ ⏳ Remaining :
┃ ${minutes} minutes
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [senderId]
                },
                { quoted: message }
            );
        }

        if (
            Number(opponent.jailedUntil) > now
        ) {
            const minutes =
                Math.ceil(
                    (opponent.jailedUntil - now) /
                    60000
                );

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🚔 DUEL BLOCKED 〕━━⬣
┃
┃ 🔒 @${cleanId(targetId)}
┃ is currently in jail.
┃
┃ ⏳ Remaining :
┃ ${minutes} minutes
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [targetId]
                },
                { quoted: message }
            );
        }

        // ==================================================
        // WALLET CHECK
        // ==================================================

        if (
            Number(player.balance) < wager
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
`❌ Your wallet is too low.

💰 Wallet :
${Number(player.balance).toLocaleString()} VENOM

⚔️ Required :
${wager.toLocaleString()} VENOM`
                },
                { quoted: message }
            );
        }

        if (
            Number(opponent.balance) < wager
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
`❌ @${cleanId(targetId)} doesn't have enough VENOM.

💰 Wallet :
${Number(opponent.balance).toLocaleString()}

⚔️ Required :
${wager.toLocaleString()} VENOM`,
                    mentions: [targetId]
                },
                { quoted: message }
            );
        }

        // ==================================================
        // LOCK WAGERS
        // ==================================================

        economy.add(
            senderId,
            -wager
        );

        economy.add(
            targetId,
            -wager
        );

        // ==================================================
        // WINNER
        // ==================================================

        let playerWins = false;

        if (
            typeof gameEngine.getWinChance === "function"
        ) {
            const chance =
                Number(
                    gameEngine.getWinChance(
                        senderId,
                        targetId,
                        "duel"
                    )
                );

            if (
                Number.isFinite(chance) &&
                chance >= 0 &&
                chance <= 1
            ) {
                playerWins =
                    Math.random() < chance;
            } else {
                playerWins =
                    Math.random() < 0.5;
            }
        } else {
            playerWins =
                Math.random() < 0.5;
        }

        const winner =
            playerWins
                ? senderId
                : targetId;

        const loser =
            playerWins
                ? targetId
                : senderId;

        const prize =
            wager * 2;

        // ==================================================
        // PAY WINNER
        // ==================================================

        economy.add(
            winner,
            prize
        );

        // ==================================================
        // GAME ENGINE
        // ==================================================

        const result =
            gameEngine.finishGame({
                game: "duel",
                winner,
                loser,
                winnerXP: WIN_XP,
                loserXP: LOSS_XP
            });

        // ==================================================
        // MONEY TRACKING
        // ==================================================

        gameEngine.trackMoneyEarned(
            winner,
            prize
        );

        gameEngine.trackMoneyLost(
            loser,
            wager
        );

        // ==================================================
        // UPDATED DATA
        // ==================================================

        const updatedWinner =
            economy.get(winner);

        const updatedLoser =
            economy.get(loser);

        // ==================================================
        // LEVEL-UP
        // ==================================================

        let levelText = "";

        if (
            result.winnerXP &&
            result.winnerXP.leveledUp
        ) {
            levelText +=
`\n┃ 🎉 @${cleanId(winner)}
┃    LEVEL UP → ${result.winnerXP.level}`;
        }

        if (
            result.loserXP &&
            result.loserXP.leveledUp
        ) {
            levelText +=
`\n┃ 🎉 @${cleanId(loser)}
┃    LEVEL UP → ${result.loserXP.level}`;
        }

        // ==================================================
        // MARKET STATUS
        // ==================================================

        let marketText = "";

        if (
            typeof economy.isItemActive === "function"
        ) {
            if (
                economy.isItemActive(
                    winner,
                    "lucky"
                )
            ) {
                marketText +=
`\n┃ 🍀 Lucky Charm : ACTIVE`;
            }
        }

        if (
            typeof gameEngine.getXPMultiplier === "function"
        ) {
            try {
                const multiplier =
                    Number(
                        gameEngine.getXPMultiplier(
                            winner
                        )
                    );

                if (
                    Number.isFinite(multiplier) &&
                    multiplier > 1
                ) {
                    marketText +=
`\n┃ ⚡ XP Multiplier : ${multiplier}x`;
                }
            } catch {}
        }

        // ==================================================
        // RESULT
        // ==================================================

        await sock.sendMessage(
            from,
            {
                text:
`╭━━〔 ⚔️ VENOM DUEL 〕━━⬣
┃
┃ 🥊 DUEL COMPLETE!
┃
┃ 👑 Winner
┃    @${cleanId(winner)}
┃
┃ 💀 Loser
┃    @${cleanId(loser)}
┃
┃ 💰 Wager
┃    ${wager.toLocaleString()} VENOM
┃
┃ 🏆 Prize
┃    ${prize.toLocaleString()} VENOM
┃
┃ ✨ Winner XP
┃    +${WIN_XP}
┃
┃ ✨ Loser XP
┃    +${LOSS_XP}
┃
┃ 💎 Winner Wallet
┃    ${Number(
        updatedWinner.balance
    ).toLocaleString()} VENOM
┃
┃ 💰 Loser Wallet
┃    ${Number(
        updatedLoser.balance
    ).toLocaleString()} VENOM
${marketText}
${levelText}
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [
                    senderId,
                    targetId,
                    winner,
                    loser
                ]
            },
            { quoted: message }
        );
    }
};
