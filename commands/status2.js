/**
 * VENOM X - Group Status (Baileys 7)
 * #gcstatus / #status2
 * Multi-group | colors | media | text
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const { getSettings } = require("../lib/settingsCache");

const CONFIG_PATH = path.join(__dirname, "../data/gcstatus.json");
const GROUPS_CACHE_FILE = path.join(__dirname, "../data/gcstatus_list.json");
const MEMORY_GROUP_CACHE = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_COLOR = "#9C27B0";

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

function px() {
    try {
        return getSettings().prefix || "#";
    } catch (e) {
        return "#";
    }
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
    if (!raw) return { color: null };
    if (typeof raw === "string") return { color: raw };
    return { color: raw.color || null };
}

function resolveColor(name) {
    const lower = String(name || "").toLowerCase().trim();
    if (COLOR_MAP[lower]) return COLOR_MAP[lower];
    const hex = lower.replace("#", "");
    if (/^[0-9a-f]{6}$/i.test(hex)) return "#" + hex;
    return null;
}

function pickColor(groupId, inlineColor) {
    if (inlineColor) return inlineColor;
    const saved = getGroupSettings(groupId).color;
    if (!saved || saved === "random") {
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
    return String(jid || "")
        .split("@")[0]
        .replace(/\D/g, "");
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

async function fetchUserGroups(sock) {
    const cacheKey = "bot";
    const cached = MEMORY_GROUP_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        return cached.list;
    }

    let rawMap = {};
    try {
        if (typeof sock.groupFetchAllParticipating === "function") {
            rawMap = await sock.groupFetchAllParticipating();
        }
    } catch (e) {
        console.log("[gcstatus] fetch groups:", e.message);
    }

    const list = Object.values(rawMap || {})
        .map(function (g, idx) {
            return {
                index: idx + 1,
                jid: g.id,
                name: g.subject || g.id
            };
        })
        .sort(function (a, b) {
            return String(a.name).localeCompare(String(b.name));
        })
        .map(function (g, idx) {
            return { index: idx + 1, jid: g.jid, name: g.name };
        });

    MEMORY_GROUP_CACHE.set(cacheKey, { list: list, ts: Date.now() });
    try {
        const dir = path.dirname(GROUPS_CACHE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(GROUPS_CACHE_FILE, JSON.stringify(list, null, 2));
    } catch (e) {}

    return list;
}

async function postGroupStatus(sock, groupJid, content, bgColor) {
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

    await sock.sendMessage("status@broadcast", content, {
        backgroundColor: bgColor || DEFAULT_COLOR,
        font: 0,
        statusJidList: statusJidList,
        broadcast: true
    });
}

function parseArgs(args) {
    const raw = (args || []).join(" ").trim();
    let color = null;
    let text = raw;

    const colorMatch = text.match(/(?:^|\s)(?:--?color)(?:=|\s+)([^\s]+)/i);
    if (colorMatch) {
        color = resolveColor(colorMatch[1]);
        text = text.replace(colorMatch[0], " ").trim();
    }

    // leading "all" or "1,2,3" or "1-3"
    let targets = null;
    const first = text.split(/\s+/)[0] || "";
    if (/^(all|\*)$/i.test(first)) {
        targets = [{ type: "all" }];
        text = text.slice(first.length).trim();
    } else if (/^[\d,\-\s]+$/.test(first) && /\d/.test(first)) {
        targets = [];
        first.split(",").forEach(function (part) {
            part = part.trim();
            const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
            if (range) {
                let a = parseInt(range[1], 10);
                let b = parseInt(range[2], 10);
                if (a > b) {
                    const t = a;
                    a = b;
                    b = t;
                }
                for (let i = a; i <= b && i - a < 50; i++) {
                    targets.push({ type: "index", value: i });
                }
            } else if (/^\d+$/.test(part)) {
                targets.push({ type: "index", value: parseInt(part, 10) });
            }
        });
        text = text.slice(first.length).trim();
    }

    return { targets: targets, text: text, color: color };
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
        const p = px();
        const sub = String((args && args[0]) || "").toLowerCase();

        // color set
        if (sub === "color" && isGroup) {
            const name = (args && args[1]) || "";
            if (!name) {
                return reply(
                    "🎨 Colors: " +
                        Object.keys(COLOR_MAP).join(", ") +
                        "\n" +
                        p +
                        "gcstatus color purple"
                );
            }
            if (name.toLowerCase() === "random") {
                const cfg = loadConfig();
                cfg[from] = { color: "random" };
                saveConfig(cfg);
                return reply("✅ Group status color: *random*");
            }
            const c = resolveColor(name);
            if (!c) return reply("❌ Unknown color.");
            const cfg = loadConfig();
            cfg[from] = { color: name.toLowerCase() };
            saveConfig(cfg);
            return reply("✅ Group status color: *" + name + "* → " + c);
        }

        // list groups
        if (sub === "list" || sub === "-list") {
            const list = await fetchUserGroups(sock);
            if (!list.length) return reply("❌ No groups found.");
            const lines = list
                .map(function (g) {
                    return "│ *" + g.index + ".* " + g.name;
                })
                .join("\n");
            return reply(
"╭━━━「 📋 GROUPS 」━━━\n" +
"│ Total: *" + list.length + "*\n│\n" +
lines + "\n│\n" +
"│ " + p + "gcstatus 1 Hello\n" +
"│ " + p + "gcstatus 1,2,3 Hello\n" +
"│ " + p + "gcstatus all Hello\n" +
"╰━━━━━━━━━━━━━━━━━━━━\n" +
"_VENOM X_"
            );
        }

        const parsed = parseArgs(args);
        let targetJids = [];

        if (parsed.targets && parsed.targets.length) {
            const list = await fetchUserGroups(sock);
            for (let i = 0; i < parsed.targets.length; i++) {
                const t = parsed.targets[i];
                if (t.type === "all") {
                    targetJids = list.map(function (g) {
                        return g.jid;
                    });
                    break;
                }
                if (t.type === "index") {
                    const hit = list.find(function (g) {
                        return g.index === t.value;
                    });
                    if (hit && targetJids.indexOf(hit.jid) === -1) {
                        targetJids.push(hit.jid);
                    }
                }
            }
        } else if (isGroup) {
            targetJids = [from];
        } else {
            return reply(
"╭━━〔 📢 GCSTATUS 〕━━⬣\n" +
"┃ " + p + "gcstatus Hello\n" +
"┃ " + p + "gcstatus list\n" +
"┃ " + p + "gcstatus 1,2 Hello\n" +
"┃ " + p + "gcstatus all Hello\n" +
"┃ " + p + "gcstatus color purple\n" +
"┃ Reply media + " + p + "gcstatus\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        }

        if (!targetJids.length) {
            return reply("❌ No target groups. Use `" + p + "gcstatus list`");
        }

        const caption = parsed.text || "";
        const ctx =
            message.message &&
            message.message.extendedTextMessage &&
            message.message.extendedTextMessage.contextInfo;
        const quoted = ctx && ctx.quotedMessage;

        let content = null;

        try {
            if (quoted) {
                const payload = unwrap(quoted);
                const type = detectType(payload);
                if (!type) {
                    return reply("❌ Reply to image, video, audio, or sticker.");
                }
                const buffer = await downloadMedia(payload, type);
                if (!buffer.length) throw new Error("Empty media");

                if (type === "audio") {
                    content = {
                        audio: buffer,
                        mimetype: "audio/ogg; codecs=opus",
                        ptt: true
                    };
                } else if (type === "sticker") {
                    content = { sticker: buffer };
                } else {
                    content = {
                        [type]: buffer,
                        caption: caption || ""
                    };
                }
            } else {
                if (!caption) {
                    return reply("❌ Provide text or reply to media.");
                }
                content = { text: caption };
            }

            await reply("🚀 Posting to *" + targetJids.length + "* group(s)...");

            let ok = 0;
            let fail = 0;
            for (let i = 0; i < targetJids.length; i++) {
                const jid = targetJids[i];
                try {
                    const color = pickColor(jid, parsed.color);
                    const body =
                        content.text !== undefined
                            ? {
                                  text: content.text,
                                  backgroundColor: color
                              }
                            : content;
                    await postGroupStatus(sock, jid, body, color);
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
"✅ *Group Status*\n• Success: *" +
                    ok +
                    "*\n• Failed: *" +
                    fail +
                    "*\n• Total: *" +
                    targetJids.length +
                    "*\n\n_VENOM X_"
            );
        } catch (e) {
            console.log("[GCSTATUS]", e);
            return reply("❌ Failed: " + (e.message || e));
        }
    }
};
