const xp = require("./xp");

async function rewardXP({
    sock,
    from,
    message,
    sender,
    amount = 0
}) {
    const result = xp.addXP(sender, amount);

    if (!result.leveledUp) {
        return result;
    }

    await sock.sendMessage(
        from,
        {
            text:
`╭━━〔 🎉 LEVEL UP 〕━━⬣
┃
┃ 👤 @${sender.split("@")[0]}
┃
┃ ⭐ Level : ${result.level}
┃ 🏆 Rank : ${result.rank}
┃
┃ ✨ XP : ${result.xp.toLocaleString()}
┃
┃ 🚀 You've reached a new level!
┃
╰━━━━━━━━━━━━━━━━⬣`,
            mentions: [sender]
        },
        {
            quoted: message
        }
    ).catch(() => {});

    return result;
}

module.exports = rewardXP;
