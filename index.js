"use strict";

/**
 * VENOM X — single entry (Botkeep / Pterodactyl / Render)
 * Fixes packed here:
 *  - AUTH_DIR that works on /home/container (not /data)
 *  - Only ONE Telegram poller (stops 409 if nothing else runs)
 *  - Only ONE WhatsApp start
 *  - Backoff on 408 / 515 / 401
 *  - Clear logs for pair / host limits
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const http = require("http");
const pino = require("pino");

const PORT = process.env.PORT || 3000;
const logger = pino({ level: process.env.LOG_LEVEL || "silent" });

// ─── globals: prevent double start ───────────────────────────
if (!global.__VENOM) {
    global.__VENOM = {
        tgStarted: false,
        waStarting: false,
        sock: null,
        baileys: null,
        reconnectTimer: null,
        waitTimer: null
    };
}

// ─── AUTH DIR (Botkeep-safe) ─────────────────────────────────
function resolveAuthDir() {
    const candidates = [
        process.env.AUTH_DIR,
        path.join(process.cwd(), "auth_info_baileys"),
        path.join(__dirname, "auth_info_baileys"),
        path.join("/home/container", "auth_info_baileys")
    ].filter(Boolean);

    for (let i = 0; i < candidates.length; i++) {
        const dir = path.resolve(String(candidates[i]));
        try {
            // never use broken /data on pterodactyl unless it exists
            if (dir === "/data" || dir.startsWith("/data/")) {
                try {
                    fs.accessSync("/data", fs.constants.W_OK);
                } catch (e) {
                    continue;
                }
            }
            fs.mkdirSync(dir, { recursive: true });
            fs.accessSync(dir, fs.constants.W_OK);
            return dir;
        } catch (e) {
            console.log("⚠️ AUTH skip:", dir, e.message);
        }
    }

    const fallback = path.join(process.cwd(), "auth_info_baileys");
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
}

const AUTH_DIR = resolveAuthDir();
console.log("📁 AUTH_DIR =", AUTH_DIR);

// ─── HTTP keep-alive ─────────────────────────────────────────
http
    .createServer(function (req, res) {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("VENOM X online\n");
    })
    .listen(PORT, function () {
        console.log("🌐 HTTP on port " + PORT);
    });

// ─── helpers ─────────────────────────────────────────────────
function hasCreds() {
    try {
        return fs.existsSync(path.join(AUTH_DIR, "creds.json"));
    } catch (e) {
        return false;
    }
}

async function loadBaileys() {
    if (global.__VENOM.baileys) return global.__VENOM.baileys;
    global.__VENOM.baileys = await import("@whiskeysockets/baileys");
    return global.__VENOM.baileys;
}

function scheduleReconnect(reason, ms) {
    if (global.__VENOM.reconnectTimer) return;
    const delay = ms || 20000;
    console.log(
        "🔄 Reconnect in " + Math.round(delay / 1000) + "s (" + reason + ")"
    );
    global.__VENOM.reconnectTimer = setTimeout(function () {
        global.__VENOM.reconnectTimer = null;
        startWhatsApp().catch(function (err) {
            console.log("Reconnect failed:", err.message);
            scheduleReconnect("error", 25000);
        });
    }, delay);
}

function startWaitLog() {
    if (global.__VENOM.waitTimer) return;
    global.__VENOM.waitTimer = setInterval(function () {
        console.log("⏳ WA waiting — pair 2347077417996 from Telegram (no QR)");
    }, 60000);
}

function stopWaitLog() {
    if (global.__VENOM.waitTimer) {
        clearInterval(global.__VENOM.waitTimer);
        global.__VENOM.waitTimer = null;
    }
}

function bindHandlers(sock) {
    try {
        require("./handlers/messages")(sock);
    } catch (e) {
        console.log("⚠️ messages:", e.message);
    }
    ["./handlers/antilink", "./handlers/antistatustag"].forEach(function (p) {
        try {
            const h = require(p);
            if (typeof h === "function") h(sock);
        } catch (e) {}
    });
}

// ─── Telegram ONCE only ──────────────────────────────────────
function startTelegramOnce(sock) {
    if (global.__VENOM.tgStarted) {
        console.log("📲 Telegram already running — skip");
        return;
    }
    try {
        const tg = require("./telegram/bot");
        if (typeof tg.startTelegramBot === "function") {
            tg.startTelegramBot(sock);
            global.__VENOM.tgStarted = true;
            console.log("📱 Telegram started (single instance)");
        } else if (typeof tg.start === "function") {
            tg.start(sock);
            global.__VENOM.tgStarted = true;
            console.log("📱 Telegram started (single instance)");
        } else {
            console.log("⚠️ telegram/bot has no start export");
        }
    } catch (e) {
        console.log("⚠️ Telegram:", e.message);
    }
}

// ─── WhatsApp ────────────────────────────────────────────────
async function startWhatsApp() {
    if (global.__VENOM.waStarting) return;
    global.__VENOM.waStarting = true;

    try {
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
            console.log("📲 WA Web version:", (version || []).join("."));
        } catch (e) {
            version = [2, 3000, 1015901307];
        }

        const sock = makeWASocket({
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

        global.__VENOM.sock = sock;
        global.sock = sock;

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", function (update) {
            const { connection, lastDisconnect } = update;

            if (connection === "open") {
                stopWaitLog();
                console.log("✅ WhatsApp connected");
                return;
            }

            if (connection === "close") {
                const code =
                    lastDisconnect &&
                    lastDisconnect.error &&
                    lastDisconnect.error.output &&
                    lastDisconnect.error.output.statusCode;

                console.log("❌ WhatsApp closed. code:", code);

                // logged out — stop tight loop
                if (
                    code === DisconnectReason.loggedOut ||
                    code === 401
                ) {
                    console.log(
                        "🚪 Logged out (401). Delete auth folder + pair again from Telegram."
                    );
                    stopWaitLog();
                    startWaitLog();
                    return;
                }

                // 515 = restart required after pair — reconnect fast
                if (code === 515) {
                    scheduleReconnect("515", 5000);
                    return;
                }

                // 408 timeout
                if (code === 408 || code === 428) {
                    scheduleReconnect(String(code), 20000);
                    return;
                }

                scheduleReconnect(String(code || "close"), 15000);
            }
        });

        bindHandlers(sock);
        startTelegramOnce(sock);

        if (!(state.creds && state.creds.registered)) {
            startWaitLog();
            console.log(
                "⏳ No WA session — pair 2347077417996 from Telegram"
            );
        } else {
            console.log("📂 Using saved session in", AUTH_DIR);
        }
    } finally {
        global.__VENOM.waStarting = false;
    }
}

// ─── boot ────────────────────────────────────────────────────
console.log("═══════════════════════════════════════");
console.log(" VENOM X boot");
console.log(" AUTH:", AUTH_DIR);
console.log(" NOTE: Telegram 409 = another process still uses the same bot token");
console.log(" NOTE: TikTok 403 on Botkeep = host blocked TikWM (use Render/VPS)");
console.log("═══════════════════════════════════════");

startWhatsApp().catch(function (err) {
    console.error("FATAL:", err.message || err);
    scheduleReconnect("fatal", 15000);
});

process.on("unhandledRejection", function (err) {
    const msg = err && err.message ? err.message : String(err);
    // don't spam axios 403 stacks
    if (/status code 403/.test(msg)) {
        console.log(
            "⛔ Outbound 403 (host blocked API). TikTok/etc will fail on this server."
        );
        return;
    }
    console.log("unhandledRejection:", msg);
});

process.on("uncaughtException", function (err) {
    console.log(
        "uncaughtException:",
        err && err.message ? err.message : err
    );
});
