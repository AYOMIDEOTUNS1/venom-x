"use strict";

/**
 * VENOM X - entry (Baileys 7)
 * - No QR in logs (pair from Telegram)
 * - Persistent AUTH_DIR
 * - Less reconnect spam when unpaired
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const http = require("http");
const pino = require("pino");

const PORT = process.env.PORT || 3000;
const AUTH_DIR =
    process.env.AUTH_DIR ||
    path.join(__dirname, "auth_info_baileys");

const logger = pino({ level: process.env.LOG_LEVEL || "silent" });

// keep host awake
http
    .createServer(function (req, res) {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("VENOM X online\n");
    })
    .listen(PORT, function () {
        console.log("🌐 HTTP on port " + PORT);
    });

let sock = null;
let baileys = null;
let reconnectTimer = null;
let waitLogTimer = null;
let starting = false;

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function hasAuthFiles() {
    try {
        if (!fs.existsSync(AUTH_DIR)) return false;
        const files = fs.readdirSync(AUTH_DIR);
        // multi-file auth: creds.json at least
        return files.some(function (f) {
            return f === "creds.json" || f.endsWith(".json");
        });
    } catch (e) {
        return false;
    }
}

async function loadBaileys() {
    if (baileys) return baileys;
    baileys = await import("@whiskeysockets/baileys");
    return baileys;
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
        } catch (e) {}
    }
}

function scheduleReconnect(reason, delayMs) {
    if (reconnectTimer) return;
    const ms = delayMs || 15000;
    console.log("🔄 Reconnect in " + Math.round(ms / 1000) + "s (" + reason + ")");
    reconnectTimer = setTimeout(function () {
        reconnectTimer = null;
        startBot().catch(function (err) {
            console.log("Reconnect failed:", err.message);
            scheduleReconnect("error", 20000);
        });
    }, ms);
}

function startWaitLog() {
    if (waitLogTimer) return;
    // log at most once per 60s while unpaired
    waitLogTimer = setInterval(function () {
        if (!hasAuthFiles()) {
            console.log("⏳ WA waiting — pair from Telegram (no session files yet)");
        }
    }, 60000);
}

function stopWaitLog() {
    if (waitLogTimer) {
        clearInterval(waitLogTimer);
        waitLogTimer = null;
    }
}

async function startBot() {
    if (starting) return;
    starting = true;

    try {
        ensureDir(AUTH_DIR);
        const B = await loadBaileys();
        const {
            default: makeWASocket,
            useMultiFileAuthState,
            DisconnectReason,
            fetchLatestBaileysVersion,
            makeCacheableSignalKeyStore
        } = B;

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        let version;
        try {
            const v = await fetchLatestBaileysVersion();
            version = v.version;
            console.log("📲 WA Web version:", version.join("."));
        } catch (e) {
            version = [2, 3000, 1015901307];
        }

        sock = makeWASocket({
            version: version,
            logger: logger,
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            browser: ["VENOM-X", "Chrome", "120.0.0"],
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 25000,
            getMessage: async function () {
                return undefined;
            }
        });

        global.sock = sock;
        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async function (update) {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                // pair code flow via Telegram — do not print QR
                startWaitLog();
            }

            if (connection === "open") {
                stopWaitLog();
                console.log("✅ WhatsApp connected");
                return;
            }

            if (connection === "close") {
                const statusCode =
                    lastDisconnect &&
                    lastDisconnect.error &&
                    lastDisconnect.error.output &&
                    lastDisconnect.error.output.statusCode;

                const loggedOut =
                    statusCode === DisconnectReason.loggedOut ||
                    statusCode === 401;

                console.log("❌ WhatsApp closed. code:", statusCode);

                if (loggedOut) {
                    console.log(
                        "🚪 Logged out — delete AUTH_DIR and pair again from Telegram"
                    );
                    stopWaitLog();
                    return; // do not tight-loop
                }

                // 408 / 515 / etc — backoff
                const delay =
                    statusCode === 408 || statusCode === 428
                        ? 20000
                        : statusCode === 515
                          ? 5000
                          : 15000;

                scheduleReconnect(String(statusCode || "close"), delay);
            }
        });

        bindHandlers(sock);

        // Telegram bridge (pair codes live here)
        try {
            const tg = require("./telegram/bot");
            if (tg && typeof tg.startTelegramBot === "function") {
                tg.startTelegramBot(sock);
                console.log("📲 Telegram bridge started");
            } else if (tg && typeof tg.start === "function") {
                tg.start(sock);
                console.log("📲 Telegram bridge started");
            }
        } catch (e) {
            console.log("⚠️ Telegram:", e.message);
        }

        if (!hasAuthFiles() || !(state.creds && state.creds.registered)) {
            startWaitLog();
            console.log("⏳ No registered session — pair from Telegram");
        }
    } finally {
        starting = false;
    }
}

startBot().catch(function (err) {
    console.error("FATAL:", err);
    scheduleReconnect("fatal", 15000);
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
