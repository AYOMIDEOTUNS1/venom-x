/**
 * VENOM X - GROUP STATUS (Clean + Stable)
 * Multi-group | Colors | Owner/Sudo | No Auto-Delete
 */
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { exec } = require("child_process");
const { promisify } = require("util");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const { getSettings } = require("../lib/settingsCache");

const execAsync = promisify(exec);

const CONFIG_PATH = path.join(__dirname, "../data/gcstatus.json");
const GROUPS_CACHE_FILE = path.join(__dirname, "../data/gcstatus_list.json");
const MEMORY_GROUP_CACHE = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;
const COOLDOWN_MS = 8000;
const userCooldown = new Map();

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

function px() {
    try {
        return getSettings().prefix || "#";
    } catch (e) {
        return "#";
    }
}

function tmp(ext) {
    return path.join(
        os.tmpdir(),
        "venom_" + crypto.randomBytes(6).toString("hex") + "." + ext
    );
}

function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return {};
        return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    } catch (e) {
        return {};
    }
}

function saveConfig(cfg) {
    try {
        const dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
    } catch (e) {}
}

function getGroupSettings(groupId) {
    const raw = loadConfig()[groupId];
    if (!raw) return { color: null, audience: "all" };
    if (typeof raw === "string") return { color: raw, audience: "all" };
    return {
        color: raw.color != null ? raw.color : null,
        audience: raw.audience || "all"
    };
}

function setGroupColor(groupId, value) {
    const cfg = loadConfig();
    cfg[groupId] = Object.assign({}, getGroupSettings(groupId), { color: value });
    saveConfig(cfg);
}

function setGroupAudience(groupId, value) {
    const cfg = loadConfig();
    cfg[groupId] = Object.assign({}, getGroupSettings(groupId), {
        audience: value
    });
    saveConfig(cfg);
}

function resolveColor(name) {
    if (!name) return null;
    const lower = String(name).toLowerCase().trim();
    if (COLOR_MAP[lower]) return COLOR_MAP[lower];
    const hex = lower.replace("#", "");
    if (/^[0-9a-f]{6}$/i.test(hex)) return "#" + hex;
    return null;
}

function pickColor(groupId, inlineColor) {
    if (inlineColor && inlineColor !== "random") return inlineColor;
    const saved = getGroupSettings(groupId).color;
    if (!saved || saved === "random" || inlineColor === "random") {
        return (
            "#" +
            Math.floor(Math.random() * 0xffffff)
                .toString(16)
                .padStart(6, "0")
        );
    }
    return resolveColor(saved) || DEFAULT_COLOR;
}

function extractDigits(jid) {
    return String(jid || "").replace(/\D/g, "");
}

function loadGroupsDiskCache() {
    try {
        if (!fs.existsSync(GROUPS_CACHE_FILE)) return {};
        return JSON.parse(fs.readFileSync(GROUPS_CACHE_FILE, "utf8"));
    } catch (e) {
        return {};
    }
}

