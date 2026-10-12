"use strict";

const fs = require("fs");
const path = require("path");
const { getSettings } = require("../lib/settingsCache");
const { runAntiGuards } = require("../lib/antiGuard");

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
                console.log("⚠️ Command load error [" + file + "]:", err.message);
            }
        }
        console.log("📦 Loaded " + commands.size + " command keys");
    }

    loadCommands();

    function getOwnerNumbers(settings) {
        const list = [];
        if (settings && settings.owner) {
            if (Array.isArray(settings.owner)) {
                settings.owner.forEach(function (n) {
                    list.push(String(n).replace(/\D/g, ""));
                });
            } else {
                list.push(String(settings.owner).replace(/\D/g, ""));
            }
        }
        if (process.env.OWNER_NUMBER) {
            list.push(String(process.env.OWNER_NUMBER).replace(/\D/g, ""));
        }
        // hard fallback from your bot
        list.push("2349163743900");
        return list.filter(Boolean);
    }

    function getSudoNumbers(settings) {
        const list = [];
        try {
            if (settings && Array.isArray(settings.sudo)) {
                settings.sudo.forEach(function (n) {
                    list.push(String(n).replace(/\D/g, ""));
                });
            }
        } catch (e) {}
        return list;
    }

    function numberFromJid(jid) {
        if (!jid) return "";
        return String(jid).split("@")[0].split(":")[0].replace(/\D/g, "");
    }

    sock.ev.on("messages.upsert", async function (upsert) {
        try {
            const messages = upsert.messages || [];
            const type = upsert.type;

            for (let mi = 0; mi < messages.length; mi++) {
                const msg = messages[mi];
                if (!msg || !msg.message || !msg.key) continue;

                const from = msg.key.remoteJid;
                if (!from) continue;

                // dedupe
                const mid = msg.key.id || "";
                const dedupeKey = from + "|" + mid;
                if (mid && global.processedMessages.has(dedupeKey)) continue;
                if (mid) {
                    global.processedMessages.add(dedupeKey);
                    if (global.processedMessages.size > 5000) {
                        global.processedMessages.clear();
                    }
                }

                // sticker history
                if (stickerHistory && messageHasSticker(msg)) {
                    try {
                        if (typeof stickerHistory.recordStickerMessage === "function") {
                            stickerHistory.recordStickerMessage(msg);
                        }
                    } catch (e) {}
                }

                const isGroup = from.endsWith("@g.us");
                const sender = isGroup
                    ? msg.key.participant || msg.participant || from
                    : from;

                // anti guards (groups only, not bot)
                if (isGroup && sender && !msg.key.fromMe) {
                    try {
                        const blocked = await runAntiGuards(sock, msg, from, sender);
                        if (blocked) continue;
                    } catch (e) {
                        console.log("antiGuard:", e.message);
                    }
                }

                // ban check
                if (banlist && typeof banlist.isBanned === "function") {
                    try {
                        if (banlist.isBanned(sender)) continue;
                    } catch (e) {}
                }

                const settings = getSettings() || {};
                const prefix = settings.prefix || "#";

                // extract text
                const m = msg.message;
                let body =
                    m.conversation ||
                    m.extendedTextMessage?.text ||
                    m.imageMessage?.caption ||
                    m.videoMessage?.caption ||
                    m.documentMessage?.caption ||
                    "";

                body = String(body || "").trim();
                if (!body) continue;

                if (!body.startsWith(prefix)) continue;

                const without = body.slice(prefix.length).trim();
                const parts = without.split(/\s+/);
                const commandName = String(parts[0] || "").toLowerCase();
                const args = parts.slice(1);

                if (!commandName) continue;

                const command = commands.get(commandName);
                if (!command || typeof command.run !== "function") continue;

                const senderNum = numberFromJid(sender);
                const owners = getOwnerNumbers(settings);
                const sudos = getSudoNumbers(settings);
                const isOwner = owners.includes(senderNum);
                const isSudo = sudos.includes(senderNum);
                const isPrivileged = isOwner || isSudo;

                // group admin-only mode
                if (
                    isGroup &&
                    groupMode &&
                    typeof groupMode.isAdminOnly === "function" &&
                    groupMode.isAdminOnly(from) &&
                    !isPrivileged
                ) {
                    let admin = false;
                    try {
                        const meta = await sock.groupMetadata(from);
                        const list = meta.participants || [];
                        for (let i = 0; i < list.length; i++) {
                            const p = list[i];
                            const id = p.id || p.jid || "";
                            if (
                                numberFromJid(id) === senderNum ||
                                id === sender
                            ) {
                                if (p.admin === "admin" || p.admin === "superadmin") {
                                    admin = true;
                                }
                                break;
                            }
                        }
                    } catch (e) {}
                    if (!admin) continue;
                }

                // private mode
                if (
                    settings.mode === "private" &&
                    !isPrivileged
                ) {
                    continue;
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
                        senderPn: senderNum,
                        participantPn: senderNum,
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
                    const errText = String(
                        (err && err.message) || err || "Unknown error"
                    ).slice(0, 280);
                    await sock
                        .sendMessage(
                            from,
                            {
                                text:
`╭━━〔 ❌ VENOM ERROR 〕━━⬣
┃
┃ Command: *\( {prefix} \){commandName}*
┃
┃ ${errText}
┃
╰━━━━━━━━━━━━━━━━⬣`
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
