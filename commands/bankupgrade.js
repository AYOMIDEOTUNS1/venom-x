const economy = require("../lib/economy");

const UPGRADE_COST = 100000;
const XP_REWARD = 500;
const CAPACITY_INCREASE = 200000;

module.exports = {
    name: "bankupgrade",
    aliases: ["bupgrade", "upgradebank"],

    run: async ({ sock, from, message, sender }) => {
        const user = economy.get(sender);

        const balance = Number(user.balance) || 0;
        const oldCapacity =
            Number(user.bankCapacity) || 1000000;

        if (balance < UPGRADE_COST) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🏦 BANK UPGRADE 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ ❌ Insufficient funds.
┃
┃ 💰 Your Wallet
┃    ${balance.toLocaleString()} VENOM
┃
┃ 💳 Upgrade Cost
┃    ${UPGRADE_COST.toLocaleString()} VENOM
┃
┃ 📦 Current Capacity
┃    ${oldCapacity.toLocaleString()} VENOM
┃
┃ ⬆️ Capacity Increase
┃    +${CAPACITY_INCREASE.toLocaleString()} VENOM
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                },
                { quoted: message }
            );
        }

        // Pay upgrade cost
        economy.add(sender, -UPGRADE_COST);

        // Increase capacity
        const result = economy.upgradeBank(sender);

        // Give XP
        const xpResult =
            economy.addXP(sender, XP_REWARD);

        const updated =
            economy.get(sender);

        let levelMessage = "";

        if (xpResult.leveledUp) {
            levelMessage =
                `\n┃ 🎉 LEVEL UP → Level ${xpResult.level}`;
        }

        await sock.sendMessage(
            from,
            {
                text:
`╭━━〔 🏦 BANK UPGRADED 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ 🎉 Upgrade successful!
┃
┃ 💳 Cost
┃    ${UPGRADE_COST.toLocaleString()} VENOM
┃
┃ 📦 Old Capacity
┃    ${result.oldCapacity.toLocaleString()} VENOM
┃
┃ ⬆️ Increased
┃    +${CAPACITY_INCREASE.toLocaleString()} VENOM
┃
┃ 🏦 New Capacity
┃    ${result.newCapacity.toLocaleString()} VENOM
┃
┃ 💰 Wallet
┃    ${updated.balance.toLocaleString()} VENOM
┃
┃ ✨ XP +${XP_REWARD}${levelMessage}
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [sender]
            },
            { quoted: message }
        );
    }
};
