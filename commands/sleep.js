const botState = require("../lib/botState");

module.exports = {
    name: "sleep",
    aliases: ["pause", "botrest"],

    run: async ({ reply, isOwner }) => {
        if (!isOwner) return reply("❌ Owner only.");

        botState.sleepBot();

        return reply(
`╭━━〔 😴 VENOM X SLEEP 〕━━⬣

✅ Bot is now sleeping
📵 Commands paused

Use #up to wake the bot

╰━━━━━━━━━━━━━━━━⬣`
        );
    }
};
