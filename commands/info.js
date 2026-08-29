const info = {
    coinflip: `╭━━〔 🪙 COINFLIP INFO 〕━━⬣
┃
┃ 🎮 Bet on Heads or Tails.
┃
┃ 💰 Usage:
┃ .coinflip <amount> <heads/tails>
┃
┃ 📝 Example:
┃ .coinflip 7000 heads
┃
┃ 🎯 Win = receive payout
┃ 💸 Lose = lose your bet
┃
╰━━━━━━━━━━━━━━━━⬣`,

    rob: `╭━━〔 🦹 ROB INFO 〕━━⬣
┃
┃ 🎮 Try to steal VENOM from another player.
┃
┃ 💰 Usage:
┃ .rob @user
┃
┃ 💵 Minimum target: 5,000
┃ 💵 Maximum steal: 50,000
┃ ⏳ Cooldown applies
┃
╰━━━━━━━━━━━━━━━━⬣`,

    jail: `╭━━〔 🚔 JAIL INFO 〕━━⬣
┃
┃ 🎮 Jail another player.
┃
┃ 💰 Cost: 5,000 VENOM
┃ ⏱️ Sentence: 60 minutes
┃
┃ 💰 You can go negative
┃ when paying the jail cost.
┃
┃ 🔓 Prisoner:
┃ .escape
┃
╰━━━━━━━━━━━━━━━━⬣`,

    escape: `╭━━〔 🔓 ESCAPE INFO 〕━━⬣
┃
┃ 🎮 Escape from jail.
┃
┃ 💰 Cost: 10,000 VENOM
┃ 🎯 Success chance applies
┃
┃ ❌ Failed escape = fine
┃
╰━━━━━━━━━━━━━━━━⬣`,

    bal: `╭━━〔 💰 BALANCE INFO 〕━━⬣
┃
┃ .bal
┃
┃ Shows:
┃ 💵 Wallet
┃ 🏦 Bank
┃ 💎 Total wealth
┃
╰━━━━━━━━━━━━━━━━⬣`,

    daily: `╭━━〔 🎁 DAILY INFO 〕━━⬣
┃
┃ 🎮 Claim your daily VENOM reward.
┃
┃ 💰 Usage:
┃ .daily
┃
┃ ⏳ You must wait for the
┃ cooldown before claiming again.
┃
╰━━━━━━━━━━━━━━━━⬣`,

    slots: `╭━━〔 🎰 SLOTS INFO 〕━━⬣
┃
┃ 🎮 Spin the slot machine.
┃
┃ 💰 Usage:
┃ .slots <amount>
┃
┃ 📝 Example:
┃ .slots 5000
┃
┃ 💵 Minimum bet: 100
┃ 💵 Maximum bet: 50,000
┃
┃ 🎯 Matching symbols win:
┃
┃ 2 matching = 2x
┃ 3 matching = 5x
┃ 777 = 8x
┃ 💎💎💎 = 10x
┃
┃ 💀 No match = lose bet
╰━━━━━━━━━━━━━━━━⬣`,

dice: `╭━━〔 🎲 DICE INFO 〕━━⬣
┃
┃ 🎮 Guess what number the
┃ dice will roll.
┃
┃ 💰 Usage:
┃ .dice <amount> <1-6>
┃
┃ 📝 Example:
┃ .dice 5000 4
┃
┃ 🎯 Correct guess = 5x
┃ 💀 Wrong guess = lose bet
┃
┃ 💵 Minimum bet: 100
┃ 💵 Maximum bet: 50,000
╰━━━━━━━━━━━━━━━━⬣`,

duel: `╭━━〔 ⚔️ DUEL INFO 〕━━⬣
┃
┃ 🎮 Challenge another player
┃ to a VENOM duel.
┃
┃ 💰 Usage:
┃ .duel @user <amount>
┃
┃ 📝 Example:
┃ .duel @user 5000
┃
┃ 💵 Minimum bet: 100
┃ 💵 Maximum bet: 50,000
┃
┃ ⚔️ Both players stake the
┃ same amount.
┃
┃ 🏆 Winner takes the full pot!
┃ 💀 Loser loses their stake.
╰━━━━━━━━━━━━━━━━⬣`,

guess: `╭━━〔 🎯 GUESS INFO 〕━━⬣
┃
┃ 🎮 Guess the secret number.
┃
┃ 💰 Usage:
┃ .guess <amount> <number>
┃
┃ 📝 Example:
┃ .guess 5000 7
┃
┃ 🎲 Number range: 1 - 10
┃ 💵 Minimum bet: 100
┃ 💵 Maximum bet: 50,000
┃
┃ 🎉 Correct guess = 5x
┃ 💀 Wrong guess = lose bet
╰━━━━━━━━━━━━━━━━⬣`,
};

module.exports = {
    name: "info",
    aliases: ["help", "howto"],

    run: async ({ args, reply }) => {
        const command = args[0]?.toLowerCase();

        if (!command) {
            return reply(
`╭━━〔 🧠 VENOM X HELP 〕━━⬣
┃
┃ Type:
┃ .info <command>
┃
┃ Examples:
┃ .info coinflip
┃ .info rob
┃ .info jail
┃ .info escape
┃ .info daily
┃ .info slots
┃
┃ 💡 Use .economy to see
┃ all economy commands.
╰━━━━━━━━━━━━━━━━⬣`
            );
        }

        if (!info[command]) {
            return reply(
`❌ No info found for "${command}".

💡 Try:
.info coinflip
.info rob
.info jail
.info escape
.info daily
.info slots

📖 Or use:
.economy`
            );
        }

        await reply(info[command]);
    }
};
