const economy = require("../lib/economy");

const MIN_WAGER = 1000;
const MAX_WAGER = 100000;
const MOVE_TIME = 60 * 1000;

// Active RPS matches
const matches = new Map();

const CHOICES = {
    rock: "🪨",
    paper: "📄",
    scissors: "✂️"
};

// ============================================================
// HELPERS
// ============================================================

function cleanId(id) {
    return String(id)
        .split("@")[0]
        .split(":")[0];
}

function normalizeId(id) {
    if (typeof economy.normalizeId === "function") {
        return economy.normalizeId(id);
    }

    return cleanId(id);
}

function samePlayer(a, b) {
    return normalizeId(a) === normalizeId(b);
}

function normalizeMove(value) {
    if (!value) return null;

    const move = String(value).toLowerCase();

    if (["rock", "r"].includes(move)) {
        return "rock";
    }

    if (["paper", "p"].includes(move)) {
        return "paper";
    }

    if (
        ["scissors", "scissor", "s"].includes(move)
    ) {
        return "scissors";
    }

    return null;
}

function getWinner(move1, move2) {
    if (move1 === move2) {
        return "draw";
    }

    if (
        (move1 === "rock" && move2 === "scissors") ||
        (move1 === "paper" && move2 === "rock") ||
        (move1 === "scissors" && move2 === "paper")
    ) {
        return "player1";
    }

    return "player2";
}

function getMentioned(message) {
    const context =
        message?.message?.extendedTextMessage?.contextInfo ||
        message?.message?.imageMessage?.contextInfo ||
        message?.message?.videoMessage?.contextInfo ||
        {};

    return context.mentionedJid?.[0] || null;
}

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

function addGamePlayed(id) {
    const user = economy.get(id);
    const stats = ensureStats(user);

    stats.gamesPlayed += 1;

    economy.set(id, {
        stats
    });
}

function addWin(id) {
    const user = economy.get(id);
    const stats = ensureStats(user);

    stats.gamesPlayed += 1;
    stats.gamesWon += 1;

    economy.set(id, {
        stats
    });
}

function addLoss(id) {
    const user = economy.get(id);
    const stats = ensureStats(user);

    stats.gamesPlayed += 1;
    stats.gamesLost += 1;

    economy.set(id, {
        stats
    });
}

function addMoneyEarned(id, amount) {
    const user = economy.get(id);
    const stats = ensureStats(user);

    stats.moneyEarned += Number(amount) || 0;

    economy.set(id, {
        stats
    });
}

function addMoneyLost(id, amount) {
    const user = economy.get(id);
    const stats = ensureStats(user);

    stats.moneyLost += Number(amount) || 0;

    economy.set(id, {
        stats
    });
}

function addXP(id, amount) {
    if (typeof economy.addXP === "function") {
        return economy.addXP(id, amount);
    }

    return null;
}

// ============================================================
// SEND PRIVATE MOVE REQUEST
// ============================================================

async function sendPrivateMove(sock, player, opponent, wager) {
    try {
        await sock.sendMessage(player, {
            text:
`╭━━〔 🔒 VENOM RPS PRIVATE 〕━━⬣
┃
┃ ✊ YOUR RPS MATCH IS READY!
┃
┃ 👤 Opponent :
┃    @${cleanId(opponent)}
┃
┃ 💰 Wager :
┃    ${wager.toLocaleString()} VENOM
┃
┃ 🔐 YOUR MOVE IS PRIVATE
┃
┃ Choose ONE:
┃
┃ 🪨 .rps rock
┃ 📄 .rps paper
┃ ✂️ .rps scissors
┃
┃ ⏳ Time : 60 seconds
┃
┃ ⚠️ Send your move HERE,
┃ not in the group.
╰━━━━━━━━━━━━━━━━⬣`,
            mentions: [opponent]
        });

        return true;

    } catch (error) {
        console.error(
            "❌ RPS PRIVATE MESSAGE ERROR:",
            error
        );

        return false;
    }
}

// ============================================================
// FIND ACTIVE MATCH FOR PLAYER
// ============================================================

function findPlayerMatch(player) {
    for (const [key, activeMatch] of matches.entries()) {

        if (
            samePlayer(activeMatch.player1, player) ||
            samePlayer(activeMatch.player2, player)
        ) {
            return {
                key,
                match: activeMatch
            };
        }
    }

    return null;
}

// ============================================================
// MODULE
// ============================================================

