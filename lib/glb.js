const fs = require("fs");
const path = require("path");
const economy = require("./economy");

const file = path.join(
    __dirname,
    "../database/glb.json"
);

function load() {
    try {
        if (!fs.existsSync(file)) {
            fs.mkdirSync(path.dirname(file), {
                recursive: true
            });

            fs.writeFileSync(
                file,
                JSON.stringify({
                    currentPhase: 1,
                    phases: {}
                }, null, 2)
            );
        }

        return JSON.parse(
            fs.readFileSync(file, "utf8")
        );

    } catch (err) {
        console.log(
            "GLB LOAD ERROR:",
            err.message
        );

        return {
            currentPhase: 1,
            phases: {}
        };
    }
}

function save(data) {
    fs.writeFileSync(
        file,
        JSON.stringify(data, null, 2)
    );
}

function ensurePhase(data) {
    const phaseId =
        String(data.currentPhase || 1);

    if (!data.phases) {
        data.phases = {};
    }

    if (!data.phases[phaseId]) {
        data.phases[phaseId] = {
            name: `Phase ${phaseId}`,
            startedAt: Date.now(),
            endsAt: 0,
            players: {},
            groups: {}
        };
    }

    return data.phases[phaseId];
}

function ensurePlayer(phase, id) {
    const key = economy.normalizeId(id);

    if (!key) {
        throw new Error(
            "Invalid GLB player ID"
        );
    }

    if (!phase.players[key]) {
        phase.players[key] = {
            score: 0,
            gamesPlayed: 0,
            gamesWon: 0,
            duelsWon: 0
        };
    }

    return phase.players[key];
}

// ===================== ADD SCORE =====================

function addScore(id, amount, options = {}) {
    const data = load();
    const phase = ensurePhase(data);
    const player = ensurePlayer(phase, id);

    amount = Math.max(
        0,
        Number(amount) || 0
    );

    player.score += amount;

    if (options.gamePlayed) {
        player.gamesPlayed++;
    }

    if (options.gameWon) {
        player.gamesWon++;
    }

    if (options.duelWon) {
        player.duelsWon++;
    }

    save(data);

    return player;
}

// ===================== OVERALL =====================

function overall(limit = 10) {
    const data = economy.all();

    return Object.entries(data)
        .map(([id, user]) => ({
            id,
            balance:
                Number(user.balance) || 0,
            bank:
                Number(user.bank) || 0,
            level:
                Number(user.level) || 1,
            xp:
                Number(user.xp) || 0,
            wealth:
                (Number(user.balance) || 0) +
                (Number(user.bank) || 0)
        }))
        .sort((a, b) =>
            b.wealth - a.wealth ||
            b.level - a.level ||
            b.xp - a.xp
        )
        .slice(0, limit);
}

// ===================== PHASE =====================

function phaseLeaderboard(limit = 10) {
    const data = load();
    const phase = ensurePhase(data);

    const players = Object.entries(
        phase.players
    )
        .map(([id, stats]) => ({
            id,
            ...stats
        }))
        .sort((a, b) =>
            b.score - a.score
        )
        .slice(0, limit);

    save(data);

    return players;
}

// ===================== GROUP =====================

function groupLeaderboard(
    groupId,
    members,
    limit = 10
) {
    const data = load();
    const phase = ensurePhase(data);

    const memberIds = new Set(
        members
            .map(id => economy.normalizeId(id))
            .filter(Boolean)
    );

    const players = Object.entries(
        phase.players
    )
        .filter(([id]) =>
            memberIds.has(id)
        )
        .map(([id, stats]) => ({
            id,
            ...stats
        }))
        .sort((a, b) =>
            b.score - a.score
        )
        .slice(0, limit);

    save(data);

    return players;
}

// ===================== CURRENT PHASE =====================

function currentPhase() {
    const data = load();

    return {
        id: Number(data.currentPhase) || 1,
        phase:
            ensurePhase(data)
    };
}

// ===================== RESET PHASE =====================

function startNewPhase(name = null) {
    const data = load();

    const current =
        Number(data.currentPhase) || 1;

    const next = current + 1;

    data.currentPhase = next;

    data.phases[String(next)] = {
        name:
            name ||
            `Phase ${next}`,

        startedAt: Date.now(),
        endsAt: 0,

        players: {},
        groups: {}
    };

    save(data);

    return data.phases[String(next)];
}

module.exports = {
    addScore,
    overall,
    phaseLeaderboard,
    groupLeaderboard,
    currentPhase,
    startNewPhase
};
