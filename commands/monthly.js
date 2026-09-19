const economy = require("../lib/economy");
const rewardXP = require("../lib/rewardXP");

const REWARD = 500000;
const XP_REWARD = 2000;
const COOLDOWN = 30 * 24 * 60 * 60 * 1000;

module.exports = {
    name: "monthly",

    run: async function ({ sock, from, message, sender }) {
        const user = economy.get(sender);
        const now = Date.now();

        if (user.monthly && now - user.monthly < COOLDOWN) {
            const remaining = COOLDOWN - (now - user.monthly);
            const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));

            return sock.sendMessage(from, {
                text:
"╭━━〔 🎁 VENOM MONTHLY 〕━━⬣\n" +
"┃\n" +
"┃ 👤 @" + sender.split("@")[0] + "\n" +
"┃\n" +
"┃ ⏳ Already claimed!\n" +
"┃ 🕐 Come back in : " + days + " days\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣",
                mentions: [sender]
            }, { quoted: message });
        }

        economy.add(sender, REWARD);
        economy.set(sender, { monthly: now });

        const xpResult = await rewardXP({
            sock: sock,
            from: from,
            message: message,
            sender: sender,
            amount: XP_REWARD
        });

        const updated = economy.get(sender);

        await sock.sendMessage(from, {
            text:
"╭━━〔 🎁 VENOM MONTHLY 〕━━⬣\n" +
"┃\n" +
"┃ 🎉 @" + sender.split("@")[0] + "\n" +
"┃\n" +
"┃ 💰 Reward : +" + REWARD.toLocaleString() + " VENOM\n" +
"┃ ✨ XP : +" + XP_REWARD + "\n" +
"┃\n" +
"┃ 💵 Wallet : " + Number(updated.balance || 0).toLocaleString() + " VENOM\n" +
"┃ ⭐ Level : " + (xpResult.level || updated.level || 1) + "\n" +
"┃ 🏆 Rank : " + (xpResult.rank || "🌱 ROOKIE") + "\n" +
"┃\n" +
"┃ 🔄 Come back next month!\n" +
"╰━━━━━━━━━━━━━━━━⬣",
            mentions: [sender]
        }, { quoted: message });
    }
};
