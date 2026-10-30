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

    function isPrivateMode(settings) {
        if (!settings) return false;
        if (settings.mode === "private") return true;
        if (settings.mode === "public") return false;
        if (settings.public === false) return true;
        return false;
    }

    function getBody(msg) {
        const m = msg.message || {};
        if (m.conversation) return m.conversation;
        if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
        if (m.imageMessage?.caption) return m.imageMessage.caption;
        if (m.videoMessage?.caption) return m.videoMessage.caption;
        if (m.documentMessage?.caption) return m.documentMessage.caption;
        if (m.buttonsResponseMessage?.selectedButtonId) {
            return m.buttonsResponseMessage.selectedButtonId;
        }
        if (m.buttonsResponseMessage?.selectedDisplayText) {
            return m.buttonsResponseMessage.selectedDisplayText;
        }
        if (m.listResponseMessage?.singleSelectReply?.selectedRowId) {
            return m.listResponseMessage.singleSelectReply.selectedRowId;
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

    function getMentioned(msg) {
        const m = msg.message || {};
        const ctx =
            m.extendedTextMessage?.contextInfo ||
            m.imageMessage?.contextInfo ||
            m.videoMessage?.contextInfo ||
            {};
        const list = [];
        const raw = ctx.mentionedJid || [];
        for (let i = 0; i < raw.length; i++) {
            if (raw[i]) list.push(raw[i]);
        }
        if (ctx.participant) list.push(ctx.participant);
        return list;
    }

    function getQuotedParticipant(msg) {
        const m = msg.message || {};
        const ctx =
            m.extendedTextMessage?.contextInfo ||
            m.imageMessage?.contextInfo ||
            m.videoMessage?.contextInfo ||
            {};
        return ctx.participant || null;
    }

    let recordSticker = null;
    try {
        recordSticker = require("../lib/stickerHistory").recordStickerMessage;
    } catch (e) {}

    let runAntiGuards = null;
    try {
        runAntiGuards = require("../lib/antiGuard").runAntiGuards;
    } catch (e) {
        console.log("⚠️ antiGuard not loaded");
    }

    let isBanned = null;
    try {
        isBanned = require("../lib/banlist").isBanned;
    } catch (e) {}

    let isAdminOnly = null;
    try {
        isAdminOnly = require("../lib/groupMode").isAdminOnly;
    } catch (e) {}

    let afk = null;
    try {
        afk = require("../lib/afk");
    } catch (e) {
        console.log("⚠️ afk not loaded");
    }

    // wordchain — support several export shapes
    function getWordchainHandler() {
        try {
            const wc = require("../commands/wordchain");
            if (typeof wc.handleWordChainMessage === "function") {
                return wc.handleWordChainMessage;
            }
            if (typeof wc.onMessage === "function") return wc.onMessage;
            if (typeof wc.handleMessage === "function") return wc.handleMessage;
            if (typeof wc.handle === "function") return wc.handle;
        } catch (e) {}
        return null;
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
                const isOwner = isOwnerMsg(msg, sender, senderPn, settings);
                const isSudo = isOwner;
                const isPrivileged = isOwner || isSudo;

                // ── AFK: track activity when this user speaks
                if (afk && sender && !msg.key.fromMe) {
                    try {
                        afk.touch(sender);
                        if (senderPn) afk.touch(senderPn);
                    } catch (e) {}
                }

                // ── AFK: if someone tags / replies to an AFK user
                if (afk && isGroup && !msg.key.fromMe && body) {
                    try {
                        const targets = [];
                        const mentioned = getMentioned(msg);
                        for (let t = 0; t < mentioned.length; t++) {
                            targets.push(mentioned[t]);
                        }
                        const qp = getQuotedParticipant(msg);
                        if (qp) targets.push(qp);

                        for (let t = 0; t < targets.length; t++) {
                            const target = targets[t];
                            if (afk.sameUser(target, sender)) continue;
                            const state = afk.getAfkState(target);
                            if (!state) continue;
                            if (!afk.canNotify(target)) continue;

                            const mention = "@" + String(target).split("@")[0];
                            await sock.sendMessage(
                                from,
                                {
                                    text:
`╭━━〔 💤 AFK 〕━━⬣
┃
┃ ${mention} is *away*
┃
┃ 📝 ${state.reason}
┃ ⏱️ Offline: *${state.offlineFor}*
┃ 🔖 ${state.type === "manual" ? "Manual AFK" : "Auto (20+ min quiet)"}
┃
╰━━━━━━━━━━━━━━━━⬣`,
                                    mentions: [target]
                                },
                                { quoted: msg }
                            );
                        }
                    } catch (e) {
                        console.log("afk notify:", e.message);
                    }
                }

                // ── ANTI GUARDS (before body/prefix requirements)
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

                // ── WORDCHAIN (no prefix — active game turns)
                if (body && !msg.key.fromMe) {
                    const wcHandler = getWordchainHandler();
                    if (wcHandler) {
                        try {
                            const handled = await wcHandler({
                                sock: sock,
                                from: from,
                                sender: sender,
                                senderPn: senderPn,
                                body: body,
                                message: msg,
                                msg: msg,
                                isGroup: isGroup,
                                reply: async function (text) {
                                    return sock.sendMessage(
                                        from,
                                        { text: String(text) },
                                        { quoted: msg }
                                    );
                                }
                            });
                            if (handled === true) continue;
                        } catch (e) {
                            console.log("wordchain:", e.message);
                        }
                    }
                }

                
                // ── WORDCHAIN (plain words, no prefix)
                if (body && !msg.key.fromMe && isGroup) {
                    try {
                        const wc = require("../commands/wordchain");
                        if (typeof wc.handleWordChainMessage === "function") {
                            const handled = await wc.handleWordChainMessage(
                                sock,
                                msg,
                                from,
                                sender,
                                body,
                                isGroup
                            );
                            if (handled === true) continue;
                        }
                    } catch (e) {
                        console.log("wordchain:", e.message);
                    }
                }

                if (!body) continue;

                // private / public
                // owner can always run commands (including #public)
                if (isPrivateMode(settings) && !isPrivileged) {
                    // still allow nothing for non-owners
                    if (!body.startsWith(prefix)) continue;
                    // block non-owner commands in private mode
                    continue;
                }

                if (!body.startsWith(prefix)) continue;

                // ban
                if (isBanned) {
                    try {
                        if (
                            isBanned(sender) ||
                            isBanned(senderPn) ||
                            isBanned(onlyDigits(sender)) ||
                            isBanned(onlyDigits(senderPn))
                        ) {
                            continue;
                        }
                    } catch (e) {}
                }

                const without = body.slice(prefix.length).trim();
                const parts = without.split(/\s+/);
                const commandName = String(parts[0] || "").toLowerCase();
                const args = parts.slice(1);
                if (!commandName) continue;

                const command = commands.get(commandName);
                if (!command || typeof command.run !== "function") continue;

                // admin-only groups
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
