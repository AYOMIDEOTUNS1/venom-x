const games = new Map();

function key(from, sender) {
    return String(from) + "|" + String(sender);
}

module.exports = {
    name: "guessgame",
    aliases: ["numbergame", "nguess"],

    run: async function ({ from, sender, args, reply }) {
        const id = key(from, sender);
        const sub = String(args[0] || "").toLowerCase();

        if (sub === "end") {
            games.delete(id);
            return reply("🛑 Number game ended.");
        }

        if (!sub || sub === "start") {
            const n = 1 + Math.floor(Math.random() * 50);
            games.set(id, { n: n, tries: 0, max: 7 });
            return reply(
`🔢 *Guess the Number*

I'm thinking of a number *1–50*
You have *7* tries

Guess: *#guessgame 25*
Stop: *#guessgame end*`
            );
        }

        const guess = parseInt(sub, 10);
        if (!guess && guess !== 0) return reply("Example: #guessgame 12");

        const g = games.get(id);
        if (!g) return reply("Start: *#guessgame*");

        g.tries += 1;
        if (guess === g.n) {
            games.delete(id);
            return reply("🎉 Correct! *" + g.n + "* in " + g.tries + " tries.");
        }
        if (g.tries >= g.max) {
            games.delete(id);
            return reply("💀 Out of tries. Number was *" + g.n + "*");
        }
        const hint = guess < g.n ? "higher ⬆️" : "lower ⬇️";
        return reply(
            hint + "\nTries left: *" + (g.max - g.tries) + "*"
        );
    }
};
