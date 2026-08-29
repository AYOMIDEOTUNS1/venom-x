const economy = require("../lib/economy");
const gameEngine = require("../lib/gameEngine");

// ============================================================
// VENOM X BLACKJACK
// Shared economy + gameEngine system
// ============================================================

const MIN_BET = 1000;
const MAX_BET = 1000000;
const GAME_TIMEOUT = 2 * 60 * 1000;

const games = new Map();

// ============================================================
// CARD DECK
// ============================================================

const SUITS = ["♠️", "♥️", "♦️", "♣️"];

const RANKS = [
    { rank: "A", value: 11 },
    { rank: "2", value: 2 },
    { rank: "3", value: 3 },
    { rank: "4", value: 4 },
    { rank: "5", value: 5 },
    { rank: "6", value: 6 },
    { rank: "7", value: 7 },
    { rank: "8", value: 8 },
    { rank: "9", value: 9 },
    { rank: "10", value: 10 },
    { rank: "J", value: 10 },
    { rank: "Q", value: 10 },
    { rank: "K", value: 10 }
];

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

    return String(id);
}

function cardText(card) {
    return `${card.rank}${card.suit}`;
}

function handValue(hand) {
    let total = 0;
    let aces = 0;

    for (const card of hand) {
        total += card.value;

        if (card.rank === "A") {
            aces++;
        }
    }

    // Convert A from 11 to 1 when necessary
    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }

    return total;
}

function isBlackjack(hand) {
    return (
        hand.length === 2 &&
        handValue(hand) === 21
    );
}

function formatHand(hand) {
    return hand.map(cardText).join(" │ ");
}

function createDeck() {
    const deck = [];

    for (const suit of SUITS) {
        for (const data of RANKS) {
            deck.push({
                rank: data.rank,
                value: data.value,
                suit
            });
        }
    }

    return deck;
}

function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j =
            Math.floor(
                Math.random() * (i + 1)
            );

        [deck[i], deck[j]] =
            [deck[j], deck[i]];
    }

    return deck;
}

function drawCard(game) {
    return game.deck.pop();
}

// ============================================================
// MARKET LUCK
// ============================================================

