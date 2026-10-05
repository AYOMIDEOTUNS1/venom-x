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

    // -------------------------------------------------
    // LOAD COMMANDS
    // -------------------------------------------------
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

                if (!command || typeof command !== "object") {
                    console.log("⚠️ Invalid command: " + file);
                    continue;
                }

                const name = file.replace(".js", "").toLowerCase();
                commands.set(name, command);

                if (Array.isArray(command.aliases)) {
                    for (let a = 0; a < command.aliases.length; a++) {
                        const alias = String(command.aliases[a] || "").toLowerCase();
                        if (alias) commands.set(alias, command);
                    }
                }
            } catch (err) {
                console.log("⚠️ Failed to load " + file + ":", err.message);
            }
        }

        console.log("📦 Loaded " + commands.size + " command keys");
    }

    loadCommands();

    // -------------------------------------------------
    // HELPERS
    // -------------------------------------------------
    function extractBody(msg) {
        try {
            const m = msg.message || {};

            if (m.conversation) return m.conversation;

            if (m.extendedTextMessage && m.extendedTextMessage.text) {
                return m.extendedTextMessage.text;
            }

            if (m.imageMessage && m.imageMessage.caption) {
                return m.imageMessage.caption;
            }

            if (m.videoMessage && m.videoMessage.caption) {
                return m.videoMessage.caption;
            }

            if (m.documentMessage && m.documentMessage.caption) {
                return m.documentMessage.caption;
            }

            // buttons
            if (m.buttonsResponseMessage) {
                return (
                    m.buttonsResponseMessage.selectedDisplayText ||
                    m.buttonsResponseMessage.selectedButtonId ||
                    ""
                );
            }

            // list
            if (m.listResponseMessage) {
                const s = m.listResponseMessage.singleSelectReply;
                return (
                    (s && s.selectedRowId) ||
                    m.listResponseMessage.title ||
                    ""
                );
            }

            // template button
            if (m.templateButtonReplyMessage) {
                return (
                    m.templateButtonReplyMessage.selectedId ||
                    m.templateButtonReplyMessage.selectedDisplayText ||
                    ""
                );
            }

            // interactive / native flow
            if (
                m.interactiveResponseMessage &&
                m.interactiveResponseMessage.nativeFlowResponseMessage
            ) {
                try {
                    const params =
                        m.interactiveResponseMessage.nativeFlowResponseMessage
                            .paramsJson;
                    if (params) {
                        const parsed = JSON.parse(params);
                        if (parsed.id) return String(parsed.id);
                        if (parsed.selectedId) return String(parsed.selectedId);
                    }
                } catch (e) {}
            }

            return "";
        } catch (e) {
            return "";
        }
    }

    function normalizeId(id) {
        if (!id) return "";
        let v = String(id);
        if (v.includes(":")) v = v.split(":")[0];
        return v;
    }

    function getOwnerList(settings) {
        const list = [];
        if (settings.owner) {
            if (Array.isArray(settings.owner)) {
                for (let i = 0; i < settings.owner.length; i++) {
                    list.push(normalizeId(settings.owner[i]));
                }
            } else {
                list.push(normalizeId(settings.owner));
            }
        }
        if (settings.ownerNumber) {
            list.push(normalizeId(settings.ownerNumber));
        }
        if (process.env.OWNER_NUMBER) {
            list.push(normalizeId(process.env.OWNER_NUMBER));
        }
        return list.filter(Boolean);
    }

    function isSudoUser(sender, settings) {
        try {
            const sudoPath = path.join(__dirname, "../database/sudo.json");
            if (!fs.existsSync(sudoPath)) return false;
            const raw = fs.readFileSync(sudoPath, "utf8");
            const data = JSON.parse(raw || "[]");
            const id = normalizeId(sender);
            if (Array.isArray(data)) {
                return data.some(function (x) {
                    return normalizeId(x) === id || String(x).includes(id);
                });
            }
            if (data && typeof data === "object") {
                return !!(data[id] || data[sender]);
            }
        } catch (e) {}
        return false;
    }

    // -------------------------------------------------
    // MESSAGE LISTENER
    // -------------------------------------------------
    sock.ev.on("messages.upsert", async function (chatUpdate) {
        try {
            const messages = chatUpdate.messages || [];
            if (!messages.length) return;

            const msg = messages[0];
            if (!msg || !msg.message) return;
            if (msg.key && msg.key.remoteJid === "status@broadcast") return;

            // dedupe
            const mid = msg.key && msg.key.id ? msg.key.id : null;
            if (mid) {
                if (global.processedMessages.has(mid)) return;
                global.processedMessages.add(mid);
                if (global.processedMessages.size > 1000) {
                    global.processedMessages.clear();
                }
            }

            const from = msg.key.remoteJid;
            const isGroup = from && from.endsWith("@g.us");

            let sender = isGroup
                ? msg.key.participant || msg.participant || from
                : from;

            // LID / PN helpers
            const senderPn =
                (msg.key && msg.key.participantPn) ||
                (msg.key && msg.key.remoteJidAlt) ||
                sender;
            const participantPn =
                (msg.key && msg.key.participantPn) || senderPn;

            const settings = getSettings() || {};
            const prefix = settings.prefix || "#";

            // owner / sudo
            const owners = getOwnerList(settings);
            const botId = normalizeId(
                sock.user && (sock.user.id || sock.user.jid)
            );
            const senderNorm = normalizeId(sender);
            const senderPnNorm = normalizeId(senderPn);

            const isOwner =
                owners.some(function (o) {
                    return (
                        senderNorm.includes(o) ||
                        senderPnNorm.includes(o) ||
                        o.includes(senderNorm)
                    );
                }) ||
                (msg.key && msg.key.fromMe === true);

            const isSudo = isSudoUser(sender, settings) || isSudoUser(senderPn, settings);
            const isPrivileged = isOwner || isSudo;

            // ---------- STICKER COLLECTOR (#takeall) ----------
            if (isGroup && !(msg.key && msg.key.fromMe)) {
                setImmediate(function () {
                    (async function () {
                        try {
                            const raw = msg.message || {};
                            const stickerMsg =
                                raw.stickerMessage ||
                                (raw.ephemeralMessage &&
                                    raw.ephemeralMessage.message &&
                                    raw.ephemeralMessage.message.stickerMessage) ||
                                (raw.viewOnceMessage &&
                                    raw.viewOnceMessage.message &&
                                    raw.viewOnceMessage.message.stickerMessage) ||
                                (raw.viewOnceMessageV2 &&
                                    raw.viewOnceMessageV2.message &&
                                    raw.viewOnceMessageV2.message.stickerMessage) ||
                                (raw.viewOnceMessageV2Extension &&
                                    raw.viewOnceMessageV2Extension.message &&
                                    raw.viewOnceMessageV2Extension.message
                                        .stickerMessage) ||
                                null;

                            if (!stickerMsg) return;

                            const {
                                downloadContentFromMessage
                            } = require("@whiskeysockets/baileys");
                            const stickerCollector = require("../lib/stickerCollector");

                            const stream = await downloadContentFromMessage(
                                stickerMsg,
                                "sticker"
                            );
                            const chunks = [];
                            for await (const chunk of stream) chunks.push(chunk);
                            const buffer = Buffer.concat(chunks);
                            if (buffer.length) {
                                stickerCollector.addSticker(from, buffer);
                            }
                        } catch (e) {
                            // ignore
                        }
                    })();
                });
            }

            // body / command
            let body = extractBody(msg);
            body = String(body || "").trim();
            if (!body) return;

            // sleep mode
            if (settings.sleep === true && !isPrivileged) return;

            // private mode
            if (
                String(settings.mode || "public").toLowerCase() === "private" &&
                !isPrivileged
            ) {
                return;
            }

            // global ban
            try {
                const banlist = require("../lib/banlist");
                if (!isPrivileged && typeof banlist.isBanned === "function") {
                    if (banlist.isBanned(sender) || banlist.isBanned(senderPn)) {
                        return;
                    }
                }
            } catch (e) {}

            // must start with prefix
            if (!body.startsWith(prefix)) return;

            const withoutPrefix = body.slice(prefix.length).trim();
            if (!withoutPrefix) return;

            const parts = withoutPrefix.split(/\s+/);
            const commandName = String(parts[0] || "").toLowerCase();
            const args = parts.slice(1);

            const command = commands.get(commandName);
            if (!command || typeof command.run !== "function") return;

            // reply helper
            const reply = async function (text) {
                return sock.sendMessage(
                    from,
                    { text: String(text) },
                    { quoted: msg }
                );
            };

            // optional react
            try {
                const reactMap = settings.react || {};
                const reactEmoji =
                    (reactMap && reactMap[commandName]) ||
                    settings.commandReact ||
                    "⚡";
                await sock.sendMessage(from, {
                    react: { text: reactEmoji, key: msg.key }
                });
            } catch (e) {}

            console.log("🚀 RUNNING COMMAND:", commandName);
            const start = Date.now();

            try {
                await command.run({
                    sock: sock,
                    from: from,
                    sender: sender,
                    senderPn: senderPn,
                    participantPn: participantPn,
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
                    err.message
                );
                await sock
                    .sendMessage(
                        from,
                        { text: "❌ Error: " + err.message },
                        { quoted: msg }
                    )
                    .catch(function () {});
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
