const collections = new Map(); // chatId -> { hashes: Set, items: [] }
const MAX_PER_CHAT = 30;

function hashBuffer(buf) {
    // Simple fast hash to detect duplicates
    let h = 0;
    const step = Math.max(1, Math.floor(buf.length / 50));
    for (let i = 0; i < buf.length; i += step) {
        h = ((h << 5) - h + buf[i]) | 0;
    }
    return `\( {buf.length}_ \){h}`;
}

function addSticker(chatId, buffer) {
    if (!chatId || !buffer || !Buffer.isBuffer(buffer)) return false;
    if (buffer.length < 500) return false;

    if (!collections.has(chatId)) {
        collections.set(chatId, {
            hashes: new Set(),
            items: []
        });
    }

    const data = collections.get(chatId);
    const hash = hashBuffer(buffer);

    // Already saved → skip
    if (data.hashes.has(hash)) {
        return false;
    }

    data.hashes.add(hash);
    data.items.push(buffer);

    // Keep only last 30 unique
    if (data.items.length > MAX_PER_CHAT) {
        const removed = data.items.shift();
        data.hashes.delete(hashBuffer(removed));
    }

    return true;
}

function getStickers(chatId) {
    return collections.get(chatId)?.items || [];
}

function clearStickers(chatId) {
    collections.delete(chatId);
}

function count(chatId) {
    return collections.get(chatId)?.items?.length || 0;
}

module.exports = {
    addSticker,
    getStickers,
    clearStickers,
    count,
    MAX_PER_CHAT
};