function getPlayerLuck(id) {
    try {
        if (
            typeof gameEngine.getLuck ===
            "function"
        ) {
            const luck =
                Number(
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
            "BLACKJACK LUCK ERROR:",
            error
        );
    }

    return 1;
}

// ============================================================
// MARKET-AFFECTED DRAW
// ============================================================

function drawPlayerCard(game) {
    const luck =
        getPlayerLuck(game.player);

    /*
     * The engine normally returns 1 when
     * the player has no luck attribute.
     *
     * A higher luck value gives the player
     * a small chance to receive a better
     * card. It does NOT guarantee a win.
     */

    if (luck <= 1 || game.deck.length < 2) {
        return drawCard(game);
    }

    const normal =
        drawCard(game);

    const shouldBoost =
        Math.random() <
        Math.min(
            0.20,
            (luck - 1) * 0.05
        );

    if (!shouldBoost) {
        return normal;
    }

    // Find a better card among remaining cards
    let bestIndex = -1;
    let bestValue = -1;

    const current =
        handValue(game.playerHand);

    for (
        let i = 0;
        i < game.deck.length;
        i++
    ) {
        const card =
            game.deck[i];

        const testValue =
            current + card.value;

        if (
            testValue <= 21 &&
            card.value > bestValue
        ) {
            bestValue = card.value;
            bestIndex = i;
        }
    }

    if (bestIndex === -1) {
        return normal;
    }

    const better =
        game.deck.splice(
            bestIndex,
            1
        )[0];

    game.deck.push(normal);

    return better;
}

// ============================================================
// FIND ACTIVE GAME
// ============================================================

function findGame(player) {
    const id =
        normalizeId(player);

    for (const [key, game] of games.entries()) {
        if (
            normalizeId(game.player) === id
        ) {
            return {
                key,
                game
            };
        }
    }

    return null;
}

// ============================================================
// XP
// ============================================================

function rewardGameXP(player, amount) {
    let xp = Number(amount) || 0;

    try {
        if (
            typeof gameEngine.calculateGameXP ===
            "function"
        ) {
            const calculated =
                gameEngine.calculateGameXP(
                    player,
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
            "BLACKJACK XP CALC ERROR:",
            error
        );
    }

    return gameEngine.rewardXP(
        player,
        xp
    );
}

// ============================================================
// FINISH / STATS
// ============================================================

function finishWin(player, amount) {
    gameEngine.recordGame(
        player,
        "blackjack",
        true
    );

    rewardGameXP(
        player,
        250
    );

    gameEngine.trackMoneyEarned(
        player,
        amount
    );
}

function finishLoss(player, amount) {
    gameEngine.recordGame(
        player,
        "blackjack",
        false
    );

    rewardGameXP(
        player,
        100
    );

    gameEngine.trackMoneyLost(
        player,
        amount
    );
}

function finishDraw(player) {
    gameEngine.recordGame(
        player,
        "blackjack",
        false
    );

    rewardGameXP(
        player,
        50
    );
}

// ============================================================
// SEND HELP
// ============================================================

async function sendHelp(
    sock,
    from,
    message
) {
    return sock.sendMessage(
        from,
        {
            text:
`╭━━〔 🃏 VENOM BLACKJACK 〕━━⬣
┃
┃ 🎰 PLAYER VS DEALER
┃
┃ Start:
┃ .blackjack <amount>
┃
┃ Example:
┃ .blackjack 10000
┃
┃ 🎯 During game:
┃ .blackjack hit
┃ .blackjack stand
┃
┃ 💰 Minimum : ${MIN_BET.toLocaleString()} VENOM
┃ 💰 Maximum : ${MAX_BET.toLocaleString()} VENOM
┃
┃ 🏆 Blackjack pays 2.5x
┃
┃ 🍀 Market attributes
┃ affect gameplay.
╰━━━━━━━━━━━━━━━━⬣`
        },
        { quoted: message }
    );
}

// ============================================================
// SHOW GAME
// ============================================================

async function showGame(
    sock,
    from,
    message,
    game
) {
    const playerTotal =
        handValue(game.playerHand);

    const dealerVisible =
        game.dealerHand[0];

    return sock.sendMessage(
        from,
        {
            text:
`╭━━〔 🃏 VENOM BLACKJACK 〕━━⬣
┃
┃ 👤 @${cleanId(game.player)}
┃
┃ 🃏 YOUR CARDS
┃    ${formatHand(game.playerHand)}
┃
┃ 🎯 Total : ${playerTotal}
┃
┃ 🤵 DEALER
┃    ${cardText(dealerVisible)} │ ❓
┃
┃ 💰 Bet : ${game.bet.toLocaleString()} VENOM
┃
┃ Choose:
┃ 🃏 .blackjack hit
┃ 🛑 .blackjack stand
┃
┃ ⏳ Game expires in 2 minutes.
╰━━━━━━━━━━━━━━━━⬣`,
            mentions: [game.player]
        },
        { quoted: message }
    );
}

// ============================================================
// DEALER PLAY
// ============================================================

function dealerPlay(game) {
    while (
        handValue(game.dealerHand) < 17
    ) {
        game.dealerHand.push(
            drawCard(game)
        );
    }
}

// ============================================================
// COMPLETE GAME
// ============================================================

async function resolveGame(
    sock,
    from,
    message,
    key,
    game,
    reason = "stand"
) {
    clearTimeout(game.timer);

    games.delete(key);

    const playerTotal =
        handValue(game.playerHand);

    // --------------------------------------------------------
    // PLAYER BUST
    // --------------------------------------------------------

    if (playerTotal > 21) {
        finishLoss(
            game.player,
            game.bet
        );

        const updated =
            economy.get(game.player);

        return sock.sendMessage(
            from,
            {
                text:
`╭━━〔 💀 VENOM BLACKJACK 〕━━⬣
┃
┃ 💥 BUST!
┃
┃ 👤 @${cleanId(game.player)}
┃
┃ 🃏 Your Cards
┃    ${formatHand(game.playerHand)}
┃
┃ 🎯 Total : ${playerTotal}
┃
┃ 🤵 Dealer
┃    ${formatHand(game.dealerHand)}
┃
┃
┃ 💸 Lost : ${game.bet.toLocaleString()} VENOM
┃ ✨ XP : +100
┃
┃ 💎 Wallet
┃    ${Number(updated.balance).toLocaleString()} VENOM
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [game.player]
            },
            { quoted: message }
        );
    }

    // --------------------------------------------------------
    // DEALER PLAY
    // --------------------------------------------------------

    dealerPlay(game);

    const dealerTotal =
        handValue(game.dealerHand);

    // --------------------------------------------------------
    // BLACKJACK
    // --------------------------------------------------------

    if (
        isBlackjack(game.playerHand) &&
        !isBlackjack(game.dealerHand)
    ) {
        const prize =
            Math.floor(
                game.bet * 2.5
            );

        economy.add(
            game.player,
            prize
        );

        finishWin(
            game.player,
            prize
        );

        const updated =
            economy.get(game.player);

        return sock.sendMessage(
            from,
            {
                text:
`╭━━〔 🏆 BLACKJACK! 〕━━⬣
┃
┃ 👑 @${cleanId(game.player)}
┃
┃ 🃏 Your Cards
┃    ${formatHand(game.playerHand)}
┃
┃ 🎯 Total : 21
┃
┃ 🤵 Dealer
┃    ${formatHand(game.dealerHand)}
┃
┃ 🎯 Dealer Total : ${dealerTotal}
┃
┃ 💰 Bet : ${game.bet.toLocaleString()}
┃ 🏆 Prize : ${prize.toLocaleString()} VENOM
┃
┃ ✨ XP : +250+
┃
┃ 💎 Wallet
┃    ${Number(updated.balance).toLocaleString()} VENOM
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [game.player]
            },
            { quoted: message }
        );
    }

    // --------------------------------------------------------
    // DEALER BLACKJACK
    // --------------------------------------------------------

    if (
        isBlackjack(game.dealerHand) &&
        !isBlackjack(game.playerHand)
    ) {
        finishLoss(
            game.player,
            game.bet
        );

        const updated =
            economy.get(game.player);

        return sock.sendMessage(
            from,
            {
                text:
`╭━━〔 🃏 VENOM BLACKJACK 〕━━⬣
┃
┃ 🤵 DEALER BLACKJACK!
┃
┃ 👤 @${cleanId(game.player)}
┃
┃ 🃏 Your Cards
┃    ${formatHand(game.playerHand)}
┃
┃ 🎯 Your Total : ${playerTotal}
┃
┃ 🤵 Dealer
┃    ${formatHand(game.dealerHand)}
┃
┃ 🎯 Dealer Total : 21
┃
┃ 💸 Lost : ${game.bet.toLocaleString()} VENOM
┃ ✨ XP : +100
┃
┃ 💎 Wallet
┃    ${Number(updated.balance).toLocaleString()} VENOM
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [game.player]
            },
            { quoted: message }
        );
    }

    // --------------------------------------------------------
    // DRAW
    // --------------------------------------------------------

    if (
        playerTotal === dealerTotal
    ) {
        economy.add(
            game.player,
            game.bet
        );

        finishDraw(
            game.player
        );

        const updated =
            economy.get(game.player);

        return sock.sendMessage(
            from,
            {
                text:
`╭━━〔 🤝 BLACKJACK DRAW 〕━━⬣
┃
┃ 👤 @${cleanId(game.player)}
┃
┃ 🃏 Your Cards
┃    ${formatHand(game.playerHand)}
┃
┃ 🎯 Your Total : ${playerTotal}
┃
┃ 🤵 Dealer
┃    ${formatHand(game.dealerHand)}
┃
┃ 🎯 Dealer Total : ${dealerTotal}
┃
┃ 💰 Bet Refunded
┃    ${game.bet.toLocaleString()} VENOM
┃
┃ ✨ XP : +50
┃
┃ 💎 Wallet
┃    ${Number(updated.balance).toLocaleString()} VENOM
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [game.player]
            },
            { quoted: message }
        );
    }

    // --------------------------------------------------------
    // PLAYER WINS
    // --------------------------------------------------------

    if (
        playerTotal <= 21 &&
        (
            dealerTotal > 21 ||
            playerTotal > dealerTotal
        )
    ) {
        const prize =
            game.bet * 2;

        economy.add(
            game.player,
            prize
        );

        finishWin(
            game.player,
            prize
        );

        const updated =
            economy.get(game.player);

        return sock.sendMessage(
            from,
            {
                text:
`╭━━〔 🏆 VENOM BLACKJACK 〕━━⬣
┃
┃ 👑 YOU WIN!
┃
┃ 👤 @${cleanId(game.player)}
┃
┃ 🃏 Your Cards
┃    ${formatHand(game.playerHand)}
┃
┃ 🎯 Your Total : ${playerTotal}
┃
┃ 🤵 Dealer
┃    ${formatHand(game.dealerHand)}
┃
┃ 🎯 Dealer Total : ${dealerTotal}
┃
┃ 💰 Bet : ${game.bet.toLocaleString()} VENOM
┃ 🏆 Prize : ${prize.toLocaleString()} VENOM
┃ ✨ XP : +250+
┃
┃ 💎 Wallet
┃    ${Number(updated.balance).toLocaleString()} VENOM
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [game.player]
            },
            { quoted: message }
        );
    }

    // --------------------------------------------------------
    // PLAYER LOSES
    // --------------------------------------------------------

    finishLoss(
        game.player,
        game.bet
    );

    const updated =
        economy.get(game.player);

    return sock.sendMessage(
        from,
        {
            text:
`╭━━〔 💀 VENOM BLACKJACK 〕━━⬣
┃
┃ 🤵 DEALER WINS!
┃
┃ 👤 @${cleanId(game.player)}
┃
┃ 🃏 Your Cards
┃    ${formatHand(game.playerHand)}
┃
┃ 🎯 Your Total : ${playerTotal}
┃
┃ 🤵 Dealer
┃    ${formatHand(game.dealerHand)}
┃
┃ 🎯 Dealer Total : ${dealerTotal}
┃
┃ 💸 Lost : ${game.bet.toLocaleString()} VENOM
┃ ✨ XP : +100
┃
┃ 💎 Wallet
┃    ${Number(updated.balance).toLocaleString()} VENOM
╰━━━━━━━━━━━━━━━━⬣`,
            mentions: [game.player]
        },
        { quoted: message }
    );
}

// ============================================================
// MODULE
// ============================================================

module.exports = {
    name: "blackjack",

    aliases: [
        "bj"
    ],

    run: async ({
        sock,
        from,
        message,
        sender,
        args
    }) => {

        const player =
            normalizeId(sender);

        const action =
            String(
                args?.[0] || ""
            ).toLowerCase();

        // ====================================================
        // ACTIVE GAME
        // ====================================================

        const found =
            findGame(player);

        // ====================================================
        // HIT
        // ====================================================

        if (
            found &&
            (
                action === "hit" ||
                action === "h"
            )
        ) {
            const game =
                found.game;

            const card =
                drawPlayerCard(game);

            game.playerHand.push(card);

            const total =
                handValue(game.playerHand);

            if (total > 21) {
                return resolveGame(
                    sock,
                    from,
                    message,
                    found.key,
                    game,
                    "bust"
                );
            }

            if (total === 21) {
                return resolveGame(
                    sock,
                    from,
                    message,
                    found.key,
                    game,
                    "21"
                );
            }

            return showGame(
                sock,
                from,
                message,
                game
            );
        }

        // ====================================================
        // STAND
        // ====================================================

        if (
            found &&
            (
                action === "stand" ||
                action === "s"
            )
        ) {
            return resolveGame(
                sock,
                from,
                message,
                found.key,
                found.game,
                "stand"
            );
        }

        // ====================================================
        // ACTIVE GAME + INVALID ACTION
        // ====================================================

        if (found) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🃏 BLACKJACK 〕━━⬣
┃
┃ Your game is active.
┃
┃ 🃏 .blackjack hit
┃ 🛑 .blackjack stand
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );
        }

        // ====================================================
        // HELP
        // ====================================================

        if (
            !action ||
            ["help", "menu"].includes(action)
        ) {
            return sendHelp(
                sock,
                from,
                message
            );
        }

        // ====================================================
        // START GAME
        // ====================================================

        const bet =
            Number(action);

        if (
            !Number.isInteger(bet) ||
            bet < MIN_BET ||
            bet > MAX_BET
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
`❌ Invalid Blackjack bet.

💰 Minimum : ${MIN_BET.toLocaleString()} VENOM
💰 Maximum : ${MAX_BET.toLocaleString()} VENOM

Example:
.blackjack 10000`
                },
                { quoted: message }
            );
        }

        const user =
            economy.get(player);

        const balance =
            Number(user.balance) || 0;

        if (balance < bet) {
            return sock.sendMessage(
                from,
                {
                    text:
`❌ Insufficient VENOM.

💰 Wallet : ${balance.toLocaleString()}
🃏 Required : ${bet.toLocaleString()}`
                },
                { quoted: message }
            );
        }

        // ====================================================
        // TAKE BET
        // ====================================================

        economy.add(
            player,
            -bet
        );

        // ====================================================
        // CREATE GAME
        // ====================================================

        const deck =
            shuffle(
                createDeck()
            );

        const game = {
            player,
            bet,
            deck,

            playerHand: [],
            dealerHand: [],

            timer: null
        };

        // Initial deal
        game.playerHand.push(
            drawPlayerCard(game)
        );

        game.dealerHand.push(
            drawCard(game)
        );

        game.playerHand.push(
            drawPlayerCard(game)
        );

        game.dealerHand.push(
            drawCard(game)
        );

        // ====================================================
        // SAVE GAME
        // ====================================================

        const key =
            `${player}:${Date.now()}`;

        games.set(
            key,
            game
        );

        // ====================================================
        // TIMEOUT
        // ====================================================

        game.timer =
            setTimeout(
                async () => {

                    if (!games.has(key)) {
                        return;
                    }

                    games.delete(key);

                    // Refund unfinished game
                    economy.add(
                        player,
                        bet
                    );

                    try {
                        await sock.sendMessage(
                            from,
                            {
                                text:
`╭━━〔 ⏰ BLACKJACK EXPIRED 〕━━⬣
┃
┃ 👤 @${cleanId(player)}
┃
┃ ❌ You took too long.
┃
┃ 💰 Bet refunded:
┃    ${bet.toLocaleString()} VENOM
┃
┃ Start another game with:
┃ .blackjack ${bet}
╰━━━━━━━━━━━━━━━━⬣`,
                                mentions: [player]
                            }
                        );
                    } catch (error) {
                        console.error(
                            "BLACKJACK TIMEOUT ERROR:",
                            error
                        );
                    }

                },
                GAME_TIMEOUT
            );

        // ====================================================
        // IMMEDIATE BLACKJACK
        // ====================================================

        if (
            isBlackjack(
                game.playerHand
            )
        ) {
            return resolveGame(
                sock,
                from,
                message,
                key,
                game,
                "blackjack"
            );
        }

        // ====================================================
        // START MESSAGE
        // ====================================================

        return showGame(
            sock,
            from,
            message,
            game
        );
    }
};
