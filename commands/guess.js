const economy = require("../lib/economy");

const MIN_BET = 100;
const MAX_BET = 50000;
const MIN_NUMBER = 1;
const MAX_NUMBER = 10;
const MULTIPLIER = 5;

module.exports = {
    name: "guess",

    run: async ({ sock, from, message, sender, args }) => {
        // .guess <amount> <number>
        if (!args[0] || !args[1]) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🎯 VENOM GUESS 〕━━⬣
┃
┃ 🎮 Guess the secret number!
┃
┃ Usage:
┃ .guess <amount> <number>
┃
┃ Example:
┃ .guess 5000 7
┃
┃ 🎲 Number range : 1 - 10
┃ 💰 Minimum bet : ${MIN_BET.toLocaleString()}
┃ 💰 Maximum bet : ${MAX_BET.toLocaleString()}
┃
┃ 🎉 Correct = ${MULTIPLIER}x payout
┃ 💀 Wrong = lose your bet
╰━━━━━━━━━━━━━━━━⬣`
                },
                { quoted: message }
            );
        }

        const amount = Number(args[0]);
        const guess = Number(args[1]);

        // Validate amount
        if (
            !Number.isInteger(amount) ||
            amount < MIN_BET ||
            amount > MAX_BET
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
`❌ Invalid bet.

💰 Minimum : ${MIN_BET.toLocaleString()} VENOM
💰 Maximum : ${MAX_BET.toLocaleString()} VENOM

Example:
.guess 5000 7`
                },
                { quoted: message }
            );
        }

        // Validate guess
        if (
            !Number.isInteger(guess) ||
            guess < MIN_NUMBER ||
            guess > MAX_NUMBER
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
`❌ Invalid number.

🎲 Choose a number from ${MIN_NUMBER} to ${MAX_NUMBER}.

Example:
.guess 5000 7`
                },
                { quoted: message }
            );
        }

        const user = economy.get(sender);

        // Check wallet
        if (user.balance < amount) {
            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🎯 GUESS 〕━━⬣
┃
┃ 😂 You're too broke!
┃
┃ 💵 Wallet : ${user.balance.toLocaleString()} VENOM
┃ 💸 Bet : ${amount.toLocaleString()} VENOM
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                },
                { quoted: message }
            );
        }

        // Take the bet
        economy.add(sender, -amount);

        // Generate secret number
        const secret =
            Math.floor(
                Math.random() *
                (MAX_NUMBER - MIN_NUMBER + 1)
            ) + MIN_NUMBER;

        // ===================== WIN =====================
        if (guess === secret) {
            const payout = amount * MULTIPLIER;

            economy.add(sender, payout);

            const updated = economy.get(sender);

            return sock.sendMessage(
                from,
                {
                    text:
`╭━━〔 🎯 GUESS WIN 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ 🎯 Your Guess : ${guess}
┃ 🎲 Secret Number : ${secret}
┃
┃ 🎉 CORRECT!
┃
┃ 💰 Bet : ${amount.toLocaleString()} VENOM
┃ 🎯 Multiplier : ${MULTIPLIER}x
┃ 💎 Payout : ${payout.toLocaleString()} VENOM
┃
┃ 💵 Wallet :
┃ ${updated.balance.toLocaleString()} VENOM
╰━━━━━━━━━━━━━━━━⬣`,
                    mentions: [sender]
                },
                { quoted: message }
            );
        }

        // ===================== LOSS =====================
        const updated = economy.get(sender);

        await sock.sendMessage(
            from,
            {
                text:
`╭━━〔 🎯 GUESS RESULT 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ 🎯 Your Guess : ${guess}
┃ 🎲 Number : ${secret}
┃
┃ 💀 WRONG!
┃
┃ 💸 Lost : ${amount.toLocaleString()} VENOM
┃
┃ 💵 Wallet :
┃ ${updated.balance.toLocaleString()} VENOM
┃
┃ 😈 Better luck next time!
╰━━━━━━━━━━━━━━━━⬣`,
                mentions: [sender]
            },
            { quoted: message }
        );
    }
};
