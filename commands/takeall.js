'use strict';

const crypto = require('crypto');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { getStickerHistory, removeStickerHistory } = require('../lib/stickerHistory');
const { PACK_HARD_LIMIT, sendNativeStickerPack } = require('../lib/nativeStickerPack');

const DEFAULT_BATCH_SIZE = 30;
const LARGE_BATCH_SIZE = 60;

function getStickerMessage(message) {
    let current = message && message.message;
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

function getMessageKey(storedMessage) {
    return (storedMessage && storedMessage.key) || null;
}

function getContentHashFromMessage(stickerMsg) {
    const sha = stickerMsg && stickerMsg.fileSha256;
    if (!sha) return null;
    return Buffer.isBuffer(sha) ? sha.toString('hex') : Buffer.from(sha).toString('hex');
}

function dedupeStickers(stickers) {
    const seenHashes = new Set();
    const unique = [];
    const duplicateKeys = [];

    for (let i = 0; i < stickers.length; i++) {
        const storedMessage = stickers[i];
        const stickerMsg = getStickerMessage(storedMessage);
        if (!stickerMsg) {
            unique.push(storedMessage);
            continue;
        }
        const hash = getContentHashFromMessage(stickerMsg);
        if (hash) {
            if (seenHashes.has(hash)) {
                duplicateKeys.push(getMessageKey(storedMessage));
                continue;
            }
            seenHashes.add(hash);
        }
        unique.push(storedMessage);
    }
    return { unique: unique, duplicateKeys: duplicateKeys };
}

function pruneHistory(chatId, keys) {
    const validKeys = (keys || []).filter(Boolean);
    if (!validKeys.length) return;
    try {
        removeStickerHistory(chatId, validKeys);
    } catch (error) {
        console.error('[takeall] prune failed: ' + error.message);
    }
}

module.exports = {
    name: 'takeall',
    aliases: ['stickerpack', 'packall', 'stealall'],

    run: async function ({ sock, from, message, reply, args }) {
        const chatId = from;

        let requestedBatchSize = null;
        if (args && args[0]) {
            const size = Number(args[0]);
            if (size === DEFAULT_BATCH_SIZE || size === LARGE_BATCH_SIZE) {
                requestedBatchSize = size;
            } else if (args[0] && !/^\d+$/.test(String(args[0]))) {
                // allow pack name override later; ignore non-size first arg
            } else if (args[0]) {
                return reply('❌ Use *#takeall*, *#takeall 30*, or *#takeall 60*.');
            }
        }

        const rawStickers = getStickerHistory(chatId);
        if (!rawStickers.length) {
            return reply('🖼️ I have not seen any stickers in this chat yet.\nSend stickers here, then *#takeall*.');
        }

        const deduped = dedupeStickers(rawStickers);
        const stickers = deduped.unique;
        if (deduped.duplicateKeys.length) {
            pruneHistory(chatId, deduped.duplicateKeys);
        }

        const batchSize =
            requestedBatchSize ||
            (stickers.length > DEFAULT_BATCH_SIZE ? LARGE_BATCH_SIZE : DEFAULT_BATCH_SIZE);
        const totalBatches = Math.ceil(stickers.length / batchSize);

        let basePackName = 'VENOM X';
        let author = '⸸𝕍ΞȠØ𝕄⸸';
        try {
            const { getSettings } = require('../lib/settingsCache');
            const s = getSettings() || {};
            if (s.packname) basePackName = s.packname;
            if (s.botName) basePackName = s.botName;
            if (s.botOwner) author = s.botOwner;
        } catch (e) {}

        // optional: #takeall 30 MyPack | Author
        const nameArgs = (args || []).slice(requestedBatchSize ? 1 : 0).join(' ').trim();
        if (nameArgs.includes('|')) {
            const parts = nameArgs.split('|');
            basePackName = (parts[0] || '').trim() || basePackName;
            author = (parts[1] || '').trim() || author;
        } else if (nameArgs && !/^\d+$/.test(nameArgs)) {
            basePackName = nameArgs;
        }

        await reply(
            '📦 Found *' +
                stickers.length +
                '* stickers.\n⏳ Building *' +
                totalBatches +
                '* pack(s) (' +
                batchSize +
                ' max / batch)...'
        );

        let totalSent = 0;
        let totalFailed = 0;
        let packsSent = 0;

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
            const batch = stickers.slice(
                batchIndex * batchSize,
                (batchIndex + 1) * batchSize
            );

            const entries = [];
            const downloadedHashes = new Set();
            const postDownloadDuplicateKeys = [];

            for (let i = 0; i < batch.length; i++) {
                const storedMessage = batch[i];
                const key = getMessageKey(storedMessage);
                try {
                    if (!getStickerMessage(storedMessage)) {
                        totalFailed += 1;
                        continue;
                    }

                    const stickerBuffer = await downloadMediaMessage(
                        storedMessage,
                        'buffer',
                        {},
                        {
                            logger: undefined,
                            reuploadRequest: sock.updateMediaMessage
                        }
                    );

                    if (!stickerBuffer || !stickerBuffer.length) {
                        totalFailed += 1;
                        continue;
                    }

                    const hash = crypto
                        .createHash('sha256')
                        .update(stickerBuffer)
                        .digest('hex');
                    if (downloadedHashes.has(hash)) {
                        postDownloadDuplicateKeys.push(key);
                        continue;
                    }
                    downloadedHashes.add(hash);
                    entries.push({ buffer: stickerBuffer, key: key });
                } catch (error) {
                    totalFailed += 1;
                    console.error('[takeall] download: ' + error.message);
                }
            }

            if (postDownloadDuplicateKeys.length) {
                pruneHistory(chatId, postDownloadDuplicateKeys);
            }

            if (!entries.length) {
                await reply(
                    '⚠️ Batch ' +
                        (batchIndex + 1) +
                        '/' +
                        totalBatches +
                        ': no stickers downloaded, skipping.'
                );
                continue;
            }

            const subPacks = [];
            for (let i = 0; i < entries.length; i += PACK_HARD_LIMIT) {
                subPacks.push(entries.slice(i, i + PACK_HARD_LIMIT));
            }

            for (let subIndex = 0; subIndex < subPacks.length; subIndex += 1) {
                const chunk = subPacks[subIndex];
                const chunkBuffers = chunk.map(function (e) { return e.buffer; });
                const packName =
                    totalBatches === 1 && subPacks.length === 1
                        ? basePackName
                        : basePackName +
                          ' ' +
                          (batchIndex + 1) +
                          (subPacks.length > 1 ? '.' + (subIndex + 1) : '');

                try {
                    await sendNativeStickerPack(
                        sock,
                        chatId,
                        chunkBuffers,
                        packName,
                        author,
                        message
                    );
                    totalSent += chunkBuffers.length;
                    packsSent += 1;
                    pruneHistory(
                        chatId,
                        chunk.map(function (e) { return e.key; })
                    );
                } catch (error) {
                    totalFailed += chunkBuffers.length;
                    console.error('[takeall] pack failed: ' + error.message);
                    await reply(
                        '⚠️ Pack "' + packName + '" failed: ' + error.message
                    );
                }
            }
        }

        return reply(
            totalFailed
                ? '✅ Done: *' +
                      totalSent +
                      '* stickers in *' +
                      packsSent +
                      '* pack(s), *' +
                      totalFailed +
                      '* failed.'
                : '✅ Done: *' +
                      totalSent +
                      '* stickers in *' +
                      packsSent +
                      '* pack(s).'
        );
    }
};
