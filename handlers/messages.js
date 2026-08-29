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
                        const alias = command.aliases[a];
                        if (typeof alias === "string") {
                            commands.set(alias.toLowerCase(), command);
                        }
                    }
                }
            } catch (err) {
                console.log("COMMAND LOAD ERROR: " + file + " " + err.message);
            }
        }

        console.log("✅ Loaded " + commands.size + " commands");
    }

    loadCommands();

    const reactions = {
        menu: "🤖",
        help: "📚",
        ping: "⚡",
        alive: "💚",
        owner: "👑",
        ai: "🧠",
        sticker: "🖼️",
        kick: "🥾",
        tagall: "📢",
        antilink: "🛡️",
        play: "🎵",
        sleep: "😴",
        up: "⚡",
        refresh: "🔄",
        welcome: "👋",
        goodbye: "👋",
        hd: "✨",
        default: "⚙️"
    };

    console.log("📡 Registering messages.upsert listener...");

    sock.ev.on("messages.upsert", function (payload) {
        try {
            const type = payload && payload.type ? payload.type : "unknown";
            const messages = payload && payload.messages ? payload.messages : null;

            if (!Array.isArray(messages) || messages.length === 0) return;

            // Always log so we can see if events arrive after pairing
            // only log when useful
if (type === "notify") {
    // silent, or:
    // console.log("📡 UPSERT:", type, messages.length);
}

            for (let i = 0; i < messages.length; i++) {
                const msg = messages[i];
                const jid = msg && msg.key ? msg.key.remoteJid : "";
                if (!jid) continue;
                if (jid === "status@broadcast") continue;
                if (String(jid).indexOf("@newsletter") !== -1) continue;

                processMessage(msg).catch(function (err) {
                    console.log("❌ MESSAGE PROCESS ERROR:", err.message);
                });
            }
        } catch (err) {
            console.log("❌ UPSERT HANDLER ERROR:", err.message);
        }
    });

    console.log("✅ messages.upsert listener registered");

    async function processMessage(msg) {
        try {
            if (!msg || !msg.message || !msg.key) return;

            const messageId = msg.key.id;
            if (!messageId) return;

            const dedupeKey =
                String(msg.key.remoteJid) + "|" +
                String(messageId) + "|" +
                (msg.key.fromMe ? "1" : "0");

            if (global.processedMessages.has(dedupeKey)) return;
            global.processedMessages.add(dedupeKey);

            if (global.processedMessages.size > 5000) {
                global.processedMessages.clear();
            }

            // No strict age filter (pairing/reconnect safe)
            const settings = getSettings();
            if (!settings || typeof settings !== "object") return;

            const from = msg.key.remoteJid;
            if (!from) return;

            const senderPn = msg.key.senderPn || null;
            const participantPn = msg.key.participantPn || null;
            const sender = msg.key.participant || msg.key.remoteJid;
            const isGroup = String(from).indexOf("@g.us") !== -1;

            function normalizeId(value) {
                return String(value || "").replace(/[^0-9]/g, "");
            }

            const senderNumber = normalizeId(sender);
            const ownerNumber = normalizeId(settings.ownerNumber);
            const ownerLid = normalizeId(settings.ownerLid);

            const isOwner =
                Boolean(msg.key.fromMe) ||
                (senderNumber && senderNumber === ownerNumber) ||
                (senderNumber && senderNumber === ownerLid);

            const allowSelf = settings.allowSelf !== false;
            if (msg.key.fromMe && !allowSelf && !isOwner) return;

            // Group protections non-blocking
            if (isGroup) {
                setImmediate(function () {
                    try {
                        const antiLinkHandler = require("./antilink");
                        Promise.resolve(antiLinkHandler(sock, msg)).catch(function () {});
                    } catch (e) {}

                    try {
                        const antiChannel = require("./antichannel");
                        Promise.resolve(antiChannel(sock, msg)).catch(function () {});
                    } catch (e) {}

                    try {
                        const antiStatusTag = require("./antistatustag");
                        Promise.resolve(antiStatusTag(sock, msg)).catch(function () {});
                    } catch (e) {}
                });
            }

            // Sticker collector non-blocking
            if (!msg.key.fromMe) {
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
                                    raw.viewOnceMessageV2.message.stickerMessage);

                            if (!stickerMsg) return;

                            const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
                            const stickerCollector = require("../lib/stickerCollector");

                            const stream = await downloadContentFromMessage(stickerMsg, "sticker");
                            const chunks = [];
                            for await (const chunk of stream) chunks.push(chunk);
                            const buffer = Buffer.concat(chunks);
                            stickerCollector.addSticker(from, buffer);
                        } catch (e) {}
                    })();
                });
            }

            let content = msg.message;
            if (content.ephemeralMessage && content.ephemeralMessage.message) {
                content = content.ephemeralMessage.message;
            }
            if (content.viewOnceMessage && content.viewOnceMessage.message) {
                content = content.viewOnceMessage.message;
            }
            if (content.viewOnceMessageV2 && content.viewOnceMessageV2.message) {
                content = content.viewOnceMessageV2.message;
            }

            let body =
                content.conversation ||
                (content.extendedTextMessage && content.extendedTextMessage.text) ||
                (content.imageMessage && content.imageMessage.caption) ||
                (content.videoMessage && content.videoMessage.caption) ||
                (content.documentMessage && content.documentMessage.caption) ||
                (content.buttonsResponseMessage && content.buttonsResponseMessage.selectedButtonId) ||
                (content.listResponseMessage &&
                    content.listResponseMessage.singleSelectReply &&
                    content.listResponseMessage.singleSelectReply.selectedRowId) ||
                (content.templateButtonReplyMessage && content.templateButtonReplyMessage.selectedId) ||
                "";

            body = String(body || "").trim();
            if (!body) return;

            const prefix = settings.prefix || "#";
            if (body.indexOf(prefix) !== 0) return;

            const commandText = body.slice(prefix.length).trim();
            if (!commandText) return;

            const parts = commandText.split(/\s+/);
            const commandName = (parts.shift() || "").toLowerCase();
            if (!commandName) return;
            const args = parts;

            console.log("📩 Message:", body);

            try {
                const botState = require("../lib/botState");
                if (botState.isSleeping()) {
                    const allowed = ["up", "wake", "awake", "resume", "sleep", "refresh", "alive", "ping"];
                    if (allowed.indexOf(commandName) === -1) return;
                }
            } catch (e) {}

            const command = commands.get(commandName);

            if (!command) {
                await sock.sendMessage(
                    from,
                    {
                        text:
                            "╭━━〔 ❓ VENOM X 〕━━⬣\n\n" +
                            "❌ Command not found: " + prefix + commandName + "\n\n" +
                            "Type " + prefix + "menu or " + prefix + "m to see all commands.\n\n" +
                            "╰━━━━━━━━━━━━━━━━⬣"
                    },
                    { quoted: msg }
                ).catch(function () {});
                return;
            }

            if (typeof command.run !== "function") {
                console.log("❌ Broken command: " + commandName);
                return;
            }

            if (settings.mode === "private" && !isOwner && isGroup) {
                return;
            }

            const reply = async function (text, extra) {
                return sock.sendMessage(
                    from,
                    Object.assign({ text: String(text) }, extra || {}),
                    { quoted: msg }
                );
            };

            const reactEmoji = reactions[commandName] || reactions.default;
            sock.sendMessage(from, {
                react: { text: reactEmoji, key: msg.key }
            }).catch(function () {});

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
                    args: args,
                    body: body,
                    commandName: commandName,
                    settings: settings,
                    message: msg,
                    reply: reply
                });

                console.log("✅ " + commandName + " finished in " + (Date.now() - start) + "ms");
            } catch (err) {
                console.log("❌ Command Error [" + commandName + "]:", err.message);
                await sock.sendMessage(
                    from,
                    { text: "❌ Error: " + err.message },
                    { quoted: msg }
                ).catch(function () {});
            }
        } catch (err) {
            console.log("❌ MESSAGE HANDLER ERROR:", err.message);
        }
    }

    sock.reloadCommands = loadCommands;
    sock.getCommands = function () {
        return commands;
    };
};
