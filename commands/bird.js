/**
 * Interactive Flappy-style game for WhatsApp (turn-based)
 * #bird  → start
 * #flap  → jump
 * #birdquit → end
 */

const games = new Map(); // from -> state

const W = 12;
const H = 8;
const GRAVITY = 1;
const FLAP = -2;
const PIPE_GAP = 3;

function key(from, sender) {
    return String(from) + "|" + String(sender);
}

function newGame() {
    return {
        birdY: 3,
        birdV: 0,
        pipes: [{ x: 10, gapY: 3 }],
        score: 0,
        best: 0,
        alive: true,
        tick: 0
    };
}

function draw(state) {
    const grid = [];
    for (let y = 0; y < H; y++) {
        const row = [];
        for (let x = 0; x < W; x++) row.push("sky");
        grid.push(row);
    }

    // pipes
    for (let p = 0; p < state.pipes.length; p++) {
        const pipe = state.pipes[p];
        for (let y = 0; y < H; y++) {
            if (y < pipe.gapY || y >= pipe.gapY + PIPE_GAP) {
                if (pipe.x >= 0 && pipe.x < W) grid[y][pipe.x] = "pipe";
                if (pipe.x + 1 >= 0 && pipe.x + 1 < W) grid[y][pipe.x + 1] = "pipe";
            }
        }
    }

    // bird
    const by = Math.max(0, Math.min(H - 1, Math.round(state.birdY)));
    grid[by][2] = "bird";

    const lines = [];
    for (let y = 0; y < H; y++) {
        let line = "";
        for (let x = 0; x < W; x++) {
            const c = grid[y][x];
            if (c === "bird") line += "🐤";
            else if (c === "pipe") line += "🟩";
            else line += "🟦";
        }
        lines.push(line);
    }

    return (
        "╭━━〔 🐤 VENOM X FLAPPY 〕━━⬣\n" +
        "┃ Score: *" +
        state.score +
        "*  Best: *" +
        state.best +
        "*\n" +
        "╰━━━━━━━━━━━━━━━━⬣\n\n" +
        lines.join("\n") +
        "\n\n" +
        (state.alive
            ? "▶️ *#flap* to jump\n🛑 *#birdquit* to stop"
            : "💀 *Game Over!*\nScore: *" +
              state.score +
              "*\nType *#bird* to play again")
    );
}

function step(state, flap) {
    if (!state.alive) return state;

    if (flap) state.birdV = FLAP;
    state.birdV += GRAVITY;
    state.birdY += state.birdV * 0.5;

    // move pipes
    for (let i = 0; i < state.pipes.length; i++) {
        state.pipes[i].x -= 1;
    }

    // remove off-screen + score
    if (state.pipes.length && state.pipes[0].x < -1) {
        state.pipes.shift();
        state.score += 1;
        if (state.score > state.best) state.best = state.score;
    }

    // spawn
    if (state.tick % 5 === 0) {
        const gapY = 1 + Math.floor(Math.random() * (H - PIPE_GAP - 2));
        state.pipes.push({ x: W - 1, gapY: gapY });
    }

    state.tick += 1;

    // collisions
    const by = Math.round(state.birdY);
    if (by < 0 || by >= H) {
        state.alive = false;
        return state;
    }

    for (let i = 0; i < state.pipes.length; i++) {
        const pipe = state.pipes[i];
        if (pipe.x <= 2 && pipe.x + 1 >= 2) {
            if (by < pipe.gapY || by >= pipe.gapY + PIPE_GAP) {
                state.alive = false;
                return state;
            }
        }
    }

    return state;
}

module.exports = {
    name: "bird",
    aliases: ["flappy", "flappybird", "flap", "birdquit"],

    run: async function ({ from, sender, reply, commandName }) {
        const cmd = String(commandName || "").toLowerCase();
        const id = key(from, sender);

        if (cmd === "birdquit") {
            if (!games.has(id)) return reply("No active game.");
            games.delete(id);
            return reply("🛑 Flappy stopped.");
        }

        if (cmd === "flap") {
            let state = games.get(id);
            if (!state || !state.alive) {
                return reply("No active game.\nType *#bird* to start.");
            }
            state = step(state, true);
            games.set(id, state);
            return reply(draw(state));
        }

        // #bird / #flappy → new game
        const state = newGame();
        // mild first step so board isn't empty
        step(state, false);
        games.set(id, state);
        return reply(
            "🎮 *Flappy started!*\n\n" +
                draw(state) +
                "\n\n⚡ VENOM X Arcade"
        );
    }
};
