const economy = require("../lib/economy");

const REWARD = 500000;
const XP_REWARD = 2000;

const COOLDOWN = 30 * 24 * 60 * 60 * 1000;

module.exports = {
    name: "monthly",

    run: async ({ sock, from, message, sender }) => {
        const user = economy.get(sender);
        const now = Date.now();

        if (
            user.monthly &&
            now - user.monthly < COOLDOWN
        ) {
            const remaining =
                COOLDOWN - (now - user.monthly);

            const days = Math.ceil(
                remaining / (24 * 60 * 60 * 1000)
            );

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🎁 VENOM MONTHLY 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ ⏳ Already claimed!
┃ 🕐 Come back in : ${days} days
┃
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                },
                { quoted: message }
            );
        }

        economy.add(sender, REWARD);

        economy.set(sender, {
            monthly: now,
            xp: Number(user.xp || 0) + XP_REWARD
        });

        const updated = economy.get(sender);

        await sock.sendMessage(
            from,
            {
                text:
`╭━━〔 🎁 VENOM MONTHLY 〕━━⬣
┃
┃ 🎉 @${sender.split("@")[0]}
┃
┃ 💰 Reward
┃    +${REWARD.toLocaleString()} VENOM
┃
┃ ✨ XP
┃    +${XP_REWARD} XP
┃
┃ 💵 Wallet
┃    ${updated.balance.toLocaleString()} VENOM
┃
┃ ⭐ Level : ${updated.level}
┃ ✨ XP : ${updated.xp}
┃
┃ 🔄 Come back next month!
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [sender]
            },
            { quoted: message }
        );
    }
};
