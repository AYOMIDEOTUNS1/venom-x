const games = new Map();

function key(from) {
    return String(from);
}

function empty() {
    return ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
}

function draw(board) {
    const c = function (i) {
        if (board[i] === "X") return "❌";
        if (board[i] === "O") return "⭕";
        return "⬜";
    };
    return (
        c(0) + c(1) + c(2) + "\n" +
        c(3) + c(4) + c(5) + "\n" +
        c(6) + c(7) + c(8)
    );
}

function winner(b) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    for (let i = 0; i < lines.length; i++) {
        const a = lines[i][0], c = lines[i][1], d = lines[i][2];
        if (b[a] === b[c] && b[c] === b[d] && (b[a] === "X" || b[a] === "O")) {
            return b[a];
        }
    }
    if (b.every(function (x) { return x === "X" || x === "O"; })) return "draw";
    return null;
}

module.exports = {
    name: "ttt",
    aliases: ["tictactoe", "xo"],

    run: async function ({ from, sender, args, reply }) {
        const id = key(from);
        const sub = String(args[0] || "").toLowerCase();

        if (sub === "end" || sub === "quit") {
            games.delete(id);
            return reply("🛑 Tic-Tac-Toe ended.");
        }

        if (sub === "start" || !sub) {
            games.set(id, {
                board: empty(),
                turn: "X",
                players: { X: sender, O: null }
            });
            return reply(
`🎮 *Tic-Tac-Toe*

You are ❌
Friend: type *#ttt join*

${draw(empty())}

Play: *#ttt 5* (cell 1-9)
Stop: *#ttt end*`
            );
        }

        if (sub === "join") {
            const g = games.get(id);
            if (!g) return reply("No game. *#ttt start*");
            if (g.players.O) return reply("Game full.");
            if (g.players.X === sender) return reply("You are already X.");
            g.players.O = sender;
            return reply("⭕ joined!\n❌ goes first.\n" + draw(g.board));
        }

        const cell = parseInt(sub, 10);
        if (!(cell >= 1 && cell <= 9)) {
            return reply("Usage:\n#ttt start\n#ttt join\n#ttt 1-9\n#ttt end");
        }

        const g = games.get(id);
        if (!g) return reply("No game. *#ttt start*");

        const mark = g.turn;
        if (mark === "X" && g.players.X !== sender) return reply("Not your turn (X).");
        if (mark === "O" && g.players.O !== sender) {
            if (!g.players.O) return reply("Wait for someone to *#ttt join*");
            return reply("Not your turn (O).");
        }

        const idx = cell - 1;
        if (g.board[idx] === "X" || g.board[idx] === "O") {
            return reply("Cell taken.");
        }

        g.board[idx] = mark;
        const w = winner(g.board);
        if (w === "X" || w === "O") {
            games.delete(id);
            return reply(draw(g.board) + "\n\n🏆 *" + w + "* wins!");
        }
        if (w === "draw") {
            games.delete(id);
            return reply(draw(g.board) + "\n\n🤝 Draw!");
        }

        g.turn = mark === "X" ? "O" : "X";
        return reply(draw(g.board) + "\n\nTurn: *" + g.turn + "*");
    }
};
