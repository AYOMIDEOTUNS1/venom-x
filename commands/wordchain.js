const games = new Map(); // chatId -> game state

const START_WORDS = [
    "exaggerated", "beautiful", "challenge", "adventure", "pineapple",
    "keyboard", "umbrella", "mountain", "elephant", "strawberry"
];

function norm(s) {
    return String(s || "")
        .toLowerCase()
        .replace(/[^a-z]/g, "");
}

function mention(jid) {
    return "@" + String(jid || "").split("@")[0];
}

function minLenFor(word) {
    const n = norm(word).length;
    if (n >= 8) return 3;
    if (n >= 5) return 2;
    return 2;
}

function getGame(from) {
    return games.get(from) || null;
}

function stopTimer(game) {
    if (game && game.timer) {
        clearTimeout(game.timer);
        game.timer = null;
    }
}

function scheduleTurn(sock, from, game, reply) {
    stopTimer(game);
    const seconds = game.turnSeconds || 60;
    game.deadline = Date.now() + seconds * 1000;

    game.timer = setTimeout(async function () {
        const g = getGame(from);
        if (!g || g.id !== game.id) return;

        const victim = g.players[g.turn];
        g.players.splice(g.turn, 1);

        if (g.players.length <= 1) {
            stopTimer(g);
            games.delete(from);
            const winner = g.players[0];
            await sock.sendMessage(from, {
                text:
                    "🏆 *Word Chain ended*\n\n" +
                    (winner
                        ? "Winner: " + mention(winner)
                        : "No winner.") +
                    "\n\n⚡ VENOM X",
                mentions: winner ? [winner] : []
            }).catch(function () {});
            return;
        }

        if (g.turn >= g.players.length) g.turn = 0;

        const next = g.players[g.turn];
        await sock.sendMessage(from, {
            text:
                "⏳ " + mention(victim) + " ran out of time and is eliminated.\n\n" +
                "🔤 Word Chain — your turn " + mention(next) + "\n" +
                "Next word must start with *" + g.nextLetter.toUpperCase() +
                "* (minimum letters: " + g.minLen + ")\n" +
                "⏱️ " + g.turnSeconds + "s",
            mentions: [victim, next]
        }).catch(function () {});

        scheduleTurn(sock, from, g, reply);
    }, seconds * 1000);
}

