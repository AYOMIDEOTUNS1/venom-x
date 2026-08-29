const botState = require("../lib/botState");

module.exports = {
    name: "refresh",
    aliases: ["clearcache", "reloadmem"],

    run: async ({ sock, reply, isOwner }) => {
        if (!isOwner) return reply("❌ Owner only.");

        botState.refreshBot();

        // Reload commands if available
        try {
            if (typeof sock.reloadCommands === "function") {
                sock.reloadCommands();
            }
        } catch {}

        // Clear global processed-message memory if present
        try {
            if (global.processedMessages && typeof global.processedMessages.clear === "function") {
                global.processedMessages.clear();
            }
        } catch {}

        return reply(
`╭━━〔 🔄 VENOM X REFRESH 〕━━⬣

✅ Bot memory refreshed
✅ Command cache reloaded
✅ Spam buffer cleared

╰━━━━━━━━━━━━━━━━⬣`
        );
    }
};
