module.exports = {
    name: "games",
    aliases: ["game"],

    run: async ({ sock, from, message }) => {
        await sock.sendMessage(
            from,
            {
                text:
`╭━━〔 🎮 VENOM X GAMES 〕━━⬣
┃
┃ ⚔️ DUEL
┃ .duel @user <wager>
┃
┃ 🎰 SLOTS
┃ .slots <amount>
┃
┃ 🎲 DICE
┃ .dice <amount>
┃
┃ 🃏 BLACKJACK
┃ .blackjack <amount>
┃
┃ ━━━━━━━━━━━━━━━
┃
┃ ✨ Win games → Earn XP
┃ 💰 Win → Earn VENOM
┃ 📊 .stats → View your records
┃
╰━━━━━━━━━━━━━━━━⬣`
            },
            { quoted: message }
        );
    }
};
