"use strict";

/**
 * VENOM X — Group Status V2
 * list | multi-group | text/image/video
 * Posts to Group Status only (not chat media spam)
 */

const fs = require("fs");
const path = require("path");
const {
    downloadMediaMessage,
    generateWAMessageFromContent,
    prepareWAMessageMedia,
    jidNormalizedUser
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

function px() {
    try {
        return getSettings().prefix || "#";
    } catch (e) {
        return "#";
    }
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
            return {
                id: g.id,
                subject: g.subject || g.id
            };
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

    return {
        targets: targets,
        color: color,
        text: textParts.join(" ").trim()
    };
}

function unwrapMessage(message) {
    if (!message) return null;
    let current = message;
    for (let i = 0; i < 6; i++) {
        const next =
            current.ephemeralMessage?.message ||
            current.viewOnceMessage?.message ||
            current.viewOnceMessageV2?.message ||
            current.viewOnceMessageV2Extension?.message ||
            current.documentWithCaptionMessage?.message;
        if (!next) break;
        current = next;
    }
    return current;
}

function getQuotedContext(message) {
    const m = message?.message || {};
    return (
        m.extendedTextMessage?.contextInfo ||
        m.imageMessage?.contextInfo ||
        m.videoMessage?.contextInfo ||
        m.documentMessage?.contextInfo ||
        {}
    );
}

function getQuotedMessage(message) {
    return getQuotedContext(message)?.quotedMessage || null;
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
                groupStatus: {
                    authorJid: senderJid
                }
            }
        ],
        statusAudienceMetadata: {
            audienceType: 1,
            listEmoji: "⚡",
            listName: "VENOM X"
        }
    };
}

