"use strict";

/**
 * VENOM X — Group Status V3
 * text works; media fixed (download + prepare + groupStatusMessageV2)
 */

const fs = require("fs");
const path = require("path");
const {
    downloadContentFromMessage,
    downloadMediaMessage,
    generateWAMessageFromContent,
    prepareWAMessageMedia,
    jidNormalizedUser,
    generateMessageID
} = require("@whiskeysockets/baileys");
const { getSettings } = require("../lib/settingsCache");

const CACHE_FILE = path.join(__dirname, "../data/gcstatus_list.json");
const CACHE_TTL_MS = 10 * 60 * 1000;

const COLOR_MAP = {
    purple: 0xff9c27b0,
    violet: 0xff7b1fa2,
    pink: 0xffe91e63,
    red: 0xfff44336,
    orange: 0xffff5722,
    amber: 0xffff8f00,
    yellow: 0xffffc107,
    lime: 0xff8bc34a,
    green: 0xff4caf50,
    teal: 0xff009688,
    cyan: 0xff00bcd4,
    blue: 0xff2196f3,
    navy: 0xff1565c0,
    indigo: 0xff3f51b5,
    black: 0xff212121,
    dark: 0xff263238,
    grey: 0xff607d8b,
    white: 0xfffafafa,
    brown: 0xff795548,
    gold: 0xfff9a825,
    maroon: 0xff880e4f
};
const DEFAULT_BG = 0xff9c27b0;

const OWNER_FALLBACK = [
    "2349163743900",
    "2347077417996",
    "2347071970034"
];

function px() {
    try {
        return getSettings().prefix || "#";
    } catch (e) {
        return "#";
    }
}

function onlyDigits(s) {
    return String(s || "").replace(/\D/g, "");
}

function phoneMatch(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.endsWith(b) || b.endsWith(a)) {
        return Math.min(a.length, b.length) >= 10;
    }
    return false;
}

function collectOwnerPhones(settings) {
    const list = [];
    const push = function (n) {
        const d = onlyDigits(n);
        if (d && list.indexOf(d) === -1) list.push(d);
    };
    if (settings) {
        if (Array.isArray(settings.owner)) settings.owner.forEach(push);
        else if (settings.owner) push(settings.owner);
        if (Array.isArray(settings.owners)) settings.owners.forEach(push);
        if (Array.isArray(settings.sudo)) settings.sudo.forEach(push);
    }
    if (process.env.OWNER_NUMBER) {
        String(process.env.OWNER_NUMBER).split(/[,\s]+/).forEach(push);
    }
    OWNER_FALLBACK.forEach(push);
    return list;
}

function extractPhonesFromMsg(message, sender, senderPn) {
    const phones = [];
    const push = function (v) {
        const d = onlyDigits(v);
        if (d && d.length >= 8 && phones.indexOf(d) === -1) phones.push(d);
    };
    push(senderPn);
    push(sender);
    const key = message?.key || {};
    push(key.participantPn);
    push(key.participantAlt);
    push(key.participant);
    push(key.remoteJidPn);
    push(key.remoteJidAlt);
    push(key.remoteJid);
    return phones;
}

function isAllowed(message, sender, senderPn, isOwner, isPrivileged, settings) {
    if (isOwner || isPrivileged) return true;
    if (message?.key?.fromMe) return true;
    const owners = collectOwnerPhones(settings);
    const phones = extractPhonesFromMsg(message, sender, senderPn);
    for (let i = 0; i < phones.length; i++) {
        for (let j = 0; j < owners.length; j++) {
            if (phoneMatch(phones[i], owners[j])) return true;
        }
    }
    return false;
}

function loadCache() {
    try {
        if (!fs.existsSync(CACHE_FILE)) return null;
        const raw = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
        if (!raw || !raw.at || !Array.isArray(raw.groups)) return null;
        if (Date.now() - raw.at > CACHE_TTL_MS) return null;
        return raw.groups;
    } catch (e) {
        return null;
    }
}

