/**
 * VENOM X - entry (Baileys 7 compatible)
 * Botkeep-friendly: quiet logs, backoff reconnect, single wait notice
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

const AUTH_DIR =
    process.env.AUTH_DIR || path.join(__dirname, "auth_info_baileys");
const logger = pino({ level: process.env.LOG_LEVEL || "silent" });

let sock = null;
let baileys = null;
let reconnectTimer = null;
let starting = false;
let waitNoticeShown = false;
let reconnectAttempt = 0;

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function hasSessionFiles() {
    try {
        if (!fs.existsSync(AUTH_DIR)) return false;
        const files = fs.readdirSync(AUTH_DIR);
        return files.some(function (f) {
            return f.endsWith(".json");
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
            else if (h && typeof h.bind === "function") h.bind(socket);
        } catch (e) {}
    }
}

function scheduleReconnect(reason) {
    if (reconnectTimer) return;

    reconnectAttempt += 1;
    // 5s, 10s, 20s... cap 60s
    const delay = Math.min(60000, 5000 * Math.pow(2, Math.min(reconnectAttempt - 1, 3)));

    console.log(
        "🔄 Reconnect in " + Math.round(delay / 1000) + "s" +
            (reason ? " (" + reason + ")" : "")
    );

    reconnectTimer = setTimeout(function () {
        reconnectTimer = null;
        startBot().catch(function (err) {
            console.log("Reconnect failed:", err && err.message ? err.message : err);
            scheduleReconnect("start failed");
        });
    }, delay);
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
            fetchLatestBaileysVersion
        } = B;

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

        let version;
        try {
            const ver = await fetchLatestBaileysVersion();
            version = ver.version;
            console.log("📲 WA Web version:", version.join("."));
        } catch (e) {
            console.log("📲 WA version fetch failed, using default");
        }

        if (sock) {
            try {
                sock.ev.removeAllListeners();
                sock.end(undefined);
            } catch (e) {}
            sock = null;
        }

        sock = makeWASocket({
            version: version,
            auth: state,
            logger: logger,
            printQRInTerminal: false,
            browser: ["VENOM X", "Chrome", "120.0.0"],
            syncFullHistory: false,
            markOnlineOnConnect: false,
            generateHighQualityLinkPreview: false
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", function (update) {
            const connection = update.connection;
            const lastDisconnect = update.lastDisconnect;
            const qr = update.qr;

            if (qr) {
                // pairing-code flow via Telegram — don't spam QR
                if (!waitNoticeShown) {
                    waitNoticeShown = true;
                    console.log("⏳ WA waiting — pair from Telegram");
                }
            }

            if (connection === "open") {
                waitNoticeShown = false;
                reconnectAttempt = 0;
                console.log("✅ WhatsApp connected");
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

                // only log meaningful closes
                if (statusCode && statusCode !== 408) {
                    console.log("❌ WhatsApp closed. code:", statusCode);
                } else if (statusCode === 408 && hasSessionFiles()) {
                    // session exists but timed out — quiet reconnect
                    console.log("❌ WA timeout (408) — retrying…");
                } else if (statusCode === 408 && !hasSessionFiles()) {
                    if (!waitNoticeShown) {
                        waitNoticeShown = true;
                        console.log("⏳ WA waiting — pair from Telegram");
                    }
                } else {
                    console.log("❌ WhatsApp closed. code:", statusCode);
                }

                if (loggedOut) {
                    console.log("🚪 Logged out — delete auth and pair again");
                    waitNoticeShown = false;
                    return;
                }

                scheduleReconnect(statusCode ? String(statusCode) : "close");
            }

            // no session yet → one notice only
            if (
                connection !== "open" &&
                !hasSessionFiles() &&
                !waitNoticeShown
            ) {
                waitNoticeShown = true;
                console.log("⏳ WA waiting — pair from Telegram");
            }
        });

        bindHandlers(sock);

        // Telegram bridge (once)
        try {
            const tg = require("./telegram/bot");
            if (tg && typeof tg.startTelegramBot === "function") {
                if (!global.__VENOM_TG_STARTED) {
                    global.__VENOM_TG_STARTED = true;
                    console.log("📲 Starting Telegram...");
                    tg.startTelegramBot(sock);
                } else {
                    // already up — optional rebind sock if your bot supports it
                    if (typeof tg.setSock === "function") tg.setSock(sock);
                }
            }
        } catch (e) {
            console.log("⚠️ Telegram:", e.message);
        }

        global.sock = sock;
        return sock;
    } finally {
        starting = false;
    }
}

startBot().catch(function (err) {
    console.error("FATAL start error:", err);
    scheduleReconnect("fatal");
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
