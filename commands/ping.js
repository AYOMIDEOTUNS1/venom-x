const os = require("os");

function formatRuntime(seconds) {
    seconds = Math.floor(Number(seconds) || 0);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return (
        String(h).padStart(2, "0") +
        ":" +
        String(m).padStart(2, "0") +
        ":" +
        String(s).padStart(2, "0")
    );
}

module.exports = {
    name: "ping",
    aliases: ["p", "speed"],

    run: async function ({ reply }) {
        const t0 = Date.now();
        // tiny work so speed isn't always 0
        await Promise.resolve();
        const speed = Date.now() - t0;

        return reply(
`╭━━〔 🏓 VENOM X PING 〕━━⬣
┃ ⚡ Speed : ${speed} ms
┃ 🤖 Status : Online
┃ 📡 Platform : Baileys
┃ 💚 Runtime : ${formatRuntime(process.uptime())}
┃ 🖥️ Node : ${process.version}
┃ ⚙️ OS : ${os.platform()}
╰━━━━━━━━━━━━━━━━⬣`
        );
    }
};
