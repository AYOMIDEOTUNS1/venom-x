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
    if (days) parts.push(days + "d");
    if (hours) parts.push(hours + "h");
    if (minutes) parts.push(minutes + "m");
    parts.push(seconds + "s");
    return parts.join(" ");
}

module.exports = {
    name: "alive",
    aliases: ["up1"],

    run: async function ({ reply }) {
        const uptime = formatUptime(process.uptime());
        await reply(
"╭━━〔 💚 VENOM X ALIVE 〕━━⬣\n" +
"┃\n" +
"┃ 🟢 Status : ONLINE\n" +
"┃ ⚡ Speed : Active\n" +
"┃ ⏱️ Uptime : " + uptime + "\n" +
"┃ 📱 Platform : WhatsApp\n" +
"┃ 💻 Host : " + os.platform() + "\n" +
"┃\n" +
"┃ 🎮 Games : Available\n" +
"┃ 🤖 VENOM X is running\n" +
"┃\n" +
"╰━━━━━━━━━━━━━━━━⬣"
        );
    }
};
