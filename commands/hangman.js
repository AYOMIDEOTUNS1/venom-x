const games = new Map();
const WORDS = [
    "javascript", "whatsapp", "nigeria", "venom", "python",
    "hangman", "keyboard", "android", "diamond", "flappy"
];

const HANG = [
    "  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========",
    "  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========",
    "  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========",
    "  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========",
    "  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========",
    "  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========",
    "  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n========="
];

function key(from, sender) {
    return String(from) + "|" + String(sender);
}

function view(word, guessed) {
    return word
        .split("")
        .map(function (ch) {
            return guessed.indexOf(ch) !== -1 ? ch : "_";
        })
        .join(" ");
}

module.exports = {
    name: "hangman",
    aliases: ["hang", "hm"],

    run: async function ({ from, sender, args, reply }) {
        const id = key(from, sender);
        const sub = String(args[0] || "").toLowerCase();

        if (sub === "end" || sub === "quit") {
            games.delete(id);
            return reply("🛑 Hangman ended.");
        }

        if (!sub || sub === "start") {
            const word = WORDS[Math.floor(Math.random() * WORDS.length)];
            games.set(id, { word: word, guessed: [], wrong: 0 });
            return reply(
`🎮 *Hangman*

${HANG[0]}

${view(word, [])}

Guess: *#hangman a*
Stop: *#hangman end*`
            );
        }

        if (sub.length !== 1 || !/[a-z]/i.test(sub)) {
            return reply("Guess one letter:\n#hangman e");
        }

        const g = games.get(id);
        if (!g) return reply("Start with *#hangman*");

        const letter = sub.toLowerCase();
        if (g.guessed.indexOf(letter) !== -1) {
            return reply("Already tried *" + letter + "*");
        }
        g.guessed.push(letter);

        if (g.word.indexOf(letter) === -1) {
            g.wrong += 1;
        }

        const shown = view(g.word, g.guessed);
        if (shown.indexOf("_") === -1) {
            games.delete(id);
            return reply("🎉 You won!\nWord: *" + g.word + "*");
        }
        if (g.wrong >= 6) {
            games.delete(id);
            return reply(
                HANG[6] + "\n\n💀 Game over!\nWord was: *" + g.word + "*"
            );
        }

        return reply(
            HANG[g.wrong] +
                "\n\n" +
                shown +
                "\n\nTried: " +
                g.guessed.join(", ")
        );
    }
};
