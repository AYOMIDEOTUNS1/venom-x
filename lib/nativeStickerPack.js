'use strict';

const crypto = require('crypto');
const JSZip = require('jszip');

const PACK_HARD_LIMIT = 60;

async function uploadToServer(client, buffer, options) {
    const hkdfInfo = options.hkdf;
    const mediaPath = options.mediaPath;
    const mediaKey = options.mediaKey || crypto.randomBytes(32);

    const expanded = Buffer.from(
        crypto.hkdfSync(
            'sha256',
            mediaKey,
            Buffer.alloc(32),
            Buffer.from(hkdfInfo),
            112
        )
    );
    const iv = expanded.subarray(0, 16);
    const cipherKey = expanded.subarray(16, 48);
    const macKey = expanded.subarray(48, 80);

    const cipher = crypto.createCipheriv('aes-256-cbc', cipherKey, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const mac = crypto
        .createHmac('sha256', macKey)
        .update(iv)
        .update(encrypted)
        .digest()
        .subarray(0, 10);
    const encBuffer = Buffer.concat([encrypted, mac]);
    const fileSha256 = crypto.createHash('sha256').update(buffer).digest();
    const fileEncSha256 = crypto.createHash('sha256').update(encBuffer).digest();

    const iq = await client.query({
        tag: 'iq',
        attrs: {
            id: (client.generateMessageTag && client.generateMessageTag()) || Date.now().toString(),
            to: 's.whatsapp.net',
            type: 'set',
            xmlns: 'w:m'
        },
        content: [{ tag: 'media_conn', attrs: {} }]
    });

    const mediaConn = (iq.content || []).find(function (v) {
        return v.tag === 'media_conn';
    });
    if (!mediaConn) throw new Error('media_conn not found');

    const auth = mediaConn.attrs && mediaConn.attrs.auth;
    if (!auth) throw new Error('auth not found');

    const hosts = (mediaConn.content || [])
        .filter(function (v) {
            return v.tag === 'host';
        })
        .map(function (v) {
            return v.attrs && v.attrs.hostname;
        })
        .filter(Boolean);

    if (!hosts.length) throw new Error('No host for upload');

    const token = encodeURIComponent(
        fileEncSha256
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/g, '')
    );

    let lastError;
    for (let h = 0; h < hosts.length; h++) {
        const host = hosts[h];
        try {
            const url = new URL('https://' + host + mediaPath + '/' + token);
            url.searchParams.set('auth', auth);
            url.searchParams.set('token', token);

            const response = await fetch(url.toString(), {
                method: 'POST',
                headers: {
                    Origin: 'https://web.whatsapp.com',
                    Referer: 'https://web.whatsapp.com/',
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': String(encBuffer.length)
                },
                body: encBuffer
            });

            if (!response.ok) throw new Error('Upload failed: ' + response.status);

            const json = await response.json();
            const directPath =
                json.direct_path || json.directPath || json.url || json.path;
            if (!directPath) throw new Error('directPath not found');

            return {
                mediaKey: mediaKey,
                fileLength: buffer.length,
                fileSha256: fileSha256,
                fileEncSha256: fileEncSha256,
                directPath: directPath
            };
        } catch (error) {
            lastError = error;
            console.error('[nativeStickerPack] ' + host + ':', error.message);
        }
    }

    throw lastError || new Error('All upload attempts failed');
}

async function createThumbnail(stickerBuffer) {
    try {
        const sharp = require('sharp');
        return await sharp(stickerBuffer)
            .resize(252, 252, { fit: 'cover' })
            .jpeg()
            .toBuffer();
    } catch (error) {
        // fallback: reuse first sticker bytes if sharp fails (Render should have sharp)
        return stickerBuffer.subarray(0, Math.min(stickerBuffer.length, 50 * 1024));
    }
}

async function sendNativeStickerPack(sock, chatId, stickerBuffers, packName, author, quotedMsg) {
    const zip = new JSZip();
    const stickersMetadata = [];

    stickerBuffers.forEach(function (stickerBuffer, index) {
        const fileName =
            'sticker_' + String(index + 1).padStart(3, '0') + '.webp';
        zip.file(fileName, stickerBuffer);
        stickersMetadata.push({
            fileName: fileName,
            isAnimated: stickerBuffer.includes(Buffer.from('VP8X')),
            emojis: ['🔥'],
            accessibilityLabel: '',
            isLottie: false,
            mimetype: 'image/webp'
        });
    });

    const trayFileName = 'tray_icon.webp';
    zip.file(trayFileName, stickerBuffers[0]);

    const archiveBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'STORE'
    });

    const packUpload = await uploadToServer(sock, archiveBuffer, {
        hkdf: 'WhatsApp Sticker Pack Keys',
        mediaPath: '/mms/sticker-pack'
    });

    const thumbnailBuffer = await createThumbnail(stickerBuffers[0]);
    const thumbUpload = await uploadToServer(sock, thumbnailBuffer, {
        hkdf: 'WhatsApp Sticker Pack Thumbnail Keys',
        mediaPath: '/mms/thumbnail-sticker-pack',
        mediaKey: packUpload.mediaKey
    });

    const packId = 'venomx-' + crypto.randomBytes(8).toString('hex');

    await sock.relayMessage(
        chatId,
        {
            messageContextInfo: { messageSecret: crypto.randomBytes(32) },
            stickerPackMessage: {
                stickerPackId: packId,
                name: packName,
                publisher: author,
                packDescription: '🔥 ' + stickerBuffers.length + ' stickers',
                stickers: stickersMetadata,
                fileLength: packUpload.fileLength,
                fileSha256: packUpload.fileSha256,
                fileEncSha256: packUpload.fileEncSha256,
                mediaKey: packUpload.mediaKey,
                directPath: packUpload.directPath,
                mediaKeyTimestamp: Math.floor(Date.now() / 1000),
                stickerPackSize: packUpload.fileLength,
                stickerPackOrigin: 2,
                trayIconFileName: trayFileName,
                thumbnailDirectPath: thumbUpload.directPath,
                thumbnailSha256: thumbUpload.fileSha256,
                thumbnailEncSha256: thumbUpload.fileEncSha256,
                thumbnailHeight: 252,
                thumbnailWidth: 252,
                imageDataHash: thumbUpload.fileSha256.toString('base64')
            }
        },
        { quoted: quotedMsg }
    );
}

module.exports = {
    PACK_HARD_LIMIT: PACK_HARD_LIMIT,
    uploadToServer: uploadToServer,
    createThumbnail: createThumbnail,
    sendNativeStickerPack: sendNativeStickerPack
};
