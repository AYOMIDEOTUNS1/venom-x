const originalConsoleError = console.error;
console.error = (...args) => {
    const text = args.map(a => String(a)).join(" ");
    if (
        text.includes("Bad MAC") ||
        text.includes("Failed to decrypt") ||
        text.includes("Session error") ||
        text.includes("Closing session:") ||
        text.includes("Closing open session in favor of incoming prekey") ||
        text.includes("SessionEntry")
    ) {
        return;
    }
    originalConsoleError(...args);
};

const originalConsoleLog = console.log;
console.log = (...args) => {
    const text = args.map(a => String(a)).join(" ");
    if (
        text.includes("Bad MAC") ||
        text.includes("Failed to decrypt") ||
        text.includes("Session error") ||
        text.includes("Closing session:") ||
        text.includes("Closing open session in favor of incoming prekey") ||
        text.includes("SessionEntry")
    ) {
        return;
    }
    originalConsoleLog(...args);
};

require("dotenv").config();

const http = require("http");
const axios = require("axios");
const { startTelegramBot } = require("./telegram/bot");

const PORT = Number(process.env.PORT || 10000);
const HOST = "0.0.0.0";

const healthServer = http.createServer((req, res) => {
    if (req.url === "/" || req.url === "/health" || req.url === "/ping") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            status: "online",
            service: "VENOM X",
            telegram: "running"
        }));
        return;
    }
    res.writeHead(404);
    res.end("Not Found");
});

healthServer.listen(PORT, HOST, () => {
    console.log(`VENOM X health server listening on \( {HOST}: \){PORT}`);

    // Render free-tier keep-alive (only when RENDER_EXTERNAL_URL exists)
    if (process.env.RENDER_EXTERNAL_URL) {
        console.log("🔄 Auto-ping enabled for Render");
        setInterval(() => {
            axios
                .get(String(process.env.RENDER_EXTERNAL_URL).replace(/\/$/, "") + "/ping", {
                    timeout: 15000
                })
                .then(() => console.log("✅ Ping successful"))
                .catch(() => console.log("⚠️ Ping failed"));
        }, 14 * 60 * 1000);
    }
});

console.log("🐍 VENOM X — Telegram Pairing Service");
console.log("🔐 License system enabled");
console.log("📱 Multi-number WhatsApp sessions enabled");

startTelegramBot();

process.on("unhandledRejection", reason => {
    console.log("⚠️ UNHANDLED REJECTION:", reason?.message || reason);
});

process.on("uncaughtException", error => {
    console.log("⚠️ UNCAUGHT EXCEPTION:", error?.message || error);
});
