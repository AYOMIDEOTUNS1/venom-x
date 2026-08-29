const economy = require("../lib/economy");

module.exports = {
    name: "pay",
    aliases: ["give", "transfer"],

    run: async ({ sock, from, message, sender, args }) => {

        // =========================
        // GET REAL MENTION
        // =========================

        const context =
            message?.message?.extendedTextMessage?.contextInfo ||
            message?.message?.imageMessage?.contextInfo ||
            message?.message?.videoMessage?.contextInfo ||
            {};

        const mentioned =
            context.mentionedJid?.[0];

        let targetJid = mentioned || null;

        // =========================
        // FALLBACK: NUMBER
        // =========================

        if (!targetJid && args[0]) {
            const number =
                args[0].replace(/\D/g, "");

            if (number) {
                targetJid =
                    `${number}@s.whatsapp.net`;
            }
        }

        // =========================
        // AMOUNT
        // =========================

        const amount =
            Number(args[1]);

        // =========================
        // USAGE
        // =========================

        if (
            !targetJid ||
            !Number.isInteger(amount) ||
            amount <= 0
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 💸 VENOM PAY 〕━━⬣
┃
┃ Transfer VENOM to another player.
┃
┃ Usage:
┃ .pay @user <amount>
┃
┃ Example:
┃ .pay @user 6000
┃
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );
        }

        // =========================
        // CANONICAL IDs
        // =========================

        const target =
            economy.normalizeId(targetJid);

        const userId =
            economy.normalizeId(sender);

        // =========================
        // SELF PAYMENT
        // =========================

        if (target === userId) {
            return sock.sendMessage(
                from,
                {
                    text:
                        "😂 You can't pay yourself."
                },
                { quoted: message }
            );
        }

        // =========================
        // GET SENDER
        // =========================

        const user =
            economy.get(userId);

        // =========================
        // INSUFFICIENT FUNDS
        // =========================

        if (user.balance < amount) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 💸 PAY FAILED 〕━━⬣
┃
┃ ❌ Insufficient wallet balance.
┃
┃ 💵 Wallet :
┃ ${user.balance.toLocaleString()} VENOM
┃
┃ 💸 Required :
┃ ${amount.toLocaleString()} VENOM
┃
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                },
                { quoted: message }
            );
        }

        // =========================
        // TRANSFER
        // =========================

        economy.add(
            userId,
            -amount
        );

        economy.add(
            target,
            amount
        );

        // =========================
        // UPDATED BALANCE
        // =========================

        const updated =
            economy.get(userId);

        // =========================
        // SUCCESS
        // =========================

        await sock.sendMessage(
            from,
            {
                text:
`╭━━〔 💸 PAYMENT SUCCESS 〕━━⬣
┃
┃ 👤 @${userId.split("@")[0]}
┃
┃ sent VENOM to
┃ 👤 @${target.split("@")[0]}
┃
┃ 💰 Amount :
┃ ${amount.toLocaleString()} VENOM
┃
┃ 💵 Your Wallet :
┃ ${updated.balance.toLocaleString()} VENOM
┃
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [
                    userId,
                    target
                ]
            },
            { quoted: message }
        );
    }
};
