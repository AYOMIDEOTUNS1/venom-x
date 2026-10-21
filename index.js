"use strict";

/**
 * VENOM X — entry (Baileys 7 + Telegram pair + pinger + relay cache)
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const http = require("http");
const pino = require("pino");

const PORT = process.env.PORT || 3000;
const AUTH_DIR =
    process.env.AUTH_DIR || path.join(__dirname, "auth_info_baileys");
const PING_URL = process.env.PING_URL || process.env.RENDER_EXTERNAL_URL || "";
const PING_MS = Number(process.env.PING_MS || 4 * 60 * 1000);

const logger = pino({ level: process.env.LOG_LEVEL || "silent" });

let sock = null;
let baileys = null;
let reconnectTimer = null;
let telegramStarted = false;

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// keep host awake
const server = http.createServer(function (req, res) {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("VENOM X online\n");
});
server.listen(PORT, function () {
    console.log("🌐 HTTP server on port " + PORT);
});

if (PING_URL) {
    setInterval(function () {
        try {
            const u = PING_URL.replace(/\/$/, "") + "/";
            http.get(u, function (r) {
                r.resume();
            }).on("error", function () {});
        } catch (e) {}
    }, PING_MS);
    console.log("🔁 Auto pinger every " + PING_MS + "ms");
}

async function loadBaileys() {
    if (baileys) return baileys;
    baileys = await import("@whiskeysockets/baileys");
    return baileys;
}

function wrapRelayCache(socket, proto) {
    if (!global.completeMessageCache) {
        global.completeMessageCache = new Map();
    }
    if (socket.__relayWrapped) return;
    socket.__relayWrapped = true;

    const orig = socket.relayMessage.bind(socket);
    socket.relayMessage = async function (jid, message, options) {
        options = options || {};
        const result = await orig(jid, message, options);
        try {
            const messageId = options.messageId || result;
            if (jid && messageId && typeof messageId === "string" && message) {
                let rawBytes;
                try {
                    rawBytes = Buffer.from(proto.Message.encode(message).finish());
                } catch (e) {
                    rawBytes = Buffer.from(
                        proto.Message.encode(
                            proto.Message.fromObject(message)
                        ).finish()
                    );
                }
                global.completeMessageCache.set(jid + ":" + messageId, rawBytes);
                while (global.completeMessageCache.size > 1000) {
                    const old = global.completeMessageCache.keys().next().value;
                    global.completeMessageCache.delete(old);
                }
            }
        } catch (e) {}
        return result;
    };
}

function bindHandlers(socket) {
    try {
        require("./handlers/messages")(socket);
    } catch (e) {
        console.log("⚠️ messages handler:", e.message);
    }
    const optional = ["./handlers/antilink", "./handlers/antistatustag"];
    for (let i = 0; i < optional.length; i++) {
        try {
            const h = require(optional[i]);
            if (typeof h === "function") h(socket);
            else if (h && typeof h.bind === "function") h.bind(socket);
        } catch (e) {}
    }
}

function startTelegram(socket) {
    if (telegramStarted) {
        console.log("📲 Telegram already running — skip");
        return;
    }
    try {
        const tg = require("./telegram/bot");
        if (tg && typeof tg.startTelegramBot === "function") {
            tg.startTelegramBot(socket);
            telegramStarted = true;
            console.log("📲 Telegram started");
        } else if (tg && typeof tg.start === "function") {
            tg.start(socket);
            telegramStarted = true;
        }
    } catch (e) {
        console.log("📲 Telegram skip:", e.message);
    }
}

async function startBot() {
    const B = await loadBaileys();
    const {
        default: makeWASocket,
        useMultiFileAuthState,
        DisconnectReason,
        fetchLatestBaileysVersion,
        proto
    } = B;

    ensureDir(AUTH_DIR);
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    let version;
    try {
        const v = await fetchLatestBaileysVersion();
        version = v.version;
        console.log("📲 WA Web version:", version.join("."));
    } catch (e) {
        console.log("📲 WA version fetch failed, using default");
    }

    sock = makeWASocket({
        auth: state,
        logger: logger,
        version: version,
        printQRInTerminal: false,
        syncFullHistory: false,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: true
    });

    wrapRelayCache(sock, proto);
    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", function (update) {
        const { connection, lastDisconnect, qr } = update || {};

        if (qr) {
            console.log("⏳ WA waiting — pair from Telegram (no QR printed)");
        }

        if (connection === "open") {
            console.log("✅ WhatsApp connected");
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
        }

        if (connection === "close") {
            const statusCode =
                lastDisconnect &&
                lastDisconnect.error &&
                lastDisconnect.error.output &&
                lastDisconnect.error.output.statusCode;

            const loggedOut =
                statusCode === DisconnectReason.loggedOut || statusCode === 401;

            console.log("❌ WhatsApp closed. code:", statusCode);

            if (loggedOut) {
                console.log("🚪 Logged out — re-pair from Telegram");
                return;
            }

            if (!reconnectTimer) {
                const delay = statusCode === 403 ? 40000 : 5000;
                reconnectTimer = setTimeout(function () {
                    reconnectTimer = null;
                    console.log("🔄 Reconnecting WhatsApp...");
                    startBot().catch(function (err) {
                        console.log("Reconnect failed:", err.message);
                    });
                }, delay);
            }
        }
    });

    bindHandlers(sock);
    startTelegram(sock);
    global.sock = sock;
    return sock;
}

startBot().catch(function (err) {
    console.error("FATAL start error:", err);
    process.exit(1);
});

process.on("unhandledRejection", function (err) {
    console.log(
        "unhandledRejection:",
        err && err.message ? err.message : err
    );
});

process.on("uncaughtException", function (err) {
    console.log(
        "uncaughtException:",
        err && err.message ? err.message : err
    );
});
