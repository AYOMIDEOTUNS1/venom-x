require("dotenv").config();

const http = require("http");
const axios = require("axios");
const path = require("path");

const PORT = Number(process.env.PORT) || 10000;

console.log("🐍 VENOM X — Telegram Pairing Service");
console.log("🔐 License system enabled");
console.log("📱 Multi-number WhatsApp sessions enabled");

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
        console.log("VENOM X health server listening on 0.0.0.0:" + PORT);

        if (process.env.RENDER_EXTERNAL_URL) {
            console.log("🔄 Auto-ping enabled for Render");
            setInterval(function () {
                axios
                    .get(String(process.env.RENDER_EXTERNAL_URL).replace(/\/$/, "") + "/ping", {
                        timeout: 15000
                    })
                    .then(function () {
                        console.log("✅ Ping successful");
                    })
                    .catch(function () {
                        console.log("⚠️ Ping failed");
                    });
            }, 14 * 60 * 1000);
        }
    });

    server.on("error", function (err) {
        console.log("⚠️ Health server error:", err.message);
    });
}

/* ============================================================
   TELEGRAM BOT
   ============================================================ */

function startTelegram() {
    try {
        const botPath = path.join(__dirname, "telegram", "bot.js");
        const botModule = require(botPath);

        const startFn =
            typeof botModule === "function"
                ? botModule
                : botModule && typeof botModule.startTelegramBot === "function"
                  ? botModule.startTelegramBot
                  : null;

        if (!startFn) {
            console.log("⚠️ telegram/bot.js has no startTelegramBot export.");
            return;
        }

        // bot.js reads TELEGRAM_BOT_TOKEN from process.env itself
        const result = startFn();

        if (result !== null && process.env.TELEGRAM_BOT_TOKEN) {
            console.log("📱 VENOM X Telegram bot started");
        }
    } catch (err) {
        console.log("❌ Telegram start error:", err.message);
    }
}

/* ============================================================
   PROCESS GUARDS
   ============================================================ */

process.on("unhandledRejection", function (reason) {
    console.log("⚠️ UNHANDLED REJECTION:", (reason && reason.message) || reason);
});

process.on("uncaughtException", function (error) {
    console.log("⚠️ UNCAUGHT EXCEPTION:", (error && error.message) || error);
});

process.once("SIGINT", function () {
    console.log("🛑 SIGINT — shutting down");
    process.exit(0);
});

process.once("SIGTERM", function () {
    console.log("🛑 SIGTERM — shutting down");
    process.exit(0);
});

/* ============================================================
   BOOT
   ============================================================ */

startHealthServer();
startTelegram();
