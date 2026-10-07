/**
 * VENOM X - Baileys 7
 * Telegram once | no QR | pinger | handlers
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const http = require("http");
const pino = require("pino");

const PORT = process.env.PORT || 3000;

const server = http.createServer(function (req, res) {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("VENOM X online\n");
});
server.listen(PORT, function () {
    console.log("🌐 HTTP server on port " + PORT);
});

const PING_URL =
    process.env.PING_URL || process.env.RENDER_EXTERNAL_URL || "";
const PING_MS = Number(process.env.PING_INTERVAL_MS) || 10 * 60 * 1000;

if (PING_URL) {
    setInterval(function () {
        fetch(PING_URL).catch(function () {});
    }, PING_MS);
    setTimeout(function () {
        fetch(PING_URL).catch(function () {});
    }, 30000);
    console.log("🏓 Auto pinger →", PING_URL);
}

const AUTH_DIR =
    process.env.AUTH_DIR || path.join(__dirname, "auth_info_baileys");
const logger = pino({ level: process.env.LOG_LEVEL || "silent" });

let sock = null;
let baileys = null;
let reconnectTimer = null;
let telegramStarted = false;
let starting = false;

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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

    ["./handlers/antilink", "./handlers/antistatustag"].forEach(function (p) {
        try {
            const h = require(p);
            if (typeof h === "function") h(socket);
        } catch (e) {}
    });
}

function startTelegramOnce(socket) {
    if (telegramStarted) {
        console.log("📲 Telegram already running — skip");
        return;
    }
    try {
        const tg = require("./telegram/bot");
        if (tg && typeof tg.startTelegramBot === "function") {
            telegramStarted = true;
            console.log("📲 Starting Telegram...");
            Promise.resolve(tg.startTelegramBot(socket)).catch(function (err) {
                telegramStarted = false;
                console.log("❌ Telegram failed:", err.message || err);
            });
        } else {
            console.log("⚠️ startTelegramBot not found");
        }
    } catch (e) {
        console.log("❌ Telegram require failed:", e.message);
    }
}

async function startBot() {
    if (starting) return;
    starting = true;

    try {
        ensureDir(AUTH_DIR);
        const B = await loadBaileys();

        const makeWASocket =
            B.default ||
            B.makeWASocket ||
            (B.default && B.default.makeWASocket);

        const {
            useMultiFileAuthState,
            DisconnectReason,
            fetchLatestBaileysVersion,
            makeCacheableSignalKeyStore,
            Browsers
        } = B;

        if (typeof makeWASocket !== "function") {
            throw new Error("makeWASocket not found");
        }

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

        let version;
        try {
            const v = await fetchLatestBaileysVersion();
            version = v.version;
            console.log("📲 WA Web version:", version.join("."));
        } catch (e) {}

        sock = makeWASocket({
            version: version,
            logger: logger,
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore
                    ? makeCacheableSignalKeyStore(state.keys, logger)
                    : state.keys
            },
            browser:
                Browsers && Browsers.ubuntu
                    ? Browsers.ubuntu("Chrome")
                    : ["VENOM-X", "Chrome", "120.0.0"],
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            getMessage: async function () {
                return undefined;
            }
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async function (update) {
            const connection = update.connection;
            const lastDisconnect = update.lastDisconnect;

            if (update.qr) {
                console.log("⏳ WA waiting — pair from Telegram");
            }

            if (connection === "open") {
                console.log("✅ VENOM X WhatsApp connected");
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

                console.log("❌ WhatsApp closed. code:", statusCode);

                if (
                    statusCode === DisconnectReason.loggedOut ||
                    statusCode === 401
                ) {
                    console.log("🚪 Logged out — pair again from Telegram");
                    return;
                }

                if (!reconnectTimer) {
                    reconnectTimer = setTimeout(function () {
                        reconnectTimer = null;
                        starting = false;
                        console.log("🔄 Reconnecting WhatsApp...");
                        startBot().catch(function (err) {
                            starting = false;
                            console.log("Reconnect failed:", err.message);
                        });
                    }, 5000);
                }
            }
        });

        bindHandlers(sock);
        startTelegramOnce(sock);
        global.sock = sock;
    } finally {
        starting = false;
    }

    return sock;
}

startBot().catch(function (err) {
    console.error("FATAL:", err);
    process.exit(1);
});

process.on("unhandledRejection", function (err) {
    console.log("unhandledRejection:", err && err.message ? err.message : err);
});
process.on("uncaughtException", function (err) {
    console.log("uncaughtException:", err && err.message ? err.message : err);
});
