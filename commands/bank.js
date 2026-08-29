const economy = require("../lib/economy");

const XP_BANK = 50;

module.exports = {
    name: "bank",
    aliases: ["deposit", "withdraw"],

    run: async ({ sock, from, message, sender, args }) => {
        const user = economy.get(sender);
        const command = String(message?.body || "")
            .trim()
            .split(/\s+/)[0]
            .replace(".", "")
            .toLowerCase();

        // =================================================
        // .BANK
        // =================================================

        if (command === "bank") {
            const capacity = Number(user.bankCapacity) || 1000000;
            const bank = Number(user.bank) || 0;
            const used = Math.min(bank, capacity);
            const available = Math.max(0, capacity - used);

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🏦 VENOM X BANK 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ 💰 Wallet
┃    ${Number(user.balance || 0).toLocaleString()} VENOM
┃
┃ 🏦 Bank
┃    ${bank.toLocaleString()} VENOM
┃
┃ 📦 Capacity
┃    ${capacity.toLocaleString()} VENOM
┃
┃ 📊 Available Space
┃    ${available.toLocaleString()} VENOM
┃
┃ ⬆️ Upgrade
┃    +200,000 capacity
┃
┃ Commands:
┃ .deposit <amount>
┃ .withdraw <amount>
┃ .bankupgrade
┃
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                },
                { quoted: message }
            );
        }

        // =================================================
        // AMOUNT
        // =================================================

        const amount = Number(args?.[0]);

        if (
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🏦 VENOM X BANK 〕━━⬣
┃
┃ ❌ Invalid amount.
┃
┃ Examples:
┃ .deposit 50000
┃ .withdraw 20000
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );
        }

        // =================================================
        // DEPOSIT
        // =================================================

        if (command === "deposit") {
            const capacity =
                Number(user.bankCapacity) || 1000000;

            const currentBank =
                Number(user.bank) || 0;

            const wallet =
                Number(user.balance) || 0;

            if (amount > wallet) {
                return sock.sendMessage(
                    from,
                    {
                        text:
`╭━━〔 🏦 DEPOSIT 〕━━⬣
┃
┃ ❌ Insufficient wallet funds.
┃
┃ 💰 Wallet : ${wallet.toLocaleString()} VENOM
┃ 💵 Requested : ${amount.toLocaleString()} VENOM
╰━━━━━━━━━━━━━━━━⬣`
                    },
                    { quoted: message }
                );
            }

            if (currentBank + amount > capacity) {
                const space =
                    Math.max(0, capacity - currentBank);

                return sock.sendMessage(
                    from,
                    {
                        text:
`╭━━〔 🏦 DEPOSIT 〕━━⬣
┃
┃ ❌ Bank capacity exceeded.
┃
┃ 🏦 Current : ${currentBank.toLocaleString()} VENOM
┃ 📦 Capacity : ${capacity.toLocaleString()} VENOM
┃ 📥 Available : ${space.toLocaleString()} VENOM
┃
┃ ⬆️ Use .bankupgrade
┃ to increase your capacity.
╰━━━━━━━━━━━━━━━━⬣`
                    },
                    { quoted: message }
                );
            }

            economy.add(sender, -amount);

            economy.set(sender, {
                bank: currentBank + amount
            });

            const xpResult =
                economy.addXP(sender, XP_BANK);

            const updated =
                economy.get(sender);

            let levelMessage = "";

            if (xpResult.leveledUp) {
                levelMessage =
                    `\n┃ 🎉 LEVEL UP! → Level ${xpResult.level}`;
            }

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 💳 DEPOSIT SUCCESS 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ 📥 Deposited
┃    ${amount.toLocaleString()} VENOM
┃
┃ 💰 Wallet
┃    ${updated.balance.toLocaleString()} VENOM
┃
┃ 🏦 Bank
┃    ${updated.bank.toLocaleString()} VENOM
┃
┃ 📦 Capacity
┃    ${updated.bankCapacity.toLocaleString()} VENOM
┃
┃ ✨ XP +${XP_BANK}${levelMessage}
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                },
                { quoted: message }
            );
        }

        // =================================================
        // WITHDRAW
        // =================================================

        if (command === "withdraw") {
            const bank =
                Number(user.bank) || 0;

            if (amount > bank) {
                return sock.sendMessage(
                    from,
                    {
                        text:
`╭━━〔 🏦 WITHDRAW 〕━━⬣
┃
┃ ❌ Insufficient bank funds.
┃
┃ 🏦 Bank : ${bank.toLocaleString()} VENOM
┃ 💵 Requested : ${amount.toLocaleString()} VENOM
╰━━━━━━━━━━━━━━━━⬣`
                    },
                    { quoted: message }
                );
            }

            economy.set(sender, {
                bank: bank - amount
            });

            economy.add(sender, amount);

            const xpResult =
                economy.addXP(sender, XP_BANK);

            const updated =
                economy.get(sender);

            let levelMessage = "";

            if (xpResult.leveledUp) {
                levelMessage =
                    `\n┃ 🎉 LEVEL UP! → Level ${xpResult.level}`;
            }

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 💸 WITHDRAW SUCCESS 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ 📤 Withdrawn
┃    ${amount.toLocaleString()} VENOM
┃
┃ 💰 Wallet
┃    ${updated.balance.toLocaleString()} VENOM
┃
┃ 🏦 Bank
┃    ${updated.bank.toLocaleString()} VENOM
┃
┃ ✨ XP +${XP_BANK}${levelMessage}
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                },
                { quoted: message }
            );
        }

        return sock.sendMessage(
            from,
            {
                text:
`❌ Unknown bank action.

Use:
.bank
.deposit <amount>
.withdraw <amount>`
            },
            { quoted: message }
        );
    }
};
