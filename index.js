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
