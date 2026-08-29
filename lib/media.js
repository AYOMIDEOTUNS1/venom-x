const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const {
    downloadContentFromMessage
} = require("@whiskeysockets/baileys");

function tmp(ext) {
    return path.join(
        os.tmpdir(),
        `venom_${crypto.randomBytes(6).toString("hex")}.${ext}`
    );
}

async function streamToBuffer(stream) {
    const chunks = [];

    for await (const chunk of stream) {
        chunks.push(chunk);
    }

    return Buffer.concat(chunks);
}

async function downloadMedia(message) {

    if (!message) {
        throw new Error("No message supplied.");
    }

    let mediaType = null;
    let media = null;

    if (message.imageMessage) {
        mediaType = "image";
        media = message.imageMessage;
    }

    else if (message.videoMessage) {
        mediaType = "video";
        media = message.videoMessage;
    }

    else if (message.stickerMessage) {
        mediaType = "sticker";
        media = message.stickerMessage;
    }

    else if (message.audioMessage) {
        mediaType = "audio";
        media = message.audioMessage;
    }

    else if (message.documentMessage) {
        mediaType = "document";
        media = message.documentMessage;
    }

    if (!mediaType) {
        throw new Error("Unsupported media type.");
    }
    const stream = await downloadContentFromMessage(
        media,
        mediaType
    );

    const buffer = await streamToBuffer(stream);

    return {
        type: mediaType,
        buffer,
        tmp
    };
}

module.exports = {
    downloadMedia,
    tmp
};
