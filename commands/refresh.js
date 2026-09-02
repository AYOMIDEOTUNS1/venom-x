const botState = require("../lib/botState");
const { isOwnerContext } = require("../lib/ownerCheck");

module.exports = {
    name: "refresh",
    aliases: ["clearcache", "reloadmem"],

    run: async function (ctx) {
        const { sock, reply } = ctx;

        if (!isOwnerContext(ctx)) {
            return reply("❌ Owner only.");
        }

        botState.refreshBot();

        try {
            if (typeof sock.reloadCommands === "function") {
                sock.reloadCommands();
            }
        } catch (e) {}

        try {
            if (global.processedMessages && typeof global.processedMessages.clear === "function") {
                global.processedMessages.clear();
            }
        } catch (e) {}

        return reply(
"╭━━〔 🔄 VENOM X REFRESH 〕━━⬣\n\n" +
"✅ Bot memory refreshed\n" +
"✅ Command cache reloaded\n" +
"✅ Spam buffer cleared\n\n" +
"╰━━━━━━━━━━━━━━━━⬣"
        );
    }
};
