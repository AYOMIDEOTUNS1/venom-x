/**
 * VENOM X - Group Status
 * Base: DevAfeez | extras: DaraTech (colors, multi-group)
 * Does NOT re-send media into the group chat — story only + text ACK
 */
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { exec } = require("child_process");
const { promisify } = require("util");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

const execAsync = promisify(exec);

const COLOR_MAP = {
    purple: "#9C27B0",
    violet: "#7B1FA2",
    pink: "#E91E63",
    hotpink: "#FF4081",
    red: "#F44336",
    orange: "#FF5722",
    amber: "#FF8F00",
    yellow: "#FFC107",
    lime: "#8BC34A",
    green: "#4CAF50",
    teal: "#009688",
    cyan: "#00BCD4",
    blue: "#2196F3",
    navy: "#1565C0",
    indigo: "#3F51B5",
    black: "#212121",
    dark: "#263238",
    grey: "#607D8B",
    white: "#FAFAFA",
    brown: "#795548",
    gold: "#F9A825",
    maroon: "#880E4F"
};
const DEFAULT_COLOR = "#9C27B0";

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

function parseArgs(args) {
    const colors = [];
    const rest = [];
    for (let i = 0; i < (args || []).length; i++) {
        const a = String(args[i] || "").toLowerCase();
        if (COLOR_MAP[a]) colors.push(COLOR_MAP[a]);
        else rest.push(args[i]);
    }
    return {
        color: colors[0] || DEFAULT_COLOR,
        caption: rest.join(" ").trim()
    };
}

/**
 * Post to GROUP STORY only.
 * Primary: status@broadcast + statusJidList (does not dump media in chat)
 * Fallback: isGroupStatus on group jid (DevAfeez style)
 */
async function postGroupStatus(sock, groupJid, content, backgroundColor) {
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

    const payload = { ...content };

    // text background (DaraTech-style)
    if (payload.text && backgroundColor) {
        payload.backgroundColor = backgroundColor;
    }

    // --- Method A: status broadcast targeted at group (preferred: no chat bubble) ---
    try {
        await sock.sendMessage(
            "status@broadcast",
            {
                ...payload,
                contextInfo: {
                    ...(payload.contextInfo || {}),
                    isGroupStatus: true,
                    statusSourceType,
                    statusAttributions: [{ type: 10 }],
                    statusAudienceMetadata: { audienceType: "ALL" }
                }
            },
            {
                statusJidList: [groupJid],
                backgroundColor: backgroundColor || DEFAULT_COLOR
            }
        );
        return "broadcast";
    } catch (e1) {
        console.log("[GCSTATUS] broadcast method failed:", e1.message);
    }

    // --- Method B: DevAfeez isGroupStatus on group jid ---
    await sock.sendMessage(groupJid, {
        ...payload,
        contextInfo: {
            ...(payload.contextInfo || {}),
            isGroupStatus: true,
            statusSourceType,
            statusAttributions: [{ type: 10 }],
            statusAudienceMetadata: { audienceType: "ALL" }
        }
    });
    return "group";
}

module.exports = {
    name: "status2",
    aliases: ["gcstatus", "gstatus", "groupstatus"],

    run: async function ({ sock, from, message, args, reply }) {
        if (!from.endsWith("@g.us")) {
            return reply("❌ Group only.");
        }

        const { color, caption } = parseArgs(args);

        const ctx =
            message.message?.extendedTextMessage?.contextInfo ||
            message.message?.imageMessage?.contextInfo ||
            message.message?.videoMessage?.contextInfo ||
            {};

        const quotedMessage = ctx.quotedMessage || null;

        // ── TEXT ONLY ─────────────────────────────────────
        if (!quotedMessage) {
            if (!caption) {
                return reply(
`╭━━〔 📢 VENOM X GC STATUS 〕━━⬣

Reply to image / video / audio / sticker:
*#gcstatus* [caption] [color]

Text story:
*#gcstatus* Your text here purple

Colors: purple pink red blue green gold black …

⚠️ Media is posted to *group story only*
— not re-sent in the chat.

╰━━━━━━━━━━━━━━━━⬣`
                );
            }

            try {
                await reply("⏳ Posting text group story…");
                await postGroupStatus(
                    sock,
                    from,
                    { text: caption },
                    color
                );
                // text ACK only — never the story body again as media
                return reply("✅ Text group story posted.");
            } catch (err) {
                console.error("[GCSTATUS] text:", err);
                return reply("❌ Failed: " + (err.message || err));
            }
        }

        // ── QUOTED MEDIA ──────────────────────────────────
        const mediaPayload = unwrapQuotedMessage(quotedMessage);
        const mediaType = detectMediaType(mediaPayload);

        if (!mediaType) {
            return reply("❌ Reply to an image, video, audio, or sticker.");
        }

        // ACK only — do NOT send the image/video into the group
        await reply("⏳ Preparing *" + mediaType + "* group story…");

        try {
            const buffer = await downloadMedia(mediaPayload, mediaType);
            if (!buffer || !buffer.length) throw new Error("Empty download");

            let content;

            if (mediaType === "audio") {
                const voice = await convertToVoiceNote(buffer);
                content = {
                    audio: voice,
                    mimetype: "audio/ogg; codecs=opus",
                    ptt: true
                };
            } else if (mediaType === "sticker") {
                try {
                    content = { sticker: buffer };
                    await postGroupStatus(sock, from, content, color);
                    return reply("✅ Sticker group story posted.");
                } catch (e) {
                    console.log("[GCSTATUS] sticker failed, image fallback:", e.message);
                    const img = await stickerToImage(buffer);
                    content = { image: img, caption: caption || "" };
                }
            } else {
                content = {
                    [mediaType]: buffer,
                    caption: caption || ""
                };
            }

            await postGroupStatus(sock, from, content, color);

            // success text only — media never sent as normal group message
            return reply(
                "✅ *" +
                    mediaType.charAt(0).toUpperCase() +
                    mediaType.slice(1) +
                    "* group story posted."
            );
        } catch (err) {
            console.error("[GCSTATUS] " + mediaType + ":", err);
            return reply("❌ Failed: " + (err.message || err));
        }
    }
};
