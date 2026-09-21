/**
 * VENOM X Flappy Bird
 * Image board (Jimp v1 / Baileys compatible)
 */

const { Jimp } = require("jimp");

const games = new Map();

const W = 12;
const H = 8;
const CELL = 32;
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

function rgba(hex) {
    const h = String(hex).replace("#", "");
    const full = h.length === 6 ? h + "FF" : h;
    return parseInt(full, 16) >>> 0;
}

async function renderImage(state) {
    const img = new Jimp({
        width: W * CELL,
        height: H * CELL,
        color: rgba("#4FC3F7")
    });

    const pipe = rgba("#43A047");
    const pipeDark = rgba("#2E7D32");
    const bird = rgba("#FDD835");
    const beak = rgba("#FB8C00");

    // sky
    for (let y = 0; y < H * CELL; y++) {
        const t = y / (H * CELL);
        const r = Math.floor(79 + t * 40);
        const g = Math.floor(195 - t * 30);
        const b = Math.floor(247 - t * 20);
        const col = (((r & 255) << 24) | ((g & 255) << 16) | ((b & 255) << 8) | 255) >>> 0;
        for (let x = 0; x < W * CELL; x++) {
            img.setPixelColor(col, x, y);
        }
    }

    function fillRect(x, y, w, h, color) {
        for (let yy = y; yy < y + h; yy++) {
            for (let xx = x; xx < x + w; xx++) {
                if (xx >= 0 && yy >= 0 && xx < W * CELL && yy < H * CELL) {
                    img.setPixelColor(color, xx, yy);
                }
            }
        }
    }

    for (let p = 0; p < state.pipes.length; p++) {
        const pipeObj = state.pipes[p];
        for (let y = 0; y < H; y++) {
            if (y < pipeObj.gapY || y >= pipeObj.gapY + PIPE_GAP) {
                fillRect(pipeObj.x * CELL, y * CELL, CELL * 2 - 4, CELL, pipe);
                fillRect(pipeObj.x * CELL, y * CELL, 4, CELL, pipeDark);
            }
        }
    }

    const by = Math.max(0, Math.min(H - 1, Math.round(state.birdY)));
    fillRect(2 * CELL + 6, by * CELL + 6, CELL - 12, CELL - 12, bird);
    fillRect(2 * CELL + CELL - 14, by * CELL + 12, 10, 8, beak);

    return img.getBuffer("image/jpeg");
}

function caption(state) {
    if (!state.alive) {
        return (
            "🐤 *VENOM FLAPPY*\n\n" +
            "💀 Game Over\n" +
            "🏆 Score: *" + state.score + "*\n" +
            "⭐ Best: *" + state.best + "*\n\n" +
            "Type *#bird* to play again"
        );
    }
    return (
        "🐤 *VENOM FLAPPY*\n\n" +
        "🏆 Score: *" + state.score + "*   ⭐ Best: *" + state.best + "*\n\n" +
        "▶️ *#flap* to jump\n" +
        "🛑 *#birdquit* to stop"
    );
}

function step(state, flap) {
    if (!state.alive) return state;

    if (flap) state.birdV = FLAP;
    state.birdV += GRAVITY;
    state.birdY += state.birdV * 0.5;

    for (let i = 0; i < state.pipes.length; i++) state.pipes[i].x -= 1;

    if (state.pipes.length && state.pipes[0].x < -1) {
        state.pipes.shift();
        state.score += 1;
        if (state.score > state.best) state.best = state.score;
    }

    if (state.tick % 5 === 0) {
        const gapY = 1 + Math.floor(Math.random() * (H - PIPE_GAP - 2));
        state.pipes.push({ x: W - 1, gapY: gapY });
    }

    state.tick += 1;

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

async function sendBoard(sock, from, state, quoted) {
    const buf = await renderImage(state);
    await sock.sendMessage(
        from,
        {
            image: buf,
            caption: caption(state)
        },
        quoted ? { quoted: quoted } : undefined
    );
}

module.exports = {
    name: "bird",
    aliases: ["flappy", "flappybird", "flap", "birdquit"],

    run: async function ({ sock, from, sender, reply, commandName, message }) {
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
            await sendBoard(sock, from, state, message);
            return;
        }

        const state = newGame();
        step(state, false);
        games.set(id, state);
        await sendBoard(sock, from, state, message);
    }
};
