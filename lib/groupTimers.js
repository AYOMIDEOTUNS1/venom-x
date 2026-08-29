const timers = new Map();

function setTimer(groupJid, type, timeout) {
    clearTimer(groupJid);

    const timer = setTimeout(() => {
        timers.delete(groupJid);
    }, timeout);

    timers.set(groupJid, {
        type,
        timer,
        expiresAt: Date.now() + timeout
    });

    return timer;
}

function clearTimer(groupJid) {
    const existing = timers.get(groupJid);

    if (existing) {
        clearTimeout(existing.timer);
        timers.delete(groupJid);
    }
}

function getTimer(groupJid) {
    return timers.get(groupJid) || null;
}

module.exports = {
    setTimer,
    clearTimer,
    getTimer
};
