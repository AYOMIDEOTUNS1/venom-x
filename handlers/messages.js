"use strict";

const fs = require("fs");
const path = require("path");
const { getSettings } = require("../lib/settingsCache");
const { runAntiGuards } = require("../lib/antiGuard");
const {
    resolveSender,
    isOwnerPhone,
    isSudoPhone,
    isGroupAdmin,
    onlyDigits
} = require("../lib/identity");

let groupMode = null;
try {
    groupMode = require("../lib/groupMode");
} catch (e) {}

let banlist = null;
try {
    banlist = require("../lib/banlist");
} catch (e) {}

let stickerHistory = null;
try {
    stickerHistory = require("../lib/stickerHistory");
} catch (e) {}

function messageHasSticker(msg) {
    let current = msg && msg.message;
    for (let i = 0; i < 5 && current; i++) {
        if (current.stickerMessage) return true;
        current =
            current.ephemeralMessage?.message ||
            current.viewOnceMessage?.message ||
            current.viewOnceMessageV2?.message ||
            current.viewOnceMessageV2Extension?.message ||
            null;
    }
    return false;
}

module.exports = function (sock) {
    console.log("✅ VENOM X Message Handler Loaded");

    if (!sock || !sock.ev) {
        console.log("❌ Message handler received invalid socket");
        return;
    }

    const commands = new Map();
    if (!global.processedMessages) global.processedMessages = new Set();

    function loadCommands() {
        commands.clear();
        const folder = path.join(__dirname, "../commands");
        if (!fs.existsSync(folder)) return;

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

                const name = file.replace(".js", "").toLowerCase();
                commands.set(name, command);

                if (Array.isArray(command.aliases)) {
                    for (let a = 0; a < command.aliases.length; a++) {
                        const alias = String(command.aliases[a] || "").toLowerCase();
                        if (alias) commands.set(alias, command);
                    }
                }
            } catch (err) {
                console.log("⚠️ Command load [" + file + "]:", err.message);
            }
        }
        console.log("📦 Loaded " + commands.size + " command keys");
    }

    loadCommands();

    sock.ev.on("messages.upsert", async function (upsert) {
        try {
            const messages = upsert.messages || [];

            for (let mi = 0; mi < messages.length; mi++) {
                const msg = messages[mi];
                if (!msg || !msg.message || !msg.key) continue;

                const from = msg.key.remoteJid;
                if (!from) continue;

                const mid = msg.key.id || "";
                const dedupeKey = from + "|" + mid;
                if (mid && global.processedMessages.has(dedupeKey)) continue;
                if (mid) {
                    global.processedMessages.add(dedupeKey);
                    if (global.processedMessages.size > 5000) {
                        global.processedMessages.clear();
                    }
                }

                if (stickerHistory && messageHasSticker(msg)) {
                    try {
                        if (typeof stickerHistory.recordStickerMessage === "function") {
                            stickerHistory.recordStickerMessage(msg);
                        }
                    } catch (e) {}
                }

                const ident = resolveSender(msg, from);
                const sender = ident.senderJid;
                const senderPn = ident.phone;
                const isGroup = ident.isGroup;

                const settings = getSettings() || {};
                const isOwner = isOwnerPhone(senderPn, settings) || msg.key.fromMe;
                const isSudo = isSudoPhone(senderPn, settings);
                const isPrivileged = isOwner || isSudo;

                // debug once in a while if needed:
                // console.log("ID", { from, sender, senderPn, isOwner, fromMe: msg.key.fromMe });

                if (isGroup && sender && !msg.key.fromMe) {
                    try {
                        const blocked = await runAntiGuards(sock, msg, from, sender, {
                            phone: senderPn,
                            isPrivileged: isPrivileged
                        });
                        if (blocked) continue;
                    } catch (e) {
                        console.log("antiGuard:", e.message);
                    }
                }

                if (banlist && typeof banlist.isBanned === "function" && !isPrivileged) {
                    try {
                        if (banlist.isBanned(sender) || banlist.isBanned(senderPn)) continue;
                    } catch (e) {}
                }

                const prefix = settings.prefix || "#";
                const m = msg.message;
                let body =
                    m.conversation ||
                    m.extendedTextMessage?.text ||
                    m.imageMessage?.caption ||
                    m.videoMessage?.caption ||
                    m.documentMessage?.caption ||
                    "";

                body = String(body || "").trim();
                if (!body || !body.startsWith(prefix)) continue;

                const without = body.slice(prefix.length).trim();
                const parts = without.split(/\s+/);
                const commandName = String(parts[0] || "").toLowerCase();
                const args = parts.slice(1);
                if (!commandName) continue;

                const command = commands.get(commandName);
                if (!command || typeof command.run !== "function") continue;

                // private mode
                if (settings.mode === "private" && !isPrivileged) continue;

                // group admin-only mode
                if (
                    isGroup &&
                    groupMode &&
                    typeof groupMode.isAdminOnly === "function" &&
                    groupMode.isAdminOnly(from) &&
                    !isPrivileged
                ) {
                    const admin = await isGroupAdmin(sock, from, sender, senderPn);
                    if (!admin) continue;
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
                console.log(
                    "🚀",
                    commandName,
                    "| phone:",
                    senderPn || "?",
                    "| owner:",
                    isOwner
                );
                const start = Date.now();

                try {
                    await command.run({
                        sock: sock,
                        from: from,
                        sender: sender,
                        senderPn: senderPn,
                        participantPn: senderPn,
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
                    console.log("✅ " + commandName + " " + (Date.now() - start) + "ms");
                } catch (err) {
                    console.log("❌ [" + commandName + "]", err && err.message ? err.message : err);
                    await setReact("❌");
                    await sock
                        .sendMessage(
                            from,
                            {
                                text:
                                    "╭━━〔 ❌ VENOM ERROR 〕━━⬣\n┃\n┃ " +
                                    String((err && err.message) || err).slice(0, 280) +
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