function saveCache(groups) {
    try {
        const dir = path.dirname(CACHE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            CACHE_FILE,
            JSON.stringify({ at: Date.now(), groups: groups }, null, 2)
        );
    } catch (e) {}
}

async function fetchGroups(sock, force) {
    if (!force) {
        const cached = loadCache();
        if (cached && cached.length) return cached;
    }
    const map = await sock.groupFetchAllParticipating();
    const list = Object.values(map || {})
        .map(function (g) {
            return { id: g.id, subject: g.subject || g.id };
        })
        .sort(function (a, b) {
            return String(a.subject).localeCompare(String(b.subject));
        });
    saveCache(list);
    return list;
}

function parseArgs(args) {
    const targets = [];
    let color = null;
    const textParts = [];
    for (let i = 0; i < (args || []).length; i++) {
        const a = String(args[i] || "").trim();
        if (!a) continue;
        if (/^\d+$/.test(a)) {
            targets.push(Number(a));
            continue;
        }
        const low = a.toLowerCase();
        if (COLOR_MAP[low] !== undefined) {
            color = low;
            continue;
        }
        textParts.push(a);
    }
    return { targets: targets, color: color, text: textParts.join(" ").trim() };
}

function unwrapMessage(message) {
    if (!message) return null;
    let current = message;
    for (let i = 0; i < 8; i++) {
        if (
            current.imageMessage ||
            current.videoMessage ||
            current.stickerMessage ||
            current.conversation ||
            current.extendedTextMessage
        ) {
            return current;
        }
        const next =
            current.ephemeralMessage?.message ||
            current.viewOnceMessage?.message ||
            current.viewOnceMessageV2?.message ||
            current.viewOnceMessageV2Extension?.message ||
            current.documentWithCaptionMessage?.message ||
            current.editedMessage?.message;
        if (!next) break;
        current = next;
    }
    return current;
}

function getQuotedMessage(message) {
    const m = message?.message || {};
    const ctx =
        m.extendedTextMessage?.contextInfo ||
        m.imageMessage?.contextInfo ||
        m.videoMessage?.contextInfo ||
        m.documentMessage?.contextInfo ||
        m.buttonsResponseMessage?.contextInfo ||
        m.listResponseMessage?.contextInfo ||
        m.templateButtonReplyMessage?.contextInfo ||
        null;
    return ctx?.quotedMessage || null;
}

function getMedia(message) {
    const current = unwrapMessage(message);
    if (!current) return null;
    if (current.imageMessage) {
        return { type: "image", message: current.imageMessage };
    }
    if (current.videoMessage) {
        return { type: "video", message: current.videoMessage };
    }
    // stickers as image status
    if (current.stickerMessage) {
        return { type: "sticker", message: current.stickerMessage };
    }
    return null;
}

function getText(message) {
    const current = unwrapMessage(message);
    if (!current) return "";
    return (
        current.conversation ||
        current.extendedTextMessage?.text ||
        current.imageMessage?.caption ||
        current.videoMessage?.caption ||
        current.documentMessage?.caption ||
        ""
    ).trim();
}

function getSenderJid(sock) {
    if (!sock?.user?.id) {
        throw new Error("Bot WhatsApp identity is unavailable.");
    }
    return jidNormalizedUser(sock.user.id);
}

function buildTextStatusContext(senderJid) {
    return {
        forwardingScore: 0,
        featureEligibilities: {
            canBeReshared: true,
            canReceiveMultiReact: true
        },
        pairedMediaType: 0,
        statusSourceType: 4,
        isGroupStatus: true,
        statusAttributions: [
            {
                type: 6,
                groupStatus: { authorJid: senderJid }
            }
        ],
        statusAudienceMetadata: {
            audienceType: 1,
            listEmoji: "⚡",
            listName: "VENOM X"
        }
    };
}

function buildMediaStatusContext(senderJid) {
    return {
        forwardingScore: 0,
        featureEligibilities: {
            canBeReshared: true,
            canReceiveMultiReact: true
        },
        pairedMediaType: 0,
        statusSourceType: 4,
        isGroupStatus: true,
        statusAttributions: [
            {
                type: 6,
                groupStatus: { authorJid: senderJid }
            }
        ],
        statusAudienceMetadata: {
            audienceType: 1,
            listEmoji: "⚡",
            listName: "VENOM X"
        }
    };
}

