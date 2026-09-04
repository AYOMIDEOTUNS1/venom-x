require("dotenv").config();

const http = require("http");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const PORT = Number(process.env.PORT) || 10000;
const SESSIONS_ROOT = path.join(process.cwd(), "sessions");

/* ============================================================
   SILENCE BAD MAC / PREKEY / SIGNAL NOISE
   ============================================================ */

const SILENT_PATTERNS = [
    /bad mac/i,
    /failed to decrypt message/i,
    /session error/i,
    /closing open session in favor of incoming prekey/i,
    /closing session:/i,
    /SessionEntry/i,
    /pendingPreKey/i,
    /currentRatchet/i,
    /remoteIdentityKey/i,
    /chainKey/i,
    /messageKeys/i,
    /registrationId/i,
    /_chains/i,
    /PreKey/i,
    /prekey bundle/i
];

function shouldSilence(args) {
    try {
        const text = args
            .map(function (a) {
                if (a == null) return "";
                if (typeof a === "string") return a;
                if (a instanceof Error) return a.message || String(a);
                try {
                    return JSON.stringify(a);
                } catch (e) {
                    return String(a);
                }
            })
            .join(" ");

        for (let i = 0; i < SILENT_PATTERNS.length; i++) {
            if (SILENT_PATTERNS[i].test(text)) return true;
        }
        return false;
    } catch (e) {
        return false;
    }
}

const _log = console.log;
const _error = console.error;
const _warn = console.warn;
const _info = console.info;

console.log = function () {
    if (shouldSilence(Array.prototype.slice.call(arguments))) return;
    return _log.apply(console, arguments);
};

console.error = function () {
    if (shouldSilence(Array.prototype.slice.call(arguments))) return;
    return _error.apply(console, arguments);
};

console.warn = function () {
    if (shouldSilence(Array.prototype.slice.call(arguments))) return;
    return _warn.apply(console, arguments);
};

console.info = function () {
    if (shouldSilence(Array.prototype.slice.call(arguments))) return;
    return _info.apply(console, arguments);
};

/* ============================================================
   BOOT BANNER
   ============================================================ */

_log("🐍 VENOM X — Telegram Pairing Service");
_log("🔐 License system enabled");
_log("📱 Multi-number WhatsApp sessions enabled");
_log("🔇 Bad MAC / prekey logs silenced");

/* ============================================================
   HEALTH SERVER + RENDER KEEP-ALIVE
   ============================================================ */

function startHealthServer() {
    const server = http.createServer(function (req, res) {
        const url = String(req.url || "/").split("?")[0];

        if (url === "/" || url === "/ping" || url === "/health") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
                JSON.stringify({
                    ok: true,
                    service: "VENOM X",
                    uptime: Math.floor(process.uptime()),
                    time: new Date().toISOString()
                })
            );
            return;
        }

        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
    });

    server.listen(PORT, "0.0.0.0", function () {
        _log("VENOM X health server listening on 0.0.0.0:" + PORT);

        if (process.env.RENDER_EXTERNAL_URL) {
            _log("🔄 Auto-ping enabled for Render");
            setInterval(function () {
                axios
                    .get(
                        String(process.env.RENDER_EXTERNAL_URL).replace(/\/$/, "") +
                            "/ping",
                        { timeout: 15000 }
                    )
                    .then(function () {
                        _log("✅ Ping successful");
                    })
                    .catch(function () {
                        _log("⚠️ Ping failed");
                    });
            }, 14 * 60 * 1000);
        }
    });

    server.on("error", function (err) {
        _log("⚠️ Health server error:", err.message);
    });
}

/* ============================================================
   TELEGRAM (only one instance — don't run Termux + Render)
   ============================================================ */

function startTelegram() {
    try {
        const botModule = require(path.join(__dirname, "telegram", "bot.js"));
        const startFn =
            typeof botModule === "function"
                ? botModule
                : botModule && typeof botModule.startTelegramBot === "function"
                  ? botModule.startTelegramBot
                  : null;

        if (!startFn) {
            _log("⚠️ telegram/bot.js has no startTelegramBot export.");
            return;
        }

        const result = startFn();
        if (result !== null && process.env.TELEGRAM_BOT_TOKEN) {
            _log("📱 VENOM X Telegram bot ready");
        }
    } catch (err) {
        _log("❌ Telegram start error:", err.message);
    }
}

/* ============================================================
   RESTORE SAVED WHATSAPP SESSIONS
   ============================================================ */

async function restoreSavedSessions() {
    try {
        const sm = require(path.join(__dirname, "telegram", "sessionManager.js"));

        if (!fs.existsSync(SESSIONS_ROOT)) {
            _log("♻️ No sessions folder yet — waiting for /pair");
            return;
        }

        const userDirs = fs
            .readdirSync(SESSIONS_ROOT, { withFileTypes: true })
            .filter(function (d) {
                return d.isDirectory();
            })
            .map(function (d) {
                return d.name;
            });

        if (!userDirs.length) {
            _log("♻️ No saved Telegram users on disk");
            return;
        }

        _log("♻️ Restoring sessions for " + userDirs.length + " Telegram user(s)...");

        for (let i = 0; i < userDirs.length; i++) {
            const uid = userDirs[i];
            let phones = [];

            try {
                if (typeof sm.listSavedSessions === "function") {
                    phones = sm.listSavedSessions(uid) || [];
                } else {
                    const userPath = path.join(SESSIONS_ROOT, uid);
                    phones = fs
                        .readdirSync(userPath, { withFileTypes: true })
                        .filter(function (d) {
                            return d.isDirectory();
                        })
                        .map(function (d) {
                            return d.name;
                        });
                }
            } catch (e) {
                _log("⚠️ listSavedSessions failed for " + uid + ":", e.message);
                continue;
            }

            for (let j = 0; j < phones.length; j++) {
                const phone = String(phones[j]);
                _log("♻️ [" + uid + "/" + phone + "] restoring...");

                try {
                    await sm.createSocket(uid, phone, function (text) {
                        _log(
                            "♻️ [" +
                                uid +
                                "/" +
                                phone +
                                "] " +
                                String(text || "").slice(0, 120)
                        );
                    });
                } catch (err) {
                    _log(
                        "❌ [" + uid + "/" + phone + "] restore failed:",
                        err.message
                    );
                }
            }
        }

        _log("♻️ Restore pass finished");
    } catch (err) {
        _log("⚠️ restoreSavedSessions:", err.message);
    }
}

/* ============================================================
   PROCESS GUARDS
   ============================================================ */

process.on("unhandledRejection", function (reason) {
    if (shouldSilence([reason])) return;
    _log("⚠️ UNHANDLED REJECTION:", (reason && reason.message) || reason);
});

process.on("uncaughtException", function (error) {
    if (shouldSilence([error])) return;
    _log("⚠️ UNCAUGHT EXCEPTION:", (error && error.message) || error);
});

process.once("SIGINT", function () {
    _log("🛑 SIGINT — shutting down");
    process.exit(0);
});

process.once("SIGTERM", function () {
    _log("🛑 SIGTERM — shutting down");
    process.exit(0);
});

/* ============================================================
   START
   ============================================================ */

startHealthServer();
startTelegram();

setTimeout(function () {
    restoreSavedSessions().catch(function (e) {
        _log("⚠️ restore error:", e.message);
    });
}, 3000);
