const botState = require("../lib/botState");

module.exports = {
    name: "up",
    aliases: ["wake", "awake"],

    run: async ({ reply, isOwner }) => {
        if (!isOwner) {
            return reply("❌ Owner only.");
        }

        if (!botState.isSleeping()) {
            return reply(
`╭━━〔 💚 VENOM X 〕━━⬣

⚠️ Bot is already awake.

⚡ Status : ONLINE

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        botState.wakeBot();

        return reply(
`╭━━〔 💚 VENOM X AWAKE 〕━━⬣

✅ Bot is now awake
⚡ Commands resumed
🟢 Status : ONLINE

╰━━━━━━━━━━━━━━━━⬣`
        );
    }
};
