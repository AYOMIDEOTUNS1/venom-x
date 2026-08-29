const economy = require("../lib/economy");

module.exports = {
    name: "bal",
    aliases: ["balance", "wallet"],

    run: async ({ sock, from, message, sender }) => {
        const user = economy.get(sender);

        const wallet = Number(user.balance || 0);
        const bank = Number(user.bank || 0);
        const total = wallet + bank;

        await sock.sendMessage(
            from,
            {
                text:
`╭━━〔 💰 VENOM X BALANCE 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ 💵 Wallet Balance
┃    ${wallet.toLocaleString()} VENOM
┃
┃ 🏦 Bank Balance
┃    ${bank.toLocaleString()} VENOM
┃
┃ 💎 Total Wealth
┃    ${total.toLocaleString()} VENOM
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