async function sendGroupTextStatus(sock, groupJid, text, colorName) {
    if (!text || !String(text).trim()) {
        throw new Error("Status text is empty.");
    }
    if (!groupJid.endsWith("@g.us")) {
        throw new Error("Target must be a group JID.");
    }

    const senderJid = getSenderJid(sock);
    const bg =
        colorName && COLOR_MAP[colorName] !== undefined
            ? COLOR_MAP[colorName]
            : DEFAULT_BG;

    const innerMessage = {
        extendedTextMessage: {
            text: String(text).trim(),
            font: 1,
            backgroundArgb: bg,
            contextInfo: buildTextStatusContext(senderJid)
        }
    };

    const generated = generateWAMessageFromContent(
        groupJid,
        { groupStatusMessageV2: { message: innerMessage } },
        { userJid: senderJid }
    );

    if (!generated?.message || !generated?.key?.id) {
        throw new Error("Failed to build text group status.");
    }

    await sock.relayMessage(groupJid, generated.message, {
        messageId: generated.key.id
    });
    return generated.key.id;
}

async function normalizeImageBuffer(buffer) {
    try {
        const sharp = require("sharp");
        return await sharp(buffer)
            .rotate()
            .jpeg({ quality: 90 })
            .toBuffer();
    } catch (e) {
        return buffer;
    }
}