function saveGroupsDiskCache(data) {
    try {
        const dir = path.dirname(GROUPS_CACHE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(GROUPS_CACHE_FILE, JSON.stringify(data, null, 2));
    } catch (e) {}
}

async function fetchUserGroups(sock, senderId, forceRefresh) {
    const senderKey = extractDigits(senderId) || "default";

    if (!forceRefresh) {
        const cached = MEMORY_GROUP_CACHE.get(senderKey);
        if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.list;

        const disk = loadGroupsDiskCache();
        if (disk[senderKey] && disk[senderKey].length) {
            MEMORY_GROUP_CACHE.set(senderKey, {
                list: disk[senderKey],
                ts: Date.now()
            });
            return disk[senderKey];
        }
    }

    let rawMap = {};
    try {
        if (typeof sock.groupFetchAllParticipating === "function") {
            rawMap = await sock.groupFetchAllParticipating();
        }
    } catch (e) {
        console.log("[GCSTATUS] Failed to fetch groups:", e.message);
    }

    if (!Object.keys(rawMap).length && sock.chats) {
        const entries = Object.entries(sock.chats);
        for (let i = 0; i < entries.length; i++) {
            const jid = entries[i][0];
            const chat = entries[i][1];
            if (String(jid).endsWith("@g.us")) {
                rawMap[jid] = {
                    id: jid,
                    subject: chat.name || chat.subject || jid
                };
            }
        }
    }

    const groups = Object.values(rawMap || {})
        .map(function (g) {
            return {
                jid: g.id,
                name: g.subject || String(g.id).replace("@g.us", "")
            };
        })
        .sort(function (a, b) {
            return a.name.localeCompare(b.name);
        });

    for (let i = 0; i < groups.length; i++) {
        groups[i].index = i + 1;
    }

    if (groups.length) {
        MEMORY_GROUP_CACHE.set(senderKey, { list: groups, ts: Date.now() });
        const disk = loadGroupsDiskCache();
        disk[senderKey] = groups;
        saveGroupsDiskCache(disk);
    }

    return groups;
}

function unwrapMessage(message) {
    let current = message;
    for (let i = 0; i < 6; i++) {
        const wrapper =
            (current && current.viewOnceMessageV2) ||
            (current && current.viewOnceMessage) ||
            (current && current.viewOnceMessageV2Extension) ||
            (current && current.documentWithCaptionMessage) ||
            (current && current.ephemeralMessage);
        if (!wrapper || !wrapper.message) break;
        current = wrapper.message;
    }
    return current;
}

function getMediaType(msg) {
    if (msg && msg.imageMessage) return "image";
    if (msg && msg.videoMessage) return "video";
    if (msg && msg.audioMessage) return "audio";
    if (msg && msg.stickerMessage) return "sticker";
    return null;
}

async function downloadMedia(message, type) {
    const mediaMsg = message[type + "Message"];
    if (!mediaMsg) throw new Error("No " + type + " payload found");
    const stream = await downloadContentFromMessage(mediaMsg, type);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

async function convertToVoice(buffer) {
    const input = tmp("input");
    const output = tmp("ogg");
    try {
        fs.writeFileSync(input, buffer);
        await execAsync(
            'ffmpeg -hide_banner -loglevel error -y -i "' +
                input +
                '" -vn -c:a libopus -b:a 64k -ar 48000 -ac 1 "' +
                output +
                '"'
        );
        return fs.readFileSync(output);
    } finally {
        try {
            fs.unlinkSync(input);
        } catch (e) {}
        try {
            fs.unlinkSync(output);
        } catch (e) {}
    }
}

async function postGroupStatus(sock, jid, content, color, audience) {
    audience = audience || "all";
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

    const payload = Object.assign({}, content, {
        contextInfo: {
            isGroupStatus: true,
            statusSourceType: statusSourceType,
            statusAttributions: [{ type: 10 }],
            statusAudienceMetadata: {
                audienceType: audience === "close" ? "CLOSE_FRIENDS" : "ALL"
            }
        }
    });

    if (content.text) {
        payload.backgroundColor = color || DEFAULT_COLOR;
    }

    return sock.sendMessage(jid, payload);
}

function isSudoUser(sender) {
    try {
        const sudo = require("./sudo");
        if (sudo.isSudoNumber) {
            return sudo.isSudoNumber(sender);
        }
    } catch (e) {}
    return false;
}

module.exports = {
    name: "status2",
    aliases: ["gcstatus", "gstatus", "groupstatus", "gcs"],

    run: async function ({
        sock,
        from,
        message,
        args,
        reply,
        isGroup,
        isOwner,
        sender
    }) {
        const p = px();
        const allowed = isOwner || isSudoUser(sender);
        if (!allowed) {
            return reply("🚫 Owner / Sudo only.");
        }

        const now = Date.now();
        if (userCooldown.has(sender) && now - userCooldown.get(sender) < COOLDOWN_MS) {
            const left = Math.ceil(
                (COOLDOWN_MS - (now - userCooldown.get(sender))) / 1000
            );
            return reply("⏳ Wait *" + left + "s* before using this again.");
        }

        const text = args.join(" ").trim();
        const ctx =
            (message.message &&
                message.message.extendedTextMessage &&
                message.message.extendedTextMessage.contextInfo) ||
            {};
        const quoted = ctx.quotedMessage || null;

        if (!text && !quoted) {
            return reply(
`╭━━〔 📢 GROUP STATUS 〕━━⬣

Text:
${p}gcstatus Hello world
${p}gcstatus 1,3,5 Hello
${p}gcstatus all Announcement

Media: reply to image/video/audio/sticker
${p}gcstatus 1,2
${p}gcstatus all

Colors:
${p}gcstatus --color gold Hello
${p}gcstatus --color random Hello

Settings:
${p}gcstatus list
${p}gcstatus setcolor purple
${p}gcstatus setaudience close

Owner + Sudo only
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        if (text.toLowerCase() === "list") {
            const list = await fetchUserGroups(sock, sender, true);
            if (!list.length) return reply("❌ No groups found.");
            const formatted = list
                .map(function (g) {
                    return "│  *" + g.index + ".* " + g.name;
                })
                .join("\n");
            return reply(
`╭━━〔 📋 YOUR GROUPS 〕━━⬣
│ Total: *${list.length}*
│
${formatted}
│
│ Usage: ${p}gcstatus 1,3,5 text
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        if (text.toLowerCase().indexOf("setcolor") === 0) {
            if (!isGroup) return reply("❌ Use inside a group.");
            const colorName = text.slice(8).trim().toLowerCase();
            if (!colorName) return reply("Example: " + p + "gcstatus setcolor purple");
            if (colorName === "random") {
                setGroupColor(from, "random");
                return reply("✅ Group color set to *random*");
            }
            const resolved = resolveColor(colorName);
            if (!resolved) {
                return reply(
                    "❌ Invalid color.\nAvailable: " + Object.keys(COLOR_MAP).join(", ")
                );
            }
            setGroupColor(from, colorName);
            return reply("✅ Group color saved as *" + colorName + "*");
        }

        if (text.toLowerCase().indexOf("setaudience") === 0) {
            if (!isGroup) return reply("❌ Use inside a group.");
            const val = text.slice(11).trim().toLowerCase();
            if (["all", "close", "closefriends"].indexOf(val) === -1) {
                return reply("Usage: " + p + "gcstatus setaudience all / close");
            }
            setGroupAudience(from, val === "all" ? "all" : "close");
            return reply("✅ Audience set to *" + val + "*");
        }

        let targetSpecs = [];
        let contentText = text;
        let inlineColor = null;

        const colorMatch = contentText.match(/(?:--color|--colour)[= ]+([^\s]+)/i);
        if (colorMatch) {
            const c = colorMatch[1].toLowerCase();
            inlineColor = c === "random" ? "random" : resolveColor(c);
            contentText = contentText.replace(colorMatch[0], "").trim();
        }

        const firstToken = contentText.split(/\s+/)[0] || "";
        if (
            /^(all|\*|(\d+)([,-]\d+)*)$/i.test(firstToken) ||
            firstToken.indexOf("@g.us") !== -1
        ) {
            const targets = firstToken.toLowerCase();
            if (targets === "all" || targets === "*") {
                targetSpecs = [{ type: "all" }];
            } else if (targets.indexOf(",") !== -1) {
                targetSpecs = targets.split(",").map(function (n) {
                    return { type: "index", value: parseInt(n, 10) };
                });
            } else if (targets.indexOf("-") !== -1) {
                const parts = targets.split("-").map(Number);
                const start = Math.min(parts[0], parts[1]);
                const end = Math.max(parts[0], parts[1]);
                for (let i = start; i <= end; i++) {
                    targetSpecs.push({ type: "index", value: i });
                }
            } else if (/^\d+$/.test(targets)) {
                targetSpecs = [{ type: "index", value: parseInt(targets, 10) }];
            } else if (targets.indexOf("@g.us") !== -1) {
                targetSpecs = [{ type: "jid", value: firstToken }];
            }
            contentText = contentText.slice(firstToken.length).trim();
        } else if (isGroup) {
            targetSpecs = [{ type: "jid", value: from }];
        }

        const groups = await fetchUserGroups(sock, sender, false);
        let targetJids = [];

        for (let s = 0; s < targetSpecs.length; s++) {
            const spec = targetSpecs[s];
            if (spec.type === "all") {
                targetJids = groups.map(function (g) {
                    return g.jid;
                });
                break;
            }
            if (spec.type === "jid") targetJids.push(spec.value);
            if (spec.type === "index") {
                const found = groups.find(function (g) {
                    return g.index === spec.value;
                });
                if (found) targetJids.push(found.jid);
            }
        }

        targetJids = Array.from(new Set(targetJids));

        if (!targetJids.length) {
            return reply(
                "❌ No valid groups.\nUse *" + p + "gcstatus list* first."
            );
        }

        let content = {};
        try {
            if (quoted) {
                const mediaPayload = unwrapMessage(quoted);
                const type = getMediaType(mediaPayload);
                if (!type) {
                    return reply("❌ Reply to an image, video, audio or sticker.");
                }
                const buffer = await downloadMedia(mediaPayload, type);
                if (!buffer || !buffer.length) {
                    throw new Error("Failed to download media");
                }
                if (type === "audio") {
                    const voice = await convertToVoice(buffer);
                    content = {
                        audio: voice,
                        mimetype: "audio/ogg; codecs=opus",
                        ptt: true
                    };
                } else if (type === "sticker") {
                    content = { sticker: buffer };
                } else {
                    content = {};
                    content[type] = buffer;
                    content.caption = contentText || "";
                }
            } else {
                if (!contentText) {
                    return reply("❌ Provide text or reply to media.");
                }
                content = { text: contentText };
            }
        } catch (err) {
            console.log("[GCSTATUS] Media Error:", err.message);
            return reply("❌ Failed to process media: " + err.message);
        }

        userCooldown.set(sender, Date.now());
        await reply("🚀 Posting to *" + targetJids.length + "* group(s)...");

        let success = 0;
        let failed = 0;

        for (let i = 0; i < targetJids.length; i++) {
            const jid = targetJids[i];
            try {
                const color = pickColor(jid, inlineColor);
                const audience = getGroupSettings(jid).audience || "all";
                await postGroupStatus(sock, jid, content, color, audience);
                success++;
            } catch (e) {
                console.log("[GCSTATUS] Failed on " + jid + ":", e.message);
                failed++;
            }
            if (targetJids.length > 1) {
                await new Promise(function (r) {
                    setTimeout(r, 800);
                });
            }
        }

        return reply(
            "✅ *Group Status Posted!*\n\n" +
                "• Success: *" +
                success +
                "*\n" +
                "• Failed: *" +
                failed +
                "*\n" +
                "• Total: *" +
                targetJids.length +
                "*"
        );
    }
};