module.exports = {
    name: "rps",

    aliases: [
        "rockpaperscissors"
    ],

    run: async ({
        sock,
        from,
        message,
        sender,
        args
    }) => {

        const isPrivate =
            !String(from).endsWith("@g.us");

        // ====================================================
        // PRIVATE CHAT
        // Player is submitting their hidden move
        // ====================================================

        if (isPrivate) {

            const found =
                findPlayerMatch(sender);

            // No active RPS match
            if (!found) {
                return sock.sendMessage(
                    from,
                    {
                        text:
`╭━━〔 ✊ VENOM RPS 〕━━⬣
┃
┃ ❌ You don't have an
┃ active RPS match.
┃
┃ Start one from a group:
┃
┃ .rps @user 1000
╰━━━━━━━━━━━━━━━━⬣`
                    },
                    { quoted: message }
                );
            }

            const activeMatch =
                found.match;

            const matchKey =
                found.key;

            const move =
                normalizeMove(args?.[0]);

            if (!move) {
                return sock.sendMessage(
                    from,
                    {
                        text:
`╭━━〔 🔒 RPS MOVE 〕━━⬣
┃
┃ Choose ONE:
┃
┃ 🪨 .rps rock
┃ 📄 .rps paper
┃ ✂️ .rps scissors
┃
╰━━━━━━━━━━━━━━━━⬣`
                    },
                    { quoted: message }
                );
            }

            let playerNumber = 0;

            if (
                samePlayer(
                    activeMatch.player1,
                    sender
                )
            ) {
                playerNumber = 1;
            }

            if (
                samePlayer(
                    activeMatch.player2,
                    sender
                )
            ) {
                playerNumber = 2;
            }

            if (!playerNumber) {
                return;
            }

            // =================================================
            // PREVENT CHANGING MOVE
            // =================================================

            if (
                playerNumber === 1 &&
                activeMatch.move1
            ) {
                return sock.sendMessage(
                    from,
                    {
                        text:
`🔒 Your move is already locked.

🤫 You cannot change it.`
                    },
                    { quoted: message }
                );
            }

            if (
                playerNumber === 2 &&
                activeMatch.move2
            ) {
                return sock.sendMessage(
                    from,
                    {
                        text:
`🔒 Your move is already locked.

🤫 You cannot change it.`
                    },
                    { quoted: message }
                );
            }

            // =================================================
            // SAVE PRIVATE MOVE
            // =================================================

            if (playerNumber === 1) {
                activeMatch.move1 = move;
            } else {
                activeMatch.move2 = move;
            }

            await sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🔒 MOVE LOCKED 〕━━⬣
┃
┃ ${CHOICES[move]}
┃ Your move has been locked.
┃
┃ 🤫 VENOM will keep it hidden.
┃
┃ ⏳ Waiting for opponent...
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );

            // =================================================
            // ONLY ONE PLAYER HAS CHOSEN
            // =================================================

            if (
                !activeMatch.move1 ||
                !activeMatch.move2
            ) {
                return;
            }

            // =================================================
            // BOTH PLAYERS CHOSE
            // =================================================

            clearTimeout(
                activeMatch.timer
            );

            matches.delete(matchKey);

            const result =
                getWinner(
                    activeMatch.move1,
                    activeMatch.move2
                );

            const wager =
                activeMatch.wager;

            const pot =
                wager * 2;

            // =================================================
            // DRAW
            // =================================================

            if (result === "draw") {

                economy.add(
                    activeMatch.player1,
                    wager
                );

                economy.add(
                    activeMatch.player2,
                    wager
                );

                addGamePlayed(
                    activeMatch.player1
                );

                addGamePlayed(
                    activeMatch.player2
                );

                addXP(
                    activeMatch.player1,
                    50
                );

                addXP(
                    activeMatch.player2,
                    50
                );

                await sock.sendMessage(
                    activeMatch.chat,
                    {
                        text:
`╭━━〔 ✊ VENOM RPS 〕━━⬣
┃
┃ 🤝 RPS DRAW!
┃
┃ 👤 Player 1
┃    @${cleanId(activeMatch.player1)}
┃    ${CHOICES[activeMatch.move1]}
┃
┃ 👤 Player 2
┃    @${cleanId(activeMatch.player2)}
┃    ${CHOICES[activeMatch.move2]}
┃
┃ 💰 Wager Returned
┃    ${wager.toLocaleString()} each
┃
┃ ✨ XP : +50 each
╰━━━━━━━━━━━━━━━━⬣`,
                        mentions: [
                            activeMatch.player1,
                            activeMatch.player2
                        ]
                    }
                );

                return;
            }

            // =================================================
            // DETERMINE WINNER
            // =================================================

            const winner =
                result === "player1"
                    ? activeMatch.player1
                    : activeMatch.player2;

            const loser =
                result === "player1"
                    ? activeMatch.player2
                    : activeMatch.player1;

            const winnerMove =
                result === "player1"
                    ? activeMatch.move1
                    : activeMatch.move2;

            const loserMove =
                result === "player1"
                    ? activeMatch.move2
                    : activeMatch.move1;

            // =================================================
            // PAY WINNER
            // =================================================

            economy.add(
                winner,
                pot
            );

            // =================================================
            // STATS
            // =================================================

            addWin(winner);
            addLoss(loser);

            addMoneyEarned(
                winner,
                pot
            );

            addMoneyLost(
                loser,
                wager
            );

            // =================================================
            // XP
            // =================================================

            addXP(
                winner,
                250
            );

            addXP(
                loser,
                100
            );

            const winnerUser =
                economy.get(winner);

            const loserUser =
                economy.get(loser);

            // =================================================
            // GROUP RESULT
            // =================================================

            await sock.sendMessage(
                activeMatch.chat,
                {
                    text:
`╭━━〔 ✊ VENOM RPS 〕━━⬣
┃
┃ 🥊 RPS COMPLETE!
┃
┃ 👑 Winner
┃    @${cleanId(winner)}
┃    ${CHOICES[winnerMove]}
┃
┃ 💀 Loser
┃    @${cleanId(loser)}
┃    ${CHOICES[loserMove]}
┃
┃ 💰 Wager
┃    ${wager.toLocaleString()} VENOM
┃
┃ 🏆 Prize
┃    ${pot.toLocaleString()} VENOM
┃
┃ ✨ Winner XP : +250
┃ ✨ Loser XP : +100
┃
┃ 💎 Winner Wallet
┃    ${Number(
    winnerUser.balance
).toLocaleString()} VENOM
┃
┃ 💰 Loser Wallet
┃    ${Number(
    loserUser.balance
).toLocaleString()} VENOM
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [
                        winner,
                        loser
                    ]
                }
            );

            return;
        }

        // ====================================================
        // GROUP CHAT
        // START NEW RPS MATCH
        // ====================================================

        const target =
            getMentioned(message);

        const wager =
            Number(args?.[1]);

        if (
            !target ||
            !Number.isInteger(wager)
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 ✊ VENOM RPS 〕━━⬣
┃
┃ ⚔️ PLAYER VS PLAYER
┃
┃ Usage:
┃ .rps @user <wager>
┃
┃ Example:
┃ .rps @user 1000
┃
┃ 🔒 Moves are PRIVATE.
┃
┃ 💰 Minimum :
┃    ${MIN_WAGER.toLocaleString()}
┃
┃ 💰 Maximum :
┃    ${MAX_WAGER.toLocaleString()}
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );
        }

        const player1 =
            sender;

        const player2 =
            target;

        // ====================================================
        // SELF CHECK
        // ====================================================

        if (
            samePlayer(
                player1,
                player2
            )
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
                        "😂 You can't play RPS against yourself."
                },
                { quoted: message }
            );
        }

        // ====================================================
        // WAGER CHECK
        // ====================================================

        if (
            wager < MIN_WAGER ||
            wager > MAX_WAGER
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
`❌ Invalid wager.

💰 Minimum : ${MIN_WAGER.toLocaleString()} VENOM
💰 Maximum : ${MAX_WAGER.toLocaleString()} VENOM`
                },
                { quoted: message }
            );
        }

        // ====================================================
        // BALANCE CHECK
        // ====================================================

        const player1User =
            economy.get(player1);

        const player2User =
            economy.get(player2);

        if (
            Number(player1User.balance) < wager
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
`❌ @${cleanId(player1)} doesn't have enough VENOM.

💰 Wallet :
${Number(
    player1User.balance
).toLocaleString()}

⚔️ Required :
${wager.toLocaleString()} VENOM`,
                    mentions: [player1]
                },
                { quoted: message }
            );
        }

        if (
            Number(player2User.balance) < wager
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
`❌ @${cleanId(player2)} doesn't have enough VENOM.

💰 Wallet :
${Number(
    player2User.balance
).toLocaleString()}

⚔️ Required :
${wager.toLocaleString()} VENOM`,
                    mentions: [player2]
                },
                { quoted: message }
            );
        }

        // ====================================================
        // ACTIVE GAME CHECK
        // ====================================================

        for (const activeMatch of matches.values()) {

            if (
                samePlayer(
                    activeMatch.player1,
                    player1
                ) ||
                samePlayer(
                    activeMatch.player2,
                    player1
                ) ||
                samePlayer(
                    activeMatch.player1,
                    player2
                ) ||
                samePlayer(
                    activeMatch.player2,
                    player2
                )
            ) {
                return sock.sendMessage(
                    from,
                    {
                        text:
                            "⚠️ One of these players already has an active RPS match."
                    },
                    { quoted: message }
                );
            }
        }

        // ====================================================
        // LOCK BOTH WAGERS
        // ====================================================

        economy.add(
            player1,
            -wager
        );

        economy.add(
            player2,
            -wager
        );

        // ====================================================
        // CREATE UNIQUE MATCH
        // ====================================================

        const matchKey =
            `${from}:${Date.now()}:${Math.random()
                .toString(36)
                .slice(2)}`;

        const newMatch = {
            chat: from,

            player1,
            player2,

            wager,

            move1: null,
            move2: null,

            timer: null
        };

        matches.set(
            matchKey,
            newMatch
        );

        // ====================================================
        // PRIVATE MESSAGES
        // ====================================================

        const player1DM =
            await sendPrivateMove(
                sock,
                player1,
                player2,
                wager
            );

        const player2DM =
            await sendPrivateMove(
                sock,
                player2,
                player1,
                wager
            );

        // ====================================================
        // PRIVATE MESSAGE FAILURE
        // ====================================================

        if (
            !player1DM ||
            !player2DM
        ) {

            matches.delete(
                matchKey
            );

            economy.add(
                player1,
                wager
            );

            economy.add(
                player2,
                wager
            );

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 ❌ RPS CANCELLED 〕━━⬣
┃
┃ VENOM couldn't privately
┃ contact both players.
┃
┃ 💰 Both wagers refunded.
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );
        }

        // ====================================================
        // 60 SECOND TIMER
        // ====================================================

        newMatch.timer =
            setTimeout(
                async () => {

                    if (
                        !matches.has(
                            matchKey
                        )
                    ) {
                        return;
                    }

                    matches.delete(
                        matchKey
                    );

                    // Refund both
                    economy.add(
                        player1,
                        wager
                    );

                    economy.add(
                        player2,
                        wager
                    );

                    // Count cancelled game
                    addGamePlayed(
                        player1
                    );

                    addGamePlayed(
                        player2
                    );

                    try {
                        await sock.sendMessage(
                            from,
                            {
                                text:
`╭━━〔 ⏰ VENOM RPS EXPIRED 〕━━⬣
┃
┃ ❌ Time ran out!
┃
┃ 🔒 Match cancelled.
┃
┃ 💰 Both wagers refunded.
┃
┃ 👤 @${cleanId(player1)}
┃ 👤 @${cleanId(player2)}
╰━━━━━━━━━━━━━━━━⬣`,
                                mentions: [
                                    player1,
                                    player2
                                ]
                            }
                        );
                    } catch (error) {
                        console.error(
                            "RPS EXPIRY MESSAGE ERROR:",
                            error
                        );
                    }

                },
                MOVE_TIME
            );

        // ====================================================
        // GROUP ANNOUNCEMENT
        // ====================================================

        await sock.sendMessage(
            from,
            {
                text:
`╭━━〔 ✊ VENOM RPS 〕━━⬣
┃
┃ ⚔️ RPS MATCH STARTED!
┃
┃ 👤 Player 1
┃    @${cleanId(player1)}
┃
┃ 👤 Player 2
┃    @${cleanId(player2)}
┃
┃ 💰 Wager
┃    ${wager.toLocaleString()} VENOM each
┃
┃ 🔒 Both wagers locked!
┃
┃ 📩 VENOM privately
┃ messaged both players.
┃
┃ 🤫 Moves are hidden.
┃
┃ ⏳ Time : 60 seconds
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [
                    player1,
                    player2
                ]
            },
            { quoted: message }
        );
    }
};
