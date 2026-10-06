/**
 * VENOM X - entry (Baileys 7)
 * Telegram: startTelegramBot from ./telegram/bot
 * Auto pinger for Render keep-alive
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

// ---------- AUTO PINGER ----------
const PING_URL =
    process.env.PING_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    "";
const PING_MS = Number(process.env.PING_INTERVAL_MS) || 10 * 60 * 1000;

if (PING_URL) {
    setInterval(function () {
        fetch(PING_URL).catch(function () {});
    }, PING_MS);
    // first ping after 30s
    setTimeout(function () {
        fetch(PING_URL).catch(function () {});
    }, 30000);
    console.log("🏓 Auto pinger every", Math.round(PING_MS / 60000), "min →", PING_URL);
} else {
    console.log("🏓 Auto pinger off (set PING_URL or RENDER_EXTERNAL_URL)");
}

const AUTH_DIR =
    process.env.AUTH_DIR || path.join(__dirname, "auth_info_baileys");
const logger = pino({ level: process.env.LOG_LEVEL || "silent" });

let sock = null;
let baileys = null;
let reconnectTimer = null;

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

async function loadBaileys() {
    if (baileys) return baileys;
    baileys = await import("@whiskeysockets/baileys");
    return baileys;
}

function bindHandlers(socket) {
    try {
        const messagesHandler = require("./handlers/messages");
        messagesHandler(socket);
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

async function startBot() {
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
        throw new Error("makeWASocket not found in Baileys export");
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    let version;
    try {
        const v = await fetchLatestBaileysVersion();
        version = v.version;
        console.log("📲 WA Web version:", version.join("."));
    } catch (e) {
        console.log("⚠️ fetchLatestBaileysVersion failed, using default");
    }

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
        const qr = update.qr;

        if (qr) {
            console.log("🔑 QR received — scan or use pairing code flow");
            try {
                const qrcode = require("qrcode-terminal");
                qrcode.generate(qr, { small: true });
            } catch (e) {}
        }

        if (connection === "open") {
            console.log("✅ VENOM X connected");
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
                statusCode === DisconnectReason.loggedOut ||
                statusCode === 401;

            console.log("❌ Connection closed. code:", statusCode);

            if (loggedOut) {
                console.log("🚪 Logged out — delete auth and pair again");
                return;
            }

            if (!reconnectTimer) {
                reconnectTimer = setTimeout(function () {
                    reconnectTimer = null;
                    console.log("🔄 Reconnecting...");
                    startBot().catch(function (err) {
                        console.log("Reconnect failed:", err.message);
                    });
                }, 4000);
            }
        }
    });

    bindHandlers(sock);

    try {
        const tg = require("./telegram/bot");
        if (tg && typeof tg.startTelegramBot === "function") {
            console.log("📲 Starting Telegram...");
            Promise.resolve(tg.startTelegramBot(sock)).catch(function (err) {
                console.log(
                    "❌ Telegram failed:",
                    err && err.message ? err.message : err
                );
            });
        } else {
            console.log("⚠️ startTelegramBot not found on telegram/bot");
        }
    } catch (e) {
        console.log("❌ Telegram require failed:", e.message);
    }

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
