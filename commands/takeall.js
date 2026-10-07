'use strict';

const crypto = require('crypto');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const {
    getStickerHistory,
    removeStickerHistory
} = require('../lib/stickerHistory');
const {
    PACK_HARD_LIMIT,
    sendNativeStickerPack
} = require('../lib/nativeStickerPack');

const DEFAULT_BATCH_SIZE = 30;
const LARGE_BATCH_SIZE = 60;
const PACK_NAME = 'VENOM X';
const AUTHOR_NAME = '⸸𝕍ΞȠØ𝕄⸸';

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

function getContentHashFromMessage(stickerMsg) {
    const sha = stickerMsg && stickerMsg.fileSha256;
    if (!sha) return null;
    return Buffer.isBuffer(sha)
        ? sha.toString('hex')
        : Buffer.from(sha).toString('hex');
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
                duplicateKeys.push(storedMessage.key || null);
                continue;
            }
            seenHashes.add(hash);
        }
        unique.push(storedMessage);
    }
    return { unique: unique, duplicateKeys: duplicateKeys };
}

async function pruneHistory(chatId, keys) {
    const validKeys = (keys || []).filter(Boolean);
    if (!validKeys.length) return;
    try {
        await removeStickerHistory(chatId, validKeys);
    } catch (error) {
        console.error('[takeall] prune:', error.message);
    }
}

module.exports = {
    name: 'takeall',
    aliases: ['stealall', 'packall', 'stickerdump'],

    run: async function ({ sock, from, args, reply, message, isGroup }) {
        if (!isGroup) return reply('❌ Group only.');

        let requestedBatchSize = null;
        const opt = args && args[0] ? Number(args[0]) : null;
        if (args && args[0] && opt !== DEFAULT_BATCH_SIZE && opt !== LARGE_BATCH_SIZE && !Number.isNaN(opt)) {
            // allow custom pack name if not 30/60
        }
        if (opt === DEFAULT_BATCH_SIZE || opt === LARGE_BATCH_SIZE) {
            requestedBatchSize = opt;
        }

        const rawStickers = getStickerHistory(from);
        if (!rawStickers.length) {
            return reply(
'╭━━〔 📦 VENOM X TAKEALL 〕━━⬣\n' +
'┃ No stickers seen in this chat yet.\n' +
'┃ Send stickers here, then:\n' +
'┃ #takeall\n' +
'┃ #takeall 30\n' +
'┃ #takeall 60\n' +
'╰━━━━━━━━━━━━━━━━⬣'
            );
        }

        const deduped = dedupeStickers(rawStickers);
        const stickers = deduped.unique;
        if (deduped.duplicateKeys.length) {
            await pruneHistory(from, deduped.duplicateKeys);
        }

        const batchSize =
            requestedBatchSize ||
            (stickers.length > DEFAULT_BATCH_SIZE
                ? LARGE_BATCH_SIZE
                : DEFAULT_BATCH_SIZE);
        const totalBatches = Math.ceil(stickers.length / batchSize);

        await reply(
            '📦 Found *' +
                stickers.length +
                '* stickers.\n⏳ Building ' +
                totalBatches +
                ' pack(s) (' +
                batchSize +
                ' max/batch)...\nAuthor: ' +
                AUTHOR_NAME
        );

        let totalSent = 0;
        let totalFailed = 0;
        let packsSent = 0;

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const batch = stickers.slice(
                batchIndex * batchSize,
                (batchIndex + 1) * batchSize
            );
            const entries = [];
            const downloadedHashes = new Set();
            const postDupKeys = [];

            for (let i = 0; i < batch.length; i++) {
                const storedMessage = batch[i];
                const key = storedMessage.key || null;
                try {
                    if (!getStickerMessage(storedMessage)) {
                        totalFailed++;
                        continue;
                    }
                    const stickerBuffer = await downloadMediaMessage(
                        storedMessage,
                        'buffer',
                        {},
                        {
                            reuploadRequest: sock.updateMediaMessage
                        }
                    );
                    if (!stickerBuffer || !stickerBuffer.length) {
                        totalFailed++;
                        continue;
                    }
                    const hash = crypto
                        .createHash('sha256')
                        .update(stickerBuffer)
                        .digest('hex');
                    if (downloadedHashes.has(hash)) {
                        postDupKeys.push(key);
                        continue;
                    }
                    downloadedHashes.add(hash);
                    entries.push({ buffer: stickerBuffer, key: key });
                } catch (error) {
                    totalFailed++;
                    console.error('[takeall] download:', error.message);
                }
            }

            if (postDupKeys.length) await pruneHistory(from, postDupKeys);

            if (!entries.length) {
                await reply(
                    '⚠️ Batch ' +
                        (batchIndex + 1) +
                        '/' +
                        totalBatches +
                        ': nothing downloaded.'
                );
                continue;
            }

            for (let i = 0; i < entries.length; i += PACK_HARD_LIMIT) {
                const chunk = entries.slice(i, i + PACK_HARD_LIMIT);
                const chunkBuffers = chunk.map(function (e) {
                    return e.buffer;
                });
                const packName =
                    totalBatches === 1
                        ? PACK_NAME
                        : PACK_NAME + ' ' + (batchIndex + 1);

                try {
                    await sendNativeStickerPack(
                        sock,
                        from,
                        chunkBuffers,
                        packName,
                        AUTHOR_NAME,
                        message
                    );
                    totalSent += chunkBuffers.length;
                    packsSent++;
                    await pruneHistory(
                        from,
                        chunk.map(function (e) {
                            return e.key;
                        })
                    );
                } catch (error) {
                    totalFailed += chunkBuffers.length;
                    console.error('[takeall] pack:', error.message);
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
