/**
 * VENOM X - Group Status
 * Text / image / video / audio / sticker → group story
 * Credits base: DevAfeez | adapted for VENOM X
 */
"use strict";

const { PassThrough } = require("stream");
const { exec } = require("child_process");
const { promisify } = require("util");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const execAsync = promisify(exec);
const PURPLE = "#9C27B0";

function tmp(ext) {
    return path.join(
        os.tmpdir(),
        "venom_gs_" + crypto.randomBytes(6).toString("hex") + "." + ext
    );
}

function detectMediaType(message) {
    if (!message || typeof message !== "object") return null;
    if (message.imageMessage) return "image";
    if (message.videoMessage) return "video";
    if (message.audioMessage) return "audio";
    if (message.stickerMessage) return "sticker";
    return null;
}

function unwrapQuotedMessage(message) {
    let current = message;
    for (let i = 0; i < 6; i++) {
        const wrapper =
            current?.viewOnceMessageV2 ||
            current?.viewOnceMessage ||
            current?.viewOnceMessageV2Extension ||
            current?.documentWithCaptionMessage ||
            current?.ephemeralMessage;
        if (!wrapper?.message) break;
        current = wrapper.message;
    }
    return current;
}

async function downloadMedia(message, type) {
    const mediaMessage = message[type + "Message"];
    if (!mediaMessage) throw new Error("Missing " + type + " payload");

    const stream = await downloadContentFromMessage(mediaMessage, type);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

async function postGroupStatus(sock, jid, content) {
    const statusSourceType = content.text
        ? "TEXT"
        : content.image
          ? "IMAGE"
          : content.video
            ? "VIDEO"
            : content.audio
              ? "AUDIO"
              : content.sticker
                ? "IMAGE"
                : "TEXT";

    return sock.sendMessage(jid, {
        ...content,
        contextInfo: {
            ...(content.contextInfo || {}),
            isGroupStatus: true,
            statusSourceType,
            statusAttributions: [{ type: 10 }],
            statusAudienceMetadata: { audienceType: "ALL" }
        }
    });
}

async function convertToVoiceNote(buffer) {
    const inFile = tmp("in");
    const outFile = tmp("ogg");
    fs.writeFileSync(inFile, buffer);
    try {
        await execAsync(
            'ffmpeg -hide_banner -loglevel error -y -i "' +
                inFile +
                '" -vn -c:a libopus -ac 1 -ar 48000 "' +
                outFile +
                '"'
        );
        return fs.readFileSync(outFile);
    } finally {
        try {
            fs.unlinkSync(inFile);
        } catch (e) {}
        try {
            fs.unlinkSync(outFile);
        } catch (e) {}
    }
}

/** Sticker webp → still image for group status (WA often rejects raw sticker) */
async function stickerToImage(buffer) {
    const inFile = tmp("webp");
    const outFile = tmp("jpg");
    fs.writeFileSync(inFile, buffer);
    try {
        await execAsync(
            'ffmpeg -hide_banner -loglevel error -y -i "' +
                inFile +
                '" -frames:v 1 -q:v 2 "' +
                outFile +
                '"'
        );
        return fs.readFileSync(outFile);
    } finally {
        try {
            fs.unlinkSync(inFile);
        } catch (e) {}
        try {
            fs.unlinkSync(outFile);
        } catch (e) {}
    }
}

module.exports = {
    name: "status2",
    aliases: ["gcstatus", "gstatus", "groupstatus"],

    run: async function ({ sock, from, message, args, reply, isOwner, isPrivileged }) {
        if (!from.endsWith("@g.us")) {
            return reply("❌ Group only.");
        }

        // optional: only admin/owner — remove if everyone can post
        // if (!isPrivileged) return reply("❌ Owner/sudo only.");

        const caption = (args || []).join(" ").trim();

        const ctx =
            message.message?.extendedTextMessage?.contextInfo ||
            message.message?.imageMessage?.contextInfo ||
            message.message?.videoMessage?.contextInfo ||
            {};

        const quotedMessage = ctx.quotedMessage || null;

        // ── Text only
        if (!quotedMessage) {
            if (!caption) {
                return reply(
`╭━━〔 📢 VENOM X GC STATUS 〕━━⬣

Reply to image / video / audio / sticker:
#gcstatus [caption]

Text only:
#gcstatus Your text here

╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            try {
                await reply("⏳ Posting text group status...");
                await postGroupStatus(sock, from, {
                    text: caption,
                    backgroundColor: PURPLE
                });
                return reply("✅ Text group story posted.");
            } catch (err) {
                console.error("[GCSTATUS] text:", err);
                return reply("❌ Failed: " + (err.message || err));
            }
        }

        const mediaPayload = unwrapQuotedMessage(quotedMessage);
        const mediaType = detectMediaType(mediaPayload);

        if (!mediaType) {
            return reply("❌ Reply to an image, video, audio, or sticker.");
        }

        await reply("⏳ Preparing *" + mediaType + "* group status...");

        try {
            const buffer = await downloadMedia(mediaPayload, mediaType);
            if (!buffer || !buffer.length) throw new Error("Empty download");

            if (mediaType === "audio") {
                const voice = await convertToVoiceNote(buffer);
                await postGroupStatus(sock, from, {
                    audio: voice,
                    mimetype: "audio/ogg; codecs=opus",
                    ptt: true
                });
            } else if (mediaType === "sticker") {
                // try sticker first, then image fallback
                try {
                    await postGroupStatus(sock, from, { sticker: buffer });
                } catch (e1) {
                    console.log("[GCSTATUS] sticker raw failed, trying image:", e1.message);
                    const img = await stickerToImage(buffer);
                    await postGroupStatus(sock, from, {
                        image: img,
                        caption: caption || ""
                    });
                }
            } else {
                await postGroupStatus(sock, from, {
                    [mediaType]: buffer,
                    caption: caption || ""
                });
            }

            return reply(
                "✅ *" +
                    mediaType.charAt(0).toUpperCase() +
                    mediaType.slice(1) +
                    "* group story posted."
            );
        } catch (err) {
            console.error("[GCSTATUS] " + mediaType + ":", err);
            return reply("❌ Failed to post " + mediaType + ": " + (err.message || err));
        }
    }
};
