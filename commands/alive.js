const os = require("os");

function formatUptime(seconds) {
    seconds = Math.floor(seconds);

    const days = Math.floor(seconds / 86400);
    seconds %= 86400;

    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;

    const minutes = Math.floor(seconds / 60);
    seconds %= 60;

    const parts = [];

    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);

    return parts.join(" ");
}

module.exports = {
    name: "alive",
    aliases: ["up1"],

    run: async ({ reply }) => {

        const uptime = formatUptime(process.uptime());

        await reply(
`╭━━〔 💚 VENOM X ALIVE 〕━━⬣
┃
┃ 🟢 Status : ONLINE
┃ ⚡ Speed : Active
┃ ⏱️ Uptime : ${uptime}
┃ 📱 Platform : WhatsApp
┃ 💻 Host : ${os.platform()}
┃
┃ 🎮 Games : Available
┃ 🤖 VENOM X is running
┃
╰━━━━━━━━━━━━━━━━⬣`
        );

    }
};
