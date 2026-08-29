const economy = require("../lib/economy");
const xp = require("../lib/xp");

module.exports = {
    name: "profile",
    aliases: ["me", "prof"],

    run: async ({ sock, from, message, sender }) => {

        const user = economy.get(sender);
        const progress = xp.getProgress(sender);

        const wallet =
            Number(user.balance) || 0;

        const bank =
            Number(user.bank) || 0;

        const wealth =
            wallet + bank;

        const currentXP =
            progress.xp;

        const nextXP =
            progress.nextLevelXP;

        const remaining =
            progress.remaining;

        await sock.sendMessage(
            from,
            {
                text:
`╭━━〔 👤 VENOM X PROFILE 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ ⭐ Level : ${progress.level}
┃ 🏆 Rank : ${progress.rank}
┃
┃ ✨ XP : ${currentXP.toLocaleString()}
┃ 📈 Next Level : ${nextXP.toLocaleString()} XP
┃ ⏳ Remaining : ${remaining.toLocaleString()} XP
┃
┃ 💵 Wallet : ${wallet.toLocaleString()} VENOM
┃ 🏦 Bank : ${bank.toLocaleString()} VENOM
┃ 💎 Wealth : ${wealth.toLocaleString()} VENOM
┃
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [sender]
            },
            {
                quoted: message
            }
        );
    }
};
