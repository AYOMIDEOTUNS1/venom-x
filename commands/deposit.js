const economy = require("../lib/economy");

module.exports = {
    name: "deposit",
    aliases: ["dep"],

    run: async ({ sock, from, message, sender, args }) => {
        const amount = Number(args[0]);

        if (!Number.isInteger(amount) || amount <= 0) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🏦 DEPOSIT 〕━━⬣
┃
┃ Usage:
┃ .deposit <amount>
┃
┃ Example:
┃ .deposit 10000
┃
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );
        }

        const user = economy.get(sender);

        if (user.balance < amount) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🏦 DEPOSIT 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ ❌ Insufficient wallet balance.
┃ 💰 Wallet : ${user.balance.toLocaleString()} VENOM
┃
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                },
                { quoted: message }
            );
        }

        economy.add(sender, -amount);

        economy.set(sender, {
            bank: (user.bank || 0) + amount
        });

        const updated = economy.get(sender);

        await sock.sendMessage(
            from,
            {
                text:
`╭━━〔 🏦 DEPOSIT SUCCESS 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ 📥 Deposited : ${amount.toLocaleString()} VENOM
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
