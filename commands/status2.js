/**
 * VENOM X Group Status (Baileys 7)
 * #status2 / #gcstatus text | reply media
 */

"use strict";

const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const { getSettings } = require("../lib/settingsCache");

const DEFAULT_COLOR = "#9C27B0";

function px() {
    try {
        return getSettings().prefix || "#";
    } catch (e) {
        return "#";
    }
}

function unwrap(message) {
    let current = message || {};
    for (let i = 0; i < 6; i++) {
        const wrapper =
            current.viewOnceMessageV2 ||
            current.viewOnceMessage ||
            current.viewOnceMessageV2Extension ||
            current.ephemeralMessage ||
            current.documentWithCaptionMessage;
        if (!wrapper || !wrapper.message) break;
        current = wrapper.message;
    }
    return current;
}

function detectType(message) {
    if (!message) return null;
    if (message.imageMessage) return "image";
    if (message.videoMessage) return "video";
    if (message.audioMessage) return "audio";
    if (message.stickerMessage) return "sticker";
    return null;
}

async function downloadMedia(message, type) {
    const mediaMessage = message[type + "Message"];
    if (!mediaMessage) throw new Error("Missing " + type);
    const stream = await downloadContentFromMessage(mediaMessage, type);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

async function postGroupStatus(sock, groupJid, content) {
    // Prefer participant list for visibility in group
    let statusJidList = [groupJid];
    try {
        const meta = await sock.groupMetadata(groupJid);
        const parts = (meta.participants || [])
            .map(function (p) {
                return p.id || p.jid;
            })
            .filter(Boolean);
        if (parts.length) statusJidList = parts;
    } catch (e) {}

    const opts = {
        backgroundColor: DEFAULT_COLOR,
        font: 0,
        statusJidList: statusJidList,
        broadcast: true
    };

    await sock.sendMessage("status@broadcast", content, opts);
}

module.exports = {
    name: "status2",
    aliases: ["gcstatus", "gcs", "groupstatus"],

    run: async function ({
        sock,
        from,
        sender,
        args,
        reply,
        message,
        isGroup,
        isOwner,
        isPrivileged
    }) {
        if (!isGroup) {
            return reply("❌ Use inside a group.");
        }

        if (!isOwner && !isPrivileged) {
            // allow admins too if you want — tighten later
        }

        const caption = (args || []).join(" ").trim();

        const ctx =
            message.message &&
            message.message.extendedTextMessage &&
            message.message.extendedTextMessage.contextInfo;

        const quoted = ctx && ctx.quotedMessage;

        try {
            if (!quoted) {
                if (!caption) {
                    const p = px();
                    return reply(
"╭━━〔 📢 GROUP STATUS 〕━━⬣\n" +
"┃ Text: " + p + "gcstatus Hello\n" +
"┃ Media: reply image/video/audio + " + p + "gcstatus [caption]\n" +
"╰━━━━━━━━━━━━━━━━⬣"
                    );
                }

                await postGroupStatus(sock, from, {
                    text: caption,
                    backgroundColor: DEFAULT_COLOR
                });
                return reply("✅ Text group status posted.");
            }

            const payload = unwrap(quoted);
            const type = detectType(payload);
            if (!type) {
                return reply("❌ Reply to image, video, audio, or sticker.");
            }

            await reply("⏳ Posting " + type + " group status...");

            const buffer = await downloadMedia(payload, type);
            if (!buffer || !buffer.length) throw new Error("Empty media");

            if (type === "audio") {
                await postGroupStatus(sock, from, {
                    audio: buffer,
                    mimetype: "audio/ogg; codecs=opus",
                    ptt: true
                });
            } else if (type === "sticker") {
                await postGroupStatus(sock, from, { sticker: buffer });
            } else {
                await postGroupStatus(sock, from, {
                    [type]: buffer,
                    caption: caption || ""
                });
            }

            return reply("✅ " + type + " group status posted.");
        } catch (e) {
            console.log("[GCSTATUS]", e);
            return reply("❌ Group status failed: " + (e.message || e));
        }
    }
};
