const economy = require("../lib/economy");

const REWARD = 150000;
const XP_REWARD = 500;

const COOLDOWN = 7 * 24 * 60 * 60 * 1000;

module.exports = {
    name: "weekly",

    run: async ({ sock, from, message, sender }) => {
        const user = economy.get(sender);
        const now = Date.now();

        if (
            user.weekly &&
            now - user.weekly < COOLDOWN
        ) {
            const remaining =
                COOLDOWN - (now - user.weekly);

            const days = Math.floor(
                remaining / (24 * 60 * 60 * 1000)
            );

            const hours = Math.ceil(
                (remaining % (24 * 60 * 60 * 1000)) /
                (60 * 60 * 1000)
            );

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🎁 VENOM WEEKLY 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ ⏳ Already claimed!
┃ 🕐 Come back in : ${days}d ${hours}h
┃
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                },
                { quoted: message }
            );
        }

        economy.add(sender, REWARD);

        economy.set(sender, {
            weekly: now,
            xp: Number(user.xp || 0) + XP_REWARD
        });

        const updated = economy.get(sender);

        await sock.sendMessage(
            from,
            {
                text:
`╭━━〔 🎁 VENOM WEEKLY 〕━━⬣
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
┃ 🔄 Come back next week!
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [sender]
            },
            { quoted: message }
        );
    }
};
