const originalConsoleError = console.error;
console.error = (...args) => {
    const text = args.map(a => String(a)).join(" ");
    if (
        text.includes("Bad MAC") ||
        text.includes("Failed to decrypt") ||
        text.includes("Session error") ||
        text.includes("Closing session:")
    ) {
        return;
    }
    originalConsoleError(...args);
};

require("dotenv").config();

const http = require("http");

const PORT = Number(process.env.PORT || 10000);
const HOST = "0.0.0.0";

const healthServer = http.createServer((req, res) => {
    if (req.url === "/" || req.url === "/health") {
        res.writeHead(200, {
            "Content-Type": "application/json"
        });

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
    console.log(`VENOM X health server listening on ${HOST}:${PORT}`);
});


const { startTelegramBot } = require("./telegram/bot");

console.log("🐍 VENOM X — Telegram Pairing Service");
console.log("🔐 License system enabled");
console.log("📱 Multi-number WhatsApp sessions enabled");

startTelegramBot();

process.on("unhandledRejection", reason => {
    console.log(
        "⚠️ UNHANDLED REJECTION:",
        reason?.message || reason
    );
});

process.on("uncaughtException", error => {
    console.log(
        "⚠️ UNCAUGHT EXCEPTION:",
        error?.message || error
    );
});
