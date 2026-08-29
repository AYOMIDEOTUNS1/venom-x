const state = {
    sleeping: false,
    refreshedAt: Date.now()
};

function sleepBot() {
    state.sleeping = true;
    return state;
}

function wakeBot() {
    state.sleeping = false;
    state.refreshedAt = Date.now();
    return state;
}

function refreshBot() {
    state.refreshedAt = Date.now();
    return state;
}

function isSleeping() {
    return state.sleeping === true;
}

module.exports = {
    sleepBot,
    wakeBot,
    refreshBot,
    isSleeping,
    state
};