function buildMediaStatusContext() {
    return {
        forwardingScore: 0,
        featureEligibilities: {
            canBeReshared: true,
            canReceiveMultiReact: true
        },
        pairedMediaType: 0,
        statusSourceType: 4,
        isGroupStatus: true,
        statusAttributions: [{ type: 10 }],
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

    const senderJid = getSenderJid(sock);
    const bg =
        (colorName && COLOR_MAP[colorName]) !== undefined
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
        {
            groupStatusMessageV2: {
                message: innerMessage
            }
        },
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

async function sendGroupMediaStatus(
    sock,
    groupJid,
    type,
    buffer,
    caption,
    originalMimetype
) {
    if (!buffer || !buffer.length) {
        throw new Error("Media buffer is empty.");
    }
    if (type !== "image" && type !== "video") {
        throw new Error("Unsupported media type: " + type);
    }

    const senderJid = getSenderJid(sock);
    const mime =
        originalMimetype ||
        (type === "image" ? "image/jpeg" : "video/mp4");

    const mediaInput =
        type === "image"
            ? { image: buffer, mimetype: mime, caption: caption || undefined }
            : { video: buffer, mimetype: mime, caption: caption || undefined };

    const prepared = await prepareWAMessageMedia(mediaInput, {
        upload: sock.waUploadToServer
    });

    const mediaKey = type === "image" ? "imageMessage" : "videoMessage";
    const mediaMessage = prepared?.[mediaKey];
    if (!mediaMessage) {
        throw new Error("Baileys failed to prepare " + type);
    }

    mediaMessage.contextInfo = {
        ...(mediaMessage.contextInfo || {}),
        ...buildMediaStatusContext()
    };

    let generated = generateWAMessageFromContent(
        groupJid,
        {
            groupStatusMessageV2: {
                message: {
                    [mediaKey]: mediaMessage
                }
            }
        },
        { userJid: senderJid }
    );

    if (!generated?.message || !generated?.key?.id) {
        generated = generateWAMessageFromContent(
            groupJid,
            { [mediaKey]: mediaMessage },
            { userJid: senderJid }
        );
    }

    if (!generated?.message || !generated?.key?.id) {
        throw new Error("Failed to build " + type + " group status.");
    }

    await sock.relayMessage(groupJid, generated.message, {
        messageId: generated.key.id
    });

    return generated.key.id;
}

async function downloadQuotedMedia(message, from, quoted) {
    const contextInfo = getQuotedContext(message);
    if (!contextInfo?.stanzaId) {
        throw new Error("Could not identify the replied message.");
    }

    const quotedKey = {
        remoteJid: from,
        id: contextInfo.stanzaId,
        participant: contextInfo.participant,
        fromMe: false
    };

    const buffer = await downloadMediaMessage(
        { key: quotedKey, message: quoted },
        "buffer",
        {},
        {}
    );

    if (!buffer || !buffer.length) {
        throw new Error("Downloaded media is empty.");
    }
    return buffer;
}

function resolveTargets(groups, numbers, currentFrom) {
    if (!numbers.length) {
        return currentFrom && currentFrom.endsWith("@g.us")
            ? [currentFrom]
            : [];
    }
    const out = [];
    for (let i = 0; i < numbers.length; i++) {
        const n = numbers[i];
        const g = groups[n - 1];
        if (g && g.id) out.push(g.id);
    }
    return out;
}

module.exports = {
    name: "status2",
    aliases: ["gcstatus", "gcs", "groupstatus"],

    run: async function ({
        sock,
        from,
        message,
        args,
        reply,
        isOwner,
        isPrivileged
    }) {
        if (!isOwner && !isPrivileged) {
            return reply("❌ Owner / sudo only.");
        }

        const prefix = px();
        const sub = String(args[0] || "").toLowerCase();

        // ── LIST ──────────────────────────────────────────
        if (sub === "list" || sub === "groups" || sub === "ls") {
            try {
                await reply("⏳ Loading groups...");
                const groups = await fetchGroups(sock, true);
                if (!groups.length) {
                    return reply("❌ Bot is not in any groups.");
                }

                let text =
                    "╭━━〔 📋 GCSTATUS LIST 〕━━⬣\n┃\n" +
                    "┃ Total: *" +
                    groups.length +
                    "*\n┃\n";

                for (let i = 0; i < groups.length; i++) {
                    text +=
                        "┃ *" +
                        (i + 1) +
                        ".* " +
                        groups[i].subject +
                        "\n";
                }

                text +=
                    "┃\n┃ Use numbers:\n┃ " +
                    prefix +
                    "gcstatus 1 3 hello\n┃ " +
                    prefix +
                    "gcstatus 2 blue hi\n" +
                    "╰━━━━━━━━━━━━━━━━⬣";

                return reply(text);
            } catch (err) {
                console.error("[GCSTATUS LIST]", err);
                return reply("❌ List failed: " + (err.message || err));
            }
        }

        // ── HELP ──────────────────────────────────────────
        if (!args.length && !getQuotedMessage(message)) {
            return reply(
`╭━━〔 📢 VENOM GCSTATUS 〕━━⬣
┃
┃ 📋 List groups:
┃ ${prefix}gcstatus list
┃
┃ 📝 This group:
┃ ${prefix}gcstatus Hello
┃
┃ 📝 Multi-group:
┃ ${prefix}gcstatus 1 3 Hello
┃
┃ 🎨 Color (text):
┃ ${prefix}gcstatus 2 blue Hello
┃
┃ 🖼️ Media:
┃ Reply image/video + ${prefix}gcstatus
┃ Reply + ${prefix}gcstatus 1 4 caption
┃
┃ Colors: purple pink red blue green
┃ gold cyan black white ...
┃
┃ Posts to *Group Status* only
┃
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        try {
            const parsed = parseArgs(args);
            const groups = await fetchGroups(sock, false);
            const targetJids = resolveTargets(
                groups,
                parsed.targets,
                from
            );

            if (!targetJids.length) {
                return reply(
                    "❌ No valid target groups.\nUse `" +
                        prefix +
                        "gcstatus list` first."
                );
            }

            // need to be in a group OR targeting by numbers
            if (
                parsed.targets.length === 0 &&
                (!from || !from.endsWith("@g.us"))
            ) {
                return reply(
                    "❌ Use inside a group, or pick numbers from `" +
                        prefix +
                        "gcstatus list`."
                );
            }

            const quoted = getQuotedMessage(message);

            // ── MEDIA ─────────────────────────────────────
            if (quoted) {
                const media = getMedia(quoted);
                if (media) {
                    await reply(
                        "⏳ Posting " +
                            media.type +
                            " to *" +
                            targetJids.length +
                            "* group status..."
                    );

                    const buffer = await downloadQuotedMedia(
                        message,
                        from,
                        quoted
                    );
                    const caption =
                        parsed.text ||
                        media.message?.caption ||
                        "";
                    const mimetype =
                        media.message?.mimetype ||
                        (media.type === "image"
                            ? "image/jpeg"
                            : "video/mp4");

                    let ok = 0;
                    let fail = 0;

                    for (let i = 0; i < targetJids.length; i++) {
                        try {
                            await sendGroupMediaStatus(
                                sock,
                                targetJids[i],
                                media.type,
                                buffer,
                                caption,
                                mimetype
                            );
                            ok++;
                        } catch (e) {
                            console.log(
                                "[GCSTATUS] media fail",
                                targetJids[i],
                                e.message
                            );
                            fail++;
                        }
                        if (targetJids.length > 1) {
                            await new Promise(function (r) {
                                setTimeout(r, 700);
                            });
                        }
                    }

                    return reply(
                        "✅ " +
                            (media.type === "image" ? "Image" : "Video") +
                            " group status\n" +
                            "• Success: *" +
                            ok +
                            "*\n" +
                            "• Failed: *" +
                            fail +
                            "*"
                    );
                }

                // quoted text only
                const quotedText = getText(quoted);
                if (quotedText && !parsed.text) {
                    parsed.text = quotedText;
                }
            }

            // ── TEXT ──────────────────────────────────────
            if (!parsed.text) {
                return reply(
                    "❌ Provide text or reply to image/video.\n" +
                        prefix +
                        "gcstatus help"
                );
            }

            await reply(
                "⏳ Posting text to *" +
                    targetJids.length +
                    "* group status..."
            );

            let ok = 0;
            let fail = 0;

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
                    console.log(
                        "[GCSTATUS] text fail",
                        targetJids[i],
                        e.message
                    );
                    fail++;
                }
                if (targetJids.length > 1) {
                    await new Promise(function (r) {
                        setTimeout(r, 700);
                    });
                }
            }

            return reply(
                "✅ Text group status\n" +
                    "• Success: *" +
                    ok +
                    "*\n" +
                    "• Failed: *" +
                    fail +
                    "*" +
                    (parsed.color ? "\n• Color: *" + parsed.color + "*" : "")
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
