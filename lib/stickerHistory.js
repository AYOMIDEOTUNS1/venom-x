'use strict';

const fs = require('fs');
const path = require('path');

const MAX_STICKERS_PER_CHAT = 500;
const HISTORY_FILE = path.join(__dirname, '../data/takeall-stickers.json');
const histories = new Map();

function reviveBuffers(key, value) {
    if (value && value.type === 'Buffer' && Array.isArray(value.data)) {
        return Buffer.from(value.data);
    }
    return value;
}

function loadHistory() {
    try {
        if (!fs.existsSync(HISTORY_FILE)) return;
        const saved = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'), reviveBuffers);
        for (const [chatId, messages] of Object.entries(saved || {})) {
            if (Array.isArray(messages) && messages.length) {
                histories.set(chatId, messages.slice(-MAX_STICKERS_PER_CHAT));
            }
        }
    } catch (error) {
        console.warn('[stickerHistory] load:', error.message);
    }
}

function saveHistory() {
    try {
        fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(Object.fromEntries(histories)));
    } catch (error) {
        console.warn('[stickerHistory] save:', error.message);
    }
}

function unwrapMessage(message) {
    let current = message;
    for (let i = 0; i < 4 && current; i += 1) {
        if (current.stickerMessage) return current.stickerMessage;
        if (current.ephemeralMessage && current.ephemeralMessage.message) {
            current = current.ephemeralMessage.message;
            continue;
        }
        if (current.viewOnceMessage && current.viewOnceMessage.message) {
            current = current.viewOnceMessage.message;
            continue;
        }
        if (current.viewOnceMessageV2 && current.viewOnceMessageV2.message) {
            current = current.viewOnceMessageV2.message;
            continue;
        }
        break;
    }
    return null;
}

function recordStickerMessage(message) {
    const chatId = message && message.key && message.key.remoteJid;
    const stickerMessage = unwrapMessage(message && message.message);
    const messageId = message && message.key && message.key.id;
    if (!chatId || !stickerMessage || !messageId) return false;

    const history = histories.get(chatId) || [];
    if (history.some(function (item) {
        return item.key && item.key.id === messageId;
    })) return false;

    history.push({
        key: message.key,
        message: message.message,
        messageTimestamp: message.messageTimestamp
    });

    if (history.length > MAX_STICKERS_PER_CHAT) {
        history.splice(0, history.length - MAX_STICKERS_PER_CHAT);
    }
    histories.set(chatId, history);
    saveHistory();
    return true;
}

function getStickerHistory(chatId) {
    return [].concat(histories.get(chatId) || []);
}

function removeStickerHistory(chatId, keys) {
    const history = histories.get(chatId);
    if (!history || !history.length) return 0;

    const idsToRemove = new Set(
        (keys || []).map(function (key) {
            return key && key.id;
        }).filter(Boolean)
    );
    if (!idsToRemove.size) return 0;

    const remaining = history.filter(function (item) {
        return !idsToRemove.has(item.key && item.key.id);
    });
    const removedCount = history.length - remaining.length;
    if (!removedCount) return 0;

    if (remaining.length) histories.set(chatId, remaining);
    else histories.delete(chatId);
    saveHistory();
    return removedCount;
}

function clearStickerHistory(chatId) {
    histories.delete(chatId);
    saveHistory();
}

loadHistory();

module.exports = {
    recordStickerMessage,
    getStickerHistory,
    removeStickerHistory,
    clearStickerHistory,
    MAX_STICKERS_PER_CHAT
};
