const duel = require("./duelgame");
const economy = require("../lib/economy");

const MAX_HP = 100;
const HEAL_AMOUNT = 20;
const HEAL_COOLDOWN = 2;
const SPECIAL_COOLDOWN = 3;

function findBattle(sender, from) {
    for (const [key, game] of duel.games.entries()) {
        if (
            game.chat === from &&
            game.game === "battle" &&
            (game.player1 === sender || game.player2 === sender)
        ) {
            return { key, game };
        }
    }

    return null;
}

function playerName(jid) {
    return `@${jid.split("@")[0]}`;
}

function status(game, turn) {
    return `╭━━〔 ⚔️ VENOM BATTLE 〕━━⬣
┃
┃ 🥊 ${playerName(game.player1)}
┃ ❤️ HP : ${game.hp[game.player1]}/${MAX_HP}
┃
┃ 🥊 ${playerName(game.player2)}
┃ ❤️ HP : ${game.hp[game.player2]}/${MAX_HP}
┃
┃ 🎯 Turn : ${playerName(turn)}
┃
┃ ⚔️ .battle attack
┃ 🛡️ .battle defend
┃ ❤️ .battle heal
┃ 💥 .battle special
╰━━━━━━━━━━━━━━━━⬣`;
}

module.exports = {
    name: "battle",

    run: async ({ sock, from, message, sender, args }) => {
        const action = args[0]?.toLowerCase();

        const found = findBattle(sender, from);

        if (!found) {
            return sock.sendMessage(
                from,
                {
                    text:
`❌ You don't have an active Battle Duel.

Start:
.duel @user <amount>

Then:
.accept
.duelgame 4`
                },
                { quoted: message }
            );
        }

        const { key, game } = found;

        // Initialize battle data.
        if (!game.hp) {
            game.hp = {
                [game.player1]: MAX_HP,
                [game.player2]: MAX_HP
            };

            game.turn = game.player1;
            game.defending = {};
            game.healCooldown = {};
            game.specialCooldown = {};
            game.turnCount = 0;
        }

        if (sender !== game.turn) {
            return sock.sendMessage(
                from,
                {
                    text:
`⏳ It's not your turn!

🎯 Waiting for:
${playerName(game.turn)}`
                },
                { quoted: message }
            );
        }

        if (
            ![
                "attack",
                "defend",
                "heal",
                "special"
            ].includes(action)
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 ⚔️ BATTLE INFO 〕━━⬣
┃
┃ ⚔️ attack
┃ Random damage
┃
┃ 🛡️ defend
┃ Reduces the next attack
┃
┃ ❤️ heal
┃ Restores ${HEAL_AMOUNT} HP
┃ Cooldown: ${HEAL_COOLDOWN} turns
┃
┃ 💥 special
┃ Powerful attack
┃ Cooldown: ${SPECIAL_COOLDOWN} turns
┃
┃ 🏆 Reduce your opponent's HP
┃ to 0 to win.
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );
        }

        const opponent =
            sender === game.player1
                ? game.player2
                : game.player1;

        // ===================== ATTACK =====================
        if (action === "attack") {
            let damage =
                Math.floor(Math.random() * 16) + 10;

            const critical =
                Math.random() < 0.15;

            if (critical) {
                damage *= 2;
            }

            // Defending reduces damage.
            if (game.defending[opponent]) {
                damage = Math.floor(damage * 0.5);
                game.defending[opponent] = false;
            }

            game.hp[opponent] = Math.max(
                0,
                game.hp[opponent] - damage
            );

            game.turnCount++;

            if (game.hp[opponent] <= 0) {
                return finishBattle(
                    sock,
                    from,
                    message,
                    game,
                    key,
                    sender,
                    opponent,
                    damage,
                    critical
                );
            }

            game.turn = opponent;

            return sock.sendMessage(
                from,
                {
                    text:
`${critical ? "💥 CRITICAL HIT!\n\n" : ""}⚔️ ${playerName(sender)} attacked!

💥 Damage : ${damage}

❤️ ${playerName(opponent)}
HP : ${game.hp[opponent]}/${MAX_HP}

🎯 ${playerName(opponent)}'s turn

⚔️ .battle attack
🛡️ .battle defend
❤️ .battle heal
💥 .battle special`,
                    mentions: [sender, opponent]
                },
                { quoted: message }
            );
        }

        // ===================== DEFEND =====================
        if (action === "defend") {
            game.defending[sender] = true;
            game.turnCount++;
            game.turn = opponent;

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🛡️ DEFEND 〕━━⬣
┃
┃ 🛡️ ${playerName(sender)}
┃ is defending!
┃
┃ 💥 The next attack will
┃ deal reduced damage.
┃
┃ 🎯 ${playerName(opponent)}'s turn.
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender, opponent]
                },
                { quoted: message }
            );
        }

        // ===================== HEAL =====================
        if (action === "heal") {
            const lastHeal =
                game.healCooldown[sender] || -999;

            if (
                game.turnCount - lastHeal <
                HEAL_COOLDOWN
            ) {
                const remaining =
                    HEAL_COOLDOWN -
                    (game.turnCount - lastHeal);

                return sock.sendMessage(
                    from,
                    {
                        text:
`❌ Heal is on cooldown.

⏳ Wait ${remaining} more turn(s).`
                    },
                    { quoted: message }
                );
            }

            if (game.hp[sender] >= MAX_HP) {
                return sock.sendMessage(
                    from,
                    {
                        text: "❤️ Your HP is already full!"
                    },
                    { quoted: message }
                );
            }

            game.hp[sender] = Math.min(
                MAX_HP,
                game.hp[sender] + HEAL_AMOUNT
            );

            game.healCooldown[sender] =
                game.turnCount;

            game.turnCount++;
            game.turn = opponent;

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 ❤️ HEAL 〕━━⬣
┃
┃ ❤️ ${playerName(sender)}
┃ recovered ${HEAL_AMOUNT} HP!
┃
┃ ❤️ HP :
┃ ${game.hp[sender]}/${MAX_HP}
┃
┃ 🎯 ${playerName(opponent)}'s turn.
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender, opponent]
                },
                { quoted: message }
            );
        }

        // ===================== SPECIAL =====================
        if (action === "special") {
            const lastSpecial =
                game.specialCooldown[sender] || -999;

            if (
                game.turnCount - lastSpecial <
                SPECIAL_COOLDOWN
            ) {
                const remaining =
                    SPECIAL_COOLDOWN -
                    (game.turnCount - lastSpecial);

                return sock.sendMessage(
                    from,
                    {
                        text:
`❌ Special attack is on cooldown.

⏳ Wait ${remaining} more turn(s).`
                    },
                    { quoted: message }
                );
            }

            let damage =
                Math.floor(Math.random() * 21) + 25;

            if (game.defending[opponent]) {
                damage = Math.floor(damage * 0.5);
                game.defending[opponent] = false;
            }

            game.hp[opponent] = Math.max(
                0,
                game.hp[opponent] - damage
            );

            game.specialCooldown[sender] =
                game.turnCount;

            game.turnCount++;

            if (game.hp[opponent] <= 0) {
                return finishBattle(
                    sock,
                    from,
                    message,
                    game,
                    key,
                    sender,
                    opponent,
                    damage,
                    false
                );
            }

            game.turn = opponent;

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 💥 SPECIAL ATTACK 〕━━⬣
┃
┃ 🔥 ${playerName(sender)}
┃ unleashed a special attack!
┃
┃ 💥 Damage : ${damage}
┃
┃ ❤️ ${playerName(opponent)}
┃ HP : ${game.hp[opponent]}/${MAX_HP}
┃
┃ 🎯 ${playerName(opponent)}'s turn.
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender, opponent]
                },
                { quoted: message }
            );
        }
    }
};

async function finishBattle(
    sock,
    from,
    message,
    game,
    key,
    winner,
    loser,
    damage,
    critical
) {
    const pot = game.amount * 2;

    economy.add(winner, pot);

    const updated = economy.get(winner);

    duel.games.delete(key);

    await sock.sendMessage(
        from,
        {
            text:
`╭━━〔 🏆 BATTLE OVER 〕━━⬣
┃
┃ 👑 WINNER
┃ ${playerName(winner)}
┃
┃ 💀 DEFEATED
┃ ${playerName(loser)}
┃
┃ ${critical ? "💥 CRITICAL HIT!\n┃" : ""}
┃ ⚔️ Final Damage : ${damage}
┃
┃ ❤️ Winner HP :
┃ ${game.hp[winner]}/${MAX_HP}
┃
┃ 💰 Prize :
┃ ${pot.toLocaleString()} VENOM
┃
┃ 🪙 New Balance :
┃ ${updated.balance.toLocaleString()} VENOM
╰━━━━━━━━━━━━━━━━⬣`,
            mentions: [winner, loser]
        },
        { quoted: message }
    );
}
