const economy = require("../lib/economy");

module.exports = {
    name: "withdraw",
    aliases: ["with"],

    run: async ({ sock, from, message, sender, args }) => {
        const amount = Number(args[0]);

        if (!Number.isInteger(amount) || amount <= 0) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🏧 WITHDRAW 〕━━⬣
┃
┃ Usage:
┃ .withdraw <amount>
┃
┃ Example:
┃ .withdraw 10000
┃
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );
        }

        const user = economy.get(sender);
        const bank = user.bank || 0;

        if (bank < amount) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🏧 WITHDRAW 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ ❌ Insufficient bank balance.
┃ 💳 Bank : ${bank.toLocaleString()} VENOM
┃
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                },
                { quoted: message }
            );
        }

        economy.set(sender, {
            bank: bank - amount
        });

        economy.add(sender, amount);

        const updated = economy.get(sender);

        await sock.sendMessage(
            from,
            {
                text:
`╭━━〔 🏧 WITHDRAW SUCCESS 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ 📤 Withdrawn : ${amount.toLocaleString()} VENOM
┃ 💳 Bank : ${updated.bank.toLocaleString()} VENOM
┃ 💰 Wallet : ${updated.balance.toLocaleString()} VENOM
┃
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [sender]
            },
            { quoted: message }
        );
    }
};
