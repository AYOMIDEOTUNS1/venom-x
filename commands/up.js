const botState = require("../lib/botState");
const os = require("os");

function formatUptime(ms) {
    const sec = Math.floor(ms / 1000);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;

    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

module.exports = {
    name: "up",
    aliases: ["wake", "awake", "resume"],

    run: async ({ reply, isOwner }) => {
        if (!isOwner) return reply("❌ Owner only.");

        botState.wakeBot();

        const uptime = formatUptime(process.uptime() * 1000);
        const host = os.platform();

        return reply(
`╭━━〔 💚 VENOM X ALIVE 〕━━⬣
┃
┃ 🟢 Status : ONLINE
┃ ⚡ Speed : Active
┃ ⏱️ Uptime : ${uptime}
┃ 📱 Platform : WhatsApp
┃ 💻 Host : ${host}
┃
┃ 🤖 VENOM X is running
┃
╰━━━━━━━━━━━━━━━━⬣`
        );
    }
};
