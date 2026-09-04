const botState = require("../lib/botState");

module.exports = {
    name: "sleep",
    aliases: ["pause", "botrest"],

    run: async ({ reply, isOwner }) => {
        if (!isOwner) {
            return reply("❌ Owner only.");
        }

        // Prevent repeatedly putting an already sleeping bot to sleep
        if (typeof botState.isSleeping === "function" && botState.isSleeping()) {
            return reply(
                `╭━━〔 😴 VENOM X 〕━━⬣

⚠️ Bot is already sleeping.

Use #up to wake the bot.

╰━━━━━━━━━━━━━━━━⬣`
            );
        }

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
