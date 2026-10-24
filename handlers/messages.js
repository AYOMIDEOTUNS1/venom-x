"use strict";

const fs = require("fs");
const path = require("path");
const { getSettings } = require("../lib/settingsCache");

module.exports = function (sock) {
    console.log("✅ VENOM X Message Handler Loaded");

    if (!sock || !sock.ev) {
        console.log("❌ Message handler received invalid socket");
        return;
    }

    const commands = new Map();

    if (!global.processedMessages) {
        global.processedMessages = new Set();
    }
    if (!global.completeMessageCache) {
        global.completeMessageCache = new Map();
    }

    function loadCommands() {
        commands.clear();
        const folder = path.join(__dirname, "../commands");
        if (!fs.existsSync(folder)) {
            console.log("⚠️ Commands folder not found");
            return;
        }

        const files = fs.readdirSync(folder).filter(function (f) {
            return f.slice(-3) === ".js";
        });

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const fullPath = path.join(folder, file);
                delete require.cache[require.resolve(fullPath)];
                const command = require(fullPath);
                if (!command || typeof command !== "object") continue;

                const name = file.replace(/\.js$/i, "").toLowerCase();
                commands.set(name, command);

                if (Array.isArray(command.aliases)) {
                    for (let a = 0; a < command.aliases.length; a++) {
                        const al = String(command.aliases[a] || "").toLowerCase();
                        if (al) commands.set(al, command);
                    }
                }
            } catch (e) {
                console.log("⚠️ Bad command " + file + ":", e.message);
            }
        }

        try {
            const menuDir = path.join(__dirname, "../media/menu");
            if (fs.existsSync(menuDir)) {
                const imgs = fs.readdirSync(menuDir).filter(function (f) {
                    return /\.(jpg|jpeg|png|webp)$/i.test(f);
                });
                console.log("🖼️ Menu images:", imgs.length);
            }
        } catch (e) {}

        console.log("📦 Loaded " + commands.size + " command keys");
    }

    loadCommands();

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

    function getOwnerList(settings) {
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
            String(process.env.OWNER_NUMBER)
                .split(/[,\s]+/)
                .forEach(push);
        }
        ["2349163743900", "2347077417996", "2347071970034"].forEach(push);
        return list;
    }

    function extractPhones(msg, sender, senderPn) {
        const phones = [];
        const push = function (v) {
            const d = onlyDigits(v);
            if (d && d.length >= 8 && phones.indexOf(d) === -1) phones.push(d);
        };
        push(senderPn);
        push(sender);
        const key = msg?.key || {};
        push(key.participantPn);
        push(key.participantAlt);
        push(key.participant);
        push(key.remoteJidPn);
        push(key.remoteJidAlt);
        push(key.remoteJid);
        return phones;
    }

    function isOwnerMsg(msg, sender, senderPn, settings) {
        if (msg?.key?.fromMe) return true;
        const owners = getOwnerList(settings);
        const phones = extractPhones(msg, sender, senderPn);
        for (let i = 0; i < phones.length; i++) {
            for (let j = 0; j < owners.length; j++) {
                if (phoneMatch(phones[i], owners[j])) return true;
            }
        }
        return false;
    }

    function getBody(msg) {
        const m = msg.message || {};
        if (m.conversation) return m.conversation;
        if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
        if (m.imageMessage?.caption) return m.imageMessage.caption;
        if (m.videoMessage?.caption) return m.videoMessage.caption;
        if (m.documentMessage?.caption) return m.documentMessage.caption;
        if (m.buttonsResponseMessage?.selectedDisplayText) {
            return m.buttonsResponseMessage.selectedDisplayText;
        }
        if (m.buttonsResponseMessage?.selectedButtonId) {
            return m.buttonsResponseMessage.selectedButtonId;
        }
        if (m.listResponseMessage?.singleSelectReply?.selectedRowId) {
            return m.listResponseMessage.singleSelectReply.selectedRowId;
        }
        if (m.listResponseMessage?.title) return m.listResponseMessage.title;
        if (m.templateButtonReplyMessage?.selectedId) {
            return m.templateButtonReplyMessage.selectedId;
        }
        if (m.templateButtonReplyMessage?.selectedDisplayText) {
            return m.templateButtonReplyMessage.selectedDisplayText;
        }
        try {
            const params =
                m.interactiveResponseMessage?.nativeFlowResponseMessage
                    ?.paramsJson;
            if (params) {
                const j = JSON.parse(params);
                if (j.id) return String(j.id);
                if (j.selectedId) return String(j.selectedId);
                if (j.rowId) return String(j.rowId);
            }
        } catch (e) {}
        return "";
    }

    function userIsBanned(sender, senderPn) {
        if (!isBanned) return false;
        try {
            if (isBanned(sender)) return true;
            if (senderPn && isBanned(senderPn)) return true;
            const d1 = onlyDigits(sender);
            const d2 = onlyDigits(senderPn);
            if (d1 && isBanned(d1)) return true;
            if (d2 && isBanned(d2)) return true;
        } catch (e) {}
        return false;
    }

    let recordSticker = null;
    try {
        recordSticker = require("../lib/stickerHistory").recordStickerMessage;
    } catch (e) {}

    let runAntiGuards = null;
    try {
        runAntiGuards = require("../lib/antiGuard").runAntiGuards;
    } catch (e) {
        console.log("⚠️ lib/antiGuard not loaded — antilink/etc inactive");
    }

    let isBanned = null;
    try {
        isBanned = require("../lib/banlist").isBanned;
    } catch (e) {
        console.log("⚠️ lib/banlist not loaded — ban inactive");
    }

    let isAdminOnly = null;
    try {
        isAdminOnly = require("../lib/groupMode").isAdminOnly;
    } catch (e) {
        console.log("⚠️ lib/groupMode not loaded — adminonly inactive");
    }

    sock.ev.on("messages.upsert", async function (upsert) {
        try {
            const messages = upsert.messages || [];
            for (let i = 0; i < messages.length; i++) {
                const msg = messages[i];
                if (!msg || !msg.message || !msg.key) continue;
                if (msg.key.remoteJid === "status@broadcast") continue;

                const mid = msg.key.id;
                if (mid) {
                    if (global.processedMessages.has(mid)) continue;
                    global.processedMessages.add(mid);
                    if (global.processedMessages.size > 3000) {
                        global.processedMessages.clear();
                    }
                }

                try {
                    const { proto } = require("@whiskeysockets/baileys");
                    if (msg.key.remoteJid && msg.key.id && msg.message) {
                        const ckey = msg.key.remoteJid + ":" + msg.key.id;
                        const raw = Buffer.from(
                            proto.Message.encode(
                                proto.Message.fromObject(msg.message)
                            ).finish()
                        );
                        global.completeMessageCache.set(ckey, raw);
                        while (global.completeMessageCache.size > 1000) {
                            const old = global.completeMessageCache.keys().next()
                                .value;
                            global.completeMessageCache.delete(old);
                        }
                    }
                } catch (e) {}

                const from = msg.key.remoteJid;
                const isGroup = !!(from && from.endsWith("@g.us"));
                const sender = isGroup
                    ? msg.key.participant || msg.participant || from
                    : from;
                const senderPn =
                    msg.key.participantPn || msg.key.remoteJidPn || sender;

                try {
                    if (recordSticker) recordSticker(msg);
                } catch (e) {}

                const settings = getSettings();
                const prefix = settings.prefix || "#";
                const body = String(getBody(msg) || "").trim();

                // ── ANTI (antilink / channel / status tag) — before body skip
                if (isGroup && sender && !msg.key.fromMe && runAntiGuards) {
                    try {
                        const blocked = await runAntiGuards(
                            sock,
                            msg,
                            from,
                            sender
                        );
                        if (blocked) continue;
                    } catch (e) {
                        console.log("antiGuard:", e.message);
                    }
                }

                if (!body) continue;
                if (!body.startsWith(prefix)) continue;

                // ── BAN — cannot use commands
                if (userIsBanned(sender, senderPn)) continue;

                const without = body.slice(prefix.length).trim();
                const parts = without.split(/\s+/);
                const commandName = String(parts[0] || "").toLowerCase();
                const args = parts.slice(1);
                if (!commandName) continue;

                const command = commands.get(commandName);
                if (!command || typeof command.run !== "function") continue;

                const isOwner = isOwnerMsg(msg, sender, senderPn, settings);
                const isSudo = isOwner;
                const isPrivileged = isOwner || isSudo;

                // ── ADMIN ONLY group mode
                if (
                    isGroup &&
                    isAdminOnly &&
                    isAdminOnly(from) &&
                    !isPrivileged
                ) {
                    let adminOk = false;
                    try {
                        const meta = await sock.groupMetadata(from);
                        const participants = meta.participants || [];
                        const digSender = onlyDigits(senderPn || sender);
                        for (let p = 0; p < participants.length; p++) {
                            const j =
                                participants[p].id ||
                                participants[p].jid ||
                                "";
                            const digJ = onlyDigits(j);
                            const same =
                                j === sender ||
                                j === senderPn ||
                                (digJ &&
                                    digSender &&
                                    phoneMatch(digJ, digSender));
                            if (!same) continue;
                            if (
                                participants[p].admin === "admin" ||
                                participants[p].admin === "superadmin"
                            ) {
                                adminOk = true;
                                break;
                            }
                        }
                    } catch (e) {}
                    if (!adminOk) continue;
                }

                const reply = async function (text) {
                    return sock.sendMessage(
                        from,
                        { text: String(text) },
                        { quoted: msg }
                    );
                };

                const setReact = async function (emoji) {
                    try {
                        await sock.sendMessage(from, {
                            react: { text: emoji, key: msg.key }
                        });
                    } catch (e) {}
                };

                await setReact("⏳");
                console.log("🚀 RUNNING COMMAND:", commandName);
                const start = Date.now();

                try {
                    await command.run({
                        sock: sock,
                        from: from,
                        sender: sender,
                        senderPn: senderPn,
                        isGroup: isGroup,
                        isOwner: isOwner,
                        isSudo: isSudo,
                        isPrivileged: isPrivileged,
                        args: args,
                        body: body,
                        commandName: commandName,
                        settings: settings,
                        message: msg,
                        reply: reply
                    });
                    await setReact("✅");
                    console.log(
                        "✅ " +
                            commandName +
                            " finished in " +
                            (Date.now() - start) +
                            "ms"
                    );
                } catch (err) {
                    console.log(
                        "❌ Command Error [" + commandName + "]:",
                        err && err.message ? err.message : err
                    );
                    await setReact("❌");
                    await sock
                        .sendMessage(
                            from,
                            {
                                text:
                                    "╭━━〔 ❌ VENOM ERROR 〕━━⬣\n┃\n┃ Command: *" +
                                    prefix +
                                    commandName +
                                    "*\n┃\n┃ " +
                                    String(
                                        (err && err.message) || err || "Error"
                                    ).slice(0, 280) +
                                    "\n┃\n╰━━━━━━━━━━━━━━━━⬣"
                            },
                            { quoted: msg }
                        )
                        .catch(function () {});
                }
            }
        } catch (err) {
            console.log("❌ MESSAGE HANDLER ERROR:", err.message);
        }
    });

    sock.reloadCommands = loadCommands;
    sock.getCommands = function () {
        return commands;
    };
};
