// commands/shutdown.js
module.exports = {
    name: "shutdown",
    aliases: ["stopbot", "off"],

    run: async ({ reply, isOwner }) => {
        if (!isOwner) {
            return reply("❌ Owner only.");
        }

        await reply(
`╭━━〔 🛑 VENOM X SHUTDOWN 〕━━⬣

✅ WhatsApp bot is shutting down...

╰━━━━━━━━━━━━━━━━⬣`
        );

        try {
            // If multi-session manager exists, disconnect WA sessions only
            const sessionManager = require("../telegram/sessionManager");
            const list = sessionManager.listActiveSessions?.() || [];

            for (const s of list) {
                try {
                    await sessionManager.disconnectUser(s.telegramUserId, { wipeAuth: false });
                } catch {}
            }

            console.log("🛑 WhatsApp sessions disconnected (Telegram still running)");
        } catch (err) {
            // Single-user mode fallback: just log
            console.log("🛑 Shutdown requested:", err.message);
        }
    }
};
