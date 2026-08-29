module.exports = {
    name: "economy",
    aliases: ["econ", "money"],

    run: async ({ sock, from, message, reply }) => {
        await reply(
`╭━━〔 💰 VENOM X ECONOMY 〕━━⬣
┃
┃ 💵 MONEY
┃ .bal
┃ .deposit <amount>
┃ .withdraw <amount>
┃ .pay @user <amount>
┃
┃ 🎁 REWARDS
┃ .daily
┃ .weekly
┃ .monthly
┃ .work
┃
┃ 🎮 GAMES
┃ .coinflip <amount> <heads/tails>
┃ .slots <amount>
┃ .dice <amount>
┃ .duel @user <amount>
┃
┃ 🚔 CRIME
┃ .rob @user
┃ .crime
┃ .heist
┃ .jail @user
┃ .escape
┃
┃ 🏆 RANKINGS
┃ .lb
┃ .profile
┃
┃ 🧠 HELP
┃ .info <command>
┃
┃ Example:
┃ .info coinflip
╰━━━━━━━━━━━━━━━━⬣`
        );
    }
};
