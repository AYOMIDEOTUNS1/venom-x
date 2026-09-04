require("dotenv").config();

const http = require("http");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const PORT = Number(process.env.PORT) || 10000;
const SESSIONS_ROOT = path.join(process.cwd(), "sessions");

console.log("🐍 VENOM X — Telegram Pairing Service");
console.log("🔐 License system enabled");
console.log("📱 Multi-number WhatsApp sessions enabled");

function startHealthServer() {
    const server = http.createServer(function (req, res) {
        const url = String(req.url || "/").split("?")[0];
        if (url === "/" || url === "/ping" || url === "/health") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                ok: true,
                service: "VENOM X",
                uptime: Math.floor(process.uptime()),
                time: new Date().toISOString()
            }));
            return;
        }
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
    });

    server.listen(PORT, "0.0.0.0", function () {
        console.log("VENOM X health server listening on 0.0.0.0:" + PORT);

        if (process.env.RENDER_EXTERNAL_URL) {
            console.log("🔄 Auto-ping enabled for Render");
            setInterval(function () {
                axios
                    .get(String(process.env.RENDER_EXTERNAL_URL).replace(/\/$/, "") + "/ping", {
                        timeout: 15000
                    })
                    .then(function () { console.log("✅ Ping successful"); })
                    .catch(function () { console.log("⚠️ Ping failed"); });
            }, 14 * 60 * 1000);
        }
    });

    server.on("error", function (err) {
        console.log("⚠️ Health server error:", err.message);
    });
}

function startTelegram() {
    try {
        const botModule = require(path.join(__dirname, "telegram", "bot.js"));
        const startFn =
            typeof botModule === "function"
                ? botModule
                : botModule && botModule.startTelegramBot;

        if (!startFn) {
            console.log("⚠️ telegram/bot.js has no startTelegramBot export.");
            return;
        }

        const result = startFn();
        if (result !== null && process.env.TELEGRAM_BOT_TOKEN) {
            console.log("📱 VENOM X Telegram bot ready");
        }
    } catch (err) {
        console.log("❌ Telegram start error:", err.message);
    }
}

/** Restore all saved WhatsApp sessions from disk after reboot/deploy */
async function restoreSavedSessions() {
    try {
        const sm = require(path.join(__dirname, "telegram", "sessionManager.js"));

        if (!fs.existsSync(SESSIONS_ROOT)) {
            console.log("♻️ No sessions folder yet — waiting for /pair");
            return;
        }

        const userDirs = fs.readdirSync(SESSIONS_ROOT, { withFileTypes: true })
            .filter(function (d) { return d.isDirectory(); })
            .map(function (d) { return d.name; });

        if (!userDirs.length) {
            console.log("♻️ No saved Telegram users on disk");
            return;
        }

        console.log("♻️ Restoring sessions for " + userDirs.length + " Telegram user(s)...");

        for (let i = 0; i < userDirs.length; i++) {
            const uid = userDirs[i];
            let phones = [];

            try {
                if (typeof sm.listSavedSessions === "function") {
                    phones = sm.listSavedSessions(uid) || [];
                } else {
                    const userPath = path.join(SESSIONS_ROOT, uid);
                    phones = fs.readdirSync(userPath, { withFileTypes: true })
                        .filter(function (d) { return d.isDirectory(); })
                        .map(function (d) { return d.name; });
                }
            } catch (e) {
                console.log("⚠️ listSavedSessions failed for " + uid + ":", e.message);
                continue;
            }

            for (let j = 0; j < phones.length; j++) {
                const phone = String(phones[j]);
                console.log("♻️ [" + uid + "/" + phone + "] restoring...");

                try {
                    await sm.createSocket(uid, phone, function (text) {
                        // no Telegram chat notify on silent restore
                        console.log("♻️ [" + uid + "/" + phone + "] " + String(text || "").slice(0, 120));
                    });
                } catch (err) {
                    console.log("❌ [" + uid + "/" + phone + "] restore failed:", err.message);
                }
            }
        }

        console.log("♻️ Restore pass finished");
    } catch (err) {
        console.log("⚠️ restoreSavedSessions:", err.message);
    }
}

process.on("unhandledRejection", function (reason) {
    console.log("⚠️ UNHANDLED REJECTION:", (reason && reason.message) || reason);
});

process.on("uncaughtException", function (error) {
    console.log("⚠️ UNCAUGHT EXCEPTION:", (error && error.message) || error);
});

process.once("SIGINT", function () {
    console.log("🛑 SIGINT");
    process.exit(0);
});

process.once("SIGTERM", function () {
    console.log("🛑 SIGTERM");
    process.exit(0);
});

startHealthServer();
startTelegram();

// delay restore so Telegram is up first
setTimeout(function () {
    restoreSavedSessions().catch(function (e) {
        console.log("⚠️ restore error:", e.message);
    });
}, 3000);