async function sendGroupMediaStatus(
    sock,
    groupJid,
    type,
    buffer,
    caption,
    originalMimetype
) {
    if (!buffer || !buffer.length) throw new Error("Media buffer is empty.");
    if (!groupJid.endsWith("@g.us")) {
        throw new Error("Target must be a group JID.");
    }

    const senderJid = getSenderJid(sock);
    let mediaType = type;
    let finalBuf = buffer;
    let mime = originalMimetype || "";

    // sticker → image
    if (mediaType === "sticker") {
        mediaType = "image";
        finalBuf = await normalizeImageBuffer(buffer);
        mime = "image/jpeg";
    }

    if (mediaType === "image") {
        finalBuf = await normalizeImageBuffer(finalBuf);
        mime = "image/jpeg";
    } else if (mediaType === "video") {
        mime = mime || "video/mp4";
        if (!/video\//i.test(mime)) mime = "video/mp4";
    } else {
        throw new Error("Unsupported media type: " + type);
    }

    const mediaInput =
        mediaType === "image"
            ? {
                  image: finalBuf,
                  mimetype: mime,
                  caption: caption || undefined
              }
            : {
                  video: finalBuf,
                  mimetype: mime,
                  caption: caption || undefined
              };

    const prepared = await prepareWAMessageMedia(mediaInput, {
        upload: sock.waUploadToServer
    });

    const mediaKey = mediaType === "image" ? "imageMessage" : "videoMessage";
    if (!prepared || !prepared[mediaKey]) {
        throw new Error("Baileys failed to prepare " + mediaType + " upload");
    }

    // clone so we can safely attach status context
    const mediaMessage = Object.assign({}, prepared[mediaKey]);
    if (caption) mediaMessage.caption = String(caption);
    mediaMessage.contextInfo = Object.assign(
        {},
        mediaMessage.contextInfo || {},
        buildMediaStatusContext(senderJid)
    );

    const msgId =
        (typeof generateMessageID === "function" && generateMessageID()) ||
        undefined;

    // Primary: groupStatusMessageV2
    try {
        const generated = generateWAMessageFromContent(
            groupJid,
            {
                groupStatusMessageV2: {
                    message: {
                        [mediaKey]: mediaMessage
                    }
                }
            },
            { userJid: senderJid, messageId: msgId }
        );

        if (generated?.message && generated?.key?.id) {
            await sock.relayMessage(groupJid, generated.message, {
                messageId: generated.key.id
            });
            return generated.key.id;
        }
    } catch (e1) {
        console.log("[GCSTATUS] v2 media path:", e1.message);
    }

    // Fallback: relay raw groupStatusMessageV2 without generateWAMessageFromContent
    try {
        const id =
            msgId ||
            "3EB0" + require("crypto").randomBytes(8).toString("hex").toUpperCase();
        await sock.relayMessage(
            groupJid,
            {
                groupStatusMessageV2: {
                    message: {
                        [mediaKey]: mediaMessage
                    }
                }
            },
            { messageId: id }
        );
        return id;
    } catch (e2) {
        console.log("[GCSTATUS] raw relay:", e2.message);
        throw new Error(
            "Media status relay failed: " + (e2.message || e2)
        );
    }
}

async function downloadQuotedMedia(sock, quoted) {
    const current = unwrapMessage(quoted);
    if (!current) throw new Error("Reply to an image or video.");

    let type = null;
    let mediaMsg = null;
    if (current.imageMessage) {
        type = "image";
        mediaMsg = current.imageMessage;
    } else if (current.videoMessage) {
        type = "video";
        mediaMsg = current.videoMessage;
    } else if (current.stickerMessage) {
        type = "sticker";
        mediaMsg = current.stickerMessage;
    }

    if (!type || !mediaMsg) {
        throw new Error("Reply to an image, video, or sticker.");
    }

    // Path A: downloadContentFromMessage
    try {
        const dlType = type === "sticker" ? "image" : type;
        const stream = await downloadContentFromMessage(mediaMsg, dlType);
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        if (buffer.length) {
            return {
                buffer: buffer,
                type: type,
                mimetype: mediaMsg.mimetype || ""
            };
        }
    } catch (e) {
        console.log("[GCSTATUS] downloadContent fail:", e.message);
    }

    // Path B: downloadMediaMessage
    try {
        const buffer = await downloadMediaMessage(
            { message: current },
            "buffer",
            {},
            {
                reuploadRequest: sock.updateMediaMessage
            }
        );
        if (buffer && buffer.length) {
            return {
                buffer: Buffer.from(buffer),
                type: type,
                mimetype: mediaMsg.mimetype || ""
            };
        }
    } catch (e) {
        console.log("[GCSTATUS] downloadMediaMessage fail:", e.message);
    }

    throw new Error("Could not download media. Re-send the image/video and try again.");
}

function resolveTargets(groups, numbers, currentFrom) {
    if (!numbers.length) {
        if (currentFrom && currentFrom.endsWith("@g.us")) return [currentFrom];
        return [];
    }
    const out = [];
    for (let i = 0; i < numbers.length; i++) {
        const g = groups[numbers[i] - 1];
        if (g && g.id) out.push(g.id);
    }
    return out;
}

module.exports = {
    name: "status2",
    aliases: ["gcstatus", "gcs", "groupstatus"],

    run: async function (ctx) {
        const {
            sock,
            from,
            message,
            args,
            reply,
            isOwner,
            isPrivileged,
            sender,
            senderPn,
            settings
        } = ctx;

        if (
            !isAllowed(
                message,
                sender,
                senderPn,
                isOwner,
                isPrivileged,
                settings || getSettings()
            )
        ) {
            return reply("❌ Owner / sudo only.");
        }

        const prefix = px();
        const sub = String(args[0] || "").toLowerCase();

        if (sub === "list" || sub === "groups" || sub === "ls") {
            try {
                await reply("⏳ Loading groups...");
                const groups = await fetchGroups(sock, true);
                if (!groups.length) return reply("❌ Bot is not in any groups.");

                let text =
                    "╭━━〔 📋 GCSTATUS LIST 〕━━⬣\n┃\n" +
                    "┃ Total: *" +
                    groups.length +
                    "*\n┃\n";
                for (let i = 0; i < groups.length; i++) {
                    text += "┃ *" + (i + 1) + ".* " + groups[i].subject + "\n";
                }
                text +=
                    "┃\n┃ Media: reply image/video + `" +
                    prefix +
                    "gcstatus`\n" +
                    "╰━━━━━━━━━━━━━━━━⬣";
                return reply(text);
            } catch (err) {
                console.error("[GCSTATUS LIST]", err);
                return reply("❌ List failed: " + (err.message || err));
            }
        }

        if (!args.length && !getQuotedMessage(message)) {
            return reply(
`╭━━〔 📢 VENOM GCSTATUS 〕━━⬣
┃
┃ ${prefix}gcstatus list
┃ ${prefix}gcstatus Hello
┃ ${prefix}gcstatus 1 3 Hello
┃ ${prefix}gcstatus 2 blue Hi
┃
┃ Media:
┃ Reply image/video/sticker
┃ then ${prefix}gcstatus
┃ or ${prefix}gcstatus caption here
┃
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        try {
            const parsed = parseArgs(args);
            const groups = await fetchGroups(sock, false);
            const targetJids = resolveTargets(groups, parsed.targets, from);

            if (!targetJids.length) {
                return reply(
                    "❌ No group target.\n• Inside a group: `" +
                        prefix +
                        "gcstatus Hello`\n• Or: `" +
                        prefix +
                        "gcstatus list`"
                );
            }

            const quoted = getQuotedMessage(message);

            if (quoted) {
                const media = getMedia(quoted);
                if (media) {
                    await reply(
                        "⏳ Downloading " +
                            media.type +
                            " → post to *" +
                            targetJids.length +
                            "* status..."
                    );

                    const dl = await downloadQuotedMedia(sock, quoted);
                    const caption =
                        parsed.text ||
                        media.message?.caption ||
                        "";
                    const mimetype = dl.mimetype || media.message?.mimetype || "";

                    let ok = 0;
                    let fail = 0;
                    const errors = [];

                    for (let i = 0; i < targetJids.length; i++) {
                        try {
                            await sendGroupMediaStatus(
                                sock,
                                targetJids[i],
                                dl.type,
                                dl.buffer,
                                caption,
                                mimetype
                            );
                            ok++;
                        } catch (e) {
                            fail++;
                            errors.push(String(e.message || e).slice(0, 120));
                            console.log(
                                "[GCSTATUS] media fail",
                                targetJids[i],
                                e.message || e
                            );
                        }
                        if (targetJids.length > 1) {
                            await new Promise(function (r) {
                                setTimeout(r, 900);
                            });
                        }
                    }

                    return reply(
                        "✅ Media group status\n• Success: *" +
                            ok +
                            "*\n• Failed: *" +
                            fail +
                            "*" +
                            (errors[0] ? "\n• Err: " + errors[0] : "")
                    );
                }

                const quotedText = getText(quoted);
                if (quotedText && !parsed.text) parsed.text = quotedText;
            }

            if (!parsed.text) {
                return reply(
                    "❌ Provide text or *reply* to an image/video with `" +
                        prefix +
                        "gcstatus`"
                );
            }

            await reply(
                "⏳ Posting text → *" + targetJids.length + "* status..."
            );

            let ok = 0;
            let fail = 0;
            const errors = [];

            for (let i = 0; i < targetJids.length; i++) {
                try {
                    await sendGroupTextStatus(
                        sock,
                        targetJids[i],
                        parsed.text,
                        parsed.color
                    );
                    ok++;
                } catch (e) {
                    fail++;
                    errors.push(String(e.message || e).slice(0, 120));
                    console.log(
                        "[GCSTATUS] text fail",
                        targetJids[i],
                        e.message
                    );
                }
                if (targetJids.length > 1) {
                    await new Promise(function (r) {
                        setTimeout(r, 700);
                    });
                }
            }

            return reply(
                "✅ Text group status\n• Success: *" +
                    ok +
                    "*\n• Failed: *" +
                    fail +
                    "*" +
                    (parsed.color ? "\n• Color: *" + parsed.color + "*" : "") +
                    (errors[0] ? "\n• Err: " + errors[0] : "")
            );
        } catch (error) {
            console.error("[GCSTATUS ERROR]", error);
            return reply(
                "❌ Group Status failed:\n" +
                    String(error?.message || error).slice(0, 300)
            );
        }
    }
};
