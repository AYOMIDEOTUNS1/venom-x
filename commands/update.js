const { isOwnerContext } = require("../lib/ownerCheck");

module.exports = {
    name: "update",

    run: async function (ctx) {
        const { sock, from, message, reply } = ctx;

        if (!isOwnerContext(ctx)) {
            return reply("❌ Only the VENOM X owner can use #update.");
        }

        if (typeof sock.reloadCommands !== "function") {
            return reply("❌ Command reload system is not available.");
        }

        try {
            await reply("🔄 Reloading VENOM X commands...");
            sock.reloadCommands();
            return reply(
"╭━━〔 🔄 VENOM X UPDATE 〕━━⬣\n" +
"┃\n" +
"┃ ✅ Commands reloaded\n" +
"┃ ⚡ VENOM X is updated\n" +
"┃ 🚀 No restart required\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            );
        } catch (err) {
            console.log("UPDATE ERROR:", err.message);
            return reply("❌ UPDATE ERROR: " + err.message);
        }
    }
};
