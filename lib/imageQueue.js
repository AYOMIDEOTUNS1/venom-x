const queue = new Set();
const cooldowns = new Map();

const COOLDOWN_TIME = 60 * 1000; // 1 minute

module.exports = {

    has(id) {
        return queue.has(id);
    },

    add(id) {
        queue.add(id);
    },

    remove(id) {
        queue.delete(id);
    },

    isCooldown(id) {

        if (!cooldowns.has(id)) {
            return false;
        }

        const timeLeft =
            cooldowns.get(id) - Date.now();

        if (timeLeft <= 0) {
            cooldowns.delete(id);
            return false;
        }

        return timeLeft;
    },

    setCooldown(id) {
        cooldowns.set(
            id,
            Date.now() + COOLDOWN_TIME
        );
    }
};
