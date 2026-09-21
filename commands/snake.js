const games = new Map();
const W = 8;
const H = 8;

function key(from, sender) {
    return String(from) + "|" + String(sender);
}

function spawnFood(snake) {
    while (true) {
        const x = Math.floor(Math.random() * W);
        const y = Math.floor(Math.random() * H);
        if (!snake.some(function (s) { return s.x === x && s.y === y; })) {
            return { x: x, y: y };
        }
    }
}

function drawBoard(state) {
    let out = "";
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (state.food.x === x && state.food.y === y) out += "🍎";
            else if (state.snake[0].x === x && state.snake[0].y === y) out += "🟢";
            else if (state.snake.some(function (s) { return s.x === x && s.y === y; })) out += "🟩";
            else out += "⬛";
        }
        out += "\n";
    }
    return out.trim();
}

function render(state) {
    if (!state.alive) {
        return (
"╭━━━━━━━━━━━━━━━━━━╮\n" +
"┃   🐍 *VENOM SNAKE*   ┃\n" +
"╰━━━━━━━━━━━━━━━━━━╯\n\n" +
drawBoard(state) + "\n\n" +
"💀 *GAME OVER*\n" +
"🏆 Score: *" + state.score + "*\n\n" +
"▶️ Play again: *#snake*"
        );
    }

    return (
"╭━━━━━━━━━━━━━━━━━━╮\n" +
"┃   🐍 *VENOM SNAKE*   ┃\n" +
"╰━━━━━━━━━━━━━━━━━━╯\n\n" +
drawBoard(state) + "\n\n" +
"🏆 Score: *" + state.score + "*\n\n" +
"⬆️ *#snake u*  ⬇️ *#snake d*\n" +
"⬅️ *#snake l*  ➡️ *#snake r*\n" +
"🛑 *#snake end*"
    );
}

function move(state, dir) {
    const head = { x: state.snake[0].x, y: state.snake[0].y };
    if (dir === "u") head.y -= 1;
    if (dir === "d") head.y += 1;
    if (dir === "l") head.x -= 1;
    if (dir === "r") head.x += 1;

    if (head.x < 0 || head.y < 0 || head.x >= W || head.y >= H) {
        state.alive = false;
        return state;
    }
    if (state.snake.some(function (s) { return s.x === head.x && s.y === head.y; })) {
        state.alive = false;
        return state;
    }

    state.snake.unshift(head);
    if (head.x === state.food.x && head.y === state.food.y) {
        state.score += 1;
        state.food = spawnFood(state.snake);
    } else {
        state.snake.pop();
    }
    return state;
}

async function sendOrEdit(sock, from, state, quoted) {
    const body = render(state);

    if (state.msgKey) {
        try {
            await sock.sendMessage(from, { text: body, edit: state.msgKey });
            return;
        } catch (e) {}
    }

    const sent = await sock.sendMessage(
        from,
        {
            text: body,
            contextInfo: {
                externalAdReply: {
                    title: "🐍 VENOM SNAKE",
                    body: state.alive ? ("Score " + state.score) : ("Game Over • " + state.score),
                    mediaType: 1,
                    sourceUrl: "https://whatsapp.com"
                }
            }
        },
        quoted ? { quoted: quoted } : undefined
    );

    if (sent && sent.key) state.msgKey = sent.key;
}

module.exports = {
    name: "snake",
    aliases: ["snakegame"],

    run: async function ({ sock, from, sender, args, reply, message }) {
        const id = key(from, sender);
        const sub = String(args[0] || "").toLowerCase();

        if (sub === "end" || sub === "quit") {
            if (!games.has(id)) return reply("No active snake game.");
            games.delete(id);
            return reply("🛑 Snake ended.");
        }

        if (!sub || sub === "start") {
            const snake = [{ x: 3, y: 3 }];
            const state = {
                snake: snake,
                food: spawnFood(snake),
                score: 0,
                alive: true,
                msgKey: null
            };
            games.set(id, state);
            await sendOrEdit(sock, from, state, message);
            return;
        }

        if (["u", "d", "l", "r", "up", "down", "left", "right"].indexOf(sub) === -1) {
            return reply("Use: #snake u | d | l | r");
        }

        let state = games.get(id);
        if (!state || !state.alive) return reply("Start with *#snake*");

        const dir =
            sub === "up" ? "u" :
            sub === "down" ? "d" :
            sub === "left" ? "l" :
            sub === "right" ? "r" : sub;

        state = move(state, dir);
        games.set(id, state);

        if (!state.alive) {
            await sendOrEdit(sock, from, state, message);
            games.delete(id);
            return;
        }

        await sendOrEdit(sock, from, state, message);
    }
};
