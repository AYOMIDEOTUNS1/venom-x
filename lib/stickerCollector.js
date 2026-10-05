const store = new Map(); // groupJid -> [{ buffer, at }]
const MAX = 30;

function addSticker(groupId, buffer) {
    if (!groupId || !buffer || !buffer.length) return;
    const list = store.get(groupId) || [];
    list.push({ buffer: Buffer.from(buffer), at: Date.now() });
    while (list.length > MAX) list.shift();
    store.set(groupId, list);
}

function getStickers(groupId) {
    return (store.get(groupId) || []).map(function (x) { return x.buffer; });
}

function clearStickers(groupId) {
    store.delete(groupId);
}

module.exports = { addSticker, getStickers, clearStickers };
