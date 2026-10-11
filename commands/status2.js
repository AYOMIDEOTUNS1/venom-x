/**
 * VENOM X - Group Status (upgraded)
 * Core: DevAfeez | List/colors/multi: DaraTech-style
 * #gcstatus list | #gcstatus [text] [color] | reply media + #gcstatus
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

const GROUPS_CACHE_FILE = path.join(__dirname, "../data/gcstatus_list.json");
const CACHE_TTL_MS = 10 * 60 * 1000;

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

function loadGroupCache() {
    try {
        if (!fs.existsSync(GROUPS_CACHE_FILE)) return null;
        const data = JSON.parse(fs.readFileSync(GROUPS_CACHE_FILE, "utf8"));
        if (!data || !data.ts || !Array.isArray(data.groups)) return null;
        if (Date.now() - data.ts > CACHE_TTL_MS) return null;
        return data.groups;
    } catch (e) {
        return null;
    }
}

function saveGroupCache(groups) {
    try {
        const dir = path.dirname(GROUPS_CACHE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            GROUPS_CACHE_FILE,
            JSON.stringify({ ts: Date.now(), groups: groups }, null, 2)
        );
    } catch (e) {}
}

async function fetchGroups(sock) {
    let cached = loadGroupCache();
    if (cached && cached.length) return cached;

    const map = await sock.groupFetchAllParticipating();
    const groups = Object.values(map || {})
        .map(function (g) {
            return {
                id: g.id,
                subject: g.subject || g.id
            };
        })
        .sort(function (a, b) {
            return String(a.subject).localeCompare(String(b.subject));
        });

    saveGroupCache(groups);
    return groups;
}

function parseArgs(args) {
    let color = DEFAULT_COLOR;
    const targets = []; // 1-based indexes or jids
    const rest = [];

    (args || []).forEach(function (a) {
        const s = String(a || "");
        const low = s.toLowerCase();
        if (COLOR_MAP[low]) {
            color = COLOR_MAP[low];
            return;
        }
        if (/^\d+$/.test(s)) {
            targets.push(parseInt(s, 10));
            return;
        }
        if (s.endsWith("@g.us")) {
            targets.push(s);
            return;
        }
        rest.push(s);
    });

    return {
        color: color,
        targets: targets,
        caption: rest.join(" ").trim()
    };
}

async function postGroupStatus(sock, jid, content, backgroundColor) {
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

    const body = { ...content };
    if (body.text) body.backgroundColor = backgroundColor || DEFAULT_COLOR;

    return sock.sendMessage(jid, {
        ...body,
        contextInfo: {
            isGroupStatus: true,
            statusSourceType: statusSourceType,
            statusAttributions: [{ type: 10 }],
            statusAudienceMetadata: { audienceType: "ALL" }
        }
    });
}

function helpText() {
    return (
`╭━━〔 📢 VENOM X GC STATUS 〕━━⬣

*List groups*
#gcstatus list

*Text story (this group)*
#gcstatus Hello purple

*Text to group # from list*
#gcstatus 1 Hello
#gcstatus 1 3 Hello gold

*Media*
Reply image/video/audio/sticker:
#gcstatus [caption] [color]
#gcstatus 1 2 [caption] blue

Colors: purple pink red blue green gold black …

╰━━━━━━━━━━━━━━━━⬣`
    );
}

module.exports = {
    name: "status2",
    aliases: ["gcstatus", "gstatus", "groupstatus"],

    run: async function ({ sock, from, message, args, reply }) {
        const sub = String((args && args[0]) || "").toLowerCase();

        // ── LIST ──────────────────────────────────────────
        if (sub === "list" || sub === "groups" || sub === "ls") {
            try {
                await reply("⏳ Loading groups…");
                const groups = await fetchGroups(sock);
                if (!groups.length) {
                    return reply("❌ No groups found.");
                }

                let text =
                    "╭━━〔 📋 GC STATUS GROUPS 〕━━⬣\n┃\n";
                groups.forEach(function (g, i) {
                    const name = String(g.subject || g.id).slice(0, 40);
                    text += "┃ *" + (i + 1) + "* · " + name + "\n";
                });
                text +=
                    "┃\n┃ Use number with #gcstatus\n┃ Example: #gcstatus 1 Hello\n╰━━━━━━━━━━━━━━━━⬣";

                return reply(text);
            } catch (err) {
                console.error("[GCSTATUS] list:", err);
                return reply("❌ List failed: " + (err.message || err));
            }
        }

        if (!args || !args.length) {
            // allow media reply with no args
            const ctx0 =
                message.message?.extendedTextMessage?.contextInfo || {};
            if (!ctx0.quotedMessage) return reply(helpText());
        }

        const parsed = parseArgs(args);
        const caption = parsed.caption;
        const color = parsed.color;

        // resolve target groups
        let targetJids = [];
        if (parsed.targets.length) {
            const groups = await fetchGroups(sock);
            for (let t = 0; t < parsed.targets.length; t++) {
                const item = parsed.targets[t];
                if (typeof item === "string" && item.endsWith("@g.us")) {
                    targetJids.push(item);
                } else if (typeof item === "number") {
                    const g = groups[item - 1];
                    if (g && g.id) targetJids.push(g.id);
                }
            }
            targetJids = targetJids.filter(function (v, i, a) {
                return a.indexOf(v) === i;
            });
            if (!targetJids.length) {
                return reply(
                    "❌ Invalid group number. Use *#gcstatus list* first."
                );
            }
        } else {
            if (!from.endsWith("@g.us")) {
                return reply(
                    "❌ Use in a group, or pick targets:\n#gcstatus list\n#gcstatus 1 Hello"
                );
            }
            targetJids = [from];
        }

        const ctx =
            message.message?.extendedTextMessage?.contextInfo ||
            message.message?.imageMessage?.contextInfo ||
            message.message?.videoMessage?.contextInfo ||
            {};
        const quotedMessage = ctx.quotedMessage || null;

        // build content once
        let content = null;

        if (!quotedMessage) {
            if (!caption) return reply(helpText());
            content = { text: caption };
        } else {
            const mediaPayload = unwrapQuotedMessage(quotedMessage);
            const mediaType = detectMediaType(mediaPayload);
            if (!mediaType) {
                return reply("❌ Reply to image, video, audio, or sticker.");
            }

            await reply("⏳ Preparing *" + mediaType + "*…");

            const buffer = await downloadMedia(mediaPayload, mediaType);
            if (!buffer || !buffer.length) throw new Error("Empty download");

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
                    // test path — actual post below
                } catch (e) {
                    content = {
                        image: await stickerToImage(buffer),
                        caption: caption || ""
                    };
                }
            } else {
                content = {
                    [mediaType]: buffer,
                    caption: caption || ""
                };
            }
        }

        await reply(
            "🚀 Posting to *" + targetJids.length + "* group(s)…"
        );

        let ok = 0;
        let fail = 0;

        for (let i = 0; i < targetJids.length; i++) {
            const jid = targetJids[i];
            try {
                if (
                    content.sticker &&
                    !content.image &&
                    !content.video &&
                    !content.audio &&
                    !content.text
                ) {
                    try {
                        await postGroupStatus(sock, jid, content, color);
                    } catch (e1) {
                        const img = await stickerToImage(content.sticker);
                        await postGroupStatus(
                            sock,
                            jid,
                            { image: img, caption: caption || "" },
                            color
                        );
                    }
                } else {
                    await postGroupStatus(sock, jid, content, color);
                }
                ok++;
            } catch (e) {
                console.log("[GCSTATUS] fail", jid, e.message);
                fail++;
            }
            if (targetJids.length > 1) {
                await new Promise(function (r) {
                    setTimeout(r, 700);
                });
            }
        }

        return reply(
`╭━━〔 ✅ GC STATUS 〕━━⬣
┃ Success : *${ok}*
┃ Failed  : *${fail}*
┃ Total   : *${targetJids.length}*
╰━━━━━━━━━━━━━━━━⬣`
        );
    }
};