module.exports = {
    name: "wordchain",
    aliases: ["wc", "wcg", "wordgame", "chain"],

    run: async function ({ sock, from, sender, args, reply, message, isGroup }) {
        if (!isGroup) {
            return reply("❌ Word Chain is for groups only.");
        }

        const sub = String(args[0] || "").toLowerCase();
        const game = getGame(from);

        // JOIN
        if (sub === "join") {
            if (!game || game.status !== "lobby") {
                return reply("No lobby. Start with:\n#wordchain start");
            }
            if (game.players.indexOf(sender) !== -1) {
                return reply("You're already in the lobby.");
            }
            game.players.push(sender);
            return reply(
                "✅ Joined Word Chain\nPlayers: " + game.players.length +
                "\nHost: type *#wordchain begin* to start"
            );
        }

        // LEAVE
        if (sub === "leave") {
            if (!game) return reply("No active game.");
            const i = game.players.indexOf(sender);
            if (i === -1) return reply("You're not in this game.");
            game.players.splice(i, 1);
            if (game.players.length === 0) {
                stopTimer(game);
                games.delete(from);
                return reply("Game cancelled (no players).");
            }
            if (game.status === "playing" && game.turn >= game.players.length) {
                game.turn = 0;
            }
            return reply("You left Word Chain.");
        }

        // STOP
        if (sub === "stop" || sub === "end") {
            if (!game) return reply("No active game.");
            if (game.host !== sender) {
                return reply("❌ Only the host can stop the game.");
            }
            stopTimer(game);
            games.delete(from);
            return reply("🛑 Word Chain stopped.");
        }

        // START LOBBY
        if (sub === "start" || sub === "create") {
            if (game && game.status === "playing") {
                return reply("A game is already running. #wordchain stop");
            }
            const turnSeconds = Math.min(120, Math.max(30, parseInt(args[1], 10) || 60));
            games.set(from, {
                id: Date.now(),
                status: "lobby",
                host: sender,
                players: [sender],
                turn: 0,
                used: new Set(),
                nextLetter: "",
                minLen: 2,
                turnSeconds: turnSeconds,
                timer: null
            });
            return reply(
`🎮 *Word Chain lobby*

Host joined.
Others: *#wordchain join*
Host starts: *#wordchain begin*

⏱️ Turn time: ${turnSeconds}s

⚡ VENOM X`
            );
        }

        // BEGIN
        if (sub === "begin" || sub === "go") {
            if (!game || game.status !== "lobby") {
                return reply("Start a lobby first:\n#wordchain start");
            }
            if (game.host !== sender) {
                return reply("❌ Only the host can begin.");
            }
            if (game.players.length < 2) {
                return reply("Need at least 2 players. Others: #wordchain join");
            }

            const startWord = START_WORDS[Math.floor(Math.random() * START_WORDS.length)];
            const nextLetter = startWord.slice(-1).toUpperCase();
            game.status = "playing";
            game.used.add(norm(startWord));
            game.nextLetter = nextLetter.toLowerCase();
            game.minLen = minLenFor(startWord);
            game.turn = 0;

            const order = game.players
                .map(function (p, i) {
                    return (i + 1) + ". " + mention(p);
                })
                .join("\n");

            await sock.sendMessage(from, {
                text:
                    "🎮 *Game Start!*\n" +
                    "Starting word: *" + startWord + "*\n" +
                    "Next letter: *" + nextLetter + "*\n\n" +
                    "Turn Order:\n" + order,
                mentions: game.players.slice()
            });

            const first = game.players[0];
            await sock.sendMessage(from, {
                text:
                    "🔤 *Word Chain — your turn* " + mention(first) + "\n" +
                    "Next word must start with *" + nextLetter +
                    "* (minimum letters: " + game.minLen + ")\n" +
                    "⏱️ " + game.turnSeconds + "s\n\n" +
                    "_Type your word as a normal message (no prefix)_",
                mentions: [first]
            });

            scheduleTurn(sock, from, game, reply);
            return;
        }

        // STATUS
        if (sub === "status") {
            if (!game) return reply("No Word Chain game here.");
            if (game.status === "lobby") {
                return reply(
                    "Lobby — players: " + game.players.length +
                    "\n#wordchain begin to start"
                );
            }
            const cur = game.players[game.turn];
            return reply(
                "Playing\nTurn: " + mention(cur) +
                "\nLetter: " + game.nextLetter.toUpperCase() +
                "\nMin length: " + game.minLen +
                "\nPlayers left: " + game.players.length
            );
        }

        // HELP
        return reply(
`╭━━〔 🔤 VENOM X WORD CHAIN 〕━━⬣

#wordchain start
#wordchain join
#wordchain begin
#wordchain stop
#wordchain status

During game: type a word (no #)
Must start with the given letter,
not used before, min length applies.

⏱️ Timeout = eliminated

╰━━━━━━━━━━━━━━━━⬣`
        );
    }
};

// Listen for plain words during active games
module.exports.handleWordChainMessage = async function (sock, msg, from, sender, body, isGroup) {
    if (!isGroup) return false;
    const game = getGame(from);
    if (!game || game.status !== "playing") return false;

    const text = String(body || "").trim();
    if (!text || text.startsWith("#") || text.startsWith(".")) return false;

    const word = norm(text);
    if (!word) return false;

    const current = game.players[game.turn];
    if (sender !== current) return false;

    const need = game.nextLetter.toLowerCase();
    if (word[0] !== need) {
        await sock.sendMessage(from, {
            text: "❌ Must start with *" + need.toUpperCase() + "*",
            quoted: msg
        }).catch(function () {});
        return true;
    }

    if (word.length < game.minLen) {
        await sock.sendMessage(from, {
            text: "❌ Minimum " + game.minLen + " letters.",
            quoted: msg
        }).catch(function () {});
        return true;
    }

    if (game.used.has(word)) {
        await sock.sendMessage(from, {
            text: "❌ Word already used.",
            quoted: msg
        }).catch(function () {});
        return true;
    }

    game.used.add(word);
    game.nextLetter = word[word.length - 1];
    game.minLen = minLenFor(word);

    stopTimer(game);

    await sock.sendMessage(from, {
        text: "✅ *" + word + "* accepted.",
        quoted: msg
    }).catch(function () {});

    game.turn = (game.turn + 1) % game.players.length;
    const next = game.players[game.turn];

    await sock.sendMessage(from, {
        text:
            "🔤 *Word Chain — your turn* " + mention(next) + "\n" +
            "Next word must start with *" + game.nextLetter.toUpperCase() +
            "* (minimum letters: " + game.minLen + ")\n" +
            "⏱️ " + game.turnSeconds + "s",
        mentions: [next]
    }).catch(function () {});

    scheduleTurn(sock, from, game);
    return true;
};
