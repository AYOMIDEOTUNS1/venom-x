const economy = require("../lib/economy");
const rewardXP = require("../lib/rewardXP");

const REWARD = 5000;
const XP_REWARD = 150;
const COOLDOWN = 24 * 60 * 60 * 1000;

module.exports = {
    name: "daily",

    run: async ({ sock, from, message, sender }) => {
        const user = economy.get(sender);
        const now = Date.now();

        // =========================
        // COOLDOWN
        // =========================

        if (
            user.daily &&
            now - user.daily < COOLDOWN
        ) {
            const remaining =
                COOLDOWN - (now - user.daily);

            const hours = Math.ceil(
                remaining / (60 * 60 * 1000)
            );

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🎁 DAILY REWARD 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃ ⏳ Already claimed!
┃ 🕐 Come back in : ${hours}h
┃
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                },
                {
                    quoted: message
                }
            );
        }

        // =========================
        // GIVE MONEY
        // =========================

        economy.add(
            sender,
            REWARD
        );

        // =========================
        // SET COOLDOWN
        // =========================

        economy.set(
            sender,
            {
                daily: now
            }
        );

        // =========================
        // GIVE XP
        // =========================

        const xpResult = await rewardXP({
            sock,
            from,
            message,
            sender,
            amount: XP_REWARD
        });

        // =========================
        // UPDATED ACCOUNT
        // =========================

        const updated =
            economy.get(sender);

        // =========================
        // RESULT
        // =========================

        await sock.sendMessage(
            from,
            {
                text:
`╭━━〔 🎁 DAILY REWARD 〕━━⬣
┃
┃ 🎉 @${sender.split("@")[0]}
┃
┃ 🪙 Received : ${REWARD.toLocaleString()} VENOM
┃ ✨ XP Earned : +${XP_REWARD}
┃
┃ ⭐ Level : ${xpResult.level}
┃ 🏆 Rank : ${xpResult.rank}
┃
┃ 💰 Balance : ${updated.balance.toLocaleString()} VENOM
┃
┃ 🔄 Come back tomorrow!
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [sender]
            },
            {
                quoted: message
            }
        );
    }
};
