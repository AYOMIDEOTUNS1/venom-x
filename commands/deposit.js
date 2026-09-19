const economy = require("../lib/economy");

module.exports = {
    name: "deposit",
    aliases: ["dep"],

    run: async function ({ sock, from, message, sender, args }) {
        const amount = Number(args[0]);

        if (!Number.isInteger(amount) || amount <= 0) {
            return sock.sendMessage(from, {
                text:
"╭━━〔 🏦 DEPOSIT 〕━━⬣\n" +
"┃\n" +
"┃ Usage:\n" +
"┃ #deposit <amount>\n" +
"┃\n" +
"┃ Example:\n" +
"┃ #deposit 10000\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            }, { quoted: message });
        }

        const user = economy.get(sender);
        const balance = Number(user.balance) || 0;
        const bank = Number(user.bank) || 0;
        const capacity = Number(user.bankCapacity) || 1000000;

        if (balance < amount) {
            return sock.sendMessage(from, {
                text:
"╭━━〔 🏦 DEPOSIT 〕━━⬣\n" +
"┃\n" +
"┃ 👤 @" + sender.split("@")[0] + "\n" +
"┃\n" +
"┃ ❌ Insufficient wallet balance.\n" +
"┃ 💰 Wallet : " + balance.toLocaleString() + " VENOM\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣",
                mentions: [sender]
            }, { quoted: message });
        }

        if (bank + amount > capacity) {
            const space = Math.max(0, capacity - bank);
            return sock.sendMessage(from, {
                text:
"╭━━〔 🏦 DEPOSIT 〕━━⬣\n" +
"┃\n" +
"┃ ❌ Bank capacity full.\n" +
"┃\n" +
"┃ 🏦 Capacity : " + capacity.toLocaleString() + "\n" +
"┃ 💳 Bank : " + bank.toLocaleString() + "\n" +
"┃ 📦 Space left : " + space.toLocaleString() + "\n" +
"┃\n" +
"┃ Use #bankupgrade to increase capacity.\n" +
"╰━━━━━━━━━━━━━━━━⬣"
            }, { quoted: message });
        }

        economy.add(sender, -amount);
        economy.set(sender, { bank: bank + amount });

        const updated = economy.get(sender);

        await sock.sendMessage(from, {
            text:
"╭━━〔 🏦 DEPOSIT SUCCESS 〕━━⬣\n" +
"┃\n" +
"┃ 👤 @" + sender.split("@")[0] + "\n" +
"┃\n" +
"┃ 📥 Deposited : " + amount.toLocaleString() + " VENOM\n" +
"┃ 💳 Bank : " + Number(updated.bank || 0).toLocaleString() + " VENOM\n" +
"┃ 💰 Wallet : " + Number(updated.balance || 0).toLocaleString() + " VENOM\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣",
            mentions: [sender]
        }, { quoted: message });
    }
};
