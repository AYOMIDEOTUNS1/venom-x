/**
 * VENOM X Flappy Bird
 * Image board + tappable buttons
 */

const Jimp = require("jimp");

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

function hex(n) {
    return Jimp.cssColorToHex(n);
}

async function renderImage(state) {
    const img = new Jimp(W * CELL, H * CELL, hex("#4FC3F7"));

    img.scan(0, 0, img.bitmap.width, img.bitmap.height, function (x, y, idx) {
        const t = y / img.bitmap.height;
        this.bitmap.data[idx] = 79 + Math.floor(t * 40);
        this.bitmap.data[idx + 1] = 195 - Math.floor(t * 30);
        this.bitmap.data[idx + 2] = 247 - Math.floor(t * 20);
        this.bitmap.data[idx + 3] = 255;
    });

    function fillRect(x, y, w, h, color) {
        for (let yy = y; yy < y + h; yy++) {
            for (let xx = x; xx < x + w; xx++) {
                if (xx >= 0 && yy >= 0 && xx < img.bitmap.width && yy < img.bitmap.height) {
                    img.setPixelColor(color, xx, yy);
                }
            }
        }
    }

    const pipe = hex("#43A047");
    const pipeDark = hex("#2E7D32");
    const bird = hex("#FDD835");
    const beak = hex("#FB8C00");

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

    return img.quality(80).getBufferAsync(Jimp.MIME_JPEG);
}

function caption(state) {
    if (!state.alive) {
        return "🐤 *VENOM FLAPPY*\n\n💀 Game Over\n🏆 Score: *" + state.score + "*\n⭐ Best: *" + state.best + "*\n\nTap *PLAY AGAIN*";
    }
    return "🐤 *VENOM FLAPPY*\n\n🏆 Score: *" + state.score + "*   ⭐ Best: *" + state.best + "*\n\nTap *FLAP* to jump";
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

    const buttons = state.alive
        ? [
            { buttonId: "#flap", buttonText: { displayText: "🐤 FLAP" }, type: 1 },
            { buttonId: "#birdquit", buttonText: { displayText: "🛑 QUIT" }, type: 1 }
        ]
        : [
            { buttonId: "#bird", buttonText: { displayText: "▶️ PLAY AGAIN" }, type: 1 }
        ];

    try {
        await sock.sendMessage(
            from,
            {
                image: buf,
                caption: caption(state),
                footer: "VENOM X Arcade",
                buttons: buttons,
                headerType: 4
            },
            quoted ? { quoted: quoted } : undefined
        );
    } catch (e) {
        // fallback if buttons are blocked by WhatsApp
        await sock.sendMessage(
            from,
            {
                image: buf,
                caption: caption(state) + "\n\nOr type *#flap*"
            },
            quoted ? { quoted: quoted } : undefined
        );
    }
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
