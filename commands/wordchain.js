const games = new Map();

const START_WORDS = [
    "exaggerated", "beautiful", "challenge", "adventure", "pineapple",
    "keyboard", "umbrella", "mountain", "elephant", "strawberry",
    "knowledge", "wonderful", "excellent", "champion", "treasure",
    "mysterious", "beautiful", "dangerous", "important", "education"
];

// Simple list of common short words to block
const BANNED = new Set([
    "a","i","to","in","on","at","is","it","of","an","as","be","by","do","go","he","me","my","no","or","so","up","us","we",
    "the","and","for","you","are","but","not","can","had","her","was","one","our","out","has","his","how","its","may","new","now","old","see","way","who","boy","did","get","has","him","let","put","say","she","too","use"
]);

function norm(s) {
    return String(s || "").toLowerCase().replace(/[^a-z]/g, "");
}

function mention(jid) {
    return "@" + String(jid || "").split("@")[0];
}

function minLenFor(turnCount) {
    if (turnCount >= 15) return 6;
    if (turnCount >= 10) return 5;
    if (turnCount >= 5) return 4;
    return 4; // start hard
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

function scheduleTurn(sock, from, game) {
    stopTimer(game);
    const seconds = game.turnSeconds || 45;

    game.timer = setTimeout(async () => {
        const g = getGame(from);
        if (!g || g.id !== game.id) return;

        const victim = g.players[g.turn];
        g.players.splice(g.turn, 1);

        if (g.players.length <= 1) {
            stopTimer(g);
            games.delete(from);
            const winner = g.players[0];
            await sock.sendMessage(from, {
                text: `🏆 *Word Chain Ended*\n\n${winner ? "Winner: " + mention(winner) : "No winner."}\n\n⚡ VENOM X`,
                mentions: winner ? [winner] : []
            }).catch(() => {});
            return;
        }

        if (g.turn >= g.players.length) g.turn = 0;
        const next = g.players[g.turn];

        await sock.sendMessage(from, {
            text: `⏳ ${mention(victim)} ran out of time and is *eliminated*.\n\n🔤 Your turn \( {mention(next)}\nMust start with * \){g.nextLetter.toUpperCase()}*\nMinimum *${g.minLen}* letters\n⏱️ ${g.turnSeconds}s`,
            mentions: [victim, next]
        }).catch(() => {});

        scheduleTurn(sock, from, g);
    }, seconds * 1000);
}

module.exports = {
    name: "wordchain",
    aliases: ["wc", "wcg", "wordgame", "chain"],

    run: async function ({ sock, from, sender, args, reply, isGroup }) {
        if (!isGroup) return reply("❌ Word Chain is for groups only.");

        const sub = String(args[0] || "").toLowerCase();
        const game = getGame(from);

        if (sub === "join") {
            if (!game || game.status !== "lobby") return reply("No lobby. Use:\n#wordchain start");
            if (game.players.includes(sender)) return reply("You're already in.");
            game.players.push(sender);
            return reply(`✅ Joined!\nPlayers: ${game.players.length}\nHost: type *#wordchain begin*`);
        }

        if (sub === "leave") {
            if (!game) return reply("No active game.");
            const i = game.players.indexOf(sender);
            if (i === -1) return reply("You're not in this game.");
            game.players.splice(i, 1);
            if (game.players.length === 0) {
                stopTimer(game);
                games.delete(from);
                return reply("Game cancelled.");
            }
            return reply("You left the game.");
        }

        if (sub === "stop" || sub === "end") {
            if (!game) return reply("No active game.");
            if (game.host !== sender) return reply("❌ Only the host can stop the game.");
            stopTimer(game);
            games.delete(from);
            return reply("🛑 Word Chain stopped.");
        }

        if (sub === "start" || sub === "create") {
            if (game && game.status === "playing") return reply("A game is already running.");
            const turnSeconds = Math.min(90, Math.max(25, parseInt(args[1], 10) || 40));
            games.set(from, {
                id: Date.now(),
                status: "lobby",
                host: sender,
                players: [sender],
                turn: 0,
                turnCount: 0,
                used: new Set(),
                nextLetter: "",
                minLen: 4,
                turnSeconds,
                timer: null
            });
            return reply(`🎮 *Word Chain Lobby* (Hard Mode)

Host joined.
Others: *#wordchain join*
Host starts: *#wordchain begin*

⏱️ Turn time: ${turnSeconds}s
🔥 Minimum 4 letters (increases later)

⚡ VENOM X`);
        }

        if (sub === "begin" || sub === "go") {
            if (!game || game.status !== "lobby") return reply("Start a lobby first:\n#wordchain start");
            if (game.host !== sender) return reply("❌ Only the host can begin.");
            if (game.players.length < 2) return reply("Need at least 2 players.");

            const startWord = START_WORDS[Math.floor(Math.random() * START_WORDS.length)];
            game.status = "playing";
            game.used.add(norm(startWord));
            game.nextLetter = startWord.slice(-1).toLowerCase();
            game.minLen = 4;
            game.turn = 0;
            game.turnCount = 0;

            const order = game.players.map((p, i) => `${i + 1}. ${mention(p)}`).join("\n");

            await sock.sendMessage(from, {
                text: `🎮 *Hard Word Chain Started!*\n\nStarting word: *\( {startWord}*\nNext letter: * \){game.nextLetter.toUpperCase()}*\n\nTurn Order:\n${order}`,
                mentions: game.players
            });

            const first = game.players[0];
            await sock.sendMessage(from, {
                text: `🔤 Your turn \( {mention(first)}\nMust start with * \){game.nextLetter.toUpperCase()}*\nMinimum *${game.minLen}* letters\n⏱️ ${game.turnSeconds}s\n\n_Type the word without prefix_`,
                mentions: [first]
            });

            scheduleTurn(sock, from, game);
            return;
        }

        if (sub === "status") {
            if (!game) return reply("No active Word Chain.");
            if (game.status === "lobby") return reply(`Lobby — ${game.players.length} players\n#wordchain begin`);
            const cur = game.players[game.turn];
            return reply(`Playing\nTurn: ${mention(cur)}\nLetter: ${game.nextLetter.toUpperCase()}\nMin length: ${game.minLen}\nPlayers left: ${game.players.length}`);
        }

        return reply(`╭━━〔 🔤 HARD WORD CHAIN 〕━━⬣

*#wordchain start*
*#wordchain join*
*#wordchain begin*
*#wordchain stop*
*#wordchain status*

Rules:
• Minimum 4 letters (increases)
• No repeated words
• No very short/easy words
• Timeout = Eliminated

╰━━━━━━━━━━━━━━━━⬣`);
    }
};

// Handle plain words
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

    // Must start with correct letter
    if (word[0] !== game.nextLetter) {
        await sock.sendMessage(from, { text: `❌ Must start with *${game.nextLetter.toUpperCase()}*`, quoted: msg }).catch(() => {});
        return true;
    }

    // Minimum length
    if (word.length < game.minLen) {
        await sock.sendMessage(from, { text: `❌ Minimum *${game.minLen}* letters required.`, quoted: msg }).catch(() => {});
        return true;
    }

    // Banned short words
    if (BANNED.has(word)) {
        await sock.sendMessage(from, { text: `❌ Too basic. Use a better word.`, quoted: msg }).catch(() => {});
        return true;
    }

    // Already used
    if (game.used.has(word)) {
        await sock.sendMessage(from, { text: `❌ Word already used.`, quoted: msg }).catch(() => {});
        return true;
    }

    // Accept word
    game.used.add(word);
    game.nextLetter = word[word.length - 1];
    game.turnCount++;
    game.minLen = minLenFor(game.turnCount);

    stopTimer(game);

    await sock.sendMessage(from, { text: `✅ *${word}* accepted!`, quoted: msg }).catch(() => {});

    game.turn = (game.turn + 1) % game.players.length;
    const next = game.players[game.turn];

    await sock.sendMessage(from, {
        text: `🔤 Your turn \( {mention(next)}\nMust start with * \){game.nextLetter.toUpperCase()}*\nMinimum *${game.minLen}* letters\n⏱️ ${game.turnSeconds}s`,
        mentions: [next]
    }).catch(() => {});

    scheduleTurn(sock, from, game);
    return true;
};
